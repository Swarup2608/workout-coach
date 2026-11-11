import { assertConfig, config } from "./config.js";
import { closeDb, connectDb } from "./db.js";
import { createApp } from "./app.js";

assertConfig();
try {
  await connectDb();
} catch (e) {
  const msg = String((e as Error)?.message ?? e);
  console.error("\nCould not connect to MongoDB:", msg.split("\n")[0]);
  if (/alert number 80|tlsv1 alert internal error|ServerSelection|ECONNREFUSED|ETIMEDOUT/i.test(msg))
    console.error(
      "  → Most likely your current IP isn't allowed. In MongoDB Atlas: Security → Network Access → Add IP Address\n" +
        "    (add your current IP, or 0.0.0.0/0 for testing). Also check the cluster isn't paused.",
    );
  else if (/auth|bad auth|Authentication failed/i.test(msg))
    console.error("  → Check the username/password in MONGODB_URI (URL-encode special characters like @ : / ? # in the password).");
  process.exit(1);
}

const server = createApp().listen(config.port, () => {
  console.log(`StarkFitIQ API → http://localhost:${config.port}/api`);
  console.log(`MongoDB connected (db "${config.mongoDb}"). AI keys are per user: Profile → AI provider.`);
  console.log(config.resendApiKey ? `Emails sent via Resend from ${config.emailFrom}` : "No RESEND_API_KEY: emails are printed here instead of sent (dev mode).");
});

for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, () => {
    server.close(() => closeDb().finally(() => process.exit(0)));
  });
