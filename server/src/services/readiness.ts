import type { Checkin, Readiness } from "../domain.js";

/**
 * Rule-based readiness from a daily check-in (no AI). Each answered signal becomes 0–100,
 * then a weighted average over the answered ones. Needs at least two signals to say anything.
 */
const WEIGHTS = { sleep: 0.3, energy: 0.25, soreness: 0.2, stress: 0.15, mood: 0.1 } as const;

const fromScale = (v: number) => ((v - 1) / 4) * 100; // 1..5 → 0..100

export function computeReadiness(c: Pick<Checkin, "sleep" | "mood" | "soreness" | "energy" | "stress">): Readiness | null {
  const signals: [keyof typeof WEIGHTS, number][] = [];
  if (c.sleep) signals.push(["sleep", { poor: 15, ok: 60, good: 100 }[c.sleep]]);
  if (c.energy != null) signals.push(["energy", fromScale(c.energy)]);
  if (c.soreness != null) signals.push(["soreness", 100 - fromScale(c.soreness)]);
  if (c.stress != null) signals.push(["stress", 100 - fromScale(c.stress)]);
  if (c.mood != null) signals.push(["mood", fromScale(c.mood)]);
  if (signals.length < 2) return null;

  const total = signals.reduce((a, [k]) => a + WEIGHTS[k], 0);
  const score = Math.round(signals.reduce((a, [k, v]) => a + WEIGHTS[k] * v, 0) / total);

  if (score >= 75) return { score, band: "push", label: "Ready to push", advice: "Good day to add a little weight or an extra rep where it feels solid." };
  if (score >= 50) return { score, band: "normal", label: "Train as planned", advice: "Stick to the plan. Keep 1–2 reps in reserve on the last sets." };
  return { score, band: "light", label: "Go lighter today", advice: "Drop one set per exercise and keep the weights you know, or swap to a mobility session." };
}
