import { useAppStore } from '@/stores/appStore'
import { cx } from '@/components/ui'

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts)
  const dismiss = useAppStore((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed bottom-20 right-3 z-[70] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 lg:bottom-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={cx(
            'pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-xl',
            t.kind === 'success' && 'border-emerald-400/50 bg-emerald-950 text-emerald-50',
            t.kind === 'error' && 'border-rose-400/50 bg-rose-950 text-rose-50',
            t.kind === 'info' && 'border-sky-400/50 bg-slate-900 text-sky-50',
          )}
        >
          <span aria-hidden>{t.kind === 'success' ? '✓' : t.kind === 'error' ? '⚠' : 'ℹ'}</span>
          <div className="flex-1 text-sm">
            <strong className="block">{t.title}</strong>
            {t.message && <span className="opacity-90">{t.message}</span>}
          </div>
          <button className="min-h-8 min-w-8 rounded-lg hover:bg-white/10" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">✕</button>
        </div>
      ))}
    </div>
  )
}
