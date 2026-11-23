import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Button, Card, Chip, ConfirmDialog, EmptyState, ErrorState, Field, Input, LoadingState, Modal, Notice, PageHeader,
  QueryBoundary, Select, SkeletonCards, StatusChip, errorMessage, IconArrowLeft, IconArrowRight, IconEye, IconMapPin, IconX,
} from '@/components/ui'
import {
  useAvailability, useDepartments, useEquipmentCategories, useEquipmentDetail, useEquipmentList, useLaboratories, useSetUnitStatus,
} from '@/hooks/useApi'
import { campusDate, formatDateTime, formatRange, formatTime, humanize, localISO, minutesToLabel, pct } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { toast } from '@/stores/appStore'
import { BookingForm } from '@/features/bookings'
import { AssistantPanel } from '@/features/ai-assistant'
import type { EquipmentQuery, EquipmentStatus, EquipmentType, UnitStatus } from '@/types/api'

const PAGE_SIZE = 12
const cap = (c: string) => c.replace(/_/g, ' ')

/** Availability chip status: partially booked when only some units are free. */
export function availabilityStatus(e: { status: string; quantity_available: number; quantity_total: number }): string {
  if (e.status === 'available' && e.quantity_available > 0 && e.quantity_available < e.quantity_total) return 'partially_booked'
  return e.status
}

function EquipmentCard({ e }: { e: EquipmentType }) {
  return (
    <Card as="article" className="flex h-full flex-col transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-raised" aria-label={e.name}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 break-words font-semibold leading-snug">
          <Link to={ROUTES.equipment(e.id)} className="hover:text-brand hover:underline">{e.name}</Link>
        </h3>
        <StatusChip status={availabilityStatus(e)} />
      </div>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-subtle">{e.category}</p>
      <p className="mt-3 text-sm"><span className="tnum font-semibold">{e.quantity_available}</span> of <span className="tnum">{e.quantity_total}</span> units free</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><IconMapPin size={14} className="shrink-0 text-subtle" />{e.laboratory_name} · {e.department_name}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {e.capabilities.slice(0, 4).map((c) => <Chip key={c} tone="neutral">{cap(c)}</Chip>)}
      </div>
      <div className="mt-auto pt-4"><div className="border-t border-line pt-1">
        <Link to={ROUTES.equipment(e.id)} className="link mt-2 inline-flex min-h-11 items-center gap-1 text-sm no-underline hover:underline lg:min-h-9">
          View details<span className="sr-only"> for {e.name}</span> <IconArrowRight size={16} />
        </Link>
      </div></div>
    </Card>
  )
}

export function EquipmentCatalogue() {
  const [params] = useSearchParams()
  const initialQ = params.get('q') ?? ''
  const [qInput, setQInput] = useState(initialQ)
  const [q, setQ] = useState(initialQ)
  const [department, setDepartment] = useState('')
  const [laboratory, setLaboratory] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<EquipmentStatus | ''>('')
  const [date, setDate] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<NonNullable<EquipmentQuery['sort']>>('relevance')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [qInput])

  const depts = useDepartments()
  const labs = useLaboratories({ department_id: department || undefined })
  const cats = useEquipmentCategories()

  const windowOk = !!(date && from && to)
  const query: EquipmentQuery = useMemo(
    () => ({
      q: q || undefined,
      department_id: department || undefined,
      laboratory_id: laboratory || undefined,
      category: category || undefined,
      status: status || undefined,
      available_from: windowOk ? localISO(date, from) : undefined,
      available_to: windowOk ? localISO(date, to) : undefined,
      sort,
      page,
      page_size: PAGE_SIZE,
    }),
    [q, department, laboratory, category, status, windowOk, date, from, to, sort, page],
  )
  const list = useEquipmentList(query)
  const windowInvalid = windowOk && to <= from
  const reset = () => {
    setQInput(''); setQ(''); setDepartment(''); setLaboratory(''); setCategory(''); setStatus('')
    setDate(''); setFrom(''); setTo(''); setSort('relevance'); setPage(1)
  }
  const upd = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.page_size)) : 1

  return (
    <div className="space-y-5">
      <PageHeader title="Equipment catalogue" subtitle="Search and filter specialised equipment across all labs. Sample campus data." />
      <Card as="section" aria-label="Filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search" htmlFor="eq-q" className="sm:col-span-2">
            <Input id="eq-q" type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Name, capability, lab…" />
          </Field>
          <Field label="Department" htmlFor="eq-dept">
            <Select id="eq-dept" value={department} onChange={(e) => { setDepartment(e.target.value); setLaboratory(''); setPage(1) }}>
              <option value="">All departments</option>
              {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Laboratory" htmlFor="eq-lab">
            <Select id="eq-lab" value={laboratory} onChange={(e) => upd(setLaboratory)(e.target.value)}>
              <option value="">All laboratories</option>
              {labs.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
          <Field label="Category" htmlFor="eq-cat">
            <Select id="eq-cat" value={category} onChange={(e) => upd(setCategory)(e.target.value)}>
              <option value="">All categories</option>
              {cats.data?.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Status" htmlFor="eq-status">
            <Select id="eq-status" value={status} onChange={(e) => upd(setStatus)(e.target.value as EquipmentStatus | '')}>
              <option value="">Any status</option>
              <option value="available">Available</option>
              <option value="occupied">Fully booked now</option>
              <option value="maintenance">Under maintenance</option>
            </Select>
          </Field>
          <Field label="Sort by" htmlFor="eq-sort">
            <Select id="eq-sort" value={sort} onChange={(e) => upd(setSort)(e.target.value as NonNullable<EquipmentQuery['sort']>)}>
              <option value="relevance">Relevance</option>
              <option value="availability">Availability</option>
              <option value="name">Name</option>
              <option value="utilisation">Utilisation</option>
            </Select>
          </Field>
          <Field label="Free on date" htmlFor="eq-date">
            <Input id="eq-date" type="date" value={date} min={campusDate()} onChange={(e) => upd(setDate)(e.target.value)} />
          </Field>
          <Field label="From" htmlFor="eq-from">
            <Input id="eq-from" type="time" value={from} onChange={(e) => upd(setFrom)(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="eq-to" error={windowInvalid ? 'End time must be after start time.' : null}>
            <Input id="eq-to" type="time" value={to} onChange={(e) => upd(setTo)(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button variant="secondary" onClick={reset} className="w-full sm:w-auto">Clear filters</Button>
          </div>
        </div>
      </Card>

      <div aria-live="polite">
        {list.isLoading ? (
          <div role="status" aria-busy="true"><span className="sr-only">Searching equipment…</span><SkeletonCards count={6} /></div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.data && list.data.items.length === 0 ? (
          <EmptyState title="No equipment matches your filters" hint="Try a broader search or clear the filters, or ask the Assistant to find a match." action={<div className="flex flex-wrap justify-center gap-2"><Button variant="secondary" onClick={reset}>Clear filters</Button><Link to={ROUTES.assistant} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-brand hover:underline">Ask the Assistant</Link></div>} />
        ) : (
          list.data && (
            <>
              <p className="mb-3 text-sm text-muted"><span className="tnum font-medium text-fg">{list.data.total}</span> result{list.data.total === 1 ? '' : 's'}</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.data.items.map((e) => <EquipmentCard key={e.id} e={e} />)}
              </div>
              <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <span className="tnum text-sm text-muted">Page {page} of {totalPages}</span>
                <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </nav>
            </>
          )
        )}
      </div>
    </div>
  )
}

export function EquipmentDetailPage() {
  const { id } = useParams()
  if (!id) return <EmptyState title="No equipment selected" />
  return <EquipmentDetailPanel equipmentId={id} />
}

const UNIT_STATUSES: UnitStatus[] = ['operational', 'maintenance', 'unavailable']

function AvailabilityTimeline({ equipmentId }: { equipmentId: string }) {
  const [date, setDate] = useState(campusDate())
  const av = useAvailability(equipmentId, date)
  return (
    <Card as="section" aria-label="Availability">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-base font-semibold sm:text-[17px]">Availability</h3>
        <Field label="Date" htmlFor={`av-date-${equipmentId}`}>
          <Input id={`av-date-${equipmentId}`} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
      </div>
      <div aria-live="polite" className="mt-3">
        {av.isLoading ? (
          <LoadingState label="Loading availability…" />
        ) : av.isError ? (
          <ErrorState error={av.error} onRetry={() => av.refetch()} />
        ) : av.data && (!av.data.lab_open_at || !av.data.lab_close_at) ? (
          <Notice tone="warn">The laboratory is closed on this date.</Notice>
        ) : (
          av.data && (() => {
            const a = av.data
            const t0 = new Date(a.lab_open_at!).getTime()
            const t1 = new Date(a.lab_close_at!).getTime()
            const span = Math.max(1, t1 - t0)
            const pos = (iso: string) => Math.min(100, Math.max(0, ((new Date(iso).getTime() - t0) / span) * 100))
            return (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <p className="text-xs text-muted">Open {formatTime(a.lab_open_at)}–{formatTime(a.lab_close_at)} ({a.timezone})</p>
                  <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
                    <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border border-emerald-300 bg-emerald-100" aria-hidden />Free</li>
                    <li className="flex items-center gap-1.5"><span className="hatch-busy h-3 w-5 rounded-sm" aria-hidden />Booked</li>
                    <li className="flex items-center gap-1.5"><span className="hatch-maint h-3 w-5 rounded-sm" aria-hidden />Maintenance</li>
                  </ul>
                </div>
                {a.units.map((u) => (
                  <div key={u.unit_id}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium">{u.unit_name} <span className="font-normal text-muted">({u.inventory_code})</span></span>
                      <StatusChip status={u.status} />
                    </div>
                    <div className="relative h-6 w-full overflow-hidden rounded-md border border-emerald-200 bg-emerald-50" role="img"
                      aria-label={`${u.unit_name}: ${u.busy.length === 0 ? 'free all day' : u.busy.map((b) => `${b.kind} ${formatTime(b.start_at)} to ${formatTime(b.end_at)}`).join(', ')}`}>
                      {u.busy.map((b, i) => (
                        <div
                          key={i}
                          title={`${b.label} ${formatTime(b.start_at)}–${formatTime(b.end_at)}`}
                          className={b.kind === 'maintenance' ? 'hatch-maint absolute inset-y-0' : 'hatch-busy absolute inset-y-0'}
                          style={{ left: `${pos(b.start_at)}%`, width: `${Math.max(1, pos(b.end_at) - pos(b.start_at))}%` }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="tnum flex justify-between text-xs text-subtle" aria-hidden>
                  <span>{formatTime(a.lab_open_at)}</span><span>{formatTime(a.lab_close_at)}</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Free slots</h4>
                  {a.free_slots.length === 0 ? (
                    <p className="text-sm text-muted">No free slots on this date.</p>
                  ) : (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {a.free_slots.map((s, i) => (
                        <li key={i}><Chip tone="ok">{formatTime(s.start_at)}–{formatTime(s.end_at)} · {s.free_units} free</Chip></li>
                      ))}
                    </ul>
                  )}
                </div>
                <details>
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-muted hover:text-fg">Text list of busy periods</summary>
                  <ul className="list-disc pl-5 text-sm text-muted">
                    {a.units.flatMap((u) => u.busy.map((b, i) => (
                      <li key={`${u.unit_id}-${i}`}>{u.unit_name}: {b.kind} {formatTime(b.start_at)}–{formatTime(b.end_at)} ({b.label})</li>
                    )))}
                    {a.units.every((u) => u.busy.length === 0) && <li>No busy periods.</li>}
                  </ul>
                </details>
              </div>
            )
          })()
        )}
      </div>
    </Card>
  )
}

function DemoOperations({ equipmentId, units }: { equipmentId: string; units: { id: string; unit_name: string; status: UnitStatus }[] }) {
  const mut = useSetUnitStatus()
  const [pending, setPending] = useState<{ unitId: string; name: string; status: UnitStatus } | null>(null)
  const [sel, setSel] = useState<Record<string, UnitStatus>>({})
  return (
    <details className="rounded-2xl border border-dashed border-line-strong bg-surface px-4 py-2 sm:px-5" data-equipment={equipmentId}>
      <summary className="flex min-h-11 cursor-pointer items-center py-2 font-semibold">Demo operations (simulation)</summary>
      <p className="text-sm text-muted">
        Demo simulation: change a unit status to see maintenance flow through availability, scheduling conflicts and the 3D scene.
        Existing confirmed bookings are not cancelled.
      </p>
      <ul className="mb-3 mt-3 space-y-3">
        {units.map((u) => {
          const value = sel[u.id] ?? u.status
          return (
            <li key={u.id} className="flex flex-wrap items-end gap-2">
              <span className="min-w-28 pb-2.5 text-sm font-medium">{u.unit_name}</span>
              <Field label={`Status of ${u.unit_name}`} htmlFor={`us-${u.id}`}>
                <Select id={`us-${u.id}`} value={value} onChange={(e) => setSel((s) => ({ ...s, [u.id]: e.target.value as UnitStatus }))}>
                  {UNIT_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                </Select>
              </Field>
              <Button variant="secondary" disabled={value === u.status} onClick={() => setPending({ unitId: u.id, name: u.unit_name, status: value })}>
                Apply
              </Button>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={!!pending}
        title="Change unit status (demo simulation)"
        message={pending && <>Set <strong>{pending.name}</strong> to <strong>{humanize(pending.status)}</strong>? This is a demo simulation on sample data.</>}
        confirmLabel="Apply status"
        loading={mut.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return
          mut.mutate(
            { unitId: pending.unitId, status: pending.status, reason: 'Demo simulation' },
            {
              onSuccess: () => { toast.success('Unit status updated', `${pending.name} is now ${humanize(pending.status)}.`); setPending(null) },
              onError: (e) => { toast.error('Could not update unit', errorMessage(e)); setPending(null) },
            },
          )
        }}
      />
    </details>
  )
}

/** Shared detail panel (page + 3D inspection panel). */
export function EquipmentDetailPanel({ equipmentId, onBook, onClose, embedded }: { equipmentId: string; onBook?: (equipmentId: string) => void; onClose?: () => void; embedded?: boolean }) {
  const q = useEquipmentDetail(equipmentId)
  const [bookOpen, setBookOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const book = () => (onBook ? onBook(equipmentId) : setBookOpen(true))

  return (
    <QueryBoundary query={q} loadingLabel="Loading equipment…" skeleton={<SkeletonCards count={3} />}>
      {(e) => (
        <div className="space-y-4">
          {embedded ? (
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold">{e.name}</h2>
              {onClose && <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close equipment panel"><IconX size={18} /></Button>}
            </div>
          ) : (
            <PageHeader
              title={e.name}
              subtitle={<>{e.category} · {e.manufacturer} {e.model}</>}
              actions={onClose ? <Button variant="ghost" onClick={onClose}>Close</Button> : <Link to={ROUTES.discover} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted hover:bg-surface2 hover:text-fg"><IconArrowLeft size={16} />Back to catalogue</Link>}
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={availabilityStatus(e)} />
            <Chip tone="avail">{e.quantity_available}/{e.quantity_total} units free</Chip>
            {e.requires_supervision && <Chip tone="warn" icon={<IconEye size={13} strokeWidth={2} />}>Supervision required</Chip>}
            <Chip>Utilisation {pct(e.utilisation_pct)}</Chip>
            {e.next_free_at && <Chip>Next free {formatDateTime(e.next_free_at)}</Chip>}
          </div>
          <p className="max-w-3xl text-[15px] leading-relaxed text-muted">{e.description}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <IconMapPin size={16} className="text-subtle" />
            <Link to={ROUTES.lab(e.laboratory_id)} className="link">{e.laboratory_name}</Link> · {e.department_name}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={book}>Request booking</Button>
            <Button variant="secondary" size="lg" aria-expanded={askOpen} onClick={() => setAskOpen((v) => !v)}>Ask the assistant</Button>
          </div>
          {askOpen && <Card><AssistantPanel embedded context={{ equipment_type_id: e.id }} /></Card>}

          <div className={embedded ? 'space-y-4' : 'grid gap-4 lg:grid-cols-2'}>
            <Card as="section" aria-label="Specifications">
              <h3 className="font-semibold">Specifications</h3>
              {Object.keys(e.specifications).length === 0 ? <p className="text-sm text-muted">No specifications listed.</p> : (
                <table className="mt-3 w-full text-sm">
                  <tbody>
                    {Object.entries(e.specifications).map(([k, v]) => (
                      <tr key={k} className="border-t border-line first:border-0">
                        <th scope="row" className="w-2/5 py-2 pr-3 text-left align-top font-medium text-muted">{humanize(k)}</th>
                        <td className="break-words py-2">{String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <h3 className="mt-5 font-semibold">Capabilities</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {e.capabilities.map((c) => <Chip key={c} tone="neutral">{cap(c)}</Chip>)}
              </div>
            </Card>
            <Card as="section" aria-label="Safety, access and booking rules">
              <h3 className="font-semibold">Safety and access</h3>
              <p className="mt-2 text-sm text-muted"><strong className="font-medium text-fg">Safety:</strong> {e.safety_notes || 'None listed.'}</p>
              <p className="mt-1.5 text-sm text-muted"><strong className="font-medium text-fg">Access:</strong> {e.access_notes || 'None listed.'}</p>
              <p className="mt-1.5 text-sm">{e.requires_supervision ? 'Supervision is required to use this equipment.' : 'No supervision required.'}</p>
              <h3 className="mt-5 font-semibold">Booking constraints</h3>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted marker:text-subtle">
                <li>Minimum booking: {minutesToLabel(e.min_booking_minutes)}</li>
                <li>Maximum booking: {minutesToLabel(e.max_booking_minutes)}</li>
                <li>Setup buffer: {minutesToLabel(e.setup_minutes)}</li>
                <li>Cleanup buffer: {minutesToLabel(e.cleanup_minutes)}</li>
              </ul>
            </Card>
          </div>

          <AvailabilityTimeline equipmentId={e.id} />

          <Card as="section" aria-label="Units">
            <h3 className="font-semibold">Units</h3>
            <ul className="mt-2 divide-y divide-line">
              {e.units.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{u.unit_name} <span className="font-normal text-muted">({u.inventory_code})</span></p>
                    <p className="text-xs text-muted">
                      {u.current_booking ? `In use until ${formatTime(u.current_booking.end_at)} (${u.current_booking.project_title}). ` : u.is_free_now ? 'Free now. ' : ''}
                      {u.next_booking_at ? `Next booking ${formatDateTime(u.next_booking_at)}.` : 'No upcoming bookings.'}
                    </p>
                    {u.condition_notes && <p className="text-xs text-muted">{u.condition_notes}</p>}
                  </div>
                  <StatusChip status={u.status} />
                </li>
              ))}
            </ul>
          </Card>

          <Card as="section" aria-label="Upcoming bookings">
            <h3 className="font-semibold">Upcoming bookings</h3>
            {e.upcoming_bookings.length === 0 ? <p className="text-sm text-muted">No upcoming confirmed bookings.</p> : (
              <ul className="mt-2 divide-y divide-line text-sm">
                {e.upcoming_bookings.map((b) => (
                  <li key={b.id} className="py-2">
                    <span className="font-medium">{b.project_title}</span> <span className="text-muted">· {b.unit_name} · {formatRange(b.start_at, b.end_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {e.alternatives.length > 0 && (
            <Card as="section" aria-label="Alternatives">
              <h3 className="font-semibold">Alternative equipment</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {e.alternatives.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm hover:bg-surface2/60">
                    <div className="min-w-0">
                      <Link to={ROUTES.equipment(a.id)} className="link">{a.name}</Link>
                      <p className="text-xs text-muted">{a.laboratory_name} · {a.quantity_available}/{a.quantity_total} free</p>
                    </div>
                    <StatusChip status={a.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <DemoOperations equipmentId={e.id} units={e.units} />

          <Modal open={bookOpen} onClose={() => setBookOpen(false)} title={`Request booking: ${e.name}`} wide>
            <BookingForm
              equipmentId={e.id}
              onCancel={() => setBookOpen(false)}
              onSubmitted={() => { setBookOpen(false); toast.success('Booking request submitted', 'Track it under My Requests.') }}
            />
          </Modal>
        </div>
      )}
    </QueryBoundary>
  )
}
