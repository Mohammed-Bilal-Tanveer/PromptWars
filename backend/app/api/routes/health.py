"""Liveness and readiness probes."""
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import dialect_name, get_db
from app.core.errors import error_body

log = logging.getLogger("lablink.health")
router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness probe: always cheap, never touches the database."""
    s = get_settings()
    return {"status": "ok", "version": s.app_version, "app": s.app_name}


@router.get("/health/ready")
def ready(db: Session = Depends(get_db)):
    """Readiness probe: verifies the database answers a trivial query."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        log.exception("Readiness check failed")
        return JSONResponse(status_code=503, content=error_body("INTERNAL_ERROR", "Database unavailable"))
    return {"status": "ready", "database": "sqlite" if dialect_name(db) == "sqlite" else "postgresql"}
