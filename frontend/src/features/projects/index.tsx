import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Chip, Field, Input, Modal, Notice, PageHeader, ProgressBar, Select, StatusChip, Textarea, errorMessage, cx,
  IconAlert, IconClock, IconDot, IconMapPin, IconPlus, IconX,
} from '@/components/ui'
import { ApiError } from '@/services/apiClient'
import { useAnalyseProject, useCreateProject, useDepartments } from '@/hooks/useApi'
import { campusDate, localISO } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import { toast, useAppStore } from '@/stores/appStore'
import { BookingForm } from '@/features/bookings'
import type { AnalysisResult, MatchCandidate, ProjectAnalyseRequest, RequirementMatch } from '@/types/api'

const MAX_DESC = 8000
const CATEGORIES = ['Robotics', 'AI / Machine learning', 'IoT and sensors', 'Embedded systems', 'Biotechnology', 'Materials and civil', 'Manufacturing', 'Other']

export const SAMPLE_PROJECT = {
  title: 'Autonomous agricultural monitoring robot',
  description:
    'I am building an autonomous agricultural monitoring robot. I need to test object detection, integrate sensors, connect a microcontroller, and develop a small physical prototype. My project submission is in two weeks.',
  category: 'Robotics',
}

function analyseErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 429) return 'You are analysing too quickly. Please wait a minute and try again.'
  return errorMessage(e)
}

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

function MatchCard({ m, onView, onBook, onFind }: { m: RequirementMatch; onView: (id: string) => void; onBook: (id: string) => void; onFind: (id: string, label: string) => void }) {
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

export function ProjectLab({ embedded, onViewMatch, onBook, onFind }: { embedded?: boolean; onViewMatch?: (equipmentId: string) => void; onBook?: (equipmentId: string) => void; onFind?: (equipmentId: string, label: string) => void }) {
  const navigate = useNavigate()
  const store = useAppStore()
  const depts = useDepartments()
  const analyse = useAnalyseProject()
  const createProject = useCreateProject()

  const [title, setTitle] = useState(store.lastAnalysisInput?.title ?? '')
  const [description, setDescription] = useState(store.lastAnalysisInput?.description ?? '')
  const [category, setCategory] = useState('')
  const [deadline, setDeadline] = useState('')
  const [prefDepts, setPrefDepts] = useState<string[]>([])
  const [prefDate, setPrefDate] = useState('')
  const [prefStart, setPrefStart] = useState('')
  const [prefEnd, setPrefEnd] = useState('')
  const [hours, setHours] = useState('')
  const [constraints, setConstraints] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [result, setResult] = useState<AnalysisResult | null>(store.lastAnalysis)
  const [assumptions, setAssumptions] = useState<string[]>(store.lastAnalysis?.assumptions ?? [])
  const [estHours, setEstHours] = useState<string>(store.lastAnalysis ? String(store.lastAnalysis.estimated_total_hours) : '')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [bookTarget, setBookTarget] = useState<string | null>(null)
  const [nameFor, setNameFor] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')

  const editedResult = useMemo<AnalysisResult | null>(
    () => (result ? { ...result, assumptions: assumptions.map((a) => a.trim()).filter(Boolean), estimated_total_hours: Number(estHours) || result.estimated_total_hours } : null),
    [result, assumptions, estHours],
  )

  const useSample = () => {
    setTitle(SAMPLE_PROJECT.title)
    setDescription(SAMPLE_PROJECT.description)
    setCategory(SAMPLE_PROJECT.category)
    setDeadline(campusDate(14))
    setErrors({})
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'Project title is required.'
    if (description.trim().length < 10) e.description = 'Please describe your project in at least 10 characters.'
    if (description.length > MAX_DESC) e.description = `Description must be at most ${MAX_DESC} characters.`
    if ((prefStart || prefEnd) && !(prefDate && prefStart && prefEnd)) e.window = 'Provide date, start and end time for a preferred window.'
    else if (prefStart && prefEnd && prefEnd <= prefStart) e.window = 'End time must be after start time.'
    if (hours && !(Number(hours) > 0)) e.hours = 'Estimated hours must be a positive number.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    const body: ProjectAnalyseRequest = {
      title: title.trim(),
      description: description.trim(),
      category: category || undefined,
      deadline: deadline || undefined,
      preferred_department_ids: prefDepts.length ? prefDepts : undefined,
      preferred_window: prefDate && prefStart && prefEnd ? { start_at: localISO(prefDate, prefStart), end_at: localISO(prefDate, prefEnd) } : undefined,
      estimated_total_hours: hours ? Number(hours) : undefined,
      constraints: constraints.trim() || undefined,
    }
    analyse.mutate(body, {
      onSuccess: (r) => {
        setResult(r)
        setAssumptions(r.assumptions)
        setEstHours(String(r.estimated_total_hours))
        setProjectId(null)
        store.setLastAnalysis(r, { title: body.title, description: body.description })
        store.setHighlightedEquipmentIds(
          Array.from(new Set(r.matches.map((m) => m.best?.equipment_type_id).filter((x): x is string => !!x))),
        )
      },
    })
  }

  const find = (id: string, label: string) => {
    store.setFindInCampus({ equipmentId: id, label })
    if (onFind) onFind(id, label)
    else navigate(ROUTES.campus3d)
  }
  const view = (id: string) => (onViewMatch ? onViewMatch(id) : navigate(ROUTES.equipment(id)))

  const saveProject = async (name: string): Promise<string | null> => {
    if (projectId) return projectId
    if (!editedResult) return null
    try {
      const p = await createProject.mutateAsync({
        title: title.trim() || SAMPLE_PROJECT.title,
        description: description.trim(),
        category: category || undefined,
        requester_name: name,
        requester_department_id: store.requester.departmentId || undefined,
        deadline: deadline || undefined,
        estimated_total_hours: editedResult.estimated_total_hours,
        analysis: editedResult,
      })
      setProjectId(p.id)
      toast.success('Project saved', p.title)
      return p.id
    } catch (e) {
      toast.error('Could not save project', errorMessage(e))
      return null
    }
  }

  const proceedBooking = async (equipmentId: string, name: string) => {
    const id = await saveProject(name)
    if (!id) return
    store.setBookingDraft({
      equipmentId,
      projectId: id,
      projectTitle: title.trim() || SAMPLE_PROJECT.title,
      estimatedHours: editedResult?.estimated_total_hours,
    })
    setBookTarget(equipmentId)
  }

  const requestBooking = (equipmentId: string) => {
    if (onBook) return onBook(equipmentId)
    const name = store.requester.name.trim()
    if (!name) {
      setNameFor(equipmentId)
      return
    }
    void proceedBooking(equipmentId, name)
  }

  const toggleDept = (id: string) => setPrefDepts((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const requirements = (kind: 'required' | 'recommended') =>
    result?.matches.filter((m) => (kind === 'required' ? m.priority === 'required' : m.priority !== 'required')) ?? []

  return (
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          title="Project Lab"
          subtitle="Describe your project and we'll match it to campus equipment."
        />
      )}
      <Card as="section" aria-label="Project details">
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
            <div>
              <h2 className="text-base font-semibold sm:text-[17px]">Your project</h2>
              <p className="mt-0.5 text-sm text-muted">A few plain sentences are enough. Optional fields help the scheduler later.</p>
            </div>
            <Button type="button" variant="secondary" onClick={useSample}>Use sample project</Button>
          </div>
          <Field label="Project title" htmlFor="pl-title" error={errors.title}>
            <Input id="pl-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-invalid={!!errors.title} />
          </Field>
          <Field label="Description" htmlFor="pl-desc" error={errors.description} hint="What are you building and what do you need to test or make?">
            <Textarea id="pl-desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={!!errors.description} />
            <p className={`tnum text-right text-xs ${description.length > MAX_DESC ? 'font-medium text-red-700' : 'text-subtle'}`} aria-live="polite">{description.length}/{MAX_DESC}</p>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Category" htmlFor="pl-cat">
              <Select id="pl-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Not specified</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Deadline" htmlFor="pl-deadline">
              <Input id="pl-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>
            <Field label="Estimated total hours (optional)" htmlFor="pl-hours" error={errors.hours}>
              <Input id="pl-hours" type="number" min={0} step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
            </Field>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Preferred departments (optional)</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {depts.data?.map((d) => (
                <label
                  key={d.id}
                  className={cx(
                    'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors lg:min-h-10',
                    prefDepts.includes(d.id) ? 'border-brand-muted bg-brand-subtle text-brand-fg' : 'border-line-strong bg-surface hover:bg-surface2',
                  )}
                >
                  <input type="checkbox" className="h-4 w-4 accent-[#1d4ed8]" checked={prefDepts.includes(d.id)} onChange={() => toggleDept(d.id)} />
                  {d.name}
                </label>
              ))}
              {!depts.data && <span className="text-sm text-muted">{depts.isError ? 'Departments unavailable.' : 'Loading departments…'}</span>}
            </div>
          </fieldset>
          <div>
            <p className="text-sm font-medium">Preferred time window (optional)</p>
            <div className="mt-1.5 grid gap-3 rounded-xl border border-line bg-surface2/50 p-3 sm:grid-cols-3">
              <Field label="Preferred date" htmlFor="pl-pdate"><Input id="pl-pdate" type="date" min={campusDate()} value={prefDate} onChange={(e) => setPrefDate(e.target.value)} /></Field>
              <Field label="Start time" htmlFor="pl-pstart"><Input id="pl-pstart" type="time" value={prefStart} onChange={(e) => setPrefStart(e.target.value)} /></Field>
              <Field label="End time" htmlFor="pl-pend"><Input id="pl-pend" type="time" value={prefEnd} onChange={(e) => setPrefEnd(e.target.value)} /></Field>
            </div>
            {errors.window && <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-700"><IconAlert size={14} /> {errors.window}</p>}
          </div>
          <Field label="Constraints (optional)" htmlFor="pl-constraints">
            <Textarea id="pl-constraints" rows={2} value={constraints} onChange={(e) => setConstraints(e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button type="submit" variant="primary" size="lg" loading={analyse.isPending}>Analyse project</Button>
            {analyse.isPending && <span className="text-sm text-muted" role="status">Analysing… this can take a few seconds.</span>}
          </div>
        </form>
        <div aria-live="assertive" className="mt-3">
          {analyse.isError && <Notice tone="danger" title="Analysis failed">{analyseErrorMessage(analyse.error)}</Notice>}
        </div>
      </Card>

      <div aria-live="polite">
        {result && editedResult && (
          <section className="space-y-4" aria-label="Analysis results">
            {result.is_fallback ? (
              <Notice tone="warn" title="Demo analysis (deterministic fallback)">
                This result came from keyword rules, not a live AI model.
                {result.fallback_reason ? ` Reason: ${result.fallback_reason}.` : ''} Equipment matching is still real catalogue data.
              </Notice>
            ) : (
              <Notice tone="ai" title="Live AI analysis">Generated by an AI model; equipment matches come from the real catalogue.</Notice>
            )}

            <Card>
              <h3 className="text-base font-semibold sm:text-[17px]">Project summary</h3>
              <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-muted">{result.project_summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Capabilities">
                {result.capabilities.map((c) => <Chip key={c} tone="neutral">{c.replace(/_/g, ' ')}</Chip>)}
              </div>
              {result.reasoning_summary && <p className="mt-3 text-xs text-muted">{result.reasoning_summary}</p>}
              {result.suggested_departments.length > 0 && (
                <p className="mt-2 text-xs text-muted">Suggested departments: {result.suggested_departments.map((d) => d.name).join(', ')}</p>
              )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card as="section" aria-label="Assumptions">
                <h3 className="font-semibold">Assumptions (editable)</h3>
                <Field label="Estimated total hours" htmlFor="pl-esthours" className="mt-2 max-w-48">
                  <Input id="pl-esthours" type="number" min={0} step="0.5" value={estHours} onChange={(e) => setEstHours(e.target.value)} />
                </Field>
                <ul className="mt-3 space-y-2">
                  {assumptions.map((a, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Input aria-label={`Assumption ${i + 1}`} value={a} onChange={(e) => setAssumptions((s) => s.map((x, j) => (j === i ? e.target.value : x)))} />
                      <Button type="button" variant="ghost" size="sm" aria-label={`Remove assumption ${i + 1}`} onClick={() => setAssumptions((s) => s.filter((_, j) => j !== i))}><IconX size={16} /></Button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setAssumptions((s) => [...s, ''])}><IconPlus size={16} /> Add assumption</Button>
                  {!onBook && (
                    <Button type="button" size="sm" loading={createProject.isPending} disabled={!!projectId} onClick={() => {
                      const n = store.requester.name.trim()
                      if (!n) setNameFor('__save__')
                      else void saveProject(n)
                    }}>
                      {projectId ? 'Project saved' : 'Save project'}
                    </Button>
                  )}
                </div>
              </Card>
              <div className="space-y-4">
                <Card as="section" aria-label="Safety considerations">
                  <h3 className="font-semibold">Safety considerations</h3>
                  {result.safety_considerations.length === 0 ? <p className="mt-1 text-sm text-muted">None identified.</p> : (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted marker:text-subtle">{result.safety_considerations.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  )}
                </Card>
                <Card as="section" aria-label="Clarifying questions">
                  <h3 className="font-semibold">Clarifying questions</h3>
                  {result.clarifying_questions.length === 0 ? <p className="mt-1 text-sm text-muted">None.</p> : (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted marker:text-subtle">{result.clarifying_questions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  )}
                </Card>
              </div>
            </div>

            {(['required', 'recommended'] as const).map((kind) => {
              const list = requirements(kind)
              return (
                <section key={kind} aria-label={`${kind} equipment`}>
                  <h3 className="mb-3 text-base font-semibold sm:text-[17px]">{kind === 'required' ? 'Required equipment' : 'Recommended and optional equipment'}</h3>
                  {list.length === 0 ? <p className="text-sm text-muted">None.</p> : (
                    <div className="grid gap-3 xl:grid-cols-2">
                      {list.map((m, i) => <MatchCard key={`${m.requirement_name}-${i}`} m={m} onView={view} onBook={requestBooking} onFind={find} />)}
                    </div>
                  )}
                </section>
              )
            })}
          </section>
        )}
      </div>

      <Modal open={!!nameFor} onClose={() => setNameFor(null)} title="Who is requesting?">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const n = nameInput.trim()
            if (!n || !nameFor) return
            store.setRequester({ name: n, departmentId: store.requester.departmentId })
            const target = nameFor
            setNameFor(null)
            if (target === '__save__') void saveProject(n)
            else void proceedBooking(target, n)
          }}
          className="space-y-3"
        >
          <p className="text-sm text-muted">Enter your name so the project and booking request can be saved. No account is needed.</p>
          <Field label="Your name" htmlFor="pl-reqname"><Input id="pl-reqname" value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setNameFor(null)}>Cancel</Button>
            <Button type="submit" disabled={!nameInput.trim()}>Continue</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!bookTarget} onClose={() => setBookTarget(null)} title="Request booking" wide>
        {bookTarget && (
          <BookingForm
            equipmentId={bookTarget}
            onCancel={() => setBookTarget(null)}
            onSubmitted={() => { setBookTarget(null); store.setBookingDraft(null); toast.success('Booking request submitted', 'Track it under My Requests.') }}
          />
        )}
      </Modal>
    </div>
  )
}
