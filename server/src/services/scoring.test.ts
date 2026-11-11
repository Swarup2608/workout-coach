import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parsePlan } from "./planParser.js";
import { checkPlan, DEFAULT_CONSTRAINTS } from "./constraints.js";
import { computeWeekMetrics } from "./metrics.js";
import type { Profile, WorkoutPlan, WorkoutSession } from "../domain.js";

const raw = fs.readFileSync(new URL("../seed/baseline-plan.md", import.meta.url), "utf8");
const parsed = parsePlan(raw);
const plan: WorkoutPlan = { id: "p", name: "t", goal: parsed.goal, createdAt: "", active: true, rawText: raw, days: parsed.days };
const profile: Profile = { name: "", goal: "", experience: "", startBodyweightKg: null, targetBodyweightKg: null, constraints: DEFAULT_CONSTRAINTS };

test("parses 5 training days and 2 recovery days", () => {
  assert.equal(parsed.days.filter((d) => !d.isRest).length, 5);
  assert.equal(parsed.days.find((d) => d.day === "Monday")!.exercises[0].name, "EZ-bar curls");
  const plank = parsed.days[0].exercises.find((e) => e.name.includes("plank"))!;
  assert.equal(plank.unit, "seconds");
});

test("flags RDLs and crunches against spinal-flexion constraint", () => {
  const flags = checkPlan(parsed.days, DEFAULT_CONSTRAINTS);
  assert.ok(flags.some((f) => f.exercise === "Romanian deadlifts" && f.swaps.includes("Trap bar deadlift")));
  assert.ok(flags.some((f) => f.exercise.includes("crunch")));
  assert.ok(!flags.some((f) => f.exercise.includes("Hanging knee")));
});

test("week metrics detect progressive overload", () => {
  const mk = (date: string, w: number, r: number): WorkoutSession => ({
    id: date, planId: "p", date, day: "Monday", cardioMinutes: 10, sessionRpe: 8, bodyweightKg: null, notes: "", createdAt: "", updatedAt: "",
    exercises: [{ plannedId: null, name: "EZ-bar curls", muscle: "biceps", unit: "reps", sets: [1, 2, 3].map(() => ({ weightKg: w, reps: r, done: true })) }],
  });
  const { metrics } = computeWeekMetrics(plan, [mk("2026-11-02", 20, 10), mk("2026-11-09", 22.5, 12)], "2026-11-09", profile);
  assert.equal(metrics.completedSessions, 1);
  assert.equal(metrics.exercises[0].trend, "up");
  assert.equal(metrics.exercises[0].hitTopOfRange, true);
  assert.ok(metrics.baseScore > 0 && metrics.baseScore <= 100);
});

import { parseReply } from "./handoff.js";
test("parses Claude's pasted reply with a fenced json score block", () => {
  const reply = 'Great week!\n\n| a | b |\n\n```json\n{ "repscore": { "kind": "week", "overall": 74, "summary": "Solid", "subScores": [{ "key": "adherence", "score": 80, "detail": "4/5" }], "strengths": ["x"], "issues": [], "recommendations": [], "nextWeekAdjustments": ["EZ-bar curls: 3 × 10 @ +2.5 kg"] } }\n```';
  const r = parseReply(reply);
  assert.equal(r.overall, 74);
  assert.equal(r.subScores[0].score, 80);
  assert.throws(() => parseReply("no score here"));
});
