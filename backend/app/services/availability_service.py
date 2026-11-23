"""Availability is always derived from units + confirmed bookings + maintenance (never a stored counter)."""
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Booking, BookingRequest, EquipmentType, EquipmentUnit, MaintenanceWindow
from app.utils_time import campus_tz, iso, local, local_day_bounds, local_dt, now_utc

GRID_MINUTES = 15


@dataclass
class Interval:
    start: datetime  # buffered start (bookings) or raw (maintenance)
    end: datetime
    kind: str  # booking | maintenance
    label: str
    ref_id: str | None = None
    raw_start: datetime | None = None
    raw_end: datetime | None = None


def overlaps(a_start, a_end, b_start, b_end) -> bool:
    """Half-open interval overlap."""
    return a_start < b_end and b_start < a_end


def build_busy_index(db: Session, start: datetime, end: datetime, unit_ids: list[str] | None = None,
                     exclude_booking_ids: set[str] | None = None) -> dict[str, list[Interval]]:
    """unit_id -> busy intervals (confirmed bookings buffered by setup/cleanup, plus active maintenance)."""
    margin = timedelta(days=1)
    exclude_booking_ids = exclude_booking_ids or set()
    idx: dict[str, list[Interval]] = {}
    q = (
        select(Booking, EquipmentType, BookingRequest.project_title)
        .join(EquipmentUnit, EquipmentUnit.id == Booking.equipment_unit_id)
        .join(EquipmentType, EquipmentType.id == EquipmentUnit.equipment_type_id)
        .outerjoin(BookingRequest, BookingRequest.id == Booking.booking_request_id)
        .where(Booking.status == "confirmed", Booking.end_at > start - margin, Booking.start_at < end + margin)
    )
    if unit_ids is not None:
        q = q.where(Booking.equipment_unit_id.in_(unit_ids))
    for b, et, title in db.execute(q).all():
        if b.id in exclude_booking_ids:
            continue
        idx.setdefault(b.equipment_unit_id, []).append(Interval(
            b.start_at - timedelta(minutes=et.setup_minutes), b.end_at + timedelta(minutes=et.cleanup_minutes),
            "booking", title or "Booked", b.id, b.start_at, b.end_at))
    mq = select(MaintenanceWindow).where(MaintenanceWindow.status == "active", MaintenanceWindow.end_at > start - margin,
                                         MaintenanceWindow.start_at < end + margin)
    if unit_ids is not None:
        mq = mq.where(MaintenanceWindow.equipment_unit_id.in_(unit_ids))
    for m in db.scalars(mq).all():
        idx.setdefault(m.equipment_unit_id, []).append(Interval(m.start_at, m.end_at, "maintenance", m.reason or "Maintenance",
                                                                m.id, m.start_at, m.end_at))
    return idx


def unit_free(idx: dict[str, list[Interval]], unit: EquipmentUnit, start: datetime, end: datetime) -> bool:
    """True if the unit has no busy interval overlapping [start, end)."""
    if unit.status != "operational":
        return False
    return not any(overlaps(start, end, iv.start, iv.end) for iv in idx.get(unit.id, []))


def free_units(db: Session, et: EquipmentType, start: datetime, end: datetime,
               exclude_booking_ids: set[str] | None = None, idx: dict | None = None) -> list[EquipmentUnit]:
    units = list(et.units)
    if idx is None:
        idx = build_busy_index(db, start, end, [u.id for u in units], exclude_booking_ids)
    return [u for u in units if unit_free(idx, u, start, end)]


def lab_day_hours(et: EquipmentType, d: date) -> tuple[datetime, datetime] | None:
    """Lab opening/closing datetimes for the date, or None when the lab is closed that day."""
    lab = et.laboratory
    if lab.status != "open" or d.weekday() not in (lab.operating_days or []):
        return None
    oh = lab.opening_hours or {"start": "09:00", "end": "18:00"}
    return local_dt(d, oh["start"]), local_dt(d, oh["end"])


def hard_constraint_reasons(et: EquipmentType, start: datetime, end: datetime, now: datetime | None = None) -> list[str]:
    """Reasons the requested window violates hard rules (empty list when valid)."""
    now = now or now_utc()
    reasons: list[str] = []
    if end <= start:
        reasons.append("End time must be after start time.")
        return reasons
    if start < now:
        reasons.append("Requested start time is in the past.")
    dur = (end - start).total_seconds() / 60
    if dur < et.min_booking_minutes:
        reasons.append(f"Minimum booking duration is {et.min_booking_minutes} minutes.")
    if dur > et.max_booking_minutes:
        reasons.append(f"Maximum booking duration is {et.max_booking_minutes} minutes.")
    ls, le = local(start), local(end)
    hours = lab_day_hours(et, ls.date())
    if hours is None:
        reasons.append(f"{et.laboratory.name} is closed on {ls.strftime('%A')}.")
    else:
        if ls.date() != le.date() and not (le.hour == 0 and le.minute == 0):
            reasons.append("Booking must start and end on the same day within lab opening hours.")
        elif start < hours[0] or end > hours[1]:
            oh = et.laboratory.opening_hours
            reasons.append(f"Outside lab opening hours ({oh['start']}-{oh['end']} {campus_tz().key}).")
    if not any(u.status == "operational" for u in et.units):
        reasons.append("No operational units are available for this equipment.")
    return reasons


def _merge(intervals: list[tuple[datetime, datetime]]) -> list[tuple[datetime, datetime]]:
    out: list[tuple[datetime, datetime]] = []
    for s, e in sorted(intervals):
        if out and s <= out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], e))
        else:
            out.append((s, e))
    return out


def compute_availability(db: Session, et: EquipmentType, d: date, start: datetime | None = None,
                         end: datetime | None = None) -> dict:
    day_start, day_end = local_day_bounds(d)
    idx = build_busy_index(db, day_start, day_end, [u.id for u in et.units])
    hours = lab_day_hours(et, d)
    units_out = []
    for u in et.units:
        busy = []
        for iv in sorted(idx.get(u.id, []), key=lambda x: x.start):
            if overlaps(iv.start, iv.end, day_start, day_end):
                busy.append({"start_at": iso(iv.start), "end_at": iso(iv.end), "kind": iv.kind, "label": iv.label})
        units_out.append({"unit_id": u.id, "unit_name": u.unit_name, "inventory_code": u.inventory_code,
                          "status": u.status, "busy": busy})
    free_slots: list[dict] = []
    if hours:
        o, c = hours
        step = timedelta(minutes=GRID_MINUTES)
        t = o
        segs: list[tuple[datetime, datetime, int]] = []
        while t < c:
            n_end = min(t + step, c)
            n = sum(1 for u in et.units if unit_free(idx, u, t, n_end))
            if n > 0:
                if segs and segs[-1][1] == t and segs[-1][2] == n:
                    segs[-1] = (segs[-1][0], n_end, n)
                else:
                    segs.append((t, n_end, n))
            t = n_end
        free_slots = [{"start_at": iso(s), "end_at": iso(e), "free_units": n} for s, e, n in segs]
    requested = None
    if start and end:
        reasons = hard_constraint_reasons(et, start, end)
        fu = free_units(db, et, start, end) if end > start else []
        if not fu and end > start and not reasons:
            reasons.append("All units are booked or in maintenance during this window.")
        requested = {"start_at": iso(start), "end_at": iso(end), "free_units": len(fu),
                     "is_available": bool(fu) and not reasons, "reasons": reasons}
    return {
        "equipment_type_id": et.id, "date": d.isoformat(), "timezone": campus_tz().key,
        "lab_open_at": iso(hours[0]) if hours else None, "lab_close_at": iso(hours[1]) if hours else None,
        "units": units_out, "free_slots": free_slots, "requested": requested,
    }


def find_alternatives(db: Session, et: EquipmentType, start: datetime, end: datetime, now: datetime | None = None,
                      limit: int = 5, exclude_booking_ids: set[str] | None = None) -> list[dict]:
    """Nearest feasible slots: same type first, then compatible same-category types. 15-min grid, 7 days."""
    now = now or now_utc()
    duration = end - start
    cands = [et] + list(db.scalars(select(EquipmentType).where(EquipmentType.category == et.category,
                                                                EquipmentType.id != et.id)).all())
    all_units = [u for c in cands for u in c.units]
    first_day = local(start).date()
    horizon_end = local_dt(first_day + timedelta(days=8), "00:00")
    idx = build_busy_index(db, now - timedelta(days=1), horizon_end, [u.id for u in all_units], exclude_booking_ids)
    out: list[dict] = []
    step = timedelta(minutes=GRID_MINUTES)
    for c in cands:
        dmin = duration.total_seconds() / 60
        if dmin < c.min_booking_minutes or dmin > c.max_booking_minutes:
            continue
        best_for_type: list[dict] = []
        for day_off in range(-1, 8):
            d = first_day + timedelta(days=day_off)
            hours = lab_day_hours(c, d)
            if not hours:
                continue
            t = hours[0]
            while t + duration <= hours[1]:
                if t >= now and t != start or (t == start and c.id != et.id):
                    free = [u for u in c.units if unit_free(idx, u, t, t + duration)]
                    if free:
                        shift = int(abs((t - start).total_seconds()) // 60)
                        best_for_type.append({
                            "equipment_type_id": c.id, "equipment_name": c.name, "unit_id": free[0].id,
                            "unit_name": free[0].unit_name, "start_at": iso(t), "end_at": iso(t + duration),
                            "reason": ("Same equipment, nearest free slot" if c.id == et.id
                                       else f"Compatible alternative ({c.name}) at the requested time"
                                       if shift == 0 else f"Compatible alternative ({c.name}), nearest free slot"),
                            "is_alternative_equipment": c.id != et.id, "shift_minutes": shift,
                        })
                t += step
        best_for_type.sort(key=lambda a: a["shift_minutes"])
        out.extend(best_for_type[:limit])
    out.sort(key=lambda a: (a["shift_minutes"], a["is_alternative_equipment"]))
    # spread: avoid 5 near-identical consecutive slots of the same type; keep distinct (type, hour) first
    chosen: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for a in out:
        key = (a["equipment_type_id"], a["start_at"][:13])
        if key in seen:
            continue
        seen.add(key)
        chosen.append(a)
        if len(chosen) >= limit:
            break
    return chosen


# ---------------------------------------------------------------- derived equipment state

def utilisation_map(db: Session, window_start: datetime, window_end: datetime) -> dict[str, tuple[float, float]]:
    """equipment_type_id -> (booked_hours, capacity_hours) over window (confirmed+completed bookings)."""
    types = db.scalars(select(EquipmentType).options(selectinload(EquipmentType.units),
                                                      selectinload(EquipmentType.laboratory))).all()
    rows = db.execute(
        select(EquipmentUnit.equipment_type_id, Booking.start_at, Booking.end_at)
        .join(EquipmentUnit, EquipmentUnit.id == Booking.equipment_unit_id)
        .where(Booking.status.in_(["confirmed", "completed"]), Booking.end_at > window_start,
               Booking.start_at < window_end)
    ).all()
    booked: dict[str, float] = {}
    for tid, s, e in rows:
        ov = (min(e, window_end) - max(s, window_start)).total_seconds() / 3600
        booked[tid] = booked.get(tid, 0.0) + max(ov, 0.0)
    out = {}
    days = int((window_end - window_start).total_seconds() // 86400)
    first = local(window_start).date()
    for et in types:
        cap_day_hours = 0.0
        for i in range(days):
            h = lab_day_hours(et, first + timedelta(days=i))
            if h:
                cap_day_hours += (h[1] - h[0]).total_seconds() / 3600
        out[et.id] = (round(booked.get(et.id, 0.0), 2), round(cap_day_hours * max(len(et.units), 1), 2))
    return out


def pct(booked: float, capacity: float) -> float:
    """Booked share of capacity as a 0-100 percentage (1 dp); 0 when capacity is zero."""
    return round(min(100.0, 100.0 * booked / capacity), 1) if capacity > 0 else 0.0


def unit_states(db: Session, units: list[EquipmentUnit], now: datetime | None = None) -> dict[str, dict]:
    """unit_id -> {is_free_now, current_booking, next_booking_at, free_at}"""
    now = now or now_utc()
    ids = [u.id for u in units]
    idx = build_busy_index(db, now, now + timedelta(days=30), ids)
    titles = {}
    out = {}
    for u in units:
        ivs = sorted(idx.get(u.id, []), key=lambda x: x.start)
        cur = next((iv for iv in ivs if iv.start <= now < iv.end), None)
        nxt = next((iv for iv in ivs if iv.start > now and iv.kind == "booking"), None)
        current_booking = None
        if cur and cur.kind == "booking":
            titles[cur.ref_id] = cur.label
            current_booking = {"booking_id": cur.ref_id, "start_at": iso(cur.raw_start), "end_at": iso(cur.raw_end),
                               "project_title": cur.label}
        free_at = None
        if cur or u.status != "operational":
            t = cur.end if cur else None
            if t:
                for iv in ivs:
                    if iv.start <= t < iv.end:
                        t = iv.end
                free_at = t
        out[u.id] = {
            "is_free_now": u.status == "operational" and cur is None,
            "in_maintenance": u.status != "operational" or bool(cur and cur.kind == "maintenance"),
            "current_booking": current_booking,
            "next_booking_at": iso(nxt.raw_start) if nxt else None,
            "free_at": free_at,
        }
    return out
