import { Link } from 'react-router-dom'
import {
  Card, buttonCls, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, QueryBoundary, Stat, StatusChip,
  IconArrowRight, IconCalendar, IconCheckCircle, IconClock, IconCube, IconFlask, IconLayers, IconSearch, IconCheckSquare,
} from '@/components/ui'
import { useAnalyticsOverview, useBookingRequests, useDepartments } from '@/hooks/useApi'
import { formatRange, pct } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { DemoEntryActions } from '@/features/landing/DemoEntryActions'
import { DemoResetButton } from '@/features/landing/DemoResetButton'

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
            <Stat label="Units available now" value={o.units_available} hint={`of ${o.total_units} total`} gradient="avail" icon={<IconLayers size={18} />} />
            <Stat label="Active bookings" value={o.active_bookings} gradient="sched" icon={<IconCalendar size={18} />} />
            <Stat label="Pending requests" value={o.pending_requests} gradient="warn" icon={<IconClock size={18} />} />
            <Stat label="Approved / confirmed" value={o.approved_count} gradient="growth" icon={<IconCheckCircle size={18} />} />
          </section>
        )
      )}

      <section aria-label="Guided demo">
        <DemoEntryActions startTo={ROUTES.overview} />
      </section>

      <section aria-label="Quick actions">
        <h2 className="mb-3 text-base font-semibold sm:text-[17px]">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link to={ROUTES.projectLab} className={buttonCls("primary")}><IconFlask size={18} /> Analyse a project</Link>
          <Link to={ROUTES.discover} className={buttonCls("secondary")}><IconSearch size={18} /> Browse equipment</Link>
          <Link to={ROUTES.approvals} className={buttonCls("secondary")}><IconCheckSquare size={18} /> Open approval desk</Link>
          <Link to={ROUTES.campus3d} className={buttonCls("secondary")}><IconCube size={18} /> Explore 3D</Link>
        </div>
      </section>

      <section aria-label="Departments">
        <h2 className="mb-3 text-base font-semibold sm:text-[17px]">Departments</h2>
        <QueryBoundary query={depts} loadingLabel="Loading departments…">
          {(list) => (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((d) => (
                <Card key={d.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{d.name}</h3>
                    <span className="rounded-md bg-surface2 px-1.5 py-0.5 font-mono text-xs text-muted">{d.building_code}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted"><span className="tnum">{d.units_available}</span> of <span className="tnum">{d.units_total}</span> units available · {d.lab_count} labs</p>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs text-muted"><span>Utilisation</span><span className="tnum font-medium text-fg">{pct(d.utilisation_pct)}</span></div>
                    <ProgressBar value={d.utilisation_pct} label={`${d.name} utilisation`} gradient="brand" />
                  </div>
                  <Link to={ROUTES.department(d.id)} className="link mt-3 inline-flex min-h-11 items-center gap-1 self-start text-sm no-underline hover:underline">
                    View {d.name} <IconArrowRight size={16} />
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </QueryBoundary>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" aria-label="Recommended next steps">
          <h2 className="text-base font-semibold sm:text-[17px]">Recommended next steps</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-muted">
            {steps.map((s) => (
              <li key={s} className="flex gap-2.5"><IconArrowRight size={16} className="mt-0.5 shrink-0 text-brand" />{s}</li>
            ))}
          </ul>
        </Card>
        <Card as="section" aria-label="Recent requests">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold sm:text-[17px]">Recent requests</h2>
            <Link to={ROUTES.requests} className="link inline-flex min-h-11 items-center text-sm">All requests</Link>
          </div>
          <QueryBoundary query={recent}>
            {(page) =>
              page.items.length === 0 ? (
                <EmptyState title="No requests yet" hint="Book equipment to see requests here." />
              ) : (
                <ul className="mt-1 divide-y divide-line">
                  {page.items.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.equipment_name}</p>
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
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
        <span>Fictional sample data. Requester and reviewer identities are simulated.</span>
        <DemoResetButton />
      </footer>
    </div>
  )
}
