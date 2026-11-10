import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { WEEKDAYS, addDays, computeWeekStats, estimateKcal, weekdayOf, weekStartOf, type ScoreReport, type WorkoutSession } from "@workout/shared";
import { activePlan, getDb, newId, update } from "../store.js";
import { claudeEnabled, config } from "../config.js";
import { parsePlan } from "../services/planParser.js";
import { classifyMuscle } from "../services/muscles.js";
import { computePlanMetrics, computeWeekMetrics, inWeek, inWeekThrough, latestLoggedDate } from "../services/metrics.js";
import { buildChatContext, scorePlan, scoreWeek, streamChat } from "../services/claude.js";
import { parseReply, planPack, reportFromReply, weekPack } from "../services/handoff.js";
import { dayPrompt, mergeDay, parseDay } from "../services/dayImport.js";

export const api = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown> | unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);

const now = () => new Date().toISOString();

/** The app's weekly stats for the score card (bodyweight change measured from last week's last weigh-in). */
function statsFor(weekStart: string, through?: string) {
  const db = getDb();
  const prevBw = [...inWeek(db.sessions, addDays(weekStart, -7))].sort((a, b) => a.date.localeCompare(b.date)).reverse().find((s) => s.bodyweightKg)?.bodyweightKg ?? null;
  const current = inWeek(db.sessions, weekStart).filter((s) => !through || s.date <= through);
  return computeWeekStats(
    [...current].sort((a, b) => a.date.localeCompare(b.date)),
    db.profile.startBodyweightKg,
    prevBw,
  );
}

/** Stores Claude's per-session calorie estimates on the matching logged days. */
function applyClaudeCalories(sessions: WorkoutSession[], calories?: { date: string; kcal: number }[]) {
  for (const c of calories ?? []) {
    const s = sessions.find((x) => x.date === c.date);
    if (s && Number.isFinite(c.kcal) && c.kcal > 0) s.kcalClaude = Math.round(c.kcal);
  }
}

// ── Status ───────────────────────────────────────────────────
api.get("/status", (_req, res) => res.json({ claudeConnected: claudeEnabled(), model: config.model }));

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

api.get("/profile", (_req, res) => res.json(getDb().profile));
api.put("/profile", wrap(async (req, res) => {
  const profile = ProfileSchema.parse(req.body);
  await update((d) => (d.profile = profile));
  res.json(profile);
}));

// ── Plans ────────────────────────────────────────────────────
api.get("/plans", (_req, res) => res.json(getDb().plans));
api.get("/plans/active", (_req, res) => res.json(activePlan()));

api.post("/plans", wrap(async (req, res) => {
  const { name, text } = z.object({ name: z.string().default("Uploaded plan"), text: z.string().min(20) }).parse(req.body);
  const parsed = parsePlan(text);
  const exerciseCount = parsed.days.reduce((a, d) => a + d.exercises.length, 0);
  if (!exerciseCount)
    return res.status(422).json({ error: "No exercises found. Use lines like '| Bench press | 3 × 8–12 |' or '- Squat — 3 × 8' under '## Monday' headers." });
  const plan = { id: newId(), name, goal: parsed.goal, createdAt: now(), active: true, rawText: text, days: parsed.days };
  await update((d) => {
    d.plans.forEach((p) => (p.active = false));
    d.plans.push(plan);
  });
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
  const result = await update((d) => {
    const plan = d.plans.find((p) => p.id === req.params.id);
    if (!plan) return null;
    const target = plan.days.find((x) => x.day === day);
    if (!target) return null;
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
    d.scores = d.scores.filter((s) => !(s.kind === "plan" && s.planId === plan.id));
    return plan;
  });
  result ? res.json(result) : res.status(404).json({ error: "Plan not found" });
}));

api.post("/plans/:id/activate", wrap(async (req, res) => {
  const ok = await update((d) => {
    const p = d.plans.find((x) => x.id === req.params.id);
    if (!p) return false;
    d.plans.forEach((x) => (x.active = x.id === p.id));
    return true;
  });
  ok ? res.json(activePlan()) : res.status(404).json({ error: "Plan not found" });
}));

api.delete("/plans/:id", wrap(async (req, res) => {
  await update((d) => {
    d.plans = d.plans.filter((p) => p.id !== req.params.id);
    if (!d.plans.some((p) => p.active) && d.plans.length) d.plans[d.plans.length - 1].active = true;
  });
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
function saveSessionBody(body: SessionBody) {
  const plan = activePlan();
  return update((d) => {
    const existing = d.sessions.find((s) => s.date === body.date);
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
      kcalApp: estimateKcal(body, d.profile.startBodyweightKg),
      kcalClaude: existing?.kcalClaude ?? null,
      food: body.food,
      steps: body.steps,
      waterL: body.waterL,
      sleepHours: body.sleepHours,
      notes: body.notes,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    };
    if (existing) Object.assign(existing, session);
    else d.sessions.push(session);
    return session;
  });
}

api.get("/sessions", (req, res) => {
  const { week, date } = req.query as { week?: string; date?: string };
  let list = getDb().sessions;
  if (week) list = inWeek(list, weekStartOf(week));
  if (date) list = list.filter((s) => s.date === date);
  res.json([...list].sort((a, b) => a.date.localeCompare(b.date)));
});

/** Most recent previous performance per exercise name (for placeholders on the log screen). */
api.get("/sessions/previous", (req, res) => {
  const before = String(req.query.before ?? "9999-12-31");
  const out: Record<string, { date: string; sets: { weightKg: number | null; reps: number | null; negatives?: number | null }[] }> = {};
  const sorted = [...getDb().sessions].filter((s) => s.date < before).sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted)
    for (const e of s.exercises) {
      const k = e.name.toLowerCase();
      if (!out[k] && e.sets.some((x) => x.done)) out[k] = { date: s.date, sets: e.sets.filter((x) => x.done) };
    }
  res.json(out);
});

api.put("/sessions", wrap(async (req, res) => {
  res.json(await saveSessionBody(SessionSchema.parse(req.body)));
}));

// ── "Quick add with AI": prompt out, JSON back ───────────────
api.get("/day-import/prompt", (req, res) => {
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  res.json({ text: dayPrompt(activePlan(), date) });
});

api.post("/day-import", wrap(async (req, res) => {
  const { text, date: fallbackDate } = z.object({ text: z.string().min(2), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.body);
  let day;
  try {
    day = parseDay(text);
  } catch (e) {
    return res.status(422).json({ error: (e as Error).message });
  }
  const date = day.date && /^\d{4}-\d{2}-\d{2}$/.test(day.date) ? day.date : fallbackDate;
  const existing = getDb().sessions.find((s) => s.date === date) ?? null;
  const { body, summary } = mergeDay(day, date, existing, activePlan());
  const saved = await saveSessionBody(SessionSchema.parse(body));
  res.json({ session: saved, summary });
}));

api.delete("/sessions/:id", wrap(async (req, res) => {
  await update((d) => (d.sessions = d.sessions.filter((s) => s.id !== req.params.id)));
  res.status(204).end();
}));

// ── Scores ───────────────────────────────────────────────────
api.get("/scores", (req, res) => {
  const kind = req.query.kind as string | undefined;
  res.json(getDb().scores.filter((s) => !kind || s.kind === kind));
});

api.get("/metrics/week", (req, res) => {
  const plan = activePlan();
  if (!plan) return res.status(400).json({ error: "No active plan" });
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  const ws = weekStartOf(date);
  const through = latestLoggedDate(getDb().sessions, ws, date);
  res.json(computeWeekMetrics(plan, getDb().sessions, ws, getDb().profile, through));
});

api.post("/scores/plan", wrap(async (_req, res) => {
  const plan = activePlan();
  if (!plan) return res.status(400).json({ error: "Upload a plan first" });
  const profile = getDb().profile;
  const m = computePlanMetrics(plan, profile);
  const v = await scorePlan(plan, profile, { base: m.baseScore, subScores: m.subScores, flags: m.flags, setsByMuscle: m.setsByMuscle });
  const report: ScoreReport = { id: newId(), kind: "plan", planId: plan.id, createdAt: now(), ...v };
  await update((d) => d.scores.push(report));
  res.json(report);
}));

api.post("/scores/week", wrap(async (req, res) => {
  const plan = activePlan();
  if (!plan) return res.status(400).json({ error: "Upload a plan first" });
  const { date } = z.object({ date: z.string().default(() => new Date().toISOString().slice(0, 10)) }).parse(req.body ?? {});
  const ws = weekStartOf(date);
  const db = getDb();
  const through = latestLoggedDate(db.sessions, ws, date);
  const { metrics, flags } = computeWeekMetrics(plan, db.sessions, ws, db.profile, through);
  if (!metrics.completedSets) return res.status(422).json({ error: "No completed sets logged this week yet." });
  const { calories, ...v } = await scoreWeek(plan, db.profile, metrics, inWeekThrough(db.sessions, ws, through), flags, inWeek(db.sessions, addDays(ws, -7)), statsFor(ws, through));
  const report: ScoreReport = { id: newId(), kind: "week", planId: plan.id, weekStart: ws, createdAt: now(), ...v };
  await update((d) => {
    d.scores = d.scores.filter((s) => !(s.kind === "week" && s.weekStart === ws));
    d.scores.push(report);
    applyClaudeCalories(inWeekThrough(d.sessions, ws, through), calories);
  });
  res.json(report);
}));

// ── Claude Project bridge (no API key needed) ────────────────
const dateQ = (req: Request) => String(req.query.date ?? req.body?.date ?? new Date().toISOString().slice(0, 10));

api.get("/handoff/week", (req, res) => {
  const plan = activePlan();
  if (!plan) return res.status(400).json({ error: "Upload a plan first" });
  const db = getDb();
  const date = dateQ(req);
  const ws = weekStartOf(date);
  const through = latestLoggedDate(db.sessions, ws, date);
  const { metrics, flags } = computeWeekMetrics(plan, db.sessions, ws, db.profile, through);
  res.json({ filename: `repscore-week-${ws}.md`, markdown: weekPack(plan, db.profile, metrics, inWeekThrough(db.sessions, ws, through), flags, inWeek(db.sessions, addDays(ws, -7)), statsFor(ws, through)) });
});

api.get("/handoff/plan", (_req, res) => {
  const plan = activePlan();
  if (!plan) return res.status(400).json({ error: "Upload a plan first" });
  const db = getDb();
  const m = computePlanMetrics(plan, db.profile);
  res.json({ filename: `repscore-plan-review.md`, markdown: planPack(plan, db.profile, m) });
});

api.get("/handoff/context", (_req, res) => {
  const db = getDb();
  res.json({
    filename: "repscore-context.md",
    markdown: `# My RepScore training context\n\nUse this as my current training data when coaching me.\n\n${buildChatContext(db.profile, activePlan(), db.scores, db.sessions)}\n`,
  });
});

api.post("/scores/import", wrap(async (req, res) => {
  const plan = activePlan();
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
  const db = getDb();
  let report: ScoreReport;
  if (kind === "week") {
    const date = dateQ(req);
    const ws = weekStartOf(date);
    const through = latestLoggedDate(db.sessions, ws, date);
    const { metrics, flags } = computeWeekMetrics(plan, db.sessions, ws, db.profile, through);
    report = { id: newId(), kind, planId: plan.id, weekStart: ws, createdAt: now(), ...reportFromReply(reply, metrics.subScores, flags, statsFor(ws, through)), metrics };
  } else {
    const m = computePlanMetrics(plan, db.profile);
    report = { id: newId(), kind, planId: plan.id, createdAt: now(), ...reportFromReply(reply, m.subScores, m.flags) };
  }
  await update((d) => {
    if (kind === "week") d.scores = d.scores.filter((s) => !(s.kind === "week" && s.weekStart === report.weekStart));
    d.scores.push(report);
    if (kind === "week" && report.weekStart && report.metrics)
      applyClaudeCalories(inWeekThrough(d.sessions, report.weekStart, report.metrics.weekEnd), reply.calories);
  });
  res.json(report);
}));

// ── Chat (Server-Sent Events stream) ─────────────────────────
api.get("/chat", (_req, res) => res.json(getDb().chat));
api.delete("/chat", wrap(async (_req, res) => {
  await update((d) => (d.chat = []));
  res.status(204).end();
}));

api.post("/chat", wrap(async (req, res) => {
  const { message } = z.object({ message: z.string().min(1).max(8000) }).parse(req.body);
  await update((d) => d.chat.push({ id: newId(), role: "user", content: message, createdAt: now() }));

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const db = getDb();
  const context = buildChatContext(db.profile, activePlan(), db.scores, db.sessions);
  try {
    const full = await streamChat(db.chat, context, (t) => send("delta", t));
    const msg = { id: newId(), role: "assistant" as const, content: full, createdAt: now() };
    await update((d) => d.chat.push(msg));
    send("done", msg);
  } catch (e) {
    send("error", { error: e instanceof Error ? e.message : "Chat failed" });
  }
  res.end();
}));

