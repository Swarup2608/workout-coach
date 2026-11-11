/**
 * End-to-end auth tests: the real Express app + a throwaway in-memory MongoDB.
 * The database files live in server/.mongo-test-<pid> (deleted afterwards), never in /tmp.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server-core";

// ── Test environment (set before any app module reads config) ──
const projectDir = path.resolve(import.meta.dirname, "../..");
const dbPath = path.join(projectDir, `.mongo-test-${process.pid}`);
const systemMongod = (() => {
  if (process.env.MONGOMS_SYSTEM_BINARY) return process.env.MONGOMS_SYSTEM_BINARY;
  try {
    return execFileSync("/bin/sh", ["-c", "command -v mongod"], { encoding: "utf8" }).trim() || undefined;
  } catch {
    return undefined; // falls back to downloading a mongod binary into node_modules/.cache
  }
})();

let mongo: MongoMemoryServer;
let server: Server;
let base = "";
const sent: { to: string; subject: string; text: string }[] = [];
let closeDb: () => Promise<void>;
let col: typeof import("../db.js").col;
let jwtSecret = "";

before(async () => {
  fs.mkdirSync(dbPath, { recursive: true });
  mongo = await MongoMemoryServer.create({
    instance: { dbPath, args: ["--nounixsocket"] },
    binary: systemMongod ? { systemBinary: systemMongod } : { downloadDir: path.join(projectDir, "../node_modules/.cache/mongodb-binaries") },
  });
  jwtSecret = crypto.randomBytes(48).toString("base64url");
  Object.assign(process.env, {
    DOTENV_CONFIG_PATH: path.join(projectDir, ".env.does-not-exist"),
    NODE_ENV: "test",
    MONGODB_URI: mongo.getUri(),
    MONGODB_DB: "auth_test",
    JWT_ACCESS_SECRET: jwtSecret,
    JWT_REFRESH_SECRET: crypto.randomBytes(48).toString("base64url"),
    ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"),
    CLIENT_ORIGIN: "http://localhost:3000",
    APP_URL: "http://localhost:3000",
    RESEND_API_KEY: "",
    EMAIL_FROM: "test@example.com",
    REQUIRE_EMAIL_VERIFICATION: "true",
    REFRESH_REUSE_GRACE_MS: "0",
    ACCESS_TOKEN_TTL_SEC: "900",
    REFRESH_TOKEN_TTL_SEC: "604800",
    COOKIE_SAMESITE: "lax",
    COOKIE_SECURE: "false",
    COOKIE_DOMAIN: "",
    TRUST_PROXY: "false",
    ALLOW_PRIVATE_AI_URLS: "false",
  });
  const db = await import("../db.js");
  const email = await import("../services/email.js");
  const { createApp } = await import("../app.js");
  email.setEmailTransport(async (e) => void sent.push(e));
  await db.connectDb();
  col = db.col;
  closeDb = db.closeDb;
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

after(async () => {
  await new Promise((r) => server?.close(r));
  await closeDb?.();
  await mongo?.stop({ doCleanup: true, force: true });
  fs.rmSync(dbPath, { recursive: true, force: true });
});

// ── A tiny browser: keeps cookies, sends the CSRF header like the web app ──
class Browser {
  cookies: Record<string, string> = {};
  csrf = "";
  async call(method: string, p: string, body?: unknown, opts: { csrf?: string | null; origin?: string; cookie?: string } = {}) {
    const headers: Record<string, string> = { cookie: opts.cookie ?? Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ") };
    if (body !== undefined) headers["content-type"] = "application/json";
    const csrf = opts.csrf === undefined ? this.csrf : opts.csrf;
    if (csrf) headers["x-csrf-token"] = csrf;
    if (opts.origin) headers.origin = opts.origin;
    const res = await fetch(base + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookies = res.headers.getSetCookie();
    for (const c of setCookies) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      const k = kv.slice(0, i);
      const v = kv.slice(i + 1);
      if (v) this.cookies[k] = v;
      else delete this.cookies[k];
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    if (json && typeof json === "object" && typeof json.csrfToken === "string") this.csrf = json.csrfToken;
    return { status: res.status, body: json, setCookies };
  }
}

const tokenFrom = (to: string, kind: "verify-email" | "reset-password") => {
  const mail = [...sent].reverse().find((m) => m.to === to && m.text.includes(`/${kind}?token=`));
  assert.ok(mail, `expected a ${kind} email to ${to}`);
  return decodeURIComponent(mail.text.match(/token=([^\s]+)/)![1]);
};

const PW = "Str0ngPassw0rd";
const alice = { name: "Alice", email: "alice@example.com", password: PW };
const a = new Browser();

describe("auth", () => {
  it("rejects protected routes when signed out", async () => {
    const r = await new Browser().call("GET", "/plans");
    assert.equal(r.status, 401);
    assert.equal(r.body.code, "UNAUTHENTICATED");
  });

  it("validates sign-up input", async () => {
    const b = new Browser();
    assert.equal((await b.call("POST", "/auth/register", { ...alice, password: "short1" })).status, 400);
    assert.equal((await b.call("POST", "/auth/register", { ...alice, password: "nonumbershere" })).status, 400);
    assert.equal((await b.call("POST", "/auth/register", { ...alice, email: "not-an-email" })).status, 400);
  });

  it("registers with secure httpOnly cookies, hashes the password with argon2id, and emails a verification link", async () => {
    const r = await a.call("POST", "/auth/register", { ...alice, email: "  Alice@Example.com " });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.email, "alice@example.com", "email is normalised");
    assert.equal(r.body.user.emailVerified, false);
    assert.equal(r.body.emailVerificationRequired, true);
    assert.ok(a.cookies.rs_at && a.cookies.rs_rt);
    const at = r.setCookies.find((c) => c.startsWith("rs_at="))!;
    const rt = r.setCookies.find((c) => c.startsWith("rs_rt="))!;
    assert.match(at, /HttpOnly/i);
    assert.match(at, /SameSite=Lax/i);
    assert.match(at, /Path=\/api(;|$)/);
    assert.match(rt, /HttpOnly/i);
    assert.match(rt, /Path=\/api\/auth(;|$)/, "refresh cookie is only sent to /api/auth");
    const doc = await col.users().findOne({ email: "alice@example.com" });
    assert.match(doc!.passwordHash, /^\$argon2id\$/);
    assert.ok(!JSON.stringify(r.body).includes(doc!.passwordHash));
    tokenFrom("alice@example.com", "verify-email");
  });

  it("rejects a duplicate email", async () => {
    assert.equal((await new Browser().call("POST", "/auth/register", alice)).status, 409);
  });

  it("locks app data until the email is verified, but allows auth routes", async () => {
    const r = await a.call("GET", "/plans");
    assert.equal(r.status, 403);
    assert.equal(r.body.code, "EMAIL_UNVERIFIED");
    assert.equal((await a.call("GET", "/auth/me")).status, 200);
  });

  it("resends verification, and only the newest link works", async () => {
    const first = tokenFrom("alice@example.com", "verify-email");
    assert.equal((await a.call("POST", "/auth/resend-verification")).status, 200);
    const second = tokenFrom("alice@example.com", "verify-email");
    assert.notEqual(first, second);
    assert.equal((await new Browser().call("POST", "/auth/verify-email", { token: first })).status, 400, "old link invalidated");
  });

  it("verifies the email from a link (works without being signed in) and the link is single-use", async () => {
    const token = tokenFrom("alice@example.com", "verify-email");
    assert.equal((await new Browser().call("POST", "/auth/verify-email", { token: "bogus-token-value-123456" })).status, 400);
    assert.equal((await new Browser().call("POST", "/auth/verify-email", { token })).status, 200);
    assert.equal((await new Browser().call("POST", "/auth/verify-email", { token })).status, 400, "single use");
    const me = await a.call("GET", "/auth/me");
    assert.equal(me.body.user.emailVerified, true);
    const plans = await a.call("GET", "/plans");
    assert.equal(plans.status, 200);
    assert.equal(plans.body.length, 1, "new account is seeded with the baseline plan");
  });

  it("requires the CSRF header on writes and rejects foreign origins", async () => {
    const profile = (await a.call("GET", "/profile")).body;
    const noCsrf = await a.call("PUT", "/profile", profile, { csrf: null });
    assert.equal(noCsrf.status, 403);
    assert.equal(noCsrf.body.code, "CSRF");
    assert.equal((await a.call("PUT", "/profile", profile, { csrf: "forged-token" })).status, 403);
    assert.equal((await a.call("PUT", "/profile", profile, { origin: "https://evil.example" })).status, 403);
    assert.equal((await a.call("PUT", "/profile", { ...profile, goal: "Get strong" })).status, 200);
  });

  it("rejects tampered and expired access tokens", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const claims = JSON.parse(Buffer.from(a.cookies.rs_at.split(".")[1], "base64url").toString());
    const forged = jwt.sign({ sub: claims.sub, tv: claims.tv, sid: claims.sid }, "wrong-secret-wrong-secret-wrong-secret", { expiresIn: 900, issuer: "starkfitiq-api", audience: "starkfitiq-client" });
    assert.equal((await a.call("GET", "/plans", undefined, { cookie: `rs_at=${forged}` })).status, 401);
    const noneAlg = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${a.cookies.rs_at.split(".")[1]}.`;
    assert.equal((await a.call("GET", "/plans", undefined, { cookie: `rs_at=${noneAlg}` })).status, 401, "alg=none rejected");
    const expired = jwt.sign({ sub: claims.sub, tv: claims.tv, sid: claims.sid }, jwtSecret, { expiresIn: -10, issuer: "starkfitiq-api", audience: "starkfitiq-client" });
    const r = await a.call("GET", "/plans", undefined, { cookie: `rs_at=${expired}` });
    assert.equal(r.status, 401);
    assert.equal(r.body.code, "TOKEN_EXPIRED");
  });

  it("rotates refresh tokens and revokes the whole session when an old one is replayed", async () => {
    const old = a.cookies.rs_rt;
    const r = await a.call("POST", "/auth/refresh");
    assert.equal(r.status, 200);
    assert.notEqual(a.cookies.rs_rt, old);
    const stored = await col.refreshTokens().find({ userId: r.body.user.id }).toArray();
    assert.ok(stored.every((t) => !t.tokenHash.includes(".") && t.tokenHash.length === 64), "only hashes are stored");
    const replay = await new Browser().call("POST", "/auth/refresh", undefined, { cookie: `rs_rt=${old}` });
    assert.equal(replay.status, 401);
    assert.equal((await a.call("POST", "/auth/refresh")).status, 401, "theft detected: current token revoked too");
  });

  it("logs in with generic errors and rate-limits brute force", async () => {
    const wrong = await a.call("POST", "/auth/login", { email: alice.email, password: "Wrong1234" });
    assert.equal(wrong.status, 401);
    const unknown = await a.call("POST", "/auth/login", { email: "nobody@example.com", password: "Wrong1234" });
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error, unknown.body.error, "same message for unknown email and wrong password");
    const ok = await a.call("POST", "/auth/login", alice);
    assert.equal(ok.status, 200);
    assert.equal((await a.call("GET", "/plans")).status, 200);

    const attacker = new Browser();
    const statuses: number[] = [];
    for (let i = 0; i < 9; i++) statuses.push((await attacker.call("POST", "/auth/login", { email: "victim@example.com", password: `Guess${i}xx1` })).status);
    assert.equal(statuses.at(-1), 429, `per-email limit kicks in (got ${statuses.join(",")})`);
  });

  it("keeps each user's data private", async () => {
    const bob = new Browser();
    assert.equal((await bob.call("POST", "/auth/register", { name: "Bob", email: "bob@example.com", password: PW })).status, 201);
    await bob.call("POST", "/auth/verify-email", { token: tokenFrom("bob@example.com", "verify-email") });

    const saved = await a.call("PUT", "/sessions", { date: "2026-11-09", exercises: [{ plannedId: null, name: "Bench press", sets: [{ weightKg: 60, reps: 8, done: true }] }] });
    assert.equal(saved.status, 200);
    assert.deepEqual((await bob.call("GET", "/sessions")).body, [], "Bob can't see Alice's logs");
    await bob.call("DELETE", `/sessions/${saved.body.id}`);
    assert.equal((await a.call("GET", "/sessions")).body.length, 1, "Bob can't delete Alice's logs");
    const bobPlan = (await bob.call("GET", "/plans")).body[0];
    assert.equal((await a.call("POST", `/plans/${bobPlan.id}/activate`)).status, 404, "Alice can't touch Bob's plan");
  });

  it("stores AI keys encrypted, never returns them, and blocks private-network URLs (SSRF)", async () => {
    const status = await a.call("GET", "/status");
    assert.equal(status.body.aiConnected, false);
    for (const baseUrl of ["http://169.254.169.254/v1", "https://127.0.0.1/v1", "https://localhost/v1", "ftp://example.com"]) {
      const r = await a.call("PUT", "/settings/ai", { provider: "custom", model: "m", baseUrl, apiKey: "sk-test-1234567890" });
      assert.equal(r.status, 400, `${baseUrl} should be blocked`);
    }
    // Simulate a saved key (a real save makes a live test call to the provider).
    const { encryptSecret, decryptSecret } = await import("../auth/secretBox.js");
    const me = (await a.call("GET", "/auth/me")).body.user;
    const keyEnc = encryptSecret("sk-secret-abcdef1234", me.id);
    await col.users().updateOne({ _id: me.id }, { $set: { ai: { provider: "openai", model: "gpt-5", baseUrl: "https://api.openai.com/v1", keyEnc, keyHint: "1234", updatedAt: new Date() } } });
    const view = await a.call("GET", "/settings/ai");
    assert.equal(view.body.configured, true);
    assert.equal(view.body.keyHint, "1234");
    assert.ok(!JSON.stringify(view.body).includes("sk-secret"));
    assert.ok(!keyEnc.includes("sk-secret"));
    assert.throws(() => decryptSecret(keyEnc, "someone-else"), "ciphertext is bound to its owner");
    assert.equal((await a.call("DELETE", "/settings/ai")).status, 204);
  });

  it("forgot password: same answer for unknown emails, one-time link, resets and signs out everywhere", async () => {
    const phone = new Browser();
    await phone.call("POST", "/auth/login", alice);
    assert.equal((await phone.call("GET", "/auth/me")).status, 200);

    const before = sent.length;
    const unknown = await new Browser().call("POST", "/auth/forgot-password", { email: "ghost@example.com" });
    const known = await new Browser().call("POST", "/auth/forgot-password", { email: alice.email });
    assert.equal(unknown.status, 200);
    assert.deepEqual(unknown.body, known.body, "no account enumeration");
    assert.equal(sent.slice(before).filter((m) => m.to === "ghost@example.com").length, 0);
    const token = tokenFrom(alice.email, "reset-password");

    const anon = new Browser();
    assert.equal((await anon.call("POST", "/auth/reset-password", { token, newPassword: "weak" })).status, 400);
    assert.equal((await anon.call("POST", "/auth/reset-password", { token: "not-a-real-token-1234567", newPassword: "N3wPassword!" })).status, 400);
    assert.equal((await anon.call("POST", "/auth/reset-password", { token, newPassword: "N3wPassword!" })).status, 200);
    assert.equal((await anon.call("POST", "/auth/reset-password", { token, newPassword: "An0therPass!" })).status, 400, "single use");
    assert.ok(sent.some((m) => m.to === alice.email && /password was changed/i.test(m.subject)), "security notice sent");

    assert.equal((await phone.call("GET", "/auth/me")).status, 401, "existing sessions ended");
    assert.equal((await phone.call("POST", "/auth/refresh")).status, 401, "refresh tokens revoked");
    assert.equal((await a.call("POST", "/auth/login", alice)).status, 401, "old password no longer works");
    alice.password = "N3wPassword!";
    assert.equal((await a.call("POST", "/auth/login", alice)).status, 200);
  });

  it("change password ends other sessions but keeps this one", async () => {
    const laptop = new Browser();
    await laptop.call("POST", "/auth/login", alice);
    const oldAccess = a.cookies.rs_at;
    const r = await a.call("POST", "/auth/change-password", { currentPassword: "wrongpass1", newPassword: "Chang3dPass!" });
    assert.equal(r.status, 400);
    assert.equal((await a.call("POST", "/auth/change-password", { currentPassword: alice.password, newPassword: "Chang3dPass!" })).status, 200);
    alice.password = "Chang3dPass!";
    assert.equal((await a.call("GET", "/auth/me")).status, 200, "this device stays signed in");
    assert.equal((await a.call("GET", "/auth/me", undefined, { cookie: `rs_at=${oldAccess}` })).status, 401, "old access token is dead");
    assert.equal((await laptop.call("GET", "/auth/me")).status, 401, "other device signed out");
  });

  it("lists and revokes devices, logout, and logout everywhere", async () => {
    const tablet = new Browser();
    await tablet.call("POST", "/auth/login", alice);
    const list = (await a.call("GET", "/auth/sessions")).body as { id: string; current: boolean }[];
    assert.equal(list.filter((s) => s.current).length, 1);
    const other = list.find((s) => !s.current)!;
    assert.equal((await a.call("DELETE", `/auth/sessions/${other.id}`)).status, 204);
    assert.equal((await tablet.call("POST", "/auth/refresh")).status, 401, "revoked device can't refresh");

    const r = await a.call("POST", "/auth/logout");
    assert.equal(r.status, 204);
    assert.ok(!a.cookies.rs_at && !a.cookies.rs_rt, "cookies cleared");

    await a.call("POST", "/auth/login", alice);
    const second = new Browser();
    await second.call("POST", "/auth/login", alice);
    assert.equal((await a.call("POST", "/auth/logout-all")).status, 204);
    assert.equal((await second.call("GET", "/auth/me")).status, 401);
    assert.equal((await second.call("POST", "/auth/refresh")).status, 401);
  });

  it("deletes the account and every piece of its data", async () => {
    await a.call("POST", "/auth/login", alice);
    const id = (await a.call("GET", "/auth/me")).body.user.id;
    assert.equal((await a.call("DELETE", "/auth/me", { password: "wrongpass1" })).status, 400);
    assert.equal((await a.call("DELETE", "/auth/me", { password: alice.password })).status, 204);
    assert.equal((await a.call("POST", "/auth/login", alice)).status, 401);
    for (const c of [col.plans(), col.sessions(), col.scores(), col.chat(), col.refreshTokens(), col.emailTokens()])
      assert.equal(await c.countDocuments({ userId: id }), 0);
    assert.equal(await col.users().countDocuments({ _id: id }), 0);
  });
});
