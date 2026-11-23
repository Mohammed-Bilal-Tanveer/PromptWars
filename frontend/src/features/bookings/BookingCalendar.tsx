import { useState } from 'react'
import {
  Button, Card, EmptyState, Field, Input, LoadingState, ErrorState, Modal, Notice, PageHeader, QueryBoundary, Select, StatusChip, cx,
  IconChevronLeft, IconChevronRight, IconPlus,
} from '@/components/ui'
import { useAvailability, useBookings, useEquipmentList } from '@/hooks/useApi'
import { useAppStore } from '@/stores/appStore'
import { campusDate, campusDateOf, campusTimeOf, formatDateLong, formatRange, formatTime } from '@/lib/format'
import { BookingForm } from './BookingForm'

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function BookingCalendar({ embedded }: { embedded?: boolean }) {
  const eqList = useEquipmentList({ page_size: 100, sort: 'name' })
  const [eqId, setEqId] = useState('')
  const [date, setDate] = useState(campusDate(0))
  const [formFor, setFormFor] = useState<string | null>(null)
  const setDraft = useAppStore((s) => s.setBookingDraft)

  const items = eqList.data?.items ?? []
  const selected = eqId || items[0]?.id || ''
  const av = useAvailability(selected || undefined, date)
  const upcoming = useBookings({ equipment_type_id: selected || undefined, status: 'confirmed', from: new Date().toISOString(), page_size: 10 })

  function bookSlot(start?: string, end?: string) {
    if (!selected) return
    const s = start ? `${campusDateOf(start)}T${campusTimeOf(start)}` : `${date}T10:00`
    const e = end ? `${campusDateOf(end)}T${campusTimeOf(end)}` : `${date}T12:00`
    // Cap the draft to a 2h window so it starts within a free slot.
    setDraft({ equipmentId: selected, start: s, end: e })
    setFormFor(selected)
  }

  const a = av.data
  const openMs = a?.lab_open_at ? new Date(a.lab_open_at).getTime() : 0
  const closeMs = a?.lab_close_at ? new Date(a.lab_close_at).getTime() : 0
  const span = closeMs - openMs
  const pos = (iso: string) => Math.max(0, Math.min(100, ((new Date(iso).getTime() - openMs) / span) * 100))

  return (
    <div className="space-y-5">
      {!embedded && <PageHeader title="Booking calendar" subtitle="Pick a piece of equipment and a day to see free and booked time per unit." />}
      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Equipment" htmlFor="cal-eq">
            <Select id="cal-eq" value={selected} onChange={(e) => setEqId(e.target.value)}>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name} — {i.laboratory_name}</option>)}
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button variant="secondary" className="px-3" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><IconChevronLeft size={18} /></Button>
            <Field label="Date" htmlFor="cal-date">
              <Input id="cal-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </Field>
            <Button variant="secondary" className="px-3" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><IconChevronRight size={18} /></Button>
          </div>
        </div>
        <p className="text-sm font-medium text-fg">{formatDateLong(`${date}T12:00:00Z`)}</p>
      </Card>

      {eqList.isLoading || av.isLoading ? <LoadingState label="Loading availability…" /> : eqList.isError ? <ErrorState error={eqList.error} onRetry={() => eqList.refetch()} /> : av.isError ? <ErrorState error={av.error} onRetry={() => av.refetch()} /> : !a ? null : (
        <Card className="space-y-5" aria-label="Day timeline">
          {!a.lab_open_at || !a.lab_close_at ? (
            <Notice tone="warn">The laboratory is closed on this day. Pick another date.</Notice>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Day timeline</h2>
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
                  <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border border-emerald-300 bg-emerald-100" aria-hidden />Free</li>
                  <li className="flex items-center gap-1.5"><span className="hatch-busy h-3 w-5 rounded-sm" aria-hidden />Booked</li>
                  <li className="flex items-center gap-1.5"><span className="hatch-maint h-3 w-5 rounded-sm" aria-hidden />Maintenance</li>
                </ul>
              </div>
              <div className="tnum flex justify-between text-xs text-subtle" aria-hidden>
                <span>{formatTime(a.lab_open_at)}</span>
                <span>{formatTime(a.lab_close_at)}</span>
              </div>
              <ul className="space-y-3">
                {a.units.map((u) => (
                  <li key={u.unit_id}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">{u.unit_name} <span className="font-normal text-muted">({u.inventory_code})</span></span>
                      {u.status !== 'operational' && <StatusChip status={u.status} />}
                    </div>
                    <div className="relative h-8 overflow-hidden rounded-md border border-emerald-200 bg-emerald-50" role="img" aria-label={`${u.unit_name}: ${u.busy.length} busy block${u.busy.length === 1 ? '' : 's'}`}>
                      {u.status !== 'operational' && <div className="hatch-maint absolute inset-0 opacity-50" />}
                      {u.busy.map((b, i) => (
                        <div
                          key={i}
                          title={`${b.label} ${formatTime(b.start_at)}–${formatTime(b.end_at)}`}
                          className={cx('absolute top-0 h-full border-x border-white', b.kind === 'maintenance' ? 'hatch-maint' : 'hatch-busy')}
                          style={{ left: `${pos(b.start_at)}%`, width: `${Math.max(1, pos(b.end_at) - pos(b.start_at))}%` }}
                        />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <section aria-live="polite" className="border-t border-line pt-4">
                <h3 className="mb-2 text-sm font-semibold">Free slots (at least one unit free)</h3>
                {a.free_slots.length === 0 ? (
                  <p className="text-sm text-muted">No free slots on this day.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {a.free_slots.map((s, i) => (
                      <li key={i}>
                        <Button size="sm" variant="secondary" onClick={() => bookSlot(s.start_at, s.end_at)} aria-label={`Book free slot ${formatTime(s.start_at)} to ${formatTime(s.end_at)}`}>
                          {formatTime(s.start_at)}–{formatTime(s.end_at)} · {s.free_units} free
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
          <div><Button onClick={() => bookSlot()}><IconPlus size={18} /> Book this slot</Button></div>
        </Card>
      )}

      {(
        <Card>
          <h3 className="mb-2 text-base font-semibold">Upcoming confirmed bookings</h3>
          <QueryBoundary query={upcoming}>
            {(p) =>
              p.items.length === 0 ? <EmptyState title="No upcoming bookings" hint="Confirmed bookings for this equipment appear here." /> : (
                <ul className="divide-y divide-line text-sm">
                  {p.items.map((b) => (
                    <li key={b.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                      <span><strong className="font-medium">{b.project_title}</strong> <span className="text-muted">· {b.unit_name}</span></span>
                      <span className="tnum text-muted">{formatRange(b.start_at, b.end_at)}</span>
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryBoundary>
        </Card>
      )}

      <Modal open={!!formFor} onClose={() => setFormFor(null)} title="Request a booking" wide>
        {formFor && <BookingForm equipmentId={formFor} embedded onCancel={() => setFormFor(null)} />}
      </Modal>
    </div>
  )
}
