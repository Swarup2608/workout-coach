import { swapsFor, type Constraint, type ConstraintFlag, type PlanDay } from "@workout/shared";

export const DEFAULT_CONSTRAINTS: Constraint[] = [
  {
    id: "no-loaded-spinal-flexion",
    label: "No loaded spinal flexion",
    reason: "Avoid loaded spinal flexion / hinge patterns that round the lower back.",
    keywords: [
      "romanian deadlift",
      "rdl",
      "conventional deadlift",
      "stiff-leg deadlift",
      "crunch",
      "sit-up",
      "sit up",
      "ab wheel",
      "ab-wheel",
      "rollout",
      "good morning",
    ],
    swaps: [
      "Trap bar deadlift",
      "Cable pull-through",
      "Dead bug",
      "Pallof press",
      "Bird dog",
      "Side plank",
    ],
  },
  {
    id: "no-treadmill-running",
    label: "No straight treadmill running",
    reason: "Prefer low-impact cardio (incline walk, cycling, rowing, Stairmaster).",
    keywords: ["treadmill run", "running", "sprints"],
    swaps: ["Incline treadmill walk", "Cycling", "Rowing machine", "Stairmaster"],
  },
];

export function checkExercise(name: string, constraints: Constraint[]): ConstraintFlag[] {
  const n = name.toLowerCase();
  return constraints
    .filter((c) => c.keywords.some((k) => k && n.includes(k.toLowerCase())))
    .map((c) => ({ exercise: name, constraint: c.label, reason: c.reason, swaps: swapsFor(name, c) }));
}

export function checkPlan(days: PlanDay[], constraints: Constraint[]): ConstraintFlag[] {
  const flags: ConstraintFlag[] = [];
  for (const d of days)
    for (const e of d.exercises)
      for (const f of checkExercise(e.name, constraints)) flags.push({ ...f, day: d.day });
  return flags;
}
