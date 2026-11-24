// Domain types and helpers for the Next.js client.
// The other app keeps its own copy (server/src/domain.ts): when you change an API type, update both.

export type Weekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export const WEEKDAYS: Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export type MuscleGroup =
  | "chest"
  | "back"
  | "lower back"
  | "shoulders"
  | "rear delts"
  | "traps"
  | "biceps"
  | "triceps"
  | "forearms"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "adductors"
  | "calves"
  | "shins"
  | "core"
  | "other";

export type RepUnit = "reps" | "seconds" | "minutes" | "meters";

export const REP_UNITS: { value: RepUnit; label: string; short: string }[] = [
  { value: "reps", label: "Reps", short: "reps" },
  { value: "seconds", label: "Seconds", short: "sec" },
  { value: "minutes", label: "Minutes", short: "min" },
  { value: "meters", label: "Meters", short: "m" },
];

export const unitShort = (u: RepUnit) => REP_UNITS.find((x) => x.value === u)?.short ?? u;

export interface PlannedExercise {
  id: string;
  name: string;
  /** "A OR B" choices from the plan */
  alternatives: string[];
  section: string;
  sets: number;
  repMin: number;
  repMax: number;
  unit: RepUnit;
  /** "each" side / arm */
  perSide: boolean;
  muscle: MuscleGroup;
}

export interface PlanDay {
  day: Weekday;
  title: string;
  isRest: boolean;
  exercises: PlannedExercise[];
  notes: string[];
}

export interface WorkoutPlan {
  id: string;
  name: string;
  goal: string;
  createdAt: string;
  active: boolean;
  rawText: string;
  days: PlanDay[];
  /** This week's reshuffle: missed workouts moved to later days. Ignored once the week is over. */
  weekMoves?: WeekMoves | null;
}

/** A plan preview from the generator (not saved until the user accepts it). */
export interface GeneratedPlan {
  /** "ai": written by the user's AI and passed every check; "rules": the rule-based fallback; "pasted": checked from a pasted reply */
  source: "ai" | "rules" | "pasted";
  name: string;
  goal: string;
  summary: string;
  /** Markdown, saved through the normal plan endpoint */
  rawText: string;
  days: PlanDay[];
  note: string;
  /** Rules the plan breaks (empty when it passed) */
  problems: string[];
}

/** A missed plan day done on another date this week. The plan's own days don't change. */
export interface WeekMove {
  date: string;
  planDay: Weekday;
}
export interface WeekMoves {
  weekStart: string;
  moves: WeekMove[];
}

/** Suggested reshuffle for the rest of the week. */
export interface ReshuffleSuggestion {
  weekStart: string;
  /** Planned training days already past with nothing logged for them */
  missed: { day: Weekday; title: string }[];
  /** Where each missed workout could go (free rest days from today on, oldest first) */
  moves: (WeekMove & { title: string })[];
  /** Missed workouts with no free day left: better skipped than crammed in */
  skipped: { day: Weekday; title: string }[];
  /** Moves already in use this week */
  applied: WeekMove[];
}

export interface LoggedSet {
  weightKg: number | null;
  /** Full reps (or seconds/minutes/meters, per the exercise's unit) */
  reps: number | null;
  /** Extra negative-only (eccentric) reps after the full reps: "10+2" = reps 10, negatives 2 */
  negatives?: number | null;
  done: boolean;
  /** When the set was ticked during a live workout (pacing stats) */
  completedAt?: string | null;
  /** How hard it felt, as reps left in the tank: 4 = easy (4+), 2 = good (2–3), 1 = hard, 0 = max. Optional. */
  rir?: number | null;
}

/** The four effort choices shown after a set, as reps in reserve. */
export const EFFORTS = [
  { rir: 4, label: "Easy", hint: "4+ reps left" },
  { rir: 2, label: "Good", hint: "2–3 left" },
  { rir: 1, label: "Hard", hint: "1 left" },
  { rir: 0, label: "Max", hint: "nothing left" },
] as const;
export const effortLabel = (rir: number | null | undefined) => (rir == null ? null : (EFFORTS.find((e) => e.rir <= rir) ?? EFFORTS[3]).label);

/**
 * A "next time" hint from the effort of the done sets, or null when none were rated.
 * Easy everywhere → add load; max early on → hold; otherwise chase a rep.
 */
export function nextTimeHint(sets: Pick<LoggedSet, "done" | "rir">[], unit: RepUnit = "reps"): string | null {
  const rated = sets.filter((s) => s.done && s.rir != null).map((s) => s.rir!);
  if (!rated.length) return null;
  const avg = rated.reduce((a, b) => a + b, 0) / rated.length;
  if (rated.every((r) => r >= 3)) return unit === "reps" ? "Felt easy: add a little weight (2.5 kg) or 2 reps next time." : "Felt easy: go a bit longer next time.";
  if (rated.slice(0, -1).some((r) => r === 0) || avg < 0.75) return "Close to your limit: keep the same weight next time and own it.";
  return unit === "reps" ? "Right effort: same weight, aim for one more rep next time." : "Right effort: repeat it and add a little next time.";
}

/** "20 kg × 10 + 2 neg" style text for one set. */
export const setLabel = (s: Pick<LoggedSet, "weightKg" | "reps" | "negatives">, unit: RepUnit) =>
  `${s.weightKg != null ? `${s.weightKg} kg` : "BW"} × ${s.reps ?? "?"}${unit === "reps" ? "" : ` ${REP_UNITS.find((u) => u.value === unit)?.short ?? unit}`}${s.negatives ? ` + ${s.negatives} neg` : ""}`;

export type Equipment = "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight" | "other";

/** What the kg number means for each kind of equipment. */
export const EQUIPMENT: { value: Equipment; label: string; kgMeans: string }[] = [
  { value: "barbell", label: "Barbell / EZ bar", kgMeans: "total: bar + all plates" },
  { value: "dumbbell", label: "Dumbbell", kgMeans: "one dumbbell" },
  { value: "cable", label: "Cable", kgMeans: "stack setting" },
  { value: "machine", label: "Machine", kgMeans: "stack / plates loaded" },
  { value: "bodyweight", label: "Bodyweight", kgMeans: "added weight (blank = none)" },
  { value: "other", label: "Other", kgMeans: "kg" },
];

export function guessEquipment(name: string): Equipment {
  const n = name.toLowerCase();
  if (/dumbbell|\bdb\b|hammer curl|concentration|lateral raise|incline (dumbbell )?curl|arnold/.test(n)) return "dumbbell";
  if (/cable|pushdown|pulldown|face pull|crossover|pull-through|pallof/.test(n)) return "cable";
  if (/barbell|ez[- ]?bar|\bbar\b|deadlift|squat|bench press|\brow\b|rdl|hip thrust|skull/.test(n)) return "barbell";
  if (/machine|leg press|leg curl|leg extension|smith|pec deck|hack/.test(n)) return "machine";
  if (/push-?up|pull-?up|chin-?up|dip|plank|crunch|dead bug|bird dog|lunge walk|hang/.test(n)) return "bodyweight";
  return "other";
}

/**
 * How many times the logged kg is actually moved per rep:
 * dumbbells are logged per hand (two hands, or one hand per side), each-side work is done twice.
 * (A single dumbbell held in both hands, e.g. goblet squat, is the exception: set equipment to "other".)
 */
export const loadMultiplier = (e: { name: string; equipment?: Equipment; perSide?: boolean }) =>
  (e.equipment ?? guessEquipment(e.name)) === "dumbbell" || e.perSide ? 2 : 1;

/** Total kg × reps for completed rep-based sets (negatives not included). */
export const exerciseVolume = (e: { name: string; unit: RepUnit; equipment?: Equipment; perSide?: boolean; sets: LoggedSet[] }) =>
  e.unit !== "reps" ? 0 : e.sets.filter((s) => s.done).reduce((a, s) => a + (s.weightKg ?? 0) * (s.reps ?? 0), 0) * loadMultiplier(e);

export interface LoggedExercise {
  plannedId: string | null;
  name: string;
  muscle: MuscleGroup;
  unit: RepUnit;
  /** What the kg means (see EQUIPMENT); guessed from the name when missing */
  equipment?: Equipment;
  /** One arm/leg at a time: reps are counted per side */
  perSide?: boolean;
  sets: LoggedSet[];
  /** Per-exercise note (form cues, pain, machine settings…) — shared with Claude */
  notes?: string;
}

export type CardioType = "incline walk" | "cycling" | "running" | "rowing" | "elliptical" | "other";

export const CARDIO_TYPES: CardioType[] = ["incline walk", "cycling", "running", "rowing", "elliptical", "other"];

export interface CardioEntry {
  type: CardioType;
  minutes: number | null;
  speedKmh?: number | null;
  inclinePct?: number | null;
  distanceKm?: number | null;
  /** Machine resistance / level (bikes, ellipticals) */
  level?: number | null;
  notes?: string;
}

/** "Incline walk 15 min @ 3.5 km/h, 12% incline, 0.9 km" */
export const cardioText = (c: CardioEntry) =>
  [
    `${c.type[0].toUpperCase()}${c.type.slice(1)} ${c.minutes ?? "?"} min`,
    c.speedKmh != null && `@ ${c.speedKmh} km/h`,
    c.inclinePct != null && `${c.inclinePct}% incline`,
    c.level != null && `level ${c.level}`,
    c.distanceKm != null && `${c.distanceKm} km`,
  ]
    .filter(Boolean)
    .join(", ")
    .replace(" min, @", " min @") + (c.notes ? ` (${c.notes})` : "");

/**
 * Cardio calories. Walking/running use the ACSM equations (speed + grade);
 * other machines use typical MET values, nudged by resistance level.
 */
export function cardioKcal(c: CardioEntry, kg: number): number {
  const min = c.minutes ?? 0;
  if (!min) return 0;
  const mPerMin = c.speedKmh ? (c.speedKmh * 1000) / 60 : null;
  const grade = (c.inclinePct ?? 0) / 100;
  let vo2: number; // ml/kg/min
  if ((c.type === "incline walk" || c.type === "running") && mPerMin) {
    vo2 = c.type === "running" || c.speedKmh! > 8 ? 0.2 * mPerMin + 0.9 * mPerMin * grade + 3.5 : 0.1 * mPerMin + 1.8 * mPerMin * grade + 3.5;
  } else {
    const met = { "incline walk": 5, cycling: 7, running: 9, rowing: 7, elliptical: 5.5, other: 6 }[c.type];
    const levelBoost = c.level ? Math.min(1.4, Math.max(0.8, 0.8 + c.level * 0.04)) : 1;
    vo2 = met * levelBoost * 3.5;
  }
  return Math.round(((vo2 * kg) / 200) * min);
}

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

export interface FoodEntry {
  meal?: Meal;
  name: string;
  kcal: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
}

export function foodTotals(food: FoodEntry[] = []) {
  const sum = (k: "kcal" | "proteinG" | "carbsG" | "fatG") => Math.round(food.reduce((a, f) => a + (f[k] ?? 0), 0));
  return { kcal: sum("kcal"), proteinG: sum("proteinG"), carbsG: sum("carbsG"), fatG: sum("fatG") };
}

// ── Nutrition ────────────────────────────────────────────────
/** Who can eat a food. "vegan" foods are also veg; "egg" foods suit eggetarians. */
export type FoodDiet = "vegan" | "veg" | "egg" | "non_veg";

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** One food in the database (built-in) or one of the user's own foods. Nutrition is per serving. */
export interface FoodItem extends Macros {
  id: string;
  name: string;
  aliases?: string[];
  category: string;
  /** e.g. "1 katori (150 g)" */
  serving: string;
  /** Grams (or ml) in one serving */
  grams: number;
  fiberG?: number;
  diet: FoodDiet;
  /** The user's own food */
  custom?: boolean;
}

export interface FoodLogEntry extends Macros {
  id: string;
  meal: Meal;
  name: string;
  /** Database or custom food id; null for quick-add */
  foodId: string | null;
  servings: number;
  /** Serving label at the time of logging */
  serving: string | null;
  /** Nutrition of one serving, so changing `servings` rescales the totals */
  per: Macros;
  source: "db" | "custom" | "quick" | "photo" | "import";
  createdAt: string;
}

/** One suggested meal: database foods with servings. */
export interface MealOption {
  items: ({ foodId: string; name: string; serving: string; servings: number } & Macros)[];
  totals: Macros;
  /** e.g. "520 kcal of your 550 · 32 g protein covers it" */
  why: string;
}

/** "What should I eat now": ideas for the next meal from what's left today. */
export interface MealSuggestions {
  meal: Meal;
  budget: { kcal: number; proteinG: number };
  /** Calories for the day are used up: light, high-protein ideas instead */
  full: boolean;
  /** Profile is missing what targets need, so a typical day is assumed */
  assumed: boolean;
  options: MealOption[];
}

/** A day of meals hitting the targets; each meal has a few options to swap between. */
export interface DayMealPlan {
  date: string;
  seed: number;
  targets: Macros;
  assumed: boolean;
  meals: { meal: Meal; budget: { kcal: number; proteinG: number }; options: MealOption[] }[];
}

/** All food and water for one local date. */
export interface FoodLog {
  date: string;
  entries: FoodLogEntry[];
  waterMl: number;
  updatedAt: string;
}

export interface NutritionTargets extends Macros {
  waterMl: number;
  trainingDay: boolean;
  bmr: number;
  /** Average daily burn for the week before the goal adjustment */
  tdee: number;
  /** Bodyweight the targets were worked out from, and where it came from */
  weightKg: number;
  weightSource: "check-in" | "workout log" | "profile";
  /** Plain-language lines explaining the numbers */
  basis: string[];
  /** Correction from your real weight trend (and food logs, when there are enough); null until there's enough data */
  adaptive?: AdaptiveCalories | null;
}

export interface AdaptiveCalories {
  /** Added to the formula's daily average (negative = eat less) */
  deltaKcal: number;
  /** Trend weight change, kg per week */
  rateKgWeek: number;
  /** What the goal aims for, kg per week */
  goalRateKgWeek: number;
  /** "intake": from food logs + weight trend; "trend": weight trend only (half-step nudges) */
  method: "intake" | "trend";
  /** Daily burn estimated from food logs and the weight trend (method "intake") */
  observedTdee: number | null;
  note: string;
}

export interface NutritionDay {
  date: string;
  log: FoodLog;
  totals: Macros;
  /** null when profile details are missing (see `missing`) */
  targets: NutritionTargets | null;
  missing: ("age" | "height" | "weight")[];
  trainingDay: boolean;
}

export interface NutritionWeekDay extends Macros {
  date: string;
  logged: boolean;
  trainingDay: boolean;
  targetKcal: number | null;
  targetProteinG: number | null;
}

/** What the AI read from a food photo: a draft the user edits before anything is saved. */
export interface PhotoLabel extends Macros {
  name: string;
  serving: string;
  grams: number;
  servingsPerPack: number | null;
}
export interface PhotoFood {
  name: string;
  portion: string;
  grams: number | null;
  estimate: Macros;
  matches: FoodItem[];
}
export type PhotoResult =
  | { kind: "label"; label: PhotoLabel; note: string }
  | { kind: "food"; foods: PhotoFood[]; note: string }
  | { kind: "unknown"; note: string };

export interface RecentFood {
  foodId: string | null;
  name: string;
  serving: string | null;
  servings: number;
  meal: Meal;
  per: Macros;
  lastDate: string;
}

export const MEAL_LABELS: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

/** Meal that fits the time of day, for the Add-food default. */
export const mealForNow = (h = new Date().getHours()): Meal => (h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 18 ? "snack" : "dinner");

export const sumMacros = (xs: Macros[]): Macros => {
  const t = xs.reduce((a, x) => ({ kcal: a.kcal + x.kcal, proteinG: a.proteinG + x.proteinG, carbsG: a.carbsG + x.carbsG, fatG: a.fatG + x.fatG }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  return { kcal: Math.round(t.kcal), proteinG: Math.round(t.proteinG), carbsG: Math.round(t.carbsG), fatG: Math.round(t.fatG) };
};

export const scaleMacros =(m: Macros, servings: number): Macros => ({
  kcal: Math.round(m.kcal * servings),
  proteinG: Math.round(m.proteinG * servings * 10) / 10,
  carbsG: Math.round(m.carbsG * servings * 10) / 10,
  fatG: Math.round(m.fatG * servings * 10) / 10,
});

/** ~0.04 kcal per step for a 70 kg person, scaled by bodyweight. */
export const stepsKcal = (steps: number | null | undefined, kg: number) => (steps ? Math.round(steps * 0.04 * (kg / 70)) : 0);

export interface WorkoutSession {
  id: string;
  planId: string;
  date: string; // YYYY-MM-DD
  day: Weekday;
  /**
   * One-day change of workout: which plan day's workout was done instead
   * ("custom" = my own). Undefined or equal to `day` = followed the plan.
   */
  planDay?: Weekday | "custom";
  /** Name for a changed/custom workout, e.g. "Back & biceps" */
  title?: string;
  exercises: LoggedExercise[];
  /** Total session length incl. cardio */
  durationMin?: number | null;
  /** Optional cardio pieces (incline walk, cycling…) */
  cardio?: CardioEntry[];
  /** Total cardio minutes (sum of `cardio` when present) */
  cardioMinutes: number | null;
  sessionRpe: number | null; // 1–10
  bodyweightKg: number | null;
  /** App's MET-based calorie estimate, recomputed on every save */
  kcalApp?: number | null;
  /** Claude's calorie estimate, imported from a check-in reply (wins over kcalApp) */
  kcalClaude?: number | null;
  /** Whole-day tracking (optional) */
  food?: FoodEntry[];
  steps?: number | null;
  waterL?: number | null;
  sleepHours?: number | null;
  notes: string;
  // ── Live workout timer (missing on sessions logged by hand) ──
  /** undefined = completed (older data and hand-logged days) */
  status?: "in_progress" | "completed";
  startedAt?: string | null;
  endedAt?: string | null;
  /** Total paused time, ms */
  pausedMs?: number;
  /** Set while paused */
  pausedAt?: string | null;
  /** When the current rest countdown ends */
  restEndsAt?: string | null;
  /** Short coach note shown on the workout summary */
  coachNote?: { text: string; source: "ai" | "rules"; createdAt: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** Elapsed active time of a live (or finished) session, in ms. */
export function sessionElapsedMs(s: Pick<WorkoutSession, "startedAt" | "endedAt" | "pausedMs" | "pausedAt">, nowMs: number): number {
  if (!s.startedAt) return 0;
  const start = Date.parse(s.startedAt);
  const end = s.endedAt ? Date.parse(s.endedAt) : s.pausedAt ? Date.parse(s.pausedAt) : nowMs;
  return Math.max(0, end - start - (s.pausedMs ?? 0));
}

export const isLive = (s: Pick<WorkoutSession, "status">) => s.status === "in_progress";

export interface Constraint {
  id: string;
  label: string;
  reason: string;
  keywords: string[];
  swaps: string[];
}

export type GoalKey = "fat_loss" | "muscle_gain" | "maintain" | "strength" | "general";
export type EquipmentSetup = "gym" | "home_dumbbells" | "bodyweight";
export type Injury = "knee" | "lower_back" | "shoulder" | "wrist" | "elbow";
export type Diet = "veg" | "eggetarian" | "non_veg" | "vegan";
export type Units = "kg" | "lb";
export type Sex = "male" | "female" | "other";
export type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced";
export type SessionMinutes = 30 | 45 | 60 | 90;

export const GOAL_KEYS: GoalKey[] = ["fat_loss", "muscle_gain", "maintain", "strength", "general"];
export const GOAL_LABELS: Record<GoalKey, string> = {
  fat_loss: "Fat loss",
  muscle_gain: "Muscle gain / weight gain",
  maintain: "Maintain weight",
  strength: "Get stronger",
  general: "General fitness",
};
export const EQUIPMENT_SETUPS: EquipmentSetup[] = ["gym", "home_dumbbells", "bodyweight"];
export const INJURIES: Injury[] = ["knee", "lower_back", "shoulder", "wrist", "elbow"];
export const DIETS: Diet[] = ["veg", "eggetarian", "non_veg", "vegan"];
export const EXPERIENCE_LEVELS: ExperienceLevel[] = ["Beginner", "Intermediate", "Advanced"];
export const SESSION_MINUTES: SessionMinutes[] = [30, 45, 60, 90];

/** Steps 1–2 (account, basics) are done at signup; the flow runs 3–8. */
export interface OnboardingState {
  step: number;
  completedAt: string | null;
  skippedAt: string | null;
  /**
   * "Redo setup" after finishing: new answers are kept here, not on the profile, and only replace
   * the old ones when the redo is completed. Skipping throws them away and the old setup stays.
   */
  redo?: { step: number; answers: Partial<Profile> } | null;
}

export interface Profile {
  name: string;
  /** Human-readable goal; set from GOAL_LABELS[goalKey] when onboarding completes */
  goal: string;
  experience: string;
  startBodyweightKg: number | null;
  targetBodyweightKg: number | null;
  constraints: Constraint[];
  /** Link to the user's claude.ai Project used for no-API coaching */
  claudeProjectUrl?: string;
  // ── Onboarding answers (all optional: older profiles don't have them) ──
  age?: number | null;
  sex?: Sex | null;
  heightCm?: number | null;
  /** Display unit only; weights are always stored in kg */
  units?: Units;
  goalKey?: GoalKey | null;
  daysPerWeek?: number | null;
  sessionMinutes?: SessionMinutes | null;
  equipmentSetup?: EquipmentSetup | null;
  injuries?: Injury[];
  diet?: Diet | null;
  /** Missing on accounts created before onboarding existed */
  onboarding?: OnboardingState;
  // ── Display and workout preferences ──
  heightUnit?: "cm" | "in";
  /** Default rest between sets, seconds */
  restDefaults?: { compound: number; isolation: number };
  /** Rest per exercise name (lower-case), seconds */
  restOverrides?: Record<string, number>;
  timerSound?: boolean;
  timerVibrate?: boolean;
  keepAwake?: boolean;
}

export const DEFAULT_REST = { compound: 90, isolation: 60 };

export type Scale5 = 1 | 2 | 3 | 4 | 5;

export interface Readiness {
  score: number; // 0–100
  band: "push" | "normal" | "light";
  label: string;
  advice: string;
}

export interface Checkin {
  /** The user's local date, YYYY-MM-DD */
  date: string;
  weightKg: number | null;
  mood: Scale5 | null;
  sleep: "poor" | "ok" | "good" | null;
  /** 1 = fresh, 5 = very sore */
  soreness?: Scale5 | null;
  /** 1 = drained, 5 = full of energy */
  energy?: Scale5 | null;
  /** 1 = calm, 5 = very stressed */
  stress?: Scale5 | null;
  readiness?: Readiness | null;
  updatedAt: string;
}

// ── Exercise library ─────────────────────────────────────────
export interface ExerciseInfo {
  slug: string;
  name: string;
  /** Movement pattern, or "other" for the user's own exercises */
  pattern: string;
  muscle: MuscleGroup;
  secondary: string[];
  equipment: EquipmentSetup[];
  stresses: Injury[];
  level: "beginner" | "intermediate" | "advanced" | null;
  unit: RepUnit;
  steps: string[];
  cues: string[];
  mistakes: string[];
  restSec: number;
  /** Image path under the client's /public */
  image: string;
  youtubeUrl: string;
  /** false = only in the user's plans/logs, not in the built-in library */
  builtIn: boolean;
  inPlan?: boolean;
  lastDone?: string | null;
}

export const exerciseSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export interface PersonalRecord {
  exercise: string;
  date: string;
  kind: "weight" | "e1rm" | "reps";
  value: number;
  /** "60 kg × 8" */
  detail: string;
  previous: number | null;
}

export interface ExerciseComparison {
  name: string;
  bestSet: string | null;
  prevBestSet: string | null;
  volume: number;
  prevVolume: number | null;
  trend: "up" | "same" | "down" | "new";
  /** From per-set effort, when rated */
  nextTime?: string | null;
}

export interface WorkoutSummary {
  session: WorkoutSession;
  title: string;
  durationMin: number | null;
  setsDone: number;
  setsPlanned: number;
  volumeKg: number;
  kcal: number | null;
  prs: PersonalRecord[];
  exercises: ExerciseComparison[];
  /** From set tick times; null when the session wasn't timed */
  workingMin: number | null;
  restMin: number | null;
  ruleNote: string;
}

export interface TodayData {
  date: string;
  weekday: Weekday;
  plan: { id: string; name: string } | null;
  planDay: PlanDay | null;
  session: WorkoutSession | null;
  /** Name of what was (or is being) trained today, e.g. "Upper body" */
  sessionTitle: string | null;
  live: WorkoutSession | null;
  liveTitle: string | null;
  checkin: Checkin | null;
  streak: number;
  tip: string | null;
  estMinutes: number;
  /** Workouts this week (Mon–Sun) against the weekly goal */
  weekGoal: WeekGoal;
  /** Set when today's workout is a missed day moved here by a reshuffle */
  movedFrom?: Weekday | null;
}

export interface WeekGoal {
  done: number;
  /** Plan training days, else the profile's days per week, else 3 */
  goal: number;
  /** Days left this week, counting today if nothing is logged yet */
  daysLeft: number;
  days: { date: string; done: boolean; planned: boolean }[];
  /** Missed workouts that a reshuffle could still fit in (not yet moved) */
  toReshuffle?: number;
}

export interface ProgressData {
  range: number;
  bodyweight: { date: string; kg: number }[];
  exercises: { name: string; slug: string; points: { date: string; e1rm: number; best: string }[] }[];
  prs: PersonalRecord[];
  calendar: { date: string; rpe: number | null; durationMin: number | null; title: string }[];
  totals: { sessions: number; minutes: number; volumeKg: number; thisMonth: number; lastMonth: number };
}

// ── Coach actions (proposed in chat, applied on tap) ─────────
export type CoachAction =
  | { type: "swap_exercise"; from: string; to: string; day?: Weekday; reason?: string }
  | { type: "change_sets_reps"; exercise: string; sets?: number; repMin?: number; repMax?: number; day?: Weekday; reason?: string }
  | { type: "move_workout"; from: Weekday; to: Weekday; reason?: string }
  | { type: "set_rest"; exercise: string; seconds: number; reason?: string }
  | { type: "start_workout"; day?: Weekday | "custom"; reason?: string }
  | { type: "add_note"; text: string; exercise?: string; reason?: string };

/** Which Apply buttons an action offers. */
export const actionScopes = (a: CoachAction): ("today" | "plan")[] =>
  a.type === "swap_exercise" || a.type === "change_sets_reps" ? ["today", "plan"] : a.type === "move_workout" ? ["plan"] : ["today"];

export function describeAction(a: CoachAction): string {
  switch (a.type) {
    case "swap_exercise":
      return `Swap ${a.from} → ${a.to}${a.day ? ` (${a.day})` : ""}`;
    case "change_sets_reps":
      return `${a.exercise}: ${a.sets ? `${a.sets} sets` : ""}${a.sets && a.repMin ? " × " : ""}${a.repMin ? `${a.repMin}${a.repMax && a.repMax !== a.repMin ? `–${a.repMax}` : ""} reps` : ""}${a.day ? ` (${a.day})` : ""}`;
    case "move_workout":
      return `Swap ${a.from}'s and ${a.to}'s workouts`;
    case "set_rest":
      return `Rest ${a.seconds}s between sets of ${a.exercise}`;
    case "start_workout":
      return a.day === "custom" ? "Start an empty workout" : `Start ${a.day ? `${a.day}'s` : "today's"} workout`;
    case "add_note":
      return `Add note${a.exercise ? ` to ${a.exercise}` : ""}: "${a.text}"`;
  }
}

export interface AppliedAction {
  id: string;
  action: CoachAction;
  scope: "today" | "plan";
  summary: string;
  createdAt: string;
  undoneAt: string | null;
}

export interface ConstraintFlag {
  exercise: string;
  day?: Weekday;
  constraint: string;
  reason: string;
  swaps: string[];
}

export interface SubScore {
  key: string;
  label: string;
  score: number; // 0–100
  detail: string;
}

export interface ExerciseProgress {
  name: string;
  muscle: MuscleGroup;
  bestE1rm: number | null;
  prevBestE1rm: number | null;
  totalReps: number;
  prevTotalReps: number | null;
  trend: "up" | "flat" | "down" | "new";
  hitTopOfRange: boolean;
  suggestion: string;
}

export interface WeekMetrics {
  weekStart: string;
  weekEnd: string;
  plannedSessions: number;
  completedSessions: number;
  completedDays: Weekday[];
  plannedSets: number;
  completedSets: number;
  inRangeSetPct: number;
  setsByMuscle: Record<string, number>;
  plannedSetsByMuscle: Record<string, number>;
  avgRpe: number | null;
  cardioMinutes: number;
  kcal: number;
  kcalEaten: number;
  steps: number;
  bodyweightKg: number | null;
  exercises: ExerciseProgress[];
  subScores: SubScore[];
  baseScore: number;
}

/** Weekly numbers shown on the score card. The app pre-computes them; Claude confirms/corrects and adds targets. */
export interface WeekStats {
  workouts?: number;
  kcalBurned?: number;
  kcalEaten?: number | null;
  /** eaten − burned − steps kcal (negative = deficit); null when food wasn't logged */
  kcalNet?: number | null;
  avgProteinG?: number | null;
  avgSteps?: number | null;
  avgSleepH?: number | null;
  avgWaterL?: number | null;
  cardioMin?: number;
  volumeKg?: number;
  bodyweightChangeKg?: number | null;
  /** Claude's suggestions for next week */
  kcalTargetPerDay?: number | null;
  proteinTargetG?: number | null;
  stepsTarget?: number | null;
}

export const STAT_LABELS: { key: keyof WeekStats; label: string; unit?: string; target?: keyof WeekStats; perDay?: boolean }[] = [
  { key: "workouts", label: "Workouts" },
  { key: "kcalBurned", label: "Calories burned", unit: "kcal" },
  { key: "kcalEaten", label: "Calories eaten", unit: "kcal" },
  { key: "kcalNet", label: "Net calories", unit: "kcal" },
  { key: "avgProteinG", label: "Protein / day", unit: "g", target: "proteinTargetG" },
  { key: "avgSteps", label: "Steps / day", target: "stepsTarget" },
  { key: "avgSleepH", label: "Sleep / night", unit: "h" },
  { key: "avgWaterL", label: "Water / day", unit: "L" },
  { key: "cardioMin", label: "Cardio", unit: "min" },
  { key: "volumeKg", label: "Volume lifted", unit: "kg" },
  { key: "bodyweightChangeKg", label: "Bodyweight change", unit: "kg" },
];

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

/** The app's own weekly stats from what was logged (averages only over days that logged that item). */
export function computeWeekStats(sessions: WorkoutSession[], fallbackKg: number | null, prevBodyweight?: number | null): WeekStats {
  const kg = [...sessions].reverse().find((s) => s.bodyweightKg)?.bodyweightKg ?? fallbackKg ?? 75;
  const burned = sessions.reduce((a, s) => a + (sessionKcal(s) ?? estimateKcal(s, fallbackKg) ?? 0), 0);
  const stepsBurn = sessions.reduce((a, s) => a + stepsKcal(s.steps, kg), 0);
  const foodDays = sessions.filter((s) => s.food?.length);
  const eaten = foodDays.length ? foodDays.reduce((a, s) => a + foodTotals(s.food).kcal, 0) : null;
  // Net only over the days that logged food, so a missing day doesn't look like a huge deficit.
  const net =
    eaten == null
      ? null
      : eaten - foodDays.reduce((a, s) => a + (sessionKcal(s) ?? estimateKcal(s, fallbackKg) ?? 0) + stepsKcal(s.steps, kg), 0);
  const bws = sessions.filter((s) => s.bodyweightKg).map((s) => s.bodyweightKg!);
  const bwStart = prevBodyweight ?? bws[0] ?? null;
  return {
    workouts: sessions.filter((s) => s.exercises.some((e) => e.sets.some((x) => x.done))).length,
    kcalBurned: Math.round(burned + stepsBurn),
    kcalEaten: eaten,
    kcalNet: net == null ? null : Math.round(net),
    avgProteinG: foodDays.length ? Math.round(avg(foodDays.map((s) => foodTotals(s.food).proteinG))!) : null,
    avgSteps: (() => {
      const a = avg(sessions.map((s) => s.steps));
      return a == null ? null : Math.round(a);
    })(),
    avgSleepH: r1(avg(sessions.map((s) => s.sleepHours))),
    avgWaterL: r1(avg(sessions.map((s) => s.waterL))),
    cardioMin: Math.round(sessions.reduce((a, s) => a + (s.cardioMinutes ?? 0), 0)),
    volumeKg: Math.round(sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + exerciseVolume(e), 0), 0)),
    bodyweightChangeKg: bwStart != null && bws.length ? r1(bws[bws.length - 1] - bwStart) : null,
  };
}

export interface ScoreReport {
  id: string;
  kind: "plan" | "week";
  planId: string;
  weekStart?: string;
  createdAt: string;
  overall: number;
  grade: string;
  summary: string;
  subScores: SubScore[];
  strengths: string[];
  issues: string[];
  recommendations: string[];
  constraintFlags: ConstraintFlag[];
  nextWeekAdjustments: string[];
  /** "ai" = scored by the user's own AI provider; "claude" kept for reports made before multi-provider support */
  source: "ai" | "claude" | "offline" | "project";
  /** Which provider/model produced an "ai" report, e.g. "OpenAI · gpt-5" */
  aiLabel?: string;
  metrics?: WeekMetrics;
  /** Weekly stats for the score card (Claude's numbers when it returned them) */
  stats?: WeekStats;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** What the user was looking at when they asked (from the coach dock) */
  page?: string | null;
}

/** Where a chat message was sent from, e.g. { page: "exercise", detail: "Goblet squat" }. */
export interface PageContext {
  page: string;
  detail?: string;
}

export interface ApiStatus {
  /** True when the signed-in user has saved an AI API key */
  aiConnected: boolean;
  provider: AiProviderId | null;
  model: string | null;
  /** e.g. "Anthropic · claude-sonnet-5-5" */
  label: string | null;
}

// ── Auth ─────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  /** Echo this in the X-CSRF-Token header on every non-GET request */
  csrfToken: string;
  /** When true and the user isn't verified, the app is locked until they click the email link */
  emailVerificationRequired: boolean;
}

// ── Per-user AI provider (bring your own key) ────────────────
export type AiProviderId = "anthropic" | "openai" | "gemini" | "groq" | "mistral" | "openrouter" | "custom";

export interface AiProviderPreset {
  id: AiProviderId;
  label: string;
  /** "anthropic" uses the Anthropic Messages API; everything else speaks the OpenAI Chat Completions format */
  api: "anthropic" | "openai";
  baseUrl: string;
  defaultModel: string;
  keyUrl: string;
}

export const AI_PROVIDERS: AiProviderPreset[] = [
  { id: "anthropic", label: "Anthropic (Claude)", api: "anthropic", baseUrl: "https://api.anthropic.com", defaultModel: "claude-sonnet-5-5", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "openai", label: "OpenAI", api: "openai", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-5", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "gemini", label: "Google Gemini", api: "openai", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.5-flash", keyUrl: "https://aistudio.google.com/apikey" },
  { id: "groq", label: "Groq", api: "openai", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", keyUrl: "https://console.groq.com/keys" },
  { id: "mistral", label: "Mistral", api: "openai", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-large-latest", keyUrl: "https://console.mistral.ai/api-keys" },
  { id: "openrouter", label: "OpenRouter", api: "openai", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-5", keyUrl: "https://openrouter.ai/keys" },
  { id: "custom", label: "Custom (OpenAI-compatible)", api: "openai", baseUrl: "", defaultModel: "", keyUrl: "" },
];

/** What the API returns about a saved key: never the key itself. */
export interface AiSettings {
  configured: boolean;
  provider: AiProviderId | null;
  model: string | null;
  baseUrl: string | null;
  /** Last 4 characters of the key, for recognition */
  keyHint: string | null;
  updatedAt: string | null;
}

// ── Calories ─────────────────────────────────────────────────
/** Calories to show for a session: Claude's number if imported, else the app estimate. */
export const sessionKcal = (s: Pick<WorkoutSession, "kcalApp" | "kcalClaude">) => s.kcalClaude ?? s.kcalApp ?? null;

/**
 * MET-based estimate (kcal = MET × kg × hours). Strength MET scales with RPE;
 * without a logged duration, assumes ~2.5 min per completed set (work + rest).
 */
export function estimateKcal(
  s: Pick<WorkoutSession, "durationMin" | "cardioMinutes" | "sessionRpe" | "bodyweightKg" | "cardio"> & { exercises: { sets: LoggedSet[] }[] },
  fallbackKg: number | null,
): number | null {
  const kg = s.bodyweightKg ?? fallbackKg ?? 75;
  const sets = s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const entries = s.cardio ?? [];
  const cardioMin = entries.length ? entries.reduce((a, c) => a + (c.minutes ?? 0), 0) : (s.cardioMinutes ?? 0);
  const strengthMin = s.durationMin ? Math.max(0, s.durationMin - cardioMin) : sets * 2.5;
  if (!strengthMin && !cardioMin) return null;
  const rpe = s.sessionRpe ?? 7;
  const strengthMet = rpe <= 5 ? 3.5 : rpe <= 7 ? 5 : 6;
  const cardio = entries.length ? entries.reduce((a, c) => a + cardioKcal(c, kg), 0) : 7 * kg * (cardioMin / 60);
  return Math.round(strengthMet * kg * (strengthMin / 60) + cardio);
}

/** Display name of what was actually trained that day. */
export function workoutTitle(s: Pick<WorkoutSession, "day" | "planDay" | "title">, plan: WorkoutPlan | null): string | undefined {
  if (s.title) return s.title;
  if (s.planDay === "custom") return "Custom workout";
  return plan?.days.find((d) => d.day === (s.planDay ?? s.day))?.title;
}

export function gradeFor(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

/** Monday of the week containing the given YYYY-MM-DD date. */
export function weekStartOf(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Bodyweight trend ─────────────────────────────────────────
/**
 * Trend weight: an exponential moving average that moves ~10% of the way to each day's weigh-in
 * (gaps count as several days), so water and food swings don't hide the real direction.
 * Input must be sorted by date. Returns one smoothed value per point.
 */
export function trendWeights(points: { date: string; kg: number }[], dailyPull = 0.1): number[] {
  const out: number[] = [];
  let prev: { date: string; t: number } | null = null;
  for (const p of points) {
    if (!prev) prev = { date: p.date, t: p.kg };
    else {
      const days = Math.max(1, Math.round((Date.parse(p.date) - Date.parse(prev.date)) / 86_400_000));
      const a = 1 - Math.pow(1 - dailyPull, days);
      prev = { date: p.date, t: prev.t + a * (p.kg - prev.t) };
    }
    out.push(Math.round(prev.t * 100) / 100);
  }
  return out;
}

/**
 * Weekly rate of change (kg/week, negative = losing): a least-squares line through the raw weigh-ins
 * of the last `days`. The fit averages out daily noise without the lag a moving average has early on.
 * Null with fewer than `minPoints` weigh-ins spanning 10+ days.
 */
export function weeklyWeightRate(points: { date: string; kg: number }[], days = 28, minPoints = 5): number | null {
  if (!points.length) return null;
  const last = points.at(-1)!.date;
  const from = addDays(last, -days);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of points) {
    if (p.date >= from) {
      xs.push(Date.parse(p.date) / 86_400_000);
      ys.push(p.kg);
    }
  }
  if (xs.length < minPoints || xs.at(-1)! - xs[0] < 10) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return den ? Math.round((num / den) * 7 * 100) / 100 : null;
}

export function weekdayOf(date: string): Weekday {
  const d = new Date(date + "T00:00:00Z");
  return WEEKDAYS[(d.getUTCDay() + 6) % 7];
}

/** Movement-aware swap suggestions for a constraint conflict. */
export function swapsFor(exercise: string, c: Constraint): string[] {
  const n = exercise.toLowerCase();
  const hinge = ["Trap bar deadlift", "Cable pull-through", "Hip thrust"];
  const core = ["Dead bug", "Pallof press", "Side plank", "Bird dog"];
  if (/deadlift|rdl|good morning/.test(n)) return c.swaps.filter((s) => hinge.includes(s)).length ? c.swaps.filter((s) => hinge.includes(s)) : c.swaps;
  if (/crunch|sit|wheel|rollout/.test(n)) return c.swaps.filter((s) => core.includes(s)).length ? c.swaps.filter((s) => core.includes(s)) : c.swaps;
  return c.swaps;
}
