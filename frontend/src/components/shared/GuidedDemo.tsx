import { Link } from 'react-router-dom'
import { Button, IconArrowRight, Modal, cx } from '@/components/ui'
import { ROUTES } from '@/lib/routes'
import { useAppStore } from '@/stores/appStore'

const STEPS = [
  { id: 'project', title: 'Describe your project', text: 'Open Project Lab, click “Use sample project”, run the analysis.', to: ROUTES.projectLab },
  { id: 'matches', title: 'Review equipment matches', text: 'See required vs recommended equipment matched to real catalogue records.', to: ROUTES.projectLab },
  { id: 'equipment', title: 'Open a matched equipment item', text: 'Inspect units, specs and availability for a date.', to: ROUTES.discover },
  { id: 'book', title: 'Submit a booking request', text: 'Pick a date and time window and request the booking.', to: ROUTES.discover },
  { id: 'approve', title: 'Review in the Demo Approval Desk', text: 'Approve, reject or propose an alternative (simulated reviewer).', to: ROUTES.approvals },
  { id: 'track', title: 'Check My Requests', text: 'Confirm the status changed and the booking is confirmed.', to: ROUTES.requests },
  { id: 'conflict', title: 'Trigger a conflict in Scheduling Studio', text: 'Try the GPU workstation tomorrow 14:00–16:00 — it is fully booked; see OR-Tools alternatives.', to: ROUTES.scheduling },
  { id: '3d', title: 'Switch to 3D Campus', text: 'Walk to the CS building, inspect the same equipment, visit the Operations Centre.', to: ROUTES.campus3d },
  { id: 'analytics', title: 'Inspect analytics', text: 'Counts reflect the stored bookings and requests.', to: ROUTES.analytics },
]

/** Checklist only — never performs actions for the evaluator. */
export function GuidedDemo() {
  const open = useAppStore((s) => s.guidedDemoOpen)
  const setOpen = useAppStore((s) => s.setGuidedDemoOpen)
  const done = useAppStore((s) => s.guidedDone)
  const mark = useAppStore((s) => s.markGuided)
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Guided demo" side>
      <p className="mb-3 text-sm text-muted">
        A suggested path through LabLink. Each step opens the relevant screen — you perform the actions; nothing is auto-completed.
      </p>
      <ol className="flex flex-col gap-2">
        {STEPS.map((s, i) => {
          const checked = done.includes(s.id)
          return (
            <li key={s.id} className={cx('rounded-xl border p-3 transition-colors', checked ? 'border-emerald-200 bg-emerald-50' : 'border-line bg-surface')}>
              <div className="flex items-start gap-3">
                <input
                  id={`gd-${s.id}`}
                  type="checkbox"
                  checked={checked}
                  onChange={() => mark(s.id)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700"
                  aria-label={`Mark step ${i + 1} done`}
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={`gd-${s.id}`} className={cx('text-sm font-semibold', checked && 'text-emerald-900')}>{i + 1}. {s.title}</label>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{s.text}</p>
                </div>
                <Link
                  to={s.to}
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-line-strong bg-surface px-2.5 text-xs font-semibold text-fg hover:bg-surface2"
                >
                  Go <IconArrowRight size={14} />
                </Link>
              </div>
            </li>
          )
        })}
      </ol>
      <Button variant="secondary" className="mt-4" onClick={() => setOpen(false)}>Close</Button>
    </Modal>
  )
}
