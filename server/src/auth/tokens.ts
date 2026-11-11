import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { CookieOptions, Request, Response } from "express";
import type { AuthUser } from "../domain.js";
import { config } from "../config.js";
import { col, type UserDoc } from "../db.js";
import { newId } from "../util/id.js";

export const ACCESS_COOKIE = "rs_at";
export const REFRESH_COOKIE = "rs_rt";

/** Access token: short-lived, sent to every /api route. */
export interface AccessClaims {
  sub: string;
  /** user.tokenVersion at issue time */
  tv: number;
  /** session (refresh family) id, used for CSRF binding and "this device" */
  sid: string;
}

/** Refresh token: long-lived, only ever sent to /api/auth. */
interface RefreshClaims {
  sub: string;
  fam: string;
  jti: string;
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const verifyOpts = { algorithms: ["HS256" as const], issuer: config.jwtIssuer, audience: config.jwtAudience };

export const publicUser = (u: UserDoc): AuthUser => ({ id: u._id, email: u.email, name: u.name, emailVerified: !!u.emailVerified, createdAt: u.createdAt.toISOString() });

export function verifyAccess(token: string): AccessClaims {
  return jwt.verify(token, config.jwtAccessSecret, verifyOpts) as unknown as AccessClaims;
}

/** CSRF token derived from the session id: no extra storage, changes with every new login. */
export const csrfFor = (sid: string) => crypto.createHmac("sha256", config.jwtAccessSecret).update(`csrf:${sid}`).digest("base64url");

export function csrfMatches(sid: string, given: unknown) {
  if (typeof given !== "string") return false;
  const a = Buffer.from(csrfFor(sid));
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Cookies ──────────────────────────────────────────────────
const base = (): CookieOptions => ({
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: config.cookieSameSite,
  domain: config.cookieDomain,
});
const accessCookie = (): CookieOptions => ({ ...base(), path: "/api", maxAge: config.accessTtlSec * 1000 });
const refreshCookie = (): CookieOptions => ({ ...base(), path: "/api/auth", maxAge: config.refreshTtlSec * 1000 });

export function clearAuthCookies(res: Response) {
  const { maxAge: _a, ...a } = accessCookie();
  const { maxAge: _r, ...r } = refreshCookie();
  res.clearCookie(ACCESS_COOKIE, a);
  res.clearCookie(REFRESH_COOKIE, r);
}

const clientInfo = (req: Request) => ({ userAgent: String(req.get("user-agent") ?? "").slice(0, 300), ip: req.ip ?? "" });

/**
 * Issues an access + refresh pair as httpOnly cookies. The refresh token is stored only as a
 * SHA-256 hash, so a database leak doesn't hand out working sessions.
 */
async function issue(res: Response, req: Request, user: UserDoc, familyId: string) {
  const jti = newId();
  const refresh = jwt.sign({ sub: user._id, fam: familyId, jti } satisfies RefreshClaims, config.jwtRefreshSecret, {
    algorithm: "HS256",
    expiresIn: config.refreshTtlSec,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
  const access = jwt.sign({ sub: user._id, tv: user.tokenVersion, sid: familyId } satisfies AccessClaims, config.jwtAccessSecret, {
    algorithm: "HS256",
    expiresIn: config.accessTtlSec,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
  const nowD = new Date();
  await col.refreshTokens().insertOne({
    _id: jti,
    userId: user._id,
    familyId,
    tokenHash: sha256(refresh),
    createdAt: nowD,
    expiresAt: new Date(nowD.getTime() + config.refreshTtlSec * 1000),
    revokedAt: null,
    replacedBy: null,
    ...clientInfo(req),
  });
  res.cookie(ACCESS_COOKIE, access, accessCookie());
  res.cookie(REFRESH_COOKIE, refresh, refreshCookie());
  return { jti, csrfToken: csrfFor(familyId) };
}

/** New login → new session family. */
export const startSession = (res: Response, req: Request, user: UserDoc) => issue(res, req, user, newId());

export class AuthError extends Error {
  constructor(message: string, public status = 401, public code = "UNAUTHENTICATED") {
    super(message);
  }
}


/**
 * Refresh-token rotation with reuse detection: each refresh token works once. Presenting a
 * token that was already rotated (outside the short race window) means it was stolen, so the
 * whole session family is revoked and both the thief and the user must log in again.
 */
export async function rotateSession(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (typeof raw !== "string" || !raw) throw new AuthError("Not signed in");
  let claims: RefreshClaims;
  try {
    claims = jwt.verify(raw, config.jwtRefreshSecret, verifyOpts) as unknown as RefreshClaims;
  } catch {
    throw new AuthError("Session expired, please sign in again");
  }
  const doc = await col.refreshTokens().findOne({ _id: claims.jti });
  if (!doc || doc.tokenHash !== sha256(raw) || doc.userId !== claims.sub) throw new AuthError("Session expired, please sign in again");

  if (doc.revokedAt) {
    if (doc.replacedBy && Date.now() - doc.revokedAt.getTime() < config.refreshReuseGraceMs) throw new AuthError("Session refreshed elsewhere", 401, "REFRESH_RACE");
    await revokeFamily(doc.familyId);
    throw new AuthError("Session revoked, please sign in again");
  }

  const user = await col.users().findOne({ _id: doc.userId });
  if (!user) throw new AuthError("Account not found");

  // Claim the token atomically so two concurrent refreshes can't both succeed with it.
  const claimed = await col.refreshTokens().findOneAndUpdate({ _id: doc._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  if (!claimed) throw new AuthError("Session refreshed elsewhere", 401, "REFRESH_RACE");

  const next = await issue(res, req, user, doc.familyId);
  await col.refreshTokens().updateOne({ _id: doc._id }, { $set: { replacedBy: next.jti } });
  return { user, csrfToken: next.csrfToken };
}

export const revokeFamily = (familyId: string) =>
  col.refreshTokens().updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });

export const revokeAllForUser = (userId: string) =>
  col.refreshTokens().updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });

/** Session family id of the refresh cookie on this request, if it's valid (used by logout). */
export function familyFromRefreshCookie(req: Request): string | null {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (typeof raw !== "string" || !raw) return null;
  try {
    return (jwt.verify(raw, config.jwtRefreshSecret, verifyOpts) as unknown as RefreshClaims).fam;
  } catch {
    return null;
  }
}
