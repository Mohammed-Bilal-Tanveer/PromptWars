# LabLink API Contract (source of truth for backend + frontend + 3D)

Base path: `/api/v1`. JSON only. No auth. Field names are snake_case. IDs are strings.
Product spec/roadmap: `docs/SPEC.md`; overview and deployment: `README.md`.

## Conventions
- **Timestamps**: responses always ISO-8601 UTC with `Z` (e.g. `2026-11-25T04:30:00Z`). Requests may send ISO with offset OR *naive* ISO (`2026-11-25T10:00`) which the backend interprets as **campus-local time** (`CAMPUS_TIMEZONE`, default `Asia/Kolkata`). Store UTC. `GET /config/public` returns `campus_timezone`; frontend formats with `Intl.DateTimeFormat(..., {timeZone})`.
- **Intervals** are half-open `[start,end)`. Buffer: each booking occupies `[start - setup_minutes, end + cleanup_minutes)` for conflict purposes on the same unit (setup/cleanup from equipment type).
- **Pagination**: `?page=1&page_size=20` -> `{ "items": [...], "total": n, "page": 1, "page_size": 20 }`.
- **Errors**: `{ "error": { "code": "SLOT_CONFLICT", "message": "...", "details": {...} } }`. Codes: `VALIDATION_ERROR`(400/422), `NOT_FOUND`(404), `SLOT_CONFLICT`(409), `INVALID_STATE`(409), `RATE_LIMITED`(429), `INTERNAL_ERROR`(500). Never leak stack traces. FastAPI's own 422 must also be rewrapped in this format.
- **Weekdays**: `operating_days` is an array of ints, Monday=0 … Sunday=6. `opening_hours` = `{"start":"09:00","end":"18:00"}` campus-local.

## Enumerations
- unit.status: `operational | maintenance | unavailable`
- equipment.status (derived): `available` if >=1 unit is free now, `maintenance` if every unit is in maintenance/non-operational, otherwise `occupied`. => **`available | occupied | maintenance`** (there is no `limited` status).
- booking_request.status: `pending_review | waitlisted | approved | rejected | alternative_proposed | confirmed | cancelled | completed | expired`
  - Active (reviewable) statuses: `pending_review`, `waitlisted`, `alternative_proposed`. `waitlisted` = joined the allocation queue (no booking, no reservation).
  - Approving a request (from any active status) runs a fresh transactional availability check; success -> request `confirmed` + Booking row `confirmed` (an `approvals` audit row with action `approved`). Failure -> 409 `SLOT_CONFLICT` with `details.alternatives`, request keeps its current status.
  - `approved` is only a transient/legacy value; normal path jumps straight to `confirmed`.
- booking.status: `confirmed | cancelled | completed`
- priority: `required | recommended | optional`
- match_status: `exact | partial | unavailable | unmatched`
- notification.type: `request_submitted | waitlist_joined | demo_reset | request_approved | request_rejected | alternative_proposed | booking_confirmed | booking_reminder | booking_cancelled | booking_completed | maintenance`

## Stable seed IDs (idempotent seed MUST use exactly these)
Departments: `dept-cs`, `dept-ece`, `dept-mech`, `dept-civil`, `dept-bio`
Buildings (`building_code`): cs/ai=`CS-B`, ece=`EC-B`, mech+civil=`ME-B`, bio=`BT-B`
Department `scene_position` (x,y,z): cs(-28,0,-22) ece(28,0,-22) mech(-28,0,24) civil(-28,0,24) bio(28,0,24). Lab `scene_position` = its department's position.
Labs: `lab-ai`(cs) `lab-gpu`(cs) `lab-robotics`(ece) `lab-proto`(ece) `lab-iot`(ece) `lab-fab`(mech) `lab-3dp`(mech) `lab-materials`(civil) `lab-biotech`(bio)
Required equipment types (add more to reach 18-22 total; ids are `eq-<slug>`):
`eq-gpu-workstation`(lab-gpu, 5 units) `eq-raspberry-pi`(lab-robotics, 6) `eq-arduino`(lab-robotics, 8) `eq-camera-module`(lab-robotics, 4) `eq-robotics-kit`(lab-robotics, 3) `eq-oscilloscope`(lab-proto, 4) `eq-fpga`(lab-proto, 3) `eq-3d-printer`(lab-3dp, 4) `eq-cnc`(lab-fab, 2, requires_supervision) `eq-microscope`(lab-biotech, 3) `eq-centrifuge`(lab-biotech, 2, requires_supervision) `eq-materials-tester`(lab-materials, 2, requires_supervision)
Extra suggestions: `eq-jetson-nano`(lab-ai) `eq-ml-server`(lab-ai) `eq-sensor-kit`(lab-iot) `eq-lora-gateway`(lab-iot) `eq-soldering-station`(lab-proto) `eq-logic-analyzer`(lab-proto) `eq-laser-cutter`(lab-fab) `eq-pcr-thermocycler`(lab-biotech) `eq-spectrophotometer`(lab-biotech) `eq-concrete-tester`(lab-materials)
Unit ids: `<equipment_id>-u1`, `-u2`…; `inventory_code` like `GPU-001`; `scene_object_id` = `obj-<equipment_id>-<n>`.
Capability tags (snake_case vocabulary, used by AI + matcher): `computer_vision, machine_learning, deep_learning, embedded_systems, sensor_integration, robotics, prototyping, signal_analysis, fpga_design, additive_manufacturing, machining, microscopy, cell_biology, materials_testing, iot_networking, electronics_testing, gpu_compute, data_acquisition`.
Demo requester departments use the same dept ids. Seed also creates: ~4 confirmed bookings (time-relative: tomorrow/day-after, 10:00-12:00 etc. in campus tz; at least one on `eq-gpu-workstation` that occupies ALL units for a slot tomorrow 14:00-16:00 so a conflict scenario is demonstrable), 3 pending requests, 1 maintenance window (one `eq-3d-printer` unit), 4 example projects, a few notifications, and ~25 historical `completed` bookings spread over the last 3 weeks (for analytics/fairness). Seed must be idempotent and time-relative (computed from now).

## Health / config
- `GET /health` -> `{status:"ok", version:"1.0.0", app:"LabLink API"}`
- `GET /health/ready` -> `{status:"ready", database:"sqlite"|"postgresql"}` (503 + error format if DB down)
- `GET /config/public` -> `{app_name, version, demo_mode, ai_configured, campus_timezone, data_label:"Sample campus data", demo_reset_enabled:boolean}`

## Campus
- `GET /departments` -> `Department[]`
- `GET /departments/{id}` -> `Department & { laboratories: Laboratory[] }`
- `GET /laboratories?department_id=&q=` -> `Laboratory[]`
- `GET /laboratories/{id}` -> `Laboratory & { equipment: EquipmentType[] }`

```
Department { id, name, slug, description, building_code,
  scene_position:{x,y,z}, lab_count, equipment_type_count, units_total, units_available /*operational & free right now*/, utilisation_pct /*0-100, booked hours / capacity hours over next 7 days + past 7 days*/ }
Laboratory { id, department_id, department_name, name, code, description, building, floor, room_number,
  opening_hours:{start,end}, operating_days:number[], max_occupancy, capabilities:string[], access_notes, safety_notes,
  scene_position:{x,y,z}, status:"open"|"closed", equipment_count, units_total, units_available }
```

## Equipment
- `GET /equipment?q=&department_id=&laboratory_id=&category=&status=&available_from=&available_to=&sort=relevance|availability|name|utilisation&page=&page_size=` -> `Paginated<EquipmentType>`. `q` matches name/category/description/capabilities/specs/lab name/department name (case-insens). `available_from/to` (ISO) restricts to types with >=1 unit free for the entire window. `status` filters derived status.
- `GET /equipment/categories` -> `string[]`
- `GET /equipment/recommendations?capabilities=a,b&limit=6` -> `EquipmentRecommendation[]` (`EquipmentType & {score, evidence:string[]}`)
- `GET /equipment/{id}` -> `EquipmentDetail`
- `GET /equipment/{id}/units` -> `EquipmentUnit[]`
- `GET /equipment/{id}/availability?date=YYYY-MM-DD[&start=ISO&end=ISO]` -> `Availability`
- `POST /equipment/units/{unit_id}/status` body `{status:"operational"|"maintenance"|"unavailable", reason?:string}` -> `EquipmentUnit`. Creates notification `maintenance` + audit event. Putting a unit in maintenance/unavailable must NOT cancel confirmed bookings; instead those show up in `/scheduling/conflicts` (`maintenance_overlap`).

```
EquipmentType { id, name, category, description, department_id, department_name, laboratory_id, laboratory_name,
  manufacturer, model, specifications:{[k]:string|number}, capabilities:string[],
  min_booking_minutes, max_booking_minutes, setup_minutes, cleanup_minutes, estimated_setup_minutes,
  requires_supervision:boolean, safety_notes, access_notes, image_url:string|null, scene_object_id:string|null /*first unit's*/,
  quantity_total, quantity_available /*free right now, derived from units+bookings+maintenance*/,
  status:"available"|"occupied"|"maintenance", maintenance_state:"none"|"partial"|"full", utilisation_pct, next_free_at:string|null }
EquipmentUnit { id, equipment_type_id, inventory_code, unit_name, status:"operational"|"maintenance"|"unavailable", condition_notes, scene_object_id,
  is_free_now:boolean, current_booking:{booking_id,start_at,end_at,project_title}|null, next_booking_at:string|null }
EquipmentDetail = EquipmentType & { units:EquipmentUnit[], alternatives:EquipmentType[] /*same category/capability overlap, up to 4*/, upcoming_bookings:Booking[] /*next 10 confirmed*/ }
Availability { equipment_type_id, date, timezone, lab_open_at:string|null, lab_close_at:string|null /*null when lab closed that day*/,
  units:[{unit_id, unit_name, inventory_code, status, busy:[{start_at,end_at,kind:"booking"|"maintenance",label}]}],
  free_slots:[{start_at,end_at,free_units:number}] /*merged intervals within opening hours where >=1 operational unit is free; respects setup/cleanup buffer*/,
  requested:{start_at,end_at,free_units:number,is_available:boolean,reasons:string[]}|null /*present when start&end given*/ }
```

## Projects + AI
- `POST /projects/analyse` (rate limited: 10/min/IP) body `ProjectAnalyseRequest` -> `AnalysisResult`
- `POST /projects` body `{title, description, category?, requester_name, requester_department_id?, deadline?, estimated_total_hours?, analysis?:AnalysisResult}` -> `Project` (201)
- `GET /projects` -> `Project[]` ; `GET /projects/{id}` -> `Project`
- `POST /assistant/message` (rate limited) body `{message:string(<=1000), context?:{equipment_type_id?, booking_request_id?, project_id?, laboratory_id?}}` -> `AssistantReply`

```
ProjectAnalyseRequest { title, description(10..8000 chars), category?, deadline?:ISO date/datetime, preferred_department_ids?:string[],
  preferred_window?:{start_at,end_at}, estimated_total_hours?:number, constraints?:string }
AnalysisResult { analysis_source:"openai"|"demo_fallback", is_fallback:boolean, fallback_reason:string|null /*e.g. "OPENAI_API_KEY not configured"*/,
  project_summary, capabilities:string[], equipment_requirements:[{equipment_query, priority, reason, capability_tag:string|null}],
  required_lab_capabilities:string[], suggested_departments:[{id,name}], estimated_total_hours:number, assumptions:string[],
  safety_considerations:string[], clarifying_questions:string[], reasoning_summary:string,
  matches:RequirementMatch[] }
RequirementMatch { requirement_name, priority, reason, capability_tag:string|null, match_status:"exact"|"partial"|"unavailable"|"unmatched",
  best:MatchCandidate|null, candidates:MatchCandidate[] /*max 4, score desc*/ }
MatchCandidate { equipment_type_id, name, category, laboratory_id, laboratory_name, department_id, department_name, building, room_label,
  score:number /*0-100 explainable*/, match_type:"exact_name"|"category"|"capability"|"alternative", evidence:string[],
  total_units, available_units /*free in preferred window if given else right now*/, is_available:boolean }
Project { id, title, description, category, requester_name, requester_department_id, deadline:string|null, estimated_total_hours:number|null,
  analysis_source:"openai"|"demo_fallback"|"manual", analysis:AnalysisResult|null, created_at, updated_at }
AssistantReply { reply:string, source:"openai"|"deterministic", references:[{type:"equipment"|"booking_request"|"laboratory"|"project", id, label}],
  suggested_actions:[{label, action:"open_equipment"|"open_booking_form"|"open_scheduling"|"open_approvals"|"open_project_lab", params:{[k]:string}}] }
```
AI rules: OpenAI called server-side only (`OPENAI_API_KEY`, `OPENAI_MODEL`); strict JSON-schema output validated by Pydantic; fallback = deterministic keyword->capability extractor labelled `demo_fallback`; matcher is deterministic and only returns real DB equipment; unmatched requirements stay `unmatched`. Cache by hash for 10 min.

## Booking requests & bookings
- `POST /booking-requests` body `{project_id?, project_title, requester_name, requester_department_id, equipment_type_id, requested_unit_id?, start_at, end_at, estimated_hours?, purpose?, deadline?, join_waitlist?:boolean (default false)}` -> 201 `BookingRequest` (status `pending_review`, or `waitlisted` when `join_waitlist` is true and no unit is free; see "Allocation queue / waitlist"). Validates ALL hard constraints (end>start, not in past, lab opening hours/operating day, min/max duration, >=1 operational unit, no confirmed-booking/maintenance overlap incl. buffers on at least one unit, supervision flagged in response not blocked). Violation -> 400 `VALIDATION_ERROR` with `details.reasons[]`; no free unit in window and `join_waitlist` false -> 409 `SLOT_CONFLICT` with `details:{alternatives:Alternative[], reasons[]}` (request NOT created); an overlapping active request by the same requester/project/equipment -> 400 `VALIDATION_ERROR`. Computes priority score+factors. Creates notification `request_submitted` + audit event. If `project_id` missing but `project_title` present, backend auto-creates a manual project row.
- `GET /booking-requests?status=&department_id=&equipment_type_id=&date=YYYY-MM-DD&q=&page=&page_size=` -> `Paginated<BookingRequest>` (newest first). `status` may be comma separated. `department_id` matches requester OR owning department.
- `GET /booking-requests/{id}` -> `BookingRequest` incl. `timeline`, `analysis`, `availability_now`, `recommendation` (best alternative slot summary or null)
- `POST /booking-requests/{id}/cancel` -> `BookingRequest` (pending_review/waitlisted/alternative_proposed/confirmed/approved -> cancelled; also cancels its confirmed booking; any other status -> 409 `INVALID_STATE`)
- `POST /booking-requests/{id}/accept-alternative` -> `{request, booking}` (re-validates the proposed alternative transactionally; 409 on conflict)
- `GET /bookings?status=&equipment_type_id=&unit_id=&laboratory_id=&from=&to=&page=&page_size=` -> `Paginated<Booking>` (default status confirmed)
- `GET /bookings/{id}` -> `Booking`; `POST /bookings/{id}/cancel` -> `Booking`

```
BookingRequest { id, project_id, project_title, requester_name, requester_department_id, requester_department_name,
  equipment_type_id, equipment_name, laboratory_id, laboratory_name, department_id /*owning*/, department_name,
  requested_unit_id:string|null, requested_unit_name:string|null, requested_start_at, requested_end_at, estimated_hours:number|null,
  purpose, deadline:string|null, status, priority_score:number /*0-1*/,
  priority_factors:{deadline_urgency:number, waiting_time:number, fairness:number, preference_fit:number} /*each 0-1*/,
  review_note:string|null, requires_supervision:boolean,
  proposed_alternative:{start_at,end_at,equipment_unit_id:string|null,equipment_type_id:string|null,equipment_name:string|null,note:string|null}|null,
  booking:Booking|null, created_at, updated_at,
  /* detail-only: */ timeline?:AuditItem[], analysis?:AnalysisResult|null, availability_now?:{is_available:boolean,free_units:number,total_units:number}, recommendation?:Alternative|null }
AuditItem { id, action:string /*submitted|approved|rejected|alternative_proposed|confirmed|cancelled|conflict|...*/, description, actor:string /*e.g. "Demo Lab Coordinator" | requester name | "System"*/, note:string|null, created_at }
Booking { id, booking_request_id, equipment_unit_id, unit_name, inventory_code, equipment_type_id, equipment_name, laboratory_id, laboratory_name,
  project_title, requester_name, start_at, end_at, status:"confirmed"|"cancelled"|"completed", approved_at:string|null, created_at }
Alternative { equipment_type_id, equipment_name, unit_id:string, unit_name, start_at, end_at, reason:string, is_alternative_equipment:boolean, shift_minutes:number /*abs distance from requested start*/ }
```

## Scheduling (OR-Tools CP-SAT) & approvals
- `POST /scheduling/recommendations` body `{request_ids?:string[], equipment_type_id?:string, window_start?:ISO, window_end?:ISO, duration_minutes?:number, deadline?:ISO, horizon_days?:number(default 7,max 14)}` -> `SchedulingResponse`. With `request_ids`: jointly allocate those requests (any status pending_review/waitlisted/alternative_proposed; other statuses -> 409 `INVALID_STATE`) over unit-slots (15-min grid) maximising sum(priority-weighted satisfaction) − shift penalty; with `equipment_type_id`+`duration_minutes`: ad-hoc single recommendation (synthetic request, priority from deadline). Solver time limit ≤ 5 s, deterministic (seed/ workers=1). Existing confirmed bookings and maintenance are hard-fixed.
- `GET /scheduling/conflicts` -> `{conflicts:Conflict[]}`
- `GET /approvals/queue?status=&department_id=&equipment_type_id=&date=&page=&page_size=` -> `Paginated<BookingRequest>` (default statuses `pending_review,waitlisted,alternative_proposed`; each item includes `availability_now` and `recommendation`)
- `POST /approvals/{request_id}/approve` body `{note?:string, reviewer_name?:string}` -> `{request:BookingRequest, booking:Booking}`; 409 `SLOT_CONFLICT` w/ `details.alternatives` if no unit free now; 409 `INVALID_STATE` if not pending_review/waitlisted/alternative_proposed.
- `POST /approvals/{request_id}/reject` body `{reason:string(min 3), note?}` -> `BookingRequest`
- `POST /approvals/{request_id}/alternative` body `{start_at,end_at,equipment_unit_id?,equipment_type_id?,note?}` -> `BookingRequest` (status `alternative_proposed`, alternative validated as feasible, else 409)

```
SchedulingResponse { solver:"cp-sat", solver_status:"optimal"|"feasible"|"infeasible"|"not_run", solve_time_ms:number,
  weights:{deadline_urgency:0.40,waiting_time:0.25,fairness:0.20,preference_fit:0.15}, horizon_days:number,
  results:SchedulingResult[],
  summary:SolverSummary|null, timeline:UnitTimeline[] /*feed the Scheduling decision visualiser*/ }
SolverSummary { requests_considered, feasible_assignments, unresolved, units_considered, fixed_blocks, solve_time_ms, horizon_start, horizon_end, horizon_days, grid_minutes, solver_status }
UnitTimeline { unit_id, unit_name, equipment_type_id, locked:[{start_at,end_at,kind:"booking"|"maintenance",label}], recommended:[{request_id:string|null,start_at,end_at,project_title:string|null}] }
SchedulingResult { request_id:string|null, equipment_type_id, equipment_name, allocation_status:"feasible"|"partially_feasible"|"infeasible",
  recommended:{unit_id,unit_name,start_at,end_at}|null, priority_score:number, priority_factors:{deadline_urgency,waiting_time,fairness,preference_fit},
  explanation:string[], conflicts:Conflict[], alternatives:Alternative[], assumptions:string[],
  project_title?, deadline?, requested_start_at?, requested_end_at?, eligible_units:number, hard_constraints_checked:string[], shift_minutes:number|null }
Conflict { id, type:"pending_overlap"|"maintenance_overlap"|"booking_overlap", severity:"high"|"medium"|"low", equipment_type_id, equipment_name,
  request_ids:string[], booking_ids:string[], start_at, end_at, message }
```
Priority formula (weights in config, documented): `0.40*deadline_urgency + 0.25*waiting_time + 0.20*fairness + 0.15*preference_fit`, each normalised 0-1. Fairness = higher for requesters/departments with fewer recent (14-day) allocated hours (identity-free: keyed by department+name hash only for hours, never a priority bonus by name itself). Deterministic reason codes -> English explanation list.

## Analytics / notifications / maintenance
- `GET /analytics/overview` -> `{total_units, units_available, units_occupied, units_maintenance, active_bookings /*confirmed, end>=now*/, pending_requests /*pending_review+alternative_proposed; waitlisted are counted separately*/, waitlisted_count, approved_count /*approved+confirmed+completed*/, rejected_count, confirmed_count, cancelled_count, avg_review_minutes:number|null, conflict_count, alternatives_proposed, alternatives_accepted, alternative_acceptance_rate:number|null, laboratory_count, department_count, is_demo_data:true, data_label:"Sample campus data"}`
- `GET /analytics/utilisation` -> `{window_days:14, by_department:UtilRow[], by_laboratory:UtilRow[], by_equipment:UtilRow[], most_requested:[{id,name,request_count}], underutilised:UtilRow[] /*lowest 5 by_equipment*/}` where `UtilRow={id,name,booked_hours,capacity_hours,utilisation_pct}` (equipment rows also have `laboratory_name`)
- `GET /analytics/trends` -> `{peak_hours:[{hour:0-23,bookings:number}], daily:[{date:"YYYY-MM-DD",bookings:number,requests:number}] /*last 14 days + next 7*/}`
- `GET /notifications?unread_only=false&limit=30` -> `{items:Notification[], unread_count}`; `POST /notifications/{id}/read` -> `Notification`; `POST /notifications/read-all` -> `{unread_count:0}`
- `GET /maintenance` -> `MaintenanceWindow[]`; `POST /maintenance` body `{equipment_unit_id,start_at,end_at,reason}` -> `MaintenanceWindow` (201); `POST /maintenance/{id}/end` -> `MaintenanceWindow`
```
Notification { id, title, message, type, related_entity_type:string|null, related_entity_id:string|null, is_read, created_at }
MaintenanceWindow { id, equipment_unit_id, unit_name, inventory_code, equipment_type_id, equipment_name, start_at, end_at, reason, status:"active"|"ended" }
```

## Interactive docs
FastAPI serves Swagger UI at `/docs` and the schema at `/openapi.json` on the host root (not under `/api/v1`).

## Backend config (env)
`DATABASE_URL` (empty -> `sqlite:///./lablink.db`; `postgres://` / `postgresql://` -> `postgresql+psycopg://`), `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TIMEOUT_SECONDS`, `OPENAI_MAX_INPUT_CHARS`, `CAMPUS_TIMEZONE`, `FRONTEND_ORIGIN` (comma-separated CORS allowlist; always also allow `http://localhost:5173` & `http://127.0.0.1:5173` in dev), `DEMO_MODE`, `DEMO_RESET_ENABLED` (default false everywhere; see "Controlled demo reset"), `LOG_LEVEL`, `SOLVER_TIME_LIMIT_SECONDS` (default 5), scheduling weights `W_DEADLINE,W_WAITING,W_FAIRNESS,W_PREFERENCE`.
On startup (in lifespan): when `DEMO_MODE=true`, run alembic upgrade (or `create_all` fallback) + idempotent seed so the hosted demo works with zero manual steps. Seed is idempotent and refreshes time-relative demo bookings only if none exist in the future.


## Allocation queue / waitlist (implemented; the sections above already reflect it)
- Booking_request.status value **`waitlisted`** (active, not confirmed) and notification type `waitlist_joined`.
- `POST /booking-requests` accepts optional `join_waitlist: boolean` (default `false`).
  - Hard-constraint failures (bad range, past, closed lab, duration, etc.) stay `400 VALIDATION_ERROR` — **never** waitlisted.
  - Valid window but **no free unit**: `join_waitlist=false` -> unchanged `409 SLOT_CONFLICT` with alternatives. `join_waitlist=true` -> `201` BookingRequest with `status:"waitlisted"` (priority computed, audit event `queue_joined`, notification `waitlist_joined`), no booking created.
  - A unit is free: normal `pending_review` request (join_waitlist ignored).
  - Duplicate active request (same requester_name + project_title + equipment + overlapping window, status pending_review/waitlisted/alternative_proposed) -> `400 VALIDATION_ERROR` with reason "You already have an active request for this equipment in an overlapping window."
- Transitions from `waitlisted`: approve (transactional re-check; 409 SLOT_CONFLICT if still no unit), reject (reason required), propose alternative -> `alternative_proposed`, cancel/leave queue (`POST /booking-requests/{id}/cancel`) -> `cancelled`. Cancelled/rejected/expired are excluded from scheduling.
- `BookingRequest` carries `queue_position: number | null` (**estimated**, only for waitlisted: rank among waitlisted requests for the same equipment type by priority_score desc, then created_at asc; may change).
- `GET /booking-requests?status=waitlisted` works. `GET /approvals/queue` default statuses are `pending_review,waitlisted,alternative_proposed` (same as in the Scheduling & approvals section).
- Scheduling (`POST /scheduling/recommendations`, `GET /scheduling/conflicts`) treats `waitlisted` like `pending_review`. Recommendation runs never create bookings or change request status.
- `GET /analytics/overview` includes `waitlisted_count`.


## Controlled demo reset (roadmap H.5)
Public, unauthenticated apps must never expose an unrestricted destructive endpoint, so the reset is **off by default in every environment** (local development included, and a deployment that forgets `APP_ENV` stays safe) and guarded.
- Enabled only when `DEMO_MODE=true` AND `DEMO_RESET_ENABLED` is true (default: **false** in every environment; opt in with `DEMO_RESET_ENABLED=true`, intended for local use only, never on a public deployment). `GET /config/public` returns `demo_reset_enabled: boolean` (true only when both hold).
- `POST /demo/reset-token` -> `{"token": string, "expires_in_seconds": 120}`. One-time, in-memory, rate limited 5/min/IP (429 `RATE_LIMITED`). Disabled -> 403 `DEMO_RESET_DISABLED`.
- `POST /demo/reset` body `{"token": string, "confirm": "RESET DEMO SCENARIO"}` -> `{"status":"reset","restored":{"requests_removed":n,"bookings_removed":n,"projects_removed":n,"maintenance_removed":n}}`. Wrong confirm text / bad, expired or used token -> 400 `VALIDATION_ERROR`. Disabled -> 403.
- Only non-seed rows are removed (seed ids are recognised by prefix: `req-seed-`, `req-hist-`, `bk-seed-`, `bk-hist-`, `prj-seed-`); seed requests are restored to their seeded state; the catalogue (departments, labs, equipment types, units) is never touched; tables are never dropped.
