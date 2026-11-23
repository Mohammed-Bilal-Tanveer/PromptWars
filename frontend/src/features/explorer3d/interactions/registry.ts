export type InteractableType =
  | 'department' | 'laboratory' | 'equipment' | 'kiosk' | 'ai_terminal'
  | 'booking_terminal' | 'operations_desk' | 'analytics_centre' | 'scheduling_hub'

export interface Interactable {
  id: string
  type: InteractableType
  position: { x: number; z: number }
  radius: number
  label: string
  prompt: string
  recordId?: string
}

const registry = new Map<string, Interactable>()
const listeners = new Set<() => void>()

export function registerInteractable(o: Interactable): () => void {
  registry.set(o.id, o)
  listeners.forEach((l) => l())
  return () => {
    registry.delete(o.id)
    listeners.forEach((l) => l())
  }
}
export const getInteractables = (): Interactable[] => Array.from(registry.values())
export const clearInteractables = () => registry.clear()

/** Pure: nearest object whose radius contains the point (ties -> smallest distance). */
export function findNearest(pos: { x: number; z: number }, list: Interactable[]): Interactable | null {
  let best: Interactable | null = null
  let bestD = Infinity
  for (const o of list) {
    const d = Math.hypot(o.position.x - pos.x, o.position.z - pos.z)
    if (d <= o.radius && d < bestD) {
      best = o
      bestD = d
    }
  }
  return best
}
