import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import type { EquipmentType } from '@/types/api'
import { ROUTES } from '@/lib/routes'
import { BUILDINGS, CAMPUS_BOUND, buildingForDept } from '../environments/layout'
import { startWalk } from '../interactions/navigation'
import { input, playerState } from '../character/playerState'
import { interactNearest, useExplorerStore, type PanelState } from '../stores/explorerStore'
import {
  cx, IconArrowLeft, IconBell, IconCalendar, IconChart, IconCheckSquare, IconFlask, IconLogout, IconMessage, IconSearch, IconSettings,
  IconSliders, IconMap, IconMenu, IconX, type IconProps,
} from '@/components/ui'

/** Solid, light HUD surfaces — readable over the scene without blur or glow. */
const surface = 'border border-line-strong bg-surface text-fg shadow-raised'
const btn = `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-surface2 ${surface}`

export function ExitButton() {
  return (
    <Link to={ROUTES.overview} className={btn} aria-label="Exit 3D and skip to dashboard">
      <IconArrowLeft size={18} className="text-muted" /> Exit 3D<span className="max-sm:hidden"> · Go to dashboard</span>
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
  const B = CAMPUS_BOUND
  const V = B + 5
  const fs = V / 10
  const openPanel = useExplorerStore((st) => st.openPanel)
  return (
    <button type="button" onClick={() => openPanel({ kind: 'map' })} aria-label={`Open campus map. You are at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}.${wp ? ` Waypoint: ${wp.label}.` : ''}`} title="Open campus map" className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
    <svg viewBox={`${-V} ${-V} ${2 * V} ${2 * V}`} aria-hidden className="h-24 w-24 rounded-xl border border-line-strong bg-[#e6ece0] shadow-raised sm:h-36 sm:w-36">
      <rect x={-2.5} y={-B} width={5} height={2 * B} fill="#e2dccd" />
      <rect x={-B} y={-2.5} width={2 * B} height={5} fill="#e2dccd" />
      <circle cx={0} cy={0} r={10} fill="#d9d4c8" />
      {BUILDINGS.map((b) => (
        <g key={b.id}>
          <rect x={b.x - b.w / 2} y={b.z - b.d / 2} width={b.w} height={b.d} rx={1} fill={b.color} stroke={hiBuildings.has(b.id) ? '#1d4ed8' : '#5d6b82'} strokeWidth={hiBuildings.has(b.id) ? 2 : 0.6} />
          <text x={b.x} y={b.z + 2} fontSize={fs * 0.6} fontWeight={600} textAnchor="middle" fill="#101828" stroke="#ffffff" strokeWidth={1.2} paintOrder="stroke">{b.short}</text>
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
      <text x={-V + 1} y={-V + fs * 0.6} fontSize={fs * 0.5} fontWeight={600} fill="#475467">N ↑</text>
    </svg>
    </button>
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
    <div className={cx('max-w-sm rounded-xl px-3 py-2 text-xs sm:text-sm', surface)} aria-live="polite">
      <span className="font-semibold">Objective: </span>
      {wp ? (
        <>
          <span className="text-muted">Head to {wp.label} (~{Math.round(d)} m)</span>{' '}
          <button className="link min-h-6" onClick={() => startWalk(wp)} aria-label="Walk to waypoint">walk there</button>{' '}
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
    <div className="pointer-events-auto absolute left-1/2 top-40 z-20 -translate-x-1/2 max-sm:bottom-[11.5rem] max-sm:top-auto" role="status">
      <button onClick={interactNearest} className="inline-flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-lg bg-brand px-4 py-2 text-[15px] font-semibold text-white shadow-pop transition-colors hover:bg-brand-hover" aria-label={nearest.prompt}>
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

const MENU_ITEMS: { label: string; icon: ComponentType<IconProps>; panel: PanelState }[] = [
  ...ACTIONS,
  { label: 'Map & Teleport', icon: IconMap, panel: { kind: 'map' } },
  { label: 'Settings', icon: IconSettings, panel: { kind: 'settings' } },
]

const rowCls = 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-fg transition-colors hover:bg-surface2 focus-visible:bg-surface2'

export function MenuButton() {
  const open = useExplorerStore((s) => s.menuOpen)
  const setOpen = useExplorerStore((s) => s.setMenuOpen)
  const openPanel = useExplorerStore((s) => s.openPanel)
  const trigger = useRef<HTMLButtonElement>(null)
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) first.current?.focus()
  }, [open])
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      e.nativeEvent.stopImmediatePropagation?.()
      setOpen(false)
      trigger.current?.focus()
    }
  }
  return (
    <div className="relative flex flex-col items-end" onKeyDown={onKey}>
      <button
        ref={trigger}
        type="button"
        className={cx(btn, 'min-w-11 justify-center')}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="explorer-menu"
        onClick={() => setOpen(!open)}
      >
        {open ? <IconX size={20} /> : <IconMenu size={20} />}<span className="max-sm:hidden">Menu</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 sm:hidden" aria-hidden onClick={() => setOpen(false)} />
          <nav
            id="explorer-menu"
            aria-label="Menu"
            className={cx('z-50 mt-2 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl p-1.5', surface, 'shadow-pop max-sm:fixed max-sm:inset-x-2 max-sm:top-16 sm:w-64')}
          >
            <ul className="space-y-0.5">
              {MENU_ITEMS.map((a, i) => (
                <li key={a.label}>
                  <button ref={i === 0 ? first : undefined} className={rowCls} onClick={() => openPanel(a.panel)}>
                    <a.icon size={18} className="text-muted" /> {a.label}
                  </button>
                </li>
              ))}
              <li className="my-1 border-t border-line" aria-hidden />
              <li>
                <Link to={ROUTES.overview} className={rowCls} onClick={() => setOpen(false)}>
                  <IconLogout size={18} className="text-muted" /> Exit 3D
                </Link>
              </li>
            </ul>
          </nav>
        </>
      )}
    </div>
  )
}

/** Touch joystick + big Interact button. */
export function TouchControls() {
  const [coarse, setCoarse] = useState(() => {
    try { return !!window.matchMedia?.('(pointer: coarse), (max-width: 800px)').matches } catch { return false }
  })
  useEffect(() => {
    try {
      const mq = window.matchMedia?.('(pointer: coarse), (max-width: 800px)')
      if (!mq) return
      const on = () => setCoarse(mq.matches)
      mq.addEventListener?.('change', on)
      return () => mq.removeEventListener?.('change', on)
    } catch { /* ignore */ }
  }, [])
  const sprint = useExplorerStore((s) => s.sprint)
  const setSprint = useExplorerStore((s) => s.setSprint)
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
        type="button"
        className={cx('pointer-events-auto absolute bottom-[7.5rem] right-4 z-30 flex h-12 w-20 flex-col items-center justify-center rounded-full border text-xs font-semibold leading-tight shadow-pop', sprint ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-fg')}
        aria-pressed={sprint}
        aria-label="Sprint"
        onClick={() => setSprint(!sprint)}
      >
        Sprint<span>{sprint ? 'ON' : 'OFF'}</span>
      </button>
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
