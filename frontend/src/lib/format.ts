let CAMPUS_TZ = 'Asia/Kolkata'
export const setCampusTimezone = (tz: string) => {
  if (tz) CAMPUS_TZ = tz
}
export const getCampusTimezone = () => CAMPUS_TZ

const fmt = (opts: Intl.DateTimeFormatOptions) => (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat('en-GB', { timeZone: CAMPUS_TZ, ...opts }).format(new Date(iso)) : '—'

export const formatDateTime = fmt({ day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
export const formatTime = fmt({ hour: '2-digit', minute: '2-digit', hour12: false })
export const formatDate = fmt({ weekday: 'short', day: '2-digit', month: 'short' })
export const formatDateLong = fmt({ weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

export function formatRange(startIso: string, endIso: string): string {
  const sameDay = formatDate(startIso) === formatDate(endIso)
  return sameDay
    ? `${formatDate(startIso)}, ${formatTime(startIso)}–${formatTime(endIso)}`
    : `${formatDateTime(startIso)} → ${formatDateTime(endIso)}`
}

/** Today's date as YYYY-MM-DD in campus timezone (+ optional day offset). */
export function campusDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: CAMPUS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return parts // en-CA => YYYY-MM-DD
}

/** Build a naive campus-local ISO string the backend interprets in CAMPUS_TIMEZONE. */
export const localISO = (date: string, time: string) => `${date}T${time.length === 5 ? time : time.slice(0, 5)}`

/** YYYY-MM-DD in campus tz for an ISO instant. */
export function campusDateOf(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CAMPUS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}
/** HH:mm in campus tz for an ISO instant. */
export function campusTimeOf(iso: string): string {
  return formatTime(iso)
}

export const humanize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
export const pct = (n: number | null | undefined, digits = 0) => (n == null ? '—' : `${n.toFixed(digits)}%`)
export const minutesToLabel = (m: number) => (m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} min`)

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  alternative_proposed: 'Alternative proposed',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  expired: 'Expired',
}
export const EQUIPMENT_STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  occupied: 'Fully booked now',
  maintenance: 'Under maintenance',
}
