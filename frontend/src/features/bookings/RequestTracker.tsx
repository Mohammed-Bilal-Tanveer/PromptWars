import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Notice, PageHeader, QueryBoundary, SkeletonRows, Select, StatusChip, Chip, IconEye, IconChevronRight, buttonCls } from '@/components/ui'
import { ROUTES } from '@/lib/routes'
import { useAcceptAlternative, useBookingRequest, useBookingRequests, useCancelRequest } from '@/hooks/useApi'
import { toast } from '@/stores/appStore'
import { formatRange } from '@/lib/format'
import { REQUEST_STATUS_LABEL } from '@/lib/format'
import type { BookingRequest } from '@/types/api'
import { FactorBars, Section, Timeline, apiDetails } from './parts'

const PAGE = 10
const CANCELLABLE = ['pending_review', 'waitlisted', 'alternative_proposed', 'confirmed']

export function RequestDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useBookingRequest(id)
  const accept = useAcceptAlternative()
  const cancel = useCancelRequest()
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  return (
    <QueryBoundary query={q}>
      {(r: BookingRequest) => (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={r.status} />
            {r.requires_supervision && <Chip tone="warn" icon={<IconEye size={13} strokeWidth={2} />}>Supervision required</Chip>}
            <span className="font-mono text-xs text-subtle">{r.id}</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold">{r.project_title}</h3>
            <p className="mt-0.5 text-sm text-muted">{r.equipment_name} · {r.laboratory_name}{r.requested_unit_name ? ` · ${r.requested_unit_name}` : ''}</p>
            <p className="tnum mt-2 text-sm font-medium">{formatRange(r.requested_start_at, r.requested_end_at)}</p>
            <p className="mt-2 text-sm leading-relaxed">{r.purpose}</p>
            <p className="mt-2 text-xs text-subtle">Requested by {r.requester_name} ({r.requester_department_name})</p>
          </div>
          {r.status === 'waitlisted' && (
            <Notice tone="info" title="You are in the allocation queue">
              <p>This is not a reservation. LabLink includes waitlisted requests in future scheduling recommendations, and a reviewer must still approve a slot.</p>
              <p className="mt-1">Estimated queue position: <strong>{r.queue_position != null ? `#${r.queue_position}` : 'not available yet'}</strong>. It can change when other requests or availability change.</p>
            </Notice>
          )}
          {r.review_note && <Notice tone="info" title="Reviewer note">{r.review_note}</Notice>}
          <div aria-live="polite">{err && <Notice tone="danger">{err}</Notice>}</div>

          {r.proposed_alternative && r.status === 'alternative_proposed' && (
            <Notice tone="info" title="Alternative proposed by the reviewer">
              <p>{formatRange(r.proposed_alternative.start_at, r.proposed_alternative.end_at)}{r.proposed_alternative.equipment_name ? ` · ${r.proposed_alternative.equipment_name}` : ''}</p>
              {r.proposed_alternative.note && <p className="italic">{r.proposed_alternative.note}</p>}
              <Button
                className="mt-2"
                variant="success"
                loading={accept.isPending}
                onClick={() =>
                  accept.mutate(r.id, {
                    onSuccess: () => toast.success('Alternative accepted', 'Your booking is confirmed.'),
                    onError: (e) => { const x = apiDetails(e); setErr(x.message); toast.error('Could not accept alternative', x.message) },
                  })
                }
              >
                Accept alternative
              </Button>
            </Notice>
          )}

          {r.booking && (
            <Section title="Linked booking">
              <p className="text-sm">{r.booking.unit_name} ({r.booking.inventory_code}) · {formatRange(r.booking.start_at, r.booking.end_at)} · <StatusChip status={r.booking.status} /></p>
            </Section>
          )}
          <Section title={`Priority score ${Math.round(r.priority_score * 100)}%`}>
            <FactorBars factors={r.priority_factors} />
          </Section>
          {r.status === 'waitlisted' && (
            <Section title="Current alternatives">
              {r.recommendation ? <p className="text-sm">{formatRange(r.recommendation.start_at, r.recommendation.end_at)} · {r.recommendation.equipment_name} ({r.recommendation.unit_name}){r.recommendation.reason ? ` — ${r.recommendation.reason}` : ''}</p> : <p className="text-sm text-muted">No alternative slot is available right now.</p>}
            </Section>
          )}
          <Section title="History"><Timeline items={r.timeline ?? []} /></Section>

          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {CANCELLABLE.includes(r.status) && <Button variant="danger" onClick={() => setConfirm(true)}>{r.status === 'waitlisted' ? 'Leave queue' : 'Cancel request'}</Button>}
          </div>
          <ConfirmDialog
            open={confirm}
            title={r.status === 'waitlisted' ? 'Leave the allocation queue?' : 'Cancel this request?'}
            message={r.status === 'confirmed' ? 'This will also cancel the confirmed booking and free the slot.' : r.status === 'waitlisted' ? 'Your request will be cancelled and removed from the queue. You can join again later if the slot is still unavailable.' : 'The request will be withdrawn from the approval queue.'}
            confirmLabel={r.status === 'waitlisted' ? 'Leave queue' : 'Cancel request'}
            variant="danger"
            loading={cancel.isPending}
            onCancel={() => setConfirm(false)}
            onConfirm={() =>
              cancel.mutate(r.id, {
                onSuccess: () => { toast.success(r.status === 'waitlisted' ? 'Left the queue' : 'Request cancelled'); setConfirm(false) },
                onError: (e) => { setConfirm(false); const x = apiDetails(e); setErr(x.message); toast.error('Could not cancel', x.message) },
              })
            }
          />
        </div>
      )}
    </QueryBoundary>
  )
}

export function RequestTracker({ embedded }: { embedded?: boolean }) {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const query = useBookingRequests({ status: status || undefined, q: q || undefined, page, page_size: PAGE })

  return (
    <div className="space-y-5">
      {!embedded && <PageHeader title="My requests" subtitle="Track the booking requests you have submitted and their current status." />}
      <Card className="grid gap-3 sm:grid-cols-2">
        <Field label="Search requests" htmlFor="rt-q">
          <Input id="rt-q" type="search" value={q} placeholder="Project, equipment or requester" onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </Field>
        <Field label="Status" htmlFor="rt-status">
          <Select id="rt-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
            <option value="">All statuses</option>
            {Object.entries(REQUEST_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
      </Card>

      <QueryBoundary query={query} loadingLabel="Loading requests…" skeleton={<SkeletonRows count={4} />}>
        {(p) =>
          p.items.length === 0 ? (
            <EmptyState title="No requests yet" hint="Submit a request from Discover or the Calendar to track it here." action={<Link to={ROUTES.discover} className={buttonCls('primary')}>Browse equipment</Link>} />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Booking requests</caption>
                  <thead className="border-b border-line bg-surface2 text-xs font-medium text-muted">
                    <tr><th scope="col" className="px-3 py-2.5 font-medium">Project and equipment</th><th scope="col" className="px-3 py-2.5 font-medium">When</th><th scope="col" className="px-3 py-2.5 font-medium">Status</th><th scope="col" className="px-3 py-2.5 text-right font-medium">Priority</th><th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {p.items.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-surface2/60">
                        <td className="px-3 py-3 font-medium">{r.project_title}<div className="text-xs font-normal text-muted">{r.equipment_name} · {r.requester_name}</div></td>
                        <td className="tnum whitespace-nowrap px-3 py-3 text-muted">{formatRange(r.requested_start_at, r.requested_end_at)}</td>
                        <td className="px-3 py-3"><StatusChip status={r.status} /></td>
                        <td className="tnum px-3 py-3 text-right">{Math.round(r.priority_score * 100)}%</td>
                        <td className="px-3 py-3 text-right"><Button size="sm" variant="secondary" onClick={() => setOpen(r.id)} aria-label={`View details for ${r.project_title}`}>Details</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-3 md:hidden">
                {p.items.map((r) => (
                  <li key={r.id}>
                    <Card>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><div className="truncate font-semibold">{r.project_title}</div><div className="text-xs text-muted">{r.equipment_name}</div></div>
                        <StatusChip status={r.status} />
                      </div>
                      <p className="tnum mt-2 text-sm text-muted">{formatRange(r.requested_start_at, r.requested_end_at)}</p>
                      <Button className="mt-3 w-full" size="sm" variant="secondary" onClick={() => setOpen(r.id)} aria-label={`View details for ${r.project_title}`}>Details <IconChevronRight size={16} /></Button>
                    </Card>
                  </li>
                ))}
              </ul>
              <nav className="flex items-center justify-between gap-2" aria-label="Pagination">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <span className="tnum text-center text-sm text-muted" aria-live="polite">Page {p.page} of {Math.max(1, Math.ceil(p.total / PAGE))} · {p.total} request{p.total === 1 ? '' : 's'}</span>
                <Button variant="secondary" disabled={page * PAGE >= p.total} onClick={() => setPage(page + 1)}>Next</Button>
              </nav>
            </>
          )
        }
      </QueryBoundary>

      <Modal open={!!open} onClose={() => setOpen(null)} title="Request details" side={!embedded}>
        {open && <RequestDetail id={open} onClose={() => setOpen(null)} />}
      </Modal>
    </div>
  )
}
