import { BUILDINGS, CAMPUS_BOUND, PLAZA, doorOutside, doorPos, isInside, type BuildingDef } from '../environments/layout'
import { input, playerState } from '../character/playerState'
import { useExplorerStore } from '../stores/explorerStore'

export interface Pt { x: number; z: number }
export interface Destination {
  id: string
  label: string
  kind: 'building' | 'landmark'
  /** Where the thing is on the map. */
  x: number
  z: number
  /** Where the player is placed / walks to (outside the door, or beside the landmark). */
  stand: Pt
  heading: number
}

/** Duration of the fade-out before a teleport is applied (ms). */
const TELEPORT_FADE_MS = 250

const bDest = (id: string): Destination => {
  const b = BUILDINGS.find((q) => q.id === id)!
  const s = doorOutside(b)
  return { id: b.id, label: b.label, kind: 'building', x: b.x, z: b.z, stand: s, heading: b.facing > 0 ? 0 : Math.PI }
}

export const DESTINATIONS: Destination[] = [
  { id: 'kiosk', label: 'Information kiosk', kind: 'landmark', ...PLAZA.kiosk, stand: { x: PLAZA.kiosk.x, z: PLAZA.kiosk.z + 2 }, heading: Math.PI },
  { id: 'project-lab', label: 'Project Lab terminal', kind: 'landmark', ...PLAZA.ai, stand: { x: PLAZA.ai.x, z: PLAZA.ai.z + 2 }, heading: Math.PI },
  { id: 'bookings', label: 'Bookings terminal', kind: 'landmark', ...PLAZA.booking, stand: { x: PLAZA.booking.x, z: PLAZA.booking.z + 2 }, heading: Math.PI },
  { id: 'scheduling', label: 'Scheduling hub', kind: 'landmark', ...PLAZA.scheduling, stand: { x: PLAZA.scheduling.x, z: PLAZA.scheduling.z + 2 }, heading: Math.PI },
  ...['CS-B', 'EC-B', 'ME-B', 'BT-B', 'OPS', 'ANA'].map(bDest),
]

// ---- path planning (pure) ----
function segHitsRect(a: Pt, b: Pt, r: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  let t0 = 0, t1 = 1
  const dx = b.x - a.x, dz = b.z - a.z
  for (const [p, q, lo, hi] of [[a.x, dx, r.minX, r.maxX], [a.z, dz, r.minZ, r.maxZ]] as const) {
    if (Math.abs(q) < 1e-9) { if (p <= lo || p >= hi) return false; continue }
    let u = (lo - p) / q, v = (hi - p) / q
    if (u > v) [u, v] = [v, u]
    t0 = Math.max(t0, u); t1 = Math.min(t1, v)
    if (t0 >= t1) return false
  }
  return true
}
const footprint = (b: BuildingDef, m: number) => ({ minX: b.x - b.w / 2 - m, maxX: b.x + b.w / 2 + m, minZ: b.z - b.d / 2 - m, maxZ: b.z + b.d / 2 + m })
const len = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.z - b.z)

function detour(from: Pt, to: Pt): Pt[] {
  for (const b of BUILDINGS) {
    const r = footprint(b, 1.2)
    if (!segHitsRect(from, to, r)) continue
    const corners: Pt[] = [{ x: r.minX, z: r.minZ }, { x: r.maxX, z: r.minZ }, { x: r.minX, z: r.maxZ }, { x: r.maxX, z: r.maxZ }]
    const clear = (p: Pt, q: Pt) => !segHitsRect(p, q, footprint(b, 0.8))
    const ranked = corners
      .map((c) => ({ c, d: len(from, c) + len(c, to), ok: clear(from, c) && clear(c, to) }))
      .sort((p, q) => Number(q.ok) - Number(p.ok) || p.d - q.d)
    const best = ranked[0].c
    return [best, ...(clear(best, to) ? [] : detour(best, to).slice(0, 1))]
  }
  return []
}

/** Centre-aisle point level with the destination, so the last leg runs along a clear row between benches. */
function aisle(b: BuildingDef, dest: Pt): Pt[] {
  return Math.abs(dest.x - b.x) > 2 ? [{ x: b.x, z: dest.z }] : []
}

/** Waypoints (excluding the start) from `from` to `to`, routing through doors and around buildings. */
export function planPath(from: Pt, to: Pt): Pt[] {
  const clamp = (v: number) => Math.max(-CAMPUS_BOUND + 0.5, Math.min(CAMPUS_BOUND - 0.5, v))
  const dest = { x: clamp(to.x), z: clamp(to.z) }
  const path: Pt[] = []
  let cur = from
  const fromB = BUILDINGS.find((b) => isInside(b, from.x, from.z))
  const toB = BUILDINGS.find((b) => isInside(b, dest.x, dest.z))
  if (fromB && fromB !== toB) {
    const d = doorPos(fromB)
    path.push({ x: d.x, z: d.z - fromB.facing * 1 }, doorOutside(fromB, 2))
    cur = path[path.length - 1]
  }
  if (toB && toB !== fromB) {
    const out = doorOutside(toB, 2)
    path.push(...detour(cur, out), out, doorPos(toB), { x: toB.x, z: toB.z + toB.facing * (toB.d / 2 - 1.2) })
    if (Math.hypot(dest.x - toB.x, dest.z - (toB.z + toB.facing * (toB.d / 2 - 1.2))) > 0.6) path.push(...aisle(toB, dest), dest)
  } else if (toB) {
    // already inside the target building: use the centre aisle so benches are not crossed
    path.push(...aisle(toB, dest), dest)
  } else {
    path.push(...detour(cur, dest), dest)
  }
  return path
}

// ---- auto-walk runtime state (read by PlayerRig every frame) ----
export const autoWalk: { path: Pt[]; target: Pt | null; age: number; stuck: number } = { path: [], target: null, age: 0, stuck: 0 }

export function startWalk(to: Pt): void {
  autoWalk.path = planPath({ x: playerState.x, z: playerState.z }, to)
  autoWalk.target = { x: to.x, z: to.z }
  autoWalk.age = 0
  autoWalk.stuck = 0
}
export function cancelWalk(): void { autoWalk.path = []; autoWalk.target = null; autoWalk.age = 0; autoWalk.stuck = 0 }

export function walkToDestination(d: Destination): void {
  useExplorerStore.getState().closePanel()
  startWalk(d.stand)
}

function place(d: Destination) {
  playerState.x = d.stand.x
  playerState.z = d.stand.z
  playerState.heading = d.heading
  playerState.speed = 0
}

export function teleportToDestination(d: Destination): void {
  const st = useExplorerStore.getState()
  st.closePanel()
  cancelWalk()
  input.joy.x = 0; input.joy.y = 0
  if (st.reduceMotion) { place(d); return }
  st.setFade(true)
  setTimeout(() => { place(d); useExplorerStore.getState().setFade(false) }, TELEPORT_FADE_MS)
}
