import { Router, type NextFunction, type Request, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";
import { AI_PROVIDERS, type AiProviderId, type AiSettings } from "../domain.js";
import { col, type UserDoc } from "../db.js";
import { decryptSecret, encryptSecret } from "../auth/secretBox.js";
import { aiForUser, assertPublicUrl, makeClient, testClient } from "../services/ai.js";

/** Mounted behind requireAuth: every route acts on req.user only. */
export const settings = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const view = (u: UserDoc): AiSettings =>
  u.ai
    ? { configured: true, provider: u.ai.provider, model: u.ai.model, baseUrl: u.ai.baseUrl, keyHint: u.ai.keyHint, updatedAt: u.ai.updatedAt.toISOString() }
    : { configured: false, provider: null, model: null, baseUrl: null, keyHint: null, updatedAt: null };

// Each save/test makes a paid call with the user's key; keep it bounded.
const testLimit = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id ?? ipKeyGenerator(req.ip ?? ""),
  message: { error: "Too many key tests. Try again in a few minutes." },
});

const SaveSchema = z.object({
  provider: z.enum(AI_PROVIDERS.map((p) => p.id) as [AiProviderId, ...AiProviderId[]]),
  model: z.string().trim().min(1, "Model is required").max(120).regex(/^[\w.:/@-]+$/, "Model name has invalid characters"),
  /** Only used for "custom"; presets always use their official URL */
  baseUrl: z.string().trim().max(300).optional(),
  /** Omit to keep the saved key (e.g. when only switching model) */
  apiKey: z.string().trim().min(8, "That doesn't look like an API key").max(500).optional(),
});

settings.get("/ai", (req, res) => res.json(view(req.user!)));

settings.put("/ai", testLimit, wrap(async (req, res) => {
  const input = SaveSchema.parse(req.body);
  const user = req.user!;
  const preset = AI_PROVIDERS.find((p) => p.id === input.provider)!;
  const baseUrl = input.provider === "custom" ? (input.baseUrl ?? "") : preset.baseUrl;
  if (input.provider === "custom") {
    if (!baseUrl) return res.status(400).json({ error: "Base URL is required for a custom provider" });
    try {
      await assertPublicUrl(baseUrl);
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
  }

  // A saved key is reused only for the same provider + endpoint, so it can never be sent somewhere new.
  const sameEndpoint = user.ai && user.ai.provider === input.provider && user.ai.baseUrl === baseUrl;
  let apiKey = input.apiKey;
  if (!apiKey && sameEndpoint) apiKey = decryptSecret(user.ai!.keyEnc, user._id);
  if (!apiKey) return res.status(400).json({ error: "Enter your API key" });

  try {
    await testClient(makeClient({ provider: input.provider, model: input.model, baseUrl, apiKey }));
  } catch (e) {
    return res.status(422).json({ error: `Key check failed: ${(e as Error).message}` });
  }

  const ai = { provider: input.provider, model: input.model, baseUrl, keyEnc: encryptSecret(apiKey, user._id), keyHint: apiKey.slice(-4), updatedAt: new Date() };
  await col.users().updateOne({ _id: user._id }, { $set: { ai, updatedAt: new Date() } });
  res.json(view({ ...user, ai }));
}));

settings.post("/ai/test", testLimit, wrap(async (req, res) => {
  const ai = aiForUser(req.user!);
  if (!ai) return res.status(400).json({ error: "No API key saved yet" });
  try {
    res.json({ ok: true, label: ai.label, reply: await testClient(ai) });
  } catch (e) {
    res.status(422).json({ ok: false, error: (e as Error).message });
  }
}));

settings.delete("/ai", wrap(async (req, res) => {
  await col.users().updateOne({ _id: req.user!._id }, { $unset: { ai: "" }, $set: { updatedAt: new Date() } });
  res.status(204).end();
}));
