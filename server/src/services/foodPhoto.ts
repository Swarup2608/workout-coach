import { z } from "zod";
import type { FoodItem, Macros } from "../domain.js";
import type { AiClient, AiImage } from "./ai.js";
import { searchFoods } from "./nutrition.js";

/**
 * Photo to food: the user's own AI looks at one photo and says whether it is a nutrition label
 * (read the numbers) or food (name it, estimate it). Food is then matched against our database.
 * Nothing is saved here: the client shows an editable draft and the user confirms.
 */

export interface LabelDraft extends Macros {
  name: string;
  /** Serving the values are for, e.g. "1 bar (40 g)" or "100 g" */
  serving: string;
  grams: number;
  /** Servings in the pack, when printed */
  servingsPerPack: number | null;
}

export interface PhotoFood {
  name: string;
  /** What the AI saw, e.g. "1 plate" or "2 pieces" */
  portion: string;
  grams: number | null;
  /** The AI's estimate for the portion in the photo */
  estimate: Macros;
  /** Closest foods in our database (best first); their own serving sizes apply */
  matches: FoodItem[];
}

export type PhotoResult =
  | { kind: "label"; label: LabelDraft; note: string }
  | { kind: "food"; foods: PhotoFood[]; note: string }
  | { kind: "unknown"; note: string };

const SYSTEM = `You read food photos for a calorie tracker used mostly in India.
Decide what the photo shows, then call the tool once.
- "label": a printed Nutrition Facts / nutrition information table on a package. Copy the numbers exactly as printed. If the table has both "per 100 g" and "per serving" columns, use per serving and give servingGrams. If it only has per 100 g (or 100 ml), set basis to "100g". Energy in kJ only: divide by 4.184. Use the product name from the pack if visible.
- "food": a meal, dish, snack, drink or packaged food without a readable table. List each distinct item (at most 6). Use the common name, preferring the Indian dish name when it fits (e.g. "Masala dosa", "Rajma chawal", "Poha"). Give 1–3 searchTerms (other names or the main ingredient). Estimate the portion you see and its calories and macros, home-cooked unless it is clearly restaurant food.
- "unknown": not food, or too blurry to tell. Say why in note.
Keep note to one short sentence (what you assumed, or what was unclear). Never invent numbers you cannot see on a label.`;

const TOOL = {
  name: "read_food_photo",
  description: "Report what the food photo shows.",
  schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["label", "food", "unknown"] },
      note: { type: "string" },
      label: {
        type: "object",
        properties: {
          productName: { type: "string" },
          servingSize: { type: "string", description: "Serving as printed, e.g. '1 bar (40 g)'" },
          servingGrams: { type: ["number", "null"] },
          basis: { type: "string", enum: ["serving", "100g"] },
          kcal: { type: "number" },
          proteinG: { type: "number" },
          carbsG: { type: "number" },
          fatG: { type: "number" },
          servingsPerPack: { type: ["number", "null"] },
        },
        required: ["basis", "kcal"],
      },
      foods: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            searchTerms: { type: "array", items: { type: "string" } },
            portion: { type: "string" },
            grams: { type: ["number", "null"] },
            kcal: { type: "number" },
            proteinG: { type: "number" },
            carbsG: { type: "number" },
            fatG: { type: "number" },
          },
          required: ["name", "kcal"],
        },
      },
    },
    required: ["kind", "note"],
  },
};

// Forgiving parse: models send "12 g", "", null or strings for numbers.
const num = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : v),
  z.number().finite().nullable(),
);
const n0 = num.transform((v) => (v == null || v < 0 ? 0 : v));
const str = z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string());

const Raw = z.object({
  kind: z.preprocess((v) => (v === "label" || v === "food" ? v : "unknown"), z.enum(["label", "food", "unknown"])),
  note: str.default(""),
  label: z
    .object({
      productName: str.default(""),
      servingSize: str.default(""),
      servingGrams: num.default(null),
      basis: z.preprocess((v) => (String(v ?? "").includes("100") ? "100g" : "serving"), z.enum(["serving", "100g"])),
      kcal: n0,
      proteinG: n0.default(0),
      carbsG: n0.default(0),
      fatG: n0.default(0),
      servingsPerPack: num.default(null),
    })
    .nullish(),
  foods: z
    .array(
      z.object({
        name: str,
        searchTerms: z.array(str).catch([]).default([]),
        portion: str.default(""),
        grams: num.default(null),
        kcal: n0,
        proteinG: n0.default(0),
        carbsG: n0.default(0),
        fatG: n0.default(0),
      }),
    )
    .catch([])
    .default([]),
});
export type RawPhoto = z.input<typeof Raw>;

const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));
const macros = (m: Macros, f = 1): Macros => ({
  kcal: Math.round(clamp(m.kcal * f, 5000)),
  proteinG: r1(clamp(m.proteinG * f, 1000)),
  carbsG: r1(clamp(m.carbsG * f, 1000)),
  fatG: r1(clamp(m.fatG * f, 1000)),
});

/** Turns the AI's answer into a draft: label values become per-serving, food gets database matches. */
export function shapePhotoResult(raw: unknown, opts: { custom?: FoodItem[] } = {}): PhotoResult {
  const parsed = Raw.safeParse(raw);
  if (!parsed.success) return { kind: "unknown", note: "The AI's answer could not be read. Try again or add the food by hand." };
  const p = parsed.data;

  if (p.kind === "label" && p.label && p.label.kcal > 0) {
    const l = p.label;
    const g = l.servingGrams && l.servingGrams > 0 ? Math.min(l.servingGrams, 5000) : null;
    // Per-100 g tables become one serving when the serving weight is known, else stay as "100 g".
    const per100 = l.basis === "100g";
    const factor = per100 && g ? g / 100 : 1;
    const serving = per100 && !g ? "100 g" : l.servingSize || (g ? `${g} g` : "1 serving");
    return {
      kind: "label",
      note: p.note,
      label: {
        name: (l.productName || "Packaged food").slice(0, 120),
        serving: serving.slice(0, 60),
        grams: g ?? (per100 ? 100 : 0),
        servingsPerPack: l.servingsPerPack && l.servingsPerPack > 0 ? r1(l.servingsPerPack) : null,
        ...macros(l, factor),
      },
    };
  }

  const items = p.foods.filter((f) => f.name).slice(0, 6);
  if ((p.kind === "food" || p.kind === "label") && items.length) {
    return {
      kind: "food",
      note: p.note,
      foods: items.map((f) => ({
        name: f.name.slice(0, 120),
        portion: f.portion.slice(0, 60),
        grams: f.grams && f.grams > 0 ? Math.round(f.grams) : null,
        estimate: macros(f),
        matches: matchFoods([f.name, ...f.searchTerms], opts),
      })),
    };
  }

  return { kind: "unknown", note: p.note || "No food or nutrition label found in the photo." };
}

/** Up to 3 database foods for the names, best first. The diet filter is off: the photo shows what was eaten. */
export function matchFoods(names: string[], opts: { custom?: FoodItem[] } = {}): FoodItem[] {
  const out: FoodItem[] = [];
  for (const name of names.filter(Boolean).slice(0, 4)) {
    for (const f of searchFoods(name, { all: true, custom: opts.custom, limit: 3 })) {
      if (!out.some((x) => x.id === f.id)) out.push(f);
      if (out.length >= 3) return out;
    }
  }
  return out;
}

export async function analyzeFoodPhoto(ai: AiClient, image: AiImage, opts: { custom?: FoodItem[] } = {}): Promise<PhotoResult> {
  const raw = await ai.structured({ system: SYSTEM, prompt: "What is in this photo?", tool: TOOL, maxTokens: 1500, image });
  return shapePhotoResult(raw, opts);
}

/** Splits a data: URL into what the AI clients need, or null if it isn't a supported image. */
export function parseImageDataUrl(url: string): AiImage | null {
  const m = url.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  return m ? { mediaType: m[1] as AiImage["mediaType"], data: m[2] } : null;
}
