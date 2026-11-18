# StarkFitIQ: Spec vs Reality, and the Plan to Close the Gap

Spec date: 17 Nov 2026. Audit date: 18 Nov 2026. Branch: master (landing-page work uncommitted).

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
| Tests | Auth (348 lines), scoring, day-import | server `*.test.ts` |

## 2. Gap analysis against the spec

### Pages (31 in spec, 18 P0)

| # | Page | Pri | Status |
|---|---|---|---|
| 1 | Welcome | P0 | Partial (marketing landing only, no in-app welcome) |
| 2 | Sign up / log in | P0 | Partial (email only; no Google, no phone OTP) |
| 3 | Onboarding | P0 | **Missing** |
| 4 | Plan reveal | P0 | **Missing** |
| 5 | Home / Today | P0 | Partial (weekly score dashboard; no today card, readiness, rings, streak, coach tip) |
| 6 | Workout plan | P0 | Partial (weekday list and edit; no calendar, no drag reschedule) |
| 7 | Nutrition | P0 | **Missing** (food table inside the log page only) |
| 8 | Progress | P0 | Partial (calories bar chart, scores; no strength charts, PRs, bodyweight trend) |
| 9 | Coach | P0 | **Done** |
| 10 | Workout preview | P0 | **Missing** |
| 11 | Live workout | P0 | Partial (set logger and notes; no rest timer, no real swap) |
| 12 | Workout summary | P0 | **Missing** |
| 13 | Exercise library | P0 | **Missing** |
| 14 | Exercise detail | P0 | **Missing** |
| 15 | Add food | P0 | **Missing** (manual rows only) |
| 23 | Daily check-in | P0 | **Missing** |
| 27 | Profile | P0 | Partial (name, password, sessions, delete; thin profile model) |
| 28 | Settings | P0 | Partial (theme and AI key only; no kg/lb) |
| 16-22, 24-26, 29-31 | P1/P2 pages | P1/P2 | All **missing**. Weekly report is partial (card on dashboard), privacy is partial (delete only) |

Totals for the 18 P0 pages: 1 done, 9 partial, 8 missing.

### P0 features

| Feature | Status | Note |
|---|---|---|
| Plan generation from onboarding | Missing | Plans are pasted Markdown only |
| One-tap set logging | Done | |
| Effort rating (per set) | Partial | Session-level RPE only |
| Rest timer | Missing | |
| Progressive overload (auto next load + reason) | Partial | e1RM and hints are scored; nothing auto-adjusts |
| Exercise swap | Partial | Constraint-based only |
| Missed-session reshuffle | Missing | |
| PR detection | Partial | e1RM computed, no PR flag or celebration |
| Calorie and macro targets | Missing | Only burn estimates exist |
| Food logging (search, recent, favourites, quick-add) | Partial | Free-text rows via day-import |
| Indian food database | Missing | No food DB at all |
| Protein tracker | Missing | |
| Strength charts, bodyweight trend, workout history calendar | Partial | History list only |
| Daily check-in | Missing | |
| Streaks and weekly goal ring | Missing | |
| Accounts and sync | Done | |
| Units (kg/lb) | Missing | kg hardcoded |
| Dark theme | Done | |

### P0 AI features (6)

| AI feature | Status |
|---|---|
| Plan generator | **Missing** |
| Adaptive plan | Partial (scoring only, no rewrite) |
| Readiness engine | **Missing** |
| Coach chat | **Done** (no per-user usage cap, no output validation) |
| Plan edits by chat (confirm before apply) | **Missing** (chat has no tool use) |
| Photo-to-macros | **Missing** (no image input) |

### Platform and cross-cutting

- Google and phone OTP login: missing.
- Offline and PWA: missing (no manifest, no service worker).
- Data export: missing. Delete exists but I did not verify which collections it clears.
- Subscription and billing: missing (marketing pricing section only).
- Observability, per-user AI cost caps, content moderation: missing.
- Tests: no coverage for chat, plans, sessions or AI routes.

---

## 3. Plan: what is left, in order

The spec's own gate model applies: finish the P0 loop, then P1, then P2.

### Phase 0: Decisions needed first (blockers)

These are open questions in the spec and they change the work below.
1. **Platform:** keep the Next.js web app and make it a PWA (cheapest, matches the existing code) or start React Native (Expo). Recommendation: PWA first. It reuses the server and client, and gives offline and install.
2. **Product direction:** the current "bring your own AI key" model conflicts with a consumer app where AI is built in and billed. Decide whether Pro includes AI or users keep supplying keys.
3. **Food data source:** licensed API vs a self-built Indian dataset. Recommendation: seed a small self-built Indian dataset (dal, roti, paneer, idli, poha) for the MVP, add a licensed source later.
4. **Exercise media:** license vs shoot. MVP can ship text form cues only.

### Phase 1: P0 MVP (core loop)

Build in this sequence, since each step feeds the next.

1. **Profile model and onboarding** (goal, body stats, experience, schedule, equipment, diet, injuries). Extend `Profile` in `server/src/domain.ts` and `client lib/domain.ts`. Add `/onboarding` flow and an onboarding-completion event for the 70% metric.
2. **Plan generator (AI #1)** with structured output and rule checks. Reuse the forced-tool-call pattern in `server/src/services/ai.ts` and the checks in `metrics.ts` and `constraints.ts`, but make them hard rejections at generation time (volume, frequency, injury exclusions). Then the **Plan reveal** page.
3. **Exercise library and detail.** Seed exercise data (muscles, equipment, cues). Search and filter by muscle or equipment. Show the user's history per lift. Also supplies real **swap** alternatives.
4. **Training loop upgrades.** Workout preview page, rest timer (background-safe), per-set effort rating, PR detection with flag, workout summary page with volume, PRs and duration, missed-session reshuffle.
5. **Progressive overload.** Turn the existing overload hints into a stored next-session load or reps with a one-line reason.
6. **Nutrition module** (largest missing block):
   - Targets from body stats and goal (TDEE and macros, higher on training days).
   - Food DB with Indian dishes, plus search, recent, favourites and quick-add.
   - A real food-log endpoint, so entries stop living only inside the session doc.
   - Water and protein tracker. Nutrition page and Add-food page.
7. **Daily check-in and readiness engine (AI #3).** Check-in page (sleep, soreness, energy, stress in under 10 seconds). Verdict of push, normal or go light, which adjusts the session and never raises intensity on low readiness.
8. **Home / Today.** Today's workout card, readiness, calorie and protein rings, streak, weekly goal ring, coach tip.
9. **Progress page.** Estimated 1RM charts per lift, smoothed bodyweight trend, workout history calendar, PR list.
10. **Remaining P0 AI:**
    - Plan edits by chat: add tool use to chat, show a diff, apply only after the user confirms.
    - Photo-to-macros: add image input, editable estimate, confidence flag on mixed dishes.
    - Adaptive plan: rewrite upcoming weeks with a weekly load-change cap and a "what changed and why" view.
11. **Settings and units** (kg/lb, cm/in) and a richer Profile page.
12. **Platform P0 hardening.** Tests for chat, plans, sessions and AI routes. Per-user AI usage caps. Safety guardrails (no diagnosis, doctor referral for pain) with tests.

**Gate to Phase 2:** onboarding completion 70%, 3+ sessions per active user per week, D7 retention 40% (proposed targets, set from beta data).

### Phase 2: P1 (retention and differentiation)

- Pages: meal plan, recipe detail, lift detail, body measurements, progress photos, weekly report page, achievements, notifications, subscription, help and feedback, privacy and data.
- Features: short-on-time mode, warm-up and plate calculators, supersets and deloads, water tracking polish, barcode scan, diet filters (veg, vegan, Jain, eggetarian), adaptive calories, muscle volume, smart reminders, badges, share cards, offline logging, Apple Health and Google Health Connect sync, subscription billing (Razorpay or app store), data export and deletion.
- AI: voice logging, plateau detector, meal plan generator, "what should I eat now", weekly AI report, goal forecasting, smart reminders, injury-aware programming (hard exclusions).
- Compliance: DPDP Act consent, export and delete in-app.

### Phase 3: P2 (growth)

Grocery list, challenges and friend leaderboards, form check, menu scanner, fridge-to-recipe, pattern finder, progress photo analysis, coach personalities, Google and phone OTP login if growth needs it.

---

## 4. Immediate housekeeping (before Phase 1)

- Commit or stash the large uncommitted landing-page work (new `sections/`, `chrome/`, `blog/`, `disciplines`, two large mp4 files in `client/src/assets/landing`). Check whether the mp4 files belong in git or on a CDN.
- Add Google OAuth and phone OTP to the P0 backlog if they stay P0; otherwise ask whether email-only is acceptable for the MVP, since the spec lists them as P0.
- Fix the README claims about parser and constraint tests that have no test files.
- Verify what `DELETE /auth/me` removes (profiles, plans, sessions, scores, chat) for DPDP compliance.

## 5. Verification (for each phase)

- `npm test` in `server` (node test runner with in-memory Mongo). Add tests per new route.
- Run the client and server locally and walk the daily loop: onboard, generate plan, check in, train, log food, view progress, ask the coach.
- Check each AI guardrail with adversarial inputs: unsafe load, injury conflict, veg and Jain diet rules, low-readiness intensity.
- Track the success metrics from the spec in an events table so the phase gates can be measured.

## 6. Caveats on this audit

Both explorers read the routes and key files and grepped the rest; neither read every file. `handoff.ts`, `planParser.ts` and the test files were not read line by line. Statuses marked Missing mean no code was found by search.
