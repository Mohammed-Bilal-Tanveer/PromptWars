from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import InvalidState, NotFound, ValidationFailed
from app.models import EquipmentUnit, MaintenanceWindow
from app.schemas.requests import MaintenanceCreate
from app.services.notification_service import audit, notify
from app.services.serializers import maintenance_dict
from app.utils_time import now_utc, to_utc

router = APIRouter(tags=["maintenance"])


@router.get("/maintenance")
def list_maintenance(db: Session = Depends(get_db)):
    rows = db.scalars(select(MaintenanceWindow).order_by(MaintenanceWindow.start_at.desc())).all()
    return [maintenance_dict(m) for m in rows]


@router.post("/maintenance", status_code=201)
def create_maintenance(body: MaintenanceCreate, db: Session = Depends(get_db)):
    unit = db.get(EquipmentUnit, body.equipment_unit_id)
    if not unit:
        raise NotFound("Equipment unit not found")
    s, e = to_utc(body.start_at), to_utc(body.end_at)
    if e <= s:
        raise ValidationFailed("End must be after start", {"reasons": ["End time must be after start time."]})
    m = MaintenanceWindow(equipment_unit_id=unit.id, start_at=s, end_at=e, reason=body.reason, status="active")
    db.add(m)
    db.flush()
    notify(db, "maintenance", "Maintenance scheduled", f"{unit.unit_name}: {body.reason}", "maintenance_window", m.id)
    audit(db, "maintenance_scheduled", "maintenance_window", m.id, f"Maintenance scheduled for {unit.unit_name}",
          note=body.reason)
    db.commit()
    return maintenance_dict(m)


@router.post("/maintenance/{maintenance_id}/end")
def end_maintenance(maintenance_id: str, db: Session = Depends(get_db)):
    m = db.get(MaintenanceWindow, maintenance_id)
    if not m:
        raise NotFound("Maintenance window not found")
    if m.status == "ended":
        raise InvalidState("Maintenance window already ended")
    m.status = "ended"
    now = now_utc()
    if m.end_at > now:
        m.end_at = max(now, m.start_at)
    notify(db, "maintenance", "Maintenance ended", f"{m.equipment_unit.unit_name} is back in service.",
           "maintenance_window", m.id)
    audit(db, "maintenance_ended", "maintenance_window", m.id, "Maintenance window ended")
    db.commit()
    return maintenance_dict(m)
