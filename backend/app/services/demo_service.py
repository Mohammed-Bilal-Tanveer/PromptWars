"""Controlled demo reset: restores ONLY the fictional seed scenario.

Safety: never drops tables, never touches the catalogue (departments, labs, equipment types/units
except resetting unit status after removing user-created maintenance), and every DELETE is tied
to ids that are NOT part of the seed (seed ids are recognised by their fixed prefixes).
"""
import secrets
import threading
import time
from datetime import timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models import (
    Approval,
    AuditEvent,
    Booking,
    BookingRequest,
    EquipmentUnit,
    MaintenanceWindow,
    Notification,
    Project,
    ProjectRequirement,
)
from app.seed.demo_data import seed
from app.services.notification_service import audit, notify
from app.utils_time import now_utc

CONFIRM_TEXT = "RESET DEMO SCENARIO"
TOKEN_TTL_SECONDS = 120

SEED_REQUEST_PREFIXES = ("req-seed-", "req-hist-")
SEED_BOOKING_PREFIXES = ("bk-seed-", "bk-hist-")
SEED_PROJECT_PREFIX = "prj-seed-"
SEED_MAINTENANCE_UNIT = "eq-3d-printer-u4"
SEED_MAINTENANCE_REASON = "Hotend replacement and bed levelling"
# Seeded audit / notification types per seeded request state
_PENDING_KEEP_AUDIT = {"submitted"}
_CONFIRMED_KEEP_AUDIT = {"approved"}
_SEED_NOTIFICATION_TYPES = {"request_submitted", "booking_confirmed", "booking_reminder", "request_approved"}

_tokens: dict[str, float] = {}
_lock = threading.Lock()


# --------------------------------------------------------------------------- one-time tokens
def _purge(now: float) -> None:
    for t in [t for t, exp in _tokens.items() if exp <= now]:
        del _tokens[t]


def issue_token() -> str:
    now = time.monotonic()
    token = secrets.token_urlsafe(24)
    with _lock:
        _purge(now)
        _tokens[token] = now + TOKEN_TTL_SECONDS
    return token


def consume_token(token: str) -> bool:
    """True once for a valid unexpired token; always removes it."""
    now = time.monotonic()
    with _lock:
        _purge(now)
        exp = _tokens.pop(token or "", None)
    return exp is not None and exp > now


def clear_tokens() -> None:
    with _lock:
        _tokens.clear()


# --------------------------------------------------------------------------- reset routine
def _is_seed_request(rid: str) -> bool:
    return rid.startswith(SEED_REQUEST_PREFIXES)


def _is_seed_booking(bid: str) -> bool:
    return bid.startswith(SEED_BOOKING_PREFIXES)


def reset_demo_scenario(db: Session) -> dict:
    """Restore the fictional demo scenario. Returns counts of removed rows.

    Note: the idempotent `seed()` call commits internally, so this is not one atomic transaction. If a failure
    happens part-way the data is still a valid demo scenario, and running the reset again completes the restore.
    """
    now = now_utc()
    all_req = db.execute(select(BookingRequest)).scalars().all()
    user_req_ids = [r.id for r in all_req if not _is_seed_request(r.id)]
    seed_reqs = [r for r in all_req if r.id.startswith("req-seed-")]

    all_bk = db.execute(select(Booking)).scalars().all()
    user_bk_ids = [b.id for b in all_bk if not _is_seed_booking(b.id)]
    user_bk_ids_set = set(user_bk_ids)

    user_prj_ids = [pid for pid in db.execute(select(Project.id)).scalars() if not pid.startswith(SEED_PROJECT_PREFIX)]

    all_mw = db.execute(select(MaintenanceWindow)).scalars().all()
    seed_mw = [m for m in all_mw if m.equipment_unit_id == SEED_MAINTENANCE_UNIT and m.reason == SEED_MAINTENANCE_REASON]
    seed_mw_ids = {m.id for m in seed_mw[:1]}
    user_mw = [m for m in all_mw if m.id not in seed_mw_ids]
    user_mw_ids = [m.id for m in user_mw]
    affected_units = {m.equipment_unit_id for m in user_mw}

    # ---- seed requests: restore to seeded state
    modified_seed_ids: set[str] = set()
    pending_ids = {r.id for r in seed_reqs if r.id.rsplit("-", 1)[-1].startswith("p")}
    for r in seed_reqs:
        want = "pending_review" if r.id in pending_ids else "confirmed"
        if r.status != want or r.review_note or r.proposed_start_at or r.proposed_unit_id or r.proposed_note:
            modified_seed_ids.add(r.id)
        if r.id in pending_ids:
            if r.reviewed_at is not None or r.requested_unit_id is not None:
                modified_seed_ids.add(r.id)
            r.status, r.review_note, r.reviewed_at = want, None, None
            r.requested_unit_id = None
        else:
            r.status, r.review_note = want, None
        r.proposed_start_at = r.proposed_end_at = r.proposed_unit_id = r.proposed_equipment_type_id = r.proposed_note = None
        if r.project_id and r.project_id in user_prj_ids:
            r.project_id = None
    db.flush()

    # bookings of seed requests that are not seed bookings count as user-created (already in user_bk_ids)
    seed_bk_by_req: dict[str, list[Booking]] = {}
    for b in all_bk:
        if _is_seed_booking(b.id) and b.booking_request_id:
            seed_bk_by_req.setdefault(b.booking_request_id, []).append(b)

    # pending seed requests must have no bookings; confirmed ones get their seeded bookings back
    for r in seed_reqs:
        if r.id in pending_ids:
            for b in seed_bk_by_req.get(r.id, []):
                if b.id not in user_bk_ids_set:
                    user_bk_ids_set.add(b.id)
                    user_bk_ids.append(b.id)
            continue
        have = {b.id: b for b in seed_bk_by_req.get(r.id, [])}
        for b in have.values():
            if b.status != "confirmed":
                b.status = "confirmed"
                modified_seed_ids.add(r.id)
            b.start_at, b.end_at = r.requested_start_at, r.requested_end_at
        tag, key = r.id[len("req-seed-"):].rsplit("-", 1)
        if key == "gpu":
            units = {f"bk-seed-{tag}-gpu{n}": f"eq-gpu-workstation-u{n}" for n in range(1, 6)}
        else:
            units = {f"bk-seed-{tag}-{key}": r.requested_unit_id}
        for bid, unit_id in units.items():
            if bid not in have and unit_id:
                modified_seed_ids.add(r.id)
                db.add(Booking(id=bid, booking_request_id=r.id, equipment_unit_id=unit_id, start_at=r.requested_start_at,
                               end_at=r.requested_end_at, status="confirmed", approved_at=now, created_at=now))

    # ---- deletes: each tied to explicit non-seed ids
    approval_ids = []
    for a in db.execute(select(Approval)).scalars():
        if a.booking_request_id in user_req_ids or (
                a.booking_request_id in pending_ids) or (
                a.booking_request_id in modified_seed_ids and a.action != "approved"):
            approval_ids.append(a.id)
    if approval_ids:
        db.execute(delete(Approval).where(Approval.id.in_(approval_ids)))
    if user_bk_ids:
        db.execute(delete(Booking).where(Booking.id.in_(user_bk_ids)))
    if user_req_ids:
        db.execute(delete(BookingRequest).where(BookingRequest.id.in_(user_req_ids)))
    if user_prj_ids:
        db.execute(delete(ProjectRequirement).where(ProjectRequirement.project_id.in_(user_prj_ids)))
        db.execute(delete(Project).where(Project.id.in_(user_prj_ids)))
    if user_mw_ids:
        db.execute(delete(MaintenanceWindow).where(MaintenanceWindow.id.in_(user_mw_ids)))
    if affected_units:
        db.execute(update(EquipmentUnit).where(EquipmentUnit.id.in_(sorted(affected_units)),
                                               EquipmentUnit.status != "operational").values(status="operational"))

    # seed maintenance window: restore to active
    for m in seed_mw[:1]:
        m.status = "active"
        m.start_at = now - timedelta(hours=3)
        m.end_at = now + timedelta(days=3)

    # ---- audit events / notifications for deleted entities and modified seed requests
    gone_ids = set(user_req_ids) | set(user_bk_ids) | set(user_prj_ids) | set(user_mw_ids)
    if gone_ids:
        db.execute(delete(AuditEvent).where(AuditEvent.entity_id.in_(sorted(gone_ids))))
        db.execute(delete(Notification).where(Notification.related_entity_id.in_(sorted(gone_ids))))
    for rid in modified_seed_ids:
        keep = _PENDING_KEEP_AUDIT if rid in pending_ids else _CONFIRMED_KEEP_AUDIT
        db.execute(delete(AuditEvent).where(AuditEvent.entity_id == rid, AuditEvent.event_type.notin_(sorted(keep))))
        db.execute(delete(Notification).where(Notification.related_entity_id == rid,
                                              Notification.type.notin_(sorted(_SEED_NOTIFICATION_TYPES))))
    db.execute(delete(Notification).where(Notification.type == "demo_reset"))
    db.flush()

    seed(db)  # idempotent top-up of time-relative demo data (commits)

    audit(db, "demo_reset", "demo", "demo-scenario", "Demo scenario reset to seed data", actor="Demo user")
    notify(db, "demo_reset", "Demo scenario reset", "The fictional demo scenario was restored to its seeded state.",
           "demo", "demo-scenario")
    db.commit()
    return {"requests_removed": len(user_req_ids), "bookings_removed": len(user_bk_ids),
            "projects_removed": len(user_prj_ids), "maintenance_removed": len(user_mw_ids)}
