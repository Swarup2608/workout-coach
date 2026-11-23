import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  MEALS,
  addDays,
  sumMacros,
  weekdayOf,
  type FoodItem,
  type FoodLog,
  type FoodLogEntry,
  type Macros,
  type NutritionDay,
  type WorkoutPlan,
  type WorkoutSession,
} from "../domain.js";
import { userRepo, type UserRepo } from "../repo.js";
import { newId, now } from "../util/id.js";
import { builtInFood, computeTargets, searchFoods } from "../services/nutrition.js";

/** Food log, targets, food search, favourites and own foods. Mounted on the authenticated `api` router. */
export const nutrition = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const repoOf = (req: Request) => userRepo(req.user!._id);

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
const DateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((d) => {
    const t = new Date(`${d}T00:00:00Z`);
    return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
  }, "Not a real date");

const MAX_ENTRIES = 100;
const MAX_CUSTOM = 300;
const MAX_FAVOURITES = 200;

const Meal = z.enum(MEALS);
const Servings = z.number().min(0.25).max(20);
const Gram = z.number().min(0).max(1000);
const Kcal = z.number().min(0).max(5000);

const r1 = (n: number) => Math.round(n * 10) / 10;
const scale = (per: Macros, servings: number): Macros => ({
  kcal: Math.round(per.kcal * servings),
  proteinG: r1(per.proteinG * servings),
  carbsG: r1(per.carbsG * servings),
  fatG: r1(per.fatG * servings),
});
const macrosOf = (f: Macros): Macros => ({ kcal: f.kcal, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG });

// ── Day helpers ──────────────────────────────────────────────
/**
 * The day's food log. When there is none yet, food and water typed into that day's workout log
 * (before the food log existed) become its first entries, so nothing is lost or counted twice.
 */
export async function loadLog(repo: UserRepo, date: string): Promise<FoodLog> {
  const log = await repo.foodLog(date);
  if (log) return log;
  const s = await repo.sessionByDate(date);
  const createdAt = s?.updatedAt ?? now();
  return {
    date,
    entries: (s?.food ?? []).map((f) => {
      const m = { kcal: f.kcal ?? 0, proteinG: f.proteinG ?? 0, carbsG: f.carbsG ?? 0, fatG: f.fatG ?? 0 };
      return { id: newId(), meal: f.meal ?? "snack", name: f.name, foodId: null, servings: 1, serving: null, per: m, ...m, source: "import" as const, createdAt };
    }),
    waterMl: s?.waterL ? Math.round(s.waterL * 1000) : 0,
    updatedAt: createdAt,
  };
}

const isTrainingDay = (plan: WorkoutPlan | null, session: WorkoutSession | null, date: string) =>
  !!session?.exercises.some((e) => e.sets.some((x) => x.done)) ||
  !!plan?.days.some((d) => d.day === weekdayOf(date) && !d.isRest && d.exercises.length > 0);

/** Latest bodyweight on or before the date: check-in, then workout log, then the profile. */
async function latestWeight(repo: UserRepo, date: string, startKg: number | null) {
  const [checkins, sessions] = await Promise.all([repo.checkins(addDays(date, -90), date), repo.sessions()]);
  const c = [...checkins].reverse().find((x) => x.weightKg);
  if (c?.weightKg) return { kg: c.weightKg, source: "check-in" as const };
  const s = [...sessions].filter((x) => x.date <= date && x.bodyweightKg).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (s?.bodyweightKg) return { kg: s.bodyweightKg, source: "workout log" as const };
  return { kg: startKg, source: "profile" as const };
}

async function targetsContext(repo: UserRepo, date: string) {
  const [profile, plan] = await Promise.all([repo.profile(), repo.activePlan()]);
  const weight = await latestWeight(repo, date, profile.startBodyweightKg);
  const plannedDays = plan ? plan.days.filter((d) => !d.isRest && d.exercises.length > 0).length : null;
  return { profile, plan, weight, plannedDays };
}

async function dayView(repo: UserRepo, date: string, log?: FoodLog): Promise<NutritionDay> {
  const [ctx, theLog, session] = await Promise.all([targetsContext(repo, date), log ?? loadLog(repo, date), repo.sessionByDate(date)]);
  const trainingDay = isTrainingDay(ctx.plan, session, date);
  const t = computeTargets({ profile: ctx.profile, weightKg: ctx.weight.kg, weightSource: ctx.weight.source, trainingDay, plannedDays: ctx.plannedDays });
  return { date, log: theLog, totals: sumMacros(theLog.entries), targets: t.targets, missing: t.missing, trainingDay };
}

/** One line for the coach's context: what was eaten today against the targets. */
export async function nutritionContextLine(repo: UserRepo, date: string): Promise<string> {
  const d = await dayView(repo, date);
  const t = d.targets;
  if (!d.log.entries.length && !d.log.waterMl && !t) return "";
  const of = (v: number, target: number | undefined, unit: string) => `${v}${target ? `/${target}` : ""} ${unit}`;
  return [
    `NUTRITION TODAY (${date}, ${d.trainingDay ? "training day" : "rest day"}): eaten ${of(d.totals.kcal, t?.kcal, "kcal")}, protein ${of(d.totals.proteinG, t?.proteinG, "g")}, carbs ${of(d.totals.carbsG, t?.carbsG, "g")}, fat ${of(d.totals.fatG, t?.fatG, "g")}, water ${of(d.log.waterMl, t?.waterMl, "ml")}.`,
    t ? "" : `No targets yet: profile is missing ${d.missing.join(", ")}.`,
    ...d.log.entries.map((e) => `- ${e.meal}: ${e.name}${e.servings !== 1 ? ` × ${e.servings}` : ""} (${e.kcal} kcal, ${e.proteinG} g protein)`),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Loads the day, applies a change, saves, and answers with the updated day. */
async function changeDay(req: Request, res: Response, fn: (log: FoodLog) => void | Response) {
  const date = DateParam.parse(req.params.date);
  const repo = repoOf(req);
  const log = await loadLog(repo, date);
  const out = fn(log);
  if (out) return out;
  log.updatedAt = now();
  await repo.saveFoodLog(log);
  res.json(await dayView(repo, date, log));
}

// ── Day ──────────────────────────────────────────────────────
nutrition.get("/nutrition/day/:date", wrap(async (req, res) => {
  const date = DateParam.parse(req.params.date);
  res.json(await dayView(repoOf(req), date));
}));

/** Calories and protein per day for the 7 days ending on `date`, with that day's targets. */
nutrition.get("/nutrition/week", wrap(async (req, res) => {
  const to = DateParam.parse(String(req.query.date ?? new Date().toISOString().slice(0, 10)));
  const from = addDays(to, -6);
  const repo = repoOf(req);
  const [ctx, logs, sessions] = await Promise.all([targetsContext(repo, to), repo.foodLogs(from, to), repo.sessions()]);
  const logByDate = new Map(logs.map((l) => [l.date, l]));
  const sessByDate = new Map(sessions.map((s) => [s.date, s]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((date) => {
    const s = sessByDate.get(date) ?? null;
    const log = logByDate.get(date);
    // Older days may only have food typed into the workout log.
    const totals = log ? sumMacros(log.entries) : sumMacros((s?.food ?? []).map((f) => ({ kcal: f.kcal ?? 0, proteinG: f.proteinG ?? 0, carbsG: f.carbsG ?? 0, fatG: f.fatG ?? 0 })));
    const trainingDay = isTrainingDay(ctx.plan, s, date);
    const t = computeTargets({ profile: ctx.profile, weightKg: ctx.weight.kg, weightSource: ctx.weight.source, trainingDay, plannedDays: ctx.plannedDays }).targets;
    const logged = log ? log.entries.length > 0 : !!s?.food?.length;
    return { date, logged, trainingDay, ...totals, targetKcal: t?.kcal ?? null, targetProteinG: t?.proteinG ?? null };
  });
  res.json({ days });
}));

const AddEntry = z.union([
  z.object({ meal: Meal, foodId: z.string().min(1).max(80), servings: Servings.default(1) }).strict(),
  z
    .object({
      meal: Meal,
      name: z.string().trim().min(1).max(120),
      kcal: Kcal,
      proteinG: Gram.default(0),
      carbsG: Gram.default(0),
      fatG: Gram.default(0),
      servings: Servings.default(1),
    })
    .strict(),
]);

nutrition.post("/nutrition/day/:date/entries", wrap(async (req, res) => {
  const body = AddEntry.parse(req.body);
  const prefs = "foodId" in body ? await repoOf(req).nutritionPrefs() : null;
  await changeDay(req, res, (log) => {
    if (log.entries.length >= MAX_ENTRIES) return res.status(422).json({ error: `A day holds up to ${MAX_ENTRIES} items.` });
    let entry: FoodLogEntry;
    if ("foodId" in body) {
      const food = builtInFood(body.foodId) ?? prefs!.customFoods.find((f) => f.id === body.foodId);
      if (!food) return res.status(404).json({ error: "Food not found" });
      const per = macrosOf(food);
      entry = { id: newId(), meal: body.meal, name: food.name, foodId: food.id, servings: body.servings, serving: food.serving, per, ...scale(per, body.servings), source: food.custom ? "custom" : "db", createdAt: now() };
    } else {
      const per = { kcal: Math.round(body.kcal), proteinG: r1(body.proteinG), carbsG: r1(body.carbsG), fatG: r1(body.fatG) };
      entry = { id: newId(), meal: body.meal, name: body.name, foodId: null, servings: body.servings, serving: null, per, ...scale(per, body.servings), source: "quick", createdAt: now() };
    }
    log.entries.push(entry);
  });
}));

nutrition.patch("/nutrition/day/:date/entries/:id", wrap(async (req, res) => {
  const body = z.object({ servings: Servings.optional(), meal: Meal.optional() }).strict().parse(req.body);
  await changeDay(req, res, (log) => {
    const e = log.entries.find((x) => x.id === req.params.id);
    if (!e) return res.status(404).json({ error: "Entry not found" });
    if (body.meal) e.meal = body.meal;
    if (body.servings) Object.assign(e, { servings: body.servings }, scale(e.per, body.servings));
  });
}));

nutrition.delete("/nutrition/day/:date/entries/:id", wrap(async (req, res) => {
  await changeDay(req, res, (log) => {
    const before = log.entries.length;
    log.entries = log.entries.filter((x) => x.id !== req.params.id);
    if (log.entries.length === before) return res.status(404).json({ error: "Entry not found" });
  });
}));

nutrition.put("/nutrition/day/:date/water", wrap(async (req, res) => {
  const { waterMl } = z.object({ waterMl: z.number().int().min(0).max(10000) }).strict().parse(req.body);
  await changeDay(req, res, (log) => void (log.waterMl = waterMl));
}));

// ── Foods ────────────────────────────────────────────────────
nutrition.get("/nutrition/foods", wrap(async (req, res) => {
  const q = String(req.query.q ?? "").slice(0, 80);
  const repo = repoOf(req);
  const [profile, prefs] = await Promise.all([repo.profile(), repo.nutritionPrefs()]);
  res.json({ foods: searchFoods(q, { diet: profile.diet, all: req.query.all === "1", custom: prefs.customFoods }), diet: profile.diet ?? null });
}));

/** Recent items (last 60 days, newest first), favourites and own foods for the Add-food page. */
nutrition.get("/nutrition/library", wrap(async (req, res) => {
  const repo = repoOf(req);
  const date = DateParam.parse(String(req.query.date ?? new Date().toISOString().slice(0, 10)));
  const [prefs, logs] = await Promise.all([repo.nutritionPrefs(), repo.foodLogs(addDays(date, -60), date)]);
  const seen = new Set<string>();
  const recent: { foodId: string | null; name: string; serving: string | null; servings: number; meal: string; per: Macros; lastDate: string }[] = [];
  for (const log of [...logs].reverse())
    for (const e of [...log.entries].reverse()) {
      const key = e.foodId ?? `quick:${e.name.toLowerCase()}`;
      if (seen.has(key) || recent.length >= 25) continue;
      // Skip foods that were deleted from the user's own list since.
      if (e.foodId && !builtInFood(e.foodId) && !prefs.customFoods.some((f) => f.id === e.foodId)) continue;
      seen.add(key);
      recent.push({ foodId: e.foodId, name: e.name, serving: e.serving, servings: e.servings, meal: e.meal, per: e.per, lastDate: log.date });
    }
  const lookup = (id: string) => builtInFood(id) ?? prefs.customFoods.find((f) => f.id === id) ?? null;
  res.json({
    recent,
    favourites: prefs.favourites.map(lookup).filter((f): f is FoodItem => !!f),
    custom: prefs.customFoods,
  });
}));

nutrition.put("/nutrition/favourites/:foodId", wrap(async (req, res) => {
  const repo = repoOf(req);
  const prefs = await repo.nutritionPrefs();
  const id = String(req.params.foodId);
  if (!builtInFood(id) && !prefs.customFoods.some((f) => f.id === id)) return res.status(404).json({ error: "Food not found" });
  if (!prefs.favourites.includes(id)) {
    if (prefs.favourites.length >= MAX_FAVOURITES) return res.status(422).json({ error: `Up to ${MAX_FAVOURITES} favourites.` });
    prefs.favourites.unshift(id);
    await repo.saveNutritionPrefs(prefs);
  }
  res.json({ favourites: prefs.favourites });
}));

nutrition.delete("/nutrition/favourites/:foodId", wrap(async (req, res) => {
  const repo = repoOf(req);
  const prefs = await repo.nutritionPrefs();
  prefs.favourites = prefs.favourites.filter((x) => x !== req.params.foodId);
  await repo.saveNutritionPrefs(prefs);
  res.json({ favourites: prefs.favourites });
}));

const CustomFood = z
  .object({
    name: z.string().trim().min(1).max(120),
    serving: z.string().trim().min(1).max(60).default("1 serving"),
    grams: z.number().min(0).max(5000).default(0),
    kcal: Kcal,
    proteinG: Gram.default(0),
    carbsG: Gram.default(0),
    fatG: Gram.default(0),
  })
  .strict();

nutrition.post("/nutrition/custom-foods", wrap(async (req, res) => {
  const body = CustomFood.parse(req.body);
  const repo = repoOf(req);
  const [prefs, profile] = await Promise.all([repo.nutritionPrefs(), repo.profile()]);
  if (prefs.customFoods.length >= MAX_CUSTOM) return res.status(422).json({ error: `Up to ${MAX_CUSTOM} own foods.` });
  const food: FoodItem = {
    id: `u-${newId()}`,
    name: body.name,
    category: "My foods",
    serving: body.serving,
    grams: body.grams,
    kcal: Math.round(body.kcal),
    proteinG: r1(body.proteinG),
    carbsG: r1(body.carbsG),
    fatG: r1(body.fatG),
    // Own foods always show in search; this only records the user's diet when it was made.
    diet: profile.diet === "vegan" ? "vegan" : profile.diet === "non_veg" ? "non_veg" : profile.diet === "eggetarian" ? "egg" : "veg",
    custom: true,
  };
  prefs.customFoods.unshift(food);
  await repo.saveNutritionPrefs(prefs);
  res.status(201).json(food);
}));

nutrition.delete("/nutrition/custom-foods/:id", wrap(async (req, res) => {
  const repo = repoOf(req);
  const prefs = await repo.nutritionPrefs();
  prefs.customFoods = prefs.customFoods.filter((f) => f.id !== req.params.id);
  prefs.favourites = prefs.favourites.filter((x) => x !== req.params.id);
  await repo.saveNutritionPrefs(prefs);
  res.status(204).end();
}));
