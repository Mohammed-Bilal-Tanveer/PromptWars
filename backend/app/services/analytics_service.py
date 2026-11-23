from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    Booking,
    BookingRequest,
    Department,
    EquipmentType,
    EquipmentUnit,
    Laboratory,
)
from app.services import availability_service as av
from app.services.serializers import DATA_LABEL, count
from app.utils_time import campus_tz, local, now_utc


def overview(db: Session) -> dict:
    now = now_utc()
    units = db.scalars(select(EquipmentUnit)).all()
    states = av.unit_states(db, units, now) if units else {}
    free = sum(1 for s in states.values() if s["is_free_now"])
    maint = sum(1 for s in states.values() if s["in_maintenance"])
    occupied = len(units) - free - maint
    sc = {s: count(db, BookingRequest, BookingRequest.status == s) for s in
          ("pending_review", "approved", "rejected", "confirmed", "cancelled", "alternative_proposed", "completed")}
    reviewed = db.execute(select(BookingRequest.created_at, BookingRequest.reviewed_at)
                          .where(BookingRequest.reviewed_at.is_not(None))).all()
    avg = None
    if reviewed:
        mins = [max((r - c).total_seconds() / 60, 0) for c, r in reviewed]
        avg = round(sum(mins) / len(mins), 1)
    proposed = count(db, AuditEvent, AuditEvent.event_type == "alternative_proposed")
    accepted = count(db, AuditEvent, AuditEvent.event_type == "alternative_accepted")
    try:
        from app.services.scheduling_service import detect_conflicts  # Agent C

        conflict_count = len(detect_conflicts(db))
    except Exception:  # noqa: BLE001
        conflict_count = _conflict_estimate(db, now)
    return {
        "total_units": len(units), "units_available": free, "units_occupied": max(occupied, 0),
        "units_maintenance": maint,
        "active_bookings": count(db, Booking, Booking.status == "confirmed", Booking.end_at >= now),
        "pending_requests": sc["pending_review"] + sc["alternative_proposed"],
        "approved_count": sc["approved"] + sc["confirmed"] + sc["completed"], "rejected_count": sc["rejected"],
        "confirmed_count": sc["confirmed"], "cancelled_count": sc["cancelled"], "avg_review_minutes": avg,
        "conflict_count": conflict_count, "alternatives_proposed": proposed, "alternatives_accepted": accepted,
        "alternative_acceptance_rate": round(accepted / proposed, 3) if proposed else None,
        "is_demo_data": True, "data_label": DATA_LABEL,
    }


def _conflict_estimate(db: Session, now) -> int:
    """Pending requests whose window has no free unit right now."""
    n = 0
    for r in db.scalars(select(BookingRequest).where(BookingRequest.status.in_(["pending_review", "alternative_proposed"]))).all():
        if not av.free_units(db, r.equipment_type, r.requested_start_at, r.requested_end_at):
            n += 1
    return n


def utilisation(db: Session) -> dict:
    now = now_utc()
    um = av.utilisation_map(db, now - timedelta(days=7), now + timedelta(days=7))
    ets = db.scalars(select(EquipmentType)).all()
    labs = {lab.id: lab for lab in db.scalars(select(Laboratory)).all()}
    deps = {d.id: d for d in db.scalars(select(Department)).all()}

    def row(id_, name, b, c, **extra):
        return {"id": id_, "name": name, "booked_hours": round(b, 1), "capacity_hours": round(c, 1),
                "utilisation_pct": av.pct(b, c), **extra}

    by_eq = [row(e.id, e.name, *um.get(e.id, (0, 0)), laboratory_name=e.laboratory.name) for e in ets]
    lab_agg: dict[str, list[float]] = {}
    dep_agg: dict[str, list[float]] = {}
    for e in ets:
        b, c = um.get(e.id, (0, 0))
        for agg, key in ((lab_agg, e.laboratory_id), (dep_agg, e.department_id)):
            a = agg.setdefault(key, [0.0, 0.0])
            a[0] += b
            a[1] += c
    by_lab = [row(k, labs[k].name, *v) for k, v in lab_agg.items()]
    by_dep = [row(k, deps[k].name, *v) for k, v in dep_agg.items()]
    most = db.execute(select(BookingRequest.equipment_type_id, func.count().label("n"))
                      .group_by(BookingRequest.equipment_type_id).order_by(func.count().desc()).limit(5)).all()
    names = {e.id: e.name for e in ets}
    return {
        "window_days": 14,
        "by_department": sorted(by_dep, key=lambda r: -r["utilisation_pct"]),
        "by_laboratory": sorted(by_lab, key=lambda r: -r["utilisation_pct"]),
        "by_equipment": sorted(by_eq, key=lambda r: -r["utilisation_pct"]),
        "most_requested": [{"id": i, "name": names.get(i, i), "request_count": n} for i, n in most],
        "underutilised": sorted(by_eq, key=lambda r: r["utilisation_pct"])[:5],
    }


def trends(db: Session) -> dict:
    now = now_utc()
    today = local(now).date()
    start = today - timedelta(days=14)
    end = today + timedelta(days=8)
    bookings = db.execute(select(Booking.start_at).where(Booking.status.in_(["confirmed", "completed"]))).all()
    peak = {h: 0 for h in range(24)}
    daily_b: dict[str, int] = {}
    for (s,) in bookings:
        ls = s.astimezone(campus_tz())
        peak[ls.hour] += 1
        daily_b[ls.date().isoformat()] = daily_b.get(ls.date().isoformat(), 0) + 1
    daily_r: dict[str, int] = {}
    for (c,) in db.execute(select(BookingRequest.created_at)).all():
        k = c.astimezone(campus_tz()).date().isoformat()
        daily_r[k] = daily_r.get(k, 0) + 1
    daily = []
    d = start
    while d < end:
        k = d.isoformat()
        daily.append({"date": k, "bookings": daily_b.get(k, 0), "requests": daily_r.get(k, 0)})
        d += timedelta(days=1)
    return {"peak_hours": [{"hour": h, "bookings": n} for h, n in peak.items()], "daily": daily}
