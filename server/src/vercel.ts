/**
 * Vercel serverless entry. index.ts is the long-running server (local dev / always-on hosts):
 * it connects at startup and calls listen(). On Vercel each instance instead handles requests
 * through this exported handler, connecting to MongoDB lazily on the first request and reusing
 * that connection while the instance stays warm.
 *
 * Bundled by `npm run build:vercel` to dist/vercel.js, which api/index.js re-exports — so Vercel
 * runs plain JavaScript and never compiles TypeScript itself (its builder can't use TypeScript 7).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { assertConfig } from "./config.js";
import { connectDb } from "./db.js";
import { createApp } from "./app.js";

const app = createApp();
let ready: Promise<unknown> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= (async () => {
    assertConfig(); // exits with a clear list of missing env vars, visible in the Vercel function logs
    await connectDb();
  })().catch((e) => {
    ready = null; // let the next request retry instead of caching the failure
    throw e;
  });

  try {
    await ready;
  } catch (e) {
    console.error("MongoDB connection failed:", String((e as Error)?.message ?? e).split("\n")[0]);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Service unavailable" }));
    return;
  }

  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
