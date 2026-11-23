import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Chip, Modal, Notice, PageHeader, Textarea, IconAlert, IconInfo, IconMessage, IconSend, IconSliders } from '@/components/ui'
import { useAssistant } from '@/hooks/useApi'
import { useAppStore } from '@/stores/appStore'
import { ROUTES } from '@/lib/routes'
import { BookingForm } from '@/features/bookings/BookingForm'
import { apiDetails } from '@/features/bookings/parts'
import type { AssistantReply } from '@/types/api'

type Ctx = { equipment_type_id?: string; booking_request_id?: string; project_id?: string; laboratory_id?: string }
type Msg = { role: 'user'; text: string } | { role: 'assistant'; reply: AssistantReply } | { role: 'error'; text: string }

const SUGGESTED = [
  'Which lab has equipment for embedded systems?',
  'What are the earliest alternatives for my project?',
  'Why is the GPU workstation unavailable?',
]
const MAX = 1000

/** AI Scheduling Assistant. `context` pins the conversation to an equipment/request/project. */
export function AssistantPanel({ embedded, context }: { embedded?: boolean; context?: Ctx }) {
  const [text, setText] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [formFor, setFormFor] = useState<string | null>(null)
  const ask = useAssistant()
  const nav = useNavigate()
  const setDraft = useAppStore((s) => s.setBookingDraft)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }) }, [msgs.length, ask.isPending])

  const send = (message: string) => {
    const m = message.trim()
    if (!m || m.length > MAX || ask.isPending) return
    setMsgs((x) => [...x, { role: 'user', text: m }])
    setText('')
    ask.mutate(
      { message: m, context: context && Object.keys(context).length ? context : undefined },
      {
        onSuccess: (reply) => setMsgs((x) => [...x, { role: 'assistant', reply }]),
        onError: (e) => {
          const d = apiDetails(e)
          setMsgs((x) => [...x, { role: 'error', text: d.status === 429 || d.code === 'RATE_LIMITED' ? 'You are asking too quickly. Please wait a minute and try again.' : d.message }])
        },
      },
    )
  }

  const act = (a: AssistantReply['suggested_actions'][number]) => {
    const p = a.params ?? {}
    switch (a.action) {
      case 'open_equipment': {
        const id = p.equipment_type_id ?? p.id ?? p.equipment_id
        nav(id ? ROUTES.equipment(id) : ROUTES.discover)
        break
      }
      case 'open_booking_form': {
        const id = p.equipment_type_id ?? p.id ?? p.equipment_id
        if (!id) { nav(ROUTES.discover); break }
        setDraft({ equipmentId: id, start: p.start, end: p.end, projectTitle: p.project_title, purpose: p.purpose })
        setFormFor(id)
        break
      }
      case 'open_scheduling': nav(ROUTES.scheduling); break
      case 'open_approvals': nav(ROUTES.approvals); break
      case 'open_project_lab': nav(ROUTES.projectLab); break
    }
  }

  const refTo = (r: AssistantReply['references'][number]) => {
    if (r.type === 'equipment') nav(ROUTES.equipment(r.id))
    else if (r.type === 'booking_request') nav(ROUTES.requests)
    else if (r.type === 'laboratory') nav(ROUTES.lab(r.id))
    else nav(ROUTES.projectLab)
  }

  const panel = (
    <Card className={embedded ? 'flex flex-col gap-4' : 'flex flex-col gap-4'}>
      <Notice tone="info">The assistant gives suggestions only. It never books equipment — use the booking form to submit a request.</Notice>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
        {SUGGESTED.map((s) => (
          <Button key={s} size="sm" variant="secondary" disabled={ask.isPending} onClick={() => send(s)}>{s}</Button>
        ))}
      </div>

      <div className="max-h-[50vh] min-h-48 space-y-3 overflow-y-auto rounded-xl border border-line bg-bg p-3 sm:p-4" role="log" aria-live="polite" aria-label="Conversation">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-subtle shadow-card" aria-hidden><IconMessage size={20} /></span>
            Ask about equipment, availability or alternatives.
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-sm text-white">{m.text}</div>
          ) : m.role === 'error' ? (
            <div key={i} role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-900"><IconAlert size={16} className="mt-0.5 shrink-0 text-red-600" /> {m.text}</div>
          ) : (
            <div key={i} className="max-w-[95%] space-y-2.5 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5 text-sm shadow-card">
              <p className="whitespace-pre-wrap break-words leading-relaxed">{m.reply.reply}</p>
              <div><Chip tone={m.reply.source === 'openai' ? 'ai' : 'neutral'} icon={m.reply.source === 'openai' ? <IconInfo size={13} strokeWidth={2} /> : <IconSliders size={13} strokeWidth={2} />}>{m.reply.source === 'openai' ? 'AI-generated answer' : 'Rule-based answer'}</Chip></div>
              {m.reply.references.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="References">
                  {m.reply.references.map((r) => (
                    <button key={`${r.type}-${r.id}`} type="button" onClick={() => refTo(r)} className="min-h-9 rounded-full border border-line-strong bg-surface px-3 text-xs font-medium text-fg hover:bg-surface2">
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
              {m.reply.suggested_actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {m.reply.suggested_actions.map((a, j) => <Button key={j} size="sm" variant="secondary" onClick={() => act(a)}>{a.label}</Button>)}
                </div>
              )}
            </div>
          ),
        )}
        {ask.isPending && <p className="text-sm text-muted" role="status">Looking that up…</p>}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(text) }} className="space-y-2" aria-label="Ask the assistant">
        <label htmlFor="as-msg" className="block text-sm font-medium">Your question</label>
        <Textarea id="as-msg" value={text} maxLength={MAX} className="min-h-20" onChange={(e) => setText(e.target.value)} placeholder="e.g. Which equipment can I use for computer vision?" />
        <div className="flex items-center justify-between gap-2">
          <span className="tnum text-xs text-subtle">{text.length}/{MAX}</span>
          <Button type="submit" variant="primary" loading={ask.isPending} disabled={!text.trim()}><IconSend size={16} /> Send</Button>
        </div>
      </form>

      <Modal open={!!formFor} onClose={() => setFormFor(null)} title="Request a booking" wide>
        {formFor && <BookingForm equipmentId={formFor} embedded onCancel={() => setFormFor(null)} />}
      </Modal>
    </Card>
  )
  if (embedded) return panel
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Assistant" subtitle="Ask where to find equipment, why something is unavailable, or what the earliest alternatives are." />
      {panel}
    </div>
  )
}
