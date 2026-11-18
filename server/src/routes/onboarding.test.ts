import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Browser, signUpVerified, useTestApp } from "../test/harness.js";

useTestApp("onboarding_test");

const ALL = { goalKey: "muscle_gain", experience: "Intermediate", daysPerWeek: 4, sessionMinutes: 60, equipmentSetup: "gym", injuries: ["knee"] };

describe("onboarding", () => {
  const a = new Browser();

  it("saves answers per step and never moves the step backwards", async () => {
    await signUpVerified(a, { name: "Ravi", email: "ravi@example.com" });
    assert.equal((await a.call("PATCH", "/profile/onboarding", { step: 4, answers: { heightCm: 175, startBodyweightKg: 80, units: "lb" } })).status, 200);
    const r = await a.call("PATCH", "/profile/onboarding", { step: 3, answers: { goalKey: "fat_loss" } });
    assert.equal(r.status, 200);
    assert.equal(r.body.profile.onboarding.step, 4);
    assert.equal(r.body.profile.goalKey, "fat_loss");
    assert.equal(r.body.profile.heightCm, 175);
    assert.equal(r.body.profile.units, "lb");
    assert.equal(r.body.profile.name, "Ravi", "other fields untouched");
  });

  it("rejects unknown or invalid answers", async () => {
    assert.equal((await a.call("PATCH", "/profile/onboarding", { step: 3, answers: { goalKey: "bulk" } })).status, 400);
    assert.equal((await a.call("PATCH", "/profile/onboarding", { step: 3, answers: { foo: 1 } })).status, 400);
    assert.equal((await a.call("PATCH", "/profile/onboarding", { step: 9, answers: {} })).status, 400);
    assert.equal((await a.call("PATCH", "/profile/onboarding", { step: 5, answers: { daysPerWeek: 7 } })).status, 400);
    assert.equal((await a.call("PATCH", "/profile/onboarding", {})).status, 400);
  });

  it("complete needs the core answers", async () => {
    const b = new Browser();
    await signUpVerified(b, { name: "Fresh", email: "fresh@example.com" });
    const r = await b.call("PATCH", "/profile/onboarding", { complete: true });
    assert.equal(r.status, 422);
    assert.ok(r.body.missing.includes("goalKey"));
    assert.ok(r.body.missing.includes("equipmentSetup"));
  });

  it("complete builds and activates a starter plan, keeping the baseline in history", async () => {
    assert.equal((await a.call("PATCH", "/profile/onboarding", { step: 6, answers: ALL })).status, 200);
    const r = await a.call("PATCH", "/profile/onboarding", { complete: true });
    assert.equal(r.status, 200);
    assert.match(r.body.plan.name, /^Starter plan/);
    assert.equal(r.body.plan.days.filter((d: { isRest: boolean }) => !d.isRest).length, 4);
    assert.equal((await a.call("GET", "/plans/active")).body.id, r.body.plan.id);
    assert.equal((await a.call("GET", "/plans")).body.length, 2);
    const p = r.body.profile;
    assert.ok(p.onboarding.completedAt);
    assert.equal(p.onboarding.step, 8);
    assert.equal(p.goal, "Muscle gain / weight gain");
    assert.equal(p.constraints.filter((c: { id: string }) => c.id === "injury-knee").length, 1);
  });

  it("redo: restart then complete again does not duplicate constraints", async () => {
    const restarted = await a.call("PATCH", "/profile/onboarding", { restart: true });
    assert.deepEqual(restarted.body.profile.onboarding, { step: 2, completedAt: null, skippedAt: null });
    assert.equal(restarted.body.profile.goalKey, "muscle_gain", "answers are kept");
    await a.call("PATCH", "/profile/onboarding", { step: 6, answers: { injuries: ["knee", "wrist"] } });
    const r = await a.call("PATCH", "/profile/onboarding", { complete: true });
    const ids = r.body.profile.constraints.map((c: { id: string }) => c.id).filter((id: string) => id.startsWith("injury-"));
    assert.deepEqual(ids.sort(), ["injury-knee", "injury-wrist"]);
    assert.equal((await a.call("GET", "/plans")).body.length, 3);
  });

  it("removing an injury on redo removes its constraint but keeps other constraints", async () => {
    const profile = (await a.call("GET", "/profile")).body;
    const custom = { id: "custom-1", label: "No running", reason: "", keywords: ["running"], swaps: ["Bike"] };
    await a.call("PUT", "/profile", { ...profile, constraints: [...profile.constraints, custom] });
    await a.call("PATCH", "/profile/onboarding", { restart: true });
    await a.call("PATCH", "/profile/onboarding", { step: 6, answers: { injuries: [] } });
    const r = await a.call("PATCH", "/profile/onboarding", { complete: true });
    assert.deepEqual(r.body.profile.constraints.map((c: { id: string }) => c.id), ["custom-1"]);
  });

  it("skip leaves the baseline plan active; restart after skip keeps the step", async () => {
    const b = new Browser();
    await signUpVerified(b, { name: "Skipper", email: "skip@example.com" });
    const before = (await b.call("GET", "/plans/active")).body;
    await b.call("PATCH", "/profile/onboarding", { step: 4, answers: { goalKey: "general" } });
    const r = await b.call("PATCH", "/profile/onboarding", { skip: true });
    assert.equal(r.status, 200);
    assert.ok(r.body.profile.onboarding.skippedAt);
    assert.equal((await b.call("GET", "/plans/active")).body.id, before.id);
    const again = await b.call("PATCH", "/profile/onboarding", { restart: true });
    assert.deepEqual(again.body.profile.onboarding, { step: 4, completedAt: null, skippedAt: null });
  });

  it("requires the CSRF header", async () => {
    assert.equal((await a.call("PATCH", "/profile/onboarding", { skip: true }, { csrf: null })).status, 403);
  });
});
