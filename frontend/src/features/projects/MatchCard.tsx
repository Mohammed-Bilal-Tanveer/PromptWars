import { Button, Card, Chip, Notice, ProgressBar, StatusChip, IconClock, IconDot, IconMapPin } from '@/components/ui'
import type { MatchCandidate, RequirementMatch } from '@/types/api'

function CandidateView({ c, onView, onBook, onFind }: { c: MatchCandidate; onView: () => void; onBook: () => void; onFind: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface2/50 p-3.5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-semibold">{c.name}</p>
          <p className="text-xs text-muted">{c.laboratory_name} · {c.department_name} · {c.building}, {c.room_label}</p>
        </div>
        <Chip tone={c.is_available ? 'ok' : 'warn'} icon={c.is_available ? <IconDot size={10} /> : <IconClock size={13} strokeWidth={2} />}>{c.available_units}/{c.total_units} units available</Chip>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="w-full max-w-48"><ProgressBar value={c.score} label={`Match score for ${c.name}`} gradient="ai" /></div>
        <span className="tnum text-xs font-medium text-muted">Match score <span className="text-fg">{Math.round(c.score)}</span>/100</span>
      </div>
      {c.evidence.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted marker:text-subtle">
          {c.evidence.map((ev, i) => <li key={i}>{ev}</li>)}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onView}>View equipment<span className="sr-only">: {c.name}</span></Button>
        <Button size="sm" onClick={onBook}>Request booking<span className="sr-only">: {c.name}</span></Button>
        <Button size="sm" variant="secondary" onClick={onFind}><IconMapPin size={16} /> Find in 3D Campus<span className="sr-only">: {c.name}</span></Button>
      </div>
    </div>
  )
}

export function MatchCard({ m, onView, onBook, onFind }: { m: RequirementMatch; onView: (id: string) => void; onBook: (id: string) => void; onFind: (id: string, label: string) => void }) {
  const others = m.candidates.filter((c) => c.equipment_type_id !== m.best?.equipment_type_id)
  return (
    <Card as="article" aria-label={m.requirement_name}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-semibold">{m.requirement_name}</h4>
        <div className="flex flex-wrap gap-1.5">
          <StatusChip status={m.priority} />
          <StatusChip status={m.match_status} />
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">{m.reason}</p>
      {m.match_status === 'unmatched' || !m.best ? (
        <div className="mt-3"><Notice tone="warn" title="No matching equipment in the catalogue">
          The campus catalogue has nothing that fits this requirement. Consider an external partner or adjusting the project.
        </Notice></div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Best candidate</p>
          <CandidateView c={m.best} onView={() => onView(m.best!.equipment_type_id)} onBook={() => onBook(m.best!.equipment_type_id)} onFind={() => onFind(m.best!.equipment_type_id, m.best!.name)} />
          {others.length > 0 && (
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center py-2 text-sm font-medium text-muted hover:text-fg">Other candidates ({others.length})</summary>
              <div className="space-y-2">
                {others.map((c) => (
                  <CandidateView key={c.equipment_type_id} c={c} onView={() => onView(c.equipment_type_id)} onBook={() => onBook(c.equipment_type_id)} onFind={() => onFind(c.equipment_type_id, c.name)} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </Card>
  )
}
