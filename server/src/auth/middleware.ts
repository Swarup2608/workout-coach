import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { col, type UserDoc } from "../db.js";
import { ACCESS_COOKIE, csrfMatches, verifyAccess } from "./tokens.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
      /** Session (refresh family) id from the access token */
      sid?: string;
    }
  }
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Blocks state-changing requests whose Origin isn't the configured client.
 * Browsers always send Origin on cross-origin POST/PUT/DELETE, so this stops CSRF from other sites
 * even before cookies' SameSite rules come into play.
 */
export function originGuard(req: Request, res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get("origin");
  if (origin && !config.clientOrigins.includes(origin)) return res.status(403).json({ error: "Origin not allowed" });
  next();
}

/** Verifies the access-token cookie, loads the user, and enforces the CSRF header on writes. Unverified emails allowed (auth routes). */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => authenticate(req, res, next, false);

/** Same, but also requires a verified email when REQUIRE_EMAIL_VERIFICATION is on (all app data routes). */
export const requireVerifiedUser = (req: Request, res: Response, next: NextFunction) => authenticate(req, res, next, config.requireEmailVerification);

async function authenticate(req: Request, res: Response, next: NextFunction, mustBeVerified: boolean) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (typeof token !== "string" || !token) return res.status(401).json({ error: "Not signed in", code: "UNAUTHENTICATED" });
  let claims;
  try {
    claims = verifyAccess(token);
  } catch (e) {
    const expired = e instanceof jwt.TokenExpiredError;
    return res.status(401).json({ error: expired ? "Session expired" : "Not signed in", code: expired ? "TOKEN_EXPIRED" : "UNAUTHENTICATED" });
  }
  try {
    const user = await col.users().findOne({ _id: claims.sub });
    // tokenVersion mismatch = password changed or "log out everywhere" since this token was issued.
    if (!user || user.tokenVersion !== claims.tv) return res.status(401).json({ error: "Session ended, please sign in again", code: "UNAUTHENTICATED" });
    if (!SAFE.has(req.method) && !csrfMatches(claims.sid, req.get("x-csrf-token")))
      return res.status(403).json({ error: "Missing or invalid CSRF token. Reload the page and try again.", code: "CSRF" });
    if (mustBeVerified && !user.emailVerified)
      return res.status(403).json({ error: "Please verify your email address first.", code: "EMAIL_UNVERIFIED" });
    req.user = user;
    req.sid = claims.sid;
    next();
  } catch (e) {
    next(e);
  }
}
