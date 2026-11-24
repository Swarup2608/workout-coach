# StarkFitIQ: Spec vs Reality, and the Plan to Close the Gap

Spec date: 17 Nov 2026. Audit date: 18 Nov 2026. Branch: master (landing-page work uncommitted).

> **Update, 18 Nov 2026:** onboarding (Phase 1, step 1) is built: in-app welcome on the dashboard, 8-step onboarding, rule-based plan generation with a plan reveal page, a daily check-in (weight, mood, sleep) and kg/lb units. Details: [docs/onboarding.md](docs/onboarding.md). The tables below are updated; rows that changed say so.

> **Update 2, 18 Nov 2026:** the daily training loop is built: coach chat on every page (with page context and Apply/undo for coach-proposed changes), Home / Today, plan week view with day preview, live workout with a start-to-finish timer and rest timer, workout summary with PRs, exercise library and detail, progress page, check-in with readiness, and a sectioned profile with cm/in. Every AI feature falls back to a copyable prompt without a key. Details and demo: [docs/app-completion.md](docs/app-completion.md), [docs/workflow/](docs/workflow/). Rows changed by this update are marked *(18 Nov, loop)*.

> **Update 3, 21 Nov 2026:** the nutrition module is built: rule-based daily targets (Mifflin-St Jeor, goal, more on training days), a self-built Indian-first food database (174 foods with regional aliases and a diet filter), a food log with search, recent, favourites, own foods and quick-add, a water tracker, the Nutrition and Add-food pages, a food card on Today, and the coach and week scoring reading the food log. Details: [docs/nutrition.md](docs/nutrition.md). Rows changed by this update are marked *(21 Nov, nutrition)*.

## Context

The spec describes a mobile-style consumer fitness app: onboarding, then a daily loop of check-in, train, eat, progress, with 6 P0 AI features and 31 pages (18 P0).

The codebase is a different product today. It is a **web-based plan logger with AI scoring** (Next.js client, Express 5 + MongoDB server, bring-your-own-AI keys). Users paste a plan, log sessions and food by hand, and get a weekly AI score and a coach chat. The most polished part is the marketing landing page.

Roughly **25-30% of the P0 scope is built**: auth, coach chat, set logging, weekly scoring, theme. The two biggest gaps are the **nutrition module** (about 0% built) and **AI-generated plans** (about 0% built).

---

## 1. What exists

| Area | Built | Where |
|---|---|---|
| Email auth | Register, login, refresh rotation, email verify, forgot/reset password, device sessions, logout-all, delete account. Argon2id, JWT cookies, CSRF, rate limits | server `routes/auth.ts`; client `(app)/login`, `signup`, `forgot-password`, `reset-password`, `verify-email` |
| Per-user AI keys | Anthropic or any OpenAI-compatible provider, AES-256-GCM encrypted, SSRF-checked | server `routes/settings.ts`, `services/ai.ts`; client `AiProviderSettings.tsx` |
| AI coach chat | Streaming (SSE), uses profile, plan, scores and sessions as context, history stored. Prompt says "not a doctor" | server `POST /api/chat`; client `(app)/chat` |
| Set logging | Weight, reps, done flag, negatives, per-exercise notes, session RPE, cardio, previous-session prefill | server `PUT /sessions`; client `(app)/log` |
| Plans | Create from pasted Markdown, edit a day, activate, delete, per-day constraint swaps | server `planParser.ts`, `constraints.ts`; client `(app)/plan` |
| Weekly score and report | Deterministic metrics (adherence, overload, rep quality, balance, recovery) plus AI verdict, offline fallback | server `metrics.ts`, `POST /scores/week`; client dashboard `ScoreReportCard` |
| Theme | Light and dark, follows OS | `ThemeToggle.tsx` |
| Landing and blog | Animated landing page, disciplines blog, pricing and FAQ sections (marketing only) | `components/landing/*`, `app/disciplines` |
| Onboarding *(new)* | Age at signup, dashboard welcome card, 8-step resumable `/onboarding` (goal, body, training, equipment, injuries, diet, optional AI key), skip and redo | server `routes/onboarding.ts`; client `(app)/onboarding`, `SetupCard.tsx` |
| Starter plan *(new)* | Rule-based (no AI): goal × days × session length × equipment × experience, injury exclusions, ~80-exercise library, plan reveal page | server `services/starterPlan.ts`, `seed/workouts.json`; client `onboarding/PlanReveal.tsx` |
| Daily check-in *(new)* | Weight, mood, sleep; one per day; dashboard card until done | server `routes/checkins.ts`; client `CheckinCard.tsx` |
| Units *(new)* | kg/lb per user, stored in kg, applied to onboarding, check-in, log, history, profile | client `lib/units.ts` |
| Nutrition *(21 Nov)* | Daily targets, 174-food Indian-first database, food log (search, recent, favourites, own foods, quick-add), water, Nutrition and Add-food pages, Today card | server `services/nutrition.ts`, `routes/nutrition.ts`, `seed/foods.json`; client `(app)/nutrition`, `components/nutrition` |
| Tests | Auth, profile, onboarding, check-ins, starter plan (every answer combination), scoring, day-import: 57 passing | server `*.test.ts`, shared `test/harness.ts` |

## 2. Gap analysis against the spec

### Pages (31 in spec, 18 P0)

| # | Page | Pri | Status |
|---|---|---|---|
| 1 | Welcome | P0 | **Done** for web: welcome card on the dashboard for new users (no separate `/welcome` page, by decision) |
| 2 | Sign up / log in | P0 | Partial (email only; no Google, no phone OTP). Signup now asks for age |
| 3 | Onboarding | P0 | **Done**: 8 steps, steps 1–2 done at signup, saved per step, skip and redo |
| 4 | Plan reveal | P0 | **Done**: "Here's your week" after onboarding (rule-based plan) |
| 5 | Home / Today | P0 | Partial *(18 Nov, loop)*: today card with Start/Resume, readiness, streak, coach tip, week strip. *(21 Nov, nutrition)* calorie ring, protein and water bars. *(23 Nov)* weekly goal ring |
| 6 | Workout plan | P0 | Partial *(18 Nov, loop)*: "This week" view with status per day and day preview; edit/paste under "Manage plans". No drag reschedule |
| 7 | Nutrition | P0 | **Done** *(21 Nov, nutrition)*: calorie ring, macro bars, how targets are set, water, meals with servings edit, 7-day chart, other dates |
| 8 | Progress | P0 | **Done** *(18 Nov, loop)*: bodyweight trend, e1RM charts per lift, PR list, calendar, totals (30/90/365 days) |
| 9 | Coach | P0 | **Done**; *(18 Nov, loop)* also a chat bar at the bottom of every page with page context and Apply/undo action cards |
| 10 | Workout preview | P0 | **Done** *(18 Nov, loop)*: plan day preview (sets × reps, last best set, Start) and the Today card |
| 11 | Live workout | P0 | **Done** *(18 Nov, loop)*: server-timestamp timer (pause/resume/finish/discard, survives reloads), rest timer with beep/vibrate/notification, swap from library alternatives, add exercises, autosave, wake lock, empty workout |
| 12 | Workout summary | P0 | **Done** *(18 Nov, loop)*: time, sets, volume, kcal, PRs, vs last time, RPE, coach note (AI auto + on demand, prompt without key) |
| 13 | Exercise library | P0 | **Done** *(18 Nov, loop)*: 82 built-in + user exercises; search, muscle, movement, equipment, "safe for my injuries" |
| 14 | Exercise detail | P0 | **Done** *(18 Nov, loop)*: steps, cues, mistakes, photo (stock by movement), YouTube link, history chart, alternatives, injury warning |
| 15 | Add food | P0 | **Done** *(21 Nov, nutrition)*: search with regional aliases and diet filter, Recent, Favourites, My foods, Quick add, servings picker |
| 23 | Daily check-in | P0 | **Done** *(18 Nov, loop)*: weight, mood, sleep, soreness, energy, stress → rule-based readiness verdict; `/checkin` page with 14-day strip |
| 27 | Profile | P0 | **Done** *(18 Nov, loop)*: stats header, section nav, about you, training, workout preferences (rest times, sound, vibration, keep awake), constraints, AI, account |
| 28 | Settings | P0 | **Done** *(18 Nov, loop)*: theme, AI key, kg/lb, cm/in |
| 16-22, 24-26, 29-31 | P1/P2 pages | P1/P2 | All **missing**. Weekly report is partial (card on dashboard), privacy is partial (delete only) |

Totals for the 18 P0 pages: 15 done, 3 partial (sign up, Home / Today, Workout plan), 0 missing *(21 Nov, nutrition)*. Before the nutrition update: 13 done, 3 partial, 2 missing. Before the loop update: 4 done, 8 partial, 6 missing.

### P0 features

| Feature | Status | Note |
|---|---|---|
| Plan generation from onboarding | **Done** *(23 Nov)* | Rule-based starter plan, plus an AI plan generator with hard checks, one retry and the rule plan as fallback; copy-paste path without a key ([docs/training-upgrades.md](docs/training-upgrades.md)) |
| One-tap set logging | Done | |
| Effort rating (per set) | **Done** *(23 Nov)* | Easy / Good / Hard / Max after each set (stored as reps in reserve), turned into a "next time" hint |
| Rest timer | **Done** *(18 Nov, loop)* | Per exercise (compound/isolation defaults, per-exercise overrides), ±15 s, survives reloads, background notification |
| Progressive overload (auto next load + reason) | Partial | e1RM and hints are scored; nothing auto-adjusts |
| Exercise swap | **Done** *(18 Nov, loop)* | Live workout swap from same-pattern, equipment- and injury-filtered alternatives; coach can propose swaps (today or plan) |
| Missed-session reshuffle | **Done** *(23 Nov)* | Missed workouts move to this week's free rest days; scoring credits the plan day a workout followed |
| PR detection | **Done** *(18 Nov, loop)* | Weight, e1RM and reps PRs; shown on the summary and Progress |
| Calorie and macro targets | **Done** *(21 Nov, nutrition)* | Rule-based (Mifflin-St Jeor × training days, goal adjustment, training days higher). Not yet adaptive to the weight trend |
| Food logging (search, recent, favourites, quick-add) | **Done** *(21 Nov, nutrition)* | Plus own foods; day-import (AI) adds to the same food log |
| Indian food database | **Done** *(21 Nov, nutrition)* | Self-built, 174 foods, regional aliases, veg / egg / non-veg / vegan tags. No licensed source yet. Barcode scan dropped: photos of the nutrition label replace it |
| Protein tracker | **Done** *(21 Nov, nutrition)* | Protein bar against a goal-based target on Nutrition and Today; water tracker too |
| Strength charts, bodyweight trend, workout history calendar | **Done** *(18 Nov, loop)* | Progress page (bodyweight not smoothed yet) |
| Daily check-in | **Done** *(18 Nov, loop)* | Six answers, rule-based readiness |
| Streaks and weekly goal ring | **Done** *(23 Nov)* | Training streak and a weekly goal ring on Today |
| Accounts and sync | Done | |
| Units (kg/lb, cm/in) | Done | Per user, stored in kg and cm *(cm/in 18 Nov, loop)* |
| Dark theme | Done | |

### P0 AI features (6)

| AI feature | Status |
|---|---|
| Plan generator | **Done** *(23 Nov)*: forced tool call, allowed-exercise list, hard rejections (days, volume, session length, injuries), rule-based fallback |
| Adaptive plan | Partial (scoring only, no rewrite) |
| Readiness engine | Partial *(18 Nov, loop)*: rule-based verdict from the check-in, shown on Today with advice; no AI and the session is not auto-adjusted |
| Coach chat | **Done** (no per-user usage cap, no output validation); on every page with page context *(18 Nov, loop)* |
| Plan edits by chat (confirm before apply) | **Done** *(18 Nov, loop)*: the coach adds `coach-action` blocks; the app shows Apply today / Apply to plan / Dismiss, validates server-side, keeps an undo snapshot. Works with a pasted Claude reply too |
| Photo-to-macros | **Done** *(23 Nov, nutrition)*: one photo, read by the user's own AI. A nutrition label is copied (per-100 g scaled to the serving); food is named, estimated and matched to the database. Every value is editable before and after adding. No copy-paste fallback without a key |

### Platform and cross-cutting

- Google and phone OTP login: missing.
- Offline and PWA: missing (no manifest, no service worker).
- Data export: missing. Delete exists but I did not verify which collections it clears.
- Subscription and billing: missing (marketing pricing section only).
- Observability, per-user AI cost caps, content moderation: missing.
- Tests: 115 passing *(21 Nov: 26 new nutrition tests)*. Covered: auth, profile, onboarding, check-ins and readiness, live workout timer, coach actions and prompts, today/progress/exercises, PRs. Still no coverage for AI calls or plan upload edge cases.
- Dependencies: `npm audit` clean (tsup replaced with esbuild, 18 Nov).

---

## 3. Plan: what is left, in order

The spec's own gate model applies: finish the P0 loop, then P1, then P2.

### Phase 0: Decisions needed first (blockers)

These are open questions in the spec and they change the work below.
1. **Platform:** keep the Next.js web app and make it a PWA (cheapest, matches the existing code) or start React Native (Expo). Recommendation: PWA first. It reuses the server and client, and gives offline and install.
2. **Product direction:** the current "bring your own AI key" model conflicts with a consumer app where AI is built in and billed. Decide whether Pro includes AI or users keep supplying keys.
3. ~~**Food data source:**~~ Decided 21 Nov: a self-built Indian-first dataset (`server/src/seed/foods.json`, 174 foods) for the MVP; add a licensed source later.
4. ~~**Exercise media:**~~ Decided 18 Nov: text cues + stock photos from `client/public/media` by movement + a YouTube link per exercise; optional per-exercise `image` / `youtubeId` in `workouts.json` later.

### Phase 1: P0 MVP (core loop)

Build in this sequence, since each step feeds the next.

1. ~~**Profile model and onboarding**~~ **Done 18 Nov** (goal, body stats, experience, schedule, equipment, diet, injuries; `/onboarding`). Still to do: an onboarding-completion event for the 70% metric (`onboarding.completedAt` / `skippedAt` are stored and can feed it).
2. ~~**Plan generator (AI #1)**~~ **done 23 Nov** ([docs/training-upgrades.md](docs/training-upgrades.md)). Original note: structured output and rule checks. *A rule-based starter plan and the Plan reveal page already exist (18 Nov); the AI generator should build on the same profile fields and the `workouts.json` library, and can reuse the rule-based plan as a fallback.* Reuse the forced-tool-call pattern in `server/src/services/ai.ts` and the checks in `metrics.ts` and `constraints.ts`, but make them hard rejections at generation time (volume, frequency, injury exclusions). Then the **Plan reveal** page.
3. ~~**Exercise library and detail.**~~ **Done 18 Nov.** Seed exercise data (muscles, equipment, cues). Search and filter by muscle or equipment. Show the user's history per lift. Also supplies real **swap** alternatives.
4. **Training loop upgrades.** ~~Workout preview, rest timer, PR detection, workout summary~~ **done 18 Nov** (plus a start-to-finish workout timer and empty workouts). ~~Per-set effort rating, missed-session reshuffle~~ **done 23 Nov**.
5. **Progressive overload.** Turn the existing overload hints into a stored next-session load or reps with a one-line reason.
6. ~~**Nutrition module**~~ **Done 21 Nov** ([docs/nutrition.md](docs/nutrition.md)): targets (TDEE and macros, higher on training days), Indian food DB with search, recent, favourites, own foods and quick-add, a `food_logs` collection with its own endpoints (older session food moves over on first read), water and protein tracker, Nutrition and Add-food pages. ~~Adaptive calories from the weight trend~~ **done 23 Nov**, plus "what should I eat now" and a day meal planner. Still to do: copy a previous meal.
7. **Daily check-in and readiness engine (AI #3).** *Check-in page and rule-based readiness verdict done 18 Nov; still to do: auto-adjusting the session on low readiness, and an AI layer.* Check-in page (sleep, soreness, energy, stress in under 10 seconds). Verdict of push, normal or go light, which adjusts the session and never raises intensity on low readiness.
8. **Home / Today.** ~~Today's workout card, readiness, streak, coach tip~~ **done 18 Nov**; ~~calorie and protein rings~~ **done 21 Nov**. ~~Weekly goal ring~~ **done 23 Nov**.
9. ~~**Progress page.**~~ **Done 18 Nov**; bodyweight trend smoothing **done 23 Nov**.
10. **Remaining P0 AI:**
    - ~~Plan edits by chat~~ **done 18 Nov** (action cards with Apply/undo; no visual diff yet).
    - ~~Photo-to-macros~~ **done 23 Nov**: label or food photo, editable draft, database matches, edit calories after adding. Still to do: confidence flag on mixed dishes.
    - Adaptive plan: rewrite upcoming weeks with a weekly load-change cap and a "what changed and why" view.
11. ~~**Settings and units**~~ **Done 18 Nov**: kg/lb, cm/in, sectioned Profile with workout preferences.
12. **Platform P0 hardening.** Tests for chat, plans, sessions and AI routes. Per-user AI usage caps. Safety guardrails (no diagnosis, doctor referral for pain) with tests.

**Gate to Phase 2:** onboarding completion 70%, 3+ sessions per active user per week, D7 retention 40% (proposed targets, set from beta data).

### Phase 2: P1 (retention and differentiation)

- Pages: ~~meal plan~~ (done 23 Nov), recipe detail, lift detail, body measurements, progress photos, weekly report page, achievements, notifications, subscription, help and feedback, privacy and data.
- Features: short-on-time mode, warm-up and plate calculators, supersets and deloads, water tracking polish, diet filters (veg, vegan, Jain, eggetarian), ~~adaptive calories~~ (done 23 Nov), muscle volume, smart reminders, badges, share cards, offline logging, Apple Health and Google Health Connect sync, subscription billing (Razorpay or app store), data export and deletion.
- AI: voice logging, plateau detector, ~~meal plan generator, "what should I eat now"~~ (rule-based, done 23 Nov), weekly AI report, goal forecasting, smart reminders, injury-aware programming (hard exclusions).
- Compliance: DPDP Act consent, export and delete in-app.

### Phase 3: P2 (growth)

Grocery list, challenges and friend leaderboards, form check, menu scanner, fridge-to-recipe, pattern finder, progress photo analysis, coach personalities, Google and phone OTP login if growth needs it.

---

## 4. Immediate housekeeping (before Phase 1)

- Commit or stash the large uncommitted landing-page work (new `sections/`, `chrome/`, `blog/`, `disciplines`, two large mp4 files in `client/src/assets/landing`). Check whether the mp4 files belong in git or on a CDN.
- Add Google OAuth and phone OTP to the P0 backlog if they stay P0; otherwise ask whether email-only is acceptable for the MVP, since the spec lists them as P0.
- Fix the README claims about parser and constraint tests that have no test files.
- ~~Verify what `DELETE /auth/me` removes~~ Verified 18 Nov: profiles, plans, sessions, scores, chat, check-ins, coach actions, refresh and email tokens, and the user (covered by the auth test).

## 5. Verification (for each phase)

- `npm test` in `server` (node test runner with in-memory Mongo). Add tests per new route.
- Run the client and server locally and walk the daily loop: onboard, generate plan, check in, train, log food, view progress, ask the coach.
- Check each AI guardrail with adversarial inputs: unsafe load, injury conflict, veg and Jain diet rules, low-readiness intensity.
- Track the success metrics from the spec in an events table so the phase gates can be measured.

## 6. Caveats on this audit

Both explorers read the routes and key files and grepped the rest; neither read every file. `handoff.ts`, `planParser.ts` and the test files were not read line by line. Statuses marked Missing mean no code was found by search.
