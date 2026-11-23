import { api } from './apiClient'
import type { ApprovalDecision, BookingRequest, BookingRequestQuery, Paginated } from '@/types/api'

export const approvalService = {
  queue: (q: BookingRequestQuery = {}) => api.get<Paginated<BookingRequest>>('/approvals/queue', q as any),
  approve: (id: string, b: { note?: string; reviewer_name?: string } = {}) =>
    api.post<ApprovalDecision>(`/approvals/${id}/approve`, b),
  reject: (id: string, b: { reason: string; note?: string }) => api.post<BookingRequest>(`/approvals/${id}/reject`, b),
  proposeAlternative: (
    id: string,
    b: { start_at: string; end_at: string; equipment_unit_id?: string; equipment_type_id?: string; note?: string },
  ) => api.post<BookingRequest>(`/approvals/${id}/alternative`, b),
}
