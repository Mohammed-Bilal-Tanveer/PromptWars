# LabLink — AI-Powered Campus Laboratory Resource Sharing

> **Your Campus. Your Labs. One Connected World.**
> Hackathon demonstration using simulated campus data. No login required.

LabLink lets students discover specialised lab equipment across departments, describe a project in plain language, get AI-extracted requirements matched to **real catalogue records**, request bookings (or join an allocation queue when a slot is full), and see transparent OR-Tools scheduling recommendations. A public **Demo Approval Desk** simulates the faculty review workflow. Everything is available in two connected interfaces — **Professional Mode** and a game-like **3D Campus Mode** — that share one backend, one database and the same React hooks/components.

The full product spec/roadmap is in [`docs/SPEC.md`](docs/SPEC.md); the API contract is [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Vertical & approach
- **Vertical:** education / campus resource sharing (laboratory equipment discovery, booking, fair scheduling, utilisation analytics).
- **Approach:** *LLM interprets, deterministic code decides.* OpenAI (server-side only) turns free-text projects into structured requirements; a deterministic, explainable matcher maps them to real DB equipment; availability/booking rules are enforced transactionally in the backend; Google OR-Tools (CP-SAT) recommends feasible, fair allocations. The LLM never invents equipment/availability and never confirms or mutates bookings.

## Logic overview
| Area | How it works |
|---|---|
| Availability | Derived from equipment **units** + confirmed bookings + maintenance windows (no stored counters). Half-open intervals `[start,end)`, setup/cleanup buffers, lab opening hours/days in `CAMPUS_TIMEZONE`. |
| Booking | `POST /booking-requests` validates all hard constraints → `pending_review`. Approval re-checks availability **inside a transaction** (row locks on PostgreSQL) and only then creates a `confirmed` booking; conflicts return `409 SLOT_CONFLICT` with alternatives. |
| Allocation queue | If every unit is busy, the requester may send `join_waitlist: true`: the request becomes `waitlisted` (valid window only, duplicates rejected, **no booking and no reservation**). It shows an estimated `queue_position` (priority, then age), can be left (cancelled), is included in scheduling runs, and still needs reviewer approval. |
| AI analyser | Strict JSON-schema output re-validated by Pydantic; untrusted-input prompt; 10-min cache; rate limit. Missing key / timeout / invalid output → clearly labelled **Demo analysis** (`demo_fallback`). |
| Matching | Score 0–100 from exact-name, category, capability overlap, lab/department preference, availability, with evidence strings. Nothing matched ⇒ `unmatched` (never fabricated). |
| Scheduling | CP-SAT over 15-min slots per unit; hard constraints (no overlap, opening hours, operational units, min/max duration, maintenance, confirmed bookings fixed). Weights `0.40 deadline + 0.25 waiting + 0.20 fairness + 0.15 preference` (`W_*` env vars), identity-free fairness. Output is a recommendation only. The response also carries a solver `summary` and per-unit `timeline` that feed the **Scheduling decision visualiser** (locked vs recommended blocks, factor bars, alternatives). |
| 3D mode | Procedural low-poly campus (React Three Fiber). The interaction registry opens the *same* panels as Professional Mode; equipment anchors read live status from the API. WebGL failure or context loss → message with Retry 3D / return to Professional Mode. |

## Notable UX features
- **Calm light UI** (tokens in `frontend/src/styles/index.css`), status chips with icon + text (never colour alone), loading skeletons, 2D/3D mode switch.
- **Server wake-up banner + connection indicator:** a startup readiness probe and single-flight recovery loop show a non-blocking "Waking up LabLink" banner (then a small "Reconnecting…" / "Backend unavailable" pill if dismissed) when a free-tier host is cold. Only GET queries are refetched on recovery; mutations are never replayed.
- **Guided demo:** a 10-step drawer (understand → analyse → discover → availability → request/queue → optimise → review → confirm → 3D → analytics). It only links to screens and **never mutates data**.
- **3D:** three-quarter top-down camera, top **Menu**, **Map & Teleport** (map + resource-network tab), click-to-walk, **E or Enter** to interact, mobile joystick + Sprint toggle, large coloured world (forests, pond, hills, clouds, boundary wall), hero models for Arduino / GPU workstation / 3D printer, and **Find in 3D Campus** guidance.
- **Opt-in "Reset demo scenario":** `DEMO_RESET_ENABLED=true` (needs `DEMO_MODE=true`; **off by default in every environment**). One-time token (120 s) + typed confirmation `RESET DEMO SCENARIO`; deletes only non-seed rows (seed ids are recognised by prefix) and never drops tables or touches the catalogue. Intended for local demos.

## Run locally
```powershell
# Backend (SQLite is selected automatically when DATABASE_URL is empty)
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed.demo_data
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173
```
Optional: copy `.env.example` → `backend/.env` and set `OPENAI_API_KEY` (never exposed to the browser). Without it the analyser uses the labelled deterministic fallback. `.env` is only read from the folder uvicorn is started in, and empty variables are ignored (`env_ignore_empty`).

## Tests & checks
```powershell
cd backend;  .venv\Scripts\activate; ruff check .; pytest -q      # 102 tests
cd frontend; npm run lint; npx vitest run; npm run build         # 58 tests
```
Not covered: no Playwright/e2e, no real OpenAI call in tests, no automated PostgreSQL run (tests use SQLite), no CI pipeline, no assistive-technology accessibility audit.

## Deployment
Both services are deployed from their own sub-folder (set the **Root Directory** in each dashboard).

**Backend — Render, Root Directory `backend`** (`render.yaml` sets `rootDir: backend`). If you create the service by hand:

| Setting | Value |
|---|---|
| Runtime / Python | Python 3 with `PYTHON_VERSION=3.12.5` (otherwise Render may pick a newer Python) |
| Build command | `pip install -r requirements.txt` |
| Start command | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/api/v1/health/ready` |
| Env vars | `DATABASE_URL`, `APP_ENV=production`, `DEMO_MODE=true`, `CAMPUS_TIMEZONE=Asia/Kolkata`, `FRONTEND_ORIGIN=https://<your-vercel-domain>` (exact origin, no trailing slash), optional `OPENAI_API_KEY` / `OPENAI_MODEL`. Do **not** set `DEMO_RESET_ENABLED` on a public deployment. |

**`DATABASE_URL` pitfall:** Render's *Internal* database host (`dpg-…-a`) only resolves inside the same region/workspace (error `failed to resolve host`). Use the Internal URL only when the service and database share a region; otherwise use the **External Database URL**.

With `DEMO_MODE=true` the app runs migrations and the idempotent seed on start-up, so a fresh database is ready with no manual step.

**Frontend — Vercel, Root Directory `frontend`** (`frontend/vercel.json` adds the SPA rewrite). Leave Install/Build/Output overrides empty (Vite defaults: `npm ci`, `npm run build`, `dist`) and set `VITE_API_BASE_URL=https://<render-service>.onrender.com/api/v1`, then redeploy (baked in at build time). Optional: `VITE_RENDER_FREE_TIER=true` switches the wake-up banner to free-tier wording ("up to a minute"). (The root-level `vercel.json` only applies if the Root Directory is left at the repository root.)

## Evaluator scenario
Landing → "Start Guided Demo" (or Professional Mode) → Project Lab → "Use sample project" → analyse → matched equipment → open item → pick a window → request (or join the queue for the fully booked GPU workstation tomorrow 14:00–16:00) → Demo Approval Desk → approve/reject/propose alternative → My Requests → Scheduling Studio (decision visualiser) → 3D Campus (Menu → Map & Teleport) → Analytics.

## Assumptions & limitations
1. All campus data is fictional sample data. 2. No authentication/roles by design; the Demo Approval Desk is a public simulation, not for real approvals. 3. Requester names/departments are unverified display metadata. 4. Scheduling output is a recommendation; joining the queue reserves nothing. 5. Safety/supervision flags are demo metadata. 6. The 3D campus is a low-poly environment using procedural geometry plus a few CC0 Kenney models (see `frontend/public/assets/ASSET_CREDITS.md`). 7. Render free/starter plans may cold-start; the UI shows the wake-up banner and retry states. 8. Enter-key / joystick / sprint behaviour in 3D is covered by unit tests only and should be checked in a real browser.
