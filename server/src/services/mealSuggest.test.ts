import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MEAL_ORDER, MEAL_SHARE, nowBudget, suggestMeal } from "./mealSuggest.js";
import { FOODS } from "./nutrition.js";

const byId = new Map(FOODS.map((f) => [f.id, f]));
const ZERO = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

describe("meal suggestions", () => {
  it("meal shares add up to the whole day", () => {
    assert.equal(Math.round(MEAL_ORDER.reduce((a, m) => a + MEAL_SHARE[m], 0) * 100), 100);
  });

  it("lands close to the budget, three different options", () => {
    for (const meal of MEAL_ORDER) {
      const opts = suggestMeal({ meal, budget: { kcal: 600, proteinG: 30 }, diet: "non_veg" });
      assert.equal(opts.length, 3, meal);
      for (const o of opts) assert.ok(Math.abs(o.totals.kcal - 600) / 600 < 0.25, `${meal}: ${o.totals.kcal}`);
      assert.equal(new Set(opts.map((o) => o.items[0].foodId)).size, 3, `${meal} options differ`);
    }
  });

  it("totals match the items, and servings are half steps", () => {
    const [o] = suggestMeal({ meal: "lunch", budget: { kcal: 700, proteinG: 35 }, diet: "veg" });
    assert.equal(o.totals.kcal, o.items.reduce((a, i) => a + i.kcal, 0));
    for (const i of o.items) assert.equal(i.servings * 2, Math.round(i.servings * 2));
  });

  it("follows the diet and never suggests sweets, fats or supplements at meals", () => {
    for (const diet of ["veg", "vegan", "eggetarian"] as const) {
      const allowed = diet === "vegan" ? ["vegan"] : diet === "veg" ? ["vegan", "veg"] : ["vegan", "veg", "egg"];
      for (const meal of MEAL_ORDER)
        for (const o of suggestMeal({ meal, budget: { kcal: 500, proteinG: 25 }, diet }))
          for (const i of o.items) {
            const f = byId.get(i.foodId)!;
            assert.ok(allowed.includes(f.diet), `${diet}: ${f.name}`);
            assert.ok(!["Sweets", "Fats & extras"].includes(f.category), f.name);
            if (meal !== "snack") assert.notEqual(f.id, "whey");
          }
    }
  });

  it("no food twice in one meal (soya curry + soya chunks)", () => {
    for (const o of suggestMeal({ meal: "lunch", budget: { kcal: 800, proteinG: 45 }, diet: "vegan" })) {
      const words = o.items.map((i) => i.name.toLowerCase().split(/[\s/(]+/)[0]);
      assert.equal(new Set(words).size, words.length, words.join(","));
    }
  });

  it("the same seed repeats; another seed can change the picks; liked foods get a lift", () => {
    const a = suggestMeal({ meal: "dinner", budget: { kcal: 650, proteinG: 35 }, diet: "veg", seed: 1 });
    assert.deepEqual(a, suggestMeal({ meal: "dinner", budget: { kcal: 650, proteinG: 35 }, diet: "veg", seed: 1 }));
    const seeds = new Set([1, 2, 3, 4, 5].map((seed) => JSON.stringify(suggestMeal({ meal: "dinner", budget: { kcal: 650, proteinG: 35 }, diet: "veg", seed }).map((o) => o.items.map((i) => i.foodId)))));
    assert.ok(seeds.size > 1);
    const liked = suggestMeal({ meal: "breakfast", budget: { kcal: 450, proteinG: 20 }, diet: "veg", liked: new Set(["idli", "sambar"]) });
    assert.ok(liked.some((o) => o.items.some((i) => i.foodId === "idli")));
  });

  it("now-budget shares what's left among this and later unlogged meals", () => {
    const target = { kcal: 2000, proteinG: 120, carbsG: 0, fatG: 0 };
    // Nothing eaten, lunch next: lunch .35 of (lunch .35 + snack .10 + dinner .30).
    const lunch = nowBudget(target, ZERO, new Set(["breakfast"]), "lunch");
    assert.equal(lunch.kcal, Math.round(2000 * (0.35 / 0.75)));
    // Dinner, last meal: everything left.
    const dinner = nowBudget(target, { kcal: 1400, proteinG: 80, carbsG: 0, fatG: 0 }, new Set(["breakfast", "lunch", "snack"]), "dinner");
    assert.deepEqual([dinner.kcal, dinner.proteinG, dinner.full], [600, 40, false]);
    // Over target → a light, high-protein snack.
    const full = nowBudget(target, { kcal: 1950, proteinG: 100, carbsG: 0, fatG: 0 }, new Set(), "dinner");
    assert.deepEqual([full.meal, full.kcal, full.proteinG, full.full], ["snack", 150, 20, true]);
  });
});
