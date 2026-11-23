import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ApiError } from '@/services/apiClient'
import { humanize } from '@/lib/format'
import {
  IconAlert, IconCheck, IconCheckCircle, IconClock, IconDot, IconInbox, IconInfo, IconMinus, IconSwap, IconWrench, IconX, IconXCircle,
} from './icons'

export * from './icons'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------- Button ---------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' | 'success'
const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: 'bg-brand text-white shadow-card hover:bg-brand-hover active:bg-brand-active',
  // "ai" used to be a purple gradient; it is now the same calm primary button.
  ai: 'bg-brand text-white shadow-card hover:bg-brand-hover active:bg-brand-active',
  success: 'bg-emerald-700 text-white shadow-card hover:bg-emerald-800 active:bg-emerald-900',
  secondary: 'bg-surface text-fg border border-line-strong shadow-card hover:bg-surface2 active:bg-[#e8ebf0]',
  ghost: 'bg-transparent text-muted hover:bg-surface2 hover:text-fg active:bg-[#e8ebf0]',
  danger: 'bg-red-700 text-white shadow-card hover:bg-red-800 active:bg-red-900',
}
const BTN_SIZE = {
  sm: 'px-3 text-sm min-h-11 sm:min-h-9',
  md: 'px-4 text-sm min-h-11 lg:min-h-10',
  lg: 'px-5 text-[15px] min-h-12',
} as const
/** Button look for non-button elements (e.g. router links styled as buttons). */
export const buttonCls = (variant: BtnVariant = 'primary', size: keyof typeof BTN_SIZE = 'md', className?: string) =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold leading-tight transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55',
    BTN_VARIANT[variant], BTN_SIZE[size], className,
  )
export function Button({
  variant = 'primary', size = 'md', loading, className, children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonCls(variant, size, className)}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  )
}

/* ---------- Card ---------- */
export function Card({ className, children, as: Tag = 'div', ...rest }: { className?: string; children: ReactNode; as?: any } & Record<string, any>) {
  return (
    <Tag {...rest} className={cx('rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5', className)}>
      {children}
    </Tag>
  )
}

const TINT: Record<string, string> = {
  brand: 'bg-brand-subtle border-brand-muted',
  ai: 'bg-brand-subtle border-brand-muted',
  sched: 'bg-brand-subtle border-brand-muted',
  accent: 'bg-brand-subtle border-brand-muted',
  avail: 'bg-emerald-50 border-emerald-200',
  growth: 'bg-teal-50 border-teal-200',
  warn: 'bg-amber-50 border-amber-200',
}
/** Kept for compatibility — renders a softly tinted card (no gradients). */
export function GradientCard({ gradient = 'brand', className, children }: { gradient?: 'brand' | 'ai' | 'avail' | 'sched' | 'growth' | 'warn' | 'accent'; className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border p-4 text-fg sm:p-5', TINT[gradient] ?? TINT.brand, className)}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode; gradient?: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px] sm:leading-9">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Section heading used inside pages. */
export function SectionTitle({ children, className, as: Tag = 'h2' }: { children: ReactNode; className?: string; as?: any }) {
  return <Tag className={cx('text-base font-semibold text-fg sm:text-[17px]', className)}>{children}</Tag>
}

/* ---------- Chips ---------- */
type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'ai' | 'neutral' | 'avail'
const toneCls: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warn: 'bg-amber-50 text-amber-900 border-amber-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
  info: 'bg-sky-50 text-sky-900 border-sky-200',
  ai: 'bg-brand-subtle text-brand-fg border-brand-muted',
  avail: 'bg-teal-50 text-teal-900 border-teal-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
}
const toneIconCls: Record<Tone, string> = {
  ok: 'text-emerald-600', warn: 'text-amber-600', danger: 'text-red-600', info: 'text-sky-600',
  ai: 'text-brand', avail: 'text-teal-600', neutral: 'text-slate-500',
}
export function Chip({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5', toneCls[tone], className)}>
      {icon && <span aria-hidden className={cx('inline-flex shrink-0', toneIconCls[tone])}>{icon}</span>}
      {children}
    </span>
  )
}

const I = { size: 13, strokeWidth: 2 } as const
const DOT = <IconDot size={10} />
const STATUS_TONE: Record<string, { tone: Tone; icon: ReactNode; label?: string }> = {
  available: { tone: 'ok', icon: DOT, label: 'Available' },
  occupied: { tone: 'warn', icon: <IconClock {...I} />, label: 'Fully booked now' },
  maintenance: { tone: 'danger', icon: <IconWrench {...I} />, label: 'Under maintenance' },
  operational: { tone: 'ok', icon: DOT, label: 'Operational' },
  unavailable: { tone: 'danger', icon: <IconXCircle {...I} />, label: 'Unavailable' },
  pending_review: { tone: 'warn', icon: <IconClock {...I} />, label: 'Pending review' },
  approved: { tone: 'ok', icon: <IconCheck {...I} /> },
  confirmed: { tone: 'ok', icon: <IconCheck {...I} />, label: 'Confirmed' },
  rejected: { tone: 'danger', icon: <IconX {...I} />, label: 'Rejected' },
  alternative_proposed: { tone: 'info', icon: <IconSwap {...I} />, label: 'Alternative proposed' },
  cancelled: { tone: 'neutral', icon: <IconMinus {...I} />, label: 'Cancelled' },
  completed: { tone: 'info', icon: <IconCheckCircle {...I} />, label: 'Completed' },
  expired: { tone: 'neutral', icon: <IconMinus {...I} />, label: 'Expired' },
  open: { tone: 'ok', icon: DOT, label: 'Open' },
  closed: { tone: 'neutral', icon: <IconMinus {...I} />, label: 'Closed' },
  exact: { tone: 'ok', icon: <IconCheck {...I} />, label: 'Exact match' },
  partial: { tone: 'info', icon: <IconSwap {...I} />, label: 'Partial match' },
  unmatched: { tone: 'danger', icon: <IconAlert {...I} />, label: 'Unmatched' },
  feasible: { tone: 'ok', icon: <IconCheck {...I} />, label: 'Feasible' },
  partially_feasible: { tone: 'warn', icon: <IconAlert {...I} />, label: 'Partially feasible' },
  infeasible: { tone: 'danger', icon: <IconX {...I} />, label: 'Infeasible' },
  required: { tone: 'ai', icon: null, label: 'Required' },
  recommended: { tone: 'avail', icon: null, label: 'Recommended' },
  optional: { tone: 'neutral', icon: null, label: 'Optional' },
}
/** Status is always text + icon + colour (never colour alone). */
export function StatusChip({ status, label }: { status: string; label?: string }) {
  const m = STATUS_TONE[status] ?? { tone: 'neutral' as Tone, icon: DOT }
  // "unavailable" as a match_status means matched-but-no-free-units; as a unit status means offline.
  return <Chip tone={m.tone} icon={m.icon}>{label ?? m.label ?? humanize(status)}</Chip>
}

/* ---------- Feedback ---------- */
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg role="status" aria-label="Loading" width={size} height={size} viewBox="0 0 24 24" className="animate-spin text-current opacity-80">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2.5" fill="none" opacity=".2" />
      <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted" role="status" aria-live="polite">
      <span className="text-brand"><Spinner /></span> <span>{label}</span>
    </div>
  )
}
/** Shimmer placeholder rows for list-like content. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton h-4', className)} aria-hidden />
}
export function EmptyState({ title, hint, action, icon }: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  // Emoji icons from older call sites are ignored in favour of the outline icon set.
  const glyph = icon && typeof icon !== 'string' ? icon : <IconInbox size={22} />
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-surface2 text-subtle" aria-hidden>{glyph}</div>
      <p className="mt-3 font-semibold text-fg">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{hint}</p>}
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
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-red-700" aria-hidden><IconAlert /></div>
      <p className="mt-3 font-semibold text-red-900">{title}</p>
      <p className="mt-1 text-sm text-red-800">{errorMessage(error)}</p>
      {onRetry && <Button className="mt-4" variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  )
}
const NOTICE_ICON: Record<Tone, ReactNode> = {
  ok: <IconCheckCircle size={18} />, warn: <IconAlert size={18} />, danger: <IconAlert size={18} />,
  info: <IconInfo size={18} />, ai: <IconInfo size={18} />, avail: <IconInfo size={18} />, neutral: <IconInfo size={18} />,
}
export function Notice({ tone = 'info', title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'note'} className={cx('flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed', toneCls[tone])}>
      <span aria-hidden className={cx('mt-0.5 shrink-0', toneIconCls[tone])}>{NOTICE_ICON[tone]}</span>
      <div className="min-w-0 flex-1">
        {title && <strong className="block font-semibold">{title}</strong>}
        {children}
      </div>
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

const FILL: Record<string, string> = {
  brand: 'bg-brand', ai: 'bg-brand', sched: 'bg-brand', accent: 'bg-brand',
  avail: 'bg-emerald-600', growth: 'bg-teal-600', warn: 'bg-amber-500',
}
export function ProgressBar({ value, label, gradient = 'avail' }: { value: number; label?: string; gradient?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'} className="h-1.5 w-full overflow-hidden rounded-full bg-[#e8ebf0]">
      <div className={cx('h-full rounded-full', FILL[gradient] ?? 'bg-brand')} style={{ width: `${v}%` }} />
    </div>
  )
}

/* ---------- Forms ---------- */
const inputBase =
  'w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-fg shadow-card placeholder:text-subtle min-h-11 lg:min-h-10 ' +
  'transition-colors hover:border-[#b5bcc7] focus:border-brand disabled:cursor-not-allowed disabled:bg-surface2 disabled:text-subtle aria-[invalid=true]:border-red-600'
export function Field({ label, htmlFor, error, hint, children, className }: { label: string; htmlFor: string; error?: string | null; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-subtle">{hint}</p>}
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-red-700">
          <IconAlert size={14} className="mt-px shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputBase, className)} />
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputBase, 'pr-8', className)} />
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputBase, 'min-h-24 leading-relaxed', className)} />

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
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative z-10 flex flex-col overflow-hidden border border-line bg-surface text-fg shadow-pop outline-none',
          side
            ? 'ml-auto h-full w-full max-w-xl rounded-l-2xl'
            : cx('m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] rounded-2xl', wide ? 'max-w-3xl' : 'max-w-lg'),
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="min-w-0 truncate text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-2 grid min-h-11 min-w-11 place-items-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-fg sm:min-h-9 sm:min-w-9"
          >
            <IconX size={18} />
          </button>
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
      <div className="text-sm leading-relaxed text-muted">{message}</div>
      <div className="-mx-5 -mb-5 mt-5 flex justify-end gap-2 border-t border-line bg-surface2/60 px-5 py-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant={variant} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

const STAT_ICON_TONE: Record<string, string> = {
  avail: 'bg-emerald-50 text-emerald-700',
  growth: 'bg-teal-50 text-teal-700',
  warn: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  brand: 'bg-brand-subtle text-brand', sched: 'bg-brand-subtle text-brand', ai: 'bg-brand-subtle text-brand', accent: 'bg-brand-subtle text-brand',
  neutral: 'bg-surface2 text-muted',
}
/** Stat tile: white card, optional small icon, big number, label, optional hint. `gradient` now only tints the icon badge. */
export function Stat({ label, value, hint, gradient, icon }: { label: string; value: ReactNode; hint?: string; gradient?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2.5">
        {icon && <span aria-hidden className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', STAT_ICON_TONE[gradient ?? 'neutral'] ?? STAT_ICON_TONE.neutral)}>{icon}</span>}
        <div className="text-sm font-medium text-muted">{label}</div>
      </div>
      <div className="tnum mt-3 text-[28px] font-semibold leading-none tracking-tight text-fg">{value}</div>
      {hint && <div className="mt-2 text-xs text-subtle">{hint}</div>}
    </div>
  )
}
