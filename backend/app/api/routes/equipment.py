from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import NotFound, ValidationFailed
from app.models import Booking, EquipmentType, EquipmentUnit
from app.schemas.requests import UnitStatusBody
from app.services import availability_service as av
from app.services.notification_service import audit, notify
from app.services.serializers import (
    booking_dict,
    equipment_summaries,
    strip_private,
    unit_dict,
)
from app.utils_time import now_utc, to_utc

router = APIRouter(tags=["equipment"])


def _haystack(e: dict, et: EquipmentType) -> str:
    specs = " ".join(f"{k} {v}" for k, v in (et.specifications or {}).items())
    return " ".join([et.name, et.category, et.description, " ".join(et.capabilities or []).replace("_", " "),
                     " ".join(et.capabilities or []), specs, e["laboratory_name"], e["department_name"],
                     et.manufacturer, et.model]).lower()


@router.get("/equipment")
def list_equipment(q: str | None = Query(default=None, max_length=200), department_id: str | None = None,
                   laboratory_id: str | None = None, category: str | None = None, status: str | None = None,
                   available_from: datetime | None = None, available_to: datetime | None = None,
                   sort: str = Query("relevance", pattern="^(relevance|availability|name|utilisation)$"),
                   page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    stmt = select(EquipmentType)
    if department_id:
        stmt = stmt.where(EquipmentType.department_id == department_id)
    if laboratory_id:
        stmt = stmt.where(EquipmentType.laboratory_id == laboratory_id)
    if category:
        stmt = stmt.where(EquipmentType.category == category)
    ets = list(db.scalars(stmt).all())
    summaries = equipment_summaries(db, ets)
    by_id = {et.id: et for et in ets}
    scored: list[tuple[float, dict]] = []
    terms = [t for t in (q or "").lower().split() if t]
    for s in summaries:
        et = by_id[s["id"]]
        score = 0.0
        if terms:
            hay = _haystack(s, et)
            if not all(t in hay for t in terms):
                continue
            name = et.name.lower()
            score = sum(3 if t in name else 1 for t in terms) + (2 if (q or "").lower() in name else 0)
        if status and s["status"] != status:
            continue
        scored.append((score, s))
    if available_from and available_to:
        f, t = to_utc(available_from), to_utc(available_to)
        scored = [(sc, s) for sc, s in scored if t > f and av.free_units(db, by_id[s["id"]], f, t)]
    if sort == "name":
        scored.sort(key=lambda x: x[1]["name"].lower())
    elif sort == "availability":
        scored.sort(key=lambda x: (-x[1]["quantity_available"], x[1]["name"].lower()))
    elif sort == "utilisation":
        scored.sort(key=lambda x: (-x[1]["utilisation_pct"], x[1]["name"].lower()))
    else:
        scored.sort(key=lambda x: (-x[0], -x[1]["quantity_available"], x[1]["name"].lower()))
    total = len(scored)
    items = strip_private([s for _, s in scored[(page - 1) * page_size: page * page_size]])
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/equipment/categories")
def categories(db: Session = Depends(get_db)):
    return sorted(set(db.scalars(select(EquipmentType.category)).all()))


@router.get("/equipment/recommendations")
def recommendations(capabilities: str = "", limit: int = Query(6, ge=1, le=20), db: Session = Depends(get_db)):
    wanted = [c.strip() for c in capabilities.split(",") if c.strip()]
    if not wanted:
        raise ValidationFailed("capabilities is required", {"reasons": ["Provide comma separated capabilities."]})
    ets = list(db.scalars(select(EquipmentType)).all())
    summaries = {s["id"]: s for s in equipment_summaries(db, ets)}
    out = []
    for et in ets:
        caps = set(et.capabilities or [])
        hit = [c for c in wanted if c in caps]
        if not hit:
            continue
        s = summaries[et.id]
        score = round(100 * len(hit) / len(wanted) * 0.85 + (15 if s["quantity_available"] > 0 else 0), 1)
        ev = [f"Supports {c.replace('_', ' ')}" for c in hit]
        ev.append(f"{s['quantity_available']} of {s['quantity_total']} units free now")
        out.append({**s, "score": score, "evidence": ev})
    out.sort(key=lambda x: (-x["score"], x["name"]))
    return strip_private(out[:limit])


@router.post("/equipment/units/{unit_id}/status")
def set_unit_status(unit_id: str, body: UnitStatusBody, db: Session = Depends(get_db)):
    u = db.get(EquipmentUnit, unit_id)
    if not u:
        raise NotFound(f"Unit '{unit_id}' not found")
    old = u.status
    u.status = body.status
    audit(db, "unit_status_changed", "equipment_unit", u.id, f"{u.unit_name}: {old} -> {body.status}",
          note=body.reason, metadata={"from": old, "to": body.status})
    notify(db, "maintenance", f"{u.unit_name} is now {body.status}",
           body.reason or f"Status changed from {old} to {body.status}.", "equipment_unit", u.id)
    db.commit()
    db.refresh(u)
    st = av.unit_states(db, [u])[u.id]
    return unit_dict(u, st)


@router.get("/equipment/{equipment_id}")
def get_equipment(equipment_id: str, db: Session = Depends(get_db)):
    et = db.get(EquipmentType, equipment_id)
    if not et:
        raise NotFound(f"Equipment '{equipment_id}' not found")
    summary = equipment_summaries(db, [et])[0]
    states = summary.pop("_states")
    units = [unit_dict(u, states[u.id]) for u in et.units]
    others = list(db.scalars(select(EquipmentType).where(EquipmentType.id != et.id)).all())
    caps = set(et.capabilities or [])
    rel = [o for o in others if o.category == et.category or caps & set(o.capabilities or [])]
    rel.sort(key=lambda o: (o.category != et.category, -len(caps & set(o.capabilities or []))))
    alts = strip_private(equipment_summaries(db, rel[:4])) if rel else []
    upcoming = db.scalars(
        select(Booking).join(EquipmentUnit, EquipmentUnit.id == Booking.equipment_unit_id)
        .where(EquipmentUnit.equipment_type_id == et.id, Booking.status == "confirmed", Booking.end_at >= now_utc())
        .order_by(Booking.start_at).limit(10)).all()
    return {**summary, "units": units, "alternatives": alts, "upcoming_bookings": [booking_dict(b) for b in upcoming]}


@router.get("/equipment/{equipment_id}/units")
def get_units(equipment_id: str, db: Session = Depends(get_db)):
    et = db.get(EquipmentType, equipment_id)
    if not et:
        raise NotFound(f"Equipment '{equipment_id}' not found")
    states = av.unit_states(db, list(et.units))
    return [unit_dict(u, states[u.id]) for u in et.units]
