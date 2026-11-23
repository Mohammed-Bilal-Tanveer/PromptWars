import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'
import { useAppStore } from '@/stores/appStore'
import { useEquipmentList } from '@/hooks/useApi'
import { Loader } from '@react-three/drei'
import Scene from './scene/Scene'
import { ExitButton, InteractPrompt, Minimap, Objective, QuickActions, StatusLegend, TouchControls } from './hud/Hud'
import { CANVAS_WRAP_ID, PanelHost } from './hud/PanelHost'
import { input, resetPlayer } from './character/playerState'
import { clearInteractables } from './interactions/registry'
import { interactNearest, useExplorerStore } from './stores/explorerStore'

export function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function WebGLFallback({ reason }: { reason: string }) {
  return (
    <div role="alert" className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 p-8 text-center text-fg">
      <h1 className="text-2xl font-bold">3D Campus is not available</h1>
      <p className="text-muted">{reason}</p>
      <p className="text-muted">Everything in 3D mode is also available in Professional Mode.</p>
      <Link to={ROUTES.overview} className="grad-sched inline-flex min-h-12 items-center rounded-xl px-6 py-3 font-semibold text-white">
        Return to Professional Mode
      </Link>
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
  if (!webgl) return <WebGLFallback reason="Your browser or device does not support WebGL, which the 3D campus needs." />
  return <Explorer />
}

function Explorer() {
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
  const wrap = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number } | null>(null)

  useEffect(() => {
    resetPlayer()
    clearInteractables()
    wrap.current?.focus()
    return () => { input.reset(); clearInteractables(); useExplorerStore.setState({ panel: null, prevPanel: null, nearest: null, waypoint: null }) }
  }, [])

  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      const st = useExplorerStore.getState()
      if (e.key === 'Escape') {
        if (st.panel) st.closePanel()
        else st.openPanel({ kind: 'settings' })
        return
      }
      if (st.panel || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
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
    const blur = () => input.keys.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  useEffect(() => { if (panel) input.keys.clear() }, [panel])

  return (
    <div className="relative h-[calc(100vh-0px)] min-h-[480px] w-full overflow-hidden bg-sky-200">
      <div
        id={CANVAS_WRAP_ID}
        ref={wrap}
        tabIndex={-1}
        role="application"
        aria-label="3D campus. Use W A S D or arrow keys to move, Shift to run, E to interact, Escape for settings."
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
        <div className="pointer-events-auto absolute left-3 top-3 flex max-w-[60%] flex-col items-start gap-2">
          <ExitButton />
          <LocationLabel />
          <Objective />
        </div>
        <div className="pointer-events-auto absolute right-3 top-3 flex flex-col items-end gap-2">
          <Minimap equipment={equipment} highlightedIds={highlighted} />
          <div className="hidden sm:block"><StatusLegend /></div>
        </div>
        <InteractPrompt />
        <div className="absolute bottom-3 left-1/2 w-[min(100%-9rem,56rem)] -translate-x-1/2 max-sm:bottom-36 max-sm:w-[calc(100%-1.5rem)]">
          <QuickActions />
        </div>
        <TouchControls />
        {eqQuery.isError && (
          <div role="alert" className="pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2 rounded-xl bg-rose-700 px-3 py-2 text-sm text-white">
            Could not load live equipment data. <button className="underline" onClick={() => refetch()}>Retry</button>
          </div>
        )}
      </div>
      <Loader containerStyles={{ background: 'rgba(11,16,32,0.85)' }} dataInterpolation={(p) => `Loading 3D campus… ${p.toFixed(0)}%`} />
      <PanelHost equipment={equipment} />
    </div>
  )
}

function LocationLabel() {
  const loc = useExplorerStore((s) => s.location)
  return (
    <div className="rounded-xl border border-white/20 bg-slate-900/85 px-3 py-1.5 text-sm font-semibold text-white" aria-live="polite" aria-label={`Current location: ${loc}`}>
      📍 {loc}
    </div>
  )
}
