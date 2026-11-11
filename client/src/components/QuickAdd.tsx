"use client";

import { useEffect, useState } from "react";
import type { WorkoutSession } from "@/lib/domain";
import { api } from "@/lib/api";
import { CopyBox, ErrorNote, Spinner } from "@/components/ui";

/**
 * Describe your day in plain words to any AI using our prompt, paste its JSON back,
 * and the day's log (workout, cardio, food, steps, water, sleep) updates itself.
 */
export function QuickAdd({
  date,
  onImported,
  clearSignal,
}: {
  date: string;
  onImported: (s: WorkoutSession, summary: string) => void;
  /** Changes whenever the day is saved; clears any leftover pasted JSON */
  clearSignal?: unknown;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The prompt includes today's date and your plan, so rebuild it when the date changes.
  useEffect(() => {
    if (!open) return;
    api
      .dayPrompt(date)
      .then((r) => setPrompt(r.text))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not build the prompt"));
  }, [open, date]);

  // Saved (by import or "Update session") or moved to another date: drop the pasted JSON.
  useEffect(() => {
    setReply("");
    setError(null);
  }, [clearSignal, date]);

  const importIt = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await api.importDay(reply, date);
      setReply("");
      setDone(`Added to ${r.session.day}, ${r.session.date}: ${r.summary}.`);
      onImported(r.session, r.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="card group border-volt/40" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer list-none">
        <h2 className="h-display text-lg">
          <span className="mr-2 inline-block text-ink-400 transition group-open:rotate-90">›</span>
          Quick add with AI
        </h2>
        <p className="text-xs text-ink-400">Describe your day in plain words (workout, cardio, food, steps, water, sleep) to any AI and paste back its reply.</p>
      </summary>

      <ol className="mt-4 space-y-5 text-sm">
        <li className="space-y-2">
          <Step n={1}>Copy this prompt into Claude, ChatGPT or any AI. Then type your day after &quot;My day:&quot; and send.</Step>
          {prompt ? <CopyBox text={prompt} rows={7} label="Copy prompt" /> : <p className="text-xs text-ink-400">Building prompt…</p>}
          <p className="text-xs text-ink-400">
            Example: <em>&quot;did arms. ez bar 20kg 3x12, preacher 7.5kg 2x10, hammer 10kg 2x12. 15 min incline walk 3.5 speed 12 incline. breakfast 3 eggs and 2 toast, lunch chicken
            biryani, protein shake after gym. 9k steps, 3L water, slept 6h. left elbow a bit sore&quot;</em>
          </p>
        </li>
        <li className="space-y-2">
          <Step n={2}>Paste the AI&apos;s whole reply here. It updates that date&apos;s log straight away (you can still edit everything below).</Step>
          <textarea className="input h-32 font-mono text-xs" placeholder='Paste the reply with the ```json { "starkfitiqDay": … } block' value={reply} onChange={(e) => setReply(e.target.value)} />
          <button className="btn btn-primary" onClick={importIt} disabled={reply.trim().length < 2 || busy}>
            {busy && <Spinner />} Add to my log
          </button>
          {done && <p className="text-xs text-good">✓ {done}</p>}
        </li>
      </ol>
      <ErrorNote error={error} />
    </details>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-volt font-display font-bold text-ink-950">{n}</span>
      <span>{children}</span>
    </div>
  );
}
