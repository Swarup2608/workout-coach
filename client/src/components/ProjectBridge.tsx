"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ScoreReport } from "@/lib/domain";
import { api } from "@/lib/api";
import { CopyBox, ErrorNote, Spinner } from "@/components/ui";

const FALLBACK_URL = "https://claude.ai/projects";

/**
 * No-API scoring through the user's claude.ai Project:
 * 1) copy a check-in pack + open the Project, 2) paste Claude's reply back to import the score.
 */
export function ProjectBridge({
  kind,
  date,
  onImported,
  title,
  collapsed = false,
}: {
  kind: "week" | "plan";
  date?: string;
  onImported: (r: ScoreReport) => void;
  title?: string;
  /** Start closed (dashboard) */
  collapsed?: boolean;
}) {
  const [projectUrl, setProjectUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  /** The check-in text, shown on screen once built */
  const [text, setText] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<"send" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.profile().then((p) => setProjectUrl(p.claudeProjectUrl ?? "")).catch(() => {});
  }, []);

  const send = async (mode: "open" | "show") => {
    setBusy("send");
    setError(null);
    // Open the tab synchronously-ish so popup blockers allow it.
    const tab = mode === "open" ? window.open("about:blank", "_blank") : null;
    try {
      const pack = await api.handoff(kind, date);
      setText(pack.markdown);
      if (mode === "open") {
        const ok = await navigator.clipboard.writeText(pack.markdown).then(
          () => true,
          () => false,
        );
        setCopied(ok);
        if (tab) tab.location.href = projectUrl || FALLBACK_URL;
      }
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "Could not build the check-in");
    } finally {
      setBusy(null);
    }
  };

  const importReply = async () => {
    setBusy("import");
    setError(null);
    try {
      const r = await api.importReply(kind, reply, date);
      setReply("");
      setCopied(false);
      onImported(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <details className="card group border-volt/40" open={!collapsed}>
      <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="h-display text-lg">
            <span className="mr-2 inline-block text-ink-400 transition group-open:rotate-90">›</span>
            {title ?? (kind === "week" ? "Score this week with Claude" : "Review this plan with Claude")}
          </h2>
          <p className="text-xs text-ink-400">Free: uses your Claude subscription, no API credits.</p>
        </div>
        {!projectUrl && (
          <Link href="/profile" className="text-xs text-warn hover:underline">
            Add your Workout Project link →
          </Link>
        )}
      </summary>

      <details className="mt-4 rounded-lg bg-ink-800/60 px-4 py-3 text-xs text-ink-200">
        <summary className="cursor-pointer text-ink-400">How this works</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            Step 1 builds a <strong>check-in</strong> from your logs ({kind === "week" ? "this week's sets, notes, duration, RPE, cardio and calorie estimates" : "your plan and its volume per muscle"}),
            your profile and the app&apos;s own metrics. It copies that to your clipboard and opens your Claude Project.
          </li>
          <li>You paste it into a new chat there. Claude reviews it as your coach and ends its reply with a small score block.</li>
          <li>
            Step 2: paste Claude&apos;s reply back here. The app reads the score{kind === "week" ? ", advice and Claude's calories per workout" : " and advice"} and saves it to your
            History.
          </li>
          <li>Nothing is sent automatically: you choose what to paste, both ways.</li>
        </ul>
      </details>

      <ol className="mt-4 space-y-4 text-sm">
        <li className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-volt font-display font-bold text-ink-950">1</span>
            <button className="btn btn-primary" onClick={() => send("open")} disabled={busy !== null}>
              {busy === "send" && <Spinner />} Copy check-in & open Claude
            </button>
            <button className="btn btn-ghost" onClick={() => (text ? setText(null) : send("show"))} disabled={busy !== null}>
              {text ? "Hide text" : "Show text"}
            </button>
            {copied && <span className="text-xs text-good">Copied. Start a new chat in the project, paste and send.</span>}
          </div>
          {text && (
            <>
              <p className="text-xs text-ink-400">This is exactly what Claude gets. Copy it and paste it into a new chat in your Claude Project (or any AI).</p>
              <CopyBox text={text} rows={10} label="Copy check-in" />
            </>
          )}
        </li>
        <li className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-volt font-display font-bold text-ink-950">2</span>
            <span>Copy Claude&apos;s whole reply (it ends with a ```json score block) and paste it here:</span>
          </div>
          <textarea className="input h-32 font-mono text-xs" placeholder="Paste Claude's reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
          <button className="btn btn-ghost" onClick={importReply} disabled={reply.trim().length < 10 || busy !== null}>
            {busy === "import" && <Spinner />} Import score
          </button>
        </li>
      </ol>
      <ErrorNote error={error} />
    </details>
  );
}
