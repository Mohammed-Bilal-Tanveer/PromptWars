"""Scheduling recommendations (OR-Tools CP-SAT) and conflict detection. Never mutates bookings."""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import InvalidState, NotFound, ValidationFailed
from app.models import BookingRequest
from app.schemas.scheduling import ConflictsResponse, SchedulingRequestBody, SchedulingResponse
from app.services import scheduling_data as sd
from app.services.priority import compute_priority, explain_priority
from app.services.scheduling_service import SolverRequest, solve
from app.utils_time import iso, to_utc

router = APIRouter(tags=["scheduling"])

HARD_CONSTRAINTS = (
    "Equipment unit is operational",
    "Requested duration fits the lab's opening hours",
    "Lab is open for the whole session",
    "No overlap with confirmed bookings, setup/cleanup buffers or maintenance",
    "Slot is inside the scheduling horizon",
    "At most one allocation per request",
)

ZERO_FACTORS = {"deadline_urgency": 0.0, "waiting_time": 0.0, "fairness": 0.0, "preference_fit": 0.0}


def _factors(d: dict | None) -> dict:
    d = d or {}
    return {k: float(d.get(k, 0.0)) for k in ZERO_FACTORS}


def run_recommendations(db: Session, body: SchedulingRequestBody, now: datetime | None = None) -> dict:
    s = get_settings()
    now = now or datetime.now(UTC)
    h_start, h_end = sd.horizon_for(now, body.horizon_days)
    window_start = to_utc(body.window_start) if body.window_start else None
    window_end = to_utc(body.window_end) if body.window_end else None
    deadline = to_utc(body.deadline) if body.deadline else None

    sreqs: list[SolverRequest] = []
    meta: dict[str, dict] = {}
    type_ids: list[str] = []
    if body.request_ids:
        rows = {r.id: r for r in db.execute(select(BookingRequest).where(BookingRequest.id.in_(body.request_ids))).scalars()}
        for rid in body.request_ids:
            r = rows.get(rid)
            if r is None:
                raise NotFound(f"Booking request {rid} not found")
            if r.status not in sd.PENDING:
                raise InvalidState(f"Request {rid} is {r.status}; only pending requests can be scheduled",
                                   {"request_id": rid, "status": r.status})
            dur = sd.minutes_between(r.requested_start_at, r.requested_end_at)
            score, fac = r.priority_score, _factors(r.priority_factors)
            if not r.priority_factors:
                p = compute_priority(db, deadline=r.deadline, created_at=r.created_at, requester_department_id=r.requester_department_id,
                                     requester_name=r.requester_name, estimated_hours=r.estimated_hours, requested_start=r.requested_start_at, now=now)
                score, fac = p["score"], p["factors"]
            earliest = max(h_start, window_start) if window_start else h_start
            sreqs.append(SolverRequest(r.id, r.equipment_type_id, "", dur, max(r.requested_start_at, earliest), float(score),
                                       earliest=earliest, latest_end=window_end, label=r.id))
            meta[r.id] = {"request_id": r.id, "score": score, "factors": fac, "assumptions": [], "project_title": r.project_title or None,
                          "deadline": iso(r.deadline) if r.deadline else None, "req_start": iso(r.requested_start_at), "req_end": iso(r.requested_end_at)}
            type_ids.append(r.equipment_type_id)
    elif body.equipment_type_id and body.duration_minutes:
        et = sd.load_types(db, [body.equipment_type_id]).get(body.equipment_type_id)
        if et is None:
            raise NotFound(f"Equipment type {body.equipment_type_id} not found")
        pref = window_start or h_start
        p = compute_priority(db, deadline=deadline, created_at=now, requester_department_id=None, requester_name=None,
                             estimated_hours=body.duration_minutes / 60, requested_start=pref, now=now)
        earliest = max(h_start, window_start) if window_start else h_start
        sreqs.append(SolverRequest("adhoc", et.id, et.name, body.duration_minutes, max(pref, earliest), p["score"], earliest=earliest,
                                   latest_end=min((x for x in (window_end, deadline) if x), default=None), label="ad-hoc request"))
        meta["adhoc"] = {"request_id": None, "score": p["score"], "factors": p["factors"],
                         "project_title": None, "deadline": iso(deadline) if deadline else None, "req_start": iso(pref), "req_end": None,
                         "assumptions": ["Ad-hoc recommendation: synthetic request, priority derived from the deadline only."]}
        type_ids.append(et.id)
    else:
        raise ValidationFailed("Provide request_ids, or equipment_type_id with duration_minutes",
                               {"reasons": ["request_ids or (equipment_type_id + duration_minutes) required"]})

    types = sd.load_types(db, list(dict.fromkeys(type_ids)))
    for sr in sreqs:
        sr.type_name = types[sr.type_id].name if sr.type_id in types else sr.type_id
    compat: dict[str, list] = {}
    all_types = list(types.values())
    compat_by_type: dict[str, list] = {}
    for tid, t in types.items():
        cts = sd.compatible_types(db, t)
        compat_by_type[tid] = cts
        all_types.extend(c for c in cts if c.id not in types)
    units = sd.build_units(list(types.values()), h_start, h_end)
    all_units = sd.build_units(all_types, h_start, h_end)
    busy = sd.build_busy(db, [u.id for u in all_units], h_start, h_end)
    for sr in sreqs:
        compat[sr.id] = [u for u in sd.build_units(compat_by_type.get(sr.type_id, []), h_start, h_end)]

    out = solve(sreqs, units, busy, h_start, h_end, grid=sd.GRID, time_limit=min(s.solver_time_limit_seconds, 5.0), workers=1, compatible_units=compat)

    unit_name = {u.id: u.name for u in all_units}
    eligible_by_type: dict[str, list] = {}
    for u in units:
        if u.status == "operational":
            eligible_by_type.setdefault(u.type_id, []).append(u)
    conflicts_all = sd.detect_conflicts(db, now)
    results = []
    for sr in sreqs:
        m = meta[sr.id]
        a = out.assignments.get(sr.id)
        if a is None:
            status, rec = "infeasible", None
        else:
            status = "feasible" if abs((a.start - sr.preferred_start).total_seconds()) < 60 else "partially_feasible"
            rec = {"unit_id": a.unit_id, "unit_name": unit_name.get(a.unit_id, a.unit_id), "start_at": iso(a.start), "end_at": iso(a.end)}
        expl = list(out.explanations.get(sr.id, []))
        expl.extend(explain_priority(m["factors"]))
        mine = [c for c in conflicts_all if (m["request_id"] and m["request_id"] in c["request_ids"])
                or (not m["request_id"] and c["equipment_type_id"] == sr.type_id and c["type"] == "maintenance_overlap")]
        alts = [{
            "equipment_type_id": al.type_id, "equipment_name": types[al.type_id].name if al.type_id in types else next(
                (t.name for t in all_types if t.id == al.type_id), al.type_id),
            "unit_id": al.unit_id, "unit_name": unit_name.get(al.unit_id, al.unit_id), "start_at": iso(al.start), "end_at": iso(al.end),
            "reason": al.reason, "is_alternative_equipment": al.is_alternative_equipment, "shift_minutes": al.shift_minutes,
        } for al in out.alternatives.get(sr.id, [])]
        results.append({
            "request_id": m["request_id"], "equipment_type_id": sr.type_id, "equipment_name": sr.type_name,
            "allocation_status": status, "recommended": rec, "priority_score": round(float(m["score"]), 4),
            "priority_factors": m["factors"], "explanation": expl, "conflicts": mine, "alternatives": alts,
            "project_title": m.get("project_title"), "deadline": m.get("deadline"),
            "requested_start_at": m.get("req_start"), "requested_end_at": m.get("req_end"),
            "eligible_units": len(eligible_by_type.get(sr.type_id, [])),
            "hard_constraints_checked": list(HARD_CONSTRAINTS),
            "shift_minutes": int(abs((a.start - sr.preferred_start).total_seconds()) // 60) if a is not None else None,
            "assumptions": m["assumptions"] + ["Recommendation only: nothing is booked until a coordinator approves it.",
                                               f"Scheduled on a {sd.GRID}-minute grid over {body.horizon_days} day(s); confirmed bookings and maintenance are fixed."],
        })
    titles = {sr.id: meta[sr.id].get("project_title") for sr in sreqs}
    unit_ids = {u.id for u in units}
    horizon_busy = [b for b in busy if b.unit_id in unit_ids and b.end > h_start and b.start < h_end]
    timeline = []
    for u in units:
        locked = [{"start_at": iso(b.start), "end_at": iso(b.end), "kind": b.kind,
                   "label": "Confirmed booking" if b.kind == "booking" else "Maintenance window"}
                  for b in sorted(horizon_busy, key=lambda x: x.start) if b.unit_id == u.id]
        recs = [{"request_id": meta[sr.id]["request_id"], "start_at": iso(a.start), "end_at": iso(a.end), "project_title": titles.get(sr.id)}
                for sr in sreqs if (a := out.assignments.get(sr.id)) is not None and a.unit_id == u.id]
        timeline.append({"unit_id": u.id, "unit_name": u.name, "equipment_type_id": u.type_id, "locked": locked, "recommended": recs})
    assigned = sum(1 for sr in sreqs if out.assignments.get(sr.id) is not None)
    summary = {
        "requests_considered": len(sreqs), "feasible_assignments": assigned, "unresolved": len(sreqs) - assigned,
        "units_considered": len(units), "fixed_blocks": len(horizon_busy), "solve_time_ms": out.solve_time_ms,
        "horizon_start": iso(h_start), "horizon_end": iso(h_end), "horizon_days": body.horizon_days,
        "grid_minutes": sd.GRID, "solver_status": out.status,
    }
    return {
        "summary": summary, "timeline": timeline,
        "solver": "cp-sat", "solver_status": out.status, "solve_time_ms": out.solve_time_ms,
        "weights": {"deadline_urgency": s.w_deadline, "waiting_time": s.w_waiting, "fairness": s.w_fairness, "preference_fit": s.w_preference},
        "horizon_days": body.horizon_days, "results": results,
    }


@router.post("/scheduling/recommendations", response_model=SchedulingResponse)
def scheduling_recommendations(body: SchedulingRequestBody, db: Session = Depends(get_db)):
    return run_recommendations(db, body)


@router.get("/scheduling/conflicts", response_model=ConflictsResponse)
def scheduling_conflicts(db: Session = Depends(get_db)):
    return {"conflicts": sd.detect_conflicts(db)}

