"use client";

import { useEffect, useState } from "react";
import type { Units } from "@/lib/domain";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

/** Weights are always stored in kg; the unit only changes what's shown and typed. */
export const LB_PER_KG = 2.20462;

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

/** Stored kg → number to show, to 1 decimal place. */
export function toDisplay(kg: number | null | undefined, units: Units): number | null {
  if (kg == null || !Number.isFinite(kg)) return null;
  return round(units === "lb" ? kg * LB_PER_KG : kg, 1);
}

/** Typed value → kg to store. Kept to 3 dp so 180 lb reloads as 180.0 lb, not 179.9. */
export function fromDisplay(v: number | null | undefined, units: Units): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return round(units === "lb" ? v / LB_PER_KG : v, 3);
}

export const unitLabel = (units: Units): "kg" | "lb" => units;

// ── Shared unit preference, cached per signed-in user ──
// The cache is keyed by user id: signing out or switching accounts drops it and reloads
// from the new user's profile, so one user's unit never shows for another.
let current: Units = "kg";
let owner: string | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(u: Units) => void>();

function publish(u: Units) {
  current = u;
  listeners.forEach((l) => l(u));
}

/** Call after saving a new unit so every mounted component updates. */
export function setUnitsLocally(u: Units) {
  publish(u);
}

function ensureFor(userId: string | null) {
  if (userId === owner && (loading || !userId)) return;
  owner = userId;
  publish("kg");
  loading = null;
  if (!userId) return;
  const mine = api
    .profile()
    .then((p) => {
      if (owner === userId) publish(p.units ?? "kg");
    })
    .catch(() => {
      if (owner === userId) loading = null; // retry on the next mount
    });
  loading = mine;
}

export function useUnits(): { units: Units; setUnits: (u: Units) => void } {
  const userId = useAuth().user?.id ?? null;
  const [units, set] = useState<Units>(userId === owner ? current : "kg");
  useEffect(() => {
    listeners.add(set);
    ensureFor(userId);
    set(current);
    return () => void listeners.delete(set);
  }, [userId]);
  return { units, setUnits: setUnitsLocally };
}

// ── Height: stored in cm, shown in cm or inches ──
export const CM_PER_IN = 2.54;
export const cmToDisplay = (cm: number | null | undefined, unit: "cm" | "in") =>
  cm == null ? null : unit === "in" ? Math.round((cm / CM_PER_IN) * 10) / 10 : Math.round(cm);
export const displayToCm = (v: number | null, unit: "cm" | "in") => (v == null || !Number.isFinite(v) ? null : unit === "in" ? Math.round(v * CM_PER_IN * 10) / 10 : v);
