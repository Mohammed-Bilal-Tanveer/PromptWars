from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import analytics_service as svc

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    return svc.overview(db)


@router.get("/utilisation")
def utilisation(db: Session = Depends(get_db)):
    return svc.utilisation(db)


@router.get("/trends")
def trends(db: Session = Depends(get_db)):
    return svc.trends(db)
