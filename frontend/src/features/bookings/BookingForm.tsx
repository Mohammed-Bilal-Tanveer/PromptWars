import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Chip, Field, Input, LoadingState, ErrorState, Notice, Select, StatusChip, Textarea } from '@/components/ui'
import { useAvailability, useCreateBookingRequest, useDepartments, useEquipmentDetail } from '@/hooks/useApi'
import { useAppStore, toast } from '@/stores/appStore'
import { campusDate, campusDateOf, campusTimeOf, localISO, minutesToLabel } from '@/lib/format'
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
    setConflict(null)
    setReasons([])
    const v = validate()
    setErrs(v)
    if (Object.keys(v).length) return
    setRequester({ name: name.trim(), departmentId: dept })
    create.mutate(
      {
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
          toast.success('Booking request submitted', `Request ${r.id} is pending review.`)
          onSubmitted?.(r.id)
        },
        onError: (err) => {
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

  if (done) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <Notice tone="ok" title="Request submitted">
          Your request for {done.equipment_name} is waiting for the demo approval desk. Nothing is booked until it is approved.
        </Notice>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">Request ID</dt>
          <dd className="font-mono break-all">{done.id}</dd>
          <dt className="text-muted">Status</dt>
          <dd><StatusChip status={done.status} /></dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Link to={ROUTES.requests} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface2 px-4 text-sm font-semibold">My requests</Link>
          <Link to={ROUTES.approvals} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface2 px-4 text-sm font-semibold">Demo approval desk</Link>
          {onCancel && <Button variant="ghost" onClick={onCancel}>Close</Button>}
        </div>
      </div>
    )
  }

  const freeUnits = av.data?.requested
  return (
    <form onSubmit={submit} noValidate className={embedded ? 'space-y-4' : 'max-w-3xl space-y-4'} aria-label={`Booking request for ${e.name}`}>
      <div className="rounded-xl border border-line bg-bg p-3 text-sm">
        <div className="font-bold">{e.name} <span className="font-normal text-muted">· {e.laboratory_name}</span></div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Chip tone="neutral">Min {minutesToLabel(e.min_booking_minutes)}</Chip>
          <Chip tone="neutral">Max {minutesToLabel(e.max_booking_minutes)}</Chip>
          <Chip tone="neutral">Setup {e.setup_minutes} min</Chip>
          <Chip tone="neutral">Cleanup {e.cleanup_minutes} min</Chip>
          {e.requires_supervision && <Chip tone="warn" icon="⚠">Supervision required</Chip>}
        </div>
        {e.requires_supervision && <p className="mt-2 text-xs text-amber-200">This equipment requires a supervisor present. The approval desk will check this before confirming.</p>}
        {altNote && <p className="mt-2 text-xs text-sky-200">{altNote}</p>}
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
        <span className="text-sm text-muted">Duration:</span>
        {quick.map((m) => (
          <Button key={m} type="button" size="sm" variant={duration === m ? 'primary' : 'secondary'} onClick={() => setEnd(fromMin(toMin(start || '09:00') + m))}>
            {minutesToLabel(m)}
          </Button>
        ))}
      </div>

      <div aria-live="polite" className="text-sm">
        {windowOk ? (
          av.isLoading ? <span className="text-muted">Checking availability…</span>
          : freeUnits ? (
            freeUnits.is_available
              ? <Notice tone="ok">{freeUnits.free_units} unit{freeUnits.free_units === 1 ? '' : 's'} free for this window (advisory — final check happens on submit).</Notice>
              : <Notice tone="warn" title="Not available for this window">{freeUnits.reasons.length ? freeUnits.reasons.join(' ') : 'No free units in this window.'}</Notice>
          ) : null
        ) : <span className="text-muted">Choose a valid start and end time to check availability.</span>}
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
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3" data-testid="conflict-panel">
            <p className="font-semibold text-amber-200">Slot conflict</p>
            <p className="text-sm">{conflict.message}</p>
            {conflict.reasons.length > 0 && <ul className="list-disc pl-5 text-sm">{conflict.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
            <p className="mt-2 text-sm font-semibold">Suggested alternatives</p>
            <AlternativeList items={conflict.alternatives} onPick={applySlot} pickLabel="Use this slot" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={create.isPending}>Submit request</Button>
      </div>
    </form>
  )
}
