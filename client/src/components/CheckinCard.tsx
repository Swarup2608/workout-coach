"use client";

import { useState } from "react";
import type { Checkin } from "@/lib/domain";
import { api, today } from "@/lib/api";
import { fromDisplay, unitLabel, useUnits } from "@/lib/units";
import { ErrorNote, Spinner } from "@/components/ui";

const MOODS: { value: NonNullable<Checkin["mood"]>; emoji: string; label: string }[] = [
  { value: 1, emoji: "😣", label: "Very low" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];
const SLEEP: { value: NonNullable<Checkin["sleep"]>; label: string }[] = [
  { value: "poor", label: "Poor" },
  { value: "ok", label: "OK" },
  { value: "good", label: "Good" },
];

/** Daily check-in: shows until today's check-in is saved; any one field is enough. */
export function CheckinCard({ onSaved }: { onSaved: (c: Checkin) => void }) {
  const { units } = useUnits();
  const [weight, setWeight] = useState("");
  const [mood, setMood] = useState<Checkin["mood"]>(null);
  const [sleep, setSleep] = useState<Checkin["sleep"]>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weightNum = weight.trim() === "" ? null : Number(weight);
  const weightKg = fromDisplay(weightNum, units);
  const weightBad = weightNum != null && (weightKg == null || weightKg < 20 || weightKg > 400);
  const canSave = !weightBad && (weightKg != null || mood != null || sleep != null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.saveCheckin(today(), { weightKg, mood, sleep }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={save} aria-labelledby="checkin-title" noValidate>
      <h2 id="checkin-title" className="h-display text-2xl">
        How are you today?
      </h2>
      <p className="mt-1 text-sm text-ink-400">A 10-second check-in. Fill in any one and save.</p>
      <div className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="w-40">
          <label className="label" htmlFor="ci-weight">
            Weight ({unitLabel(units)})
          </label>
          <input id="ci-weight" type="number" inputMode="decimal" step="0.1" className="input" value={weight} onChange={(e) => setWeight(e.target.value)} />
          {weightBad && <p className="mt-1 text-xs text-warn">That weight looks off.</p>}
        </div>
        <fieldset>
          <legend className="label">Mood</legend>
          <div className="flex gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={mood === m.value}
                aria-label={m.label}
                title={m.label}
                onClick={() => setMood(mood === m.value ? null : m.value)}
                className={`h-11 w-11 rounded-xl border text-xl transition ${mood === m.value ? "border-volt-bright bg-volt-bright/10" : "border-ink-700 hover:border-volt-bright/50"}`}
              >
                <span aria-hidden>{m.emoji}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Sleep</legend>
          <div className="flex gap-1.5">
            {SLEEP.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={sleep === s.value}
                onClick={() => setSleep(sleep === s.value ? null : s.value)}
                className={`h-11 rounded-xl border px-3 text-sm transition ${sleep === s.value ? "border-volt-bright bg-volt-bright/10" : "border-ink-700 hover:border-volt-bright/50"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="mt-4">
        <ErrorNote error={error} />
      </div>
      <button className="btn btn-primary mt-2" disabled={!canSave || busy}>
        {busy && <Spinner />} Save check-in
      </button>
    </form>
  );
}
