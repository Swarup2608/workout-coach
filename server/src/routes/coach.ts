import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  WEEKDAYS,
  describeAction,
  guessEquipment,
  isLive,
  type CoachAction,
  type PageContext,
  type WorkoutSession,
  type WorkoutSummary,
} from "../domain.js";
import { userRepo, type UserRepo } from "../repo.js";
import type { CoachActionDoc } from "../db.js";
import { newId, now } from "../util/id.js";
import { classifyMuscle } from "../services/muscles.js";
import { aiForUser } from "../services/ai.js";
import { COACH_SYSTEM, buildChatContext } from "../services/claude.js";
import { buildSummary } from "./workout.js";
import { nutritionContextLine } from "./nutrition.js";
import { mergeFoodLogs } from "../services/nutrition.js";

/**
 * Coach extras: page context for chat, actions the coach proposes (applied only on the user's tap,
 * with undo), ready-made prompts for users without an AI key, and the workout-summary coach note.
 */
export const coach = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
const repoOf = (req: Request) => userRepo(req.user!._id);

// ── Page context ─────────────────────────────────────────────
export const PageSchema = z
  .object({
    page: z.string().trim().min(1).max(40),
    detail: z.string().trim().max(300).optional(),
  })
  .strict();

export const pageLine = (p: PageContext) => (p.detail ? `${p.page} — ${p.detail}` : p.page);

// ── Actions ──────────────────────────────────────────────────
const Day = z.enum(WEEKDAYS as [string, ...string[]]);
const Name = z.string().trim().min(1).max(120);
const reason = z.string().max(300).optional();

export const CoachActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("swap_exercise"), from: Name, to: Name, day: Day.optional(), reason }),
  z
    .object({
      type: z.literal("change_sets_reps"),
      exercise: Name,
      sets: z.number().int().min(1).max(20).optional(),
      repMin: z.number().int().min(1).max(100).optional(),
      repMax: z.number().int().min(1).max(100).optional(),
      day: Day.optional(),
      reason,
    })
    .refine((a) => a.sets || a.repMin || a.repMax, "Nothing to change"),
  z.object({ type: z.literal("move_workout"), from: Day, to: Day, reason }),
  z.object({ type: z.literal("set_rest"), exercise: Name, seconds: z.number().int().min(15).max(600), reason }),
  z.object({ type: z.literal("start_workout"), day: z.union([Day, z.literal("custom")]).optional(), reason }),
  z.object({ type: z.literal("add_note"), text: z.string().trim().min(1).max(500), exercise: Name.optional(), reason }),
]);

export const ACTION_GUIDE = `PROPOSING CHANGES
You can propose changes the app applies only when the user taps Apply. After your explanation, add one fenced block per change, exactly like:
\`\`\`coach-action
{"type":"swap_exercise","from":"Barbell back squat","to":"Goblet squat","reason":"Easier on the knee"}
\`\`\`
Allowed types and fields:
- swap_exercise: from, to, optional day (Monday…Sunday)
- change_sets_reps: exercise, sets and/or repMin/repMax, optional day
- move_workout: from, to (weekdays) — swaps two days of the plan
- set_rest: exercise, seconds
- start_workout: optional day (a weekday or "custom")
- add_note: text, optional exercise
Use exercise names exactly as they appear in the plan or session. Only propose changes the user asked about or that clearly help; never more than 3 per reply. Without a change to propose, add no block.`;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

class ActionError extends Error {
  constructor(message: string, public status = 422) {
    super(message);
  }
}

async function todaySession(repo: UserRepo, date: string) {
  const s = (await repo.liveSession()) ?? (await repo.sessionByDate(date));
  if (!s) throw new ActionError("Start today's workout first, or use Apply to plan.", 409);
  return s;
}

function findEx<T extends { name: string }>(list: T[], name: string, where: string) {
  const hit = list.find((e) => norm(e.name) === norm(name));
  if (!hit) throw new ActionError(`${name} isn't in ${where}.`);
  return hit;
}

/** Applies one action and returns the undo snapshot. */
async function apply(repo: UserRepo, a: CoachAction, scope: "today" | "plan", date: string): Promise<CoachActionDoc["before"]> {
  if (a.type === "set_rest") {
    const profile = await repo.profile();
    const before = structuredClone(profile);
    profile.restOverrides = { ...(profile.restOverrides ?? {}), [a.exercise.toLowerCase()]: a.seconds };
    await repo.saveProfile(profile);
    return { kind: "profile", profile: before };
  }
  if (a.type === "start_workout") throw new ActionError("Start a workout from the app.", 400);

  if (scope === "today" || a.type === "add_note") {
    if (a.type === "move_workout") throw new ActionError("Moving a workout changes the plan. Use Apply to plan.");
    const s = await todaySession(repo, date);
    const before = structuredClone(s);
    if (a.type === "swap_exercise") {
      const e = findEx(s.exercises, a.from, "today's workout");
      Object.assign(e, { name: a.to, muscle: classifyMuscle(a.to), equipment: guessEquipment(a.to) });
    } else if (a.type === "change_sets_reps") {
      if (!a.sets) throw new ActionError("Rep ranges live in the plan. Use Apply to plan.");
      const e = findEx(s.exercises, a.exercise, "today's workout");
      const doneCount = e.sets.filter((x) => x.done).length;
      const target = Math.max(a.sets, doneCount);
      while (e.sets.length > target) {
        const i = e.sets.map((x) => x.done).lastIndexOf(false);
        if (i < 0) break;
        e.sets.splice(i, 1);
      }
      while (e.sets.length < target) e.sets.push({ weightKg: e.sets.at(-1)?.weightKg ?? null, reps: null, negatives: null, done: false, completedAt: null });
    } else if (a.type === "add_note") {
      if (a.exercise) {
        const e = findEx(s.exercises, a.exercise, "today's workout");
        e.notes = [e.notes, a.text].filter(Boolean).join("\n");
      } else s.notes = [s.notes, a.text].filter(Boolean).join("\n");
    }
    s.updatedAt = now();
    await repo.upsertSession(s);
    return { kind: "session", session: before };
  }

  const plan = await repo.activePlan();
  if (!plan) throw new ActionError("You don't have an active plan yet.");
  const before = structuredClone(plan);
  if (a.type === "move_workout") {
    const from = plan.days.find((d) => d.day === a.from);
    const to = plan.days.find((d) => d.day === a.to);
    if (!from || !to) throw new ActionError("Those days aren't in your plan.");
    const { title, isRest, exercises, notes } = from;
    Object.assign(from, { title: to.title, isRest: to.isRest, exercises: to.exercises, notes: to.notes });
    Object.assign(to, { title, isRest, exercises, notes });
  } else {
    const days = a.day ? plan.days.filter((d) => d.day === a.day) : plan.days;
    const name = a.type === "swap_exercise" ? a.from : a.exercise;
    const hits = days.flatMap((d) => d.exercises.filter((e) => norm(e.name) === norm(name)));
    if (!hits.length) throw new ActionError(`${name} isn't in your plan${a.day ? ` on ${a.day}` : ""}.`);
    for (const e of hits) {
      if (a.type === "swap_exercise") Object.assign(e, { name: a.to, alternatives: [], muscle: classifyMuscle(a.to) });
      else if (a.type === "change_sets_reps") {
        if (a.sets) e.sets = a.sets;
        if (a.repMin) e.repMin = a.repMin;
        if (a.repMax) e.repMax = a.repMax;
        if (e.repMax < e.repMin) e.repMax = e.repMin;
      }
    }
  }
  await repo.replacePlan(plan);
  await repo.deletePlanScores(plan.id);
  return { kind: "plan", plan: before };
}

coach.post("/coach/actions/apply", wrap(async (req, res) => {
  const body = z
    .object({ action: CoachActionSchema, scope: z.enum(["today", "plan"]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .parse(req.body);
  const action = body.action as CoachAction;
  const repo = repoOf(req);
  let before;
  try {
    before = await apply(repo, action, body.scope, body.date);
  } catch (e) {
    if (e instanceof ActionError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
  const summary = describeAction(action);
  const doc: CoachActionDoc = { id: newId(), action, scope: body.scope, summary, createdAt: now(), undoneAt: null, before };
  await repo.addCoachAction(doc);
  await repo.addChat({ id: newId(), role: "user", content: `[Applied${body.scope === "plan" ? " to my plan" : " today"}] ${summary}`, createdAt: now() });
  const { before: _b, ...applied } = doc;
  res.json(applied);
}));

coach.post("/coach/actions/:id/undo", wrap(async (req, res) => {
  const repo = repoOf(req);
  const doc = await repo.coachAction(String(req.params.id));
  if (!doc) return res.status(404).json({ error: "Action not found" });
  if (doc.undoneAt) return res.status(409).json({ error: "Already undone" });
  const b = doc.before;
  if (b.kind === "plan") await repo.replacePlan(b.plan);
  else if (b.kind === "profile") await repo.saveProfile(b.profile);
  else {
    // Put back only what the action touched, so sets logged since then and the timer survive.
    const current = await repo.sessionById(b.session.id);
    if (current) await repo.upsertSession({ ...current, exercises: b.session.exercises, notes: b.session.notes, updatedAt: now() });
  }
  const at = now();
  await repo.markActionUndone(doc.id, at);
  await repo.addChat({ id: newId(), role: "user", content: `[Undid] ${doc.summary}`, createdAt: at });
  res.json({ ok: true });
}));

// ── Prompts for users without an AI key ──────────────────────
async function contextFor(repo: UserRepo) {
  const [plan, profile, all, scores, logs, food] = await Promise.all([
    repo.activePlan(),
    repo.profile(),
    repo.sessions(),
    repo.scores(),
    repo.foodLogs(),
    nutritionContextLine(repo, new Date().toISOString().slice(0, 10)).catch(() => ""),
  ]);
  const text = [buildChatContext(profile, plan, scores, mergeFoodLogs(all, logs)), food].filter(Boolean).join("\n\n");
  return { plan, all, text };
}

const summaryText = (s: WorkoutSummary) =>
  [
    `WORKOUT JUST FINISHED: ${s.title} on ${s.session.date}`,
    `Time: ${s.durationMin ?? "?"} min · sets ${s.setsDone}/${s.setsPlanned} · volume ${s.volumeKg} kg${s.session.sessionRpe ? ` · RPE ${s.session.sessionRpe}` : ""}`,
    s.prs.length ? `PRs: ${s.prs.map((p) => `${p.exercise} ${p.detail}`).join("; ")}` : "No PRs.",
    ...s.exercises.map((e) => `- ${e.name}: best ${e.bestSet ?? "not done"} (last time ${e.prevBestSet ?? "n/a"}), ${e.trend}`),
    s.session.notes ? `Notes: ${s.session.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

const NOTE_ASK = "Write a short coach note on this workout (3–4 sentences): one thing that went well, one thing to change next time with exact numbers, and a sentence of encouragement. No headings.";

coach.post("/coach/prompt", wrap(async (req, res) => {
  const body = z
    .object({
      kind: z.enum(["chat", "coach-note"]),
      message: z.string().max(8000).optional(),
      page: PageSchema.optional(),
      sessionId: z.string().max(64).optional(),
    })
    .parse(req.body);
  const repo = repoOf(req);
  const { plan, all, text } = await contextFor(repo);
  if (body.kind === "coach-note") {
    const s = all.find((x) => x.id === body.sessionId);
    if (!s) return res.status(404).json({ error: "Workout not found" });
    return res.json({ text: `${COACH_SYSTEM}\n\nMY TRAINING DATA:\n${text}\n\n${summaryText(buildSummary(s, all, plan))}\n\n${NOTE_ASK}` });
  }
  res.json({
    text: [
      COACH_SYSTEM,
      `MY TRAINING DATA (from the StarkFitIQ app):\n${text}`,
      body.page ? `I'm looking at: ${pageLine(body.page)}.` : "",
      ACTION_GUIDE,
      `MY QUESTION:\n${body.message?.trim() || "(ask me what I need help with)"}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
}));

/** AI coach note for a finished workout; without a key, returns the prompt to paste instead. */
coach.post("/sessions/:id/coach-note", wrap(async (req, res) => {
  const repo = repoOf(req);
  const { plan, all, text } = await contextFor(repo);
  const s = all.find((x) => x.id === String(req.params.id));
  if (!s) return res.status(404).json({ error: "Workout not found" });
  if (isLive(s)) return res.status(409).json({ error: "Finish the workout first" });
  const summary = summaryText(buildSummary(s, all, plan));
  const ai = aiForUser(req.user!);
  if (!ai) return res.json({ note: null, prompt: `${COACH_SYSTEM}\n\nMY TRAINING DATA:\n${text}\n\n${summary}\n\n${NOTE_ASK}` });
  let note: string;
  try {
    note = (await ai.stream({ system: `${COACH_SYSTEM}\n\nATHLETE CONTEXT:\n${text}`, messages: [{ role: "user", content: `${summary}\n\n${NOTE_ASK}` }], maxTokens: 400, onText: () => {} })).trim();
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : "The AI provider didn't answer" });
  }
  const saved: WorkoutSession = { ...s, coachNote: { text: note, source: "ai", createdAt: now() } };
  await repo.upsertSession(saved);
  res.json({ note: saved.coachNote, prompt: null });
}));
