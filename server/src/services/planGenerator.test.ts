import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { allowedExercises, checkPastedPlan, checkPlan, generatePlan, generatorPrompt, pastePrompt, toMarkdown } from "./planGenerator.js";
import type { AiClient } from "./ai.js";
import { LIBRARY, type StarterInput } from "./starterPlan.js";

const input: StarterInput = { goalKey: "muscle_gain", experience: "Intermediate", daysPerWeek: 3, sessionMinutes: 60, equipmentSetup: "gym", injuries: [] };

/** A plan that follows every rule: full body Mon/Wed/Fri from the allowed list. */
function goodPlan(inp = input) {
  const allowed = allowedExercises(inp);
  const first = (p: string) => allowed.find((e) => e.pattern === p)!.name;
  const ex = ["squat", "horizontal_push", "horizontal_pull", "hinge"].map((p) => ({ name: first(p), sets: 3, repMin: 8, repMax: 12, unit: "reps" as const }));
  return { summary: "Full body three times a week.", days: ["Monday", "Wednesday", "Friday"].map((day) => ({ day, title: "Full body", exercises: ex, notes: ["Rest about 90 s."] })) };
}

const fakeAi = (...replies: unknown[]) => {
  const prompts: string[] = [];
  const ai: AiClient = {
    label: "Fake",
    structured: async (o) => {
      prompts.push(o.prompt);
      return replies[Math.min(prompts.length - 1, replies.length - 1)];
    },
    stream: async () => "",
  };
  return { ai, prompts };
};

describe("plan generator: checks", () => {
  it("a plan that follows the rules passes", () => {
    assert.deepEqual(checkPlan(goodPlan(), input), []);
  });

  it("injured joints remove exercises from the allowed list", () => {
    const knee = allowedExercises({ ...input, injuries: ["knee"] });
    assert.ok(knee.length < allowedExercises(input).length);
    assert.ok(knee.every((e) => !e.stresses.includes("knee")));
  });

  it("catches wrong day counts, unknown exercises, repeats, long sessions, bad ranges and lopsided volume", () => {
    const p = goodPlan();
    assert.match(checkPlan({ ...p, days: p.days.slice(0, 2) }, input).join(" "), /exactly 3 training days/);
    const unknown = structuredClone(p);
    unknown.days[0].exercises[0].name = "Bosu ball juggling";
    assert.match(checkPlan(unknown, input).join(" "), /not in the allowed list/);
    const twice = structuredClone(p);
    twice.days[0].exercises[1] = { ...twice.days[0].exercises[0] };
    assert.match(checkPlan(twice, input).join(" "), /same exercise twice/);
    const long = structuredClone(p);
    long.days[0].exercises.forEach((e) => (e.sets = 6));
    long.days[0].exercises.push(...allowedExercises(input).filter((e) => e.pattern === "biceps" || e.pattern === "triceps").slice(0, 2).map((e) => ({ name: e.name, sets: 6, repMin: 10, repMax: 12, unit: "reps" as const })));
    assert.match(checkPlan(long, input).join(" "), /won't fit in 60 min/);
    const reps = structuredClone(p);
    reps.days[0].exercises[0].repMin = 15;
    reps.days[0].exercises[0].repMax = 8;
    assert.match(checkPlan(reps, input).join(" "), /low ≤ high/);
    const noPull = structuredClone(p);
    noPull.days.forEach((d) => (d.exercises = d.exercises.filter((e) => e.name !== p.days[0].exercises[2].name)));
    assert.match(checkPlan(noPull, input).join(" "), /weekly sets for pull/);
  });

  it("flags more than 3 days in a row", () => {
    const p = goodPlan({ ...input, daysPerWeek: 4 });
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday"].map((day) => ({ ...p.days[0], day }));
    assert.match(checkPlan({ ...p, days }, { ...input, daysPerWeek: 4 }).join(" "), /3 training days in a row/);
  });
});

describe("plan generator: flow", () => {
  it("a good first answer is used as is, in plan Markdown", async () => {
    const { ai, prompts } = fakeAi(goodPlan());
    const g = await generatePlan(ai, input, "focus on arms");
    assert.equal(g.source, "ai");
    assert.equal(prompts.length, 1);
    assert.match(prompts[0], /focus on arms/);
    assert.deepEqual(g.days.filter((d) => !d.isRest).map((d) => d.day), ["Monday", "Wednesday", "Friday"]);
    assert.equal(g.days.find((d) => d.day === "Monday")!.exercises.length, 4);
    assert.match(g.rawText, /^# AI plan — /);
  });

  it("a broken first answer gets one retry with the problems listed", async () => {
    const bad = { ...goodPlan(), days: goodPlan().days.slice(0, 1) };
    const { ai, prompts } = fakeAi(bad, goodPlan());
    const g = await generatePlan(ai, input, "");
    assert.equal(g.source, "ai");
    assert.equal(prompts.length, 2);
    assert.match(prompts[1], /previous plan was rejected[\s\S]*exactly 3 training days/);
    assert.match(g.note, /second try/);
  });

  it("broken twice → the rule-based plan, with the reasons", async () => {
    const { ai } = fakeAi({ summary: "", days: [] });
    const g = await generatePlan(ai, input, "");
    assert.equal(g.source, "rules");
    assert.ok(g.problems.length > 0);
    assert.equal(g.days.filter((d) => !d.isRest).length, 3);
  });

  it("Markdown keeps library names and timed units", () => {
    const p = goodPlan();
    const plank = allowedExercises(input).find((e) => e.unit === "seconds")!;
    p.days[0].exercises.push({ name: plank.name.toUpperCase(), sets: 3, repMin: 30, repMax: 45, unit: "reps" });
    const md = toMarkdown(p, input);
    assert.ok(md.includes(`- ${plank.name} — 3 × 30–45 seconds`));
  });
});

describe("plan generator: no-key path", () => {
  it("the prompt lists the rules and the allowed exercises", () => {
    const text = pastePrompt(input, "");
    assert.match(text, /Exactly 3 training days/);
    assert.ok(text.includes(allowedExercises(input)[0].name));
    assert.match(text, /## Monday — Upper body/);
    const kneePrompt = generatorPrompt({ ...input, injuries: ["knee"] }, "");
    const kneeLoaders = LIBRARY.exercises.filter((e) => e.stresses.includes("knee") && e.equipment.includes("gym"));
    assert.ok(kneeLoaders.length > 0);
    for (const e of kneeLoaders) assert.ok(!kneePrompt.includes(`${e.name};`) && !kneePrompt.includes(`${e.name}\n`), e.name);
  });

  it("a pasted plan is parsed and checked with the same rules", () => {
    const ok = checkPastedPlan(toMarkdown(goodPlan(), input), input);
    assert.equal(ok.source, "pasted");
    assert.deepEqual(ok.problems, []);
    const bad = checkPastedPlan("## Monday — Arms\n- Bosu ball juggling — 3 × 10\n- Bicep curl — 3 × 10", input);
    assert.ok(bad.problems.some((p) => /exactly 3/.test(p)));
    assert.ok(bad.problems.some((p) => /not in the allowed list/.test(p)));
  });
});
