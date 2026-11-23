"""ORM -> contract dict serializers."""
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    AuditEvent,
    Booking,
    BookingRequest,
    Department,
    EquipmentType,
    EquipmentUnit,
    Laboratory,
    MaintenanceWindow,
    Notification,
)
from app.services import availability_service as av
from app.utils_time import iso, now_utc

DATA_LABEL = "Sample campus data"


def dept_pos(d) -> dict:
    """Return the department scene position as an x/y/z dict."""
    return {"x": d.scene_position_x, "y": d.scene_position_y, "z": d.scene_position_z}


def unit_dict(u: EquipmentUnit, state: dict | None = None) -> dict:
    """Serialise an equipment unit with its live state."""
    state = state or {}
    return {
        "id": u.id, "equipment_type_id": u.equipment_type_id, "inventory_code": u.inventory_code,
        "unit_name": u.unit_name, "status": u.status, "condition_notes": u.condition_notes,
        "scene_object_id": u.scene_object_id, "is_free_now": state.get("is_free_now", u.status == "operational"),
        "current_booking": state.get("current_booking"), "next_booking_at": state.get("next_booking_at"),
    }


def equipment_summaries(db: Session, ets: list[EquipmentType]) -> list[dict]:
    """Serialise equipment types with unit states and counts."""
    now = now_utc()
    units = [u for et in ets for u in et.units]
    states = av.unit_states(db, units, now)
    util = av.utilisation_map(db, now - timedelta(days=7), now + timedelta(days=7))
    out = []
    for et in ets:
        total = len(et.units)
        free_now = sum(1 for u in et.units if states[u.id]["is_free_now"])
        in_maint = sum(1 for u in et.units if states[u.id]["in_maintenance"])
        if in_maint == 0:
            mstate = "none"
        elif in_maint >= total:
            mstate = "full"
        else:
            mstate = "partial"
        status = "available" if free_now > 0 else ("maintenance" if in_maint >= total and total > 0 else "occupied")
        next_free = None
        if free_now == 0:
            cands = [states[u.id]["free_at"] for u in et.units if states[u.id]["free_at"]]
            next_free = min(cands) if cands else None
        b, c = util.get(et.id, (0, 0))
        out.append({
            "id": et.id, "name": et.name, "category": et.category, "description": et.description,
            "department_id": et.department_id, "department_name": et.department.name,
            "laboratory_id": et.laboratory_id, "laboratory_name": et.laboratory.name,
            "manufacturer": et.manufacturer, "model": et.model, "specifications": et.specifications or {},
            "capabilities": et.capabilities or [], "min_booking_minutes": et.min_booking_minutes,
            "max_booking_minutes": et.max_booking_minutes, "setup_minutes": et.setup_minutes,
            "cleanup_minutes": et.cleanup_minutes, "estimated_setup_minutes": et.setup_minutes,
            "requires_supervision": et.requires_supervision, "safety_notes": et.safety_notes,
            "access_notes": et.access_notes, "image_url": et.image_url,
            "scene_object_id": et.units[0].scene_object_id if et.units else None,
            "quantity_total": total, "quantity_available": free_now, "status": status,
            "maintenance_state": mstate, "utilisation_pct": av.pct(b, c), "next_free_at": iso(next_free),
            "_states": states,
        })
    return out


def strip_private(items: list[dict]) -> list[dict]:
    """Remove the internal ``_states`` key from each item (in place) before public output."""
    for i in items:
        i.pop("_states", None)
    return items


def booking_dict(b: Booking) -> dict:
    """Serialise a booking."""
    u = b.equipment_unit
    et = u.equipment_type
    req = b.booking_request
    return {
        "id": b.id, "booking_request_id": b.booking_request_id, "equipment_unit_id": b.equipment_unit_id,
        "unit_name": u.unit_name, "inventory_code": u.inventory_code, "equipment_type_id": et.id,
        "equipment_name": et.name, "laboratory_id": et.laboratory_id, "laboratory_name": et.laboratory.name,
        "project_title": req.project_title if req else "", "requester_name": req.requester_name if req else "",
        "start_at": iso(b.start_at), "end_at": iso(b.end_at), "status": b.status, "approved_at": iso(b.approved_at),
        "created_at": iso(b.created_at),
    }


def audit_item(a: AuditEvent) -> dict:
    """Serialise an audit event."""
    return {"id": a.id, "action": a.event_type, "description": a.description, "actor": a.actor or "System",
            "note": a.note, "created_at": iso(a.created_at)}


def queue_position(db: Session, r: BookingRequest) -> int | None:
    """Estimated rank among waitlisted requests of the same equipment type (priority desc, created_at asc)."""
    if r.status != "waitlisted":
        return None
    rows = db.execute(select(BookingRequest.id, BookingRequest.priority_score, BookingRequest.created_at).where(
        BookingRequest.equipment_type_id == r.equipment_type_id, BookingRequest.status == "waitlisted")).all()
    rows.sort(key=lambda x: (-(x[1] or 0.0), x[2], x[0]))
    return next((i + 1 for i, x in enumerate(rows) if x[0] == r.id), None)


def request_dict(db: Session, r: BookingRequest, detail: bool = False) -> dict:
    """Serialise a booking request (optionally with detail)."""
    et = r.equipment_type
    booking = next((b for b in sorted(r.bookings, key=lambda x: x.created_at) if b.status != "cancelled"), None)
    if booking is None and r.bookings:
        booking = r.bookings[-1]
    proposed = None
    if r.proposed_start_at and r.proposed_end_at:
        pet = db.get(EquipmentType, r.proposed_equipment_type_id) if r.proposed_equipment_type_id else None
        proposed = {
            "start_at": iso(r.proposed_start_at), "end_at": iso(r.proposed_end_at),
            "equipment_unit_id": r.proposed_unit_id, "equipment_type_id": r.proposed_equipment_type_id,
            "equipment_name": (pet.name if pet else None), "note": r.proposed_note,
        }
    d = {
        "id": r.id, "project_id": r.project_id, "project_title": r.project_title, "requester_name": r.requester_name,
        "requester_department_id": r.requester_department_id,
        "requester_department_name": r.requester_department.name,
        "equipment_type_id": r.equipment_type_id, "equipment_name": et.name, "laboratory_id": et.laboratory_id,
        "laboratory_name": et.laboratory.name, "department_id": et.department_id, "department_name": et.department.name,
        "requested_unit_id": r.requested_unit_id,
        "requested_unit_name": r.requested_unit.unit_name if r.requested_unit else None,
        "requested_start_at": iso(r.requested_start_at), "requested_end_at": iso(r.requested_end_at),
        "estimated_hours": r.estimated_hours, "purpose": r.purpose, "deadline": iso(r.deadline), "status": r.status,
        "priority_score": r.priority_score or 0.0,
        "priority_factors": {k: (r.priority_factors or {}).get(k, 0.0) for k in
                             ("deadline_urgency", "waiting_time", "fairness", "preference_fit")},
        "review_note": r.review_note, "requires_supervision": r.requires_supervision,
        "proposed_alternative": proposed, "booking": booking_dict(booking) if booking else None,
        "created_at": iso(r.created_at), "updated_at": iso(r.updated_at),
        "queue_position": queue_position(db, r),
    }
    return d


def request_with_extras(db: Session, r: BookingRequest, detail: bool = False) -> dict:
    """Adds availability_now + recommendation (and timeline/analysis when detail)."""
    d = request_dict(db, r)
    et = r.equipment_type
    now = now_utc()
    states = av.unit_states(db, list(et.units), now)
    if r.status in ("pending_review", "waitlisted", "alternative_proposed"):
        # Pending requests: availability for the REQUESTED WINDOW (what the reviewer actually needs).
        free_in_window = len(av.free_units(db, et, r.requested_start_at, r.requested_end_at))
        d["availability_now"] = {"is_available": free_in_window > 0, "free_units": free_in_window,
                                 "total_units": len(et.units)}
    else:
        d["availability_now"] = {"is_available": any(s["is_free_now"] for s in states.values()),
                                 "free_units": sum(1 for s in states.values() if s["is_free_now"]),
                                 "total_units": len(et.units)}
    rec = None
    if r.status in ("pending_review", "waitlisted", "alternative_proposed"):
        # is the requested window still free?
        if not av.free_units(db, et, r.requested_start_at, r.requested_end_at):
            alts = av.find_alternatives(db, et, r.requested_start_at, r.requested_end_at, limit=1)
            rec = alts[0] if alts else None
    d["recommendation"] = rec
    if detail:
        events = db.scalars(select(AuditEvent).where(AuditEvent.entity_type == "booking_request",
                                                     AuditEvent.entity_id == r.id).order_by(AuditEvent.created_at)).all()
        d["timeline"] = [audit_item(a) for a in events]
        analysis = None
        if r.project_id:
            from app.models import Project

            p = db.get(Project, r.project_id)
            analysis = p.analysis_json if p else None
        d["analysis"] = analysis
    return d


def maintenance_dict(m: MaintenanceWindow) -> dict:
    """Serialise a maintenance window."""
    u = m.equipment_unit
    et = u.equipment_type
    return {"id": m.id, "equipment_unit_id": m.equipment_unit_id, "unit_name": u.unit_name,
            "inventory_code": u.inventory_code, "equipment_type_id": et.id, "equipment_name": et.name,
            "start_at": iso(m.start_at), "end_at": iso(m.end_at), "reason": m.reason, "status": m.status}


def notification_dict(n: Notification) -> dict:
    """Serialise a notification."""
    return {"id": n.id, "title": n.title, "message": n.message, "type": n.type,
            "related_entity_type": n.related_entity_type, "related_entity_id": n.related_entity_id,
            "is_read": n.is_read, "created_at": iso(n.created_at)}


def lab_dict(db: Session, lab: Laboratory, summaries: dict | None = None, states: dict | None = None) -> dict:
    """Serialise a laboratory with its equipment summaries."""
    now = now_utc()
    ets = lab.equipment_types
    units = [u for et in ets for u in et.units]
    if states is None:
        states = av.unit_states(db, units, now) if units else {}
    else:
        states = {u.id: states[u.id] for u in units if u.id in states}
    avail = sum(1 for s in states.values() if s["is_free_now"])
    d = lab.department
    return {
        "id": lab.id, "department_id": lab.department_id, "department_name": d.name, "name": lab.name, "code": lab.code,
        "description": lab.description, "building": lab.building, "floor": lab.floor, "room_number": lab.room_number,
        "opening_hours": lab.opening_hours, "operating_days": lab.operating_days, "max_occupancy": lab.max_occupancy,
        "capabilities": lab.capabilities or [], "access_notes": lab.access_notes, "safety_notes": lab.safety_notes,
        "scene_position": dept_pos(lab), "status": lab.status, "equipment_count": len(ets),
        "units_total": len(units), "units_available": avail,
    }


def dept_dict(db: Session, dep: Department, states: dict | None = None, util: dict | None = None) -> dict:
    """states/util may be passed in (computed once for a whole list) to avoid repeating heavy queries per row."""
    now = now_utc()
    labs = dep.laboratories
    ets = [et for lab in labs for et in lab.equipment_types]
    units = [u for et in ets for u in et.units]
    if states is None:
        states = av.unit_states(db, units, now) if units else {}
    else:
        states = {u.id: states[u.id] for u in units if u.id in states}
    if util is None:
        util = av.utilisation_map(db, now - timedelta(days=7), now + timedelta(days=7))
    booked = sum(util.get(et.id, (0, 0))[0] for et in ets)
    cap = sum(util.get(et.id, (0, 0))[1] for et in ets)
    return {
        "id": dep.id, "name": dep.name, "slug": dep.slug, "description": dep.description,
        "building_code": dep.building_code, "scene_position": dept_pos(dep), "lab_count": len(labs),
        "equipment_type_count": len(ets), "units_total": len(units),
        "units_available": sum(1 for s in states.values() if s["is_free_now"]),
        "utilisation_pct": av.pct(booked, cap),
    }


def count(db: Session, model, *where) -> int:
    """Count rows of ``model`` matching the optional ``where`` clauses."""
    return db.scalar(select(func.count()).select_from(model).where(*where)) or 0


def _all_unit_states(db: Session) -> dict:
    units = db.scalars(select(EquipmentUnit)).all()
    return av.unit_states(db, units, now_utc()) if units else {}


def dept_dicts(db: Session, deps: list[Department] | None = None) -> list[dict]:
    """All departments with ONE set of queries (eager loading + shared availability/utilisation), not one set per row."""
    if deps is None:
        deps = list(db.scalars(
            select(Department).order_by(Department.name).options(
                selectinload(Department.laboratories)
                .selectinload(Laboratory.equipment_types)
                .selectinload(EquipmentType.units))).all())
    now = now_utc()
    states = _all_unit_states(db)
    util = av.utilisation_map(db, now - timedelta(days=7), now + timedelta(days=7))
    return [dept_dict(db, d, states=states, util=util) for d in deps]


def lab_dicts(db: Session, labs: list[Laboratory]) -> list[dict]:
    """Many laboratories with shared availability state (one unit_states call instead of one per lab)."""
    states = _all_unit_states(db)
    return [lab_dict(db, lab, states=states) for lab in labs]
