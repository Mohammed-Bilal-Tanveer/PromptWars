import { api } from './apiClient'
import type { Conflict, SchedulingRequestBody, SchedulingResponse } from '@/types/api'

export const schedulingService = {
  recommend: (b: SchedulingRequestBody) => api.post<SchedulingResponse>('/scheduling/recommendations', b),
  conflicts: () => api.get<{ conflicts: Conflict[] }>('/scheduling/conflicts'),
}
