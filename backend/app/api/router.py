"""Aggregates all v1 routers. Each module under routes/ must expose `router`."""
from fastapi import APIRouter

from app.api.routes import (
    ai,
    analytics,
    approvals,
    availability,
    bookings,
    campus,
    departments,
    equipment,
    health,
    laboratories,
    maintenance,
    notifications,
    projects,
    scheduling,
)

api_router = APIRouter()
for module in (
    health,
    campus,
    departments,
    laboratories,
    equipment,
    availability,
    projects,
    ai,
    bookings,
    scheduling,
    approvals,
    analytics,
    notifications,
    maintenance,
):
    api_router.include_router(module.router)
