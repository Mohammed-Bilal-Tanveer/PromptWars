"""Programmatic alembic upgrade (used at startup + tests)."""
import logging
from pathlib import Path

from alembic.config import Config

from alembic import command

log = logging.getLogger("lablink.migrations")
BACKEND_DIR = Path(__file__).resolve().parent.parent


def alembic_config(database_url: str | None = None) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    if database_url:
        cfg.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return cfg


def upgrade_head(database_url: str | None = None) -> None:
    command.upgrade(alembic_config(database_url), "head")
