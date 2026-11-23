import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Chip, ConfirmDialog, Field, Input, LoadingState, ErrorState, Notice, Select, StatusChip, Textarea, buttonCls, IconAlert, IconEye, IconInfo, IconSwap } from '@/components/ui'
import { useAvailability, useCreateBookingRequest, useDepartments, useEquipmentDetail } from '@/hooks/useApi'
import { useAppStore, toast } from '@/stores/appStore'
import { formatRange, campusDate, campusDateOf, campusTimeOf, localISO, minutesToLabel } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import type { Alternative, BookingRequest } from '@/types/api'
import { AlternativeList, apiDetails, fromMin, toMin } from './parts'

type Errs = Partial<Record<'title' | 'name' | 'dept' | 'date' | 'start' | 'end' | 'purpose' | 'hours', string>>

export function BookingForm({ equipmentId, onSubmitted, onCancel, embedded }: { equipmentId: string; onSubmitted?: (requestId: string) => void; onCancel?: () => void; embedded?: boolean }) {
  const draft = useAppStore((s) => s.bookingDraft)
  const requester = useAppStore((s) => s.requester)
  const setRequester = useAppStore((s) => s.setRequester)
  const d = draft && draft.equipmentId === equipmentId ? draft : null

  const [eqId, setEqId] = useState(equipmentId)
  const [altNote, setAltNote] = useState<string | null>(null)
  const [title, setTitle] = useState(d?.projectTitle ?? '')
  const [name, setName] = useState(requester.name)
  const [dept, setDept] = useState(requester.departmentId)
  const [date, setDate] = useState(d?.start ? d.start.slice(0, 10) : campusDate(1))
  const [start, setStart] = useState(d?.start ? d.start.slice(11, 16) : '10:00')
  const [end, setEnd] = useState(d?.end ? d.end.slice(11, 16) : '12:00')
  const [unit, setUnit] = useState('')
  const [purpose, setPurpose] = useState(d?.purpose ?? '')
  const [deadline, setDeadline] = useState('')
  const [hours, setHours] = useState(d?.estimatedHours != null ? String(d.estimatedHours) : '')
  const [errs, setErrs] = useState<Errs>({})
  const [conflict, setConflict] = useState<{ message: string; alternatives: Alternative[]; reasons: string[] } | null>(null)
  const [reasons, setReasons] = useState<string[]>([])
  const [queueOpen, setQueueOpen] = useState(false)
  const [done, setDone] = useState<BookingRequest | null>(null)

  useEffect(() => setEqId(equipmentId), [equipmentId])

  const eq = useEquipmentDetail(eqId)
  const depts = useDepartments()
  const create = useCreateBookingRequest()

  const e = eq.data
  const windowOk = !!date && !!start && !!end && toMin(end) > toMin(start)
  const av = useAvailability(eqId, date || undefined, windowOk ? localISO(date, start) : undefined, windowOk ? localISO(date, end) : undefined)
  const duration = windowOk ? toMin(end) - toMin(start) : 0

  const quick = useMemo(() => [30, 60, 120, 180, 240].filter((m) => !e || (m >= e.min_booking_minutes && m <= e.max_booking_minutes)), [e])

  function validate(): Errs {
    const x: Errs = {}
    if (title.trim().length < 3) x.title = 'Enter a project title (at least 3 characters).'
    if (!name.trim()) x.name = 'Enter your display name.'
    if (!dept) x.dept = 'Select your department.'
    if (!date) x.date = 'Choose a date.'
    else if (date < campusDate(0)) x.date = 'Date cannot be in the past.'
    if (!start) x.start = 'Choose a start time.'
    if (!end) x.end = 'Choose an end time.'
    else if (start && toMin(end) <= toMin(start)) x.end = 'End time must be after the start time.'
    else if (e && duration < e.min_booking_minutes) x.end = `Minimum booking is ${minutesToLabel(e.min_booking_minutes)}.`
    else if (e && duration > e.max_booking_minutes) x.end = `Maximum booking is ${minutesToLabel(e.max_booking_minutes)}.`
    if (purpose.trim().length < 3) x.purpose = 'Describe the purpose (at least 3 characters).'
    if (hours && (isNaN(Number(hours)) || Number(hours) <= 0)) x.hours = 'Estimated hours must be a positive number.'
    return x
  }

  function applySlot(a: Alternative) {
    setEqId(a.equipment_type_id)
    setAltNote(a.is_alternative_equipment ? `Switched to alternative equipment: ${a.equipment_name}.` : null)
    setDate(campusDateOf(a.start_at))
    setStart(campusTimeOf(a.start_at))
    setEnd(campusTimeOf(a.end_at))
    setUnit(a.equipment_type_id === eqId ? a.unit_id : '')
    setConflict(null)
    setReasons([])
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault()
    send(false)
  }

  function send(joinWaitlist: boolean) {
    setReasons([])
    if (!joinWaitlist) setConflict(null)
    const v = validate()
    setErrs(v)
    if (Object.keys(v).length) { setQueueOpen(false); return }
    setRequester({ name: name.trim(), departmentId: dept })
    create.mutate(
      {
        ...(joinWaitlist ? { join_waitlist: true } : {}),
        project_title: title.trim(),
        requester_name: name.trim(),
        requester_department_id: dept,
        equipment_type_id: eqId,
        requested_unit_id: unit || undefined,
        start_at: localISO(date, start),
        end_at: localISO(date, end),
        estimated_hours: hours ? Number(hours) : undefined,
        purpose: purpose.trim(),
        deadline: deadline || undefined,
        project_id: d?.projectId,
      },
      {
        onSuccess: (r) => {
          setDone(r)
          setQueueOpen(false)
          if (r.status === 'waitlisted') toast.success('Added to the allocation queue', `Request ${r.id} is waitlisted. Nothing is reserved.`)
          else toast.success('Booking request submitted', `Request ${r.id} is pending review.`)
          // A waitlisted request is NOT a submitted booking: keep the queue confirmation panel (reference, estimated
          // position, "not a reservation") on screen instead of letting the host close the dialog with a generic toast.
          if (r.status !== 'waitlisted') onSubmitted?.(r.id)
        },
        onError: (err) => {
          setQueueOpen(false)
          const x = apiDetails(err)
          if (x.status === 409 && x.code === 'SLOT_CONFLICT') setConflict({ message: x.message, alternatives: x.alternatives, reasons: x.reasons })
          else if (x.status === 400 || x.status === 422) setReasons(x.reasons.length ? x.reasons : [x.message])
          else toast.error('Could not submit request', x.message)
        },
      },
    )
  }

  if (eq.isLoading) return <LoadingState label="Loading equipment…" />
  if (eq.isError || !e) return <ErrorState error={eq.error} onRetry={() => eq.refetch()} />

  if (done && done.status === 'waitlisted') {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <Notice tone="info" title="You joined the allocation queue">
          This is not a reservation. {done.equipment_name} is not booked for you. LabLink will include your request in future scheduling recommendations, and a reviewer must still approve any slot.
        </Notice>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 rounded-xl border border-line p-4 text-sm">
          <dt className="text-muted">Request reference</dt>
          <dd className="break-all font-mono text-[13px]">{done.id}</dd>
          <dt className="text-muted">Status</dt>
          <dd><StatusChip status={done.status} /></dd>
          <dt className="text-muted">Requested window</dt>
          <dd className="tnum">{formatRange(done.requested_start_at, done.requested_end_at)}</dd>
          {done.queue_position != null && (
            <>
              <dt className="text-muted">Estimated queue position</dt>
              <dd><span className="font-semibold">#{done.queue_position}</span> <span className="text-xs text-muted">Current estimate. It can change when requests or availability change.</span></dd>
            </>
          )}
        </dl>
        <p className="text-sm text-muted">Next step: track or leave the queue from My requests.</p>
        <div className="flex flex-wrap gap-2">
          <Link to={ROUTES.requests} className={buttonCls('primary')}>My requests</Link>
          {onCancel && <Button variant="ghost" onClick={onCancel}>Close</Button>}
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <Notice tone="ok" title="Request submitted">
          Your request for {done.equipment_name} is waiting for the demo approval desk. Nothing is booked until it is approved.
        </Notice>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 rounded-xl border border-line p-4 text-sm">
          <dt className="text-muted">Request ID</dt>
          <dd className="break-all font-mono text-[13px]">{done.id}</dd>
          <dt className="text-muted">Status</dt>
          <dd><StatusChip status={done.status} /></dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Link to={ROUTES.requests} className={buttonCls('primary')}>My requests</Link>
          <Link to={ROUTES.approvals} className={buttonCls('secondary')}>Demo approval desk</Link>
          {onCancel && <Button variant="ghost" onClick={onCancel}>Close</Button>}
        </div>
      </div>
    )
  }

  const freeUnits = av.data?.requested
  return (
    <>
    <form onSubmit={submit} noValidate className={embedded ? 'space-y-4' : 'max-w-3xl space-y-4'} aria-label={`Booking request for ${e.name}`}>
      <div className="rounded-xl border border-line bg-surface2/60 p-3.5 text-sm">
        <div className="font-semibold">{e.name} <span className="font-normal text-muted">· {e.laboratory_name}</span></div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip tone="neutral">Min {minutesToLabel(e.min_booking_minutes)}</Chip>
          <Chip tone="neutral">Max {minutesToLabel(e.max_booking_minutes)}</Chip>
          <Chip tone="neutral">Setup {e.setup_minutes} min</Chip>
          <Chip tone="neutral">Cleanup {e.cleanup_minutes} min</Chip>
          {e.requires_supervision && <Chip tone="warn" icon={<IconEye size={13} strokeWidth={2} />}>Supervision required</Chip>}
        </div>
        {e.requires_supervision && <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-900"><IconAlert size={14} className="mt-px shrink-0 text-amber-600" />This equipment requires a supervisor present. The approval desk will check this before confirming.</p>}
        {altNote && <p className="mt-2 flex items-start gap-1.5 text-xs text-sky-900"><IconSwap size={14} className="mt-px shrink-0 text-sky-600" />{altNote}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Project title" htmlFor="bf-title" error={errs.title} className="sm:col-span-2">
          <Input id="bf-title" value={title} onChange={(x) => setTitle(x.target.value)} maxLength={200} aria-invalid={!!errs.title} />
        </Field>
        <Field label="Your display name" htmlFor="bf-name" error={errs.name}>
          <Input id="bf-name" value={name} onChange={(x) => setName(x.target.value)} maxLength={100} aria-invalid={!!errs.name} />
        </Field>
        <Field label="Department" htmlFor="bf-dept" error={errs.dept}>
          <Select id="bf-dept" value={dept} onChange={(x) => setDept(x.target.value)}>
            <option value="">Select department…</option>
            {(depts.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </Field>
        <Field label="Date" htmlFor="bf-date" error={errs.date}>
          <Input id="bf-date" type="date" min={campusDate(0)} value={date} onChange={(x) => setDate(x.target.value)} aria-invalid={!!errs.date} />
        </Field>
        <Field label="Specific unit (optional)" htmlFor="bf-unit" hint="Leave on Any to let the approver assign a free unit.">
          <Select id="bf-unit" value={unit} onChange={(x) => setUnit(x.target.value)}>
            <option value="">Any available unit</option>
            {e.units.filter((u) => u.status === 'operational').map((u) => <option key={u.id} value={u.id}>{u.unit_name} ({u.inventory_code})</option>)}
          </Select>
        </Field>
        <Field label="Start time" htmlFor="bf-start" error={errs.start}>
          <Input id="bf-start" type="time" step={900} value={start} onChange={(x) => setStart(x.target.value)} aria-invalid={!!errs.start} />
        </Field>
        <Field label="End time" htmlFor="bf-end" error={errs.end}>
          <Input id="bf-end" type="time" step={900} value={end} onChange={(x) => setEnd(x.target.value)} aria-invalid={!!errs.end} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Duration quick pick">
        <span className="text-sm font-medium text-muted">Duration</span>
        {quick.map((m) => (
          <Button key={m} type="button" size="sm" variant={duration === m ? 'primary' : 'secondary'} onClick={() => setEnd(fromMin(toMin(start || '09:00') + m))}>
            {minutesToLabel(m)}
          </Button>
        ))}
      </div>

      <div aria-live="polite" className="text-sm">
        {windowOk ? (
          av.isLoading ? <span className="text-muted" role="status">Checking availability…</span>
          : freeUnits ? (
            freeUnits.is_available
              ? <Notice tone="ok">{freeUnits.free_units} unit{freeUnits.free_units === 1 ? '' : 's'} free for this window (advisory — final check happens on submit).</Notice>
              : <Notice tone="warn" title="Not available for this window">{freeUnits.reasons.length ? freeUnits.reasons.join(' ') : 'No free units in this window.'}</Notice>
          ) : null
        ) : <span className="flex items-center gap-1.5 text-muted"><IconInfo size={16} className="text-subtle" />Choose a valid start and end time to check availability.</span>}
      </div>

      <Field label="Purpose" htmlFor="bf-purpose" error={errs.purpose}>
        <Textarea id="bf-purpose" value={purpose} onChange={(x) => setPurpose(x.target.value)} maxLength={1000} aria-invalid={!!errs.purpose} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Deadline (optional)" htmlFor="bf-deadline" hint="Helps the priority score.">
          <Input id="bf-deadline" type="date" min={campusDate(0)} value={deadline} onChange={(x) => setDeadline(x.target.value)} />
        </Field>
        <Field label="Estimated total hours (optional)" htmlFor="bf-hours" error={errs.hours}>
          <Input id="bf-hours" type="number" min={0.5} step={0.5} value={hours} onChange={(x) => setHours(x.target.value)} aria-invalid={!!errs.hours} />
        </Field>
      </div>

      <div aria-live="assertive">
        {reasons.length > 0 && (
          <Notice tone="danger" title="This request cannot be submitted">
            <ul className="list-disc pl-5">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </Notice>
        )}
        {conflict && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950" data-testid="conflict-panel">
            <p className="flex items-center gap-2 font-semibold text-amber-900"><IconAlert size={18} className="text-amber-600" />Slot conflict</p>
            <p className="mt-1 text-sm">Requested slot: <strong className="tnum">{formatRange(localISO(date, start), localISO(date, end))}</strong> is unavailable.</p>
            <p className="mt-1 text-sm">{conflict.message}</p>
            {conflict.reasons.length > 0 && <ul className="mt-1 list-disc pl-5 text-sm">{conflict.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
            <p className="mb-2 mt-3 text-sm font-semibold">Suggested alternatives</p>
            <AlternativeList items={conflict.alternatives} onPick={applySlot} pickLabel="Use this slot" />
            <div className="mt-4 border-t border-amber-200 pt-3">
              <p className="text-sm">Or keep your interest in this slot. Joining the queue does not reserve the equipment.</p>
              <Button type="button" variant="secondary" className="mt-2" onClick={() => setQueueOpen(true)}>Join the allocation queue</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={create.isPending}>Submit request</Button>
      </div>
    </form>
    <ConfirmDialog
      open={queueOpen}
      title="Join the allocation queue?"
      message="This workstation is fully booked for the selected time. You can choose one of the suggested alternatives or join the intelligent allocation queue. LabLink will include your request in future scheduling recommendations. Joining the queue does not automatically reserve the equipment."
      confirmLabel="Join the queue"
      loading={create.isPending}
      onCancel={() => setQueueOpen(false)}
      onConfirm={() => send(true)}
    />
    </>
  )
}
