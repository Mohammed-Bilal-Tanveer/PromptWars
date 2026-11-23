import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProfessionalLayout } from '@/components/layout/ProfessionalLayout'
import { LoadingState } from '@/components/ui'
import { Landing } from '@/features/landing'
import { Overview } from '@/features/dashboard'
import { EquipmentCatalogue, EquipmentDetailPage } from '@/features/equipment'
import { CampusDirectory, DepartmentDetailPage, LabDetailPage } from '@/features/campus'
import { ProjectLab } from '@/features/projects'
import { BookingCalendar, RequestTracker } from '@/features/bookings'
import { SchedulingStudio } from '@/features/scheduling'
import { ApprovalDesk } from '@/features/approvals'
import { AnalyticsDashboard } from '@/features/analytics'
import { AssistantPanel } from '@/features/ai-assistant'

// 3D bundle (three.js etc.) is only fetched when the user opens /campus-3d.
const Explorer3D = lazy(() => import('@/features/explorer3d'))

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  {
    path: '/app',
    element: <ProfessionalLayout />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'discover', element: <EquipmentCatalogue /> },
      { path: 'discover/:id', element: <EquipmentDetailPage /> },
      { path: 'labs', element: <CampusDirectory /> },
      { path: 'labs/:id', element: <LabDetailPage /> },
      { path: 'departments/:id', element: <DepartmentDetailPage /> },
      { path: 'project-lab', element: <ProjectLab /> },
      { path: 'calendar', element: <BookingCalendar /> },
      { path: 'requests', element: <RequestTracker /> },
      { path: 'scheduling', element: <SchedulingStudio /> },
      { path: 'approvals', element: <ApprovalDesk /> },
      { path: 'analytics', element: <AnalyticsDashboard /> },
      { path: 'assistant', element: <AssistantPanel /> },
      { path: '*', element: <Navigate to="/app" replace /> },
    ],
  },
  {
    path: '/campus-3d',
    element: (
      <Suspense fallback={<div className="grid h-full place-items-center bg-bg"><LoadingState label="Loading 3D campus…" /></div>}>
        <Explorer3D />
      </Suspense>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
