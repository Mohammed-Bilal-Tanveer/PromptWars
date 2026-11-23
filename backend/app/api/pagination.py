"""Shared pagination and list-filter helpers for the REST routers."""
from typing import Any

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models import BookingRequest, EquipmentType
from app.utils_time import local_day_bounds

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
MAX_BOOKING_PAGE_SIZE = 200
MAX_QUERY_LENGTH = 200


def split_csv(value: str | None) -> list[str]:
    """Split a comma separated query value into trimmed, non-empty tokens."""
    return [s.strip() for s in (value or "").split(",") if s.strip()]


def paginate(db: Session, stmt: Select, page: int, page_size: int) -> tuple[int, list[Any]]:
    """Return (total, rows) for one page of ``stmt``."""
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return total, list(rows)


def page_envelope(items: list[Any], total: int, page: int, page_size: int) -> dict[str, Any]:
    """Standard paginated response body from the API contract."""
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def request_filters(stmt: Select, status: str | None, department_id: str | None, equipment_type_id: str | None,
                    date_: Any, q: str | None) -> Select:
    """Apply the shared booking-request list filters."""
    if status:
        stmt = stmt.where(BookingRequest.status.in_(split_csv(status)))
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
