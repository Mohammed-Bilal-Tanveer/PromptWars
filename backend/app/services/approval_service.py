"""Demo approval desk: approve (transactional re-check), reject, propose alternative."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import InvalidState, SlotConflict, ValidationFailed
from app.models import Booking, BookingRequest, EquipmentType, EquipmentUnit
from app.services import availability_service as av
from app.services.booking_service import confirm_booking, find_alternatives, get_request
from app.services.notification_service import REVIEWER, audit, notify, record_approval
from app.utils_time import iso, now_utc, to_utc

REVIEWABLE = ("pending_review", "alternative_proposed")


def approve(db: Session, request_id: str, note: str | None, reviewer: str | None) -> tuple[BookingRequest, Booking]:
    r = get_request(db, request_id)
    if r.status not in REVIEWABLE:
        raise InvalidState(f"Request in status '{r.status}' cannot be approved")
    et = r.equipment_type
    try:
        booking = confirm_booking(db, r, r.requested_start_at, r.requested_end_at, et, r.requested_unit_id,
                                  reviewer, note)
    except SlotConflict:
        # persist the conflict in the audit trail (transaction was rolled back in confirm_booking)
        r = get_request(db, request_id)
        audit(db, "conflict", "booking_request", r.id, "Approval blocked: slot no longer available",
              actor=reviewer or REVIEWER)
        db.commit()
        raise
    actor = reviewer or REVIEWER
    record_approval(db, r.id, "approved", note, actor)
    audit(db, "approved", "booking_request", r.id, "Request approved", actor=actor, note=note,
          metadata={"booking_id": booking.id, "unit_id": booking.equipment_unit_id})
    audit(db, "confirmed", "booking_request", r.id, f"Booking confirmed on {booking.equipment_unit.unit_name}",
          actor="System")
    notify(db, "request_approved", "Request approved", f"'{r.project_title}' was approved.", "booking_request", r.id)
    notify(db, "booking_confirmed", "Booking confirmed",
           f"{et.name} confirmed for {iso(booking.start_at)}.", "booking", booking.id)
    db.commit()
    db.refresh(r)
    db.refresh(booking)
    return r, booking


def reject(db: Session, request_id: str, reason: str, note: str | None, reviewer: str | None = None) -> BookingRequest:
    r = get_request(db, request_id)
    if r.status not in REVIEWABLE:
        raise InvalidState(f"Request in status '{r.status}' cannot be rejected")
    r.status = "rejected"
    r.review_note = reason + (f" - {note}" if note else "")
    r.reviewed_at = now_utc()
    actor = reviewer or REVIEWER
    record_approval(db, r.id, "rejected", r.review_note, actor)
    audit(db, "rejected", "booking_request", r.id, "Request rejected", actor=actor, note=r.review_note)
    notify(db, "request_rejected", "Request rejected", f"'{r.project_title}' was rejected: {reason}",
           "booking_request", r.id)
    db.commit()
    db.refresh(r)
    return r


def propose_alternative(db: Session, request_id: str, data, reviewer: str | None = None) -> BookingRequest:
    r = get_request(db, request_id)
    if r.status not in REVIEWABLE:
        raise InvalidState(f"Request in status '{r.status}' cannot receive an alternative")
    start, end = to_utc(data.start_at), to_utc(data.end_at)
    et = db.get(EquipmentType, data.equipment_type_id) if data.equipment_type_id else r.equipment_type
    if et is None:
        raise ValidationFailed("Unknown equipment type", {"reasons": ["Unknown equipment_type_id."]})
    reasons = av.hard_constraint_reasons(et, start, end)
    unit = None
    if data.equipment_unit_id:
        unit = db.get(EquipmentUnit, data.equipment_unit_id)
        if not unit or unit.equipment_type_id != et.id:
            reasons.append("Proposed unit does not belong to the proposed equipment type.")
    free = av.free_units(db, et, start, end) if not reasons else []
    if unit and unit not in free and not reasons:
        reasons.append("Proposed unit is not free in the proposed window.")
        free = []
    if reasons or not free:
        raise SlotConflict("Proposed alternative is not feasible",
                           {"reasons": reasons or ["No unit is free in the proposed window."],
                            "alternatives": find_alternatives(db, et, start, end)})
    r.status = "alternative_proposed"
    r.proposed_start_at, r.proposed_end_at = start, end
    r.proposed_unit_id = (unit or free[0]).id
    r.proposed_equipment_type_id = et.id
    r.proposed_note = data.note
    actor = reviewer or REVIEWER
    record_approval(db, r.id, "alternative_proposed", data.note, actor)
    audit(db, "alternative_proposed", "booking_request", r.id, f"Alternative proposed: {et.name} at {iso(start)}",
          actor=actor, note=data.note)
    notify(db, "alternative_proposed", "Alternative proposed",
           f"An alternative slot was proposed for '{r.project_title}'.", "booking_request", r.id)
    db.commit()
    db.refresh(r)
    return r


def queue_ids(db: Session):
    return select(BookingRequest)
