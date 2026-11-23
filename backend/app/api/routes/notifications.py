from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import NotFound
from app.models import Notification
from app.services.serializers import count, notification_dict

router = APIRouter(tags=["notifications"])


@router.get("/notifications")
def list_notifications(unread_only: bool = False, limit: int = Query(30, ge=1, le=200), db: Session = Depends(get_db)):
    stmt = select(Notification).order_by(Notification.created_at.desc()).limit(limit)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    items = db.scalars(stmt).all()
    return {"items": [notification_dict(n) for n in items],
            "unread_count": count(db, Notification, Notification.is_read.is_(False))}


@router.post("/notifications/read-all")
def read_all(db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.is_read.is_(False)).values(is_read=True))
    db.commit()
    return {"unread_count": 0}


@router.post("/notifications/{notification_id}/read")
def mark_read(notification_id: str, db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if not n:
        raise NotFound("Notification not found")
    n.is_read = True
    db.commit()
    return notification_dict(n)
