"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { MEAL_LABELS, type DayMealPlan, type Macros, type Meal } from "@/lib/domain";
import { api, today } from "@/lib/api";
import { ErrorNote, Spinner } from "@/components/ui";
import { useCoachContext } from "@/components/coach/CoachProvider";
import { notifyDataChanged } from "@/components/coach/actions";
import { MACRO_COLOR, MacroBar } from "@/components/nutrition/NutritionUi";
import { MealOptionCard } from "@/components/nutrition/MealIdeas";

export default function MealPlanPage() {
  return (
    <Suspense fallback={<div className="card">Loading…</div>}>
      <MealPlan />
    </Suspense>
  );
}

const sum = (xs: Macros[]): Macros => xs.reduce((a, m) => ({ kcal: a.kcal + m.kcal, proteinG: a.proteinG + m.proteinG, carbsG: a.carbsG + m.carbsG, fatG: a.fatG + m.fatG }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
const r = (n: number) => Math.round(n);

function MealPlan() {
  const params = useSearchParams();
  const t = today();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? params.get("date")! : t;
  const [seed, setSeed] = useState(0);
  const [plan, setPlan] = useState<DayMealPlan | null>(null);
  /** Which option is showing for each meal (Swap moves to the next). */
  const [pick, setPick] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<Meal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const back = `/nutrition${date !== t ? `?date=${date}` : ""}`;

  const load = useCallback(() => {
    setError(null);
    api
      .mealPlan(date, seed)
      .then((p) => {
        setPlan(p);
        setPick({});
      })
      .catch((e) => setError(e.message));
  }, [date, seed]);
  useEffect(load, [load]);

  const chosen = plan?.meals.map((m) => ({ ...m, option: m.options[(pick[m.meal] ?? 0) % Math.max(1, m.options.length)] })) ?? [];
  const totals = sum(chosen.filter((c) => c.option).map((c) => c.option.totals));
  useCoachContext("Meal plan", plan ? `${date}: plan of ${totals.kcal} kcal / ${r(totals.proteinG)} g protein against ${plan.targets.kcal} kcal / ${plan.targets.proteinG} g` : undefined);

  const addMeals = async (meals: typeof chosen) => {
    setBusy(meals.length > 1 ? "all" : meals[0].meal);
    setError(null);
    try {
      for (const m of meals) {
        await api.addMeal(date, m.meal, m.option.items.map(({ foodId, servings }) => ({ foodId, servings })));
        setAdded((xs) => [...xs, m.meal]);
      }
      notifyDataChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={back} className="text-sm link">
            ← Nutrition
          </Link>
          <h1 className="t-workout text-fg text-4xl">Meal plan</h1>
          <p className="text-sm text-ink-400">
            {date === t ? "Today" : new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · built from the food database to fit your targets
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setSeed((s) => s + 1)} disabled={!!busy}>
            New plan
          </button>
          {plan && (
            <button className="btn btn-primary" disabled={!!busy || chosen.every((c) => added.includes(c.meal))} onClick={() => addMeals(chosen.filter((c) => c.option && !added.includes(c.meal)))}>
              {busy === "all" && <Spinner />} Log the whole day
            </button>
          )}
        </div>
      </header>

      <ErrorNote error={error} />
      {!plan ? (
        !error && <div className="card">Loading…</div>
      ) : (
        <>
          <section className="card space-y-4">
            <p className="text-sm">
              <strong className="font-display text-2xl text-fg">{totals.kcal.toLocaleString()}</strong>
              <span className="text-ink-400"> of {plan.targets.kcal.toLocaleString()} kcal planned</span>
            </p>
            <MacroBar label="Protein" value={r(totals.proteinG)} target={plan.targets.proteinG} color={MACRO_COLOR.protein} />
            <MacroBar label="Carbs" value={r(totals.carbsG)} target={plan.targets.carbsG} color={MACRO_COLOR.carbs} />
            <MacroBar label="Fat" value={r(totals.fatG)} target={plan.targets.fatG} color={MACRO_COLOR.fat} />
            {plan.assumed && (
              <p className="text-xs text-ink-400">
                Using a typical 2000 kcal day. <Link href="/profile" className="link">Add age, height and weight</Link> for your own targets.
              </p>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            {chosen.map((m) => (
              <section key={m.meal} className="card space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="h-display text-lg">{MEAL_LABELS[m.meal]}</h2>
                  <span className="text-xs tabular-nums text-ink-400">
                    aim {m.budget.kcal} kcal · {m.budget.proteinG} g P
                  </span>
                </div>
                {m.option ? (
                  <>
                    {added.includes(m.meal) ? (
                      <p className="text-sm text-good" role="status">
                        Logged ✓ {m.option.items.map((i) => i.name).join(", ")}
                      </p>
                    ) : (
                      <MealOptionCard o={m.option} label={`Log ${MEAL_LABELS[m.meal].toLowerCase()}`} busy={busy === m.meal} onAdd={() => addMeals([m])} />
                    )}
                    {m.options.length > 1 && !added.includes(m.meal) && (
                      <button className="text-sm link" onClick={() => setPick((p) => ({ ...p, [m.meal]: (p[m.meal] ?? 0) + 1 }))}>
                        Swap ({((pick[m.meal] ?? 0) % m.options.length) + 1} of {m.options.length})
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-ink-400">No idea fits your diet here.</p>
                )}
              </section>
            ))}
          </div>
          <p className="text-center text-xs text-ink-400">Home-style portions from the food database. Swap any meal, or log one when you eat it.</p>
        </>
      )}
    </div>
  );
}
