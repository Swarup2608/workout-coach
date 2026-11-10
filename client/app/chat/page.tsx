"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ApiStatus, ChatMessage } from "@workout/shared";
import { api, streamChat } from "@/lib/api";
import { CopyBox, ErrorNote, Spinner } from "@/components/ui";

const QUICK = [
  "How did my week go? Give me my score breakdown.",
  "What weights should I use next week for each lift?",
  "Swap anything in my plan that conflicts with my constraints.",
  "My lower back feels tight after legs day — what should I change?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [projectUrl, setProjectUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [contextText, setContextText] = useState<string | null>(null);

  useEffect(() => {
    api.chat().then(setMessages).catch((e) => setError(e.message));
    api.status().then(setStatus).catch(() => {});
    api.profile().then((p) => setProjectUrl(p.claudeProjectUrl ?? "")).catch(() => {});
  }, []);

  const showContext = async () => {
    if (contextText) return setContextText(null);
    try {
      setContextText((await api.handoff("context")).markdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build context");
    }
  };

  const openProject = async () => {
    const tab = window.open("about:blank", "_blank");
    try {
      const pack = await api.handoff("context");
      setContextText(pack.markdown);
      setCopied(await navigator.clipboard.writeText(pack.markdown).then(() => true, () => false));
      if (tab) tab.location.href = projectUrl || "https://claude.ai/projects";
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "Could not copy context");
    }
  };

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || streaming !== null) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { id: "tmp-" + Date.now(), role: "user", content: msg, createdAt: new Date().toISOString() }]);
    setStreaming("");
    try {
      const final = await streamChat(msg, (t) => setStreaming((s) => (s ?? "") + t));
      setMessages((m) => [...m, final]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setStreaming(null);
    }
  };

  const clear = async () => {
    await api.clearChat();
    setMessages([]);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-sm text-ink-400">Claude sees your plan, logs, scores and constraints</p>
          <h1 className="h-display text-4xl">Coach chat</h1>
        </div>
        {messages.length > 0 && (
          <button className="btn btn-ghost" onClick={clear}>
            Clear chat
          </button>
        )}
      </div>

      {status && !status.claudeConnected && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 border-volt/40">
          <p className="text-sm">
            No API key? Chat in your <strong className="text-white">Claude Workout Project</strong> instead. This copies your latest plan, logs and scores so Claude has them.
          </p>
          <div className="flex items-center gap-3">
            {copied && <span className="text-xs text-good">Copied. Paste it as your first message.</span>}
            <button className="btn btn-ghost" onClick={showContext}>
              {contextText ? "Hide text" : "Show text"}
            </button>
            <button className="btn btn-primary" onClick={openProject}>
              Copy my data & open Claude
            </button>
          </div>
          {contextText && (
            <div className="w-full">
              <CopyBox text={contextText} rows={8} label="Copy my data" />
            </div>
          )}
        </div>
      )}

      <div className="card flex-1 space-y-4 overflow-y-auto">
        {messages.length === 0 && streaming === null && (
          <div className="grid gap-2 sm:grid-cols-2">
            {QUICK.map((q) => (
              <button key={q} className="rounded-xl border border-ink-600 p-3 text-left text-sm hover:border-volt" onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} content={m.content} />
        ))}
        {streaming !== null && (streaming ? <Bubble role="assistant" content={streaming} /> : <div className="flex items-center gap-2 text-sm text-ink-400"><Spinner /> Coach is thinking…</div>)}
        <div ref={bottom} />
      </div>

      <ErrorNote error={error} />

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          className="input h-14 flex-1 resize-none"
          placeholder="Ask about your plan, weights, recovery…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button className="btn btn-primary px-6" disabled={!input.trim() || streaming !== null}>
          Send
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${role === "user" ? "bg-volt text-white" : "border border-ink-700 bg-ink-800"}`}>
        {role === "assistant" ? (
          <div className="prose-chat">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{content}</p>
        )}
      </div>
    </div>
  );
}
