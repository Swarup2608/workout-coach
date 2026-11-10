"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  cardioText,
  estimateKcal,
  exerciseVolume,
  foodTotals,
  sessionKcal,
  unitShort,
  weekStartOf,
  workoutTitle,
  type ExerciseProgress,
  type Profile,
  type ScoreReport,
  type WorkoutPlan,
  type WorkoutSession,
} from "@workout/shared";
import { api, today } from "@/lib/api";
import { ErrorNote, scoreColor } from "@/components/ui";

const doneSets = (s: WorkoutSession) => s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
const volume = (s: WorkoutSession) => s.exercises.reduce((a, e) => a + exerciseVolume(e), 0);
const hasLoggedData = (s: WorkoutSession) =>
  doneSets(s) > 0 ||
  s.exercises.some((e) => !!e.notes?.trim()) ||
  (s.cardio ?? []).some((c) => c.minutes != null || c.distanceKm != null) ||
  s.cardioMinutes != null || s.durationMin != null || s.sessionRpe != null || s.bodyweightKg != null ||
  !!s.food?.length || s.steps != null || s.waterL != null || s.sleepHours != null || !!s.notes.trim();
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export default function HistoryPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [scores, setScores] = useState<ScoreReport[]>([]);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lifts, setLifts] = useState<ExerciseProgress[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.sessions(), api.scores("week"), api.activePlan(), api.profile()])
      .then(async ([s, sc, p, pr]) => {
        setSessions(s);
        setScores(sc);
        setPlan(p);
        setProfile(pr);
        if (p) setLifts((await api.weekMetrics(today())).metrics.exercises);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoaded(true));
  }, []);

  /** Calories per session: Claude's number if imported, else the app estimate. */
  const kcalOf = (s: WorkoutSession) => sessionKcal(s) ?? estimateKcal(s, profile?.startBodyweightKg ?? null) ?? 0;

  const weeks = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    for (const s of [...sessions].sort((a, b) => b.date.localeCompare(a.date))) {
      const ws = weekStartOf(s.date);
      map.set(ws, [...(map.get(ws) ?? []), s]);
    }
    return [...map.entries()].map(([weekStart, list]) => {
      const lastLoggedDate = list.filter(hasLoggedData).reduce((latest, s) => (s.date > latest ? s.date : latest), "");
      const savedScore = scores.find((x) => x.weekStart === weekStart) ?? null;
      const score = savedScore?.metrics?.weekEnd && (!lastLoggedDate || savedScore.metrics.weekEnd > lastLoggedDate) ? null : savedScore;
      return {
        weekStart,
        list,
        kcal: list.reduce((a, s) => a + kcalOf(s), 0),
        sets: list.reduce((a, s) => a + doneSets(s), 0),
        eaten: list.reduce((a, s) => a + foodTotals(s.food).kcal, 0),
        steps: list.reduce((a, s) => a + (s.steps ?? 0), 0),
        score,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, scores, profile]);

  const totals = {
    workouts: sessions.filter((s) => doneSets(s) > 0).length,
    kcal: weeks.reduce((a, w) => a + w.kcal, 0),
    sets: weeks.reduce((a, w) => a + w.sets, 0),
    volume: sessions.reduce((a, s) => a + volume(s), 0),
  };
  const maxKcal = Math.max(1, ...weeks.map((w) => w.kcal));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-400">Every workout you&apos;ve logged</p>
        <h1 className="h-display text-4xl">History</h1>
      </div>

      <ErrorNote error={error} />

      {loaded && !sessions.length && !error && (
        <div className="card text-center">
          <p>Nothing logged yet.</p>
          <Link href="/log" className="btn btn-primary mt-4">
            Log your first workout
          </Link>
        </div>
      )}

      {sessions.length > 0 && (
        <>
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Tile label="Workouts" value={totals.workouts.toLocaleString()} />
            <Tile label="Calories burned" value={totals.kcal.toLocaleString()} unit="kcal" />
            <Tile label="Sets" value={totals.sets.toLocaleString()} />
            <Tile label="Volume lifted" value={Math.round(totals.volume).toLocaleString()} unit="kg" />
          </section>

          <section className="card">
            <h2 className="h-display mb-4 text-lg">Calories per week</h2>
            <div className="flex h-32 items-end gap-2">
              {[...weeks].reverse().slice(-12).map((w) => (
                <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1" title={`Week of ${w.weekStart}: ${w.kcal} kcal`}>
                  <span className="text-[10px] text-ink-400">{w.kcal}</span>
                  <div className="w-full max-w-10 rounded-t bg-volt" style={{ height: `${Math.max(4, (w.kcal / maxKcal) * 88)}px` }} />
                  <span className="text-[10px] text-ink-400">{w.weekStart.slice(5)}</span>
                </div>
              ))}
            </div>
          </section>

          {lifts.length > 0 && (
            <details className="card">
              <summary className="h-display cursor-pointer text-lg">Lift progress: this week vs last</summary>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-ink-400">
                    <tr>
                      <th className="pb-2">Exercise</th>
                      <th className="pb-2">This week</th>
                      <th className="pb-2">Last week</th>
                      <th className="pb-2">Next step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lifts.map((e) => (
                      <tr key={e.name} className="border-t border-ink-700">
                        <td className="py-2 text-white">
                          {e.name} <span className={`ml-1 text-xs ${e.trend === "up" ? "text-good" : e.trend === "down" ? "text-bad" : "text-ink-400"}`}>{{ up: "▲", down: "▼", flat: "●", new: "new" }[e.trend]}</span>
                        </td>
                        <td>{e.bestE1rm ? `${e.bestE1rm} kg e1RM` : `${e.totalReps} total`}</td>
                        <td className="text-ink-400">{e.prevBestE1rm ? `${e.prevBestE1rm} kg` : e.prevTotalReps ?? "—"}</td>
                        <td className="text-xs text-ink-400">{e.suggestion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {weeks.map((w) => (
            <section key={w.weekStart} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                <h2 className="h-display text-lg">
                  Week of {fmtDate(w.weekStart)} – {fmtDate(addDays(w.weekStart, 6))}
                </h2>
                <p className="text-xs text-ink-400">
                  {w.list.length} day{w.list.length === 1 ? "" : "s"} · {w.sets} sets · {w.kcal.toLocaleString()} kcal burned
                  {w.eaten > 0 && ` · ${w.eaten.toLocaleString()} eaten`}
                  {w.steps > 0 && ` · ${w.steps.toLocaleString()} steps`}
                  {w.score && (
                    <span className="ml-2 font-display text-sm font-bold" style={{ color: scoreColor(w.score.overall) }}>
                      Score {w.score.overall} ({w.score.grade})
                    </span>
                  )}
                </p>
              </div>
              <div className="card divide-y divide-ink-700 p-0">
                {w.list.map((s) => (
                  <SessionRow key={s.id} s={s} title={workoutTitle(s, plan)} kcal={kcalOf(s)} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <p className="text-xs text-ink-400">
        Calories: Claude&apos;s estimate when you&apos;ve imported a weekly check-in, otherwise the app&apos;s estimate from duration, effort, cardio and bodyweight. Everything is
        stored on your computer in <code>server/data/db.json</code>.
      </p>
    </div>
  );
}

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className="font-display text-3xl font-bold text-white">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-ink-400">{unit}</span>}
      </p>
    </div>
  );
}

function SessionRow({ s, title, kcal }: { s: WorkoutSession; title?: string; kcal: number }) {
  const hasNotes = !!s.notes || s.exercises.some((e) => e.notes);
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 hover:bg-ink-800/40">
        <span className="w-32 font-semibold text-white">{fmtDate(s.date)}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink-400">
          {title ?? `${s.exercises.length} exercises`}
          {s.planDay && <span className="ml-2 rounded-full bg-volt/20 px-2 py-0.5 text-[10px] text-volt-bright">{s.planDay === "custom" ? "own workout" : `changed: ${s.planDay}'s workout`}</span>}
        </span>
        <span className="text-sm">
          {doneSets(s)} sets{s.durationMin ? ` · ${s.durationMin} min` : ""}
        </span>
        <span className="w-28 text-right text-sm">
          <strong className="text-white">{kcal}</strong> kcal{" "}
          <span className="text-[10px] uppercase text-ink-400">{s.kcalClaude ? "Claude" : "est."}</span>
        </span>
        <span className="w-4 text-ink-400" title={hasNotes ? "Has notes" : undefined}>
          {hasNotes ? "✎" : ""}
        </span>
      </summary>
      <div className="space-y-2 px-5 pb-4 text-sm">
        {s.notes && <p className="rounded-lg bg-ink-800/60 px-3 py-2 text-ink-200">{s.notes}</p>}
        <ul className="space-y-1">
          {s.exercises.map((e, i) => (
            <li key={i}>
              <span className="text-white">{e.name}</span>{" "}
              <span className="text-ink-400">
                {e.sets
                  .filter((x) => x.done)
                  .map((x) => `${x.weightKg ?? "BW"}×${x.reps}${e.unit === "reps" ? "" : unitShort(e.unit)}${x.negatives ? `+${x.negatives}n` : ""}`)
                  .join(", ") || "skipped"}
                {e.perSide && <span className="text-xs"> (each side)</span>}
              </span>
              {e.notes && <span className="ml-2 text-xs italic text-ink-400">({e.notes})</span>}
            </li>
          ))}
          {(s.cardio ?? []).map((c, i) => (
            <li key={`c${i}`}>
              <span className="text-white">Cardio</span> <span className="text-ink-400">{cardioText(c)}</span>
            </li>
          ))}
        </ul>
        {!!s.food?.length && (
          <div>
            <p className="text-white">
              Food <span className="text-ink-400">· {foodTotals(s.food).kcal} kcal · {foodTotals(s.food).proteinG} g protein</span>
            </p>
            <ul className="text-ink-400">
              {s.food.map((f, i) => (
                <li key={i}>
                  {f.meal && <span className="capitalize">{f.meal}: </span>}
                  {f.name} ({f.kcal ?? "?"} kcal)
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-ink-400">
          {[
            s.steps != null && `${s.steps.toLocaleString()} steps`,
            s.waterL != null && `${s.waterL} L water`,
            s.sleepHours != null && `${s.sleepHours} h sleep`,
            s.sessionRpe && `RPE ${s.sessionRpe}`,
            !s.cardio?.length && s.cardioMinutes && `${s.cardioMinutes} min cardio`, s.bodyweightKg && `BW ${s.bodyweightKg} kg`, `${Math.round(volume(s)).toLocaleString()} kg volume`]
            .filter(Boolean)
            .join(" · ")}
          <Link href={`/log?date=${s.date}`} className="ml-3 text-volt-bright hover:underline">
            Edit
          </Link>
        </p>
      </div>
    </details>
  );
}
