import { useState } from 'react'
import { Button, ConfirmDialog, Field, Select, errorMessage } from '@/components/ui'
import { useSetUnitStatus } from '@/hooks/useApi'
import { humanize } from '@/lib/format'
import { toast } from '@/stores/appStore'
import type { UnitStatus } from '@/types/api'

const UNIT_STATUSES: UnitStatus[] = ['operational', 'maintenance', 'unavailable']
export function DemoOperations({ equipmentId, units }: { equipmentId: string; units: { id: string; unit_name: string; status: UnitStatus }[] }) {
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
