"""Timezone helpers. Storage/API are UTC; naive request datetimes are campus-local."""
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import get_settings


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
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return to_utc(value)
    s = value.strip()
    if s.endswith("Z") or s.endswith("z"):
        s = s[:-1] + "+00:00"
    if len(s) == 10:  # date only
        return to_utc(datetime.combine(date.fromisoformat(s), time(23, 59)))
    return to_utc(datetime.fromisoformat(s))


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def local(dt: datetime) -> datetime:
    return dt.astimezone(campus_tz())


def local_day_bounds(d: date) -> tuple[datetime, datetime]:
    tz = campus_tz()
    start = datetime.combine(d, time(0, 0), tzinfo=tz)
    return start.astimezone(UTC), (start + timedelta(days=1)).astimezone(UTC)


def local_dt(d: date, hhmm: str) -> datetime:
    h, m = (int(x) for x in hhmm.split(":"))
    return datetime.combine(d, time(h, m), tzinfo=campus_tz()).astimezone(UTC)
