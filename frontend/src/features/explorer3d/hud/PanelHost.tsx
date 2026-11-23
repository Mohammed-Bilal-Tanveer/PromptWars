import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CHARACTERS } from '../scene/kenney'
import type { EquipmentType } from '@/types/api'
import { useAppStore } from '@/stores/appStore'
import { useDepartments, useEquipmentList } from '@/hooks/useApi'
import { Button, Chip, Input, Select, StatusChip, Spinner } from '@/components/ui'
import { EquipmentDetailPanel } from '@/features/equipment'
import { ProjectLab } from '@/features/projects'
import { DepartmentPanel, LabPanel } from '@/features/campus'
import { BookingCalendar, BookingForm, RequestTracker } from '@/features/bookings'
import { SchedulingStudio } from '@/features/scheduling'
import { ApprovalDesk } from '@/features/approvals'
import { AnalyticsDashboard, NotificationCenter } from '@/features/analytics'
import { AssistantPanel } from '@/features/ai-assistant'
import { useExplorerStore, type PanelState, type Quality } from '../stores/explorerStore'
import { DEPT_FALLBACK, buildingById, buildingForDept, doorOutside } from '../environments/layout'

export const CANVAS_WRAP_ID = 'explorer-canvas-wrap'

const TITLES: Record<string, string> = {
  equipment: 'Equipment details', department: 'Department', lab: 'Laboratory', kiosk: 'Campus information kiosk',
  project: 'AI Project Lab', bookings: 'Bookings & scheduling', approvals: 'Operations & Approval Desk',
  analytics: 'Analytics Control Centre', assistant: 'AI Assistant', notifications: 'Notifications',
  search: 'Search equipment', settings: 'Pause & settings',
}

function Shell({ panel, onClose, onBack, children }: { panel: PanelState; onClose: () => void; onBack?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
    return () => { document.getElementById(CANVAS_WRAP_ID)?.focus() }
  }, [])
  const title = TITLES[panel.kind]
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-start justify-center overflow-hidden p-2 sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative z-10 mt-2 flex max-h-[85vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-line bg-surface text-fg shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2">
            {onBack && <Button variant="secondary" size="sm" onClick={onBack} aria-label="Back">← Back</Button>}
            <h2 className="text-lg font-bold">{title}</h2>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose} aria-label="Close panel (Esc)">✕ Close</Button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

function SearchPanel({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const res = useEquipmentList({ q: q.trim() || undefined, page_size: 12, sort: q.trim() ? 'relevance' : 'name' })
  return (
    <div className="space-y-3">
      <label htmlFor="ex-search" className="text-sm text-muted">Search by name, capability, lab or department</label>
      <Input id="ex-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. GPU, camera, 3D printing" />
      {res.isLoading && <div className="flex items-center gap-2"><Spinner size={16} /> Searching…</div>}
      {res.isError && <p role="alert" className="text-rose-300">Could not search right now.</p>}
      <ul className="space-y-2">
        {res.data?.items.map((e) => (
          <li key={e.id}>
            <button onClick={() => onPick(e.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface2 px-3 py-2 text-left hover:border-brand">
              <span><span className="font-semibold">{e.name}</span><span className="block text-xs text-muted">{e.laboratory_name} · {e.department_name}</span></span>
              <span className="flex items-center gap-2"><StatusChip status={e.status} /><span className="text-xs">{e.quantity_available}/{e.quantity_total}</span></span>
            </button>
          </li>
        ))}
        {res.data && res.data.items.length === 0 && <li className="text-muted">No equipment matches “{q}”.</li>}
      </ul>
    </div>
  )
}

function KioskPanel({ onClose, openDept }: { onClose: () => void; openDept: (id: string) => void }) {
  const deps = useDepartments()
  const setWp = useExplorerStore((s) => s.setWaypoint)
  const list = deps.data ?? Object.entries(DEPT_FALLBACK).map(([id, v]) => ({ id, name: v.name, building_code: v.building, description: '' }))
  const go = (id: string, name: string) => {
    const b = buildingForDept(id)
    if (!b) return
    const o = doorOutside(b, 3)
    setWp({ x: o.x, z: o.z, label: `${b.short} · ${name}` })
    useAppStore.getState().pushToast({ kind: 'info', title: 'Waypoint set', message: `Follow the gold beacon to ${b.label}.` })
    onClose()
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Which building is which. Set a waypoint and a gold beacon plus a minimap marker will guide you.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((d) => (
          <li key={d.id} className="rounded-xl border border-line bg-surface2 p-3">
            <div className="flex items-center justify-between"><span className="font-semibold">{d.name}</span><Chip tone="neutral">{d.building_code}</Chip></div>
            <p className="mt-1 text-xs text-muted">{buildingById(d.building_code)?.label ?? d.building_code}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => go(d.id, d.name)} aria-label={`Set waypoint to ${d.name}`}>⚑ Set waypoint</Button>
              <Button size="sm" variant="secondary" onClick={() => openDept(d.id)}>Details</Button>
            </div>
          </li>
        ))}
      </ul>
      <ul className="text-sm text-muted">
        <li>Operations & Approval Centre — north end of the avenue (OPS)</li>
        <li>Analytics Control Centre — south end of the avenue (ANA)</li>
      </ul>
    </div>
  )
}

function BookingHub({ equipment, initial }: { equipment: EquipmentType[]; initial: PanelState }) {
  const [tab, setTab] = useState<NonNullable<PanelState['tab']>>(initial.tab ?? 'calendar')
  const draft = useAppStore((s) => s.bookingDraft)
  const [eq, setEq] = useState(initial.recordId ?? draft?.equipmentId ?? '')
  const list = useEquipmentList({ page_size: 100 })
  const options = list.data?.items ?? equipment
  const eqId = eq || options[0]?.id || ''
  const tabs: [NonNullable<PanelState['tab']>, string][] = [['calendar', 'Calendar'], ['form', 'New request'], ['tracker', 'My requests'], ['scheduling', 'Scheduling studio']]
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Booking sections" className="flex flex-wrap gap-2">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-10 rounded-xl border px-3 text-sm font-semibold ${tab === k ? 'border-brand bg-brand/30' : 'border-line bg-surface2'}`}>{l}</button>
        ))}
      </div>
      {tab === 'calendar' && <BookingCalendar embedded />}
      {tab === 'tracker' && <RequestTracker embedded />}
      {tab === 'scheduling' && <SchedulingStudio embedded />}
      {tab === 'form' && (
        <div className="space-y-3">
          <label className="block text-sm" htmlFor="ex-eq">Equipment</label>
          <Select id="ex-eq" value={eqId} onChange={(e) => setEq(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name} — {o.laboratory_name}</option>)}
          </Select>
          {eqId ? <BookingForm key={eqId} equipmentId={eqId} embedded onSubmitted={() => setTab('tracker')} /> : <p className="text-muted">Loading equipment…</p>}
        </div>
      )}
    </div>
  )
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useExplorerStore()
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="font-semibold">Graphics quality</legend>
        <div className="flex gap-2">
          {(['auto', 'low', 'high'] as Quality[]).map((q) => (
            <button key={q} onClick={() => s.setQuality(q)} aria-pressed={s.quality === q} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold capitalize ${s.quality === q ? 'border-brand bg-brand/30' : 'border-line bg-surface2'}`}>{q}</button>
          ))}
        </div>
        <p className="text-xs text-muted">Affects pixel ratio, shadows and tree count.</p>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="font-semibold">Your character</legend>
        <div className="flex flex-wrap gap-2">
          {CHARACTERS.map((c) => (
            <button key={c.id} onClick={() => s.setCharacter(c.id)} aria-pressed={s.character === c.id} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${s.character === c.id ? 'border-brand bg-brand/30' : 'border-line bg-surface2'}`}>{c.label}</button>
          ))}
        </div>
        <p className="text-xs text-muted">Kenney Mini Characters (CC0). Your choice is remembered on this device.</p>
      </fieldset>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="h-5 w-5" checked={s.reduceMotion} onChange={(e) => s.setReduceMotion(e.target.checked)} />
        Reduce motion (no camera smoothing, pulsing or bobbing)
      </label>
      <div>
        <h3 className="font-semibold">Controls</h3>
        <ul className="mt-1 list-disc pl-5 text-sm text-muted">
          <li>W A S D / arrow keys: move · Shift: run</li>
          <li>Drag mouse or touch: orbit camera · Q / R: rotate camera</li>
          <li>E: interact with the highlighted object · Esc: close panel / pause</li>
          <li>Touch: joystick (bottom-left), E button (bottom-right)</li>
          <li>Quick actions bar opens every tool without walking</li>
        </ul>
      </div>
      <Button onClick={onClose}>Resume exploring</Button>
    </div>
  )
}

export function PanelHost({ equipment }: { equipment: EquipmentType[] }) {
  const panel = useExplorerStore((s) => s.panel)
  const prev = useExplorerStore((s) => s.prevPanel)
  const open = useExplorerStore((s) => s.openPanel)
  const close = useExplorerStore((s) => s.closePanel)
  const back = useExplorerStore((s) => s.back)
  const setWp = useExplorerStore((s) => s.setWaypoint)
  if (!panel) return null

  const viewMatch = (id: string) => {
    const eq = equipment.find((e) => e.id === id)
    const app = useAppStore.getState()
    if (!app.highlightedEquipmentIds.includes(id)) app.setHighlightedEquipmentIds([...app.highlightedEquipmentIds, id])
    const b = eq ? buildingForDept(eq.department_id) : undefined
    if (b) {
      const o = doorOutside(b, 3)
      setWp({ x: o.x, z: o.z, label: `${eq!.name} in ${b.short}` })
      app.pushToast({ kind: 'info', title: 'Waypoint set', message: `${eq!.name} is in ${b.label}. Follow the gold beacon.` })
    }
    close()
  }
  const book = (id: string) => open({ kind: 'bookings', tab: 'form', recordId: id })

  let body: ReactNode = null
  switch (panel.kind) {
    case 'equipment':
      body = <EquipmentDetailPanel equipmentId={panel.recordId!} embedded onBook={book} onClose={close} />
      break
    case 'department':
      body = <DepartmentPanel departmentId={panel.recordId!} embedded onOpenLab={(id) => open({ kind: 'lab', recordId: id })} />
      break
    case 'lab':
      body = <LabPanel labId={panel.recordId!} embedded onSelectEquipment={(id) => open({ kind: 'equipment', recordId: id })} />
      break
    case 'kiosk':
      body = <KioskPanel onClose={close} openDept={(id) => open({ kind: 'department', recordId: id })} />
      break
    case 'project':
      body = <ProjectLab embedded onViewMatch={viewMatch} onBook={book} />
      break
    case 'bookings':
      body = <BookingHub equipment={equipment} initial={panel} />
      break
    case 'approvals':
      body = <ApprovalDesk embedded />
      break
    case 'analytics':
      body = (
        <div className="space-y-6">
          <AnalyticsDashboard embedded />
          <section aria-label="Notifications"><h3 className="mb-2 font-semibold">Notifications</h3><NotificationCenter embedded /></section>
        </div>
      )
      break
    case 'assistant':
      body = <AssistantPanel embedded />
      break
    case 'notifications':
      body = <NotificationCenter embedded />
      break
    case 'search':
      body = <SearchPanel onPick={(id) => open({ kind: 'equipment', recordId: id })} />
      break
    case 'settings':
      body = <SettingsPanel onClose={close} />
      break
  }
  return (
    <Shell key={panel.kind + (panel.recordId ?? '') + (panel.tab ?? '')} panel={panel} onClose={close} onBack={prev ? back : undefined}>
      {body}
    </Shell>
  )
}
