from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.errors import NotFound
from app.models import EquipmentType, Laboratory
from app.services.serializers import equipment_summaries, lab_dict, lab_dicts, strip_private

router = APIRouter(tags=["laboratories"])


@router.get("/laboratories")
def list_labs(department_id: str | None = None, q: str | None = Query(default=None, max_length=200),
              db: Session = Depends(get_db)):
    stmt = select(Laboratory).order_by(Laboratory.name).options(
        selectinload(Laboratory.department),
        selectinload(Laboratory.equipment_types).selectinload(EquipmentType.units))
    if department_id:
        stmt = stmt.where(Laboratory.department_id == department_id)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Laboratory.name).like(like), func.lower(Laboratory.description).like(like),
                              func.lower(Laboratory.code).like(like)))
    return lab_dicts(db, list(db.scalars(stmt).all()))


@router.get("/laboratories/{lab_id}")
def get_lab(lab_id: str, db: Session = Depends(get_db)):
    lab = db.get(Laboratory, lab_id)
    if not lab:
        raise NotFound(f"Laboratory '{lab_id}' not found")
    out = lab_dict(db, lab)
    out["equipment"] = strip_private(equipment_summaries(db, list(lab.equipment_types)))
    return out
