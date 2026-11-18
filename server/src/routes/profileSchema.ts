import { z } from "zod";
import { DIETS, EQUIPMENT_SETUPS, EXPERIENCE_LEVELS, GOAL_KEYS, INJURIES } from "../domain.js";
import { newId } from "../util/id.js";

export const Age = z.number().int().min(16).max(90);

export const ConstraintSchema = z.object({
  id: z.string().default(() => newId()),
  label: z.string().min(1),
  reason: z.string().default(""),
  keywords: z.array(z.string()),
  swaps: z.array(z.string()),
});

/** Onboarding answers: every field optional, each validated on its own. */
export const answerFields = {
  age: Age.nullable(),
  sex: z.enum(["male", "female", "other"]).nullable(),
  heightCm: z.number().min(100).max(250).nullable(),
  startBodyweightKg: z.number().min(20).max(400).nullable(),
  targetBodyweightKg: z.number().min(20).max(400).nullable(),
  units: z.enum(["kg", "lb"]),
  goalKey: z.enum(GOAL_KEYS).nullable(),
  experience: z.enum(EXPERIENCE_LEVELS),
  daysPerWeek: z.number().int().min(2).max(6).nullable(),
  sessionMinutes: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]).nullable(),
  equipmentSetup: z.enum(EQUIPMENT_SETUPS).nullable(),
  injuries: z.array(z.enum(INJURIES)).max(INJURIES.length),
  diet: z.enum(DIETS).nullable(),
};

export const OnboardingStateSchema = z.object({
  step: z.number().int().min(2).max(8),
  completedAt: z.string().nullable(),
  skippedAt: z.string().nullable(),
});

export const ProfileSchema = z.object({
  name: z.string(),
  goal: z.string(),
  // Free text for profiles made before onboarding; onboarding writes one of EXPERIENCE_LEVELS.
  experience: z.string(),
  startBodyweightKg: z.number().nullable(),
  targetBodyweightKg: z.number().nullable(),
  constraints: z.array(ConstraintSchema),
  claudeProjectUrl: z.string().url().or(z.literal("")).optional(),
  age: answerFields.age.optional(),
  sex: answerFields.sex.optional(),
  heightCm: answerFields.heightCm.optional(),
  units: answerFields.units.optional(),
  goalKey: answerFields.goalKey.optional(),
  daysPerWeek: answerFields.daysPerWeek.optional(),
  sessionMinutes: answerFields.sessionMinutes.optional(),
  equipmentSetup: answerFields.equipmentSetup.optional(),
  injuries: answerFields.injuries.optional(),
  diet: answerFields.diet.optional(),
  onboarding: OnboardingStateSchema.optional(),
});
