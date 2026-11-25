# Onboarding process

Design (part 1) and implementation plan (part 2) for onboarding, the rule-based starter plan, kg/lb units and the daily check-in.

---

# Part 1 — Design

Date: 18 Nov 2026. Status: approved 18 Nov 2026.

## Intent
New users land on the dashboard with placeholder profile data and a generic plan. Onboarding asks them about themselves, then builds a starter plan from rules (no AI) that fits their goal, schedule, equipment and injuries. A daily check-in card on the dashboard keeps them coming back. It is a web app, so there is no separate Welcome page.

## Goals
- Signup also asks for **age**. Onboarding then opens with two steps already ticked (Account, Basics), so the user feels partway done from the start.
- A short `/onboarding` flow that saves a richer profile and resumes where the user left off.
- At the end, a **rule-based starter plan** chosen from a JSON workout library, saved as the active plan.
- A **kg / lb choice**, used across the app.
- A **daily check-in card** on the dashboard (weight, mood, sleep) that shows on every login until that day's check-in is saved.

## Non-goals
- No AI anywhere in onboarding or plan building.
- No separate `/welcome` route.
- Diet answers are stored but drive nothing until the nutrition module exists.

## Approaches considered
1. AI-generated plan. Rejected: the user wants no AI here.
2. Profile only, no plan. Superseded: the user wants a baseline plan picked by rules.
3. **Chosen: rule-based plan from a JSON library.** Goal × days × equipment × experience picks a split and sets/reps; injuries filter or swap exercises.

## Signup change
`/signup` gains an **Age** field (required, whole number, 16–90). `POST /auth/register` accepts `age`, and `seedNewUser` stores it on the profile.

## Onboarding flow
```
signup (name, email, age, password) → verify email → /dashboard
  └─ Setup card (until onboarding is completed or skipped):
       "Welcome, <name>. You're 2 of 8 steps in. Finish setup to get your plan."
       [Continue setup]   [Skip for now]
             ▼
/onboarding  — progress bar starts at 2/8; "Skip setup" link on every step
  ✓ 1. Account        (done at signup)
  ✓ 2. Basics         name, email, age (done at signup)
    3. Goal           fat loss · muscle gain / weight gain · maintain weight · get stronger · general fitness
    4. Body           sex (optional), height, current weight, target weight, units kg / lb
    5. Training       experience (beginner / intermediate / advanced), days per week (2–6), minutes per session (30/45/60/90)
    6. Equipment &    full gym · home with dumbbells · bodyweight only;
       limits         injuries (chips: knee, lower back, shoulder, wrist, elbow; optional)
    7. Diet           veg · eggetarian · non-veg · vegan (optional)
    8. AI coach       optional: add an API key with the existing AiProviderSettings, or "Skip for now".
                      Does not affect the plan; it only unlocks the coach chat and AI scoring.
             ▼
Plan reveal: "Here's your week" — the generated days, each with its exercises, sets × reps
  [Start using StarkFitIQ] → /dashboard   (the plan is now active)
```
Ticked steps can be opened and edited but are never shown as pending. Back is always available; optional steps show Skip. Each step saves when the user presses Continue.

## Starter plan rules
Data lives in `server/src/seed/workouts.json`, with two parts:

**Exercise library** (about 60–80 entries). Each one has:
- `name`, `pattern` (squat, hinge, lunge, horizontal_push, vertical_push, horizontal_pull, vertical_pull, biceps, triceps, shoulders_iso, calves, core, cardio)
- `equipment`: gym / dumbbells / bodyweight (the set of setups it works with)
- `stresses`: joints it loads (knee, lower_back, shoulder, wrist, elbow)
- `level`: beginner / intermediate / advanced

**Templates by days per week.** Each day is a list of pattern slots:
- 2 days: Full body A / B
- 3 days: Full body A / B / C
- 4 days: Upper / Lower × 2
- 5 days: Push / Pull / Legs / Upper / Lower
- 6 days: Push / Pull / Legs × 2

The other weekdays are rest or active-recovery days.

**Goal sets the prescription:**

| Goal | Sets × reps | Rest | Extra |
|---|---|---|---|
| Fat loss | 3 × 10–15 | 60 s | 10–20 min cardio finisher |
| Muscle gain / weight gain | 3–4 × 8–12 | 90 s | — |
| Maintain weight | 3 × 8–12 | 75 s | optional short cardio |
| Get stronger | 4–5 × 3–6 on the compound lifts, 3 × 8–10 on accessories | 2–3 min | — |
| General fitness | 3 × 10–12 | 60–75 s | 10 min cardio |

**Other inputs:**
- **Experience:** beginners get one fewer set and beginner-level exercises; advanced users can get advanced ones.
- **Minutes per session:** caps how many slots a day keeps (roughly 30 min → 4 exercises, 45 → 5, 60 → 6, 90 → 7–8).
- **Picking an exercise for a slot:** filter by equipment, then by level, then drop anything that stresses an injured joint. Take the first match in library order, so the same answers always give the same plan. If nothing is left, use the safest fallback for that pattern; if there's none, drop the slot.

**Output:** the generator writes the plan as Markdown in the existing format and runs it through `parsePlan`, so it is stored, edited and logged exactly like a pasted plan. Injuries also become entries in `profile.constraints`, so the existing swap hints keep working.

**Before onboarding is done, or if it's skipped:** new accounts get the current baseline plan, so the dashboard is never empty. A user who skips keeps the baseline plan as their active plan. Finishing onboarding (now or later) replaces it as the active plan; the old one stays in plan history.

**Skipping:** "Skip for now" (on the card) or "Skip setup" (inside the flow) sets `onboarding.skippedAt`. The setup card hides and the check-in card takes the slot. `/profile` keeps a "Finish setup" link that resumes at the saved step.

## Daily check-in card
- Shows at the top of `/dashboard` on every visit until today's check-in exists for the user. Once saved, it's gone until tomorrow (by the user's local date).
- Fields: **weight** (in the user's unit), **mood** (5-point scale), **sleep** (hours, or a poor/ok/good choice). Any single field is enough to save, and one saved check-in counts for the whole day. The user can edit it later that day, but the card won't come back.
- After saving, the card collapses to "Checked in today ✓" or disappears.
- Storage: a new `checkins` collection `{ userId, date: "YYYY-MM-DD", weightKg?, mood?, sleep?, createdAt }`, one per user per date (upsert).
- API: `GET /api/checkins/today?date=YYYY-MM-DD` and `PUT /api/checkins/:date`.
- Only one card shows at a time: while onboarding is unfinished and not skipped, the setup card takes the slot; after that, the check-in card does.

## Units (kg / lb)
- `profile.units: "kg" | "lb"`, chosen in onboarding step 4 and changeable in `/profile` settings.
- Values are always stored in kg; the client converts for display and input (1 kg = 2.20462 lb, shown to 1 decimal place).
- Applies to the onboarding weights, check-in weight, set logging, history and the dashboard.

## Data changes
Optional new `Profile` fields, so existing documents stay valid: `age`, `sex`, `heightCm`, `units`, `daysPerWeek`, `sessionMinutes`, `equipmentSetup` (gym / home_dumbbells / bodyweight; named to avoid the existing `Equipment` type), `injuries[]`, `diet`, and `onboarding: { step, completedAt, skippedAt }`. Reused: `goal`, `experience`, `startBodyweightKg`, `targetBodyweightKg`, `constraints`.

Existing accounts without an `onboarding` field don't see the setup card. `/profile` gets a "Redo setup" link.

## API summary
- `POST /auth/register`: adds `age`.
- `PATCH /api/profile/onboarding`: `{ step, answers }` merges validated fields. `{ complete: true }` generates the plan, activates it, sets `completedAt` and returns the plan for the reveal screen. `{ skip: true }` sets `skippedAt` and leaves the plan alone.
- `GET /api/checkins/today` and `PUT /api/checkins/:date`.
- All of these use the existing auth, CSRF and rate-limit middleware.

## Constraints
Match the existing app look (`card`, `btn`, `input`, `label`), light and dark. Works at phone width. Keyboard accessible, with a label for every input.

## Builder's calls
The exact exercise list and order in the JSON, the chip lists, the mood icons, validation copy and component structure. Keep the onboarding steps in one config array.

## Tests
Server:
- Plan generator: every goal × days × equipment combination produces a valid plan; injuries exclude stressed exercises; the same input gives the same plan.
- Onboarding PATCH: validation, merging, completion.
- Check-in upsert, one per day.
- Register with age.

Client: manual walkthrough (resume mid-flow, skip optional steps, switch kg/lb, check-in card hides after saving and comes back the next day).

---

# Part 2 — Implementation plan


**Goal:** New users finish a short onboarding (2 of 8 steps pre-ticked), get a rule-based starter plan, pick kg or lb, and see a daily check-in card on the dashboard.

**Architecture:** Server gains a pure `starterPlan` generator driven by `seed/workouts.json` (writes Markdown, runs the existing `parsePlan`), an onboarding PATCH endpoint, and a `checkins` collection. Client gains `/onboarding`, two dashboard cards (setup, check-in), a units helper, and an age field on signup.

**Tech Stack:** Express 5 + MongoDB + zod 4 (server, `node:test` via `tsx --test`, mongodb-memory-server), Next.js App Router + Tailwind (client, no test runner: `npm run typecheck` + manual).


## Global Constraints

- No AI calls anywhere in onboarding or plan generation.
- No `/welcome` route.
- All new `Profile` fields are optional, so existing Mongo documents stay valid.
- Weights are stored in kg; `units` is display only. 1 kg = 2.20462 lb, shown to 1 decimal place.
- Age: whole number, 16–90.
- Onboarding has 8 steps; steps 1 (Account) and 2 (Basics) are always ticked; the progress bar starts at 2/8.
- Same onboarding answers always give the same plan (no randomness).
- New accounts keep the baseline plan until onboarding is completed; skipping leaves the plan alone.
- Only one dashboard card at a time: setup card while `onboarding` exists with `completedAt` and `skippedAt` both null; otherwise the check-in card (hidden once today's check-in exists).
- One check-in per user per local date; any one of weight / mood / sleep is enough.
- Match the existing UI classes (`card`, `btn`, `btn-primary`, `btn-ghost`, `input`, `label`), light and dark, phone width, a label on every input.
- New routes use the existing `/api` auth, CSRF and rate-limit middleware (mount on the existing `api` router).

## Review Focus

1. **Profile page save wiping new fields.** `PUT /profile` parses with `ProfileSchema` (zod strips unknown keys) and `replaceOne`s the doc. A user who edits their name on `/profile` after onboarding must keep `units`, `onboarding`, `injuries`, etc. → Task 1 adds every new field to `ProfileSchema` and a test that round-trips them through `PUT /profile`.
2. **Existing accounts.** A profile with no `onboarding` field must show no setup card and must still save → Task 1 test (old-shape profile PUT), Task 8 card logic.
3. **Completing onboarding twice** ("Redo setup" from `/profile`) must not stack duplicate injury constraints and must create a new active plan while keeping the old one in history → Task 3 test.
4. **Check-in date around midnight / time zones.** The server never computes "today"; the client sends its local `YYYY-MM-DD`. Malformed dates are 400 → Task 4 test.
5. **Lb round-trip drift.** Entering 180 lb, saving, and reloading must show 180.0 lb, not 179.9 → Task 5 helper rounding plus Task 5 test list item for manual check.

## File Map

| File | Responsibility |
|---|---|
| `server/src/domain.ts` (modify) | New `Profile` fields and types |
| `server/src/test/harness.ts` (create) | Shared in-memory Mongo + app + `Browser`, extracted from `auth.test.ts` |
| `server/src/routes/auth.ts`, `server/src/seed/index.ts` (modify) | `age` on register; seed `onboarding` |
| `server/src/seed/workouts.json` (create) | Exercise library, day templates, injury constraints |
| `server/src/services/starterPlan.ts` (create) | Pure generator: answers → Markdown → `PlanDay[]` |
| `server/src/routes/onboarding.ts` (create) | `PATCH /api/profile/onboarding` |
| `server/src/routes/checkins.ts`, `server/src/db.ts`, `server/src/repo.ts` (modify/create) | Check-in collection and routes |
| `client/src/lib/domain.ts`, `client/src/lib/api.ts` (modify) | Mirror types; API calls |
| `client/src/lib/units.ts` (create) | kg/lb conversion and `useUnits()` |
| `client/src/app/(app)/onboarding/page.tsx` + `client/src/components/onboarding/*` (create) | Onboarding flow and plan reveal |
| `client/src/components/SetupCard.tsx`, `client/src/components/CheckinCard.tsx` (create) | Dashboard cards |

---

### Task 1: Profile model, shared test harness, age on register

**Files:**
- Modify: `server/src/domain.ts:258-267`, `server/src/routes/api.ts:48-56`, `server/src/routes/auth.ts:79-89`, `server/src/seed/index.ts`, `server/src/repo.ts:7-14`
- Create: `server/src/test/harness.ts`
- Modify: `server/src/routes/auth.test.ts` (use the harness; no behaviour change)
- Test: `server/src/routes/profile.test.ts`

**Interfaces:**
- Produces (in `domain.ts`):
  ```ts
  export type GoalKey = "fat_loss" | "muscle_gain" | "maintain" | "strength" | "general";
  export type EquipmentSetup = "gym" | "home_dumbbells" | "bodyweight";
  export type Injury = "knee" | "lower_back" | "shoulder" | "wrist" | "elbow";
  export type Diet = "veg" | "eggetarian" | "non_veg" | "vegan";
  export type Units = "kg" | "lb";
  export type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced";
  export interface OnboardingState { step: number; completedAt: string | null; skippedAt: string | null }
  // Profile gains (all optional):
  // age, sex ("male"|"female"|"other"|null), heightCm, units, goalKey, daysPerWeek, sessionMinutes,
  // equipmentSetup, injuries: Injury[], diet, onboarding: OnboardingState
  export const GOAL_LABELS: Record<GoalKey, string>; // "Fat loss", "Muscle gain / weight gain", "Maintain weight", "Get stronger", "General fitness"
  ```
  `goal` keeps holding the human label; `goalKey` is what the generator reads (my call: the generator needs a stable code).
- Produces (`server/src/test/harness.ts`): `export function useTestApp(dbName: string): { browser(): Browser; sent: Mail[]; col(): typeof import("../db.js").col }` — registers `before`/`after` hooks exactly as `auth.test.ts` does today; `export class Browser` (moved as-is); `export async function signUpVerified(b: Browser, user: { name; email; password; age? }): Promise<void>` (register + verify via the emailed token).
- Produces: `seedNewUser(userId: string, name: string, age: number | null)` sets `age` and `onboarding: { step: 2, completedAt: null, skippedAt: null }`.

- [ ] **Step 1: Extract the harness.** Move env setup, mongo lifecycle, `Browser`, `tokenFrom` from `auth.test.ts` into `harness.ts`; `auth.test.ts` calls `useTestApp("auth_test")`. Run `npm test -w server` → all existing auth tests PASS.
- [ ] **Step 2: Write failing tests** in `profile.test.ts` (`useTestApp("profile_test")`):
  - `register stores age and starts onboarding at step 2`: register `{..., age: 30}`, verify, `GET /profile` → `age === 30`, `onboarding` deep-equals `{ step: 2, completedAt: null, skippedAt: null }`.
  - `register rejects out-of-range age`: `age: 15` → 400, `age: 91` → 400, `age: 30.5` → 400.
  - `register requires age`: no `age` → 400.
  - `PUT /profile keeps the new fields`: PUT a profile with `units: "lb", goalKey: "strength", daysPerWeek: 4, injuries: ["knee"], onboarding: {step: 5, completedAt: null, skippedAt: null}` → GET returns all of them unchanged.
  - `PUT /profile accepts an old-shape profile`: PUT `{ name, goal, experience, startBodyweightKg: null, targetBodyweightKg: null, constraints: [] }` → 200.
- [ ] **Step 3: Run** `npm test -w server` → the new tests FAIL.
- [ ] **Step 4: Implement.** Add types to `domain.ts`. Extend `ProfileSchema` with each new field as `.optional()` (enums via `z.enum`, `age: z.number().int().min(16).max(90).nullable()`, `heightCm` 100–250, `daysPerWeek` int 2–6, `sessionMinutes` `z.union([30,45,60,90] literals)`, `injuries: z.array(z.enum([...])).max(5)`). Register schema: `age: z.number().int().min(16).max(90)` (required). Add `age: 30` to every register call in the existing tests (`alice` and any other fixtures). Pass `age` to `seedNewUser`.
- [ ] **Step 5: Run** `npm test -w server` and `npm run typecheck -w server` → PASS.

### Task 2: Workout library and starter plan generator

**Files:**
- Create: `server/src/seed/workouts.json`, `server/src/services/starterPlan.ts`
- Test: `server/src/services/starterPlan.test.ts`

**Interfaces:**
- Consumes: `GoalKey`, `EquipmentSetup`, `Injury`, `ExperienceLevel`, `Constraint` from `domain.ts`; `parsePlan` from `planParser.ts`.
- Produces:
  ```ts
  export interface StarterInput { goalKey: GoalKey; experience: ExperienceLevel; daysPerWeek: number; sessionMinutes: 30|45|60|90; equipmentSetup: EquipmentSetup; injuries: Injury[] }
  export function buildStarterMarkdown(input: StarterInput): string;
  export function buildStarterPlan(input: StarterInput): { name: string; goal: string; rawText: string; days: PlanDay[] };
  export function injuryConstraints(injuries: Injury[]): Constraint[]; // ids "injury-<key>"
  ```

**`workouts.json` shape:**
```json
{
  "exercises": [{ "name": "Goblet squat", "pattern": "squat", "equipment": ["gym","home_dumbbells"], "stresses": ["knee"], "level": "beginner", "unit": "reps" }],
  "templates": { "full_a": ["squat","horizontal_push","horizontal_pull","hinge","shoulders_iso","core","biceps","triceps"] },
  "schedule": { "2": [["Monday","full_a"],["Thursday","full_b"]] },
  "injuryConstraints": { "knee": { "label": "Protect knees", "keywords": ["squat","lunge","leg extension","jump"], "swaps": ["Glute bridge","Hamstring curl"] } }
}
```
- Patterns: `squat, hinge, lunge, horizontal_push, vertical_push, horizontal_pull, vertical_pull, biceps, triceps, shoulders_iso, calves, core`. `unit`: `"reps"` or `"seconds"`.
- Templates (slot order matters; the time cap keeps the first N):
  - `full_a`: squat, horizontal_push, horizontal_pull, hinge, shoulders_iso, core, biceps, triceps
  - `full_b`: hinge, vertical_push, vertical_pull, lunge, biceps, core, triceps, calves
  - `full_c`: lunge, horizontal_push, vertical_pull, squat, shoulders_iso, core, triceps, biceps
  - `upper`: horizontal_push, horizontal_pull, vertical_push, vertical_pull, biceps, triceps, shoulders_iso, core
  - `lower`: squat, hinge, lunge, calves, core, squat, hinge, core
  - `push`: horizontal_push, vertical_push, horizontal_push, shoulders_iso, triceps, core, triceps, shoulders_iso
  - `pull`: vertical_pull, horizontal_pull, horizontal_pull, biceps, shoulders_iso, core, biceps, vertical_pull
  - `legs`: squat, hinge, lunge, calves, core, squat, hinge, calves
- Schedule (titles: "Full body A", "Upper", "Push", etc.):
  - 2: Mon full_a, Thu full_b
  - 3: Mon full_a, Wed full_b, Fri full_c
  - 4: Mon upper, Tue lower, Thu upper, Fri lower
  - 5: Mon push, Tue pull, Wed legs, Thu upper, Fri lower
  - 6: Mon push, Tue pull, Wed legs, Thu push, Fri pull, Sat legs
- Library contents are the builder's call (about 60–80 entries), with one hard rule enforced by a test: for every pattern × equipment setup there are at least 2 beginner-level entries, and at least 1 of those has empty `stresses` or stresses a single joint.

**Rules (decided; implement exactly):**
- Exercise pick per slot: candidates = library entries in file order where `equipment` includes the setup, `level` allowed (Beginner → beginner; Intermediate → beginner+intermediate; Advanced → all), and `stresses` shares nothing with `injuries`; skip names already used that day; take the first. No candidate → use the static fallback for that pattern from `fallbacks` in the JSON (never dropped). Fallbacks are bodyweight, beginner, `stresses: []` exercises that exist in the library (e.g. squat → "Glute bridge", hinge → "Bird dog", lunge → "Side-lying leg raise", horizontal_push → "Wall push-up", vertical_push → "Band pull-apart", pulls → "Band row", biceps → "Band curl", triceps → "Band pushdown", shoulders_iso → "Band face pull", calves → "Seated calf raise", core → "Dead bug"); the fallback may repeat within a day.
- Time cap: 30 → 4 slots, 45 → 5, 60 → 6, 90 → 8 (applied before picking, to the template list).
- Prescription (`sets × repMin–repMax`); beginners get one fewer set (min 2):

  | goalKey | compound* | other | day note |
  |---|---|---|---|
  | fat_loss | 3 × 10–15 | 3 × 10–15 | `Cardio: 10–20 min finisher (incline walk, bike or rower).` + `Important: rest about 60 s between sets.` |
  | muscle_gain | 4 × 8–12 | 3 × 10–12 | `Important: rest about 90 s between sets.` |
  | maintain | 3 × 8–12 | 3 × 8–12 | `Cardio: optional 10 min easy cardio.` + `Important: rest about 75 s between sets.` |
  | strength | 5 × 3–6 | 3 × 8–10 | `Important: rest 2–3 min on the main lifts.` |
  | general | 3 × 10–12 | 3 × 10–12 | `Cardio: 10 min easy cardio.` + `Important: rest 60–75 s between sets.` |

  *compound = squat, hinge, horizontal_push, vertical_push, horizontal_pull, vertical_pull. `unit: "seconds"` entries always get `3 × 30–45 seconds` (beginner: 2).
- Markdown format (parser-compatible): `# Starter plan — <Goal label>`, `Goal: <Goal label>`, then per training day `## <Weekday> — <Title>`, one `- <Exercise> — <sets> × <min>–<max>` line per exercise (seconds: `- Plank — 3 × 30–45 seconds`), then the note lines. Unlisted weekdays become Rest via `parsePlan`.
- `buildStarterPlan` returns `name: "Starter plan — <Goal label>"`, `goal: <Goal label>`, `rawText` = the Markdown, `days` = `parsePlan(rawText).days`.

- [ ] **Step 1: Write failing tests** in `starterPlan.test.ts`:
  - `library covers every pattern for every setup`: the coverage rule above.
  - `every combination builds a usable week`: for all 5 goals × 3 experiences × days 2–6 × 4 session lengths × 3 setups, with `injuries: []`, with each single injury, and with all 5 injuries: training-day count === `daysPerWeek`; every training day has exactly the time-cap number of exercises (no slot dropped);
  - `fallbacks are safe`: every `fallbacks` entry names a library exercise with `stresses: []`, `level: "beginner"`, available for all 3 setups; `isRest` is false on training days and true on the others.
  - `injuries exclude stressed exercises`: with `injuries: ["knee"]`, no exercise name in the plan belongs to a library entry whose `stresses` includes `"knee"`.
  - `deterministic`: same input twice → identical `rawText`.
  - `prescriptions follow the goal`: strength + Intermediate + gym, Monday's first exercise has `sets === 5, repMin === 3, repMax === 6`; same with Beginner → `sets === 4`; fat_loss days have a note starting with `Cardio:`.
  - `injuryConstraints`: `["knee","wrist"]` → 2 constraints with ids `injury-knee`, `injury-wrist` and the JSON keywords.
- [ ] **Step 2: Run** `npm test -w server` → FAIL (module missing).
- [ ] **Step 3: Write `workouts.json`** to the shape and templates above, then implement `starterPlan.ts` (import the JSON with `import data from "../seed/workouts.json" with { type: "json" }`; esbuild bundles it, so the build script needs no change).
- [ ] **Step 4: Run** `npm test -w server` and `npm run build -w server` → PASS, and `dist/index.js` starts (`node dist/index.js` reaches "listening" or the Mongo connect step).

### Task 3: Onboarding endpoint

**Files:**
- Create: `server/src/routes/onboarding.ts`; Modify: `server/src/routes/api.ts` (mount it on `api`)
- Test: `server/src/routes/onboarding.test.ts`

**Interfaces:**
- Consumes: `buildStarterPlan`, `injuryConstraints` (Task 2); `userRepo().profile/saveProfile/addPlan`; `GOAL_LABELS`.
- Produces: `PATCH /api/profile/onboarding`, body exactly one of:
  - `{ step: number (3–8), answers: OnboardingAnswers }` → merges answers, sets `onboarding.step = max(current, step)`, returns `{ profile }`.
  - `{ complete: true }` → 422 `{ error, missing: string[] }` unless `goalKey, experience, daysPerWeek, sessionMinutes, equipmentSetup` are set; otherwise sets `goal = GOAL_LABELS[goalKey]`, replaces any `injury-*` constraints with `injuryConstraints(injuries ?? [])` (other constraints kept), `addPlan` with a new id and `createdAt: now()`, sets `completedAt = now()`, `skippedAt = null`, `step = 8`; returns `{ profile, plan }`.
  - `{ skip: true }` → sets `skippedAt = now()`; plan untouched; returns `{ profile }`.
  - `{ restart: true }` (used by "Finish setup" / "Redo setup") → if `completedAt` is set or `onboarding` is missing: `onboarding = { step: 2, completedAt: null, skippedAt: null }`; otherwise keep `step` and clear `skippedAt`. Answers are kept either way. Returns `{ profile }`.
- `OnboardingAnswers` = partial of `goalKey, sex, heightCm, startBodyweightKg, targetBodyweightKg, units, experience, daysPerWeek, sessionMinutes, equipmentSetup, injuries, diet`, same zod rules as Task 1, `.strict()`.

- [ ] **Step 1: Write failing tests** (`useTestApp("onboarding_test")`, `signUpVerified`):
  - `saves answers per step and never moves step backwards`: PATCH step 4 then step 3 → `onboarding.step === 4`, both answer sets present.
  - `rejects unknown or invalid answers`: `{ step: 3, answers: { goalKey: "bulk" } }` → 400; `{ answers: { foo: 1 } }` → 400.
  - `complete needs the core answers`: fresh user `{ complete: true }` → 422 with `missing` containing `"goalKey"`.
  - `complete builds and activates a starter plan`: answer everything (gym, 4 days, injuries `["knee"]`), complete → response `plan.name` starts with `"Starter plan"`; `GET /plans/active` returns that id; `GET /plans` length is 2 (baseline kept); profile `onboarding.completedAt` set; constraints contain exactly one `injury-knee`.
  - `completing again does not duplicate constraints`: restart, complete again → still one `injury-knee`; `GET /plans` length 3.
  - `skip leaves the baseline plan active`: fresh user skip → `skippedAt` set, active plan name unchanged.
  - `requires CSRF`: PATCH without the header → 403.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test -w server` → PASS.

### Task 4: Daily check-ins

**Files:**
- Modify: `server/src/domain.ts`, `server/src/db.ts` (collection `checkins` + unique index `{ userId: 1, date: 1 }`), `server/src/repo.ts` (methods + delete on account deletion, next to `profiles().deleteOne` at line ~90)
- Create: `server/src/routes/checkins.ts`; mount on `api`
- Test: `server/src/routes/checkins.test.ts`

**Interfaces:**
- Produces: `export interface Checkin { date: string; weightKg: number | null; mood: 1|2|3|4|5 | null; sleep: "poor"|"ok"|"good" | null; updatedAt: string }`
- Repo: `checkin(date: string): Promise<Checkin | null>`, `upsertCheckin(c: Checkin): Promise<void>`
- Routes: `GET /api/checkins/:date` → `Checkin` or `null` (200); `PUT /api/checkins/:date` body `{ weightKg?, mood?, sleep? }` → saved `Checkin`. `:date` must match `^\d{4}-\d{2}-\d{2}$` and be a real calendar date, else 400. Body: `weightKg` 20–400, `mood` int 1–5, `sleep` enum; at least one non-null, else 400. A second PUT for the same date replaces it.

- [ ] **Step 1: Write failing tests:** get-empty returns `null`; PUT weight only → GET returns it with mood/sleep `null`; second PUT same date replaces (one doc in `col().checkins()`); empty body → 400; `2026-13-40` and `today` → 400; user B can't see user A's check-in; account delete removes check-ins.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test -w server` → PASS.

### Task 5: Client types, API calls, units helper

**Files:**
- Modify: `client/src/lib/domain.ts` (mirror Task 1 + Task 4 types and `GOAL_LABELS`), `client/src/lib/api.ts`
- Create: `client/src/lib/units.ts`

**Interfaces:**
- `api.ts` adds: `authApi.register(name, email, password, age: number)`; `api.onboarding(body)` → `PATCH /profile/onboarding` returning `{ profile: Profile; plan?: WorkoutPlan }`; `api.checkin(date)`; `api.saveCheckin(date, body)`. Update `AuthProvider.register` signature to pass `age`.
- `units.ts`:
  ```ts
  export const LB_PER_KG = 2.20462;
  export function toDisplay(kg: number | null, units: Units): number | null; // lb: round to 1 dp; kg: round to 1 dp
  export function fromDisplay(v: number | null, units: Units): number | null; // lb → kg rounded to 3 dp (keeps 180 lb → 180.0 on reload)
  export function unitLabel(units: Units): "kg" | "lb";
  export function useUnits(): { units: Units; setUnits(u: Units): void }; // reads profile once per page load (module-level cache), defaults "kg"
  ```
- [ ] **Step 1: Implement**, then run `npm run typecheck -w client` → PASS.
- [ ] **Step 2: Check the round trip** with a throwaway `node -e` in the terminal (not a file): `fromDisplay(180,"lb")` then `toDisplay(...,"lb")` → `180`; same for 1–400 lb in a loop → no drift.

### Task 6: Age on signup

**Files:** Modify `client/src/app/(app)/signup/page.tsx`

- [ ] **Step 1:** Add an **Age** input (`type="number"`, `inputMode="numeric"`, min 16, max 90, required) after Email. Block submit unless it's a whole number 16–90, with the message "Enter your age (16–90)". Change the subtitle to "Next we'll ask a few questions to build your plan."
- [ ] **Step 2:** `npm run typecheck -w client` → PASS; manually sign up with age 15 (blocked) and 30 (works; `GET /api/profile` shows `age: 30`).

### Task 7: Onboarding flow and plan reveal

**Files:**
- Create: `client/src/app/(app)/onboarding/page.tsx`, `client/src/components/onboarding/steps.ts` (step config), `client/src/components/onboarding/StepShell.tsx` (progress bar + Back / Continue / Skip), `client/src/components/onboarding/PlanReveal.tsx`

**Interfaces:**
- Consumes: `api.profile`, `api.onboarding`, `useUnits`, `toDisplay`/`fromDisplay`, `AiProviderSettings` (existing component, unchanged).
- `steps.ts`: `export const STEPS: { n: number; key: string; title: string; optional: boolean; prefilled?: boolean }[]` with exactly:
  1 `account` "Account" prefilled · 2 `basics` "Basics" prefilled · 3 `goal` "Goal" · 4 `body` "Body" · 5 `training` "Training" · 6 `equipment` "Equipment & limits" · 7 `diet` "Diet" optional · 8 `ai` "AI coach" optional.

**Behaviour (decided):**
- On load, open at `max(3, onboarding.step + 1)` (capped at 8); if `completedAt` is set, open at 3 with saved answers filled in (Redo).
- Progress bar shows `n/8`, with steps 1–2 ticked and clickable. Step 1 shows the email (read-only); step 2 shows name and age, editable via the existing `authApi.updateMe` and `PATCH /profile/onboarding` with `answers: {}`. Neither ever shows as pending.
- Step 3 goal: 5 option cards using `GOAL_LABELS`.
- Step 4 body: sex (optional radio), height cm, current weight, target weight, kg/lb toggle at the top. Weights convert with `fromDisplay` before sending. Choosing a unit saves `units` immediately and updates `useUnits`.
- Step 5 training: experience (3 cards with the spec's month ranges), days per week 2–6, minutes 30/45/60/90.
- Step 6: equipment (3 cards); injury chips knee, lower back, shoulder, wrist, elbow (multi-select, none allowed).
- Step 7 diet: 4 cards plus Skip.
- Step 8 AI coach: embed `AiProviderSettings`, with copy saying it's optional and doesn't change the plan; buttons "Skip for now" and "Finish".
- Continue on steps 3–7 sends `{ step, answers }`; Continue is disabled until required fields are set (steps 3, 5, 6). Finish/Skip on step 8 sends `{ complete: true }`, then renders `PlanReveal`.
- Every step has a "Skip setup" text link → `{ skip: true }` → `/dashboard`.
- `PlanReveal`: "Here's your week", each weekday as a card (title, exercises with `sets × repMin–repMax`, rest days labelled Rest), and a button "Start using StarkFitIQ" → `/dashboard`.
- Errors show with the existing `ErrorNote`.

- [ ] **Step 1: Implement.** **Step 2:** `npm run typecheck -w client` → PASS.
- [ ] **Step 3: Manual walkthrough** (`npm run dev` in both workspaces): new account → `/onboarding` opens at step 3 with 1–2 ticked; leave at step 5, reload → reopens at step 5; switch to lb and back; skip diet and AI; finish → reveal shows 4 training days for "4 days"; `/plan` shows the starter plan active; phone width (375 px) has no horizontal scroll; keyboard-only run-through works.

### Task 8: Dashboard cards and profile links

**Files:**
- Create: `client/src/components/SetupCard.tsx`, `client/src/components/CheckinCard.tsx`
- Modify: `client/src/app/(app)/dashboard/page.tsx` (render one card above the header section), `client/src/app/(app)/profile/page.tsx` (units toggle; "Finish setup" or "Redo setup" link)

**Behaviour (decided):**
- Dashboard loads `api.profile()` and `api.checkin(today())` alongside its existing calls. Which card:
  - `profile.onboarding && !completedAt && !skippedAt` → `SetupCard`
  - else if the check-in is `null` → `CheckinCard`
  - else nothing.
- `SetupCard` copy: "Welcome, {first name}. You're {step} of 8 steps in. Finish setup to get your plan." Buttons: **Continue setup** → `/onboarding`; **Skip for now** → `{ skip: true }`, then the card swaps to `CheckinCard`.
- `CheckinCard`: "How are you today?" Weight input (in `unitLabel(units)`, sent through `fromDisplay`), mood as 5 buttons (1–5, with an accessible label each: "Very low"…"Great"), sleep Poor / OK / Good. **Save** is enabled once any field has a value, then sends `api.saveCheckin(today(), …)`, and the card is replaced by a one-line "Checked in today ✓" that disappears on the next visit.
- Profile page: a kg/lb toggle saving through `PUT /profile` (the whole profile, which Task 1 keeps intact). Link "Finish setup" when onboarding isn't completed (calls `{ restart: true }`, then `/onboarding`), "Redo setup" when it is. Accounts with no `onboarding` field see "Redo setup".

- [ ] **Step 1: Implement.** **Step 2:** `npm run typecheck -w client` → PASS.
- [ ] **Step 3: Manual check:**
  - New account: setup card shows. Skip → check-in card. Save mood only → "Checked in today ✓". Reload → no card.
  - Change the system date by a day, or use `PUT` with tomorrow's date in devtools, then reload → card back.
  - An existing (pre-feature) account → no setup card, check-in card shows.
  - Profile name edit keeps `units` and `onboarding` (`GET /api/profile`).

### Task 9: Units across the app

**Files:** Modify `client/src/app/(app)/log/page.tsx` (set weight inputs, previous-set text, bodyweight input, headers at ~406-516), `client/src/app/(app)/history/page.tsx` (~114, 149-150, 271)

- [ ] **Step 1:** Replace hard-coded `"kg"` labels with `unitLabel(units)`. Show stored kg values through `toDisplay`; convert inputs back with `fromDisplay` before they go into state that's saved. Volume and e1RM go through `toDisplay` too. Keep the header wording ("kg total" → "lb total", etc.).
- [ ] **Step 2:** `npm run typecheck -w client` → PASS.
- [ ] **Step 3: Manual check:** in lb mode, log 3 sets at 135 lb and save; switch to kg → the set shows 61.2 kg; switch back → 135 lb; `GET /api/sessions` stores ≈61.235 kg; history volume and e1RM follow the toggle.

---

## Self-review notes

- Spec coverage: signup age (T1, T6), 2/8 prefilled (T7), goals/body/training/equipment/injuries/diet/AI steps (T7), JSON rule plan (T2), plan on completion + baseline kept / skip (T3), daily check-in (T4, T8), kg/lb everywhere (T5, T7, T8, T9), existing accounts (T1, T8), Redo / Finish setup (T3, T8), tests (T1–T4).
- My calls beyond the spec: `goalKey` field next to `goal`; `restart` action for Finish/Redo setup. Age is required on the server too; when no safe exercise fits a slot, a static fallback fills it.

---

# Part 3 — Implementation notes (18 Nov 2026)

Built as planned, with these calls made during implementation:

- `PUT /profile` merges into the stored profile instead of replacing it, so a page that omits the new fields can't wipe onboarding answers.
- Profile validation shared by `/profile` and onboarding lives in `server/src/routes/profileSchema.ts`.
- `starterPlan.ts` also exports `LIBRARY` and `slotCap()` so the tests can check library coverage and slot counts.
- Injury constraint keywords were narrowed so the generated plan never flags its own exercises (a test enforces this).
- Basics step (age edit) saves through `PUT /profile`, so it doesn't mark the Goal step as reached.
- The AI-coach step renders without a `<form>` and `AiProviderSettings` buttons are `type="button"`, so saving a key doesn't finish onboarding.
- Experience is only pre-selected once the user has passed step 5 (seeded profiles say "Intermediate" without the user choosing).
- In kg mode the log page passes weights through untouched (keeps 2-decimal plate maths); lb mode converts on display and entry.

Known gaps:

- No automated client tests (the client has no test runner); the flow was checked by typecheck and production build only.
- The server build now calls esbuild directly instead of tsup. tsup pulled in picomatch, and every published picomatch version (≤ 4.0.7) is flagged high-severity (GHSA-fc5q-39xc-vjpf). `npm audit` now reports 0 vulnerabilities.
- The unit preference cache is keyed by the signed-in user; signing out or switching accounts resets it, so one user's unit never shows for another.
- Progress UI: a segmented bar ("N of 8 steps completed") plus a clickable stepper. Green = done (steps 1–2 always), red = an optional step that was skipped, ring = current, grey = to do. The dashboard setup card uses the same segmented bar.
- Starter plan never repeats an exercise within a day when it can avoid it: if a slot's own pattern has nothing safe and unused left, it borrows from a related movement (e.g. a squat slot tries lunge, hinge, calves) before using the static fallback. A test covers every combination with zero or one injury. A few wrist- and elbow-friendly bodyweight exercises were added for that.
- Demo: `docs/demo/e2e-workflow.mp4` (sign-up and onboarding open it) and `docs/screenshots/readme/` (full set: `node scripts/record-demos.mjs shots`).
