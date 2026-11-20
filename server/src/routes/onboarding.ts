import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { EXPERIENCE_LEVELS, GOAL_LABELS, type ExperienceLevel, type OnboardingState, type Profile } from "../domain.js";
import { userRepo } from "../repo.js";
import { newId, now } from "../util/id.js";
import { buildStarterPlan, injuryConstraints } from "../services/starterPlan.js";
import { answerFields } from "./profileSchema.js";

/** PATCH /profile/onboarding — mounted on the authenticated `api` router (auth, CSRF, rate limits apply). */
export const onboarding = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const Answers = z.object(answerFields).partial().strict();

const Body = z.union([
  z.object({ step: z.number().int().min(3).max(8), answers: Answers }).strict(),
  z.object({ complete: z.literal(true) }).strict(),
  z.object({ skip: z.literal(true) }).strict(),
  z.object({ restart: z.literal(true) }).strict(),
]);

const REQUIRED = ["goalKey", "experience", "daysPerWeek", "sessionMinutes", "equipmentSetup"] as const;
const FRESH: OnboardingState = { step: 2, completedAt: null, skippedAt: null };

onboarding.patch("/profile/onboarding", wrap(async (req, res) => {
  const body = Body.parse(req.body);
  const repo = userRepo(req.user!._id);
  const profile: Profile = await repo.profile();
  const state: OnboardingState = profile.onboarding ?? { ...FRESH };

  if ("answers" in body) {
    // During a redo the answers go into the draft; the finished setup stays untouched until completion.
    const next: Profile = state.redo
      ? { ...profile, onboarding: { ...state, redo: { step: Math.max(state.redo.step, body.step), answers: { ...state.redo.answers, ...body.answers } } } }
      : { ...profile, ...body.answers, onboarding: { ...state, step: Math.max(state.step, body.step) } };
    await repo.saveProfile(next);
    return res.json({ profile: next });
  }

  if ("skip" in body) {
    // Skipping a redo discards it: the previous setup and plan stay exactly as they were.
    const next: Profile = state.redo ? { ...profile, onboarding: { ...state, redo: null } } : { ...profile, onboarding: { ...state, skippedAt: now() } };
    await repo.saveProfile(next);
    return res.json({ profile: next });
  }

  if ("restart" in body) {
    // Redo after finishing opens a draft (old answers kept until it completes);
    // "Finish setup" after a skip resumes where they left off.
    const reset: OnboardingState = state.completedAt
      ? { ...state, redo: state.redo ?? { step: 2, answers: {} } }
      : !profile.onboarding
        ? { ...FRESH }
        : { ...state, skippedAt: null };
    const next: Profile = { ...profile, onboarding: reset };
    await repo.saveProfile(next);
    return res.json({ profile: next });
  }

  // Completing: a redo's answers are applied now, on top of the old ones.
  const merged: Profile = state.redo ? { ...profile, ...state.redo.answers } : profile;
  const missing = REQUIRED.filter((k) => (k === "experience" ? !EXPERIENCE_LEVELS.includes(merged.experience as ExperienceLevel) : merged[k] == null));
  if (missing.length) return res.status(422).json({ error: "Answer the remaining setup questions first", missing });

  const injuries = merged.injuries ?? [];
  const starter = buildStarterPlan({
    goalKey: merged.goalKey!,
    experience: merged.experience as ExperienceLevel,
    daysPerWeek: merged.daysPerWeek!,
    sessionMinutes: merged.sessionMinutes!,
    equipmentSetup: merged.equipmentSetup!,
    injuries,
  });
  const plan = { id: newId(), createdAt: now(), active: true, ...starter };
  await repo.addPlan(plan);

  const next: Profile = {
    ...merged,
    goal: GOAL_LABELS[merged.goalKey!],
    constraints: [...merged.constraints.filter((c) => !c.id.startsWith("injury-")), ...injuryConstraints(injuries)],
    onboarding: { step: 8, completedAt: now(), skippedAt: null, redo: null },
  };
  await repo.saveProfile(next);
  res.json({ profile: next, plan });
}));
