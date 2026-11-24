import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeFoodPhoto, matchFoods, parseImageDataUrl, shapePhotoResult } from "./foodPhoto.js";
import type { AiClient } from "./ai.js";

describe("food photo", () => {
  it("a per-serving label is copied as one serving", () => {
    const r = shapePhotoResult({
      kind: "label",
      note: "",
      label: { productName: "Oats bar", servingSize: "1 bar (40 g)", servingGrams: 40, basis: "serving", kcal: "180 kcal", proteinG: "6 g", carbsG: 26, fatG: 6, servingsPerPack: 6 },
    });
    assert.equal(r.kind, "label");
    if (r.kind !== "label") return;
    assert.deepEqual(r.label, { name: "Oats bar", serving: "1 bar (40 g)", grams: 40, servingsPerPack: 6, kcal: 180, proteinG: 6, carbsG: 26, fatG: 6 });
  });

  it("a per-100 g label becomes one serving when the serving weight is printed", () => {
    const r = shapePhotoResult({ kind: "label", note: "", label: { productName: "Peanut butter", servingSize: "2 tbsp (32 g)", servingGrams: 32, basis: "100g", kcal: 600, proteinG: 25, carbsG: 20, fatG: 50 } });
    if (r.kind !== "label") return assert.fail("expected a label");
    assert.deepEqual([r.label.serving, r.label.grams, r.label.kcal, r.label.proteinG, r.label.fatG], ["2 tbsp (32 g)", 32, 192, 8, 16]);
  });

  it("a per-100 g label without a serving weight stays as 100 g", () => {
    const r = shapePhotoResult({ kind: "label", note: "", label: { basis: "per 100g", kcal: 350, proteinG: 10 } });
    if (r.kind !== "label") return assert.fail("expected a label");
    assert.deepEqual([r.label.name, r.label.serving, r.label.grams, r.label.kcal, r.label.carbsG], ["Packaged food", "100 g", 100, 350, 0]);
  });

  it("food is matched against the database, ignoring the diet filter", () => {
    const r = shapePhotoResult({
      kind: "food",
      note: "Assumed home-cooked.",
      foods: [
        { name: "Masala dosa", searchTerms: ["dosa"], portion: "1 dosa", grams: 180, kcal: 380, proteinG: 8, carbsG: 50, fatG: 16 },
        { name: "Chicken curry", searchTerms: [], portion: "1 katori", grams: 150, kcal: 250, proteinG: 22, carbsG: 6, fatG: 15 },
      ],
    });
    if (r.kind !== "food") return assert.fail("expected food");
    assert.equal(r.note, "Assumed home-cooked.");
    assert.equal(r.foods.length, 2);
    assert.match(r.foods[0].matches[0].name, /dosa/i);
    assert.ok(r.foods[0].matches.length <= 3);
    assert.ok(r.foods[1].matches.some((f) => f.diet === "non_veg"));
    assert.deepEqual(r.foods[0].estimate, { kcal: 380, proteinG: 8, carbsG: 50, fatG: 16 });
  });

  it("an item nobody stocks still comes back with the AI's estimate", () => {
    const r = shapePhotoResult({ kind: "food", note: "", foods: [{ name: "Zzqx mystery cake", kcal: 300 }] });
    if (r.kind !== "food") return assert.fail("expected food");
    assert.deepEqual(r.foods[0].matches, []);
    assert.equal(r.foods[0].estimate.kcal, 300);
  });

  it("unclear photos, junk answers and absurd numbers are handled", () => {
    assert.equal(shapePhotoResult({ kind: "unknown", note: "Too blurry." }).kind, "unknown");
    assert.equal(shapePhotoResult("nonsense").kind, "unknown");
    assert.equal(shapePhotoResult({ kind: "label", note: "", label: { basis: "serving", kcal: 0 } }).kind, "unknown");
    const big = shapePhotoResult({ kind: "food", note: "", foods: [{ name: "Feast", kcal: 99999, proteinG: -5 }] });
    if (big.kind !== "food") return assert.fail("expected food");
    assert.deepEqual([big.foods[0].estimate.kcal, big.foods[0].estimate.proteinG], [5000, 0]);
  });

  it("own foods can be matched", () => {
    const mine = { id: "u-1", name: "Amma's sambar", category: "My foods", serving: "1 bowl", grams: 200, kcal: 150, proteinG: 7, carbsG: 20, fatG: 4, diet: "veg" as const, custom: true };
    assert.equal(matchFoods(["amma's sambar"], { custom: [mine] })[0].id, "u-1");
  });

  it("only JPEG, PNG and WebP data URLs are accepted", () => {
    assert.deepEqual(parseImageDataUrl("data:image/jpeg;base64,/9j/4AAQ"), { mediaType: "image/jpeg", data: "/9j/4AAQ" });
    assert.equal(parseImageDataUrl("data:image/gif;base64,R0lG"), null);
    assert.equal(parseImageDataUrl("https://example.com/a.jpg"), null);
    assert.equal(parseImageDataUrl("data:image/png;base64,abc<script>"), null);
  });

  it("sends the image to the AI and shapes the reply", async () => {
    let seen: unknown;
    const ai: AiClient = {
      label: "Fake",
      structured: async (o) => {
        seen = o.image;
        return { kind: "food", note: "", foods: [{ name: "Poha", kcal: 250 }] };
      },
      stream: async () => "",
    };
    const r = await analyzeFoodPhoto(ai, { mediaType: "image/jpeg", data: "abc" });
    assert.deepEqual(seen, { mediaType: "image/jpeg", data: "abc" });
    assert.equal(r.kind, "food");
  });
});
