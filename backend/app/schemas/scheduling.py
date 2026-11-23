"""Schemas for scheduling recommendations (see docs/API_CONTRACT.md)."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PriorityFactors(BaseModel):
    deadline_urgency: float
    waiting_time: float
    fairness: float
    preference_fit: float


class SchedulingRequestBody(BaseModel):
    request_ids: list[str] | None = None
    equipment_type_id: str | None = None
    window_start: datetime | None = None
    window_end: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=24 * 60)
    deadline: datetime | None = None
    horizon_days: int = Field(default=7, ge=1, le=14)


class Conflict(BaseModel):
    id: str
    type: Literal["pending_overlap", "maintenance_overlap", "booking_overlap"]
    severity: Literal["high", "medium", "low"]
    equipment_type_id: str
    equipment_name: str
    request_ids: list[str] = []
    booking_ids: list[str] = []
    start_at: str
    end_at: str
    message: str


class Alternative(BaseModel):
    equipment_type_id: str
    equipment_name: str
    unit_id: str
    unit_name: str
    start_at: str
    end_at: str
    reason: str
    is_alternative_equipment: bool = False
    shift_minutes: int = 0


class Recommended(BaseModel):
    unit_id: str
    unit_name: str
    start_at: str
    end_at: str


class SchedulingResult(BaseModel):
    request_id: str | None = None
    equipment_type_id: str
    equipment_name: str
    allocation_status: Literal["feasible", "partially_feasible", "infeasible"]
    recommended: Recommended | None = None
    priority_score: float
    priority_factors: PriorityFactors
    explanation: list[str] = []
    conflicts: list[Conflict] = []
    alternatives: list[Alternative] = []
    assumptions: list[str] = []


class Weights(BaseModel):
    deadline_urgency: float = 0.40
    waiting_time: float = 0.25
    fairness: float = 0.20
    preference_fit: float = 0.15


class SchedulingResponse(BaseModel):
    solver: Literal["cp-sat"] = "cp-sat"
    solver_status: Literal["optimal", "feasible", "infeasible", "not_run"]
    solve_time_ms: float
    weights: Weights
    horizon_days: int
    results: list[SchedulingResult]


class ConflictsResponse(BaseModel):
    conflicts: list[Conflict]
