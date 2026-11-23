# LabLink — project instructions

- Spec: `README.md` (product + roadmap); API source of truth: `docs/API_CONTRACT.md`.
- NO login/signup/auth/roles. Keep the public, clearly-labelled Demo Approval Desk.
- Backend (`backend/`, FastAPI + SQLAlchemy) is the single source of truth for availability, bookings, approvals, scheduling. Never hardcode availability in React or in the 3D scene.
- SQLite when `DATABASE_URL` is empty, PostgreSQL when set (Render). One ORM/service layer.
- OpenAI calls are server-side only; deterministic fallback labelled `demo_fallback`; the LLM never mutates data. Scheduling = OR-Tools CP-SAT.
- 2D (Professional) and 3D modes share the same hooks (`frontend/src/hooks/useApi.ts`) and feature components.
- Keep the repo < 10 MB, a single `main` branch, no secrets/databases/build output committed.
- Checks: `cd frontend && npm run lint && npx vitest run && npm run build`; `cd backend && ruff check . && pytest -q`.
