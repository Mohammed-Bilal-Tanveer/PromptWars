import { useMemo, useState } from 'react'
import { useDepartment, useDepartments, useEquipmentList } from '@/hooks/useApi'
import { useAppStore } from '@/stores/appStore'
import { Button, Spinner, cx, IconFlask } from '@/components/ui'
import { buildLinks, matchedItems } from '../interactions/network'
import { useExplorerStore } from '../stores/explorerStore'

const W = 320, C = W / 2, R = 112

function DeptDetail({ id }: { id: string }) {
  const q = useDepartment(id)
  const openPanel = useExplorerStore((s) => s.openPanel)
  const analysis = useAppStore((s) => s.lastAnalysis)
  const items = matchedItems(analysis).filter((i) => i.departmentId === id)
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface2 p-3 text-sm" aria-live="polite">
      <h3 className="font-semibold">{q.data?.name ?? 'Department'}</h3>
      {q.isLoading && <p className="flex items-center gap-2 text-muted"><Spinner size={14} /> Loading laboratories…</p>}
      {q.isError && <p role="alert" className="text-red-700">Could not load laboratories.</p>}
      {q.data && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Laboratories</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {q.data.laboratories.map((l) => (
              <li key={l.id}><Button size="sm" variant="secondary" onClick={() => openPanel({ kind: 'lab', recordId: l.id })}><IconFlask size={14} /> {l.name}</Button></li>
            ))}
          </ul>
        </div>
      )}
      {items.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Matched to your project</p>
          <ul className="mt-1 space-y-1">
            {items.map((i) => (
              <li key={i.equipmentId + i.requirement}>
                <button className="link min-h-8 text-left" onClick={() => openPanel({ kind: 'equipment', recordId: i.equipmentId })}>{i.name}</button>
                <span className="text-xs text-muted"> for {i.requirement}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function NetworkView() {
  const analysis = useAppStore((s) => s.lastAnalysis)
  const title = useAppStore((s) => s.lastAnalysisInput?.title)
  const depts = useDepartments()
  const eq = useEquipmentList({ page_size: 100 })
  const openPanel = useExplorerStore((s) => s.openPanel)
  const [sel, setSel] = useState<string | null>(null)
  const [showProject, setShowProject] = useState(true)
  const list = useMemo(() => depts.data ?? [], [depts.data])
  const items = useMemo(() => matchedItems(analysis), [analysis])
  const links = useMemo(() => buildLinks(analysis, eq.data?.items ?? []), [analysis, eq.data])
  const matchDepts = useMemo(() => new Set(items.map((i) => i.departmentId)), [items])
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    list.forEach((d, i) => {
      const t = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2
      m.set(d.id, { x: C + R * Math.cos(t), y: C + R * Math.sin(t) })
    })
    return m
  }, [list])

  if (!analysis) {
    return (
      <div className="space-y-3 rounded-xl border border-line bg-surface2 p-4 text-sm">
        <h3 className="font-semibold">No project analysis yet</h3>
        <p className="text-muted">The resource network is built from your project: departments are linked when your Project Lab analysis matches equipment in both. Analyse a project to see real connections. Nothing is drawn until then.</p>
        <Button onClick={() => openPanel({ kind: 'project' })}><IconFlask size={16} /> Open Project Lab</Button>
      </div>
    )
  }
  if (depts.isLoading) return <p className="flex items-center gap-2 text-sm text-muted"><Spinner size={14} /> Loading departments…</p>
  if (depts.isError) return <p role="alert" className="text-sm font-medium text-red-700">Could not load departments.</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" aria-pressed={showProject} onClick={() => setShowProject((v) => !v)} className={cx('min-h-10 rounded-lg border px-3 font-medium', showProject ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface')}>
          Project: {title ?? 'current analysis'}
        </button>
        <span className="text-xs text-muted">Blue: departments with matching equipment. Solid line: used together by your project. Dashed: shared capabilities.</span>
      </div>
      <svg viewBox={`0 0 ${W} ${W}`} role="group" aria-label="Campus resource network" className="mx-auto block w-full max-w-[420px] rounded-xl border border-line-strong bg-surface">
        {links.map((l) => {
          const a = pos.get(l.a), b = pos.get(l.b)
          if (!a || !b) return null
          return (
            <line key={l.a + l.b + l.kind} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={l.kind === 'project' ? '#1d4ed8' : '#98a2b3'} strokeWidth={l.kind === 'project' ? 1.5 + Math.min(l.weight, 4) * 0.5 : 1} strokeDasharray={l.kind === 'capability' ? '4 3' : undefined}>
              <title>{l.detail}</title>
            </line>
          )
        })}
        {list.map((d) => {
          const p = pos.get(d.id)!
          const hi = showProject && matchDepts.has(d.id)
          const on = sel === d.id
          return (
            <g key={d.id} transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={0} aria-pressed={on} aria-label={`${d.name}${hi ? ', has matching equipment' : ''}`} className="cursor-pointer outline-none" onClick={() => setSel(d.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(d.id) } }}>
              <circle r={on ? 20 : 17} fill={hi ? '#dbeafe' : '#ffffff'} stroke={on ? '#1d4ed8' : hi ? '#2563eb' : '#667085'} strokeWidth={on ? 3 : 1.5} />
              <text y={4} fontSize={9} fontWeight={700} textAnchor="middle" fill="#101828" pointerEvents="none">{d.building_code}</text>
              <text y={32} fontSize={8} textAnchor="middle" fill="#475467" pointerEvents="none">{d.name.length > 18 ? `${d.name.slice(0, 17)}…` : d.name}</text>
            </g>
          )
        })}
      </svg>
      {links.length === 0 && <p className="text-xs text-muted">Your matches sit in a single department, so there are no cross-department links to show.</p>}
      {sel ? <DeptDetail id={sel} /> : <p className="text-sm text-muted">Select a department to see its laboratories and matched equipment.</p>}
    </div>
  )
}
