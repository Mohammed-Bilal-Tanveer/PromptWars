import { create } from 'zustand'

export type ConnectionState = 'checking' | 'connected' | 'waking' | 'unavailable'
export type ConnectionReason = 'startup_slow' | 'network' | 'gateway' | 'health_check' | 'timeout'

interface ConnectionStore {
  state: ConnectionState
  reason: ConnectionReason | null
  since: number | null
  lastHealthyAt: number | null
  attemptCount: number
  overlayDismissed: boolean
  /** A write (POST/PUT/PATCH/DELETE) failed while the backend was down; it is never replayed. */
  mutationFailed: boolean
  reportFailure: (reason: ConnectionReason, opts?: { mutation?: boolean }) => void
  markConnected: () => void
  markUnavailable: () => void
  markChecking: () => void
  recordAttempt: () => void
  dismissOverlay: () => void
  /** User asked to try again: back to waking and the overlay is shown again. */
  restart: () => void
}

/** Not persisted on purpose: a stale "connected" must never survive a reload. */
export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  state: 'checking',
  reason: null,
  since: null,
  lastHealthyAt: null,
  attemptCount: 0,
  overlayDismissed: false,
  mutationFailed: false,
  reportFailure: (reason, opts) => {
    const s = get()
    const mutationFailed = s.mutationFailed || !!opts?.mutation
    if (s.state === 'waking' || s.state === 'unavailable') {
      if (mutationFailed !== s.mutationFailed) set({ mutationFailed })
      return
    }
    set({ state: 'waking', reason, since: Date.now(), attemptCount: 0, overlayDismissed: false, mutationFailed })
  },
  markConnected: () =>
    set({ state: 'connected', reason: null, since: null, lastHealthyAt: Date.now(), overlayDismissed: false }),
  markUnavailable: () => set({ state: 'unavailable', overlayDismissed: false }),
  markChecking: () => set({ state: 'checking' }),
  recordAttempt: () => set((s) => ({ attemptCount: s.attemptCount + 1 })),
  dismissOverlay: () => set({ overlayDismissed: true }),
  restart: () => set({ state: 'waking', since: Date.now(), attemptCount: 0, overlayDismissed: false }),
}))

/** Status codes that mean "gateway/proxy cannot reach the app" (never 4xx or plain 500). */
export const isGatewayStatus = (status: number) => status === 502 || status === 503 || status === 504
