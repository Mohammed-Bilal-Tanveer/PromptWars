import type { EquipmentType } from '@/types/api'

export interface AABB { minX: number; maxX: number; minZ: number; maxZ: number }
export type RoofKind = 'flat' | 'pyramid' | 'dome' | 'slope'

export interface BuildingDef {
  id: string // building_code or special id
  label: string
  short: string
  x: number
  z: number
  w: number // size along x
  d: number // size along z
  h: number
  facing: 1 | -1 // +1: door on +z side, -1: door on -z side
  color: string
  roofColor: string
  roof: RoofKind
  departmentIds: string[]
  special?: 'operations' | 'analytics'
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'CS-B', label: 'CS Building', short: 'CS-B', x: -28, z: -22, w: 16, d: 12, h: 4.8, facing: 1, color: '#6B84A8', roofColor: '#3F5373', roof: 'flat', departmentIds: ['dept-cs'] },
  { id: 'EC-B', label: 'ECE Building', short: 'EC-B', x: 28, z: -22, w: 16, d: 12, h: 4.8, facing: 1, color: '#C9A66B', roofColor: '#8A6A38', roof: 'pyramid', departmentIds: ['dept-ece'] },
  { id: 'ME-B', label: 'Mech & Civil Building', short: 'ME-B', x: -28, z: 24, w: 16, d: 12, h: 4.8, facing: -1, color: '#C07A5F', roofColor: '#7D4A38', roof: 'slope', departmentIds: ['dept-mech', 'dept-civil'] },
  { id: 'BT-B', label: 'Biotech Building', short: 'BT-B', x: 28, z: 24, w: 16, d: 12, h: 4.8, facing: -1, color: '#7FA58B', roofColor: '#4A6F58', roof: 'dome', departmentIds: ['dept-bio'] },
  { id: 'OPS', label: 'Operations & Approval Centre', short: 'OPS', x: 0, z: -40, w: 16, d: 8, h: 4.8, facing: 1, color: '#A79F94', roofColor: '#6B655C', roof: 'flat', departmentIds: [], special: 'operations' },
  { id: 'ANA', label: 'Analytics Control Centre', short: 'ANA', x: 0, z: 40, w: 16, d: 8, h: 4.8, facing: -1, color: '#8FA3B0', roofColor: '#566874', roof: 'flat', departmentIds: [], special: 'analytics' },
]

export const DEPT_FALLBACK: Record<string, { building: string; x: number; z: number; name: string }> = {
  'dept-cs': { building: 'CS-B', x: -28, z: -22, name: 'Computer Science & AI' },
  'dept-ece': { building: 'EC-B', x: 28, z: -22, name: 'Electronics & Communication' },
  'dept-mech': { building: 'ME-B', x: -28, z: 24, name: 'Mechanical Engineering' },
  'dept-civil': { building: 'ME-B', x: -28, z: 24, name: 'Civil Engineering' },
  'dept-bio': { building: 'BT-B', x: 28, z: 24, name: 'Biotechnology' },
}

export const CAMPUS_BOUND = 55
export const DOOR_WIDTH = 2.9 // matches the Kenney wide doorway opening
const WALL_T = 0.5

export const buildingById = (id: string) => BUILDINGS.find((b) => b.id === id)
export const buildingForDept = (deptId: string) => BUILDINGS.find((b) => b.departmentIds.includes(deptId))

/** World position of the door threshold (at the wall line). */
export const doorPos = (b: BuildingDef) => ({ x: b.x, z: b.z + b.facing * (b.d / 2) })
/** Point just outside the door. */
export const doorOutside = (b: BuildingDef, off = 2.5) => ({ x: b.x, z: b.z + b.facing * (b.d / 2 + off) })

export function isInside(b: BuildingDef, x: number, z: number) {
  return Math.abs(x - b.x) < b.w / 2 - 0.2 && Math.abs(z - b.z) < b.d / 2 - 0.2
}

/** Interior slot layout in building-local (u: along x, v: depth towards the door). */
const SLOTS: [number, number][] = [
  [-6, -4], [-3.6, -4], [3.6, -4], [6, -4],
  [-6, -0.6], [-3.6, -0.6], [3.6, -0.6], [6, -0.6],
  [-6, 3], [-3.6, 3], [3.6, 3], [6, 3],
]
export const MAX_ANCHORS = SLOTS.length

export function slotWorld(b: BuildingDef, i: number) {
  const [u, v] = SLOTS[i % SLOTS.length]
  return { x: b.x + u, z: b.z + b.facing * v }
}
export const BENCH_SIZE = { w: 2.2, d: 1.1 }

export function wallBoxes(b: BuildingDef): AABB[] {
  const hw = b.w / 2, hd = b.d / 2, g = DOOR_WIDTH / 2
  const front = b.z + b.facing * hd
  const back = b.z - b.facing * hd
  const fMin = front - WALL_T / 2, fMax = front + WALL_T / 2
  const bMin = back - WALL_T / 2, bMax = back + WALL_T / 2
  return [
    { minX: b.x - hw, maxX: b.x - g, minZ: fMin, maxZ: fMax },
    { minX: b.x + g, maxX: b.x + hw, minZ: fMin, maxZ: fMax },
    { minX: b.x - hw, maxX: b.x + hw, minZ: bMin, maxZ: bMax },
    { minX: b.x - hw - WALL_T, maxX: b.x - hw, minZ: b.z - hd, maxZ: b.z + hd },
    { minX: b.x + hw, maxX: b.x + hw + WALL_T, minZ: b.z - hd, maxZ: b.z + hd },
  ]
}

export function benchBox(x: number, z: number): AABB {
  return { minX: x - BENCH_SIZE.w / 2, maxX: x + BENCH_SIZE.w / 2, minZ: z - BENCH_SIZE.d / 2, maxZ: z + BENCH_SIZE.d / 2 }
}
export const boxAt = (x: number, z: number, hw: number, hd: number): AABB => ({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd })

export const PLAZA = {
  kiosk: { x: 0, z: -5 },
  ai: { x: -7, z: 0 },
  booking: { x: 7, z: 0 },
  scheduling: { x: 0, z: 6 },
  sign: { x: 0, z: -9.5 },
}
/** AI terminal inside CS-B (back-centre). */
export const csAiTerminal = (b: BuildingDef) => ({ x: b.x, z: b.z - b.facing * 4.6 })
/** Interior console position for the special centres (near the door so it is reachable from outside). */
export const consolePos = (b: BuildingDef) => ({ x: b.x, z: b.z - b.facing * (b.d / 2 - 1.2) })

export const BENCHES_PLAZA: { x: number; z: number; rot: number }[] = [
  { x: -4, z: 8, rot: 0 }, { x: 4, z: 8, rot: 0 }, { x: -9, z: -4, rot: Math.PI / 2 }, { x: 9, z: -4, rot: Math.PI / 2 },
]

export function staticColliders(): AABB[] {
  const out: AABB[] = []
  for (const b of BUILDINGS) out.push(...wallBoxes(b))
  out.push(boxAt(PLAZA.kiosk.x, PLAZA.kiosk.z, 0.9, 0.9))
  out.push(boxAt(PLAZA.ai.x, PLAZA.ai.z, 0.8, 0.8))
  out.push(boxAt(PLAZA.booking.x, PLAZA.booking.z, 0.8, 0.8))
  out.push(boxAt(PLAZA.scheduling.x, PLAZA.scheduling.z, 0.8, 0.8))
  out.push(boxAt(PLAZA.sign.x, PLAZA.sign.z, 1.6, 0.3))
  for (const b of BENCHES_PLAZA) out.push(boxAt(b.x, b.z, b.rot ? 0.4 : 1.1, b.rot ? 1.1 : 0.4))
  for (const b of BUILDINGS) {
    if (b.special) { const c = consolePos(b); out.push(boxAt(c.x, c.z, 1.6, 0.6)) }
  }
  const cs = buildingById('CS-B')!
  const t = csAiTerminal(cs)
  out.push(boxAt(t.x, t.z, 0.8, 0.8))
  return out
}

/** Circle vs AABB push-out. Mutates and returns pos. */
export function resolveCollisions(pos: { x: number; z: number }, r: number, boxes: AABB[], bound = CAMPUS_BOUND) {
  for (let iter = 0; iter < 2; iter++) {
    for (const bx of boxes) {
      const cx = Math.max(bx.minX, Math.min(pos.x, bx.maxX))
      const cz = Math.max(bx.minZ, Math.min(pos.z, bx.maxZ))
      const dx = pos.x - cx, dz = pos.z - cz
      const d2 = dx * dx + dz * dz
      if (d2 < r * r) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2)
          pos.x = cx + (dx / d) * r
          pos.z = cz + (dz / d) * r
        } else {
          const l = pos.x - bx.minX, rr = bx.maxX - pos.x, t = pos.z - bx.minZ, bt = bx.maxZ - pos.z
          const m = Math.min(l, rr, t, bt)
          if (m === l) pos.x = bx.minX - r
          else if (m === rr) pos.x = bx.maxX + r
          else if (m === t) pos.z = bx.minZ - r
          else pos.z = bx.maxZ + r
        }
      }
    }
  }
  pos.x = Math.max(-bound, Math.min(bound, pos.x))
  pos.z = Math.max(-bound, Math.min(bound, pos.z))
  return pos
}

export interface Anchor { equipment: EquipmentType; x: number; z: number; slot: number; buildingId: string }

/** Group equipment by building (via department) and assign interior slots deterministically. */
export function buildAnchors(equipment: EquipmentType[]): Anchor[] {
  const out: Anchor[] = []
  for (const b of BUILDINGS) {
    if (b.special) continue
    const items = equipment
      .filter((e) => b.departmentIds.includes(e.department_id))
      .sort((a, c) => a.laboratory_id.localeCompare(c.laboratory_id) || a.name.localeCompare(c.name))
      .slice(0, MAX_ANCHORS)
    items.forEach((e, i) => {
      const p = slotWorld(b, i)
      out.push({ equipment: e, x: p.x, z: p.z, slot: i, buildingId: b.id })
    })
  }
  return out
}

export function locationFor(x: number, z: number): { label: string; inside: string | null } {
  for (const b of BUILDINGS) if (isInside(b, x, z)) return { label: `Inside ${b.label} (${b.short})`, inside: b.id }
  let best: BuildingDef | null = null
  let bd = 16
  for (const b of BUILDINGS) {
    const d = Math.hypot(b.x - x, b.z - z)
    if (d < bd) { bd = d; best = b }
  }
  if (best) return { label: `Outside ${best.label}`, inside: null }
  if (Math.hypot(x, z) < 13) return { label: 'Central Plaza', inside: null }
  return { label: 'Campus grounds', inside: null }
}
