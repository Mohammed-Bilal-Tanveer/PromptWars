import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Card, Chip, Notice, StatusChip, cx } from '@/components/ui'
import { campusDateOf, campusTimeOf, formatDate, formatDateTime, formatRange, minutesToLabel } from '@/lib/format'
import { AlternativeList, FactorBars, Section } from '@/features/bookings/parts'
import type { Alternative } from '@/types/api'
import type { DecisionResponse, DecisionResult, LockedBlock, SolverStatus } from './types'

const STATUS_TEXT: Record<SolverStatus, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral'; hint: string }> = {
  optimal: { label: 'Optimal', tone: 'ok', hint: 'CP-SAT proved no better allocation exists under the model.' },
  feasible: { label: 'Feasible (time limit reached)', tone: 'warn', hint: 'A valid allocation was found but optimality was not proven within the time limit.' },
  infeasible: { label: 'Infeasible', tone: 'danger', hint: 'No request could be allocated under the hard constraints.' },
  not_run: { label: 'Not run', tone: 'neutral', hint: 'The solver had nothing to solve.' },
}

const DAY_START = 7 * 60
const DAY_END = 21 * 60
const minutesOfDay = (iso: string) => { const [h, m] = campusTimeOf(iso).split(':').map(Number); return h * 60 + m }

/** Clip an interval to one campus day; returns percent left/width in the visible axis or null. */
function clip(day: string, startIso: string, endIso: string) {
  const sd = campusDateOf(startIso), ed = campusDateOf(endIso)
  if (sd > day || ed < day) return null
  const s = sd < day ? 0 : minutesOfDay(startIso)
  const e = ed > day ? 24 * 60 : minutesOfDay(endIso)
  const a = Math.max(s, DAY_START), b = Math.min(e, DAY_END)
  if (b <= a) return null
  const span = DAY_END - DAY_START
  return { left: ((a - DAY_START) / span) * 100, width: ((b - a) / span) * 100 }
}

function daysOf(startIso: string, days: number): string[] {
  const out: string[] = []
  const t0 = new Date(startIso).getTime()
  for (let i = 0; i <= days; i++) {
    const d = campusDateOf(new Date(t0 + i * 86_400_000).toISOString())
    if (!out.includes(d)) out.push(d)
  }
  return out
}

export function SolverSummaryPanel({ data }: { data: DecisionResponse }) {
  const s = data.summary
  const st = STATUS_TEXT[(s?.solver_status ?? data.solver_status) as SolverStatus]
  const items: [string, string | number][] = s ? [
    ['Requests considered', s.requests_considered],
    ['Feasible assignments', s.feasible_assignments],
    ['Unresolved', s.unresolved],
    ['Units considered', s.units_considered],
    ['Fixed blocks (bookings + maintenance)', s.fixed_blocks],
    ['Solver runtime', `${Math.round(s.solve_time_ms)} ms`],
    ['Horizon', `${formatDate(s.horizon_start)} to ${formatDate(s.horizon_end)} (${s.horizon_days} d)`],
    ['Time grid', `${s.grid_minutes} min`],
  ] : [['Solver runtime', `${Math.round(data.solve_time_ms)} ms`], ['Horizon', `${data.horizon_days} d`]]
  return (
    <Card className="space-y-3" aria-label="Solver run summary">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Solver run summary</h3>
        <span data-testid="solver-status"><Chip tone={st.tone}>CP-SAT status: {st.label}</Chip></span>
      </div>
      <p className="text-xs text-muted">{st.hint}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
        {items.map(([k, v]) => (
          <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="tnum font-semibold">{v}</dd></div>
        ))}
      </dl>
    </Card>
  )
}

export function ConstraintExplainer() {
  return (
    <Card aria-label="Hard constraints and soft preferences">
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Hard constraints (cannot be violated)">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted marker:text-subtle">
            <li>The equipment unit must be operational.</li>
            <li>The requested duration must be allowed.</li>
            <li>The lab must be open for the whole session.</li>
            <li>No overlap with confirmed bookings, setup/cleanup buffers or maintenance.</li>
            <li>The slot must be inside the scheduling horizon.</li>
            <li>A request receives at most one allocation.</li>
          </ul>
        </Section>
        <Section title="Soft preferences (compare feasible choices)">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted marker:text-subtle">
            <li>Project deadline urgency.</li>
            <li>Waiting duration.</li>
            <li>Fair access based on recent usage.</li>
            <li>Preferred time fit.</li>
            <li>Minimum shift from the requested time.</li>
          </ul>
        </Section>
      </div>
      <p className="mt-3 text-xs text-muted">Hard constraints decide what is feasible; soft preferences only rank feasible options.</p>
    </Card>
  )
}

type Mode = 'before' | 'after'
type Pick = { kind: 'request'; id: string | null } | { kind: 'locked'; unit: string; block: LockedBlock }

export function DecisionVisualiser({ data, onUse, busy }: { data: DecisionResponse; onUse: (r: DecisionResult, a: Alternative) => void; busy: boolean }) {
  const [mode, setMode] = useState<Mode>('after')
  const [pick, setPick] = useState<Pick | null>(() => {
    const first = data.results[0]
    return first ? { kind: 'request', id: first.request_id } : null
  })
  const timeline = data.timeline ?? []
  const horizonStart = data.summary?.horizon_start
  const days = useMemo(() => (horizonStart ? daysOf(horizonStart, data.summary?.horizon_days ?? data.horizon_days) : []), [horizonStart, data.summary?.horizon_days, data.horizon_days])
  const [day, setDay] = useState('')
  const activeDay = days.includes(day) ? day : days[0] ?? ''
  const selected = pick?.kind === 'request' ? data.results.find((r) => r.request_id === pick.id) : undefined
  const hours = [8, 10, 12, 14, 16, 18, 20]

  const titleOf = (id: string | null) => data.results.find((r) => r.request_id === id)?.project_title || id || 'Ad-hoc request'

  return (
    <div className="space-y-4">
      <Notice tone="info" title="Recommendations only — no booking has been created">
        Confirmed bookings and maintenance stay fixed. Pick an assignment or alternative to start the normal booking or proposal workflow.
      </Notice>
      <SolverSummaryPanel data={data} />

      {timeline.length > 0 && (
        <Card className="space-y-3" aria-label="Equipment timeline">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Equipment timeline</h3>
            <div role="group" aria-label="Timeline state" className="inline-flex rounded-lg border border-line p-0.5 text-sm">
              {(['before', 'after'] as Mode[]).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                  className={cx('rounded-md px-3 py-1.5 font-medium', mode === m ? 'bg-brand-600 text-white' : 'text-muted hover:bg-surface2')}>
                  {m === 'before' ? 'Before optimisation' : 'After optimisation'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Day">
            {days.map((d) => (
              <button key={d} type="button" aria-pressed={d === activeDay} onClick={() => setDay(d)}
                className={cx('rounded-lg border px-2.5 py-1 text-xs', d === activeDay ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'border-line text-muted')}>
                {formatDate(`${d}T12:00:00Z`)}
              </button>
            ))}
          </div>
          <Legend mode={mode} />

          {/* Desktop lanes */}
          <div className="hidden md:block" data-testid="timeline-lanes">
            <div className="relative ml-40 h-5 text-[11px] text-subtle">
              {hours.map((h) => <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h * 60 - DAY_START) / (DAY_END - DAY_START)) * 100}%` }}>{String(h).padStart(2, '0')}:00</span>)}
            </div>
            {mode === 'before' && data.results.map((r) => {
              const c = r.requested_start_at && r.requested_end_at ? clip(activeDay, r.requested_start_at, r.requested_end_at) : null
              const clash = r.conflicts.length > 0
              return (
                <Lane key={`req-${r.request_id ?? 'adhoc'}`} label={`Request: ${r.project_title || r.request_id || 'Ad-hoc'}`}>
                  {c && <Bar c={c} tone={clash ? 'clash' : 'request'} title={`Requested ${formatRange(r.requested_start_at!, r.requested_end_at!)}${clash ? ' (conflict)' : ''}`} onClick={() => setPick({ kind: 'request', id: r.request_id })} />}
                </Lane>
              )
            })}
            {timeline.map((u) => (
              <Lane key={u.unit_id} label={u.unit_name}>
                {u.locked.map((b, i) => { const c = clip(activeDay, b.start_at, b.end_at); return c && (
                  <Bar key={`l${i}`} c={c} tone={b.kind} title={`${b.label}: ${formatRange(b.start_at, b.end_at)}`} onClick={() => setPick({ kind: 'locked', unit: u.unit_name, block: b })} />) })}
                {mode === 'after' && u.recommended.map((b, i) => { const c = clip(activeDay, b.start_at, b.end_at); return c && (
                  <Bar key={`r${i}`} c={c} tone="recommended" title={`Recommended: ${titleOf(b.request_id)} ${formatRange(b.start_at, b.end_at)}`} label={titleOf(b.request_id)} onClick={() => setPick({ kind: 'request', id: b.request_id })} />) })}
              </Lane>
            ))}
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden" data-testid="timeline-cards">
            {timeline.map((u) => (
              <li key={u.unit_id} className="rounded-xl border border-line bg-surface p-3 text-sm">
                <div className="font-semibold">{u.unit_name}</div>
                <ul className="mt-1.5 space-y-1 text-xs text-muted">
                  {u.locked.map((b, i) => <li key={`l${i}`}><Chip tone={b.kind === 'maintenance' ? 'warn' : 'neutral'}>{b.label}</Chip> <span className="tnum">{formatRange(b.start_at, b.end_at)}</span></li>)}
                  {mode === 'after' && u.recommended.map((b, i) => (
                    <li key={`r${i}`}><button type="button" className="text-left" onClick={() => setPick({ kind: 'request', id: b.request_id })}><Chip tone="info">Recommended</Chip> {titleOf(b.request_id)} <span className="tnum">{formatRange(b.start_at, b.end_at)}</span></button></li>
                  ))}
                  {u.locked.length === 0 && (mode === 'before' || u.recommended.length === 0) && <li>No blocks in this horizon.</li>}
                </ul>
              </li>
            ))}
          </ul>

          {pick?.kind === 'locked' && (
            <div role="status" className="rounded-lg border border-line bg-surface2 px-3 py-2 text-sm">
              <strong>{pick.block.label}</strong> on {pick.unit}: <span className="tnum">{formatRange(pick.block.start_at, pick.block.end_at)}</span>.{' '}
              {pick.block.kind === 'maintenance' ? 'The unit is blocked for maintenance and cannot be allocated.' : 'A confirmed booking, kept unchanged by the solver.'}
            </div>
          )}
        </Card>
      )}

      <ConstraintExplainer />

      <Card className="space-y-3" aria-label="Request decisions">
        <h3 className="font-semibold">Decision per request</h3>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose request">
          {data.results.map((r, i) => {
            const on = pick?.kind === 'request' && pick.id === r.request_id
            return (
              <button key={`${r.request_id ?? 'adhoc'}-${i}`} type="button" aria-pressed={on} onClick={() => setPick({ kind: 'request', id: r.request_id })}
                className={cx('rounded-lg border px-2.5 py-1 text-xs', on ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'border-line text-muted')}>
                {r.project_title || r.request_id || 'Ad-hoc search'} · {r.recommended ? 'assigned' : 'unscheduled'}
              </button>
            )
          })}
        </div>
        {selected ? <DecisionPanel r={selected} weights={data.weights} onUse={onUse} busy={busy} /> : <p className="text-sm text-muted">Select a request to see why it was decided this way.</p>}
      </Card>
    </div>
  )
}

function Legend({ mode }: { mode: Mode }) {
  const chips: [string, string][] = [['bg-slate-400', 'Confirmed (locked)'], ['bg-amber-400', 'Maintenance (blocked)']]
  if (mode === 'before') chips.push(['bg-sky-300', 'Requested window'], ['bg-red-400', 'Conflicting request'])
  else chips.push(['bg-brand-600', 'Recommended (not booked)'])
  return <ul className="flex flex-wrap gap-3 text-xs text-muted">{chips.map(([c, l]) => <li key={l} className="flex items-center gap-1.5"><span className={cx('inline-block h-3 w-3 rounded-sm', c)} />{l}</li>)}</ul>
}

function Lane({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center border-t border-line">
      <div className="w-40 shrink-0 truncate pr-2 text-xs font-medium" title={label}>{label}</div>
      <div className="relative h-9 flex-1 bg-surface2/40">{children}</div>
    </div>
  )
}

const BAR_TONE = { booking: 'bg-slate-400', maintenance: 'bg-amber-400', recommended: 'bg-brand-600 text-white', request: 'bg-sky-300', clash: 'bg-red-400' } as const
function Bar({ c, tone, title, label, onClick }: { c: { left: number; width: number }; tone: keyof typeof BAR_TONE; title: string; label?: string; onClick: () => void }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={cx('absolute top-1 bottom-1 overflow-hidden rounded px-1 text-left text-[11px] leading-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600', BAR_TONE[tone])}
      style={{ left: `${c.left}%`, width: `${c.width}%` }}>{label}</button>
  )
}

function DecisionPanel({ r, weights, onUse, busy }: { r: DecisionResult; weights: DecisionResponse['weights']; onUse: (r: DecisionResult, a: Alternative) => void; busy: boolean }) {
  const facts: [string, string][] = [
    ['Project', r.project_title || r.request_id || 'Ad-hoc search'],
    ['Deadline', r.deadline ? formatDateTime(r.deadline) : 'None given'],
    ['Requested window', r.requested_start_at ? (r.requested_end_at ? formatRange(r.requested_start_at, r.requested_end_at) : formatDateTime(r.requested_start_at)) : 'Not specified'],
    ['Equipment', `${r.equipment_name} (${r.eligible_units ?? 0} eligible unit${r.eligible_units === 1 ? '' : 's'})`],
    ['Recommendation', r.recommended ? `${r.recommended.unit_name} · ${formatRange(r.recommended.start_at, r.recommended.end_at)}` : 'None'],
  ]
  return (
    <div className="space-y-4" data-testid="decision-panel">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={r.allocation_status} />
        <span data-testid="weighted-score"><Chip tone="ai">Weighted priority score {Math.round(r.priority_score * 100)}%</Chip></span>
        {r.recommended && <Chip tone="info">Recommended, not booked</Chip>}
      </div>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}
      </dl>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Priority factors (from backend)"><FactorBars factors={r.priority_factors} weights={weights} /></Section>
        <Section title={r.recommended ? 'Why this slot' : 'Why it was not scheduled'}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted marker:text-subtle">{r.explanation.map((x, i) => <li key={i}>{x}</li>)}</ul>
          {r.recommended && r.shift_minutes != null && (
            <p className="text-sm text-muted" data-testid="shift-note">{r.shift_minutes === 0 ? 'No shift: starts at the preferred time.' : `Shift from preferred start: ${minutesToLabel(r.shift_minutes)}.`}</p>
          )}
        </Section>
      </div>
      {!!r.hard_constraints_checked?.length && (
        <Section title="Hard constraints checked">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted marker:text-subtle">{r.hard_constraints_checked.map((x) => <li key={x}>{x}</li>)}</ul>
        </Section>
      )}
      {r.conflicts.length > 0 && (
        <Section title="Conflicts">
          <ul className="space-y-1 text-sm text-muted">{r.conflicts.map((c) => <li key={c.id}>{c.message} <span className="tnum">({formatRange(c.start_at, c.end_at)})</span></li>)}</ul>
        </Section>
      )}
      <Section title="Alternatives (suggestions, not reservations)">
        <AlternativeList items={r.alternatives} onPick={(a) => onUse(r, a)} pickLabel={r.request_id ? 'Propose to requester' : 'Use this slot'} busy={busy} />
      </Section>
    </div>
  )
}
