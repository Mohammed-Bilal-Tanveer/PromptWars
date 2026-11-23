import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import type { EquipmentType } from '@/types/api'
import { ROUTES } from '@/lib/routes'
import { BUILDINGS, buildingForDept } from '../environments/layout'
import { input, playerState } from '../character/playerState'
import { interactNearest, useExplorerStore, type PanelState } from '../stores/explorerStore'
import {
  cx, IconArrowLeft, IconBell, IconCalendar, IconChart, IconCheckSquare, IconFlask, IconLogout, IconMessage, IconSearch, IconSettings,
  IconSliders, type IconProps,
} from '@/components/ui'

/** Solid, light HUD surfaces — readable over the scene without blur or glow. */
const surface = 'border border-line-strong bg-surface text-fg shadow-raised'
const btn = `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-surface2 ${surface}`

export function ExitButton() {
  return (
    <Link to={ROUTES.overview} className={btn} aria-label="Exit 3D and skip to dashboard">
      <IconArrowLeft size={18} className="text-muted" /> Exit 3D · Go to dashboard
    </Link>
  )
}

export function Minimap({ equipment, highlightedIds }: { equipment: EquipmentType[]; highlightedIds: string[] }) {
  const [p, setP] = useState({ x: 0, z: 9, h: 0 })
  const wp = useExplorerStore((s) => s.waypoint)
  useEffect(() => {
    const t = setInterval(() => setP({ x: playerState.x, z: playerState.z, h: playerState.heading }), 150)
    return () => clearInterval(t)
  }, [])
  const hiBuildings = useMemo(() => {
    const ids = new Set<string>()
    for (const e of equipment) if (highlightedIds.includes(e.id)) { const b = buildingForDept(e.department_id); if (b) ids.add(b.id) }
    return ids
  }, [equipment, highlightedIds])
  const S = 2 // px per unit; view -60..60 -> 240 -> scaled to 144 via viewBox
  return (
    <svg viewBox="-60 -60 120 120" width={144} height={144} role="img" aria-label={`Minimap. You are at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}.${wp ? ` Waypoint: ${wp.label}.` : ''}`} className="rounded-xl border border-line-strong bg-[#e6ece0] shadow-raised">
      <rect x={-2.5} y={-55} width={5} height={110} fill="#e2dccd" />
      <rect x={-55} y={-2.5} width={110} height={5} fill="#e2dccd" />
      <circle cx={0} cy={0} r={10} fill="#d9d4c8" />
      {BUILDINGS.map((b) => (
        <g key={b.id}>
          <rect x={b.x - b.w / 2} y={b.z - b.d / 2} width={b.w} height={b.d} rx={1} fill={b.color} stroke={hiBuildings.has(b.id) ? '#1d4ed8' : '#5d6b82'} strokeWidth={hiBuildings.has(b.id) ? 2 : 0.6} />
          <text x={b.x} y={b.z + 2} fontSize={6} fontWeight={600} textAnchor="middle" fill="#101828" stroke="#ffffff" strokeWidth={1.2} paintOrder="stroke">{b.short}</text>
          {hiBuildings.has(b.id) && <text x={b.x} y={b.z - 6} fontSize={7} textAnchor="middle" fill="#1d4ed8">★</text>}
        </g>
      ))}
      {wp && (
        <g>
          <circle cx={wp.x} cy={wp.z} r={4} fill="#ffffff" stroke="#b45309" strokeWidth={1.5} />
          <circle cx={wp.x} cy={wp.z} r={1.4} fill="#b45309" />
        </g>
      )}
      <g transform={`translate(${p.x} ${p.z}) rotate(${(-p.h * 180) / Math.PI + 180})`}>
        <polygon points="0,-4.5 3.2,3 -3.2,3" fill="#1d4ed8" stroke="#ffffff" strokeWidth={1} strokeLinejoin="round" />
      </g>
      <text x={-56} y={-51} fontSize={5} fontWeight={600} fill="#475467">N ↑</text>
      {S > 100 && null}
    </svg>
  )
}

export function StatusLegend() {
  return (
    <div className={cx('w-44 rounded-xl px-3 py-2.5 text-xs', surface)} aria-label="Equipment status legend">
      <div className="mb-1.5 font-semibold">Equipment status</div>
      <ul className="space-y-1 text-muted">
        <li className="flex items-center gap-2"><span className="w-3 text-center text-emerald-600" aria-hidden>●</span>Available x/y</li>
        <li className="flex items-center gap-2"><span className="w-3 text-center text-amber-600" aria-hidden>◐</span>Fully booked now</li>
        <li className="flex items-center gap-2"><span className="w-3 text-center text-red-600" aria-hidden>▲</span>Maintenance</li>
        <li className="flex items-center gap-2"><span className="w-3 text-center text-brand" aria-hidden>★</span>Project Lab match (blue ring)</li>
      </ul>
    </div>
  )
}

export function Objective() {
  const wp = useExplorerStore((s) => s.waypoint)
  const [d, setD] = useState(0)
  useEffect(() => {
    const t = setInterval(() => wp && setD(Math.hypot(wp.x - playerState.x, wp.z - playerState.z)), 300)
    return () => clearInterval(t)
  }, [wp])
  const setWp = useExplorerStore((s) => s.setWaypoint)
  return (
    <div className={cx('max-w-sm rounded-xl px-3 py-2 text-sm', surface)} aria-live="polite">
      <span className="font-semibold">Objective: </span>
      {wp ? (
        <>
          <span className="text-muted">Head to {wp.label} (~{Math.round(d)} m)</span>{' '}
          <button className="link min-h-6" onClick={() => setWp(null)} aria-label="Clear waypoint">clear</button>
        </>
      ) : (
        <span className="text-muted">Visit the kiosk in the plaza, or try the Project Lab terminal.</span>
      )}
    </div>
  )
}

export function InteractPrompt() {
  const nearest = useExplorerStore((s) => s.nearest)
  const panel = useExplorerStore((s) => s.panel)
  if (!nearest || panel) return null
  return (
    <div className="pointer-events-auto absolute left-1/2 top-40 z-20 -translate-x-1/2" role="status">
      <button onClick={interactNearest} className="inline-flex min-h-11 items-center gap-2.5 rounded-lg bg-brand px-4 py-2 text-[15px] font-semibold text-white shadow-pop transition-colors hover:bg-brand-hover" aria-label={nearest.prompt}>
        <kbd className="rounded border border-white/40 bg-white/15 px-1.5 font-sans text-sm">E</kbd> {nearest.prompt.replace(/^Press E to /, '')}
      </button>
    </div>
  )
}

const ACTIONS: { label: string; icon: ComponentType<IconProps>; panel: PanelState }[] = [
  { label: 'Search', icon: IconSearch, panel: { kind: 'search' } },
  { label: 'Project Lab', icon: IconFlask, panel: { kind: 'project' } },
  { label: 'Bookings', icon: IconCalendar, panel: { kind: 'bookings', tab: 'tracker' } },
  { label: 'Scheduling', icon: IconSliders, panel: { kind: 'bookings', tab: 'scheduling' } },
  { label: 'Operations', icon: IconCheckSquare, panel: { kind: 'approvals' } },
  { label: 'Analytics', icon: IconChart, panel: { kind: 'analytics' } },
  { label: 'Assistant', icon: IconMessage, panel: { kind: 'assistant' } },
  { label: 'Notifications', icon: IconBell, panel: { kind: 'notifications' } },
]

const barBtn = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2.5 text-sm font-medium text-fg transition-colors hover:bg-surface2 sm:px-3'

export function QuickActions() {
  const open = useExplorerStore((s) => s.openPanel)
  return (
    <nav aria-label="Quick actions" className={cx('pointer-events-auto mx-auto flex w-fit max-w-full flex-wrap justify-center gap-0.5 rounded-xl p-1.5', surface, 'shadow-pop')}>
      {ACTIONS.map((a) => (
        <button key={a.label} className={barBtn} onClick={() => open(a.panel)} aria-label={a.label} title={a.label}>
          <a.icon size={18} className="text-muted" /> <span className="hidden xl:inline">{a.label}</span>
        </button>
      ))}
      <span className="mx-1 my-2 w-px bg-line" aria-hidden />
      <button className={barBtn} onClick={() => open({ kind: 'settings' })} aria-label="Pause and settings" title="Settings"><IconSettings size={18} className="text-muted" /> <span className="hidden xl:inline">Settings</span></button>
      <Link to={ROUTES.overview} className={barBtn} aria-label="Exit 3D" title="Exit 3D"><IconLogout size={18} className="text-muted" /> <span className="hidden xl:inline">Exit 3D</span></Link>
    </nav>
  )
}

/** Touch joystick + big Interact button. */
export function TouchControls() {
  const [coarse] = useState(() => {
    try { return !!window.matchMedia?.('(pointer: coarse)').matches } catch { return false }
  })
  const knob = useRef<HTMLDivElement>(null)
  const base = useRef<HTMLDivElement>(null)
  const active = useRef<number | null>(null)
  if (!coarse) return null
  const move = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId || !base.current) return
    const r = base.current.getBoundingClientRect()
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
    const m = Math.hypot(dx, dy)
    if (m > 1) { dx /= m; dy /= m }
    input.joy.x = dx; input.joy.y = dy
    if (knob.current) knob.current.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`
  }
  const end = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return
    active.current = null
    input.joy.x = 0; input.joy.y = 0
    if (knob.current) knob.current.style.transform = 'translate(0,0)'
  }
  return (
    <>
      <div
        ref={base}
        role="application"
        aria-label="Movement joystick"
        className="pointer-events-auto absolute bottom-4 left-4 z-30 h-28 w-28 touch-none rounded-full border border-line-strong bg-surface shadow-pop"
        onPointerDown={(e) => { e.stopPropagation(); active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e) }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div ref={knob} className="absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-brand shadow-raised" />
      </div>
      <button
        className="pointer-events-auto absolute bottom-6 right-4 z-30 h-20 w-20 rounded-full bg-brand text-lg font-semibold text-white shadow-pop"
        onClick={interactNearest}
        aria-label="Interact"
      >
        E
      </button>
    </>
  )
}

export { btn as hudBtn }
