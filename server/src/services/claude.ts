import Anthropic from "@anthropic-ai/sdk";
import {
  EQUIPMENT,
  STAT_LABELS,
  WEEKDAYS,
  addDays,
  cardioText,
  foodTotals,
  guessEquipment,
  type WeekStats,
  gradeFor,
  sessionKcal,
  unitShort,
  type ChatMessage,
  type LoggedExercise,
  type ConstraintFlag,
  type Profile,
  type ScoreReport,
  type SubScore,
  type WeekMetrics,
  type WorkoutPlan,
  type WorkoutSession,
} from "@workout/shared";
import { claudeEnabled, config } from "../config.js";

/** Every completed set: "S1 60 kg × 10 reps, S2 60 kg × 9 reps + 2 negative-only reps (2 of 3 planned sets done)". */
export const setText = (e: LoggedExercise) => {
  const done = e.sets.filter((x) => x.done);
  if (!done.length) return "no sets done";
  const sets = done
    .map((x, i) => `S${i + 1} ${x.weightKg != null ? `${x.weightKg} kg` : "bodyweight"} × ${x.reps ?? "?"} ${unitShort(e.unit)}${x.negatives ? ` + ${x.negatives} negative-only reps` : ""}`)
    .join(", ");
  return done.length < e.sets.length ? `${sets} (${done.length} of ${e.sets.length} sets done)` : sets;
};

/** Tells Claude what the kg means, e.g. " (dumbbell: kg = one dumbbell, reps per side)". */
const loadText = (e: LoggedExercise) => {
  const eq = e.equipment ?? guessEquipment(e.name);
  const info = EQUIPMENT.find((x) => x.value === eq);
  return eq === "other" && !e.perSide ? "" : ` (${info?.label.toLowerCase()}: kg = ${info?.kgMeans}${e.perSide ? ", one side at a time, reps per side" : ""})`;
};

const plannedTarget = (plan: WorkoutPlan | null | undefined, e: LoggedExercise) => {
  const p = plan?.days.flatMap((d) => d.exercises).find((x) => x.id === e.plannedId);
  return p ? ` [plan: ${p.sets} × ${p.repMin}${p.repMax !== p.repMin ? `–${p.repMax}` : ""} ${unitShort(p.unit)}${p.perSide ? " each side" : ""}]` : " [not in plan]";
};

// ─────────────────────────────────────────────────────────────
// Claude API slot. Set ANTHROPIC_API_KEY in server/.env to enable.
// ─────────────────────────────────────────────────────────────
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: config.anthropicApiKey }));

const COACH_SYSTEM = `You are an evidence-based strength & conditioning coach inside a workout-tracking app.
Be specific and numbers-driven (sets, reps, kg, %). Prefer short tables and bullet lists.
Use only constraints explicitly listed in the athlete's Profile. If the Profile says there are none, do not infer injuries, restrictions, or other constraints. When a listed constraint conflicts with an exercise, name it and give a safer swap.
Fat loss comes from an overall calorie deficit — never promise spot reduction.
You are not a doctor: for pain or injury, advise seeing a qualified professional.`;

type Verdict = Pick<
  ScoreReport,
  "overall" | "summary" | "strengths" | "issues" | "recommendations" | "nextWeekAdjustments"
> & {
  subScoreNotes?: { key: string; score: number; detail: string }[];
  constraintFlags?: ConstraintFlag[];
  calories?: { date: string; kcal: number }[];
  stats?: WeekStats;
};

const SCORE_TOOL: Anthropic.Tool = {
  name: "submit_score",
  description: "Return the structured score report.",
  input_schema: {
    type: "object",
    properties: {
      overall: { type: "integer", minimum: 0, maximum: 100, description: "Final 0–100 score. Stay within ±10 of the base score unless clearly justified." },
      summary: { type: "string", description: "2–3 sentence verdict." },
      subScoreNotes: {
        type: "array",
        description: "Optional adjusted sub-scores with one-line reasons, using the provided keys.",
        items: {
          type: "object",
          properties: { key: { type: "string" }, score: { type: "integer" }, detail: { type: "string" } },
          required: ["key", "score", "detail"],
        },
      },
      strengths: { type: "array", items: { type: "string" } },
      issues: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
      nextWeekAdjustments: { type: "array", items: { type: "string" }, description: "Concrete changes: exercise, sets × reps, load change." },
      constraintFlags: {
        type: "array",
        items: {
          type: "object",
          properties: {
            exercise: { type: "string" },
            constraint: { type: "string" },
            reason: { type: "string" },
            swaps: { type: "array", items: { type: "string" } },
          },
          required: ["exercise", "constraint", "reason", "swaps"],
        },
      },
      stats: {
        type: "object",
        description:
          "Week scoring only: weekly numbers for the score card. Confirm or correct the app's values; add targets for next week. Leave out anything not logged.",
        properties: {
          workouts: { type: "integer" },
          kcalBurned: { type: "integer", description: "Total for the week incl. steps" },
          kcalEaten: { type: "integer", description: "Total eaten on days food was logged" },
          kcalNet: { type: "integer", description: "Eaten minus burned on food-logged days; negative = deficit" },
          avgProteinG: { type: "integer" },
          avgSteps: { type: "integer" },
          avgSleepH: { type: "number" },
          avgWaterL: { type: "number" },
          cardioMin: { type: "integer" },
          volumeKg: { type: "integer" },
          bodyweightChangeKg: { type: "number" },
          kcalTargetPerDay: { type: "integer" },
          proteinTargetG: { type: "integer" },
          stepsTarget: { type: "integer" },
        },
      },
      calories: {
        type: "array",
        description: "Week scoring only: estimated kcal burned for each logged day (bodyweight, exercises, duration, RPE, cardio).",
        items: {
          type: "object",
          properties: { date: { type: "string", description: "YYYY-MM-DD" }, kcal: { type: "integer" } },
          required: ["date", "kcal"],
        },
      },
    },
    required: ["overall", "summary", "strengths", "issues", "recommendations", "nextWeekAdjustments"],
  },
};

async function askForScore(prompt: string): Promise<Verdict> {
  const res = await getClient().messages.create({
    model: config.model,
    max_tokens: 3000,
    system: COACH_SYSTEM,
    tools: [SCORE_TOOL],
    tool_choice: { type: "tool", name: SCORE_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Claude returned no score");
  return block.input as Verdict;
}

export function mergeSubScores(base: SubScore[], notes?: Verdict["subScoreNotes"]): SubScore[] {
  return base.map((s) => {
    const n = notes?.find((x) => x.key === s.key);
    return n ? { ...s, score: Math.max(0, Math.min(100, n.score)), detail: n.detail } : s;
  });
}

export const planOutline = (plan: WorkoutPlan) =>
  plan.days
    .map((d) =>
      d.isRest
        ? `${d.day}: ${d.title} (recovery)`
        : `${d.day}: ${d.title}\n` +
          d.exercises.map((e) => `  - ${e.name}: ${e.sets} × ${e.repMin}${e.repMax !== e.repMin ? "–" + e.repMax : ""}${e.unit === "reps" ? "" : unitShort(e.unit)}${e.perSide ? " each" : ""} [${e.muscle}]`).join("\n"),
    )
    .join("\n");

export function unloggedPlanDays(plan: WorkoutPlan, weekStart: string, through: string, sessions: WorkoutSession[]) {
  const loggedDates = new Set(
    sessions.filter((s) => s.exercises.some((e) => e.sets.some((set) => set.done))).map((s) => s.date),
  );
  return plan.days
    .filter((d) => !d.isRest)
    .map((d) => ({ day: d.day, date: addDays(weekStart, WEEKDAYS.indexOf(d.day)) }))
    .filter(({ date }) => date <= through && !loggedDates.has(date))
    .map(({ day, date }) => `${day} (${date})`);
}

/** Profile as text. Constraints come ONLY from the profile; with none, say so plainly. */
export const profileText = (p: Profile) => {
  const constraints = p.constraints.filter((c) => c.label.trim());
  return (
    [
      p.name && `Athlete: ${p.name}`,
      p.goal && `Goal: ${p.goal}`,
      p.experience && `Experience: ${p.experience}`,
      (p.startBodyweightKg || p.targetBodyweightKg) && `Bodyweight start/target: ${p.startBodyweightKg ?? "?"} / ${p.targetBodyweightKg ?? "?"} kg`,
    ]
      .filter(Boolean)
      .join(" | ") +
    "\n" +
    (constraints.length
      ? `Constraints (from my profile, the only ones that apply):\n${constraints
          .map((c) => `- ${c.label}${c.reason ? `: ${c.reason}` : ""}${c.keywords.length ? ` (avoid: ${c.keywords.join(", ")})` : ""}${c.swaps.length ? ` (swaps: ${c.swaps.join(", ")})` : ""}`)
          .join("\n")}`
      : "Constraints: none listed in my Profile. Do not infer any.")
  );
};

const flagsText = (flags: ConstraintFlag[]) =>
  flags.length ? flags.map((f) => `- ${f.exercise}${f.day ? ` (${f.day})` : ""} conflicts with "${f.constraint}"; safer: ${f.swaps.slice(0, 2).join(" or ")}`).join("\n") : "none";

/** App metrics as readable lines (never raw JSON). */
export const weekMetricsText = (m: WeekMetrics) =>
  [
    `- Sessions: ${m.completedSessions}/${m.plannedSessions} planned training days so far`,
    `- Working sets: ${m.completedSets}/${m.plannedSets}; inside target rep range: ${m.inRangeSetPct}%`,
    m.avgRpe != null && `- Average session RPE: ${m.avgRpe}`,
    m.cardioMinutes > 0 && `- Cardio: ${m.cardioMinutes} min`,
    `- Sets per muscle (done / planned): ${Object.keys({ ...m.plannedSetsByMuscle, ...m.setsByMuscle })
      .map((k) => `${k} ${m.setsByMuscle[k] ?? 0}/${m.plannedSetsByMuscle[k] ?? 0}`)
      .join(", ")}`,
    `- Base score: ${m.baseScore}/100`,
    ...m.subScores.map((s) => `  - ${s.label} (${s.key}): ${s.score} (${s.detail})`),
  ]
    .filter(Boolean)
    .join("\n");

/** Weekly stats as readable lines; items that weren't logged are left out. */
export const statsText = (s: WeekStats) =>
  STAT_LABELS.filter(({ key }) => s[key] != null && !(key === "cardioMin" && !s[key]))
    .map(({ key, label, unit }) => `- ${label}: ${(s[key] as number).toLocaleString()}${unit ? ` ${unit}` : ""}`)
    .join("\n") || "- nothing beyond workouts logged";

export interface ScoreInput {
  base: number;
  subScores: SubScore[];
  flags: ConstraintFlag[];
}

export async function scorePlan(plan: WorkoutPlan, profile: Profile, input: ScoreInput & { setsByMuscle: Record<string, number> }) {
  if (!claudeEnabled()) return offlineVerdict("plan", input);
  const v = await askForScore(
    `Score this weekly training PLAN for the athlete's goal.\n\n${profileText(profile)}\n\nPLAN:\n${planOutline(plan)}\n\n` +
      `App-computed metrics:\n- Base score: ${input.base}/100\n${input.subScores.map((s) => `- ${s.label} (${s.key}): ${s.score} (${s.detail})`).join("\n")}\n` +
      `- Weekly sets per muscle: ${Object.entries(input.setsByMuscle).map(([k, v]) => `${k} ${v}`).join(", ")}\n` +
      `- Constraint conflicts found by the app:\n${flagsText(input.flags)}\n\n` +
      `Evaluate fit for MY goal as written above, plus volume, frequency, recovery, exercise selection and safety. ` +
      `Return the report via submit_score. nextWeekAdjustments = concrete plan edits.`,
  );
  return finalize(v, input, "claude");
}

export async function scoreWeek(
  plan: WorkoutPlan,
  profile: Profile,
  metrics: WeekMetrics,
  sessions: WorkoutSession[],
  flags: ConstraintFlag[],
  prevSessions: WorkoutSession[] = [],
  stats?: WeekStats,
) {
  const input = { base: metrics.baseScore, subScores: metrics.subScores, flags };
  if (!claudeEnabled()) return offlineVerdict("week", input, metrics, stats);
  const log =
    sessions.map((s) => sessionText(s, plan)).join("\n") +
    `\n\nLAST WEEK'S SESSIONS (for your own comparison):\n${prevSessions.map((s) => sessionText(s, plan)).join("\n") || "(nothing logged)"}`;
  const unlogged = unloggedPlanDays(plan, metrics.weekStart, metrics.weekEnd, sessions);
  const v = await askForScore(
    `Score this athlete's TRAINING WEEK from ${metrics.weekStart} through ${metrics.weekEnd} against their plan. This is a partial-week check-in: use only the logged sessions through ${metrics.weekEnd}; don't assume later days have happened.\n\n${profileText(profile)}\n\nPLAN:\n${planOutline(plan)}\n\n` +
      `LOGGED SESSIONS:\n${log || "(nothing logged)"}\n\nApp-computed metrics (ground truth, do not contradict the numbers):\n${weekMetricsText(metrics)}\n\n` +
      `Weekly stats the app computed from my logs:\n${statsText(stats ?? {})}\n\n` +
      `${unlogged.length ? `Planned training days with no completed workout logged through ${metrics.weekEnd}: ${unlogged.join(", ")}\n\n` : ""}` +
      `Constraint conflicts in the log:\n${flagsText(flags)}\n\nGive the final score, what went well, what to fix, and exact next-week adjustments (load/rep targets per lift). ` +
      `Read the athlete's notes carefully (pain, sleep, energy). Estimate calories burned for each logged day, and fill "stats": confirm or correct the app's weekly numbers ` +
      `and add next-week targets for calories per day, protein per day and steps per day that fit the goal. Return via submit_score.`,
  );
  return finalize(v, input, "claude", metrics, stats);
}

function finalize(v: Verdict, input: ScoreInput, source: "claude" | "offline", metrics?: WeekMetrics, appStats?: WeekStats) {
  // Claude's numbers win where it gave them; the app's fill the gaps.
  const stats = appStats || v.stats ? { ...(appStats ?? {}), ...cleanStats(v.stats) } : undefined;
  const overall = Math.max(0, Math.min(100, Math.round(v.overall)));
  return {
    overall,
    grade: gradeFor(overall),
    summary: v.summary,
    subScores: mergeSubScores(input.subScores, v.subScoreNotes),
    strengths: v.strengths ?? [],
    issues: v.issues ?? [],
    recommendations: v.recommendations ?? [],
    nextWeekAdjustments: v.nextWeekAdjustments ?? [],
    constraintFlags: v.constraintFlags?.length ? v.constraintFlags : input.flags,
    source,
    metrics,
    stats,
    calories: v.calories ?? [],
  };
}

const STAT_KEYS = [...STAT_LABELS.map((s) => s.key), "kcalTargetPerDay", "proteinTargetG", "stepsTarget"] as (keyof WeekStats)[];

/** Keep only known numeric stat keys from Claude's reply. */
export function cleanStats(raw: unknown): WeekStats {
  const out: WeekStats = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of STAT_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    const n = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : v;
    if (typeof n === "number" && Number.isFinite(n)) (out as Record<string, number>)[k] = n;
  }
  return out;
}

/** One logged session in full detail: every set, plan target, duration, calories and notes. */
const changeText = (s: WorkoutSession, plan?: WorkoutPlan | null) => {
  if (!s.planDay && !s.title) return "";
  const planned = plan?.days.find((d) => d.day === s.day)?.title ?? "plan";
  const did = s.planDay === "custom" ? "my own custom workout" : s.planDay ? `${s.planDay}'s "${plan?.days.find((d) => d.day === s.planDay)?.title ?? ""}"` : "the planned workout";
  return ` [CHANGED FOR TODAY ONLY: did ${did}${s.title ? ` named "${s.title}"` : ""} instead of ${s.day}'s "${planned}"]`;
};

/**
 * One saved day, exactly as finally logged: only fields that were filled in, only exercises with
 * completed sets (planned-but-skipped ones are listed by name on one line).
 */
export const sessionText = (s: WorkoutSession, plan?: WorkoutPlan | null) => {
  const done = s.exercises.filter((e) => e.sets.some((x) => x.done));
  const skipped = s.exercises.filter((e) => !e.sets.some((x) => x.done) && e.plannedId);
  const header = [
    s.durationMin && `${s.durationMin} min`,
    s.sessionRpe && `RPE ${s.sessionRpe}`,
    s.bodyweightKg && `bodyweight ${s.bodyweightKg} kg`,
    sessionKcal(s) && `~${sessionKcal(s)} kcal burned${s.kcalClaude ? " (your earlier estimate)" : " (app estimate)"}`,
  ].filter(Boolean);
  return (
    `${s.date} ${s.day}${changeText(s, plan)}${header.length ? `: ${header.join(", ")}` : ""}` +
    (s.notes ? `\n  Session notes: ${s.notes}` : "") +
    (s.cardio ?? []).map((c) => `\n  - Cardio: ${cardioText(c)}`).join("") +
    done.map((e) => `\n  - ${e.name}${plannedTarget(plan, e)}${loadText(e)}: ${setText(e)}${e.notes ? `\n      Exercise note: ${e.notes}` : ""}`).join("") +
    (skipped.length ? `\n  - Not done from the plan: ${skipped.map((e) => e.name).join(", ")}` : "") +
    dayText(s)
  );
};

/** Food, steps, water and sleep for the day (only what was logged). */
const dayText = (s: WorkoutSession) => {
  const lines: string[] = [];
  if (s.food?.length) {
    const t = foodTotals(s.food);
    lines.push(`  Food: ${t.kcal} kcal eaten, ${t.proteinG} g protein, ${t.carbsG} g carbs, ${t.fatG} g fat`);
    for (const f of s.food) lines.push(`    - ${f.meal ? `${f.meal}: ` : ""}${f.name} (${f.kcal ?? "?"} kcal${f.proteinG != null ? `, ${f.proteinG} g protein` : ""})`);
  }
  const extras = [s.steps != null && `${s.steps.toLocaleString()} steps`, s.waterL != null && `${s.waterL} L water`, s.sleepHours != null && `${s.sleepHours} h sleep`].filter(Boolean);
  if (extras.length) lines.push(`  Day: ${extras.join(", ")}`);
  return lines.length ? `\n${lines.join("\n")}` : "";
};

function offlineVerdict(kind: "plan" | "week", input: ScoreInput, metrics?: WeekMetrics, stats?: WeekStats) {
  const low = [...input.subScores].sort((a, b) => a.score - b.score);
  const high = [...input.subScores].sort((a, b) => b.score - a.score);
  const adjustments =
    kind === "week" && metrics
      ? metrics.exercises.filter((e) => e.hitTopOfRange || e.trend === "down").map((e) => `${e.name}: ${e.suggestion}`)
      : input.flags.map((f) => `Replace ${f.exercise}${f.day ? ` (${f.day})` : ""} with ${f.swaps[0]}`);
  return finalize(
    {
      overall: input.base,
      summary: `Offline score computed by the app (add ANTHROPIC_API_KEY for Claude's coaching analysis). Weakest area: ${low[0]?.label ?? "n/a"}.`,
      strengths: high.slice(0, 2).map((s) => `${s.label}: ${s.score}/100 — ${s.detail}`),
      issues: low.slice(0, 2).map((s) => `${s.label}: ${s.score}/100 — ${s.detail}`),
      recommendations: input.flags.map((f) => `${f.exercise} conflicts with "${f.constraint}" → try ${f.swaps.slice(0, 2).join(" or ")}`),
      nextWeekAdjustments: adjustments,
    },
    input,
    "offline",
    metrics,
    stats,
  );
}

// ── Chat ─────────────────────────────────────────────────────
export async function streamChat(
  history: ChatMessage[],
  context: string,
  onText: (t: string) => void,
): Promise<string> {
  if (!claudeEnabled()) {
    const msg = "Claude isn't connected yet. Add your key to `ANTHROPIC_API_KEY` in `server/.env` and restart the server — scoring still works offline in the meantime.";
    onText(msg);
    return msg;
  }
  const stream = getClient().messages.stream({
    model: config.model,
    max_tokens: 2000,
    system: `${COACH_SYSTEM}\n\nCURRENT ATHLETE CONTEXT (from the app's database):\n${context}`,
    messages: history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
  });
  stream.on("text", onText);
  const final = await stream.finalMessage();
  return final.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

export function buildChatContext(profile: Profile, plan: WorkoutPlan | null, scores: ScoreReport[], sessions: WorkoutSession[]) {
  const recent = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return [
    profileText(profile),
    plan ? `ACTIVE PLAN "${plan.name}":\n${planOutline(plan)}` : "No active plan.",
    scores.length
      ? `RECENT SCORES:\n${scores.slice(-4).map((s) => `- ${s.kind}${s.weekStart ? " " + s.weekStart : ""}: ${s.overall}/100 (${s.grade}) — ${s.summary}`).join("\n")}`
      : "No scores yet.",
    recent.length
      ? `RECENT SESSIONS (full detail):\n${recent.map((s) => sessionText(s, plan)).join("\n")}`
      : "No sessions logged.",
  ].join("\n\n");
}
