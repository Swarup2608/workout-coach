import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  ChatMessage,
  Profile,
  ScoreReport,
  WorkoutPlan,
  WorkoutSession,
} from "@workout/shared";
import { config } from "./config.js";

/**
 * Tiny JSON-file database. Zero setup; swap for MongoDB/Postgres later by
 * re-implementing this module behind the same functions.
 */
export interface DB {
  profile: Profile;
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  scores: ScoreReport[];
  chat: ChatMessage[];
}

const file = path.resolve(config.dataFile);
let db: DB | null = null;
let writeChain: Promise<void> = Promise.resolve();

export const newId = () => crypto.randomUUID();

export function load(initial: () => DB): DB {
  if (db) return db;
  if (fs.existsSync(file)) {
    db = JSON.parse(fs.readFileSync(file, "utf8")) as DB;
  } else {
    db = initial();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db, null, 2));
  }
  return db;
}

export function getDb(): DB {
  if (!db) throw new Error("DB not loaded");
  return db;
}

/** Mutate then persist (serialised writes, atomic rename). */
export async function update<T>(fn: (d: DB) => T): Promise<T> {
  const result = fn(getDb());
  writeChain = writeChain.then(async () => {
    const tmp = file + ".tmp";
    await fs.promises.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.promises.rename(tmp, file);
  });
  await writeChain;
  return result;
}

export const activePlan = () => getDb().plans.find((p) => p.active) ?? null;
