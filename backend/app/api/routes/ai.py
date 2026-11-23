"""Grounded assistant endpoint (read-only)."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.routes.projects import rate_limit
from app.core.database import get_db
from app.schemas.ai import AssistantReply, AssistantRequest
from app.services import ai_service, assistant_service

router = APIRouter(tags=["assistant"])


@router.post("/assistant/message", response_model=AssistantReply)
def assistant_message(body: AssistantRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(ai_service.assistant_limiter, request)
    return assistant_service.answer(db, body)
