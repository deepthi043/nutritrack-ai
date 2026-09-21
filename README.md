# NutriTrack AI

A personal wellness application for tracking activity and hydration goals — with AI-generated wellness insights layered on top of your real data.

> **Status:** Phase 6 complete (mobile application & real activity sync) — **not yet verified on a physical device**; see [mobile/README.md](mobile/README.md#platform-requirements). Meal logging and nutrition tracking (originally Phase 3) were subsequently removed at the user's request — see the note under [Development Phases](#development-phases) below.

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4 + React Router + Recharts + Lucide React
- **Mobile:** React Native (Expo SDK 57) + TypeScript + React Navigation — see [mobile/README.md](mobile/README.md)
- **Backend:** Python + FastAPI + Pydantic + SQLAlchemy + PostgreSQL + JWT auth
- **AI:** Server-side `AIService` with a swappable provider abstraction (`MockAIProvider` active by default; `LLMProvider` scaffolded for a future real vendor)

## Project Structure

```
nutritrack-ai/
├── frontend/          React + TypeScript + Vite app
├── backend/           FastAPI application
│   ├── app/
│   │   ├── api/       Route handlers
│   │   ├── models/    SQLAlchemy ORM models
│   │   ├── schemas/   Pydantic request/response schemas
│   │   ├── services/  Business logic (AI, activity providers, goals, analytics)
│   │   ├── database/  Engine/session/Base setup
│   │   └── core/      Config and security (JWT, password hashing)
│   └── tests/         Pytest suite (isolated in-memory SQLite)
├── mobile/            Placeholder for future mobile app
├── docs/
├── .env.example
└── docker-compose.yml (planned)
```

## Prerequisites

- Python 3.11 (3.13+ currently lacks prebuilt wheels for some dependencies — stick to 3.11 for now)
- Node.js 18+
- PostgreSQL running locally

## Backend Setup

```bash
cd backend
py -3.11 -m venv venv
./venv/Scripts/pip install -r requirements.txt   # Windows
# source venv/bin/activate && pip install -r requirements.txt   # macOS/Linux

# Create the database (adjust to your local Postgres superuser)
psql -U postgres -c "CREATE USER nutritrack WITH PASSWORD 'nutritrack';"
psql -U postgres -c "CREATE DATABASE nutritrack_db OWNER nutritrack;"

cp ../.env.example .env   # then edit DATABASE_URL / SECRET_KEY as needed

./venv/Scripts/python -m uvicorn app.main:app --reload --reload-dir app --port 8010
```

Tables are created automatically on startup (via SQLAlchemy `create_all`). Visit `http://127.0.0.1:8010/docs` for interactive API docs.

**Note:** `create_all` only creates *missing* tables — it never alters an existing table's columns. If a model's columns change (as happened when the meal/food schema was restructured for Phase 3, and again when `profiles`/`water_records` gained new/renamed columns for Phase 4), drop the affected tables manually before restarting so they're recreated with the new shape. This project intentionally has no data worth migrating yet; a real migration tool (Alembic) is planned before this matters in production.

`--reload-dir app` limits the file watcher to the `app/` folder — without it, `--reload` also watches `venv/`, which can trigger spurious restarts when packages touch their own files.

### Run backend tests

```bash
cd backend
./venv/Scripts/python -m pytest tests/ -v
```

Tests run against an isolated in-memory SQLite database — they never touch your real Postgres data.

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL to match your backend port
npm run dev
```

Visit the printed local URL — pinned to `http://localhost:5190` in `vite.config.ts` (`strictPort: true`) for this environment.

## Environment Variables

See [.env.example](.env.example) (backend) and [frontend/.env.example](frontend/.env.example) (frontend). Never commit real `.env` files or secrets.

Key backend variables:
- `DATABASE_URL` — PostgreSQL connection string
- `SECRET_KEY` — JWT signing secret (generate a long random value for production)
- `CORS_ORIGINS` — JSON list of allowed frontend origins
- `AI_PROVIDER` — `mock` (default) or `llm`; automatically falls back to `mock` if `llm` is selected without an `AI_API_KEY`
- `AI_API_KEY` — required only for `AI_PROVIDER=llm`; **server-side only, never sent to the frontend**
- `RESEND_API_KEY` — for password-reset emails via [Resend](https://resend.com); if blank, the reset link is returned directly in the API response (dev mode) instead of emailed — **server-side only**
- `RESEND_FROM_EMAIL` — the "From" address for reset emails (must be a verified sender/domain in Resend)
- `FRONTEND_URL` — base URL used to build the link inside the reset email

## Core User Flow

Signup → Login → Onboarding → Profile → Dashboard → Track Activity → Track Water → View Analytics → AI Insights

## Development Phases

- [x] **Phase 1** — Project setup, PostgreSQL + SQLAlchemy, FastAPI, React/Vite/Tailwind, JWT authentication (register/login/logout/me), profile creation on signup, onboarding flow, protected routes. Verified end-to-end via automated browser test (Playwright) and backend pytest suite (14 tests passing).
- [x] **Auth amendment** — Forgot/reset password flow (added post-Phase-5):
  - `POST /api/auth/forgot-password` and `/reset-password`, backed by a single-use, 30-minute-expiry `PasswordResetToken`
  - Account-enumeration-safe: the forgot-password response is byte-identical whether or not the email is registered, and no token is ever generated for an unregistered email
  - Email delivery via [Resend](https://resend.com) (`email_service.py`), with a safe dev-mode fallback — if `RESEND_API_KEY` is unset, the reset link is logged server-side and returned directly in the API response instead of emailed, so the flow works end-to-end with zero external configuration (same pattern as the mock AI/activity providers)
  - Frontend: "Forgot password?" link on the login page, a request page (`/forgot-password`), and a token-based reset page (`/reset-password?token=...`) that clearly labels the dev-mode link when no real email was sent
  - 12 new backend tests (160 total passing): generic-message enumeration safety, dev-link presence/absence, single-use token enforcement, expiry rejection, short-password rejection, and no-auth-required verification
- [x] **Phase 2** — Activity & step tracking:
  - Activity API (`/api/activity/today`, `/api/activity`, `/api/activity/history`, `/api/activity/weekly`) scoped to the authenticated user
  - `ActivityProvider` abstraction with `MockActivityProvider` (Phase 2) — designed so `AndroidHealthProvider` / `iOSHealthProvider` / `WearableActivityProvider` can be added later without changing the service or API layer
  - Step goal stored on the user's `Profile` (reused, not duplicated) with an editable goal + progress bar on the Activity page
  - Weekly activity bar chart (Recharts) on both the Activity page and Dashboard, zero-filled for days with no data — never fabricated
  - Dashboard replaced with real steps/distance/active-minutes/goal-progress from the database
  - "Add Activity" modal clearly labeled **Development / Demo Activity Data** — never presented as real sensor tracking
  - Loading, empty, and error states on both Activity and Dashboard pages
  - Backend validation rejects negative steps/distance/active minutes (422)
  - 14 new backend tests (28 total passing) covering aggregation, goal progress, cross-user isolation, and validation
- [x] ~~**Phase 3** — Meal logging & nutrition tracking~~ **— REMOVED.** Originally built (meal CRUD, food catalog/search, natural-language food entry, nutrition calculation and charts) but subsequently deleted end-to-end at the user's request: backend models/schemas/services/routes, frontend pages/components/services, mobile's nutrition summary, and every nutrition-derived field in Goals, Analytics, History, the Dashboard, and AI Insights. Activity and water tracking were unaffected.
  > **Note on the Phase 4/5 bullets below:** they were written while Phase 3 still existed, so some lines mention nutrition analytics, nutrition goals, or nutrition history that no longer exist post-removal. Kept as an accurate historical record of what shipped in each phase at the time; the current backend source (`backend/app/`) is the authority on what exists today.
- [x] **Phase 4** — Water tracking, unified goals, analytics & history:
  - Water tracking: `POST /api/water`, `GET /api/water/today`, `/history`, `/weekly`, `DELETE /api/water/{id}` — amount in ml, validated `0 < amount ≤ 10000`; progress is capped at 100% for display but the real total is never truncated
  - Water page (`/water`) with quick-add buttons (250/500/750/1000 ml), a custom-amount form, today's entry list with delete, and a weekly hydration chart
  - Unified goals: `GET/PUT /api/goals` reads and updates goal targets that live as `Profile` fields (steps, weekly active minutes, water, calories, protein, carbs, fat, fiber) — **no duplicate goal-storage table**; Phase 2's step-goal-via-profile mechanism keeps working unchanged
  - Goals page (`/goals`) grouped by Activity / Hydration / Nutrition, each with live progress computed from the same activity/water/nutrition aggregation services the other pages use, and an edit modal per goal
  - Analytics: `GET /api/analytics/{summary,activity,nutrition,water,weekly}` — all SQL-aggregated (`SUM`/`GROUP BY`, no pulling raw rows into Python), covering weekly averages, totals, best/highest day, and tracking consistency
  - Transparent, documented consistency score: **plain average of activity goal completion, water goal completion, and nutrition tracking consistency** — formula returned in the API response itself, not a hidden weighting
  - Analytics page (`/analytics`) with per-category stat cards, a switchable-metric nutrition trend chart, weekly activity/water charts, and the consistency score card
  - Combined history: `GET /api/history` merges activity + nutrition + water per day (`range=today|last_7_days|last_30_days` or explicit `start_date`/`end_date`, capped at 366 days), zero-filled for days with no data, newest first
  - History page (`/history`) with range presets, a custom date-range picker, a responsive table (desktop) / card list (mobile), and a click-to-expand day detail panel
  - Dashboard extended with real "Today's Water" data (Phase 3's placeholder removed), weekly nutrition/water charts, and a live Goal Progress section — Phase 2 activity and Phase 3 nutrition sections untouched
  - 51 new backend tests (119 total passing): water CRUD/validation/aggregation, goal read/update/progress-from-real-data, analytics averages/best-day/consistency/empty-state, history combination/range-filtering/isolation — all with cross-user authorization coverage
- [x] **Phase 5** — AI insights & wellness assistant:
  - Strict architecture: `Database -> service layer -> AIContextBuilder -> AIProvider -> AISafety -> API`. AI providers never receive a database session or user id — only a plain structured context dict built from the same activity/water/meal/goal/analytics services the rest of the app already uses, so an AI response is guaranteed to reflect real logged data
  - `AIProvider` abstraction with `MockAIProvider` (active by default — deterministic, rule-based text generated entirely from the context dict, no external calls, always available) and a scaffolded `LLMProvider` extension point for a future real vendor; `AI_PROVIDER=llm` without `AI_API_KEY` automatically falls back to mock rather than breaking the app
  - `POST /api/ai/daily-insight` and `/weekly-insight` generate and persist an insight to `ai_insights`; `GET /api/ai/insights/history` lists past insights newest-first
  - `POST /api/ai/chat` answers data-aware questions ("What did I eat today?", "How much protein did I consume?", "Summarize my week.") grounded entirely in the authenticated user's own data
  - `AISafety` layer runs on every response regardless of provider: blocks diagnostic language, disease-cure claims, dangerously low calorie prescriptions, and "you don't need a doctor" framing — replacing unsafe text with a labelled safe fallback rather than silently passing it through; every response carries a standard non-medical-advice disclaimer
  - Insights page (`/insights`) with daily/weekly insight cards, a chat assistant with suggested questions, and insight history; Dashboard extended with a "Today's Insight" section generated on demand (not auto-generated on every page load, to avoid flooding insight history)
  - Loading/error states throughout; the mock provider means the AI features work fully offline with zero configuration
  - 29 new backend tests (148 total passing): insight generation with/without logged data, never-fabricates-unlogged-data checks, chat question routing, safety-layer pattern blocking (diagnosis/cure-claims/dangerous-restriction/replaces-doctor), disclaimer presence, cross-user data isolation in both insights and chat context, and provider-fallback behavior
- [x] **Phase 6** — Mobile application & real activity tracking (**not yet verified on a physical device** — see [mobile/README.md](mobile/README.md#platform-requirements)):
  - New `mobile/` Expo (React Native) app — versions (Expo 57.0.22, React Native 0.86.3, React 19.2.3) pulled directly from the official `expo-template-blank-typescript` package and every added dependency resolved via `npx expo install` against this SDK's compatibility matrix, not guessed
  - Mobile auth reuses the existing FastAPI endpoints with zero duplication — JWT stored via `expo-secure-store` (OS keychain/keystore, never AsyncStorage), a 401 anywhere logs the user out locally, and the entire authenticated screen tree is simply unreachable while logged out
  - Client-side `ActivityProvider` abstraction mirroring the backend's own (`MockActivityProvider` / `AndroidHealthProvider` via Health Connect / `IOSHealthProvider` via HealthKit) selected automatically per platform, with an Expo-Go-safe fallback to mock since native health modules require a custom dev build
  - Permission flow: an in-app explanation screen before ever prompting the OS dialog, and a persisted "previously denied" flag (survives app restart) so the OS dialog is never re-prompted after a denial — the user is guided to device settings instead
  - **New backend endpoint** `POST /api/activity/sync` — idempotent upsert keyed on `(user_id, date, source)` via a real DB `UniqueConstraint`, distinct from the existing (unchanged, still-additive) `POST /api/activity` used by manual/web entries — repeated or increasing-total syncs for the same day converge on one row rather than summing
  - Offline-first sync queue (AsyncStorage): activity is always captured locally first and only delivered when `NetInfo` reports connectivity; failed deliveries stay queued for retry rather than being dropped
  - Mobile Home and Activity screens re-use backend-computed values only — no goal math or nutrition totals re-implemented client-side
  - 12 new backend tests (172 total passing) covering sync idempotency, duplicate prevention, cross-source independence, and cross-user isolation; 31 mobile Jest tests (offline queueing, retry-after-failure, the exact 7,000→7,500→7,842 non-duplication scenario, secure token storage, and 401-handling) — all passing, plus clean `tsc` and `eslint`
- [ ] **Phase 7** — Testing hardening, security review, deployment, documentation

## Security Notes

- Passwords hashed with bcrypt (via passlib)
- JWT bearer tokens for stateless auth; tokens expire after 30 minutes by default
- All data-access endpoints scoped to `current_user` — no cross-user data exposure
- CORS restricted to configured frontend origins
- SQL injection protected via SQLAlchemy ORM (parameterized queries)
- No API keys or secrets in frontend code

## Important Engineering Rules

This project follows strict rules to stay production-realistic rather than a demo:
- No fake/hardcoded dashboard statistics — all data comes from the database
- No medical diagnoses in AI output — enforced by an automated safety layer (`ai_safety.py`) that blocks diagnostic/cure-claim/dangerous-restriction language on every response, not just prompt instructions
- Every AI response carries a non-medical-advice disclaimer and a recommendation to consult a professional when relevant
- The AI never has direct database access — it only ever sees a structured context dict built from the same services the rest of the app uses
- Users can only ever access their own data
