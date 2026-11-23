import { API_BASE_URL } from '@/services/apiClient'
import { useConnectionStore } from './connectionStore'

const num = (v: unknown, d: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : d
}
const env = import.meta.env as Record<string, string | undefined>

export const connectionConfig = {
  freeTier: env.VITE_RENDER_FREE_TIER === 'true',
  thresholdMs: num(env.VITE_BACKEND_WAKE_THRESHOLD_MS, 1800),
  deadlineMs: num(env.VITE_BACKEND_WAKE_TIMEOUT_MS, 120_000),
  pollMs: num(env.VITE_BACKEND_HEALTH_POLL_MS, 4000),
  probeTimeoutMs: 10_000,
}

/** One readiness probe (GET only). Resolves true when the API reports ready. */
let probing: Promise<boolean> | null = null
export function probeReady(timeoutMs = connectionConfig.probeTimeoutMs): Promise<boolean> {
  // Single-flight: concurrent callers share one in-flight request.
  if (!probing) probing = doProbe(timeoutMs).finally(() => { probing = null })
  return probing
}

async function doProbe(timeoutMs: number): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE_URL}/health/ready`, { cache: 'no-store', signal: ctrl.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

let loop: Promise<boolean> | null = null
let cancelled = false
let wake: (() => void) | null = null

/**
 * Single-flight recovery loop: however many requests fail, only one poller runs and
 * only one health request is in flight. Resolves true when recovered, false on deadline.
 */
export function startRecovery(): Promise<boolean> {
  if (loop) return loop
  cancelled = false
  const store = useConnectionStore
  loop = (async () => {
    const started = Date.now()
    let delay = connectionConfig.pollMs
    while (!cancelled) {
      store.getState().recordAttempt()
      if (await probeReady()) {
        store.getState().markConnected()
        return true
      }
      if (cancelled) return false
      if (Date.now() - started >= connectionConfig.deadlineMs) {
        store.getState().markUnavailable()
        return false
      }
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, delay)
        wake = () => {
          clearTimeout(t)
          resolve()
        }
      })
      wake = null
      delay = Math.min(Math.round(delay * 1.25), connectionConfig.pollMs * 3)
    }
    return false
  })().finally(() => {
    loop = null
  })
  return loop
}

/** "Retry now": skip the current wait; if the loop ended (unavailable), start a new one. */
export function retryNow() {
  const s = useConnectionStore.getState()
  if (s.state === 'unavailable') s.restart()
  if (wake) wake()
  else void startRecovery()
}

export function stopRecovery() {
  cancelled = true
  wake?.()
}

export const isRecoveryRunning = () => loop !== null
