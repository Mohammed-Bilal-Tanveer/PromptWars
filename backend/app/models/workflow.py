from datetime import datetime

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.campus import Department, EquipmentType, EquipmentUnit
from app.models.types import UTCDateTime, new_id, utcnow


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("prj-"))
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    requester_name: Mapped[str] = mapped_column(String(150))
    requester_department_id: Mapped[str | None] = mapped_column(
        ForeignKey("departments.id"), nullable=True, index=True
    )
    deadline: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    estimated_total_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    analysis_source: Mapped[str] = mapped_column(String(20), default="manual")
    analysis_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    requirements: Mapped[list["ProjectRequirement"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectRequirement(Base):
    __tablename__ = "project_requirements"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("pr-"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    requirement_name: Mapped[str] = mapped_column(String(200))
    priority: Mapped[str] = mapped_column(String(20), default="required")
    capability_tag: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    matched_equipment_type_id: Mapped[str | None] = mapped_column(ForeignKey("equipment_types.id"), nullable=True)
    match_status: Mapped[str] = mapped_column(String(20), default="unmatched")
    project: Mapped[Project] = relationship(back_populates="requirements")


class BookingRequest(Base):
    __tablename__ = "booking_requests"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("req-"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    project_title: Mapped[str] = mapped_column(String(300), default="")
    requester_name: Mapped[str] = mapped_column(String(150))
    requester_department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), index=True)
    equipment_type_id: Mapped[str] = mapped_column(ForeignKey("equipment_types.id"), index=True)
    requested_unit_id: Mapped[str | None] = mapped_column(ForeignKey("equipment_units.id"), nullable=True)
    requested_start_at: Mapped[datetime] = mapped_column(UTCDateTime)
    requested_end_at: Mapped[datetime] = mapped_column(UTCDateTime)
    estimated_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    purpose: Mapped[str] = mapped_column(Text, default="")
    deadline: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending_review", index=True)
    priority_score: Mapped[float] = mapped_column(Float, default=0.0)
    priority_factors: Mapped[dict] = mapped_column(JSON, default=dict)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    requires_supervision: Mapped[bool] = mapped_column(Boolean, default=False)
    proposed_start_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    proposed_end_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    proposed_unit_id: Mapped[str | None] = mapped_column(ForeignKey("equipment_units.id"), nullable=True)
    proposed_equipment_type_id: Mapped[str | None] = mapped_column(ForeignKey("equipment_types.id"), nullable=True)
    proposed_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    equipment_type: Mapped[EquipmentType] = relationship(foreign_keys=[equipment_type_id])
    requester_department: Mapped[Department] = relationship(foreign_keys=[requester_department_id])
    requested_unit: Mapped[EquipmentUnit | None] = relationship(foreign_keys=[requested_unit_id])
    bookings: Mapped[list["Booking"]] = relationship(back_populates="booking_request")


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("bk-"))
    booking_request_id: Mapped[str | None] = mapped_column(
        ForeignKey("booking_requests.id"), nullable=True, index=True
    )
    equipment_unit_id: Mapped[str] = mapped_column(ForeignKey("equipment_units.id"), index=True)
    start_at: Mapped[datetime] = mapped_column(UTCDateTime)
    end_at: Mapped[datetime] = mapped_column(UTCDateTime)
    status: Mapped[str] = mapped_column(String(20), default="confirmed", index=True)
    approved_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    booking_request: Mapped[BookingRequest | None] = relationship(back_populates="bookings")
    equipment_unit: Mapped[EquipmentUnit] = relationship()


Index("ix_bookings_unit_range", Booking.equipment_unit_id, Booking.start_at, Booking.end_at)


class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("apr-"))
    booking_request_id: Mapped[str] = mapped_column(ForeignKey("booking_requests.id"), index=True)
    action: Mapped[str] = mapped_column(String(30))
    reviewer_display_name: Mapped[str] = mapped_column(String(150), default="Demo Lab Coordinator")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class MaintenanceWindow(Base):
    __tablename__ = "maintenance_windows"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("mnt-"))
    equipment_unit_id: Mapped[str] = mapped_column(ForeignKey("equipment_units.id"), index=True)
    start_at: Mapped[datetime] = mapped_column(UTCDateTime)
    end_at: Mapped[datetime] = mapped_column(UTCDateTime)
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    equipment_unit: Mapped[EquipmentUnit] = relationship()


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("ntf-"))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text, default="")
    type: Mapped[str] = mapped_column(String(40))
    related_entity_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    related_entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("aud-"))
    event_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    actor: Mapped[str] = mapped_column(String(150), default="System")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
