import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { weekGoalFor } from "./insights.js";
import type { PlanDay, WorkoutPlan, WorkoutSession } from "../domain.js";

const day = (d: PlanDay["day"], rest = false) => ({ day: d, title: d, isRest: rest, exercises: rest ? [] : [{ id: d, name: "Squat" }] }) as unknown as PlanDay;
const plan = { days: [day("Monday"), day("Tuesday", true), day("Wednesday"), day("Thursday", true), day("Friday"), day("Saturday", true), day("Sunday", true)] } as WorkoutPlan;
const lift = (date: string) => ({ date, exercises: [{ sets: [{ done: true }] }] }) as unknown as WorkoutSession;
const timed = (date: string) => ({ date, exercises: [], durationMin: 40 }) as unknown as WorkoutSession;

// Week of Mon 16 – Sun 22 Nov 2026.
describe("weekly goal", () => {
  it("goal comes from the plan's training days; done counts lifting and timed days this week only", () => {
    const g = weekGoalFor(plan, { daysPerWeek: 5 }, [lift("2026-11-15"), lift("2026-11-16"), timed("2026-11-17"), lift("2026-11-16")], "2026-11-18");
    assert.deepEqual([g.done, g.goal], [2, 3]);
    assert.equal(g.daysLeft, 5); // Wed (nothing yet) through Sun
    assert.deepEqual(g.days.map((d) => d.planned), [true, false, true, false, true, false, false]);
    assert.deepEqual(g.days.map((d) => d.done), [true, true, false, false, false, false, false]);
  });

  it("today counts as left only until something is logged", () => {
    assert.equal(weekGoalFor(plan, {}, [lift("2026-11-18")], "2026-11-18").daysLeft, 4);
  });

  it("without a plan the profile's days per week is the goal, else 3", () => {
    assert.equal(weekGoalFor(null, { daysPerWeek: 4 }, [], "2026-11-18").goal, 4);
    assert.equal(weekGoalFor(null, {}, [], "2026-11-18").goal, 3);
  });

  it("a live (unfinished) workout doesn't count", () => {
    const live = { ...timed("2026-11-18"), status: "in_progress" } as WorkoutSession;
    assert.equal(weekGoalFor(plan, {}, [live], "2026-11-18").done, 0);
  });
});
