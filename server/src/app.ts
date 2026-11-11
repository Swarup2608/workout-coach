import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { ZodError } from "zod";
import { config } from "./config.js";
import { originGuard, requireVerifiedUser } from "./auth/middleware.js";
import { auth } from "./routes/auth.js";
import { settings } from "./routes/settings.js";
import { api } from "./routes/api.js";

/** The Express app without listening or connecting: index.ts runs it, tests mount it on a random port. */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.clientOrigins.includes(origin)),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(originGuard);
  // Auth responses and personal data must never be cached by browsers or proxies.
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many requests" } }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", auth);
  // App data needs a signed-in user with a verified email (when REQUIRE_EMAIL_VERIFICATION is on).
  app.use("/api/settings", requireVerifiedUser, settings);
  app.use("/api", requireVerifiedUser, api);

  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) return res.status(400).json({ error: err.issues[0]?.message ?? "Invalid input", details: err.issues });
    if ((err as { type?: string }).type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
    console.error(err);
    // Don't leak internals (stack traces, DB errors) in production.
    const message = !config.isProd && err instanceof Error ? err.message : "Server error";
    if (!res.headersSent) res.status(500).json({ error: message });
  });

  return app;
}
