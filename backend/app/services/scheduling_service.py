# ruff: noqa: B023  (gather() closure is only called inside the loop iteration that defines it)
"""CP-SAT scheduling core (pure: plain dataclasses in, plain dataclasses out; no DB, no clock).

Model
* Time is a grid of ``grid`` minutes starting at ``horizon_start`` (must be grid aligned, UTC aware).
* For every (request, eligible unit, feasible start slot) there is an optional interval variable.
  Intervals include the unit's setup/cleanup buffers, NoOverlap is enforced per unit.
* Hard constraints are applied as domain pruning: unit operational, booking inside an opening window,
  inside horizon / earliest / latest_end, and the buffered occupancy must not touch a fixed busy interval
  (confirmed bookings and maintenance windows are immovable; the solver never displaces them).
* Objective: maximise  sum(priority * (10000 - shift_penalty) * assigned) - tiny tie-breaks, i.e. priority-weighted
  satisfaction where the shift penalty (distance of the start from the preferred start) is capped so that an
  assignment is always worth more than leaving the request unscheduled. Higher priority wins contested slots.
* Deterministic: workers=1, fixed random seed, stable ordering. Time limit is clamped to <= 5 s.

The output is a *recommendation*; nothing here confirms a booking.
"""
from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from ortools.sat.python import cp_model

MAX_TIME_LIMIT = 5.0
PRIORITY_SCALE = 10000
SHIFT_COST_PER_SLOT = 20
SHIFT_COST_CAP = 3000


@dataclass
class SolverRequest:
    id: str
    type_id: str
    type_name: str
    duration_min: int
    preferred_start: datetime
    priority: float
    earliest: datetime | None = None
    latest_end: datetime | None = None  # hard deadline for end of session (optional)
    label: str = ""


@dataclass
class SolverUnit:
    id: str
    name: str
    type_id: str
    windows: list[tuple[datetime, datetime]]  # opening windows (UTC) in which a booking must fit
    status: str = "operational"
    setup_min: int = 0
    cleanup_min: int = 0
    type_name: str = ""


@dataclass
class Busy:
    unit_id: str
    start: datetime
    end: datetime
    kind: str = "booking"  # booking | maintenance
    ref_id: str | None = None


@dataclass
class Assignment:
    unit_id: str
    start: datetime
    end: datetime


@dataclass
class Alt:
    unit_id: str
    type_id: str
    start: datetime
    end: datetime
    is_alternative_equipment: bool
    shift_minutes: int
    reason: str


@dataclass
class SolveOutput:
    status: str  # optimal | feasible | infeasible | not_run
    solve_time_ms: float
    assignments: dict[str, Assignment | None] = field(default_factory=dict)
    explanations: dict[str, list[str]] = field(default_factory=dict)
    alternatives: dict[str, list[Alt]] = field(default_factory=dict)
    infeasible_reasons: dict[str, list[str]] = field(default_factory=dict)


# ------------------------------------------------------------------ slot helpers
def _slot_floor(dt: datetime, t0: datetime, grid: int) -> int:
    return math.floor((dt - t0).total_seconds() / 60.0 / grid)


def _slot_ceil(dt: datetime, t0: datetime, grid: int) -> int:
    return math.ceil((dt - t0).total_seconds() / 60.0 / grid - 1e-9)


def _slot_dt(slot: int, t0: datetime, grid: int) -> datetime:
    return t0 + timedelta(minutes=slot * grid)


def _overlaps(a0: int, a1: int, b0: int, b1: int) -> bool:
    return a0 < b1 and b0 < a1


@dataclass
class _UnitSlots:
    unit: SolverUnit
    pre: int
    post: int
    windows: list[tuple[int, int]]
    blocked: list[tuple[int, int]]


def _prepare_unit(unit: SolverUnit, busy: list[Busy], t0: datetime, grid: int, extra: list[tuple[int, int]] | None = None) -> _UnitSlots:
    pre = math.ceil(unit.setup_min / grid) if unit.setup_min else 0
    post = math.ceil(unit.cleanup_min / grid) if unit.cleanup_min else 0
    windows = []
    for ws, we in unit.windows:
        a, b = _slot_ceil(ws, t0, grid), _slot_floor(we, t0, grid)
        if b > a:
            windows.append((a, b))
    blocked: list[tuple[int, int]] = []
    for b in busy:
        if b.unit_id != unit.id:
            continue
        s, e = _slot_floor(b.start, t0, grid), _slot_ceil(b.end, t0, grid)
        if b.kind == "booking":
            s, e = s - pre, e + post  # confirmed bookings keep their own buffers (same type buffers)
        blocked.append((s, e))
    if extra:
        blocked.extend(extra)
    blocked.sort()
    return _UnitSlots(unit, pre, post, windows, blocked)


def _candidate_starts(us: _UnitSlots, d: int, lo: int, hi_end: int) -> list[int]:
    """All start slots s with [s, s+d) inside an opening window, lo <= s, s+d <= hi_end, buffered occupancy free."""
    out: list[int] = []
    if us.unit.status != "operational":
        return out
    for wa, wb in us.windows:
        s = max(wa, lo)
        last = min(wb, hi_end) - d
        while s <= last:
            a0, a1 = s - us.pre, s + d + us.post
            clash = False
            for b0, b1 in us.blocked:
                if b0 >= a1:
                    break
                if _overlaps(a0, a1, b0, b1):
                    clash = True
                    break
            if not clash:
                out.append(s)
            s += 1
    return out


# ------------------------------------------------------------------ solver
def solve(
    requests: list[SolverRequest],
    units: list[SolverUnit],
    busy: list[Busy],
    horizon_start: datetime,
    horizon_end: datetime,
    grid: int = 15,
    time_limit: float = 3.0,
    workers: int = 1,
    compatible_units: dict[str, list[SolverUnit]] | None = None,
    seed: int = 0,
) -> SolveOutput:
    t_start = time.perf_counter()
    if not requests:
        return SolveOutput("not_run", 0.0)
    time_limit = max(0.1, min(float(time_limit), MAX_TIME_LIMIT))
    t0 = horizon_start
    h_end = _slot_floor(horizon_end, t0, grid)
    units_sorted = sorted(units, key=lambda u: (u.type_id, u.id))
    unit_slots = {u.id: _prepare_unit(u, busy, t0, grid) for u in units_sorted}
    by_type: dict[str, list[SolverUnit]] = {}
    for u in units_sorted:
        by_type.setdefault(u.type_id, []).append(u)

    out = SolveOutput("infeasible", 0.0)
    model = cp_model.CpModel()
    lits: dict[tuple[int, str, int], cp_model.IntVar] = {}
    per_unit_intervals: dict[str, list] = {}
    objective_terms = []
    req_cands: dict[str, dict[str, list[int]]] = {}
    ordered = sorted(requests, key=lambda r: (-r.priority, r.id))  # stable
    index_of = {r.id: i for i, r in enumerate(ordered)}

    for r in ordered:
        d = max(1, math.ceil(r.duration_min / grid))
        lo = _slot_ceil(r.earliest, t0, grid) if r.earliest else 0
        lo = max(lo, 0)
        hi_end = h_end
        if r.latest_end:
            hi_end = min(hi_end, _slot_floor(r.latest_end, t0, grid))
        pref = _slot_floor(r.preferred_start, t0, grid)
        cands_for_r: dict[str, list[int]] = {}
        r_lits = []
        for ui, u in enumerate(by_type.get(r.type_id, [])):
            us = unit_slots[u.id]
            starts = _candidate_starts(us, d, lo, hi_end)
            if not starts:
                continue
            cands_for_r[u.id] = starts
            for s in starts:
                lit = model.NewBoolVar(f"x_{index_of[r.id]}_{u.id}_{s}")
                lits[(index_of[r.id], u.id, s)] = lit
                r_lits.append(lit)
                iv = model.NewOptionalFixedSizeIntervalVar(s - us.pre, d + us.pre + us.post, lit, f"iv_{index_of[r.id]}_{u.id}_{s}")
                per_unit_intervals.setdefault(u.id, []).append(iv)
                shift_cost = min(SHIFT_COST_CAP, abs(s - pref) * SHIFT_COST_PER_SLOT)
                coeff = int(round(r.priority * (PRIORITY_SCALE - shift_cost))) + 100 - ui  # priority-weighted satisfaction; 100: always positive
                objective_terms.append(coeff * lit)
        req_cands[r.id] = cands_for_r
        if r_lits:
            model.AddAtMostOne(r_lits)

    for _uid, ivs in per_unit_intervals.items():
        if len(ivs) > 1:
            model.AddNoOverlap(ivs)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = max(1, int(workers))
    solver.parameters.random_seed = seed
    solver.parameters.log_search_progress = False

    status_name = "infeasible"
    if objective_terms:
        model.Maximize(sum(objective_terms))
        st = solver.Solve(model)
        if st == cp_model.OPTIMAL:
            status_name = "optimal"
        elif st == cp_model.FEASIBLE:
            status_name = "feasible"
        else:
            status_name = "infeasible"
    out.solve_time_ms = round((time.perf_counter() - t_start) * 1000, 1)

    # ---- extract
    chosen: dict[str, tuple[str, int, int]] = {}  # req id -> (unit, start slot, d)
    if status_name in ("optimal", "feasible"):
        for (ri, uid, s), lit in lits.items():
            if solver.Value(lit):
                r = ordered[ri]
                chosen[r.id] = (uid, s, max(1, math.ceil(r.duration_min / grid)))
    for r in ordered:
        if r.id in chosen:
            uid, s, d = chosen[r.id]
            out.assignments[r.id] = Assignment(uid, _slot_dt(s, t0, grid), _slot_dt(s + d, t0, grid))
        else:
            out.assignments[r.id] = None
    if not chosen:
        status_name = "infeasible"
    out.status = status_name

    _explain(out, ordered, units_sorted, by_type, req_cands, chosen, unit_slots, busy, t0, grid)
    _alternatives(out, ordered, by_type, chosen, unit_slots, busy, t0, grid, h_end, compatible_units or {})
    out.solve_time_ms = round((time.perf_counter() - t_start) * 1000, 1)
    return out


# ------------------------------------------------------------------ explanations
def _fmt(dt: datetime) -> str:
    return dt.strftime("%a %d %b %H:%M UTC")


def _explain(out, ordered, units, by_type, req_cands, chosen, unit_slots, busy, t0, grid):
    unit_name = {u.id: u.name for u in units}
    for r in ordered:
        lines: list[str] = []
        reasons: list[str] = []
        d = max(1, math.ceil(r.duration_min / grid))
        pref = _slot_floor(r.preferred_start, t0, grid)
        type_units = by_type.get(r.type_id, [])
        if r.id in chosen:
            uid, s, _ = chosen[r.id]
            shift = abs(s - pref) * grid
            lines.append(f"Recommended {unit_name[uid]} from {_fmt(_slot_dt(s, t0, grid))} for {r.duration_min} minutes.")
            if shift == 0:
                lines.append("Starts exactly at the preferred time.")
            else:
                lines.append(f"Starts {shift} minutes away from the preferred time because the preferred slot was not free.")
                # who or what blocked the preferred slot?
                blockers = []
                for o in ordered:
                    if o.id == r.id or o.id not in chosen or o.type_id != r.type_id:
                        continue
                    ouid, os_, od = chosen[o.id]
                    if _overlaps(os_, os_ + od, pref, pref + d):
                        blockers.append(o)
                for o in blockers:
                    if o.priority >= r.priority:
                        lines.append(f"Request {o.label or o.id} has higher priority ({o.priority:.2f} vs {r.priority:.2f}) and holds the nearby slot.")
                if any(b.unit_id in {u.id for u in type_units} and _overlaps(
                        _slot_floor(b.start, t0, grid), _slot_ceil(b.end, t0, grid), pref, pref + d) for b in busy):
                    lines.append("Existing confirmed bookings or maintenance occupy the preferred time on some units.")
            for o in ordered:
                if o.id != r.id and o.type_id == r.type_id and o.priority < r.priority:
                    if o.id in chosen:
                        ouid, os_, od = chosen[o.id]
                        opref = _slot_floor(o.preferred_start, t0, grid)
                        if os_ != opref and _overlaps(opref, opref + od, s, s + d):
                            lines.append(f"Won the contested slot over lower-priority request {o.label or o.id} ({r.priority:.2f} vs {o.priority:.2f}).")
                    else:
                        if _overlaps(_slot_floor(o.preferred_start, t0, grid), _slot_floor(o.preferred_start, t0, grid) + d, s, s + d):
                            lines.append(f"Won the contested slot over lower-priority request {o.label or o.id} ({r.priority:.2f} vs {o.priority:.2f}).")
        else:
            if not type_units:
                reasons.append("No units exist for this equipment type.")
            elif all(u.status != "operational" for u in type_units):
                reasons.append("All units are in maintenance or unavailable.")
            elif not any(unit_slots[u.id].windows for u in type_units if u.status == "operational"):
                reasons.append("The laboratory has no opening window inside the planning horizon.")
            elif not req_cands.get(r.id):
                reasons.append("No free slot of the required length exists inside opening hours: confirmed bookings, maintenance and buffers occupy every window.")
            else:
                higher = [o.label or o.id for o in ordered if o.id != r.id and o.type_id == r.type_id and o.id in chosen and o.priority > r.priority]
                if higher:
                    reasons.append("Higher-priority requests (" + ", ".join(higher) + ") took all feasible slots.")
                else:
                    reasons.append("No feasible slot could be allocated within the time limit.")
            if r.latest_end:
                reasons.append(f"Session must end before {_fmt(r.latest_end)}.")
            lines.extend(reasons)
            out.infeasible_reasons[r.id] = reasons
        out.explanations[r.id] = lines


# ------------------------------------------------------------------ alternatives
def _alternatives(out, ordered, by_type, chosen, unit_slots, busy, t0, grid, h_end, compat):
    for r in ordered:
        d = max(1, math.ceil(r.duration_min / grid))
        lo = max(0, _slot_ceil(r.earliest, t0, grid) if r.earliest else 0)
        hi_end = h_end if not r.latest_end else min(h_end, _slot_floor(r.latest_end, t0, grid))
        pref = _slot_floor(r.preferred_start, t0, grid)
        taken_by_others: dict[str, list[tuple[int, int]]] = {}
        for o in ordered:
            if o.id == r.id or o.id not in chosen:
                continue
            uid, s, od = chosen[o.id]
            us = unit_slots.get(uid)
            if us is None:
                continue
            taken_by_others.setdefault(uid, []).append((s - us.pre, s + od + us.post))
        rec = chosen.get(r.id)
        alts: list[Alt] = []

        def gather(unit_list, is_alt_equipment, limit):
            found: list[tuple[int, int, SolverUnit, int]] = []
            for ui, u in enumerate(unit_list):
                base = unit_slots.get(u.id) or _prepare_unit(u, busy, t0, grid)
                us = _UnitSlots(base.unit, base.pre, base.post, base.windows, sorted(base.blocked + taken_by_others.get(u.id, [])))
                starts = _candidate_starts(us, d, lo, hi_end)
                if not starts:
                    continue
                # nearest start to preferred, and earliest start
                near = min(starts, key=lambda s: (abs(s - pref), s))
                found.append((abs(near - pref), ui, u, near))
                early = starts[0]
                if early != near:
                    found.append((abs(early - pref), ui, u, early))
            found.sort(key=lambda x: (x[0], x[1], x[3]))
            res: list[Alt] = []
            seen = set()
            for shift, _ui, u, s in found:
                key = (u.id, s)
                if key in seen or (rec and not is_alt_equipment and key == (rec[0], rec[1])):
                    continue
                seen.add(key)
                if is_alt_equipment:
                    reason = f"Compatible equipment ({u.type_name or u.type_id}) is free at this time."
                elif u.id == (rec[0] if rec else None):
                    reason = "Same unit, different time."
                else:
                    reason = "Another unit of the same equipment type is free."
                res.append(Alt(u.id, u.type_id, _slot_dt(s, t0, grid), _slot_dt(s + d, t0, grid), is_alt_equipment, shift * grid, reason))
                if len(res) >= limit:
                    break
            return res

        alts.extend(gather(by_type.get(r.type_id, []), False, 3))
        if len(alts) < 4:
            alts.extend(gather(sorted(compat.get(r.id, []), key=lambda u: (u.type_id, u.id)), True, 2))
        out.alternatives[r.id] = alts[:5]


__all__ = [
    "SolverRequest", "SolverUnit", "Busy", "Assignment", "Alt", "SolveOutput", "solve", "MAX_TIME_LIMIT",
]
