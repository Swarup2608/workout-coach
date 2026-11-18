import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EQUIPMENT_SETUPS, EXPERIENCE_LEVELS, GOAL_KEYS, INJURIES, SESSION_MINUTES, type Injury } from "../domain.js";
import { LIBRARY, buildStarterPlan, injuryConstraints, slotCap, type StarterInput } from "./starterPlan.js";

const PATTERNS = ["squat", "hinge", "lunge", "horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "biceps", "triceps", "shoulders_iso", "calves", "core"];
const base: StarterInput = { goalKey: "strength", experience: "Intermediate", daysPerWeek: 4, sessionMinutes: 60, equipmentSetup: "gym", injuries: [] };
const byName = new Map(LIBRARY.exercises.map((e) => [e.name, e]));

describe("starter plan", () => {
  it("library covers every pattern for every setup", () => {
    for (const pattern of PATTERNS)
      for (const setup of EQUIPMENT_SETUPS) {
        const beginner = LIBRARY.exercises.filter((e) => e.pattern === pattern && e.equipment.includes(setup) && e.level === "beginner");
        assert.ok(beginner.length >= 2, `${pattern}/${setup} has ${beginner.length} beginner entries`);
        assert.ok(beginner.some((e) => e.stresses.length <= 1), `${pattern}/${setup} needs a low-stress entry`);
      }
  });

  it("fallbacks are safe", () => {
    for (const pattern of PATTERNS) {
      const name = LIBRARY.fallbacks[pattern];
      const e = byName.get(name);
      assert.ok(e, `fallback for ${pattern} (${name}) is in the library`);
      assert.equal(e.pattern, pattern);
      assert.deepEqual(e.stresses, []);
      assert.equal(e.level, "beginner");
      assert.deepEqual([...e.equipment].sort(), [...EQUIPMENT_SETUPS].sort());
    }
  });

  it("every combination builds a usable week", () => {
    const injurySets: Injury[][] = [[], ...INJURIES.map((i) => [i]), [...INJURIES]];
    for (const goalKey of GOAL_KEYS)
      for (const experience of EXPERIENCE_LEVELS)
        for (let daysPerWeek = 2; daysPerWeek <= 6; daysPerWeek++)
          for (const sessionMinutes of SESSION_MINUTES)
            for (const equipmentSetup of EQUIPMENT_SETUPS)
              for (const injuries of injurySets) {
                const input = { goalKey, experience, daysPerWeek, sessionMinutes, equipmentSetup, injuries };
                const label = JSON.stringify(input);
                const plan = buildStarterPlan(input);
                assert.equal(plan.days.length, 7, label);
                const training = plan.days.filter((d) => !d.isRest);
                assert.equal(training.length, daysPerWeek, label);
                for (const d of training) assert.equal(d.exercises.length, slotCap(sessionMinutes), `${label} ${d.day}`);
                for (const d of plan.days.filter((d) => d.isRest)) assert.equal(d.exercises.length, 0, label);
              }
  });

  it("never repeats an exercise within a day (no injuries or one injury)", () => {
    const injurySets: Injury[][] = [[], ...INJURIES.map((i) => [i])];
    for (const goalKey of GOAL_KEYS)
      for (const experience of EXPERIENCE_LEVELS)
        for (let daysPerWeek = 2; daysPerWeek <= 6; daysPerWeek++)
          for (const equipmentSetup of EQUIPMENT_SETUPS)
            for (const injuries of injurySets) {
              const plan = buildStarterPlan({ goalKey, experience, daysPerWeek, sessionMinutes: 90, equipmentSetup, injuries });
              for (const d of plan.days) {
                const names = d.exercises.map((e) => e.name);
                assert.equal(new Set(names).size, names.length, `${JSON.stringify({ experience, daysPerWeek, equipmentSetup, injuries })} ${d.day}: ${names.join(", ")}`);
              }
            }
  });

  it("injuries exclude stressed exercises", () => {
    for (const injury of INJURIES)
      for (const equipmentSetup of EQUIPMENT_SETUPS) {
        const plan = buildStarterPlan({ ...base, equipmentSetup, injuries: [injury], daysPerWeek: 6, sessionMinutes: 90 });
        for (const d of plan.days)
          for (const ex of d.exercises) assert.ok(!byName.get(ex.name)?.stresses.includes(injury), `${ex.name} stresses ${injury}`);
      }
  });

  it("only uses equipment the user has and exercises at their level", () => {
    const plan = buildStarterPlan({ ...base, experience: "Beginner", equipmentSetup: "bodyweight", daysPerWeek: 6, sessionMinutes: 90 });
    for (const d of plan.days)
      for (const ex of d.exercises) {
        const e = byName.get(ex.name)!;
        assert.ok(e.equipment.includes("bodyweight"), ex.name);
        assert.equal(e.level, "beginner", ex.name);
      }
  });

  it("is deterministic", () => {
    assert.equal(buildStarterPlan(base).rawText, buildStarterPlan(base).rawText);
  });

  it("prescriptions follow the goal and experience", () => {
    const strong = buildStarterPlan(base).days.find((d) => d.day === "Monday")!.exercises[0];
    assert.deepEqual([strong.sets, strong.repMin, strong.repMax], [5, 3, 6]);
    const beginner = buildStarterPlan({ ...base, experience: "Beginner" }).days.find((d) => d.day === "Monday")!.exercises[0];
    assert.equal(beginner.sets, 4);
    const fat = buildStarterPlan({ ...base, goalKey: "fat_loss" });
    for (const d of fat.days.filter((d) => !d.isRest)) assert.ok(d.notes.some((n) => n.startsWith("Cardio:")), d.day);
    assert.equal(fat.name, "Starter plan — Fat loss");
    assert.equal(fat.goal, "Fat loss");
  });

  it("timed exercises use seconds", () => {
    const plan = buildStarterPlan({ ...base, experience: "Beginner", equipmentSetup: "bodyweight", daysPerWeek: 4, sessionMinutes: 90 });
    const timed = plan.days.flatMap((d) => d.exercises).filter((e) => byName.get(e.name)?.unit === "seconds");
    assert.ok(timed.length > 0, "expected a timed core exercise");
    for (const e of timed) assert.deepEqual([e.unit, e.repMin, e.repMax], ["seconds", 30, 45]);
  });

  it("schedule puts training on the planned weekdays", () => {
    const days = (n: number) => buildStarterPlan({ ...base, daysPerWeek: n }).days.filter((d) => !d.isRest).map((d) => d.day);
    assert.deepEqual(days(2), ["Monday", "Thursday"]);
    assert.deepEqual(days(3), ["Monday", "Wednesday", "Friday"]);
    assert.deepEqual(days(4), ["Monday", "Tuesday", "Thursday", "Friday"]);
    assert.deepEqual(days(6), ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  });

  it("a plan never trips the constraint for its own injury", () => {
    for (const injury of INJURIES)
      for (const equipmentSetup of EQUIPMENT_SETUPS)
        for (const experience of EXPERIENCE_LEVELS) {
          const [c] = injuryConstraints([injury]);
          const plan = buildStarterPlan({ ...base, experience, equipmentSetup, injuries: [injury], daysPerWeek: 6, sessionMinutes: 90 });
          for (const ex of plan.days.flatMap((d) => d.exercises))
            assert.ok(!c.keywords.some((k) => ex.name.toLowerCase().includes(k)), `${ex.name} flagged by ${c.id}`);
        }
  });

  it("injuryConstraints maps injuries to constraints", () => {
    const c = injuryConstraints(["knee", "wrist"]);
    assert.deepEqual(c.map((x) => x.id), ["injury-knee", "injury-wrist"]);
    assert.ok(c[0].keywords.includes("squat"));
    assert.ok(c.every((x) => x.swaps.length > 0 && x.label));
  });
});
