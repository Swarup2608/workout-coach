import type { Diet, EquipmentSetup, ExperienceLevel, GoalKey, Injury, SessionMinutes } from "@/lib/domain";

export interface StepDef {
  n: number;
  key: "account" | "basics" | "goal" | "body" | "training" | "equipment" | "diet" | "ai";
  title: string;
  /** Shows a Skip button for the step */
  optional: boolean;
  /** Done at signup: always ticked, never pending */
  prefilled?: boolean;
}

/** The onboarding steps, in order. Steps 1–2 are completed by signup. */
export const STEPS: StepDef[] = [
  { n: 1, key: "account", title: "Account", optional: false, prefilled: true },
  { n: 2, key: "basics", title: "Basics", optional: false, prefilled: true },
  { n: 3, key: "goal", title: "Goal", optional: false },
  { n: 4, key: "body", title: "Body", optional: false },
  { n: 5, key: "training", title: "Training", optional: false },
  { n: 6, key: "equipment", title: "Equipment & limits", optional: false },
  { n: 7, key: "diet", title: "Diet", optional: true },
  { n: 8, key: "ai", title: "AI coach", optional: true },
];
export const TOTAL_STEPS = STEPS.length;

export const GOAL_OPTIONS: { value: GoalKey; label: string; hint: string }[] = [
  { value: "fat_loss", label: "Fat loss", hint: "Lose fat, keep muscle, add some cardio" },
  { value: "muscle_gain", label: "Muscle gain / weight gain", hint: "Build size with moderate reps" },
  { value: "maintain", label: "Maintain weight", hint: "Stay where you are and keep fit" },
  { value: "strength", label: "Get stronger", hint: "Heavier, lower-rep main lifts" },
  { value: "general", label: "General fitness", hint: "A bit of everything" },
];

export const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; hint: string }[] = [
  { value: "Beginner", label: "Beginner", hint: "Less than 6 months of regular training" },
  { value: "Intermediate", label: "Intermediate", hint: "6 months to 2 years" },
  { value: "Advanced", label: "Advanced", hint: "More than 2 years" },
];

export const DAY_OPTIONS = [2, 3, 4, 5, 6];
export const MINUTE_OPTIONS: SessionMinutes[] = [30, 45, 60, 90];

export const EQUIPMENT_OPTIONS: { value: EquipmentSetup; label: string; hint: string }[] = [
  { value: "gym", label: "Full gym", hint: "Barbells, machines, cables" },
  { value: "home_dumbbells", label: "Home with dumbbells", hint: "Dumbbells and a bench or chair" },
  { value: "bodyweight", label: "Bodyweight only", hint: "No equipment needed" },
];

export const INJURY_OPTIONS: { value: Injury; label: string }[] = [
  { value: "knee", label: "Knee" },
  { value: "lower_back", label: "Lower back" },
  { value: "shoulder", label: "Shoulder" },
  { value: "wrist", label: "Wrist" },
  { value: "elbow", label: "Elbow" },
];

export const DIET_OPTIONS: { value: Diet; label: string }[] = [
  { value: "veg", label: "Vegetarian" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "non_veg", label: "Non-vegetarian" },
  { value: "vegan", label: "Vegan" },
];
