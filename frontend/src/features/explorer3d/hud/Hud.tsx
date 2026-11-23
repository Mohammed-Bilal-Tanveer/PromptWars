import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EquipmentType } from '@/types/api'
import { ROUTES } from '@/lib/routes'
import { BUILDINGS, buildingForDept } from '../environments/layout'
import { input, playerState } from '../character/playerState'
import { interactNearest, useExplorerStore, type PanelState } from '../stores/explorerStore'

const btn = 'inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/20 bg-slate-900/85 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300'

export function ExitButton() {
  return (
    <Link to={ROUTES.overview} className={btn + ' bg-indigo-600/90 hover:bg-indigo-500'} aria-label="Exit 3D and skip to dashboard">
      ⬅ Exit 3D / Skip to dashboard
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
    <svg viewBox="-60 -60 120 120" width={144} height={144} role="img" aria-label={`Minimap. You are at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}.${wp ? ` Waypoint: ${wp.label}.` : ''}`} className="rounded-xl border border-white/30 bg-emerald-900/70">
      <circle cx={0} cy={0} r={10} fill="#c9d1e6" opacity={0.7} />
      {BUILDINGS.map((b) => (
        <g key={b.id}>
          <rect x={b.x - b.w / 2} y={b.z - b.d / 2} width={b.w} height={b.d} fill={b.color} stroke={hiBuildings.has(b.id) ? '#f472b6' : '#0b1020'} strokeWidth={hiBuildings.has(b.id) ? 2.5 : 0.8} />
          <text x={b.x} y={b.z + 2} fontSize={6} textAnchor="middle" fill="#fff" stroke="#0b1020" strokeWidth={0.4} paintOrder="stroke">{b.short}</text>
          {hiBuildings.has(b.id) && <text x={b.x} y={b.z - 6} fontSize={7} textAnchor="middle" fill="#f472b6">★</text>}
        </g>
      ))}
      {wp && (
        <g>
          <circle cx={wp.x} cy={wp.z} r={4} fill="none" stroke="#fbbf24" strokeWidth={1.5} />
          <text x={wp.x} y={wp.z + 2} fontSize={6} textAnchor="middle" fill="#fbbf24">⚑</text>
        </g>
      )}
      <g transform={`translate(${p.x} ${p.z}) rotate(${(-p.h * 180) / Math.PI + 180})`}>
        <polygon points="0,-4 3,3 -3,3" fill="#fff" stroke="#0b1020" strokeWidth={0.8} />
      </g>
      <text x={-58} y={-52} fontSize={5} fill="#fff">N↑ (−z)</text>
      {S > 100 && null}
    </svg>
  )
}

export function StatusLegend() {
  return (
    <div className="rounded-xl border border-white/20 bg-slate-900/85 px-3 py-2 text-xs text-white" aria-label="Equipment status legend">
      <div className="font-semibold">Equipment status</div>
      <div>● Available x/y</div>
      <div>◐ Fully booked now</div>
      <div>▲ Maintenance</div>
      <div>★ AI match (pink ring)</div>
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
    <div className="rounded-xl border border-white/20 bg-slate-900/85 px-3 py-2 text-sm text-white" aria-live="polite">
      <span className="font-semibold">Objective: </span>
      {wp ? (
        <>
          Head to {wp.label} (~{Math.round(d)} m){' '}
          <button className="underline" onClick={() => setWp(null)} aria-label="Clear waypoint">clear</button>
        </>
      ) : (
        'Visit the kiosk in the plaza, or try the AI Project Lab terminal.'
      )}
    </div>
  )
}

export function InteractPrompt() {
  const nearest = useExplorerStore((s) => s.nearest)
  const panel = useExplorerStore((s) => s.panel)
  if (!nearest || panel) return null
  return (
    <div className="pointer-events-auto absolute left-1/2 top-24 z-20 -translate-x-1/2" role="status">
      <button onClick={interactNearest} className={btn + ' bg-cyan-600/95 hover:bg-cyan-500 text-base'} aria-label={nearest.prompt}>
        <kbd className="rounded bg-black/40 px-1.5">E</kbd> {nearest.prompt.replace(/^Press E to /, '')}
      </button>
    </div>
  )
}

const ACTIONS: { label: string; icon: string; panel: PanelState }[] = [
  { label: 'Search', icon: '🔎', panel: { kind: 'search' } },
  { label: 'Project AI', icon: '✨', panel: { kind: 'project' } },
  { label: 'Bookings', icon: '📅', panel: { kind: 'bookings', tab: 'tracker' } },
  { label: 'Scheduling', icon: '🧮', panel: { kind: 'bookings', tab: 'scheduling' } },
  { label: 'Operations', icon: '✅', panel: { kind: 'approvals' } },
  { label: 'Analytics', icon: '📊', panel: { kind: 'analytics' } },
  { label: 'Assistant', icon: '💬', panel: { kind: 'assistant' } },
  { label: 'Notifications', icon: '🔔', panel: { kind: 'notifications' } },
]

export function QuickActions() {
  const open = useExplorerStore((s) => s.openPanel)
  return (
    <nav aria-label="Quick actions" className="pointer-events-auto flex max-w-full flex-wrap justify-center gap-1.5">
      {ACTIONS.map((a) => (
        <button key={a.label} className={btn} onClick={() => open(a.panel)} aria-label={a.label}>
          <span aria-hidden>{a.icon}</span> <span className="hidden sm:inline">{a.label}</span>
        </button>
      ))}
      <button className={btn} onClick={() => open({ kind: 'settings' })} aria-label="Pause and settings">⚙ <span className="hidden sm:inline">Settings</span></button>
      <Link to={ROUTES.overview} className={btn} aria-label="Exit 3D"><span aria-hidden>🚪</span> <span className="hidden sm:inline">Exit 3D</span></Link>
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
        className="pointer-events-auto absolute bottom-4 left-4 z-30 h-28 w-28 touch-none rounded-full border-2 border-white/40 bg-slate-900/60"
        onPointerDown={(e) => { e.stopPropagation(); active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e) }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div ref={knob} className="absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-white/70" />
      </div>
      <button
        className="pointer-events-auto absolute bottom-6 right-4 z-30 h-20 w-20 rounded-full border-2 border-white/50 bg-cyan-600/90 text-lg font-bold text-white"
        onClick={interactNearest}
        aria-label="Interact"
      >
        E
      </button>
    </>
  )
}

export { btn as hudBtn }
