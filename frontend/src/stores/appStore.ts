import { create } from 'zustand'
import type { AnalysisResult } from '@/types/api'

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  title: string
  message?: string
}

export interface BookingDraft {
  equipmentId: string
  projectId?: string
  projectTitle?: string
  start?: string // naive campus-local ISO
  end?: string
  purpose?: string
  estimatedHours?: number
}

interface AppState {
  toasts: Toast[]
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void

  /** Equipment ids highlighted after an AI analysis (consumed by 3D scene + lists). */
  highlightedEquipmentIds: string[]
  setHighlightedEquipmentIds: (ids: string[]) => void

  /** Last project analysis so Project Lab results survive navigation and 3D can highlight matches. */
  lastAnalysis: AnalysisResult | null
  lastAnalysisInput: { title: string; description: string } | null
  setLastAnalysis: (a: AnalysisResult | null, input?: { title: string; description: string } | null) => void

  /** Pre-fill for the booking form (from AI match / assistant action). */
  bookingDraft: BookingDraft | null
  setBookingDraft: (d: BookingDraft | null) => void

  /** Remember last requester so forms are pre-filled. */
  requester: { name: string; departmentId: string }
  setRequester: (r: { name: string; departmentId: string }) => void

  guidedDemoOpen: boolean
  setGuidedDemoOpen: (v: boolean) => void
  guidedDone: string[]
  markGuided: (id: string) => void
}

let toastId = 1

export const useAppStore = create<AppState>((set) => ({
  toasts: [],
  pushToast: (t) => {
    const id = toastId++
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-4) }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.kind === 'error' ? 7000 : 4500)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

  highlightedEquipmentIds: [],
  setHighlightedEquipmentIds: (ids) => set({ highlightedEquipmentIds: ids }),

  lastAnalysis: null,
  lastAnalysisInput: null,
  setLastAnalysis: (a, input = null) => set({ lastAnalysis: a, lastAnalysisInput: input }),

  bookingDraft: null,
  setBookingDraft: (d) => set({ bookingDraft: d }),

  requester: { name: 'Demo Student', departmentId: 'dept-cs' },
  setRequester: (r) => set({ requester: r }),

  guidedDemoOpen: false,
  setGuidedDemoOpen: (v) => set({ guidedDemoOpen: v }),
  guidedDone: [],
  markGuided: (id) => set((s) => (s.guidedDone.includes(id) ? s : { guidedDone: [...s.guidedDone, id] })),
}))

export const toast = {
  success: (title: string, message?: string) => useAppStore.getState().pushToast({ kind: 'success', title, message }),
  error: (title: string, message?: string) => useAppStore.getState().pushToast({ kind: 'error', title, message }),
  info: (title: string, message?: string) => useAppStore.getState().pushToast({ kind: 'info', title, message }),
}
