import { create } from 'zustand'
import type { Interactable } from '../interactions/registry'
import type { CharacterId } from '../scene/kenney'
import { input } from '../character/playerState'

export type PanelKind =
  | 'equipment' | 'department' | 'lab' | 'kiosk' | 'project' | 'bookings' | 'approvals'
  | 'analytics' | 'assistant' | 'notifications' | 'search' | 'settings' | 'map'
export interface PanelState { kind: PanelKind; recordId?: string; tab?: 'calendar' | 'form' | 'tracker' | 'scheduling' }
export type Quality = 'auto' | 'low' | 'high'
export interface Waypoint { x: number; z: number; label: string }

interface ExplorerState {
  panel: PanelState | null
  prevPanel: PanelState | null
  openPanel: (p: PanelState) => void
  closePanel: () => void
  back: () => void
  nearest: Interactable | null
  setNearest: (o: Interactable | null) => void
  location: string
  setLocation: (s: string) => void
  insideBuilding: string | null
  setInside: (id: string | null) => void
  waypoint: Waypoint | null
  setWaypoint: (w: Waypoint | null) => void
  quality: Quality
  setQuality: (q: Quality) => void
  reduceMotion: boolean
  setReduceMotion: (v: boolean) => void
  menuOpen: boolean
  setMenuOpen: (v: boolean) => void
  sprint: boolean
  setSprint: (v: boolean) => void
  fade: boolean
  setFade: (v: boolean) => void
  character: CharacterId
  setCharacter: (c: CharacterId) => void
}

const prefersReduced = () => {
  try { return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

const CHAR_KEY = 'lablink.character'
const loadCharacter = (): CharacterId => {
  try { return (localStorage.getItem(CHAR_KEY) as CharacterId) || 'male-a' } catch { return 'male-a' }
}

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  panel: null,
  prevPanel: null,
  openPanel: (p) => set((s) => ({ menuOpen: false, prevPanel: s.panel && s.panel.kind !== 'settings' ? s.panel : null, panel: p })),
  closePanel: () => set({ panel: null, prevPanel: null }),
  back: () => {
    const prev = get().prevPanel
    set({ panel: prev, prevPanel: null })
  },
  nearest: null,
  setNearest: (o) => { if (get().nearest?.id !== o?.id) set({ nearest: o }) },
  location: 'Central Plaza',
  setLocation: (s) => { if (get().location !== s) set({ location: s }) },
  insideBuilding: null,
  setInside: (id) => { if (get().insideBuilding !== id) set({ insideBuilding: id }) },
  waypoint: null,
  setWaypoint: (w) => set({ waypoint: w }),
  quality: 'auto',
  setQuality: (q) => set({ quality: q }),
  reduceMotion: prefersReduced(),
  setReduceMotion: (v) => set({ reduceMotion: v }),
  menuOpen: false,
  setMenuOpen: (v) => set({ menuOpen: v }),
  sprint: false,
  setSprint: (v) => { input.sprint = v; set({ sprint: v }) },
  fade: false,
  setFade: (v) => set({ fade: v }),
  character: loadCharacter(),
  setCharacter: (c) => {
    try { localStorage.setItem(CHAR_KEY, c) } catch { /* storage unavailable */ }
    set({ character: c })
  },
}))

export function panelForInteractable(o: Interactable): PanelState | null {
  switch (o.type) {
    case 'department': return { kind: 'department', recordId: o.recordId }
    case 'laboratory': return { kind: 'lab', recordId: o.recordId }
    case 'equipment': return { kind: 'equipment', recordId: o.recordId }
    case 'kiosk': return { kind: 'kiosk' }
    case 'ai_terminal': return { kind: 'project' }
    case 'booking_terminal': return { kind: 'bookings', tab: 'calendar' }
    case 'scheduling_hub': return { kind: 'bookings', tab: 'scheduling' }
    case 'operations_desk': return { kind: 'approvals' }
    case 'analytics_centre': return { kind: 'analytics' }
    default: return null
  }
}

export function interactNearest() {
  const s = useExplorerStore.getState()
  if (s.panel || !s.nearest) return
  const p = panelForInteractable(s.nearest)
  if (p) s.openPanel(p)
}

export function resolveQuality(q: Quality): 'low' | 'high' {
  if (q !== 'auto') return q
  try {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches
    const cores = navigator.hardwareConcurrency ?? 4
    return coarse || cores <= 4 ? 'low' : 'high'
  } catch { return 'low' }
}
