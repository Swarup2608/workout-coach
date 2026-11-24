import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Browser, signUpVerified, useTestApp } from "../test/harness.js";
import { plannedDayFor, suggestReshuffle, validateMoves } from "../services/reshuffle.js";
import type { PlanDay, WorkoutPlan, WorkoutSession } from "../domain.js";

const app = useTestApp("reshuffle_test");

// Week of Mon 16 – Sun 22 Nov 2026. Training Mon, Wed, Fri; the rest are rest days.
const day = (d: PlanDay["day"], title?: string) => ({ day: d, title: title ?? "Rest", isRest: !title, exercises: title ? [{ id: d, name: "Squat" }] : [] }) as unknown as PlanDay;
const plan = {
  id: "p",
  days: [day("Monday", "Upper"), day("Tuesday"), day("Wednesday", "Lower"), day("Thursday"), day("Friday", "Full"), day("Saturday"), day("Sunday")],
} as WorkoutPlan;
const lift = (date: string, planDay?: string) => ({ date, day: new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }), planDay, exercises: [{ sets: [{ done: true }] }] }) as unknown as WorkoutSession;

describe("reshuffle rules", () => {
  it("nothing missed → nothing to move", () => {
    const r = suggestReshuffle(plan, [lift("2026-11-16")], "2026-11-17");
    assert.deepEqual([r.missed, r.moves, r.skipped], [[], [], []]);
  });

  it("a missed day moves to the first free rest day from today, planned days stay put", () => {
    const r = suggestReshuffle(plan, [], "2026-11-17"); // Tue: Monday missed
    assert.deepEqual(r.missed.map((m) => m.day), ["Monday"]);
    assert.deepEqual(r.moves, [{ date: "2026-11-17", planDay: "Monday", title: "Upper" }]);
  });

  it("days already used and planned days are not free; overflow is skipped", () => {
    // Sat: Mon, Wed, Fri all missed; only Sat and Sun free.
    const r = suggestReshuffle(plan, [], "2026-11-21");
    assert.deepEqual(r.moves.map((m) => [m.date, m.planDay]), [["2026-11-21", "Monday"], ["2026-11-22", "Wednesday"]]);
    assert.deepEqual(r.skipped.map((m) => m.day), ["Friday"]);
  });

  it("a missed workout done on another day counts as done", () => {
    const r = suggestReshuffle(plan, [lift("2026-11-17", "Monday")], "2026-11-18");
    assert.deepEqual(r.missed, []);
  });

  it("today follows applied moves for this week only", () => {
    const moved = { ...plan, weekMoves: { weekStart: "2026-11-16", moves: [{ date: "2026-11-17", planDay: "Monday" as const }] } };
    assert.deepEqual([plannedDayFor(moved, "2026-11-17").planDay?.title, plannedDayFor(moved, "2026-11-17").movedFrom], ["Upper", "Monday"]);
    assert.equal(plannedDayFor(moved, "2026-11-24").planDay?.isRest, true); // next Tuesday: plan as usual
  });

  it("validates moves", () => {
    assert.equal(validateMoves(plan, [{ date: "2026-11-17", planDay: "Monday" }], "2026-11-17"), null);
    assert.match(validateMoves(plan, [{ date: "2026-11-16", planDay: "Monday" }], "2026-11-17")!, /not between/);
    assert.match(validateMoves(plan, [{ date: "2026-11-23", planDay: "Monday" }], "2026-11-17")!, /not between/);
    assert.match(validateMoves(plan, [{ date: "2026-11-18", planDay: "Tuesday" }], "2026-11-17")!, /no workout/);
    assert.match(validateMoves(plan, [{ date: "2026-11-18", planDay: "Monday" }, { date: "2026-11-18", planDay: "Friday" }], "2026-11-17")!, /Two workouts/);
  });
});

const PLAN = `# Test plan
## Monday
- Goblet squat — 3 × 8-12
## Tuesday
Rest
## Wednesday
- Lat pulldown — 3 × 10
`;

describe("reshuffle API", () => {
  const a = new Browser();
  const TUE = "2026-11-17";

  it("suggests, applies, shows on Today, credits the original day, and clears", async () => {
    await signUpVerified(a, { name: "Ravi", email: "ravi@example.com" });
    await a.call("POST", "/plans", { name: "Test", text: PLAN });

    const s = (await a.call("GET", `/reshuffle?date=${TUE}`)).body;
    assert.deepEqual(s.moves.map((m: { date: string; planDay: string }) => [m.date, m.planDay]), [[TUE, "Monday"]]);

    const put = await a.call("PUT", "/reshuffle", { date: TUE, moves: [{ date: TUE, planDay: "Monday" }] });
    assert.equal(put.status, 200);
    assert.deepEqual(put.body.applied, [{ date: TUE, planDay: "Monday" }]);

    const t = (await a.call("GET", `/today?date=${TUE}`)).body;
    assert.equal(t.movedFrom, "Monday");
    assert.equal(t.planDay.day, "Monday");

    // Do Monday's workout on Tuesday: the weekly score counts Monday as done.
    const live = (await a.call("POST", "/sessions/start", { planDay: "Monday", date: TUE })).body.session;
    Object.assign(live.exercises[0].sets[0], { done: true, reps: 10, weightKg: 16 });
    await a.call("PATCH", `/sessions/${live.id}`, { exercises: live.exercises.map(({ muscle, ...e }: { muscle: string }) => e) });
    await a.call("POST", `/sessions/${live.id}/finish`, {});
    const m = (await a.call("GET", `/metrics/week?date=${TUE}`)).body.metrics;
    assert.ok(m.completedDays.includes("Monday"));
    assert.equal(m.completedSessions, 1);
    assert.deepEqual((await a.call("GET", `/reshuffle?date=${TUE}`)).body.missed, []);

    assert.deepEqual((await a.call("PUT", "/reshuffle", { date: TUE, moves: [] })).body.applied, []);
  });

  it("rejects bad moves and other users can't see the plan", async () => {
    assert.equal((await a.call("PUT", "/reshuffle", { date: TUE, moves: [{ date: "2026-11-16", planDay: "Monday" }] })).status, 422);
    assert.equal((await a.call("PUT", "/reshuffle", { date: TUE, moves: [{ date: TUE, planDay: "Funday" }] })).status, 400);
    const b = new Browser();
    await signUpVerified(b, { name: "Other", email: "other@example.com" });
    await app.col().plans().deleteMany({ userId: (await b.call("GET", "/auth/me")).body.user.id });
    assert.equal((await b.call("GET", `/reshuffle?date=${TUE}`)).status, 404);
  });
});
