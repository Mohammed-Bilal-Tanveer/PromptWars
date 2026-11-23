import { useState } from 'react'
import { Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Notice, QueryBoundary, Select, StatusChip, Chip } from '@/components/ui'
import { useAcceptAlternative, useBookingRequest, useBookingRequests, useCancelRequest } from '@/hooks/useApi'
import { toast } from '@/stores/appStore'
import { formatRange } from '@/lib/format'
import { REQUEST_STATUS_LABEL } from '@/lib/format'
import type { BookingRequest } from '@/types/api'
import { FactorBars, Section, Timeline, apiDetails } from './parts'

const PAGE = 10
const CANCELLABLE = ['pending_review', 'alternative_proposed', 'confirmed']

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
            {r.requires_supervision && <Chip tone="warn" icon="⚠">Supervision required</Chip>}
            <span className="font-mono text-xs text-muted">{r.id}</span>
          </div>
          <div>
            <h3 className="text-lg font-bold">{r.project_title}</h3>
            <p className="text-sm text-muted">{r.equipment_name} · {r.laboratory_name}{r.requested_unit_name ? ` · ${r.requested_unit_name}` : ''}</p>
            <p className="text-sm">{formatRange(r.requested_start_at, r.requested_end_at)}</p>
            <p className="mt-1 text-sm">{r.purpose}</p>
            <p className="text-xs text-muted">Requested by {r.requester_name} ({r.requester_department_name})</p>
          </div>
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
          <Section title="History"><Timeline items={r.timeline ?? []} /></Section>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            {CANCELLABLE.includes(r.status) && <Button variant="danger" onClick={() => setConfirm(true)}>Cancel request</Button>}
          </div>
          <ConfirmDialog
            open={confirm}
            title="Cancel this request?"
            message={r.status === 'confirmed' ? 'This will also cancel the confirmed booking and free the slot.' : 'The request will be withdrawn from the approval queue.'}
            confirmLabel="Cancel request"
            variant="danger"
            loading={cancel.isPending}
            onCancel={() => setConfirm(false)}
            onConfirm={() =>
              cancel.mutate(r.id, {
                onSuccess: () => { toast.success('Request cancelled'); setConfirm(false) },
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
    <div className="space-y-4">
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

      <QueryBoundary query={query} loadingLabel="Loading requests…">
        {(p) =>
          p.items.length === 0 ? (
            <EmptyState title="No booking requests found" hint="Submit a request from Discover or the Calendar." />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-line md:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Booking requests</caption>
                  <thead className="bg-surface2 text-xs uppercase text-muted">
                    <tr><th className="p-3">Project</th><th className="p-3">Equipment</th><th className="p-3">When</th><th className="p-3">Status</th><th className="p-3">Priority</th><th className="p-3"><span className="sr-only">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {p.items.map((r) => (
                      <tr key={r.id} className="border-t border-line">
                        <td className="p-3 font-semibold">{r.project_title}<div className="text-xs font-normal text-muted">{r.requester_name}</div></td>
                        <td className="p-3">{r.equipment_name}</td>
                        <td className="p-3">{formatRange(r.requested_start_at, r.requested_end_at)}</td>
                        <td className="p-3"><StatusChip status={r.status} /></td>
                        <td className="p-3 tabular-nums">{Math.round(r.priority_score * 100)}%</td>
                        <td className="p-3"><Button size="sm" variant="secondary" onClick={() => setOpen(r.id)} aria-label={`View details for ${r.project_title}`}>Details</Button></td>
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
                      <p className="mt-1 text-sm">{formatRange(r.requested_start_at, r.requested_end_at)}</p>
                      <Button className="mt-2" size="sm" variant="secondary" onClick={() => setOpen(r.id)} aria-label={`View details for ${r.project_title}`}>Details</Button>
                    </Card>
                  </li>
                ))}
              </ul>
              <nav className="flex items-center justify-between" aria-label="Pagination">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <span className="text-sm text-muted" aria-live="polite">Page {p.page} of {Math.max(1, Math.ceil(p.total / PAGE))} · {p.total} request{p.total === 1 ? '' : 's'}</span>
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
