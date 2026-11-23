import { describe, expect, it } from 'vitest'
import type { EquipmentType } from '@/types/api'
import { advanceFind, resolveFindTarget, entranceOf, benchStand } from '../interactions/findInCampus'
import { buildAnchors, buildingById } from '../environments/layout'
import { buildLinks } from '../interactions/network'

const eq = (id: string, dept: string, name = id): EquipmentType => ({
  id, name, category: 'x', description: '', department_id: dept, department_name: '', laboratory_id: 'lab-1', laboratory_name: '',
  manufacturer: '', model: '', specifications: {}, capabilities: ['a', 'b'], min_booking_minutes: 30, max_booking_minutes: 120,
  setup_minutes: 0, cleanup_minutes: 0, estimated_setup_minutes: 0, requires_supervision: false, safety_notes: '', access_notes: '',
  image_url: null, scene_object_id: null, quantity_total: 1, quantity_available: 1, status: 'available', maintenance_state: 'none',
  utilisation_pct: 0, next_free_at: null,
} as EquipmentType)

describe('find in 3D campus', () => {
  const list = [eq('e1', 'dept-cs', 'GPU Workstation'), eq('e2', 'dept-ece', 'Scope')]

  it('targets the building entrance first, then the equipment bench', () => {
    const plan = resolveFindTarget({ equipmentId: 'e1', label: 'GPU' }, list, null)
    const b = buildingById('CS-B')!
    expect(plan.state.stage).toBe('entrance')
    expect(plan.waypoint).toMatchObject({ x: entranceOf(b).x, z: entranceOf(b).z })
    const a = buildAnchors(list).find((x) => x.equipment.id === 'e1')!
    expect(plan.state.bench).toEqual(benchStand(b, a))
    // enters the building -> bench waypoint
    const next = advanceFind(plan.state, 'CS-B', { x: b.x, z: b.z })
    expect(next && next !== 'arrived' && next.state.stage).toBe('bench')
    if (next && next !== 'arrived') {
      expect(next.waypoint).toMatchObject(plan.state.bench!)
      expect(advanceFind(next.state, 'CS-B', plan.state.bench!)).toBe('arrived')
    }
  })

  it('starts at the bench when already inside the building', () => {
    expect(resolveFindTarget({ equipmentId: 'e1', label: 'GPU' }, list, 'CS-B').state.stage).toBe('bench')
  })

  it('is unavailable (no waypoint, never another item) for unknown or unmapped equipment', () => {
    const missing = resolveFindTarget({ equipmentId: 'nope', label: 'Ghost' }, list)
    expect(missing.state.stage).toBe('unavailable')
    expect(missing.waypoint).toBeNull()
    const noBuilding = resolveFindTarget({ equipmentId: 'e3', label: 'X' }, [eq('e3', 'dept-unknown')])
    expect(noBuilding.state.stage).toBe('unavailable')
    expect(noBuilding.waypoint).toBeNull()
  })
})

describe('resource network', () => {
  it('has no links without an analysis', () => {
    expect(buildLinks(null, [eq('e1', 'dept-cs')])).toEqual([])
  })
})
