import { api } from './apiClient'
import type { AnalyticsOverview, AnalyticsTrends, AnalyticsUtilisation, NotificationList, AppNotification } from '@/types/api'

export const analyticsService = {
  overview: () => api.get<AnalyticsOverview>('/analytics/overview'),
  utilisation: () => api.get<AnalyticsUtilisation>('/analytics/utilisation'),
  trends: () => api.get<AnalyticsTrends>('/analytics/trends'),
  notifications: (p: { unread_only?: boolean; limit?: number } = {}) => api.get<NotificationList>('/notifications', p),
  markRead: (id: string) => api.post<AppNotification>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ unread_count: number }>('/notifications/read-all'),
}
