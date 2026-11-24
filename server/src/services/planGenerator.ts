import { z } from "zod";
import {
  EXPERIENCE_LEVELS,
  GOAL_LABELS,
  WEEKDAYS,
  type ExperienceLevel,
  type GeneratedPlan,
  type PlanDay,
  type Profile,
} from "../domain.js";
import type { AiClient } from "./ai.js";
import { parsePlan } from "./planParser.js";
import { LIBRARY, buildStarterPlan, slotCap, type LibraryExercise, type Pattern, type StarterInput } from "./starterPlan.js";

/**
 * AI plan generator. The user's AI writes the week from the profile, but only with library exercises
 * that suit the equipment, level and injuries. Hard checks reject a plan that breaks the rules
 * (day count, exercise choice, volume, session length); one retry with the problems listed, then the
 * rule-based starter plan as the fallback. Output is the same Markdown the plan parser reads, so a
 * generated plan is stored, edited and logged like any other.
 */

const LEVELS: Record<ExperienceLevel, LibraryExercise["level"][]> = {
  Beginner: ["beginner"],
  Intermediate: ["beginner", "intermediate"],
  Advanced: ["beginner", "intermediate", "advanced"],
};

/** Weekly sets per movement group must land in this range. */
const GROUPS: Record<string, Pattern[]> = {
  legs: ["squat", "hinge", "lunge", "calves"],
  push: ["horizontal_push", "vertical_push", "triceps", "shoulders_iso"],
  pull: ["horizontal_pull", "vertical_pull", "biceps"],
};
const GROUP_MIN = 6;
const GROUP_MAX = 30;
const MIN_PER_SET = 2.5;

export function starterInputFrom(p: Profile): StarterInput | null {
  if (!p.goalKey || !p.daysPerWeek || !p.sessionMinutes || !p.equipmentSetup || !EXPERIENCE_LEVELS.includes(p.experience as ExperienceLevel)) return null;
  return { goalKey: p.goalKey, experience: p.experience as ExperienceLevel, daysPerWeek: p.daysPerWeek, sessionMinutes: p.sessionMinutes, equipmentSetup: p.equipmentSetup, injuries: p.injuries ?? [] };
}

/** Library exercises this user may be given. */
export function allowedExercises(input: StarterInput): LibraryExercise[] {
  const levels = LEVELS[input.experience];
  return LIBRARY.exercises.filter((e) => e.equipment.includes(input.equipmentSetup) && levels.includes(e.level) && !e.stresses.some((s) => input.injuries.includes(s)));
}

// ── What the AI returns ──────────────────────────────────────
const Raw = z.object({
  summary: z.string().catch(""),
  days: z
    .array(
      z.object({
        day: z.string(),
        title: z.string().catch("Workout"),
        exercises: z.array(z.object({ name: z.string(), sets: z.coerce.number(), repMin: z.coerce.number(), repMax: z.coerce.number(), unit: z.enum(["reps", "seconds"]).catch("reps") })),
        notes: z.array(z.string()).catch([]),
      }),
    )
    .catch([]),
});
type RawPlan = z.infer<typeof Raw>;

const TOOL = {
  name: "write_plan",
  description: "Write the weekly training plan.",
  schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "Two sentences: the split and why it suits this person." },
      days: {
        type: "array",
        description: "Training days only; every other weekday is rest.",
        items: {
          type: "object",
          properties: {
            day: { type: "string", enum: WEEKDAYS },
            title: { type: "string", description: "e.g. Upper body, Legs, Full body A" },
            exercises: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Exactly as written in the allowed list" },
                  sets: { type: "integer" },
                  repMin: { type: "integer" },
                  repMax: { type: "integer" },
                  unit: { type: "string", enum: ["reps", "seconds"] },
                },
                required: ["name", "sets", "repMin", "repMax", "unit"],
              },
            },
            notes: { type: "array", items: { type: "string" }, description: "Rest times, cardio finisher, cues (0–3 short lines)" },
          },
          required: ["day", "title", "exercises"],
        },
      },
    },
    required: ["summary", "days"],
  },
};

const SYSTEM = `You are a strength coach writing a weekly gym plan for one person. Follow the rules exactly; a checker rejects plans that break them.`;

export function generatorPrompt(input: StarterInput, notes: string, problems: string[] = []): string {
  const allowed = allowedExercises(input);
  const byPattern = new Map<string, string[]>();
  for (const e of allowed) byPattern.set(e.pattern, [...(byPattern.get(e.pattern) ?? []), `${e.name}${e.unit === "seconds" ? " (timed)" : ""}`]);
  const cap = slotCap(input.sessionMinutes);
  return [
    `Person: goal ${GOAL_LABELS[input.goalKey]}, ${input.experience}, ${input.daysPerWeek} training days a week, ${input.sessionMinutes} min sessions, equipment: ${input.equipmentSetup}.`,
    input.injuries.length ? `Injuries: ${input.injuries.join(", ")}. The allowed list already leaves out exercises that load these joints.` : "No injuries reported.",
    notes.trim() ? `Their request: "${notes.trim().slice(0, 500)}"` : "",
    "",
    "Allowed exercises, by movement (use these names exactly; nothing else):",
    ...[...byPattern.entries()].map(([p, names]) => `- ${p}: ${names.join("; ")}`),
    "",
    "Rules:",
    `- Exactly ${input.daysPerWeek} training days on different weekdays, spread out (avoid more than 3 in a row).`,
    `- 2 to ${cap + 1} exercises per day, no exercise twice in a day, and at most ${Math.floor((input.sessionMinutes + 10) / MIN_PER_SET)} sets per day (about ${MIN_PER_SET} min per set).`,
    `- Sets 1–6. Reps 1–30 (repMin ≤ repMax); timed exercises use unit "seconds" with 10–120.`,
    `- Weekly sets per group between ${GROUP_MIN} and ${GROUP_MAX}: legs (squat, hinge, lunge, calves), push (horizontal/vertical push, triceps, shoulders), pull (horizontal/vertical pull, biceps).`,
    `- Match the goal: strength = low reps (3–6) on the main lifts; muscle gain = 8–12; fat loss = 10–15 with short rests.`,
    ...(problems.length ? ["", "Your previous plan was rejected. Fix all of these:", ...problems.map((p) => `- ${p}`)] : []),
  ]
    .filter((l) => l !== "")
    .join("\n")
    .replace(/\nRules:/, "\n\nRules:");
}

/** Every rule the plan breaks, in plain words (empty = OK). */
export function checkPlan(raw: RawPlan, input: StarterInput): string[] {
  const problems: string[] = [];
  const allowed = new Map(allowedExercises(input).map((e) => [e.name.toLowerCase(), e]));
  const days = raw.days;
  const weekdays = days.map((d) => WEEKDAYS.find((w) => w.toLowerCase() === d.day.trim().toLowerCase()));
  if (days.length !== input.daysPerWeek) problems.push(`Needs exactly ${input.daysPerWeek} training days, got ${days.length}.`);
  if (weekdays.some((w) => !w)) problems.push(`Days must be weekday names (Monday–Sunday).`);
  if (new Set(weekdays).size !== weekdays.length) problems.push("Two workouts on the same weekday.");
  const idx = new Set(weekdays.filter(Boolean).map((w) => WEEKDAYS.indexOf(w!)));
  let run = 0;
  let longest = 0;
  for (let i = 0; i < 14; i++) {
    run = idx.has(i % 7) ? run + 1 : 0;
    longest = Math.max(longest, Math.min(run, 7));
  }
  if (input.daysPerWeek <= 5 && longest > 3) problems.push("More than 3 training days in a row; spread them out.");

  const maxSets = Math.floor((input.sessionMinutes + 10) / MIN_PER_SET);
  const groupSets: Record<string, number> = { legs: 0, push: 0, pull: 0 };
  for (const d of days) {
    const label = d.day;
    if (d.exercises.length < 2 || d.exercises.length > slotCap(input.sessionMinutes) + 1) problems.push(`${label}: use 2–${slotCap(input.sessionMinutes) + 1} exercises.`);
    const names = d.exercises.map((e) => e.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) problems.push(`${label}: the same exercise twice.`);
    const sets = d.exercises.reduce((a, e) => a + (Number.isFinite(e.sets) ? e.sets : 0), 0);
    if (sets > maxSets) problems.push(`${label}: ${sets} sets won't fit in ${input.sessionMinutes} min (max ${maxSets}).`);
    for (const e of d.exercises) {
      const lib = allowed.get(e.name.trim().toLowerCase());
      if (!lib) {
        problems.push(`${label}: "${e.name}" is not in the allowed list.`);
        continue;
      }
      if (!(e.sets >= 1 && e.sets <= 6)) problems.push(`${label}: ${e.name} sets must be 1–6.`);
      const [lo, hi] = lib.unit === "seconds" ? [10, 120] : [1, 30];
      if (!(e.repMin >= lo && e.repMax <= hi && e.repMin <= e.repMax)) problems.push(`${label}: ${e.name} ${lib.unit === "seconds" ? "seconds" : "reps"} must be ${lo}–${hi}, low ≤ high.`);
      for (const [g, patterns] of Object.entries(GROUPS)) if (patterns.includes(lib.pattern)) groupSets[g] += e.sets;
    }
  }
  for (const [g, n] of Object.entries(groupSets)) {
    if (n < GROUP_MIN) problems.push(`Only ${n} weekly sets for ${g}; needs at least ${GROUP_MIN}.`);
    if (n > GROUP_MAX) problems.push(`${n} weekly sets for ${g} is too many; at most ${GROUP_MAX}.`);
  }
  return [...new Set(problems)];
}

/** The plan as Markdown in the format the plan parser reads (library names and units restored). */
export function toMarkdown(raw: RawPlan, input: StarterInput): string {
  const lib = new Map(LIBRARY.exercises.map((e) => [e.name.toLowerCase(), e]));
  const order = (d: string) => WEEKDAYS.findIndex((w) => w.toLowerCase() === d.trim().toLowerCase());
  const label = GOAL_LABELS[input.goalKey];
  const out = [`# AI plan — ${label}`, "", `Goal: ${label}`, ""];
  for (const d of [...raw.days].sort((a, b) => order(a.day) - order(b.day))) {
    out.push(`## ${WEEKDAYS[order(d.day)]} — ${d.title.trim() || "Workout"}`, "");
    for (const e of d.exercises) {
      const l = lib.get(e.name.trim().toLowerCase());
      const name = l?.name ?? e.name.trim();
      const reps = e.repMin === e.repMax ? `${e.repMin}` : `${e.repMin}–${e.repMax}`;
      out.push(`- ${name} — ${e.sets} × ${reps}${l?.unit === "seconds" ? " seconds" : ""}`);
    }
    if (d.notes.length) out.push("", ...d.notes.slice(0, 3).map((n) => n.trim()).filter(Boolean));
    out.push("");
  }
  return out.join("\n");
}

function asGenerated(raw: RawPlan, input: StarterInput, source: GeneratedPlan["source"], note: string, problems: string[] = []): GeneratedPlan {
  const rawText = toMarkdown(raw, input);
  const days: PlanDay[] = parsePlan(rawText).days;
  return { source, name: `AI plan — ${GOAL_LABELS[input.goalKey]}`, goal: GOAL_LABELS[input.goalKey], summary: raw.summary.trim(), rawText, days, note, problems };
}

function ruleFallback(input: StarterInput, note: string, problems: string[]): GeneratedPlan {
  const s = buildStarterPlan(input);
  return { source: "rules", name: s.name, goal: s.goal, summary: "", rawText: s.rawText, days: s.days, note, problems };
}

/** Asks the AI, checks, retries once with the problems, then falls back to the rule-based plan. */
export async function generatePlan(ai: AiClient, input: StarterInput, notes: string): Promise<GeneratedPlan> {
  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = Raw.safeParse(await ai.structured({ system: SYSTEM, prompt: generatorPrompt(input, notes, problems), tool: TOOL, maxTokens: 4000 }));
    if (!parsed.success) {
      problems = ["The reply didn't match the plan format."];
      continue;
    }
    problems = checkPlan(parsed.data, input);
    if (!problems.length) return asGenerated(parsed.data, input, "ai", attempt ? "Fixed on the second try." : "");
  }
  return ruleFallback(input, "The AI's plan broke the rules twice, so here is the rule-based plan instead.", problems);
}

/**
 * Checks a plan pasted back from another AI (the no-key path): parsed from Markdown, then run through
 * the same rules. Exercise names outside the allowed list count as problems.
 */
export function checkPastedPlan(text: string, input: StarterInput): GeneratedPlan {
  const parsed = parsePlan(text);
  const raw: RawPlan = {
    summary: "",
    days: parsed.days
      .filter((d) => !d.isRest && d.exercises.length)
      .map((d) => ({ day: d.day, title: d.title, notes: d.notes, exercises: d.exercises.map((e) => ({ name: e.name, sets: e.sets, repMin: e.repMin, repMax: e.repMax, unit: e.unit === "seconds" ? ("seconds" as const) : ("reps" as const) })) })),
  };
  const problems = checkPlan(raw, input);
  return { ...asGenerated(raw, input, "pasted", problems.length ? "Saved as is, the plan would break these rules. Ask the AI to fix them, or save anyway." : "Passed every check."), problems };
}

/** The no-key prompt: same rules, but the reply is Markdown to paste back. */
export function pastePrompt(input: StarterInput, notes: string): string {
  return [
    "Write my weekly gym plan.",
    "",
    generatorPrompt(input, notes),
    "",
    "Reply with ONLY the plan in this Markdown format (one ## heading per training day, one exercise per line):",
    "```",
    "## Monday — Upper body",
    "- Barbell bench press — 4 × 6–8",
    "- Plank — 3 × 30–45 seconds",
    "Rest about 90 s between sets.",
    "```",
  ].join("\n");
}

