"""Deterministic, explainable equipment matcher (score 0-100).

Score components (documented, sum capped at 100):
  name        up to 50  exact name / synonym match = 50, else proportional to token overlap (max 35)
  category    15        query/capability words appear in the equipment category
  capability  up to 25  the requirement's capability tag is offered by the equipment (25), fuzzy token overlap (12)
  preference   5        equipment owned by a preferred department
  availability up to 5  5 if >=1 unit free in the window, 2 if operational units exist but are all busy

Statuses: exact (best >= 70 and available) / unavailable (matched but 0 free units) / partial / unmatched
(nothing >= MATCH_THRESHOLD). Only real catalogue rows are ever returned - nothing is invented.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from app.schemas.ai import MatchCandidate, RequirementMatch

EXACT_THRESHOLD = 70.0
MATCH_THRESHOLD = 30.0
MAX_CANDIDATES = 4

STOP = {"a", "an", "the", "of", "for", "and", "or", "with", "kit", "module", "unit", "station", "system", "board", "machine", "set"}

# synonym groups: any phrase in a group counts as the same equipment
SYNONYMS: list[set[str]] = [
    {"gpu workstation", "gpu", "gpu server", "deep learning workstation", "ml workstation", "cuda workstation", "gpu compute"},
    {"raspberry pi", "rpi", "raspberry", "single board computer", "sbc"},
    {"arduino", "microcontroller", "arduino uno", "arduino board"},
    {"camera module", "camera", "pi camera", "webcam", "vision camera", "image sensor"},
    {"robotics kit", "robot kit", "robot platform", "robot chassis", "mobile robot", "robotics platform"},
    {"sensor kit", "sensors", "sensor", "sensor pack", "environmental sensors", "soil sensor"},
    {"oscilloscope", "scope", "digital oscilloscope"},
    {"fpga", "fpga board", "fpga development board", "fpga kit"},
    {"3d printer", "3d printing", "fdm printer", "additive manufacturing"},
    {"cnc", "cnc machine", "cnc router", "cnc mill", "milling machine"},
    {"microscope", "microscopy", "optical microscope"},
    {"centrifuge"},
    {"materials tester", "universal testing machine", "utm", "tensile tester", "materials testing machine"},
    {"jetson nano", "jetson", "edge ai module", "nvidia jetson"},
    {"lora gateway", "lorawan gateway", "lora", "iot gateway"},
    {"laser cutter", "laser cutting"},
    {"soldering station", "soldering iron"},
    {"logic analyzer", "logic analyser"},
    {"ml server", "machine learning server", "training server"},
]


def _norm(s: str | None) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", (s or "").lower().replace("_", " ")).strip()


def _tokens(s: str | None) -> set[str]:
    return {t for t in _norm(s).split() if t and t not in STOP}


def _stem(t: str) -> str:
    return t[:-1] if len(t) > 3 and t.endswith("s") else t


def _tokset(s: str | None) -> set[str]:
    return {_stem(t) for t in _tokens(s)}


@dataclass
class EquipmentInfo:
    id: str
    name: str
    category: str = ""
    description: str = ""
    capabilities: list[str] = field(default_factory=list)
    department_id: str | None = None
    department_name: str | None = None
    laboratory_id: str | None = None
    laboratory_name: str | None = None
    building: str | None = None
    room_label: str | None = None
    total_units: int = 0
    operational_units: int = 0
    free_units: int = 0


def _group_of(text: str) -> int | None:
    n = _norm(text)
    for i, g in enumerate(SYNONYMS):
        for phrase in g:
            if n == phrase or (len(phrase) > 3 and phrase in n and len(phrase.split()) >= len(n.split()) - 1):
                return i
    return None


def _name_score(query: str, eq: EquipmentInfo) -> tuple[float, str | None]:
    q, n = _norm(query), _norm(eq.name)
    if not q:
        return 0.0, None
    if q == n or q in n or n in q:
        return 50.0, f"Name matches '{query}'"
    gq = _group_of(q)
    if gq is not None:
        for phrase in SYNONYMS[gq]:
            if phrase == n or (len(phrase) > 2 and re.search(r"\b" + re.escape(phrase) + r"\b", n)):
                return 50.0, f"'{query}' is a known synonym of '{eq.name}'"
    qt, nt = _tokset(query), _tokset(eq.name)
    if qt and nt:
        ov = qt & nt
        if ov:
            frac = len(ov) / len(qt)
            return round(35.0 * frac, 1), f"Name shares terms with '{query}' ({', '.join(sorted(ov))})"
    return 0.0, None


def score_candidate(
    eq: EquipmentInfo,
    query: str,
    capability_tag: str | None = None,
    preferred_department_ids: list[str] | None = None,
) -> tuple[float, str, list[str]]:
    evidence: list[str] = []
    name_s, name_ev = _name_score(query, eq)
    if name_ev:
        evidence.append(name_ev)
    # category
    cat_s = 0.0
    cat_tokens = _tokset(eq.category)
    q_tokens = _tokset(query)
    if cat_tokens and (q_tokens & cat_tokens):
        cat_s = 15.0
        evidence.append(f"Category '{eq.category}' relates to the requirement")
    # capability
    cap_s = 0.0
    caps = {c.lower() for c in eq.capabilities}
    if capability_tag and capability_tag.lower() in caps:
        cap_s = 25.0
        evidence.append(f"Provides capability '{capability_tag}'")
    elif capability_tag:
        ctoks = _tokset(capability_tag)
        for c in caps:
            if ctoks & _tokset(c):
                cap_s = 12.0
                evidence.append(f"Related capability '{c}' (needs '{capability_tag}')")
                break
    if not capability_tag and name_s < 50:
        # no tag given: allow query words to hit capability tags
        for c in caps:
            if q_tokens & _tokset(c):
                cap_s = max(cap_s, 12.0)
                evidence.append(f"Capability '{c}' mentioned by the requirement")
                break
    # preference
    pref_s = 0.0
    if preferred_department_ids and eq.department_id in preferred_department_ids:
        pref_s = 5.0
        evidence.append(f"Owned by a preferred department ({eq.department_name})")
    # availability
    if eq.free_units > 0:
        av_s = 5.0
        evidence.append(f"{eq.free_units} of {eq.total_units} units free in the window")
    elif eq.operational_units > 0:
        av_s = 2.0
        evidence.append(f"All {eq.operational_units} operational units are booked in the window")
    else:
        av_s = 0.0
        evidence.append("No operational units (maintenance/unavailable)")
    total = round(min(100.0, name_s + cat_s + cap_s + pref_s + av_s), 1)
    # match type
    if name_s >= 50:
        mt = "exact_name"
    elif name_s > 0 or cat_s > 0:
        mt = "category"
    elif cap_s > 0:
        mt = "capability"
    else:
        mt = "alternative"
    # keep only the real evidence when nothing relevant matched
    if name_s + cat_s + cap_s == 0:
        total = round(min(total, 10.0), 1)
    return total, mt, evidence


def _candidate(eq: EquipmentInfo, score: float, mt: str, evidence: list[str]) -> MatchCandidate:
    return MatchCandidate(
        equipment_type_id=eq.id, name=eq.name, category=eq.category, laboratory_id=eq.laboratory_id,
        laboratory_name=eq.laboratory_name, department_id=eq.department_id, department_name=eq.department_name,
        building=eq.building, room_label=eq.room_label, score=score, match_type=mt, evidence=evidence,
        total_units=eq.total_units, available_units=eq.free_units, is_available=eq.free_units > 0,
    )


def match_requirement(
    catalog: list[EquipmentInfo],
    name: str,
    priority: str = "required",
    reason: str = "",
    capability_tag: str | None = None,
    preferred_department_ids: list[str] | None = None,
) -> RequirementMatch:
    scored = []
    for eq in catalog:
        s, mt, ev = score_candidate(eq, name, capability_tag, preferred_department_ids)
        if s >= MATCH_THRESHOLD:
            scored.append((s, mt, ev, eq))
    scored.sort(key=lambda x: (-x[0], -x[3].free_units, x[3].name, x[3].id))
    scored = scored[:MAX_CANDIDATES]
    cands = [_candidate(eq, s, mt, ev) for s, mt, ev, eq in scored]
    if not cands:
        return RequirementMatch(requirement_name=name, priority=priority, reason=reason, capability_tag=capability_tag,
                                match_status="unmatched", best=None, candidates=[])
    best = cands[0]
    if best.score >= EXACT_THRESHOLD and best.is_available:
        status = "exact"
    elif best.is_available or any(c.is_available for c in cands):
        status = "partial"
    else:
        status = "unavailable"
    if best.score >= EXACT_THRESHOLD and not best.is_available:
        status = "unavailable"
    return RequirementMatch(requirement_name=name, priority=priority, reason=reason, capability_tag=capability_tag,
                            match_status=status, best=best, candidates=cands)


def match_all(catalog: list[EquipmentInfo], requirements, preferred_department_ids=None) -> list[RequirementMatch]:
    return [
        match_requirement(catalog, r.equipment_query, r.priority, r.reason, r.capability_tag, preferred_department_ids)
        for r in requirements
    ]


# ---------------------------------------------------------------- DB loader
def load_catalog(db, window_start: datetime | None = None, window_end: datetime | None = None) -> list[EquipmentInfo]:
    """Build EquipmentInfo rows with free-unit counts for [window_start, window_end) (default: right now)."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.models import Booking, EquipmentType, MaintenanceWindow

    now = datetime.now(UTC)
    ws = window_start or now
    we = window_end or (ws + timedelta(minutes=1))
    types = db.execute(
        select(EquipmentType).options(
            selectinload(EquipmentType.units), selectinload(EquipmentType.laboratory), selectinload(EquipmentType.department)
        ).order_by(EquipmentType.id)
    ).scalars().all()
    bookings = db.execute(
        select(Booking).where(Booking.status == "confirmed", Booking.end_at > ws - timedelta(hours=6), Booking.start_at < we + timedelta(hours=6))
    ).scalars().all()
    maint = db.execute(
        select(MaintenanceWindow).where(MaintenanceWindow.status == "active", MaintenanceWindow.end_at > ws, MaintenanceWindow.start_at < we)
    ).scalars().all()
    out: list[EquipmentInfo] = []
    for t in types:
        pre, post = timedelta(minutes=t.setup_minutes or 0), timedelta(minutes=t.cleanup_minutes or 0)
        operational = [u for u in t.units if u.status == "operational"]
        free = 0
        for u in operational:
            if any(m.equipment_unit_id == u.id for m in maint):
                continue
            if any(b.equipment_unit_id == u.id and (b.start_at - pre) < we and ws < (b.end_at + post) for b in bookings):
                continue
            free += 1
        lab = t.laboratory
        out.append(EquipmentInfo(
            id=t.id, name=t.name, category=t.category or "", description=t.description or "",
            capabilities=list(t.capabilities or []), department_id=t.department_id,
            department_name=t.department.name if t.department else None, laboratory_id=t.laboratory_id,
            laboratory_name=lab.name if lab else None, building=lab.building if lab else None,
            room_label=(f"{lab.building} {lab.floor} / {lab.room_number}".strip() if lab else None),
            total_units=len(t.units), operational_units=len(operational), free_units=free,
        ))
    return out


def find_equipment_in_text(catalog: list[EquipmentInfo], text: str, limit: int = 3) -> list[EquipmentInfo]:
    """Equipment types a free-text message talks about (name or synonym mentioned as whole words)."""
    t = " " + _norm(text) + " "
    hits: list[tuple[int, EquipmentInfo]] = []
    for eq in catalog:
        n = _norm(eq.name)
        score = 0
        if n and f" {n} " in t:
            score = 100 + len(n)
        else:
            gi = _group_of(eq.name)
            phrases = set(SYNONYMS[gi]) if gi is not None else set()
            for ph in phrases:
                if f" {ph} " in t:
                    score = max(score, 50 + len(ph))
            if not phrases:
                toks = _tokset(eq.name)
                if toks and all(f" {x}" in t for x in toks):
                    score = 40
        if score:
            hits.append((score, eq))
    hits.sort(key=lambda x: (-x[0], x[1].name, x[1].id))
    return [e for _, e in hits[:limit]]
