import type { ApiErrorBody } from '@/types/api'
import { isGatewayStatus, useConnectionStore } from '@/features/connection/connectionStore'

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000/api/v1'

export class ApiError extends Error {
  status: number
  code: string
  details: Record<string, any>
  constructor(status: number, code: string, message: string, details: Record<string, any> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type Params = Record<string, string | number | boolean | undefined | null | string[]>

export function buildQuery(params?: Params): string {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

async function request<T>(method: string, path: string, opts: { params?: Params; body?: unknown } = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}${buildQuery(opts.params)}`
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    // Transport failure: tell the global connection monitor. Writes are never replayed.
    useConnectionStore.getState().reportFailure('network', { mutation: method !== 'GET' })
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the LabLink API. It may be starting up — please retry in a moment.')
  }
  if (!res.ok) {
    if (isGatewayStatus(res.status)) {
      useConnectionStore.getState().reportFailure('gateway', { mutation: method !== 'GET' })
    }
    let body: Partial<ApiErrorBody> = {}
    try {
      body = await res.json()
    } catch {
      /* ignore */
    }
    throw new ApiError(
      res.status,
      body.error?.code ?? 'HTTP_ERROR',
      body.error?.message ?? `Request failed (${res.status})`,
      body.error?.details ?? {},
    )
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} }),
}
