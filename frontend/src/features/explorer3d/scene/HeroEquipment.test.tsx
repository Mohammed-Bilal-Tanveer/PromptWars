import { describe, expect, it, vi } from 'vitest'
import { HERO_MODELS, ModelBoundary } from './HeroEquipment'

describe('HeroEquipment', () => {
  it('maps the three hero ids', () => {
    expect(Object.keys(HERO_MODELS).sort()).toEqual(['eq-3d-printer', 'eq-arduino', 'eq-gpu-workstation'])
  })
  it('renders the fallback when a model throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const state = ModelBoundary.getDerivedStateFromError()
    expect(state.failed).toBe(true)
    const b = new ModelBoundary({ fallback: 'fb', children: 'child' })
    b.state = state
    expect(b.render()).toBe('fb')
  })
})
