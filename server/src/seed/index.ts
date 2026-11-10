import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "../store.js";
import { newId } from "../store.js";
import { parsePlan } from "../services/planParser.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readBaseline(): string {
  // Works from src/ (tsx) and from dist/ (bundled build).
  for (const p of [path.join(here, "baseline-plan.md"), path.join(here, "seed", "baseline-plan.md"), path.resolve("src/seed/baseline-plan.md")])
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  return "";
}

export function initialDb(): DB {
  const raw = readBaseline();
  const parsed = parsePlan(raw);
  return {
    profile: {
      name: "",
      goal: parsed.goal || "Fat loss, muscle development, V-shaped upper body, stronger arms and chest, balanced legs",
      experience: "Intermediate",
      startBodyweightKg: null,
      targetBodyweightKg: null,
      constraints: [],
    },
    plans: raw
      ? [{ id: newId(), name: "Final weekly gym workout plan", goal: parsed.goal, createdAt: new Date().toISOString(), active: true, rawText: raw, days: parsed.days }]
      : [],
    sessions: [],
    scores: [],
    chat: [],
  };
}
