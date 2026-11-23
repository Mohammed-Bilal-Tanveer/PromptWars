"""Schemas for AI analysis + assistant (see docs/API_CONTRACT.md)."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Priority = Literal["required", "recommended", "optional"]
MatchStatus = Literal["exact", "partial", "unavailable", "unmatched"]


class PreferredWindow(BaseModel):
    start_at: datetime
    end_at: datetime


class ProjectAnalyseRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=10, max_length=8000)
    category: str | None = None
    deadline: datetime | None = None
    preferred_department_ids: list[str] | None = None
    preferred_window: PreferredWindow | None = None
    estimated_total_hours: float | None = Field(default=None, ge=0)
    constraints: str | None = Field(default=None, max_length=2000)


class EquipmentRequirement(BaseModel):
    equipment_query: str
    priority: Priority = "required"
    reason: str = ""
    capability_tag: str | None = None


class DepartmentRef(BaseModel):
    id: str
    name: str


class LLMAnalysis(BaseModel):
    """What the model is allowed to produce (no IDs, no availability)."""

    model_config = ConfigDict(extra="ignore")

    project_summary: str
    capabilities: list[str]
    equipment_requirements: list[EquipmentRequirement]
    required_lab_capabilities: list[str]
    suggested_department_names: list[str]
    estimated_total_hours: float = Field(ge=0)
    assumptions: list[str]
    safety_considerations: list[str]
    clarifying_questions: list[str]
    reasoning_summary: str


class MatchCandidate(BaseModel):
    equipment_type_id: str
    name: str
    category: str | None = None
    laboratory_id: str | None = None
    laboratory_name: str | None = None
    department_id: str | None = None
    department_name: str | None = None
    building: str | None = None
    room_label: str | None = None
    score: float
    match_type: Literal["exact_name", "category", "capability", "alternative"]
    evidence: list[str] = []
    total_units: int = 0
    available_units: int = 0
    is_available: bool = False


class RequirementMatch(BaseModel):
    requirement_name: str
    priority: Priority = "required"
    reason: str = ""
    capability_tag: str | None = None
    match_status: MatchStatus
    best: MatchCandidate | None = None
    candidates: list[MatchCandidate] = []


class AnalysisResult(BaseModel):
    analysis_source: Literal["openai", "demo_fallback"]
    is_fallback: bool
    fallback_reason: str | None = None
    project_summary: str = ""
    capabilities: list[str] = []
    equipment_requirements: list[EquipmentRequirement] = []
    required_lab_capabilities: list[str] = []
    suggested_departments: list[DepartmentRef] = []
    estimated_total_hours: float = 0
    assumptions: list[str] = []
    safety_considerations: list[str] = []
    clarifying_questions: list[str] = []
    reasoning_summary: str = ""
    matches: list[RequirementMatch] = []


class AssistantContext(BaseModel):
    equipment_type_id: str | None = None
    booking_request_id: str | None = None
    project_id: str | None = None
    laboratory_id: str | None = None


class AssistantRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    context: AssistantContext | None = None


class AssistantReference(BaseModel):
    type: Literal["equipment", "booking_request", "laboratory", "project"]
    id: str
    label: str


class SuggestedAction(BaseModel):
    label: str
    action: Literal["open_equipment", "open_booking_form", "open_scheduling", "open_approvals", "open_project_lab"]
    params: dict[str, str] = {}


class AssistantReply(BaseModel):
    reply: str
    source: Literal["openai", "deterministic"]
    references: list[AssistantReference] = []
    suggested_actions: list[SuggestedAction] = []
