"""Project analysis (AI + deterministic matcher) and project persistence."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import NotFound, RateLimited, ValidationFailed
from app.models import Department, Project, ProjectRequirement
from app.schemas.ai import AnalysisResult, DepartmentRef, ProjectAnalyseRequest
from app.schemas.project import ProjectCreate, ProjectOut
from app.services import ai_service
from app.services import equipment_matcher as matcher
from app.utils_time import iso, to_utc

MAX_SUGGESTED_DEPARTMENTS = 5
MIN_DEPT_KEYWORD_LEN = 4  # words longer than this count as a department-name keyword
REQUIREMENT_NAME_MAX_LEN = 200
KNOWN_ANALYSIS_SOURCES = ("openai", "demo_fallback", "manual")

router = APIRouter(tags=["projects"])


def client_ip(request: Request) -> str:
    """Best-effort client address (first X-Forwarded-For hop when behind a proxy)."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(limiter: ai_service.SlidingWindowLimiter, request: Request) -> None:
    """Raise RateLimited when the caller IP exceeded ``limiter``."""
    wait = limiter.check(client_ip(request))
    if wait is not None:
        raise RateLimited("Too many requests. Please wait a moment and try again.", {"retry_after_seconds": int(wait)})


def _resolve_departments(db: Session, names: list[str], matches, preferred_ids: list[str] | None) -> list[DepartmentRef]:
    depts = db.execute(select(Department).order_by(Department.id)).scalars().all()
    out: dict[str, str] = {}

    def add(d: Department | None) -> None:
        if d is not None and d.id not in out:
            out[d.id] = d.name

    for d in depts:
        if d.id in (preferred_ids or []):
            add(d)
    for n in names:
        nl = n.lower().strip()
        for d in depts:
            dl = d.name.lower()
            if nl and (nl in dl or dl in nl or any(w in dl for w in nl.split() if len(w) > MIN_DEPT_KEYWORD_LEN)):
                add(d)
                break
    for m in matches:
        if m.best and m.match_status in ("exact", "partial", "unavailable"):
            add(next((d for d in depts if d.id == m.best.department_id), None))
    return [DepartmentRef(id=i, name=n) for i, n in list(out.items())[:MAX_SUGGESTED_DEPARTMENTS]]


def analyse_project(db: Session, req: ProjectAnalyseRequest) -> AnalysisResult:
    ws = to_utc(req.preferred_window.start_at) if req.preferred_window else None
    we = to_utc(req.preferred_window.end_at) if req.preferred_window else None
    catalog = matcher.load_catalog(db, ws, we)
    dept_names = [d.name for d in db.execute(select(Department).order_by(Department.id)).scalars()]
    llm, source, reason = ai_service.analyse_text(req, [e.name for e in catalog], dept_names)
    matches = matcher.match_all(catalog, llm.equipment_requirements, req.preferred_department_ids)
    return AnalysisResult(
        analysis_source=source, is_fallback=source != "openai", fallback_reason=reason,
        project_summary=llm.project_summary, capabilities=llm.capabilities, equipment_requirements=llm.equipment_requirements,
        required_lab_capabilities=llm.required_lab_capabilities,
        suggested_departments=_resolve_departments(db, llm.suggested_department_names, matches, req.preferred_department_ids),
        estimated_total_hours=req.estimated_total_hours or llm.estimated_total_hours, assumptions=llm.assumptions,
        safety_considerations=llm.safety_considerations, clarifying_questions=llm.clarifying_questions,
        reasoning_summary=llm.reasoning_summary, matches=matches,
    )


@router.post("/projects/analyse", response_model=AnalysisResult)
def analyse(body: ProjectAnalyseRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(ai_service.analyse_limiter, request)
    return analyse_project(db, body)


def project_out(p: Project) -> ProjectOut:
    analysis = AnalysisResult.model_validate(p.analysis_json) if p.analysis_json else None
    return ProjectOut(
        id=p.id, title=p.title, description=p.description, category=p.category, requester_name=p.requester_name,
        requester_department_id=p.requester_department_id, deadline=iso(p.deadline), estimated_total_hours=p.estimated_total_hours,
        analysis_source=p.analysis_source if p.analysis_source in KNOWN_ANALYSIS_SOURCES else "manual",
        analysis=analysis, created_at=iso(p.created_at), updated_at=iso(p.updated_at),
    )


@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    if body.requester_department_id and db.get(Department, body.requester_department_id) is None:
        raise ValidationFailed("Unknown requester_department_id", {"reasons": [f"Department {body.requester_department_id} does not exist"]})
    a = body.analysis
    p = Project(
        title=body.title.strip(), description=body.description, category=body.category, requester_name=body.requester_name.strip(),
        requester_department_id=body.requester_department_id, deadline=to_utc(body.deadline) if body.deadline else None,
        estimated_total_hours=body.estimated_total_hours or (a.estimated_total_hours if a else None),
        analysis_source=a.analysis_source if a else "manual", analysis_json=a.model_dump(mode="json") if a else None,
    )
    db.add(p)
    db.flush()
    if a:
        for m in a.matches:
            matched = m.best.equipment_type_id if (m.best and m.match_status != "unmatched") else None
            db.add(ProjectRequirement(
                project_id=p.id, requirement_name=m.requirement_name[:REQUIREMENT_NAME_MAX_LEN], priority=m.priority, capability_tag=m.capability_tag,
                reason=m.reason, matched_equipment_type_id=matched, match_status=m.match_status,
            ))
    db.commit()
    db.refresh(p)
    return project_out(p)


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    rows = db.execute(select(Project).order_by(Project.created_at.desc(), Project.id)).scalars().all()
    return [project_out(p) for p in rows]


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if p is None:
        raise NotFound("Project not found")
    return project_out(p)
