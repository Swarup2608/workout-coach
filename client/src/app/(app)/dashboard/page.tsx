"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { WEEKDAYS, type ScoreReport, type WeekMetrics, type WorkoutPlan } from "@/lib/domain";
import { api, today } from "@/lib/api";
import { ProjectBridge } from "@/components/ProjectBridge";
import { ErrorNote, ScoreReportCard, ScoreRing, Spinner, SubScoreBars, scoreColor } from "@/components/ui";

export default function Dashboard() {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [metrics, setMetrics] = useState<WeekMetrics | null>(null);
  const [weekScores, setWeekScores] = useState<ScoreReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, w] = await Promise.all([api.activePlan(), api.scores("week")]);
      setPlan(p);
      setWeekScores(w.sort((a, b) => (a.weekStart ?? "").localeCompare(b.weekStart ?? "")));
      if (p) setMetrics((await api.weekMetrics(today())).metrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the API. Is the server running on :4000?");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    api.status().then((s) => setApiConnected(s.aiConnected)).catch(() => {});
  }, [load]);

  const quickScore = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.scoreWeek(today());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setBusy(false);
    }
  };

  const latest = weekScores.at(-1);
  const thisWeek =
    latest && metrics && latest.weekStart === metrics.weekStart && latest.metrics?.weekEnd === metrics.weekEnd ? latest : null;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-400">{metrics ? `Week of ${metrics.weekStart}` : "Your training"}</p>
          <h1 className="h-display text-4xl">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          {apiConnected && plan && (
            <button className="btn btn-ghost" onClick={quickScore} disabled={busy}>
              {busy && <Spinner />} Quick score
            </button>
          )}
          <Link href="/log" className="btn btn-primary">
            Log today
          </Link>
        </div>
      </section>

      <ErrorNote error={error} />

      {loaded && !plan && !error && (
        <div className="card text-center">
          <p>No active plan yet.</p>
          <Link href="/plan" className="btn btn-primary mt-4">
            Upload your plan
          </Link>
        </div>
      )}

      {plan && metrics && (
        <>
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Workouts" value={`${metrics.completedSessions}/${metrics.plannedSessions}`} hint="planned days so far" />
            <Stat label="Sets" value={`${metrics.completedSets}/${metrics.plannedSets}`} hint="done vs planned" />
            <Stat
              label="Calories burned"
              value={metrics.kcal ? metrics.kcal.toLocaleString() : "–"}
              hint={metrics.kcalEaten ? `${metrics.kcalEaten.toLocaleString()} eaten this week` : metrics.steps ? `${metrics.steps.toLocaleString()} steps this week` : "this week"}
            />
            {thisWeek ? (
              <Stat label="Week score" value={String(thisWeek.overall)} hint={`grade ${thisWeek.grade}, by Claude`} color={scoreColor(thisWeek.overall)} />
            ) : (
              <Stat label="Live score" value={String(metrics.baseScore)} hint="app estimate" color={scoreColor(metrics.baseScore)} />
            )}
          </section>

          <section className="grid grid-cols-7 gap-2">
            {plan.days.map((d, i) => {
              const done = metrics.completedDays.includes(d.day);
              return (
                <Link
                  key={d.day}
                  href="/log"
                  className={`rounded-xl border p-3 text-center transition hover:border-ink-500 ${d.isRest ? "border-ink-700 bg-ink-800/40" : done ? "border-good/50 bg-good/10" : "border-ink-600"}`}
                  title={d.title}
                >
                  <p className="font-display text-sm font-bold uppercase text-white">{WEEKDAYS[i].slice(0, 3)}</p>
                  <p className="mt-1 text-xs">{d.isRest ? "Rest" : done ? "✓" : "·"}</p>
                </Link>
              );
            })}
          </section>
        </>
      )}

      {plan && <ProjectBridge kind="week" date={today()} onImported={() => load()} collapsed={!!thisWeek} />}

      {thisWeek ? (
        <ScoreReportCard report={thisWeek} />
      ) : (
        metrics && (
          <div className="card">
            <h2 className="h-display mb-4 text-lg">This week so far</h2>
            <SubScoreBars items={metrics.subScores} />
          </div>
        )
      )}

      {weekScores.length > 1 && (
        <div className="card flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ScoreRing score={weekScores.at(-1)!.overall} size={64} />
            <Trend scores={weekScores} />
          </div>
          <Link href="/history" className="text-xs text-volt-bright hover:underline">
            Full history →
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint, color }: { label: string; value: string; hint: string; color?: string }) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className="font-display text-3xl font-bold text-white" style={color ? { color } : undefined}>
        {value}
      </p>
      <p className="text-xs text-ink-400">{hint}</p>
    </div>
  );
}

function Trend({ scores }: { scores: ScoreReport[] }) {
  return (
    <div className="flex h-16 items-end gap-1.5">
      {scores.slice(-8).map((s) => (
        <div key={s.id} className="w-5 rounded-t" style={{ height: `${Math.max(6, s.overall * 0.6)}px`, background: scoreColor(s.overall) }} title={`${s.weekStart}: ${s.overall}`} />
      ))}
    </div>
  );
}
