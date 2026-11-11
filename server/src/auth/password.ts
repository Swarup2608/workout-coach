import crypto from "node:crypto";
import { Algorithm, hash, verify } from "@node-rs/argon2";

/**
 * Argon2id (winner of the Password Hashing Competition, OWASP's first choice).
 * 64 MiB memory, 3 passes: well above OWASP's minimum (19 MiB, 2 passes).
 * Salt, parameters and version live inside the encoded hash string.
 */
const OPTS = { algorithm: Algorithm.Argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1, outputLen: 32 } as const;
const PARAMS = `m=${OPTS.memoryCost},t=${OPTS.timeCost},p=${OPTS.parallelism}`;

export const hashPassword = (password: string) => hash(password.normalize("NFKC"), OPTS);

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith("$argon2")) return false;
  try {
    return await verify(stored, password.normalize("NFKC"));
  } catch {
    return false;
  }
}

/** True when a hash was made with older/weaker settings, so login can upgrade it. */
export const needsRehash = (stored: string) => !stored.startsWith("$argon2id$") || !stored.includes(`$${PARAMS}$`);

/**
 * A real hash to compare against when the email doesn't exist, so "unknown email" and
 * "wrong password" take the same time (no account enumeration by timing).
 */
let dummy: Promise<string> | null = null;
export const dummyHash = () => (dummy ??= hashPassword(crypto.randomBytes(16).toString("hex")));
