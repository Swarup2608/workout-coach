import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parsePlan } from "./planParser.js";
import { dayPrompt, mergeDay, parseDay } from "./dayImport.js";
import type { WorkoutPlan } from "@workout/shared";

const raw = fs.readFileSync(new URL("../seed/baseline-plan.md", import.meta.url), "utf8");
const parsed = parsePlan(raw);
const plan: WorkoutPlan = { id: "p", name: "t", goal: parsed.goal, createdAt: "", active: true, rawText: raw, days: parsed.days };
const monday = "2026-11-09";

test("prompt lists the plan and the JSON format", () => {
  const p = dayPrompt(plan, monday);
  assert.match(p, /repscoreDay/);
  assert.match(p, /Monday/);
  assert.match(p, /My day:\s*$/);
});

test("parses a messy AI reply and merges workout, cardio, food and steps", () => {
  const firstEx = plan.days[0].exercises[0];
  const reply = `Sure! Here's your day:
\`\`\`json
{ "repscoreDay": {
  "date": "${monday}",
  "exercises": [
    { "name": "${firstEx.alternatives[0] ?? firstEx.name}", "unit": "reps", "sets": [{ "kg": "20", "reps": 12 }, { "kg": 20, "reps": 10 }] },
    { "name": "Farmer carry", "unit": "secs", "sets": [{ "kg": 24, "reps": 40 }] }
  ],
  "cardio": [{ "type": "treadmill incline", "minutes": 15, "speedKmh": 3.5, "inclinePct": 12 }],
  "food": [{ "meal": "Breakfast", "name": "3 eggs", "kcal": 230, "proteinG": 18 }],
  "steps": "8,500"
} }
\`\`\``;
  const day = parseDay(reply);
  const { body, summary } = mergeDay(day, monday, null, plan);
  const hit = body.exercises.find((e) => e.plannedId === firstEx.id)!;
  assert.equal(hit.sets.length, 2);
  assert.deepEqual(hit.sets[0], { weightKg: 20, reps: 12, negatives: null, done: true });
  const carry = body.exercises.find((e) => e.name === "Farmer carry")!;
  assert.equal(carry.unit, "seconds");
  assert.equal(body.cardio[0].type, "incline walk");
  assert.equal(body.food[0].meal, "breakfast");
  assert.equal(body.steps, 8500);
  // Planned exercises not mentioned are kept with empty sets.
  assert.ok(body.exercises.length > 2);
  assert.match(summary, /8,500 steps/);
});

test("negatives, timed sets, dumbbell/cable each side and barbell totals", () => {
  const p = dayPrompt(plan, monday);
  assert.match(p, /"negatives"/);
  assert.match(p, /bar \+ all plates/);
  assert.match(p, /ONE dumbbell/);
  assert.match(p, /"perSide": true/);

  const day = parseDay(`{"repscoreDay":{"exercises":[
    {"name":"EZ-bar curls","equipment":"EZ bar","sets":[{"kg":20,"reps":10,"negatives":"2"}]},
    {"name":"Single-arm cable pushdown","equipment":"cable","perSide":"true","sets":[{"kg":15,"reps":12}]},
    {"name":"Plank","equipment":"bodyweight","unit":"sec","sets":[{"kg":null,"reps":45}]}
  ]}}`);
  const { body } = mergeDay(day, monday, null, plan);
  const ez = body.exercises.find((e) => /ez/i.test(e.name))!;
  assert.equal(ez.equipment, "barbell");
  assert.equal(ez.sets[0].negatives, 2);
  const cable = body.exercises.find((e) => e.name === "Single-arm cable pushdown")!;
  assert.equal(cable.equipment, "cable");
  assert.equal(cable.perSide, true);
  const plank = body.exercises.find((e) => /plank/i.test(e.name) && e.sets.some((s) => s.done))!;
  assert.equal(plank.unit, "seconds");
  assert.equal(plank.sets[0].reps, 45);
});

test("custom workout drops untouched plan exercises; food-only import keeps existing sets", () => {
  const custom = mergeDay(parseDay(`{"workout":{"basedOn":"custom","title":"Back & biceps"},"exercises":[{"name":"Lat pulldown","sets":[{"kg":45,"reps":10}]}]}`), monday, null, plan);
  assert.equal(custom.body.planDay, "custom");
  assert.equal(custom.body.exercises.length, 1);

  const existing = { ...custom.body, id: "s", planId: "p", day: "Monday" as const, title: "Back & biceps", exercises: custom.body.exercises.map((e) => ({ ...e, muscle: "back" as const })), createdAt: "", updatedAt: "" };
  const foodOnly = mergeDay(parseDay(`{"food":[{"name":"Chicken rice","kcal":650}]}`), monday, existing, plan);
  assert.equal(foodOnly.body.exercises[0].sets[0].weightKg, 45);
  assert.equal(foodOnly.body.planDay, "custom");
  assert.equal(foodOnly.body.food.length, 1);
});
