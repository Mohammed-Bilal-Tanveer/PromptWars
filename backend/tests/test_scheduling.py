# ruff: noqa: F811
"""Pure CP-SAT scheduling tests (no DB)."""
from datetime import UTC, datetime, timedelta

from app.services import priority as prio
from app.services.scheduling_service import Busy, SolverRequest, SolverUnit, solve

T0 = datetime(2026, 11, 24, 0, 0, tzinfo=UTC)  # Tuesday
H_END = T0 + timedelta(days=2)


def _unit(uid="u1", type_id="eq", name="Unit 1", status="operational", setup=0, cleanup=0, windows=None):
    wins = windows if windows is not None else [(T0 + timedelta(hours=9 + 24 * d), T0 + timedelta(hours=17 + 24 * d)) for d in range(2)]
    return SolverUnit(uid, name, type_id, wins, status, setup, cleanup, "Type")


def _req(rid, priority=0.5, hour=10, dur=120, type_id="eq", **kw):
    return SolverRequest(rid, type_id, "Type", dur, T0 + timedelta(hours=hour), priority, earliest=T0, label=rid, **kw)


def test_deadline_urgency_wins_contested_slot():
    now = T0
    urgent = prio.compute_priority_pure(deadline=now + timedelta(hours=20), created_at=now, recent_hours=0, requested_start=T0 + timedelta(hours=10), now=now)
    relaxed = prio.compute_priority_pure(deadline=now + timedelta(days=25), created_at=now, recent_hours=0, requested_start=T0 + timedelta(hours=10), now=now)
    assert urgent["score"] > relaxed["score"]
    reqs = [_req("A", relaxed["score"]), _req("B", urgent["score"])]
    out = solve(reqs, [_unit()], [], T0, H_END, time_limit=3)
    assert out.assignments["B"].start == T0 + timedelta(hours=10)  # urgent gets the preferred slot
    assert out.assignments["A"] is not None and out.assignments["A"].start != T0 + timedelta(hours=10)
    assert any("contested" in ln or "higher priority" in ln for ln in out.explanations["A"] + out.explanations["B"])


def test_fairness_tiebreak():
    low_use = prio.compute_priority_pure(deadline=None, created_at=T0, recent_hours=0, requested_start=T0 + timedelta(hours=10), now=T0)
    high_use = prio.compute_priority_pure(deadline=None, created_at=T0, recent_hours=19, requested_start=T0 + timedelta(hours=10), now=T0)
    assert low_use["factors"]["fairness"] > high_use["factors"]["fairness"]
    assert low_use["score"] > high_use["score"]
    reqs = [_req("heavy", high_use["score"]), _req("light", low_use["score"])]
    out = solve(reqs, [_unit()], [], T0, H_END, time_limit=3)
    assert out.assignments["light"].start == T0 + timedelta(hours=10)
    assert out.assignments["heavy"].start != T0 + timedelta(hours=10)


def test_priority_is_identity_free():
    a = prio.compute_priority_pure(deadline=None, created_at=T0, recent_hours=3, requested_start=T0 + timedelta(hours=10), now=T0)
    b = prio.compute_priority_pure(deadline=None, created_at=T0, recent_hours=3, requested_start=T0 + timedelta(hours=10), now=T0)
    assert a == b
    assert len(prio.explain_priority(a["factors"])) >= 3


def test_non_operational_and_maintenance_units_never_used():
    units = [_unit("u1", status="maintenance"), _unit("u2", name="Unit 2")]
    busy = [Busy("u2", T0 + timedelta(hours=9), T0 + timedelta(hours=12), "maintenance")]
    out = solve([_req("A", 0.9, hour=10)], units, busy, T0, H_END)
    a = out.assignments["A"]
    assert a.unit_id == "u2"
    assert a.start >= T0 + timedelta(hours=12)


def test_all_units_down_is_infeasible_with_reasons():
    out = solve([_req("A")], [_unit(status="unavailable")], [], T0, H_END)
    assert out.status == "infeasible"
    assert out.assignments["A"] is None
    assert any("maintenance" in r or "unavailable" in r for r in out.infeasible_reasons["A"])


def test_impossible_duration_is_infeasible():
    out = solve([_req("A", dur=12 * 60)], [_unit()], [], T0, H_END)  # longer than any opening window
    assert out.status == "infeasible"
    assert out.infeasible_reasons["A"]


def test_confirmed_bookings_never_displaced_and_buffers_respected():
    busy = [Busy("u1", T0 + timedelta(hours=10), T0 + timedelta(hours=12), "booking")]
    unit = _unit(setup=15, cleanup=15)
    out = solve([_req("A", 0.99, hour=10, dur=60)], [unit], busy, T0, H_END)
    a = out.assignments["A"]
    assert a is not None
    blocked0, blocked1 = T0 + timedelta(hours=10, minutes=-15), T0 + timedelta(hours=12, minutes=15)
    assert not (a.start - timedelta(minutes=15) < blocked1 and blocked0 < a.end + timedelta(minutes=15))
    assert not (a.start < T0 + timedelta(hours=12) and T0 + timedelta(hours=10) < a.end)


def test_no_overlap_between_assigned_requests_and_alternatives():
    units = [_unit("u1", name="U1"), _unit("u2", name="U2")]
    reqs = [_req("A", 0.9), _req("B", 0.8), _req("C", 0.7)]
    out = solve(reqs, units, [], T0, H_END)
    by_unit: dict[str, list] = {}
    for rid in "ABC":
        a = out.assignments[rid]
        assert a is not None
        by_unit.setdefault(a.unit_id, []).append(a)
    for lst in by_unit.values():
        lst.sort(key=lambda x: x.start)
        for x, y in zip(lst, lst[1:], strict=False):
            assert x.end <= y.start
    assert out.alternatives["A"]


def test_solver_time_bounded_and_deterministic():
    units = [_unit(f"u{i}", name=f"U{i}") for i in range(6)]
    reqs = [_req(f"R{i}", 0.3 + 0.05 * i, hour=9 + (i % 4)) for i in range(10)]
    out1 = solve(reqs, units, [], T0, H_END, time_limit=99)  # clamped to <=5s
    out2 = solve(reqs, units, [], T0, H_END, time_limit=99)
    assert out1.solve_time_ms < 7000
    assert {k: (v.unit_id, v.start) for k, v in out1.assignments.items() if v} == {k: (v.unit_id, v.start) for k, v in out2.assignments.items() if v}


def test_no_requests_not_run():
    assert solve([], [_unit()], [], T0, H_END).status == "not_run"


# ---------------------------------------------------------------- endpoint tests (seeded DB)
from tests.test_ai import client  # noqa: E402,F401,F811  (fixture reuse)


def _pending_ids(client):
    from app.core.database import get_db  # noqa: F401

    ids = []
    for st in ("pending_review", "alternative_proposed"):
        r = client.get(f"/api/v1/booking-requests?status={st}&page_size=50")
        if r.status_code == 200:
            ids += [i["id"] for i in r.json()["items"]]
    return ids


def test_recommendations_for_adhoc_request(client):
    r = client.post("/api/v1/scheduling/recommendations", json={"equipment_type_id": "eq-gpu-workstation", "duration_minutes": 120, "horizon_days": 7})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["solver"] == "cp-sat" and j["solver_status"] in ("optimal", "feasible") and j["solve_time_ms"] < 6000
    assert j["weights"]["deadline_urgency"] == 0.4
    res = j["results"][0]
    assert res["request_id"] is None and res["recommended"] and res["recommended"]["unit_id"].startswith("eq-gpu-workstation-u")
    assert res["allocation_status"] in ("feasible", "partially_feasible")
    assert res["explanation"] and res["alternatives"]
    assert all("Z" in res["recommended"][k] for k in ("start_at", "end_at"))


def test_recommendations_joint_for_pending_requests_and_no_mutation(client):
    ids = _pending_ids(client)
    assert ids, "seed should contain pending requests"
    before = client.get("/api/v1/bookings?page_size=100").json()["total"]
    r = client.post("/api/v1/scheduling/recommendations", json={"request_ids": ids})
    assert r.status_code == 200, r.text
    j = r.json()
    assert len(j["results"]) == len(ids)
    for res in j["results"]:
        assert res["request_id"] in ids and res["explanation"]
    assert client.get("/api/v1/bookings?page_size=100").json()["total"] == before  # never auto-confirms


def test_recommendations_validation_and_not_found(client):
    assert client.post("/api/v1/scheduling/recommendations", json={}).status_code == 400
    assert client.post("/api/v1/scheduling/recommendations", json={"request_ids": ["nope"]}).status_code == 404
    assert client.post("/api/v1/scheduling/recommendations", json={"equipment_type_id": "nope", "duration_minutes": 60}).status_code == 404
    assert client.post("/api/v1/scheduling/recommendations", json={"equipment_type_id": "eq-cnc", "duration_minutes": 60, "horizon_days": 30}).status_code == 422


def test_recommendation_avoids_booked_gpu_slot(client):
    from datetime import datetime

    j = client.get("/api/v1/bookings?equipment_type_id=eq-gpu-workstation&page_size=50").json()["items"]
    assert j
    res = client.post("/api/v1/scheduling/recommendations", json={"equipment_type_id": "eq-gpu-workstation", "duration_minutes": 120,
                                                                   "window_start": j[0]["start_at"]}).json()["results"][0]
    rec = res["recommended"]
    p = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))  # noqa: E731
    for b in j:
        if b["equipment_unit_id"] == rec["unit_id"]:
            assert not (p(rec["start_at"]) < p(b["end_at"]) and p(b["start_at"]) < p(rec["end_at"]))


def test_conflicts_endpoint_shapes(client):
    r = client.get("/api/v1/scheduling/conflicts")
    assert r.status_code == 200
    for c in r.json()["conflicts"]:
        assert c["type"] in ("pending_overlap", "maintenance_overlap", "booking_overlap")
        assert c["severity"] in ("high", "medium", "low") and c["start_at"].endswith("Z") and c["message"]


def test_maintenance_overlap_detected(client):
    j = client.get("/api/v1/bookings?equipment_type_id=eq-gpu-workstation&page_size=50").json()["items"]
    b = j[0]
    r = client.post("/api/v1/equipment/units/" + b["equipment_unit_id"] + "/status", json={"status": "maintenance", "reason": "test"})
    assert r.status_code == 200, r.text
    conf = client.get("/api/v1/scheduling/conflicts").json()["conflicts"]
    assert any(c["type"] == "maintenance_overlap" and b["id"] in c["booking_ids"] for c in conf)
