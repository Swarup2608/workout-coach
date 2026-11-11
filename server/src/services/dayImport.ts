import { z } from "zod";
import {
  CARDIO_TYPES,
  MEALS,
  WEEKDAYS,
  unitShort,
  weekdayOf,
  type CardioType,
  type Equipment,
  type Meal,
  type RepUnit,
  type Weekday,
  type WorkoutPlan,
  type WorkoutSession,
} from "../domain.js";

/**
 * "Quick add with AI": the user pastes our prompt + their day in plain words into any AI,
 * gets back one JSON block, and pastes it here. We merge it into that date's log.
 */

// ── Prompt ───────────────────────────────────────────────────
export function dayPrompt(plan: WorkoutPlan | null, date: string): string {
  const planList = plan
    ? plan.days
        .map((d) =>
          d.isRest
            ? `- ${d.day}: rest`
            : `- ${d.day} (${d.title}): ${d.exercises
                .map((e) => `${e.alternatives.length > 1 ? e.alternatives.join(" / ") : e.name} ${e.sets}×${e.repMin}${e.repMax !== e.repMin ? `–${e.repMax}` : ""}${e.unit === "reps" ? "" : unitShort(e.unit)}`)
                .join("; ")}`,
        )
        .join("\n")
    : "(no plan uploaded)";

  return `You are a data-entry assistant for my workout tracker. I'll describe my day in plain words below. Convert it into ONE JSON code block in exactly the format shown, and nothing else after it.

Today is ${date} (${weekdayOf(date)}). If I say "yesterday" or name another day, set "date" to that date (YYYY-MM-DD).

My weekly plan (use these exact exercise names when I mean one of them):
${planList}

Rules:
- Only include what I actually mention. Leave anything I don't mention out entirely (don't invent sets, food or steps).
- One set = one object. "3 sets of 12 at 20kg" = three { "kg": 20, "reps": 12 } objects. "kg": null = bodyweight.
- Negative (eccentric-only) reps go in "negatives", separate from full reps. "10+2", "10 + 2 negatives" or "10 reps then 2 negs" = { "reps": 10, "negatives": 2 }. Leave "negatives" out if none.
- Timed sets (plank, wall sit, dead hang, "held 45s", "1 min") use "unit": "seconds" (or "minutes") and put the time in "reps", e.g. a 45 s plank = { "kg": null, "reps": 45 } with "unit": "seconds". A weighted plank keeps its "kg".
- If I give lbs, convert to kg (1 lb = 0.4536 kg), rounded to 0.5.
- Weight ("kg") and "equipment" (one of: barbell, dumbbell, cable, machine, bodyweight, other):
  - barbell / EZ bar: "kg" = TOTAL = bar + all plates on both sides. "20 kg bar + 10 each side" = 40. "EZ bar with 5s" = 10 + 5 + 5 = 20. If I don't give the bar weight, assume Olympic bar 20 kg, EZ bar 10 kg, and say you assumed it in the exercise "notes".
  - dumbbell: "kg" = ONE dumbbell, even when I use two ("12.5s" or "12.5 kg dumbbells" = 12.5).
  - cable: "kg" = the stack setting I mention.
  - machine: "kg" = stack setting or total plates loaded.
  - bodyweight (push-ups, pull-ups, dips, planks): "kg": null, or only the ADDED weight (belt, vest, plate).
- "perSide": true when I do one arm/leg at a time (single-arm cable, one-arm dumbbell row, alternating curls, "each side", "each arm", lunges per leg). Then "reps" = reps per side. Otherwise leave it out.
- "unit" is one of: ${["reps", "seconds", "minutes", "meters"].join(", ")}.
- "workout.basedOn": "plan" if I followed ${weekdayOf(date)}'s plan; a weekday name (${WEEKDAYS.join(", ")}) if I did that day's workout instead; "custom" if I made up my own. Give it a short "title" when not "plan".
- Cardio "type" is one of: ${CARDIO_TYPES.join(", ")}. Treadmill walking on an incline = "incline walk".
- Food: one item per food/drink with your best calorie and macro estimate for the portion I describe (assume a typical portion if I don't say). "meal" is one of: ${MEALS.join(", ")}.
- "rpe" = how hard the session felt, 1–10, only if I say something about effort.
- Put anything else useful (pain, mood, sleep quality, form cues) in "notes" or the exercise's "notes".

\`\`\`json
{
  "starkfitiqDay": {
    "date": "${date}",
    "workout": { "basedOn": "plan", "title": "" },
    "exercises": [
      { "name": "EZ-bar curls", "equipment": "barbell", "unit": "reps", "sets": [{ "kg": 20, "reps": 12 }, { "kg": 20, "reps": 10, "negatives": 2 }], "notes": "EZ bar 10 kg + 5 kg each side" },
      { "name": "Single-arm cable pushdown", "equipment": "cable", "perSide": true, "unit": "reps", "sets": [{ "kg": 15, "reps": 12 }], "notes": "" },
      { "name": "Hammer curls", "equipment": "dumbbell", "unit": "reps", "sets": [{ "kg": 12.5, "reps": 10 }], "notes": "" },
      { "name": "Plank", "equipment": "bodyweight", "unit": "seconds", "sets": [{ "kg": null, "reps": 45 }], "notes": "" }
    ],
    "cardio": [
      { "type": "incline walk", "minutes": 15, "speedKmh": 3.5, "inclinePct": 12, "distanceKm": null, "level": null }
    ],
    "durationMin": 75,
    "rpe": 7,
    "bodyweightKg": null,
    "food": [
      { "meal": "breakfast", "name": "3 boiled eggs + 2 slices brown bread", "kcal": 390, "proteinG": 24, "carbsG": 30, "fatG": 16 }
    ],
    "steps": 8500,
    "waterL": 2.5,
    "sleepHours": 7,
    "notes": ""
  }
}
\`\`\`

My day:
`;
}

// ── Parse (forgiving: AIs vary in how they format numbers and enums) ──
const num = z.preprocess((v) => (v === "" || v === undefined ? null : typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : v), z.number().finite().nullable());
const opt = num.optional().default(null);

const unit = z.preprocess((v) => {
  const s = String(v ?? "reps").toLowerCase();
  if (/^s|sec/.test(s)) return "seconds";
  if (/^min/.test(s)) return "minutes";
  if (/^m$|met/.test(s)) return "meters";
  return "reps";
}, z.enum(["reps", "seconds", "minutes", "meters"]));

const cardioType = z.preprocess((v) => {
  const s = String(v ?? "").toLowerCase();
  if (/incline|walk|treadmill/.test(s)) return "incline walk";
  if (/cycl|bike|spin/.test(s)) return "cycling";
  if (/run|jog/.test(s)) return "running";
  if (/row/.test(s)) return "rowing";
  if (/ellip|cross/.test(s)) return "elliptical";
  return "other";
}, z.enum(CARDIO_TYPES as [CardioType, ...CardioType[]]));

const equipment = z.preprocess((v) => {
  const s = String(v ?? "").toLowerCase();
  if (/bar|ez/.test(s)) return "barbell";
  if (/dumb|db/.test(s)) return "dumbbell";
  if (/cable|pulley/.test(s)) return "cable";
  if (/mach|smith|press/.test(s)) return "machine";
  if (/body|bw|none/.test(s)) return "bodyweight";
  return "other";
}, z.enum(["barbell", "dumbbell", "cable", "machine", "bodyweight", "other"]));

const meal = z.preprocess((v) => {
  const s = String(v ?? "").toLowerCase();
  return MEALS.find((m) => s.includes(m)) ?? (s ? "snack" : undefined);
}, z.enum(MEALS as [Meal, ...Meal[]]).optional());

const DaySchema = z.object({
  date: z.string().optional(),
  workout: z.object({ basedOn: z.string().default("plan"), title: z.string().default("") }).optional(),
  exercises: z
    .array(
      z.object({
        name: z.string().min(1),
        unit: unit.default("reps"),
        equipment: equipment.optional(),
        perSide: z.preprocess((v) => v === true || v === "true" || v === "yes", z.boolean()).optional(),
        sets: z.array(z.object({ kg: opt, reps: opt, negatives: opt })).default([]),
        notes: z.string().default(""),
      }),
    )
    .optional(),
  cardio: z
    .array(z.object({ type: cardioType, minutes: opt, speedKmh: opt, inclinePct: opt, distanceKm: opt, level: opt, notes: z.string().default("") }))
    .optional(),
  durationMin: num.optional(),
  rpe: num.optional(),
  bodyweightKg: num.optional(),
  food: z.array(z.object({ meal, name: z.string().min(1), kcal: opt, proteinG: opt, carbsG: opt, fatG: opt })).optional(),
  steps: num.optional(),
  waterL: num.optional(),
  sleepHours: num.optional(),
  notes: z.string().optional(),
});
export type DayImport = z.infer<typeof DaySchema>;

export function parseDay(text: string): DayImport {
  const candidates: string[] = [];
  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) candidates.push(m[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  let lastError = "";
  for (const c of candidates.reverse()) {
    try {
      const obj = JSON.parse(c.trim());
      const parsed = DaySchema.safeParse(obj.starkfitiqDay ?? obj.repscoreDay ?? obj);
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; ");
    } catch {
      /* try next */
    }
  }
  throw new Error(
    lastError
      ? `The JSON was found but some fields look wrong (${lastError}). Ask the AI to fix them, or edit the JSON and paste again.`
      : "Couldn't find the JSON block. Paste the AI's whole reply, including the ```json part.",
  );
}

// ── Merge into the day's log ─────────────────────────────────
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const sameExercise = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return x === y || (x.length > 4 && y.length > 4 && (x.includes(y) || y.includes(x)));
};

/**
 * Only the parts present in the import change: exercises are matched by name and get their
 * sets replaced (others are kept), cardio/food lists are replaced, numbers overwrite.
 */
export function mergeDay(day: DayImport, date: string, existing: WorkoutSession | null, plan: WorkoutPlan | null) {
  const weekday = weekdayOf(date);
  const basedOn = day.workout?.basedOn ?? "plan";
  const changedTo: Weekday | "custom" | undefined =
    basedOn === "custom" ? "custom" : (WEEKDAYS.find((w) => w.toLowerCase() === basedOn.toLowerCase()) as Weekday | undefined);
  const planDay = day.workout ? (changedTo && changedTo !== weekday ? changedTo : undefined) : existing?.planDay;
  const allPlanned = plan?.days.flatMap((d) => d.exercises) ?? [];

  // Starting exercise list: what's already logged, else the (possibly changed) plan day with empty sets.
  type Ex = { plannedId: string | null; name: string; unit: RepUnit; equipment?: Equipment; perSide?: boolean; sets: { weightKg: number | null; reps: number | null; negatives?: number | null; done: boolean }[]; notes: string };
  const templateDay = planDay === "custom" ? null : (planDay ?? weekday);
  const changedWorkout = day.workout && planDay !== existing?.planDay;
  let exercises: Ex[] =
    existing && !changedWorkout
      ? existing.exercises.map((e) => ({ plannedId: e.plannedId, name: e.name, unit: e.unit, equipment: e.equipment, perSide: e.perSide, sets: e.sets, notes: e.notes ?? "" }))
      : (plan?.days.find((d) => d.day === templateDay)?.exercises ?? []).map((p) => ({
          plannedId: p.id,
          name: p.alternatives[0] ?? p.name,
          unit: p.unit,
          perSide: p.perSide,
          sets: Array.from({ length: p.sets }, () => ({ weightKg: null, reps: null, done: false })),
          notes: "",
        }));

  let matched = 0;
  let added = 0;
  for (const ie of day.exercises ?? []) {
    const sets = ie.sets.map((s) => ({ weightKg: s.kg, reps: s.reps, negatives: s.negatives || null, done: true }));
    const planned = allPlanned.find((p) => [p.name, ...p.alternatives].some((n) => sameExercise(n, ie.name)));
    const hit = exercises.find((e) => sameExercise(e.name, ie.name) || (planned && e.plannedId === planned.id));
    if (hit) {
      hit.sets = sets;
      hit.unit = ie.unit;
      if (ie.equipment) hit.equipment = ie.equipment;
      if (ie.perSide !== undefined) hit.perSide = ie.perSide;
      if (ie.notes) hit.notes = ie.notes;
      if (planned?.alternatives.some((a) => sameExercise(a, ie.name))) hit.name = planned.alternatives.find((a) => sameExercise(a, ie.name))!;
      matched++;
    } else {
      exercises.push({ plannedId: planned?.id ?? null, name: ie.name, unit: ie.unit, equipment: ie.equipment, perSide: ie.perSide ?? planned?.perSide, sets, notes: ie.notes });
      added++;
    }
  }
  if (planDay === "custom") exercises = exercises.filter((e) => e.sets.some((s) => s.done) || !e.plannedId);

  const keep = <T>(v: T | null | undefined, old: T | null | undefined) => (v !== undefined && v !== null ? v : (old ?? null));

  const body = {
    date,
    planDay,
    title: day.workout?.title || existing?.title || "",
    exercises,
    durationMin: keep(day.durationMin, existing?.durationMin),
    cardio: day.cardio ?? existing?.cardio ?? [],
    cardioMinutes: null,
    sessionRpe: (() => {
      const r = keep(day.rpe, existing?.sessionRpe);
      return r == null ? null : Math.min(10, Math.max(1, Math.round(r)));
    })(),
    bodyweightKg: keep(day.bodyweightKg, existing?.bodyweightKg),
    food: (day.food ?? existing?.food ?? []).map((f) => ({ ...f, kcal: f.kcal ?? null })),
    steps: (() => {
      const s = keep(day.steps, existing?.steps);
      return s == null ? null : Math.round(s);
    })(),
    waterL: keep(day.waterL, existing?.waterL),
    sleepHours: keep(day.sleepHours, existing?.sleepHours),
    notes: [existing?.notes, day.notes].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join("\n"),
  };

  const parts = [
    matched + added ? `${matched + added} exercise${matched + added === 1 ? "" : "s"}${added ? ` (${added} new)` : ""}` : "",
    day.cardio?.length ? `${day.cardio.length} cardio` : "",
    day.food?.length ? `${day.food.length} food item${day.food.length === 1 ? "" : "s"}` : "",
    day.steps != null ? `${Math.round(day.steps).toLocaleString()} steps` : "",
    day.waterL != null ? `${day.waterL} L water` : "",
    day.sleepHours != null ? `${day.sleepHours} h sleep` : "",
  ].filter(Boolean);
  return { body, summary: parts.length ? parts.join(", ") : "nothing new found in the JSON" };
}
