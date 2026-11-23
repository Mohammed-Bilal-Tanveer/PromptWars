"""Controlled demo reset. Restores only the fictional seed scenario; see services/demo_service.py."""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.projects import rate_limit
from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import AppError, ValidationFailed
from app.services import ai_service, demo_service

router = APIRouter(prefix="/demo", tags=["demo"])

TOKEN_LIMIT_PER_WINDOW = 5
TOKEN_LIMIT_WINDOW_SECONDS = 60.0

token_limiter = ai_service.SlidingWindowLimiter(TOKEN_LIMIT_PER_WINDOW, TOKEN_LIMIT_WINDOW_SECONDS)


class ResetBody(BaseModel):
    """Single-use reset token plus the typed confirmation phrase."""

    token: str = ""
    confirm: str = ""


def _require_enabled() -> None:
    if not get_settings().demo_reset_active:
        raise AppError("Demo reset is disabled in this environment.", status_code=403, code="DEMO_RESET_DISABLED")


@router.post("/reset-token")
def reset_token(request: Request) -> dict[str, str | int]:
    _require_enabled()
    rate_limit(token_limiter, request)
    return {"token": demo_service.issue_token(), "expires_in_seconds": demo_service.TOKEN_TTL_SECONDS}


@router.post("/reset")
def reset(body: ResetBody, request: Request, db: Session = Depends(get_db)) -> dict:
    _require_enabled()
    if body.confirm != demo_service.CONFIRM_TEXT:
        raise ValidationFailed(f'Type "{demo_service.CONFIRM_TEXT}" to confirm.', {"field": "confirm"})
    if not demo_service.consume_token(body.token):
        raise ValidationFailed("Reset token is invalid, expired or already used.", {"field": "token"})
    restored = demo_service.reset_demo_scenario(db)
    return {"status": "reset", "restored": restored}
