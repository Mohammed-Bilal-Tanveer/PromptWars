"""DB adapter for the pure scheduling core: builds solver inputs and detects conflicts. Read-only."""
from __future__ import annotations

import hashlib
import math
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Booking, BookingRequest, EquipmentType, MaintenanceWindow
from app.services.scheduling_service import Busy, SolverUnit
from app.utils_time import campus_tz, iso, local_dt

GRID = 15
PENDING = ("pending_review", "alternative_proposed")


def ceil_grid(dt: datetime, grid: int = GRID) -> datetime:
    dt = dt.astimezone(UTC).replace(second=0, microsecond=0)
    mins = dt.minute % grid
    return dt if mins == 0 else dt + timedelta(minutes=grid - mins)


def lab_windows(lab, start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    if lab is None or lab.status != "open":
        return []
    oh = lab.opening_hours or {"start": "09:00", "end": "18:00"}
    days = lab.operating_days or [0, 1, 2, 3, 4]
    d = start.astimezone(campus_tz()).date() - timedelta(days=1)
    last = end.astimezone(campus_tz()).date() + timedelta(days=1)
    out = []
    while d <= last:
        if d.weekday() in days:
            ws, we = local_dt(d, oh["start"]), local_dt(d, oh["end"])
            if we > start and ws < end:
                out.append((max(ws, start), min(we, end)))
        d += timedelta(days=1)
    return out


def load_types(db: Session, type_ids: list[str]) -> dict[str, EquipmentType]:
    rows = db.execute(
        select(EquipmentType).where(EquipmentType.id.in_(type_ids)).options(
            selectinload(EquipmentType.units), selectinload(EquipmentType.laboratory), selectinload(EquipmentType.department)
        )
    ).scalars().all()
    return {t.id: t for t in rows}


def compatible_types(db: Session, et: EquipmentType, limit: int = 2) -> list[EquipmentType]:
    """Other types sharing capabilities with `et`, best overlap first (deterministic)."""
    caps = set(et.capabilities or [])
    if not caps:
        return []
    others = db.execute(
        select(EquipmentType).where(EquipmentType.id != et.id).options(
            selectinload(EquipmentType.units), selectinload(EquipmentType.laboratory), selectinload(EquipmentType.department)
        ).order_by(EquipmentType.id)
    ).scalars().all()
    scored = sorted(((-len(caps & set(o.capabilities or [])), o.id, o) for o in others if caps & set(o.capabilities or [])))
    return [o for _, _, o in scored[:limit]]


def build_units(types: list[EquipmentType], h_start: datetime, h_end: datetime) -> list[SolverUnit]:
    out: list[SolverUnit] = []
    for t in types:
        wins = lab_windows(t.laboratory, h_start, h_end)
        for u in sorted(t.units, key=lambda x: x.id):
            out.append(SolverUnit(u.id, u.unit_name, t.id, wins, u.status, t.setup_minutes or 0, t.cleanup_minutes or 0, t.name))
    return out


def build_busy(db: Session, unit_ids: list[str], h_start: datetime, h_end: datetime) -> list[Busy]:
    if not unit_ids:
        return []
    pad = timedelta(hours=12)
    busy: list[Busy] = []
    for b in db.execute(select(Booking).where(
        Booking.equipment_unit_id.in_(unit_ids), Booking.status == "confirmed",
        Booking.end_at > h_start - pad, Booking.start_at < h_end + pad)).scalars():
        busy.append(Busy(b.equipment_unit_id, b.start_at, b.end_at, "booking", b.id))
    for m in db.execute(select(MaintenanceWindow).where(
        MaintenanceWindow.equipment_unit_id.in_(unit_ids), MaintenanceWindow.status == "active",
        MaintenanceWindow.end_at > h_start - pad, MaintenanceWindow.start_at < h_end + pad)).scalars():
        busy.append(Busy(m.equipment_unit_id, m.start_at, m.end_at, "maintenance", m.id))
    return busy


# ---------------------------------------------------------------- conflicts
def _cid(kind: str, type_id: str, ids: list[str]) -> str:
    return "cf-" + hashlib.sha1((kind + type_id + "|".join(sorted(ids))).encode()).hexdigest()[:10]


def detect_conflicts(db: Session, now: datetime | None = None) -> list[dict]:
    now = now or datetime.now(UTC)
    conflicts: list[dict] = []
    types = {t.id: t for t in db.execute(select(EquipmentType).options(selectinload(EquipmentType.units))).scalars()}
    bookings = db.execute(select(Booking).where(Booking.status == "confirmed", Booking.end_at > now)).scalars().all()
    maint = db.execute(select(MaintenanceWindow).where(MaintenanceWindow.status == "active", MaintenanceWindow.end_at > now)).scalars().all()
    unit_type = {u.id: t.id for t in types.values() for u in t.units}
    unit_obj = {u.id: u for t in types.values() for u in t.units}

    # booking_overlap: two confirmed bookings overlapping on one unit
    by_unit: dict[str, list[Booking]] = {}
    for b in bookings:
        by_unit.setdefault(b.equipment_unit_id, []).append(b)
    for uid, lst in by_unit.items():
        lst.sort(key=lambda x: x.start_at)
        for i, a in enumerate(lst):
            for b in lst[i + 1:]:
                if b.start_at >= a.end_at:
                    break
                tid = unit_type.get(uid, "")
                t = types.get(tid)
                conflicts.append({
                    "id": _cid("booking_overlap", tid, [a.id, b.id]), "type": "booking_overlap", "severity": "high",
                    "equipment_type_id": tid, "equipment_name": t.name if t else tid, "request_ids": [],
                    "booking_ids": [a.id, b.id], "start_at": iso(max(a.start_at, b.start_at)), "end_at": iso(min(a.end_at, b.end_at)),
                    "message": f"Two confirmed bookings overlap on {unit_obj[uid].unit_name}.",
                })

    # maintenance_overlap: confirmed bookings hitting a maintenance window or a non-operational unit
    for b in bookings:
        uid = b.equipment_unit_id
        u = unit_obj.get(uid)
        tid = unit_type.get(uid, "")
        t = types.get(tid)
        hit = [m for m in maint if m.equipment_unit_id == uid and m.start_at < b.end_at and b.start_at < m.end_at]
        down = u is not None and u.status != "operational"
        if not hit and not down:
            continue
        soon = b.start_at - now < timedelta(hours=48)
        conflicts.append({
            "id": _cid("maintenance_overlap", tid, [b.id] + [m.id for m in hit]), "type": "maintenance_overlap",
            "severity": "high" if soon else "medium", "equipment_type_id": tid, "equipment_name": t.name if t else tid,
            "request_ids": [b.booking_request_id] if b.booking_request_id else [], "booking_ids": [b.id],
            "start_at": iso(b.start_at), "end_at": iso(b.end_at),
            "message": (f"Confirmed booking on {u.unit_name} overlaps a maintenance window." if hit
                        else f"Confirmed booking is on {u.unit_name}, which is currently {u.status}."),
        })

    # pending_overlap: pending requests demanding more units than are free in the same slot
    pend = db.execute(select(BookingRequest).where(BookingRequest.status.in_(PENDING), BookingRequest.requested_end_at > now)
                      .order_by(BookingRequest.requested_start_at, BookingRequest.id)).scalars().all()
    by_type: dict[str, list[BookingRequest]] = {}
    for r in pend:
        by_type.setdefault(r.equipment_type_id, []).append(r)
    seen: set[str] = set()
    for tid, reqs in by_type.items():
        t = types.get(tid)
        if t is None:
            continue
        pre, post = timedelta(minutes=t.setup_minutes or 0), timedelta(minutes=t.cleanup_minutes or 0)
        ops = [u for u in t.units if u.status == "operational"]
        for r in reqs:
            point = r.requested_start_at
            covering = [x for x in reqs if x.requested_start_at <= point < x.requested_end_at]
            if len(covering) < 2 and len(reqs) < 2:
                continue
            busy_units = {b.equipment_unit_id for b in bookings
                          if unit_type.get(b.equipment_unit_id) == tid and b.start_at - pre < point + timedelta(minutes=1) and point < b.end_at + post}
            free = max(0, len(ops) - len(busy_units & {u.id for u in ops}))
            if len(covering) <= free:
                continue
            ids = [x.id for x in covering]
            if len(ids) < 2 and free > 0:
                continue
            cid = _cid("pending_overlap", tid, ids)
            if cid in seen:
                continue
            seen.add(cid)
            conflicts.append({
                "id": cid, "type": "pending_overlap", "severity": "high" if free == 0 else "medium",
                "equipment_type_id": tid, "equipment_name": t.name, "request_ids": ids, "booking_ids": [],
                "start_at": iso(max(x.requested_start_at for x in covering)), "end_at": iso(min(x.requested_end_at for x in covering)),
                "message": f"{len(covering)} pending requests want {t.name} at the same time but only {free} unit(s) are free.",
            })
    sev = {"high": 0, "medium": 1, "low": 2}
    conflicts.sort(key=lambda c: (sev[c["severity"]], c["start_at"], c["id"]))
    return conflicts


def horizon_for(now: datetime, days: int) -> tuple[datetime, datetime]:
    start = ceil_grid(now)
    return start, start + timedelta(days=days)


def minutes_between(a: datetime, b: datetime) -> int:
    return max(1, int(math.ceil((b - a).total_seconds() / 60.0)))
