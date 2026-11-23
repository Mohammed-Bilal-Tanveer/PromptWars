"""Booking request creation, cancellation and transactional confirmation."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import dialect_name
from app.core.errors import InvalidState, NotFound, SlotConflict, ValidationFailed
from app.models import Booking, BookingRequest, Department, EquipmentType, EquipmentUnit, Project
from app.services import availability_service as av
from app.services.notification_service import audit, notify
from app.utils_time import iso, now_utc, to_utc

ACTIVE_STATUSES = ("pending_review", "waitlisted", "alternative_proposed")


def get_equipment(db: Session, equipment_id: str) -> EquipmentType:
    et = db.get(EquipmentType, equipment_id)
    if not et:
        raise NotFound(f"Equipment '{equipment_id}' not found")
    return et


def find_alternatives(db: Session, et: EquipmentType, start: datetime, end: datetime, limit: int = 5,
                      exclude_booking_ids: set[str] | None = None) -> list[dict]:
    return av.find_alternatives(db, et, start, end, limit=limit, exclude_booking_ids=exclude_booking_ids)


def _priority(db, *, deadline, created_at, dept_id, name, hours, start):
    try:
        from app.services.priority import compute_priority

        r = compute_priority(db, deadline=deadline, created_at=created_at, requester_department_id=dept_id,
                             requester_name=name, estimated_hours=hours, requested_start=start)
        return float(r["score"]), r["factors"]
    except Exception:  # noqa: BLE001 - never block a request on scoring
        return 0.5, {"deadline_urgency": 0.5, "waiting_time": 0.0, "fairness": 0.5, "preference_fit": 0.5}


def create_request(db: Session, data) -> BookingRequest:
    et = get_equipment(db, data.equipment_type_id)
    if not db.get(Department, data.requester_department_id):
        raise ValidationFailed("Unknown requester department", {"reasons": ["Unknown requester department."]})
    start, end = to_utc(data.start_at), to_utc(data.end_at)
    now = now_utc()
    reasons = av.hard_constraint_reasons(et, start, end, now)
    unit = None
    if data.requested_unit_id:
        unit = db.get(EquipmentUnit, data.requested_unit_id)
        if not unit or unit.equipment_type_id != et.id:
            reasons.append("Requested unit does not belong to this equipment type.")
    if reasons:
        raise ValidationFailed("Booking request violates constraints", {"reasons": reasons})
    dup = db.scalars(select(BookingRequest).where(
        BookingRequest.requester_name == data.requester_name, BookingRequest.project_title == data.project_title,
        BookingRequest.equipment_type_id == et.id, BookingRequest.status.in_(ACTIVE_STATUSES),
        BookingRequest.requested_start_at < end, BookingRequest.requested_end_at > start).limit(1)).first()
    if dup:
        raise ValidationFailed("Duplicate active request", {"reasons": [
            "You already have an active request for this equipment in an overlapping window."]})
    waitlist = False
    if not av.free_units(db, et, start, end):
        if not data.join_waitlist:
            alts = find_alternatives(db, et, start, end)
            raise SlotConflict("No unit is free in the requested window",
                               {"alternatives": alts, "reasons": ["All operational units are booked or under maintenance in this window."]})
        waitlist = True

    project_id = data.project_id
    if project_id and not db.get(Project, project_id):
        raise ValidationFailed("Unknown project", {"reasons": ["Unknown project_id."]})
    if not project_id:
        p = Project(title=data.project_title, description=data.purpose, requester_name=data.requester_name,
                    requester_department_id=data.requester_department_id, analysis_source="manual",
                    deadline=to_utc(data.deadline) if data.deadline else None,
                    estimated_total_hours=data.estimated_hours)
        db.add(p)
        db.flush()
        project_id = p.id
    hours = data.estimated_hours or (end - start).total_seconds() / 3600
    deadline = to_utc(data.deadline) if data.deadline else None
    score, factors = _priority(db, deadline=deadline, created_at=now, dept_id=data.requester_department_id,
                               name=data.requester_name, hours=hours, start=start)
    req = BookingRequest(
        project_id=project_id, project_title=data.project_title, requester_name=data.requester_name,
        requester_department_id=data.requester_department_id, equipment_type_id=et.id,
        requested_unit_id=data.requested_unit_id, requested_start_at=start, requested_end_at=end,
        estimated_hours=hours, purpose=data.purpose, deadline=deadline, status="waitlisted" if waitlist else "pending_review",
        priority_score=score, priority_factors=factors, requires_supervision=et.requires_supervision,
        created_at=now, updated_at=now)
    db.add(req)
    db.flush()
    if waitlist:
        audit(db, "queue_joined", "booking_request", req.id, f"Joined the allocation queue for {et.name}",
              actor=data.requester_name, metadata={"equipment_type_id": et.id, "priority_score": score})
        notify(db, "waitlist_joined", "Joined allocation queue",
               f"'{data.project_title}' is waitlisted for {et.name}. Joining does not reserve the equipment.",
               "booking_request", req.id)
    else:
        audit(db, "submitted", "booking_request", req.id, f"Request submitted for {et.name}", actor=data.requester_name,
              metadata={"equipment_type_id": et.id})
        notify(db, "request_submitted", "Booking request submitted",
               f"{data.requester_name} requested {et.name} ({data.project_title}).", "booking_request", req.id)
    db.commit()
    db.refresh(req)
    return req


def get_request(db: Session, request_id: str) -> BookingRequest:
    r = db.get(BookingRequest, request_id)
    if not r:
        raise NotFound(f"Booking request '{request_id}' not found")
    return r


def lock_units(db: Session, equipment_type_id: str) -> None:
    """Serialise confirmations per equipment type on PostgreSQL."""
    if dialect_name(db) == "postgresql":
        db.execute(select(EquipmentUnit.id).where(EquipmentUnit.equipment_type_id == equipment_type_id)
                   .with_for_update()).all()


def confirm_booking(db: Session, req: BookingRequest, start: datetime, end: datetime, et: EquipmentType,
                    prefer_unit_id: str | None, reviewer: str | None, note: str | None, action: str = "approved") -> Booking:
    """Re-check availability inside the current transaction and create the booking. Raises SlotConflict."""
    lock_units(db, et.id)
    free = av.free_units(db, et, start, end)
    if not free:
        db.rollback()
        alts = find_alternatives(db, et, start, end)
        raise SlotConflict("Slot is no longer available", {"alternatives": alts,
                                                            "reasons": ["No unit is free at approval time."]})
    pick = next((u for u in free if u.id == prefer_unit_id), free[0])
    now = now_utc()
    booking = Booking(booking_request_id=req.id, equipment_unit_id=pick.id, start_at=start, end_at=end,
                      status="confirmed", approved_at=now, created_at=now, updated_at=now)
    db.add(booking)
    req.status = "confirmed"
    req.reviewed_at = now
    if note:
        req.review_note = note
    req.proposed_start_at = req.proposed_end_at = req.proposed_unit_id = req.proposed_equipment_type_id = None
    req.proposed_note = None
    db.flush()
    return booking


def cancel_request(db: Session, request_id: str) -> BookingRequest:
    r = get_request(db, request_id)
    if r.status not in ("pending_review", "waitlisted", "alternative_proposed", "confirmed", "approved"):
        raise InvalidState(f"Request in status '{r.status}' cannot be cancelled")
    for b in r.bookings:
        if b.status == "confirmed":
            b.status = "cancelled"
    r.status = "cancelled"
    audit(db, "cancelled", "booking_request", r.id, "Request cancelled", actor=r.requester_name)
    notify(db, "booking_cancelled", "Booking cancelled", f"'{r.project_title}' was cancelled.", "booking_request", r.id)
    db.commit()
    db.refresh(r)
    return r


def cancel_booking(db: Session, booking_id: str) -> Booking:
    b = db.get(Booking, booking_id)
    if not b:
        raise NotFound(f"Booking '{booking_id}' not found")
    if b.status != "confirmed":
        raise InvalidState(f"Booking in status '{b.status}' cannot be cancelled")
    b.status = "cancelled"
    req = b.booking_request
    if req and req.status == "confirmed" and not any(x.status == "confirmed" for x in req.bookings if x.id != b.id):
        req.status = "cancelled"
        audit(db, "cancelled", "booking_request", req.id, "Booking cancelled", actor=req.requester_name)
    notify(db, "booking_cancelled", "Booking cancelled", f"Booking {b.id} was cancelled.", "booking", b.id)
    db.commit()
    db.refresh(b)
    return b


def accept_alternative(db: Session, request_id: str) -> tuple[BookingRequest, Booking]:
    r = get_request(db, request_id)
    if r.status != "alternative_proposed" or not r.proposed_start_at or not r.proposed_end_at:
        raise InvalidState("Request has no proposed alternative to accept")
    et = db.get(EquipmentType, r.proposed_equipment_type_id) if r.proposed_equipment_type_id else r.equipment_type
    start, end = r.proposed_start_at, r.proposed_end_at
    reasons = av.hard_constraint_reasons(et, start, end)
    if reasons:
        raise SlotConflict("Proposed alternative is no longer valid", {"reasons": reasons, "alternatives": []})
    prefer = r.proposed_unit_id
    booking = confirm_booking(db, r, start, end, et, prefer, None, "Alternative accepted by requester")
    r.equipment_type_id = et.id
    r.requested_start_at, r.requested_end_at = start, end
    audit(db, "alternative_accepted", "booking_request", r.id, "Requester accepted the proposed alternative",
          actor=r.requester_name)
    audit(db, "confirmed", "booking_request", r.id, "Booking confirmed from alternative", actor="System")
    notify(db, "booking_confirmed", "Booking confirmed", f"'{r.project_title}' confirmed for {iso(start)}.",
           "booking", booking.id)
    db.commit()
    db.refresh(r)
    db.refresh(booking)
    return r, booking
