import "dotenv/config";

const env = (k: string, fallback = "") => (process.env[k] ?? fallback).trim();
const isProd = env("NODE_ENV") === "production";

export const config = {
  isProd,
  port: Number(env("PORT", "4000")),
  /** Comma-separated list of browser origins allowed to call the API with cookies */
  clientOrigins: env("CLIENT_ORIGIN", "http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean),

  // ── MongoDB (Atlas connection string) ──
  mongoUri: env("MONGODB_URI"),
  mongoDb: env("MONGODB_DB", "starkfitiq"),

  // ── JWT ──
  jwtAccessSecret: env("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: env("JWT_REFRESH_SECRET"),
  accessTtlSec: Number(env("ACCESS_TOKEN_TTL_SEC", String(15 * 60))),
  refreshTtlSec: Number(env("REFRESH_TOKEN_TTL_SEC", String(7 * 24 * 60 * 60))),
  jwtIssuer: "starkfitiq-api",
  jwtAudience: "starkfitiq-client",

  // ── Cookies ──
  /** "lax" works when client and API share a site (e.g. localhost:3000 + localhost:4000, or app.x.com + api.x.com). Use "none" for different sites (requires HTTPS). */
  cookieSameSite: (env("COOKIE_SAMESITE", "lax").toLowerCase() as "lax" | "strict" | "none"),
  cookieSecure: env("COOKIE_SECURE", isProd ? "true" : "false") === "true",
  cookieDomain: env("COOKIE_DOMAIN") || undefined,

  // ── Encryption of users' AI API keys at rest (32 bytes, base64 or hex) ──
  encryptionKey: env("ENCRYPTION_KEY"),

  /** Allow "custom" AI base URLs on private/loopback networks (e.g. local Ollama). Keep false in production. */
  allowPrivateAiUrls: env("ALLOW_PRIVATE_AI_URLS", "false") === "true",

  /** Set when running behind a reverse proxy (Render, Fly, Nginx) so rate limiting sees real client IPs */
  trustProxy: env("TRUST_PROXY", "false") === "true",

  // ── Email (Resend) ──
  /** Public URL of the web app, used in email links */
  appUrl: env("APP_URL", env("CLIENT_ORIGIN", "http://localhost:3000").split(",")[0].trim()).replace(/\/+$/, ""),
  /** Without a key, emails are printed to the server console (development only) */
  resendApiKey: env("RESEND_API_KEY"),
  emailFrom: env("EMAIL_FROM", "StarkFitIQ <onboarding@resend.dev>"),
  /** Block the app (not sign-in) until the email address is verified */
  requireEmailVerification: env("REQUIRE_EMAIL_VERIFICATION", "true") === "true",
  verifyTtlSec: 24 * 60 * 60,
  resetTtlSec: 60 * 60,

  /** Window in which reusing a just-rotated refresh token is treated as a two-tab race, not theft */
  refreshReuseGraceMs: Number(env("REFRESH_REUSE_GRACE_MS", "15000")),
};

/** Decoded 32-byte key for AES-256-GCM. */
export function encryptionKeyBytes(): Buffer {
  const raw = config.encryptionKey;
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)");
  return buf;
}

/** Fail fast on missing or weak secrets. Called once at startup (not on import, so unit tests stay env-free). */
export function assertConfig() {
  const problems: string[] = [];
  if (!config.mongoUri) problems.push("MONGODB_URI is required (your MongoDB Atlas connection string)");
  for (const k of ["jwtAccessSecret", "jwtRefreshSecret"] as const) {
    const name = k === "jwtAccessSecret" ? "JWT_ACCESS_SECRET" : "JWT_REFRESH_SECRET";
    if (config[k].length < 32) problems.push(`${name} must be at least 32 characters`);
  }
  if (config.jwtAccessSecret && config.jwtAccessSecret === config.jwtRefreshSecret)
    problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
  try {
    encryptionKeyBytes();
  } catch (e) {
    problems.push((e as Error).message);
  }
  if (config.cookieSameSite === "none" && !config.cookieSecure) problems.push("COOKIE_SAMESITE=none requires COOKIE_SECURE=true");
  if (!["lax", "strict", "none"].includes(config.cookieSameSite)) problems.push("COOKIE_SAMESITE must be lax, strict or none");
  if (config.isProd && !config.resendApiKey) problems.push("RESEND_API_KEY is required in production (verification and password-reset emails)");
  if (config.isProd && !/^https:\/\//.test(config.appUrl)) problems.push("APP_URL must be the https:// address of the web app in production");
  if (problems.length) {
    console.error("\nServer config is incomplete (server/.env):\n" + problems.map((p) => `  • ${p}`).join("\n"));
    console.error("\nGenerate secrets with:  npm run secrets -w server\n");
    process.exit(1);
  }
}
