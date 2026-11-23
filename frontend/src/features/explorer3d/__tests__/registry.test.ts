import { describe, expect, it } from 'vitest'
import { findNearest, type Interactable } from '../interactions/registry'
import { resolveCollisions, buildingById, wallBoxes, buildAnchors, locationFor } from '../environments/layout'

const mk = (id: string, x: number, z: number, radius = 3): Interactable => ({ id, type: 'kiosk', position: { x, z }, radius, label: id, prompt: `Press E to ${id}` })

describe('findNearest', () => {
  it('returns null when nothing is in radius', () => {
    expect(findNearest({ x: 50, z: 50 }, [mk('a', 0, 0)])).toBeNull()
  })
  it('returns the closest object inside its radius', () => {
    const r = findNearest({ x: 0, z: 0 }, [mk('far', 2.5, 0), mk('near', 1, 0), mk('out', 9, 0)])
    expect(r?.id).toBe('near')
  })
  it('respects per-object radius', () => {
    expect(findNearest({ x: 5, z: 0 }, [mk('small', 0, 0, 2), mk('big', 9, 0, 6)])?.id).toBe('big')
  })
})

describe('collision', () => {
  it('pushes the player out of a building wall and allows the door gap', () => {
    const cs = buildingById('CS-B')!
    const walls = wallBoxes(cs)
    const p = { x: cs.x - 6, z: cs.z + 6 } // on the front wall (not the door)
    resolveCollisions(p, 0.45, walls)
    expect(Math.abs(p.z - (cs.z + 6)) >= 0.45 - 1e-6 || p.x !== cs.x - 6).toBe(true)
    const door = { x: cs.x, z: cs.z + 6 }
    resolveCollisions(door, 0.45, walls)
    expect(door.x).toBeCloseTo(cs.x)
    expect(door.z).toBeCloseTo(cs.z + 6)
  })
  it('clamps to campus bounds', () => {
    const p = { x: 200, z: -200 }
    resolveCollisions(p, 0.4, [])
    expect(p.x).toBe(55)
    expect(p.z).toBe(-55)
  })
})

describe('layout', () => {
  it('maps equipment to the building of its department', () => {
    const eq = (id: string, dep: string) => ({ id, name: id, department_id: dep, laboratory_id: 'l' }) as any
    const a = buildAnchors([eq('e1', 'dept-cs'), eq('e2', 'dept-civil'), eq('e3', 'dept-mech')])
    expect(a.filter((x) => x.buildingId === 'CS-B')).toHaveLength(1)
    expect(a.filter((x) => x.buildingId === 'ME-B')).toHaveLength(2)
  })
  it('detects being inside a building', () => {
    expect(locationFor(-28, -22).inside).toBe('CS-B')
    expect(locationFor(0, 0).inside).toBeNull()
  })
})
