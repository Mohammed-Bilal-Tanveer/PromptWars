from datetime import datetime

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.types import UTCDateTime, utcnow


class Department(Base):
    __tablename__ = "departments"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    building_code: Mapped[str] = mapped_column(String(20), default="")
    scene_position_x: Mapped[float] = mapped_column(Float, default=0)
    scene_position_y: Mapped[float] = mapped_column(Float, default=0)
    scene_position_z: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    laboratories: Mapped[list["Laboratory"]] = relationship(back_populates="department")


class Laboratory(Base):
    __tablename__ = "laboratories"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    code: Mapped[str] = mapped_column(String(50), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    building: Mapped[str] = mapped_column(String(50), default="")
    floor: Mapped[str] = mapped_column(String(20), default="")
    room_number: Mapped[str] = mapped_column(String(20), default="")
    opening_hours: Mapped[dict] = mapped_column(JSON, default=lambda: {"start": "09:00", "end": "18:00"})
    operating_days: Mapped[list] = mapped_column(JSON, default=lambda: [0, 1, 2, 3, 4])
    max_occupancy: Mapped[int] = mapped_column(Integer, default=20)
    capabilities: Mapped[list] = mapped_column(JSON, default=list)
    access_notes: Mapped[str] = mapped_column(Text, default="")
    safety_notes: Mapped[str] = mapped_column(Text, default="")
    scene_position_x: Mapped[float] = mapped_column(Float, default=0)
    scene_position_y: Mapped[float] = mapped_column(Float, default=0)
    scene_position_z: Mapped[float] = mapped_column(Float, default=0)
    scene_anchor_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    department: Mapped[Department] = relationship(back_populates="laboratories")
    equipment_types: Mapped[list["EquipmentType"]] = relationship(back_populates="laboratory")


class EquipmentType(Base):
    __tablename__ = "equipment_types"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    category: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), index=True)
    laboratory_id: Mapped[str] = mapped_column(ForeignKey("laboratories.id"), index=True)
    manufacturer: Mapped[str] = mapped_column(String(100), default="")
    model: Mapped[str] = mapped_column(String(100), default="")
    specifications: Mapped[dict] = mapped_column(JSON, default=dict)
    capabilities: Mapped[list] = mapped_column(JSON, default=list)
    min_booking_minutes: Mapped[int] = mapped_column(Integer, default=30)
    max_booking_minutes: Mapped[int] = mapped_column(Integer, default=480)
    setup_minutes: Mapped[int] = mapped_column(Integer, default=0)
    cleanup_minutes: Mapped[int] = mapped_column(Integer, default=0)
    requires_supervision: Mapped[bool] = mapped_column(Boolean, default=False)
    safety_notes: Mapped[str] = mapped_column(Text, default="")
    access_notes: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    laboratory: Mapped[Laboratory] = relationship(back_populates="equipment_types")
    department: Mapped[Department] = relationship()
    units: Mapped[list["EquipmentUnit"]] = relationship(
        back_populates="equipment_type", order_by="EquipmentUnit.id"
    )


class EquipmentUnit(Base):
    __tablename__ = "equipment_units"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    equipment_type_id: Mapped[str] = mapped_column(ForeignKey("equipment_types.id"), index=True)
    inventory_code: Mapped[str] = mapped_column(String(50), unique=True)
    unit_name: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="operational", index=True)
    condition_notes: Mapped[str] = mapped_column(Text, default="")
    scene_object_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    equipment_type: Mapped[EquipmentType] = relationship(back_populates="units")


Index("ix_units_type_status", EquipmentUnit.equipment_type_id, EquipmentUnit.status)
