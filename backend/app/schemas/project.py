"""Project schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.ai import AnalysisResult


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=8000)
    category: str | None = Field(default=None, max_length=100)
    requester_name: str = Field(min_length=1, max_length=120)
    requester_department_id: str | None = Field(default=None, max_length=64)
    deadline: datetime | None = None
    estimated_total_hours: float | None = Field(default=None, ge=0)
    analysis: AnalysisResult | None = None


class ProjectOut(BaseModel):
    id: str
    title: str
    description: str
    category: str | None = Field(default=None, max_length=100)
    requester_name: str
    requester_department_id: str | None = Field(default=None, max_length=64)
    deadline: str | None = None
    estimated_total_hours: float | None = None
    analysis_source: Literal["openai", "demo_fallback", "manual"] = "manual"
    analysis: AnalysisResult | None = None
    created_at: str
    updated_at: str
