import { api } from './apiClient'
import type {
  AnalysisResult, AssistantReply, AssistantRequest, Project, ProjectAnalyseRequest, ProjectCreate,
} from '@/types/api'

export const projectService = {
  analyse: (b: ProjectAnalyseRequest) => api.post<AnalysisResult>('/projects/analyse', b),
  create: (b: ProjectCreate) => api.post<Project>('/projects', b),
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  assistant: (b: AssistantRequest) => api.post<AssistantReply>('/assistant/message', b),
}
