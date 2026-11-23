from tests.conftest import API


def test_seed_counts_and_idempotent(client, db):
    from sqlalchemy import func, select

    from app.models import Department, EquipmentType, EquipmentUnit, Laboratory
    from app.seed.demo_data import seed

    seed(db)  # second run must not duplicate
    assert db.scalar(select(func.count()).select_from(Department)) == 5
    assert db.scalar(select(func.count()).select_from(Laboratory)) == 9
    assert 18 <= db.scalar(select(func.count()).select_from(EquipmentType)) <= 22
    assert db.scalar(select(func.count()).select_from(EquipmentUnit)) >= 46
    assert db.get(EquipmentType, "eq-gpu-workstation") is not None
    assert len(db.get(EquipmentType, "eq-gpu-workstation").units) == 5


def test_departments_and_labs(client):
    deps = client.get(f"{API}/departments").json()
    assert {d["id"] for d in deps} == {"dept-cs", "dept-ece", "dept-mech", "dept-civil", "dept-bio"}
    cs = next(d for d in deps if d["id"] == "dept-cs")
    assert cs["scene_position"] == {"x": -28, "y": 0, "z": -22} and cs["lab_count"] == 3 - 1
    detail = client.get(f"{API}/departments/dept-cs").json()
    assert {lab["id"] for lab in detail["laboratories"]} == {"lab-ai", "lab-gpu"}
    labs = client.get(f"{API}/laboratories", params={"department_id": "dept-ece"}).json()
    assert {lab["id"] for lab in labs} == {"lab-robotics", "lab-proto", "lab-iot"}
    lab = client.get(f"{API}/laboratories/lab-gpu").json()
    assert lab["equipment"][0]["id"] == "eq-gpu-workstation"
    assert lab["opening_hours"] == {"start": "09:00", "end": "18:00"}


def test_equipment_search_and_filters(client):
    r = client.get(f"{API}/equipment", params={"q": "gpu"}).json()
    assert r["total"] >= 1 and r["items"][0]["id"] in ("eq-gpu-workstation", "eq-ml-server", "eq-jetson-nano")
    r = client.get(f"{API}/equipment", params={"q": "COMPUTER VISION"}).json()
    ids = {i["id"] for i in r["items"]}
    assert "eq-camera-module" in ids and "eq-gpu-workstation" in ids
    r = client.get(f"{API}/equipment", params={"q": "biotechnology"}).json()
    assert all(i["department_name"] == "Biotechnology" for i in r["items"]) and r["total"] >= 3
    r = client.get(f"{API}/equipment", params={"category": "Fabrication", "sort": "name"}).json()
    assert [i["name"] for i in r["items"]] == sorted(i["name"] for i in r["items"])
    r = client.get(f"{API}/equipment", params={"page_size": 5, "page": 2}).json()
    assert len(r["items"]) == 5 and r["page"] == 2 and r["total"] >= 18


def test_categories_and_recommendations(client):
    cats = client.get(f"{API}/equipment/categories").json()
    assert "Compute" in cats and cats == sorted(cats)
    recs = client.get(f"{API}/equipment/recommendations", params={"capabilities": "computer_vision,gpu_compute", "limit": 3}).json()
    assert len(recs) == 3 and recs[0]["score"] >= recs[-1]["score"] and recs[0]["evidence"]
    assert client.get(f"{API}/equipment/recommendations").status_code == 400


def test_equipment_detail_units(client):
    d = client.get(f"{API}/equipment/eq-3d-printer").json()
    assert d["quantity_total"] == 4 and len(d["units"]) == 4 and d["maintenance_state"] == "partial"
    assert d["quantity_available"] <= 3  # one unit in maintenance window
    assert d["scene_object_id"] == "obj-eq-3d-printer-1"
    assert len(d["alternatives"]) <= 4
    assert client.get(f"{API}/equipment/eq-3d-printer/units").json()[3]["is_free_now"] is False


def test_unit_status_change_notifies_and_keeps_bookings(client):
    before = client.get(f"{API}/bookings", params={"equipment_type_id": "eq-gpu-workstation"}).json()["total"]
    r = client.post(f"{API}/equipment/units/eq-gpu-workstation-u1/status", json={"status": "maintenance", "reason": "Fan fault"})
    assert r.status_code == 200 and r.json()["status"] == "maintenance" and r.json()["is_free_now"] is False
    after = client.get(f"{API}/bookings", params={"equipment_type_id": "eq-gpu-workstation"}).json()["total"]
    assert before == after == 5
    notes = client.get(f"{API}/notifications").json()["items"]
    assert any(n["type"] == "maintenance" and "Fan fault" in n["message"] for n in notes)
    assert client.post(f"{API}/equipment/units/eq-gpu-workstation-u1/status", json={"status": "broken"}).status_code == 422


def test_notifications_read(client):
    n = client.get(f"{API}/notifications").json()
    assert n["unread_count"] > 0
    nid = n["items"][0]["id"]
    assert client.post(f"{API}/notifications/{nid}/read").json()["is_read"] is True
    assert client.post(f"{API}/notifications/read-all").json() == {"unread_count": 0}
    assert client.get(f"{API}/notifications", params={"unread_only": True}).json()["items"] == []


def test_maintenance_crud(client):
    from tests.conftest import at, workday

    d = workday(8)
    r = client.post(f"{API}/maintenance", json={"equipment_unit_id": "eq-arduino-u1", "start_at": at(d, "09:00"),
                                                  "end_at": at(d, "18:00"), "reason": "Firmware refresh"})
    assert r.status_code == 201 and r.json()["status"] == "active"
    mid = r.json()["id"]
    assert any(m["id"] == mid for m in client.get(f"{API}/maintenance").json())
    assert client.post(f"{API}/maintenance/{mid}/end").json()["status"] == "ended"
    assert client.post(f"{API}/maintenance/{mid}/end").status_code == 409
