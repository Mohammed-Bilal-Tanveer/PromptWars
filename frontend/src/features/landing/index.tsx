import { Link, useNavigate } from 'react-router-dom'
import { Button, Notice, Stat, errorMessage } from '@/components/ui'
import { useAnalyticsOverview, useDepartments } from '@/hooks/useApi'
import { ROUTES } from '@/lib/routes'
import { useAppStore } from '@/stores/appStore'

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
      <section className="animated-bg">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
          <div className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <span className="grad-brand inline-flex h-9 w-9 items-center justify-center rounded-xl" aria-hidden>L</span>
            LabLink
          </div>
          <h1 className="mt-8 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Your Campus. Your Labs. One Connected World.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">
            Discover specialised lab equipment, check live availability, describe a project to an AI analyser and let an
            optimisation engine find fair booking slots across departments.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Link to={ROUTES.overview} className="grad-sched block rounded-2xl p-6 shadow-lg transition hover:brightness-110">
              <div className="text-3xl" aria-hidden>🧪</div>
              <h2 className="mt-2 text-xl font-bold">Professional Mode</h2>
              <p className="mt-1 text-sm opacity-90">Dashboards, equipment catalogue, project analyser, booking requests and approvals.</p>
              <span className="mt-3 inline-block font-semibold">Open the dashboard →</span>
            </Link>
            <Link to={ROUTES.campus3d} className="grad-ai block rounded-2xl p-6 shadow-lg transition hover:brightness-110">
              <div className="text-3xl" aria-hidden>🏛️</div>
              <h2 className="mt-2 text-xl font-bold">Explore 3D Campus</h2>
              <p className="mt-1 text-sm opacity-90">Walk the campus, open labs, inspect equipment and book from inside the scene.</p>
              <span className="mt-3 inline-block font-semibold">Enter the campus →</span>
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button size="lg" variant="secondary" onClick={() => navigate(ROUTES.discover)}>Explore demo</Button>
            <Button size="lg" variant="ai" onClick={startDemo}>Try guided demo</Button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section aria-labelledby="impact-h" aria-live="polite">
          <h2 id="impact-h" className="mb-3 text-xl font-bold">Campus at a glance</h2>
          {failed && (
            <div className="mb-3">
              <Notice tone="warn" title="The demo API may still be waking up">
                {errorMessage(overview.error ?? depts.error)}{' '}
                <button type="button" className="ml-1 min-h-11 font-semibold underline" onClick={retry}>Retry</button>
              </Notice>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Equipment units" value={val(o?.total_units)} />
            <Stat label="Laboratories" value={val(labs)} />
            <Stat label="Pending requests" value={val(o?.pending_requests)} />
            <Stat label="Active bookings" value={val(o?.active_bookings)} />
          </div>
          <p className="mt-3 text-sm text-muted">{o?.data_label ?? 'Sample campus data'}</p>
          <div className="mt-2">
            <Notice tone="info">Hackathon demonstration using simulated campus data.</Notice>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2" aria-label="How it works">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="font-bold">🤖 AI project analyser</h3>
            <p className="mt-1 text-sm text-muted">
              Describe your project in plain language. The analyser extracts capabilities, lists the equipment you need, and
              matches each requirement against real catalogue entries, honestly flagging anything the campus does not have.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="font-bold">🧮 Intelligent scheduling</h3>
            <p className="mt-1 text-sm text-muted">
              Competing requests are allocated jointly by an OR-Tools constraint solver that weighs deadline urgency, waiting
              time and fairness while respecting setup, cleanup and maintenance windows.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
