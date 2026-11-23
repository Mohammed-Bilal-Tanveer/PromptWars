import os
import tempfile
from datetime import date, timedelta
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="lablink-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["DEMO_MODE"] = "false"
os.environ["OPENAI_API_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed.demo_data import seed  # noqa: E402
from app.utils_time import campus_tz  # noqa: E402

API = "/api/v1"


@pytest.fixture()
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as s:
        seed(s)
    with SessionLocal() as s:
        yield s


@pytest.fixture()
def client(db):
    with TestClient(app) as c:
        yield c


def workday(n: int) -> date:
    """n-th operating day (Mon-Fri) after today in campus time."""
    from datetime import datetime

    d = datetime.now(campus_tz()).date()
    while n > 0:
        d += timedelta(days=1)
        if d.weekday() < 5:
            n -= 1
    return d


def at(d: date, hhmm: str) -> str:
    """Naive campus-local ISO string."""
    return f"{d.isoformat()}T{hhmm}:00"


def request_body(eq="eq-arduino", d=None, start="10:00", end="12:00", **kw):
    d = d or workday(6)
    body = {"project_title": "Test project", "requester_name": "Test Student", "requester_department_id": "dept-ece",
            "equipment_type_id": eq, "start_at": at(d, start), "end_at": at(d, end), "purpose": "Testing"}
    body.update(kw)
    return body
