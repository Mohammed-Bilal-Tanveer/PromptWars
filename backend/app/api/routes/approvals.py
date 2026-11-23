from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.bookings import paginate, request_filters
from app.core.database import get_db
from app.models import BookingRequest
from app.schemas.requests import AlternativeBody, ApproveBody, RejectBody
from app.services import approval_service as svc
from app.services.serializers import booking_dict, request_dict, request_with_extras

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.get("/queue")
def queue(status: str = "pending_review,waitlisted,alternative_proposed", department_id: str | None = None,
          equipment_type_id: str | None = None, date: date | None = None, page: int = Query(1, ge=1),
          page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    stmt = request_filters(select(BookingRequest), status, department_id, equipment_type_id, date, None).order_by(
        BookingRequest.priority_score.desc(), BookingRequest.created_at)
    total, rows = paginate(db, stmt, page, page_size)
    return {"items": [request_with_extras(db, r) for r in rows], "total": total, "page": page, "page_size": page_size}


@router.post("/{request_id}/approve")
def approve(request_id: str, body: ApproveBody | None = None, db: Session = Depends(get_db)):
    body = body or ApproveBody()
    req, booking = svc.approve(db, request_id, body.note, body.reviewer_name)
    return {"request": request_dict(db, req), "booking": booking_dict(booking)}


@router.post("/{request_id}/reject")
def reject(request_id: str, body: RejectBody, db: Session = Depends(get_db)):
    return request_dict(db, svc.reject(db, request_id, body.reason, body.note))


@router.post("/{request_id}/alternative")
def alternative(request_id: str, body: AlternativeBody, db: Session = Depends(get_db)):
    return request_dict(db, svc.propose_alternative(db, request_id, body))
