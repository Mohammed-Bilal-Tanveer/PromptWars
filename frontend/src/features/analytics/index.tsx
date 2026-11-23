import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Button, Card, Chip, EmptyState, ErrorState, LoadingState, Notice, PageHeader, QueryBoundary, Skeleton, Stat, cx, IconChart,
  IconAlert, IconBell, IconCalendar, IconCheck, IconClock, IconCpu, IconSwap, IconWrench, IconX, IconMinus, IconCheckCircle, IconLayers,
} from '@/components/ui'
import {
  useAnalyticsOverview, useAnalyticsTrends, useAnalyticsUtilisation, useMarkAllRead, useMarkNotificationRead, useNotifications,
} from '@/hooks/useApi'
import { pct } from '@/lib/format'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'

function ChartCard<T extends object>({ title, columns, rows, children }: { title: string; columns: { key: keyof T & string; label: string }[]; rows: T[]; children: ReactNode }) {
  const [table, setTable] = useState(false)
  return (
    <Card className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <Button size="sm" variant="secondary" aria-pressed={table} onClick={() => setTable((v) => !v)}>{table ? 'Show chart' : 'Show data table'}</Button>
      </div>
      {table ? (
        <div className="max-h-72 overflow-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-surface2 text-xs font-medium text-muted"><tr>{columns.map((c) => <th key={c.key} scope="col" className="px-3 py-2">{c.label}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line hover:bg-surface2/60">{columns.map((c) => <td key={c.key} className="px-3 py-2 tabular-nums">{String(r[c.key as keyof T] ?? '')}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : rows.length === 0 ? <EmptyState title="No data yet" /> : (
        <div role="img" aria-label={`${title}. Use the Show data table button for the values.`} className="h-64 w-full">{children}</div>
      )}
    </Card>
  )
}

/* One coherent chart palette: blue, teal, amber, slate. */
const C = { blue: '#2563eb', teal: '#0d9488', amber: '#d97706', slate: '#64748b', grid: '#eaecf0', axis: '#cfd4dc', text: '#475467', ink: '#101828', border: '#e4e7ec' }
const axis = { stroke: C.axis, tick: { fill: C.text, fontSize: 12 }, tickLine: false }
const grid = { stroke: C.grid, vertical: false }

/* Chart layout constants. */
const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0]
const BAR_MAX_WIDTH = 44
const PEAK_BAR_MAX_WIDTH = 28
const LINE_STROKE_WIDTH = 2
const DASH_PATTERN = '5 3'
const TICK_FONT_SIZE_SMALL = 11
const LEGEND_FONT_SIZE = 12
const TICK_ANGLE = -30
const TICK_AREA_HEIGHT = 84
const DEPT_TICK_AREA_HEIGHT = 56
const LAB_CHART_MARGIN = { top: 4, right: 8, left: 28, bottom: 0 }
const tip = {
  cursor: { fill: 'rgba(16,24,40,0.04)' },
  contentStyle: { background: '#ffffff', border: `1px solid ${C.border}`, borderRadius: 8, color: C.ink, boxShadow: '0 4px 12px rgba(16,24,40,.08)', fontSize: 13 },
  labelStyle: { color: C.ink, fontWeight: 600 },
}

export function AnalyticsDashboard({ embedded }: { embedded?: boolean }) {
  const ov = useAnalyticsOverview()
  const ut = useAnalyticsUtilisation()
  const tr = useAnalyticsTrends()

  return (
    <div className="space-y-6">
      {!embedded && <PageHeader accent="teal" icon={<IconChart size={20} />} title="Resource analytics" subtitle="Utilisation, demand and review activity across departments." />}
      <QueryBoundary query={ov} loadingLabel="Loading overview…" skeleton={<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="rounded-2xl border border-line bg-surface p-4"><Skeleton className="h-3 w-1/2" /><Skeleton className="mt-3 h-7 w-1/3" /></div>)}</div>}>
        {(o) => (
          <>
            <Notice tone="info" title={o.data_label || 'Sample campus data'}>Demonstration analytics computed from sample campus data.</Notice>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              <Stat label="Total units" value={o.total_units} icon={<IconLayers size={18} />} gradient="neutral" />
              <Stat label="Available now" value={o.units_available} gradient="avail" icon={<IconCheckCircle size={18} />} />
              <Stat label="In use now" value={o.units_occupied} gradient="brand" icon={<IconCpu size={18} />} />
              <Stat label="In maintenance" value={o.units_maintenance} gradient="danger" icon={<IconWrench size={18} />} />
              <Stat label="Active bookings" value={o.active_bookings} gradient="brand" icon={<IconCalendar size={18} />} />
              <Stat label="Pending requests" value={o.pending_requests} gradient="warn" icon={<IconClock size={18} />} />
              <Stat label="Approved" value={o.approved_count} hint={`${o.confirmed_count} confirmed`} gradient="avail" icon={<IconCheck size={18} />} />
              <Stat label="Rejected" value={o.rejected_count} gradient="danger" icon={<IconX size={18} />} />
              <Stat label="Cancelled" value={o.cancelled_count} gradient="neutral" icon={<IconMinus size={18} />} />
              <Stat label="Avg review time" value={o.avg_review_minutes == null ? '—' : `${Math.round(o.avg_review_minutes)} min`} gradient="neutral" icon={<IconClock size={18} />} />
              <Stat label="Conflicts" value={o.conflict_count} gradient="warn" icon={<IconAlert size={18} />} />
              <Stat icon={<IconSwap size={18} />} gradient="neutral" label="Alternative acceptance" value={o.alternative_acceptance_rate == null ? '—' : pct(o.alternative_acceptance_rate <= 1 ? o.alternative_acceptance_rate * 100 : o.alternative_acceptance_rate)} hint={`${o.alternatives_accepted} of ${o.alternatives_proposed} proposed`} />
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
              rows={ut.data.by_department}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ut.data.by_department}>
                  <CartesianGrid {...grid} />
                  <XAxis
                    dataKey="name"
                    {...axis}
                    tick={{ fill: C.text, fontSize: TICK_FONT_SIZE_SMALL }}
                    interval={0}
                    angle={TICK_ANGLE}
                    textAnchor="end"
                    height={DEPT_TICK_AREA_HEIGHT}
                  />
                  <YAxis {...axis} unit="%" />
                  <Tooltip {...tip} />
                  <Bar dataKey="utilisation_pct" name="Utilisation %" fill={C.blue} radius={BAR_RADIUS} maxBarSize={BAR_MAX_WIDTH} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard
              title="Utilisation by laboratory (%)"
              columns={[{ key: 'name', label: 'Laboratory' }, { key: 'booked_hours', label: 'Booked h' }, { key: 'capacity_hours', label: 'Capacity h' }, { key: 'utilisation_pct', label: 'Utilisation %' }]}
              rows={ut.data.by_laboratory}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ut.data.by_laboratory} margin={LAB_CHART_MARGIN}>
                  <CartesianGrid {...grid} />
                  <XAxis
                    dataKey="name"
                    {...axis}
                    tick={{ fill: C.text, fontSize: TICK_FONT_SIZE_SMALL }}
                    interval={0}
                    angle={TICK_ANGLE}
                    textAnchor="end"
                    height={TICK_AREA_HEIGHT}
                  />
                  <YAxis {...axis} unit="%" />
                  <Tooltip {...tip} />
                  <Bar dataKey="utilisation_pct" name="Utilisation %" fill={C.teal} radius={BAR_RADIUS} maxBarSize={BAR_MAX_WIDTH} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard
              title="Peak booking hours"
              columns={[{ key: 'hour', label: 'Hour' }, { key: 'bookings', label: 'Bookings' }]}
              rows={tr.data.peak_hours.map((p) => ({ hour: `${String(p.hour).padStart(2, '0')}:00`, bookings: p.bookings }))}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tr.data.peak_hours}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="hour" {...axis} />
                  <YAxis {...axis} allowDecimals={false} />
                  <Tooltip {...tip} />
                  <Bar dataKey="bookings" name="Bookings" fill={C.slate} radius={BAR_RADIUS} maxBarSize={PEAK_BAR_MAX_WIDTH} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard
              title="Daily bookings vs requests"
              columns={[{ key: 'date', label: 'Date' }, { key: 'bookings', label: 'Bookings' }, { key: 'requests', label: 'Requests' }]}
              rows={tr.data.daily}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tr.data.daily}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis {...axis} allowDecimals={false} />
                  <Tooltip {...tip} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: LEGEND_FONT_SIZE, color: C.text }} />
                  <Line type="monotone" dataKey="bookings" name="Bookings" stroke={C.blue} strokeWidth={LINE_STROKE_WIDTH} dot={false} />
                  <Line type="monotone" dataKey="requests" name="Requests" stroke={C.amber} strokeWidth={LINE_STROKE_WIDTH} strokeDasharray={DASH_PATTERN} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="min-w-0">
              <h3 className="mb-3 text-[15px] font-semibold">Most requested equipment</h3>
              {ut.data.most_requested.length === 0 ? <p className="text-sm text-muted">No requests yet.</p> : (
                <ol className="divide-y divide-line text-sm">{ut.data.most_requested.map((m, i) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 items-center gap-3"><span className="tnum w-5 shrink-0 text-right text-subtle">{i + 1}.</span><span className="truncate">{m.name}</span></span>
                    <Chip tone="info">{m.request_count} requests</Chip>
                  </li>
                ))}</ol>
              )}
            </Card>
            <Card className="min-w-0">
              <h3 className="mb-3 text-[15px] font-semibold">Underutilised equipment</h3>
              {ut.data.underutilised.length === 0 ? <p className="text-sm text-muted">No data.</p> : (
                <ul className="divide-y divide-line text-sm">{ut.data.underutilised.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">{u.name}{u.laboratory_name ? <span className="text-muted"> · {u.laboratory_name}</span> : null}</span>
                    <Chip tone="neutral">{u.utilisation_pct.toFixed(0)}%</Chip>
                  </li>
                ))}</ul>
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
  const bell = useRef<HTMLButtonElement>(null)
  const unread = q.data?.unread_count ?? 0

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // Leave Esc to an open dialog (it handles its own close); otherwise close the panel and hand focus back to the bell.
      if (e.key !== 'Escape' || document.querySelector('[aria-modal="true"]')) return
      setOpen(false)
      bell.current?.focus()
    }
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
        ref={bell}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        className={cx(
          'relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-control-border bg-surface text-muted shadow-card transition-colors hover:bg-surface2 hover:text-fg lg:min-h-10 lg:min-w-10',
          open && 'bg-surface2 text-fg',
        )}
      >
        <IconBell size={20} />
        {unread > 0 && <span className="tnum absolute -right-1.5 -top-1.5 min-w-5 rounded-full border-2 border-surface bg-red-600 px-1 text-center text-[11px] font-semibold leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div role="region" aria-label="Notifications panel" className={`absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-3 text-fg shadow-pop ${embedded ? 'bottom-full mb-2 mt-0' : ''}`}>
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <h2 className="text-[15px] font-semibold">Notifications</h2>
            <Button size="sm" variant="secondary" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}>Mark all read</Button>
          </div>
          <div aria-live="polite">
            {q.isLoading ? <LoadingState label="Loading…" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load notifications" /> : !q.data || q.data.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No notifications yet.</p>
            ) : (
              <ul className="space-y-1">
                {q.data.items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => { if (!n.is_read) mark.mutate(n.id); go(n.related_entity_type) }}
                      className={cx('w-full rounded-lg border p-3 text-left text-sm transition-colors', n.is_read ? 'border-transparent hover:bg-surface2' : 'border-brand-muted bg-brand-subtle hover:bg-[#e3ebff]')}
                    >
                      <span className="flex items-center gap-2 font-semibold">{!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />}{n.title}{!n.is_read && <span className="sr-only"> (unread)</span>}</span>
                      <span className="mt-0.5 block text-muted">{n.message}</span>
                      <span className="mt-1 block text-xs text-subtle">{new Date(n.created_at).toLocaleString('en-GB')}</span>
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
