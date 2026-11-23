"""Programmatic alembic upgrade (used at startup + tests)."""
import logging
from pathlib import Path

from alembic.config import Config

from alembic import command

log = logging.getLogger("lablink.migrations")
BACKEND_DIR = Path(__file__).resolve().parent.parent


def alembic_config(database_url: str | None = None) -> Config:
    """Build an alembic Config rooted at the backend directory."""
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    if database_url:
        cfg.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return cfg


def upgrade_head(database_url: str | None = None) -> None:
    """Upgrade the database to the latest revision."""
    command.upgrade(alembic_config(database_url), "head")
