# StarkFitIQ features

Everything the app does today, grouped by area. Status as of 23 Nov 2026 (including [the training and nutrition upgrades](docs/training-upgrades.md)). For what's still missing and the order it will be built in, see [PRODUCT_PLAN.md](PRODUCT_PLAN.md).

**Bring your own AI.** Each user connects their own AI provider. Every AI feature except food photos also works without a key: the app hands you a ready-made prompt to paste into Claude, and you can paste the reply back. Meal ideas, adaptive calories and the reshuffle are rule-based and need no key at all.

---

## Public site

- **Landing page**: hero video reel, marquee, story, goal picker, features, film, gallery, pricing, FAQ and a call to action.
- **Disciplines blog** (`/disciplines`): articles on strength, cardio, mobility, technique, consistency and sport.

## Account and security

- Sign up with name, email, age and password, then verify your email.
- Log in, log out, and log out of every device.
- Forgot and reset password by email. Emails go out through Gmail SMTP: verify, reset, and "your password was changed".
- Change your password; doing so signs out every other device.
- See the devices you're signed in on and sign out any one of them.
- Delete your account and all its data.
- Under the hood:
  - Passwords are hashed with Argon2id.
  - Sessions use short-lived access tokens with refresh tokens.
  - Every write is protected against cross-site request forgery.
  - Security headers, CORS and rate limits are set, with stricter limits on login and AI calls.

## Onboarding

- Setup opens with 2 of 8 steps done, since sign-up already covers account and basics.
- The other six steps:
  - Goal.
  - Body, in kg or lb.
  - Training: days per week, session length, experience.
  - Equipment and injuries.
  - Diet (optional).
  - AI coach (optional).
- Progress is saved after every step and resumes where you left off. Done steps show green, skipped optional steps show red.
- A welcome card on Today offers *Continue setup* or *Skip for now*. You can finish later, or redo setup from Profile.

## Starter plan (rule-based, no AI)

- Your answers pick a split for 2–6 days a week and exercises from the built-in library.
- Your goal sets the sets, reps, rest and cardio. Session length caps how many exercises go in each day.
- Experience and equipment filter the exercises.
- Injuries to the knee, lower back, shoulder, wrist or elbow remove exercises that load that joint and add matching constraints.
- The same answers always give the same plan. "Here's your week" shows it, and the old plan stays in plan history.

## Today (`/dashboard`)

- Today's workout: title, exercise count and estimated minutes, with Start, Resume, or Done ✓ linking to the summary.
- Readiness from today's check-in, a 7-day week strip and your training streak.
- **Weekly goal ring**: workouts done this week against your goal ("2/3 · 1 to go, 4 days left"), with trained and planned days, and a link to reshuffle missed ones.
- If today's workout was moved from a missed day, the card says so.
- A coach tip picked by rules from your lowest score.
- A food card: calorie ring, protein and water bars, Add food and View day.
- Weekly stats, the score report and the trend.
- The check-in card or setup card shows until it's done.

## Daily check-in (`/checkin`)

- Weight, mood, sleep, energy, soreness and stress, one tap each. Any single answer is enough to save.
- Readiness verdict: "Ready to push", "Train as planned" or "Go lighter today", with advice. It shows on Today and goes into the coach's context.
- Edit today's entry and see the last 14 days.

## Plan (`/plan`)

- **This week view**: each day is marked done, today, upcoming, missed or rest.
- **Day preview**: exercises with sets × reps, your last best set, links to exercise detail, and Start this workout.
- **Manage plans**: paste a Markdown plan and it becomes structured training days. You can also edit days, switch the active plan, and delete plans.
- **Plan review**: weekly muscle volume, recovery days, session length and constraint safety.
- **Missed-session reshuffle**: missed workouts move to this week's free rest days in one tap, planned days stay put, extras are suggested as skips, and there's an undo. A missed Monday done on Wednesday counts as Monday in your weekly score.
- **AI plan generator**:
  - Add an optional note, and your AI writes the week from your setup answers using only exercises that suit your equipment, level and injuries.
  - Hard checks cover day count, exercise choice, volume and session length. It gets one retry, then falls back to the rule-based plan.
  - You see a preview before **Use this plan**.
  - Without a key, you get a prompt for Claude, and the pasted reply gets the same checks.

## Live workout (`/workout/live`)

- **Workout timer**: start-to-finish, worked out from server timestamps, so it survives reloads, tab switches and a locked phone.
- **Controls**: pause, resume and discard. Finish works any time, even half done; if sets are left, a warning lists them first.
- **Empty workout**: start with no plan, then add exercises as you go or just time a class.
- **Set rows**: weight and reps filled in from last time, tick to complete, add or remove sets, notes. Exercises can be swapped for safe alternatives.
- **Per-set effort**: after a set, rate it Easy, Good, Hard or Max. Last time's effort turns into a hint ("felt easy: add a little weight").
- **Rest timer**: starts when you tick a set (90 s for compound lifts, 60 s for isolation, ±15 s, or skip) and remembers your rest per exercise. When rest ends you get a beep, a vibration and a background notification.
- **Keeps the screen on** during a workout, if you allow it.
- **Autosave** on every tick and every 15 seconds.
- **Resume pill** in the header on every page while a workout is running.

## Workout summary

- Time, sets done vs planned, volume and estimated calories.
- Personal records from this session, with a small celebration.
- "vs last time" for each exercise: ↑, = or ↓ on best set and volume, plus a "next time" hint from your effort ratings.
- Working vs resting time.
- Session RPE (effort, 1–10), notes, and fixing the duration if you forgot to press Finish.
- **Coach note**:
  - A rule-based note always shows straight away.
  - With an AI key, an AI note is written automatically after Finish and can be regenerated.
  - Without a key, you get a prompt to paste into Claude.

## Workout log and history

- **Log** (`/log`): fill in past days: exercises, sets, reps, weight, negatives, timed sets, per-side sets, cardio (type, minutes, speed, incline, distance), effort, steps, sleep and notes.
- **Quick add with AI**: describe your day in plain words, paste the AI's JSON back, and it becomes a saved log covering training, cardio, food, water, steps and sleep.
- **History** (`/history`): all sessions, and calories per week.

## Progress (`/progress`)

- Bodyweight over 30, 90 or 365 days, in your units: weigh-ins as dots, **trend weight** as a line that smooths day-to-day swings, and your recent weekly rate.
- Strength: best estimated one-rep max per session for any exercise, plus your best sets.
- Personal records: heaviest weight, best estimated one-rep max, and most reps at a weight.
- Training calendar coloured by effort.
- Totals: sessions, time trained and volume, this month vs last.

## Exercise library (`/exercises`)

- 82 built-in exercises plus any you've used. Search, and filter by muscle, movement pattern and equipment, with a "Safe for my injuries" filter.
- **Detail page**:
  - How to do it, form cues and common mistakes.
  - Muscles worked, a photo and a Watch on YouTube link.
  - Your history chart and last sessions.
  - Safer alternatives, and an injury warning if it loads a joint you've flagged.

## Weekly score

- **Score out of 100**, weighted:

  | Part | Weight | What it checks |
  |---|---|---|
  | Adherence | 35% | Sessions and sets done |
  | Progressive overload | 25% | Estimated one-rep max vs last week |
  | Rep-range quality | 15% | Sets inside the target range |
  | Muscle balance | 15% | Sets per muscle vs plan |
  | Recovery and safety | 10% | Effort and constraint violations |

- **Mid-week scores** only count days that have passed.
- **AI review**: with a key, the AI interprets the numbers and suggests changes. Without one, you get a prompt to paste into Claude and can paste the result back.
- **Score history and trend**.

## Constraints

- Exercises that clash with your injuries or limits are flagged, with safer alternatives suggested. This applies to the plan, the library, swaps and coach suggestions.

## AI coach

- **Coach on every page**: a bar at the bottom opens one ongoing conversation. Replies stream in and keep going in the background.
- **Page awareness**: the coach knows which page you're on, and quick prompts change to match.
- **Proposed changes**: the coach can suggest swapping an exercise, changing sets or reps, moving a workout, setting rest, starting a workout or adding a note. Nothing changes until you tap Apply today or Apply to plan, and there's Undo.
- **Full chat page** (`/chat`).
- **What the coach knows**: your plan, logs, scores, constraints, readiness and today's food against your targets.
- **Without a key**: a copyable prompt, an Open Claude button and a "Paste reply back" box. Changes it suggests still show as Apply cards.
- **AI providers**: Anthropic (Claude), OpenAI, Gemini, Groq, Mistral, OpenRouter or any OpenAI-compatible endpoint. Keys are encrypted at rest, can be tested before saving, and custom endpoints are blocked from reaching private networks.

## Nutrition

- **Daily targets (formula-based)**:
  - Calories, protein, carbs, fat and water from your age, height, weight, sex, training days and goal.
  - Training days get more calories than rest days, with the weekly average unchanged.
  - Never below your resting burn or 1200 kcal.
  - **Adaptive calories**: targets adjust to your real weight trend. They use your food logs when there are 10+ days of them, are capped at ±500 kcal, and explain every change.
  - "How these targets are set" explains the numbers.
- **Indian-first food database**:
  - 174 foods in home portions (katori, roti, plate, glass).
  - Regional names, e.g. chapati / phulka / rotli, golgappa / puchka.
  - Veg, egg, non-veg and vegan tags.
- **Food search**: follows your diet (veg, eggetarian, vegan), with an "include everything" switch, and ranks exact and prefix matches first.
- **Add food**:
  - Meal chips default to the time of day.
  - Pick servings from 0.25 to 20, with live calories and macros.
  - Tabs for Recent, Favourites, My foods (your own recipes) and Quick add (just a name and calories).
- **Food from a photo**, read by your own AI:
  - **Nutrition label**: the values are copied. Per-100 g tables are converted to a serving, and there's a "whole pack" shortcut.
  - **Meal or dish**: each item is named, estimated for the portion shown, and matched to the database.
  - **Editable before saving**: every value can be changed, items can be unticked, and a label can be saved to My foods.
- **Edit after adding**: change the name, meal, servings, or calories and macros of any entry.
- **What should I eat now?**: three meal ideas from the food database that fit what's left today, following your diet and leaning toward foods you eat. Shuffle for others, and add a whole meal in one tap.
- **Meal planner** (`/nutrition/plan`): a full day of Indian home-style meals that adds up to your targets. Swap any meal, log one meal or the whole day, or make a new plan.
- **Nutrition page**: calorie ring, macro bars, water glasses (±250 ml), four meal cards and a 7-day chart against targets. Any day can be opened.
- **Older data**: food and water typed into old workout logs move into the food log, and weekly scores and the coach read from it.

## Profile and settings

- Tabs: About you, Training, Workout preferences, Constraints, AI coach, and Account & security.
- Units: kg or lb, cm or in; every number in the app follows them.
- Workout preferences: default rest times, rest-timer sound and vibration, keep screen awake.
- Redo setup to build a fresh starter plan.

## Across the app

- **Navigation**: sidebar on desktop, bottom tab bar on phones.
- **Search** (top bar): pages, exercises, past workouts and logs.
- **Notifications**: workout in progress, check-in due, today's workout, rest day, workout done, AI not connected.
- **Light and dark theme**, plus a date selector in the top bar.
- **Accessibility**: keyboard-navigable tabs and dialogs, and reduced motion respected.

---

## Not built yet

- Plans that adapt themselves week to week (the generator writes a new plan on request).
- Readiness adjusting the session automatically.
- Recipes, and meal ideas from your own foods.
- Phone app / offline use, data export, billing and per-user AI usage caps.
