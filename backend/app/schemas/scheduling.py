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
    # additive decision-visualiser metadata
    project_title: str | None = None
    deadline: str | None = None
    requested_start_at: str | None = None
    requested_end_at: str | None = None
    eligible_units: int = 0
    hard_constraints_checked: list[str] = []
    shift_minutes: int | None = None


class Weights(BaseModel):
    deadline_urgency: float = 0.40
    waiting_time: float = 0.25
    fairness: float = 0.20
    preference_fit: float = 0.15


class LockedBlock(BaseModel):
    start_at: str
    end_at: str
    kind: Literal["booking", "maintenance"]
    label: str


class RecommendedBlock(BaseModel):
    request_id: str | None = None
    start_at: str
    end_at: str
    project_title: str | None = None


class UnitTimeline(BaseModel):
    unit_id: str
    unit_name: str
    equipment_type_id: str
    locked: list[LockedBlock] = []
    recommended: list[RecommendedBlock] = []


class SolverSummary(BaseModel):
    requests_considered: int
    feasible_assignments: int
    unresolved: int
    units_considered: int
    fixed_blocks: int
    solve_time_ms: float
    horizon_start: str
    horizon_end: str
    horizon_days: int
    grid_minutes: int
    solver_status: Literal["optimal", "feasible", "infeasible", "not_run"]


class SchedulingResponse(BaseModel):
    solver: Literal["cp-sat"] = "cp-sat"
    solver_status: Literal["optimal", "feasible", "infeasible", "not_run"]
    solve_time_ms: float
    weights: Weights
    horizon_days: int
    results: list[SchedulingResult]
    summary: SolverSummary | None = None
    timeline: list[UnitTimeline] = []


class ConflictsResponse(BaseModel):
    conflicts: list[Conflict]
