import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeReadiness } from "./readiness.js";
import { allRecords, recordsIn } from "./records.js";
import type { WorkoutSession } from "../domain.js";

describe("readiness", () => {
  it("needs at least two answers", () => {
    assert.equal(computeReadiness({ sleep: "good", mood: null }), null);
  });
  it("great sleep and energy, no soreness → push", () => {
    assert.equal(computeReadiness({ sleep: "good", energy: 5, soreness: 1, stress: 1, mood: 5 })?.band, "push");
  });
  it("middling answers → train as planned", () => {
    assert.equal(computeReadiness({ sleep: "ok", energy: 3, soreness: 3, stress: 3, mood: 3 })?.band, "normal");
  });
  it("poor sleep, drained and sore → go lighter", () => {
    const r = computeReadiness({ sleep: "poor", energy: 1, soreness: 5, stress: 4, mood: 2 });
    assert.equal(r?.band, "light");
    assert.ok(r!.score < 50);
  });
});

const session = (date: string, name: string, sets: [number | null, number][]): WorkoutSession => ({
  id: date,
  planId: "",
  date,
  day: "Monday",
  exercises: [{ plannedId: null, name, muscle: "quads", unit: "reps", sets: sets.map(([weightKg, reps]) => ({ weightKg, reps, done: true })) }],
  cardioMinutes: null,
  sessionRpe: null,
  bodyweightKg: null,
  notes: "",
  createdAt: date,
  updatedAt: date,
});

describe("personal records", () => {
  it("first time doing an exercise is not a PR", () => {
    const s = session("2026-11-01", "Squat", [[60, 5]]);
    assert.deepEqual(recordsIn(s, [s]), []);
  });
  it("heavier weight is a weight PR", () => {
    const a = session("2026-11-01", "Squat", [[60, 5]]);
    const b = session("2026-11-08", "Squat", [[65, 3]]);
    const prs = recordsIn(b, [a, b]);
    assert.equal(prs[0].kind, "weight");
    assert.equal(prs[0].previous, 60);
  });
  it("same weight, more reps is an e1RM PR", () => {
    const a = session("2026-11-01", "Squat", [[60, 5]]);
    const b = session("2026-11-08", "Squat", [[60, 8]]);
    assert.equal(recordsIn(b, [a, b])[0].kind, "e1rm");
  });
  it("bodyweight work: more reps is a reps PR", () => {
    const a = session("2026-11-01", "Push-up", [[null, 10]]);
    const b = session("2026-11-08", "Push-up", [[null, 14]]);
    assert.equal(recordsIn(b, [a, b])[0].kind, "reps");
  });
  it("in-progress sessions are ignored and history is newest first", () => {
    const a = session("2026-11-01", "Squat", [[60, 5]]);
    const b = session("2026-11-08", "Squat", [[65, 5]]);
    const c = { ...session("2026-11-15", "Squat", [[70, 5]]), status: "in_progress" as const };
    const prs = allRecords([a, b, c]);
    assert.equal(prs.length, 1);
    assert.equal(prs[0].date, "2026-11-08");
  });
});
