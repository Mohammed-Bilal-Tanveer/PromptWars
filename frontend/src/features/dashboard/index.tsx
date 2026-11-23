import { Link } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, QueryBoundary, Stat, StatusChip } from '@/components/ui'
import { useAnalyticsOverview, useBookingRequests, useDepartments } from '@/hooks/useApi'
import { formatRange, pct } from '@/lib/format'
import { ROUTES } from '@/lib/routes'

export function Overview() {
  const overview = useAnalyticsOverview()
  const depts = useDepartments()
  const recent = useBookingRequests({ page_size: 5 })
  const o = overview.data

  const steps: string[] = []
  if (o) {
    if (o.pending_requests > 0) steps.push(`${o.pending_requests} request(s) are waiting in the approval desk.`)
    if (o.conflict_count > 0) steps.push(`${o.conflict_count} scheduling conflict(s) need attention in the Scheduling Studio.`)
    if (o.units_maintenance > 0) steps.push(`${o.units_maintenance} unit(s) are under maintenance; check alternatives before booking.`)
  }
  steps.push('Describe a project in Project Lab to find matching equipment.')

  return (
    <div className="space-y-6">
      <PageHeader title="Campus overview" subtitle="Sample campus data: equipment, bookings and requests across departments." />

      {overview.isLoading ? (
        <LoadingState label="Loading campus metrics…" />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      ) : (
        o && (
          <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Units available now" value={o.units_available} hint={`of ${o.total_units} total`} gradient="avail" />
            <Stat label="Active bookings" value={o.active_bookings} gradient="sched" />
            <Stat label="Pending requests" value={o.pending_requests} gradient="warn" />
            <Stat label="Approved / confirmed" value={o.approved_count} gradient="growth" />
          </section>
        )
      )}

      <section aria-label="Quick actions">
        <h2 className="mb-2 text-lg font-bold">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link to={ROUTES.projectLab}><Button variant="ai">Analyse a project</Button></Link>
          <Link to={ROUTES.discover}><Button variant="secondary">Browse equipment</Button></Link>
          <Link to={ROUTES.approvals}><Button variant="secondary">Open approval desk</Button></Link>
          <Link to={ROUTES.campus3d}><Button variant="secondary">Explore 3D</Button></Link>
        </div>
      </section>

      <section aria-label="Departments">
        <h2 className="mb-2 text-lg font-bold">Departments</h2>
        <QueryBoundary query={depts} loadingLabel="Loading departments…">
          {(list) => (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((d) => (
                <Card key={d.id}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold">{d.name}</h3>
                    <span className="text-xs text-muted">{d.building_code}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{d.units_available} of {d.units_total} units available · {d.lab_count} labs</p>
                  <div className="mt-2">
                    <ProgressBar value={d.utilisation_pct} label={`${d.name} utilisation`} />
                    <p className="mt-1 text-xs text-muted">Utilisation {pct(d.utilisation_pct)}</p>
                  </div>
                  <Link to={ROUTES.department(d.id)} className="mt-3 inline-flex min-h-11 items-center font-semibold text-sky-300 underline">
                    View {d.name}
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </QueryBoundary>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" aria-label="Recommended next steps">
          <h2 className="text-lg font-bold">Recommended next steps</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {steps.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </Card>
        <Card as="section" aria-label="Recent requests">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Recent requests</h2>
            <Link to={ROUTES.requests} className="inline-flex min-h-11 items-center text-sm font-semibold text-sky-300 underline">All requests</Link>
          </div>
          <QueryBoundary query={recent}>
            {(page) =>
              page.items.length === 0 ? (
                <EmptyState title="No requests yet" hint="Book equipment to see requests here." />
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {page.items.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{r.equipment_name}</p>
                        <p className="truncate text-xs text-muted">{r.project_title} · {formatRange(r.requested_start_at, r.requested_end_at)}</p>
                      </div>
                      <StatusChip status={r.status} />
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryBoundary>
        </Card>
      </div>
    </div>
  )
}
