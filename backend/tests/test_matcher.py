"""Pure matcher tests (no DB)."""
from app.schemas.ai import EquipmentRequirement
from app.services.equipment_matcher import (
    EquipmentInfo,
    find_equipment_in_text,
    match_all,
    match_requirement,
    score_candidate,
)

CATALOG = [
    EquipmentInfo("eq-gpu", "GPU Workstation", "Compute", capabilities=["gpu_compute", "machine_learning", "computer_vision"],
                  department_id="dept-cs", department_name="CS", laboratory_id="lab-gpu", laboratory_name="GPU Lab", total_units=5, operational_units=5, free_units=3),
    EquipmentInfo("eq-ml", "ML Training Server", "Compute", capabilities=["machine_learning", "gpu_compute"],
                  department_id="dept-cs", department_name="CS", laboratory_id="lab-ai", laboratory_name="AI Lab", total_units=2, operational_units=2, free_units=2),
    EquipmentInfo("eq-pi", "Raspberry Pi 5 Kit", "Embedded", capabilities=["embedded_systems"], department_id="dept-ece",
                  total_units=6, operational_units=6, free_units=6),
    EquipmentInfo("eq-cnc", "CNC Milling Machine", "Fabrication", capabilities=["machining"], department_id="dept-mech",
                  total_units=2, operational_units=2, free_units=0),
    EquipmentInfo("eq-down", "Research Microscope", "Imaging", capabilities=["microscopy"], total_units=3, operational_units=0, free_units=0),
]


def test_exact_name_match_is_exact_and_scored_over_70():
    m = match_requirement(CATALOG, "GPU workstation", "required", "train", "gpu_compute")
    assert m.match_status == "exact" and m.best.equipment_type_id == "eq-gpu" and m.best.score >= 70
    assert m.best.match_type == "exact_name" and m.best.evidence
    assert len(m.candidates) <= 4
    assert m.candidates[0].score >= m.candidates[-1].score


def test_synonym_match():
    m = match_requirement(CATALOG, "CNC machine", capability_tag="machining")
    assert m.best.equipment_type_id == "eq-cnc"
    m = match_requirement(CATALOG, "Raspberry Pi", capability_tag="embedded_systems")
    assert m.match_status == "exact" and m.best.equipment_type_id == "eq-pi"


def test_unavailable_when_matched_but_no_free_units():
    m = match_requirement(CATALOG, "CNC machine", capability_tag="machining")
    assert m.match_status == "unavailable" and m.best.is_available is False and m.best.available_units == 0
    m = match_requirement(CATALOG, "Microscope", capability_tag="microscopy")
    assert m.match_status == "unavailable"


def test_capability_only_is_partial_with_alternatives():
    m = match_requirement(CATALOG, "Deep learning accelerator", capability_tag="machine_learning")
    assert m.match_status == "partial"
    assert {c.equipment_type_id for c in m.candidates} >= {"eq-gpu", "eq-ml"}
    assert all(c.score < 70 for c in m.candidates)


def test_unmatched_never_invented():
    m = match_requirement(CATALOG, "Quantum annealer")
    assert m.match_status == "unmatched" and m.best is None and m.candidates == []
    m = match_requirement(CATALOG, "Electron microscope xyz", capability_tag="nonexistent_tag")
    assert all(c.equipment_type_id in {e.id for e in CATALOG} for c in m.candidates)


def test_score_components_bounded_and_deterministic():
    for eq in CATALOG:
        s1 = score_candidate(eq, "GPU workstation", "gpu_compute", ["dept-cs"])
        s2 = score_candidate(eq, "GPU workstation", "gpu_compute", ["dept-cs"])
        assert s1 == s2 and 0 <= s1[0] <= 100


def test_preferred_department_adds_five():
    a = score_candidate(CATALOG[0], "GPU workstation", "gpu_compute", None)[0]
    b = score_candidate(CATALOG[0], "GPU workstation", "gpu_compute", ["dept-cs"])[0]
    assert round(b - a, 1) == 5.0


def test_match_all_and_find_in_text():
    reqs = [EquipmentRequirement(equipment_query="GPU workstation", capability_tag="gpu_compute"),
            EquipmentRequirement(equipment_query="Time machine")]
    res = match_all(CATALOG, reqs)
    assert [r.match_status for r in res] == ["exact", "unmatched"]
    assert [e.id for e in find_equipment_in_text(CATALOG, "Why is the gpu workstation busy tomorrow?")][:1] == ["eq-gpu"]
    assert find_equipment_in_text(CATALOG, "hello there") == []
