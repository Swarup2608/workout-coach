"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { MEALS, MEAL_LABELS, addDays, scaleMacros, sumMacros, type FoodLogEntry, type Macros, type Meal, type NutritionDay, type NutritionWeekDay } from "@/lib/domain";
import { api, today } from "@/lib/api";
import { Icon } from "@/components/Icons";
import { ErrorNote } from "@/components/ui";
import { useCoachContext } from "@/components/coach/CoachProvider";
import { DATA_CHANGED } from "@/components/coach/actions";
import { MealIdeas } from "@/components/nutrition/MealIdeas";
import { CalorieRing, MACRO_COLOR, MacroBar, MacroInputs, MissingTargets, macrosOk, toMacros, toText, type MacroText } from "@/components/nutrition/NutritionUi";

const GLASS_ML = 250;
const validDate = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

export default function NutritionPage() {
  return (
    <Suspense fallback={<div className="card">Loading…</div>}>
      <Nutrition />
    </Suspense>
  );
}

function Nutrition() {
  const params = useSearchParams();
  const router = useRouter();
  const t = today();
  const date = validDate(params.get("date")) ?? t;
  const [day, setDay] = useState<NutritionDay | null>(null);
  const [week, setWeek] = useState<NutritionWeekDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const targets = day?.targets ?? null;
  useCoachContext(
    "Nutrition",
    day ? `${date}: ${day.totals.kcal}${targets ? `/${targets.kcal}` : ""} kcal, protein ${day.totals.proteinG}${targets ? `/${targets.proteinG}` : ""} g` : undefined,
  );

  const load = useCallback(() => {
    setError(null);
    api.nutritionDay(date).then(setDay).catch((e) => setError(e.message));
    api.nutritionWeek(date).then((w) => setWeek(w.days)).catch(() => {});
  }, [date]);
  useEffect(() => {
    load();
    window.addEventListener(DATA_CHANGED, load);
    return () => window.removeEventListener(DATA_CHANGED, load);
  }, [load]);

  /** Runs a change and shows the day the server sends back. */
  const run = async (key: string, fn: () => Promise<NutritionDay>) => {
    setBusy(key);
    setError(null);
    try {
      setDay(await fn());
      api.nutritionWeek(date).then((w) => setWeek(w.days)).catch(() => {});
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const go = (d: string) => router.push(d === t ? "/nutrition" : `/nutrition?date=${d}`);
  const water = day?.log.waterMl ?? 0;
  const waterTarget = targets?.waterMl ?? 2500;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-400">{date === t ? "Today" : new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" })}</p>
          <h1 className="t-workout text-fg text-4xl">Nutrition</h1>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost px-2" onClick={() => go(addDays(date, -1))} aria-label="Previous day">
            <Icon name="chevronLeft" size={18} />
          </button>
          <input
            type="date"
            className="input w-auto"
            value={date}
            max={t}
            onChange={(e) => validDate(e.target.value) && go(e.target.value)}
            aria-label="Day"
          />
          <button className="btn btn-ghost px-2" onClick={() => go(addDays(date, 1))} disabled={date >= t} aria-label="Next day">
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </header>

      <ErrorNote error={error} />

      {day && (
        <>
          <section className="card flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex flex-col items-center gap-2">
              <CalorieRing eaten={day.totals.kcal} target={targets?.kcal ?? null} />
              <p className="text-xs text-ink-400">
                {day.totals.kcal.toLocaleString()} eaten{targets ? ` of ${targets.kcal.toLocaleString()} kcal` : " kcal"} · {day.trainingDay ? "training day" : "rest day"}
              </p>
            </div>
            <div className="flex-1 space-y-4">
              <MacroBar label="Protein" value={day.totals.proteinG} target={targets?.proteinG ?? null} color={MACRO_COLOR.protein} />
              <MacroBar label="Carbs" value={day.totals.carbsG} target={targets?.carbsG ?? null} color={MACRO_COLOR.carbs} />
              <MacroBar label="Fat" value={day.totals.fatG} target={targets?.fatG ?? null} color={MACRO_COLOR.fat} />
              {targets?.adaptive && targets.adaptive.deltaKcal !== 0 && (
                <p className="rounded-lg border border-ink-600 px-3 py-2 text-xs">
                  <strong className="text-fg">
                    {targets.adaptive.deltaKcal > 0 ? "+" : "−"}
                    {Math.abs(targets.adaptive.deltaKcal)} kcal a day
                  </strong>{" "}
                  from your weight trend ({targets.adaptive.rateKgWeek > 0 ? "+" : ""}
                  {targets.adaptive.rateKgWeek} kg/week vs a goal of {targets.adaptive.goalRateKgWeek > 0 ? "+" : ""}
                  {targets.adaptive.goalRateKgWeek}).
                </p>
              )}
              {targets ? (
                <details className="text-xs text-ink-400">
                  <summary className="cursor-pointer select-none hover:text-fg">How these targets are set</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {targets.basis.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                    <li>Estimates from standard formulas, not medical advice. Your weekly weight trend is the real check.</li>
                  </ul>
                </details>
              ) : (
                <MissingTargets missing={day.missing} />
              )}
            </div>
          </section>

          {date === t && <MealIdeas date={date} />}

          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="h-display flex items-center gap-2 text-lg">
                <Icon name="droplet" size={18} className="text-ice" /> Water
              </h2>
              <p className="text-sm tabular-nums">
                <strong className="font-display text-base text-fg">{(water / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                <span className="text-ink-400"> / {(waterTarget / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} L</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" aria-hidden>
              {Array.from({ length: Math.max(Math.ceil(waterTarget / GLASS_ML), Math.ceil(water / GLASS_ML)) }, (_, i) => (
                <span key={i} className={`h-7 w-5 rounded-b-md border ${i < Math.floor(water / GLASS_ML) ? "border-transparent" : "border-ink-600"}`} style={i < Math.floor(water / GLASS_ML) ? { background: MACRO_COLOR.water } : undefined} />
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost" disabled={!!busy || water <= 0} onClick={() => run("water", () => api.setWater(date, Math.max(0, water - GLASS_ML)))} aria-label="Remove a glass">
                <Icon name="minus" size={16} />
              </button>
              <button className="btn btn-primary" disabled={!!busy} onClick={() => run("water", () => api.setWater(date, Math.min(10000, water + GLASS_ML)))}>
                <Icon name="plus" size={16} /> Glass (250 ml)
              </button>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            {MEALS.map((meal) => {
              const items = day.log.entries.filter((e) => e.meal === meal);
              const sub = sumMacros(items);
              return (
                <section key={meal} className="card space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="h-display text-lg">{MEAL_LABELS[meal]}</h2>
                    <span className="text-xs tabular-nums text-ink-400">{items.length ? `${sub.kcal} kcal · ${sub.proteinG} g protein` : ""}</span>
                  </div>
                  {items.length > 0 && (
                    <ul className="divide-y divide-ink-700">
                      {items.map((e) => (
                        <EntryRow
                          key={e.id}
                          e={e}
                          busy={busy === e.id}
                          onServings={(s) => run(e.id, () => api.updateFood(date, e.id, { servings: s }))}
                          onSave={(body) => run(e.id, () => api.updateFood(date, e.id, body))}
                          onRemove={() => run(e.id, () => api.removeFood(date, e.id))}
                        />
                      ))}
                    </ul>
                  )}
                  <Link href={`/nutrition/add?meal=${meal}${date !== t ? `&date=${date}` : ""}`} className="inline-flex items-center gap-1 text-sm link">
                    <Icon name="plus" size={14} /> Add to {MEAL_LABELS[meal].toLowerCase()}
                  </Link>
                </section>
              );
            })}
          </div>

          {week.length > 0 && <WeekStrip days={week} selected={date} onPick={go} />}
        </>
      )}
    </div>
  );
}

type EntryEdit = { name: string; meal: Meal; servings: number } & Macros;

function EntryRow({ e, busy, onServings, onSave, onRemove }: { e: FoodLogEntry; busy: boolean; onServings: (s: number) => void; onSave: (b: EntryEdit) => Promise<boolean>; onRemove: () => void }) {
  const step = 0.5;
  const [editing, setEditing] = useState(false);
  if (editing) return <EntryEditor e={e} busy={busy} onCancel={() => setEditing(false)} onSave={(b) => onSave(b).then((ok) => ok && setEditing(false))} />;
  const how = e.serving ? `${e.servings} × ${e.serving}` : e.servings !== 1 ? `× ${e.servings}` : e.source === "import" ? "from your log" : e.source === "photo" ? "from a photo" : "quick add";
  return (
    <li className={`flex items-center gap-3 py-2 ${busy ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{e.name}</p>
        <p className="truncate text-xs text-ink-400">
          {how} · {e.proteinG} g P · {e.carbsG} g C · {e.fatG} g F
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button className="rounded-md p-1 text-ink-400 hover:bg-ink-800 hover:text-fg disabled:opacity-40" disabled={busy} onClick={() => setEditing(true)} aria-label={`Edit ${e.name}`}>
          <Icon name="pencil" size={14} />
        </button>
        <button className="rounded-md p-1 text-ink-400 hover:bg-ink-800 hover:text-fg disabled:opacity-40" disabled={busy || e.servings <= 0.25} onClick={() => onServings(Math.max(0.25, e.servings - step))} aria-label={`Less ${e.name}`}>
          <Icon name="minus" size={14} />
        </button>
        <span className="w-14 text-right font-display text-sm font-bold tabular-nums text-fg">{e.kcal}</span>
        <button className="rounded-md p-1 text-ink-400 hover:bg-ink-800 hover:text-fg disabled:opacity-40" disabled={busy || e.servings >= 20} onClick={() => onServings(Math.min(20, e.servings + step))} aria-label={`More ${e.name}`}>
          <Icon name="plus" size={14} />
        </button>
        <button className="ml-1 rounded-md p-1 text-ink-400 hover:text-bad disabled:opacity-40" disabled={busy} onClick={onRemove} aria-label={`Remove ${e.name}`}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </li>
  );
}

/** Edit an entry in place: name, meal, servings, and calories/macros of one serving. */
function EntryEditor({ e, busy, onCancel, onSave }: { e: FoodLogEntry; busy: boolean; onCancel: () => void; onSave: (b: EntryEdit) => void }) {
  const [name, setName] = useState(e.name);
  const [meal, setMeal] = useState<Meal>(e.meal);
  const [servings, setServings] = useState(String(e.servings));
  const [m, setM] = useState<MacroText>(toText(e.per));
  const s = Number(servings);
  const ok = name.trim() && macrosOk(m) && s >= 0.25 && s <= 20;
  const total = scaleMacros(toMacros(m), ok ? s : 1);
  return (
    <li className="py-3">
      <form
        className="space-y-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (ok) onSave({ name: name.trim(), meal, servings: Math.round(s * 4) / 4, ...toMacros(m) });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <div>
            <label className="label" htmlFor={`e-${e.id}-name`}>
              Name
            </label>
            <input id={`e-${e.id}-name`} className="input" value={name} onChange={(ev) => setName(ev.target.value)} maxLength={120} required />
          </div>
          <div>
            <label className="label" htmlFor={`e-${e.id}-meal`}>
              Meal
            </label>
            <select id={`e-${e.id}-meal`} className="input" value={meal} onChange={(ev) => setMeal(ev.target.value as Meal)}>
              {MEALS.map((x) => (
                <option key={x} value={x}>
                  {MEAL_LABELS[x]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`e-${e.id}-servings`}>
              Servings
            </label>
            <input id={`e-${e.id}-servings`} type="number" inputMode="decimal" min={0.25} max={20} step={0.25} className="input" value={servings} onChange={(ev) => setServings(ev.target.value)} />
          </div>
        </div>
        <p className="text-xs text-ink-400">Calories and macros for one serving{e.serving ? ` (${e.serving})` : ""}:</p>
        <MacroInputs idPrefix={`e-${e.id}`} v={m} onChange={setM} />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" disabled={!ok || busy}>
            Save · {total.kcal} kcal
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

/** Seven bars: calories per day against that day's target. */
function WeekStrip({ days, selected, onPick }: { days: NutritionWeekDay[]; selected: string; onPick: (d: string) => void }) {
  const max = Math.max(1, ...days.map((d) => Math.max(d.kcal, d.targetKcal ?? 0)));
  const logged = days.filter((d) => d.logged);
  const avgKcal = logged.length ? Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length) : null;
  const avgProtein = logged.length ? Math.round(logged.reduce((a, d) => a + d.proteinG, 0) / logged.length) : null;
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="h-display text-lg">Last 7 days</h2>
        {avgKcal != null && (
          <p className="text-xs text-ink-400">
            Average on {logged.length} logged day{logged.length === 1 ? "" : "s"}: {avgKcal.toLocaleString()} kcal · {avgProtein} g protein
          </p>
        )}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const h = (d.kcal / max) * 100;
          const th = d.targetKcal ? (d.targetKcal / max) * 100 : null;
          const over = d.targetKcal != null && d.kcal > d.targetKcal * 1.1;
          return (
            <button
              key={d.date}
              onClick={() => onPick(d.date)}
              className={`flex flex-col items-center gap-1 rounded-lg p-1 ${d.date === selected ? "bg-ink-800" : "hover:bg-ink-800/60"}`}
              title={`${d.date}: ${d.kcal} kcal${d.targetKcal ? ` of ${d.targetKcal}` : ""}, ${d.proteinG} g protein`}
              aria-label={`${d.date}: ${d.kcal} kcal`}
            >
              <span className="relative flex h-28 w-full items-end justify-center">
                {th != null && <span className="absolute inset-x-0 border-t border-dashed border-ink-500" style={{ bottom: `${th}%` }} aria-hidden />}
                <span className="w-full max-w-8 rounded-t" style={{ height: `${h}%`, minHeight: d.logged ? 3 : 0, background: over ? "var(--warn)" : MACRO_COLOR.kcal }} />
              </span>
              <span className="text-[11px] text-ink-400">{new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-400">Dashed line = that day&apos;s target. Amber = more than 10% over.</p>
    </section>
  );
}
