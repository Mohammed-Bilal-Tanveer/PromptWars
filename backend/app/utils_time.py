"""Timezone helpers. Storage/API are UTC; naive request datetimes are campus-local."""
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import get_settings

DATE_ONLY_LEN = 10  # YYYY-MM-DD


def campus_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().campus_timezone)


def now_utc() -> datetime:
    return datetime.now(UTC)


def to_utc(dt: datetime) -> datetime:
    """Aware -> UTC; naive -> interpreted as campus-local."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=campus_tz())
    return dt.astimezone(UTC)


def parse_dt(value: str | datetime | None) -> datetime | None:
    """Parse ISO-8601 text or a datetime to aware UTC; a bare date means 23:59 of that campus day."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return to_utc(value)
    s = value.strip()
    if s.endswith("Z") or s.endswith("z"):
        s = s[:-1] + "+00:00"
    if len(s) == DATE_ONLY_LEN:  # date only
        return to_utc(datetime.combine(date.fromisoformat(s), time(23, 59)))
    return to_utc(datetime.fromisoformat(s))


def iso(dt: datetime | None) -> str | None:
    """Format as the contract second-precision UTC string."""
    if dt is None:
        return None
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def local(dt: datetime) -> datetime:
    return dt.astimezone(campus_tz())


def local_day_bounds(d: date) -> tuple[datetime, datetime]:
    """UTC [start, end) bounds of a campus-local calendar day."""
    tz = campus_tz()
    start = datetime.combine(d, time(0, 0), tzinfo=tz)
    return start.astimezone(UTC), (start + timedelta(days=1)).astimezone(UTC)


def local_dt(d: date, hhmm: str) -> datetime:
    """Campus-local HH:MM on date ``d`` as aware UTC."""
    h, m = (int(x) for x in hhmm.split(":"))
    return datetime.combine(d, time(h, m), tzinfo=campus_tz()).astimezone(UTC)
