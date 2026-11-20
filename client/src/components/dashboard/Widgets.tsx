"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Checkin, Readiness, TodayData, WeekMetrics, WorkoutSession } from "@/lib/domain";
import { LineChart } from "@/components/LineChart";
import { ScoreRing } from "@/components/ui";
import { MOODS } from "@/components/CheckinCard";
import { Icon, MOOD_ICONS, type IconName } from "@/components/Icons";
import { fmtClock, useElapsed } from "@/components/workout/clock";

/* ── helpers ─────────────────────────────────────────────── */

export const sessionVolume = (s: WorkoutSession) =>
  s.exercises.reduce((a, e) => a + e.sets.reduce((b, x) => b + (x.done && x.weightKg && x.reps ? x.weightKg * x.reps : 0), 0), 0);
export const sessionMinutes = (s: WorkoutSession) => s.durationMin ?? s.cardioMinutes ?? 0;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Monday of the week containing `date` (YYYY-MM-DD). */
export function weekStartOf(date: string) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}
export const addDays = (date: string, n: number) => {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return iso(d);
};

function Card({ title, right, children, className = "" }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-ink-700 bg-ink-900 p-5 ${className}`}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-bold text-fg">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const Segments = ({ value, tone }: { value: number; tone: string }) => (
  <div className="mt-1.5 flex gap-1" aria-hidden>
    {[1, 2, 3, 4, 5].map((i) => (
      <i key={i} className="h-1.5 w-4 rounded-full" style={{ background: i <= value ? tone : "var(--surface-700)" }} />
    ))}
  </div>
);

/* ── Readiness ───────────────────────────────────────────── */

const BAND_TONE: Record<Readiness["band"], string> = { push: "var(--good)", normal: "var(--accent)", light: "var(--warn)" };

export function ReadinessCard({ checkin, onCheckin }: { checkin: Checkin | null; onCheckin?: () => void }) {
  const r = checkin?.readiness;
  const sleep = checkin?.sleep ? { poor: "Poor", ok: "OK", good: "Good" }[checkin.sleep] : "–";
  const mood = MOODS.find((m) => m.value === checkin?.mood);
  const stats: { label: string; icon: IconName; value: number | null | undefined; good: "high" | "low" }[] = [
    { label: "Energy", icon: "zap", value: checkin?.energy, good: "high" },
    { label: "Soreness", icon: "biceps", value: checkin?.soreness, good: "low" },
    { label: "Stress", icon: "brain", value: checkin?.stress, good: "low" },
  ];
  const right = checkin ? (
    <span className="flex items-center gap-3 text-xs">
      {onCheckin && <button type="button" onClick={onCheckin} className="link">Edit</button>}
      <Link href="/checkin" className="link">View details →</Link>
    </span>
  ) : onCheckin ? (
    <button type="button" onClick={onCheckin} className="text-xs link">Check in →</button>
  ) : (
    <Link href="/checkin" className="text-xs link">Check in →</Link>
  );
  return (
    <Card title="Readiness" right={right}>
      {r ? (
        <div className="flex flex-wrap items-center gap-5">
          <ScoreRing score={r.score} size={124} />
          <div className="min-w-0 flex-1">
            <span className="t-badge inline-block rounded-lg px-3 py-1.5 text-sm" style={{ color: BAND_TONE[r.band], background: `color-mix(in srgb, ${BAND_TONE[r.band]} 14%, transparent)` }}>
              {r.label}
            </span>
            <p className="mt-2 text-sm text-ink-400">{r.advice}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 py-6">
          <p className="text-sm text-ink-400">Check in to see how ready you are to train today.</p>
          {onCheckin && <button type="button" onClick={onCheckin} className="btn btn-primary">Check in</button>}
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-ink-700 pt-4 sm:grid-cols-5">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-ink-400"><Icon name={mood ? MOOD_ICONS[mood.value - 1] : "smile"} size={15} /> Mood</p>
          <p className="font-display text-lg font-bold text-fg">{mood?.label ?? "–"}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-ink-400"><Icon name="bed" size={15} /> Sleep</p>
          <p className="font-display text-lg font-bold text-fg">{sleep}</p>
        </div>
        {stats.map((s) => {
          const bad = s.value != null && (s.good === "high" ? s.value <= 2 : s.value >= 4);
          const good = s.value != null && (s.good === "high" ? s.value >= 4 : s.value <= 2);
          return (
            <div key={s.label}>
              <p className="flex items-center gap-1.5 text-xs text-ink-400"><Icon name={s.icon} size={15} /> {s.label}</p>
              <p className="font-display text-lg font-bold text-fg">{s.value != null ? `${s.value}/5` : "–"}</p>
              {s.value != null && <Segments value={s.value} tone={bad ? "var(--bad)" : good ? "var(--good)" : "var(--warn)"} />}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Today's workout ─────────────────────────────────────── */

export function WorkoutCard({ t, readiness }: { t: TodayData; readiness?: Readiness | null }) {
  const elapsed = useElapsed(t.live);
  const pd = t.planDay;
  const doneToday = t.session && t.session.status !== "in_progress" && t.session.exercises.some((e) => e.sets.some((s) => s.done));
  const muscles = pd ? [...new Set(pd.exercises.map((e) => e.muscle))] : [];

  let label = "Today's workout";
  let title = "Train anyway?";
  let sub: ReactNode = null;
  let action: ReactNode = <Link href="/workout/live?day=custom" className="btn btn-primary px-6 py-3">Start empty workout</Link>;

  if (t.live) {
    label = "In progress";
    title = `${t.liveTitle ?? "Workout"}`;
    sub = <p className="mt-2 font-display text-2xl tabular-nums text-fg">{fmtClock(elapsed)}</p>;
    action = <Link href="/workout/live" className="btn btn-primary px-6 py-3">Resume</Link>;
  } else if (doneToday) {
    label = "Done today";
    title = t.sessionTitle ?? "Workout";
    sub = t.session!.durationMin ? <p className="mt-2 text-sm text-ink-200">{t.session!.durationMin} min</p> : null;
    action = <Link href={`/workout/summary/${t.session!.id}`} className="btn btn-ghost px-6 py-3">See summary</Link>;
  } else if (pd && !pd.isRest) {
    title = pd.title;
    sub = (
      <>
        <div className="mt-3 flex flex-wrap gap-2">
          {muscles.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm capitalize text-fg"><Icon name="dumbbell" size={15} />{m}</span>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-200">
          <span className="inline-flex items-center gap-1.5"><Icon name="clock" size={16} /> {t.estMinutes} min</span>
          <span className="mx-2">·</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="layers" size={16} /> {pd.exercises.length} exercises</span>
        </p>
        {readiness?.band === "light" && <p className="mt-2 text-sm text-warn">{readiness.advice}</p>}
      </>
    );
    action = <Link href={`/workout/live?day=${pd.day}`} className="btn btn-primary w-full max-w-xs justify-center gap-2 py-3 text-base"><Icon name="play" size={18} />Start workout</Link>;
  } else if (pd?.isRest) {
    label = "Rest day";
    title = "Recover";
    sub = <p className="mt-2 text-sm text-ink-200">Walk, stretch, sleep well. 10 minutes of mobility helps.</p>;
    action = <Link href="/workout/live?day=custom" className="btn btn-ghost px-6 py-3">Start empty workout</Link>;
  }

  return (
    <section className="relative flex min-h-[260px] overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/media/barbell-floor.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/85 to-transparent" />
      <div className="relative flex w-full flex-col justify-between p-5">
        <div>
          <h2 className="font-display text-sm font-bold text-fg">{label}</h2>
          <p className="t-workout mt-1 text-4xl text-fg">{title}</p>
          {sub}
        </div>
        <div className="mt-4">{action}</div>
      </div>
    </section>
  );
}

/* ── Weekly activity (minutes per day) ───────────────────── */

export function ActivityCard({ weekStart, sessions, planned }: { weekStart: string; sessions: WorkoutSession[]; planned?: number }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const mins = sessions.filter((s) => s.date === date).reduce((a, s) => a + sessionMinutes(s), 0);
    return { date, mins, label: new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" }) };
  });
  const max = Math.max(60, ...days.map((d) => d.mins));
  const done = new Set(sessions.filter((s) => sessionMinutes(s) > 0).map((s) => s.date)).size;
  return (
    <Card title="Weekly Activity" right={<span className="text-xs text-fg">{done}{planned ? `/${planned}` : ""} sessions</span>}>
      <div className="flex h-44 items-end gap-3 border-b border-ink-700 pb-1">
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${d.mins} min`}>
            <div className="w-full max-w-9 rounded-t-md" style={{ height: `${Math.max(d.mins ? 4 : 0, (d.mins / max) * 100)}%`, background: "var(--accent-fill)" }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-xs text-ink-400">
        {days.map((d) => (
          <span key={d.date} className="flex-1 text-center">{d.label}</span>
        ))}
      </div>
    </Card>
  );
}

/* ── Training volume (last 4 weeks) ──────────────────────── */

export function VolumeCard({ all, today }: { all: WorkoutSession[]; today: string }) {
  const start = weekStartOf(today);
  const points = [3, 2, 1, 0].map((n) => {
    const from = addDays(start, -7 * n);
    const to = addDays(from, 6);
    const v = all.filter((s) => s.date >= from && s.date <= to).reduce((a, s) => a + sessionVolume(s), 0);
    return { date: from, value: Math.round(v) };
  });
  return (
    <Card title="Training Volume" right={<span className="text-xs text-ink-400">Last 4 weeks</span>}>
      <LineChart points={points} unit="kg" height={170} label="Weekly training volume" />
    </Card>
  );
}

/* ── Muscle group balance ────────────────────────────────── */

export function MuscleCard({ metrics }: { metrics: WeekMetrics | null }) {
  const rows = metrics
    ? Object.entries(metrics.plannedSetsByMuscle)
        .filter(([, planned]) => planned > 0)
        .map(([m, planned]) => ({ m, pct: Math.min(100, Math.round(((metrics.setsByMuscle[m] ?? 0) / planned) * 100)) }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 6)
    : [];
  return (
    <Card title="Muscle Group Balance">
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.m} className="grid grid-cols-[5rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="capitalize text-ink-200">{r.m}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                <i className="block h-full rounded-full" style={{ width: `${r.pct}%`, background: "var(--accent-fill)" }} />
              </span>
              <span className="text-right tabular-nums text-ink-200">{r.pct}%</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-ink-400">Sets done vs planned per muscle appear once you have a plan.</p>
      )}
    </Card>
  );
}

/* ── KPI strip ───────────────────────────────────────────── */

export function StatStrip({ volumeKg, lastVolumeKg, workouts, planned, minutes, streak }: { volumeKg: number; lastVolumeKg: number; workouts: number; planned: number; minutes: number; streak: number }) {
  const delta = lastVolumeKg > 0 ? Math.round(((volumeKg - lastVolumeKg) / lastVolumeKg) * 100) : null;
  const items: { icon: IconName; label: string; value: string; extra?: ReactNode }[] = [
    { icon: "layers", label: "Weekly Volume", value: `${Math.round(volumeKg).toLocaleString()} kg`, extra: delta != null && <span className={delta >= 0 ? "text-good" : "text-bad"}>{delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%</span> },
    { icon: "dumbbell", label: "Workouts", value: planned ? `${workouts} / ${planned}` : String(workouts), extra: planned ? <span className="text-ink-400">{Math.round((workouts / planned) * 100)}%</span> : null },
    { icon: "clock", label: "Active Minutes", value: `${minutes} min` },
    { icon: "flame", label: "Streak", value: `${streak} day${streak === 1 ? "" : "s"}` },
  ];
  return (
    <section className="grid grid-cols-2 gap-4 rounded-2xl border border-ink-700 bg-ink-900 p-5 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-volt-bright"><Icon name={i.icon} size={22} /></span>
          <div className="min-w-0">
            <p className="text-xs text-ink-400">{i.label}</p>
            <p className="flex items-baseline gap-2 font-display text-xl font-bold text-fg">
              {i.value} <span className="text-xs font-semibold">{i.extra}</span>
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ── Coach insight + recent activity ─────────────────────── */

export function InsightCard({ text }: { text: string | null }) {
  return (
    <Card className="flex flex-col justify-between">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-volt-bright"><Icon name="sparkles" size={16} /> AI Coach Insight</p>
        <p className="font-display mt-2 text-xl font-bold leading-snug text-fg">{text ?? "Log a few sessions and your coach will point out what to work on."}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/plan" className="btn btn-ghost text-sm">View plan adjustments →</Link>
        <Link href="/chat" className="btn btn-ghost text-sm">Ask your coach →</Link>
      </div>
    </Card>
  );
}

export function RecentCard({ sessions }: { sessions: WorkoutSession[] }) {
  const recent = [...sessions].filter((s) => s.exercises.some((e) => e.sets.some((x) => x.done)) || sessionMinutes(s) > 0).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return (
    <Card title="Recent Activity" right={<Link href="/history" className="text-xs link">View all →</Link>}>
      {recent.length ? (
        <ul className="divide-y divide-ink-700">
          {recent.map((s) => (
            <li key={s.id}>
              <Link href={`/workout/summary/${s.id}`} className="flex items-center gap-3 py-2.5 hover:text-fg">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-volt-bright"><Icon name="dumbbell" size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="t-workout block truncate text-base text-fg">{s.title ?? `${s.day} workout`}</span>
                  <span className="block text-xs text-ink-400">
                    {new Date(s.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                    {sessionMinutes(s) ? ` · ${sessionMinutes(s)} min` : ""}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-fg">{Math.round(sessionVolume(s)).toLocaleString()} kg</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-ink-400">No workouts logged yet.</p>
      )}
    </Card>
  );
}
