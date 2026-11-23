import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, ConfirmDialog } from '@/components/ui'
import { usePublicConfig } from '@/hooks/useApi'
import { ApiError, api } from '@/services/apiClient'
import { toast } from '@/stores/appStore'

export function resetErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 403 || e.code === 'DEMO_RESET_DISABLED') return 'Demo reset is disabled on this server. Use the local reset script instead.'
    if (e.status === 429) return 'Too many reset attempts. Wait a minute and try again.'
    return e.message
  }
  return 'Could not reach the server. Check your connection and try again.'
}

/** Only rendered when the server explicitly enables demo reset. Restores the fictional sample scenario only. */
export function DemoResetButton() {
  const enabled = !!(usePublicConfig().data as any)?.demo_reset_enabled
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!enabled) return null

  const run = async () => {
    setBusy(true)
    try {
      const { token } = await api.post<{ token: string; expires_in_seconds: number }>('/demo/reset-token')
      await api.post('/demo/reset', { token, confirm: 'RESET DEMO SCENARIO' })
      toast.success('Demo scenario reset', 'Sample requests and bookings were restored.')
      setOpen(false)
      await qc.invalidateQueries()
    } catch (e) {
      toast.error('Reset failed', resetErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Reset demo scenario</Button>
      <ConfirmDialog
        open={open}
        title="Reset demo scenario?"
        message="This restores only the fictional sample scenario. Requests and bookings created during this demo are removed. Nothing else is touched. This cannot be undone."
        confirmLabel="Reset demo scenario"
        variant="danger"
        loading={busy}
        onConfirm={run}
        onCancel={() => !busy && setOpen(false)}
      />
    </>
  )
}
