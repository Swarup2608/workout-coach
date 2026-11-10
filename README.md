<div align="center">
  <img src="docs/repscore-hero.gif" alt="RepScore — AI Workout Coach animated banner" width="100%" />
  <br />
  <p><strong>Plan your training. Track every rep. Score your week. Get stronger.</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs" alt="Next.js 16" />
    <img src="https://img.shields.io/badge/React-19-149eca?logo=react" alt="React 19" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss" alt="Tailwind CSS 4" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Express-API-ffffff?logo=express&logoColor=black" alt="Express" />
    <img src="https://img.shields.io/badge/AI-Claude-d97757?logo=anthropic&logoColor=white" alt="Claude AI" />
  </p>
</div>

## Your training, scored intelligently

RepScore is an AI workout coach that understands your training plan, workout history, goals and constraints. Log sets and reps, review your progress, score each training week and get practical coaching recommendations.

<div align="center">
  <img src="docs/repscore-workflow.gif" alt="RepScore animated workflow: log workout, review metrics, get AI coaching and a weekly score" width="100%" />
</div>

## What you can do

- **Track workouts** — record exercises, sets, reps, load, RPE, cardio and daily activity.
- **Build and review plans** — paste a Markdown workout plan and turn it into structured training days and exercises.
- **Score every week** — evaluate adherence, progressive overload, rep-range quality, muscle balance and recovery.
- **Review plan quality** — check weekly muscle volume, recovery days, session length and constraint safety.
- **Chat with your coach** — discuss your plan, recent logs, progress and next training decisions with context.
- **Respect constraints** — flag exercises that conflict with your profile and suggest safer alternatives.

## How it works

1. Add your profile, goals and training constraints.
2. Import or edit your workout plan.
3. Log each training session as you go.
4. Review deterministic metrics calculated by the app.
5. Ask Claude to interpret the metrics and return a structured coaching report.
6. Import the report to update your score history and next-week adjustments.

## Scoring model

The app calculates the ground-truth metrics first. Claude reviews those metrics alongside your plan and raw training logs.

| Metric               | Weight | What it measures                                            |
| -------------------- | -----: | ----------------------------------------------------------- |
| Adherence            |    35% | Planned sessions and sets completed so far in the week      |
| Progressive overload |    25% | Best estimated 1RM per lift compared with the previous week |
| Rep-range quality    |    15% | Share of working sets inside the plan's target rep range    |
| Muscle balance       |    15% | Completed versus planned sets by muscle group               |
| Recovery & safety    |    10% | Session RPE and constraint violations                       |

Mid-week scoring only counts training days that have passed. Scores stay grounded in app metrics; the AI adds interpretation, coaching and actionable adjustments.

## Tech stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, TypeScript
- **Backend:** Express API
- **AI:** Anthropic SDK / Claude
- **Storage:** JSON-file store, designed to be swappable
- **Shared package:** `@workout/shared` domain types, date helpers and score helpers

## Project structure

```text
workout-coach/
├── shared/                         # Shared domain types and helpers
├── server/                         # Express API (port 4000)
│   └── src/
│       ├── services/
│       │   ├── planParser.ts        # Markdown plan → structured plan
│       │   ├── metrics.ts           # Deterministic training metrics
│       │   ├── constraints.ts       # Constraint rules and exercise swaps
│       │   └── claude.ts            # AI scoring and streaming chat
│       ├── routes/api.ts            # REST and SSE endpoints
│       └── seed/baseline-plan.md    # Initial workout plan
└── client/                         # Next.js app (port 3000)
    ├── Dashboard
    ├── Log workout
    ├── Plan
    ├── Coach chat
    └── Profile
```

## Quick start

```bash
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API runs at [http://localhost:4000](http://localhost:4000).

## AI coaching options

### Use your Claude Project — no API credits required

RepScore can prepare a Markdown check-in containing your profile, plan, logged sets, metrics and the expected response format.

1. Add your Claude Project URL in **Profile**.
2. Select **Copy check-in & open Claude** on the Dashboard.
3. Paste the copied check-in into your Claude Project and send it.
4. Copy Claude's complete response, including its final JSON score block.
5. Paste it into RepScore and select **Import score**.

The same handoff flow is available for plan reviews and coach-chat context. RepScore does not sign in to or automate claude.ai; you manually copy and paste in both directions.

### Connect the Anthropic API (optional)

Add your API key to `server/.env`:

```env
ANTHROPIC_API_KEY=your-anthropic-api-key
CLAUDE_MODEL=your-supported-claude-model
```

Restart the server. The connection indicator changes from **Offline scoring** to **Claude connected** when the API is available. Keep the key on the server; never expose it through a `NEXT_PUBLIC_` variable or send it to the browser.

Without an API key, deterministic scoring and the manual Claude Project workflow remain available.

## Constraints and exercise swaps

Manage constraints from **Profile**. Each rule can match exercise keywords and provide suggested alternatives. Conflicts are surfaced in the plan, workout logging flow and score reports. Do not treat an exercise swap as medical advice; choose movements appropriate to your circumstances.

## API overview

| Method              | Endpoint                         | Purpose                                   |
| ------------------- | -------------------------------- | ----------------------------------------- |
| GET                 | `/api/status`                    | AI connection status and model            |
| GET / PUT           | `/api/profile`                   | Read or update profile                    |
| GET / POST          | `/api/plans`                     | List plans or upload Markdown             |
| PUT                 | `/api/plans/:id/days/:day`       | Edit a plan day                           |
| POST                | `/api/plans/:id/activate`        | Activate a plan                           |
| DELETE              | `/api/plans/:id`                 | Delete a plan                             |
| GET / PUT           | `/api/sessions`                  | Read or upsert workout logs               |
| GET                 | `/api/sessions/previous?before=` | Previous exercise performance             |
| DELETE              | `/api/sessions/:id`              | Delete a workout log                      |
| GET                 | `/api/metrics/week?date=`        | Weekly metrics                            |
| POST                | `/api/scores/plan`               | Score the active plan                     |
| POST                | `/api/scores/week`               | Score a training week                     |
| GET                 | `/api/handoff/week?date=`        | Build a weekly Claude check-in            |
| GET                 | `/api/handoff/plan`              | Build a plan-review check-in              |
| GET                 | `/api/handoff/context`           | Build coach-chat context                  |
| POST                | `/api/scores/import`             | Import an AI score report                 |
| GET / POST / DELETE | `/api/chat`                      | Chat history, streaming message and clear |

Additional day-import endpoints are available at `GET /api/day-import/prompt?date=` and `POST /api/day-import`.

## Scripts

```bash
npm run dev        # Start API and web app with hot reload
npm run build      # Build server and client
npm start          # Run production builds
npm test           # Parser, constraint and metrics tests
npm run typecheck  # TypeScript checks
```

## Data storage

The default store is `server/data/db.json` (git-ignored). The storage layer is isolated in `server/src/store.ts`, making it possible to replace the JSON-file implementation with MongoDB or PostgreSQL.

---

<div align="center">
  <strong>Show up. Log the work. Earn the score.</strong>
  <br />
  <sub>RepScore — an AI workout coach built around your actual training data.</sub>
</div>
```
