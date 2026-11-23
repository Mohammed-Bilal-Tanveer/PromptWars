from sqlalchemy import select

from app.models import Approval, AuditEvent, Booking
from tests.conftest import API, request_body, workday


def make(client, **kw):
    kw.setdefault("eq", "eq-laser-cutter")
    kw.setdefault("requester_department_id", "dept-mech")
    r = client.post(f"{API}/booking-requests", json=request_body(**kw))
    assert r.status_code == 201, r.text
    return r.json()


def test_approve_creates_booking_audit_and_notifications(client, db):
    req = make(client)
    r = client.post(f"{API}/approvals/{req['id']}/approve", json={"note": "Looks good"})
    assert r.status_code == 200
    body = r.json()
    assert body["request"]["status"] == "confirmed" and body["booking"]["status"] == "confirmed"
    assert body["booking"]["booking_request_id"] == req["id"] and body["booking"]["approved_at"]
    assert db.scalars(select(Approval).where(Approval.booking_request_id == req["id"], Approval.action == "approved")).first()
    actions = [e.event_type for e in db.scalars(select(AuditEvent).where(AuditEvent.entity_id == req["id"])).all()]
    assert "approved" in actions and "confirmed" in actions and "submitted" in actions
    types = [n["type"] for n in client.get(f"{API}/notifications").json()["items"]]
    assert "request_approved" in types and "booking_confirmed" in types
    assert client.post(f"{API}/approvals/{req['id']}/approve", json={}).status_code == 409


def test_two_pending_same_slot_second_approval_conflicts(client):
    a = make(client, project_title="First")
    b = make(client, project_title="Second")  # both pass creation: nothing confirmed yet
    ok = client.post(f"{API}/approvals/{a['id']}/approve", json={})
    assert ok.status_code == 200
    bad = client.post(f"{API}/approvals/{b['id']}/approve", json={})
    assert bad.status_code == 409
    err = bad.json()["error"]
    assert err["code"] == "SLOT_CONFLICT" and err["details"]["alternatives"]
    # request stays pending_review
    assert client.get(f"{API}/booking-requests/{b['id']}").json()["status"] == "pending_review"
    # only one booking exists for the slot
    d = workday(6)
    bookings = client.get(f"{API}/bookings", params={"equipment_type_id": "eq-laser-cutter"}).json()["items"]
    assert len([x for x in bookings if x["start_at"].startswith(d.isoformat())]) == 1


def test_seeded_conflicting_pending_gpu_request_returns_409(client):
    q = client.get(f"{API}/approvals/queue").json()
    gpu = next(i for i in q["items"] if i["equipment_type_id"] == "eq-gpu-workstation")
    assert gpu["availability_now"]["total_units"] == 5 and gpu["recommendation"]
    r = client.post(f"{API}/approvals/{gpu['id']}/approve", json={})
    assert r.status_code == 409 and r.json()["error"]["details"]["alternatives"]


def test_reject_requires_reason_and_writes_audit(client, db):
    req = make(client, eq="eq-arduino", requester_department_id="dept-ece")
    assert client.post(f"{API}/approvals/{req['id']}/reject", json={}).status_code == 422
    assert client.post(f"{API}/approvals/{req['id']}/reject", json={"reason": "ab"}).status_code == 422
    r = client.post(f"{API}/approvals/{req['id']}/reject", json={"reason": "Lab closed for inspection"})
    assert r.status_code == 200 and r.json()["status"] == "rejected" and "inspection" in r.json()["review_note"]
    assert db.scalars(select(Approval).where(Approval.booking_request_id == req["id"], Approval.action == "rejected")).first()
    assert client.post(f"{API}/approvals/{req['id']}/approve", json={}).status_code == 409


def test_propose_and_accept_alternative(client):
    req = make(client, eq="eq-arduino", requester_department_id="dept-ece")
    d = workday(7)
    r = client.post(f"{API}/approvals/{req['id']}/alternative", json={
        "start_at": f"{d.isoformat()}T14:00:00", "end_at": f"{d.isoformat()}T16:00:00", "note": "Try the afternoon"})
    assert r.status_code == 200 and r.json()["status"] == "alternative_proposed"
    assert r.json()["proposed_alternative"]["note"] == "Try the afternoon"
    acc = client.post(f"{API}/booking-requests/{req['id']}/accept-alternative")
    assert acc.status_code == 200
    assert acc.json()["request"]["status"] == "confirmed" and acc.json()["booking"]["start_at"].startswith(d.isoformat())
    assert client.post(f"{API}/booking-requests/{req['id']}/accept-alternative").status_code == 409


def test_infeasible_alternative_rejected(client):
    req = make(client, eq="eq-arduino", requester_department_id="dept-ece")
    d = workday(7)
    r = client.post(f"{API}/approvals/{req['id']}/alternative", json={
        "start_at": f"{d.isoformat()}T01:00:00", "end_at": f"{d.isoformat()}T02:00:00"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "SLOT_CONFLICT"


def test_cancellation_frees_availability(client):
    d = workday(6)
    req = make(client)
    booking = client.post(f"{API}/approvals/{req['id']}/approve", json={}).json()["booking"]
    av = client.get(f"{API}/equipment/eq-laser-cutter/availability",
                    params={"date": d.isoformat(), "start": f"{d.isoformat()}T10:00", "end": f"{d.isoformat()}T12:00"}).json()
    assert av["requested"]["is_available"] is False
    c = client.post(f"{API}/bookings/{booking['id']}/cancel")
    assert c.status_code == 200 and c.json()["status"] == "cancelled"
    av = client.get(f"{API}/equipment/eq-laser-cutter/availability",
                    params={"date": d.isoformat(), "start": f"{d.isoformat()}T10:00", "end": f"{d.isoformat()}T12:00"}).json()
    assert av["requested"]["is_available"] is True
    assert client.get(f"{API}/booking-requests/{req['id']}").json()["status"] == "cancelled"


def test_cancel_confirmed_request_cancels_booking(client, db):
    req = make(client)
    booking = client.post(f"{API}/approvals/{req['id']}/approve", json={}).json()["booking"]
    assert client.post(f"{API}/booking-requests/{req['id']}/cancel").json()["status"] == "cancelled"
    assert db.get(Booking, booking["id"]).status == "cancelled"
