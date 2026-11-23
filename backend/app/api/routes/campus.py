from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["campus"])


@router.get("/config/public")
def public_config():
    s = get_settings()
    return {"app_name": s.app_name, "version": s.app_version, "demo_mode": s.demo_mode,
            "ai_configured": s.ai_configured, "campus_timezone": s.campus_timezone,
            "data_label": "Sample campus data"}
