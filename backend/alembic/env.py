import app.models  # noqa: F401  (register tables)
from alembic import context
from app.core.config import get_settings
from app.core.database import Base, make_engine

target_metadata = Base.metadata


def _url() -> str:
    # Allow programmatic override (tests) via config attribute, else env settings.
    return context.config.get_main_option("sqlalchemy.url") or get_settings().resolved_database_url


def run_migrations_offline() -> None:
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = make_engine(_url())
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()



if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
