from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import NotFound
from app.models import Booking, BookingRequest, EquipmentType, EquipmentUnit
from app.schemas.requests import BookingRequestCreate
from app.services import booking_service as svc
from app.services.serializers import booking_dict, request_dict, request_with_extras
from app.utils_time import local_day_bounds, to_utc

router = APIRouter(tags=["bookings"])


def paginate(db: Session, stmt, page: int, page_size: int):
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return total, rows


def request_filters(stmt, status, department_id, equipment_type_id, date_, q):
    if status:
        stmt = stmt.where(BookingRequest.status.in_([s.strip() for s in status.split(",") if s.strip()]))
    if department_id:
        stmt = stmt.join(EquipmentType, EquipmentType.id == BookingRequest.equipment_type_id).where(
            or_(BookingRequest.requester_department_id == department_id, EquipmentType.department_id == department_id))
    if equipment_type_id:
        stmt = stmt.where(BookingRequest.equipment_type_id == equipment_type_id)
    if date_:
        s, e = local_day_bounds(date_)
        stmt = stmt.where(BookingRequest.requested_start_at >= s, BookingRequest.requested_start_at < e)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(BookingRequest.project_title).like(like),
                              func.lower(BookingRequest.requester_name).like(like),
                              func.lower(BookingRequest.purpose).like(like)))
    return stmt


@router.post("/booking-requests", status_code=201)
def create_request(body: BookingRequestCreate, db: Session = Depends(get_db)):
    req = svc.create_request(db, body)
    return request_dict(db, req)


@router.get("/booking-requests")
def list_requests(status: str | None = None, department_id: str | None = None, equipment_type_id: str | None = None,
                  date: date | None = None, q: str | None = Query(default=None, max_length=200),
                  page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    stmt = request_filters(select(BookingRequest), status, department_id, equipment_type_id, date, q).order_by(
        BookingRequest.created_at.desc())
    total, rows = paginate(db, stmt, page, page_size)
    return {"items": [request_dict(db, r) for r in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/booking-requests/{request_id}")
def get_request(request_id: str, db: Session = Depends(get_db)):
    return request_with_extras(db, svc.get_request(db, request_id), detail=True)


@router.post("/booking-requests/{request_id}/cancel")
def cancel_request(request_id: str, db: Session = Depends(get_db)):
    return request_dict(db, svc.cancel_request(db, request_id))


@router.post("/booking-requests/{request_id}/accept-alternative")
def accept_alternative(request_id: str, db: Session = Depends(get_db)):
    req, booking = svc.accept_alternative(db, request_id)
    return {"request": request_dict(db, req), "booking": booking_dict(booking)}


@router.get("/bookings")
def list_bookings(status: str = "confirmed", equipment_type_id: str | None = None, unit_id: str | None = None,
                  laboratory_id: str | None = None, from_: datetime | None = Query(default=None, alias="from"),
                  to: datetime | None = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
                  db: Session = Depends(get_db)):
    stmt = select(Booking).join(EquipmentUnit, EquipmentUnit.id == Booking.equipment_unit_id).join(
        EquipmentType, EquipmentType.id == EquipmentUnit.equipment_type_id)
    if status != "all":
        stmt = stmt.where(Booking.status.in_([s.strip() for s in status.split(",") if s.strip()]))
    if equipment_type_id:
        stmt = stmt.where(EquipmentUnit.equipment_type_id == equipment_type_id)
    if unit_id:
        stmt = stmt.where(Booking.equipment_unit_id == unit_id)
    if laboratory_id:
        stmt = stmt.where(EquipmentType.laboratory_id == laboratory_id)
    if from_:
        stmt = stmt.where(Booking.end_at > to_utc(from_))
    if to:
        stmt = stmt.where(Booking.start_at < to_utc(to))
    stmt = stmt.order_by(Booking.start_at)
    total, rows = paginate(db, stmt, page, page_size)
    return {"items": [booking_dict(b) for b in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/bookings/{booking_id}")
def get_booking(booking_id: str, db: Session = Depends(get_db)):
    b = db.get(Booking, booking_id)
    if not b:
        raise NotFound(f"Booking '{booking_id}' not found")
    return booking_dict(b)


@router.post("/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: str, db: Session = Depends(get_db)):
    return booking_dict(svc.cancel_booking(db, booking_id))
