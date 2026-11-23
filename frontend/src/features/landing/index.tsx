import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Button, Notice, Stat, errorMessage,
  IconArrowRight, IconBuilding, IconCalendar, IconCheckSquare, IconClock, IconCube, IconFlask, IconLayers, IconListChecks, IconSliders,
} from '@/components/ui'
import { LogoMark } from '@/components/layout/ProfessionalLayout'
import { useAnalyticsOverview, useDepartments } from '@/hooks/useApi'
import { ROUTES } from '@/lib/routes'
import { useAppStore } from '@/stores/appStore'

const STEPS = [
  {
    icon: IconFlask,
    title: 'Describe your project',
    text: 'Write a few sentences in Project Lab. We list the capabilities you need and match each one to real catalogue entries — and say plainly when the campus does not have it.',
  },
  {
    icon: IconCalendar,
    title: 'Check availability and request',
    text: 'See free slots per unit, lab hours, setup and cleanup buffers, then submit a booking request for the window that suits you.',
  },
  {
    icon: IconSliders,
    title: 'Get a fair schedule',
    text: 'Reviewers approve or propose alternatives. When requests compete, an OR-Tools solver weighs deadlines, waiting time and fairness.',
  },
]

export function Landing() {
  const navigate = useNavigate()
  const overview = useAnalyticsOverview()
  const depts = useDepartments()
  const o = overview.data
  const labs = depts.data?.reduce((n, d) => n + d.lab_count, 0)
  const failed = overview.isError || depts.isError
  const retry = () => {
    overview.refetch()
    depts.refetch()
  }
  const startDemo = () => {
    useAppStore.getState().setGuidedDemoOpen(true)
    navigate(ROUTES.overview)
  }
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
            Your Campus. Your Labs. One Connected World.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Find specialised equipment in any department, see when it is free, and request a booking — without chasing emails between labs.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <EntryCard
              to={ROUTES.overview}
              icon={<IconLayers size={22} />}
              title="Professional Mode"
              text="Dashboard, equipment catalogue, Project Lab, booking requests, approvals and analytics."
              cta="Open the dashboard"
            />
            <EntryCard
              to={ROUTES.campus3d}
              icon={<IconCube size={22} />}
              title="Explore 3D Campus"
              text="Walk between buildings, step into labs, inspect equipment and book from inside the scene."
              cta="Enter the campus"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button size="lg" variant="secondary" onClick={() => navigate(ROUTES.discover)}>Explore demo</Button>
            <Button size="lg" variant="ghost" onClick={startDemo}><IconListChecks size={18} /> Try guided demo</Button>
          </div>
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
              <Notice tone="warn" title="The demo API may still be waking up">
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

        <section aria-labelledby="how-h">
          <h2 id="how-h" className="text-lg font-semibold">How it works</h2>
          <ol className="mt-4 grid gap-4 md:grid-cols-3" aria-label="How it works">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-subtle text-brand" aria-hidden><s.icon size={20} /></span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <Notice tone="info" title="About this demo">
          Hackathon demonstration using simulated campus data. No login required; nothing here books real equipment.
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
