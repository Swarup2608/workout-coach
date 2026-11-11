/**
 * One-off: copies the old single-user JSON database (server/data/db.json) into a registered account.
 *   npm run import-json -w server -- you@example.com [path/to/db.json]
 * Replaces that account's profile, plans, sessions, scores and chat.
 */
import fs from "node:fs";
import path from "node:path";
import type { ChatMessage, Profile, ScoreReport, WorkoutPlan, WorkoutSession } from "../domain.js";
import { assertConfig } from "../config.js";
import { closeDb, col, connectDb } from "../db.js";

const [email, file = "./data/db.json"] = process.argv.slice(2);
if (!email) {
  console.error("Usage: npm run import-json -w server -- <email> [db.json]");
  process.exit(1);
}

assertConfig();
await connectDb();
try {
  const user = await col.users().findOne({ email: email.trim().toLowerCase() });
  if (!user) throw new Error(`No account for ${email}. Sign up in the app first.`);
  const data = JSON.parse(fs.readFileSync(path.resolve(file), "utf8")) as {
    profile: Profile;
    plans: WorkoutPlan[];
    sessions: WorkoutSession[];
    scores: ScoreReport[];
    chat: ChatMessage[];
  };
  const userId = user._id;
  const own = <T extends object>(xs: T[] = []) => xs.map((x) => ({ ...x, userId }));
  await Promise.all([col.plans(), col.sessions(), col.scores(), col.chat()].map((c) => c.deleteMany({ userId })));
  await col.profiles().replaceOne({ _id: userId }, data.profile, { upsert: true });
  if (data.plans?.length) await col.plans().insertMany(own(data.plans));
  if (data.sessions?.length) await col.sessions().insertMany(own(data.sessions));
  if (data.scores?.length) await col.scores().insertMany(own(data.scores));
  if (data.chat?.length) await col.chat().insertMany(own(data.chat));
  console.log(`Imported into ${user.email}: ${data.plans?.length ?? 0} plans, ${data.sessions?.length ?? 0} sessions, ${data.scores?.length ?? 0} scores, ${data.chat?.length ?? 0} chat messages.`);
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
