import crypto from "node:crypto";
import { config } from "../config.js";
import { col, type EmailTokenDoc } from "../db.js";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/**
 * Creates a single-use token (256 bits of randomness) and returns the raw value for the email link.
 * Only its hash is stored, and any older token of the same type for this user is invalidated.
 */
export async function createEmailToken(userId: string, type: EmailTokenDoc["type"]) {
  const raw = crypto.randomBytes(32).toString("base64url");
  const ttl = type === "verify" ? config.verifyTtlSec : config.resetTtlSec;
  const now = new Date();
  await col.emailTokens().deleteMany({ userId, type });
  await col.emailTokens().insertOne({ _id: sha256(raw), userId, type, createdAt: now, expiresAt: new Date(now.getTime() + ttl * 1000) });
  return raw;
}

/** Atomically consumes a token: returns its user id once, then the token is gone. */
export async function consumeEmailToken(raw: string, type: EmailTokenDoc["type"]): Promise<string | null> {
  if (!/^[\w-]{20,100}$/.test(raw)) return null;
  const doc = await col.emailTokens().findOneAndDelete({ _id: sha256(raw), type });
  if (!doc || doc.expiresAt.getTime() < Date.now()) return null;
  return doc.userId;
}
