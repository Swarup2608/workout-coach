import {
  addDays,
  estimateKcal,
  foodTotals,
  gradeFor,
  sessionKcal,
  type ConstraintFlag,
  type ExerciseProgress,
  type LoggedExercise,
  type PlannedExercise,
  type Profile,
  type SubScore,
  type WeekMetrics,
  type WorkoutPlan,
  type WorkoutSession,
} from "@workout/shared";
import { checkExercise, checkPlan } from "./constraints.js";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Epley estimated 1RM. Bodyweight / timed work falls back to reps. */
export const e1rm = (w: number | null, r: number | null) =>
  w && r ? round1(w * (1 + r / 30)) : null;

const doneSets = (e: LoggedExercise) => e.sets.filter((s) => s.done && (s.reps ?? 0) > 0);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function plannedFor(plan: WorkoutPlan, e: LoggedExercise): PlannedExercise | undefined {
  const all = plan.days.flatMap((d) => d.exercises);
  return all.find((p) => p.id === e.plannedId) ?? all.find((p) => norm(p.name) === norm(e.name));
}

function bestOf(sessions: WorkoutSession[], name: string) {
  let best: number | null = null;
  let reps = 0;
  let found = false;
  for (const s of sessions)
    for (const e of s.exercises)
      if (norm(e.name) === norm(name)) {
        found = true;
        for (const set of doneSets(e)) {
          reps += set.reps ?? 0;
          const v = e.unit === "reps" ? e1rm(set.weightKg, set.reps) : null;
          if (v !== null && (best === null || v > best)) best = v;
        }
      }
  return found ? { best, reps } : null;
}

export function inWeek(sessions: WorkoutSession[], weekStart: string) {
  const end = addDays(weekStart, 6);
  return sessions.filter((s) => s.date >= weekStart && s.date <= end);
}

const hasLoggedData = (s: WorkoutSession) =>
  s.exercises.some((e) => e.sets.some((set) => set.done) || !!e.notes?.trim()) ||
  (s.cardio ?? []).some((c) => c.minutes != null || c.distanceKm != null) ||
  s.cardioMinutes != null || s.durationMin != null || s.sessionRpe != null || s.bodyweightKg != null ||
  !!s.food?.length || s.steps != null || s.waterL != null || s.sleepHours != null || !!s.notes.trim();

/** Latest day with saved information, capped at the requested day. Empty session shells don't extend the report. */
export function latestLoggedDate(sessions: WorkoutSession[], weekStart: string, requestedEnd: string) {
  const latest = inWeek(sessions, weekStart)
    .filter((s) => s.date <= requestedEnd && hasLoggedData(s))
    .reduce<string | null>((latest, s) => (latest == null || s.date > latest ? s.date : latest), null);
  return latest ?? requestedEnd;
}

export function inWeekThrough(sessions: WorkoutSession[], weekStart: string, through: string) {
  return inWeek(sessions, weekStart).filter((s) => s.date <= through);
}

/** Deterministic weekly metrics — the ground truth Claude reasons on top of. */
export function computeWeekMetrics(
  plan: WorkoutPlan,
  allSessions: WorkoutSession[],
  weekStart: string,
  profile: Profile,
  asOf?: string,
): { metrics: WeekMetrics; flags: ConstraintFlag[] } {
  const sessions = asOf ? inWeekThrough(allSessions, weekStart, asOf) : inWeek(allSessions, weekStart);
  const prev = inWeek(allSessions, addDays(weekStart, -7));
  // Mid-week: only judge the planned days that have already happened.
  const elapsed = asOf ? Math.min(7, Math.max(1, Math.floor((Date.parse(asOf) - Date.parse(weekStart)) / 864e5) + 1)) : 7;
  const trainingDays = plan.days.slice(0, elapsed).filter((d) => !d.isRest);

  const plannedSetsByMuscle: Record<string, number> = {};
  for (const d of trainingDays)
    for (const e of d.exercises) plannedSetsByMuscle[e.muscle] = (plannedSetsByMuscle[e.muscle] ?? 0) + e.sets;
  const plannedSets = Object.values(plannedSetsByMuscle).reduce((a, b) => a + b, 0);

  const loggedDays = new Set(sessions.filter((s) => s.exercises.some((e) => doneSets(e).length)).map((s) => s.day));
  const completedSessions = trainingDays.filter((d) => loggedDays.has(d.day)).length;

  const setsByMuscle: Record<string, number> = {};
  let completedSets = 0;
  let inRange = 0;
  let rangeChecked = 0;
  const flags: ConstraintFlag[] = [];
  const names = new Map<string, LoggedExercise>();

  for (const s of sessions)
    for (const e of s.exercises) {
      const ds = doneSets(e);
      if (!ds.length) continue;
      names.set(norm(e.name), e);
      completedSets += ds.length;
      setsByMuscle[e.muscle] = (setsByMuscle[e.muscle] ?? 0) + ds.length;
      const p = plannedFor(plan, e);
      // Only judge the rep range when logging in the same unit the plan uses.
      if (p && p.unit === e.unit)
        for (const set of ds) {
          rangeChecked++;
          if ((set.reps ?? 0) >= p.repMin && (set.reps ?? 0) <= p.repMax + 2) inRange++;
        }
      for (const f of checkExercise(e.name, profile.constraints)) flags.push({ ...f, day: s.day });
    }

  // Progressive overload per exercise vs last week
  const exercises: ExerciseProgress[] = [];
  for (const [key, e] of names) {
    const cur = bestOf(sessions, e.name)!;
    const before = bestOf(prev, e.name);
    const p = plannedFor(plan, e);
    const ds = sessions.flatMap((s) => s.exercises.filter((x) => norm(x.name) === key)).flatMap(doneSets);
    const hitTop = !!p && ds.length > 0 && ds.every((s) => (s.reps ?? 0) >= p.repMax);
    let trend: ExerciseProgress["trend"] = "new";
    if (before) {
      const a = cur.best ?? cur.reps;
      const b = before.best ?? before.reps;
      trend = a > b * 1.01 ? "up" : a < b * 0.97 ? "down" : "flat";
    }
    exercises.push({
      name: e.name,
      muscle: e.muscle,
      bestE1rm: cur.best,
      prevBestE1rm: before?.best ?? null,
      totalReps: cur.reps,
      prevTotalReps: before?.reps ?? null,
      trend,
      hitTopOfRange: hitTop,
      suggestion: hitTop
        ? "Top of range on every set — add 2.5–5% load next week."
        : trend === "down"
          ? "Below last week — check sleep/recovery, hold the load."
          : "Keep the load, aim for +1 rep per set.",
    });
  }

  const rpes = sessions.map((s) => s.sessionRpe).filter((x): x is number => typeof x === "number");
  const avgRpe = rpes.length ? round1(rpes.reduce((a, b) => a + b, 0) / rpes.length) : null;
  const cardioMinutes = sessions.reduce((a, s) => a + (s.cardioMinutes ?? 0), 0);
  const kcal = sessions.reduce((a, s) => a + (sessionKcal(s) ?? estimateKcal(s, profile.startBodyweightKg) ?? 0), 0);
  const bw = [...sessions].reverse().find((s) => s.bodyweightKg)?.bodyweightKg ?? null;

  // ── Sub-scores ──
  const adherence = trainingDays.length ? (completedSessions / trainingDays.length) * 60 + (plannedSets ? Math.min(1, completedSets / plannedSets) * 40 : 0) : 0;
  const compared = exercises.filter((x) => x.trend !== "new");
  const overload = compared.length
    ? (compared.filter((x) => x.trend === "up").length * 100 + compared.filter((x) => x.trend === "flat").length * 60 + compared.filter((x) => x.trend === "down").length * 20) / compared.length
    : exercises.length ? 70 : 0;
  const repQuality = rangeChecked ? (inRange / rangeChecked) * 100 : 0;
  const muscles = Object.keys(plannedSetsByMuscle);
  const balance = muscles.length
    ? (muscles.reduce((a, m) => a + Math.min(1, (setsByMuscle[m] ?? 0) / plannedSetsByMuscle[m]), 0) / muscles.length) * 100
    : 0;
  let recovery = 75;
  if (avgRpe !== null) recovery = avgRpe <= 8.5 && avgRpe >= 6 ? 90 : avgRpe > 9 ? 55 : 70;
  recovery -= flags.length * 10;

  const subScores: SubScore[] = [
    { key: "adherence", label: "Adherence", score: clamp(adherence), detail: `${completedSessions}/${trainingDays.length} sessions, ${completedSets}/${plannedSets} sets` },
    { key: "overload", label: "Progressive overload", score: clamp(overload), detail: compared.length ? `${compared.filter((x) => x.trend === "up").length} of ${compared.length} lifts improved vs last week` : "No previous week to compare yet" },
    { key: "repQuality", label: "Rep-range quality", score: clamp(repQuality), detail: `${inRange}/${rangeChecked} sets inside the target range` },
    { key: "balance", label: "Muscle balance", score: clamp(balance), detail: "Completed vs planned sets per muscle group" },
    { key: "recovery", label: "Recovery & safety", score: clamp(recovery), detail: `Avg RPE ${avgRpe ?? "n/a"}, ${flags.length} constraint flag(s)` },
  ];
  const weights: Record<string, number> = { adherence: 0.35, overload: 0.25, repQuality: 0.15, balance: 0.15, recovery: 0.1 };
  const baseScore = clamp(subScores.reduce((a, s) => a + s.score * weights[s.key], 0));

  return {
    metrics: {
      weekStart,
      weekEnd: asOf ?? addDays(weekStart, 6),
      plannedSessions: trainingDays.length,
      completedSessions,
      completedDays: [...loggedDays],
      plannedSets,
      completedSets,
      inRangeSetPct: rangeChecked ? Math.round((inRange / rangeChecked) * 100) : 0,
      setsByMuscle,
      plannedSetsByMuscle,
      avgRpe,
      cardioMinutes,
      kcal,
      kcalEaten: sessions.reduce((a, s) => a + foodTotals(s.food).kcal, 0),
      steps: sessions.reduce((a, s) => a + (s.steps ?? 0), 0),
      bodyweightKg: bw,
      exercises,
      subScores,
      baseScore,
    },
    flags,
  };
}

/** Heuristic plan quality score (used offline and as context for Claude). */
export function computePlanMetrics(plan: WorkoutPlan, profile: Profile) {
  const training = plan.days.filter((d) => !d.isRest);
  const sets: Record<string, number> = {};
  for (const d of training) for (const e of d.exercises) sets[e.muscle] = (sets[e.muscle] ?? 0) + e.sets;
  const flags = checkPlan(plan.days, profile.constraints);

  // Evidence-based ballpark: ~10–20 hard sets / muscle / week for hypertrophy.
  const major = ["chest", "back", "shoulders", "quads", "hamstrings", "glutes", "biceps", "triceps"];
  const volume = major.reduce((a, m) => {
    const s = sets[m] ?? 0;
    return a + (s >= 10 && s <= 22 ? 100 : s >= 6 ? 70 : s > 22 ? 75 : 30);
  }, 0) / major.length;
  const restDays = plan.days.length - training.length;
  const recovery = restDays >= 1 && restDays <= 3 ? 90 : 60;
  const sessionSizes = training.map((d) => d.exercises.reduce((a, e) => a + e.sets, 0));
  const maxSession = Math.max(0, ...sessionSizes);
  const sessionLoad = maxSession <= 30 ? 90 : maxSession <= 36 ? 70 : 50;
  const safety = clamp(100 - flags.length * 12);

  const subScores: SubScore[] = [
    { key: "volume", label: "Weekly volume", score: clamp(volume), detail: "10–22 sets/week per major muscle is the target band" },
    { key: "recovery", label: "Recovery structure", score: recovery, detail: `${training.length} training days, ${restDays} recovery days` },
    { key: "sessionLoad", label: "Session length", score: sessionLoad, detail: `Largest session: ${maxSession} working sets` },
    { key: "safety", label: "Constraint safety", score: safety, detail: `${flags.length} exercise(s) conflict with your constraints` },
  ];
  const baseScore = clamp(volume * 0.35 + recovery * 0.2 + sessionLoad * 0.2 + safety * 0.25);
  return { setsByMuscle: sets, flags, subScores, baseScore, grade: gradeFor(baseScore) };
}
