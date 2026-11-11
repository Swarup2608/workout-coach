import { MongoClient, type Collection, type Db } from "mongodb";
import type { AiProviderId, ChatMessage, Profile, ScoreReport, WorkoutPlan, WorkoutSession } from "./domain.js";
import { config } from "./config.js";

// ── Document shapes ──────────────────────────────────────────
export interface UserDoc {
  _id: string;
  email: string;
  name: string;
  passwordHash: string;
  /** Missing on accounts created before verification existed = not verified */
  emailVerified?: boolean;
  /** Bumped on password change / "log out everywhere" — invalidates every outstanding access token at once */
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
  /** Per-user bring-your-own-key AI provider. The key is AES-256-GCM encrypted, never returned to clients. */
  ai?: {
    provider: AiProviderId;
    model: string;
    baseUrl: string;
    keyEnc: string;
    keyHint: string;
    updatedAt: Date;
  };
}

export interface RefreshTokenDoc {
  /** jti */
  _id: string;
  userId: string;
  /** One family per login; reuse of a rotated token revokes the whole family */
  familyId: string;
  /** SHA-256 of the raw token; the raw token only ever lives in the httpOnly cookie */
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
  userAgent: string;
  ip: string;
}

/** One-time link token for email verification or password reset. Stored only as a SHA-256 hash. */
export interface EmailTokenDoc {
  /** sha256(raw token) */
  _id: string;
  userId: string;
  type: "verify" | "reset";
  createdAt: Date;
  expiresAt: Date;
}

type Owned<T> = T & { userId: string };
export type ProfileDoc = Profile & { _id: string };

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb() {
  client = new MongoClient(config.mongoUri, { maxPoolSize: 20, serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  db = client.db(config.mongoDb);
  await ensureIndexes();
  return db;
}

export async function closeDb() {
  await client?.close();
  client = db = null;
}

const coll = <T extends object>(name: string) => {
  if (!db) throw new Error("Database not connected");
  return db.collection<T>(name) as unknown as Collection<T>;
};

export const col = {
  users: () => coll<UserDoc>("users"),
  refreshTokens: () => coll<RefreshTokenDoc>("refresh_tokens"),
  emailTokens: () => coll<EmailTokenDoc>("email_tokens"),
  profiles: () => coll<ProfileDoc>("profiles"),
  plans: () => coll<Owned<WorkoutPlan>>("plans"),
  sessions: () => coll<Owned<WorkoutSession>>("sessions"),
  scores: () => coll<Owned<ScoreReport>>("scores"),
  chat: () => coll<Owned<ChatMessage>>("chat_messages"),
};

async function ensureIndexes() {
  await Promise.all([
    col.users().createIndex({ email: 1 }, { unique: true }),
    col.refreshTokens().createIndex({ userId: 1 }),
    col.refreshTokens().createIndex({ familyId: 1 }),
    // MongoDB deletes expired refresh tokens automatically.
    col.refreshTokens().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    col.emailTokens().createIndex({ userId: 1, type: 1 }),
    col.emailTokens().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    col.plans().createIndex({ userId: 1, id: 1 }, { unique: true }),
    col.sessions().createIndex({ userId: 1, date: 1 }, { unique: true }),
    col.sessions().createIndex({ userId: 1, id: 1 }, { unique: true }),
    col.scores().createIndex({ userId: 1, kind: 1, createdAt: 1 }),
    col.chat().createIndex({ userId: 1, createdAt: 1 }),
  ]);
}
