import { api } from './apiClient'
import type { Department, DepartmentDetail, Laboratory, LaboratoryDetail, PublicConfig } from '@/types/api'

export const campusService = {
  config: () => api.get<PublicConfig>('/config/public'),
  departments: () => api.get<Department[]>('/departments'),
  department: (id: string) => api.get<DepartmentDetail>(`/departments/${id}`),
  laboratories: (p?: { department_id?: string; q?: string }) => api.get<Laboratory[]>('/laboratories', p),
  laboratory: (id: string) => api.get<LaboratoryDetail>(`/laboratories/${id}`),
}
