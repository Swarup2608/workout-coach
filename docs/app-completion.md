# StarkFitIQ: App Completion Plan

Date: 18 Nov 2026. **Status: built** (see [Build status](#build-status) at the end). Demo: [workflow/workflow-demo.webm](workflow/workflow-demo.webm), screenshots in [workflow/screens/](workflow/screens/). Follows [onboarding.md](onboarding.md) and the gap table in [../PRODUCT_PLAN.md](../PRODUCT_PLAN.md).

## Scope

Finish the signed-in app around one daily loop: **check in → see today → train (timed) → review → ask the coach**.

| # | Piece | Today | Target |
|---|---|---|---|
| 0 | Coach chat dock on every page | Chat only at `/chat` | Chatbot pinned to the bottom of every signed-in page |
| 1 | Home / Today | Weekly score dashboard | Today card, readiness, streak, week strip, coach tip |
| 2 | Workout plan | Weekday list + edit | Week view with status, per-day preview, start button |
| 3 | Progress | Calorie chart + scores in `/history` | Bodyweight trend, strength charts, PRs, calendar |
| 4 | Live workout | Set logger at `/log`, no timer | Full-screen session with a start-to-finish timer and rest timer |
| 5 | Workout summary | Missing | Post-session screen: time, volume, PRs, vs last time, coach note |
| 6 | Exercise library | Missing (82 exercises sit in `seed/workouts.json`) | Searchable, filterable list |
| 7 | Exercise detail | Missing | How-to, muscles, your history, alternatives, "ask coach" |
| 8 | Daily check-in | Weight, mood, sleep | + soreness, energy, stress → readiness verdict; own page |
| 9 | Profile | One long settings page | Sectioned profile with stats header, cm/in units |

Out of scope: nutrition module, AI plan generator, missed-session reshuffle, native mobile.

---

## 0. Coach chat dock (every page)

**What the user sees.** A bar at the bottom of every signed-in page: "Ask your coach…". Clicking it opens a panel (desktop: 420×600 card bottom-right; phone: full-height bottom sheet). Same history as `/chat`, streaming replies, quick prompts that change by page. The panel **closes when you move to another page**, but it is one continuous conversation: reopening it anywhere shows the same thread. A reply that is still streaming keeps going in the background, and the bar shows a dot until you open it. Hidden on login/signup/verify/reset pages, on `/onboarding`, and on `/chat` itself (the full page already is the chat).

**How.**

- Move chat state out of [chat/page.tsx](../client/src/app/(app)/chat/page.tsx) into `client/src/components/coach/CoachProvider.tsx` (context: `messages`, `streaming`, `send(text, pageContext?)`, `clear()`), mounted once in [(app)/layout.tsx](../client/src/app/(app)/layout.tsx). The dock and `/chat` both read from it, so they never drift apart.
- New `CoachDock.tsx` (bar + panel) and a shared `ChatThread.tsx` (bubbles, markdown, typing state) reused by `/chat`.
- **Page context**: each page registers what it is showing with `useCoachContext({ page: "exercise", exercise: "Goblet squat" })`. `send` passes it along; server `POST /api/chat` accepts an optional `page` object (zod, size-capped) and appends one line to the system context, e.g. "User is looking at: Exercise detail — Goblet squat". This makes "is this safe for my knee?" work without the user restating anything.
- Per-page quick prompts: Today ("What should I focus on today?"), Live workout ("This felt too heavy, what now?"), Exercise detail ("Show me a knee-friendly alternative"), Progress ("Why has my bench stalled?"), Check-in ("I slept badly, should I still train?").
- No AI key: the bar and input still work, but instead of a reply the panel shows a **ready-made prompt** (your question + page context + plan/logs/scores from the existing `/handoff/context`) with **Copy** and **Open Claude** buttons. See "AI features without a key" below.

**Coach actions (advice + Apply).** The coach can propose changes, but nothing changes until you tap **Apply**.

- The system prompt lists the allowed actions and asks the model to add one fenced block per proposal:
  ```coach-action
  {"type":"swap_exercise","date":"2026-11-18","from":"Barbell back squat","to":"Goblet squat","reason":"knee"}
  ```
- The client strips these blocks from the visible text and renders each as an action card: a one-line summary, the reason, and **Apply today** / **Apply to plan** / **Dismiss** (plan-only actions like `move_workout` show just one Apply). Applied cards turn into "Applied ✓ · Undo".
- Allowed actions (v1), each mapped to an existing or planned endpoint:
  | Action | Effect |
  |---|---|
  | `swap_exercise` | Swap in today's in-progress session, or in a plan day (`PUT /plans/:id/days/:day`) |
  | `change_sets_reps` | Change sets / rep range for one exercise in a plan day |
  | `move_workout` | Swap two days of the plan (permanent; plan-only) |
  | `set_rest` | Change rest seconds for an exercise (profile `restOverrides`) |
  | `start_workout` | Start a live session for a plan day |
  | `add_note` | Add a note to today's session |
- Server: `POST /api/coach/actions/apply { action }` validates the action with zod (unknown types or exercise names not found are rejected), applies it, stores an undo snapshot, and returns the updated entity. `POST /api/coach/actions/:id/undo` reverts. Applied actions are recorded in chat history so the coach knows what changed.
- Without an AI key the pasted-prompt flow can't return actions; the user can paste Claude's reply back into a "Paste coach reply" box, and any `coach-action` blocks in it become the same Apply cards.
- `<main>` gets bottom padding equal to the bar height so content is never covered. During a live workout the bar shrinks to an icon button so it doesn't fight the timer controls.
- `Esc` closes, focus is trapped in the open panel, `aria-live="polite"` on the streaming bubble.

## 1. Home / Today

Replace the top of [dashboard/page.tsx](../client/src/app/(app)/dashboard/page.tsx); rename the nav item to **Today** (route stays `/dashboard`).

Order on the page:

1. Setup card or check-in card (existing one-card-at-a-time rule).
2. **Readiness chip** from today's check-in (section 8): "Ready to push" / "Train as planned" / "Go lighter today".
3. **Today card**: today's plan day title, exercise count, estimated minutes (sets × ~2.5 min), muscle chips, big **Start workout** button → `/workout/live`. If already done: "Done ✓ 52 min" linking to the summary. If a session is in progress: "Resume — 18:42 elapsed". Rest day: "Rest day" + a mobility suggestion.
4. **Week strip** (existing 7 tiles) plus a **streak** count (consecutive planned days completed, rest days don't break it).
5. **Coach tip**: one line, rule-based (from metrics sub-scores: lowest sub-score → tip); no AI call on page load.
6. Existing stats, score report and trend move below.

Server: `GET /api/today` returns `{ planDay, session | null, checkin | null, readiness, streak }` in one call so Today loads with one request.

## 2. Workout plan

Changes to [plan/page.tsx](../client/src/app/(app)/plan/page.tsx):

- Default view is **This week**: 7 rows with date, title, status (done / today / upcoming / missed / rest) and duration if done.
- Clicking a day opens a **day preview** (inline drawer): exercises with sets × reps, last time's best set per exercise, links to exercise detail, **Start this workout** (starts a live session for that plan day, which already maps to `planDay`).
- Existing edit / paste / activate / delete moves to a **Manage plans** tab, unchanged.

## 3. Progress

New page `/progress` (nav item **Progress**; `/history` stays and is linked from it as "All sessions").

- **Bodyweight trend**: line chart from check-ins (and session bodyweight as fallback), 30/90/365-day toggle, in the user's units.
- **Strength**: pick an exercise → best e1RM per session line chart, plus best set table. e1RM is already computed in `services/metrics.ts`; reuse it.
- **PRs**: list of recent personal records (heaviest weight, best e1RM, most reps at a weight) with dates.
- **Calendar**: month grid, trained days filled, colour by session RPE.
- **Totals**: sessions, total time trained (from the new timer data), total volume, this month vs last.

Charts: a small hand-written SVG line chart (`components/LineChart.tsx`, no new dependency). Colours from the existing theme tokens so dark mode works.

Server: `GET /api/progress?range=90d` returns `{ bodyweight: [{date, kg}], exercises: [{name, points: [{date, e1rm, best}]}], prs: [...], calendar: [{date, rpe, durationMin}], totals }`. PR detection lives in a new `services/records.ts` (pure, unit-tested) and is also used by the summary.

## 4. Live workout (start-to-finish timer)

New route `/workout/live`. `/log` stays for back-filling past days and food.

**Session timer — the core requirement.**

- **Start** writes `startedAt` (server time) to a new in-progress session. The clock on screen is `now − startedAt − pausedMs`, computed every second, so it survives reloads, tab switches and phone sleep. Nothing counts in a `setInterval` counter.
- **Pause / Resume** records `pausedAt`; resume adds the gap to `pausedMs`.
- **Finish** is always allowed: with zero sets done (e.g. a class or a timed session) or half the sets done. If any planned sets are not ticked, a warning lists them ("6 of 14 sets not done — finish anyway?") with **Finish anyway** and **Keep going**. Unfinished sets are saved as not done, so adherence scoring stays honest.
- On finish it writes `endedAt`, sets `durationMin = round((endedAt − startedAt − pausedMs) / 60000)` (user can correct it on the summary), marks the session complete, and routes to the summary.
- **Discard** deletes the in-progress session after a confirm (existing `ConfirmDialog`).
- Only one in-progress session per user. Today card and nav show "Resume" while one exists. If a session is left open over 4 hours, the next visit asks "Finish at last logged set?" and uses the last set's timestamp as `endedAt`.

**Empty workout.** A **Start empty workout** button on Today and Plan starts the timer with no exercises. You add exercises from the library as you go (search sheet), or add none and just time a class or run. Saved as `planDay: "custom"` with a title you can set at the start or on the summary.

**Rest timer.**

- Ticking a set as done starts a rest countdown (default 90 s for compounds, 60 s for isolation — from the exercise library `pattern`; user can ±15 s or skip; remembered per exercise in the profile).
- Countdown also derives from a stored `restEndsAt`, so it survives reloads.
- At zero: short beep (Web Audio, no asset; **sound on by default**, toggle in Profile), `navigator.vibrate(200)` where supported, and the next set row highlights.

**Screen layout.**

- Sticky header: workout title, big elapsed clock, pause, finish.
- One exercise at a time (swipe/arrows to move), set rows with weight/reps prefilled from last session (reuse the `/sessions/previous` logic from `/log`), tick to complete, add/remove set, notes.
- Swap: pick from library alternatives (same pattern, injury-safe) — writes the swap to the session only.
- Rest overlay at the bottom with the countdown.
- `navigator.wakeLock` keeps the screen on while the page is open (ignored where unsupported).
- Autosave: every set tick and every 15 s `PUT /api/sessions` with the in-progress session, so nothing is lost if the tab dies.

**Data model** (`WorkoutSession`, server and client `domain.ts`):

```ts
status?: "in_progress" | "completed";   // undefined = completed (old data)
startedAt?: string | null;               // ISO
endedAt?: string | null;
pausedMs?: number;                       // total paused time
pausedAt?: string | null;
restEndsAt?: string | null;
// on LoggedSet:
completedAt?: string | null;             // set tick time, for pacing stats
```

Server: `POST /api/sessions/start { planDay, date }` (returns existing in-progress session if any), `POST /api/sessions/:id/pause`, `/resume`, `/finish`. Metrics and scoring ignore `in_progress` sessions.

## 5. Workout summary

Route `/workout/summary/[id]`, shown after Finish and reachable from Today, Plan and History.

- Headline: total time (from the timer), sets done / planned, total volume, estimated kcal (existing MET calc, now using the real duration).
- **PRs this session** with a short celebration (respects `prefers-reduced-motion`).
- **vs last time** per exercise: ↑ / = / ↓ on best set and volume.
- Time breakdown: working vs resting (from set `completedAt` gaps).
- Session RPE picker (1–10) if not set, and notes.
- **Coach note**: a rule-based line from the PR / vs-last-time data always shows instantly. With an AI key, an AI note is **generated automatically after Finish** (`POST /api/sessions/:id/coach-note`, cached on the session) and a **Get coach note** button regenerates it any time. Without a key, the same button shows the copyable prompt for that workout. "Ask coach about this workout" opens the dock with the summary as page context.
- Edit duration (in case the user forgot to press Finish).

## 6. Exercise library

Route `/exercises` (nav item **Exercises**).

- Source: `server/src/seed/workouts.json` (82 exercises), extended with: `slug`, `muscles` (primary + secondary; seeded with `classifyMuscle` then hand-checked), `cues` (3–4 short form cues), `steps`, `mistakes`, `restSec`.
- Merged with user exercises: anything in their plans or sessions not in the library appears under "Your exercises" with muscle from `classifyMuscle`.
- Search by name; filters for muscle, pattern, equipment (defaults to the user's setup), and **"Safe for my injuries"** (on by default when the profile has injuries; uses the existing `stresses` field).
- Each card: photo, name, muscle chips, equipment, level, "in your plan" badge.

**Media (three layers, all used):**

1. **Exercise photo** — optional `image` field in `workouts.json` pointing to `client/public/exercises/<slug>.jpg`. Added over time; any exercise without one falls back to layer 2.
2. **Stock photo from `client/public/media`** — the 14 existing photos mapped by pattern (squat/hinge → `barbell-floor.jpg` / `woman-lift.jpg`, carry → `woman-carry.jpg`, kettlebell moves → `kettlebell.jpg`, mobility → `floor-mobility.jpg`, cardio → `road-run.jpg`, etc.), so every card has an image from day one.
3. **Watch on YouTube** — a button opening `https://www.youtube.com/results?search_query=<name>+form` in a new tab; an optional `youtubeId` field can pin a specific video later.

Images use `next/image` with fixed aspect ratio and `alt` = exercise name.

Server: `GET /api/exercises` (library + user's own, with `inPlan` and `lastDone`), `GET /api/exercises/:slug`.

## 7. Exercise detail

Route `/exercises/[slug]`.

- Hero photo (layer 1 or 2 above) and a **Watch on YouTube** button.
- How to do it (steps), form cues, common mistakes, muscles worked (chips; a body diagram is a later nice-to-have).
- **Your history**: best set, e1RM chart (same component as Progress), last 5 sessions.
- **Alternatives**: same pattern, filtered by equipment and injuries, each linking to its own detail.
- Injury warning if the exercise stresses a joint in the user's profile.
- "Ask coach about this exercise" sets page context and opens the dock.
- Linked from: plan day preview, live workout (info icon), library, progress.

## 8. Daily check-in

Extend [CheckinCard.tsx](../client/src/components/CheckinCard.tsx) and `routes/checkins.ts`.

- New fields, all optional, one tap each: `soreness` 1–5, `energy` 1–5, `stress` 1–5 (sleep and mood stay).
- **Readiness** (server, pure function in `services/readiness.ts`, unit-tested): weighted score 0–100 from sleep, energy, soreness (inverted), stress (inverted), mood. Bands: ≥75 "Ready to push", 50–74 "Train as planned", <50 "Go lighter today — drop one set per exercise or swap to mobility". Stored on the check-in.
- Dedicated page `/checkin` (same form, full size, edit today's entry, last 14 days as a small strip). The dashboard card stays as the quick path.
- The readiness verdict appears on Today and is included in coach context.

## 9. Profile

Restructure [profile/page.tsx](../client/src/app/(app)/profile/page.tsx) into sections with a left sub-nav on desktop (anchors on mobile):

1. **Header**: name, goal, member since, streak, total workouts, total hours trained.
2. **About you**: age, sex, height, weight (with **cm/in** toggle added next to kg/lb in `lib/units.ts`).
3. **Training**: goal, days/week, session length, experience, equipment, injuries — editing these offers "Regenerate starter plan".
4. **Workout preferences**: default rest times (compound / isolation), sound and vibration on/off for the rest timer, keep screen awake on/off.
5. **AI coach**: existing `AiProviderSettings`.
6. **Account & security**: existing `AccountSettings`.

Profile model additions: `heightUnit: "cm" | "in"`, `restDefaults: { compound: number; isolation: number }`, `restOverrides: Record<string, number>`, `timerSound: boolean`, `timerVibrate: boolean`, `keepAwake: boolean`.

---

## AI features without a key (applies everywhere)

Every AI feature has two paths, chosen by `status.aiConnected`:

| Feature | With key | Without key |
|---|---|---|
| Coach chat dock / `/chat` | Streams a reply, may include action cards | Copyable prompt (question + page context + data) |
| Summary coach note | Auto on Finish + **Get coach note** | Rule-based note + **Get coach note** → prompt |
| Weekly score | Existing AI verdict | Existing `ProjectBridge` prompt/import (unchanged) |
| Readiness advice, Progress "why stalled?" | Answer in the dock | Prompt in the dock |

One shared component, `AiOrPrompt`, renders either the AI result or a prompt box with **Copy**, **Open Claude** (uses the profile's Claude project URL) and **Paste reply back**. The server builds every prompt (`GET /api/prompts/:kind?…`) so the wording matches what the AI path sends.

## Navigation after the change

`Today · Plan · Progress · Exercises · Coach · Profile` in the top bar; `Log` and `History` move into Progress/Plan as secondary links. On phones the top links collapse into a bottom tab bar (5 items: Today, Plan, Progress, Exercises, Profile) with the coach dock sitting just above it. When a session is in progress a "● 18:42 Resume" pill shows in the header on every page.

## API changes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/chat` | + optional `page` context |
| GET | `/api/today` | Today screen in one call |
| GET | `/api/progress?range=` | Charts, PRs, calendar, totals |
| POST | `/api/sessions/start` | Create or return the in-progress session |
| POST | `/api/sessions/:id/pause` · `/resume` · `/finish` | Timer state, server timestamps |
| POST | `/api/sessions/:id/coach-note` | Optional AI note for the summary |
| GET | `/api/exercises` · `/api/exercises/:slug` | Library and detail |
| GET | `/api/checkins?from&to` | Check-in history (trend + strip) |
| PUT | `/api/checkins/:date` | + soreness, energy, stress; returns readiness |

All new routes sit behind `requireVerifiedUser` and use the existing `wrap` + zod pattern in `routes/api.ts`.

## Build order

Each step ends with `npm run typecheck`, `npm test` and `npm run build` passing.

1. **Coach dock** — provider, dock, shared thread, page context on `/api/chat`, `AiOrPrompt` no-key fallback. Visible on every page, unblocks "ask coach" links everywhere.
1b. **Coach actions** — `coach-action` parsing, action cards, apply/undo routes with tests (validation, undo restores state). Swap/rest actions that touch live sessions are wired up after step 3.
2. **Session timer data model + start/pause/resume/finish routes** with tests (timer maths, one-in-progress rule, metrics ignoring in-progress).
3. **Live workout page** — timer, set logging, rest timer, autosave, wake lock.
4. **Workout summary** + `services/records.ts` (PR detection, tested).
5. **Exercise library data** (extend `workouts.json`) + library and detail pages.
6. **Check-in extension + readiness** (tested), `/checkin` page.
7. **Today** (`/api/today`, today card, streak, tip, resume state).
8. **Plan week view + day preview**.
9. **Progress page** (SVG charts, `/api/progress`).
10. **Profile restructure** + cm/in + workout preferences.
11. **Navigation** (new links, mobile tab bar, resume pill), then update `PRODUCT_PLAN.md` tables and screenshots in this doc.

## Testing

- Server unit tests (existing `test/harness.ts`): timer duration with pauses, auto-finish of stale sessions, PR detection, readiness bands, exercise filtering by injury/equipment, chat page-context validation (size cap, unknown keys rejected).
- Client: typecheck + build; manual run through the loop (check in → start → log sets with rest timer → reload mid-workout and confirm the clock is right → finish → summary → ask coach from the dock) in light and dark, desktop and 390 px wide.
- Playwright (already a dev dependency): one scripted demo of the full loop, saved next to this doc like the onboarding demo.

## Decisions

1. Finish is allowed with no sets or a half-finished workout, always behind a warning that lists the sets not done.
2. Rest-timer sound is on by default, with a toggle in Profile.
3. The chat panel closes when you change page; the conversation is the same everywhere.
4. The coach gives advice **and** proposes actions; changes only happen on **Apply**, and each can be undone.
5. **Start empty workout** is available alongside planned days.
6. Summary coach note: automatic on Finish and on demand. Every AI feature falls back to a copyable prompt when no key is set.
7. Exercise media: per-exercise photos where available, stock photos from `client/public/media` as fallback, and a YouTube link on every exercise.
8. Phones get a bottom tab bar (Today, Plan, Progress, Exercises, Profile); the coach bar sits just above it.
9. Rest-over alerts use a browser notification when the app is in the background (permission asked at the first workout start), with the beep as fallback.
10. Coach action cards offer **Apply today** and **Apply to plan**; the plan only changes on the second.
11. Build everything in the order below.

## Build status

Everything above is built. Verified with `npm run typecheck` (server and client), `npm test` (88 passing, including new suites for the live workout timer, coach actions, today/progress/exercises, readiness and PRs) and a production `next build`. The Playwright recorder in [workflow/record-demo.mjs](workflow/record-demo.mjs) walks the whole loop against a throwaway stack and produced the video and screenshots.

Differences from the plan above:

- **Charts** are a small SVG component instead of `recharts`, so no new dependency.
- **Coach actions** use fenced `coach-action` JSON blocks in the reply (not provider tool calls), so they work the same with any provider and with a reply pasted back from Claude. `start_workout` is handled in the browser; everything else goes through `POST /api/coach/actions/apply`. Applying "today" needs a workout for today (live or logged); otherwise the card says to start one or apply to the plan.
- **Exercise guidance** is written per movement pattern, with exercise-specific text for the ones whose pattern in `workouts.json` is only a plan-building slot (glute bridge, bird dog, side-lying leg raise, isometrics and similar).
- **Training section in Profile** shows the onboarding answers read-only, and changes go through "Redo setup" (which regenerates the starter plan), rather than inline editing.
- **One workout per day**: sessions stay one per date, so starting a workout on a day that already has logged sets returns a 409 with a link to the Log page.
- **Background alerts**: browsers can pause timers on a locked phone, so the rest-over notification fires when the page gets time to run. The countdown itself is always correct because it is computed from `restEndsAt`.

Still open (tracked in [PRODUCT_PLAN.md](../PRODUCT_PLAN.md)): per-set effort rating, missed-session reshuffle, auto-adjusting a session on low readiness, calorie/protein rings (needs nutrition), weekly goal ring, bodyweight smoothing.
