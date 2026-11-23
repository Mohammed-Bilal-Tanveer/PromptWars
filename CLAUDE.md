# LabLink — project instructions

- Overview: `README.md`; product spec/roadmap: `docs/SPEC.md`; API source of truth: `docs/API_CONTRACT.md`.
- NO login/signup/auth/roles. Keep the public, clearly-labelled Demo Approval Desk.
- Backend (`backend/`, FastAPI + SQLAlchemy) is the single source of truth for availability, bookings, approvals, waitlist, scheduling. Never hardcode availability in React or in the 3D scene.
- SQLite when `DATABASE_URL` is empty, PostgreSQL when set (Render). One ORM/service layer. Avoid N+1 queries (guarded by `backend/tests/test_query_counts.py`).
- OpenAI calls are server-side only; deterministic fallback labelled `demo_fallback`; the LLM never mutates data. Scheduling = OR-Tools CP-SAT. Joining the allocation queue never reserves equipment.
- 2D (Professional) and 3D modes share the same hooks (`frontend/src/hooks/useApi.ts`) and feature components. UI follows the calm light design tokens in `frontend/src/styles/index.css`; status is always icon + text.
- The guided demo never mutates data. "Reset demo scenario" stays OFF by default (`DEMO_RESET_ENABLED=true` opt-in, local use only).
- Keep the repo < 10 MB, no secrets/databases/build output committed. Only `main` is on the remote.
- Checks: `cd frontend && npm run lint && npx vitest run && npm run build` (70 vitest tests in 16 files); `cd backend && ruff check . && pytest -q` (103 pytest tests). Counts last verified on the submission-docs commit; update README and this file together if they change. Not covered: PostgreSQL suite, Playwright, CI.
