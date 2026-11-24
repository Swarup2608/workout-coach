"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { MEAL_LABELS, scaleMacros, type FoodItem, type Meal, type PhotoResult } from "@/lib/domain";
import { ApiError, api } from "@/lib/api";
import { Icon } from "@/components/Icons";
import { Spinner } from "@/components/ui";
import { MacroInputs, macrosOk, toMacros, toText, type MacroText } from "./NutritionUi";

const MAX_SIDE = 1600;

/** Shrinks a photo to at most 1600 px on the long side as JPEG, so it fits the API's body limit. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  for (const q of [0.85, 0.7, 0.55]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length < 1_800_000) return url;
  }
  throw new Error("That photo is too large. Try a closer, simpler shot.");
}

/** Camera / gallery button. Sends the photo to the user's AI and hands back the draft. */
export function PhotoButton({ onResult, onError }: { onResult: (r: PhotoResult) => void; onError: (e: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [noAi, setNoAi] = useState(false);

  const read = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    onError(null);
    try {
      onResult(await api.foodPhoto(await shrink(file)));
    } catch (e) {
      if (e instanceof ApiError && e.code === "no_ai") setNoAi(true);
      else onError(e instanceof Error ? e.message : "Could not read the photo");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <button type="button" className="btn btn-ghost shrink-0" onClick={() => input.current?.click()} disabled={busy} aria-label="Add food from a photo" title="Photo of a meal or a nutrition label">
        {busy ? <Spinner /> : <Icon name="camera" size={18} />}
        <span className="hidden sm:inline">{busy ? "Reading…" : "Photo"}</span>
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
      {noAi && (
        <p className="basis-full rounded-lg border border-ink-600 px-3 py-2 text-sm" role="status">
          Photos are read by your own AI.{" "}
          <Link href="/profile#ai" className="link">
            Connect one under Profile → AI coach
          </Link>{" "}
          (it needs a model that understands images), then try again.
        </p>
      )}
    </>
  );
}

/** One row the user can still change before it's added. */
type Draft = {
  key: string;
  include: boolean;
  name: string;
  /** Set while the values are a database food's, untouched */
  foodId: string | null;
  serving: string | null;
  m: MacroText;
  servings: number;
  /** "As seen in the photo" note and alternatives (food photos only) */
  portion?: string;
  estimate?: { serving: string | null; m: MacroText };
  matches?: FoodItem[];
};

function initialDrafts(r: PhotoResult): Draft[] {
  if (r.kind === "label")
    return [{ key: "label", include: true, name: r.label.name, foodId: null, serving: r.label.serving, m: toText(r.label), servings: 1 }];
  if (r.kind === "food")
    return r.foods.map((f, i) => {
      const serving = f.portion ? `${f.portion}${f.grams ? ` (~${f.grams} g)` : ""}` : null;
      return { key: `f${i}`, include: true, name: f.name, foodId: null, serving, m: toText(f.estimate), servings: 1, portion: f.portion, estimate: { serving, m: toText(f.estimate) }, matches: f.matches };
    });
  return [];
}

/** Review what the AI read, edit anything, then add the checked items to the meal. */
export function PhotoReview({
  result,
  date,
  meal,
  onAdded,
  onClose,
  onError,
}: {
  result: PhotoResult;
  date: string;
  meal: Meal;
  onAdded: (names: string[]) => void;
  onClose: () => void;
  onError: (e: string | null) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => initialDrafts(result));
  const [saveMine, setSaveMine] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key: string, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const chosen = drafts.filter((d) => d.include);
  const valid = chosen.length > 0 && chosen.every((d) => d.name.trim() && macrosOk(d.m) && d.servings >= 0.25 && d.servings <= 20);
  const total = chosen.reduce((a, d) => a + Math.round(toMacros(d.m).kcal * d.servings), 0);

  const add = async () => {
    setSaving(true);
    onError(null);
    const names: string[] = [];
    try {
      for (const d of chosen) {
        let foodId = d.foodId;
        // A label saved to "My foods" is added through it, so it shows up in search next time.
        if (!foodId && result.kind === "label" && saveMine) {
          const label = result.label;
          foodId = (await api.createFood({ name: d.name.trim(), serving: d.serving || "1 serving", grams: label.grams, ...toMacros(d.m) })).id;
        }
        await api.addFood(
          date,
          foodId
            ? { meal, foodId, servings: d.servings }
            : { meal, name: d.name.trim(), ...toMacros(d.m), servings: d.servings, ...(d.serving ? { serving: d.serving.slice(0, 60) } : {}), source: "photo" },
        );
        names.push(`${d.name.trim()}${d.servings !== 1 ? ` × ${d.servings}` : ""}`);
      }
      onAdded(names);
    } catch (e) {
      // Items already added stay added; drop them from the form so a retry doesn't double them.
      if (names.length) {
        setDrafts((ds) => ds.filter((d) => !chosen.slice(0, names.length).some((c) => c.key === d.key)));
        onError(`Added ${names.join(", ")}, then: ${e instanceof Error ? e.message : "could not add the rest"}`);
      } else onError(e instanceof Error ? e.message : "Could not add");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card space-y-4 border-volt/50" aria-label="Food from photo">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="h-display flex items-center gap-2 text-lg">
            <Icon name="camera" size={18} /> {result.kind === "label" ? "Nutrition label" : result.kind === "food" ? "Food in the photo" : "Nothing found"}
          </h2>
          <p className="text-xs text-ink-400">
            {result.kind === "unknown"
              ? result.note
              : `Check and change anything before adding. ${result.kind === "label" ? "Values are for one serving as printed." : "Estimates are for the portion in the photo."}${result.note ? ` ${result.note}` : ""}`}
          </p>
        </div>
        <button className="rounded-md p-1 text-ink-400 hover:text-fg" onClick={onClose} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </div>

      {result.kind === "unknown" && <p className="text-sm">Try a closer photo with good light, or search for the food above.</p>}

      {drafts.map((d) => (
        <DraftCard key={d.key} d={d} many={drafts.length > 1} packServings={result.kind === "label" ? result.label.servingsPerPack : null} onChange={(p) => set(d.key, p)} />
      ))}

      {result.kind === "label" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={saveMine} onChange={(e) => setSaveMine(e.target.checked)} />
          Also save to My foods for next time
        </label>
      )}

      {drafts.length > 0 && (
        <button className="btn btn-primary w-full" onClick={add} disabled={!valid || saving}>
          {saving && <Spinner />} Add {chosen.length > 1 ? `${chosen.length} items` : ""} to {MEAL_LABELS[meal].toLowerCase()} · {total.toLocaleString()} kcal
        </button>
      )}
    </section>
  );
}

function DraftCard({ d, many, packServings, onChange }: { d: Draft; many: boolean; packServings: number | null; onChange: (p: Partial<Draft>) => void }) {
  const total = scaleMacros(toMacros(d.m), d.servings);
  const setServings = (s: number) => onChange({ servings: Math.min(20, Math.max(0.25, Math.round(s * 4) / 4)) });
  const useFood = (f: FoodItem) => onChange({ foodId: f.id, name: f.name, serving: f.serving, m: toText(f) });
  const asSeen = !!d.estimate && !d.foodId && d.serving === d.estimate.serving && d.m.kcal === d.estimate.m.kcal;

  return (
    <div className={`space-y-3 rounded-lg border p-3 ${d.include ? "border-ink-600" : "border-ink-700 opacity-60"}`}>
      <div className="flex items-center gap-2">
        {many && <input type="checkbox" checked={d.include} onChange={(e) => onChange({ include: e.target.checked })} aria-label={`Include ${d.name}`} />}
        <input className="input flex-1" value={d.name} onChange={(e) => onChange({ name: e.target.value, foodId: null })} maxLength={120} aria-label="Name" />
      </div>

      {d.include && (
        <>
          {(d.estimate || d.matches?.length) && (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Values from">
              {d.estimate && (
                <button
                  role="radio"
                  aria-checked={asSeen}
                  className={`rounded-full border px-2.5 py-1 text-xs ${asSeen ?"border-volt text-fg" : "border-ink-600 text-ink-400 hover:text-fg"}`}
                  onClick={() => onChange({ foodId: null, serving: d.estimate!.serving, m: d.estimate!.m })}
                >
                  As seen{d.portion ? `: ${d.portion}` : ""} · {d.estimate.m.kcal} kcal
                </button>
              )}
              {d.matches?.map((f) => (
                <button
                  key={f.id}
                  role="radio"
                  aria-checked={d.foodId === f.id}
                  className={`rounded-full border px-2.5 py-1 text-xs ${d.foodId === f.id ? "border-volt text-fg" : "border-ink-600 text-ink-400 hover:text-fg"}`}
                  onClick={() => useFood(f)}
                  title={`${f.name}: ${f.serving}, ${f.kcal} kcal`}
                >
                  {f.name} · {f.serving} · {f.kcal} kcal
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div>
              <label className="label" htmlFor={`${d.key}-serving`}>
                One serving
              </label>
              <input
                id={`${d.key}-serving`}
                className="input"
                placeholder="e.g. 1 plate (250 g)"
                value={d.serving ?? ""}
                onChange={(e) => onChange({ serving: e.target.value || null, foodId: null })}
                maxLength={60}
              />
            </div>
            <div>
              <label className="label" htmlFor={`${d.key}-servings`}>
                Servings eaten
              </label>
              <input
                id={`${d.key}-servings`}
                type="number"
                inputMode="decimal"
                min={0.25}
                max={20}
                step={0.25}
                className="input"
                value={d.servings}
                onChange={(e) => setServings(Number(e.target.value) || 0.25)}
              />
            </div>
          </div>
          {packServings && packServings !== 1 && (
            <button className="text-xs link" onClick={() => setServings(packServings)}>
              Ate the whole pack ({packServings} servings)
            </button>
          )}

          <MacroInputs idPrefix={d.key} v={d.m} onChange={(m) => onChange({ m, foodId: null })} />
          <p className="text-xs text-ink-400">
            {d.servings !== 1 ? `× ${d.servings} = ` : "Adds "}
            <strong className="text-fg">{total.kcal} kcal</strong> · {total.proteinG} g P · {total.carbsG} g C · {total.fatG} g F
            {d.foodId ? " · from the food database" : ""}
          </p>
        </>
      )}
    </div>
  );
}
