from datetime import timedelta

from tests.conftest import API, at, workday


def _avail(client, eq, d, **params):
    return client.get(f"{API}/equipment/{eq}/availability", params={"date": d.isoformat(), **params}).json()


def test_free_slots_within_opening_hours(client):
    d = workday(6)
    a = _avail(client, "eq-arduino", d)
    assert a["timezone"] == "Asia/Kolkata" and a["lab_open_at"] == "%sT03:30:00Z" % d.isoformat()
    assert a["lab_close_at"].endswith("T12:30:00Z")
    assert a["free_slots"][0]["start_at"] == a["lab_open_at"] and a["free_slots"][-1]["end_at"] == a["lab_close_at"]
    assert a["free_slots"][0]["free_units"] == 8


def test_closed_day_has_no_slots(client):
    d = workday(6)
    while d.weekday() != 6:
        d += timedelta(days=1)
    a = _avail(client, "eq-arduino", d)
    assert a["lab_open_at"] is None and a["free_slots"] == []


def test_maintenance_excluded_from_availability(client):
    d = workday(1)  # 3d printer unit 4 is in maintenance for 3 days
    a = _avail(client, "eq-3d-printer", d)
    u4 = next(u for u in a["units"] if u["unit_id"].endswith("u4"))
    assert any(b["kind"] == "maintenance" for b in u4["busy"])
    assert max(s["free_units"] for s in a["free_slots"]) == 3


def test_booked_slot_shown_busy_with_buffer(client):
    d = workday(1)
    a = _avail(client, "eq-gpu-workstation", d)
    for u in a["units"]:
        assert u["busy"] and u["busy"][0]["kind"] == "booking"
    # fully booked 14:00-16:00 local (+ setup 10 / cleanup 5) => 08:20Z..10:35Z... no free slot in that window
    for s in a["free_slots"]:
        assert not (s["start_at"] < f"{d.isoformat()}T10:30:00Z" and s["end_at"] > f"{d.isoformat()}T08:40:00Z")


def test_requested_window_reasons(client):
    d = workday(6)
    ok = _avail(client, "eq-arduino", d, start=at(d, "10:00"), end=at(d, "11:00"))["requested"]
    assert ok["is_available"] and ok["free_units"] == 8 and ok["reasons"] == []
    bad = _avail(client, "eq-arduino", d, start=at(d, "07:00"), end=at(d, "08:00"))["requested"]
    assert not bad["is_available"] and any("opening hours" in r for r in bad["reasons"])
    full = _avail(client, "eq-gpu-workstation", workday(1), start=at(workday(1), "14:00"), end=at(workday(1), "16:00"))
    assert full["requested"]["free_units"] == 0 and not full["requested"]["is_available"]
    assert client.get(f"{API}/equipment/eq-arduino/availability", params={"start": at(d, "10:00")}).status_code == 400
