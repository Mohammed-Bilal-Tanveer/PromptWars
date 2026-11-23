import { useState } from 'react'
import { Button, Card, EmptyState, Field, Input, LoadingState, ErrorState, Modal, Notice, QueryBoundary, Select, cx } from '@/components/ui'
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
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Equipment" htmlFor="cal-eq">
            <Select id="cal-eq" value={selected} onChange={(e) => setEqId(e.target.value)}>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name} — {i.laboratory_name}</option>)}
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button variant="secondary" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>←</Button>
            <Field label="Date" htmlFor="cal-date">
              <Input id="cal-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </Field>
            <Button variant="secondary" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>→</Button>
          </div>
        </div>
        <p className="text-sm text-muted">{formatDateLong(`${date}T12:00:00Z`)}</p>
      </Card>

      {eqList.isLoading || av.isLoading ? <LoadingState label="Loading availability…" /> : eqList.isError ? <ErrorState error={eqList.error} onRetry={() => eqList.refetch()} /> : av.isError ? <ErrorState error={av.error} onRetry={() => av.refetch()} /> : !a ? null : (
        <Card className="space-y-4" aria-label="Day timeline">
          {!a.lab_open_at || !a.lab_close_at ? (
            <Notice tone="warn">The laboratory is closed on this day. Pick another date.</Notice>
          ) : (
            <>
              <div className="flex justify-between text-xs text-muted" aria-hidden>
                <span>{formatTime(a.lab_open_at)}</span>
                <span>{formatTime(a.lab_close_at)}</span>
              </div>
              <ul className="space-y-2">
                {a.units.map((u) => (
                  <li key={u.unit_id}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-semibold">{u.unit_name} <span className="text-muted">({u.inventory_code})</span></span>
                      {u.status !== 'operational' && <span className="text-rose-300">▲ {u.status}</span>}
                    </div>
                    <div className="relative h-8 overflow-hidden rounded-lg border border-line bg-emerald-500/10" role="img" aria-label={`${u.unit_name}: ${u.busy.length} busy block${u.busy.length === 1 ? '' : 's'}`}>
                      {u.status !== 'operational' && <div className="absolute inset-0 bg-rose-500/30" />}
                      {u.busy.map((b, i) => (
                        <div
                          key={i}
                          title={`${b.label} ${formatTime(b.start_at)}–${formatTime(b.end_at)}`}
                          className={cx('absolute top-0 h-full border-x border-black/30', b.kind === 'maintenance' ? 'bg-rose-500/70' : 'bg-sky-500/70')}
                          style={{ left: `${pos(b.start_at)}%`, width: `${Math.max(1, pos(b.end_at) - pos(b.start_at))}%` }}
                        />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-500/70 align-middle" /> Booked ·{' '}
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500/70 align-middle" /> Maintenance ·{' '}
                <span className="inline-block h-2.5 w-2.5 rounded-sm border border-line bg-emerald-500/20 align-middle" /> Free
              </p>

              <section aria-live="polite">
                <h3 className="mb-2 text-sm font-bold">Free slots (at least one unit free)</h3>
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
          <Button onClick={() => bookSlot()}>Book this slot</Button>
        </Card>
      )}

      {(
        <Card>
          <h3 className="mb-2 text-sm font-bold">Upcoming confirmed bookings</h3>
          <QueryBoundary query={upcoming}>
            {(p) =>
              p.items.length === 0 ? <EmptyState title="No upcoming bookings" hint="Confirmed bookings for this equipment appear here." /> : (
                <ul className="divide-y divide-line text-sm">
                  {p.items.map((b) => (
                    <li key={b.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span><strong>{b.project_title}</strong> · {b.unit_name}</span>
                      <span className="text-muted">{formatRange(b.start_at, b.end_at)}</span>
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
