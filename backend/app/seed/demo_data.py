"""Idempotent, time-relative demo seed.  Run: python -m app.seed.demo_data"""
import logging
import random
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Approval,
    AuditEvent,
    Booking,
    BookingRequest,
    Department,
    EquipmentType,
    EquipmentUnit,
    Laboratory,
    MaintenanceWindow,
    Notification,
    Project,
)
from app.seed.catalog import DEPARTMENTS, EQUIPMENT, LABS
from app.utils_time import campus_tz, local_dt, now_utc

log = logging.getLogger("lablink.seed")

REVIEWER = "Demo Lab Coordinator"


def _seed_catalog(db: Session) -> None:
    dept_pos = {}
    for did, name, slug, desc, bcode, (x, y, z) in DEPARTMENTS:
        dept_pos[did] = (x, y, z)
        if db.get(Department, did) is None:
            db.add(Department(id=did, name=name, slug=slug, description=desc, building_code=bcode,
                              scene_position_x=x, scene_position_y=y, scene_position_z=z))
    db.flush()
    lab_dept = {}
    for lid, did, name, code, bld, floor, room, caps, occ, access, safety, hours in LABS:
        lab_dept[lid] = did
        if db.get(Laboratory, lid) is None:
            x, y, z = dept_pos[did]
            db.add(Laboratory(
                id=lid, department_id=did, name=name, code=code, description=f"{name} - shared campus facility.",
                building=bld, floor=floor, room_number=room, opening_hours=hours or {"start": "09:00", "end": "18:00"},
                operating_days=[0, 1, 2, 3, 4], max_occupancy=occ, capabilities=caps, access_notes=access,
                safety_notes=safety, scene_position_x=x, scene_position_y=y, scene_position_z=z,
                scene_anchor_id=f"anchor-{lid}", status="open"))
    db.flush()
    for (eid, name, cat, lab, n_units, manu, model, specs, caps, mn, mx, setup, cleanup, sup, safety, access,
         code) in EQUIPMENT:
        if db.get(EquipmentType, eid) is None:
            db.add(EquipmentType(
                id=eid, name=name, category=cat, description=f"{name} ({manu} {model}) available for supervised and self-service project work.",
                department_id=lab_dept[lab], laboratory_id=lab, manufacturer=manu, model=model, specifications=specs,
                capabilities=caps, min_booking_minutes=mn, max_booking_minutes=mx, setup_minutes=setup,
                cleanup_minutes=cleanup, requires_supervision=sup, safety_notes=safety, access_notes=access,
                image_url=None))
            db.flush()
            for i in range(1, n_units + 1):
                db.add(EquipmentUnit(
                    id=f"{eid}-u{i}", equipment_type_id=eid, inventory_code=f"{code}-{i:03d}",
                    unit_name=f"{name} #{i}", status="operational",
                    condition_notes="Calibrated and in good condition." if i % 3 else "Minor cosmetic wear; fully functional.",
                    scene_object_id=f"obj-{eid}-{i}"))
    db.flush()


def _workday(base_local: datetime, offset: int) -> datetime:
    """The offset-th operating day (Mon-Fri) after (offset>0) / before (offset<0) base."""
    d = base_local
    step = 1 if offset > 0 else -1
    remaining = abs(offset)
    while remaining:
        d += timedelta(days=step)
        if d.weekday() < 5:
            remaining -= 1
    return d


def _audit(db, etype, entity_type, entity_id, desc, actor="System", note=None, meta=None, at=None):
    db.add(AuditEvent(event_type=etype, entity_type=entity_type, entity_id=entity_id, description=desc,
                      actor=actor, note=note, event_metadata=meta or {}, created_at=at or now_utc()))


def _priority(db, **kw):
    try:
        from app.services.priority import compute_priority

        r = compute_priority(db, **kw)
        return r["score"], r["factors"]
    except Exception:  # noqa: BLE001 - priority module may not exist yet / fails in seed
        return 0.5, {"deadline_urgency": 0.5, "waiting_time": 0.3, "fairness": 0.5, "preference_fit": 0.5}


def _mk_request(db, rid, title, name, dept, eq, start, end, status, purpose, unit=None, deadline=None,
                created_at=None, score=0.5, factors=None, hours=None):
    et = db.get(EquipmentType, eq)
    req = BookingRequest(
        id=rid, project_title=title, requester_name=name, requester_department_id=dept, equipment_type_id=eq,
        requested_unit_id=unit, requested_start_at=start, requested_end_at=end, status=status, purpose=purpose,
        deadline=deadline, priority_score=score,
        priority_factors=factors or {"deadline_urgency": 0.5, "waiting_time": 0.3, "fairness": 0.5, "preference_fit": 0.5},
        requires_supervision=bool(et and et.requires_supervision), estimated_hours=hours or (end - start).total_seconds() / 3600,
        created_at=created_at or now_utc(), updated_at=created_at or now_utc())
    db.add(req)
    db.flush()
    return req


def _mk_booking(db, bid, req, unit_id, start, end, status="confirmed", approved_at=None):
    db.add(Booking(id=bid, booking_request_id=req.id if req else None, equipment_unit_id=unit_id, start_at=start,
                   end_at=end, status=status, approved_at=approved_at or now_utc(),
                   created_at=approved_at or now_utc()))


def _seed_projects(db: Session) -> None:
    if db.scalar(select(Project.id).limit(1)):
        return
    now = now_utc()
    rows = [
        ("prj-seed-1", "Campus Waste Sorting Vision System", "Train a computer vision model on a Jetson to sort waste streams from a conveyor camera feed.", "Computer Vision", "Priya Nair", "dept-cs", 21, 40.0),
        ("prj-seed-2", "Autonomous Line-Following Rover", "Build a rover using Raspberry Pi, camera module and motor control with sensor fusion.", "Robotics", "Rahul Verma", "dept-ece", 30, 60.0),
        ("prj-seed-3", "Low-Cost Prosthetic Hand", "Design and 3D print a tendon-driven prosthetic hand, then machine aluminium mounting parts.", "Biomedical Fabrication", "Meera Iyer", "dept-mech", 25, 50.0),
        ("prj-seed-4", "Smart Soil Moisture Network", "IoT mesh of soil sensors reporting through a LoRaWAN gateway with an analytics dashboard.", "IoT", "Arjun Das", "dept-ece", 40, 35.0),
    ]
    for pid, title, desc, cat, name, dept, dl, hrs in rows:
        db.add(Project(id=pid, title=title, description=desc, category=cat, requester_name=name,
                       requester_department_id=dept, deadline=now + timedelta(days=dl), estimated_total_hours=hrs,
                       analysis_source="manual", created_at=now - timedelta(days=2), updated_at=now - timedelta(days=2)))


def _seed_history(db: Session) -> None:
    if db.get(Booking, "bk-hist-1") is not None:
        return
    rng = random.Random(42)
    people = [
        ("Priya Nair", "dept-cs"), ("Karthik S", "dept-cs"), ("Neha Kapoor", "dept-cs"), ("Rahul Verma", "dept-ece"),
        ("Ishita Rao", "dept-ece"), ("Meera Iyer", "dept-mech"), ("Dev Malhotra", "dept-civil"), ("Ananya Pillai", "dept-bio"),
    ]
    pool = [e[0] for e in EQUIPMENT if not e[13]] + ["eq-gpu-workstation", "eq-gpu-workstation", "eq-3d-printer", "eq-oscilloscope"]
    base = now_utc().astimezone(campus_tz())
    used: set[tuple[str, str]] = set()
    created = 0
    i = 0
    while created < 25 and i < 200:
        i += 1
        eq = pool[rng.randrange(len(pool))]
        et = db.get(EquipmentType, eq)
        day = _workday(base, -(1 + rng.randrange(15)))
        hour = rng.choice([9, 10, 11, 13, 14, 15, 16])
        dur = rng.choice([1, 2, 2, 3])
        unit = f"{eq}-u{1 + rng.randrange(len(et.units))}"
        s = local_dt(day.date(), f"{hour:02d}:00")
        e = s + timedelta(hours=dur)
        key = (unit, s.isoformat())
        if key in used or any(u == unit and abs((datetime.fromisoformat(k) - s).total_seconds()) < 4 * 3600 for u, k in used):
            continue
        used.add(key)
        created += 1
        name, dept = people[rng.randrange(len(people))] if rng.random() > 0.35 else people[rng.randrange(3)]
        req = _mk_request(db, f"req-hist-{created}", f"{et.name} experiment", name, dept, eq, s, e, "completed",
                          "Completed experimental session.", unit=unit, created_at=s - timedelta(days=3),
                          score=round(rng.uniform(0.3, 0.8), 2))
        _mk_booking(db, f"bk-hist-{created}", req, unit, s, e, "completed", approved_at=s - timedelta(days=2, hours=rng.randrange(1, 20)))
        req.reviewed_at = s - timedelta(days=2, hours=rng.randrange(1, 20))
        db.add(Approval(booking_request_id=req.id, action="approved", reviewer_display_name=REVIEWER,
                        note="Approved.", created_at=req.reviewed_at))
        _audit(db, "request_submitted", "booking_request", req.id, "Request submitted", actor=name, at=req.created_at)
        _audit(db, "approved", "booking_request", req.id, "Request approved and booking confirmed", actor=REVIEWER,
               at=req.reviewed_at)


def _seed_activity(db: Session) -> None:
    """Future confirmed bookings + pending requests (refreshed when none remain in the future)."""
    now = now_utc()
    future = db.scalar(select(Booking.id).where(Booking.status == "confirmed", Booking.end_at > now,
                                                Booking.id.like("bk-seed-%")).limit(1))
    if future:
        return
    base = now.astimezone(campus_tz())
    d1 = _workday(base, 1).date()
    d2 = _workday(base, 2).date()
    tag = d1.strftime("%Y%m%d")

    # 1. GPU block: all 5 units tomorrow 14:00-16:00 (conflict scenario)
    s, e = local_dt(d1, "14:00"), local_dt(d1, "16:00")
    r = _mk_request(db, f"req-seed-{tag}-gpu", "Distributed Training Benchmark", "Karthik S", "dept-cs", "eq-gpu-workstation",
                    s, e, "confirmed", "Class-wide GPU training workshop using all workstations.",
                    created_at=now - timedelta(days=2), score=0.71)
    r.reviewed_at = now - timedelta(days=1)
    for n in range(1, 6):
        _mk_booking(db, f"bk-seed-{tag}-gpu{n}", r, f"eq-gpu-workstation-u{n}", s, e, approved_at=now - timedelta(days=1))
    _audit(db, "approved", "booking_request", r.id, "Request approved and booking confirmed", actor=REVIEWER, at=now - timedelta(days=1))
    db.add(Approval(booking_request_id=r.id, action="approved", reviewer_display_name=REVIEWER, note="Workshop block approved."))

    others = [
        ("rpi", "Rover Prototype Bring-up", "Rahul Verma", "dept-ece", "eq-raspberry-pi", d1, "10:00", "12:00", 1),
        ("osc", "Sensor Signal Characterisation", "Ishita Rao", "dept-ece", "eq-oscilloscope", d2, "10:00", "12:00", 1),
        ("mic", "Cell Morphology Imaging", "Ananya Pillai", "dept-bio", "eq-microscope", d2, "14:00", "16:00", 1),
    ]
    for key, title, name, dept, eq, day, st, en, u in others:
        s, e = local_dt(day, st), local_dt(day, en)
        rq = _mk_request(db, f"req-seed-{tag}-{key}", title, name, dept, eq, s, e, "confirmed", f"{title} session.",
                         unit=f"{eq}-u{u}", created_at=now - timedelta(days=2), score=0.55)
        _mk_booking(db, f"bk-seed-{tag}-{key}", rq, f"{eq}-u{u}", s, e, approved_at=now - timedelta(hours=20))
        db.add(Approval(booking_request_id=rq.id, action="approved", reviewer_display_name=REVIEWER, note="Approved."))
        _audit(db, "approved", "booking_request", rq.id, "Request approved and booking confirmed", actor=REVIEWER, at=now - timedelta(hours=20))

    # Pending requests (one conflicts with the full GPU block)
    d3 = _workday(base, 3).date()
    pend = [
        ("gpu", "Fine-tuning Vision Transformer", "Priya Nair", "dept-cs", "eq-gpu-workstation", d1, "14:00", "16:00", 5, "Fine-tune a ViT on the campus waste dataset before the review deadline."),
        ("cnc", "Prosthetic Hand Mounting Parts", "Meera Iyer", "dept-mech", "eq-cnc", d2, "10:00", "13:00", 12, "Machine aluminium mounting brackets for prosthetic hand prototype."),
        ("3dp", "Rover Chassis Prototypes", "Rahul Verma", "dept-ece", "eq-3d-printer", d3, "11:00", "15:00", 20, "Print three chassis revisions in PETG."),
    ]
    for key, title, name, dept, eq, day, st, en, dl_days, purpose in pend:
        s, e = local_dt(day, st), local_dt(day, en)
        created = now - timedelta(hours=18 if key == "gpu" else 6)
        score, factors = _priority(db, deadline=now + timedelta(days=dl_days), created_at=created,
                                   requester_department_id=dept, requester_name=name,
                                   estimated_hours=(e - s).total_seconds() / 3600, requested_start=s)
        rq = _mk_request(db, f"req-seed-{tag}-p{key}", title, name, dept, eq, s, e, "pending_review", purpose,
                         deadline=now + timedelta(days=dl_days), created_at=created, score=score, factors=factors)
        _audit(db, "submitted", "booking_request", rq.id, "Request submitted", actor=name, at=created)
        db.add(Notification(title="New booking request", message=f"{name} requested {rq.equipment_type_id.replace('eq-', '')} - {title}.",
                            type="request_submitted", related_entity_type="booking_request", related_entity_id=rq.id,
                            is_read=False, created_at=created))

    # Maintenance window: one 3D printer unit
    if db.scalar(select(MaintenanceWindow.id).where(MaintenanceWindow.status == "active",
                                                     MaintenanceWindow.end_at > now).limit(1)) is None:
        mw = MaintenanceWindow(equipment_unit_id="eq-3d-printer-u4", start_at=now - timedelta(hours=3),
                               end_at=now + timedelta(days=3), reason="Hotend replacement and bed levelling", status="active")
        db.add(mw)
        db.flush()
        db.add(Notification(title="Maintenance scheduled", message="FDM 3D Printer #4 is in maintenance: Hotend replacement and bed levelling.",
                            type="maintenance", related_entity_type="maintenance_window", related_entity_id=mw.id, is_read=False))
        _audit(db, "maintenance_started", "maintenance_window", mw.id, "Maintenance window created for FDM 3D Printer #4")


def _seed_notifications(db: Session) -> None:
    if db.scalar(select(Notification.id).where(Notification.type == "booking_confirmed").limit(1)):
        return
    now = now_utc()
    db.add(Notification(title="Booking confirmed", message="Your GPU Workstation block for tomorrow 14:00 is confirmed.",
                        type="booking_confirmed", related_entity_type="booking", related_entity_id="bk-seed-gpu", is_read=True,
                        created_at=now - timedelta(days=1)))
    db.add(Notification(title="Booking reminder", message="Reminder: Raspberry Pi 5 Kit booking starts tomorrow at 10:00.",
                        type="booking_reminder", related_entity_type="booking", related_entity_id="bk-seed-rpi", is_read=False,
                        created_at=now - timedelta(hours=2)))
    db.add(Notification(title="Request approved", message="Your oscilloscope request was approved.", type="request_approved",
                        related_entity_type="booking_request", related_entity_id="req-seed-osc", is_read=False,
                        created_at=now - timedelta(hours=20)))


def seed(db: Session) -> None:
    _seed_catalog(db)
    _seed_projects(db)
    _seed_history(db)
    _seed_activity(db)
    _seed_notifications(db)
    db.commit()
    log.info("Seed complete")


def main() -> None:
    from app.core.database import Base, SessionLocal, engine

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)
    print("Seed complete")


if __name__ == "__main__":
    main()
