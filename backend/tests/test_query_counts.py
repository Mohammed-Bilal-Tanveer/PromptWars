"""Regression guard: list endpoints must not issue one-query-per-row (N+1) round trips.

On a remote PostgreSQL every query costs a network round trip, so an endpoint that was instant on local SQLite took
~7 s in production (GET /departments). These tests count SQL statements, which is independent of database speed.
"""
from contextlib import contextmanager

from sqlalchemy import event

from app.core.database import engine

API = "/api/v1"


@contextmanager
def count_queries():
    counter = {"n": 0}

    def _before(conn, cursor, statement, parameters, context, executemany):  # noqa: ARG001
        counter["n"] += 1

    event.listen(engine, "before_cursor_execute", _before)
    try:
        yield counter
    finally:
        event.remove(engine, "before_cursor_execute", _before)


def test_departments_list_uses_few_queries(client):
    with count_queries() as c:
        r = client.get(f"{API}/departments")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 5
    assert sum(d["lab_count"] for d in body) == 9  # the Laboratories number shown on the landing page
    assert c["n"] <= 15, f"GET /departments issued {c['n']} queries (N+1 regression)"


def test_laboratories_list_uses_few_queries(client):
    with count_queries() as c:
        r = client.get(f"{API}/laboratories")
    assert r.status_code == 200
    assert len(r.json()) == 9
    assert c["n"] <= 15, f"GET /laboratories issued {c['n']} queries (N+1 regression)"


def test_equipment_list_uses_few_queries(client):
    with count_queries() as c:
        r = client.get(f"{API}/equipment?page_size=50")
    assert r.status_code == 200
    assert c["n"] <= 20, f"GET /equipment issued {c['n']} queries (N+1 regression)"


def test_overview_exposes_laboratory_count(client):
    r = client.get(f"{API}/analytics/overview")
    assert r.status_code == 200
    body = r.json()
    assert body["laboratory_count"] == 9
    assert body["department_count"] == 5
