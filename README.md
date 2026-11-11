<div align="center">
  <img src="docs/repscore-hero.gif" alt="StarkFitIQ — AI Workout Coach animated banner" width="100%" />
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

StarkFitIQ is an AI workout coach that understands your training plan, workout history, goals and constraints. Log sets and reps, review your progress, score each training week and get practical coaching recommendations.

<div align="center">
  <img src="docs/repscore-workflow.gif" alt="StarkFitIQ animated workflow: log workout, review metrics, get AI coaching and a weekly score" width="100%" />
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
- **AI:** each user's own provider: Anthropic (Claude), OpenAI, Gemini, Groq, Mistral, OpenRouter or any OpenAI-compatible API
- **Storage:** MongoDB (Atlas)
- **Auth:** Argon2id, JWT access + refresh tokens in httpOnly cookies, Resend for email
- **Domain code:** each app has its own copy, `server/src/domain.ts` and `client/src/lib/domain.ts` (types, date helpers, score and calorie math). When you change an API type, update both

## Project structure

```text
workout-coach/
├── server/                         # Express API (port 4000)
│   └── src/
│       ├── domain.ts                # Server's domain types and helpers
│       ├── app.ts / index.ts        # Express app / startup (MongoDB connect + listen)
│       ├── db.ts / repo.ts          # MongoDB collections / per-user data access
│       ├── auth/                    # Argon2id, JWT cookies, CSRF, email tokens, key encryption
│       ├── services/
│       │   ├── planParser.ts        # Markdown plan → structured plan
│       │   ├── metrics.ts           # Deterministic training metrics
│       │   ├── constraints.ts       # Constraint rules and exercise swaps
│       │   ├── ai.ts                # Per-user AI provider client
│       │   ├── email.ts             # Resend emails (console in dev)
│       │   └── claude.ts            # AI scoring and streaming chat prompts
│       ├── routes/                  # auth.ts, settings.ts, api.ts (REST + SSE)
│       └── seed/baseline-plan.md    # Initial workout plan
└── client/                         # Next.js app (port 3000)
    └── src/
        ├── app/                     # Pages: Dashboard, Log, History, Plan, Coach, Profile,
        │                            # login, signup, forgot/reset password, verify email
        │                            # (+ icon.png / apple-icon.png = browser tab icons)
        ├── components/              # Nav, Logo, auth provider, settings, UI
        ├── lib/domain.ts            # Client's domain types and helpers
        ├── lib/api.ts               # API client (cookies, CSRF, silent refresh)
        └── assets/StarkFitIq.png    # Logo
```

## Quick start

```bash
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env.local
npm run secrets -w server   # prints JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY
```

In `server/.env`, paste the three generated secrets and set `MONGODB_URI` to your MongoDB Atlas connection string (Atlas → Database → Connect → Drivers). In Atlas **Network Access**, allow your machine's IP. Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create an account. Without `RESEND_API_KEY`, the verification email is printed in the `npm run dev` terminal: open its link to verify and you're in. The API runs at [http://localhost:4000](http://localhost:4000). The server refuses to start if any secret is missing or weak.

Have data in the old `server/data/db.json`? Sign up first, then copy it into your account:

```bash
npm run import-json -w server -- you@example.com ./data/db.json
```

## Pages

| URL | Who | What |
| --- | --- | --- |
| `/` | Everyone | Landing page (black + gold, the site-wide theme) |
| `/landing-2` | Everyone | Alternate light landing page (cream + forest green) |
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` | Everyone | Auth pages |
| `/dashboard`, `/log`, `/history`, `/plan`, `/chat`, `/profile` | Signed in + verified | The app |

Branding lives in `client/src/assets/`: `StarkFitIq Icon.png` (icon only: nav bars, footers, browser-tab icon) and `StarkFitIq.png` (full logo with name and tagline: sign-in/sign-up pages). Landing photos in `assets/landing/` are cropped from the design mockups; replace them with full-resolution photos when you have them. Set `NEXT_PUBLIC_GITHUB_URL` / `NEXT_PUBLIC_DOCS_URL` in `client/.env.local` for the landing page links.

## Accounts and security

- **Sign up, sign in, sign out, sign out everywhere, change password, revoke a device, delete account** (Profile → Account & security).
- **Email verification:** a link is emailed at sign-up (expires in 24 h, resendable, single use). The app stays locked until it's clicked (`REQUIRE_EMAIL_VERIFICATION`).
- **Forgot password:** "Forgot password?" on the sign-in page emails a one-time link (expires in 1 h). The response is identical whether or not the email exists. Resetting signs out every device and sends a "password changed" notice.
- **Email** goes through [Resend](https://resend.com) (`RESEND_API_KEY`, `EMAIL_FROM` on a verified domain). In development without a key, emails are printed in the server terminal. Link tokens are 256-bit random values stored only as SHA-256 hashes, auto-deleted by a TTL index, and removed from the address bar once read.
- **Passwords** are hashed with **Argon2id** (64 MiB, 3 passes) and rehashed automatically if settings get stronger.
- **JWT access token** (15 min) and **refresh token** (7 days) are stored in `httpOnly`, `SameSite`, `Secure` (in production) cookies, never readable by JavaScript. The refresh cookie is only sent to `/api/auth`.
- **Refresh-token rotation with reuse detection:** every refresh token works once and is stored only as a SHA-256 hash in MongoDB (auto-expired by a TTL index). Replaying an old one revokes that whole sign-in.
- **Instant revocation:** changing your password or signing out everywhere invalidates all outstanding access tokens.
- **CSRF protection:** an `Origin` check on every write, plus an `X-CSRF-Token` header bound to the session.
- **Rate limiting** on login (per IP and per email), sign-up, refresh and sensitive actions; generic login errors with constant-time checks, so attackers can't tell which emails exist.
- `helmet` security headers, strict CORS to `CLIENT_ORIGIN`, `Cache-Control: no-store` on the API, Zod validation on every input, and every database query scoped to the signed-in user.

Deploying client and API on **different sites** (e.g. `app.vercel.app` + `api.onrender.com`)? Set `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, `NODE_ENV=production`, `TRUST_PROXY=true` and `CLIENT_ORIGIN=https://your-client`.

## AI coaching options

### Use your Claude Project — no API credits required

StarkFitIQ can prepare a Markdown check-in containing your profile, plan, logged sets, metrics and the expected response format.

1. Add your Claude Project URL in **Profile**.
2. Select **Copy check-in & open Claude** on the Dashboard.
3. Paste the copied check-in into your Claude Project and send it.
4. Copy Claude's complete response, including its final JSON score block.
5. Paste it into StarkFitIQ and select **Import score**.

The same handoff flow is available for plan reviews and coach-chat context. StarkFitIQ does not sign in to or automate claude.ai; you manually copy and paste in both directions.

### Connect your own AI (optional, per user)

Each user adds their own key under **Profile → AI provider**. Supported: **Anthropic (Claude), OpenAI, Google Gemini, Groq, Mistral, OpenRouter**, or any **custom OpenAI-compatible** endpoint. Pick a provider, enter a model and key, and select **Check & save**. The key is tested with one tiny request, encrypted with AES-256-GCM (`ENCRYPTION_KEY`), and never sent back to the browser (only its last 4 characters are shown).

Custom base URLs must be HTTPS and public (private/loopback addresses are blocked to prevent SSRF). For a local model such as Ollama in development, set `ALLOW_PRIVATE_AI_URLS=true`.

Without a key, deterministic scoring and the manual Claude Project workflow remain available.

## Constraints and exercise swaps

Manage constraints from **Profile**. Each rule can match exercise keywords and provide suggested alternatives. Conflicts are surfaced in the plan, workout logging flow and score reports. Do not treat an exercise swap as medical advice; choose movements appropriate to your circumstances.

## API overview

| Method              | Endpoint                         | Purpose                                   |
| ------------------- | -------------------------------- | ----------------------------------------- |
| POST                | `/api/auth/register`             | Create account (sets auth cookies)        |
| POST                | `/api/auth/login`                | Sign in (sets auth cookies)               |
| POST                | `/api/auth/refresh`              | Rotate refresh token, new access token    |
| POST                | `/api/auth/logout`               | Sign out this device                      |
| POST                | `/api/auth/logout-all`           | Sign out every device                     |
| GET / PATCH / DELETE| `/api/auth/me`                   | Current user, rename, delete account      |
| POST                | `/api/auth/change-password`      | Change password                           |
| POST                | `/api/auth/verify-email`         | Verify email with the emailed token       |
| POST                | `/api/auth/resend-verification`  | Send a new verification link              |
| POST                | `/api/auth/forgot-password`      | Email a password-reset link               |
| POST                | `/api/auth/reset-password`       | Set a new password with the emailed token |
| GET / DELETE        | `/api/auth/sessions[/:id]`       | List or revoke signed-in devices          |
| GET / PUT / DELETE  | `/api/settings/ai`               | Your AI provider (key never returned)     |
| POST                | `/api/settings/ai/test`          | Test the saved key                        |
| GET                 | `/api/status`                    | Your AI connection status and model       |
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

Additional day-import endpoints are available at `GET /api/day-import/prompt?date=` and `POST /api/day-import`. Everything except `/api/auth/register|login|refresh|logout|verify-email|forgot-password|reset-password` and `/api/health` requires a signed-in user (app data also needs a verified email); writes also need the `X-CSRF-Token` header returned by login/refresh/me.

## Scripts

```bash
npm run dev        # Start API and web app with hot reload
npm run build      # Build server and client
npm start          # Run production builds
npm test           # Auth end-to-end tests (in-memory MongoDB) + parser, constraint and metrics tests
npm run typecheck  # TypeScript checks
npm run secrets -w server       # Generate JWT and encryption secrets
npm run import-json -w server -- <email> [db.json]  # Copy old JSON data into an account
```

The auth tests start a throwaway MongoDB: they use `mongod` from your PATH if installed (e.g. `brew install mongodb-community`), otherwise download one into `node_modules/.cache` on the first run. Its data folder is `server/.mongo-test-*`, deleted after the run. They never touch your Atlas database.

## Data storage

Data lives in **MongoDB** (`MONGODB_URI`, database `MONGODB_DB`). Collections: `users`, `refresh_tokens`, `profiles`, `plans`, `sessions`, `scores`, `chat_messages`. All training data carries a `userId` and is accessed only through `server/src/repo.ts`, which scopes every query to the signed-in user. Indexes are created on startup.

---

<div align="center">
  <strong>Show up. Log the work. Earn the score.</strong>
  <br />
  <sub>StarkFitIQ — an AI workout coach built around your actual training data.</sub>
</div>
```
