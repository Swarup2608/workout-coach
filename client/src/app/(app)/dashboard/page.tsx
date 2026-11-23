"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { WEEKDAYS, type Checkin, type Profile, type ScoreReport, type TodayData, type WeekMetrics, type WorkoutPlan } from "@/lib/domain";
import { api, today } from "@/lib/api";
import { ProjectBridge } from "@/components/ProjectBridge";
import { useAuth } from "@/components/AuthProvider";
import { SetupCard } from "@/components/SetupCard";
import { CheckinModal } from "@/components/CheckinModal";
import { NutritionCard } from "@/components/nutrition/NutritionUi";

const CHECKIN_DISMISSED_KEY = "starkfit.checkinDismissed";
import { useCoachContext } from "@/components/coach/CoachProvider";
import { DATA_CHANGED } from "@/components/coach/actions";
import { ActivityCard, InsightCard, MuscleCard, ReadinessCard, RecentCard, StatStrip, VolumeCard, WorkoutCard, addDays, sessionMinutes, sessionVolume, weekStartOf } from "@/components/dashboard/Widgets";
import type { WorkoutSession } from "@/lib/domain";
import { ErrorNote, ScoreReportCard, ScoreRing, Spinner, SubScoreBars, scoreColor } from "@/components/ui";

export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  /** undefined = not loaded yet; null = no check-in today */
  const [checkin, setCheckin] = useState<Checkin | null | undefined>(undefined);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [metrics, setMetrics] = useState<WeekMetrics | null>(null);
  const [weekScores, setWeekScores] = useState<ScoreReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [allSessions, setAllSessions] = useState<WorkoutSession[]>([]);
  useCoachContext("Today", todayData?.planDay ? `${todayData.weekday}: ${todayData.planDay.isRest ? "rest day" : todayData.planDay.title}` : undefined);

  const loadToday = useCallback(() => {
    api.today(today()).then(setTodayData).catch(() => {});
    api.sessions().then(setAllSessions).catch(() => {});
  }, []);

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
    loadToday();
    const reload = () => {
      loadToday();
      load();
    };
    window.addEventListener(DATA_CHANGED, reload);
    return () => window.removeEventListener(DATA_CHANGED, reload);
  }, [loadToday, load]);

  useEffect(() => {
    load();
    api.profile().then(setProfile).catch(() => {});
    api.checkin(today()).then(setCheckin).catch(() => {});
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

  // One card at a time: unfinished setup first, then today's check-in.
  const o = profile?.onboarding;
  const showSetup = !!o && !o.completedAt && !o.skippedAt;
  const needsCheckin = !!profile && !showSetup && checkin === null;

  // Pop the check-in open once a day; closing it without saving won't re-open it until tomorrow.
  useEffect(() => {
    if (!needsCheckin) return;
    let dismissed: string | null = null;
    try {
      dismissed = localStorage.getItem(CHECKIN_DISMISSED_KEY);
    } catch {}
    if (dismissed !== today()) setCheckinOpen(true);
  }, [needsCheckin]);

  const closeCheckin = () => {
    setCheckinOpen(false);
    try {
      localStorage.setItem(CHECKIN_DISMISSED_KEY, today());
    } catch {}
  };

  return (
    <div className="space-y-6">
      {showSetup && <SetupCard profile={profile!} name={user?.name ?? profile!.name} onSkipped={setProfile} />}
      <CheckinModal
        open={checkinOpen}
        initial={checkin ?? todayData?.checkin}
        onClose={closeCheckin}
        onSaved={(c) => {
          setCheckin(c);
          setCheckinOpen(false);
          setJustCheckedIn(true);
          loadToday();
        }}
      />
      {justCheckedIn && (
        <p className="card py-3 text-sm text-good" role="status">
          Checked in for today. Your readiness is updated below.
        </p>
      )}
      {needsCheckin && !checkinOpen && (
        <div className="card flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm">You haven&apos;t checked in today. It takes 20 seconds.</p>
          <button className="btn btn-primary" onClick={() => setCheckinOpen(true)}>Check in now</button>
        </div>
      )}

      <header>
        <h1 className="t-workout text-fg text-3xl md:text-4xl">
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {(user?.name ?? "").split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-ink-400">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </header>

      {todayData && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ReadinessCard checkin={checkin ?? todayData.checkin} onCheckin={() => setCheckinOpen(true)} />
            <WorkoutCard t={todayData} readiness={(checkin ?? todayData.checkin)?.readiness} />
          </div>
          <NutritionCard />
          <div className="grid gap-4 lg:grid-cols-3">
            <ActivityCard weekStart={weekStartOf(today())} sessions={allSessions.filter((x) => x.date >= weekStartOf(today()))} planned={metrics?.plannedSessions} />
            <VolumeCard all={allSessions} today={today()} />
            <MuscleCard metrics={metrics} />
          </div>
          <StatStrip
            volumeKg={allSessions.filter((x) => x.date >= weekStartOf(today())).reduce((a, x) => a + sessionVolume(x), 0)}
            lastVolumeKg={allSessions.filter((x) => x.date >= addDays(weekStartOf(today()), -7) && x.date < weekStartOf(today())).reduce((a, x) => a + sessionVolume(x), 0)}
            workouts={new Set(allSessions.filter((x) => x.date >= weekStartOf(today()) && sessionMinutes(x) > 0).map((x) => x.date)).size}
            planned={metrics?.plannedSessions ?? 0}
            minutes={allSessions.filter((x) => x.date >= weekStartOf(today())).reduce((a, x) => a + sessionMinutes(x), 0)}
            streak={todayData.streak}
          />
          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <InsightCard text={todayData.tip} />
            <RecentCard sessions={allSessions} />
          </div>
        </>
      )}

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-400">{metrics ? `Week of ${metrics.weekStart}` : "Your training"}</p>
          <h2 className="h-display text-3xl">This week</h2>
        </div>
        <div className="flex gap-2">
          {apiConnected && plan && (
            <button className="btn btn-ghost" onClick={quickScore} disabled={busy}>
              {busy && <Spinner />} Quick score
            </button>
          )}
          <Link href="/log" className="btn btn-ghost">
            Log by hand
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
                  href={`/plan?day=${d.day}`}
                  className={`rounded-xl border p-3 text-center transition hover:border-ink-500 ${d.isRest ? "border-ink-700 bg-ink-800/40" : done ? "border-good/50 bg-good/10" : "border-ink-600"}`}
                  title={d.title}
                >
                  <p className="font-display text-sm font-bold uppercase text-fg">{WEEKDAYS[i].slice(0, 3)}</p>
                  <p className="mt-1 text-xs">{d.isRest ? "Rest" : done ? "Done" : "·"}</p>
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
          <Link href="/history" className="text-xs link">
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
      <p className="font-display text-3xl font-bold text-fg" style={color ? { color } : undefined}>
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
