# LabLink — AI-Powered Campus Laboratory Resource Sharing

> **Build specification for Claude Code**  
> Frontend: React + Vite + TypeScript  
> Backend: FastAPI + SQLAlchemy  
> Local database: SQLite  
> Hosted database: PostgreSQL on Render  
> AI: OpenAI API (server-side only)  
> Optimisation: Google OR-Tools  
> 3D: Three.js + React Three Fiber + Drei + Zustand + Kenney CC0 assets  
> Deployment: Vercel (frontend) + Render (backend and PostgreSQL)

---

## 0. Instructions to Claude Code — Read Before Writing Code

This README is the product requirements document, technical specification, implementation roadmap, and acceptance checklist for LabLink. Treat it as the source of truth for the project.

### Your operating instructions

1. **Inspect the repository first.** Check the current files, Git state, installed tool versions, and whether any code already exists. Do not overwrite useful existing work without inspection.
2. **Build a functioning application, not a static mock-up.** Every visible primary action must work and connect to application state and, where appropriate, the FastAPI backend and database.
3. **Do not add login, signup, authentication, account creation, or role-based access control.** The hackathon evaluator must be able to open the website and use all demo workflows immediately.
4. **Do not remove the approval workflow.** The application must still demonstrate request review, approval, rejection, and alternative-slot suggestions. These are public demo workflows, not protected faculty/admin roles. Label the section clearly as a demo operations/approval workspace.
5. **Build two connected experiences:** a complete Professional Mode and a game-like 3D Campus Mode. They must use the same data, API services, booking rules, and shared state. The 3D mode must not be a separate toy or a campus-tour-only screen.
6. **The backend is the source of truth** for equipment, availability, requests, approvals, confirmed bookings, and scheduling results. Do not hardcode fake availability in React or in the 3D scene.
7. **Use deterministic business logic for booking and optimisation.** Use the LLM to interpret natural-language project descriptions and explain recommendations. Never let an LLM invent equipment, availability, or silently confirm a booking.
8. **Database selection must be automatic from configuration:** SQLite by default for local development; PostgreSQL when `DATABASE_URL` is supplied by Render. Do not maintain two separate data-access implementations.
9. **Keep secrets on the backend.** Never expose `OPENAI_API_KEY`, database credentials, or secret values through `VITE_*` variables, frontend source, committed files, logs, or API responses.
10. **Use small, optimised 3D assets.** The GitHub repository must remain below 10 MB. Prefer low-poly models, compressed GLB assets, simple procedural geometry, and a graceful fallback scene. Do not commit large videos, texture packs, archives, node_modules, virtual environments, build outputs, or model collections.
11. **Preserve the one-branch submission requirement.** The public GitHub repository must contain only one branch, named `main`. Commit and push directly to `main`. Do not create remote feature branches. If a tool creates temporary local branches, delete them before final submission and verify the remote has only `main`.
12. **Work in short, verifiable increments.** After every major phase, run the relevant tests, lint/build checks, inspect the UI, and fix failures before moving on.
13. **Do not claim a feature is complete until it has been exercised.** A visible button with no real handler is not a completed feature.
14. **Do not ask the user to restate requirements already included here.** Make sensible implementation decisions, document assumptions, and continue. Ask only if an unavailable external credential or irreversible action makes progress impossible.
15. **Keep README and implementation aligned.** Update the implementation status and setup instructions as the application is built.

### Required first action

Create a short implementation plan and task board from this README. Identify the API contract and shared data model before splitting work. Then start the independent workstreams described in Section 17. The team lead owns integration, shared contracts, root configuration, deployment files, final tests, and Git commits.

---

# 1. Product Overview

## 1.1 Product name

**LabLink — Making College Laboratories More Accessible**

**Tagline:** Your Campus. Your Labs. One Connected World.

## 1.2 Problem statement

College laboratories often contain specialised equipment, development kits, and workstations that students from other departments do not know about or cannot easily access. Resource discovery is fragmented, booking processes are manual, schedules conflict, and expensive laboratory resources may remain underutilised.

LabLink is a GenAI-powered campus laboratory resource-sharing platform. It helps students discover specialised equipment across departments, understand which resources fit their projects, request access, find feasible booking slots, and receive transparent scheduling recommendations. It also provides a public demonstration approval workflow and resource-utilisation analytics.

## 1.3 Product goals

- Make equipment across all participating departments discoverable from one place.
- Translate natural-language project descriptions into structured equipment and capability requirements.
- Match project requirements to real equipment records in the database.
- Make equipment availability and booking constraints understandable.
- Accept project-based booking requests.
- Detect scheduling conflicts and recommend fair, feasible alternatives.
- Demonstrate a complete request → review → approval/rejection → confirmed booking workflow.
- Improve resource utilisation through visibility and measurable analytics.
- Make every core function available in both Professional Mode and 3D Campus Mode.
- Deliver a deployable application that can be evaluated without credentials.

## 1.4 Non-goals for this hackathon build

- No login, signup, password reset, authentication, or role-based access control.
- No real university single sign-on or student-record integration.
- No payment processing.
- No real hardware/IoT control of laboratory machines.
- No production-grade identity verification or legally binding approval authority.
- No LLM-controlled database writes or autonomous reservation confirmation.
- No attempt to model an entire real university campus at photorealistic quality.

## 1.5 Core product principle

**One application, two interfaces, one backend, one database.**

Professional Mode is a conventional responsive web application. 3D Campus Mode is an interactive game-like environment with the same capabilities presented through world interactions, HUD panels, kiosks, equipment inspection panels, and in-world workspaces. Both modes use the same React services, shared state, API endpoints, and backend validation.

---

# 2. Hackathon Evaluation and Submission Strategy

The submission rules supplied for this challenge are strict. Treat the following as release blockers.

## 2.1 Repository requirements — mandatory

| Rule | Implementation requirement |
|---|---|
| Maximum two attempts | Validate the application locally and against the live deployment before using a submission attempt. Do not submit a placeholder. |
| Repository below 10 MB | Keep the complete tracked repository comfortably below 10 MB; target below 8 MB to leave a safety margin. |
| Public GitHub repository | The final repository must be public. |
| One branch only | Keep only the `main` branch on the remote. |
| Complete source code | Include the frontend, backend, configs, tests, seed data, and documentation required to run the project. |
| README | Explain vertical, approach, logic, operation, assumptions, and setup. This README covers those requirements. |

### Repository size controls

- Do not commit `node_modules/`, `.venv/`, `venv/`, `dist/`, `build/`, `.next/`, coverage output, caches, logs, or local database files containing runtime data.
- Do not commit `.env` files or API keys.
- Do not commit large downloaded model packs, full texture libraries, videos, screen recordings, or archives.
- Keep only the small subset of Kenney CC0 or other properly licensed assets actually used in the scene.
- Prefer procedural low-poly geometry for buildings, desks, floors, walls, and lab props where it is visually sufficient.
- Optimise GLB models and textures before committing them. Use compressed textures only when supported by the rendering path.
- Add `.gitignore` before installing dependencies or generating local data.
- Do not use Git LFS as a workaround for the repository-size limit unless the organiser explicitly confirms that LFS objects are excluded from the limit.

Before submission, run and inspect:

```bash
git status --short
git branch --all
git count-objects -vH
```

Use PowerShell to estimate working-tree size if needed:

```powershell
(Get-ChildItem -Recurse -File | Where-Object {
  $_.FullName -notmatch '\\(node_modules|\.venv|venv|dist|build|\.git)\\'
} | Measure-Object -Property Length -Sum).Sum / 1MB
```

This working-tree estimate is not the same as GitHub's complete repository storage, so also inspect Git object storage and remote branches.

## 2.2 Public demo and no-auth behaviour

The evaluator must be able to:

1. Open the deployed website.
2. Enter Professional Mode or 3D Campus Mode without registering.
3. Explore departments, laboratories, and equipment.
4. Run project requirement analysis.
5. Compare equipment recommendations.
6. Create a booking request.
7. Open the public Demo Approval Desk and approve/reject the request.
8. Return to either interface and see the updated booking state.
9. Trigger a conflict and view feasible alternatives.
10. Inspect resource analytics.

No hidden route should require a login. Do not create fake login screens, demo credentials, or role selectors.

### Approval workflow without roles

A faculty approval process is part of the problem statement, so retain it as a public, clearly labelled **Demo Approval Desk** or **Operations Desk**. Any evaluator can open it. It demonstrates how an approval queue would behave in a real institution, but it is not security-controlled and must be labelled as a hackathon simulation. Do not describe it as production-secure faculty access.

## 2.3 Evaluation alignment

The challenge description names these review areas:

- Code quality.
- Security and responsible implementation.
- Efficiency.
- Testing.
- Accessibility.
- Problem-statement alignment.
- A smart, dynamic assistant with context-aware logical decisions and practical usability.

The brief supplied by the organiser mentions High, Medium, and Low Impact tags but does not provide a tag beside every criterion in the text pasted here. Therefore, use the following as a **project prioritisation interpretation**, not as a claim about the organiser's exact hidden scoring weights.

| Project priority | What must be demonstrated |
|---|---|
| **High impact — P0** | Project description → structured requirements → real equipment match; live availability; real booking flow; conflict detection; fair/feasible scheduling; complete request approval flow; strong problem-statement alignment. |
| **Medium impact — P1** | Clean modular code; SQLite/PostgreSQL portability; API validation; tests; safe secret handling; responsive and accessible UI; analytics; graceful AI/API failure handling. |
| **Polish — P2** | Rich 3D campus visuals; character animations; sound; advanced transitions; optional NPC dialogue; extra dashboard charts; decorative effects. |

Do not sacrifice the High-impact functional flow to add decorative 3D effects. The 3D experience is a major differentiator, but it must be a working interface to the actual resource-sharing platform.

---

# 3. User Experience and Navigation

## 3.1 Entry screen

The landing page should be polished and immediately interactive. No login modal.

Include:

- LabLink logo/wordmark.
- Short headline and concise product explanation.
- Animated but lightweight gradient background.
- Two large entry cards: **Professional Mode** and **Explore 3D Campus**.
- Quick impact metrics populated from the backend, clearly marked as demo data if seeded.
- A short explanation of the AI project analyser and intelligent scheduling.
- A visible “Explore demo” action.
- A small notice: “Hackathon demonstration using simulated campus data.”

The user must be able to enter either experience with one click.

## 3.2 Professional Mode navigation

Use a consistent side navigation on desktop and a responsive drawer/bottom navigation on smaller screens.

Recommended sections:

1. Overview.
2. Discover Equipment.
3. Project Lab (AI requirement analyser).
4. Booking Calendar.
5. My Requests / Booking Tracker.
6. Scheduling Studio.
7. Demo Approval Desk.
8. Resource Analytics.
9. Campus Explorer (switch to 3D).

Provide a global search or command-style search for equipment and laboratories. Do not put every feature in a crowded top navigation.

## 3.3 3D Campus Mode navigation

The player should be able to move around a campus and enter departments/labs. An unobtrusive HUD must provide access to all the same functional sections, including functions that would otherwise be difficult to reach by walking.

HUD elements:

- LabLink mini-map.
- Current location / department.
- Interaction prompt.
- Quick actions: Search, Project AI, Bookings, Operations Desk, Analytics, Exit 3D.
- Current objective or contextual hint.
- Equipment status legend.
- Pause/settings panel.

The HUD is functional application UI, not a screenshot or decorative mock-up.

## 3.4 Shared feature parity

All important operations must work from both modes:

| Capability | Professional Mode | 3D Campus Mode |
|---|---|---|
| Department discovery | Directory/list/cards | Explore buildings and department kiosks |
| Laboratory discovery | Search/filter/list | Enter laboratory buildings and use lab information panels |
| Equipment discovery | Catalogue/search/filter | Inspect equipment models or use in-world terminal |
| Equipment details | Details drawer/page | World-anchored inspection panel / equipment HUD |
| AI project analysis | Project Lab form | Holographic project terminal with the same form and result components |
| Equipment matching | Recommendation cards | Highlight matching equipment/labs and show a side panel |
| Availability | Calendar/timeline | In-world schedule kiosk / booking panel |
| Booking requests | Booking form | Interact with equipment or kiosk and submit same form |
| Conflict resolution | Scheduling Studio | Holographic scheduling table with the same recommendations |
| Approval workflow | Demo Approval Desk | Operations/approval kiosk with the same actions |
| Notifications | Notification centre/toasts | Same notifications in HUD and shared store |
| Analytics | Dashboard/charts | Campus control centre with the same data |

If the 3D scene cannot render or WebGL is unavailable, show a clear message and provide a one-click return to Professional Mode. Never make the core platform unusable because of a graphics failure.

---

# 4. Detailed Functional Requirements

## 4.1 Campus, departments, and laboratories

Create a seeded campus directory with realistic but fictional demonstration data. Suggested departments:

- Computer Science and AI.
- Electronics and Communication.
- Mechanical Engineering.
- Civil Engineering.
- Biotechnology.

Suggested laboratories:

- AI and Machine Learning Lab.
- GPU Computing Lab.
- Robotics and Embedded Systems Lab.
- Electronics Prototyping Lab.
- IoT and Sensor Lab.
- Mechanical Fabrication Lab.
- 3D Printing Lab.
- Materials Testing Lab.
- Biotechnology Research Lab.

Every laboratory record should include:

- ID and name.
- Department ID.
- Building and floor/room label.
- Description and capabilities.
- Opening hours and operating days.
- Maximum occupancy if relevant.
- Equipment list.
- Access notes and safety restrictions.
- Coordinates/scene anchor for the 3D campus.

Do not claim that the seed records represent a real university. Display a “Sample campus data” or “Demo data” label.

## 4.2 Equipment catalogue

Equipment discovery must support:

- Search by name, category, capability, specification, laboratory, and department.
- Filters for department, lab, category, status, and availability window.
- Sorting by relevance, availability, name, and utilisation.
- Equipment detail view.
- Quantity and individual physical unit tracking.
- Safety/access notes and booking duration constraints.
- Maintenance/unavailable status.
- Compatible project capabilities/tags.
- Recommended alternative equipment.

Use two concepts:

- **Equipment type:** e.g. Arduino Development Kit.
- **Equipment unit:** a physical unit with its own inventory code and booking calendar.

This is necessary because a laboratory may own eight Arduino kits, and multiple kits may be booked simultaneously without double-booking the same physical unit.

Equipment detail fields:

- `id`, `name`, `category`, `description`.
- `department_id`, `laboratory_id`.
- `manufacturer`, `model`, `specifications` JSON.
- `capabilities` string array / tags.
- `quantity_total`, `quantity_available` derived from units and reservations.
- `estimated_setup_minutes`, `min_booking_minutes`, `max_booking_minutes`.
- `requires_supervision`, `safety_notes`, `access_notes`.
- `image_url` or a small local illustration.
- `status` and `maintenance_state`.

Do not store a mutable “available quantity” value that can drift away from bookings. Calculate or reconcile availability from actual units, reservations, and maintenance blocks.

## 4.3 AI Project Requirement Analyser

This is the primary GenAI feature and must be a demonstrable end-to-end workflow.

### Student input

Provide a project form with:

- Project title.
- Free-text project description.
- Project category/domain.
- Project deadline.
- Preferred department(s), optional.
- Preferred date/time window, optional.
- Expected session length or estimated total hours.
- Additional constraints, optional.

Example:

> “I am building an autonomous agricultural monitoring robot. I need to test object detection, integrate sensors, connect a microcontroller, and develop a small physical prototype. My project submission is in two weeks.”

### AI output

The LLM must return structured data validated by Pydantic. The schema should contain:

- Short project summary.
- Identified capabilities (e.g. `computer_vision`, `embedded_systems`, `sensor_integration`, `prototyping`).
- Required equipment concepts.
- Recommended/optional equipment concepts.
- Required lab capabilities.
- Suggested department IDs/names only when they match real records supplied to the model.
- Estimated usage duration and assumptions.
- Safety/access considerations to verify.
- Clarifying questions or missing information.
- Confidence/reasoning summary in concise user-facing language.

Example logical output (illustrative):

```json
{
  "project_summary": "Autonomous agricultural monitoring robot",
  "capabilities": [
    "computer_vision",
    "embedded_systems",
    "sensor_integration",
    "prototyping"
  ],
  "equipment_requirements": [
    {
      "equipment_query": "Raspberry Pi development kit",
      "priority": "required",
      "reason": "Provides the embedded computing platform"
    },
    {
      "equipment_query": "Camera module",
      "priority": "required",
      "reason": "Supports image capture for object detection"
    },
    {
      "equipment_query": "Arduino development kit",
      "priority": "recommended",
      "reason": "Useful for sensor integration and control"
    },
    {
      "equipment_query": "GPU workstation",
      "priority": "recommended",
      "reason": "Can accelerate model training and evaluation"
    }
  ],
  "estimated_total_hours": 8,
  "assumptions": ["Prototype uses a small mobile platform"],
  "clarifying_questions": []
}
```

### AI implementation rules

- Use the OpenAI API from FastAPI only.
- Read the API key from `OPENAI_API_KEY`.
- Read the model name from `OPENAI_MODEL`; do not hardcode it throughout the source code.
- Use strict structured output / JSON Schema when supported by the configured model; validate again using Pydantic.
- Provide the model only the relevant catalogue vocabulary and capability metadata needed for extraction. Avoid sending the entire database unnecessarily.
- The LLM may produce equipment concepts, not authoritative equipment IDs or availability.
- After analysis, a deterministic backend matcher must map the concepts/capabilities to existing database equipment.
- Show the user which requirements are exact matches, partial matches, unavailable, or unmatched.
- Make assumptions visible and editable. Do not present guesses as facts.
- Handle refusal, incomplete output, invalid output, rate limits, timeouts, missing key, and provider errors gracefully.
- Use a bounded timeout and a reasonable input length limit.
- Provide a deterministic demo fallback so the app remains evaluable when no API key is configured or the API is temporarily unavailable. Mark the fallback as “Demo analysis” rather than pretending it was a live LLM response.
- Cache repeated analyses when appropriate using a normalised input hash and a sensible expiry; do not store sensitive raw content unnecessarily.
- Do not give the model tools that directly create bookings, approve requests, or mutate database records.

### Matching after AI analysis

The equipment matcher should:

1. Normalise extracted equipment names and capability tags.
2. Query actual equipment records.
3. Score exact name/category matches higher than capability-only matches.
4. Respect equipment status and lab restrictions.
5. Check availability for the requested window if one was supplied.
6. Return match type, score, evidence, location, and availability.
7. Offer alternatives if exact equipment is unavailable.

The score must be explainable. Example factors: exact equipment-name match, category match, capability overlap, specification compatibility, department/lab suitability, and availability. Do not use opaque LLM confidence as the sole match score.

## 4.4 Booking and reservation workflow

The booking workflow must work against stored records and enforce availability on the backend.

### Request flow

1. User chooses equipment or an AI recommendation.
2. User chooses a date, start time, end time, and expected duration.
3. User enters project title, requester display name, department, and a short purpose.
4. Frontend retrieves availability and validates obvious input errors.
5. Backend re-validates all constraints.
6. Backend creates a booking request with `pending_review` status.
7. Request appears in My Requests and the Demo Approval Desk.
8. On approval, backend checks availability again inside a transaction.
9. If still available, create/activate a confirmed reservation and update status.
10. If no longer available, return a conflict response and send the request back to the scheduling recommendation flow.

### Booking statuses

Use clear statuses such as:

- `pending_review`
- `approved`
- `rejected`
- `alternative_proposed`
- `confirmed`
- `cancelled`
- `completed`
- `expired`

Document the distinction between a request being approved and a time slot being successfully confirmed. An approval must not bypass a final availability check.

### Hard booking constraints

- End time must be after start time.
- Booking must fit the lab operating hours.
- Booking must respect min/max duration and setup/cleanup buffer.
- Equipment unit must be operational and not under maintenance.
- Same physical unit cannot have overlapping confirmed reservations.
- Requests must satisfy safety/supervision restrictions represented in the demo data.
- Booking dates must be valid and not in the past.
- All times must use one documented timezone convention. Store timestamps consistently (prefer UTC in the database) and display in the campus timezone configured by `CAMPUS_TIMEZONE`.

### Availability calculation

Use a backend endpoint that returns free units and available intervals for a requested date/time window. Do not calculate final availability only in React. Use half-open intervals (`[start, end)`) so a booking ending at 12:00 and another starting at 12:00 do not count as overlapping, unless a setup/cleanup buffer applies.

### Concurrency and double-booking safety

- Check availability in the same database transaction that creates/activates a reservation.
- On PostgreSQL, use row-level locking for the relevant equipment units where practical.
- Add database-level safeguards where supported, and retain service-level validation for SQLite compatibility.
- Handle two users requesting the same slot at nearly the same time. One may succeed; the other must receive a clear conflict response and fresh alternatives.
- Never trust a stale availability response from the browser as the final booking decision.

## 4.5 Intelligent conflict resolution and scheduling engine

This is the core algorithmic differentiator. Use Google OR-Tools (CP-SAT or an appropriate scheduling formulation) for feasible allocation. Do not use an LLM as the optimiser.

### Inputs

- Booking requests and their requested windows.
- Project deadline.
- Estimated total equipment hours.
- Equipment unit availability.
- Equipment capabilities and alternatives.
- Laboratory operating hours.
- Maintenance blocks.
- Minimum/maximum booking durations.
- Setup/cleanup buffers.
- Existing confirmed reservations.
- Fairness history (e.g. recently allocated hours and recent successful access count).
- Optional preferred windows.

### Hard constraints

These must never be violated:

1. A physical unit cannot be allocated to overlapping sessions.
2. An allocation must fall within laboratory opening hours.
3. The equipment must be operational and compatible with the request.
4. The requested duration must meet equipment rules.
5. A maintenance window blocks usage.
6. The allocation must not exceed physical unit capacity.
7. Existing confirmed bookings are fixed unless an authorised demo workflow explicitly proposes a change; do not silently displace confirmed users.

### Soft constraints / optimisation goals

Optimise a weighted objective that may consider:

- Project deadline urgency.
- Whether the request has waited longer.
- Fair distribution of equipment hours.
- First-time/recently underserved demo users, where data exists.
- Preference satisfaction.
- Minimising split sessions and inconvenient time changes.
- Maximising utilisation without violating fairness or operating constraints.
- Minimising the number of alternative equipment changes.

Example configurable score (do not treat these example weights as fixed truth):

`priority = 0.40 * deadline_urgency + 0.25 * waiting_time + 0.20 * fairness_adjustment + 0.15 * preference_fit`

Normalise scores to a documented range. Explain the factors in the UI. Avoid protected-characteristic or demographic prioritisation. Do not use a student's name or identity as a priority factor.

### Scheduling output

For every request, return:

- Recommended equipment unit(s).
- Recommended time slots.
- Allocation status: feasible, partially feasible, or infeasible.
- Priority factors and human-readable explanation.
- Conflicts detected.
- Alternative slots/equipment.
- Any assumptions or constraints that prevented a perfect match.

### Fairness and transparency

- Explain why a request was prioritised.
- Show the alternatives considered.
- Avoid a hard-coded claim that the deadline alone always wins.
- Preserve confirmed allocations unless an explicit rescheduling workflow is used.
- Make weights configurable in backend settings, not scattered across files.
- Include unit tests for deadline urgency, fairness tie-breaks, unavailable units, and impossible schedules.

### Human-in-the-loop rule

The solver recommends. The person using the demo workflow reviews and accepts the recommendation. Do not auto-confirm a booking solely because an optimisation solver returned a feasible result.

## 4.6 Demo Approval Desk

This is a public simulation of the faculty approval process. No user role or login is required.

Features:

- List pending booking requests.
- Filter by status, department, equipment, and requested date.
- Open request details including project context and AI requirement analysis.
- View equipment availability and scheduling recommendation.
- Approve a request.
- Reject with a required reason.
- Propose an alternative time or compatible equipment.
- Add a short reviewer note.
- View an audit timeline of actions.
- Show updated status immediately in the booking tracker and 3D scene.

The approval action must be an actual backend mutation. Use clear confirmation UI for actions that change stored data.

Because the demo is unauthenticated and public, clearly state that it is a simulated reviewer workflow and must not be used for real institutional approvals. Do not store real sensitive data in it.

## 4.7 AI Scheduling Assistant

Provide an assistant panel that answers questions grounded in current application data. Example:

- “Why is this GPU workstation unavailable?”
- “What are the earliest alternatives for my project?”
- “Which lab has equipment for embedded systems?”
- “Why was this request suggested for a different slot?”

The assistant should:

1. Identify the relevant equipment/request/project context.
2. Retrieve current facts from backend services.
3. Generate a concise explanation grounded in those facts.
4. Cite the equipment/request IDs or show the relevant cards in the UI.
5. Offer available actions through normal frontend controls.

Do not allow chat text to bypass booking validation. A natural-language instruction such as “book this now” should create a suggested action that the user explicitly confirms through the booking form.

If the LLM is unavailable, show a small set of deterministic contextual explanations and links to the relevant UI.

## 4.8 Notifications and booking tracker

Provide in-app notifications for:

- Request submitted.
- Request approved or rejected.
- Alternative slot proposed.
- Booking confirmed.
- Booking approaching.
- Booking cancelled or completed.
- Equipment marked under maintenance.

Implement persisted notifications in the database and update the UI after successful mutations. For the first working version, use normal API refresh/polling or a simple event mechanism. Add WebSockets only if time remains and the deployment setup supports it reliably.

Optional email notifications may be added behind environment configuration, but they are not a P0 requirement. Do not block the core workflow on an email provider.

## 4.9 Analytics dashboard

All metrics must derive from database records, not hardcoded demonstration numbers.

Recommended metrics:

- Total equipment units.
- Available/occupied/maintenance units.
- Active confirmed bookings.
- Pending requests.
- Approval/rejection counts.
- Utilisation by department and laboratory.
- Most frequently requested equipment.
- Underutilised equipment.
- Peak hours.
- Average request review time.
- Booking conflict count and alternative acceptance rate.

Label charts as demonstration analytics when backed by seeded sample data. Use accessible chart labels and provide a table/list alternative for important data.

## 4.10 Maintenance and operational state

Allow the demo interface to mark an equipment unit as:

- Operational.
- Under maintenance.
- Temporarily unavailable.

Maintenance windows must immediately affect availability and scheduling. If a maintenance window overlaps a pending request, surface the conflict and propose alternatives. Do not silently cancel confirmed bookings; show a rescheduling workflow.

---

# 5. Full 3D Experience Specification

## 5.1 Vision

Build **LabLink 3D Campus Explorer** as an explorable low-poly university environment. The user controls a small character and can visit departments, enter laboratories, inspect 3D equipment, interact with an AI project terminal, book equipment, inspect scheduling conflicts, and visit the demo operations/approval centre.

This is not a separate mini-game. It is an alternate user interface for the same LabLink platform.

## 5.2 Recommended libraries

- `three` — WebGL 3D rendering.
- `@react-three/fiber` — React renderer for Three.js.
- `@react-three/drei` — controls, loaders, `<Html>`, helpers, and useful primitives.
- `zustand` — shared UI/game state.
- `@react-three/rapier` — physics and collision detection if it remains stable and lightweight enough for the scope.
- `@react-three/postprocessing` — optional subtle post-processing; do not make it a performance requirement.
- GLTF/GLB models — compact assets.
- `@use-gesture/react` only if useful for touch interactions.

Use compatible versions and commit the lockfile. Do not install overlapping libraries for the same job without a clear reason.

## 5.3 Kenney CC0 and asset rules

Use selected assets from the official Kenney asset library: https://kenney.nl/assets

Possible asset categories:

- Mini characters.
- Nature/trees/landscape.
- Buildings and modular structures.
- Furniture.
- Props and simple technology objects.

Confirm the licence for each downloaded pack and preserve the applicable attribution/licence information in `frontend/public/assets/ASSET_CREDITS.md` or a root `ASSET_CREDITS.md`.

Not every laboratory device will have a suitable Kenney model. For missing specialised objects, use one of these options:

1. Build a low-poly representation with Three.js primitives.
2. Use a small properly licensed model with attribution.
3. Use an icon/illustration in the equipment panel while keeping the 3D interaction anchor.

Never download and commit a complete asset bundle just because it is available. Select only the models actually used.

## 5.4 Campus environment

Build a compact scene with clear landmarks:

- Main entrance/plaza.
- Computer Science & AI building.
- Electronics building.
- Mechanical/Civil building.
- Biotechnology building.
- Garden/pathways and a few campus props.
- Information kiosk.
- Operations/approval centre.

Use low-poly geometry, baked/simple lighting where appropriate, shared materials, and modest draw calls. The environment should feel cohesive and navigable, not like unrelated models placed randomly.

## 5.5 Character controls

Desktop:

- W/A/S/D or arrow keys for movement.
- Shift to run (optional).
- Mouse drag or pointer lock for camera look, with a visible hint and an accessible alternative.
- E to interact.
- Esc to close the active panel or pause.

Mobile/tablet:

- On-screen movement pad or joystick.
- A clear interaction button.
- Touch-friendly camera controls.
- HUD controls remain usable without precision gestures.

Movement requirements:

- Character stays on walkable ground.
- Collisions prevent walking through buildings and large obstacles.
- Camera follows smoothly without clipping badly through walls.
- Character animation switches between idle/walk/run if suitable animations exist; otherwise use simple procedural animation.
- Do not make animation quality a blocker for core interactions.

## 5.6 Interaction system

Use a reusable interaction registry, not hard-coded click logic scattered through each model.

Each interactive object should expose:

- Stable interaction ID.
- Type: department, laboratory, equipment, kiosk, AI terminal, booking terminal, operations desk, or analytics centre.
- World position and interaction radius.
- Display label and prompt.
- Callback/action descriptor.
- Optional associated database record ID.

When the player enters an interaction radius:

1. Detect the nearest valid object.
2. Show a prompt such as “Press E to inspect GPU Workstation”.
3. On interaction, open the corresponding shared React panel/modal/drawer.
4. Fetch any necessary data from the backend.
5. Use normal form validation and mutation services.
6. Update the shared Zustand state after a successful API response.

Do not store authoritative equipment status directly inside the GLTF or scene model.

## 5.7 3D application environments

### A. Campus Plaza

- Spawn location.
- Welcome sign and wayfinding.
- Building labels.
- Campus minimap.
- Quick navigation to the functional centres.

### B. Department Buildings

Approaching a department opens a floating panel with:

- Department name and description.
- Laboratory count.
- Total and available equipment units.
- Current utilisation.
- Enter department / view labs action.

### C. Laboratory Interiors

At minimum, build one fully explorable laboratory interior for the main demonstration and simple accessible representations for other labs. Include desks, equipment locations, signs, lighting, and navigation markers.

Equipment models should have interaction IDs linked to equipment records. When equipment is unavailable or under maintenance, communicate this visually using a status indicator and text label; do not rely on colour alone.

### D. AI Project Terminal

A holographic/interactive terminal that opens the same Project Lab form used in Professional Mode. After analysis:

- Show extracted capabilities.
- Show required vs recommended equipment.
- Highlight matching equipment/labs in the world or minimap.
- Provide a “View match” action that navigates to the corresponding equipment.
- Display unmatched requirements and assumptions honestly.

### E. Booking and Scheduling Hub

A futuristic scheduling terminal / holographic timeline that uses the same booking and scheduling endpoints. It should show:

- Equipment selection.
- Date and slot availability.
- Booked vs free intervals.
- Conflicts.
- Recommended alternatives.
- Request confirmation.

### F. Operations / Approval Centre

A visible, accessible in-world location that opens the same Demo Approval Desk. Users can review pending requests, approve/reject, or propose alternatives. Do not require login or role switching.

### G. Resource Analytics Centre

Show a 3D control-room style environment with summary tiles, resource utilisation, and department comparisons. The same chart/table data should be used by Professional Mode.

## 5.8 In-world UI and accessibility

- Use Drei `<Html>` or normal React overlays for readable forms and data tables.
- Do not put long text directly into 3D meshes.
- Keep interactive controls large enough for touch and keyboard users.
- All interaction must have a keyboard-accessible alternative.
- Respect `prefers-reduced-motion` and provide settings to reduce camera movement/effects.
- Provide a skip-to-dashboard / exit-3D control at all times.
- Do not rely exclusively on audio, colour, animation, or spatial location to communicate important information.
- Ensure focus is managed when an HTML panel opens and returns to the canvas when it closes.

## 5.9 Performance requirements

- Lazy-load the 3D route and heavy assets; Professional Mode should load without waiting for the 3D scene.
- Use compressed and appropriately sized GLB models.
- Use instancing for repeated trees/props where sensible.
- Reuse geometries and materials.
- Avoid excessive real-time shadows and post-processing.
- Provide quality settings: Auto, Low, High.
- Pause or reduce render work when the browser tab is hidden or the 3D mode is not active.
- Detect WebGL failure and show a helpful fallback.
- Do not allow a huge asset to push the GitHub repository beyond the size constraint.

---

# 6. Visual Design System

## 6.1 Design direction

Create a modern, polished, multi-colour interface. Avoid using one colour heavily across every section. The visual language should feel like a premium university technology product with subtle game-inspired elements.

Use a balanced combination of:

- Deep navy / blue-black for strong surfaces and dark mode.
- Indigo and violet for AI features.
- Cyan and teal for availability and live resource indicators.
- Magenta / pink as a controlled accent for creative project areas.
- Amber / orange for urgency, warnings, and scheduling conflict states.
- Green for success and confirmed availability.
- Neutral slate/white surfaces for readability.

## 6.2 Suggested gradient palette

Use these as design tokens, not as a requirement to put a gradient on every component:

| Use | Example gradient |
|---|---|
| Brand / hero | `#2563EB → #7C3AED → #C026D3` |
| AI / project analysis | `#7C3AED → #DB2777` |
| Availability / live status | `#06B6D4 → #0D9488` |
| Scheduling / focus | `#4F46E5 → #0EA5E9` |
| Analytics / growth | `#0F766E → #84CC16` |
| Warning / deadline | `#F59E0B → #F97316` |
| Secondary creative accent | `#EC4899 → #8B5CF6` |

Guidelines:

- Use gradients in hero areas, selected cards, section headers, badges, charts, and 3D holographic panels.
- Give different feature groups their own related accent family to avoid monotony.
- Use mostly solid or subtly tinted surfaces for tables and dense forms.
- Maintain readable foreground contrast on every gradient.
- Do not use a gradient as the only status indicator.
- Avoid excessive glow, blur, glassmorphism, and drop shadows that reduce text clarity.
- Support dark-first design and a sensible light theme if time allows.

## 6.3 Component styling

Create a consistent component library for:

- Buttons (primary, secondary, ghost, danger).
- Gradient feature cards.
- Status chips.
- Search fields and filter dropdowns.
- Tables and mobile cards.
- Date/time selection.
- Booking timeline.
- Equipment detail panel.
- AI recommendation panel.
- Scheduling recommendation card.
- Approval action bar.
- Empty, loading, and error states.
- Toasts and notification centre.
- Modal/drawer/sheet.

Do not create one-off styles for every page. Use tokens and reusable components.

## 6.4 Responsive behaviour

Support:

- Desktop widescreen.
- Laptop.
- Tablet.
- Mobile.

On mobile, large tables must become cards or scrollable regions. The 3D controls must be touch-friendly. The Professional Mode must remain the reliable fallback for devices with weak graphics performance.

---

# 7. Technical Architecture

## 7.1 High-level structure

```text
lablink/
├── frontend/                 # React + Vite + TypeScript
├── backend/                  # FastAPI + SQLAlchemy
├── docs/                     # API contract, test plan, implementation notes
├── .claude/agents/           # Optional focused Claude Code agents
├── .gitignore
├── .env.example
├── CLAUDE.md                 # Persistent project instructions for Claude Code
├── README.md
├── render.yaml
└── vercel.json
```

## 7.2 Frontend stack

- React.
- Vite.
- TypeScript (preferred for maintainability and shared API contracts).
- Tailwind CSS.
- shadcn/ui or a small consistent component set.
- React Router.
- Zustand.
- TanStack Query for server state/cache (recommended) or one consistent equivalent.
- Axios or `fetch` wrapper for API calls.
- React Hook Form + Zod for forms if useful.
- Recharts or another lightweight chart library.
- Three.js, React Three Fiber, Drei, and optionally Rapier for the 3D world.
- Vitest + React Testing Library.
- Playwright for essential browser-level flows if time allows.

Do not put server data permanently in Zustand when a query cache is more appropriate. Use Zustand for app/game state (mode, active panel, player position, filters if shared) and a query library for API-backed state.

## 7.3 Backend stack

- Python 3.12+.
- FastAPI.
- Uvicorn.
- Pydantic v2.
- SQLAlchemy 2.x.
- Alembic migrations.
- SQLite local driver.
- PostgreSQL driver (`psycopg` v3 recommended).
- OpenAI Python SDK.
- Google OR-Tools.
- pytest + HTTPX.
- Ruff for linting/formatting (or an equivalent consistent tool).

Keep dependencies pinned with compatible version ranges and commit the relevant lockfile. Avoid adding heavyweight dependencies without a clear requirement.

## 7.4 Backend module boundaries

Recommended backend structure:

```text
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── logging.py
│   │   └── errors.py
│   ├── models/
│   │   ├── department.py
│   │   ├── laboratory.py
│   │   ├── equipment.py
│   │   ├── equipment_unit.py
│   │   ├── project.py
│   │   ├── project_requirement.py
│   │   ├── booking_request.py
│   │   ├── booking.py
│   │   ├── approval.py
│   │   ├── maintenance.py
│   │   ├── notification.py
│   │   └── audit_event.py
│   ├── schemas/
│   ├── api/
│   │   ├── router.py
│   │   └── routes/
│   │       ├── health.py
│   │       ├── campus.py
│   │       ├── departments.py
│   │       ├── laboratories.py
│   │       ├── equipment.py
│   │       ├── projects.py
│   │       ├── ai.py
│   │       ├── availability.py
│   │       ├── bookings.py
│   │       ├── scheduling.py
│   │       ├── approvals.py
│   │       ├── analytics.py
│   │       ├── notifications.py
│   │       └── maintenance.py
│   ├── services/
│   │   ├── ai_service.py
│   │   ├── equipment_matcher.py
│   │   ├── availability_service.py
│   │   ├── booking_service.py
│   │   ├── scheduling_service.py
│   │   ├── approval_service.py
│   │   ├── analytics_service.py
│   │   └── notification_service.py
│   ├── seed/
│   │   └── demo_data.py
│   └── utils/
├── alembic/
├── tests/
├── requirements.txt
├── alembic.ini
└── .env.example
```

## 7.5 Frontend module boundaries

Recommended frontend structure:

```text
frontend/
├── public/
│   └── assets/
│       ├── models/
│       ├── textures/
│       └── ASSET_CREDITS.md
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── feedback/
│   │   └── shared/
│   ├── features/
│   │   ├── landing/
│   │   ├── dashboard/
│   │   ├── campus/
│   │   ├── laboratories/
│   │   ├── equipment/
│   │   ├── projects/
│   │   ├── ai-assistant/
│   │   ├── bookings/
│   │   ├── scheduling/
│   │   ├── approvals/
│   │   ├── analytics/
│   │   └── explorer3d/
│   │       ├── scene/
│   │       ├── character/
│   │       ├── interactions/
│   │       ├── environments/
│   │       ├── hud/
│   │       └── stores/
│   ├── services/
│   │   ├── apiClient.ts
│   │   ├── campusService.ts
│   │   ├── equipmentService.ts
│   │   ├── projectService.ts
│   │   ├── bookingService.ts
│   │   ├── schedulingService.ts
│   │   ├── approvalService.ts
│   │   └── analyticsService.ts
│   ├── stores/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   └── styles/
├── package.json
├── vite.config.ts
└── .env.example
```

Adapt the structure where the existing repository or chosen tooling warrants it, but preserve clear separation between features and shared services.

---

# 8. Database Design

## 8.1 No account/auth tables

Do not implement `users`, passwords, roles, login sessions, or access-control policies. This application is intentionally unauthenticated for evaluation.

A booking request can capture a lightweight requester display name and department selection. This is demo metadata, not a verified identity.

## 8.2 Core entities

### `departments`

- `id` (UUID/string primary key).
- `name`.
- `slug`.
- `description`.
- `building_code`.
- `scene_position_x`, `scene_position_y`, `scene_position_z` (or a structured position field).
- `created_at`, `updated_at`.

### `laboratories`

- `id`.
- `department_id` FK.
- `name`, `code`, `description`.
- `building`, `floor`, `room_number`.
- `opening_hours` JSON or normalised schedule representation.
- `operating_days`.
- `capabilities`.
- `scene_position` and optional scene anchor ID.
- `status`.

### `equipment_types`

- `id`.
- `name`, `category`, `description`.
- `department_id` FK and/or owning `laboratory_id` FK.
- `manufacturer`, `model`.
- `specifications` JSON.
- `capabilities` JSON/string tags.
- `min_booking_minutes`, `max_booking_minutes`, `setup_minutes`, `cleanup_minutes`.
- `requires_supervision`, `safety_notes`, `access_notes`.
- `image_url` or local asset key.

### `equipment_units`

- `id`.
- `equipment_type_id` FK.
- `inventory_code` unique.
- `unit_name`.
- `status` (`operational`, `maintenance`, `unavailable`).
- `condition_notes`.
- `scene_object_id` for mapping to a 3D model/anchor.

### `projects`

- `id`.
- `title`, `description`, `category`.
- `requester_name`.
- `requester_department_id` FK.
- `deadline` nullable.
- `estimated_total_hours`.
- `analysis_source` (`openai`, `demo_fallback`, `manual`).
- `analysis_json`.
- `created_at`, `updated_at`.

### `project_requirements`

- `id`.
- `project_id` FK.
- `requirement_name`.
- `priority` (`required`, `recommended`, `optional`).
- `capability_tag` nullable.
- `reason`.
- `matched_equipment_type_id` nullable FK.
- `match_status` (`exact`, `partial`, `unavailable`, `unmatched`).

### `booking_requests`

- `id`.
- `project_id` FK.
- `requester_name`.
- `requester_department_id` FK.
- `equipment_type_id` FK.
- `requested_unit_id` nullable FK.
- `requested_start_at`, `requested_end_at`.
- `estimated_hours`.
- `purpose`.
- `status`.
- `priority_score` and/or priority component JSON.
- `review_note` nullable.
- `created_at`, `updated_at`.

### `bookings`

- `id`.
- `booking_request_id` FK.
- `equipment_unit_id` FK.
- `start_at`, `end_at`.
- `status` (`confirmed`, `cancelled`, `completed`).
- `approved_at` nullable.
- `created_at`, `updated_at`.

### `approvals`

- `id`.
- `booking_request_id` FK.
- `action` (`approved`, `rejected`, `alternative_proposed`).
- `reviewer_display_name` (e.g. “Demo Lab Coordinator”).
- `note`.
- `created_at`.

This is an audit record for the public demo workflow, not a verified faculty identity.

### `maintenance_windows`

- `id`.
- `equipment_unit_id` FK.
- `start_at`, `end_at`.
- `reason`.
- `status`.

### `notifications`

- `id`.
- `title`, `message`, `type`.
- `related_entity_type`, `related_entity_id`.
- `is_read`.
- `created_at`.

### `audit_events`

- `id`.
- `event_type`.
- `entity_type`, `entity_id`.
- `description`.
- `metadata` JSON.
- `created_at`.

Avoid recording secret values or unnecessary personally identifiable data in audit metadata.

## 8.3 Database integrity

- Use foreign keys and indexes for common lookup fields.
- Index equipment/lab/department relations and booking date ranges.
- Use database transactions for approval and booking confirmation.
- Validate overlapping intervals in backend services for both SQLite and PostgreSQL.
- Add PostgreSQL-specific exclusion constraints only if migrations and local compatibility are carefully handled; do not make the app depend on an extension that is unavailable in SQLite.
- All stored timestamps should be timezone-aware and normalised consistently.
- Use Alembic migrations. Do not rely on `create_all()` as the only production schema management approach.

---

# 9. SQLite Locally and PostgreSQL on Render

This requirement is important: use one SQLAlchemy model/service layer and select the database through configuration.

## 9.1 Desired behaviour

- Local developer machine with no `DATABASE_URL`: use SQLite, e.g. `sqlite:///./lablink.db`.
- Render deployment with `DATABASE_URL` supplied by the Render Blueprint: connect to PostgreSQL automatically.
- Tests: use a temporary SQLite database or a dedicated test database configured by the test environment.
- The application code must not contain `if local then SQLite model else Postgres model` branching in each endpoint.

## 9.2 Configuration logic

In `backend/app/core/config.py`:

- Read `DATABASE_URL` from environment.
- If missing, default to `sqlite:///./lablink.db`.
- Normalise Render's PostgreSQL URL format if needed (for example, convert `postgres://` to `postgresql+psycopg://` when using psycopg 3).
- Do not log the full database URL.

In `database.py`:

- Create a single SQLAlchemy engine and session factory.
- Apply `connect_args={"check_same_thread": False}` only for SQLite.
- Enable SQLite foreign keys and a reasonable busy timeout via connection setup.
- Use the normal PostgreSQL driver path when the URL is PostgreSQL.
- Provide a dependency that yields/closes a session safely.

The same ORM models, repositories, services, routes, and business validation must work with both databases.

## 9.3 Local setup

The README must give a simple path:

```bash
cd backend
python -m venv .venv
# Activate the environment, then:
pip install -r requirements.txt
alembic upgrade head
python -m app.seed.demo_data
uvicorn app.main:app --reload --port 8000
```

When `DATABASE_URL` is absent, SQLite should be selected automatically. Do not require the user to install PostgreSQL locally.

---

# 10. API Contract

Use a versioned API prefix such as `/api/v1`. Return predictable Pydantic response schemas and consistent error objects.

## 10.1 Health and configuration

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Liveness/health response including app version; do not expose secrets. |
| GET | `/api/v1/health/ready` | Check database connectivity and readiness. |
| GET | `/api/v1/config/public` | Safe public feature flags only, e.g. AI configured/not configured and demo mode. Never return API keys. |

## 10.2 Campus directory

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/departments` | List departments with summary counts. |
| GET | `/api/v1/departments/{id}` | Department details. |
| GET | `/api/v1/laboratories` | List/search/filter laboratories. |
| GET | `/api/v1/laboratories/{id}` | Laboratory details and resource summary. |

## 10.3 Equipment

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/equipment` | Search, filter, sort, paginate equipment types. |
| GET | `/api/v1/equipment/{id}` | Equipment details and units summary. |
| GET | `/api/v1/equipment/{id}/units` | Physical units and operational status. |
| GET | `/api/v1/equipment/{id}/availability` | Availability for a date/time range. |
| GET | `/api/v1/equipment/recommendations` | Deterministic recommendations for capability tags/project needs. |

## 10.4 Projects and AI

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/projects/analyse` | Analyse project text and return structured requirements + real catalogue matches. |
| POST | `/api/v1/projects` | Save a project and its requirement data. |
| GET | `/api/v1/projects/{id}` | Retrieve project and analysis. |
| GET | `/api/v1/projects` | List demo projects. |
| POST | `/api/v1/assistant/message` | Context-grounded assistant response; no direct booking/approval mutation. |

Use the spelling `analyse` consistently or choose `analyze` consistently; do not create both accidentally.

## 10.5 Booking requests and bookings

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/booking-requests` | Submit a booking request. |
| GET | `/api/v1/booking-requests` | List requests with filters. |
| GET | `/api/v1/booking-requests/{id}` | Request details and timeline. |
| POST | `/api/v1/booking-requests/{id}/cancel` | Cancel a pending/eligible request. |
| GET | `/api/v1/bookings` | List confirmed bookings. |
| GET | `/api/v1/bookings/{id}` | Booking details. |
| POST | `/api/v1/bookings/{id}/cancel` | Cancel an eligible booking. |

## 10.6 Scheduling and approvals

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/scheduling/recommendations` | Run the optimiser for selected requests/window. |
| GET | `/api/v1/scheduling/conflicts` | Retrieve current conflicts. |
| GET | `/api/v1/approvals/queue` | Public demo approval queue. |
| POST | `/api/v1/approvals/{request_id}/approve` | Approve and attempt final transactional confirmation. |
| POST | `/api/v1/approvals/{request_id}/reject` | Reject with a reason. |
| POST | `/api/v1/approvals/{request_id}/alternative` | Propose an alternative slot/equipment. |

## 10.7 Analytics, notifications, and maintenance

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/analytics/overview` | Summary metrics. |
| GET | `/api/v1/analytics/utilisation` | Utilisation by lab/department/equipment. |
| GET | `/api/v1/analytics/trends` | Booking and usage trends. |
| GET | `/api/v1/notifications` | List notifications. |
| POST | `/api/v1/notifications/{id}/read` | Mark notification read. |
| POST | `/api/v1/maintenance` | Add a demo maintenance window. |
| GET | `/api/v1/maintenance` | List maintenance windows. |

Adjust names as needed, but preserve the underlying capabilities and keep API naming consistent.

## 10.8 API error format

Use a consistent error response, e.g.:

```json
{
  "error": {
    "code": "SLOT_CONFLICT",
    "message": "This equipment unit is no longer available for the selected time.",
    "details": {
      "request_id": "...",
      "suggestion_available": true
    }
  }
}
```

Use suitable HTTP statuses: 400 for invalid input, 404 for missing records, 409 for booking conflicts, 422 for schema/validation errors where appropriate, 429 for rate limiting, and 500 only for unexpected failures. Never return stack traces or secrets to the browser.

---

# 11. Environment Variables and Secrets

## 11.1 Root/backend `.env.example`

Create an example file containing placeholder values only:

```dotenv
APP_ENV=development
APP_NAME=LabLink API
API_PREFIX=/api/v1
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_SECONDS=25
OPENAI_MAX_INPUT_CHARS=8000
CAMPUS_TIMEZONE=Asia/Kolkata
FRONTEND_ORIGIN=http://localhost:5173
DEMO_MODE=true
LOG_LEVEL=INFO
```

`OPENAI_MODEL` is configurable because model availability can vary by account and change over time. The example is a cost-conscious starting point; use a model enabled for the supplied API key and supporting the chosen structured-output method.

## 11.2 Frontend `.env.example`

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_APP_MODE=demo
```

Only public configuration belongs in `VITE_*` variables. The OpenAI key must never be placed here.

## 11.3 Secret handling

- Add `.env`, `.env.*` (except `.env.example`), database files, and private keys to `.gitignore`.
- Do not print environment variables in debug output.
- Do not return secret configuration through a public config endpoint.
- Keep all LLM requests in the FastAPI service.
- Validate user-provided content and keep model input bounded.
- Do not give the LLM unrestricted tools or direct database access.
- Use CORS with explicit local and production frontend origins; do not use wildcard origins in production when credentials/cookies are involved (this app should not need authentication cookies).
- Apply a sensible rate limit to expensive AI endpoints.
- Use a safe fallback if the key is missing or a provider request fails.

---

# 12. Deployment Requirements

## 12.1 Deployment topology

```text
Browser
  |
  | HTTPS
  v
Vercel — React/Vite static frontend
  |
  | HTTPS REST API requests
  v
Render — FastAPI web service
  |
  | DATABASE_URL supplied by Render
  v
Render PostgreSQL

FastAPI service
  |
  | Server-side HTTPS request using OPENAI_API_KEY
  v
OpenAI API
```

## 12.2 Render deployment

Create `render.yaml` at the repository root. The following is a baseline blueprint; keep the service and database in the same Render region and confirm the current plan names/pricing in the Render dashboard before deployment.

```yaml
services:
  - type: web
    name: lablink-api
    runtime: python
    plan: starter
    region: singapore
    buildCommand: pip install -r backend/requirements.txt
    startCommand: cd backend && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /api/v1/health/ready
    envVars:
      - key: PYTHON_VERSION
        value: 3.12.5
      - key: APP_ENV
        value: production
      - key: API_PREFIX
        value: /api/v1
      - key: DATABASE_URL
        fromDatabase:
          name: lablink-db
          property: connectionString
      - key: OPENAI_API_KEY
        sync: false
      - key: OPENAI_MODEL
        value: gpt-4o-mini
      - key: OPENAI_TIMEOUT_SECONDS
        value: "25"
      - key: CAMPUS_TIMEZONE
        value: Asia/Kolkata
      - key: FRONTEND_ORIGIN
        sync: false
      - key: DEMO_MODE
        value: "true"

databases:
  - name: lablink-db
    databaseName: lablink
    user: lablink
    plan: basic-256mb
    region: singapore
```

Implementation notes:

- If the selected Render region or plan is unavailable for the account, choose an available region/plan and keep both services in the same region.
- Render's `DATABASE_URL` must be consumed by the app automatically. Do not manually paste database credentials into source code.
- Confirm that the chosen PostgreSQL plan has persistent storage and is suitable for the demo. Pricing, availability, and free-plan restrictions can change.
- The app must use SQLite locally without requiring Render environment variables.
- The migration command must be safe to rerun. Never delete or recreate a production database on every startup.
- If the platform does not support `preDeployCommand` for the selected plan, keep migrations in the controlled start/deploy process as above or run them through the supported deployment command. Avoid racing multiple replicas with the same migration operation.
- Set `FRONTEND_ORIGIN` to the exact deployed Vercel origin.
- Configure the Render health endpoint to check database readiness without exposing credentials.
- Do not store uploaded files on the ephemeral service filesystem. This MVP can use small local static assets; future uploads require object storage.

## 12.3 Vercel deployment

Create `vercel.json` at the repository root or frontend project root according to the configured Vercel Root Directory. Recommended if the repository root is the Vercel project root and the frontend lives under `/frontend`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd frontend && npm ci && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm ci",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

If Vercel's Root Directory is set directly to `frontend`, simplify `vercel.json` and use `dist` as the output directory. Do not accidentally configure both a frontend root directory and root-relative build paths that conflict.

Vercel environment variable:

```dotenv
VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com/api/v1
```

Use the real Render service URL in the Vercel dashboard. The placeholder must not remain in production.

## 12.4 CORS

The FastAPI app should allow:

- Local Vite origin (`http://localhost:5173`).
- The exact production Vercel domain.
- Any explicitly configured preview domain only when needed for evaluation.

Use the configured comma-separated allowlist if multiple origins are required. Do not hardcode an unknown deployment domain.

## 12.5 Render cold starts and live demo reliability

If using a Render plan that spins down when idle, the first API request may be delayed. For a timed hackathon demonstration, use an always-on plan if the budget permits, and warm the health endpoint before the demonstration. Never make the frontend appear broken during a cold start: show a loading state, retry safely, and provide demo data only when the backend explicitly returns a fallback/demo state. Do not silently fabricate a successful booking when the backend is unavailable.

---

# 13. Seed Data and Evaluator Demo Scenario

## 13.1 Seed data

Create an idempotent seed command. Running it multiple times must not create duplicate departments, labs, or equipment.

Seed at least:

- 5 departments.
- 8–10 laboratories.
- 15–25 equipment types.
- 25–40 individual equipment units, with several units per common equipment type.
- A small number of existing bookings.
- A few pending requests.
- A maintenance example.
- Example projects representing AI, robotics, embedded systems, mechanical design, and biotechnology.

Use realistic but fictional campus data. Avoid storing real student details.

Important equipment examples:

- GPU workstation.
- Raspberry Pi kit.
- Arduino development kit.
- Camera module.
- Oscilloscope.
- FPGA development board.
- Robotics kit.
- 3D printer.
- CNC workstation (demo representation only).
- Digital microscope.
- Centrifuge (demo representation only).
- Materials testing apparatus.

Generate time-relative demo slots based on the current date and configured campus timezone. Do not seed only dates that may be in the past by the time the evaluator opens the application.

## 13.2 Required evaluator scenario

The product must support this demonstration without manual database editing:

1. Open the home page.
2. Choose Professional Mode.
3. Open Project Lab.
4. Enter the sample agricultural robotics project description.
5. Run AI analysis (or explicitly labelled deterministic fallback).
6. See required/recommended equipment and capability tags.
7. See actual matches from the seeded equipment catalogue.
8. Open one matched equipment item.
9. Select a date and time window.
10. Submit a booking request.
11. Open the Demo Approval Desk.
12. Review the request and its project details.
13. Approve it if still feasible, or reject/propose an alternative.
14. Confirm the state updates in My Requests and the equipment availability.
15. Open Scheduling Studio and inspect a conflict scenario with alternatives.
16. Switch to 3D Campus Mode.
17. Walk to the relevant department/laboratory and inspect the same equipment record.
18. Verify the booked/unavailable state is reflected in the 3D interaction panel.
19. Visit the 3D operations centre and verify the same approval queue is shown.
20. Open analytics and verify counts reflect stored records.

Provide a visible “Try guided demo” path that can point the evaluator through the key actions. It should not auto-complete all actions or pretend they were performed.

---

# 14. Testing and Quality Assurance

Testing is an evaluation criterion. Do not leave it until the end.

## 14.1 Backend tests

Use pytest and HTTPX. At minimum test:

### Database/configuration

- SQLite is selected when `DATABASE_URL` is absent.
- PostgreSQL URLs are parsed/normalised correctly (use unit tests; a live Postgres instance is optional in the fast test suite).
- SQLite foreign keys are enabled.
- Alembic migrations can create a fresh test schema.

### Equipment

- Search returns expected records.
- Department/lab/category filters work together.
- Maintenance units are excluded from available counts.
- Quantity derives from physical units and active bookings.

### AI

- LLM client is called through a mocked provider in tests.
- Structured output is parsed and validated.
- Invalid or missing fields are handled safely.
- Provider timeout/rate-limit/key-missing cases trigger deterministic fallback or a clear error.
- Unmatched equipment requirements are shown as unmatched rather than fabricated.

### Booking and concurrency

- Invalid date/time ranges are rejected.
- Requests outside lab operating hours are rejected.
- Maintenance windows block booking.
- Overlapping bookings on the same unit are rejected.
- Adjacent non-overlapping slots work when no buffer applies.
- A booking cannot be confirmed if availability changes after request creation.
- Two competing attempts cannot both confirm the same unit/time.
- Cancellation updates availability correctly.

### Scheduling

- Solver respects every hard constraint.
- Deadline urgency affects recommendations as configured.
- Fairness tie-breaks behave as documented.
- Existing confirmed bookings are not silently displaced.
- Infeasible scenarios return clear reasons and alternatives where possible.
- Solver time is bounded for the demo dataset.

### Approval and analytics

- Approval creates an audit record.
- Rejection requires a reason.
- Alternative proposal updates the request correctly.
- Approval performs a fresh availability check.
- Analytics reflect newly created and approved bookings.

## 14.2 Frontend tests

Use Vitest and React Testing Library for:

- Mode selection.
- Navigation.
- Equipment filtering.
- Loading/empty/error states.
- AI analysis result rendering.
- Booking form validation.
- Conflict result rendering.
- Approval action and confirmation state.
- Responsive navigation.
- Graceful AI-not-configured state.

## 14.3 End-to-end tests

Use Playwright for at least the main evaluator journey where feasible:

- Home → Professional Mode → AI analysis → Equipment match → Request booking → Approval Desk → Approve → verify booking status.
- Second flow: trigger a conflicting request → verify alternative recommendations.
- Third smoke test: open 3D route, verify canvas/HUD appears, interact with a known kiosk/equipment anchor, and verify an HTML panel opens.

Do not make the whole E2E suite require a real OpenAI API key. Mock the AI endpoint or use the deterministic fallback in CI.

## 14.4 Quality gates before each commit

Run the relevant commands:

```bash
# Frontend
npm run lint
npm run test -- --run
npm run build

# Backend
ruff check .
pytest -q
```

Adjust exact scripts to the selected toolchain and document them in the frontend/backend package files.

The main branch should remain buildable after each milestone.

---

# 15. Security, Privacy, Accessibility, and Efficiency

## 15.1 Security and responsible AI

- Keep the OpenAI key exclusively in backend environment configuration.
- Validate every request with Pydantic and business rules.
- Use SQLAlchemy parameterised queries/ORM; never interpolate user strings into SQL.
- Limit project description length and AI request frequency.
- Treat project descriptions as untrusted input; ignore embedded instructions that try to override the analyser's role or obtain secrets.
- Do not let AI output directly call mutation endpoints or bypass normal user confirmation.
- Do not render untrusted model output as raw HTML.
- Avoid collecting unnecessary personal information.
- Clearly label sample data and simulated approval functionality.
- Do not expose debugging stack traces or internal paths in production.
- Use environment-based CORS allowlists.
- Add basic rate limiting to AI-intensive endpoints.

## 15.2 Accessibility

- Use semantic HTML and accessible names.
- Ensure keyboard access to all Professional Mode features.
- Provide visible focus indicators.
- Maintain sufficient text/background contrast, including on gradients.
- Never communicate status by colour alone; pair status colours with text/icons.
- Provide labels and helpful validation messages for every form input.
- Use reduced-motion-aware animation.
- Provide a non-3D fallback for all critical workflows.
- Provide a text/list alternative for charts and 3D-only information.
- Do not trap keyboard focus inside the 3D canvas.

## 15.3 Efficiency

- Paginate equipment and booking lists.
- Avoid repeated full-catalogue queries.
- Add indexes for equipment IDs, lab/department IDs, statuses, and timestamps.
- Cache low-change campus directory data where appropriate.
- Avoid LLM calls for operations that can be solved deterministically.
- Cache or reuse analysis where safe.
- Keep LLM prompts focused and output bounded.
- Keep the scheduling search horizon and solver time limit bounded.
- Lazy-load the 3D bundle and models.
- Avoid unnecessary polling and animation rendering.

---

# 16. Implementation Roadmap and Priorities

Build the smallest complete vertical slice first, then expand. Do not build every screen superficially before connecting the backend.

## Phase 0 — Repository and contract setup (P0 / Critical)

**Tasks**

- Inspect repository and current Git state.
- Confirm one branch strategy (`main` only).
- Create `.gitignore` immediately.
- Create root and subproject structure.
- Write `CLAUDE.md` based on Section 0 constraints.
- Define API request/response schemas in a contract document.
- Define database entities and status enums.
- Decide timestamp/timezone conventions.
- Define shared frontend types.
- Create root README and initial project scripts.
- Configure baseline lint/test tooling.

**Acceptance criteria**

- A new developer can identify frontend/backend entry points.
- API contract and status lifecycle are documented.
- No authentication/role implementation is introduced.
- No secrets or large assets are committed.

## Phase 1 — Backend foundation and SQLite (P0 / Critical)

**Tasks**

- Create FastAPI application and versioned router.
- Configure SQLAlchemy 2.x.
- Implement `DATABASE_URL` selection and SQLite default.
- Create models, schemas, and Alembic initial migration.
- Create idempotent demo seed command.
- Implement health/readiness endpoint.
- Implement department, laboratory, equipment, and unit read APIs.
- Add backend tests for database and catalogue.

**Acceptance criteria**

- Backend starts locally using SQLite without PostgreSQL installation.
- Demo seed creates departments, labs, equipment, and units.
- API returns persisted records.
- Tests pass.

## Phase 2 — Professional Mode shell and design system (P0 / Critical)

**Tasks**

- Set up React, Vite, TypeScript, Tailwind, routing, and shared providers.
- Build landing page with both modes.
- Build professional layout and navigation.
- Implement gradient/token design system.
- Build responsive dashboard overview.
- Add API client, loading states, error states, and shared query cache.

**Acceptance criteria**

- No login/signup is present.
- Both mode entry points work.
- Professional Mode reads real backend data.
- Main layout works on desktop and mobile.

## Phase 3 — Equipment discovery vertical slice (P0 / Critical)

**Tasks**

- Equipment catalogue UI.
- Search/filter/sort/pagination.
- Equipment detail view.
- Department/lab detail pages.
- Availability summary.
- Shared equipment components that can later be reused in 3D panels.

**Acceptance criteria**

- Search and filters change actual returned results.
- Equipment detail uses API data.
- Unit count and status derive from backend records.

## Phase 4 — Booking, request tracking, and approval (P0 / Critical)

**Tasks**

- Availability endpoint and service.
- Booking request API and UI.
- Request tracker.
- Approval queue.
- Approve/reject/alternative operations.
- Transactional confirmation and conflict response.
- Audit events and in-app notifications.
- Unit and integration tests.

**Acceptance criteria**

- An evaluator can submit a request and approve/reject it without login.
- Approved request becomes a confirmed booking only after the final availability check.
- Double-booking is prevented.
- Status updates appear in all views.

## Phase 5 — GenAI project analyser and equipment matching (P0 / Critical)

**Tasks**

- Configure OpenAI SDK on backend.
- Create prompt and structured Pydantic schema.
- Add request validation, timeout, and rate limiting.
- Implement deterministic fallback analysis.
- Implement catalogue matching and evidence-based scoring.
- Persist project and requirements.
- Build Project Lab UI and result visualisation.
- Add mock-based tests.

**Acceptance criteria**

- Natural-language input produces structured requirements.
- Each match refers to a real catalogue record.
- Unmatched equipment is clearly identified.
- Missing API key does not make the application unusable.
- No secret is visible in the frontend bundle or browser network response.

## Phase 6 — OR-Tools scheduling and conflict resolution (P0 / Critical)

**Tasks**

- Define hard and soft constraints.
- Implement priority/fairness calculation with configurable weights.
- Implement bounded OR-Tools solver.
- Generate alternatives for conflicts.
- Explain recommendations in normal language using deterministic reason codes; optionally use LLM to make the explanation more natural after facts are calculated.
- Build Scheduling Studio UI.
- Add solver tests and conflict scenarios.

**Acceptance criteria**

- Solver output respects all hard constraints.
- It identifies infeasible requests.
- It returns alternative slots/equipment where possible.
- Fairness factors and deadline urgency are visible.
- No confirmed booking is silently moved.

## Phase 7 — 3D Campus Mode (P0 for differentiator, after contracts are stable)

**Tasks**

- Create lazy-loaded 3D route and scene shell.
- Create low-poly campus plaza and department buildings.
- Add character controller and camera.
- Add collisions/proximity detection.
- Add equipment interaction registry.
- Add lab interiors and 3D equipment anchors.
- Add HTML/HUD panels using shared components and shared API services.
- Add AI terminal, booking terminal, scheduling hub, Operations Desk, and analytics hub.
- Add fallback mode and performance settings.
- Add at least one complete 3D evaluator journey.

**Acceptance criteria**

- Character can move, collide, and interact.
- At least one lab can be entered and explored.
- At least five equipment objects connect to actual equipment IDs.
- Equipment inspection shows live backend data.
- Booking initiated in 3D updates Professional Mode.
- Approval performed in Professional Mode updates 3D state.
- 3D mode contains working project analysis, booking, scheduling, and approval entry points.
- The application remains usable without WebGL.

## Phase 8 — Analytics, notifications, and maintenance (P1 / High)

**Tasks**

- Build aggregate analytics endpoints.
- Add charts and accessible data tables.
- Add notification centre.
- Add equipment maintenance demo workflow.
- Ensure maintenance impacts availability and scheduling.

**Acceptance criteria**

- Analytics derive from stored data.
- New bookings/approvals change relevant metrics.
- Maintenance blocks new bookings.

## Phase 9 — Deployment and production hardening (P0 / Critical)

**Tasks**

- Configure Render PostgreSQL.
- Configure Render FastAPI service and `render.yaml`.
- Configure Vercel root/output/SPA rewrite and `vercel.json`.
- Configure production CORS.
- Set environment variables using deployment dashboards.
- Run Alembic migrations.
- Seed demo data once, through a deliberate command or controlled initial-deploy hook.
- Test production health and readiness.
- Test full evaluator journey on live URLs.
- Inspect browser console, API logs, and network failures.

**Acceptance criteria**

- Hosted backend uses PostgreSQL automatically.
- Local backend continues to use SQLite by default.
- Frontend calls the hosted backend successfully.
- Direct route refresh works on Vercel.
- CORS allows only intended origins.
- AI works with the configured key and fallback works without it.

## Phase 10 — Evaluation rehearsal and submission lock (P0 / Critical)

**Tasks**

- Execute the complete evaluator scenario in Section 13.2.
- Verify mobile and desktop.
- Run tests and build commands.
- Verify public GitHub repository.
- Verify only `main` exists remotely.
- Verify repository size under 10 MB.
- Verify README explains chosen vertical, approach, logic, operation, and assumptions.
- Remove debug routes, unused packages, dead code, large assets, and secrets.
- Create a final tagged commit if useful, without creating a branch.
- Prepare a short demo script and known-limitations note.

**Acceptance criteria**

- All P0 tests pass.
- No critical console or API errors.
- No visible dead primary buttons.
- Demo can be completed without credentials.
- Public repository meets every submission rule.

---

# 17. Parallel Claude Code Work Strategy

Time is limited, so divide independent workstreams. However, parallel work does **not** inherently use fewer credits. It can reduce elapsed wall-clock time when tasks are independent, but multiple agents use additional model tokens and create integration overhead. Claude Code's own guidance distinguishes lower-overhead subagents from higher-token agent teams. Use the smallest team that can deliver the required work safely.

## 17.1 Recommended team shape

Use one lead session and up to three implementation agents. Start parallel coding only after the lead defines the database/API contract and folder ownership.

| Worker | Ownership | Suggested model | Effort | Priority / severity |
|---|---|---|---|---|
| Team Lead / Integrator | API contract, shared types, root config, architecture, integration, deployment, final Git commits | **Sonnet** by default; use **Opus** briefly for architecture or difficult scheduling design if budget allows | Medium normally; High for hard design/debug work | **P0 Critical** |
| Agent A — Backend & Database | `backend/` only: models, migrations, services, routes, tests | **Sonnet** | Medium; High only for transaction/concurrency issues | **P0 Critical** |
| Agent B — Professional Frontend | `frontend/src/features/*` for 2D pages/components; no root app config | **Sonnet** | Medium | **P0 Critical** |
| Agent C — 3D Experience | `frontend/src/features/explorer3d/` and selected 3D assets only | **Sonnet** | Medium; High for movement/physics integration | **P0/P1**: build one complete 3D vertical slice before extra polish |
| Reviewer / QA helper | Read-only review of code, tests, accessibility, and requirements; report findings only | **Haiku** | Low/Medium | P1 High; P0 findings must be escalated |

Model aliases are intentionally used instead of fixed model IDs because Claude Code resolves aliases to models available to the account/provider. Check `/model` and `/status` before starting.

## 17.2 Credit-conscious model policy

- Use Sonnet for most implementation and integration work.
- Use Haiku for focused read-only tasks: file discovery, writing a test checklist, checking route completeness, auditing README coverage, or identifying obvious accessibility issues.
- Use Opus only when reasoning complexity justifies the additional cost: architecture decisions, difficult scheduling formulation, concurrency bugs, or final high-stakes review. Do not run every worker on Opus.
- Prefer `medium` effort for routine implementation and `high` for hard algorithm/design tasks. Avoid `max`/very high effort as the default.
- Do not ask agents to repeatedly re-read the entire README. Give each agent a short scoped assignment and point to the relevant sections.
- Do not spawn agents to work on the same files.
- Do not let every agent install packages or edit root lockfiles.
- The lead should request concise progress summaries and changed-file lists.
- Stop an agent once its scoped deliverable passes checks; do not keep idle agents active.

Claude Code model aliases, effort, custom subagents, and agent-team behaviour can change. Verify current behaviour with `/model`, `/effort`, `/status`, and the official docs before relying on a particular feature.

## 17.3 Agent Teams vs subagents vs separate terminals

Preferred order:

1. **Use focused subagents** for research, review, or bounded work where only a summary is needed. This is usually more economical.
2. **Use an Agent Team** when 2–3 independent implementation agents must coordinate and share tasks. Agent Teams are experimental and disabled by default in Claude Code; enable only if available in the installed version/account.
3. **Use separate terminal sessions** only when necessary. If multiple sessions share one working directory, assign exclusive files/folders to each. If using separate Git worktrees, keep temporary work local and remove temporary branches before pushing; the remote submission must still have only `main`.

Agent Teams can be enabled in project settings if supported:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Do not enable this blindly if the installed Claude Code version does not support it. If it is unavailable, use subagents or explicitly coordinated terminal sessions.

## 17.4 File ownership rules — prevent merge conflicts

| Area | Owner |
|---|---|
| `backend/**` | Backend agent |
| `frontend/src/features/explorer3d/**` | 3D agent |
| `frontend/src/features/{dashboard,equipment,projects,bookings,scheduling,approvals,analytics}/**` | Professional frontend agent |
| Root files, shared component contracts, `frontend/src/app/**`, `frontend/src/services/**`, shared API types, `package.json`, lockfiles, `render.yaml`, `vercel.json`, Alembic integration, final tests | Team lead |
| Review findings | Reviewer reports only; lead or assigned owner fixes |

If an agent needs a shared-file change, it must send a proposed interface/change to the lead rather than editing the file without coordination.

## 17.5 Dependency order

Do not start all agents at once with vague instructions.

**First — Lead, short planning stage**

- Confirm folder layout.
- Define core data models and enum values.
- Define API endpoint names and example response objects.
- Define frontend types.
- Define shared booking and equipment UI contracts.

**Second — Parallel stage**

- Backend agent builds the API and database.
- Professional frontend agent builds the responsive UI against the agreed API contract and mock fixtures where endpoints are not ready.
- 3D agent creates the campus/character/interactions using mocked records with stable IDs from the contract.
- Reviewer prepares a concise test matrix and checks requirements coverage.

**Third — Integration stage**

- Lead connects API client and environment config.
- Replace frontend mocks with live calls.
- Ensure 2D and 3D share the same services and state.
- Resolve schema and status mismatches.
- Run tests and build.

**Fourth — Focused parallel fixes**

- Assign separate, file-isolated bug clusters.
- One agent handles backend test failures, one handles UI errors, one handles 3D interactions.
- Lead owns final integration and release checks.

## 17.6 Prompts to assign workers

### Prompt for Backend & Database Agent

```text
You own backend/ only. Implement the LabLink FastAPI backend based on README.md Sections 4, 7, 8, 9, 10, 11, 14, and 16. Do not implement authentication or role access. Use SQLAlchemy 2.x, Pydantic, Alembic, SQLite by default, and PostgreSQL automatically when DATABASE_URL is set. Build the database models, migrations, idempotent demo seed, equipment/campus APIs, booking request and approval workflow, transaction-safe availability checks, AI service interface with mocked/fallback behaviour, and OR-Tools scheduling service. Follow the shared API contract agreed with the lead. Do not edit frontend files or root dependency/config files. Write tests for your services and endpoints. Keep the lead informed with changed files, endpoints implemented, test commands, and known gaps. Do not claim completion unless tests pass.
```

### Prompt for Professional Frontend Agent

```text
You own frontend Professional Mode feature folders only: frontend/src/features/dashboard, equipment, campus, projects, bookings, scheduling, approvals, and analytics, plus feature-local components/styles. Build the responsive multi-colour gradient UI described in README.md Sections 3, 4, 6, 7, and 16. There is NO login, signup, role selector, or auth gating. Use the API contract and shared types provided by the lead. Do not edit frontend/src/app, frontend/src/services, package.json, lockfiles, or the 3D feature folder. Use mock fixtures only until backend endpoints are ready, and keep fixtures isolated so they can be removed. Ensure buttons and forms have real handlers. Add component tests where practical. Report changed files and incomplete integrations.
```

### Prompt for 3D Agent

```text
You own frontend/src/features/explorer3d/** and only the 3D assets you actually use. Build LabLink 3D Campus Mode as a functional second interface, not a decorative tour. Follow README.md Sections 3.3–3.4, 5, 6, 7, 13.2, and 16. Use Three.js, React Three Fiber, Drei, Zustand, and optionally Rapier. Build one small low-poly campus, a controllable mini character, one complete laboratory interior, at least five equipment interaction anchors with stable IDs, a minimap/HUD, and functional HTML overlays that invoke the shared application callbacks/API services. Include an AI terminal, booking/scheduling entry points, and Operations Desk entry point using the agreed shared interfaces. Do not create a duplicate backend or private booking logic. Do not edit root package files, shared services, route config, or 2D feature folders. Use lightweight/properly licensed assets and document credits. Prioritise a complete working vertical slice over visual scope. Report controls, asset sizes, performance limitations, changed files, and tests.
```

### Prompt for QA / Reviewer Agent

```text
You are a read-only LabLink reviewer. Do not modify files. Review the current repository against README.md Sections 0, 2, 3.4, 4, 9, 10, 11, 13, 14, and 15. Identify dead buttons, missing routes, auth/role code that violates requirements, frontend hardcoded availability, API/DB inconsistencies, booking double-booking risks, exposed secrets, accessibility problems, missing tests, bundle/asset-size risks, and Vercel/Render configuration errors. Return findings sorted by severity: P0 blocker, P1 high, P2 medium, P3 polish. Include exact file paths, a brief reproduction method, and a suggested fix. Do not perform broad refactors.
```

## 17.7 Severity definitions

Use these consistently in task tracking and agent messages:

- **P0 / Critical:** Prevents the evaluator from completing the main workflow, causes incorrect reservations, risks data loss/security exposure, prevents deployment, or violates submission rules. Fix immediately.
- **P1 / High:** Major feature is incomplete, core mode parity is broken, important tests fail, AI matching is unreliable, or a major accessibility/performance issue exists. Fix before final demo.
- **P2 / Medium:** Non-blocking UI defects, incomplete secondary filters, chart details, minor 3D interaction issues, or test gaps not affecting the main flow. Fix after P0/P1.
- **P3 / Low:** Decorative polish, extra animations, sound, optional NPC dialogue, or cosmetic refinements. Only address if time and credits remain.

## 17.8 Git workflow with one remote branch

- Initialise/keep one branch named `main`.
- Only the lead commits and pushes, unless the team has an explicitly agreed single-branch workflow.
- Agents should not independently push.
- Commit after each stable milestone, not after every tiny edit.
- Do not commit broken states.
- Use meaningful commit messages.
- Do not create GitHub feature branches or pull requests for this submission.
- Before pushing, inspect `git status`, branch list, tracked file sizes, and secrets.
- If local helper branches were created, merge changes into `main`, then delete them locally and remotely before the evaluator checks the repository.

Example milestone commits:

```text
chore: initialise LabLink monorepo and tooling
feat(api): add campus and equipment catalogue
feat(booking): add request approval and availability workflow
feat(ai): add project requirement analysis and matching
feat(scheduling): add OR-Tools conflict recommendations
feat(ui): add professional dashboard and equipment discovery
feat(3d): add interactive campus and laboratory explorer
feat(deploy): configure Vercel and Render deployment
 test: add end-to-end evaluator workflow
```

(Use valid Git commit messages; remove the space in ` test:` if copying the last example.)

---

# 18. Claude Code Session Kickoff Prompt

Paste the following into the lead Claude Code session after opening the repository:

```text
Read README.md completely and treat it as the definitive LabLink implementation specification. First inspect the repository, Git state, Node/Python versions, and current code. Do not overwrite existing useful work. The app must have no login, signup, authentication, or role-based access. Keep a public Demo Approval Desk so the full approval workflow can be evaluated without credentials.

I have limited time and a limited Claude usage/credit budget. Start with a concise plan, define the database/API contract and folder ownership, then parallelise only independent work. Use Sonnet for most implementation, Haiku for focused read-only review, and reserve Opus for genuinely difficult architecture/scheduling problems only if needed. Do not claim parallelism saves credits: keep the team small and use it only to reduce elapsed time. Use separate agents for backend, professional frontend, and 3D only after shared contracts are defined. Give every worker exclusive file ownership and concise scope. The lead owns shared files, integration, root configs, tests, and all commits.

P0 is a working evaluator journey: project description → structured AI requirements → real equipment matches → availability → booking request → public approval desk → confirmed booking or alternative recommendation → updated UI/3D state. The 3D mode must be a true second interface to the same functionality, not just a tour. Build a small complete 3D vertical slice before adding extra campus content.

Use SQLite automatically when DATABASE_URL is absent and PostgreSQL when Render supplies DATABASE_URL. Keep OpenAI API calls server-side using OPENAI_API_KEY and configurable OPENAI_MODEL. Add a deterministic no-key fallback. Use OR-Tools for scheduling; never use the LLM as the source of truth for availability or booking decisions.

Create and maintain .gitignore, CLAUDE.md, tests, render.yaml, and vercel.json. Keep the public repository below 10 MB and keep only one remote branch named main. Do not commit secrets, databases, node_modules, build outputs, large assets, or unused asset packs.

Implement the phases in README.md. After every phase, run tests/lint/build, report exact changed files and remaining P0/P1 issues, and commit only stable work. Do not leave primary buttons inert. Do not stop at a mock-up. Start by inspecting the repository and preparing the first milestone now.
```

---

# 19. Definition of Done

LabLink is ready for evaluation only when all relevant items below are true.

## Product and usability

- [ ] Landing page opens without authentication.
- [ ] Professional Mode and 3D Campus Mode are both accessible immediately.
- [ ] No login, signup, password, role selector, or role-based route guard exists.
- [ ] The public Demo Approval Desk is clearly labelled as a simulation.
- [ ] All primary buttons perform a real action or are clearly disabled with an explanation.
- [ ] The app is responsive and has loading, empty, error, and success states.

## Equipment and AI

- [ ] Departments and laboratories load from the backend.
- [ ] Equipment catalogue supports search and filters.
- [ ] Equipment detail uses real database records.
- [ ] Project text is analysed using the configured OpenAI API when available.
- [ ] Missing-key/API-error fallback works and is labelled honestly.
- [ ] Structured output is validated.
- [ ] Equipment matches reference real records.
- [ ] Unmatched requirements are not fabricated.

## Scheduling and approvals

- [ ] Availability comes from the backend.
- [ ] Booking requests persist in the database.
- [ ] Double-booking is prevented by transactional validation.
- [ ] Scheduling engine respects hard constraints.
- [ ] Deadline urgency and fairness are explained.
- [ ] Alternative slots/equipment are returned when feasible.
- [ ] Approval/rejection/alternative actions persist.
- [ ] Approval performs a final availability check.
- [ ] Confirmed bookings update equipment availability.

## 3D

- [ ] Character can move and interact.
- [ ] Campus buildings/labs are navigable.
- [ ] At least one lab is explorable.
- [ ] At least five equipment anchors map to database records.
- [ ] In-world inspection panel shows actual backend data.
- [ ] AI terminal uses the same project-analysis service.
- [ ] Booking initiated in 3D is visible in Professional Mode.
- [ ] Approval performed in Professional Mode is reflected in 3D.
- [ ] Important workflows have keyboard/touch alternatives.
- [ ] WebGL failure has a clean fallback.

## Engineering and deployment

- [ ] SQLite works locally with no PostgreSQL installation.
- [ ] Render uses PostgreSQL through DATABASE_URL.
- [ ] Alembic migrations work on a fresh database.
- [ ] `render.yaml` is present and validated.
- [ ] `vercel.json` is present and deep links refresh correctly.
- [ ] CORS is configured for local and production frontend origins.
- [ ] OpenAI key is not present in frontend bundle or Git history.
- [ ] Tests pass.
- [ ] Frontend production build passes.
- [ ] Backend health/readiness checks pass.
- [ ] Full evaluator journey works against the live deployment.

## Submission compliance

- [ ] GitHub repository is public.
- [ ] Remote has only one branch: `main`.
- [ ] Repository is below 10 MB.
- [ ] Complete source code is committed.
- [ ] No secrets, local databases, build folders, or large unused assets are committed.
- [ ] README explains the selected vertical, approach, logic, operation, and assumptions.
- [ ] Demo URL and repository URL are ready to submit.

---

# 20. Assumptions and Known Limitations

1. The application uses fictional sample campus data because no real university inventory, lab schedules, or equipment register was supplied.
2. No authentication or role-based access is included by design for frictionless hackathon evaluation.
3. The Demo Approval Desk is a simulated, publicly accessible workflow. It is not suitable for real institutional approval decisions.
4. A booking requester supplies a display name and department; this information is not verified.
5. OpenAI analysis depends on a valid server-side API key and model availability. A deterministic demo fallback must keep the product usable without a key.
6. Scheduling results are recommendations based on the constraints and weights configured in the application. The UI must explain the important factors.
7. Equipment safety restrictions are demo metadata and do not replace real laboratory training, supervision, or institutional policies.
8. The 3D campus is a representative low-poly demonstration environment, not a geographically accurate campus model.
9. The app is designed for a hackathon demo, not as a production system for real student personal data or safety-critical laboratory operations.
10. Render/Vercel plan availability and pricing may change. Verify account-specific deployment settings before the final deployment.
11. The organiser's linked submission guide may contain additional instructions beyond the rules pasted into this README. Check it before final submission: https://docs.google.com/document/d/1yw0RLAkfp5TBYajwMRHaxZFc6zOgElKkj2Z-B9HxrWk/edit?tab=t.0#heading=h.sbdvih9v5ho

---

# 21. Official Technical References

Use current official documentation when implementing or updating dependencies. Do not rely on stale snippets if an API has changed.

- Claude Code subagents: https://code.claude.com/docs/en/sub-agents
- Claude Code agent teams: https://code.claude.com/docs/en/agent-teams
- Claude Code model configuration: https://code.claude.com/docs/en/model-config
- FastAPI: https://fastapi.tiangolo.com/
- SQLAlchemy: https://docs.sqlalchemy.org/
- Alembic: https://alembic.sqlalchemy.org/
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI API reference: https://developers.openai.com/api/reference/
- Google OR-Tools: https://developers.google.com/optimization
- React: https://react.dev/
- Vite: https://vite.dev/
- React Three Fiber: https://r3f.docs.pmnd.rs/
- Drei: https://github.com/pmndrs/drei
- Zustand: https://zustand.docs.pmnd.rs/
- Kenney assets: https://kenney.nl/assets
- Render Blueprints: https://render.com/docs/blueprint-spec
- Vercel Vite deployment: https://vercel.com/docs/frameworks/frontend/vite
- Vercel rewrites: https://vercel.com/docs/routing/rewrites

---

**End of LabLink implementation specification.**

Claude Code: begin with Section 0, follow the phased roadmap, protect the one-branch/repository-size requirements, and prioritise a fully working end-to-end evaluator journey over superficial feature count.
