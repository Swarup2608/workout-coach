# RepScore — project overview

RepScore is a personal workout tracker and coaching app. It records training and daily health details, compares progress with a weekly plan, and turns saved logs into coaching feedback.

<p align="center">
  <img src="docs/project-overview.svg" alt="Animated architecture diagram showing the RepScore client, API, shared domain logic, JSON store, and Claude coaching paths" width="100%" />
</p>

## What it contains

- **Dashboard:** this week’s sessions, sets, live score, and coach review.
- **Workout log:** planned or custom exercises, sets, reps, load, cardio, RPE, bodyweight, food, steps, water, sleep, and notes. Quick Add can turn a plain-language day description into a saved log.
- **Plan editor:** weekly plan upload and day-by-day editing for exercise names, set and rep targets, and notes.
- **History:** logged workouts, calories, volume, and lift progress over time.
- **Coach:** chat with context from the profile, active plan, recent scores, and saved sessions.
- **Profile:** goal, experience, bodyweight targets, constraints, and an optional Claude Project link.

## How a weekly score is made

1. The API selects the week’s saved information through the latest logged date, so future planned workouts do not count as missed work.
2. Shared calculations produce adherence, rep-range quality, overload, muscle balance, recovery, and weekly stats such as calories, protein, steps, sleep, water, cardio, lifting volume, and bodyweight change.
3. Coaching can come from the Claude API, or from a manual copy-and-paste check-in to a Claude Project. The Project flow sends readable plan and log text, then imports Claude’s score reply.
4. The score report and weekly stats appear on the dashboard and in history.

## Repository map

| Path | Purpose |
| --- | --- |
| `client/app/` | Next.js screens: dashboard, log, plan, history, coach chat, and profile |
| `client/components/` | Shared UI, navigation, quick-add, and Claude Project bridge |
| `client/lib/api.ts` | Browser API client and chat stream reader |
| `server/src/routes/api.ts` | Express endpoints for plans, sessions, scores, handoffs, and chat |
| `server/src/services/` | Plan parsing, metrics, constraints, Claude prompts, and day/score import |
| `server/src/store.ts` | JSON-file persistence, with a replaceable storage boundary |
| `server/src/seed/` | Initial profile and baseline plan |
| `shared/src/index.ts` | Shared types, date helpers, metrics, and calorie calculations |
| `docs/project-overview.svg` | Animated architecture diagram used above |

## Run locally

```bash
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env.local
npm run dev
```

The web app runs at `http://localhost:3000`; the API runs at `http://localhost:4000/api`. Claude API scoring is optional. Without an API key, deterministic app scoring and the manual Claude Project workflow remain available.
