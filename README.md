# LabLink — AI-Powered Campus Laboratory Resource Sharing

> **Your Campus. Your Labs. One Connected World.**
> Hackathon demonstration using simulated campus data. No login required.

LabLink lets students discover specialised lab equipment across departments, describe a project in plain language, get AI-extracted requirements matched to **real catalogue records**, request bookings, and see transparent OR-Tools scheduling recommendations. A public **Demo Approval Desk** simulates the faculty review workflow. Everything is available in two connected interfaces — **Professional Mode** and a game-like **3D Campus Mode** — that share one backend, one database and the same React hooks/components.

The full product spec/roadmap is kept in [`docs/SPEC.md`](docs/SPEC.md); the API contract is [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Vertical & approach
- **Vertical:** education / campus resource sharing (laboratory equipment discovery, booking, fair scheduling, utilisation analytics).
- **Approach:** *LLM interprets, deterministic code decides.* OpenAI (server-side only) turns free-text projects into structured requirements; a deterministic, explainable matcher maps them to real DB equipment; availability/booking rules are enforced transactionally in the backend; Google OR-Tools (CP-SAT) recommends feasible, fair allocations. The LLM never invents equipment/availability and never confirms or mutates bookings.

## Logic overview
| Area | How it works |
|---|---|
| Availability | Derived from equipment **units** + confirmed bookings + maintenance windows (no stored counters). Half-open intervals `[start,end)`, setup/cleanup buffers, lab opening hours/days in `CAMPUS_TIMEZONE`. |
| Booking | `POST /booking-requests` validates all hard constraints → `pending_review`. Approval re-checks availability **inside a transaction** (row locks on PostgreSQL) and only then creates a `confirmed` booking; conflicts return `409 SLOT_CONFLICT` with alternatives. |
| AI analyser | Strict JSON-schema output re-validated by Pydantic; untrusted-input prompt; 10-min cache; rate limit. Missing key / timeout / invalid output → clearly labelled **Demo analysis** (`demo_fallback`). |
| Matching | Score 0–100 from exact-name, category, capability overlap, lab/department preference, availability, with evidence strings. Nothing matched ⇒ `unmatched` (never fabricated). |
| Scheduling | CP-SAT over 15-min slots per unit; hard constraints (no overlap, opening hours, operational units, min/max duration, maintenance, confirmed bookings fixed). Objective weights `0.40 deadline + 0.25 waiting + 0.20 fairness + 0.15 preference` (configurable via `W_*` env vars), identity-free fairness (recent allocated hours). Output is a recommendation only. |
| 3D mode | Procedural low-poly campus (React Three Fiber). Interaction registry opens the *same* panels as Professional Mode; equipment anchors read live status from the API. WebGL failure → one-click return to Professional Mode. |

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
Optional: copy `.env.example` → `backend/.env` and set `OPENAI_API_KEY` (never exposed to the browser). Without it the analyser uses the labelled deterministic fallback.

## Tests & checks
```powershell
cd backend;  .venv\Scripts\activate; ruff check .; pytest -q
cd frontend; npm run lint; npx vitest run; npm run build
```

## Deployment
Both services are deployed from their own sub-folder (set the **Root Directory** in each dashboard).

**Backend — Render, Root Directory `backend`** (`render.yaml` already sets `rootDir: backend`). If you create the service by hand, use:

| Setting | Value |
|---|---|
| Runtime / Python | Python 3 (`PYTHON_VERSION=3.12.5`) |
| Build command | `pip install -r requirements.txt` |
| Start command | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/api/v1/health/ready` |
| Env vars | `DATABASE_URL` (from the Render PostgreSQL instance), `APP_ENV=production`, `DEMO_MODE=true`, `CAMPUS_TIMEZONE=Asia/Kolkata`, `FRONTEND_ORIGIN=https://<your-vercel-domain>` (exact origin, no trailing slash), optional `OPENAI_API_KEY` / `OPENAI_MODEL` |

With `DEMO_MODE=true` the app runs migrations and the idempotent seed on start-up, so a fresh database is ready with no manual step.

**Frontend — Vercel, Root Directory `frontend`** (`frontend/vercel.json` adds the SPA rewrite). Leave Install/Build/Output overrides empty (Vite defaults: `npm ci`, `npm run build`, `dist`) and set `VITE_API_BASE_URL=https://<render-service>.onrender.com/api/v1`, then redeploy (it is baked in at build time).

(The root-level `vercel.json` only applies if the Vercel Root Directory is left at the repository root.)

## Evaluator scenario (README §13.2)
Landing → Professional Mode → Project Lab → “Use sample project” → analyse → matched equipment → open item → pick a window → request → Demo Approval Desk → approve/reject/propose alternative → My Requests → Scheduling Studio conflict (GPU workstation tomorrow 14:00–16:00) → 3D Campus → same equipment & approval queue → Analytics. A “Guided demo” checklist is available in the app (it never performs actions for you).

## Assumptions & limitations
1. All campus data is fictional sample data. 2. No authentication/roles by design; the Demo Approval Desk is a public simulation, not for real approvals. 3. Requester names/departments are unverified display metadata. 4. Scheduling output is a recommendation based on configured weights. 5. Safety/supervision flags are demo metadata. 6. The 3D campus is a representative low-poly environment using procedural geometry (no third-party assets; see `frontend/public/assets/ASSET_CREDITS.md`). 7. Render free/starter plans may cold-start; the UI shows loading/retry states.
