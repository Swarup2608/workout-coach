"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { MEALS, MEAL_LABELS, mealForNow, scaleMacros, type Diet, type FoodItem, type Macros, type Meal, type RecentFood } from "@/lib/domain";
import { api, today } from "@/lib/api";
import { Icon } from "@/components/Icons";
import { ErrorNote, Spinner } from "@/components/ui";
import { useCoachContext } from "@/components/coach/CoachProvider";
import { notifyDataChanged } from "@/components/coach/actions";
import { MacroInputs, emptyMacros, numOr0, toMacros } from "@/components/nutrition/NutritionUi";
import { PhotoButton, PhotoReview } from "@/components/nutrition/PhotoFood";
import type { PhotoResult } from "@/lib/domain";

type Tab = "recent" | "favourites" | "mine" | "quick";
/** What the serving picker is showing: a database/own food, or a recent quick-add. */
type Pick = { foodId: string | null; name: string; serving: string | null; per: Macros; servings: number };

const DIET_WORDS: Record<Diet, string> = { veg: "vegetarian", vegan: "vegan", eggetarian: "vegetarian and egg", non_veg: "" };
const SERVING_CHIPS = [0.5, 1, 1.5, 2, 3];

export default function AddFoodPage() {
  return (
    <Suspense fallback={<div className="card">Loading…</div>}>
      <AddFood />
    </Suspense>
  );
}

function AddFood() {
  const params = useSearchParams();
  const t = today();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? params.get("date")! : t;
  const [meal, setMeal] = useState<Meal>((MEALS as string[]).includes(params.get("meal") ?? "") ? (params.get("meal") as Meal) : mealForNow());
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const [results, setResults] = useState<FoodItem[] | null>(null);
  const [diet, setDiet] = useState<Diet | null>(null);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<Tab>("recent");
  const [lib, setLib] = useState<{ recent: RecentFood[]; favourites: FoodItem[]; custom: FoodItem[] } | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** The latest photo's draft; `n` counts photos so a new one resets the review form. */
  const [photo, setPhoto] = useState<{ n: number; result: PhotoResult } | null>(null);
  const back = `/nutrition${date !== t ? `?date=${date}` : ""}`;
  useCoachContext("Add food", `${MEAL_LABELS[meal]} on ${date}`);

  const loadLib = useCallback(() => {
    api
      .foodLibrary(date)
      .then((l) => {
        setLib(l);
        setTab((cur) => (cur === "recent" && !l.recent.length ? (l.favourites.length ? "favourites" : "quick") : cur));
      })
      .catch((e) => setError(e.message));
  }, [date]);
  useEffect(loadLib, [loadLib]);

  // Search as you type (debounced). An empty box shows the tabs instead.
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults(null);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      api
        .searchFoods(query, all)
        .then((r) => {
          setResults(r.foods);
          setDiet(r.diet);
        })
        .catch((e) => setError(e.message))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(id);
  }, [q, all]);

  const favIds = new Set(lib?.favourites.map((f) => f.id) ?? []);
  const toggleFav = async (id: string) => {
    try {
      await api.favourite(id, !favIds.has(id));
      loadLib();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };

  const add = async (p: Pick) => {
    setSaving(true);
    setError(null);
    try {
      await api.addFood(
        date,
        p.foodId ? { meal, foodId: p.foodId, servings: p.servings } : { meal, name: p.name, ...p.per, servings: p.servings, ...(p.serving ? { serving: p.serving } : {}) },
      );
      setAdded((xs) => [`${p.name}${p.servings !== 1 ? ` × ${p.servings}` : ""}`, ...xs]);
      setPick(null);
      notifyDataChanged();
      loadLib();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add");
    } finally {
      setSaving(false);
    }
  };

  const pickFood = (f: FoodItem) => setPick({ foodId: f.id, name: f.name, serving: f.serving, per: f, servings: 1 });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={back} className="text-sm link">
            ← Nutrition
          </Link>
          <h1 className="t-workout text-fg text-4xl">Add food</h1>
          {date !== t && <p className="text-sm text-ink-400">{new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>}
        </div>
        <Link href={back} className="btn btn-ghost">
          Done
        </Link>
      </header>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Meal">
        {MEALS.map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={meal === m}
            onClick={() => setMeal(m)}
            className={`rounded-full border px-3 py-1.5 text-sm ${meal === m ? "border-transparent bg-volt text-on-accent" : "border-ink-600 text-ink-200 hover:border-ink-400"}`}
          >
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-10"
            placeholder="Search foods: roti, dal, paneer, idli…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            aria-label="Search foods"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">
              <Spinner />
            </span>
          )}
        </div>
        <PhotoButton
          onResult={(r) => {
            setPick(null);
            setPhoto((p) => ({ n: (p?.n ?? 0) + 1, result: r }));
          }}
          onError={setError}
        />
      </div>

      {added.length > 0 && (
        <p className="rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-sm text-good" role="status">
          Added to {MEAL_LABELS[meal].toLowerCase()}: {added.slice(0, 3).join(", ")}
          {added.length > 3 ? ` and ${added.length - 3} more` : ""}.{" "}
          <Link href={back} className="link">
            See the day
          </Link>
        </p>
      )}
      <ErrorNote error={error} />

      {photo && (
        <PhotoReview
          key={photo.n}
          result={photo.result}
          date={date}
          meal={meal}
          onAdded={(names) => {
            setAdded((xs) => [...names, ...xs]);
            setPhoto(null);
            notifyDataChanged();
            loadLib();
          }}
          onClose={() => setPhoto(null)}
          onError={setError}
        />
      )}

      {pick &&<ServingPicker pick={pick} meal={meal} saving={saving} onChange={setPick} onAdd={() => add(pick)} onCancel={() => setPick(null)} />}

      {results ? (
        <section className="card space-y-2">
          {diet && diet !== "non_veg" && (
            <label className="flex items-center gap-2 text-xs text-ink-400">
              <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
              {all ? "Showing all foods" : `Showing ${DIET_WORDS[diet]} foods only`}. Include everything
            </label>
          )}
          {results.length ? (
            <FoodList foods={results} favIds={favIds} onPick={pickFood} onFav={toggleFav} />
          ) : (
            <div className="space-y-2 py-2 text-sm">
              <p>No match for “{q.trim()}”.</p>
              <button className="link" onClick={() => setTab("quick")}>
                Quick-add it with your own calories
              </button>{" "}
              or{" "}
              <button className="link" onClick={() => setTab("mine")}>
                save it as your own food
              </button>
              .
            </div>
          )}
        </section>
      ) : null}

      {(!results || tab === "quick" || tab === "mine") && (
        <section className="card space-y-4">
          <div className="flex gap-1 overflow-x-auto" role="tablist">
            {(
              [
                ["recent", "Recent"],
                ["favourites", "Favourites"],
                ["mine", "My foods"],
                ["quick", "Quick add"],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${tab === k ? "bg-ink-800 font-semibold text-fg" : "text-ink-400 hover:text-fg"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {!lib ? (
            <Spinner />
          ) : tab === "recent" ? (
            lib.recent.length ? (
              <ul className="divide-y divide-ink-700">
                {lib.recent.map((r) => (
                  <li key={(r.foodId ?? r.name) + r.lastDate}>
                    <button
                      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-ink-800/40"
                      onClick={() => setPick({ foodId: r.foodId, name: r.name, serving: r.serving, per: r.per, servings: r.servings })}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                        <span className="block truncate text-xs text-ink-400">
                          {r.serving ? `${r.servings} × ${r.serving}` : "quick add"} · last {MEAL_LABELS[r.meal].toLowerCase()} {r.lastDate === date ? "today" : r.lastDate}
                        </span>
                      </span>
                      <span className="font-display text-sm font-bold tabular-nums text-fg">{Math.round(r.per.kcal * r.servings)}</span>
                      <Icon name="plus" size={16} className="text-volt-bright" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-400">Foods you log show up here, so the next time is one tap.</p>
            )
          ) : tab === "favourites" ? (
            lib.favourites.length ? (
              <FoodList foods={lib.favourites} favIds={favIds} onPick={pickFood} onFav={toggleFav} />
            ) : (
              <p className="text-sm text-ink-400">Tap the star next to a food to keep it here.</p>
            )
          ) : tab === "mine" ? (
            <MyFoods
              foods={lib.custom}
              favIds={favIds}
              initialName={q.trim()}
              onPick={pickFood}
              onFav={toggleFav}
              onChanged={loadLib}
              onError={setError}
            />
          ) : (
            <QuickAdd initialName={q.trim()} saving={saving} onAdd={(name, per) => add({ foodId: null, name, serving: null, per, servings: 1 })} />
          )}
        </section>
      )}

      <p className="text-center text-xs text-ink-400">Values are typical home portions. Restaurant food usually has more oil and calories.</p>
    </div>
  );
}

function FoodList({ foods, favIds, onPick, onFav }: { foods: FoodItem[]; favIds: Set<string>; onPick: (f: FoodItem) => void; onFav: (id: string) => void }) {
  return (
    <ul className="divide-y divide-ink-700">
      {foods.map((f) => (
        <li key={f.id} className="flex items-center gap-2">
          <button className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left hover:bg-ink-800/40" onClick={() => onPick(f)}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-fg">{f.name}</span>
              <span className="block truncate text-xs text-ink-400">
                {f.serving} · {f.proteinG} g protein{f.custom ? " · my food" : ""}
              </span>
            </span>
            <span className="font-display text-sm font-bold tabular-nums text-fg">{f.kcal}</span>
          </button>
          <button
            className={`rounded-md p-1.5 ${favIds.has(f.id) ? "text-volt-bright" : "text-ink-500 hover:text-fg"}`}
            onClick={() => onFav(f.id)}
            aria-label={favIds.has(f.id) ? `Remove ${f.name} from favourites` : `Add ${f.name} to favourites`}
            aria-pressed={favIds.has(f.id)}
          >
            <Icon name="star" size={16} className={favIds.has(f.id) ? "fill-current" : ""} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ServingPicker({ pick, meal, saving, onChange, onAdd, onCancel }: { pick: Pick; meal: Meal; saving: boolean; onChange: (p: Pick) => void; onAdd: () => void; onCancel: () => void }) {
  const m = scaleMacros(pick.per, pick.servings);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), [pick.name]);
  const set = (s: number) => onChange({ ...pick, servings: Math.min(20, Math.max(0.25, Math.round(s * 4) / 4)) });
  return (
    <div ref={ref} className="card space-y-4 border-volt/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="h-display truncate text-lg">{pick.name}</h2>
          <p className="text-xs text-ink-400">{pick.serving ? `1 serving = ${pick.serving}` : "Your quick-add amount = 1 serving"}</p>
        </div>
        <button className="rounded-md p-1 text-ink-400 hover:text-fg" onClick={onCancel} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost px-2" onClick={() => set(pick.servings - 0.5)} disabled={pick.servings <= 0.25} aria-label="Fewer servings">
          <Icon name="minus" size={16} />
        </button>
        <input
          type="number"
          inputMode="decimal"
          min={0.25}
          max={20}
          step={0.25}
          className="input w-20 text-center"
          value={pick.servings}
          onChange={(e) => set(numOr0(e.target.value) || 0.25)}
          aria-label="Servings"
        />
        <button className="btn btn-ghost px-2" onClick={() => set(pick.servings + 0.5)} disabled={pick.servings >= 20} aria-label="More servings">
          <Icon name="plus" size={16} />
        </button>
        <div className="flex flex-wrap gap-1">
          {SERVING_CHIPS.map((s) => (
            <button key={s} className={`rounded-full border px-2.5 py-1 text-xs ${pick.servings === s ? "border-volt text-fg" : "border-ink-600 text-ink-400 hover:text-fg"}`} onClick={() => set(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            ["kcal", m.kcal, ""],
            ["Protein", m.proteinG, "g"],
            ["Carbs", m.carbsG, "g"],
            ["Fat", m.fatG, "g"],
          ] as const
        ).map(([k, v, u]) => (
          <div key={k} className="rounded-lg bg-ink-800/50 px-2 py-2">
            <dt className="text-[11px] text-ink-400">{k}</dt>
            <dd className="font-display text-lg font-bold tabular-nums text-fg">
              {v}
              {u && <span className="text-xs font-normal text-ink-400"> {u}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <button className="btn btn-primary w-full" onClick={onAdd} disabled={saving}>
        {saving && <Spinner />} Add to {MEAL_LABELS[meal].toLowerCase()}
      </button>
    </div>
  );
}

function QuickAdd({ initialName, saving, onAdd }: { initialName: string; saving: boolean; onAdd: (name: string, per: Macros) => void }) {
  const [name, setName] = useState(initialName);
  const [m, setM] = useState(emptyMacros);
  const ok = name.trim() && m.kcal.trim() !== "" && numOr0(m.kcal) <= 5000;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        onAdd(name.trim(), toMacros(m));
        setName("");
        setM(emptyMacros);
      }}
    >
      <p className="text-xs text-ink-400">For a meal you know the calories of (a packet label, a restaurant menu). Only calories are needed.</p>
      <div>
        <label className="label" htmlFor="qa-name">
          What did you eat?
        </label>
        <input id="qa-name" className="input" placeholder="e.g. Office canteen thali" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
      </div>
      <MacroInputs v={m} onChange={setM} />
      <button className="btn btn-primary" disabled={!ok || saving}>
        {saving && <Spinner />} Add
      </button>
    </form>
  );
}

function MyFoods({
  foods,
  favIds,
  initialName,
  onPick,
  onFav,
  onChanged,
  onError,
}: {
  foods: FoodItem[];
  favIds: Set<string>;
  initialName: string;
  onPick: (f: FoodItem) => void;
  onFav: (id: string) => void;
  onChanged: () => void;
  onError: (e: string | null) => void;
}) {
  const [open, setOpen] = useState(!foods.length || !!initialName);
  const [name, setName] = useState(initialName);
  const [serving, setServing] = useState("1 serving");
  const [m, setM] = useState(emptyMacros);
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      const f = await api.createFood({ name: name.trim(), serving: serving.trim() || "1 serving", ...toMacros(m) });
      setName("");
      setM(emptyMacros);
      setOpen(false);
      onChanged();
      onPick(f);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (f: FoodItem) => {
    if (!confirm(`Delete “${f.name}” from your foods? Days you already logged keep it.`)) return;
    try {
      await api.deleteFood(f.id);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not delete");
    }
  };

  return (
    <div className="space-y-4">
      {foods.length > 0 && (
        <ul className="divide-y divide-ink-700">
          {foods.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <button className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left hover:bg-ink-800/40" onClick={() => onPick(f)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{f.name}</span>
                  <span className="block truncate text-xs text-ink-400">
                    {f.serving} · {f.proteinG} g protein
                  </span>
                </span>
                <span className="font-display text-sm font-bold tabular-nums text-fg">{f.kcal}</span>
              </button>
              <button className={`rounded-md p-1.5 ${favIds.has(f.id) ? "text-volt-bright" : "text-ink-500 hover:text-fg"}`} onClick={() => onFav(f.id)} aria-label={`Favourite ${f.name}`} aria-pressed={favIds.has(f.id)}>
                <Icon name="star" size={16} className={favIds.has(f.id) ? "fill-current" : ""} />
              </button>
              <button className="rounded-md p-1.5 text-ink-500 hover:text-bad" onClick={() => remove(f)} aria-label={`Delete ${f.name}`}>
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form className="space-y-3" onSubmit={create}>
          <p className="text-xs text-ink-400">Save a dish you eat often (a family recipe, a packaged food) so you can add it in one tap.</p>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div>
              <label className="label" htmlFor="mf-name">
                Name
              </label>
              <input id="mf-name" className="input" placeholder="e.g. Amma's sambar" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
            </div>
            <div>
              <label className="label" htmlFor="mf-serving">
                Serving
              </label>
              <input id="mf-serving" className="input" placeholder="1 bowl (200 g)" value={serving} onChange={(e) => setServing(e.target.value)} maxLength={60} />
            </div>
          </div>
          <MacroInputs v={m} onChange={setM} />
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy || !name.trim() || m.kcal.trim() === ""}>
              {busy && <Spinner />} Save food
            </button>
            {foods.length > 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <button className="btn btn-ghost" onClick={() => setOpen(true)}>
          <Icon name="plus" size={16} /> New food
        </button>
      )}
    </div>
  );
}
