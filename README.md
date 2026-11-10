# RepScore: AI workout coach

Log your sets and reps, score your **plan** and every **training week** with Claude, and chat with a coach that knows your plan, logs and constraints.

**Stack:** Next.js 16 · React 19 · Tailwind CSS 4 · TypeScript · Express · Anthropic SDK · (JSON-file store, swappable)

```
workout-coach/
├── shared/   @workout/shared: domain types + date/score helpers used by both apps
├── server/   Express API (port 4000)
│   └── src/
│       ├── services/planParser.ts   markdown plan → structured days/exercises
│       ├── services/metrics.ts      deterministic week + plan metrics (adherence, overload, e1RM…)
│       ├── services/constraints.ts  constraint rules + safer swaps
│       ├── services/claude.ts       ← Claude API slot: scoring (tool use) + streaming chat
│       ├── routes/api.ts            REST + SSE endpoints
│       └── seed/baseline-plan.md    your current plan, loaded on first run
└── client/   Next.js app (port 3000): Dashboard · Log workout · Plan · Coach chat · Profile
```

## Quick start

```bash
npm install
cp server/.env.example server/.env        # then paste your key (below)
cp client/.env.example client/.env.local
npm run dev                               # API :4000 + web :3000
```

Open http://localhost:3000.

### Optional: add a Claude API key

Put it in `server/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-5-5
```

Restart the server. The badge in the top-right switches from **Offline scoring** to **Claude connected**.
Without a key the app still works: scores are computed from the app's own metrics and chat explains how to connect.
The key only lives on the server and is never sent to the browser.

## No API credits? Use your Claude Project (default)

The app works without any API key. Scoring and coaching happen in your **claude.ai Project** on your normal Claude subscription:

1. **Profile:** paste your Workout Project link (`https://claude.ai/project/…`).
2. **Dashboard → “Copy check-in & open Claude”:** the app builds a markdown check-in with your profile, plan, logged sets/reps, metrics and a reply format. It copies it to your clipboard and opens the project. Start a new chat there, paste it and send. You can also download the `.md` and add it to the project's files.
3. Claude replies with its analysis, ending with a ```json score block.
4. **Copy the whole reply → paste it in step 2 → “Import score”.** The score, sub-scores, issues and next-week adjustments are saved to your dashboard and trend, tagged “Claude Project”.

The same flow works for **plan reviews** on the Plan page. On **Coach chat**, “Copy my data & open Claude” copies your latest training data so the project chat stays up to date.
The app never logs in to or automates claude.ai. You do the paste in each direction, which keeps this within Claude's terms.

## How scoring works

1. **The app computes ground-truth metrics** (`metrics.ts`):
   - **Adherence (35%)**: planned sessions and sets completed so far this week (mid-week scoring only counts days that have passed)
   - **Progressive overload (25%)**: best estimated 1RM (Epley) per lift vs last week
   - **Rep-range quality (15%)**: % of sets inside the plan's target range
   - **Muscle balance (15%)**: completed vs planned sets per muscle group
   - **Recovery & safety (10%)**: session RPE plus constraint violations
2. **Claude reviews it** (`claude.ts`): it gets your profile, plan, raw logs and those metrics, and returns a structured report through a forced tool call. The report has the final score (kept within ±10 of the base unless justified), a summary, strengths, issues, recommendations, concrete next-week adjustments and constraint flags.
3. **Plan scoring** checks weekly sets per muscle against a 10–22 set band, recovery days, session length and constraint safety, then asks Claude for goal-fit analysis.

## Constraints

Edit them on **Profile**. Each rule has keywords that flag exercises (e.g. `romanian deadlift`, `crunch`) and suggested swaps.
Conflicts show up in plan view, on the log screen (with one-click swap chips) and in every score report.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/status` | Claude connected? model |
| GET/PUT | `/api/profile` | Goal, bodyweights, constraints |
| GET/POST | `/api/plans` | List / upload (markdown text) |
| PUT | `/api/plans/:id/days/:day` | Edit one day's title, notes and exercises |
| POST | `/api/plans/:id/activate` | Switch active plan |
| DELETE | `/api/plans/:id` | Delete a plan |
| GET/PUT | `/api/sessions` | Logged workouts (`?week=` / `?date=`); PUT upserts by date |
| GET | `/api/sessions/previous?before=` | Last performance per exercise |
| DELETE | `/api/sessions/:id` | Delete a logged workout |
| GET | `/api/day-import/prompt?date=` | Build the AI-assisted day-entry prompt |
| POST | `/api/day-import` | Import a pasted day-entry reply (`{date, text}`) |
| GET | `/api/metrics/week?date=` | Live metrics for a week |
| POST | `/api/scores/plan` | Score the active plan |
| POST | `/api/scores/week` | Score the week containing `date` |
| GET | `/api/handoff/week?date=` · `/api/handoff/plan` · `/api/handoff/context` | Markdown check-in packs for your Claude Project |
| POST | `/api/scores/import` | Import a pasted Claude reply (`{kind, text}`); declared reply kind must match |
| GET/POST/DELETE | `/api/chat` | History / send (Server-Sent Events stream) / clear |

### Plan format

```md
## Monday — Biceps + Triceps
| Exercise     | Sets × Reps |
| ------------ | ----------- |
| EZ-bar curls | 3 × 10–12   |
- Normal forearm plank — 2 × 30–45 seconds
- Side machine crunch — 2 × 12 each side
```

## Scripts

```bash
npm run dev        # both apps with hot reload
npm run build      # build server (tsup) + client (next build)
npm start          # run production builds
npm test           # parser / constraint / metrics tests
npm run typecheck
```

## Data

Everything is stored in `server/data/db.json` (git-ignored). To move to MongoDB or Postgres, re-implement `server/src/store.ts`.
