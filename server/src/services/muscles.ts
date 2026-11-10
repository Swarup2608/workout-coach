import type { MuscleGroup } from "@workout/shared";

// Ordered rules: first match wins, so specific patterns come before generic ones.
const RULES: [RegExp, MuscleGroup][] = [
  [/tibialis/, "shins"],
  [/calf/, "calves"],
  [/adductor/, "adductors"],
  [/abductor|hip thrust|glute|pull-?through/, "glutes"],
  [/romanian|rdl|hamstring|leg curl|seated curl|good morning/, "hamstrings"],
  [/leg press|leg extension|squat|lunge|step-?up/, "quads"],
  [/deadlift/, "hamstrings"],
  [/back extension|hyperextension/, "lower back"],
  [/crunch|knee raise|leg raise|plank|dead bug|pallof|woodchop|bird dog|ab /, "core"],
  [/face pull|rear delt|reverse fly/, "rear delts"],
  [/shrug/, "traps"],
  [/pushdown|triceps|skull|dip|kickback/, "triceps"],
  [/wrist|forearm/, "forearms"],
  [/curl/, "biceps"],
  [/pulldown|pull-?up|chin-?up|row|\blats?\b/, "back"],
  [/lateral raise|front raise|arnold|overhead press|shoulder press|military/, "shoulders"],
  [/bench|chest|fly|pec|push-?up|pullover|incline press|decline press/, "chest"],
];

export function classifyMuscle(name: string): MuscleGroup {
  const n = ` ${name.toLowerCase()} `;
  for (const [re, m] of RULES) if (re.test(n)) return m;
  return "other";
}
