import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, Chip, EmptyState, Field, Input, PageHeader, ProgressBar, QueryBoundary, Select, StatusChip,
} from '@/components/ui'
import { useDepartment, useDepartments, useLaboratories, useLaboratory } from '@/hooks/useApi'
import { pct } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import type { Laboratory } from '@/types/api'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const daysLabel = (d: number[]) => (d.length === 0 ? 'Closed' : [...d].sort().map((i) => DAYS[i]).join(', '))

function LabCard({ lab, onOpen }: { lab: Laboratory; onOpen?: (id: string) => void }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-bold">{lab.name}</h3>
        <StatusChip status={lab.status} />
      </div>
      <p className="mt-1 text-xs text-muted">
        {lab.building}, floor {lab.floor}, room {lab.room_number}
      </p>
      <p className="mt-2 text-sm text-muted">
        {lab.equipment_count} equipment types · {lab.units_available}/{lab.units_total} units free
      </p>
      <div className="mt-3">
        {onOpen ? (
          <Button size="sm" variant="secondary" onClick={() => onOpen(lab.id)}>Open {lab.name}</Button>
        ) : (
          <Link to={ROUTES.lab(lab.id)} className="inline-flex min-h-11 items-center font-semibold text-sky-300 underline">
            Open {lab.name}
          </Link>
        )}
      </div>
    </Card>
  )
}

/** Embeddable department summary. */
export function DepartmentPanel({ departmentId, onOpenLab, embedded }: { departmentId: string; onOpenLab?: (labId: string) => void; embedded?: boolean }) {
  const q = useDepartment(departmentId)
  return (
    <QueryBoundary query={q} loadingLabel="Loading department…">
      {(d) => (
        <div className="space-y-4">
          {embedded ? <h2 className="text-lg font-bold">{d.name}</h2> : <PageHeader title={d.name} subtitle={d.description} />}
          {embedded && <p className="text-sm text-muted">{d.description}</p>}
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Card className="!p-3"><div className="text-xs text-muted">Laboratories</div><div className="text-xl font-bold">{d.lab_count}</div></Card>
            <Card className="!p-3"><div className="text-xs text-muted">Total units</div><div className="text-xl font-bold">{d.units_total}</div></Card>
            <Card className="!p-3"><div className="text-xs text-muted">Available now</div><div className="text-xl font-bold">{d.units_available}</div></Card>
            <Card className="!p-3"><div className="text-xs text-muted">Building</div><div className="text-xl font-bold">{d.building_code}</div></Card>
          </div>
          <div>
            <ProgressBar value={d.utilisation_pct} label={`${d.name} utilisation`} />
            <p className="mt-1 text-xs text-muted">Utilisation {pct(d.utilisation_pct)} (14-day window, sample data)</p>
          </div>
          <h3 className="font-bold">Laboratories</h3>
          {d.laboratories.length === 0 ? (
            <EmptyState title="No laboratories listed" />
          ) : (
            <div className={embedded ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'}>
              {d.laboratories.map((l) => <LabCard key={l.id} lab={l} onOpen={onOpenLab} />)}
            </div>
          )}
        </div>
      )}
    </QueryBoundary>
  )
}

/** Embeddable laboratory panel. */
export function LabPanel({ labId, onSelectEquipment, embedded }: { labId: string; onSelectEquipment?: (equipmentId: string) => void; embedded?: boolean }) {
  const q = useLaboratory(labId)
  const navigate = useNavigate()
  const select = onSelectEquipment ?? ((id: string) => navigate(ROUTES.equipment(id)))
  return (
    <QueryBoundary query={q} loadingLabel="Loading laboratory…">
      {(l) => (
        <div className="space-y-4">
          {embedded ? <h2 className="text-lg font-bold">{l.name}</h2> : (
            <PageHeader
              title={l.name}
              subtitle={<>{l.department_name} · {l.building}, floor {l.floor}, room {l.room_number}</>}
              actions={<Link to={ROUTES.department(l.department_id)} className="inline-flex min-h-11 items-center font-semibold text-sky-300 underline">Department page</Link>}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <StatusChip status={l.status} />
            <Chip tone="avail">{l.units_available}/{l.units_total} units free</Chip>
            {l.max_occupancy != null && <Chip>Max {l.max_occupancy} people</Chip>}
          </div>
          <p className="text-sm text-muted">{l.description}</p>
          <Card className="!p-3 text-sm">
            <p><strong>Hours:</strong> {l.opening_hours.start}–{l.opening_hours.end} ({daysLabel(l.operating_days)})</p>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="!p-3 text-sm"><strong>Access notes</strong><p className="mt-1 text-muted">{l.access_notes || 'None listed.'}</p></Card>
            <Card className="!p-3 text-sm"><strong>⚠ Safety notes</strong><p className="mt-1 text-muted">{l.safety_notes || 'None listed.'}</p></Card>
          </div>
          {l.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Lab capabilities">
              {l.capabilities.map((c) => <Chip key={c} tone="ai">{c.replace(/_/g, ' ')}</Chip>)}
            </div>
          )}
          <h3 className="font-bold">Equipment</h3>
          {l.equipment.length === 0 ? (
            <EmptyState title="No equipment in this laboratory" />
          ) : (
            <ul className={embedded ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'}>
              {l.equipment.map((e) => (
                <li key={e.id}>
                  <Card className="h-full">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h4 className="font-semibold">{e.name}</h4>
                      <StatusChip status={e.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted">{e.category} · {e.quantity_available}/{e.quantity_total} units free</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => select(e.id)}>View {e.name}</Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </QueryBoundary>
  )
}

export function CampusDirectory() {
  const depts = useDepartments()
  const [dept, setDept] = useState('')
  const [q, setQ] = useState('')
  const labs = useLaboratories({ department_id: dept || undefined, q: q.trim() || undefined })
  const groups = useMemo(() => {
    const m = new Map<string, Laboratory[]>()
    for (const l of labs.data ?? []) m.set(l.department_id, [...(m.get(l.department_id) ?? []), l])
    return m
  }, [labs.data])

  return (
    <div className="space-y-5">
      <PageHeader title="Labs & departments" subtitle="Browse every department and laboratory. Sample campus data." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Search laboratories" htmlFor="lab-q">
          <Input id="lab-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. robotics" />
        </Field>
        <Field label="Department" htmlFor="lab-dept">
          <Select id="lab-dept" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
      </div>
      <QueryBoundary query={labs} loadingLabel="Loading laboratories…">
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="No laboratories match" hint="Try clearing the search or department filter." action={<Button variant="secondary" onClick={() => { setQ(''); setDept('') }}>Clear filters</Button>} />
          ) : (
            <div className="space-y-6" aria-live="polite">
              {(depts.data ?? []).filter((d) => groups.has(d.id)).map((d) => (
                <section key={d.id} aria-label={d.name}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold">{d.name}</h2>
                    <Link to={ROUTES.department(d.id)} className="inline-flex min-h-11 items-center text-sm font-semibold text-sky-300 underline">Department overview</Link>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {groups.get(d.id)!.map((l) => <LabCard key={l.id} lab={l} />)}
                  </div>
                </section>
              ))}
              {!depts.data && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map((l) => <LabCard key={l.id} lab={l} />)}</div>
              )}
            </div>
          )
        }
      </QueryBoundary>
    </div>
  )
}

export function DepartmentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  if (!id) return <EmptyState title="No department selected" />
  return <DepartmentPanel departmentId={id} onOpenLab={(l) => navigate(ROUTES.lab(l))} />
}

export function LabDetailPage() {
  const { id } = useParams()
  if (!id) return <EmptyState title="No laboratory selected" />
  return <LabPanel labId={id} />
}
