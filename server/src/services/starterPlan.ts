import data from "../seed/workouts.json" with { type: "json" };
import {
  GOAL_LABELS,
  type Constraint,
  type EquipmentSetup,
  type ExperienceLevel,
  type GoalKey,
  type Injury,
  type PlanDay,
  type SessionMinutes,
} from "../domain.js";
import { parsePlan } from "./planParser.js";

/**
 * Rule-based starter plan (no AI). Onboarding answers pick a split from workouts.json,
 * each slot gets the first library exercise that fits the user's equipment, level and injuries,
 * and the goal sets the sets × reps. The result is written as Markdown and parsed by the normal
 * plan parser, so it is stored, edited and logged exactly like a pasted plan.
 */

export type Pattern =
  | "squat" | "hinge" | "lunge" | "horizontal_push" | "vertical_push" | "horizontal_pull"
  | "vertical_pull" | "biceps" | "triceps" | "shoulders_iso" | "calves" | "core";

export interface LibraryExercise {
  name: string;
  pattern: Pattern;
  equipment: EquipmentSetup[];
  stresses: Injury[];
  level: "beginner" | "intermediate" | "advanced";
  unit: "reps" | "seconds";
}

export interface WorkoutLibrary {
  exercises: LibraryExercise[];
  fallbacks: Record<string, string>;
  templates: Record<string, { title: string; slots: Pattern[] }>;
  schedule: Record<string, [string, string][]>;
  injuryConstraints: Record<Injury, { label: string; keywords: string[]; swaps: string[] }>;
}

// JSON imports widen tuples and enums to string[]; starterPlan.test.ts checks the real shape.
export const LIBRARY = data as unknown as WorkoutLibrary;

export interface StarterInput {
  goalKey: GoalKey;
  experience: ExperienceLevel;
  daysPerWeek: number;
  sessionMinutes: SessionMinutes;
  equipmentSetup: EquipmentSetup;
  injuries: Injury[];
}

const COMPOUND = new Set<Pattern>(["squat", "hinge", "horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull"]);

interface Rx {
  compound: [number, number, number];
  other: [number, number, number];
  notes: string[];
}

const PRESCRIPTION: Record<GoalKey, Rx> = {
  fat_loss: { compound: [3, 10, 15], other: [3, 10, 15], notes: ["Cardio: 10–20 min finisher (incline walk, bike or rower).", "Important: rest about 60 s between sets."] },
  muscle_gain: { compound: [4, 8, 12], other: [3, 10, 12], notes: ["Important: rest about 90 s between sets."] },
  maintain: { compound: [3, 8, 12], other: [3, 8, 12], notes: ["Cardio: optional 10 min easy cardio.", "Important: rest about 75 s between sets."] },
  strength: { compound: [5, 3, 6], other: [3, 8, 10], notes: ["Important: rest 2–3 min on the main lifts."] },
  general: { compound: [3, 10, 12], other: [3, 10, 12], notes: ["Cardio: 10 min easy cardio.", "Important: rest 60–75 s between sets."] },
};

const LEVELS: Record<ExperienceLevel, LibraryExercise["level"][]> = {
  Beginner: ["beginner"],
  Intermediate: ["beginner", "intermediate"],
  Advanced: ["beginner", "intermediate", "advanced"],
};

/** How many exercises fit in one session. */
export function slotCap(minutes: SessionMinutes): number {
  return { 30: 4, 45: 5, 60: 6, 90: 8 }[minutes];
}

const byName = new Map(LIBRARY.exercises.map((e) => [e.name, e]));

/** Related movements to borrow from when a slot's own pattern has nothing safe and unused left. */
const RELATED: Record<Pattern, Pattern[]> = {
  squat: ["lunge", "hinge", "calves"],
  hinge: ["squat", "lunge", "core"],
  lunge: ["squat", "hinge", "calves"],
  calves: ["lunge", "squat"],
  horizontal_push: ["vertical_push", "triceps", "shoulders_iso"],
  vertical_push: ["horizontal_push", "shoulders_iso", "triceps"],
  triceps: ["horizontal_push", "vertical_push"],
  horizontal_pull: ["vertical_pull", "shoulders_iso", "biceps"],
  vertical_pull: ["horizontal_pull", "biceps", "shoulders_iso"],
  biceps: ["horizontal_pull", "vertical_pull"],
  shoulders_iso: ["horizontal_pull", "vertical_push"],
  core: ["hinge"],
};

function pick(pattern: Pattern, input: StarterInput, used: Set<string>): LibraryExercise {
  const levels = LEVELS[input.experience];
  const fits = (p: Pattern) =>
    LIBRARY.exercises.find(
      (e) =>
        e.pattern === p &&
        e.equipment.includes(input.equipmentSetup) &&
        levels.includes(e.level) &&
        !e.stresses.some((s) => input.injuries.includes(s)) &&
        !used.has(e.name),
    );
  // Own pattern first, then a related movement, so a day never repeats an exercise when it can avoid it.
  for (const p of [pattern, ...RELATED[pattern]]) {
    const e = fits(p);
    if (e) return e;
  }
  // Nothing safe and unused left: the static fallback (no equipment, no joint stress) fills the slot.
  return byName.get(LIBRARY.fallbacks[pattern])!;
}

function line(e: LibraryExercise, input: StarterInput): string {
  const rx = PRESCRIPTION[input.goalKey];
  const minus = input.experience === "Beginner" ? 1 : 0;
  if (e.unit === "seconds") return `- ${e.name} — ${3 - minus} × 30–45 seconds`;
  const [sets, lo, hi] = COMPOUND.has(e.pattern) ? rx.compound : rx.other;
  return `- ${e.name} — ${Math.max(2, sets - minus)} × ${lo}–${hi}`;
}

export function buildStarterMarkdown(input: StarterInput): string {
  const label = GOAL_LABELS[input.goalKey];
  const schedule = LIBRARY.schedule[String(input.daysPerWeek)];
  if (!schedule) throw new Error(`No schedule for ${input.daysPerWeek} days per week`);
  const out = [`# Starter plan — ${label}`, "", `Goal: ${label}`, ""];
  for (const [day, key] of schedule) {
    const t = LIBRARY.templates[key];
    const used = new Set<string>();
    out.push(`## ${day} — ${t.title}`, "");
    for (const pattern of t.slots.slice(0, slotCap(input.sessionMinutes))) {
      const e = pick(pattern, input, used);
      used.add(e.name);
      out.push(line(e, input));
    }
    out.push("", ...PRESCRIPTION[input.goalKey].notes, "");
  }
  return out.join("\n");
}

export function buildStarterPlan(input: StarterInput): { name: string; goal: string; rawText: string; days: PlanDay[] } {
  const label = GOAL_LABELS[input.goalKey];
  const rawText = buildStarterMarkdown(input);
  return { name: `Starter plan — ${label}`, goal: label, rawText, days: parsePlan(rawText).days };
}

/** One constraint per injury (id "injury-<key>"), so swap hints keep working on later plan edits. */
export function injuryConstraints(injuries: Injury[]): Constraint[] {
  return injuries.map((i) => {
    const c = LIBRARY.injuryConstraints[i];
    return { id: `injury-${i}`, label: c.label, reason: "Reported during onboarding.", keywords: c.keywords, swaps: c.swaps };
  });
}
