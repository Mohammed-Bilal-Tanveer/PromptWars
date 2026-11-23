from tests.conftest import API, at, request_body, workday


def post(client, **kw):
    return client.post(f"{API}/booking-requests", json=request_body(**kw))


def test_create_request_success(client):
    r = post(client)
    assert r.status_code == 201
    b = r.json()
    assert b["status"] == "pending_review" and b["equipment_name"] and 0 <= b["priority_score"] <= 1
    assert set(b["priority_factors"]) == {"deadline_urgency", "waiting_time", "fairness", "preference_fit"}
    assert b["requested_start_at"].endswith("Z") and b["project_id"]
    assert b["requires_supervision"] is False
    detail = client.get(f"{API}/booking-requests/{b['id']}").json()
    assert detail["timeline"][0]["action"] == "submitted" and detail["availability_now"]["total_units"] == 8
    assert "recommendation" in detail
    n = client.get(f"{API}/notifications").json()["items"]
    assert any(x["type"] == "request_submitted" and x["related_entity_id"] == b["id"] for x in n)


def test_supervision_flagged_not_blocked(client):
    r = post(client, eq="eq-cnc", requester_department_id="dept-mech")
    assert r.status_code == 201 and r.json()["requires_supervision"] is True


def test_invalid_ranges_rejected(client):
    d = workday(6)
    r = post(client, start="12:00", end="10:00")
    assert r.status_code == 400 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert r.json()["error"]["details"]["reasons"]
    r = post(client, start="10:00", end="10:00")
    assert r.status_code == 400
    r = post(client, eq="eq-gpu-workstation", start="10:00", end="10:30")  # min 60
    assert r.status_code == 400 and "Minimum" in r.json()["error"]["details"]["reasons"][0]
    r = post(client, eq="eq-arduino", start="09:00", end="18:00")  # 9h > 8h max
    assert r.status_code == 400 and "Maximum" in r.json()["error"]["details"]["reasons"][0]
    assert d  # silence


def test_past_and_outside_hours_and_closed_day(client):
    r = client.post(f"{API}/booking-requests", json=request_body(d=workday(-0) if False else workday(1)) | {
        "start_at": "2020-01-06T10:00:00", "end_at": "2020-01-06T11:00:00"})
    assert r.status_code == 400 and any("past" in x for x in r.json()["error"]["details"]["reasons"])
    r = post(client, start="07:00", end="09:00")
    assert r.status_code == 400 and any("opening hours" in x for x in r.json()["error"]["details"]["reasons"])
    r = post(client, start="17:00", end="19:00")
    assert r.status_code == 400
    d = workday(6)
    while d.weekday() != 5:
        d = d.replace(day=d.day) if False else d.__class__.fromordinal(d.toordinal() + 1)
    r = client.post(f"{API}/booking-requests", json=request_body(d=d))
    assert r.status_code == 400 and any("closed" in x for x in r.json()["error"]["details"]["reasons"])


def test_unknown_equipment_404_and_unknown_department(client):
    assert post(client, eq="eq-nope").status_code == 404
    assert post(client, requester_department_id="dept-x").status_code == 400


def test_overlap_rejected_with_alternatives(client):
    d = workday(1)
    r = post(client, eq="eq-gpu-workstation", d=d, start="14:00", end="16:00", requester_department_id="dept-cs")
    assert r.status_code == 409
    err = r.json()["error"]
    assert err["code"] == "SLOT_CONFLICT" and err["details"]["reasons"]
    alts = err["details"]["alternatives"]
    assert 1 <= len(alts) <= 5
    shifts = [a["shift_minutes"] for a in alts]
    assert shifts == sorted(shifts)
    for a in alts:
        assert {"equipment_type_id", "equipment_name", "unit_id", "unit_name", "start_at", "end_at", "reason",
                "is_alternative_equipment", "shift_minutes"} <= set(a)
    # request was not created
    reqs = client.get(f"{API}/booking-requests", params={"q": "Test project"}).json()
    assert reqs["total"] == 0


def test_partial_overlap_and_buffers(client):
    d = workday(1)
    # GPU seeded booking 14:00-16:00 (setup 10, cleanup 5): 16:00 start collides with cleanup buffer
    assert post(client, eq="eq-gpu-workstation", d=d, start="16:00", end="17:00").status_code == 409
    assert post(client, eq="eq-gpu-workstation", d=d, start="15:00", end="17:00").status_code == 409
    # adjacent slots (after buffer / before setup) are allowed: half-open intervals
    assert post(client, eq="eq-gpu-workstation", d=d, start="16:05", end="17:05").status_code == 201
    assert post(client, eq="eq-gpu-workstation", d=d, start="12:50", end="13:50").status_code == 201


def test_maintenance_blocks_single_unit(client):
    from tests.conftest import at as _at

    d = workday(7)
    r = client.post(f"{API}/maintenance", json={"equipment_unit_id": "eq-laser-cutter-u1", "start_at": _at(d, "09:00"),
                                                  "end_at": _at(d, "18:00"), "reason": "Tube replacement"})
    assert r.status_code == 201
    r = post(client, eq="eq-laser-cutter", d=d, requester_department_id="dept-mech")
    assert r.status_code == 409 and r.json()["error"]["code"] == "SLOT_CONFLICT"


def test_cancel_request_and_booking_list(client):
    b = post(client).json()
    c = client.post(f"{API}/booking-requests/{b['id']}/cancel")
    assert c.status_code == 200 and c.json()["status"] == "cancelled"
    assert client.post(f"{API}/booking-requests/{b['id']}/cancel").status_code == 409
    bookings = client.get(f"{API}/bookings").json()
    assert bookings["total"] >= 8 and all(x["status"] == "confirmed" for x in bookings["items"])
    first = bookings["items"][0]
    assert client.get(f"{API}/bookings/{first['id']}").json()["id"] == first["id"]
    assert client.get(f"{API}/bookings/nope").status_code == 404


def test_list_requests_filters(client):
    r = client.get(f"{API}/booking-requests", params={"status": "pending_review,confirmed"}).json()
    assert r["total"] >= 7
    r = client.get(f"{API}/booking-requests", params={"status": "pending_review", "department_id": "dept-mech"}).json()
    assert r["total"] >= 1 and all(i["status"] == "pending_review" for i in r["items"])
    assert at(workday(1), "10:00")
