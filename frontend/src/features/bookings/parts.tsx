import type { ReactNode } from 'react'
import { ApiError } from '@/services/apiClient'
import { ProgressBar, Chip, Button, cx } from '@/components/ui'
import { formatRange, humanize, minutesToLabel } from '@/lib/format'
import type { Alternative, AuditItem, PriorityFactors } from '@/types/api'

export const FACTOR_LABEL: Record<keyof PriorityFactors, string> = {
  deadline_urgency: 'Deadline urgency',
  waiting_time: 'Waiting time',
  fairness: 'Fairness',
  preference_fit: 'Preference fit',
}

/** Four priority-factor bars (0-1 values), optionally annotated with weights. */
export function FactorBars({ factors, weights }: { factors: PriorityFactors; weights?: PriorityFactors }) {
  return (
    <ul className="space-y-2" aria-label="Priority factors">
      {(Object.keys(FACTOR_LABEL) as (keyof PriorityFactors)[]).map((k) => (
        <li key={k}>
          <div className="mb-1.5 flex justify-between text-xs">
            <span>
              {FACTOR_LABEL[k]}
              {weights && <span className="text-muted"> (weight {Math.round(weights[k] * 100)}%)</span>}
            </span>
            <span className="tabular-nums text-muted">{Math.round(factors[k] * 100)}%</span>
          </div>
          <ProgressBar value={factors[k] * 100} label={`${FACTOR_LABEL[k]} ${Math.round(factors[k] * 100)} percent`} gradient="sched" />
        </li>
      ))}
    </ul>
  )
}

export function AlternativeList({
  items, onPick, pickLabel = 'Use this slot', busy,
}: { items: Alternative[]; onPick?: (a: Alternative) => void; pickLabel?: string; busy?: boolean }) {
  if (!items.length) return <p className="text-sm text-muted">No alternative slots found in the search horizon.</p>
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((a, i) => (
        <li key={`${a.unit_id}-${a.start_at}-${i}`} className="rounded-xl border border-line bg-surface p-3 text-sm text-fg shadow-card">
          <div className="tnum font-semibold">{formatRange(a.start_at, a.end_at)}</div>
          <div className="text-muted">
            {a.equipment_name} · {a.unit_name}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {a.is_alternative_equipment && <Chip tone="info">Different equipment</Chip>}
            <Chip tone="neutral">{a.shift_minutes === 0 ? 'Same time' : `${minutesToLabel(a.shift_minutes)} shift`}</Chip>
          </div>
          <p className="mt-1 text-xs text-muted">{a.reason}</p>
          {onPick && (
            <Button className="mt-2" size="sm" variant="secondary" disabled={busy} onClick={() => onPick(a)}>
              {pickLabel}
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function Timeline({ items }: { items: AuditItem[] }) {
  if (!items.length) return <p className="text-sm text-muted">No history yet.</p>
  return (
    <ol className="ml-1 space-y-4 border-l border-line-strong pl-5">
      {items.map((t) => (
        <li key={t.id} className="relative text-sm">
          <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand ring-1 ring-brand-muted" aria-hidden />
          <div className="font-medium">{humanize(t.action)}</div>
          <div className="text-muted">{t.description}</div>
          <div className="mt-0.5 text-xs text-subtle">
            {t.actor} · {new Date(t.created_at).toLocaleString('en-GB')}
          </div>
          {t.note && <div className="mt-1 rounded-md bg-surface2 px-2 py-1 text-xs italic text-muted">“{t.note}”</div>}
        </li>
      ))}
    </ol>
  )
}

export function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('space-y-2', className)}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle">{title}</h3>
      {children}
    </section>
  )
}

export function apiDetails(e: unknown): { status: number; code: string; message: string; alternatives: Alternative[]; reasons: string[] } {
  if (e instanceof ApiError) {
    const d = e.details ?? {}
    return {
      status: e.status,
      code: e.code,
      message: e.message,
      alternatives: Array.isArray(d.alternatives) ? (d.alternatives as Alternative[]) : [],
      reasons: Array.isArray(d.reasons) ? (d.reasons as string[]) : [],
    }
  }
  return { status: 0, code: 'ERROR', message: e instanceof Error ? e.message : 'Something went wrong.', alternatives: [], reasons: [] }
}

export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}
export const fromMin = (n: number) => `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
