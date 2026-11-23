from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import NotFound, ValidationFailed
from app.models import EquipmentType
from app.services.availability_service import compute_availability
from app.utils_time import local, now_utc, to_utc

router = APIRouter(tags=["availability"])


@router.get("/equipment/{equipment_id}/availability")
def availability(equipment_id: str, date_: date | None = Query(default=None, alias="date"),
                 start: datetime | None = None, end: datetime | None = None, db: Session = Depends(get_db)):
    et = db.get(EquipmentType, equipment_id)
    if not et:
        raise NotFound(f"Equipment '{equipment_id}' not found")
    if (start is None) != (end is None):
        raise ValidationFailed("Provide both start and end", {"reasons": ["start and end must be given together"]})
    s = to_utc(start) if start else None
    e = to_utc(end) if end else None
    d = date_ or (local(s).date() if s else local(now_utc()).date())
    return compute_availability(db, et, d, s, e)
