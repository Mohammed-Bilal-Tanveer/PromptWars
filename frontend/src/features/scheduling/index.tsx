import { useState } from 'react'
import {
  Button, Card, Chip, EmptyState, Field, Input, Modal, Notice, PageHeader, QueryBoundary, Select, StatusChip,
  IconAlert, IconCheckCircle, IconInfo, IconSearch, IconSliders,
} from '@/components/ui'
import { useBookingRequests, useConflicts, useEquipmentList, useProposeAlternative, useRecommend } from '@/hooks/useApi'
import { useAppStore, toast } from '@/stores/appStore'
import { campusDateOf, campusTimeOf, formatRange, localISO } from '@/lib/format'
import { BookingForm } from '@/features/bookings/BookingForm'
import { AlternativeList, FactorBars, Section, apiDetails } from '@/features/bookings/parts'
import type { Alternative, Conflict, SchedulingResult } from '@/types/api'
import { DecisionVisualiser } from './DecisionVisualiser'
import type { DecisionResponse } from './types'

const SEV_TONE = { high: 'danger', medium: 'warn', low: 'info' } as const

function ConflictList({ items }: { items: Conflict[] }) {
  if (!items.length) return <p className="flex items-center gap-2 text-sm text-muted"><IconCheckCircle size={18} className="text-emerald-600" />No conflicts detected.</p>
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id} className="rounded-xl border border-line bg-surface p-3.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={SEV_TONE[c.severity]} icon={c.severity === 'low' ? <IconInfo size={13} strokeWidth={2} /> : <IconAlert size={13} strokeWidth={2} />}>{c.severity} severity</Chip>
            <span className="font-medium">{c.equipment_name}</span>
            <span className="tnum text-muted">{formatRange(c.start_at, c.end_at)}</span>
          </div>
          <p className="mt-1.5 text-muted">{c.message}</p>
        </li>
      ))}
    </ul>
  )
}

export function SchedulingStudio({ embedded }: { embedded?: boolean }) {
  const conflicts = useConflicts()
  const pending = useBookingRequests({ status: 'pending_review,waitlisted,alternative_proposed', page_size: 50 })
  const eqList = useEquipmentList({ page_size: 100, sort: 'name' })
  const recommend = useRecommend()
  const propose = useProposeAlternative()
  const setDraft = useAppStore((s) => s.setBookingDraft)

  const [resp, setResp] = useState<DecisionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formFor, setFormFor] = useState<string | null>(null)
  const [eqId, setEqId] = useState('')
  const [duration, setDuration] = useState('60')
  const [deadline, setDeadline] = useState('')
  const [wStart, setWStart] = useState('')
  const [wEnd, setWEnd] = useState('')
  const [formErr, setFormErr] = useState<string | null>(null)

  const run = (body: Parameters<typeof recommend.mutate>[0]) => {
    setError(null)
    recommend.mutate(body, {
      onSuccess: (r) => setResp(r as DecisionResponse),
      onError: (e) => setError(apiDetails(e).message),
    })
  }

  const optimise = () => {
    const ids = (pending.data?.items ?? []).map((r) => r.id)
    if (!ids.length) { setError('There are no pending requests to optimise.'); return }
    run({ request_ids: ids, horizon_days: 7 })
  }

  const findSlots = (e: React.FormEvent) => {
    e.preventDefault()
    const eid = eqId || eqList.data?.items[0]?.id
    const mins = Number(duration)
    if (!eid) { setFormErr('Choose equipment.'); return }
    if (!mins || mins < 15) { setFormErr('Duration must be at least 15 minutes.'); return }
    if (wStart && wEnd && wEnd <= wStart) { setFormErr('Window end must be after window start.'); return }
    setFormErr(null)
    run({
      equipment_type_id: eid,
      duration_minutes: mins,
      deadline: deadline || undefined,
      window_start: wStart || undefined,
      window_end: wEnd || undefined,
      horizon_days: 7,
    })
  }

  const useSlot = (res: Pick<SchedulingResult, 'request_id'>, a: Alternative) => {
    if (res.request_id) {
      propose.mutate(
        { id: res.request_id, start_at: a.start_at, end_at: a.end_at, equipment_unit_id: a.unit_id, equipment_type_id: a.equipment_type_id },
        {
          onSuccess: () => toast.success('Alternative proposed', 'The requester can now accept it from My Requests.'),
          onError: (e) => toast.error('Could not propose alternative', apiDetails(e).message),
        },
      )
      return
    }
    openForm(a.equipment_type_id, a.start_at, a.end_at)
  }
  const openForm = (equipmentId: string, start: string, end: string) => {
    setDraft({ equipmentId, start: localISO(campusDateOf(start), campusTimeOf(start)), end: localISO(campusDateOf(end), campusTimeOf(end)) })
    setFormFor(equipmentId)
  }

  return (
    <div className="space-y-5">
      {!embedded && <PageHeader accent="amber" icon={<IconSliders size={20} />} title="Scheduling Studio" subtitle="Spot conflicts, then let the solver suggest fair slots for pending requests or a new booking." />}
      <Notice tone="info" title="Recommendations only">
        The solver suggests slots; nothing is booked or approved automatically. Use the booking form or approval desk to act on a suggestion.
      </Notice>

      <Card>
        <Section title="Current conflicts">
          <div aria-live="polite">
            <QueryBoundary query={conflicts} loadingLabel="Detecting conflicts…">{(c) => <ConflictList items={c.conflicts} />}</QueryBoundary>
          </div>
        </Section>
      </Card>

      <div className={embedded ? 'space-y-5' : 'grid gap-5 lg:grid-cols-2'}>
        <Card className="space-y-3">
          <Section title="Optimise pending requests">
            <p className="text-sm text-muted">
              Jointly allocate all {pending.data?.total ?? 0} pending, waitlisted or alternative-proposed requests over the next 7 days.
            </p>
            <div className="pt-1"><Button onClick={optimise} loading={recommend.isPending} disabled={pending.isLoading}><IconSliders size={18} /> Optimise pending requests</Button></div>
          </Section>
        </Card>

        <Card>
          <form onSubmit={findSlots} className="space-y-3" aria-label="Find slots">
            <Section title="Find slots">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Equipment" htmlFor="ss-eq" className="sm:col-span-2">
                  <Select id="ss-eq" value={eqId || eqList.data?.items[0]?.id || ''} onChange={(e) => setEqId(e.target.value)}>
                    {(eqList.data?.items ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </Select>
                </Field>
                <Field label="Duration (minutes)" htmlFor="ss-dur">
                  <Input id="ss-dur" type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} />
                </Field>
                <Field label="Deadline (optional)" htmlFor="ss-deadline">
                  <Input id="ss-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </Field>
                <Field label="Window start (optional)" htmlFor="ss-ws">
                  <Input id="ss-ws" type="datetime-local" value={wStart} onChange={(e) => setWStart(e.target.value)} />
                </Field>
                <Field label="Window end (optional)" htmlFor="ss-we">
                  <Input id="ss-we" type="datetime-local" value={wEnd} onChange={(e) => setWEnd(e.target.value)} />
                </Field>
              </div>
              {formErr && <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-red-700"><IconAlert size={16} /> {formErr}</p>}
              <div className="pt-1"><Button type="submit" variant="secondary" loading={recommend.isPending}><IconSearch size={18} /> Find slots</Button></div>
            </Section>
          </form>
        </Card>
      </div>

      <div aria-live="polite" className="space-y-4">
        {error && <Notice tone="danger" title="Scheduling failed">{error}</Notice>}
        {resp && (
          <>
            {resp.results.length === 0 ? <EmptyState title="No recommendations" hint="Try a different window or duration." /> : <DecisionVisualiser data={resp} onUse={useSlot} busy={propose.isPending} />}
            <p className="rounded-lg bg-surface2 px-3 py-2 text-xs text-muted" data-testid="solver-footer">
              Solved with OR-Tools CP-SAT in {Math.round(resp.solve_time_ms)} ms (status: {resp.solver_status}) — recommendation only, nothing is booked automatically.
            </p>
          </>
        )}
      </div>

      <Card>
        <Section title="How the priority score works">
          <p className="rounded-lg border border-line bg-surface2/60 px-3 py-2 font-mono text-[13px] text-fg">
            Score = 0.40 × deadline urgency + 0.25 × waiting time + 0.20 × fairness + 0.15 × preference fit. Each factor is normalised between 0 and 1.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted marker:text-subtle">
            <li><strong className="font-medium text-fg">Deadline urgency</strong> rises as the deadline approaches.</li>
            <li><strong className="font-medium text-fg">Waiting time</strong> rises the longer a request has been pending.</li>
            <li><strong className="font-medium text-fg">Fairness</strong> is higher for requesters and departments with fewer recently allocated hours (last 14 days). Identity never earns a bonus.</li>
            <li><strong className="font-medium text-fg">Preference fit</strong> rewards slots close to the requested time and unit.</li>
          </ul>
        </Section>
      </Card>

      <Modal open={!!formFor} onClose={() => setFormFor(null)} title="Request a booking" wide>
        {formFor && <BookingForm equipmentId={formFor} embedded onCancel={() => setFormFor(null)} />}
      </Modal>
    </div>
  )
}
