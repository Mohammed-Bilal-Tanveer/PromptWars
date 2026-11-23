import { useEffect, useState } from 'react'
import { useAppStore, type Toast } from '@/stores/appStore'
import { cx, IconAlert, IconCheckCircle, IconInfo, IconX } from '@/components/ui'

const ERROR_DISMISS_MS = 7000
const DEFAULT_DISMISS_MS = 4500

const KIND = {
  success: { icon: IconCheckCircle, cls: 'text-emerald-600' },
  error: { icon: IconAlert, cls: 'text-red-600' },
  info: { icon: IconInfo, cls: 'text-brand' },
} as const

/** One toast. Auto-dismisses after a delay, but the timer is paused while it is hovered or holds keyboard focus. */
function ToastItem({ t, dismiss }: { t: Toast; dismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false)
  const k = KIND[t.kind]
  useEffect(() => {
    if (paused) return
    const h = setTimeout(() => dismiss(t.id), t.kind === 'error' ? ERROR_DISMISS_MS : DEFAULT_DISMISS_MS)
    return () => clearTimeout(h)
  }, [paused, t.id, t.kind, dismiss])
  return (
    <div
      role={t.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cx(
        'pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3 pl-3.5 text-fg shadow-pop',
        t.kind === 'error' && 'border-red-200',
      )}
    >
      <k.icon size={20} className={cx('mt-0.5 shrink-0', k.cls)} />
      <div className="min-w-0 flex-1 text-sm">
        <strong className="block font-semibold">{t.title}</strong>
        {t.message && <span className="text-muted">{t.message}</span>}
      </div>
      <button
        className="-mr-1 -mt-1 grid min-h-11 min-w-11 place-items-center rounded-lg text-subtle hover:bg-surface2 hover:text-fg sm:min-h-9 sm:min-w-9"
        onClick={() => dismiss(t.id)}
        aria-label="Dismiss notification"
      >
        <IconX size={16} />
      </button>
    </div>
  )
}

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts)
  const dismiss = useAppStore((s) => s.dismissToast)
  // Each toast carries its own role (status/alert); an extra aria-live wrapper would announce everything twice.
  return (
    <div className="pointer-events-none fixed bottom-20 right-3 z-[70] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 lg:bottom-4 lg:right-4">
      {toasts.map((t) => <ToastItem key={t.id} t={t} dismiss={dismiss} />)}
    </div>
  )
}
