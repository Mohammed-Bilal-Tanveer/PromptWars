import { api } from './apiClient'
import type {
  Availability, EquipmentDetail, EquipmentQuery, EquipmentRecommendation, EquipmentUnit, MaintenanceWindow, Paginated,
  EquipmentType, UnitStatus,
} from '@/types/api'

export const equipmentService = {
  list: (q: EquipmentQuery) => api.get<Paginated<EquipmentType>>('/equipment', q),
  categories: () => api.get<string[]>('/equipment/categories'),
  recommendations: (capabilities: string[], limit = 6) =>
    api.get<EquipmentRecommendation[]>('/equipment/recommendations', { capabilities, limit }),
  detail: (id: string) => api.get<EquipmentDetail>(`/equipment/${id}`),
  units: (id: string) => api.get<EquipmentUnit[]>(`/equipment/${id}/units`),
  availability: (id: string, p: { date: string; start?: string; end?: string }) =>
    api.get<Availability>(`/equipment/${id}/availability`, p),
  setUnitStatus: (unitId: string, status: UnitStatus, reason?: string) =>
    api.post<EquipmentUnit>(`/equipment/units/${unitId}/status`, { status, reason }),
  maintenance: () => api.get<MaintenanceWindow[]>('/maintenance'),
  addMaintenance: (b: { equipment_unit_id: string; start_at: string; end_at: string; reason: string }) =>
    api.post<MaintenanceWindow>('/maintenance', b),
  endMaintenance: (id: string) => api.post<MaintenanceWindow>(`/maintenance/${id}/end`),
}
