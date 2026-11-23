// Single source of truth for navigation targets (used by Professional layout, assistant actions, and 3D HUD).
export const ROUTES = {
  home: '/',
  overview: '/app',
  discover: '/app/discover',
  equipment: (id: string) => `/app/discover/${id}`,
  labs: '/app/labs',
  lab: (id: string) => `/app/labs/${id}`,
  department: (id: string) => `/app/departments/${id}`,
  projectLab: '/app/project-lab',
  calendar: '/app/calendar',
  requests: '/app/requests',
  scheduling: '/app/scheduling',
  approvals: '/app/approvals',
  analytics: '/app/analytics',
  assistant: '/app/assistant',
  campus3d: '/campus-3d',
} as const
