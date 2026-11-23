import time

import pytest
from sqlalchemy import func, select

from app.api.routes import demo as demo_routes
from app.core.config import Settings, get_settings
from app.models import (
    AuditEvent,
    Booking,
    BookingRequest,
    Department,
    EquipmentType,
    EquipmentUnit,
    MaintenanceWindow,
    Notification,
)
from app.services import demo_service
from tests.conftest import API, request_body, workday

CONFIRM = "RESET DEMO SCENARIO"


@pytest.fixture()
def enabled(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "demo_mode", True)
    monkeypatch.setattr(s, "demo_reset_enabled", True)
    demo_service.clear_tokens()
    demo_routes.token_limiter.reset()
    yield s
    demo_service.clear_tokens()
    demo_routes.token_limiter.reset()


def token(client) -> str:
    r = client.post(f"{API}/demo/reset-token")
    assert r.status_code == 200, r.text
    assert r.json()["expires_in_seconds"] == 120
    return r.json()["token"]


def do_reset(client, tok=None, confirm=CONFIRM):
    return client.post(f"{API}/demo/reset", json={"token": tok if tok is not None else token(client), "confirm": confirm})


def test_default_flag_is_off_everywhere():
    # explicit opt-in only: a deployment that forgets APP_ENV must still be safe
    assert Settings(app_env="production", demo_mode=True).demo_reset_enabled is False
    assert Settings(app_env="development").demo_reset_enabled is False
    assert Settings().demo_reset_enabled is False
    assert Settings(demo_reset_enabled=True).demo_reset_enabled is True


def test_disabled_in_production(client, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "demo_mode", True)
    monkeypatch.setattr(s, "demo_reset_enabled", Settings(app_env="production").demo_reset_enabled)
    assert client.post(f"{API}/demo/reset-token").status_code == 403
    r = client.post(f"{API}/demo/reset", json={"token": "x", "confirm": CONFIRM})
    assert r.status_code == 403 and r.json()["error"]["code"] == "DEMO_RESET_DISABLED"
    assert client.get(f"{API}/config/public").json()["demo_reset_enabled"] is False


def test_requires_demo_mode(client, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "demo_mode", False)
    monkeypatch.setattr(s, "demo_reset_enabled", True)
    assert client.post(f"{API}/demo/reset-token").status_code == 403
    assert client.get(f"{API}/config/public").json()["demo_reset_enabled"] is False


def test_public_config_flag(client, enabled):
    assert client.get(f"{API}/config/public").json()["demo_reset_enabled"] is True


def test_token_is_one_time(client, enabled):
    tok = token(client)
    assert do_reset(client, tok).status_code == 200
    r = do_reset(client, tok)
    assert r.status_code == 400 and r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_token_expiry(client, enabled):
    tok = token(client)
    with demo_service._lock:
        demo_service._tokens[tok] = time.monotonic() - 1
    assert do_reset(client, tok).status_code == 400
    assert do_reset(client, "not-a-token").status_code == 400


def test_wrong_confirm_text(client, enabled):
    tok = token(client)
    for bad in ("", "reset demo scenario", "RESET DATABASE"):
        r = do_reset(client, tok, bad)
        assert r.status_code == 400 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert do_reset(client, tok).status_code == 200  # a wrong confirm does not burn the token


def test_rate_limit(client, enabled):
    for _ in range(5):
        assert client.post(f"{API}/demo/reset-token").status_code == 200
    r = client.post(f"{API}/demo/reset-token")
    assert r.status_code == 429 and r.json()["error"]["code"] == "RATE_LIMITED"


def _catalogue(db):
    return tuple(db.scalar(select(func.count()).select_from(m)) for m in (Department, EquipmentType, EquipmentUnit))


def test_reset_restores_seed_and_removes_user_rows(client, db, enabled):
    from app.models import Laboratory

    before_cat = _catalogue(db)
    assert before_cat == (5, 22, 74)
    labs = db.scalar(select(func.count()).select_from(Laboratory))
    assert labs == 9
    seed_ids = set(db.scalars(select(BookingRequest.id).where(BookingRequest.id.like("req-%"))))
    seed_bks = set(db.scalars(select(Booking.id)))
    seed_pending = db.scalar(select(BookingRequest).where(BookingRequest.id.like("req-seed-%-pcnc")))
    pend_id = seed_pending.id

    # user activity: new request approved, a seed request approved, maintenance added, a project
    mine = client.post(f"{API}/booking-requests", json=request_body(d=workday(8))).json()
    assert client.post(f"{API}/approvals/{mine['id']}/approve", json={}).status_code == 200
    assert client.post(f"{API}/approvals/{pend_id}/reject", json={"reason": "no capacity", "note": "no"}).status_code == 200
    unit = "eq-arduino-u1"
    d = workday(9)
    m = client.post(f"{API}/maintenance", json={"equipment_unit_id": unit, "start_at": f"{d}T09:00:00",
                                                  "end_at": f"{d}T17:00:00", "reason": "User maintenance"})
    assert m.status_code == 201
    proj = client.post(f"{API}/projects", json={"title": "Mine", "description": "x", "requester_name": "T",
                                                  "requester_department_id": "dept-ece"})

    r = do_reset(client)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "reset"
    assert body["restored"]["requests_removed"] == 1
    assert body["restored"]["bookings_removed"] >= 1
    assert body["restored"]["maintenance_removed"] == 1
    assert proj.status_code == 201 and body["restored"]["projects_removed"] >= 1

    db.expire_all()
    assert db.get(BookingRequest, mine["id"]) is None
    assert db.scalar(select(MaintenanceWindow).where(MaintenanceWindow.reason == "User maintenance")) is None
    assert db.scalar(select(Notification).where(Notification.related_entity_id == mine["id"])) is None
    assert db.scalar(select(AuditEvent).where(AuditEvent.entity_id == mine["id"])) is None
    assert db.get(BookingRequest, pend_id).status == "pending_review"
    assert db.get(BookingRequest, pend_id).reviewed_at is None
    # seed rows untouched / present, catalogue unchanged
    assert seed_ids <= set(db.scalars(select(BookingRequest.id)))
    assert seed_bks <= set(db.scalars(select(Booking.id)))
    assert _catalogue(db) == before_cat
    assert db.scalar(select(func.count()).select_from(Laboratory)) == 9
    assert db.scalar(select(MaintenanceWindow).where(MaintenanceWindow.equipment_unit_id == "eq-3d-printer-u4",
                                                     MaintenanceWindow.status == "active")) is not None
    assert db.scalar(select(AuditEvent).where(AuditEvent.event_type == "demo_reset")) is not None
    assert db.scalar(select(Notification).where(Notification.title == "Demo scenario reset")) is not None


def test_reset_recreates_cancelled_or_deleted_seed_booking(client, db, enabled):
    bk = db.scalar(select(Booking).where(Booking.id.like("bk-seed-%-rpi")))
    req_id = bk.booking_request_id
    bid = bk.id
    db.delete(bk)
    req = db.get(BookingRequest, req_id)
    req.status = "cancelled"
    db.commit()
    assert do_reset(client).status_code == 200
    db.expire_all()
    assert db.get(Booking, bid).status == "confirmed"
    assert db.get(BookingRequest, req_id).status == "confirmed"


def test_reset_is_idempotent_and_noop_on_clean_seed(client, db, enabled):
    n_req = db.scalar(select(func.count()).select_from(BookingRequest))
    n_bk = db.scalar(select(func.count()).select_from(Booking))
    r = do_reset(client).json()["restored"]
    assert r == {"requests_removed": 0, "bookings_removed": 0, "projects_removed": 0, "maintenance_removed": 0}
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(BookingRequest)) == n_req
    assert db.scalar(select(func.count()).select_from(Booking)) == n_bk
