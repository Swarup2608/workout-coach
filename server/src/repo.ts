import type { ChatMessage, Profile, ScoreReport, WorkoutPlan, WorkoutSession } from "./domain.js";
import { col } from "./db.js";

/** Never leak Mongo internals or the owner id to clients. */
const hide = { projection: { _id: 0, userId: 0 } } as const;

const emptyProfile = (): Profile => ({
  name: "",
  goal: "",
  experience: "Intermediate",
  startBodyweightKg: null,
  targetBodyweightKg: null,
  constraints: [],
});

/**
 * All training data access, always scoped to one user. Every query filters by userId,
 * so one account can never read or change another's data.
 */
export function userRepo(userId: string) {
  const own = { userId };

  return {
    // ── Profile ──
    async profile(): Promise<Profile> {
      const doc = await col.profiles().findOne({ _id: userId });
      if (!doc) return emptyProfile();
      const { _id, ...p } = doc;
      return p;
    },
    saveProfile: (p: Profile) => col.profiles().replaceOne({ _id: userId }, p, { upsert: true }),

    // ── Plans ──
    plans: () => col.plans().find(own, hide).sort({ createdAt: 1 }).toArray() as Promise<WorkoutPlan[]>,
    activePlan: () => col.plans().findOne({ ...own, active: true }, hide) as Promise<WorkoutPlan | null>,
    plan: (id: string) => col.plans().findOne({ ...own, id }, hide) as Promise<WorkoutPlan | null>,
    async addPlan(plan: WorkoutPlan) {
      await col.plans().updateMany(own, { $set: { active: false } });
      await col.plans().insertOne({ ...plan, active: true, userId });
    },
    replacePlan: (plan: WorkoutPlan) => col.plans().replaceOne({ ...own, id: plan.id }, { ...plan, userId }),
    async activatePlan(id: string) {
      if (!(await col.plans().countDocuments({ ...own, id }))) return false;
      await col.plans().updateMany(own, [{ $set: { active: { $eq: ["$id", id] } } }]);
      return true;
    },
    async deletePlan(id: string) {
      await col.plans().deleteOne({ ...own, id });
      if (!(await col.plans().countDocuments({ ...own, active: true }))) {
        const latest = await col.plans().find(own).sort({ createdAt: -1 }).limit(1).next();
        if (latest) await col.plans().updateOne({ _id: latest._id }, { $set: { active: true } });
      }
    },

    // ── Sessions ──
    sessions: () => col.sessions().find(own, hide).sort({ date: 1 }).toArray() as Promise<WorkoutSession[]>,
    sessionByDate: (date: string) => col.sessions().findOne({ ...own, date }, hide) as Promise<WorkoutSession | null>,
    upsertSession: (s: WorkoutSession) => col.sessions().replaceOne({ ...own, date: s.date }, { ...s, userId }, { upsert: true }),
    deleteSession: (id: string) => col.sessions().deleteOne({ ...own, id }),
    /** Stores the AI's per-day calorie estimates on matching logged days within [from, to]. */
    async setAiCalories(from: string, to: string, calories?: { date: string; kcal: number }[]) {
      const ops = (calories ?? [])
        .filter((c) => c.date >= from && c.date <= to && Number.isFinite(c.kcal) && c.kcal > 0)
        .map((c) => ({ updateOne: { filter: { ...own, date: c.date }, update: { $set: { kcalClaude: Math.round(c.kcal) } } } }));
      if (ops.length) await col.sessions().bulkWrite(ops);
    },

    // ── Scores ──
    scores: (kind?: "plan" | "week") =>
      col.scores().find(kind ? { ...own, kind } : own, hide).sort({ createdAt: 1 }).toArray() as Promise<ScoreReport[]>,
    async addScore(report: ScoreReport) {
      // One week score per week: a re-score replaces the earlier one.
      if (report.kind === "week") await col.scores().deleteMany({ ...own, kind: "week", weekStart: report.weekStart });
      await col.scores().insertOne({ ...report, userId });
    },
    deletePlanScores: (planId: string) => col.scores().deleteMany({ ...own, kind: "plan", planId }),

    // ── Chat ──
    chat: () => col.chat().find(own, hide).sort({ createdAt: 1 }).toArray() as Promise<ChatMessage[]>,
    addChat: (m: ChatMessage) => col.chat().insertOne({ ...m, userId }),
    clearChat: () => col.chat().deleteMany(own),
  };
}

export type UserRepo = ReturnType<typeof userRepo>;

/** Removes every piece of a user's training data (account deletion). */
export async function deleteAllUserData(userId: string) {
  await Promise.all([
    col.profiles().deleteOne({ _id: userId }),
    col.plans().deleteMany({ userId }),
    col.sessions().deleteMany({ userId }),
    col.scores().deleteMany({ userId }),
    col.chat().deleteMany({ userId }),
    col.refreshTokens().deleteMany({ userId }),
    col.emailTokens().deleteMany({ userId }),
  ]);
}
