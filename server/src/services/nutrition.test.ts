import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FOODS, computeTargets, mergeFoodLogs, searchFoods } from "./nutrition.js";
import type { FoodItem, FoodLog, WorkoutSession } from "../domain.js";

type Input = Parameters<typeof computeTargets>[0];
const base: Input["profile"] = { age: 30, sex: "male", heightCm: 180, goalKey: "maintain", daysPerWeek: 4 };
const t = (over: Partial<Omit<Input, "profile">> & { profile?: Partial<Input["profile"]> } = {}) =>
  computeTargets({ weightKg: 80, weightSource: "profile", trainingDay: true, ...over, profile: { ...base, ...over.profile } });

describe("nutrition targets", () => {
  it("Mifflin-St Jeor BMR, activity from training days, more on training days", () => {
    const train = t().targets!;
    const rest = t({ trainingDay: false }).targets!;
    assert.equal(train.bmr, 1780); // 10·80 + 6.25·180 − 5·30 + 5
    assert.equal(train.tdee, 2759); // × 1.55 for 4 days
    assert.equal(train.kcal, 2900);
    assert.equal(rest.kcal, 2570);
    // The weekly average stays at maintenance.
    assert.ok(Math.abs((4 * train.kcal + 3 * rest.kcal) / 7 - train.tdee) < 10);
    assert.equal(train.proteinG, 128); // 1.6 g/kg at maintenance
    assert.equal(train.fatG, 81); // 25% of calories
    assert.equal(train.carbsG, 415);
    assert.equal(train.waterMl, 3250); // 35 ml/kg + 500 on training days, to 250 ml
    assert.equal(rest.waterMl, 2750);
  });

  it("goal changes calories and protein", () => {
    const loss = t({ profile: { goalKey: "fat_loss" } }).targets!;
    const gain = t({ profile: { goalKey: "muscle_gain" } }).targets!;
    const keep = t().targets!;
    assert.ok(loss.kcal < keep.kcal && keep.kcal < gain.kcal);
    assert.equal(loss.proteinG, 160); // 2.0 g/kg
    assert.equal(gain.proteinG, 144); // 1.8 g/kg
  });

  it("never goes below BMR or 1200 kcal", () => {
    const small = computeTargets({ profile: { age: 60, sex: "female", heightCm: 150, goalKey: "fat_loss", daysPerWeek: 0 }, weightKg: 45, weightSource: "profile", trainingDay: false }).targets!;
    assert.equal(small.kcal, 1200);
    const r = t({ profile: { goalKey: "fat_loss", sex: "female", age: 25, heightCm: 160 }, weightKg: 60, trainingDay: false }).targets!;
    assert.ok(r.kcal >= r.bmr);
  });

  it("sex 'other' or unset uses the midpoint formula", () => {
    assert.equal(t({ profile: { sex: undefined } }).targets!.bmr, 1780 - 83);
  });

  it("the plan's training days win over the profile's", () => {
    assert.equal(t({ plannedDays: 6 }).targets!.tdee, Math.round(1780 * 1.725));
  });

  it("names what is missing instead of guessing", () => {
    const r = computeTargets({ profile: { age: null, heightCm: null }, weightKg: null, weightSource: "profile", trainingDay: false });
    assert.equal(r.targets, null);
    assert.deepEqual(r.missing, ["age", "height", "weight"]);
  });
});

describe("food database and search", () => {
  it("every food has a unique id and sane numbers (macros roughly match calories)", () => {
    const ids = new Set<string>();
    for (const f of FOODS) {
      assert.ok(!ids.has(f.id), `duplicate id ${f.id}`);
      ids.add(f.id);
      assert.ok(f.kcal >= 0 && f.grams > 0 && f.serving, f.id);
      assert.ok(["vegan", "veg", "egg", "non_veg"].includes(f.diet), f.id);
      const fromMacros = f.proteinG * 4 + f.carbsG * 4 + f.fatG * 9;
      // Alcohol and rounding aside, calories should be close to 4/4/9.
      if (f.id !== "beer") assert.ok(Math.abs(fromMacros - f.kcal) <= Math.max(25, f.kcal * 0.2), `${f.id}: ${f.kcal} kcal vs ${Math.round(fromMacros)} from macros`);
    }
    assert.ok(FOODS.length >= 150);
  });

  it("finds by name and by regional alias", () => {
    assert.equal(searchFoods("roti")[0].id, "roti");
    assert.equal(searchFoods("chapati")[0].id, "roti");
    assert.equal(searchFoods("dal")[0].id, "dal-tadka");
    assert.equal(searchFoods("golgappa")[0].id, "pani-puri");
    assert.equal(searchFoods("paneer tikka")[0].id, "paneer-tikka");
    assert.deepEqual(searchFoods("zzzz"), []);
  });

  it("filters by the user's diet unless asked for everything", () => {
    const has = (xs: FoodItem[], id: string) => xs.some((f) => f.id === id);
    assert.ok(!has(searchFoods("chicken", { diet: "veg" }), "chicken-breast"));
    assert.ok(!has(searchFoods("egg", { diet: "veg" }), "boiled-egg"));
    assert.ok(has(searchFoods("egg", { diet: "eggetarian" }), "boiled-egg"));
    assert.ok(!has(searchFoods("paneer", { diet: "vegan" }), "paneer"));
    assert.ok(has(searchFoods("tofu", { diet: "vegan" }), "tofu"));
    assert.ok(has(searchFoods("chicken", { diet: "veg", all: true }), "chicken-breast"));
  });

  it("own foods always show and rank first on a tie", () => {
    const mine: FoodItem = { id: "u-1", name: "Mom's chicken roti", category: "My foods", serving: "1", grams: 0, kcal: 300, proteinG: 20, carbsG: 30, fatG: 10, diet: "non_veg", custom: true };
    assert.equal(searchFoods("chicken roti", { diet: "veg", custom: [mine] })[0].id, "u-1");
  });
});

describe("food log merge for scoring", () => {
  const session = (date: string, extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
    id: date, planId: "p", date, day: "Monday", exercises: [], cardioMinutes: null, sessionRpe: null, bodyweightKg: null, notes: "", createdAt: "", updatedAt: "", ...extra,
  });
  const log = (date: string, kcal: number, waterMl = 0): FoodLog => ({
    date,
    waterMl,
    updatedAt: "",
    entries: kcal ? [{ id: "e", meal: "lunch", name: "Dal", foodId: "dal-tadka", servings: 2, serving: "1 katori", per: { kcal: kcal / 2, proteinG: 9, carbsG: 22, fatG: 6 }, kcal, proteinG: 18, carbsG: 44, fatG: 12, source: "db", createdAt: "" }] : [],
  });

  it("the food log replaces food typed into the session; food-only days are added", () => {
    const out = mergeFoodLogs([session("2026-11-16", { food: [{ name: "old", kcal: 999 }], waterL: 1 })], [log("2026-11-16", 360, 2000), log("2026-11-17", 500), log("2026-11-18", 0)]);
    assert.deepEqual(out.map((s) => s.date), ["2026-11-16", "2026-11-17"]);
    assert.equal(out[0].food![0].kcal, 360);
    assert.equal(out[0].food![0].name, "Dal × 2");
    assert.equal(out[0].waterL, 2);
    assert.equal(out[1].exercises.length, 0);
    assert.equal(out[1].food![0].kcal, 500);
  });
});
