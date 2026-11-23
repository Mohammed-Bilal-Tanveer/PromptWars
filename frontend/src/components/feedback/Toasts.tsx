import { useAppStore } from '@/stores/appStore'
import { cx, IconAlert, IconCheckCircle, IconInfo, IconX } from '@/components/ui'

const KIND = {
  success: { icon: IconCheckCircle, cls: 'text-emerald-600' },
  error: { icon: IconAlert, cls: 'text-red-600' },
  info: { icon: IconInfo, cls: 'text-brand' },
} as const

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts)
  const dismiss = useAppStore((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed bottom-20 right-3 z-[70] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 lg:bottom-4 lg:right-4" aria-live="polite">
      {toasts.map((t) => {
        const k = KIND[t.kind]
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
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
              className="-mr-1 -mt-1 grid min-h-9 min-w-9 place-items-center rounded-lg text-subtle hover:bg-surface2 hover:text-fg"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <IconX size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
