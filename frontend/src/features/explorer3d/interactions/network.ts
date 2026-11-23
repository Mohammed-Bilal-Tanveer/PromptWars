import type { AnalysisResult, EquipmentType } from '@/types/api'

export interface NetLink { a: string; b: string; kind: 'project' | 'capability'; weight: number; detail: string }
export interface MatchedItem { equipmentId: string; name: string; departmentId: string; requirement: string }

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** Equipment the analysis matched (best candidate per requirement); derived only from the real analysis. */
export function matchedItems(analysis: AnalysisResult | null): MatchedItem[] {
  if (!analysis) return []
  const out: MatchedItem[] = []
  for (const m of analysis.matches) {
    if (m.best) out.push({ equipmentId: m.best.equipment_type_id, name: m.best.name, departmentId: m.best.department_id, requirement: m.requirement_name })
  }
  return out
}

/**
 * Resource-sharing links, from real data only:
 *  - 'project': the analysis matched equipment from both departments (one project draws on both)
 *  - 'capability': both departments own equipment sharing >= 2 capability tags
 * No analysis means no links.
 */
export function buildLinks(analysis: AnalysisResult | null, equipment: EquipmentType[]): NetLink[] {
  const links = new Map<string, NetLink>()
  if (!analysis) return []
  const items = matchedItems(analysis)
  const depts = Array.from(new Set(items.map((i) => i.departmentId)))
  for (let i = 0; i < depts.length; i++) {
    for (let j = i + 1; j < depts.length; j++) {
      const a = depts[i], b = depts[j]
      const w = items.filter((x) => x.departmentId === a || x.departmentId === b).length
      links.set(`${pairKey(a, b)}:p`, { a, b, kind: 'project', weight: w, detail: 'Your project matched equipment in both departments' })
    }
  }
  const caps = new Map<string, Set<string>>()
  for (const e of equipment) {
    const s = caps.get(e.department_id) ?? new Set<string>()
    e.capabilities.forEach((c) => s.add(c))
    caps.set(e.department_id, s)
  }
  const ids = Array.from(caps.keys())
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const shared = Array.from(caps.get(ids[i])!).filter((c) => caps.get(ids[j])!.has(c))
      if (shared.length >= 2) {
        links.set(`${pairKey(ids[i], ids[j])}:c`, { a: ids[i], b: ids[j], kind: 'capability', weight: shared.length, detail: `Shared capabilities: ${shared.slice(0, 4).map((c) => c.replace(/_/g, ' ')).join(', ')}` })
      }
    }
  }
  return Array.from(links.values())
}
