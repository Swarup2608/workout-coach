import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { config, claudeEnabled } from "./config.js";
import { load } from "./store.js";
import { initialDb } from "./seed/index.js";
import { api } from "./routes/api.js";

load(initialDb);

const app = express();
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: "2mb" }));
app.use("/api", api);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) return res.status(400).json({ error: "Invalid input", details: err.issues });
  console.error(err);
  const message = err instanceof Error ? err.message : "Server error";
  if (!res.headersSent) res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Workout Coach API → http://localhost:${config.port}/api`);
  console.log(claudeEnabled() ? `Claude connected (${config.model})` : "Claude offline — set ANTHROPIC_API_KEY in server/.env");
});
