import { useState } from 'react'
import { Button, Card, Chip, ConfirmDialog, EmptyState, Field, Input, Modal, Notice, QueryBoundary, Select, StatusChip, Textarea } from '@/components/ui'
import { useApprovalQueue, useApprove, useBookingRequest, useDepartments, useEquipmentList, useProposeAlternative, useReject } from '@/hooks/useApi'
import { toast } from '@/stores/appStore'
import { formatRange, humanize, localISO, REQUEST_STATUS_LABEL } from '@/lib/format'
import { AlternativeList, FactorBars, Section, Timeline, apiDetails } from '@/features/bookings/parts'
import type { Alternative, BookingRequest } from '@/types/api'

const STATUSES = ['pending_review', 'alternative_proposed', 'confirmed', 'rejected', 'cancelled']

export function ApprovalDesk({ embedded }: { embedded?: boolean }) {
  const [statuses, setStatuses] = useState<string[]>(['pending_review', 'alternative_proposed'])
  const [dept, setDept] = useState('')
  const [eq, setEq] = useState('')
  const [date, setDate] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const depts = useDepartments()
  const eqList = useEquipmentList({ page_size: 100, sort: 'name' })
  const queue = useApprovalQueue({
    status: statuses.length ? statuses.join(',') : undefined,
    department_id: dept || undefined,
    equipment_type_id: eq || undefined,
    date: date || undefined,
    page_size: 50,
  })

  const toggle = (s: string) => setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  return (
    <div className="space-y-4">
      <Notice tone="warn" title="Demo Approval Desk">
        Demo Approval Desk — simulated reviewer workflow, public, no login; not for real institutional approvals.
      </Notice>

      <Card className="space-y-3">
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Status</legend>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <label key={s} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-bg px-3 text-sm">
                <input type="checkbox" checked={statuses.includes(s)} onChange={() => toggle(s)} />
                {REQUEST_STATUS_LABEL[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Department" htmlFor="ad-dept">
            <Select id="ad-dept" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {(depts.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Equipment" htmlFor="ad-eq">
            <Select id="ad-eq" value={eq} onChange={(e) => setEq(e.target.value)}>
              <option value="">All equipment</option>
              {(eqList.data?.items ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Date" htmlFor="ad-date">
            <Input id="ad-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </Card>

      <div aria-live="polite">
        <QueryBoundary query={queue} loadingLabel="Loading approval queue…">
          {(p) =>
            p.items.length === 0 ? (
              <EmptyState icon="✅" title="The queue is empty" hint="No requests match these filters." />
            ) : (
              <ul className="space-y-3" aria-label="Approval queue">
                {p.items.map((r) => (
                  <li key={r.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{r.project_title}</span>
                          <StatusChip status={r.status} />
                          {r.requires_supervision && <Chip tone="warn" icon="⚠">Supervision</Chip>}
                        </div>
                        <p className="text-sm text-muted">{r.equipment_name} · {r.requester_name} ({r.requester_department_name})</p>
                        <p className="text-sm">{formatRange(r.requested_start_at, r.requested_end_at)}</p>
                        {r.availability_now && (
                          <p className="text-xs text-muted">{r.availability_now.free_units} of {r.availability_now.total_units} units free in the requested window</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-center" aria-label={`Priority score ${Math.round(r.priority_score * 100)} percent`}>
                          <div className="text-2xl font-extrabold tabular-nums">{Math.round(r.priority_score * 100)}</div>
                          <div className="text-[10px] uppercase text-muted">priority</div>
                        </div>
                        <Button variant="secondary" onClick={() => setSel(r.id)} aria-label={`Review ${r.project_title}`}>Review</Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )
          }
        </QueryBoundary>
      </div>

      <Modal open={!!sel} onClose={() => setSel(null)} title="Review request" side={!embedded}>
        {sel && <ReviewPane id={sel} onClose={() => setSel(null)} />}
      </Modal>
    </div>
  )
}

function ReviewPane({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useBookingRequest(id)
  const approve = useApprove()
  const reject = useReject()
  const propose = useProposeAlternative()
  const [note, setNote] = useState('')
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonErr, setReasonErr] = useState<string | null>(null)
  const [proposing, setProposing] = useState(false)
  const [pDate, setPDate] = useState('')
  const [pStart, setPStart] = useState('')
  const [pEnd, setPEnd] = useState('')
  const [pUnit, setPUnit] = useState('')
  const [pErr, setPErr] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{ message: string; alternatives: Alternative[] } | null>(null)

  const doPropose = (body: { start_at: string; end_at: string; equipment_unit_id?: string; equipment_type_id?: string }) =>
    propose.mutate(
      { id, ...body, note: note.trim() || undefined },
      {
        onSuccess: () => { toast.success('Alternative proposed', 'The requester can accept it from My Requests.'); setConflict(null); setProposing(false) },
        onError: (e) => { const x = apiDetails(e); setPErr(x.message); toast.error('Could not propose alternative', x.message) },
      },
    )

  return (
    <QueryBoundary query={q}>
      {(r: BookingRequest) => {
        const actionable = r.status === 'pending_review' || r.status === 'alternative_proposed'
        return (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={r.status} />
              <Chip tone="ai">Priority {Math.round(r.priority_score * 100)}%</Chip>
              {r.requires_supervision && <Chip tone="warn" icon="⚠">Supervision required</Chip>}
            </div>
            <div>
              <h3 className="text-lg font-bold">{r.project_title}</h3>
              <p className="text-sm text-muted">{r.equipment_name} · {r.laboratory_name}</p>
              <p className="text-sm">{formatRange(r.requested_start_at, r.requested_end_at)}</p>
              <p className="mt-1 text-sm">{r.purpose}</p>
              <p className="text-xs text-muted">{r.requester_name} ({r.requester_department_name}){r.deadline ? ` · deadline ${r.deadline.slice(0, 10)}` : ''}</p>
            </div>

            {r.analysis && (
              <Section title="Project context (AI analysis)">
                <p className="text-sm">{r.analysis.project_summary}</p>
                <div className="flex flex-wrap gap-1">{r.analysis.capabilities.map((c) => <Chip key={c} tone="ai">{humanize(c)}</Chip>)}</div>
                {r.analysis.matches.length > 0 && (
                  <p className="text-xs text-muted">Matches: {r.analysis.matches.map((m) => `${m.requirement_name} (${humanize(m.match_status)})`).join(', ')}</p>
                )}
              </Section>
            )}

            {r.availability_now && (
              <Notice tone={r.availability_now.is_available ? 'ok' : 'warn'} title="Availability in the requested window">
                {r.availability_now.free_units} of {r.availability_now.total_units} units free.
              </Notice>
            )}
            {r.recommendation && (
              <Section title="Recommended slot"><AlternativeList items={[r.recommendation]} onPick={actionable ? (a) => doPropose({ start_at: a.start_at, end_at: a.end_at, equipment_unit_id: a.unit_id, equipment_type_id: a.equipment_type_id }) : undefined} pickLabel="Propose this alternative" busy={propose.isPending} /></Section>
            )}
            <Section title="Priority factors"><FactorBars factors={r.priority_factors} /></Section>
            {r.booking && <Notice tone="ok" title="Booking confirmed">{r.booking.unit_name} ({r.booking.inventory_code}) · {formatRange(r.booking.start_at, r.booking.end_at)}</Notice>}
            <Section title="History"><Timeline items={r.timeline ?? []} /></Section>

            <div aria-live="assertive">
              {conflict && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3" data-testid="approve-conflict">
                  <p className="font-semibold text-amber-200">Cannot approve: slot conflict</p>
                  <p className="text-sm">{conflict.message}</p>
                  <AlternativeList items={conflict.alternatives} pickLabel="Propose this alternative" busy={propose.isPending}
                    onPick={(a) => doPropose({ start_at: a.start_at, end_at: a.end_at, equipment_unit_id: a.unit_id, equipment_type_id: a.equipment_type_id })} />
                </div>
              )}
              {pErr && <Notice tone="danger">{pErr}</Notice>}
            </div>

            {actionable ? (
              <div className="space-y-3 rounded-xl border border-line bg-bg p-3">
                <Field label="Reviewer note (optional)" htmlFor="rv-note">
                  <Textarea id="rv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-16" />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button variant="success" onClick={() => { setConflict(null); setPErr(null); setConfirmApprove(true) }}>Approve</Button>
                  <Button variant="danger" onClick={() => setRejecting(true)}>Reject</Button>
                  <Button variant="secondary" onClick={() => setProposing((v) => !v)} aria-expanded={proposing}>Propose alternative</Button>
                  <Button variant="ghost" onClick={onClose}>Close</Button>
                </div>
                {proposing && (
                  <form
                    className="grid gap-3 sm:grid-cols-2"
                    aria-label="Propose alternative"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!pDate || !pStart || !pEnd) { setPErr('Date, start and end are required.'); return }
                      if (pEnd <= pStart) { setPErr('End must be after start.'); return }
                      setPErr(null)
                      doPropose({ start_at: localISO(pDate, pStart), end_at: localISO(pDate, pEnd), equipment_unit_id: pUnit.trim() || undefined })
                    }}
                  >
                    <Field label="Alternative date" htmlFor="pa-date"><Input id="pa-date" type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} /></Field>
                    <Field label="Unit id (optional)" htmlFor="pa-unit"><Input id="pa-unit" value={pUnit} onChange={(e) => setPUnit(e.target.value)} placeholder={`${r.equipment_type_id}-u1`} /></Field>
                    <Field label="Alternative start" htmlFor="pa-start"><Input id="pa-start" type="time" value={pStart} onChange={(e) => setPStart(e.target.value)} /></Field>
                    <Field label="Alternative end" htmlFor="pa-end"><Input id="pa-end" type="time" value={pEnd} onChange={(e) => setPEnd(e.target.value)} /></Field>
                    <div className="sm:col-span-2"><Button type="submit" loading={propose.isPending}>Send proposal</Button></div>
                  </form>
                )}
              </div>
            ) : (
              <div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>
            )}

            <ConfirmDialog
              open={confirmApprove}
              title="Approve this request?"
              message="A fresh availability check runs now. If a unit is free, the booking is confirmed immediately."
              confirmLabel="Approve and confirm"
              variant="success"
              loading={approve.isPending}
              onCancel={() => setConfirmApprove(false)}
              onConfirm={() =>
                approve.mutate({ id, note: note.trim() || undefined }, {
                  onSuccess: (d) => { setConfirmApprove(false); toast.success('Request approved', `Booking ${d.booking.id} confirmed on ${d.booking.unit_name}.`) },
                  onError: (e) => {
                    setConfirmApprove(false)
                    const x = apiDetails(e)
                    if (x.code === 'SLOT_CONFLICT') setConflict({ message: x.message, alternatives: x.alternatives })
                    else { setPErr(x.message); toast.error('Could not approve', x.message) }
                  },
                })
              }
            />

            <Modal open={rejecting} onClose={() => setRejecting(false)} title="Reject request">
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (reason.trim().length < 3) { setReasonErr('A rejection reason of at least 3 characters is required.'); return }
                  setReasonErr(null)
                  reject.mutate({ id, reason: reason.trim(), note: note.trim() || undefined }, {
                    onSuccess: () => { toast.success('Request rejected'); setRejecting(false); setReason('') },
                    onError: (er) => setReasonErr(apiDetails(er).message),
                  })
                }}
              >
                <Field label="Rejection reason (required)" htmlFor="rj-reason" error={reasonErr}>
                  <Textarea id="rj-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} aria-invalid={!!reasonErr} />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
                  <Button type="submit" variant="danger" loading={reject.isPending}>Reject request</Button>
                </div>
              </form>
            </Modal>
          </div>
        )
      }}
    </QueryBoundary>
  )
}
