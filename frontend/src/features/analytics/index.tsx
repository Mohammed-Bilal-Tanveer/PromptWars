import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button, Card, Chip, EmptyState, ErrorState, LoadingState, Notice, QueryBoundary, Stat } from '@/components/ui'
import {
  useAnalyticsOverview, useAnalyticsTrends, useAnalyticsUtilisation, useMarkAllRead, useMarkNotificationRead, useNotifications,
} from '@/hooks/useApi'
import { pct } from '@/lib/format'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'

function ChartCard({ title, columns, rows, children }: { title: string; columns: { key: string; label: string }[]; rows: Record<string, string | number>[]; children: ReactNode }) {
  const [table, setTable] = useState(false)
  return (
    <Card className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{title}</h3>
        <Button size="sm" variant="secondary" aria-pressed={table} onClick={() => setTable((v) => !v)}>{table ? 'Show chart' : 'Show data table'}</Button>
      </div>
      {table ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="text-xs uppercase text-muted"><tr>{columns.map((c) => <th key={c.key} scope="col" className="p-2">{c.label}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{columns.map((c) => <td key={c.key} className="p-2 tabular-nums">{r[c.key]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : rows.length === 0 ? <EmptyState title="No data yet" /> : (
        <div role="img" aria-label={`${title}. Use the Show data table button for the values.`} className="h-64 w-full">{children}</div>
      )}
    </Card>
  )
}

const axis = { stroke: '#94a3b8', fontSize: 11 }
const tip = { contentStyle: { background: '#111936', border: '1px solid #2a3570', borderRadius: 8, color: '#e8ecff' } }

export function AnalyticsDashboard({ embedded: _embedded }: { embedded?: boolean }) {
  const ov = useAnalyticsOverview()
  const ut = useAnalyticsUtilisation()
  const tr = useAnalyticsTrends()

  return (
    <div className="space-y-5">
      <QueryBoundary query={ov} loadingLabel="Loading overview…">
        {(o) => (
          <>
            <Notice tone="info" title={o.data_label || 'Sample campus data'}>Demonstration analytics computed from sample campus data.</Notice>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Total units" value={o.total_units} />
              <Stat label="Available now" value={o.units_available} gradient="avail" />
              <Stat label="In use now" value={o.units_occupied} />
              <Stat label="In maintenance" value={o.units_maintenance} />
              <Stat label="Active bookings" value={o.active_bookings} gradient="sched" />
              <Stat label="Pending requests" value={o.pending_requests} />
              <Stat label="Approved" value={o.approved_count} hint={`${o.confirmed_count} confirmed`} />
              <Stat label="Rejected" value={o.rejected_count} />
              <Stat label="Cancelled" value={o.cancelled_count} />
              <Stat label="Avg review time" value={o.avg_review_minutes == null ? '—' : `${Math.round(o.avg_review_minutes)} min`} />
              <Stat label="Conflicts" value={o.conflict_count} />
              <Stat label="Alternative acceptance" value={o.alternative_acceptance_rate == null ? '—' : pct(o.alternative_acceptance_rate <= 1 ? o.alternative_acceptance_rate * 100 : o.alternative_acceptance_rate)} hint={`${o.alternatives_accepted} of ${o.alternatives_proposed} proposed`} />
            </div>
          </>
        )}
      </QueryBoundary>

      {ut.isLoading || tr.isLoading ? <LoadingState label="Loading charts…" /> : ut.isError ? <ErrorState error={ut.error} onRetry={() => ut.refetch()} /> : tr.isError ? <ErrorState error={tr.error} onRetry={() => tr.refetch()} /> : ut.data && tr.data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title={`Utilisation by department (%, last ${ut.data.window_days} days)`}
              columns={[{ key: 'name', label: 'Department' }, { key: 'booked_hours', label: 'Booked h' }, { key: 'capacity_hours', label: 'Capacity h' }, { key: 'utilisation_pct', label: 'Utilisation %' }]}
              rows={ut.data.by_department as any}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ut.data.by_department}><CartesianGrid stroke="#2a3570" strokeDasharray="3 3" /><XAxis dataKey="name" {...axis} /><YAxis {...axis} unit="%" /><Tooltip {...tip} /><Bar dataKey="utilisation_pct" name="Utilisation %" fill="#38bdf8" radius={[6, 6, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard
              title="Utilisation by laboratory (%)"
              columns={[{ key: 'name', label: 'Laboratory' }, { key: 'booked_hours', label: 'Booked h' }, { key: 'capacity_hours', label: 'Capacity h' }, { key: 'utilisation_pct', label: 'Utilisation %' }]}
              rows={ut.data.by_laboratory as any}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ut.data.by_laboratory}><CartesianGrid stroke="#2a3570" strokeDasharray="3 3" /><XAxis dataKey="name" {...axis} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis {...axis} unit="%" /><Tooltip {...tip} /><Bar dataKey="utilisation_pct" name="Utilisation %" fill="#a78bfa" radius={[6, 6, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard
              title="Peak booking hours"
              columns={[{ key: 'hour', label: 'Hour' }, { key: 'bookings', label: 'Bookings' }]}
              rows={tr.data.peak_hours.map((p) => ({ hour: `${String(p.hour).padStart(2, '0')}:00`, bookings: p.bookings }))}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tr.data.peak_hours}><CartesianGrid stroke="#2a3570" strokeDasharray="3 3" /><XAxis dataKey="hour" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} /><Bar dataKey="bookings" name="Bookings" fill="#34d399" radius={[6, 6, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard
              title="Daily bookings vs requests"
              columns={[{ key: 'date', label: 'Date' }, { key: 'bookings', label: 'Bookings' }, { key: 'requests', label: 'Requests' }]}
              rows={tr.data.daily as any}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tr.data.daily}><CartesianGrid stroke="#2a3570" strokeDasharray="3 3" /><XAxis dataKey="date" {...axis} tickFormatter={(d: string) => d.slice(5)} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} /><Legend /><Line type="monotone" dataKey="bookings" name="Bookings" stroke="#38bdf8" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="requests" name="Requests" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 3" dot={false} /></LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="mb-2 font-bold">Most requested equipment</h3>
              {ut.data.most_requested.length === 0 ? <p className="text-sm text-muted">No requests yet.</p> : (
                <ol className="list-decimal space-y-1 pl-5 text-sm">{ut.data.most_requested.map((m) => <li key={m.id}>{m.name} <Chip tone="info">{m.request_count} requests</Chip></li>)}</ol>
              )}
            </Card>
            <Card>
              <h3 className="mb-2 font-bold">Underutilised equipment</h3>
              {ut.data.underutilised.length === 0 ? <p className="text-sm text-muted">No data.</p> : (
                <ul className="space-y-1 text-sm">{ut.data.underutilised.map((u) => <li key={u.id}>{u.name}{u.laboratory_name ? <span className="text-muted"> · {u.laboratory_name}</span> : null} <Chip tone="neutral">{u.utilisation_pct.toFixed(0)}%</Chip></li>)}</ul>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}

/** Bell + popover panel listing notifications. */
export function NotificationCenter({ embedded }: { embedded?: boolean }) {
  const [open, setOpen] = useState(false)
  const q = useNotifications()
  const mark = useMarkNotificationRead()
  const markAll = useMarkAllRead()
  const nav = useNavigate()
  const root = useRef<HTMLDivElement>(null)
  const unread = q.data?.unread_count ?? 0

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onClick = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [open])

  const go = (type: string | null) => {
    if (type === 'booking_request') nav(ROUTES.requests)
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-surface hover:bg-surface2"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1 text-center text-xs font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className={`absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-2xl ${embedded ? 'bottom-full mb-2 mt-0' : ''}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-bold">Notifications</h2>
            <Button size="sm" variant="secondary" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}>Mark all read</Button>
          </div>
          <div aria-live="polite">
            {q.isLoading ? <LoadingState label="Loading…" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load notifications" /> : !q.data || q.data.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No notifications yet.</p>
            ) : (
              <ul className="space-y-2">
                {q.data.items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => { if (!n.is_read) mark.mutate(n.id); go(n.related_entity_type) }}
                      className={`w-full rounded-xl border p-3 text-left text-sm ${n.is_read ? 'border-line bg-bg' : 'border-sky-400/50 bg-sky-500/10'}`}
                    >
                      <span className="flex items-center gap-2 font-semibold">{!n.is_read && <span className="text-sky-300" aria-hidden>●</span>}{n.title}{!n.is_read && <span className="sr-only"> (unread)</span>}</span>
                      <span className="block text-muted">{n.message}</span>
                      <span className="block text-xs text-muted">{new Date(n.created_at).toLocaleString('en-GB')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
