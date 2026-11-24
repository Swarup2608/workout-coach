import { Router, type NextFunction, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";
import { userRepo } from "../repo.js";
import { aiForUser } from "../services/ai.js";
import { checkPastedPlan, generatePlan, pastePrompt, starterInputFrom } from "../services/planGenerator.js";

/**
 * AI plan generator. Nothing here saves a plan: the client shows the preview and, on "Use this plan",
 * saves its Markdown through the normal POST /plans (which makes it the active plan).
 */
export const planGen = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const genLimit = rateLimit({
  windowMs: 10 * 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id ?? ipKeyGenerator(req.ip ?? ""),
  message: { error: "Too many plans in a short time. Try again in a few minutes." },
});

const Notes = z.object({ notes: z.string().max(500).default("") }).strict();

async function inputFor(req: Request, res: Response) {
  const input = starterInputFrom(await userRepo(req.user!._id).profile());
  if (!input) res.status(422).json({ error: "Finish setup first (goal, experience, days per week, session length and equipment).", code: "setup" });
  return input;
}

planGen.post("/plans/generate", genLimit, wrap(async (req, res) => {
  const { notes } = Notes.parse(req.body ?? {});
  const input = await inputFor(req, res);
  if (!input) return;
  const ai = aiForUser(req.user!);
  if (!ai) return res.status(409).json({ error: "No AI connected. Use the prompt to get a plan from Claude, or connect an AI under Profile → AI coach.", code: "no_ai" });
  try {
    res.json(await generatePlan(ai, input, notes));
  } catch (e) {
    res.status(502).json({ error: `${ai.label} couldn't write the plan: ${(e as Error).message}` });
  }
}));

/** The no-key path: a prompt to paste into Claude. */
planGen.post("/plans/generate/prompt", wrap(async (req, res) => {
  const { notes } = Notes.parse(req.body ?? {});
  const input = await inputFor(req, res);
  if (input) res.json({ text: pastePrompt(input, notes) });
}));

/** Checks a plan pasted back from Claude against the same rules, and previews it. */
planGen.post("/plans/generate/check", wrap(async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(1).max(20_000) }).strict().parse(req.body);
  const input = await inputFor(req, res);
  if (!input) return;
  const preview = checkPastedPlan(text, input);
  if (!preview.days.some((d) => !d.isRest && d.exercises.length)) return res.status(422).json({ error: "No exercises found. Paste the whole reply, including the ## day headings." });
  res.json(preview);
}));
