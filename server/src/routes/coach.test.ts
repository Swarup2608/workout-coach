import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Browser, signUpVerified, useTestApp } from "../test/harness.js";

useTestApp("coach_test");

const PLAN = `# Test plan
## Monday
- Barbell back squat — 3 × 5
- Push-up — 2 × 10
## Wednesday
- Lat pulldown — 3 × 10
`;
const MON = "2026-11-16";

describe("coach actions", () => {
  const a = new Browser();

  it("apply to plan swaps the exercise and undo restores it", async () => {
    await signUpVerified(a, { name: "Lee", email: "lee@example.com" });
    await a.call("POST", "/plans", { name: "Test", text: PLAN });
    const r = await a.call("POST", "/coach/actions/apply", {
      action: { type: "swap_exercise", from: "Barbell back squat", to: "Goblet squat", reason: "knee" },
      scope: "plan",
      date: MON,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.before, undefined, "undo snapshot is not sent to the client");
    let plan = (await a.call("GET", "/plans/active")).body;
    assert.equal(plan.days.find((d: { day: string }) => d.day === "Monday").exercises[0].name, "Goblet squat");
    assert.equal((await a.call("POST", `/coach/actions/${r.body.id}/undo`)).status, 200);
    plan = (await a.call("GET", "/plans/active")).body;
    assert.equal(plan.days.find((d: { day: string }) => d.day === "Monday").exercises[0].name, "Barbell back squat");
    assert.equal((await a.call("POST", `/coach/actions/${r.body.id}/undo`)).status, 409);
  });

  it("apply today needs a workout for today", async () => {
    const r = await a.call("POST", "/coach/actions/apply", { action: { type: "swap_exercise", from: "Push-up", to: "Incline push-up" }, scope: "today", date: MON });
    assert.equal(r.status, 409);
  });

  it("apply today changes only the live session, not the plan", async () => {
    await a.call("POST", "/sessions/start", { date: MON, planDay: "Monday" });
    const r = await a.call("POST", "/coach/actions/apply", { action: { type: "change_sets_reps", exercise: "Push-up", sets: 4 }, scope: "today", date: MON });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const live = (await a.call("GET", "/sessions/live")).body.session;
    assert.equal(live.exercises.find((e: { name: string }) => e.name === "Push-up").sets.length, 4);
    const plan = (await a.call("GET", "/plans/active")).body;
    assert.equal(plan.days.find((d: { day: string }) => d.day === "Monday").exercises[1].sets, 2);
  });

  it("move_workout swaps two plan days; set_rest saves a rest override", async () => {
    assert.equal((await a.call("POST", "/coach/actions/apply", { action: { type: "move_workout", from: "Monday", to: "Wednesday" }, scope: "plan", date: MON })).status, 200);
    const plan = (await a.call("GET", "/plans/active")).body;
    assert.equal(plan.days.find((d: { day: string }) => d.day === "Monday").exercises[0].name, "Lat pulldown");
    assert.equal((await a.call("POST", "/coach/actions/apply", { action: { type: "set_rest", exercise: "Push-up", seconds: 75 }, scope: "today", date: MON })).status, 200);
    assert.equal((await a.call("GET", "/profile")).body.restOverrides["push-up"], 75);
  });

  it("rejects unknown action types and unknown exercises", async () => {
    assert.equal((await a.call("POST", "/coach/actions/apply", { action: { type: "delete_everything" }, scope: "plan", date: MON })).status, 400);
    assert.equal((await a.call("POST", "/coach/actions/apply", { action: { type: "swap_exercise", from: "Nope", to: "X" }, scope: "plan", date: MON })).status, 422);
  });

  it("chat accepts page context but rejects oversized or extra fields", async () => {
    assert.equal((await a.call("POST", "/chat", { message: "hi", page: { page: "x".repeat(41) } })).status, 400);
    assert.equal((await a.call("POST", "/chat", { message: "hi", page: { page: "Today", foo: 1 } })).status, 400);
  });

  it("without an AI key, prompts are returned to copy", async () => {
    const r = await a.call("POST", "/coach/prompt", { kind: "chat", message: "Is this safe for my knee?", page: { page: "Exercise detail", detail: "Goblet squat" } });
    assert.equal(r.status, 200);
    assert.match(r.body.text, /Is this safe for my knee\?/);
    assert.match(r.body.text, /Exercise detail — Goblet squat/);
    assert.match(r.body.text, /coach-action/);
    const live = (await a.call("GET", "/sessions/live")).body.session;
    await a.call("POST", `/sessions/${live.id}/finish`, {});
    const n = await a.call("POST", `/sessions/${live.id}/coach-note`);
    assert.equal(n.status, 200);
    assert.equal(n.body.note, null);
    assert.match(n.body.prompt, /WORKOUT JUST FINISHED/);
  });
});
