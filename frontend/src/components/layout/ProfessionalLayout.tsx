import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'
import { cx, Button, Modal } from '@/components/ui'
import { NotificationCenter } from '@/features/analytics'
import { GuidedDemo } from '@/components/shared/GuidedDemo'
import { useAppStore } from '@/stores/appStore'
import { usePublicConfig } from '@/hooks/useApi'

export const NAV = [
  { to: ROUTES.overview, label: 'Overview', icon: '🏠', end: true },
  { to: ROUTES.discover, label: 'Discover Equipment', icon: '🔎' },
  { to: ROUTES.projectLab, label: 'Project Lab (AI)', icon: '✨' },
  { to: ROUTES.calendar, label: 'Booking Calendar', icon: '📅' },
  { to: ROUTES.requests, label: 'My Requests', icon: '📋' },
  { to: ROUTES.scheduling, label: 'Scheduling Studio', icon: '🧠' },
  { to: ROUTES.approvals, label: 'Demo Approval Desk', icon: '✅' },
  { to: ROUTES.analytics, label: 'Resource Analytics', icon: '📊' },
  { to: ROUTES.labs, label: 'Campus Directory', icon: '🏛️' },
  { to: ROUTES.assistant, label: 'AI Assistant', icon: '💬' },
] as const

const BOTTOM = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[6]]

function Wordmark() {
  return (
    <Link to={ROUTES.home} className="flex items-center gap-2 font-extrabold text-lg" aria-label="LabLink home">
      <span className="grad-brand grid h-9 w-9 place-items-center rounded-xl" aria-hidden>L</span>
      <span>Lab<span className="grad-text">Link</span></span>
    </Link>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={'end' in n ? n.end : false}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition',
              isActive ? 'grad-sched shadow' : 'text-muted hover:bg-surface2 hover:text-fg',
            )
          }
        >
          <span aria-hidden>{n.icon}</span>
          {n.label}
        </NavLink>
      ))}
      <Link
        to={ROUTES.campus3d}
        onClick={onNavigate}
        className="mt-2 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold grad-accent"
      >
        <span aria-hidden>🎮</span> Campus Explorer (3D)
      </Link>
    </nav>
  )
}

export function ProfessionalLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [q, setQ] = useState('')
  const setGuided = useAppStore((s) => s.setGuidedDemoOpen)
  const { data: cfg } = usePublicConfig()

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    nav(`${ROUTES.discover}${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
  }

  return (
    <div className="flex min-h-full bg-bg">
      <a href="#main" className="skip-link">Skip to main content</a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-surface p-4 lg:flex">
        <Wordmark />
        <NavList />
        <div className="mt-auto rounded-xl border border-line p-3 text-xs text-muted">
          <strong className="text-fg">Sample campus data</strong>
          <br />
          Hackathon demonstration using simulated campus data. No login required.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-line bg-bg/90 px-3 py-2 backdrop-blur sm:px-5">
          <button
            className="min-h-11 min-w-11 rounded-xl border border-line lg:hidden"
            aria-label="Open navigation menu"
            onClick={() => setDrawer(true)}
          >
            ☰
          </button>
          <div className="lg:hidden"><Wordmark /></div>
          <form onSubmit={onSearch} role="search" className="order-last flex min-w-0 basis-full gap-2 sm:order-none sm:basis-auto sm:flex-1 sm:max-w-xl">
            <label htmlFor="global-search" className="sr-only">Search equipment and laboratories</label>
            <input
              id="global-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search equipment, labs, capabilities…"
              className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm placeholder:text-slate-500"
            />
            <Button type="submit" variant="secondary" aria-label="Search">🔍</Button>
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setGuided(true)} className="hidden sm:inline-flex">🧭 Guided demo</Button>
            <Link to={ROUTES.campus3d} className="grad-accent inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold">🎮 3D<span className="ml-1 hidden sm:inline">Campus</span></Link>
            <NotificationCenter />
          </div>
        </header>

        {cfg && !cfg.ai_configured && (
          <div className="border-b border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-200" role="note">
            AI key not configured on the server — Project Lab uses the clearly-labelled deterministic “Demo analysis”.
          </div>
        )}

        <main id="main" tabIndex={-1} key={loc.pathname} className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 pb-28 sm:px-6 lg:pb-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface lg:hidden">
          {BOTTOM.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={'end' in n ? n.end : false}
              className={({ isActive }) => cx('flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold', isActive ? 'text-sky-300' : 'text-muted')}
            >
              <span aria-hidden className="text-lg">{n.icon}</span>
              <span className="truncate max-w-full">{n.label.replace(' (AI)', '').replace('Discover Equipment', 'Discover').replace('Demo Approval Desk', 'Approvals')}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <Modal open={drawer} onClose={() => setDrawer(false)} title="Navigation" side>
        <NavList onNavigate={() => setDrawer(false)} />
        <Button variant="ghost" className="mt-3 w-full" onClick={() => { setDrawer(false); setGuided(true) }}>🧭 Guided demo</Button>
      </Modal>

      <GuidedDemo />
    </div>
  )
}
