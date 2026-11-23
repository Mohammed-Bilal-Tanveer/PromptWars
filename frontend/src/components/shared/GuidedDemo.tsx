import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, IconArrowRight, IconChevronLeft, IconChevronRight, Modal, cx } from '@/components/ui'
import { usePublicConfig } from '@/hooks/useApi'
import { ROUTES } from '@/lib/routes'
import { useAppStore } from '@/stores/appStore'

export interface TourStep {
  id: string
  title: string
  text: string
  to: string
  cta: string
}

/** The H.3 evaluator journey. Every step links to a real route; none performs an action. */
export const TOUR_STEPS: TourStep[] = [
  { id: 'understand', title: 'Understand a project', text: 'Open Project Lab and click "Use sample project" (or type your own idea). Nothing is analysed until you press the analyse button.', to: ROUTES.projectLab, cta: 'Open Project Lab' },
  { id: 'analyse', title: 'Analyse requirements', text: 'Run the analysis yourself. The result is labelled "Live AI analysis" when an AI provider is configured on the server, or "Demo analysis (deterministic fallback)" when it is not.', to: ROUTES.projectLab, cta: 'Go to analysis' },
  { id: 'discover', title: 'Discover equipment', text: 'Open one matched item (or browse the catalogue) and inspect the real catalogue record: specs, units and department.', to: ROUTES.discover, cta: 'Browse equipment' },
  { id: 'availability', title: 'Check availability', text: 'On an equipment page, pick a date to see which units are free or occupied and the valid time windows.', to: ROUTES.discover, cta: 'Check availability' },
  { id: 'request', title: 'Request access / join queue', text: 'Choose a window and submit the request yourself. For a fully booked slot you can join the queue instead. Only your own click submits.', to: ROUTES.discover, cta: 'Open catalogue' },
  { id: 'optimise', title: 'Optimise allocation', text: 'In Scheduling Studio, run the scheduler. It is deterministic code (OR-Tools), not AI, and shows fair alternatives for contested slots.', to: ROUTES.scheduling, cta: 'Open Scheduling Studio' },
  { id: 'review', title: 'Review request', text: 'The public Approval Desk uses a simulated reviewer identity. Inspect the request details there.', to: ROUTES.approvals, cta: 'Open Approval Desk' },
  { id: 'confirm', title: 'Confirm workflow', text: 'Approve or propose an alternative with a deliberate click, then check status under My Requests (simulated requester).', to: ROUTES.requests, cta: 'Open My Requests' },
  { id: 'campus', title: 'Explore 3D campus', text: 'Walk to a department and inspect equipment with live status. Professional Mode works fine without WebGL if your device cannot run 3D.', to: ROUTES.campus3d, cta: 'Enter 3D campus' },
  { id: 'utilisation', title: 'Measure utilisation', text: 'Finish at Analytics: counts and utilisation reflect the stored bookings and requests.', to: ROUTES.analytics, cta: 'Open Analytics' },
]

const KEY = 'lablink.tour.step'

function loadStep(): number {
  try {
    const n = Number(localStorage.getItem(KEY))
    return Number.isInteger(n) && n >= 0 && n < TOUR_STEPS.length ? n : 0
  } catch {
    return 0
  }
}

/** Guided tour: navigates and explains only. Never submits, approves, rejects, cancels or resets. */
export function GuidedDemo() {
  const open = useAppStore((s) => s.guidedDemoOpen)
  const setOpen = useAppStore((s) => s.setGuidedDemoOpen)
  const done = useAppStore((s) => s.guidedDone)
  const mark = useAppStore((s) => s.markGuided)
  const config = usePublicConfig().data as { ai_configured?: boolean } | undefined
  const [i, setI] = useState(loadStep)
  useEffect(() => {
    try { localStorage.setItem(KEY, String(i)) } catch { /* storage unavailable */ }
  }, [i])

  const step = TOUR_STEPS[i]
  const total = TOUR_STEPS.length
  const aiNote = config?.ai_configured === undefined
    ? null
    : config.ai_configured
      ? 'AI is configured on this server: Project Lab will show "Live AI analysis".'
      : 'AI is not configured on this server: Project Lab will show "Demo analysis (deterministic fallback)". The flow still works.'

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Guided demo" side>
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs font-semibold text-muted">
          <span aria-live="polite">Step {i + 1} of {total}</span>
          <span>{done.length} visited</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-label="Tour progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={i + 1}>
          <div className="h-full rounded-full bg-brand transition-[width] motion-reduce:transition-none" style={{ width: `${((i + 1) / total) * 100}%` }} />
        </div>
      </div>

      <section aria-labelledby="gd-step-h" className="rounded-xl border border-line bg-surface p-4">
        <h3 id="gd-step-h" className="text-base font-semibold">{i + 1}. {step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.text}</p>
        {step.id === 'analyse' && aiNote && <p className="mt-2 rounded-lg bg-brand-subtle p-2 text-xs text-fg">{aiNote}</p>}
        <Link
          to={step.to}
          onClick={() => { mark(step.id); setOpen(false) }}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:opacity-90"
        >
          {step.cta} <IconArrowRight size={16} />
        </Link>
      </section>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}><IconChevronLeft size={16} /> Previous</Button>
        <Button variant="secondary" disabled={i === total - 1} onClick={() => setI(i + 1)}>Next <IconChevronRight size={16} /></Button>
      </div>

      <nav aria-label="Jump to step" className="mt-4">
        <ol className="flex flex-wrap gap-1.5">
          {TOUR_STEPS.map((s, n) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setI(n)}
                aria-label={`Step ${n + 1}: ${s.title}`}
                aria-current={n === i ? 'step' : undefined}
                title={s.title}
                className={cx(
                  'grid h-11 w-11 place-items-center rounded-lg border text-sm font-semibold focus-visible:outline-2',
                  n === i ? 'border-brand bg-brand text-white' : done.includes(s.id) ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-line bg-surface text-fg hover:bg-surface2',
                )}
              >
                {n + 1}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <p className="mt-4 rounded-lg bg-surface2 p-3 text-xs leading-relaxed text-muted">
        The tour only navigates and explains. It never submits, approves, rejects, cancels or resets anything: every data change needs your own deliberate click.
        Requester and reviewer identities are simulated, and all data is fictional sample data. You can leave the tour and explore freely at any time.
      </p>
      <Button variant="ghost" className="mt-3" onClick={() => setOpen(false)}>Exit tour</Button>
    </Modal>
  )
}
