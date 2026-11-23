import foods from "../seed/foods.json" with { type: "json" };
import {
  allowedFoodDiets,
  weekdayOf,
  type Diet,
  type FoodEntry,
  type FoodItem,
  type FoodLog,
  type GoalKey,
  type NutritionTargets,
  type Profile,
  type WorkoutSession,
} from "../domain.js";

/**
 * Nutrition: the built-in food database, food search, daily targets, and the bridge that lets
 * week scoring and the coach read the food log as if it were part of each day's session.
 */

export const FOODS: FoodItem[] = foods as FoodItem[];
const FOOD_BY_ID = new Map(FOODS.map((f) => [f.id, f]));
export const builtInFood = (id: string) => FOOD_BY_ID.get(id) ?? null;

// ── Search ───────────────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Higher is better; 0 = no match. Every query word has to match the name, an alias or the category. */
function matchScore(f: FoodItem, words: string[], phrase: string): number {
  const name = norm(f.name);
  const aliases = (f.aliases ?? []).map(norm);
  const hay = [name, ...aliases, norm(f.category)].join(" | ");
  if (!words.every((w) => hay.includes(w))) return 0;
  if (name === phrase || aliases.includes(phrase)) return 100;
  if (name.startsWith(phrase)) return 80;
  if (aliases.some((a) => a.startsWith(phrase))) return 70;
  const wordStart = (s: string) => words.every((w) => s.split(" ").some((t) => t.startsWith(w)));
  if (wordStart(name)) return 60;
  if (aliases.some(wordStart)) return 50;
  return 20;
}

/**
 * Searches built-in and the user's own foods. Foods outside the user's diet are left out
 * unless `all` is set. An empty query lists the user's foods first, then the database by category.
 */
export function searchFoods(q: string, opts: { diet?: Diet | null; all?: boolean; custom?: FoodItem[]; limit?: number } = {}): FoodItem[] {
  const allowed = new Set(allowedFoodDiets(opts.all ? null : opts.diet));
  // The user's own foods always show; the diet filter is for the built-in database.
  const pool = [...(opts.custom ?? []), ...FOODS.filter((f) => allowed.has(f.diet))];
  const phrase = norm(q);
  const limit = opts.limit ?? 40;
  if (!phrase) return pool.slice(0, limit);
  const words = phrase.split(" ");
  return pool
    .map((f, i) => ({ f, i, s: matchScore(f, words, phrase) + (f.custom ? 5 : 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.f.name.length - b.f.name.length || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.f);
}

// ── Targets ──────────────────────────────────────────────────
/** Average daily activity multiplier from planned training days per week. */
export function activityFactor(daysPerWeek: number | null | undefined): number {
  const d = daysPerWeek ?? 3;
  return d <= 1 ? 1.2 : d <= 3 ? 1.375 : d <= 5 ? 1.55 : 1.725;
}

const GOAL_KCAL: Record<GoalKey, number> = { fat_loss: -0.2, muscle_gain: 0.1, strength: 0.05, maintain: 0, general: 0 };
const GOAL_PROTEIN: Record<GoalKey, number> = { fat_loss: 2.0, muscle_gain: 1.8, strength: 1.8, maintain: 1.6, general: 1.4 };
const GOAL_WORDS: Record<GoalKey, string> = {
  fat_loss: "20% below maintenance for fat loss",
  muscle_gain: "10% above maintenance for muscle gain",
  strength: "5% above maintenance to support strength work",
  maintain: "at maintenance",
  general: "at maintenance",
};
/** Training days get this share more than rest days; the weekly average stays the same. */
const TRAINING_BUMP = 0.12;

export interface TargetInput {
  profile: Pick<Profile, "age" | "sex" | "heightCm" | "goalKey" | "daysPerWeek">;
  weightKg: number | null;
  weightSource: NutritionTargets["weightSource"];
  trainingDay: boolean;
  /** Training days in the active plan (falls back to the profile's days per week) */
  plannedDays?: number | null;
}

export type TargetResult = { targets: NutritionTargets; missing: [] } | { targets: null; missing: ("age" | "height" | "weight")[] };

const r10 = (n: number) => Math.round(n / 10) * 10;
const r250 = (n: number) => Math.round(n / 250) * 250;

/**
 * Daily calorie, macro and water targets.
 * BMR: Mifflin-St Jeor (sex "other" or unset uses the midpoint of the male and female formulas).
 * TDEE: BMR × activity factor from training days per week, then the goal adjustment.
 * Training days get more food than rest days, keeping the weekly average. Never below BMR or 1200 kcal.
 * Protein by goal (1.4–2.0 g/kg, capped at 220 g), fat 25% of calories (at least 0.6 g/kg), carbs fill the rest.
 */
export function computeTargets(input: TargetInput): TargetResult {
  const { profile, weightKg } = input;
  const missing: ("age" | "height" | "weight")[] = [];
  if (!profile.age) missing.push("age");
  if (!profile.heightCm) missing.push("height");
  if (!weightKg) missing.push("weight");
  if (missing.length) return { targets: null, missing };
  const kg = weightKg!;
  const sexConst = profile.sex === "male" ? 5 : profile.sex === "female" ? -161 : -78;
  const bmr = 10 * kg + 6.25 * profile.heightCm! - 5 * profile.age! + sexConst;
  const days = Math.min(7, Math.max(0, input.plannedDays ?? profile.daysPerWeek ?? 3));
  const tdee = bmr * activityFactor(days);
  const goal: GoalKey = profile.goalKey ?? "maintain";
  const avg = tdee * (1 + GOAL_KCAL[goal]);
  // Split the weekly budget: rest = avg − d·bump/7, training = rest + bump.
  const bump = avg * TRAINING_BUMP;
  const rest = avg - (days * bump) / 7;
  const floor = Math.max(bmr, 1200);
  const kcal = r10(Math.max(floor, input.trainingDay && days > 0 ? rest + bump : rest));
  const proteinG = Math.round(Math.min(220, kg * GOAL_PROTEIN[goal]));
  const fatG = Math.round(Math.max(kg * 0.6, (kcal * 0.25) / 9));
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  const waterMl = r250(kg * 35 + (input.trainingDay ? 500 : 0));
  const basis = [
    `Resting burn (BMR) about ${r10(bmr)} kcal, from your age, height, ${profile.sex === "male" || profile.sex === "female" ? "sex " : ""}and ${Math.round(kg * 10) / 10} kg (${input.weightSource}).`,
    `About ${r10(tdee)} kcal a day on average with ${days} training day${days === 1 ? "" : "s"} a week.`,
    `Set ${GOAL_WORDS[goal]}${input.trainingDay && days > 0 ? "; training days get a little more than rest days" : days > 0 ? "; rest days get a little less than training days" : ""}.`,
    `Protein ${GOAL_PROTEIN[goal]} g per kg, fat about 25% of calories, carbs make up the rest.`,
  ];
  return {
    targets: { kcal, proteinG, carbsG, fatG, waterMl, trainingDay: input.trainingDay, bmr: Math.round(bmr), tdee: Math.round(tdee), weightKg: kg, weightSource: input.weightSource, basis },
    missing: [],
  };
}

// ── Food log ↔ sessions bridge ───────────────────────────────
/** Food log entries in the older FoodEntry shape that scoring and the coach read. */
export const logAsFoodEntries = (log: FoodLog): FoodEntry[] =>
  log.entries.map((e) => ({
    meal: e.meal,
    name: e.servings === 1 ? e.name : `${e.name} × ${e.servings}`,
    kcal: e.kcal,
    proteinG: e.proteinG,
    carbsG: e.carbsG,
    fatG: e.fatG,
  }));

/**
 * Puts each day's food log onto that day's session (the log wins over food typed into older
 * sessions). Days with food but no session get a food-only session with no exercises, so
 * weekly calories and protein count them. Only for read-side maths; never saved.
 */
export function mergeFoodLogs(sessions: WorkoutSession[], logs: FoodLog[]): WorkoutSession[] {
  const byDate = new Map(logs.filter((l) => l.entries.length || l.waterMl).map((l) => [l.date, l]));
  const out = sessions.map((s) => {
    const log = byDate.get(s.date);
    if (!log) return s;
    byDate.delete(s.date);
    return { ...s, food: logAsFoodEntries(log), waterL: log.waterMl ? log.waterMl / 1000 : (s.waterL ?? null) };
  });
  for (const log of byDate.values())
    out.push({
      id: `food-${log.date}`,
      planId: "",
      date: log.date,
      day: weekdayOf(log.date),
      exercises: [],
      cardioMinutes: null,
      sessionRpe: null,
      bodyweightKg: null,
      food: logAsFoodEntries(log),
      waterL: log.waterMl ? log.waterMl / 1000 : null,
      notes: "",
      createdAt: log.updatedAt,
      updatedAt: log.updatedAt,
    });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
