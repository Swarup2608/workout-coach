import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { Checkin } from "../domain.js";
import { userRepo } from "../repo.js";
import { now } from "../util/id.js";
import { computeReadiness } from "../services/readiness.js";

/** Daily check-ins — mounted on the authenticated `api` router. The client sends its own local date. */
export const checkins = Router();

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
const DateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((d) => {
    const t = new Date(`${d}T00:00:00Z`);
    return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
  }, "Not a real date");

const Scale = z.number().int().min(1).max(5).nullable().optional();
const Body = z
  .object({
    weightKg: z.number().min(20).max(400).nullable().optional(),
    mood: Scale,
    sleep: z.enum(["poor", "ok", "good"]).nullable().optional(),
    soreness: Scale,
    energy: Scale,
    stress: Scale,
  })
  .strict()
  .refine((b) => Object.values(b).some((v) => v != null), "Add at least one answer");

/** Check-ins between two dates (inclusive), oldest first. Defaults to the last 14 days. */
checkins.get("/checkins", wrap(async (req, res) => {
  const to = DateParam.parse(String(req.query.to ?? new Date().toISOString().slice(0, 10)));
  const fromDefault = new Date(Date.parse(`${to}T00:00:00Z`) - 13 * 86400000).toISOString().slice(0, 10);
  const from = DateParam.parse(String(req.query.from ?? fromDefault));
  res.json(await userRepo(req.user!._id).checkins(from, to));
}));

checkins.get("/checkins/:date", wrap(async (req, res) => {
  const date = DateParam.parse(req.params.date);
  res.json(await userRepo(req.user!._id).checkin(date));
}));

checkins.put("/checkins/:date", wrap(async (req, res) => {
  const date = DateParam.parse(req.params.date);
  const b = Body.parse(req.body);
  const s5 = (v: number | null | undefined) => (v ?? null) as Checkin["mood"];
  const answers = { mood: s5(b.mood), sleep: b.sleep ?? null, soreness: s5(b.soreness), energy: s5(b.energy), stress: s5(b.stress) };
  const c: Checkin = { date, weightKg: b.weightKg ?? null, ...answers, readiness: computeReadiness(answers), updatedAt: now() };
  await userRepo(req.user!._id).upsertCheckin(c);
  res.json(c);
}));
