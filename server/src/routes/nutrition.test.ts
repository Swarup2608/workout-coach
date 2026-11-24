import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Browser, signUpVerified, useTestApp } from "../test/harness.js";

const app = useTestApp("nutrition_test");
const D = "2026-11-18"; // a Wednesday

describe("nutrition", () => {
  const a = new Browser();
  const b = new Browser();
  let userId = "";

  it("a new day is empty, and targets wait for height and weight", async () => {
    await signUpVerified(a, { name: "Asha", email: "asha@example.com" });
    userId = (await a.call("GET", "/auth/me")).body.user.id;
    const r = await a.call("GET", `/nutrition/day/${D}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.log.entries, []);
    assert.equal(r.body.log.waterMl, 0);
    assert.deepEqual(r.body.totals, { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    assert.equal(r.body.targets, null);
    assert.ok(r.body.missing.includes("height") && r.body.missing.includes("weight"));
  });

  it("targets use the profile, then the latest check-in weight", async () => {
    await app.col().profiles().updateOne(
      { _id: userId },
      { $set: { age: 30, sex: "male", heightCm: 180, startBodyweightKg: 80, goalKey: "maintain", daysPerWeek: 4, diet: "veg" } },
      { upsert: true },
    );
    let t = (await a.call("GET", `/nutrition/day/${D}`)).body.targets;
    assert.equal(t.weightSource, "profile");
    assert.equal(t.bmr, 1780);
    await a.call("PUT", "/checkins/2026-11-17", { weightKg: 78 });
    t = (await a.call("GET", `/nutrition/day/${D}`)).body.targets;
    assert.equal(t.weightSource, "check-in");
    assert.equal(t.weightKg, 78);
    assert.equal(typeof t.trainingDay, "boolean"); // new accounts get a seeded plan, so this follows it
  });

  let entryId = "";
  it("adds a database food by servings and totals the day", async () => {
    const r = await a.call("POST", `/nutrition/day/${D}/entries`, { meal: "lunch", foodId: "roti", servings: 2 });
    assert.equal(r.status, 200);
    const e = r.body.log.entries[0];
    entryId = e.id;
    assert.deepEqual([e.name, e.meal, e.source, e.servings, e.kcal, e.proteinG], ["Roti / chapati (plain)", "lunch", "db", 2, 210, 7.2]);
    assert.equal(r.body.totals.kcal, 210);
  });

  it("quick-add takes a name and calories", async () => {
    const r = await a.call("POST", `/nutrition/day/${D}/entries`, { meal: "snack", name: "Office samosa", kcal: 250, proteinG: 4 });
    assert.equal(r.status, 200);
    const e = r.body.log.entries.at(-1);
    assert.deepEqual([e.source, e.foodId, e.kcal, e.carbsG], ["quick", null, 250, 0]);
    assert.equal(r.body.totals.kcal, 460);
  });

  it("changing servings rescales; meal can move", async () => {
    let r = await a.call("PATCH", `/nutrition/day/${D}/entries/${entryId}`, { servings: 3 });
    assert.equal(r.body.log.entries[0].kcal, 315);
    r = await a.call("PATCH", `/nutrition/day/${D}/entries/${entryId}`, { meal: "dinner" });
    assert.equal(r.body.log.entries[0].meal, "dinner");
    assert.equal(r.body.log.entries[0].kcal, 315);
  });

  it("calories, macros and name can be edited after adding; totals follow servings", async () => {
    const r = await a.call("PATCH", `/nutrition/day/${D}/entries/${entryId}`, { name: "Ghee roti", kcal: 140, fatG: 5 });
    assert.equal(r.status, 200);
    const e = r.body.log.entries[0];
    assert.deepEqual([e.name, e.per.kcal, e.per.fatG, e.per.proteinG, e.servings, e.kcal, e.fatG], ["Ghee roti", 140, 5, 3.6, 3, 420, 15]);
    assert.equal((await a.call("PATCH", `/nutrition/day/${D}/entries/${entryId}`, { kcal: 9000 })).status, 400);
    assert.equal((await a.call("PATCH", `/nutrition/day/${D}/entries/${entryId}`, { name: "" })).status, 400);
  });

  it("a photo result is added with its serving label and source", async () => {
    const r = await a.call("POST", `/nutrition/day/${D}/entries`, { meal: "snack", name: "Protein bar", serving: "1 bar (40 g)", kcal: 180, proteinG: 15, carbsG: 18, fatG: 6, servings: 2, source: "photo" });
    assert.equal(r.status, 200);
    const e = r.body.log.entries.at(-1);
    assert.deepEqual([e.source, e.serving, e.servings, e.kcal, e.proteinG], ["photo", "1 bar (40 g)", 2, 360, 30]);
    await a.call("DELETE", `/nutrition/day/${D}/entries/${e.id}`);
  });

  it("photo needs a connected AI and a real image", async () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const r = await a.call("POST", "/nutrition/photo", { image: png });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "no_ai");
    assert.equal((await a.call("POST", "/nutrition/photo", { image: "data:text/html;base64,PGI+" })).status, 400);
    assert.equal((await a.call("POST", "/nutrition/photo", { image: png, extra: 1 })).status, 400);
  });

  it("water is set per day", async () => {
    const r = await a.call("PUT", `/nutrition/day/${D}/water`, { waterMl: 750 });
    assert.equal(r.body.log.waterMl, 750);
    assert.equal((await a.call("GET", `/nutrition/day/${D}`)).body.log.waterMl, 750);
  });

  it("deletes an entry once", async () => {
    const r = await a.call("DELETE", `/nutrition/day/${D}/entries/${entryId}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.log.entries.length, 1);
    assert.equal((await a.call("DELETE", `/nutrition/day/${D}/entries/${entryId}`)).status, 404);
  });

  it("rejects bad input", async () => {
    assert.equal((await a.call("POST", `/nutrition/day/${D}/entries`, { meal: "lunch", foodId: "nope" })).status, 404);
    assert.equal((await a.call("POST", `/nutrition/day/${D}/entries`, { meal: "lunch", foodId: "roti", servings: 0 })).status, 400);
    assert.equal((await a.call("POST", `/nutrition/day/${D}/entries`, { meal: "brunch", foodId: "roti" })).status, 400);
    assert.equal((await a.call("POST", `/nutrition/day/${D}/entries`, { meal: "lunch", name: "x", kcal: -5 })).status, 400);
    assert.equal((await a.call("POST", `/nutrition/day/${D}/entries`, { meal: "lunch", foodId: "roti", extra: 1 })).status, 400);
    assert.equal((await a.call("PUT", `/nutrition/day/${D}/water`, { waterMl: 99999 })).status, 400);
    assert.equal((await a.call("GET", "/nutrition/day/2026-02-30")).status, 400);
  });

  it("search follows the user's diet; all=1 shows everything", async () => {
    let r = await a.call("GET", "/nutrition/foods?q=chicken");
    assert.equal(r.body.diet, "veg");
    assert.ok(!r.body.foods.some((f: { diet: string }) => f.diet === "non_veg"));
    r = await a.call("GET", "/nutrition/foods?q=chicken&all=1");
    assert.ok(r.body.foods.some((f: { id: string }) => f.id === "chicken-breast"));
  });

  let customId = "";
  it("own foods, favourites and recent", async () => {
    const c = await a.call("POST", "/nutrition/custom-foods", { name: "Amma's sambar", serving: "1 bowl", kcal: 140, proteinG: 6 });
    assert.equal(c.status, 201);
    customId = c.body.id;
    assert.ok((await a.call("GET", "/nutrition/foods?q=amma")).body.foods.some((f: { id: string }) => f.id === customId));
    assert.equal((await a.call("PUT", `/nutrition/favourites/${customId}`)).status, 200);
    assert.equal((await a.call("PUT", "/nutrition/favourites/idli")).status, 200);
    assert.equal((await a.call("PUT", "/nutrition/favourites/not-a-food")).status, 404);
    await a.call("POST", `/nutrition/day/${D}/entries`, { meal: "breakfast", foodId: customId, servings: 1 });
    await a.call("POST", `/nutrition/day/${D}/entries`, { meal: "breakfast", foodId: "idli", servings: 3 });
    const lib = (await a.call("GET", `/nutrition/library?date=${D}`)).body;
    assert.deepEqual(lib.favourites.map((f: { id: string }) => f.id), ["idli", customId]);
    assert.equal(lib.custom.length, 1);
    assert.equal(lib.recent[0].foodId, "idli");
    assert.equal(lib.recent[0].servings, 3);
    assert.ok(lib.recent.some((x: { name: string }) => x.name === "Office samosa"));
    // Deleting an own food also drops it from favourites and recent.
    assert.equal((await a.call("DELETE", `/nutrition/custom-foods/${customId}`)).status, 204);
    const after = (await a.call("GET", `/nutrition/library?date=${D}`)).body;
    assert.deepEqual(after.favourites.map((f: { id: string }) => f.id), ["idli"]);
    assert.ok(!after.recent.some((x: { foodId: string }) => x.foodId === customId));
    assert.equal((await a.call("DELETE", "/nutrition/favourites/idli")).status, 200);
  });

  it("food typed into an older workout log becomes the day's food log", async () => {
    const day = "2026-11-10";
    const s = await a.call("PUT", "/sessions", {
      date: day,
      exercises: [],
      food: [{ meal: "lunch", name: "Thali", kcal: 800, proteinG: 25 }],
      waterL: 2,
    });
    assert.equal(s.status, 200);
    const r = (await a.call("GET", `/nutrition/day/${day}`)).body;
    assert.equal(r.log.entries[0].name, "Thali");
    assert.equal(r.log.entries[0].source, "import");
    assert.equal(r.log.waterMl, 2000);
    // A newer client saves the session without food: what's stored is kept.
    await a.call("PUT", "/sessions", { date: day, exercises: [], steps: 5000 });
    const sess = (await a.call("GET", `/sessions?date=${day}`)).body[0];
    assert.equal(sess.food.length, 1);
    assert.equal(sess.waterL, 2);
    assert.equal(sess.steps, 5000);
  });

  it("day import puts food and water in the food log", async () => {
    const day = "2026-11-12";
    const json = JSON.stringify({ date: day, food: [{ meal: "dinner", name: "2 rotis + dal", kcal: 420, proteinG: 16 }], waterL: 2.5, steps: 7000 });
    const r = await a.call("POST", "/day-import", { text: json, date: day });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.session.food, []);
    const n = (await a.call("GET", `/nutrition/day/${day}`)).body;
    assert.equal(n.log.entries[0].name, "2 rotis + dal");
    assert.equal(n.log.waterMl, 2500);
  });

  it("weekly metrics and the week view count food from the log", async () => {
    const plan = await a.call("POST", "/plans", { name: "Test", text: "## Monday\n- Squat — 3 × 8\n\n## Wednesday\n- Bench press — 3 × 8\n" });
    assert.equal(plan.status, 201);
    await a.call("PUT", "/sessions", {
      date: D,
      exercises: [{ plannedId: null, name: "Bench press", sets: [{ weightKg: 60, reps: 8, done: true }] }],
    });
    const day = (await a.call("GET", `/nutrition/day/${D}`)).body;
    assert.equal(day.trainingDay, true);
    const m = (await a.call("GET", `/metrics/week?date=${D}`)).body;
    assert.equal(m.metrics.kcalEaten, day.totals.kcal);
    const week = (await a.call("GET", `/nutrition/week?date=${D}`)).body.days;
    assert.equal(week.length, 7);
    assert.equal(week.at(-1).date, D);
    assert.equal(week.at(-1).kcal, day.totals.kcal);
    assert.equal(week.at(-1).targetKcal, day.targets.kcal);
    assert.ok(week.find((d: { date: string }) => d.date === "2026-11-12").logged);
  });

  it("keeps food private to each user", async () => {
    await signUpVerified(b, { name: "Ravi", email: "ravi@example.com" });
    assert.deepEqual((await b.call("GET", `/nutrition/day/${D}`)).body.log.entries, []);
    const entry = (await a.call("GET", `/nutrition/day/${D}`)).body.log.entries[0];
    assert.equal((await b.call("DELETE", `/nutrition/day/${D}/entries/${entry.id}`)).status, 404);
  });

  it("account deletion removes food logs and food preferences", async () => {
    await a.call("PUT", "/nutrition/favourites/idli");
    assert.equal((await a.call("DELETE", "/auth/me", { password: "Str0ngPassw0rd" })).status, 204);
    assert.equal(await app.col().foodLogs().countDocuments({ userId }), 0);
    assert.equal(await app.col().nutritionPrefs().countDocuments({ _id: userId }), 0);
  });
});

describe("adaptive calories (API)", () => {
  const c = new Browser();
  it("a stalled fat-loss trend lowers the targets and says why", async () => {
    await signUpVerified(c, { name: "Meera", email: "meera@example.com" });
    const id = (await c.call("GET", "/auth/me")).body.user.id;
    await app.col().profiles().updateOne({ _id: id }, { $set: { age: 32, sex: "female", heightCm: 162, startBodyweightKg: 70, goalKey: "fat_loss", daysPerWeek: 3 } }, { upsert: true });
    const before = (await c.call("GET", "/nutrition/day/2026-11-20")).body.targets;
    assert.equal(before.adaptive, null);
    // Four weeks of check-ins at a flat 70 kg.
    for (let i = 27; i >= 0; i--) {
      const d = new Date(Date.UTC(2026, 10, 20 - i)).toISOString().slice(0, 10);
      await c.call("PUT", `/checkins/${d}`, { weightKg: 70 });
    }
    const after = (await c.call("GET", "/nutrition/day/2026-11-20")).body.targets;
    assert.equal(after.adaptive.method, "trend");
    assert.ok(after.adaptive.deltaKcal < 0);
    assert.ok(after.kcal < before.kcal || after.kcal === Math.max(after.bmr, 1200));
    assert.ok(after.basis.some((b: string) => b.includes("Adjusted to your progress")));
  });
});

describe("meal ideas (API)", () => {
  const d = new Browser();
  const DAY = "2026-11-20";
  it("suggests the next meal from what's left, and adds a whole option in one go", async () => {
    await signUpVerified(d, { name: "Kiran", email: "kiran@example.com" });
    const id = (await d.call("GET", "/auth/me")).body.user.id;
    await app.col().profiles().updateOne({ _id: id }, { $set: { age: 28, sex: "male", heightCm: 175, startBodyweightKg: 72, goalKey: "muscle_gain", daysPerWeek: 4, diet: "veg" } }, { upsert: true });
    const s = (await d.call("GET", `/nutrition/suggest?date=${DAY}&meal=lunch`)).body;
    assert.equal(s.meal, "lunch");
    assert.equal(s.assumed, false);
    assert.equal(s.options.length, 3);
    const opt = s.options[0];
    const r = await d.call("POST", `/nutrition/day/${DAY}/entries/bulk`, { meal: "lunch", items: opt.items.map((i: { foodId: string; servings: number }) => ({ foodId: i.foodId, servings: i.servings })) });
    assert.equal(r.status, 200);
    assert.equal(r.body.log.entries.length, opt.items.length);
    assert.equal(r.body.totals.kcal, opt.totals.kcal);
    // Lunch is logged now, so the dinner budget shrinks to what's left.
    const next = (await d.call("GET", `/nutrition/suggest?date=${DAY}&meal=dinner`)).body;
    assert.ok(next.budget.kcal < r.body.targets.kcal - opt.totals.kcal + 1);
  });

  it("plans a whole day that adds up to the targets", async () => {
    const p = (await d.call("GET", `/nutrition/plan?date=${DAY}&seed=2`)).body;
    assert.deepEqual(p.meals.map((m: { meal: string }) => m.meal), ["breakfast", "lunch", "snack", "dinner"]);
    const total = p.meals.reduce((a: number, m: { options: { totals: { kcal: number } }[] }) => a + m.options[0].totals.kcal, 0);
    assert.ok(Math.abs(total - p.targets.kcal) / p.targets.kcal < 0.12, `${total} vs ${p.targets.kcal}`);
    assert.equal(p.seed, 2);
  });

  it("bulk add validates", async () => {
    assert.equal((await d.call("POST", `/nutrition/day/${DAY}/entries/bulk`, { meal: "lunch", items: [] })).status, 400);
    assert.equal((await d.call("POST", `/nutrition/day/${DAY}/entries/bulk`, { meal: "lunch", items: [{ foodId: "nope", servings: 1 }] })).status, 404);
    assert.equal((await d.call("POST", `/nutrition/day/${DAY}/entries/bulk`, { meal: "lunch", items: [{ foodId: "roti", servings: 50 }] })).status, 400);
    assert.equal((await d.call("GET", `/nutrition/suggest?date=${DAY}&meal=brunch`)).status, 400);
  });
});
