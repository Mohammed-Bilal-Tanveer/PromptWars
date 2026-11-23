import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/stores/appStore'
import { Button, Spinner } from '@/components/ui'
import { useConnectionStore } from './connectionStore'
import { connectionConfig, probeReady, retryNow, startRecovery, stopRecovery } from './healthMonitor'

const TICK_MS = 1000

function useElapsedSeconds(since: number | null, active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [active, since])
  return since ? Math.max(0, Math.floor((now - since) / TICK_MS)) : 0
}

function AlertGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </svg>
  )
}

/**
 * Mounted once in Providers. Runs the startup readiness probe, drives the single-flight
 * recovery loop, refetches safe (GET) queries on recovery and renders a non-blocking
 * banner. Pages are never unmounted, so form state is preserved. Mutations are never replayed.
 */
export function ConnectionManager() {
  const qc = useQueryClient()
  const state = useConnectionStore((s) => s.state)
  const since = useConnectionStore((s) => s.since)
  const dismissed = useConnectionStore((s) => s.overlayDismissed)
  const attempts = useConnectionStore((s) => s.attemptCount)
  const wasDown = useRef(false)

  // Startup probe: one lightweight request; banner only if it is slow or fails.
  useEffect(() => {
    let done = false
    const slow = setTimeout(() => {
      if (!done) useConnectionStore.getState().reportFailure('startup_slow')
    }, connectionConfig.thresholdMs)
    void probeReady(connectionConfig.deadlineMs).then((ok) => {
      done = true
      clearTimeout(slow)
      if (ok) useConnectionStore.getState().markConnected()
      else useConnectionStore.getState().reportFailure('health_check')
    })
    return () => {
      done = true
      clearTimeout(slow)
      stopRecovery()
    }
  }, [])

  useEffect(() => {
    if (state === 'waking') {
      wasDown.current = true
      void startRecovery()
    } else if (state === 'unavailable') {
      wasDown.current = true
    } else if (state === 'connected' && wasDown.current) {
      wasDown.current = false
      const { mutationFailed } = useConnectionStore.getState()
      useConnectionStore.setState({ mutationFailed: false })
      void qc.invalidateQueries() // refetches GET queries only
      useAppStore.getState().pushToast({
        kind: 'success',
        title: 'LabLink is back online',
        message: mutationFailed ? 'The backend is connected again. Please retry your action.' : undefined,
      })
    }
  }, [state, qc])

  const elapsed = useElapsedSeconds(since, state === 'waking')
  const down = state === 'waking' || state === 'unavailable'
  const unavailable = state === 'unavailable'
  const title = unavailable ? 'LabLink is still unavailable' : 'Waking up LabLink'
  const body = unavailable
    ? 'The service has not responded yet. It may be starting, restarting or having an issue. Your inputs are kept; try again, or check the Render service status and deploy logs.'
    : connectionConfig.freeTier
      ? 'The demo server is waking up — this can take up to a minute on the free hosting tier. Please keep this tab open; your inputs are kept and we will reconnect automatically.'
      : 'The LabLink backend is taking longer than usual to respond. We are checking the connection and will reconnect automatically when it is ready.'

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {down ? title : ''}
      </div>
      {down && !dismissed && (
        <section
          aria-label="Backend connection status"
          className="fixed inset-x-3 bottom-24 z-[75] mx-auto max-w-lg rounded-2xl border border-line bg-surface p-4 text-fg shadow-pop lg:bottom-6 [body[data-lablink-3d]_&]:bottom-auto [body[data-lablink-3d]_&]:top-3"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-brand" aria-hidden="true">
              {unavailable ? <AlertGlyph /> : <Spinner size={20} />}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <strong className="block text-base font-semibold">{title}</strong>
              <p className="mt-1 text-muted">{body}</p>
              {!unavailable && (
                <p className="mt-1 text-xs text-subtle">
                  Waiting for the API to become ready… {elapsed}s{attempts > 0 ? ` · ${attempts} check${attempts === 1 ? '' : 's'}` : ''}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={retryNow}>{unavailable ? 'Try again' : 'Retry now'}</Button>
                <Button size="sm" variant="ghost" onClick={() => useConnectionStore.getState().dismissOverlay()}>
                  Hide
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}
      {down && dismissed && (
        <button
          type="button"
          onClick={() => useConnectionStore.setState({ overlayDismissed: false })}
          className="fixed bottom-24 right-3 z-[75] rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted shadow-pop max-sm:min-h-11 lg:bottom-6 [body[data-lablink-3d]_&]:bottom-2 [body[data-lablink-3d]_&]:left-1/2 [body[data-lablink-3d]_&]:right-auto [body[data-lablink-3d]_&]:-translate-x-1/2"
        >
          {unavailable ? 'Backend unavailable' : 'Reconnecting…'}
        </button>
      )}
    </>
  )
}
