import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  WEEKDAYS,
  estimateKcal,
  exerciseVolume,
  guessEquipment,
  isLive,
  sessionElapsedMs,
  sessionKcal,
  weekdayOf,
  workoutTitle,
  type LoggedExercise,
  type Profile,
  type WorkoutPlan,
  type WorkoutSession,
  type WorkoutSummary,
} from "../domain.js";
import { userRepo, type UserRepo } from "../repo.js";
import { newId, now } from "../util/id.js";
import { classifyMuscle } from "../services/muscles.js";
import { compareWithLast, recordsIn } from "../services/records.js";

/**
 * Live workouts: a session with status "in_progress" and server timestamps.
 * The clock is always startedAt → now (or endedAt) minus paused time, so it survives reloads.
 * One live workout per user; sessions stay one per date.
 */
export const workout = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const repoOf = (req: Request) => userRepo(req.user!._id);
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** A live workout left untouched this long is treated as forgotten. */
export const STALE_MS = 4 * 60 * 60 * 1000;

const SetSchema = z.object({
  weightKg: z.number().min(0).max(1000).nullable(),
  reps: z.number().min(0).max(10000).nullable(),
  negatives: z.number().min(0).nullable().default(null),
  done: z.boolean(),
  completedAt: z.string().datetime().nullable().optional(),
  rir: z.number().int().min(0).max(4).nullable().optional(),
});
const ExerciseSchema = z.object({
  plannedId: z.string().nullable(),
  name: z.string().trim().min(1).max(120),
  unit: z.enum(["reps", "seconds", "minutes", "meters"]).default("reps"),
  equipment: z.enum(["barbell", "dumbbell", "cable", "machine", "bodyweight", "other"]).optional(),
  perSide: z.boolean().default(false),
  sets: z.array(SetSchema).max(50),
  notes: z.string().max(2000).default(""),
});

/** Last completed sets per exercise name, for prefilling weights. */
function previousSets(sessions: WorkoutSession[], before: string) {
  const out = new Map<string, LoggedExercise["sets"]>();
  for (const s of [...sessions].filter((x) => x.date < before && !isLive(x)).sort((a, b) => b.date.localeCompare(a.date)))
    for (const e of s.exercises) {
      const k = e.name.toLowerCase();
      if (!out.has(k) && e.sets.some((x) => x.done)) out.set(k, e.sets.filter((x) => x.done));
    }
  return out;
}

export function exercisesFromPlan(plan: WorkoutPlan | null, day: string, sessions: WorkoutSession[], date: string): LoggedExercise[] {
  const planned = plan?.days.find((d) => d.day === day)?.exercises ?? [];
  const prev = previousSets(sessions, date);
  return planned.map((p) => {
    const last = prev.get(p.name.toLowerCase()) ?? [];
    return {
      plannedId: p.id,
      name: p.name,
      muscle: p.muscle,
      unit: p.unit,
      equipment: guessEquipment(p.name),
      perSide: p.perSide,
      sets: Array.from({ length: p.sets }, (_, i) => ({
        weightKg: (last[i] ?? last.at(-1))?.weightKg ?? null,
        reps: null,
        negatives: null,
        done: false,
        completedAt: null,
      })),
      notes: "",
    };
  });
}

const hasDoneSets = (s: WorkoutSession) => s.exercises.some((e) => e.sets.some((x) => x.done));
const lastActivity = (s: WorkoutSession) =>
  s.exercises.flatMap((e) => e.sets.map((x) => x.completedAt ?? "")).filter(Boolean).sort().at(-1) ?? s.startedAt ?? s.updatedAt;

workout.get("/sessions/live", wrap(async (req, res) => {
  const live = await repoOf(req).liveSession();
  if (!live) return res.json({ session: null, stale: false, lastActivityAt: null });
  const last = lastActivity(live);
  res.json({ session: live, stale: Date.now() - Date.parse(last) > STALE_MS, lastActivityAt: last });
}));

workout.post("/sessions/start", wrap(async (req, res) => {
  const body = z
    .object({
      date: DateStr,
      planDay: z.enum([...WEEKDAYS, "custom"] as unknown as [string, ...string[]]),
      title: z.string().trim().max(120).optional(),
    })
    .parse(req.body);
  const repo = repoOf(req);
  const live = await repo.liveSession();
  if (live) return res.json({ session: live, resumed: true });

  const [plan, profile, sessions, existing] = await Promise.all([repo.activePlan(), repo.profile(), repo.sessions(), repo.sessionByDate(body.date)]);
  if (existing && hasDoneSets(existing))
    return res.status(409).json({ error: "You already logged a workout on this day. Open it in Log to add to it.", sessionId: existing.id });

  const t = now();
  const exercises = body.planDay === "custom" ? [] : exercisesFromPlan(plan, body.planDay, sessions, body.date);
  const session: WorkoutSession = {
    // Keep anything already saved for the day (food, steps, sleep…).
    ...(existing ?? { cardioMinutes: null, sessionRpe: null, bodyweightKg: null, notes: "", createdAt: t }),
    id: existing?.id ?? newId(),
    planId: plan?.id ?? "",
    date: body.date,
    day: weekdayOf(body.date),
    planDay: body.planDay === weekdayOf(body.date) ? undefined : (body.planDay as WorkoutSession["planDay"]),
    title: body.title || (body.planDay === "custom" ? "Empty workout" : undefined),
    exercises,
    durationMin: null,
    status: "in_progress",
    startedAt: t,
    endedAt: null,
    pausedMs: 0,
    pausedAt: null,
    restEndsAt: null,
    coachNote: null,
    kcalApp: null,
    updatedAt: t,
  };
  session.kcalApp = estimateKcal(session, profile.startBodyweightKg);
  await repo.upsertSession(session);
  res.status(201).json({ session, resumed: false });
}));

/** Loads a session owned by the user or answers 404. */
async function owned(repo: UserRepo, id: string, res: Response) {
  const s = await repo.sessionById(id);
  if (!s) res.status(404).json({ error: "Workout not found" });
  return s;
}

/** Autosave during the workout, and edits on the summary. */
workout.patch("/sessions/:id", wrap(async (req, res) => {
  const body = z
    .object({
      exercises: z.array(ExerciseSchema).max(60).optional(),
      title: z.string().trim().max(120).optional(),
      notes: z.string().max(5000).optional(),
      restEndsAt: z.string().datetime().nullable().optional(),
      sessionRpe: z.number().min(1).max(10).nullable().optional(),
      durationMin: z.number().min(0).max(600).nullable().optional(),
    })
    .strict()
    .parse(req.body);
  const repo = repoOf(req);
  const s = await owned(repo, String(req.params.id), res);
  if (!s) return;
  const profile = await repo.profile();
  if (body.exercises) s.exercises = body.exercises.map((e) => ({ ...e, muscle: classifyMuscle(e.name) }));
  if (body.title !== undefined) s.title = body.title || undefined;
  if (body.notes !== undefined) s.notes = body.notes;
  if (body.restEndsAt !== undefined) s.restEndsAt = body.restEndsAt;
  if (body.sessionRpe !== undefined) s.sessionRpe = body.sessionRpe;
  if (body.durationMin !== undefined && !isLive(s)) s.durationMin = body.durationMin;
  s.kcalApp = estimateKcal(s, profile.startBodyweightKg);
  s.updatedAt = now();
  await repo.upsertSession(s);
  res.json(s);
}));

workout.post("/sessions/:id/pause", wrap(async (req, res) => {
  const repo = repoOf(req);
  const s = await owned(repo, String(req.params.id), res);
  if (!s) return;
  if (!isLive(s)) return res.status(409).json({ error: "This workout is already finished" });
  if (!s.pausedAt) {
    s.pausedAt = now();
    s.restEndsAt = null;
    s.updatedAt = s.pausedAt;
    await repo.upsertSession(s);
  }
  res.json(s);
}));

workout.post("/sessions/:id/resume", wrap(async (req, res) => {
  const repo = repoOf(req);
  const s = await owned(repo, String(req.params.id), res);
  if (!s) return;
  if (!isLive(s)) return res.status(409).json({ error: "This workout is already finished" });
  if (s.pausedAt) {
    s.pausedMs = (s.pausedMs ?? 0) + Math.max(0, Date.now() - Date.parse(s.pausedAt));
    s.pausedAt = null;
    s.updatedAt = now();
    await repo.upsertSession(s);
  }
  res.json(s);
}));

/** Ends the timer. Allowed with zero or partly done sets (the client warns first). */
export function finishSession(s: WorkoutSession, endedAtIso: string, profile: Profile) {
  const startMs = Date.parse(s.startedAt ?? endedAtIso);
  const endMs = Math.max(startMs, Date.parse(endedAtIso));
  if (s.pausedAt) {
    const pausedAt = Math.min(Date.parse(s.pausedAt), endMs);
    s.pausedMs = (s.pausedMs ?? 0) + Math.max(0, endMs - pausedAt);
    s.pausedAt = null;
  }
  s.endedAt = new Date(endMs).toISOString();
  s.status = "completed";
  s.restEndsAt = null;
  s.durationMin = Math.round(sessionElapsedMs(s, endMs) / 60000);
  s.kcalApp = estimateKcal(s, profile.startBodyweightKg);
  s.updatedAt = now();
  return s;
}

workout.post("/sessions/:id/finish", wrap(async (req, res) => {
  const { endedAt } = z.object({ endedAt: z.string().datetime().optional() }).parse(req.body ?? {});
  const repo = repoOf(req);
  const s = await owned(repo, String(req.params.id), res);
  if (!s) return;
  if (!isLive(s)) return res.json(s);
  const end = endedAt && Date.parse(endedAt) < Date.now() ? endedAt : now();
  await repo.upsertSession(finishSession(s, end, await repo.profile()));
  res.json(s);
}));

/** Throws away a live workout. Food, steps etc. saved for the same day are kept. */
workout.post("/sessions/:id/discard", wrap(async (req, res) => {
  const repo = repoOf(req);
  const s = await owned(repo, String(req.params.id), res);
  if (!s) return;
  if (!isLive(s)) return res.status(409).json({ error: "Only a workout in progress can be discarded" });
  const keepDay = !!s.food?.length || s.steps != null || s.waterL != null || s.sleepHours != null || !!s.cardio?.length;
  if (!keepDay) {
    await repo.deleteSession(s.id);
    return res.status(204).end();
  }
  Object.assign(s, { exercises: [], status: undefined, startedAt: null, endedAt: null, pausedMs: 0, pausedAt: null, restEndsAt: null, durationMin: null, updatedAt: now() });
  await repo.upsertSession(s);
  res.status(204).end();
}));

/**
 * Splits timed sessions into lifting vs resting from set tick times:
 * each gap between ticks beyond ~45 s of work counts as rest (capped at 10 min per gap).
 */
function restSplit(s: WorkoutSession) {
  const ticks = s.exercises.flatMap((e) => e.sets.map((x) => x.completedAt)).filter((x): x is string => !!x).map(Date.parse).sort((a, b) => a - b);
  if (!s.durationMin || ticks.length < 2) return { workingMin: null, restMin: null };
  let rest = 0;
  for (let i = 1; i < ticks.length; i++) rest += Math.min(10 * 60000, Math.max(0, ticks[i] - ticks[i - 1] - 45000));
  const restMin = Math.min(s.durationMin, Math.round(rest / 60000));
  return { workingMin: s.durationMin - restMin, restMin };
}

export function buildSummary(s: WorkoutSession, all: WorkoutSession[], plan: WorkoutPlan | null): WorkoutSummary {
  const setsPlanned = s.exercises.reduce((a, e) => a + e.sets.length, 0);
  const setsDone = s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const prs = recordsIn(s, all);
  const exercises = compareWithLast(s, all);
  const ups = exercises.filter((e) => e.trend === "up").length;
  const ruleNote = prs.length
    ? `New personal record on ${prs.map((p) => p.exercise).join(", ")}. Keep the same weight next time and own it, then add a little.`
    : setsPlanned && setsDone < setsPlanned
      ? `You finished ${setsDone} of ${setsPlanned} sets. A shorter session still counts. Next time, start with the exercises you skipped.`
      : ups
        ? `You beat last time on ${ups} exercise${ups === 1 ? "" : "s"}. Aim for one more rep on the rest next session.`
        : setsDone
          ? "Solid session that matched last time. Try one extra rep on your first exercise next time."
          : "Workout timed with no sets logged. Add what you did on the Log page if you want it in your stats.";
  return {
    session: s,
    title: workoutTitle(s, plan) ?? "Workout",
    durationMin: s.durationMin ?? null,
    setsDone,
    setsPlanned,
    volumeKg: Math.round(s.exercises.reduce((a, e) => a + exerciseVolume(e), 0)),
    kcal: sessionKcal(s),
    prs,
    exercises,
    ...restSplit(s),
    ruleNote,
  };
}

workout.get("/sessions/:id/summary", wrap(async (req, res) => {
  const repo = repoOf(req);
  const s = await owned(repo, String(req.params.id), res);
  if (!s) return;
  const [all, plan] = await Promise.all([repo.sessions(), repo.activePlan()]);
  res.json(buildSummary(s, all, plan));
}));
