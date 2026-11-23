import { Link } from 'react-router-dom'
import { Card, Chip, StatusChip, IconArrowRight, IconMapPin } from '@/components/ui'
import { ROUTES } from '@/lib/routes'
import type { EquipmentType } from '@/types/api'

export const cap = (c: string) => c.replace(/_/g, ' ')

/** Availability chip status: partially booked when only some units are free. */
export function availabilityStatus(e: { status: string; quantity_available: number; quantity_total: number }): string {
  if (e.status === 'available' && e.quantity_available > 0 && e.quantity_available < e.quantity_total) return 'partially_booked'
  return e.status
}

export function EquipmentCard({ e }: { e: EquipmentType }) {
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
