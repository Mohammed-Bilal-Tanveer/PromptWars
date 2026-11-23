import { api } from './apiClient'
import type {
  Booking, BookingRequest, BookingRequestCreate, BookingRequestQuery, Paginated, ApprovalDecision,
} from '@/types/api'

export const bookingService = {
  createRequest: (b: BookingRequestCreate) => api.post<BookingRequest>('/booking-requests', b),
  listRequests: (q: BookingRequestQuery = {}) => api.get<Paginated<BookingRequest>>('/booking-requests', q),
  getRequest: (id: string) => api.get<BookingRequest>(`/booking-requests/${id}`),
  cancelRequest: (id: string) => api.post<BookingRequest>(`/booking-requests/${id}/cancel`),
  acceptAlternative: (id: string) => api.post<ApprovalDecision>(`/booking-requests/${id}/accept-alternative`),
  listBookings: (
    q: {
      status?: string
      equipment_type_id?: string
      unit_id?: string
      laboratory_id?: string
      from?: string
      to?: string
      page?: number
      page_size?: number
    } = {},
  ) => api.get<Paginated<Booking>>('/bookings', q),
  getBooking: (id: string) => api.get<Booking>(`/bookings/${id}`),
  cancelBooking: (id: string) => api.post<Booking>(`/bookings/${id}/cancel`),
}
