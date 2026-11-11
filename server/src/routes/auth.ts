import { Router, type NextFunction, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";
import { col, type UserDoc } from "../db.js";
import { deleteAllUserData } from "../repo.js";
import { seedNewUser } from "../seed/index.js";
import { newId } from "../util/id.js";
import { dummyHash, hashPassword, needsRehash, verifyPassword } from "../auth/password.js";
import { requireAuth } from "../auth/middleware.js";
import { consumeEmailToken, createEmailToken } from "../auth/emailTokens.js";
import { passwordChangedEmail, resetEmail, sendEmail, verificationEmail } from "../services/email.js";
import { config } from "../config.js";
import {
  AuthError,
  clearAuthCookies,
  csrfFor,
  familyFromRefreshCookie,
  publicUser,
  revokeAllForUser,
  revokeFamily,
  rotateSession,
  startSession,
} from "../auth/tokens.js";

export const auth = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch((e) => {
      if (e instanceof AuthError) {
        clearAuthCookies(res);
        return res.status(e.status).json({ error: e.message, code: e.code });
      }
      next(e);
    });

// ── Validation ───────────────────────────────────────────────
const Email = z.string().trim().toLowerCase().max(254).email("Enter a valid email address");
const NewPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .refine((p) => /[a-z]/i.test(p) && /\d/.test(p), "Password must contain at least one letter and one number");
const Name = z.string().trim().min(1, "Name is required").max(80);

// ── Rate limits (brute force / credential stuffing) ──────────
const limited = (windowMin: number, limit: number, keyGenerator?: (req: Request) => string, onlyFailures = false) =>
  rateLimit({
    windowMs: windowMin * 60_000,
    limit,
    skipSuccessfulRequests: onlyFailures,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator,
    message: { error: "Too many attempts. Please wait a few minutes and try again.", code: "RATE_LIMITED" },
  });
const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? "");
const emailKey = (req: Request) => `email:${String(req.body?.email ?? "").trim().toLowerCase()}`;

// Only failed logins count, so a user signing in on several devices is never locked out.
const loginPerIp = limited(15, 20, ipKey, true);
const loginPerEmail = limited(15, 8, emailKey, true);
const registerPerIp = limited(60, 10, ipKey);
const refreshPerIp = limited(5, 60, ipKey);
const sensitivePerIp = limited(15, 10, ipKey);
const emailPerIp = limited(60, 10, ipKey);
const emailPerAddress = limited(60, 3, emailKey);
const tokenPerIp = limited(15, 20, ipKey);

const respond = (res: Response, user: UserDoc, csrfToken: string, status = 200) =>
  res.status(status).json({ user: publicUser(user), csrfToken, emailVerificationRequired: config.requireEmailVerification });

async function sendVerification(user: UserDoc) {
  sendEmail(verificationEmail(user.email, user.name, await createEmailToken(user._id, "verify")));
}

// ── Register ─────────────────────────────────────────────────
auth.post("/register", registerPerIp, wrap(async (req, res) => {
  const { name, email, password } = z.object({ name: Name, email: Email, password: NewPassword }).parse(req.body);
  const nowD = new Date();
  const user: UserDoc = { _id: newId(), email, name, passwordHash: await hashPassword(password), emailVerified: false, tokenVersion: 0, createdAt: nowD, updatedAt: nowD };
  try {
    await col.users().insertOne(user);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return res.status(409).json({ error: "An account with this email already exists" });
    throw e;
  }
  await seedNewUser(user._id, name);
  await sendVerification(user);
  const { csrfToken } = await startSession(res, req, user);
  respond(res, user, csrfToken, 201);
}));

// ── Email verification ───────────────────────────────────────
/** Public: the link may be opened on a device where the user isn't signed in. */
auth.post("/verify-email", tokenPerIp, wrap(async (req, res) => {
  const { token } = z.object({ token: z.string().min(1).max(200) }).parse(req.body);
  const userId = await consumeEmailToken(token, "verify");
  if (!userId) return res.status(400).json({ error: "This verification link is invalid or has expired. Sign in and send a new one.", code: "BAD_TOKEN" });
  await col.users().updateOne({ _id: userId }, { $set: { emailVerified: true, updatedAt: new Date() } });
  res.json({ ok: true });
}));

auth.post("/resend-verification", requireAuth, emailPerIp, wrap(async (req, res) => {
  if (req.user!.emailVerified) return res.json({ ok: true, alreadyVerified: true });
  await sendVerification(req.user!);
  res.json({ ok: true });
}));

// ── Forgot / reset password ──────────────────────────────────
/** Same response whether or not the email has an account (no account enumeration). */
auth.post("/forgot-password", emailPerIp, emailPerAddress, wrap(async (req, res) => {
  const { email } = z.object({ email: Email }).parse(req.body);
  const user = await col.users().findOne({ email });
  if (user) sendEmail(resetEmail(user.email, user.name, await createEmailToken(user._id, "reset")));
  res.json({ ok: true, message: "If an account exists for that email, a reset link is on its way. It expires in 1 hour." });
}));

auth.post("/reset-password", tokenPerIp, wrap(async (req, res) => {
  const { token, newPassword } = z.object({ token: z.string().min(1).max(200), newPassword: NewPassword }).parse(req.body);
  const userId = await consumeEmailToken(token, "reset");
  if (!userId) return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one.", code: "BAD_TOKEN" });
  const user = await col.users().findOneAndUpdate(
    { _id: userId },
    // Clicking the emailed link proves inbox ownership, so the address counts as verified too.
    { $set: { passwordHash: await hashPassword(newPassword), emailVerified: true, updatedAt: new Date() }, $inc: { tokenVersion: 1 } },
    { returnDocument: "after" },
  );
  if (!user) return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one.", code: "BAD_TOKEN" });
  await revokeAllForUser(userId);
  await col.emailTokens().deleteMany({ userId, type: "reset" });
  sendEmail(passwordChangedEmail(user.email, user.name));
  clearAuthCookies(res);
  res.json({ ok: true });
}));

// ── Login ────────────────────────────────────────────────────
auth.post("/login", loginPerIp, loginPerEmail, wrap(async (req, res) => {
  const { email, password } = z.object({ email: Email, password: z.string().min(1).max(128) }).parse(req.body);
  const user = await col.users().findOne({ email });
  // Always run a full hash comparison so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !ok) return res.status(401).json({ error: "Invalid email or password", code: "INVALID_CREDENTIALS" });
  if (needsRehash(user.passwordHash)) {
    await col.users().updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(password), updatedAt: new Date() } });
  }
  const { csrfToken } = await startSession(res, req, user);
  respond(res, user, csrfToken);
}));

// ── Refresh (rotates the refresh token) ──────────────────────
auth.post("/refresh", refreshPerIp, wrap(async (req, res) => {
  const { user, csrfToken } = await rotateSession(req, res);
  respond(res, user, csrfToken);
}));

// ── Logout (this device) ─────────────────────────────────────
auth.post("/logout", wrap(async (req, res) => {
  const fam = familyFromRefreshCookie(req);
  if (fam) await revokeFamily(fam);
  clearAuthCookies(res);
  res.status(204).end();
}));

// ── Everything below needs a valid access token ──────────────
auth.get("/me", requireAuth, (req, res) => respond(res, req.user!, csrfFor(req.sid!)));

auth.patch("/me", requireAuth, wrap(async (req, res) => {
  const { name } = z.object({ name: Name }).parse(req.body);
  await col.users().updateOne({ _id: req.user!._id }, { $set: { name, updatedAt: new Date() } });
  respond(res, { ...req.user!, name }, csrfFor(req.sid!));
}));

/** Log out of every device: bumps tokenVersion (kills access tokens now) and revokes all refresh tokens. */
auth.post("/logout-all", requireAuth, wrap(async (req, res) => {
  await col.users().updateOne({ _id: req.user!._id }, { $inc: { tokenVersion: 1 } });
  await revokeAllForUser(req.user!._id);
  clearAuthCookies(res);
  res.status(204).end();
}));

auth.post("/change-password", requireAuth, sensitivePerIp, wrap(async (req, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1).max(128), newPassword: NewPassword }).parse(req.body);
  const user = req.user!;
  if (!(await verifyPassword(currentPassword, user.passwordHash))) return res.status(400).json({ error: "Current password is incorrect" });
  if (currentPassword === newPassword) return res.status(400).json({ error: "New password must be different" });
  const updated: UserDoc = { ...user, passwordHash: await hashPassword(newPassword), tokenVersion: user.tokenVersion + 1, updatedAt: new Date() };
  await col.users().updateOne({ _id: user._id }, { $set: { passwordHash: updated.passwordHash, tokenVersion: updated.tokenVersion, updatedAt: updated.updatedAt } });
  // Sign out every other device; keep this one signed in with a fresh session.
  await revokeAllForUser(user._id);
  const { csrfToken } = await startSession(res, req, updated);
  sendEmail(passwordChangedEmail(user.email, user.name));
  respond(res, updated, csrfToken);
}));

/** Active sign-ins (one per login, across devices). */
auth.get("/sessions", requireAuth, wrap(async (req, res) => {
  const tokens = await col.refreshTokens()
    .find({ userId: req.user!._id, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(
    tokens.map((t) => ({
      id: t.familyId,
      userAgent: t.userAgent,
      ip: t.ip,
      lastActiveAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt.toISOString(),
      current: t.familyId === req.sid,
    })),
  );
}));

auth.delete("/sessions/:id", requireAuth, wrap(async (req, res) => {
  await col.refreshTokens().updateMany({ userId: req.user!._id, familyId: String(req.params.id), revokedAt: null }, { $set: { revokedAt: new Date() } });
  if (req.params.id === req.sid) clearAuthCookies(res);
  res.status(204).end();
}));

/** Permanently deletes the account and all its data. Requires the password. */
auth.delete("/me", requireAuth, sensitivePerIp, wrap(async (req, res) => {
  const { password } = z.object({ password: z.string().min(1).max(128) }).parse(req.body ?? {});
  if (!(await verifyPassword(password, req.user!.passwordHash))) return res.status(400).json({ error: "Password is incorrect" });
  await deleteAllUserData(req.user!._id);
  await col.users().deleteOne({ _id: req.user!._id });
  clearAuthCookies(res);
  res.status(204).end();
}));
