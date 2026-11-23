import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/services/apiClient'
import { useAppStore } from '@/stores/appStore'
import { ConnectionManager } from './ConnectionManager'
import { useConnectionStore } from './connectionStore'
import { stopRecovery } from './healthMonitor'

const json = (status: number, body: unknown = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

function mount() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <ConnectionManager />
    </QueryClientProvider>,
  )
}

const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  useConnectionStore.setState({ state: 'checking', reason: null, since: null, attemptCount: 0, overlayDismissed: false, mutationFailed: false })
  useAppStore.setState({ toasts: [] })
})
afterEach(() => {
  stopRecovery()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('connection monitor', () => {
  it('shows the banner on a network error, and recovers with a toast', async () => {
    let healthy = false
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/health/ready')) return healthy ? json(200, { status: 'ready' }) : Promise.reject(new TypeError('fail'))
      return Promise.reject(new TypeError('fail'))
    })
    vi.stubGlobal('fetch', fetchMock)
    mount()
    await flush(0)
    await expect(api.get('/equipment')).rejects.toMatchObject({ status: 0 })
    await flush(10)
    expect(screen.getByText('Waking up LabLink', { selector: 'strong' })).toBeTruthy()

    healthy = true
    await flush(20_000)
    expect(screen.queryByText('Waking up LabLink', { selector: 'strong' })).toBeNull()
    expect(useConnectionStore.getState().state).toBe('connected')
    expect(useAppStore.getState().toasts.some((t) => t.title === 'LabLink is back online')).toBe(true)
  })

  it.each([400, 409, 429])('does not show the banner for HTTP %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (url.includes('/health/ready') ? json(200) : json(status, { error: { code: 'X', message: 'nope' } }))))
    mount()
    await flush(0)
    await expect(api.post('/bookings', {})).rejects.toMatchObject({ status })
    await flush(10)
    expect(screen.queryByText('Waking up LabLink', { selector: 'strong' })).toBeNull()
    expect(useConnectionStore.getState().state).toBe('connected')
  })

  it('treats 503 as a gateway failure but never replays a failed POST', async () => {
    let healthy = false
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/health/ready')) return healthy ? json(200) : json(503)
      return init?.method === 'POST' ? json(503) : json(200)
    })
    vi.stubGlobal('fetch', fetchMock)
    mount()
    await flush(0)
    await expect(api.post('/bookings', { a: 1 })).rejects.toMatchObject({ status: 503 })
    await flush(10)
    expect(useConnectionStore.getState().state).toBe('waking')
    healthy = true
    await flush(20_000)
    const posts = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    expect(posts).toHaveLength(1)
    const toast = useAppStore.getState().toasts.find((t) => t.title === 'LabLink is back online')
    expect(toast?.message).toContain('Please retry your action')
  })

  it('is single-flight: repeated failures never run concurrent health polls', async () => {
    let inFlight = 0
    let maxInFlight = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (!url.includes('/health/ready')) return Promise.reject(new TypeError('fail'))
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        return new Promise((resolve) =>
          setTimeout(() => {
            inFlight--
            resolve(new Response('{}', { status: 503 }))
          }, 500),
        )
      }),
    )
    mount()
    await flush(0)
    for (let i = 0; i < 5; i++) await api.get('/x').catch(() => {})
    await flush(15_000)
    expect(maxInFlight).toBe(1)
  })
})
