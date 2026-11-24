"use client";

import Link from "next/link";
import { useState } from "react";
import { unitShort, type GeneratedPlan } from "@/lib/domain";
import { ApiError, api } from "@/lib/api";
import { Icon } from "@/components/Icons";
import { ErrorNote, Spinner } from "@/components/ui";
import { notifyDataChanged } from "@/components/coach/actions";

const SOURCE: Record<GeneratedPlan["source"], string> = { ai: "Written by your AI · passed every check", rules: "Rule-based plan", pasted: "From your pasted reply" };

/**
 * Generate a plan with AI: notes → preview → "Use this plan". Without a key, a prompt to paste into Claude
 * and a box for the reply, checked with the same rules. Nothing is saved until "Use this plan".
 */
export function PlanGenerator({ onSaved }: { onSaved: () => void }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"gen" | "check" | "save" | null>(null);
  const [preview, setPreview] = useState<GeneratedPlan | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [copied, setCopied] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async <T,>(kind: "gen" | "check" | "save", fn: () => Promise<T>) => {
    setBusy(kind);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError && e.code === "setup") setNeedsSetup(true);
      else if (e instanceof ApiError && e.code === "no_ai") setPrompt((await api.planPrompt(notes).catch(() => null))?.text ?? null);
      else setError(e instanceof Error ? e.message : "Something went wrong");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const generate = () =>
    run("gen", async () => {
      setSaved(false);
      setPreview(await api.generatePlan(notes));
    });
  const check = () => run("check", async () => setPreview(await api.checkPlan(reply)));
  const save = () =>
    run("save", async () => {
      await api.uploadPlan(preview!.name, preview!.rawText);
      setSaved(true);
      notifyDataChanged();
      onSaved();
    });
  const copy = async () => setCopied(await navigator.clipboard.writeText(prompt ?? "").then(() => true, () => false));

  return (
    <section className="card space-y-4" aria-label="Generate a plan with AI">
      <div>
        <h2 className="h-display flex items-center gap-2 text-xl">
          <Icon name="sparkles" size={18} /> Generate a plan with AI
        </h2>
        <p className="text-sm text-ink-400">Built from your setup answers (goal, days, session length, equipment, injuries) using exercises from the library. You see it before anything changes.</p>
      </div>

      {needsSetup ? (
        <p className="text-sm">
          Finish your setup first so the plan fits you. <Link href="/onboarding" className="link">Continue setup</Link>
        </p>
      ) : (
        <>
          <div>
            <label className="label" htmlFor="gen-notes">
              Anything to focus on? (optional)
            </label>
            <textarea id="gen-notes" className="input h-20" maxLength={500} placeholder="e.g. bigger arms, keep Fridays short, no jumping" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={!!busy}>
            {busy === "gen" && <Spinner />} {preview ? "Generate again" : "Generate plan"}
          </button>
        </>
      )}

      {prompt && !preview && (
        <div className="space-y-2 rounded-xl border border-warn/40 bg-warn/5 p-3 text-sm">
          <p className="font-medium text-fg">No AI key. Ask Claude instead</p>
          <p className="text-xs text-ink-400">
            Copy this prompt into Claude, then paste its reply below. It gets the same checks. Or add a key under <Link href="/profile#ai" className="link">Profile → AI coach</Link>.
          </p>
          <textarea readOnly className="input h-24 w-full resize-none font-mono text-[11px]" value={prompt} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary px-3 py-1 text-xs" onClick={copy}>
              {copied ? "Copied ✓" : "Copy prompt"}
            </button>
            <button
              className="btn btn-ghost px-3 py-1 text-xs"
              onClick={async () => {
                await copy();
                window.open("https://claude.ai/new", "_blank", "noopener");
              }}
            >
              Copy & open Claude
            </button>
          </div>
          <textarea className="input h-28 w-full text-xs" placeholder="Paste Claude's plan here" value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Claude's reply" />
          <button className="btn btn-primary px-3 py-1.5 text-sm" onClick={check} disabled={!reply.trim() || !!busy}>
            {busy === "check" && <Spinner />} Check plan
          </button>
        </div>
      )}

      <ErrorNote error={error} />

      {preview && (
        <div className="space-y-3 rounded-xl border border-ink-600 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="h-display text-lg">{preview.name}</h3>
            <span className={`text-xs ${preview.source === "rules" || preview.problems.length ? "text-warn" : "text-good"}`}>{SOURCE[preview.source]}</span>
          </div>
          {preview.summary && <p className="text-sm">{preview.summary}</p>}
          {preview.note && <p className="text-xs text-ink-400">{preview.note}</p>}
          {preview.problems.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-warn">
              {preview.problems.slice(0, 8).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <ul className="grid gap-3 md:grid-cols-2">
            {preview.days
              .filter((d) => !d.isRest && d.exercises.length)
              .map((d) => (
                <li key={d.day} className="rounded-lg bg-ink-800/50 p-3">
                  <p className="text-sm font-semibold text-fg">
                    {d.day} · {d.title}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {d.exercises.map((e) => (
                      <li key={e.id} className="flex justify-between gap-2">
                        <span className="truncate">{e.name}</span>
                        <span className="shrink-0 tabular-nums text-ink-400">
                          {e.sets} × {e.repMin}
                          {e.repMax !== e.repMin ? `–${e.repMax}` : ""}
                          {e.unit === "reps" ? "" : ` ${unitShort(e.unit)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
          {saved ? (
            <p className="text-sm text-good" role="status">
              Saved as your active plan. Your old plan stays under All plans.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={save} disabled={!!busy}>
                {busy === "save" && <Spinner />} {preview.problems.length ? "Save anyway" : "Use this plan"}
              </button>
              <button className="btn btn-ghost" onClick={() => setPreview(null)} disabled={!!busy}>
                Discard
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
