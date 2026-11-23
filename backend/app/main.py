"""LabLink API entrypoint."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app.core.errors import register_exception_handlers
from app.core.logging import setup_logging

log = logging.getLogger("lablink")


def init_database() -> None:
    """Run migrations (fallback create_all) then the idempotent seed."""
    try:
        from app.migrations import upgrade_head

        upgrade_head()
    except Exception as exc:  # noqa: BLE001
        log.warning("Alembic upgrade failed (%s); falling back to create_all", type(exc).__name__)
        import app.models  # noqa: F401

        Base.metadata.create_all(bind=engine)
    from app.seed.demo_data import seed

    with SessionLocal() as db:
        seed(db)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    setup_logging()
    if settings.demo_mode:
        try:
            init_database()
        except Exception:  # noqa: BLE001
            log.exception("Startup initialisation failed")
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
