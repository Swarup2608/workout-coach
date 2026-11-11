import dns from "node:dns/promises";
import net from "node:net";
import Anthropic from "@anthropic-ai/sdk";
import { AI_PROVIDERS, type AiProviderId, type ChatMessage } from "../domain.js";
import { config } from "../config.js";
import type { UserDoc } from "../db.js";
import { decryptSecret } from "../auth/secretBox.js";

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool's input */
  schema: Record<string, unknown>;
}

/** One chat AI, whichever provider the user picked. */
export interface AiClient {
  label: string;
  /** Forces a single tool call and returns its arguments (structured output). */
  structured(opts: { system: string; prompt: string; tool: ToolSpec; maxTokens: number }): Promise<unknown>;
  /** Streams plain text; resolves with the full reply. */
  stream(opts: { system: string; messages: Pick<ChatMessage, "role" | "content">[]; maxTokens: number; onText: (t: string) => void }): Promise<string>;
}

export interface AiConfig {
  provider: AiProviderId;
  model: string;
  baseUrl: string;
  apiKey: string;
}

const TIMEOUT_MS = 120_000;
const preset = (id: AiProviderId) => AI_PROVIDERS.find((p) => p.id === id)!;
export const aiLabel = (provider: AiProviderId, model: string) => `${preset(provider).label.replace(/ \(.*\)$/, "")} · ${model}`;

/** The signed-in user's AI client, or null when they haven't added a key (app falls back to offline scoring). */
export function aiForUser(user: UserDoc): AiClient | null {
  if (!user.ai) return null;
  return makeClient({ provider: user.ai.provider, model: user.ai.model, baseUrl: user.ai.baseUrl, apiKey: decryptSecret(user.ai.keyEnc, user._id) });
}

export function makeClient(c: AiConfig): AiClient {
  return preset(c.provider).api === "anthropic" ? anthropicClient(c) : openAiCompatibleClient(c);
}

// ── Anthropic (Messages API) ─────────────────────────────────
function anthropicClient(c: AiConfig): AiClient {
  const sdk = new Anthropic({ apiKey: c.apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
  return {
    label: aiLabel(c.provider, c.model),
    async structured({ system, prompt, tool, maxTokens }) {
      const res = await sdk.messages.create({
        model: c.model,
        max_tokens: maxTokens,
        system,
        tools: [{ name: tool.name, description: tool.description, input_schema: tool.schema as Anthropic.Tool.InputSchema }],
        tool_choice: { type: "tool", name: tool.name },
        messages: [{ role: "user", content: prompt }],
      });
      const block = res.content.find((b) => b.type === "tool_use");
      if (!block || block.type !== "tool_use") throw new Error("The AI returned no structured result");
      return block.input;
    },
    async stream({ system, messages, maxTokens, onText }) {
      const s = sdk.messages.stream({ model: c.model, max_tokens: maxTokens, system, messages: messages.map((m) => ({ role: m.role, content: m.content })) });
      s.on("text", onText);
      const final = await s.finalMessage();
      return final.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    },
  };
}

// ── OpenAI Chat Completions format (OpenAI, Gemini, Groq, Mistral, OpenRouter, custom) ──
function openAiCompatibleClient(c: AiConfig): AiClient {
  const url = c.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  // OpenAI's newer models reject max_tokens; most compatible APIs only know max_tokens.
  const limit = (n: number) => (c.provider === "openai" ? { max_completion_tokens: n } : { max_tokens: n });

  const post = async (body: Record<string, unknown>) => {
    if (c.provider === "custom") await assertPublicUrl(c.baseUrl);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}` },
      body: JSON.stringify({ model: c.model, ...body }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Never follow redirects: a custom endpoint could otherwise bounce us into the private network.
      redirect: "error",
    });
    if (!res.ok) throw new Error(`${aiLabel(c.provider, c.model)} error ${res.status}: ${await errorText(res)}`);
    return res;
  };

  return {
    label: aiLabel(c.provider, c.model),
    async structured({ system, prompt, tool, maxTokens }) {
      const res = await post({
        ...limit(maxTokens),
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.schema } }],
        tool_choice: { type: "function", function: { name: tool.name } },
      });
      const data = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: { function?: { arguments?: string } }[] } }[] };
      const msg = data.choices?.[0]?.message;
      const args = msg?.tool_calls?.[0]?.function?.arguments ?? extractJson(msg?.content ?? "");
      if (!args) throw new Error("The AI returned no structured result");
      try {
        return JSON.parse(args);
      } catch {
        throw new Error("The AI returned malformed JSON");
      }
    },
    async stream({ system, messages, maxTokens, onText }) {
      const res = await post({
        ...limit(maxTokens),
        stream: true,
        messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
      });
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (payload === "[DONE]") return full;
          try {
            const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              full += delta;
              onText(delta);
            }
          } catch {
            // keep-alive or partial line
          }
        }
      }
      return full;
    },
  };
}

const extractJson = (s: string) => s.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? (s.trim().startsWith("{") ? s.trim() : null);

async function errorText(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text);
    return String(j?.error?.message ?? j?.message ?? j?.error ?? text).slice(0, 300);
  } catch {
    return text.slice(0, 300) || res.statusText;
  }
}

/** Tiny round trip to check a key/model works before saving it. */
export async function testClient(ai: AiClient) {
  const reply = await ai.stream({ system: "You are a connectivity check.", messages: [{ role: "user", content: "Reply with the single word: OK" }], maxTokens: 16, onText: () => {} });
  return reply.trim().slice(0, 40);
}

// ── SSRF guard for user-supplied base URLs ───────────────────
const blocked = new net.BlockList();
for (const [net4, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) blocked.addSubnet(net4, bits, "ipv4");
for (const [net6, bits] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) blocked.addSubnet(net6, bits, "ipv6");

const isPrivate = (ip: string) => {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return blocked.check(mapped, "ipv4");
  return blocked.check(ip, net.isIPv6(ip) ? "ipv6" : "ipv4");
};

/** Rejects non-HTTPS URLs and hosts that resolve to private, loopback or link-local addresses (cloud metadata etc.). */
export async function assertPublicUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Base URL is not a valid URL");
  }
  if (u.username || u.password) throw new Error("Base URL must not contain credentials");
  if (config.allowPrivateAiUrls) {
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("Base URL must use http or https");
    return;
  }
  if (u.protocol !== "https:") throw new Error("Base URL must use https");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true, verbatim: true }).catch(() => [])).map((a) => a.address);
  if (!addrs.length) throw new Error("Base URL host could not be resolved");
  if (addrs.some(isPrivate)) throw new Error("Base URL points to a private network address");
}
