import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ApiError } from '@/services/apiClient'
import { humanize } from '@/lib/format'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------- Button ---------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' | 'success'
export function Button({
  variant = 'primary', size = 'md', loading, className, children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const v: Record<BtnVariant, string> = {
    primary: 'grad-sched hover:brightness-110',
    ai: 'grad-ai hover:brightness-110',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    secondary: 'bg-surface2 hover:bg-[#222d63] text-fg border border-line',
    ghost: 'bg-transparent hover:bg-surface2 text-fg',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white',
  }
  const s = { sm: 'px-3 py-1.5 text-sm min-h-9', md: 'px-4 py-2 text-sm min-h-11', lg: 'px-6 py-3 text-base min-h-12' }[size]
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed', v[variant], s, className)}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  )
}

/* ---------- Card ---------- */
export function Card({ className, children, as: Tag = 'div', ...rest }: { className?: string; children: ReactNode; as?: any } & Record<string, any>) {
  return (
    <Tag {...rest} className={cx('rounded-2xl border border-line bg-surface p-4 sm:p-5', className)}>
      {children}
    </Tag>
  )
}
export function GradientCard({ gradient = 'brand', className, children }: { gradient?: 'brand' | 'ai' | 'avail' | 'sched' | 'growth' | 'warn' | 'accent'; className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl p-4 sm:p-5 shadow-lg', `grad-${gradient}`, className)}>{children}</div>
}

export function PageHeader({ title, subtitle, actions, gradient = 'brand' }: { title: string; subtitle?: ReactNode; actions?: ReactNode; gradient?: string }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          <span className={cx('inline-block h-2 w-8 rounded-full align-middle mr-3', `grad-${gradient}`)} aria-hidden />
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted max-w-3xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

/* ---------- Chips ---------- */
type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'ai' | 'neutral' | 'avail'
const toneCls: Record<Tone, string> = {
  ok: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40',
  warn: 'bg-amber-500/15 text-amber-300 border-amber-400/40',
  danger: 'bg-rose-500/15 text-rose-300 border-rose-400/40',
  info: 'bg-sky-500/15 text-sky-300 border-sky-400/40',
  ai: 'bg-violet-500/15 text-violet-300 border-violet-400/40',
  avail: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40',
  neutral: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
}
export function Chip({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: string; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', toneCls[tone], className)}>
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </span>
  )
}

const STATUS_TONE: Record<string, { tone: Tone; icon: string; label?: string }> = {
  available: { tone: 'ok', icon: '●', label: 'Available' },
  occupied: { tone: 'warn', icon: '◐', label: 'Fully booked now' },
  maintenance: { tone: 'danger', icon: '▲', label: 'Under maintenance' },
  operational: { tone: 'ok', icon: '●', label: 'Operational' },
  unavailable: { tone: 'danger', icon: '✕', label: 'Unavailable' },
  pending_review: { tone: 'warn', icon: '⏳', label: 'Pending review' },
  approved: { tone: 'ok', icon: '✓' },
  confirmed: { tone: 'ok', icon: '✓', label: 'Confirmed' },
  rejected: { tone: 'danger', icon: '✕', label: 'Rejected' },
  alternative_proposed: { tone: 'info', icon: '⇄', label: 'Alternative proposed' },
  cancelled: { tone: 'neutral', icon: '–', label: 'Cancelled' },
  completed: { tone: 'info', icon: '✔', label: 'Completed' },
  expired: { tone: 'neutral', icon: '–', label: 'Expired' },
  open: { tone: 'ok', icon: '●', label: 'Open' },
  closed: { tone: 'neutral', icon: '–', label: 'Closed' },
  exact: { tone: 'ok', icon: '✓', label: 'Exact match' },
  partial: { tone: 'info', icon: '≈', label: 'Partial match' },
  unmatched: { tone: 'danger', icon: '?', label: 'Unmatched' },
  feasible: { tone: 'ok', icon: '✓', label: 'Feasible' },
  partially_feasible: { tone: 'warn', icon: '≈', label: 'Partially feasible' },
  infeasible: { tone: 'danger', icon: '✕', label: 'Infeasible' },
  required: { tone: 'ai', icon: '', label: 'Required' },
  recommended: { tone: 'avail', icon: '', label: 'Recommended' },
  optional: { tone: 'neutral', icon: '', label: 'Optional' },
}
/** Status is always text + icon + colour (never colour alone). */
export function StatusChip({ status, label }: { status: string; label?: string }) {
  const m = STATUS_TONE[status] ?? { tone: 'neutral' as Tone, icon: '•' }
  // "unavailable" as a match_status means matched-but-no-free-units; as a unit status means offline.
  return <Chip tone={m.tone} icon={m.icon}>{label ?? m.label ?? humanize(status)}</Chip>
}

/* ---------- Feedback ---------- */
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg role="status" aria-label="Loading" width={size} height={size} viewBox="0 0 24 24" className="animate-spin text-sky-300">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity=".25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-muted" role="status" aria-live="polite">
      <Spinner /> <span>{label}</span>
    </div>
  )
}
export function EmptyState({ title, hint, action, icon = '🗂️' }: { title: string; hint?: string; action?: ReactNode; icon?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-8 text-center">
      <div className="text-3xl" aria-hidden>{icon}</div>
      <p className="mt-2 font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return 'Something went wrong.'
}
export function ErrorState({ error, onRetry, title = 'Could not load data' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-6 text-center">
      <p className="font-semibold text-rose-200">⚠ {title}</p>
      <p className="mt-1 text-sm text-rose-100/80">{errorMessage(error)}</p>
      {onRetry && <Button className="mt-4" variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  )
}
export function Notice({ tone = 'info', title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'note'} className={cx('rounded-xl border px-4 py-3 text-sm', toneCls[tone])}>
      {title && <strong className="block">{title}</strong>}
      {children}
    </div>
  )
}

/** Renders loading / error / data for a TanStack query result. */
export function QueryBoundary<T>({ query, children, loadingLabel }: { query: { isLoading: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => any }; children: (data: T) => ReactNode; loadingLabel?: string }) {
  if (query.isLoading) return <LoadingState label={loadingLabel} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (query.data === undefined) return null
  return <>{children(query.data)}</>
}

export function ProgressBar({ value, label, gradient = 'avail' }: { value: number; label?: string; gradient?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'} className="h-2 w-full overflow-hidden rounded-full bg-surface2">
      <div className={cx('h-full rounded-full', `grad-${gradient}`)} style={{ width: `${v}%` }} />
    </div>
  )
}

/* ---------- Forms ---------- */
const inputBase = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-slate-500 min-h-11 focus:border-sky-400'
export function Field({ label, htmlFor, error, hint, children, className }: { label: string; htmlFor: string; error?: string | null; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p role="alert" className="text-xs font-medium text-rose-300">⚠ {error}</p>}
    </div>
  )
}
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputBase, className)} />
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputBase, className)} />
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputBase, 'min-h-24', className)} />

/* ---------- Modal / Drawer (focus managed, Esc closes) ---------- */
export function Modal({ open, onClose, title, children, wide, side }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; side?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const prev = useRef<Element | null>(null)
  useEffect(() => {
    if (!open) return
    prev.current = document.activeElement
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      ;(prev.current as HTMLElement | null)?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative z-10 flex max-h-full flex-col overflow-hidden border border-line bg-surface shadow-2xl outline-none',
          side ? 'ml-auto h-full w-full max-w-xl rounded-l-2xl' : cx('m-auto w-[calc(100%-1.5rem)] rounded-2xl', wide ? 'max-w-4xl' : 'max-w-lg'),
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">✕</Button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

/* ---------- Confirm ---------- */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', variant = 'primary', loading, onConfirm, onCancel }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; variant?: BtnVariant; loading?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="text-sm text-muted">{message}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant={variant} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

export function Stat({ label, value, hint, gradient }: { label: string; value: ReactNode; hint?: string; gradient?: string }) {
  return (
    <div className={cx('rounded-2xl border border-line p-4', gradient ? `grad-${gradient} border-transparent` : 'bg-surface')}>
      <div className={cx('text-xs font-semibold uppercase tracking-wide', gradient ? 'opacity-90' : 'text-muted')}>{label}</div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums">{value}</div>
      {hint && <div className={cx('mt-1 text-xs', gradient ? 'opacity-90' : 'text-muted')}>{hint}</div>}
    </div>
  )
}
