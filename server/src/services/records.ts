import { exerciseVolume, nextTimeHint, setLabel, type ExerciseComparison, type LoggedExercise, type PersonalRecord, type WorkoutSession } from "../domain.js";
import { e1rm } from "./metrics.js";

/**
 * Personal records and "vs last time" comparisons. Pure functions over sessions,
 * used by the workout summary and the Progress page.
 */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const done = (e: LoggedExercise) => e.sets.filter((s) => s.done && (s.reps ?? 0) > 0);

interface Best {
  weight: number | null;
  e1rm: number | null;
  /** Most reps in one set at or above the heaviest weight */
  repsAtTop: number | null;
  set: LoggedExercise["sets"][number] | null;
}

function bestOf(e: LoggedExercise): Best {
  const sets = done(e);
  if (!sets.length) return { weight: null, e1rm: null, repsAtTop: null, set: null };
  let bestE: number | null = null;
  let bestSet = sets[0];
  for (const s of sets) {
    const v = e.unit === "reps" ? e1rm(s.weightKg, s.reps) : null;
    if (v != null && (bestE == null || v > bestE)) {
      bestE = v;
      bestSet = s;
    }
  }
  const weights = sets.map((s) => s.weightKg ?? 0);
  const top = Math.max(...weights);
  const repsAtTop = Math.max(...sets.filter((s) => (s.weightKg ?? 0) >= top).map((s) => s.reps ?? 0));
  if (bestE == null) bestSet = sets.reduce((a, s) => ((s.reps ?? 0) > (a.reps ?? 0) ? s : a), sets[0]);
  return { weight: top > 0 ? top : null, e1rm: bestE, repsAtTop, set: bestSet };
}

/** Best values per exercise across a list of sessions. */
function historyBests(sessions: WorkoutSession[]) {
  const out = new Map<string, { weight: number | null; e1rm: number | null; reps: number | null }>();
  for (const s of sessions)
    for (const e of s.exercises) {
      const b = bestOf(e);
      if (!b.set) continue;
      const k = norm(e.name);
      const cur = out.get(k) ?? { weight: null, e1rm: null, reps: null };
      out.set(k, {
        weight: max(cur.weight, b.weight),
        e1rm: max(cur.e1rm, b.e1rm),
        reps: b.weight == null ? max(cur.reps, b.repsAtTop) : cur.reps,
      });
    }
  return out;
}

const max = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.max(a, b));

/** PRs set in `session` compared with everything logged before its date. First-time exercises are not PRs. */
export function recordsIn(session: WorkoutSession, all: WorkoutSession[]): PersonalRecord[] {
  const before = historyBests(all.filter((s) => s.date < session.date && s.status !== "in_progress"));
  const prs: PersonalRecord[] = [];
  for (const e of session.exercises) {
    const b = bestOf(e);
    if (!b.set) continue;
    const prev = before.get(norm(e.name));
    if (!prev) continue;
    const detail = setLabel(b.set, e.unit);
    if (b.weight != null && prev.weight != null && b.weight > prev.weight) {
      prs.push({ exercise: e.name, date: session.date, kind: "weight", value: b.weight, detail, previous: prev.weight });
    } else if (b.e1rm != null && prev.e1rm != null && b.e1rm > prev.e1rm) {
      prs.push({ exercise: e.name, date: session.date, kind: "e1rm", value: b.e1rm, detail, previous: prev.e1rm });
    } else if (b.weight == null && b.repsAtTop != null && prev.reps != null && b.repsAtTop > prev.reps) {
      prs.push({ exercise: e.name, date: session.date, kind: "reps", value: b.repsAtTop, detail, previous: prev.reps });
    }
  }
  return prs;
}

/** Every PR across history, newest first. */
export function allRecords(sessions: WorkoutSession[]): PersonalRecord[] {
  const sorted = sessions.filter((s) => s.status !== "in_progress").sort((a, b) => a.date.localeCompare(b.date));
  return sorted.flatMap((s) => recordsIn(s, sorted)).reverse();
}

/** Per-exercise comparison with the last session that had the same exercise. */
export function compareWithLast(session: WorkoutSession, all: WorkoutSession[]): ExerciseComparison[] {
  const earlier = all.filter((s) => s.date < session.date && s.status !== "in_progress").sort((a, b) => b.date.localeCompare(a.date));
  return session.exercises.map((e) => {
    const b = bestOf(e);
    const prevEx = earlier.flatMap((s) => s.exercises).find((x) => norm(x.name) === norm(e.name) && done(x).length);
    const volume = Math.round(exerciseVolume(e));
    const nextTime = nextTimeHint(e.sets, e.unit);
    if (!prevEx) return { name: e.name, bestSet: b.set ? setLabel(b.set, e.unit) : null, prevBestSet: null, volume, prevVolume: null, trend: "new" as const, nextTime };
    const p = bestOf(prevEx);
    const prevVolume = Math.round(exerciseVolume(prevEx));
    const score = (x: Best) => x.e1rm ?? x.repsAtTop ?? 0;
    const diff = score(b) - score(p) || volume - prevVolume;
    return {
      name: e.name,
      bestSet: b.set ? setLabel(b.set, e.unit) : null,
      prevBestSet: p.set ? setLabel(p.set, prevEx.unit) : null,
      volume,
      prevVolume,
      trend: !b.set ? ("down" as const) : diff > 0 ? ("up" as const) : diff < 0 ? ("down" as const) : ("same" as const),
      nextTime,
    };
  });
}

/** Best e1RM (or reps for bodyweight work) per session for one exercise. */
export function exerciseSeries(sessions: WorkoutSession[], name: string) {
  const k = norm(name);
  const points: { date: string; e1rm: number; best: string }[] = [];
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (s.status === "in_progress") continue;
    const e = s.exercises.find((x) => norm(x.name) === k);
    if (!e) continue;
    const b = bestOf(e);
    if (!b.set) continue;
    points.push({ date: s.date, e1rm: b.e1rm ?? b.repsAtTop ?? 0, best: setLabel(b.set, e.unit) });
  }
  return points;
}
