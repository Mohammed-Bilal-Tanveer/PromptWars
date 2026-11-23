"""Additive summary/timeline metadata on /scheduling/recommendations; recommendations never create bookings."""
from tests.test_scheduling import _pending_ids

API = "/api/v1"


def _counts(client):
    return (client.get(f"{API}/bookings?page_size=100").json()["total"],
            client.get(f"{API}/booking-requests?page_size=100").json()["total"])


def test_summary_and_timeline_fields(client):
    ids = _pending_ids(client)
    assert ids
    before = _counts(client)
    j = client.post(f"{API}/scheduling/recommendations", json={"request_ids": ids}).json()
    s = j["summary"]
    for k in ("requests_considered", "feasible_assignments", "unresolved", "units_considered", "fixed_blocks", "solve_time_ms",
              "horizon_start", "horizon_end", "horizon_days", "grid_minutes", "solver_status"):
        assert k in s, k
    assert s["solver_status"] in ("optimal", "feasible", "infeasible")  # real CP-SAT status
    assert s["solver_status"] == j["solver_status"]
    assert s["requests_considered"] == len(ids) == len(j["results"])
    assigned = sum(1 for r in j["results"] if r["recommended"])
    assert s["feasible_assignments"] == assigned and s["unresolved"] == len(ids) - assigned
    assert s["units_considered"] == len(j["timeline"]) > 0
    assert s["grid_minutes"] == 15 and s["horizon_days"] == 7
    for lane in j["timeline"]:
        assert {"unit_id", "unit_name", "equipment_type_id", "locked", "recommended"} <= set(lane)
        for b in lane["locked"]:
            assert b["kind"] in ("booking", "maintenance")
    assert sum(len(x["locked"]) for x in j["timeline"]) == s["fixed_blocks"]
    assert sum(len(x["recommended"]) for x in j["timeline"]) == assigned
    for r in j["results"]:
        assert r["hard_constraints_checked"]
        assert "eligible_units" in r and "project_title" in r
        if r["recommended"]:
            assert isinstance(r["shift_minutes"], int)
    assert _counts(client) == before  # nothing booked


def test_adhoc_summary_and_no_mutation(client):
    before = _counts(client)
    j = client.post(f"{API}/scheduling/recommendations",
                    json={"equipment_type_id": "eq-gpu-workstation", "duration_minutes": 120, "horizon_days": 3}).json()
    assert j["summary"]["requests_considered"] == 1 and j["summary"]["horizon_days"] == 3
    assert j["summary"]["solver_status"] in ("optimal", "feasible", "infeasible")
    assert _counts(client) == before
