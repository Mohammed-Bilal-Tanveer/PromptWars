from sqlalchemy.orm import Session

from app.models import Approval, AuditEvent, Notification

REVIEWER = "Demo Lab Coordinator"


def notify(db: Session, type_: str, title: str, message: str, entity_type: str | None = None,
           entity_id: str | None = None) -> Notification:
    n = Notification(type=type_, title=title, message=message, related_entity_type=entity_type,
                     related_entity_id=entity_id, is_read=False)
    db.add(n)
    return n


def audit(db: Session, event_type: str, entity_type: str, entity_id: str, description: str, actor: str = "System",
          note: str | None = None, metadata: dict | None = None) -> AuditEvent:
    a = AuditEvent(event_type=event_type, entity_type=entity_type, entity_id=entity_id, description=description,
                   actor=actor, note=note, event_metadata=metadata or {})
    db.add(a)
    return a


def record_approval(db: Session, request_id: str, action: str, note: str | None, reviewer: str | None = None) -> Approval:
    a = Approval(booking_request_id=request_id, action=action, reviewer_display_name=reviewer or REVIEWER, note=note)
    db.add(a)
    return a
