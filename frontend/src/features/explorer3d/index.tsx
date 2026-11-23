import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'
import { Button, buttonCls, IconCube, IconMapPin } from '@/components/ui'
import { useAppStore } from '@/stores/appStore'
import { useEquipmentList } from '@/hooks/useApi'
import { Loader } from '@react-three/drei'
import Scene from './scene/Scene'
import { ExitButton, InteractPrompt, Minimap, Objective, MenuButton, StatusLegend, TouchControls } from './hud/Hud'
import { CANVAS_WRAP_ID, PanelHost } from './hud/PanelHost'
import { input, resetPlayer } from './character/playerState'
import { clearInteractables } from './interactions/registry'
import { interactNearest, useExplorerStore } from './stores/explorerStore'
import { FindGuide, useFindDriver } from './hud/FindGuide'

export function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function WebGLFallback({ reason, onRetry }: { reason: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 p-8 text-center text-fg">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-surface2 text-subtle" aria-hidden><IconCube size={24} /></span>
      <h1 className="text-2xl font-semibold tracking-tight">3D Campus is not available</h1>
      <p className="text-muted">{reason}</p>
      <p className="text-muted">Everything in 3D mode is also available in Professional Mode.</p>
      <div className="flex flex-wrap justify-center gap-3">
        {onRetry && <Button size="lg" variant="secondary" onClick={onRetry}>Retry 3D</Button>}
        <Link to={ROUTES.overview} className={buttonCls('primary', 'lg')}>
          Return to Professional Mode
        </Link>
      </div>
    </div>
  )
}

class SceneBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error('3D scene error', e, info) }
  render() {
    if (this.state.error) return <WebGLFallback reason="The 3D renderer hit an error and was stopped." />
    return this.props.children
  }
}

export default function Explorer3DPage() {
  const [webgl] = useState(() => detectWebGL())
  const [attempt, setAttempt] = useState(0)
  const [lost, setLost] = useState(false)
  if (!webgl) return <WebGLFallback reason="Your browser or device does not support WebGL, which the 3D campus needs." />
  if (lost) return <WebGLFallback reason="The graphics context was lost (the browser or GPU reset it)." onRetry={() => { setLost(false); setAttempt((n) => n + 1) }} />
  return <Explorer key={attempt} onContextLost={() => setLost(true)} />
}

function Explorer({ onContextLost }: { onContextLost: () => void }) {
  const eqQuery = useEquipmentList({ page_size: 100 })
  // refetch cadence for live badges (the shared hook has no interval option, so tick an invalidate-free refetch)
  const refetch = eqQuery.refetch
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) void refetch() }, 15000)
    return () => clearInterval(t)
  }, [refetch])
  const equipment = useMemo(() => eqQuery.data?.items ?? [], [eqQuery.data])
  const highlighted = useAppStore((s) => s.highlightedEquipmentIds)
  const panel = useExplorerStore((s) => s.panel)
  const fade = useExplorerStore((s) => s.fade)
  const wrap = useRef<HTMLDivElement>(null)
  useFindDriver(equipment, eqQuery.isSuccess, eqQuery.isError)
  const drag = useRef<{ id: number; x: number } | null>(null)

  useEffect(() => {
    // Lets the global connection banner move out of the way of the touch controls on this route.
    document.body.setAttribute('data-lablink-3d', '')
    return () => document.body.removeAttribute('data-lablink-3d')
  }, [])

  useEffect(() => {
    resetPlayer()
    clearInteractables()
    wrap.current?.focus()
    return () => { input.reset(); clearInteractables(); useExplorerStore.setState({ panel: null, prevPanel: null, nearest: null, waypoint: null, find: null, menuOpen: false, sprint: false, fade: false }) }
  }, [])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const lost = (e: Event) => { e.preventDefault(); input.reset(); onContextLost() }
    el.addEventListener('webglcontextlost', lost, true) // non-bubbling event, so listen in the capture phase
    return () => el.removeEventListener('webglcontextlost', lost, true)
  }, [onContextLost])

  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      const st = useExplorerStore.getState()
      if (e.key === 'Escape') {
        if (st.menuOpen) { st.setMenuOpen(false); return }
        if (st.panel) st.closePanel()
        else st.openPanel({ kind: 'settings' })
        return
      }
      if (st.panel || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Enter') {
        const el = e.target as HTMLElement | null
        if (st.menuOpen || (el && (el.tagName === 'BUTTON' || el.tagName === 'A'))) return
        interactNearest()
        return
      }
      const k = e.key.toLowerCase()
      if (k === 'e') { interactNearest(); return }
      if (['w', 'a', 's', 'd', 'q', 'r', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        input.keys.add(k)
        e.preventDefault()
      }
      if (e.key === 'Shift') input.keys.add('shift')
    }
    const up = (e: KeyboardEvent) => {
      input.keys.delete(e.key.toLowerCase())
      if (e.key === 'Shift') input.keys.delete('shift')
    }
    const blur = () => { input.keys.clear(); input.joy.x = 0; input.joy.y = 0 }
    const vis = () => { if (document.hidden) blur() }
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])

  useEffect(() => { if (panel) { input.keys.clear(); input.joy.x = 0; input.joy.y = 0 } }, [panel])

  return (
    <main className="relative h-[calc(100vh-0px)] min-h-[480px] w-full overflow-hidden bg-[#dde7ee]">
      <h1 className="sr-only">LabLink 3D Campus</h1>
      <div
        id={CANVAS_WRAP_ID}
        ref={wrap}
        tabIndex={-1}
        role="application"
        aria-label="3D campus. Use W A S D or arrow keys to move, Shift to run, E or Enter to interact, click the ground to walk, Escape for settings."
        className="absolute inset-0 touch-none outline-none"
        onPointerDown={(e) => {
          drag.current = { id: e.pointerId, x: e.clientX }
          wrap.current?.focus()
        }}
        onPointerMove={(e) => {
          if (drag.current?.id === e.pointerId && (e.buttons > 0 || e.pointerType === 'touch')) {
            input.orbitDelta += (e.clientX - drag.current.x) * 0.006
            drag.current.x = e.clientX
          }
        }}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
      >
        <SceneBoundary>
          <Scene equipment={equipment} highlightedIds={highlighted} paused={!!panel} />
        </SceneBoundary>
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="pointer-events-auto absolute left-3 top-3 flex max-w-[calc(100%-8.5rem)] flex-col items-start gap-2 sm:max-w-[60%]">
          <ExitButton />
          <LocationLabel />
          <Objective />
          <FindGuide />
        </div>
        <div className="pointer-events-auto absolute right-3 top-3 flex flex-col items-end gap-2">
          <MenuButton />
          <Minimap equipment={equipment} highlightedIds={highlighted} />
          <div className="hidden sm:block"><StatusLegend /></div>
        </div>
        <InteractPrompt />
        <TouchControls />
        {eqQuery.isError && (
          <div role="alert" className="pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 shadow-raised">
            Could not load live equipment data. <button className="link max-sm:inline-flex max-sm:min-h-11 max-sm:items-center" onClick={() => refetch()}>Retry</button>
          </div>
        )}
      </div>
      <Loader
        containerStyles={{ background: '#f6f6f3' }}
        innerStyles={{ background: '#e4e7ec', width: 220, height: 4, borderRadius: 4, overflow: 'hidden' }}
        barStyles={{ background: '#1d4ed8', height: 4 }}
        dataStyles={{ color: '#475467', fontSize: 13, fontFamily: 'system-ui, "Segoe UI", sans-serif', fontWeight: 500 }}
        dataInterpolation={(p) => `Loading 3D campus… ${p.toFixed(0)}%`}
      />
      <div aria-hidden className={`pointer-events-none absolute inset-0 z-30 bg-black transition-opacity duration-200 ${fade ? 'opacity-100' : 'opacity-0'}`} />
      <PanelHost equipment={equipment} />
    </main>
  )
}

function LocationLabel() {
  const loc = useExplorerStore((s) => s.location)
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-semibold text-fg shadow-raised" aria-live="polite" aria-label={`Current location: ${loc}`}>
      <IconMapPin size={16} className="text-brand" /> {loc}
    </div>
  )
}
