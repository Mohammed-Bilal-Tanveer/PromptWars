"""Transparent request priority scoring.

priority = W_DEADLINE*urgency + W_WAITING*waiting + W_FAIRNESS*fairness + W_PREFERENCE*preference_fit

All factors are normalised to 0..1. Identity (names) is NEVER a bonus: the requester name only
participates in the *hours already allocated* lookup used for the fairness factor.

Pure functions (no DB) are at the top; ``compute_priority`` is the thin DB wrapper.
"""
from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

DEFAULT_WEIGHTS = {"deadline": 0.40, "waiting": 0.25, "fairness": 0.20, "preference": 0.15}
URGENT_HOURS = 24.0
HORIZON_DAYS = 30.0
NO_DEADLINE_URGENCY = 0.3
WAITING_CAP_HOURS = 72.0
FAIRNESS_WINDOW_DAYS = 14
FAIRNESS_CAP_HOURS = 20.0
PREFERENCE_IN_HOURS = 1.0
PREFERENCE_OFF_HOURS = 0.6


def get_weights() -> dict[str, float]:
    try:
        from app.core.config import get_settings

        s = get_settings()
    except Exception:  # pragma: no cover
        s = None
    return {
        "deadline": float(getattr(s, "w_deadline", DEFAULT_WEIGHTS["deadline"])),
        "waiting": float(getattr(s, "w_waiting", DEFAULT_WEIGHTS["waiting"])),
        "fairness": float(getattr(s, "w_fairness", DEFAULT_WEIGHTS["fairness"])),
        "preference": float(getattr(s, "w_preference", DEFAULT_WEIGHTS["preference"])),
    }


def _utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def deadline_urgency(deadline: datetime | None, now: datetime) -> float:
    """1.0 at/under 24h to deadline (or overdue), linear decay to 0 at 30 days; 0.3 with no deadline."""
    d = _utc(deadline)
    if d is None:
        return NO_DEADLINE_URGENCY
    hours = (d - now).total_seconds() / 3600.0
    if hours <= URGENT_HOURS:
        return 1.0
    span = HORIZON_DAYS * 24.0 - URGENT_HOURS
    return _clamp(1.0 - (hours - URGENT_HOURS) / span)


def waiting_factor(created_at: datetime | None, now: datetime) -> float:
    c = _utc(created_at)
    if c is None:
        return 0.0
    return _clamp((now - c).total_seconds() / 3600.0 / WAITING_CAP_HOURS)


def fairness_factor(recent_hours: float) -> float:
    """Fewer recently allocated hours => higher score."""
    return _clamp(1.0 - min(1.0, max(0.0, recent_hours) / FAIRNESS_CAP_HOURS))


def preference_fit(requested_start: datetime | None, tz_name: str = "Asia/Kolkata") -> float:
    """1.0 if the requested start is within core campus hours 09:00-17:00 local, else 0.6."""
    s = _utc(requested_start)
    if s is None:
        return PREFERENCE_OFF_HOURS
    try:
        local = s.astimezone(ZoneInfo(tz_name))
    except Exception:  # pragma: no cover
        local = s
    return PREFERENCE_IN_HOURS if 9 <= local.hour < 17 else PREFERENCE_OFF_HOURS


def combine(factors: dict[str, float], weights: dict[str, float] | None = None) -> float:
    w = weights or get_weights()
    score = (
        w["deadline"] * factors["deadline_urgency"]
        + w["waiting"] * factors["waiting_time"]
        + w["fairness"] * factors["fairness"]
        + w["preference"] * factors["preference_fit"]
    )
    return round(_clamp(score), 4)


def compute_priority_pure(
    *,
    deadline: datetime | None,
    created_at: datetime | None,
    recent_hours: float,
    requested_start: datetime | None,
    now: datetime | None = None,
    weights: dict[str, float] | None = None,
    tz_name: str = "Asia/Kolkata",
) -> dict[str, Any]:
    now = _utc(now) or datetime.now(UTC)
    factors = {
        "deadline_urgency": round(deadline_urgency(deadline, now), 4),
        "waiting_time": round(waiting_factor(created_at or now, now), 4),
        "fairness": round(fairness_factor(recent_hours), 4),
        "preference_fit": round(preference_fit(requested_start, tz_name), 4),
    }
    return {"score": combine(factors, weights), "factors": factors}


def recent_allocated_hours(db, department_id: str | None, requester_name: str | None, now: datetime) -> float:
    """Hours of confirmed/completed bookings in the last 14 days for this department+requester.

    Keyed on department and (case-insensitive) requester name solely to measure *usage*.
    """
    try:
        from sqlalchemy import select

        from app.models import Booking, BookingRequest  # type: ignore
    except Exception:  # pragma: no cover
        return 0.0
    since = now - timedelta(days=FAIRNESS_WINDOW_DAYS)
    stmt = (
        select(Booking.start_at, Booking.end_at, BookingRequest.requester_department_id, BookingRequest.requester_name)
        .join(BookingRequest, BookingRequest.id == Booking.booking_request_id)
        .where(Booking.status.in_(["confirmed", "completed"]), Booking.end_at >= since)
    )
    total = 0.0
    name = (requester_name or "").strip().lower()
    try:
        rows = db.execute(stmt).all()
    except Exception:
        return 0.0
    for s, e, dept, rname in rows:
        if department_id and dept != department_id:
            continue
        if name and (rname or "").strip().lower() != name:
            continue
        total += max(0.0, (e - s).total_seconds() / 3600.0)
    return total


def _campus_tz() -> str:
    try:
        from app.core.config import get_settings

        return get_settings().campus_timezone or "Asia/Kolkata"
    except Exception:  # pragma: no cover
        return "Asia/Kolkata"


def compute_priority(
    db,
    *,
    deadline,
    created_at,
    requester_department_id,
    requester_name,
    estimated_hours,
    requested_start,
    now=None,
) -> dict:
    now = _utc(now) or datetime.now(UTC)
    recent = recent_allocated_hours(db, requester_department_id, requester_name, now) if db is not None else 0.0
    return compute_priority_pure(
        deadline=deadline,
        created_at=created_at,
        recent_hours=recent,
        requested_start=requested_start,
        now=now,
        tz_name=_campus_tz(),
    )


def reason_codes(factors: dict[str, float]) -> list[str]:
    codes = []
    f = factors
    codes.append("DEADLINE_URGENT" if f["deadline_urgency"] >= 0.8 else "DEADLINE_MODERATE" if f["deadline_urgency"] >= 0.45 else "DEADLINE_RELAXED")
    if f["waiting_time"] >= 0.5:
        codes.append("LONG_WAIT")
    elif f["waiting_time"] >= 0.15:
        codes.append("SOME_WAIT")
    codes.append("FAIRNESS_BOOST" if f["fairness"] >= 0.7 else "FAIRNESS_NEUTRAL" if f["fairness"] >= 0.4 else "FAIRNESS_HEAVY_USER")
    codes.append("PREFERRED_HOURS" if f["preference_fit"] >= 0.99 else "OFF_PEAK_HOURS")
    return codes


_REASON_TEXT = {
    "DEADLINE_URGENT": "Deadline is within a few days, which raises priority.",
    "DEADLINE_MODERATE": "Deadline is approaching, which moderately raises priority.",
    "DEADLINE_RELAXED": "Deadline is far away or not set, so it adds little priority.",
    "LONG_WAIT": "The request has been waiting a long time, which raises priority.",
    "SOME_WAIT": "The request has waited for a while, which slightly raises priority.",
    "FAIRNESS_BOOST": "The requester's department has had few allocated hours recently (fairness boost).",
    "FAIRNESS_NEUTRAL": "Recent allocated hours are moderate, so fairness is neutral.",
    "FAIRNESS_HEAVY_USER": "Recent allocated hours are high, so fairness lowers priority slightly.",
    "PREFERRED_HOURS": "The requested start falls within core campus hours (09:00-17:00).",
    "OFF_PEAK_HOURS": "The requested start is outside core campus hours.",
}


def explain_priority(factors: dict[str, float]) -> list[str]:
    return [_REASON_TEXT[c] for c in reason_codes(factors)]


__all__ = [
    "compute_priority",
    "compute_priority_pure",
    "explain_priority",
    "reason_codes",
    "deadline_urgency",
    "waiting_factor",
    "fairness_factor",
    "preference_fit",
    "combine",
    "get_weights",
    "math",
]
