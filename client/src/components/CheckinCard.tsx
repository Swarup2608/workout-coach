"use client";

import { useState } from "react";
import type { Checkin, Readiness, Scale5 } from "@/lib/domain";
import { api, today } from "@/lib/api";
import { fromDisplay, toDisplay, unitLabel, useUnits } from "@/lib/units";
import { ErrorNote, Spinner } from "@/components/ui";
import { Icon, MOOD_ICONS } from "@/components/Icons";

export const MOODS: { value: Scale5; label: string }[] = [
  { value: 1, label: "Very low" },
  { value: 2, label: "Low" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];
const SLEEP: { value: NonNullable<Checkin["sleep"]>; label: string }[] = [
  { value: "poor", label: "Poor" },
  { value: "ok", label: "OK" },
  { value: "good", label: "Good" },
];
const SCALES: { key: "energy" | "soreness" | "stress"; label: string; low: string; high: string }[] = [
  { key: "energy", label: "Energy", low: "Drained", high: "Full" },
  { key: "soreness", label: "Soreness", low: "Fresh", high: "Very sore" },
  { key: "stress", label: "Stress", low: "Calm", high: "Very stressed" },
];

export const READINESS_STYLE: Record<Readiness["band"], string> = {
  push: "border-good/50 bg-good/10 text-good",
  normal: "border-volt/50 bg-volt/10 text-volt-bright",
  light: "border-warn/50 bg-warn/10 text-warn",
};

export function ReadinessChip({ r }: { r: Readiness }) {
  return (
    <span className={`t-badge inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${READINESS_STYLE[r.band]}`}>
      {r.label} <span className="tabular-nums opacity-80">{r.score}</span>
    </span>
  );
}

/** Daily check-in. Any one answer is enough; two or more give a readiness verdict. */
export function CheckinCard({ onSaved, initial, date = today(), large = false, bare = false }: { onSaved: (c: Checkin) => void; initial?: Checkin | null; date?: string; large?: boolean; /** no card chrome (inside a modal) */ bare?: boolean }) {
  const { units } = useUnits();
  const [weight, setWeight] = useState(initial?.weightKg != null ? String(toDisplay(initial.weightKg, units)) : "");
  const [mood, setMood] = useState<Checkin["mood"]>(initial?.mood ?? null);
  const [sleep, setSleep] = useState<Checkin["sleep"]>(initial?.sleep ?? null);
  const [scales, setScales] = useState<Record<"energy" | "soreness" | "stress", Scale5 | null>>({
    energy: initial?.energy ?? null,
    soreness: initial?.soreness ?? null,
    stress: initial?.stress ?? null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weightNum = weight.trim() === "" ? null : Number(weight);
  const weightKg = fromDisplay(weightNum, units);
  const weightBad = weightNum != null && (weightKg == null || weightKg < 20 || weightKg > 400);
  const canSave = !weightBad && (weightKg != null || mood != null || sleep != null || Object.values(scales).some((v) => v != null));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.saveCheckin(date, { weightKg, mood, sleep, ...scales }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const pill = (on: boolean) => `h-11 rounded-xl border text-sm transition ${on ? "border-volt-bright bg-volt-bright/10 text-fg" : "border-ink-700 hover:border-volt-bright/50"}`;

  return (
    <form className={bare ? "p-6" : "card"} onSubmit={save} aria-labelledby="checkin-title" noValidate>
      <h2 id="checkin-title" className="h-display pr-10 text-2xl">
        How are you today?
      </h2>
      <p className="mt-1 text-sm text-ink-400">A 20-second check-in. Answer two or more to get today&apos;s readiness.</p>
      <div className={`mt-4 grid gap-x-8 gap-y-4 ${large ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        <div>
          <label className="label" htmlFor="ci-weight">
            Weight
          </label>
          <div className="relative max-w-44">
            <input
              id="ci-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder={units === "lb" ? "e.g. 165" : "e.g. 72.5"}
              className="input h-11 pr-12 text-base"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-400">{unitLabel(units)}</span>
          </div>
          {weightBad && <p className="mt-1 text-xs text-warn">That weight looks off.</p>}
        </div>
        <fieldset>
          <legend className="label">Mood</legend>
          <div className="flex gap-1.5">
            {MOODS.map((m) => (
              <button key={m.value} type="button" aria-pressed={mood === m.value} aria-label={m.label} title={m.label} onClick={() => setMood(mood === m.value ? null : m.value)} className={`${pill(mood === m.value)} grid w-11 place-items-center ${mood === m.value ? "text-volt-bright" : ""}`}>
                <Icon name={MOOD_ICONS[m.value - 1]} size={22} />
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Sleep</legend>
          <div className="flex gap-1.5">
            {SLEEP.map((s) => (
              <button key={s.value} type="button" aria-pressed={sleep === s.value} onClick={() => setSleep(sleep === s.value ? null : s.value)} className={`${pill(sleep === s.value)} px-3`}>
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>
        {SCALES.map((sc) => (
          <fieldset key={sc.key}>
            <legend className="label">{sc.label}</legend>
            <div className="flex items-center gap-1.5">
              {([1, 2, 3, 4, 5] as Scale5[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={scales[sc.key] === n}
                  aria-label={`${sc.label} ${n} of 5${n === 1 ? ` (${sc.low})` : n === 5 ? ` (${sc.high})` : ""}`}
                  onClick={() => setScales((s) => ({ ...s, [sc.key]: s[sc.key] === n ? null : n }))}
                  className={`${pill(scales[sc.key] === n)} w-10`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1 flex max-w-[14.5rem] justify-between text-[11px] text-ink-400">
              <span>{sc.low}</span>
              <span>{sc.high}</span>
            </p>
          </fieldset>
        ))}
      </div>
      <div className="mt-4">
        <ErrorNote error={error} />
      </div>
      <button className="btn btn-primary mt-2" disabled={!canSave || busy}>
        {busy && <Spinner />} {initial ? "Update check-in" : "Save check-in"}
      </button>
    </form>
  );
}
