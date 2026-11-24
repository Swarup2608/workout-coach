import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";
import { assertConfig, config } from "./config.js";
import { closeDb, connectDb } from "./db.js";
import { createApp } from "./app.js";

/** Connects to MongoDB and builds the Express app. Shared by the Vercel handler and the long-lived server. */
async function init(): Promise<Express> {
  assertConfig();
  try {
    await connectDb();
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    console.error("\nCould not connect to MongoDB:", msg.split("\n")[0]);
    if (/alert number 80|tlsv1 alert internal error|ServerSelection|ECONNREFUSED|ETIMEDOUT/i.test(msg))
      console.error(
        "  → Most likely your current IP isn't allowed. In MongoDB Atlas: Security → Network Access → Add IP Address\n" +
          "    (add your current IP, or 0.0.0.0/0 for testing / Vercel). Also check the cluster isn't paused.",
      );
    else if (/auth|bad auth|Authentication failed/i.test(msg))
      console.error("  → Check the username/password in MONGODB_URI (URL-encode special characters like @ : / ? # in the password).");
    throw e;
  }
  return createApp();
}

// Vercel (@vercel/node) calls this export per request and never runs listen(). The app is built once per warm
// instance, and a failed start is retried on the next request instead of crashing the function.
let ready: Promise<Express> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  ready ??= init().catch((e: unknown) => {
    ready = undefined;
    throw e;
  });

  let app: Express;
  try {
    app = await ready;
  } catch {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "Service is starting or misconfigured" }));
    return;
  }

  app(req as Parameters<Express>[0], res as Parameters<Express>[1]);
}

/** Long-lived server for npm run dev / npm start (and any always-on host). */
async function main(): Promise<void> {
  let app: Express;
  try {
    app = await init();
  } catch {
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`StarkFitIQ API → http://localhost:${config.port}/api`);
    console.log(`MongoDB connected (db "${config.mongoDb}"). AI keys are per user: Profile → AI provider.`);
    console.log(`Emails sent via Gmail from ${config.emailFrom}`);
  });

  for (const sig of ["SIGINT", "SIGTERM"] as const)
    process.on(sig, () => {
      server.close(() => closeDb().finally(() => process.exit(0)));
    });
}

// Vercel sets VERCEL=1; anywhere else (npm run dev, npm start) this file runs as a long-lived server.
if (!process.env.VERCEL) void main();
