import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Browser, PW, signUpVerified, useTestApp } from "../test/harness.js";

useTestApp("profile_test");

describe("profile", () => {
  const a = new Browser();

  it("register stores age and starts onboarding at step 2", async () => {
    await signUpVerified(a, { name: "Asha", email: "asha@example.com", age: 30 });
    const p = (await a.call("GET", "/profile")).body;
    assert.equal(p.age, 30);
    assert.deepEqual(p.onboarding, { step: 2, completedAt: null, skippedAt: null });
  });

  it("register rejects out-of-range age", async () => {
    const b = new Browser();
    for (const age of [15, 91, 30.5, "30"])
      assert.equal((await b.call("POST", "/auth/register", { name: "X", email: `x${age}@example.com`, password: PW, age })).status, 400, `age ${age}`);
  });

  it("register requires age", async () => {
    assert.equal((await new Browser().call("POST", "/auth/register", { name: "Y", email: "y@example.com", password: PW })).status, 400);
  });

  it("PUT /profile keeps the new fields", async () => {
    const current = (await a.call("GET", "/profile")).body;
    const next = {
      ...current,
      units: "lb",
      goalKey: "strength",
      daysPerWeek: 4,
      sessionMinutes: 60,
      equipmentSetup: "gym",
      injuries: ["knee"],
      diet: "veg",
      sex: "female",
      heightCm: 165,
      onboarding: { step: 5, completedAt: null, skippedAt: null },
    };
    assert.equal((await a.call("PUT", "/profile", next)).status, 200);
    const got = (await a.call("GET", "/profile")).body;
    for (const k of ["units", "goalKey", "daysPerWeek", "sessionMinutes", "equipmentSetup", "injuries", "diet", "sex", "heightCm", "onboarding", "age"])
      assert.deepEqual(got[k], next[k], k);
  });

  it("PUT /profile accepts an old-shape profile", async () => {
    const r = await a.call("PUT", "/profile", { name: "Asha", goal: "Get fit", experience: "Intermediate", startBodyweightKg: null, targetBodyweightKg: null, constraints: [] });
    assert.equal(r.status, 200);
  });
});
