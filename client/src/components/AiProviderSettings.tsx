"use client";

import { useEffect, useState } from "react";
import { AI_PROVIDERS, type AiProviderId, type AiSettings } from "@/lib/domain";
import { settingsApi } from "@/lib/api";
import { ErrorNote, Spinner } from "@/components/ui";

/** Bring-your-own-key: each user connects their own chat AI. The key is encrypted server-side and never shown again. */
export function AiProviderSettings() {
  const [saved, setSaved] = useState<AiSettings | null>(null);
  const [provider, setProvider] = useState<AiProviderId>("anthropic");
  const [model, setModel] = useState(AI_PROVIDERS[0].defaultModel);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .ai()
      .then((s) => {
        setSaved(s);
        if (s.configured && s.provider) {
          setProvider(s.provider);
          setModel(s.model ?? "");
          setBaseUrl(s.provider === "custom" ? (s.baseUrl ?? "") : "");
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  const preset = AI_PROVIDERS.find((p) => p.id === provider)!;
  // The saved key is reused only if the provider/endpoint is unchanged.
  const keyReusable = !!saved?.configured && saved.provider === provider && (provider !== "custom" || saved.baseUrl === baseUrl.trim());

  const pickProvider = (id: AiProviderId) => {
    setProvider(id);
    const p = AI_PROVIDERS.find((x) => x.id === id)!;
    setModel(saved?.provider === id && saved.model ? saved.model : p.defaultModel);
    setNote(null);
    setError(null);
  };

  const run = async (kind: "save" | "test" | "remove", fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", async () => {
      const s = await settingsApi.saveAi({ provider, model: model.trim(), baseUrl: provider === "custom" ? baseUrl.trim() : undefined, apiKey: apiKey.trim() || undefined });
      setSaved(s);
      setApiKey("");
      setNote("Key checked and saved. Scores and chat now use this AI.");
    });

  const test = () =>
    run("test", async () => {
      const r = await settingsApi.testAi();
      setNote(`Connected to ${r.label}. Reply: “${r.reply}”`);
    });

  const remove = () =>
    run("remove", async () => {
      if (!confirm("Remove your saved AI key? Scoring will fall back to offline mode.")) return;
      await settingsApi.removeAi();
      setSaved({ configured: false, provider: null, model: null, baseUrl: null, keyHint: null, updatedAt: null });
      setNote("Key removed.");
    });

  return (
    <section id="ai" className="card scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="h-display text-2xl">AI provider</h2>
          <p className="text-sm text-ink-400">Use your own API key from any chat AI. It&apos;s encrypted, only used for your account, and never shown again.</p>
        </div>
        {saved?.configured ? (
          <span className="rounded-full border border-good/40 px-3 py-1 text-xs text-good">
            Connected · {AI_PROVIDERS.find((p) => p.id === saved.provider)?.label} · key ••••{saved.keyHint}
          </span>
        ) : (
          <span className="rounded-full border border-warn/40 px-3 py-1 text-xs text-warn">Not connected (offline scoring)</span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="ai-provider">Provider</label>
          <select id="ai-provider" className="input" value={provider} onChange={(e) => pickProvider(e.target.value as AiProviderId)}>
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ai-model">Model</label>
          <input id="ai-model" className="input" value={model} placeholder={preset.defaultModel || "model name"} onChange={(e) => setModel(e.target.value)} />
        </div>
        {provider === "custom" && (
          <div className="md:col-span-2">
            <label className="label" htmlFor="ai-base">Base URL (OpenAI-compatible)</label>
            <input id="ai-base" className="input" value={baseUrl} placeholder="https://api.together.xyz/v1" onChange={(e) => setBaseUrl(e.target.value)} />
            <p className="mt-1 text-xs text-ink-400">Any API that implements <code>/chat/completions</code> (Together, DeepSeek, xAI, Fireworks, a self-hosted gateway…).</p>
          </div>
        )}
        <div className="md:col-span-2">
          <label className="label" htmlFor="ai-key">API key</label>
          <input
            id="ai-key"
            type="password"
            className="input font-mono"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            placeholder={keyReusable ? `Saved (••••${saved?.keyHint}). Leave empty to keep it.` : "Paste your API key"}
            onChange={(e) => setApiKey(e.target.value)}
          />
          {preset.keyUrl && (
            <p className="mt-1 text-xs text-ink-400">
              Get a key at{" "}
              <a href={preset.keyUrl} target="_blank" rel="noopener noreferrer" className="text-volt-bright hover:underline">
                {new URL(preset.keyUrl).host}
              </a>
              . We make one tiny test request before saving.
            </p>
          )}
        </div>
      </div>

      <ErrorNote error={error} />
      {note && <p className="text-sm text-good">{note}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={save} disabled={!!busy || !model.trim() || (!apiKey.trim() && !keyReusable) || (provider === "custom" && !baseUrl.trim())}>
          {busy === "save" && <Spinner />} Check & save
        </button>
        {saved?.configured && (
          <>
            <button className="btn btn-ghost" onClick={test} disabled={!!busy}>
              {busy === "test" && <Spinner />} Test saved key
            </button>
            <button className="btn btn-ghost hover:!border-bad hover:!text-bad" onClick={remove} disabled={!!busy}>
              Remove key
            </button>
          </>
        )}
      </div>
    </section>
  );
}
