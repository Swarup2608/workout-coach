import { z } from "zod";
import {
  gradeFor,
  type ConstraintFlag,
  type Profile,
  type ScoreReport,
  type SubScore,
  type WeekMetrics,
  type WeekStats,
  type WorkoutPlan,
  type WorkoutSession,
} from "../domain.js";
import { cleanStats, mergeSubScores, planOutline, profileText, sessionText, statsText, unloggedPlanDays, weekMetricsText } from "./claude.js";

/**
 * No-API mode: build a plain-text "check-in" the user pastes into their claude.ai Project,
 * then parse the score block Claude replies with. All data is sent as readable text from
 * the final saved logs; the only JSON is the reply template the app needs to import the score.
 */

const hasConstraints = (p: Profile) => p.constraints.some((c) => c.label.trim());

const replyFormat = (kind: "plan" | "week", keys: SubScore[], base: number, profile: Profile, stats?: WeekStats) => {
  const statsBlock =
    kind === "week"
      ? `,
    "stats": {
      "workouts": ${stats?.workouts ?? 0},
      "kcalBurned": ${stats?.kcalBurned ?? 0},
      "kcalEaten": ${stats?.kcalEaten ?? null},
      "kcalNet": ${stats?.kcalNet ?? null},
      "avgProteinG": ${stats?.avgProteinG ?? null},
      "avgSteps": ${stats?.avgSteps ?? null},
      "avgSleepH": ${stats?.avgSleepH ?? null},
      "avgWaterL": ${stats?.avgWaterL ?? null},
      "cardioMin": ${stats?.cardioMin ?? 0},
      "volumeKg": ${stats?.volumeKg ?? 0},
      "bodyweightChangeKg": ${stats?.bodyweightChangeKg ?? null},
      "kcalTargetPerDay": 0,
      "proteinTargetG": 0,
      "stepsTarget": 0
    },
    "calories": [{ "date": "YYYY-MM-DD", "kcal": 0 }]`
      : "";

  return `## How to reply

Coach me in plain words first. Then **end your reply with exactly one fenced \`json\` block** in this shape, so my tracker app can import your score:

\`\`\`json
{
  "starkfitiq": {
    "kind": "${kind}",
    "overall": 0,
    "summary": "2–3 sentence verdict",
    "subScores": [${keys.map((k) => `\n      { "key": "${k.key}", "score": 0, "detail": "one line" }`).join(",")}
    ],
    "strengths": ["..."],
    "issues": ["..."],
    "recommendations": ["..."],
    "nextWeekAdjustments": ["exercise: sets × reps @ load change"],
    "constraintFlags": []${statsBlock}
  }
}
\`\`\`
${
  kind === "week"
    ? `
- "stats" is pre-filled with the app's weekly numbers. Correct any that look wrong (e.g. calories burned), keep null for things I didn't log, and set "kcalTargetPerDay", "proteinTargetG" and "stepsTarget" to what you recommend for next week for my goal.
- "calories": your estimate of kcal burned for **each logged day** (bodyweight, exercises, sets, duration, RPE, cardio).
`
    : ""
}
Rules: scores are integers 0–100. Keep "overall" within ±10 of the app's base score (${base}) unless you clearly justify it in the summary. ${
    hasConstraints(profile)
      ? `Respect only the constraints listed in my profile above; put any conflicts in "constraintFlags".`
      : `I have no constraints, so leave "constraintFlags" empty and don't assume injuries.`
  } Never promise spot fat reduction.`;
};

const sessionLines = (sessions: WorkoutSession[], plan: WorkoutPlan) => sessions.map((s) => `### ${sessionText(s, plan)}`).join("\n\n");

const flagLine = (flags: ConstraintFlag[]) => (flags.length ? flags.map((f) => `${f.exercise}${f.day ? ` on ${f.day}` : ""} (${f.constraint})`).join("; ") : "none");

export function weekPack(
  plan: WorkoutPlan,
  profile: Profile,
  metrics: WeekMetrics,
  sessions: WorkoutSession[],
  flags: ConstraintFlag[],
  prevSessions: WorkoutSession[] = [],
  stats?: WeekStats,
) {
  const unlogged = unloggedPlanDays(plan, metrics.weekStart, metrics.weekEnd, sessions);
  return `# StarkFitIQ weekly check-in: ${metrics.weekStart} through ${metrics.weekEnd}

Please score my training week against my plan using only the logged information through ${metrics.weekEnd}. This may be a partial week; don't assume later days have happened.

## Me
${profileText(profile)}

## My plan (${plan.name})
${planOutline(plan)}

## What I logged through ${metrics.weekEnd}
${sessionLines(sessions, plan) || "_Nothing logged yet._"}
${unlogged.length ? `\nPlanned training days with no completed workout logged through ${metrics.weekEnd}: ${unlogged.join(", ")}.` : ""}

## Last week, for comparison
${sessionLines(prevSessions, plan) || "_Nothing logged last week._"}

## App metrics (ground truth, don't contradict these numbers)
${weekMetricsText(metrics)}

## Weekly stats from my logs
${statsText(stats ?? {})}
${hasConstraints(profile) ? `\nConstraint conflicts the app found: ${flagLine(flags)}\n` : ""}
${replyFormat("week", metrics.subScores, metrics.baseScore, profile, stats)}
`;
}

export function planPack(plan: WorkoutPlan, profile: Profile, m: { subScores: SubScore[]; baseScore: number; setsByMuscle: Record<string, number>; flags: ConstraintFlag[] }) {
  return `# StarkFitIQ plan review: ${plan.name}

Please score this weekly training plan for my goal and suggest concrete edits.

## Me
${profileText(profile)}

## Plan
${planOutline(plan)}

## App metrics
- Base score: ${m.baseScore}/100
${m.subScores.map((s) => `- ${s.label} (${s.key}): ${s.score} (${s.detail})`).join("\n")}
- Weekly sets per muscle: ${Object.entries(m.setsByMuscle).map(([k, v]) => `${k} ${v}`).join(", ")}
${hasConstraints(profile) ? `- Constraint conflicts: ${flagLine(m.flags)}\n` : ""}
${replyFormat("plan", m.subScores, m.baseScore, profile)}
`;
}

// ── Import ───────────────────────────────────────────────────
const ReplySchema = z.object({
  kind: z.enum(["plan", "week"]).optional(),
  overall: z.coerce.number().min(0).max(100),
  summary: z.string().default(""),
  subScores: z.array(z.object({ key: z.string(), score: z.coerce.number(), detail: z.string().default("") })).default([]),
  strengths: z.array(z.string()).default([]),
  issues: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  nextWeekAdjustments: z.array(z.string()).default([]),
  constraintFlags: z
    .array(z.object({ exercise: z.string(), constraint: z.string().default(""), reason: z.string().default(""), swaps: z.array(z.string()).default([]) }))
    .default([]),
  calories: z.array(z.object({ date: z.string(), kcal: z.coerce.number() })).default([]),
  stats: z.unknown().optional(),
});

/** Finds the score block in a pasted Claude reply (fenced json preferred, bare object as fallback). */
export function parseReply(text: string) {
  const candidates: string[] = [];
  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) candidates.push(m[1]);
  // "repscore" = replies made before the StarkFitIQ rename; still accepted.
  const at = Math.max(text.lastIndexOf('{"starkfitiq"'), text.lastIndexOf('{"repscore"'));
  const brace = at >= 0 ? text.slice(at) : null;
  if (brace) candidates.push(brace);
  if (!candidates.length) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  }
  for (const c of candidates.reverse()) {
    try {
      const obj = JSON.parse(c.trim());
      const parsed = ReplySchema.safeParse(obj.starkfitiq ?? obj.repscore ?? obj);
      if (parsed.success) return parsed.data;
    } catch {
      /* try next */
    }
  }
  throw new Error("Couldn't find the score block. Paste Claude's whole reply, including the ```json block at the end.");
}

export function reportFromReply(
  reply: ReturnType<typeof parseReply>,
  base: SubScore[],
  flags: ConstraintFlag[],
  appStats?: WeekStats,
): Omit<ScoreReport, "id" | "kind" | "planId" | "createdAt" | "weekStart"> {
  const overall = Math.round(reply.overall);
  const claudeStats = cleanStats(reply.stats);
  // A 0 target in the template means Claude didn't fill it in.
  for (const k of ["kcalTargetPerDay", "proteinTargetG", "stepsTarget"] as const) if (!claudeStats[k]) delete claudeStats[k];
  return {
    overall,
    grade: gradeFor(overall),
    summary: reply.summary,
    subScores: mergeSubScores(base, reply.subScores),
    strengths: reply.strengths,
    issues: reply.issues,
    recommendations: reply.recommendations,
    nextWeekAdjustments: reply.nextWeekAdjustments,
    constraintFlags: reply.constraintFlags.length ? reply.constraintFlags : flags,
    source: "project",
    stats: appStats || reply.stats ? { ...(appStats ?? {}), ...claudeStats } : undefined,
  };
}
