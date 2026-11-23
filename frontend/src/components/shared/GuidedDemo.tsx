import { Link } from 'react-router-dom'
import { Button, Modal, cx } from '@/components/ui'
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
            <li key={s.id} className={cx('rounded-xl border p-3', checked ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-line bg-bg')}>
              <div className="flex items-start gap-3">
                <input
                  id={`gd-${s.id}`}
                  type="checkbox"
                  checked={checked}
                  onChange={() => mark(s.id)}
                  className="mt-1 h-5 w-5 accent-emerald-500"
                  aria-label={`Mark step ${i + 1} done`}
                />
                <div className="flex-1">
                  <label htmlFor={`gd-${s.id}`} className="font-semibold">{i + 1}. {s.title}</label>
                  <p className="text-xs text-muted">{s.text}</p>
                </div>
                <Link to={s.to} onClick={() => setOpen(false)} className="min-h-9 rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-surface2">
                  Go →
                </Link>
              </div>
            </li>
          )
        })}
      </ol>
      <Button variant="ghost" className="mt-4" onClick={() => setOpen(false)}>Close</Button>
    </Modal>
  )
}
