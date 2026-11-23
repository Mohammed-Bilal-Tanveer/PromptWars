import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button, Card, Chip, Modal, PageHeader, QueryBoundary, SkeletonCards, StatusChip, IconArrowLeft, IconEye, IconMapPin, IconX,
} from '@/components/ui'
import { useEquipmentDetail } from '@/hooks/useApi'
import { formatDateTime, formatRange, formatTime, humanize, minutesToLabel, pct } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { toast } from '@/stores/appStore'
import { BookingForm } from '@/features/bookings'
import { AssistantPanel } from '@/features/ai-assistant'
import { AvailabilityTimeline } from './AvailabilityTimeline'
import { DemoOperations } from './DemoOperations'
import { availabilityStatus, cap } from './EquipmentCard'

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
