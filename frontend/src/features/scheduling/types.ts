import type { SchedulingResponse, SchedulingResult } from '@/types/api'

export type SolverStatus = 'optimal' | 'feasible' | 'infeasible' | 'not_run'

export interface LockedBlock { start_at: string; end_at: string; kind: 'booking' | 'maintenance'; label: string }
export interface RecommendedBlock { request_id: string | null; start_at: string; end_at: string; project_title: string | null }
export interface UnitTimeline {
  unit_id: string
  unit_name: string
  equipment_type_id: string
  locked: LockedBlock[]
  recommended: RecommendedBlock[]
}
export interface SolverSummary {
  requests_considered: number
  feasible_assignments: number
  unresolved: number
  units_considered: number
  fixed_blocks: number
  solve_time_ms: number
  horizon_start: string
  horizon_end: string
  horizon_days: number
  grid_minutes: number
  solver_status: SolverStatus
}
export type DecisionResult = SchedulingResult & {
  project_title?: string | null
  deadline?: string | null
  requested_start_at?: string | null
  requested_end_at?: string | null
  eligible_units?: number
  hard_constraints_checked?: string[]
  shift_minutes?: number | null
}
/** SchedulingResponse is extended additively by the backend; every new field is optional. */
export type DecisionResponse = Omit<SchedulingResponse, 'results'> & {
  results: DecisionResult[]
  summary?: SolverSummary | null
  timeline?: UnitTimeline[]
}
