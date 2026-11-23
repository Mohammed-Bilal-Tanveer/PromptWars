"""Persistent allocation queue / waitlist."""
from tests.conftest import API, request_body, workday

D = workday(6)
GPU = dict(eq="eq-gpu-workstation", d=D, start="14:00", end="16:00")


def _block_all(client):
    """Fill every GPU unit in the window with confirmed bookings; returns booking ids."""
    ids = []
    for i in range(5):
        r = client.post(f"{API}/booking-requests",
                        json=request_body(**GPU, requester_name=f"Blocker {i}", project_title=f"Block {i}"))
        assert r.status_code == 201, r.text
        a = client.post(f"{API}/approvals/{r.json()['id']}/approve", json={})
        assert a.status_code == 200, a.text
        ids.append(a.json()["booking"]["id"])
    return ids


def _join(client, **kw):
    return client.post(f"{API}/booking-requests", json=request_body(**GPU, join_waitlist=True, **kw))


def test_join_only_when_valid_and_fully_booked(client):
    # a unit is free -> normal pending_review even with join_waitlist
    r = _join(client)
    assert r.status_code == 201 and r.json()["status"] == "pending_review"
    _block_all(client)
    r = _join(client, requester_name="Queue Student", project_title="Queued")
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "waitlisted" and body["priority_score"] > 0 and body["booking"] is None
    assert body["queue_position"] == 1


def test_no_flag_still_conflicts_and_invalid_never_waitlisted(client):
    _block_all(client)
    r = client.post(f"{API}/booking-requests", json=request_body(**GPU, requester_name="Q", project_title="Q"))
    assert r.status_code == 409 and r.json()["error"]["code"] == "SLOT_CONFLICT"
    bad = client.post(f"{API}/booking-requests", json=request_body(
        eq="eq-gpu-workstation", d=D, start="16:00", end="14:00", join_waitlist=True))
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "VALIDATION_ERROR"


def test_duplicate_rejected_and_no_booking_created(client):
    _block_all(client)
    before = client.get(f"{API}/bookings?status=confirmed&page_size=200").json()["total"]
    assert _join(client).status_code == 201
    dup = _join(client)
    assert dup.status_code == 400 and dup.json()["error"]["code"] == "VALIDATION_ERROR"
    assert client.get(f"{API}/bookings?status=confirmed&page_size=200").json()["total"] == before


def test_listing_queue_audit_notification(client):
    _block_all(client)
    rid = _join(client).json()["id"]
    assert rid in [x["id"] for x in client.get(f"{API}/booking-requests?status=waitlisted").json()["items"]]
    assert rid in [x["id"] for x in client.get(f"{API}/approvals/queue").json()["items"]]
    detail = client.get(f"{API}/booking-requests/{rid}").json()
    assert any(t["action"] == "queue_joined" for t in detail["timeline"])
    notes = client.get(f"{API}/notifications").json()
    items = notes["items"] if isinstance(notes, dict) else notes
    assert any(n["type"] == "waitlist_joined" for n in items)
    assert client.get(f"{API}/analytics/overview").json()["waitlisted_count"] >= 1


def test_queue_position_ordered_by_priority(client):
    _block_all(client)
    a = _join(client, requester_name="A Student", project_title="A").json()
    b = _join(client, requester_name="B Student", project_title="B").json()
    pos = {x["id"]: client.get(f"{API}/booking-requests/{x['id']}").json()["queue_position"] for x in (a, b)}
    assert sorted(pos.values()) == [1, 2]
    first = max((a, b), key=lambda x: x["priority_score"]) if a["priority_score"] != b["priority_score"] else a
    assert pos[first["id"]] == 1


def test_cancel_removes_from_scheduling(client):
    _block_all(client)
    rid = _join(client).json()["id"]
    r = client.post(f"{API}/scheduling/recommendations", json={"request_ids": [rid]})
    assert r.status_code == 200, r.text
    assert client.get(f"{API}/booking-requests/{rid}").json()["status"] == "waitlisted"  # no side effect
    assert client.post(f"{API}/booking-requests/{rid}/cancel").json()["status"] == "cancelled"
    r = client.post(f"{API}/scheduling/recommendations", json={"request_ids": [rid]})
    assert r.status_code == 409
    assert rid not in [x["id"] for x in client.get(f"{API}/approvals/queue").json()["items"]]


def test_approve_waitlisted_conflicts_then_succeeds(client):
    bookings = _block_all(client)
    rid = _join(client).json()["id"]
    r = client.post(f"{API}/approvals/{rid}/approve", json={})
    assert r.status_code == 409 and r.json()["error"]["code"] == "SLOT_CONFLICT"
    assert client.get(f"{API}/booking-requests/{rid}").json()["status"] == "waitlisted"
    assert client.post(f"{API}/bookings/{bookings[0]}/cancel").status_code == 200
    r = client.post(f"{API}/approvals/{rid}/approve", json={})
    assert r.status_code == 200 and r.json()["request"]["status"] == "confirmed"


def test_reject_waitlisted(client):
    _block_all(client)
    rid = _join(client).json()["id"]
    r = client.post(f"{API}/approvals/{rid}/reject", json={"reason": "No capacity"})
    assert r.status_code == 200 and r.json()["status"] == "rejected"
