"""Booking request submission and confirmed-booking listing."""
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.pagination import (
    DEFAULT_PAGE_SIZE,
    MAX_BOOKING_PAGE_SIZE,
    MAX_PAGE_SIZE,
    MAX_QUERY_LENGTH,
    page_envelope,
    paginate,
    request_filters,
    split_csv,
)
from app.core.database import get_db
from app.core.errors import NotFound
from app.models import Booking, BookingRequest, EquipmentType, EquipmentUnit
from app.schemas.requests import BookingRequestCreate
from app.services import booking_service as svc
from app.services.serializers import booking_dict, request_dict, request_with_extras
from app.utils_time import to_utc

router = APIRouter(tags=["bookings"])


@router.post("/booking-requests", status_code=201)
def create_request(body: BookingRequestCreate, db: Session = Depends(get_db)):
    req = svc.create_request(db, body)
    return request_dict(db, req)


@router.get("/booking-requests")
def list_requests(status: str | None = None, department_id: str | None = None, equipment_type_id: str | None = None,
                  date: date | None = None, q: str | None = Query(default=None, max_length=MAX_QUERY_LENGTH),
                  page: int = Query(1, ge=1), page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE), db: Session = Depends(get_db)):
    stmt = request_filters(select(BookingRequest), status, department_id, equipment_type_id, date, q).order_by(
        BookingRequest.created_at.desc())
    total, rows = paginate(db, stmt, page, page_size)
    return page_envelope([request_dict(db, r) for r in rows], total, page, page_size)


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
                  to: datetime | None = None, page: int = Query(1, ge=1), page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_BOOKING_PAGE_SIZE),
                  db: Session = Depends(get_db)):
    stmt = select(Booking).join(EquipmentUnit, EquipmentUnit.id == Booking.equipment_unit_id).join(
        EquipmentType, EquipmentType.id == EquipmentUnit.equipment_type_id)
    if status != "all":
        stmt = stmt.where(Booking.status.in_(split_csv(status)))
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
    return page_envelope([booking_dict(b) for b in rows], total, page, page_size)


@router.get("/bookings/{booking_id}")
def get_booking(booking_id: str, db: Session = Depends(get_db)):
    b = db.get(Booking, booking_id)
    if not b:
        raise NotFound(f"Booking '{booking_id}' not found")
    return booking_dict(b)


@router.post("/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: str, db: Session = Depends(get_db)):
    return booking_dict(svc.cancel_booking(db, booking_id))
