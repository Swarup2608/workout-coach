# Training and nutrition upgrades

Built 23 Nov 2026. Closes these Phase 1 items in [PRODUCT_PLAN.md](../PRODUCT_PLAN.md): per-set effort rating, bodyweight smoothing, weekly goal ring, missed-session reshuffle, adaptive calories, "what should I eat now", the meal planner and the AI plan generator. Food details also live in [nutrition.md](nutrition.md).

Everything here is rule-based except the plan generator, which uses the user's own AI. Without a key, the generator gives a prompt to paste into Claude, and the pasted reply gets the same checks.

---

## 1. Per-set effort

**What the user sees.** After ticking a set in a live workout: "How hard?" with **Easy · Good · Hard · Max** (optional, tap again to clear). The summary shows a "next time" hint for each exercise. The next live workout shows last time's hint under the exercise name.

**Rules** (`domain.ts → nextTimeHint`). Effort is stored as reps in reserve (`rir`: Easy 4, Good 2, Hard 1, Max 0).
- Every rated set easy (3+ in reserve) → "add a little weight (2.5 kg) or 2 reps" (timed work: "go a bit longer").
- Max before the last set, or very hard on average (< 0.75 in reserve) → "keep the same weight and own it".
- Otherwise → "same weight, aim for one more rep".

The coach sees effort in the set list ("felt easy, ~4+ in reserve"). Re-saving a day from /log keeps effort and tick times.

## 2. Bodyweight smoothing

**What the user sees.** On Progress: weigh-ins as faint dots, **trend weight** as the line, "Trend −1.2 kg over 90 days · −0.3 kg/week lately", and the trend value in the hover tip.

**Rules** (`domain.ts`).
- `trendWeights`: an exponential moving average. Each day pulls the trend 10% of the way to the day's weigh-in, and a gap of n days pulls 1 − 0.9ⁿ.
- `weeklyWeightRate`: a least-squares line through the **raw** weigh-ins of the last 28 days. It needs 5+ weigh-ins spanning 10+ days. Raw points avoid the lag a moving average has in its first weeks, which would understate a steady loss.

## 3. Weekly goal ring

**What the user sees.** A ring on Today: workouts done this week against the goal ("2/3"), one line of status ("1 to go, 4 days left"), and seven dots (green = trained, outlined = planned).

**Rules** (`insights.ts → weekGoalFor`).
- **Week:** Monday to Sunday.
- **What counts:** a finished workout with a ticked set or timed minutes. A live workout doesn't count.
- **Goal:** the plan's training days, else the profile's days per week, else 3.
- **Days left:** includes today until something is logged.

## 4. Missed-session reshuffle

**What the user sees.**
- On Plan → This week, a card such as "Missed Mon (Upper)", with the suggestion "Do Upper on today (a rest day)". **Reshuffle this week** applies it.
- Moved days show "moved from Mon" on their new date. The original day shows "Moved to Wed", then "Done Wed" once trained.
- An undo link sits above the week.
- Today shows "Today's workout · moved from Monday". The goal ring links to Plan when there's something to reshuffle.

**Rules** (`services/reshuffle.ts`).
- **Missed:** a planned training day whose date has passed, with no workout this week that followed it. A workout follows its `planDay` if it was started from another day, else its own weekday.
- **Moves:** missed workouts go into free rest days from today to Sunday, oldest missed into the earliest free day. Planned days still ahead stay where they are.
- **Overflow:** what doesn't fit is shown as a skip ("better than doubling up").
- **Storage:** moves are saved on the active plan as `weekMoves: { weekStart, moves[] }` and ignored once the week ends. The plan's days never change.
- **Validation:** moves must fall between today and Sunday, use distinct dates, and point at a real training day.

**Scoring fix.** Weekly adherence now credits the plan day a workout followed (`followedDay`), not just its date. Doing Monday's workout on Wednesday counts as Monday done.

## 5. Adaptive calories

**What the user sees.** On Nutrition, a line such as "−200 kcal a day from your weight trend (0 kg/week vs a goal of −0.4)". "How these targets are set" explains every change.

**Rules** (`services/nutrition.ts → adaptiveDelta`, applied inside `computeTargets`).
- **Goal pace:** fat loss −0.5% of bodyweight a week, muscle gain +0.25%, strength +0.1%, maintain and general 0.
- **Trend:** from `weeklyWeightRate` over check-ins (workout-log bodyweight fills days without one).
- **With 10+ days of food logs in the last 21** (today excluded, since it's not over):
  - real burn = average intake − trend change × 7700 / 7
  - target = real burn + goal change
- **Otherwise:** half the gap between the actual and goal pace, and only when they're more than 0.15 kg a week apart.
- **Limits:** capped at ±500 kcal and rounded to 50. Training and rest days move together, and the BMR / 1200 floor still applies.

## 6. What should I eat now · 7. Meal planner

Both use `services/mealSuggest.ts` and only database foods.

**What the user sees.**
- **Nutrition (today):** a "What should I eat now?" card with a meal picker, three ideas (foods, servings, kcal, macros and why each fits), **Add to lunch** (all items in one tap) and **Shuffle**.
- **Meal plan** (`/nutrition/plan`, also in search): four meals that add up to the day's targets, each with **Swap** (3 options) and **Log**. The page also has **Log the whole day**, **New plan**, and macro bars for the plan against your targets.

**Rules.**
- **Templates:**
  - Breakfast: a breakfast dish (+ dal / dairy / eggs / fruit), bread + dairy or eggs, or eggs (+ bread or fruit).
  - Lunch and dinner: roti or rice + dal or curry (+ vegetable, protein or dairy).
  - Snack: fruit, nuts, dairy, protein, a light snack or eggs (+ fruit or a drink).
- **Filters:** your diet. Never sweets, fats, "other meals", or anything over 55% fat. Whey only at snacks. No two items with the same first word (no soya curry + soya chunks).
- **Score:** distance from the calorie budget × 1.2 + the protein shortfall × 0.8, plus a penalty when fat is over 35% of the meal. Favourites and foods eaten in the last 30 days get a small boost.
- **Servings:** the main item's servings fill the budget in half steps from 0.5 to 6 (six idlis is a normal plate). One option per main food, so the three ideas differ. The seed changes near-ties.
- **"Now" budget:** what's left today is split between this meal and the later unlogged meals by their share (breakfast 25%, lunch 35%, snack 10%, dinner 30%). With fewer than 150 kcal left, it suggests a light, high-protein snack instead.
- **Day plan:** each meal gets its share of the day's targets.
- **Without targets:** assumes 2000 kcal and 100 g protein, and says so.

## 8. AI plan generator

**What the user sees.** Plan → Manage plans → **Generate a plan with AI**: an optional note ("bigger arms"), then **Generate plan**, then a preview of the week. The preview shows a summary, where the plan came from, any rule problems, and each day's exercises. **Use this plan** saves it as the active plan, and the old one stays in history. Without a key, the panel shows the prompt with Copy / Open Claude and a box for the reply, and **Check plan** previews it.

**Rules** (`services/planGenerator.ts`).
- **Allowed exercises:** library exercises that match the user's equipment and level and don't stress a reported injury. The AI may use only these names.
- **Hard checks:** each one rejects the plan.
  - Exactly the profile's training days, on distinct weekdays, with at most 3 in a row (up to 5 days a week).
  - 2 to (slot cap + 1) exercises a day, with no repeats.
  - Total sets × 2.5 min ≤ session length + 10.
  - Sets 1–6. Reps 1–30, or 10–120 seconds for timed work, with low ≤ high.
  - Weekly sets for legs, push and pull each between 6 and 30.
- **Retries:** one retry with the problems listed, then the rule-based starter plan, labelled as such.
- **Saving:** the result is written in the starter plan's Markdown format, so saving goes through `POST /plans` and the plan is stored and edited like any other.
- **Limits:** 10 generations per user per 10 minutes. Setup answers are required (422 `setup`).

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/today` | now also `weekGoal` (with `toReshuffle`) and `movedFrom` |
| GET | `/api/reshuffle?date=` | `ReshuffleSuggestion` (missed, moves, skipped, applied) |
| PUT | `/api/reshuffle` | `{ date, moves: [{ date, planDay }] }`; `[]` clears |
| GET | `/api/nutrition/suggest?date=&meal=&seed=` | `MealSuggestions` |
| GET | `/api/nutrition/plan?date=&seed=` | `DayMealPlan` |
| POST | `/api/nutrition/day/:date/entries/bulk` | `{ meal, items: [{ foodId, servings }] }` (1–10) |
| POST | `/api/plans/generate` | `{ notes? }` → `GeneratedPlan` preview; 409 `no_ai`, 422 `setup` |
| POST | `/api/plans/generate/prompt` | `{ notes? }` → `{ text }` to paste into Claude |
| POST | `/api/plans/generate/check` | `{ text }` → `GeneratedPlan` with `problems` |

Sets accept `rir` (0–4) on `PATCH /sessions/:id` and `PUT /sessions`. Nutrition targets include `adaptive`.

## Files

- Server: `services/reshuffle.ts`, `services/mealSuggest.ts`, `services/planGenerator.ts` and `routes/planGen.ts` (new). Changes in `domain.ts` (effort, trend weight, new types), `services/nutrition.ts` (adaptive), `services/metrics.ts` (followed day), `services/records.ts`, `services/claude.ts`, `routes/insights.ts`, `routes/nutrition.ts`, `routes/workout.ts`, `routes/api.ts` and `repo.ts`.
- Client:
  - New: `components/plan/PlanGenerator.tsx`, `components/nutrition/MealIdeas.tsx`, `app/(app)/nutrition/plan/page.tsx`.
  - Changed: the live workout, summary, Progress, Today (`WeekGoalCard`), Plan, Nutrition, `LineChart` (trend line), `lib/domain.ts`, `lib/api.ts` and the search palette.

## Tests

`npm test` in `server`: 178 passing (51 new). New suites: `effort`, `weightTrend`, `weekGoal`, `reshuffle` (rules and API), `mealSuggest`, `planGenerator` (checks, flow with a fake AI, the no-key path) and `planGen` (API). The nutrition and workout suites gained cases for adaptive calories, meal ideas, bulk add and effort round trips. Both typechecks and both production builds pass.

Not checked in a browser, and the generator hasn't been tried with a real AI key.
