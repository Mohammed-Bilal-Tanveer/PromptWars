import { useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'
import {
  cx, Button, Modal,
  IconBuilding, IconCalendar, IconChart, IconCheckSquare, IconClipboard, IconCube, IconFlask, IconHome, IconListChecks,
  IconMenu, IconMessage, IconSearch, IconSliders, IconInfo, IconCheckCircle, IconClock, IconAlert, IconWifi, type IconProps,
} from '@/components/ui'
import { NotificationCenter } from '@/features/analytics'
import { GuidedDemo } from '@/components/shared/GuidedDemo'
import { useAppStore } from '@/stores/appStore'
import { usePublicConfig } from '@/hooks/useApi'
import { useConnectionStore } from '@/features/connection/connectionStore'

type NavItem = { to: string; label: string; short: string; icon: ComponentType<IconProps>; end?: boolean; group: string }

export const NAV: readonly NavItem[] = [
  { to: ROUTES.overview, label: 'Overview', short: 'Overview', icon: IconHome, end: true, group: 'Workspace' },
  { to: ROUTES.discover, label: 'Discover Equipment', short: 'Discover', icon: IconSearch, group: 'Workspace' },
  { to: ROUTES.projectLab, label: 'Project Lab', short: 'Project Lab', icon: IconFlask, group: 'Workspace' },
  { to: ROUTES.calendar, label: 'Booking Calendar', short: 'Calendar', icon: IconCalendar, group: 'Workspace' },
  { to: ROUTES.requests, label: 'My Requests', short: 'Requests', icon: IconClipboard, group: 'Workspace' },
  { to: ROUTES.scheduling, label: 'Scheduling Studio', short: 'Scheduling', icon: IconSliders, group: 'Operations' },
  { to: ROUTES.approvals, label: 'Demo Approval Desk', short: 'Approvals', icon: IconCheckSquare, group: 'Operations' },
  { to: ROUTES.analytics, label: 'Resource Analytics', short: 'Analytics', icon: IconChart, group: 'Operations' },
  { to: ROUTES.labs, label: 'Campus Directory', short: 'Directory', icon: IconBuilding, group: 'Campus' },
  { to: ROUTES.assistant, label: 'Assistant', short: 'Assistant', icon: IconMessage, group: 'Campus' },
] as const

const BOTTOM = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[6]]
const GROUPS = ['Workspace', 'Operations', 'Campus']

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cx('grid h-8 w-8 place-items-center rounded-lg bg-brand text-white shadow-card', className)} aria-hidden>
      <IconFlask size={18} strokeWidth={1.75} />
    </span>
  )
}

function Wordmark() {
  return (
    <Link to={ROUTES.home} className="flex min-h-11 items-center gap-2.5 rounded-lg text-[17px] font-semibold tracking-tight text-fg" aria-label="LabLink home">
      <LogoMark />
      <span>LabLink</span>
    </Link>
  )
}

/** Segmented 2D/3D switch. Professional Mode is always the current mode inside this layout. */
export function ModeSwitch({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const seg = 'inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-sm font-semibold transition-colors lg:min-h-9'
  return (
    <nav aria-label="Interface mode" className={cx('inline-flex overflow-hidden rounded-lg border border-control-border bg-surface shadow-card', className)}>
      <span aria-current="page" className={cx(seg, 'bg-brand-subtle text-brand-fg')}>
        <IconClipboard size={16} />Professional<span className="max-sm:sr-only">&nbsp;Mode</span>
      </span>
      <Link to={ROUTES.campus3d} onClick={onNavigate} className={cx(seg, 'border-l border-control-border text-muted hover:bg-surface2 hover:text-fg')}>
        <IconCube size={16} />3D<span className="max-sm:sr-only">&nbsp;Campus Mode</span>
      </Link>
    </nav>
  )
}

/** Always-visible, unobtrusive backend status (text + icon, never colour alone). */
export function ConnectionIndicator() {
  const state = useConnectionStore((s) => s.state)
  const m = {
    connected: { label: 'Connected', icon: <IconCheckCircle size={14} />, cls: 'text-emerald-700' },
    checking: { label: 'Connecting…', icon: <IconWifi size={14} />, cls: 'text-muted' },
    waking: { label: 'Waking up…', icon: <IconClock size={14} />, cls: 'text-amber-800' },
    unavailable: { label: 'Unavailable', icon: <IconAlert size={14} />, cls: 'text-red-700' },
  }[state]
  return (
    <span role="status" data-testid="connection-indicator" className={cx('inline-flex items-center gap-1 text-xs font-medium', m.cls)}>
      {m.icon}<span className="max-sm:sr-only">{m.label}</span>
    </span>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <div key={g}>
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">{g}</p>
          <ul className="flex flex-col gap-0.5">
            {NAV.filter((n) => n.group === g).map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end ?? false}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cx(
                      'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors lg:min-h-9',
                      isActive
                        ? 'bg-brand-subtle text-brand-fg before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-brand'
                        : 'text-muted hover:bg-surface2 hover:text-fg',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <n.icon size={18} className={isActive ? 'text-brand' : 'text-subtle'} />
                      {n.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {onNavigate && <ModeSwitch onNavigate={onNavigate} className="w-full [&>*]:flex-1" />}
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
  const mainRef = useRef<HTMLElement>(null)
  const firstRoute = useRef(true)

  // On navigation: name the page for screen readers / history and move focus to <main> (not on first load).
  useEffect(() => {
    const heading = mainRef.current?.querySelector('h1')?.textContent?.trim()
    const route = [...NAV].sort((a, b) => b.to.length - a.to.length).find((n) => (n.end ? loc.pathname === n.to : loc.pathname === n.to || loc.pathname.startsWith(`${n.to}/`)))
    const name = heading || route?.label
    document.title = name ? `${name} · LabLink` : 'LabLink'
    if (firstRoute.current) { firstRoute.current = false; return }
    // Deferred so it lands after the nav drawer (if open) has closed and restored focus to its trigger.
    const h = setTimeout(() => mainRef.current?.focus({ preventScroll: true }), 0)
    return () => clearTimeout(h)
  }, [loc.pathname])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    nav(`${ROUTES.discover}${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
  }

  return (
    <div className="flex min-h-full bg-bg">
      <a href="#main" className="skip-link">Skip to main content</a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-3 py-4 lg:flex">
        <div className="px-2"><Wordmark /></div>
        <NavList />
        <div className="mt-auto rounded-xl border border-line bg-surface2 p-3 text-xs leading-relaxed text-muted">
          <strong className="block text-[13px] font-semibold text-fg">Sample campus data</strong>
          Hackathon demonstration using simulated campus data. No login required.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-line bg-surface/95 px-3 py-2.5 sm:px-6">
          <button
            className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-control-border bg-surface text-muted hover:bg-surface2 hover:text-fg lg:hidden"
            aria-label="Open navigation menu"
            onClick={() => setDrawer(true)}
          >
            <IconMenu size={20} />
          </button>
          <div className="lg:hidden"><Wordmark /></div>
          <form onSubmit={onSearch} role="search" className="order-last flex min-w-0 basis-full gap-2 sm:order-none sm:max-w-md sm:flex-1 sm:basis-auto">
            <label htmlFor="global-search" className="sr-only">Search equipment and laboratories</label>
            <div className="relative min-w-0 flex-1">
              <IconSearch size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
              <input
                id="global-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search equipment, labs, capabilities…"
                className="min-h-11 w-full min-w-0 rounded-lg border border-control-border bg-surface pl-10 pr-3 text-sm text-fg placeholder:text-subtle hover:border-subtle focus:border-brand lg:min-h-10"
              />
            </div>
            <Button type="submit" variant="secondary" aria-label="Search" className="px-3">
              <IconSearch size={18} className="sm:hidden" /><span className="hidden sm:inline">Search</span>
            </Button>
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={() => setGuided(true)} className="max-md:hidden">
              <IconListChecks size={18} /> Guided demo
            </Button>
            <ConnectionIndicator />
            <ModeSwitch className="max-sm:hidden" />
            <NotificationCenter />
          </div>
        </header>

        {cfg && !cfg.ai_configured && (
          <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900" role="note">
            <IconInfo size={16} className="hidden shrink-0 text-amber-600 sm:block" />
            <span>AI key not configured on the server — Project Lab uses the clearly-labelled “Demo analysis”.</span>
          </div>
        )}

        <main id="main" ref={mainRef} tabIndex={-1} key={loc.pathname} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-28 outline-none sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          {BOTTOM.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end ?? false}
              className={({ isActive }) =>
                cx(
                  'relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium',
                  isActive ? 'text-brand before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:rounded-b before:bg-brand' : 'text-muted',
                )
              }
            >
              <n.icon size={20} />
              <span className="max-w-full truncate">{n.short}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <Modal open={drawer} onClose={() => setDrawer(false)} title="Navigation" side>
        <Button variant="secondary" className="mb-4 w-full" onClick={() => { setDrawer(false); setGuided(true) }}>
          <IconListChecks size={18} /> Guided demo
        </Button>
        <NavList onNavigate={() => setDrawer(false)} />
      </Modal>

      <GuidedDemo />
    </div>
  )
}
