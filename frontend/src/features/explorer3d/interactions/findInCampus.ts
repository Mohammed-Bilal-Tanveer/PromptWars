import type { EquipmentType } from '@/types/api'
import { buildAnchors, buildingById, buildingForDept, doorOutside, type BuildingDef } from '../environments/layout'
import type { FindState, Waypoint } from '../stores/explorerStore'

export interface FindPlan {
  state: FindState
  /** First waypoint to show (entrance, or the bench when already inside). */
  waypoint: Waypoint | null
}

/** Where to stand in front of a bench (towards the door, so the collider is not in the way). */
export const benchStand = (b: BuildingDef, a: { x: number; z: number }): { x: number; z: number } => ({ x: a.x, z: a.z + b.facing * 1.7 })
export const entranceOf = (b: BuildingDef): { x: number; z: number } => doorOutside(b, 3)

/**
 * Resolve a Find-in-3D-Campus request against the REAL equipment list.
 * Never falls back to a different item: unknown id / no building / no anchor → 'unavailable'.
 */
export function resolveFindTarget(
  target: { equipmentId: string; label: string },
  equipment: EquipmentType[],
  insideBuilding: string | null = null,
): FindPlan {
  const base = { equipmentId: target.equipmentId, label: target.label }
  const eq = equipment.find((e) => e.id === target.equipmentId)
  const b = eq ? buildingForDept(eq.department_id) : undefined
  const anchor = eq && b ? buildAnchors(equipment).find((a) => a.equipment.id === eq.id) : undefined
  if (!eq || !b || !anchor) return { state: { ...base, stage: 'unavailable' }, waypoint: null }
  const name = eq.name
  const bench = benchStand(b, anchor)
  if (insideBuilding === b.id) {
    return { state: { ...base, label: name, stage: 'bench', buildingId: b.id, buildingLabel: b.label, bench }, waypoint: { ...bench, label: name } }
  }
  const o = entranceOf(b)
  return { state: { ...base, label: name, stage: 'entrance', buildingId: b.id, buildingLabel: b.label, bench }, waypoint: { x: o.x, z: o.z, label: `Entrance of ${b.label}` } }
}

/** Advance the guide given the player's position. Returns the next plan or 'arrived'. */
export function advanceFind(f: FindState, inside: string | null, pos: { x: number; z: number }): 'arrived' | FindPlan | null {
  if (f.stage === 'unavailable' || !f.bench) return null
  if (f.stage === 'entrance' && inside === f.buildingId) {
    return { state: { ...f, stage: 'bench' }, waypoint: { ...f.bench, label: f.label } }
  }
  if (f.stage === 'bench') {
    if (Math.hypot(pos.x - f.bench.x, pos.z - f.bench.z) < 1.8) return 'arrived'
    const b = f.buildingId ? buildingById(f.buildingId) : undefined
    if (inside !== f.buildingId && b) {
      // player left the building: guide them back to the entrance
      const o = entranceOf(b)
      return { state: { ...f, stage: 'entrance' }, waypoint: { x: o.x, z: o.z, label: `Entrance of ${b.label}` } }
    }
  }
  return null
}
