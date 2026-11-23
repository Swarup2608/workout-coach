"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { NutritionDay } from "@/lib/domain";
import { api, today } from "@/lib/api";
import { Icon } from "@/components/Icons";
import { DATA_CHANGED } from "@/components/coach/actions";

/** One colour per nutrient, used on every nutrition view. */
export const MACRO_COLOR = { kcal: "var(--accent)", protein: "var(--good)", carbs: "var(--pulse)", fat: "var(--warn)", water: "var(--ice)" } as const;

const fmt = (n: number, decimals = 0) => n.toLocaleString(undefined, { maximumFractionDigits: decimals });

/** Calorie ring: eaten against the target, with what's left (or over) in the middle. */
export function CalorieRing({ eaten, target, size = 168 }: { eaten: number; target: number | null; size?: number }) {
  const stroke = Math.max(8, Math.round(size / 14));
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const pct = target ? Math.min(1, eaten / target) : 0;
  const over = target != null && eaten > target;
  const left = target != null ? target - eaten : null;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={target ? `${fmt(eaten)} of ${fmt(target)} kcal eaten` : `${fmt(eaten)} kcal eaten`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-700)" strokeWidth={stroke} fill="none" />
      {target != null && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? "var(--warn)" : MACRO_COLOR.kcal}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      )}
      <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" className="fill-fg font-display" fontSize={size * 0.2} fontWeight={700}>
        {left != null ? fmt(Math.abs(left)) : fmt(eaten)}
      </text>
      <text x="50%" y="63%" textAnchor="middle" className="fill-ink-400" fontSize={Math.max(10, size * 0.075)}>
        {left == null ? "kcal eaten" : over ? "kcal over" : "kcal left"}
      </text>
    </svg>
  );
}

/** A labelled progress bar for one nutrient. */
export function MacroBar({ label, value, target, unit = "g", color }: { label: string; value: number; target: number | null; unit?: string; color: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const d = unit === "L" ? 2 : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-200">{label}</span>
        <span className="tabular-nums text-fg">
          <strong className="font-display text-base">{fmt(value, d)}</strong>
          {target != null && <span className="text-ink-400"> / {fmt(target, d)}</span>} <span className="text-xs text-ink-400">{unit}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={target ?? undefined}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** "Add your height and weight" prompt when targets can't be worked out yet. */
export function MissingTargets({ missing }: { missing: NutritionDay["missing"] }) {
  if (!missing.length) return null;
  const words = missing.map((m) => (m === "weight" ? "bodyweight" : m));
  return (
    <p className="rounded-lg border border-ink-700 bg-ink-800/40 px-3 py-2 text-xs text-ink-400">
      Add your {words.join(" and ")} in{" "}
      <Link href="/profile" className="link">
        Profile
      </Link>{" "}
      to get daily calorie and protein targets.
    </p>
  );
}

/** Today's food at a glance, for the Today page. */
export function NutritionCard() {
  const [day, setDay] = useState<NutritionDay | null>(null);
  useEffect(() => {
    const load = () => api.nutritionDay(today()).then(setDay).catch(() => {});
    load();
    window.addEventListener(DATA_CHANGED, load);
    return () => window.removeEventListener(DATA_CHANGED, load);
  }, []);
  if (!day) return null;
  const t = day.targets;
  return (
    <section className="card flex flex-col gap-4 sm:flex-row sm:items-center">
      <Link href="/nutrition" aria-label="Open nutrition" className="self-center">
        <CalorieRing eaten={day.totals.kcal} target={t?.kcal ?? null} size={128} />
      </Link>
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="h-display text-lg">Food today</h2>
          <span className="text-xs text-ink-400">{day.trainingDay ? "Training day" : "Rest day"}</span>
        </div>
        <MacroBar label="Protein" value={day.totals.proteinG} target={t?.proteinG ?? null} color={MACRO_COLOR.protein} />
        <MacroBar label="Water" value={day.log.waterMl / 1000} target={t ? t.waterMl / 1000 : null} unit="L" color={MACRO_COLOR.water} />
        {!t && <MissingTargets missing={day.missing} />}
        <div className="flex flex-wrap gap-2">
          <Link href="/nutrition/add" className="btn btn-primary">
            <Icon name="plus" size={16} /> Add food
          </Link>
          <Link href="/nutrition" className="btn btn-ghost">
            View day
          </Link>
        </div>
      </div>
    </section>
  );
}
