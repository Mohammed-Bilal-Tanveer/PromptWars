// Mirrors docs/API_CONTRACT.md. Do not diverge without updating the contract.

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> }
}

export type UnitStatus = 'operational' | 'maintenance' | 'unavailable'
export type EquipmentStatus = 'available' | 'occupied' | 'maintenance'
export type Priority = 'required' | 'recommended' | 'optional'
export type MatchStatus = 'exact' | 'partial' | 'unavailable' | 'unmatched'
export type BookingRequestStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'alternative_proposed'
  | 'waitlisted'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'expired'
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed'
export type NotificationType =
  | 'request_submitted'
  | 'request_approved'
  | 'request_rejected'
  | 'alternative_proposed'
  | 'waitlist_joined'
  | 'booking_confirmed'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'maintenance'

export interface ScenePosition {
  x: number
  y: number
  z: number
}

export interface PublicConfig {
  app_name: string
  version: string
  demo_mode: boolean
  ai_configured: boolean
  campus_timezone: string
  data_label: string
}

export interface Department {
  id: string
  name: string
  slug: string
  description: string
  building_code: string
  scene_position: ScenePosition
  lab_count: number
  equipment_type_count: number
  units_total: number
  units_available: number
  utilisation_pct: number
}
export interface DepartmentDetail extends Department {
  laboratories: Laboratory[]
}

export interface Laboratory {
  id: string
  department_id: string
  department_name: string
  name: string
  code: string
  description: string
  building: string
  floor: string
  room_number: string
  opening_hours: { start: string; end: string }
  operating_days: number[]
  max_occupancy: number | null
  capabilities: string[]
  access_notes: string
  safety_notes: string
  scene_position: ScenePosition
  status: 'open' | 'closed'
  equipment_count: number
  units_total: number
  units_available: number
}
export interface LaboratoryDetail extends Laboratory {
  equipment: EquipmentType[]
}

export interface EquipmentType {
  id: string
  name: string
  category: string
  description: string
  department_id: string
  department_name: string
  laboratory_id: string
  laboratory_name: string
  manufacturer: string
  model: string
  specifications: Record<string, string | number>
  capabilities: string[]
  min_booking_minutes: number
  max_booking_minutes: number
  setup_minutes: number
  cleanup_minutes: number
  estimated_setup_minutes: number
  requires_supervision: boolean
  safety_notes: string
  access_notes: string
  image_url: string | null
  scene_object_id: string | null
  quantity_total: number
  quantity_available: number
  status: EquipmentStatus
  maintenance_state: 'none' | 'partial' | 'full'
  utilisation_pct: number
  next_free_at: string | null
}
export interface EquipmentRecommendation extends EquipmentType {
  score: number
  evidence: string[]
}

export interface EquipmentUnit {
  id: string
  equipment_type_id: string
  inventory_code: string
  unit_name: string
  status: UnitStatus
  condition_notes: string
  scene_object_id: string | null
  is_free_now: boolean
  current_booking: { booking_id: string; start_at: string; end_at: string; project_title: string } | null
  next_booking_at: string | null
}

export interface EquipmentDetail extends EquipmentType {
  units: EquipmentUnit[]
  alternatives: EquipmentType[]
  upcoming_bookings: Booking[]
}

export interface BusyInterval {
  start_at: string
  end_at: string
  kind: 'booking' | 'maintenance'
  label: string
}
export interface Availability {
  equipment_type_id: string
  date: string
  timezone: string
  lab_open_at: string | null
  lab_close_at: string | null
  units: {
    unit_id: string
    unit_name: string
    inventory_code: string
    status: UnitStatus
    busy: BusyInterval[]
  }[]
  free_slots: { start_at: string; end_at: string; free_units: number }[]
  requested: { start_at: string; end_at: string; free_units: number; is_available: boolean; reasons: string[] } | null
}

export interface EquipmentQuery {
  q?: string
  department_id?: string
  laboratory_id?: string
  category?: string
  status?: EquipmentStatus | ''
  available_from?: string
  available_to?: string
  sort?: 'relevance' | 'availability' | 'name' | 'utilisation'
  page?: number
  page_size?: number
}

// ---- Projects & AI ----
export interface ProjectAnalyseRequest {
  title: string
  description: string
  category?: string
  deadline?: string
  preferred_department_ids?: string[]
  preferred_window?: { start_at: string; end_at: string }
  estimated_total_hours?: number
  constraints?: string
}
export interface MatchCandidate {
  equipment_type_id: string
  name: string
  category: string
  laboratory_id: string
  laboratory_name: string
  department_id: string
  department_name: string
  building: string
  room_label: string
  score: number
  match_type: 'exact_name' | 'category' | 'capability' | 'alternative'
  evidence: string[]
  total_units: number
  available_units: number
  is_available: boolean
}
export interface RequirementMatch {
  requirement_name: string
  priority: Priority
  reason: string
  capability_tag: string | null
  match_status: MatchStatus
  best: MatchCandidate | null
  candidates: MatchCandidate[]
}
export interface AnalysisResult {
  analysis_source: 'openai' | 'demo_fallback'
  is_fallback: boolean
  fallback_reason: string | null
  project_summary: string
  capabilities: string[]
  equipment_requirements: { equipment_query: string; priority: Priority; reason: string; capability_tag: string | null }[]
  required_lab_capabilities: string[]
  suggested_departments: { id: string; name: string }[]
  estimated_total_hours: number
  assumptions: string[]
  safety_considerations: string[]
  clarifying_questions: string[]
  reasoning_summary: string
  matches: RequirementMatch[]
}
export interface ProjectCreate {
  title: string
  description: string
  category?: string
  requester_name: string
  requester_department_id?: string
  deadline?: string
  estimated_total_hours?: number
  analysis?: AnalysisResult | null
}
export interface Project {
  id: string
  title: string
  description: string
  category: string | null
  requester_name: string
  requester_department_id: string | null
  deadline: string | null
  estimated_total_hours: number | null
  analysis_source: 'openai' | 'demo_fallback' | 'manual'
  analysis: AnalysisResult | null
  created_at: string
  updated_at: string
}

export type AssistantActionType =
  | 'open_equipment'
  | 'open_booking_form'
  | 'open_scheduling'
  | 'open_approvals'
  | 'open_project_lab'
export interface AssistantReply {
  reply: string
  source: 'openai' | 'deterministic'
  references: { type: 'equipment' | 'booking_request' | 'laboratory' | 'project'; id: string; label: string }[]
  suggested_actions: { label: string; action: AssistantActionType; params: Record<string, string> }[]
}
export interface AssistantRequest {
  message: string
  context?: { equipment_type_id?: string; booking_request_id?: string; project_id?: string; laboratory_id?: string }
}

// ---- Bookings ----
export interface PriorityFactors {
  deadline_urgency: number
  waiting_time: number
  fairness: number
  preference_fit: number
}
export interface Alternative {
  equipment_type_id: string
  equipment_name: string
  unit_id: string
  unit_name: string
  start_at: string
  end_at: string
  reason: string
  is_alternative_equipment: boolean
  shift_minutes: number
}
export interface AuditItem {
  id: string
  action: string
  description: string
  actor: string
  note: string | null
  created_at: string
}
export interface Booking {
  id: string
  booking_request_id: string
  equipment_unit_id: string
  unit_name: string
  inventory_code: string
  equipment_type_id: string
  equipment_name: string
  laboratory_id: string
  laboratory_name: string
  project_title: string
  requester_name: string
  start_at: string
  end_at: string
  status: BookingStatus
  approved_at: string | null
  created_at: string
}
export interface BookingRequest {
  id: string
  project_id: string | null
  project_title: string
  requester_name: string
  requester_department_id: string
  requester_department_name: string
  equipment_type_id: string
  equipment_name: string
  laboratory_id: string
  laboratory_name: string
  department_id: string
  department_name: string
  requested_unit_id: string | null
  requested_unit_name: string | null
  requested_start_at: string
  requested_end_at: string
  estimated_hours: number | null
  purpose: string
  deadline: string | null
  status: BookingRequestStatus
  priority_score: number
  priority_factors: PriorityFactors
  queue_position?: number | null
  review_note: string | null
  requires_supervision: boolean
  proposed_alternative: {
    start_at: string
    end_at: string
    equipment_unit_id: string | null
    equipment_type_id: string | null
    equipment_name: string | null
    note: string | null
  } | null
  booking: Booking | null
  created_at: string
  updated_at: string
  timeline?: AuditItem[]
  analysis?: AnalysisResult | null
  availability_now?: { is_available: boolean; free_units: number; total_units: number }
  recommendation?: Alternative | null
}
export interface BookingRequestCreate {
  project_id?: string
  project_title: string
  requester_name: string
  requester_department_id: string
  equipment_type_id: string
  requested_unit_id?: string
  start_at: string
  end_at: string
  estimated_hours?: number
  purpose: string
  deadline?: string
  join_waitlist?: boolean
}
export interface BookingRequestQuery {
  status?: string
  department_id?: string
  equipment_type_id?: string
  date?: string
  q?: string
  page?: number
  page_size?: number
}

// ---- Scheduling / approvals ----
export interface Conflict {
  id: string
  type: 'pending_overlap' | 'maintenance_overlap' | 'booking_overlap'
  severity: 'high' | 'medium' | 'low'
  equipment_type_id: string
  equipment_name: string
  request_ids: string[]
  booking_ids: string[]
  start_at: string
  end_at: string
  message: string
}
export interface SchedulingRequestBody {
  request_ids?: string[]
  equipment_type_id?: string
  window_start?: string
  window_end?: string
  duration_minutes?: number
  deadline?: string
  horizon_days?: number
}
export interface SchedulingResult {
  request_id: string | null
  equipment_type_id: string
  equipment_name: string
  allocation_status: 'feasible' | 'partially_feasible' | 'infeasible'
  recommended: { unit_id: string; unit_name: string; start_at: string; end_at: string } | null
  priority_score: number
  priority_factors: PriorityFactors
  explanation: string[]
  conflicts: Conflict[]
  alternatives: Alternative[]
  assumptions: string[]
}
export interface SchedulingResponse {
  solver: 'cp-sat'
  solver_status: 'optimal' | 'feasible' | 'infeasible' | 'not_run'
  solve_time_ms: number
  weights: PriorityFactors
  horizon_days: number
  results: SchedulingResult[]
}
export interface ApprovalDecision {
  request: BookingRequest
  booking: Booking
}

// ---- Analytics / notifications / maintenance ----
export interface AnalyticsOverview {
  total_units: number
  units_available: number
  units_occupied: number
  units_maintenance: number
  active_bookings: number
  pending_requests: number
  waitlisted_count?: number
  approved_count: number
  rejected_count: number
  confirmed_count: number
  cancelled_count: number
  avg_review_minutes: number | null
  conflict_count: number
  alternatives_proposed: number
  alternatives_accepted: number
  alternative_acceptance_rate: number | null
  laboratory_count?: number
  department_count?: number
  is_demo_data: boolean
  data_label: string
}
export interface UtilRow {
  id: string
  name: string
  laboratory_name?: string
  booked_hours: number
  capacity_hours: number
  utilisation_pct: number
}
export interface AnalyticsUtilisation {
  window_days: number
  by_department: UtilRow[]
  by_laboratory: UtilRow[]
  by_equipment: UtilRow[]
  most_requested: { id: string; name: string; request_count: number }[]
  underutilised: UtilRow[]
}
export interface AnalyticsTrends {
  peak_hours: { hour: number; bookings: number }[]
  daily: { date: string; bookings: number; requests: number }[]
}
export interface AppNotification {
  id: string
  title: string
  message: string
  type: NotificationType
  related_entity_type: string | null
  related_entity_id: string | null
  is_read: boolean
  created_at: string
}
export interface NotificationList {
  items: AppNotification[]
  unread_count: number
}
export interface MaintenanceWindow {
  id: string
  equipment_unit_id: string
  unit_name: string
  inventory_code: string
  equipment_type_id: string
  equipment_name: string
  start_at: string
  end_at: string
  reason: string
  status: 'active' | 'ended'
}
