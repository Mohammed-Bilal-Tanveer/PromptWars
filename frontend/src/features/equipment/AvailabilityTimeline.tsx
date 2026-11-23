import { useState } from 'react'
import { Card, Chip, ErrorState, Field, Input, LoadingState, Notice, StatusChip } from '@/components/ui'
import { useAvailability } from '@/hooks/useApi'
import { campusDate, formatTime } from '@/lib/format'

export function AvailabilityTimeline({ equipmentId }: { equipmentId: string }) {
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
