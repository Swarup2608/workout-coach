import { allowedFoodDiets, type Diet, type FoodItem, type Macros, type Meal, type MealOption } from "../domain.js";
import { FOODS } from "./nutrition.js";

/**
 * Rule-based meal ideas from the food database (no AI): "what should I eat now" and the day meal planner.
 * Each meal has templates (e.g. roti + dal + a side); every combination is scored on how close it lands
 * to the meal's calorie budget, how much of the protein it covers, and how fatty it is. Foods the user
 * has favourited or eaten lately get a small boost. A seed shuffles near-ties so "Shuffle" shows others.
 */

/** Share of the day's calories each meal gets in a plan. */
export const MEAL_SHARE: Record<Meal, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };
/** Meals in eating order. */
export const MEAL_ORDER: Meal[] = ["breakfast", "lunch", "snack", "dinner"];

type Slot = { cats: string[]; optional?: boolean; /** servings flex to fit the budget */ main?: boolean };

const SIDES = ["Vegetables", "Protein", "Dairy"];
const TEMPLATES: Record<Meal, Slot[][]> = {
  breakfast: [
    [{ cats: ["Breakfast"], main: true }, { cats: ["Dal & curries", "Dairy", "Eggs", "Fruit"], optional: true }],
    [{ cats: ["Breads"], main: true }, { cats: ["Dairy", "Eggs"] }],
    [{ cats: ["Eggs"], main: true }, { cats: ["Breads", "Fruit"], optional: true }],
  ],
  lunch: [
    [{ cats: ["Breads"], main: true }, { cats: ["Dal & curries"] }, { cats: SIDES, optional: true }],
    [{ cats: ["Rice"], main: true }, { cats: ["Dal & curries"] }, { cats: SIDES, optional: true }],
  ],
  dinner: [
    [{ cats: ["Breads"], main: true }, { cats: ["Dal & curries"] }, { cats: SIDES, optional: true }],
    [{ cats: ["Rice"], main: true }, { cats: ["Dal & curries"] }, { cats: SIDES, optional: true }],
  ],
  snack: [[{ cats: ["Fruit", "Nuts & seeds", "Dairy", "Protein", "Snacks", "Eggs"], main: true }, { cats: ["Fruit", "Drinks"], optional: true }]],
};

const fatShare = (m: Macros) => (m.kcal ? (m.fatG * 9) / m.kcal : 0);
/** Fried and sugary picks (samosa, jalebi, butter) never get suggested. */
const suggestible = (f: FoodItem) => f.kcal > 0 && fatShare(f) <= 0.55 && !["Sweets", "Fats & extras", "Other meals"].includes(f.category);
/** Supplements belong in snacks, not on a lunch plate. */
const SUPPLEMENTS = new Set(["whey"]);
/** "Soya chunk curry" + "Soya chunks (dry)" is the same food twice. */
const base = (f: FoodItem) => f.name.toLowerCase().split(/[\s/(]+/)[0];

/** Small deterministic hash → [0, 1), so the same seed gives the same suggestions. */
function jitter(seed: number, key: string) {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const scaled = (f: FoodItem, servings: number): Macros => ({
  kcal: Math.round(f.kcal * servings),
  proteinG: r1(f.proteinG * servings),
  carbsG: r1(f.carbsG * servings),
  fatG: r1(f.fatG * servings),
});
const add = (a: Macros, b: Macros): Macros => ({ kcal: a.kcal + b.kcal, proteinG: r1(a.proteinG + b.proteinG), carbsG: r1(a.carbsG + b.carbsG), fatG: r1(a.fatG + b.fatG) });
const ZERO: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export interface SuggestInput {
  meal: Meal;
  budget: { kcal: number; proteinG: number };
  diet?: Diet | null;
  /** Favourites and recently eaten food ids */
  liked?: Set<string>;
  seed?: number;
  count?: number;
}

export function suggestMeal(input: SuggestInput): MealOption[] {
  const { meal, budget } = input;
  const seed = input.seed ?? 0;
  const liked = input.liked ?? new Set<string>();
  const allowed = new Set(allowedFoodDiets(input.diet));
  const pool = FOODS.filter((f) => allowed.has(f.diet) && suggestible(f));
  const B = Math.max(80, budget.kcal);
  const P = Math.max(0, budget.proteinG);

  // Best few per slot by protein per calorie, with liked foods and the seed nudging the order.
  const candidates = (slot: Slot) =>
    pool
      .filter((f) => slot.cats.includes(f.category) && (!slot.main || f.kcal <= B * 1.6) && (meal === "snack" || !SUPPLEMENTS.has(f.id)))
      .map((f) => ({ f, q: (f.proteinG * 4) / f.kcal + (liked.has(f.id) ? 0.15 : 0) + jitter(seed, f.id) * 0.25 }))
      .sort((a, b) => b.q - a.q)
      .slice(0, 6)
      .map((x) => x.f);

  const scored: { option: MealOption; score: number; key: string }[] = [];
  for (const template of TEMPLATES[meal]) {
    const lists = template.map((slot) => (slot.optional ? [null, ...candidates(slot)] : candidates(slot)));
    if (lists.some((l) => !l.length)) continue;
    const combos: (FoodItem | null)[][] = lists.reduce<(FoodItem | null)[][]>((acc, list) => acc.flatMap((c) => list.map((f) => [...c, f])), [[]]);
    for (const combo of combos) {
      const ids = combo.filter(Boolean).map((f) => f!.id);
      const present = combo.filter((f): f is FoodItem => !!f);
      if (new Set(present.map(base)).size !== present.length) continue;
      const mainIdx = template.findIndex((s) => s.main);
      const main = combo[mainIdx]!;
      const fixed = combo.reduce((acc, f, i) => (f && i !== mainIdx ? add(acc, scaled(f, 1)) : acc), ZERO);
      // Main servings fill the budget the sides leave, in half-serving steps (0.5–6; 6 idlis is a normal plate).
      const servings = Math.min(6, Math.max(0.5, Math.round(((B - fixed.kcal) / main.kcal) * 2) / 2));
      const totals = add(fixed, scaled(main, servings));
      const kcalErr = Math.abs(totals.kcal - B) / B;
      const proteinGap = P ? Math.max(0, P - totals.proteinG) / Math.max(P, 10) : 0;
      const fatty = Math.max(0, fatShare(totals) - 0.35);
      const likedBonus = ids.filter((id) => liked.has(id)).length * 0.08;
      const score = kcalErr * 1.2 + proteinGap * 0.8 + fatty - likedBonus + jitter(seed, ids.join("+")) * 0.06;
      const items = combo
        .map((f, i) => (f ? { f, s: i === mainIdx ? servings : 1 } : null))
        .filter((x): x is { f: FoodItem; s: number } => !!x)
        .map(({ f, s }) => ({ foodId: f.id, name: f.name, serving: f.serving, servings: s, ...scaled(f, s) }));
      scored.push({ option: { items, totals, why: why(totals, budget, ids.some((id) => liked.has(id))) }, score, key: main.id });
    }
  }

  // Best first, one option per main food so the choices actually differ.
  const out: MealOption[] = [];
  const seenMain = new Set<string>();
  for (const s of scored.sort((a, b) => a.score - b.score)) {
    if (seenMain.has(s.key)) continue;
    seenMain.add(s.key);
    out.push(s.option);
    if (out.length >= (input.count ?? 3)) break;
  }
  return out;
}

function why(t: Macros, budget: { kcal: number; proteinG: number }, liked: boolean) {
  const parts = [`${t.kcal} kcal of your ${Math.round(budget.kcal)}`];
  if (budget.proteinG >= 5) parts.push(t.proteinG >= budget.proteinG * 0.9 ? `${t.proteinG} g protein covers it` : `${t.proteinG} g of ${Math.round(budget.proteinG)} g protein`);
  if (liked) parts.push("includes foods you eat");
  return parts.join(" · ");
}

/**
 * Budget for the next meal from what's left today: what remains is shared among this meal and the
 * later meals not logged yet, by their usual share. When the day's calories are used up, suggests a
 * light high-protein snack instead.
 */
export function nowBudget(target: Macros, eaten: Macros, logged: Set<Meal>, meal: Meal) {
  const from = MEAL_ORDER.indexOf(meal);
  const open = MEAL_ORDER.filter((m, i) => m === meal || (i > from && !logged.has(m)));
  const share = MEAL_SHARE[meal] / open.reduce((a, m) => a + MEAL_SHARE[m], 0);
  const kcalLeft = target.kcal - eaten.kcal;
  const proteinLeft = Math.max(0, target.proteinG - eaten.proteinG);
  if (kcalLeft < 150) return { meal: "snack" as Meal, kcal: 150, proteinG: Math.max(10, Math.round(proteinLeft)), full: true };
  return { meal, kcal: Math.round(kcalLeft * share), proteinG: Math.round(proteinLeft * share), full: false };
}
