import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  WEEKDAYS,
  addDays,
  exerciseSlug,
  exerciseVolume,
  isLive,
  weekdayOf,
  weekStartOf,
  workoutTitle,
  type PlanDay,
  type Profile,
  type ProgressData,
  type TodayData,
  type WeekGoal,
  type WorkoutPlan,
  type WorkoutSession,
} from "../domain.js";
import { userRepo } from "../repo.js";
import { computeWeekMetrics, latestLoggedDate } from "../services/metrics.js";
import { allRecords, exerciseSeries } from "../services/records.js";
import { plannedDayFor, suggestReshuffle, validateMoves } from "../services/reshuffle.js";
import { alternativesFor, exerciseList, findExercise, restFor } from "../services/exerciseLibrary.js";

/** Read-only views: Today, Progress, and the exercise library. */
export const insights = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const repoOf = (req: Request) => userRepo(req.user!._id);
const dateQ = (req: Request) => {
  const d = String(req.query.date ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10);
};
const trained = (s: WorkoutSession | undefined) => !!s && !isLive(s) && s.exercises.some((e) => e.sets.some((x) => x.done));

/**
 * Consecutive training streak ending today. A trained day adds one; a planned training day with
 * nothing logged breaks it; rest days (and today, until it's over) neither add nor break.
 */
export function streakFor(plan: WorkoutPlan | null, sessions: WorkoutSession[], today: string): number {
  const byDate = new Map(sessions.map((s) => [s.date, s]));
  let streak = trained(byDate.get(today)) ? 1 : 0;
  for (let i = 1; i <= 365; i++) {
    const d = addDays(today, -i);
    if (trained(byDate.get(d))) {
      streak++;
      continue;
    }
    // Without a plan there are no rest days, so any missed day ends the streak.
    const day = plan?.days.find((x) => x.day === weekdayOf(d));
    if (!day?.isRest) break;
  }
  return streak;
}

/** About 2.5 minutes per set, including rest. */
export const estimateMinutes = (day: PlanDay | null) => Math.round((day?.exercises.reduce((a, e) => a + e.sets, 0) ?? 0) * 2.5);

const isTrainingDay = (d: PlanDay | undefined) => !!d && !d.isRest && d.exercises.length > 0;

/** Workouts done this week against the goal. A timed class or run with no sets counts too. */
export function weekGoalFor(plan: WorkoutPlan | null, profile: Pick<Profile, "daysPerWeek">, sessions: WorkoutSession[], today: string): WeekGoal {
  const ws = weekStartOf(today);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const doneDates = new Set(sessions.filter((s) => s.date >= ws && s.date <= dates[6] && (trained(s) || (!isLive(s) && (s.durationMin ?? 0) > 0))).map((s) => s.date));
  const planned = plan ? plan.days.filter(isTrainingDay).length : 0;
  return {
    done: doneDates.size,
    goal: Math.min(7, Math.max(1, planned || profile.daysPerWeek || 3)),
    daysLeft: dates.filter((d) => d > today || (d === today && !doneDates.has(d))).length,
    days: dates.map((d) => ({ date: d, done: doneDates.has(d), planned: isTrainingDay(plan?.days.find((x) => x.day === weekdayOf(d))) })),
  };
}

insights.get("/today", wrap(async (req, res) => {
  const date = dateQ(req);
  const repo = repoOf(req);
  const [plan, profile, all, checkin] = await Promise.all([repo.activePlan(), repo.profile(), repo.sessions(), repo.checkin(date)]);
  const sessions = all.filter((s) => !isLive(s));
  const live = all.find(isLive) ?? null;
  const { planDay, movedFrom } = plannedDayFor(plan, date);

  let tip: string | null = null;
  if (plan) {
    const ws = weekStartOf(date);
    const { metrics } = computeWeekMetrics(plan, sessions, ws, profile, latestLoggedDate(sessions, ws, date));
    const weakest = metrics.completedSets ? [...metrics.subScores].sort((a, b) => a.score - b.score)[0] : null;
    tip = weakest ? `${weakest.label} is your lowest score this week (${weakest.score}/100). ${weakest.detail}` : null;
  }

  const session = all.find((s) => s.date === date) ?? null;
  // Missed workouts a reshuffle could still fit in, not counting ones already moved.
  const shuffle = plan ? suggestReshuffle(plan, sessions, date) : null;
  const toReshuffle = shuffle ? shuffle.moves.filter((m) => !shuffle.applied.some((a) => a.planDay === m.planDay)).length : 0;
  const data: TodayData = {
    date,
    weekday: weekdayOf(date),
    plan: plan ? { id: plan.id, name: plan.name } : null,
    planDay,
    session,
    sessionTitle: session ? (workoutTitle(session, plan) ?? null) : null,
    live,
    liveTitle: live ? (workoutTitle(live, plan) ?? null) : null,
    checkin,
    streak: streakFor(plan, sessions, date),
    tip,
    estMinutes: estimateMinutes(planDay),
    weekGoal: {
      ...weekGoalFor(plan, profile, sessions, date),
      toReshuffle,
    },
    movedFrom,
  };
  res.json(data);
}));

// ── Missed-session reshuffle ─────────────────────────────────
insights.get("/reshuffle", wrap(async (req, res) => {
  const date = dateQ(req);
  const repo = repoOf(req);
  const [plan, all] = await Promise.all([repo.activePlan(), repo.sessions()]);
  if (!plan) return res.status(404).json({ error: "No active plan" });
  res.json(suggestReshuffle(plan, all, date));
}));

const MovesBody = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    moves: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), planDay: z.enum(WEEKDAYS) }).strict()).max(7),
  })
  .strict();

/** Applies moves for the current week (replacing earlier ones). An empty list clears them. */
insights.put("/reshuffle", wrap(async (req, res) => {
  const { date, moves } = MovesBody.parse(req.body);
  const repo = repoOf(req);
  const plan = await repo.activePlan();
  if (!plan) return res.status(404).json({ error: "No active plan" });
  const problem = validateMoves(plan, moves, date);
  if (problem) return res.status(422).json({ error: problem });
  await repo.setWeekMoves(plan.id, moves.length ? { weekStart: weekStartOf(date), moves } : null);
  const fresh = (await repo.activePlan())!;
  res.json(suggestReshuffle(fresh, await repo.sessions(), date));
}));

insights.get("/progress", wrap(async (req, res) => {
  const range = z.coerce.number().int().refine((n) => [30, 90, 365].includes(n)).catch(90).parse(req.query.range);
  const to = dateQ(req);
  const from = addDays(to, -(range - 1));
  const repo = repoOf(req);
  const [plan, all, checkins] = await Promise.all([repo.activePlan(), repo.sessions(), repo.checkins(from, to)]);
  const sessions = all.filter((s) => !isLive(s));
  const inRange = sessions.filter((s) => s.date >= from && s.date <= to);

  // Bodyweight: check-in weight wins over a weight typed on the log for the same day.
  const bw = new Map<string, number>();
  for (const s of inRange) if (s.bodyweightKg) bw.set(s.date, s.bodyweightKg);
  for (const c of checkins) if (c.weightKg) bw.set(c.date, c.weightKg);

  const names = new Map<string, string>();
  for (const s of inRange) for (const e of s.exercises) if (e.unit === "reps" && e.sets.some((x) => x.done)) names.set(exerciseSlug(e.name), e.name);
  const exercises = [...names.entries()]
    .map(([slug, name]) => ({ name, slug, points: exerciseSeries(inRange, name) }))
    .filter((e) => e.points.length)
    .sort((a, b) => b.points.length - a.points.length);

  const month = to.slice(0, 7);
  const lastMonthDate = new Date(`${to.slice(0, 7)}-01T00:00:00Z`);
  lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() - 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);
  const trainedAll = sessions.filter((s) => s.exercises.some((e) => e.sets.some((x) => x.done)) || s.durationMin);

  const data: ProgressData = {
    range,
    bodyweight: [...bw.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, kg]) => ({ date, kg })),
    exercises,
    prs: allRecords(sessions).slice(0, 20),
    calendar: inRange
      .filter((s) => s.exercises.some((e) => e.sets.some((x) => x.done)) || s.durationMin)
      .map((s) => ({ date: s.date, rpe: s.sessionRpe, durationMin: s.durationMin ?? null, title: workoutTitle(s, plan) ?? "Workout" })),
    totals: {
      sessions: inRange.filter((s) => trainedAll.includes(s)).length,
      minutes: inRange.reduce((a, s) => a + (s.durationMin ?? 0), 0),
      volumeKg: Math.round(inRange.reduce((a, s) => a + s.exercises.reduce((b, e) => b + exerciseVolume(e), 0), 0)),
      thisMonth: trainedAll.filter((s) => s.date.startsWith(month)).length,
      lastMonth: trainedAll.filter((s) => s.date.startsWith(lastMonth)).length,
    },
  };
  res.json(data);
}));

insights.get("/exercises", wrap(async (req, res) => {
  const repo = repoOf(req);
  const [plan, sessions] = await Promise.all([repo.activePlan(), repo.sessions()]);
  res.json(exerciseList(plan, sessions));
}));

insights.get("/exercises/:slug", wrap(async (req, res) => {
  const repo = repoOf(req);
  const [plan, sessions, profile] = await Promise.all([repo.activePlan(), repo.sessions(), repo.profile()]);
  const exercise = findExercise(String(req.params.slug), plan, sessions);
  if (!exercise) return res.status(404).json({ error: "Exercise not found" });
  const done = sessions.filter((s) => !isLive(s));
  const history = done
    .flatMap((s) => s.exercises.filter((e) => exerciseSlug(e.name) === exercise.slug && e.sets.some((x) => x.done)).map((e) => ({ date: s.date, sets: e.sets.filter((x) => x.done), unit: e.unit })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  const injuries = profile.injuries ?? [];
  res.json({
    exercise,
    history,
    series: exerciseSeries(done, exercise.name),
    alternatives: alternativesFor(exercise, { equipment: profile.equipmentSetup, injuries }),
    injuryWarning: exercise.stresses.filter((i) => injuries.includes(i)),
    restSec: restFor(exercise.name, profile),
  });
}));
