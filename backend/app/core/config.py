"""Application settings (env driven). Never log the database URL."""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SQLITE_URL = "sqlite:///./lablink.db"


def normalise_database_url(url: str | None) -> str:
    """Empty -> local SQLite; postgres(ql):// -> postgresql+psycopg://."""
    if not url or not url.strip():
        return DEFAULT_SQLITE_URL
    url = url.strip()
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    app_env: str = "development"
    app_name: str = "LabLink API"
    app_version: str = "1.0.0"
    api_prefix: str = "/api/v1"
    database_url: str = Field(default="", validation_alias="DATABASE_URL")
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_timeout_seconds: float = 25
    openai_max_input_chars: int = 8000
    campus_timezone: str = "Asia/Kolkata"
    frontend_origin: str = "http://localhost:5173"
    demo_mode: bool = True
    log_level: str = "INFO"
    w_deadline: float = 0.40
    w_waiting: float = 0.25
    w_fairness: float = 0.20
    w_preference: float = 0.15
    solver_time_limit_seconds: float = 5.0

    @property
    def resolved_database_url(self) -> str:
        return normalise_database_url(self.database_url)

    @property
    def is_sqlite(self) -> bool:
        return self.resolved_database_url.startswith("sqlite")

    @property
    def cors_origins(self) -> list[str]:
        origins = [o.strip().rstrip("/") for o in self.frontend_origin.split(",") if o.strip()]
        for extra in ("http://localhost:5173", "http://127.0.0.1:5173"):
            if extra not in origins:
                origins.append(extra)
        return origins

    @property
    def ai_configured(self) -> bool:
        return bool(self.openai_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
