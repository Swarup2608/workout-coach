/**
 * Throwaway API for recording demos (docs/onboarding/record-demo.mjs, docs/workflow/record-demo.mjs).
 * DEMO_DB picks the database name; it must contain "demo".
 * - Local MongoDB, separate database (dropped on start and on exit), never your real data.
 * - Email verification off, and emails are printed instead of sent (no Gmail traffic).
 * Usage: DEMO_API_PORT=4100 DEMO_CLIENT_ORIGIN=http://localhost:3100 npx tsx src/scripts/demoServer.ts
 */
export {};

const port = Number(process.env.DEMO_API_PORT ?? 4100);
const db = process.env.DEMO_DB ?? "starkfitiq_onboarding_demo";

// Set before config.ts loads: dotenv never overrides variables that already exist.
Object.assign(process.env, {
  MONGODB_URI: process.env.DEMO_MONGODB_URI ?? "mongodb://127.0.0.1:27017",
  MONGODB_DB: db,
  PORT: String(port),
  CLIENT_ORIGIN: process.env.DEMO_CLIENT_ORIGIN ?? "http://localhost:3100",
  APP_URL: process.env.DEMO_CLIENT_ORIGIN ?? "http://localhost:3100",
  REQUIRE_EMAIL_VERIFICATION: "false",
  NODE_ENV: "development",
  COOKIE_SECURE: "false",
  COOKIE_SAMESITE: "lax",
  GMAIL_USER: "demo@example.com",
  GMAIL_APP_PASSWORD: "not-used",
});

const { connectDb, closeDb } = await import("../db.js");
const { setEmailTransport } = await import("../services/email.js");
const { createApp } = await import("../app.js");

setEmailTransport(async (e) => console.log(`[demo] email to ${e.to} not sent: ${e.subject}`));
const conn = await connectDb();
if (conn.databaseName !== db || !db.includes("demo")) throw new Error(`Refusing to run: connected to ${conn.databaseName}`);
await conn.dropDatabase();
await closeDb();
await connectDb(); // reconnect so indexes are recreated on the fresh database

const server = createApp().listen(port, () => console.log(`[demo] API on http://localhost:${port}/api (db ${db})`));

async function shutdown() {
  server.close();
  const { MongoClient } = await import("mongodb");
  const c = new MongoClient(process.env.MONGODB_URI!);
  await c.connect();
  await c.db(db).dropDatabase();
  await c.close();
  await closeDb();
  console.log("[demo] stopped, demo database dropped");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
