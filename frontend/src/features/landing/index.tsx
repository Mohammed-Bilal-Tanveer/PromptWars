import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Notice, Stat, errorMessage,
  IconArrowRight, IconBuilding, IconCheckSquare, IconClock, IconCube, IconFlask, IconLayers, IconSearch, IconSliders,
} from '@/components/ui'
import { LogoMark } from '@/components/layout/ProfessionalLayout'
import { useConnectionStore } from '@/features/connection/connectionStore'
import { useAnalyticsOverview, useDepartments } from '@/hooks/useApi'
import { ROUTES } from '@/lib/routes'
import { DemoEntryActions } from './DemoEntryActions'

const FEATURES = [
  { icon: IconFlask, title: 'AI Project Analysis', text: 'An AI model reads your project description and lists the capabilities it needs. When no AI key is configured, a clearly labelled deterministic fallback runs instead.' },
  { icon: IconSearch, title: 'Intelligent Matching', text: 'Deterministic code matches each capability to real catalogue entries and says plainly when the campus does not have it.' },
  { icon: IconSliders, title: 'Fair Scheduling', text: 'An OR-Tools solver, not AI, weighs deadlines, waiting time and fairness when requests compete for the same slot.' },
  { icon: IconCube, title: 'Interactive Campus', text: 'Walk the 3D campus, step into labs and see live equipment status. Professional Mode covers the same data without WebGL.' },
]

const FLOW = ['Understand', 'Discover', 'Optimise', 'Access']

export function Landing() {
  const conn = useConnectionStore((c) => c.state)
  const overview = useAnalyticsOverview()
  const depts = useDepartments()
  const o = overview.data
  const labs = depts.data?.reduce((n, d) => n + d.lab_count, 0)
  const failed = overview.isError || depts.isError
  const retry = () => {
    overview.refetch()
    depts.refetch()
  }
  const waking = conn === 'waking' || conn === 'unavailable' || failed
  const val = (v: number | undefined) => (v === undefined ? '…' : v)

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
            <LogoMark />
            LabLink
          </div>
          <Link to={ROUTES.overview} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-surface2 hover:text-fg">
            Go to dashboard <IconArrowRight size={16} />
          </Link>
        </div>
      </header>

      <section className="border-b border-line bg-gradient-to-b from-surface to-bg">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
            Campus laboratory equipment sharing
          </p>
          <h1 className="mt-5 max-w-3xl text-[32px] font-semibold leading-[1.15] tracking-tight sm:text-5xl sm:leading-[1.1]">
            From Project Idea to Lab Access.
          </h1>
          <p className="mt-2 text-sm font-medium text-brand">Your Campus. Your Labs. One Connected World.</p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Describe a project, find the specialised equipment it needs across departments, and request a booking — without chasing emails between labs.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <EntryCard
              to={ROUTES.overview}
              icon={<IconLayers size={22} />}
              title="Professional Mode"
              text="Dashboard, equipment catalogue, Project Lab, booking requests, approvals and analytics."
              cta="Open Professional Mode"
            />
            <EntryCard
              to={ROUTES.campus3d}
              icon={<IconCube size={22} />}
              title="3D Campus Mode"
              text="Walk between buildings, step into labs, inspect equipment and book from inside the scene."
              cta="Enter the campus"
            />
          </div>

          <div className="mt-6">
            <DemoEntryActions />
          </div>
          <p role="status" className="mt-4 flex items-center gap-2 text-xs text-muted">
            <span className={'h-2 w-2 rounded-full ' + (waking ? 'bg-amber-500' : conn === 'connected' ? 'bg-emerald-600' : 'bg-line-strong')} aria-hidden />
            {waking ? 'Backend is waking up… live figures may take a moment.' : conn === 'connected' ? 'Backend connected.' : 'Checking backend…'}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
        <section aria-labelledby="impact-h" aria-live="polite">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="impact-h" className="text-lg font-semibold">Campus at a glance</h2>
            <p className="text-sm text-muted">{o?.data_label ?? 'Sample campus data'}</p>
          </div>
          {failed && (
            <div className="mb-4">
              <Notice tone="warn" title="Live figures unavailable">
                {errorMessage(overview.error ?? depts.error)}{' '}
                <button type="button" className="link ml-1 min-h-11" onClick={retry}>Retry</button>
              </Notice>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Equipment units" value={val(o?.total_units)} icon={<IconLayers size={18} />} gradient="brand" />
            <Stat label="Laboratories" value={val(o?.laboratory_count ?? labs)} icon={<IconBuilding size={18} />} gradient="neutral" />
            <Stat label="Pending requests" value={val(o?.pending_requests)} icon={<IconClock size={18} />} gradient="warn" />
            <Stat label="Active bookings" value={val(o?.active_bookings)} icon={<IconCheckSquare size={18} />} gradient="avail" />
          </div>
        </section>

        <section aria-labelledby="feat-h">
          <h2 id="feat-h" className="text-lg font-semibold">What LabLink does</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-subtle text-brand" aria-hidden><f.icon size={20} /></span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how-h">
          <h2 id="how-h" className="text-lg font-semibold">How it works</h2>
          <ol className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Workflow">
            {FLOW.map((f, i) => (
              <li key={f} className="relative flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white" aria-hidden>{i + 1}</span>
                <span className="font-semibold">{f}</span>
                {i < FLOW.length - 1 && <IconArrowRight size={16} className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-subtle md:block" />}
              </li>
            ))}
          </ol>
        </section>

        <Notice tone="info" title="About this demo">
          All campus data is fictional sample data. Requester and reviewer identities are simulated, no login is required, and nothing here books real equipment.
        </Notice>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-subtle sm:px-6">LabLink · Sample campus data</div>
      </footer>
    </div>
  )
}

function EntryCard({ to, icon, title, text, cta }: { to: string; icon: ReactNode; title: string; text: string; cta: string }) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card transition-[border-color,box-shadow] hover:border-brand-muted hover:shadow-raised"
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-subtle text-brand" aria-hidden>{icon}</span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
        {cta} <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
