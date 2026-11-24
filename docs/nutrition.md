# Nutrition module

Phase 1, step 6 of [PRODUCT_PLAN.md](../PRODUCT_PLAN.md). Built 20–21 Nov 2026; photo food and editing after adding on 23 Nov 2026.

It covers daily calorie and macro targets, an Indian-first food database, a food log with search, recent items, favourites, your own foods and quick-add, a water tracker, a Nutrition page, an Add-food page and a food card on Today. Adding food from a photo (a meal or a nutrition label) uses the user's own AI; everything else is rule-based and works without a key.

---

## What the user sees

| Where | What |
|---|---|
| **Today** (`/dashboard`) | "Food today" card: calorie ring (kcal left or over), protein and water bars, Add food and View day buttons |
| **Nutrition** (`/nutrition`, `?date=` for other days) | Calorie ring, protein / carbs / fat bars, "How these targets are set", water glasses (+/− 250 ml), four meal cards with entries (servings −/+, delete), 7-day calories chart with each day's target |
| **Add food** (`/nutrition/add?meal=&date=`) | Meal chips (defaults to the time of day), search box with a **Photo** button, then Recent / Favourites / My foods / Quick add tabs. Tapping a food opens a servings picker (0.25–20, chips 0.5–3) with live kcal and macros |
| **Nutrition, each entry** | Pencil button: edit name, meal, servings, and calories / protein / carbs / fat of one serving. Works on every entry (database, own food, quick-add, photo, imported) |
| **Workout log** (`/log`) | The food table is replaced by a one-line summary and an "Open nutrition" link. Steps and sleep stay here; water moved to Nutrition |
| **Sidebar, mobile tabs, search palette** | Nutrition entry ("Food" on the mobile tab bar) |
| **Coach** | Chat and the copyable prompt both get a "NUTRITION TODAY" block (eaten vs targets, items) |

If age, height or bodyweight is missing, no targets are shown. Instead the page names what's missing and links to Profile.

## Targets (rule-based)

`server/src/services/nutrition.ts → computeTargets`

1. **Bodyweight:** latest check-in weight (last 90 days), then the latest workout-log bodyweight, then the profile's start weight. The page says which one it used.
2. **BMR:** Mifflin-St Jeor. Sex "other" or unset uses the midpoint of the male and female constants (−78).
3. **Average daily burn (TDEE):** BMR × activity factor from training days per week: 0–1 → 1.2, 2–3 → 1.375, 4–5 → 1.55, 6–7 → 1.725. Training days come from the active plan, else from the profile.
4. **Goal:** fat loss −20%, muscle gain +10%, strength +5%, maintain / general 0%.
5. **Training vs rest days:** training days get 12% more than rest days, and the weekly average stays the same. A day counts as a training day when the plan has a workout that weekday or a set was logged.
6. **Floor:** never below BMR or 1200 kcal.
7. **Macros:** protein by goal (fat loss 2.0, muscle gain / strength 1.8, maintain 1.6, general 1.4 g/kg; at most 220 g). Fat is 25% of calories and at least 0.6 g/kg. Carbs make up the rest.
8. **Water:** 35 ml/kg, plus 500 ml on training days, rounded to 250 ml.
9. **Adaptive calories (23 Nov):** the daily average moves toward your goal's weekly pace using the real weight trend. It uses food logs when there are 10+ days of them, is capped at ±500 kcal, and keeps the floor. Rules in [training-upgrades.md](training-upgrades.md#5-adaptive-calories).

Example: a 30-year-old man, 180 cm, 80 kg, 4 days a week, maintain → BMR 1780 and TDEE 2759, giving 2900 kcal on training days and 2570 on rest days, with 128 g protein.

## Food from a photo

`server/src/services/foodPhoto.ts`, `client/src/components/nutrition/PhotoFood.tsx`

1. On Add food, **Photo** opens the camera or gallery. The browser shrinks the photo to 1600 px JPEG (under the 2 MB body limit) and sends it to `POST /api/nutrition/photo`.
2. The server sends it to the **user's own AI** (Anthropic, or any OpenAI-compatible provider) with one forced tool call. The model must understand images; if it doesn't, the error says so.
3. The AI decides what the photo is:
   - **Nutrition label:** the numbers are copied as printed. A per-100 g table becomes one serving when the serving weight is printed (e.g. 600 kcal/100 g, 32 g serving → 192 kcal), otherwise the serving is "100 g". kJ-only labels are converted. Servings per pack are kept, so "Ate the whole pack" is one tap.
   - **Food or a dish:** up to 6 items, each with a name (Indian dish names preferred), the portion it saw and its estimate. Each item is searched in the food database (name, then 1–3 other names), and the top 3 matches are shown. The diet filter is off here, since the photo shows what was eaten. Own foods match too.
   - **Neither:** a short reason ("too blurry") and a hint to retake or search.
4. **Nothing is saved yet.** The review card shows every value as an editable field: name, serving, servings eaten, calories, protein, carbs, fat. For food, chips switch between "As seen" (the AI's estimate) and each database match; any edit after that turns it into the user's own values. Items can be unticked.
5. **Add** saves the ticked items to the chosen meal. A database match the user didn't change is added by `foodId` (so it counts in Recent and favourites); anything else is added with `source: "photo"` and its serving label. A label can also be saved to My foods first, so it shows in search next time.
6. After adding, the pencil on the Nutrition page edits any entry again.

Limits: 30 photos per user per 10 minutes. Without an AI key the button explains how to connect one (Profile → AI coach); there is no copy-paste fallback for photos. Photos are not stored.

## Food database

`server/src/seed/foods.json`: 174 foods. Each one has a per-serving value for a typical home portion (katori, roti, plate, glass), grams per serving, aliases, category and a diet tag (`vegan`, `veg`, `egg`, `non_veg`). Coverage: breads (roti, paratha, thepla, millet rotis), rice dishes, dals and curries, South Indian breakfasts, eggs, dairy, protein foods, snacks and street food, sweets, fruit, drinks, and common non-Indian meals.

- Values are estimates from common Indian food tables. A test checks that every food's calories are within 20% of 4/4/9 × its macros (beer is the exception, because of alcohol). The Add-food page notes that restaurant food usually has more oil.
- Aliases cover regional names (chapati / phulka / rotli, golgappa / puchka, pappu / paruppu, chaas / majjige / moru, …).
- **Diet filter:** search hides foods outside the profile diet (veg → vegan + veg; eggetarian → + egg; vegan → vegan only). "Include everything" turns the filter off. Your own foods always show.
- **Search ranking:** exact name or alias, then name prefix, alias prefix, word prefix, then anywhere. Every word in the query has to match. Your own foods win ties.

## Data model

- `food_logs` collection: one document per user and local date: `{ date, entries[], waterMl, updatedAt }`, unique index on `(userId, date)`. Each entry stores `servings`, the per-serving nutrition (`per`) and the scaled totals, so changing the servings rescales the totals and later edits to a food don't rewrite past days. `source` is one of `db`, `custom`, `quick`, `photo` or `import`. Editing calories or macros changes `per` and the totals are worked out again from `per` × servings.
- `nutrition_prefs` collection: one document per user: `{ favourites: foodId[], customFoods: FoodItem[] }` (up to 200 favourites and 300 own foods).
- Account deletion removes both.

### Older data

Food and water used to be typed into each day's workout session (`session.food`, `session.waterL`).
- The first time a day's food log is read or written, that day's session food becomes its entries (`source: "import"`) and its water becomes `waterMl`. Nothing is lost or counted twice.
- Week scoring, the weekly handoff and the coach read through `mergeFoodLogs`: a day's food log replaces session food for that date, and days with food but no workout are added as food-only days (read-side only, never saved).
- `PUT /sessions` no longer needs `food` / `waterL`. If they are left out, what's stored is kept, so older clients still work.
- **Quick add with AI** (day-import) now adds food and water to the food log instead of the session.

## API (signed in, CSRF on writes)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/nutrition/day/:date` | | `NutritionDay` (log, totals, targets or `missing`, trainingDay) |
| GET | `/api/nutrition/week?date=` | | 7 days of kcal / macros with each day's target |
| POST | `/api/nutrition/day/:date/entries` | `{ meal, foodId, servings }` or `{ meal, name, kcal, proteinG?, carbsG?, fatG?, servings?, serving?, source?: "quick" \| "photo" }` | updated `NutritionDay` |
| PATCH | `/api/nutrition/day/:date/entries/:id` | `{ servings?, meal?, name?, kcal?, proteinG?, carbsG?, fatG? }` (macros are per serving) | updated `NutritionDay` |
| POST | `/api/nutrition/photo` | `{ image }` (JPEG / PNG / WebP data URL, ≤ 1.9 MB) | `PhotoResult` draft (`label`, `food` or `unknown`); 409 `no_ai` without a key, 502 if the AI fails |
| DELETE | `/api/nutrition/day/:date/entries/:id` | | updated `NutritionDay` |
| PUT | `/api/nutrition/day/:date/water` | `{ waterMl }` (0–10000) | updated `NutritionDay` |
| GET | `/api/nutrition/foods?q=&all=1` | | `{ foods, diet }` (top 40) |
| GET | `/api/nutrition/library?date=` | | `{ recent (25, last 60 days), favourites, custom }` |
| PUT / DELETE | `/api/nutrition/favourites/:foodId` | | `{ favourites }` |
| POST | `/api/nutrition/custom-foods` | `{ name, serving?, grams?, kcal, proteinG?, carbsG?, fatG? }` | `FoodItem` (201) |
| DELETE | `/api/nutrition/custom-foods/:id` | | 204 (also removes it from favourites) |

Validation: real calendar dates only. Meals are breakfast, lunch, dinner or snack. Servings run 0.25–20, kcal 0–5000 and grams 0–1000. Bodies are strict (unknown keys give 400), and a day holds up to 100 items.

## Files

- Server: `services/nutrition.ts` (database, search, targets, merge), `services/foodPhoto.ts` (photo prompt, label maths, database matching), `routes/nutrition.ts`, `seed/foods.json`; image support in `services/ai.ts`; changes in `db.ts`, `repo.ts`, `domain.ts`, `routes/api.ts` (mount, scoring merge, day-import, chat context) and `routes/coach.ts` (prompt context).
- Client: `app/(app)/nutrition/page.tsx` (with the entry editor), `app/(app)/nutrition/add/page.tsx`, `components/nutrition/NutritionUi.tsx` (shared macro inputs), `components/nutrition/PhotoFood.tsx`; changes in `lib/domain.ts`, `lib/api.ts`, the dashboard, the log page, Sidebar, MobileTabs, SearchPalette and Icons.

## Tests

`npm test` in `server`: 127 passing (38 for nutrition).
- `services/nutrition.test.ts`: BMR and TDEE numbers, training vs rest split keeps the weekly average, goal effects, the 1200 kcal / BMR floor, the "other" sex midpoint, plan days winning over profile days, missing fields, the database's integrity and macro-vs-calorie check, search by alias, the diet filter, own foods, and the merge.
- `services/foodPhoto.test.ts`: per-serving and per-100 g labels, food matched to the database (diet filter off), unknown items keep the AI estimate, junk answers and out-of-range numbers, own-food matches, data-URL checks, the image reaching the AI.
- `routes/nutrition.test.ts`: targets from profile then check-in, editing calories / macros / name after adding, photo entries with serving and source, photo endpoint without an AI key and with a bad image, add by servings, quick-add, rescale and meal move, water, delete, input validation, diet-filtered search, own foods, favourites, recent, older session food becoming the food log, day-import into the food log, weekly metrics counting the food log, privacy between users, and account deletion.

## Not built yet

- A licensed food database. (Barcode scan is dropped: a photo of the nutrition label does the same job.)
- A confidence flag on mixed dishes in photo results, and photos without an AI key.
- Recipes, fibre and micronutrient targets. (Adaptive calories, "what should I eat now" and the meal planner were added on 23 Nov; see [training-upgrades.md](training-upgrades.md).)
- Copy yesterday's meal.
- Weekly goal ring on Today.
