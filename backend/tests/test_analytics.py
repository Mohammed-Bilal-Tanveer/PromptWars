import tempfile
from pathlib import Path

from sqlalchemy import create_engine, inspect

from app.migrations import upgrade_head
from tests.conftest import API, request_body


def test_overview_shape_and_seed_values(client):
    o = client.get(f"{API}/analytics/overview").json()
    assert o["total_units"] >= 46 and o["units_maintenance"] >= 1 and o["pending_requests"] == 3
    assert o["is_demo_data"] is True and o["data_label"] == "Sample campus data"
    assert o["units_available"] + o["units_occupied"] + o["units_maintenance"] == o["total_units"]
    assert o["avg_review_minutes"] is not None


def test_analytics_reflect_new_booking(client):
    before = client.get(f"{API}/analytics/overview").json()
    r = client.post(f"{API}/booking-requests", json=request_body(eq="eq-laser-cutter", requester_department_id="dept-mech")).json()
    mid = client.get(f"{API}/analytics/overview").json()
    assert mid["pending_requests"] == before["pending_requests"] + 1
    client.post(f"{API}/approvals/{r['id']}/approve", json={})
    after = client.get(f"{API}/analytics/overview").json()
    assert after["pending_requests"] == before["pending_requests"]
    assert after["confirmed_count"] == before["confirmed_count"] + 1
    assert after["active_bookings"] == before["active_bookings"] + 1
    trends = client.get(f"{API}/analytics/trends").json()
    assert len(trends["peak_hours"]) == 24 and len(trends["daily"]) == 22
    assert sum(d["bookings"] for d in trends["daily"]) > 0


def test_utilisation_rows(client):
    u = client.get(f"{API}/analytics/utilisation").json()
    assert u["window_days"] == 14 and len(u["by_department"]) == 5 and len(u["by_laboratory"]) == 9
    assert all(0 <= r["utilisation_pct"] <= 100 for r in u["by_equipment"])
    assert all("laboratory_name" in r for r in u["by_equipment"])
    assert len(u["underutilised"]) == 5 and u["most_requested"]
    assert u["underutilised"][0]["utilisation_pct"] <= u["underutilised"][-1]["utilisation_pct"]


def test_alembic_builds_fresh_schema():
    p = Path(tempfile.mkdtemp(prefix="lablink-mig-")) / "m.db"
    url = f"sqlite:///{p.as_posix()}"
    upgrade_head(url)
    tables = set(inspect(create_engine(url)).get_table_names())
    assert {"departments", "laboratories", "equipment_types", "equipment_units", "projects", "project_requirements",
            "booking_requests", "bookings", "approvals", "maintenance_windows", "notifications", "audit_events",
            "alembic_version"} <= tables
