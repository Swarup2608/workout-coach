import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { WEEKDAYS, addDays, computeWeekStats, estimateKcal, weekdayOf, weekStartOf, type ApiStatus, type Profile, type ScoreReport, type WorkoutSession } from "../domain.js";
import { userRepo, type UserRepo } from "../repo.js";
import { newId, now } from "../util/id.js";
import { parsePlan } from "../services/planParser.js";
import { classifyMuscle } from "../services/muscles.js";
import { computePlanMetrics, computeWeekMetrics, inWeek, inWeekThrough, latestLoggedDate } from "../services/metrics.js";
import { buildChatContext, scorePlan, scoreWeek, streamChat } from "../services/claude.js";
import { aiForUser, aiLabel } from "../services/ai.js";
import { parseReply, planPack, reportFromReply, weekPack } from "../services/handoff.js";
import { dayPrompt, mergeDay, parseDay } from "../services/dayImport.js";

/** Mounted behind requireAuth: req.user is always set, and all data goes through that user's repo. */
export const api = Router();

const repoOf = (req: Request) => userRepo(req.user!._id);

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown> | unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);

/** The app's weekly stats for the score card (bodyweight change measured from last week's last weigh-in). */
function statsFor(sessions: WorkoutSession[], profile: Profile, weekStart: string, through?: string) {
  const prevBw = [...inWeek(sessions, addDays(weekStart, -7))].sort((a, b) => a.date.localeCompare(b.date)).reverse().find((s) => s.bodyweightKg)?.bodyweightKg ?? null;
  const current = inWeek(sessions, weekStart).filter((s) => !through || s.date <= through);
  return computeWeekStats([...current].sort((a, b) => a.date.localeCompare(b.date)), profile.startBodyweightKg, prevBw);
}

// ── Status ───────────────────────────────────────────────────
api.get("/status", (req, res) => {
  const ai = req.user!.ai;
  const status: ApiStatus = ai
    ? { aiConnected: true, provider: ai.provider, model: ai.model, label: aiLabel(ai.provider, ai.model) }
    : { aiConnected: false, provider: null, model: null, label: null };
  res.json(status);
});

// ── Profile ──────────────────────────────────────────────────
const ConstraintSchema = z.object({
  id: z.string().default(() => newId()),
  label: z.string().min(1),
  reason: z.string().default(""),
  keywords: z.array(z.string()),
  swaps: z.array(z.string()),
});
const ProfileSchema = z.object({
  name: z.string(),
  goal: z.string(),
  experience: z.string(),
  startBodyweightKg: z.number().nullable(),
  targetBodyweightKg: z.number().nullable(),
  constraints: z.array(ConstraintSchema),
  claudeProjectUrl: z.string().url().or(z.literal("")).optional(),
});

api.get("/profile", wrap(async (req, res) => res.json(await repoOf(req).profile())));
api.put("/profile", wrap(async (req, res) => {
  const profile = ProfileSchema.parse(req.body);
  await repoOf(req).saveProfile(profile);
  res.json(profile);
}));

// ── Plans ────────────────────────────────────────────────────
api.get("/plans", wrap(async (req, res) => res.json(await repoOf(req).plans())));
api.get("/plans/active", wrap(async (req, res) => res.json(await repoOf(req).activePlan())));

api.post("/plans", wrap(async (req, res) => {
  const { name, text } = z.object({ name: z.string().default("Uploaded plan"), text: z.string().min(20) }).parse(req.body);
  const parsed = parsePlan(text);
  const exerciseCount = parsed.days.reduce((a, d) => a + d.exercises.length, 0);
  if (!exerciseCount)
    return res.status(422).json({ error: "No exercises found. Use lines like '| Bench press | 3 × 8–12 |' or '- Squat — 3 × 8' under '## Monday' headers." });
  const plan = { id: newId(), name, goal: parsed.goal, createdAt: now(), active: true, rawText: text, days: parsed.days };
  await repoOf(req).addPlan(plan);
  res.status(201).json(plan);
}));

const PlanDayEditSchema = z.object({
  title: z.string().trim().min(1).max(120),
  notes: z.array(z.string().max(1000)).default([]),
  exercises: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(1).max(120),
      sets: z.number().int().min(1).max(50),
      repMin: z.number().int().min(1).max(1000),
      repMax: z.number().int().min(1).max(1000),
    }).refine((e) => e.repMax >= e.repMin, { message: "Maximum reps must be at least minimum reps", path: ["repMax"] }),
  ).max(100),
});

api.put("/plans/:id/days/:day", wrap(async (req, res) => {
  const day = WEEKDAYS.find((d) => d.toLowerCase() === String(req.params.day).toLowerCase());
  if (!day) return res.status(400).json({ error: "Invalid plan day" });
  const input = PlanDayEditSchema.parse(req.body);
  const repo = repoOf(req);
  const plan = await repo.plan(String(req.params.id));
  const target = plan?.days.find((x) => x.day === day);
  if (!plan || !target) return res.status(404).json({ error: "Plan not found" });
  {
    target.title = input.title;
    target.notes = input.notes;
    target.exercises = input.exercises.map((edited) => {
      const previous = target.exercises.find((e) => e.id === edited.id);
      const alternatives = previous?.name === edited.name
        ? previous.alternatives
        : edited.name.split(/\s+OR\s+/i).map((x) => x.trim()).filter(Boolean);
      return {
        id: previous?.id ?? newId(),
        name: edited.name,
        alternatives,
        section: previous?.section ?? "Main",
        sets: edited.sets,
        repMin: edited.repMin,
        repMax: edited.repMax,
        unit: previous?.unit ?? "reps",
        perSide: previous?.perSide ?? false,
        muscle: classifyMuscle(edited.name),
      };
    });
    target.isRest = target.exercises.length === 0;
  }
  await repo.replacePlan(plan);
  await repo.deletePlanScores(plan.id);
  res.json(plan);
}));

api.post("/plans/:id/activate", wrap(async (req, res) => {
  const repo = repoOf(req);
  (await repo.activatePlan(String(req.params.id))) ? res.json(await repo.activePlan()) : res.status(404).json({ error: "Plan not found" });
}));

api.delete("/plans/:id", wrap(async (req, res) => {
  await repoOf(req).deletePlan(String(req.params.id));
  res.status(204).end();
}));

// ── Sessions (set/rep logging) ───────────────────────────────
const SetSchema = z.object({ weightKg: z.number().nullable(), reps: z.number().nullable(), negatives: z.number().min(0).nullable().default(null), done: z.boolean() });
const SessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planDay: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "custom"]).optional(),
  title: z.string().max(120).default(""),
  exercises: z.array(
    z.object({
      plannedId: z.string().nullable(),
      name: z.string().min(1),
      unit: z.enum(["reps", "seconds", "minutes", "meters"]).default("reps"),
      equipment: z.enum(["barbell", "dumbbell", "cable", "machine", "bodyweight", "other"]).optional(),
      perSide: z.boolean().default(false),
      sets: z.array(SetSchema),
      notes: z.string().max(2000).default(""),
    }),
  ),
  durationMin: z.number().min(0).nullable().default(null),
  cardio: z
    .array(
      z.object({
        type: z.enum(["incline walk", "cycling", "running", "rowing", "elliptical", "other"]),
        minutes: z.number().min(0).nullable(),
        speedKmh: z.number().min(0).nullable().default(null),
        inclinePct: z.number().min(-10).max(40).nullable().default(null),
        distanceKm: z.number().min(0).nullable().default(null),
        level: z.number().min(0).nullable().default(null),
        notes: z.string().max(500).default(""),
      }),
    )
    .default([]),
  cardioMinutes: z.number().nullable().default(null),
  sessionRpe: z.number().min(1).max(10).nullable().default(null),
  bodyweightKg: z.number().nullable().default(null),
  food: z
    .array(
      z.object({
        meal: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
        name: z.string().min(1).max(200),
        kcal: z.number().min(0).nullable(),
        proteinG: z.number().min(0).nullable().default(null),
        carbsG: z.number().min(0).nullable().default(null),
        fatG: z.number().min(0).nullable().default(null),
      }),
    )
    .default([]),
  steps: z.number().int().min(0).nullable().default(null),
  waterL: z.number().min(0).nullable().default(null),
  sleepHours: z.number().min(0).max(24).nullable().default(null),
  notes: z.string().default(""),
});
export type SessionBody = z.infer<typeof SessionSchema>;

/** Create or replace the log for body.date (one log per date). */
async function saveSessionBody(repo: UserRepo, body: SessionBody) {
  const [plan, profile, existing] = await Promise.all([repo.activePlan(), repo.profile(), repo.sessionByDate(body.date)]);
  {
    const session: WorkoutSession = {
      id: existing?.id ?? newId(),
      planId: plan?.id ?? "",
      date: body.date,
      day: weekdayOf(body.date),
      planDay: body.planDay && body.planDay !== weekdayOf(body.date) ? body.planDay : undefined,
      title: body.title.trim() || undefined,
      exercises: body.exercises.map((e) => ({ ...e, muscle: classifyMuscle(e.name) })),
      durationMin: body.durationMin,
      cardio: body.cardio,
      cardioMinutes: body.cardio.length ? body.cardio.reduce((a, c) => a + (c.minutes ?? 0), 0) : body.cardioMinutes,
      sessionRpe: body.sessionRpe,
      bodyweightKg: body.bodyweightKg,
      kcalApp: estimateKcal(body, profile.startBodyweightKg),
      kcalClaude: existing?.kcalClaude ?? null,
      food: body.food,
      steps: body.steps,
      waterL: body.waterL,
      sleepHours: body.sleepHours,
      notes: body.notes,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    };
    await repo.upsertSession(session);
    return session;
  }
}

api.get("/sessions", wrap(async (req, res) => {
  const { week, date } = req.query as { week?: string; date?: string };
  let list = await repoOf(req).sessions();
  if (week) list = inWeek(list, weekStartOf(week));
  if (date) list = list.filter((s) => s.date === date);
  res.json([...list].sort((a, b) => a.date.localeCompare(b.date)));
}));

/** Most recent previous performance per exercise name (for placeholders on the log screen). */
api.get("/sessions/previous", wrap(async (req, res) => {
  const before = String(req.query.before ?? "9999-12-31");
  const out: Record<string, { date: string; sets: { weightKg: number | null; reps: number | null; negatives?: number | null }[] }> = {};
  const sorted = [...(await repoOf(req).sessions())].filter((s) => s.date < before).sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted)
    for (const e of s.exercises) {
      const k = e.name.toLowerCase();
      if (!out[k] && e.sets.some((x) => x.done)) out[k] = { date: s.date, sets: e.sets.filter((x) => x.done) };
    }
  res.json(out);
}));

api.put("/sessions", wrap(async (req, res) => {
  res.json(await saveSessionBody(repoOf(req), SessionSchema.parse(req.body)));
}));

// ── "Quick add with AI": prompt out, JSON back ───────────────
api.get("/day-import/prompt", wrap(async (req, res) => {
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  res.json({ text: dayPrompt(await repoOf(req).activePlan(), date) });
}));

api.post("/day-import", wrap(async (req, res) => {
  const { text, date: fallbackDate } = z.object({ text: z.string().min(2), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.body);
  let day;
  try {
    day = parseDay(text);
  } catch (e) {
    return res.status(422).json({ error: (e as Error).message });
  }
  const date = day.date && /^\d{4}-\d{2}-\d{2}$/.test(day.date) ? day.date : fallbackDate;
  const repo = repoOf(req);
  const existing = await repo.sessionByDate(date);
  const { body, summary } = mergeDay(day, date, existing, await repo.activePlan());
  const saved = await saveSessionBody(repo, SessionSchema.parse(body));
  res.json({ session: saved, summary });
}));

api.delete("/sessions/:id", wrap(async (req, res) => {
  await repoOf(req).deleteSession(String(req.params.id));
  res.status(204).end();
}));

// ── Scores ───────────────────────────────────────────────────
api.get("/scores", wrap(async (req, res) => {
  const kind = req.query.kind === "plan" || req.query.kind === "week" ? req.query.kind : undefined;
  res.json(await repoOf(req).scores(kind));
}));

/** Loads everything week maths needs in one go. */
async function loadAll(repo: UserRepo) {
  const [plan, profile, sessions] = await Promise.all([repo.activePlan(), repo.profile(), repo.sessions()]);
  return { plan, profile, sessions };
}

api.get("/metrics/week", wrap(async (req, res) => {
  const { plan, profile, sessions } = await loadAll(repoOf(req));
  if (!plan) return res.status(400).json({ error: "No active plan" });
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  const ws = weekStartOf(date);
  const through = latestLoggedDate(sessions, ws, date);
  res.json(computeWeekMetrics(plan, sessions, ws, profile, through));
}));

api.post("/scores/plan", wrap(async (req, res) => {
  const repo = repoOf(req);
  const [plan, profile] = await Promise.all([repo.activePlan(), repo.profile()]);
  if (!plan) return res.status(400).json({ error: "Upload a plan first" });
  const m = computePlanMetrics(plan, profile);
  const v = await scorePlan(aiForUser(req.user!), plan, profile, { base: m.baseScore, subScores: m.subScores, flags: m.flags, setsByMuscle: m.setsByMuscle });
  const report: ScoreReport = { id: newId(), kind: "plan", planId: plan.id, createdAt: now(), ...v };
  await repo.addScore(report);
  res.json(report);
}));

api.post("/scores/week", wrap(async (req, res) => {
  const repo = repoOf(req);
  const { plan, profile, sessions } = await loadAll(repo);
  if (!plan) return res.status(400).json({ error: "Upload a plan first" });
  const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)) }).parse(req.body ?? {});
  const ws = weekStartOf(date);
  const through = latestLoggedDate(sessions, ws, date);
  const { metrics, flags } = computeWeekMetrics(plan, sessions, ws, profile, through);
  if (!metrics.completedSets) return res.status(422).json({ error: "No completed sets logged this week yet." });
  const { calories, ...v } = await scoreWeek(aiForUser(req.user!), plan, profile, metrics, inWeekThrough(sessions, ws, through), flags, inWeek(sessions, addDays(ws, -7)), statsFor(sessions, profile, ws, through));
  const report: ScoreReport = { id: newId(), kind: "week", planId: plan.id, weekStart: ws, createdAt: now(), ...v };
  await repo.addScore(report);
  await repo.setAiCalories(ws, metrics.weekEnd, calories);
  res.json(report);
}));

// ── Claude Project bridge (no API key needed) ────────────────
const dateQ = (req: Request) => {
  const d = String(req.query.date ?? req.body?.date ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10);
};

api.get("/handoff/week", wrap(async (req, res) => {
  const { plan, profile, sessions } = await loadAll(repoOf(req));
  if (!plan) return res.status(400).json({ error: "Upload a plan first" });
  const ws = weekStartOf(dateQ(req));
  const through = latestLoggedDate(sessions, ws, dateQ(req));
  const { metrics, flags } = computeWeekMetrics(plan, sessions, ws, profile, through);
  res.json({ filename: `starkfitiq-week-${ws}.md`, markdown: weekPack(plan, profile, metrics, inWeekThrough(sessions, ws, through), flags, inWeek(sessions, addDays(ws, -7)), statsFor(sessions, profile, ws, through)) });
}));

api.get("/handoff/plan", wrap(async (req, res) => {
  const repo = repoOf(req);
  const [plan, profile] = await Promise.all([repo.activePlan(), repo.profile()]);
  if (!plan) return res.status(400).json({ error: "Upload a plan first" });
  res.json({ filename: `starkfitiq-plan-review.md`, markdown: planPack(plan, profile, computePlanMetrics(plan, profile)) });
}));

api.get("/handoff/context", wrap(async (req, res) => {
  const repo = repoOf(req);
  const [{ plan, profile, sessions }, scores] = await Promise.all([loadAll(repo), repo.scores()]);
  res.json({
    filename: "starkfitiq-context.md",
    markdown: `# My StarkFitIQ training context\n\nUse this as my current training data when coaching me.\n\n${buildChatContext(profile, plan, scores, sessions)}\n`,
  });
}));

api.post("/scores/import", wrap(async (req, res) => {
  const repo = repoOf(req);
  const { plan, profile, sessions } = await loadAll(repo);
  if (!plan) return res.status(400).json({ error: "Upload a plan first" });
  const { kind, text } = z.object({ kind: z.enum(["plan", "week"]), text: z.string().min(10) }).parse(req.body);
  let reply;
  try {
    reply = parseReply(text);
  } catch (e) {
    return res.status(422).json({ error: (e as Error).message });
  }
  if (reply.kind && reply.kind !== kind) {
    return res.status(422).json({ error: `This reply is a ${reply.kind} score, but the importer is set to ${kind}.` });
  }
  let report: ScoreReport;
  if (kind === "week") {
    const date = dateQ(req);
    const ws = weekStartOf(date);
    const through = latestLoggedDate(sessions, ws, date);
    const { metrics, flags } = computeWeekMetrics(plan, sessions, ws, profile, through);
    report = { id: newId(), kind, planId: plan.id, weekStart: ws, createdAt: now(), ...reportFromReply(reply, metrics.subScores, flags, statsFor(sessions, profile, ws, through)), metrics };
  } else {
    const m = computePlanMetrics(plan, profile);
    report = { id: newId(), kind, planId: plan.id, createdAt: now(), ...reportFromReply(reply, m.subScores, m.flags) };
  }
  await repo.addScore(report);
  if (kind === "week" && report.weekStart && report.metrics) await repo.setAiCalories(report.weekStart, report.metrics.weekEnd, reply.calories);
  res.json(report);
}));

// ── Chat (Server-Sent Events stream) ─────────────────────────
api.get("/chat", wrap(async (req, res) => res.json(await repoOf(req).chat())));
api.delete("/chat", wrap(async (req, res) => {
  await repoOf(req).clearChat();
  res.status(204).end();
}));

api.post("/chat", wrap(async (req, res) => {
  const { message } = z.object({ message: z.string().min(1).max(8000) }).parse(req.body);
  const repo = repoOf(req);
  await repo.addChat({ id: newId(), role: "user", content: message, createdAt: now() });
  const [{ plan, profile, sessions }, scores, history] = await Promise.all([loadAll(repo), repo.scores(), repo.chat()]);

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const context = buildChatContext(profile, plan, scores, sessions);
  try {
    const full = await streamChat(aiForUser(req.user!), history, context, (t) => send("delta", t));
    const msg = { id: newId(), role: "assistant" as const, content: full, createdAt: now() };
    await repo.addChat(msg);
    send("done", msg);
  } catch (e) {
    send("error", { error: e instanceof Error ? e.message : "Chat failed" });
  }
  res.end();
}));

