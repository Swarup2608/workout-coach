import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { Checkin } from "../domain.js";
import { userRepo } from "../repo.js";
import { now } from "../util/id.js";

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

const Body = z
  .object({
    weightKg: z.number().min(20).max(400).nullable().optional(),
    mood: z.number().int().min(1).max(5).nullable().optional(),
    sleep: z.enum(["poor", "ok", "good"]).nullable().optional(),
  })
  .strict()
  .refine((b) => b.weightKg != null || b.mood != null || b.sleep != null, "Add your weight, mood or sleep");

checkins.get("/checkins/:date", wrap(async (req, res) => {
  const date = DateParam.parse(req.params.date);
  res.json(await userRepo(req.user!._id).checkin(date));
}));

checkins.put("/checkins/:date", wrap(async (req, res) => {
  const date = DateParam.parse(req.params.date);
  const b = Body.parse(req.body);
  const c: Checkin = { date, weightKg: b.weightKg ?? null, mood: (b.mood ?? null) as Checkin["mood"], sleep: b.sleep ?? null, updatedAt: now() };
  await userRepo(req.user!._id).upsertCheckin(c);
  res.json(c);
}));
