/**
 * Shared end-to-end test harness: the real Express app + a throwaway in-memory MongoDB.
 * The database files live in server/.mongo-test-<pid> (deleted afterwards), never in /tmp.
 * Each *.test.ts file runs in its own process, so each gets its own database and rate-limit state.
 */
import { after, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server-core";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

type Col = typeof import("../db.js").col;

const state = { base: "", jwtSecret: "", col: null as Col | null };
const sent: Mail[] = [];

/** Starts the app and database for this test file. Call once at the top level of a test file. */
export function useTestApp(dbName: string) {
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
  let closeDb: () => Promise<void>;

  before(async () => {
    fs.mkdirSync(dbPath, { recursive: true });
    mongo = await MongoMemoryServer.create({
      instance: { dbPath, args: ["--nounixsocket"] },
      binary: systemMongod ? { systemBinary: systemMongod } : { downloadDir: path.join(projectDir, "../node_modules/.cache/mongodb-binaries") },
    });
    state.jwtSecret = crypto.randomBytes(48).toString("base64url");
    Object.assign(process.env, {
      DOTENV_CONFIG_PATH: path.join(projectDir, ".env.does-not-exist"),
      NODE_ENV: "test",
      MONGODB_URI: mongo.getUri(),
      MONGODB_DB: dbName,
      JWT_ACCESS_SECRET: state.jwtSecret,
      JWT_REFRESH_SECRET: crypto.randomBytes(48).toString("base64url"),
      ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"),
      CLIENT_ORIGIN: "http://localhost:3000",
      APP_URL: "http://localhost:3000",
      GMAIL_USER: "",
      GMAIL_APP_PASSWORD: "",
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
    state.col = db.col;
    closeDb = db.closeDb;
    server = createApp().listen(0);
    await new Promise((r) => server.once("listening", r));
    state.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });

  after(async () => {
    await new Promise((r) => server?.close(r));
    await closeDb?.();
    await mongo?.stop({ doCleanup: true, force: true });
    fs.rmSync(dbPath, { recursive: true, force: true });
  });

  return {
    sent,
    /** Mongo collections (available once `before` has run). */
    col: (): Col => state.col!,
    /** The JWT access secret used by this run. */
    jwtSecret: () => state.jwtSecret,
  };
}

// ── A tiny browser: keeps cookies, sends the CSRF header like the web app ──
export class Browser {
  cookies: Record<string, string> = {};
  csrf = "";
  async call(method: string, p: string, body?: unknown, opts: { csrf?: string | null; origin?: string; cookie?: string } = {}) {
    const headers: Record<string, string> = { cookie: opts.cookie ?? Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ") };
    if (body !== undefined) headers["content-type"] = "application/json";
    const csrf = opts.csrf === undefined ? this.csrf : opts.csrf;
    if (csrf) headers["x-csrf-token"] = csrf;
    if (opts.origin) headers.origin = opts.origin;
    const res = await fetch(state.base + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
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

export const tokenFrom = (to: string, kind: "verify-email" | "reset-password") => {
  const mail = [...sent].reverse().find((m) => m.to === to && m.text.includes(`/${kind}?token=`));
  assert.ok(mail, `expected a ${kind} email to ${to}`);
  return decodeURIComponent(mail.text.match(/token=([^\s]+)/)![1]);
};

export const PW = "Str0ngPassw0rd";

/** Registers and verifies a user, leaving `b` signed in with a CSRF token. */
export async function signUpVerified(b: Browser, user: { name: string; email: string; password?: string; age?: number }) {
  const r = await b.call("POST", "/auth/register", { password: PW, age: 30, ...user });
  assert.equal(r.status, 201, `register failed: ${JSON.stringify(r.body)}`);
  assert.equal((await b.call("POST", "/auth/verify-email", { token: tokenFrom(user.email, "verify-email") })).status, 200);
}
