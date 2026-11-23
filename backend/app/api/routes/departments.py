from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import NotFound
from app.models import Department
from app.services.serializers import dept_dict, lab_dict

router = APIRouter(tags=["departments"])


@router.get("/departments")
def list_departments(db: Session = Depends(get_db)):
    return [dept_dict(db, d) for d in db.scalars(select(Department).order_by(Department.name)).all()]


@router.get("/departments/{department_id}")
def get_department(department_id: str, db: Session = Depends(get_db)):
    d = db.get(Department, department_id)
    if not d:
        raise NotFound(f"Department '{department_id}' not found")
    out = dept_dict(db, d)
    out["laboratories"] = [lab_dict(db, lab) for lab in d.laboratories]
    return out
