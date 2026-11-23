import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Chip, Modal, Notice, Textarea } from '@/components/ui'
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

  return (
    <Card className={embedded ? 'flex flex-col gap-3' : 'mx-auto flex max-w-3xl flex-col gap-3'}>
      <Notice tone="info">The assistant gives suggestions only. It never books equipment — use the booking form to submit a request.</Notice>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
        {SUGGESTED.map((s) => (
          <Button key={s} size="sm" variant="secondary" disabled={ask.isPending} onClick={() => send(s)}>{s}</Button>
        ))}
      </div>

      <div className="max-h-[50vh] min-h-40 space-y-3 overflow-y-auto rounded-xl border border-line bg-bg p-3" role="log" aria-live="polite" aria-label="Conversation">
        {msgs.length === 0 && <p className="text-sm text-muted">Ask about equipment, availability or alternatives.</p>}
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-sky-600/30 px-3 py-2 text-sm">{m.text}</div>
          ) : m.role === 'error' ? (
            <div key={i} role="alert" className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">⚠ {m.text}</div>
          ) : (
            <div key={i} className="max-w-[95%] space-y-2 rounded-2xl border border-line bg-surface px-3 py-2 text-sm">
              <p className="whitespace-pre-wrap break-words">{m.reply.reply}</p>
              <div><Chip tone={m.reply.source === 'openai' ? 'ai' : 'neutral'} icon={m.reply.source === 'openai' ? '✨' : '⚙'}>{m.reply.source === 'openai' ? 'AI' : 'Rule-based answer'}</Chip></div>
              {m.reply.references.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="References">
                  {m.reply.references.map((r) => (
                    <button key={`${r.type}-${r.id}`} type="button" onClick={() => refTo(r)} className="min-h-9 rounded-full border border-line bg-bg px-3 text-xs font-semibold hover:bg-surface2">
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
              {m.reply.suggested_actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {m.reply.suggested_actions.map((a, j) => <Button key={j} size="sm" variant="ai" onClick={() => act(a)}>{a.label}</Button>)}
                </div>
              )}
            </div>
          ),
        )}
        {ask.isPending && <p className="text-sm text-muted" role="status">Assistant is thinking…</p>}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(text) }} className="space-y-2" aria-label="Ask the assistant">
        <label htmlFor="as-msg" className="text-sm font-semibold">Your question</label>
        <Textarea id="as-msg" value={text} maxLength={MAX} className="min-h-20" onChange={(e) => setText(e.target.value)} placeholder="e.g. Which equipment can I use for computer vision?" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">{text.length}/{MAX}</span>
          <Button type="submit" variant="ai" loading={ask.isPending} disabled={!text.trim()}>Send</Button>
        </div>
      </form>

      <Modal open={!!formFor} onClose={() => setFormFor(null)} title="Request a booking" wide>
        {formFor && <BookingForm equipmentId={formFor} embedded onCancel={() => setFormFor(null)} />}
      </Modal>
    </Card>
  )
}
