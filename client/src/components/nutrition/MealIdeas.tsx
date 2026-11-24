"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MEALS, MEAL_LABELS, mealForNow, type Meal, type MealOption, type MealSuggestions } from "@/lib/domain";
import { api } from "@/lib/api";
import { Icon } from "@/components/Icons";
import { ErrorNote, Spinner } from "@/components/ui";
import { notifyDataChanged } from "@/components/coach/actions";

/** One suggested meal: its foods, totals, why it fits, and an Add button. */
export function MealOptionCard({ o, label, busy, onAdd }: { o: MealOption; label: string; busy: boolean; onAdd: () => void }) {
  return (
    <div className="space-y-2 rounded-lg border border-ink-700 p-3">
      <ul className="space-y-0.5 text-sm">
        {o.items.map((i) => (
          <li key={i.foodId} className="flex justify-between gap-3">
            <span className="min-w-0 truncate text-fg">
              {i.servings !== 1 && <span className="tabular-nums text-ink-400">{i.servings} × </span>}
              {i.name}
            </span>
            <span className="shrink-0 tabular-nums text-ink-400">{i.kcal}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-400">
        {o.totals.proteinG} g P · {o.totals.carbsG} g C · {o.totals.fatG} g F · {o.why}
      </p>
      <button className="btn btn-ghost w-full justify-center" onClick={onAdd} disabled={busy}>
        {busy ? <Spinner /> : <Icon name="plus" size={16} />} {label}
      </button>
    </div>
  );
}

/** "What should I eat now?": three ideas for the next meal that fit what's left today. */
export function MealIdeas({ date }: { date: string }) {
  const [meal, setMeal] = useState<Meal>(mealForNow());
  const [seed, setSeed] = useState(0);
  const [data, setData] = useState<MealSuggestions | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.suggestMeal(date, meal, seed).then(setData).catch((e) => setError(e.message));
  }, [date, meal, seed]);
  useEffect(load, [load]);

  const add = async (o: MealOption, i: number) => {
    if (!data) return;
    setBusy(i);
    setError(null);
    try {
      await api.addMeal(date, data.meal, o.items.map(({ foodId, servings }) => ({ foodId, servings })));
      setAdded(`Added to ${MEAL_LABELS[data.meal].toLowerCase()}: ${o.items.map((x) => x.name).join(", ")}.`);
      notifyDataChanged();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card space-y-3" aria-label="What should I eat now">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h-display text-lg">What should I eat now?</h2>
        <div className="flex items-center gap-2">
          <select className="input w-auto py-1.5 text-sm" value={meal} onChange={(e) => setMeal(e.target.value as Meal)} aria-label="Meal">
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABELS[m]}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => setSeed((s) => s + 1)} aria-label="Show other ideas">
            Shuffle
          </button>
        </div>
      </div>
      {data && (
        <p className="text-xs text-ink-400">
          {data.full
            ? "You've reached today's calories. If you're hungry, these are light and high in protein."
            : `About ${data.budget.kcal} kcal and ${data.budget.proteinG} g protein fits ${MEAL_LABELS[data.meal].toLowerCase()}, from what's left today.`}
          {data.assumed && " Using a typical 2000 kcal day until your profile has age, height and weight."}
        </p>
      )}
      {added && (
        <p className="text-sm text-good" role="status">
          {added}
        </p>
      )}
      <ErrorNote error={error} />
      {!data && !error ? (
        <Spinner />
      ) : data?.options.length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {data.options.map((o, i) => (
            <MealOptionCard key={o.items.map((x) => x.foodId).join("+")} o={o} label={`Add to ${MEAL_LABELS[data.meal].toLowerCase()}`} busy={busy === i} onAdd={() => add(o, i)} />
          ))}
        </div>
      ) : (
        data && <p className="text-sm text-ink-400">No ideas fit your diet and budget right now.</p>
      )}
      <Link href={`/nutrition/plan?date=${date}`} className="inline-flex text-sm link">
        Plan the whole day →
      </Link>
    </section>
  );
}
