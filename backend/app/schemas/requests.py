"""Request bodies + shared response shapes (contract)."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class BookingRequestCreate(BaseModel):
    project_id: str | None = Field(default=None, max_length=64)
    project_title: str = Field(min_length=1, max_length=300)
    requester_name: str = Field(min_length=1, max_length=150)
    requester_department_id: str = Field(max_length=64)
    equipment_type_id: str
    requested_unit_id: str | None = Field(default=None, max_length=80)
    start_at: datetime
    end_at: datetime
    estimated_hours: float | None = Field(default=None, ge=0)
    purpose: str = Field(default="", max_length=4000)
    deadline: datetime | None = None


class ApproveBody(BaseModel):
    note: str | None = Field(default=None, max_length=2000)
    reviewer_name: str | None = Field(default=None, max_length=150)


class RejectBody(BaseModel):
    reason: str = Field(min_length=3, max_length=2000)
    note: str | None = Field(default=None, max_length=2000)


class AlternativeBody(BaseModel):
    start_at: datetime
    end_at: datetime
    equipment_unit_id: str | None = None
    equipment_type_id: str | None = None
    note: str | None = Field(default=None, max_length=2000)


class UnitStatusBody(BaseModel):
    status: Literal["operational", "maintenance", "unavailable"]
    reason: str | None = Field(default=None, max_length=1000)


class MaintenanceCreate(BaseModel):
    equipment_unit_id: str
    start_at: datetime
    end_at: datetime
    reason: str = Field(min_length=1, max_length=1000)


class Paginated(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
