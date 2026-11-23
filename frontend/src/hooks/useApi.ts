// Shared TanStack Query hooks used by BOTH Professional Mode and 3D Campus Mode.
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import * as S from '@/services'
import type {
  BookingRequestCreate, BookingRequestQuery, EquipmentQuery, ProjectAnalyseRequest, ProjectCreate,
  SchedulingRequestBody, UnitStatus, AssistantRequest,
} from '@/types/api'

export const qk = {
  config: ['config'] as const,
  departments: ['departments'] as const,
  department: (id: string) => ['department', id] as const,
  labs: (p?: object) => ['labs', p ?? {}] as const,
  lab: (id: string) => ['lab', id] as const,
  equipment: (q: object) => ['equipment', 'list', q] as const,
  categories: ['equipment', 'categories'] as const,
  equipmentDetail: (id: string) => ['equipment', 'detail', id] as const,
  availability: (id: string, date: string, s?: string, e?: string) => ['availability', id, date, s, e] as const,
  requests: (q: object) => ['requests', q] as const,
  request: (id: string) => ['request', id] as const,
  bookings: (q: object) => ['bookings', q] as const,
  queue: (q: object) => ['approvals', 'queue', q] as const,
  conflicts: ['scheduling', 'conflicts'] as const,
  overview: ['analytics', 'overview'] as const,
  utilisation: ['analytics', 'utilisation'] as const,
  trends: ['analytics', 'trends'] as const,
  notifications: ['notifications'] as const,
  maintenance: ['maintenance'] as const,
  projects: ['projects'] as const,
}

export const usePublicConfig = () =>
  useQuery({ queryKey: qk.config, queryFn: S.campusService.config, staleTime: 5 * 60_000, retry: 2 })
export const useDepartments = () =>
  useQuery({ queryKey: qk.departments, queryFn: S.campusService.departments, staleTime: 30_000 })
export const useDepartment = (id?: string) =>
  useQuery({ queryKey: qk.department(id ?? ''), queryFn: () => S.campusService.department(id!), enabled: !!id })
export const useLaboratories = (p?: { department_id?: string; q?: string }) =>
  useQuery({ queryKey: qk.labs(p), queryFn: () => S.campusService.laboratories(p), staleTime: 30_000 })
export const useLaboratory = (id?: string) =>
  useQuery({ queryKey: qk.lab(id ?? ''), queryFn: () => S.campusService.laboratory(id!), enabled: !!id })

export const useEquipmentList = (q: EquipmentQuery) =>
  useQuery({ queryKey: qk.equipment(q), queryFn: () => S.equipmentService.list(q), placeholderData: keepPreviousData })
export const useEquipmentCategories = () =>
  useQuery({ queryKey: qk.categories, queryFn: S.equipmentService.categories, staleTime: 5 * 60_000 })
export const useEquipmentDetail = (id?: string) =>
  useQuery({ queryKey: qk.equipmentDetail(id ?? ''), queryFn: () => S.equipmentService.detail(id!), enabled: !!id })
export const useAvailability = (id: string | undefined, date: string | undefined, start?: string, end?: string) =>
  useQuery({
    queryKey: qk.availability(id ?? '', date ?? '', start, end),
    queryFn: () => S.equipmentService.availability(id!, { date: date!, start, end }),
    enabled: !!id && !!date,
  })

export const useBookingRequests = (q: BookingRequestQuery = {}) =>
  useQuery({ queryKey: qk.requests(q), queryFn: () => S.bookingService.listRequests(q), placeholderData: keepPreviousData })
export const useBookingRequest = (id?: string) =>
  useQuery({ queryKey: qk.request(id ?? ''), queryFn: () => S.bookingService.getRequest(id!), enabled: !!id })
export const useBookings = (q: Parameters<typeof S.bookingService.listBookings>[0] = {}) =>
  useQuery({ queryKey: qk.bookings(q), queryFn: () => S.bookingService.listBookings(q), placeholderData: keepPreviousData })
export const useApprovalQueue = (q: BookingRequestQuery = {}) =>
  useQuery({ queryKey: qk.queue(q), queryFn: () => S.approvalService.queue(q), placeholderData: keepPreviousData })
export const useConflicts = () => useQuery({ queryKey: qk.conflicts, queryFn: S.schedulingService.conflicts })
export const useAnalyticsOverview = () => useQuery({ queryKey: qk.overview, queryFn: S.analyticsService.overview })
export const useAnalyticsUtilisation = () => useQuery({ queryKey: qk.utilisation, queryFn: S.analyticsService.utilisation })
export const useAnalyticsTrends = () => useQuery({ queryKey: qk.trends, queryFn: S.analyticsService.trends })
export const useNotifications = () =>
  useQuery({ queryKey: qk.notifications, queryFn: () => S.analyticsService.notifications({ limit: 30 }), refetchInterval: 20_000 })
export const useMaintenance = () => useQuery({ queryKey: qk.maintenance, queryFn: S.equipmentService.maintenance })
export const useProjects = () => useQuery({ queryKey: qk.projects, queryFn: S.projectService.list })

/** After ANY mutation that changes stored state, refetch everything data-bearing so 2D + 3D stay in sync. */
export function useInvalidateAll() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}

export const useAnalyseProject = () => useMutation({ mutationFn: (b: ProjectAnalyseRequest) => S.projectService.analyse(b) })
export const useCreateProject = () => {
  const inv = useInvalidateAll()
  return useMutation({ mutationFn: (b: ProjectCreate) => S.projectService.create(b), onSuccess: inv })
}
export const useAssistant = () => useMutation({ mutationFn: (b: AssistantRequest) => S.projectService.assistant(b) })
export const useCreateBookingRequest = () => {
  const inv = useInvalidateAll()
  return useMutation({ mutationFn: (b: BookingRequestCreate) => S.bookingService.createRequest(b), onSuccess: inv })
}
export const useCancelRequest = () => {
  const inv = useInvalidateAll()
  return useMutation({ mutationFn: (id: string) => S.bookingService.cancelRequest(id), onSuccess: inv })
}
export const useAcceptAlternative = () => {
  const inv = useInvalidateAll()
  return useMutation({ mutationFn: (id: string) => S.bookingService.acceptAlternative(id), onSuccess: inv, onError: inv })
}
export const useCancelBooking = () => {
  const inv = useInvalidateAll()
  return useMutation({ mutationFn: (id: string) => S.bookingService.cancelBooking(id), onSuccess: inv })
}
export const useApprove = () => {
  const inv = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => S.approvalService.approve(id, { note }),
    onSuccess: inv,
    onError: inv,
  })
}
export const useReject = () => {
  const inv = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, reason, note }: { id: string; reason: string; note?: string }) =>
      S.approvalService.reject(id, { reason, note }),
    onSuccess: inv,
  })
}
export const useProposeAlternative = () => {
  const inv = useInvalidateAll()
  return useMutation({
    mutationFn: (a: {
      id: string
      start_at: string
      end_at: string
      equipment_unit_id?: string
      equipment_type_id?: string
      note?: string
    }) => S.approvalService.proposeAlternative(a.id, a),
    onSuccess: inv,
  })
}
export const useRecommend = () => useMutation({ mutationFn: (b: SchedulingRequestBody) => S.schedulingService.recommend(b) })
export const useSetUnitStatus = () => {
  const inv = useInvalidateAll()
  return useMutation({
    mutationFn: (a: { unitId: string; status: UnitStatus; reason?: string }) =>
      S.equipmentService.setUnitStatus(a.unitId, a.status, a.reason),
    onSuccess: inv,
  })
}
export const useAddMaintenance = () => {
  const inv = useInvalidateAll()
  return useMutation({ mutationFn: S.equipmentService.addMaintenance, onSuccess: inv })
}
export const useEndMaintenance = () => {
  const inv = useInvalidateAll()
  return useMutation({ mutationFn: (id: string) => S.equipmentService.endMaintenance(id), onSuccess: inv })
}
export const useMarkNotificationRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => S.analyticsService.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  })
}
export const useMarkAllRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: S.analyticsService.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  })
}
