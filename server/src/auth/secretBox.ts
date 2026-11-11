import crypto from "node:crypto";
import { encryptionKeyBytes } from "../config.js";

/**
 * AES-256-GCM for users' AI API keys at rest. The owner's user id is bound in as
 * additional authenticated data, so a ciphertext copied onto another account won't decrypt.
 * Format: v1.<iv>.<tag>.<ciphertext> (base64url).
 */
export function encryptSecret(plain: string, userId: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKeyBytes(), iv);
  cipher.setAAD(Buffer.from(userId));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), ct].map((x) => (typeof x === "string" ? x : x.toString("base64url"))).join(".");
}

export function decryptSecret(box: string, userId: string): string {
  const [v, iv, tag, ct] = box.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unreadable stored key");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKeyBytes(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
