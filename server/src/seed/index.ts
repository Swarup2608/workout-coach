import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newId, now } from "../util/id.js";
import { parsePlan } from "../services/planParser.js";
import { userRepo } from "../repo.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readBaseline(): string {
  // Works from src/ (tsx) and from dist/ (bundled build).
  for (const p of [path.join(here, "baseline-plan.md"), path.join(here, "seed", "baseline-plan.md"), path.resolve("src/seed/baseline-plan.md")])
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  return "";
}

/** Gives a brand-new account a starter profile (onboarding at step 2) and the baseline weekly plan, used until onboarding builds theirs. */
export async function seedNewUser(userId: string, name: string, age: number | null) {
  const raw = readBaseline();
  const parsed = parsePlan(raw);
  const repo = userRepo(userId);
  await repo.saveProfile({
    name,
    goal: parsed.goal || "Fat loss, muscle development, V-shaped upper body, stronger arms and chest, balanced legs",
    experience: "Intermediate",
    startBodyweightKg: null,
    targetBodyweightKg: null,
    constraints: [],
    age,
    units: "kg",
    injuries: [],
    onboarding: { step: 2, completedAt: null, skippedAt: null },
  });
  if (raw) await repo.addPlan({ id: newId(), name: "Final weekly gym workout plan", goal: parsed.goal, createdAt: now(), active: true, rawText: raw, days: parsed.days });
}
