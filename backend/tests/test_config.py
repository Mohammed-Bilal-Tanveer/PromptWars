from sqlalchemy import text
from sqlalchemy.pool import StaticPool  # noqa: F401

from app.core.config import DEFAULT_SQLITE_URL, Settings, normalise_database_url
from app.core.database import engine, make_engine


def test_default_sqlite():
    assert normalise_database_url("") == DEFAULT_SQLITE_URL
    assert normalise_database_url(None) == "sqlite:///./lablink.db"


def test_postgres_normalisation():
    assert normalise_database_url("postgres://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert normalise_database_url("postgresql://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert normalise_database_url("postgresql+psycopg://u:p@h/db") == "postgresql+psycopg://u:p@h/db"


def test_sqlite_fk_pragma_enabled():
    with engine.connect() as conn:
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1
    e = make_engine("sqlite://")
    with e.connect() as conn:
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1


def test_cors_always_allows_local_dev():
    s = Settings(frontend_origin="https://app.example.com/")
    assert "https://app.example.com" in s.cors_origins
    assert "http://localhost:5173" in s.cors_origins and "http://127.0.0.1:5173" in s.cors_origins


def test_weights_default():
    s = Settings()
    assert (s.w_deadline, s.w_waiting, s.w_fairness, s.w_preference) == (0.40, 0.25, 0.20, 0.15)


def test_health_and_public_config(client):
    assert client.get("/api/v1/health").json() == {"status": "ok", "version": "1.0.0", "app": "LabLink API"}
    assert client.get("/api/v1/health/ready").json() == {"status": "ready", "database": "sqlite"}
    cfg = client.get("/api/v1/config/public").json()
    assert cfg["data_label"] == "Sample campus data" and cfg["ai_configured"] is False
    assert cfg["campus_timezone"] == "Asia/Kolkata"


def test_error_format_for_validation_and_404(client):
    r = client.post("/api/v1/booking-requests", json={"foo": 1})
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    r = client.get("/api/v1/equipment/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"
    r = client.get("/api/v1/does-not-exist")
    assert r.status_code == 404 and "error" in r.json()
