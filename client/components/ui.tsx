"use client";

import { useRef, useState } from "react";
import { STAT_LABELS, type ScoreReport, type SubScore, type WeekStats } from "@workout/shared";

export const scoreColor = (s: number) => (s >= 80 ? "var(--color-good)" : s >= 60 ? "var(--color-volt)" : s >= 45 ? "var(--color-warn)" : "var(--color-bad)");

export function ScoreRing({ score, grade, size = 132 }: { score: number; grade?: string; size?: number }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-ink-700)" strokeWidth={10} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={scoreColor(score)}
        strokeWidth={10}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .8s ease" }}
      />
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-white font-display" fontSize={size * 0.3} fontWeight={700}>
        {score}
      </text>
      {grade && (
        <text x="50%" y="70%" textAnchor="middle" className="fill-[var(--color-ink-400)] font-display" fontSize={size * 0.12} fontWeight={600}>
          GRADE {grade}
        </text>
      )}
    </svg>
  );
}

export function SubScoreBars({ items }: { items: SubScore[] }) {
  return (
    <ul className="space-y-3">
      {items.map((s) => (
        <li key={s.key}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-ink-200">{s.label}</span>
            <span className="font-display text-base font-bold text-white">{s.score}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-700">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.score}%`, background: scoreColor(s.score) }} />
          </div>
          <p className="mt-1 text-xs text-ink-400">{s.detail}</p>
        </li>
      ))}
    </ul>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className={`mb-2 text-xs font-semibold uppercase tracking-wider ${tone}`}>{title}</h4>
      <ul className="space-y-1.5 text-sm">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className={tone}>•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** Weekly stats tiles on the score card, with Claude's targets where it gave them. */
function StatsGrid({ stats, byClaude }: { stats: WeekStats; byClaude: boolean }) {
  const tiles = STAT_LABELS.filter(({ key }) => stats[key] != null && !(key === "cardioMin" && !stats[key]));
  const kcalTarget = stats.kcalTargetPerDay;
  if (!tiles.length) return null;
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">This week{byClaude ? ", checked by Claude" : ""}</h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(({ key, label, unit, target }) => {
          const v = stats[key] as number;
          const t = target ? (stats[target] as number | null | undefined) : null;
          const signed = key === "kcalNet" || key === "bodyweightChangeKg";
          const tone = key === "kcalNet" ? (v < 0 ? "text-good" : "text-warn") : t ? (v >= t ? "text-good" : "text-warn") : "text-white";
          return (
            <div key={key} className="rounded-xl border border-ink-700 bg-ink-800/40 px-3 py-2">
              <p className="text-[11px] text-ink-400">{label}</p>
              <p className={`font-display text-xl font-bold ${tone}`}>
                {signed && v > 0 ? "+" : ""}
                {fmt(v)}
                {unit && <span className="ml-1 text-xs font-normal text-ink-400">{unit}</span>}
              </p>
              {t ? <p className="text-[11px] text-ink-400">target {fmt(t)}</p> : key === "kcalNet" && <p className="text-[11px] text-ink-400">{v < 0 ? "deficit" : "surplus"}</p>}
            </div>
          );
        })}
        {kcalTarget ? (
          <div className="rounded-xl border border-volt/40 bg-volt/10 px-3 py-2">
            <p className="text-[11px] text-ink-400">Calorie target</p>
            <p className="font-display text-xl font-bold text-volt-bright">
              {fmt(kcalTarget)}
              <span className="ml-1 text-xs font-normal text-ink-400">kcal/day</span>
            </p>
            <p className="text-[11px] text-ink-400">Claude, for next week</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ScoreReportCard({ report }: { report: ScoreReport }) {
  const through = report.metrics?.weekEnd;
  const throughLabel = through
    ? new Date(`${through}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
    : report.weekStart;
  return (
    <div className="card space-y-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <ScoreRing score={report.overall} grade={report.grade} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="h-display text-2xl">
              {report.kind === "plan"
                ? "Plan score"
                : `Week of ${report.weekStart} through ${throughLabel}`}
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${report.source === "offline" ? "bg-ink-700 text-ink-400" : "bg-volt/20 text-volt-bright"}`}>
              {report.source === "claude" ? "Claude API" : report.source === "project" ? "Claude Project" : "Offline score"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed">{report.summary}</p>
          <p className="mt-1 text-xs text-ink-400">{new Date(report.createdAt).toLocaleString()}</p>
        </div>
      </div>
      {report.stats && <StatsGrid stats={report.stats} byClaude={report.source !== "offline"} />}
      <SubScoreBars items={report.subScores} />
      <div className="grid gap-5 md:grid-cols-2">
        <List title="Strengths" items={report.strengths} tone="text-good" />
        <List title="Issues" items={report.issues} tone="text-warn" />
        <List title="Recommendations" items={report.recommendations} tone="text-volt-bright" />
        <List title="Next week adjustments" items={report.nextWeekAdjustments} tone="text-white" />
      </div>
      {report.constraintFlags.length > 0 && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-bad">Constraint conflicts</h4>
          <ul className="space-y-1 text-sm">
            {report.constraintFlags.map((f, i) => (
              <li key={i}>
                <strong className="text-white">{f.exercise}</strong>
                {f.day ? ` (${f.day})` : ""}: {f.constraint} → try <span className="text-good">{f.swaps.slice(0, 2).join(" or ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Read-only text shown on screen with a Copy button (no downloads). */
export function CopyBox({ text, rows = 8, label = "Copy" }: { text: string; rows?: number; label?: string }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard blocked (http, permissions): select the text so Cmd/Ctrl+C works.
      ref.current?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-2">
      <textarea ref={ref} readOnly rows={rows} className="input font-mono text-xs leading-relaxed" value={text} onFocus={(e) => e.currentTarget.select()} />
      <button className="btn btn-ghost" onClick={copy}>
        {copied ? "✓ Copied" : label}
      </button>
    </div>
  );
}

export function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />;
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>;
}
