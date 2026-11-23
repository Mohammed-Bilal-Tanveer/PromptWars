"""SQLAlchemy engine/session setup. SQLite locally, PostgreSQL via DATABASE_URL."""
from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

SQLITE_BUSY_TIMEOUT_S = 15


class Base(DeclarativeBase):
    """Declarative base shared by every ORM model."""


def make_engine(url: str) -> Engine:
    """Create an engine: SQLite (with FK enforcement) locally, PostgreSQL otherwise."""
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": SQLITE_BUSY_TIMEOUT_S})

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn, _record):  # pragma: no cover - trivial
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute(f"PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_S * 1000}")
            cur.close()

        return engine
    return create_engine(url, pool_pre_ping=True)


engine: Engine = make_engine(get_settings().resolved_database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def dialect_name(db: Session) -> str:
    """SQLAlchemy dialect name of the session bind (e.g. sqlite, postgresql)."""
    return db.get_bind().dialect.name
