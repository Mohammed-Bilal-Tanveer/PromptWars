import { useState } from 'react'
import { BUILDINGS, CAMPUS_BOUND } from '../environments/layout'
import { usePlayerPose } from '../character/usePlayerPose'
import { DESTINATIONS, teleportToDestination, walkToDestination } from '../interactions/navigation'
import { Button, cx, IconMapPin } from '@/components/ui'
import { NetworkView } from './NetworkView'
import { TabList, TabPanel, useTabIds } from './Tabs'

const MAP_TABS = [['map', 'Map & Teleport'], ['network', 'Resource network']] as const

export function MapPanel() {
  const [tab, setTab] = useState<'map' | 'network'>('map')
  const ids = useTabIds('map-tabs')
  return (
    <div className="space-y-4">
      <TabList label="Map views" tabs={MAP_TABS} value={tab} onChange={setTab} idPrefix={ids} className="inline-flex gap-1 rounded-lg bg-surface2 p-1" />
      <TabPanel idPrefix={ids} tab={tab}>{tab === 'map' ? <CampusMap /> : <NetworkView />}</TabPanel>
    </div>
  )
}

function CampusMap() {
  const [sel, setSel] = useState<string | null>(null)
  const p = usePlayerPose()
  const B = CAMPUS_BOUND
  const V = B + 4
  const fs = V / 16
  const chosen = DESTINATIONS.find((d) => d.id === sel) ?? null
  const bld = (id: string) => BUILDINGS.find((b) => b.id === id)

  return (
    <div className="space-y-4">
      <svg viewBox={`${-V} ${-V} ${2 * V} ${2 * V}`} role="group" aria-label="Campus map" className="mx-auto block w-full max-w-[560px] rounded-xl border border-line-strong bg-[#e6ece0]">
        <rect x={-B} y={-B} width={2 * B} height={2 * B} fill="#dfe7d6" />
        <rect x={-2.5} y={-B} width={5} height={2 * B} fill="#e2dccd" />
        <rect x={-B} y={-2.5} width={2 * B} height={5} fill="#e2dccd" />
        <circle cx={0} cy={0} r={12} fill="#d9d4c8" />
        {BUILDINGS.map((b) => {
          const active = sel === b.id
          return (
            <g key={b.id} onClick={() => setSel(b.id)} className="cursor-pointer">
              <rect x={b.x - b.w / 2} y={b.z - b.d / 2} width={b.w} height={b.d} rx={1} fill={b.color} stroke={active ? '#1d4ed8' : '#5d6b82'} strokeWidth={active ? 1.6 : 0.5} />
              <text x={b.x} y={b.z + fs * 0.35} fontSize={fs} fontWeight={700} textAnchor="middle" fill="#101828" stroke="#ffffff" strokeWidth={fs * 0.2} paintOrder="stroke" pointerEvents="none">{b.short}</text>
            </g>
          )
        })}
        {DESTINATIONS.filter((d) => d.kind === 'landmark').map((d) => (
          <g key={d.id} onClick={() => setSel(d.id)} className="cursor-pointer">
            <circle cx={d.x} cy={d.z} r={sel === d.id ? 2.4 : 1.8} fill="#ffffff" stroke={sel === d.id ? '#1d4ed8' : '#475467'} strokeWidth={0.8} />
            <circle cx={d.x} cy={d.z} r={0.7} fill="#1d4ed8" />
          </g>
        ))}
        {chosen && <circle cx={chosen.stand.x} cy={chosen.stand.z} r={1.2} fill="none" stroke="#b45309" strokeWidth={0.7} strokeDasharray="1 1" />}
        <g transform={`translate(${p.x} ${p.z}) rotate(${(-p.h * 180) / Math.PI + 180})`} aria-label="You are here">
          <polygon points="0,-3.4 2.4,2.4 -2.4,2.4" fill="#1d4ed8" stroke="#ffffff" strokeWidth={0.8} strokeLinejoin="round" />
        </g>
        <text x={-V + 1.5} y={-V + fs} fontSize={fs * 0.8} fontWeight={600} fill="#475467">N ↑</text>
      </svg>

      <div className="rounded-xl border border-line bg-surface2 p-3" aria-live="polite">
        {chosen ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold"><IconMapPin size={16} className="text-brand" /> {chosen.label}</div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => walkToDestination(chosen)}>Walk there</Button>
              <Button variant="secondary" onClick={() => teleportToDestination(chosen)}>Teleport</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Select a building or landmark on the map or in the list.</p>
        )}
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Destinations">
        {DESTINATIONS.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              aria-pressed={sel === d.id}
              onClick={() => setSel(d.id)}
              className={cx('flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium hover:bg-surface2', sel === d.id ? 'border-brand bg-brand-subtle text-fg' : 'border-line text-fg')}
            >
              <span className="text-muted" aria-hidden>{d.kind === 'building' ? (bld(d.id)?.short ?? '') : '•'}</span> {d.label}
            </button>
          </li>
        ))}
      </ul>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Equipment status legend">
        <li>Available x/y</li><li>Fully booked now</li><li>Maintenance</li><li>Blue ring: Project Lab match</li>
      </ul>
    </div>
  )
}
