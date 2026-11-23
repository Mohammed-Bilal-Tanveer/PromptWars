import { useEffect } from 'react'
import type { EquipmentType } from '@/types/api'
import { Button, IconAlert, IconMapPin, IconX } from '@/components/ui'
import { useAppStore, toast } from '@/stores/appStore'
import { playerState } from '../character/playerState'
import { startWalk } from '../interactions/navigation'
import { advanceFind, resolveFindTarget } from '../interactions/findInCampus'
import { useExplorerStore } from '../stores/explorerStore'

/** Consumes a "Find in 3D Campus" request, drives entrance → bench waypoints, and renders the HUD hint. */
export function useFindDriver(equipment: EquipmentType[], loaded: boolean, failed: boolean) {
  const request = useAppStore((s) => s.findInCampus)
  useEffect(() => {
    if (!request || (!loaded && !failed)) return
    const st = useExplorerStore.getState()
    const plan = resolveFindTarget(request, failed ? [] : equipment, st.insideBuilding)
    st.setFind(plan.state)
    st.setWaypoint(plan.waypoint)
    useAppStore.getState().setFindInCampus(null)
  }, [request, equipment, loaded, failed])

  const find = useExplorerStore((s) => s.find)
  useEffect(() => {
    if (!find || find.stage === 'unavailable') return
    const t = setInterval(() => {
      const st = useExplorerStore.getState()
      if (!st.find) return
      const r = advanceFind(st.find, st.insideBuilding, { x: playerState.x, z: playerState.z })
      if (r === 'arrived') {
        toast.success('You have arrived', st.find.label)
        st.setFind(null)
        st.setWaypoint(null)
      } else if (r) {
        st.setFind(r.state)
        st.setWaypoint(r.waypoint)
      }
    }, 250)
    return () => clearInterval(t)
  }, [find])
}

export function FindGuide() {
  const find = useExplorerStore((s) => s.find)
  const wp = useExplorerStore((s) => s.waypoint)
  const setFind = useExplorerStore((s) => s.setFind)
  const setWp = useExplorerStore((s) => s.setWaypoint)
  const openPanel = useExplorerStore((s) => s.openPanel)
  if (!find) return null
  const clear = () => { setFind(null); setWp(null) }
  if (find.stage === 'unavailable') {
    return (
      <div role="alert" className="max-w-sm rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-raised sm:text-sm">
        <p className="flex items-center gap-1.5 font-semibold"><IconAlert size={16} /> Navigation unavailable for this item</p>
        <p className="mt-0.5">We could not place it in the 3D campus, so no route is shown. You can still open its normal details.</p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => { openPanel({ kind: 'equipment', recordId: find.equipmentId }); setFind(null) }}>Open equipment panel</Button>
          <Button size="sm" variant="ghost" onClick={clear}>Dismiss</Button>
        </div>
      </div>
    )
  }
  const text = find.stage === 'entrance' ? `Walk to the entrance of ${find.buildingLabel}` : `Now walk to ${find.label}`
  return (
    <div role="status" aria-live="polite" className="max-w-sm rounded-xl border border-brand-muted bg-surface px-3 py-2 text-xs shadow-raised sm:text-sm">
      <p className="flex items-center gap-1.5 font-semibold text-fg"><IconMapPin size={16} className="text-brand" /> {text}</p>
      <p className="mt-0.5 text-muted">Finding: {find.label}. Follow the beacon and the minimap marker.</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={() => wp && startWalk(wp)}>Walk there</Button>
        <Button size="sm" variant="ghost" onClick={clear}><IconX size={14} /> Cancel</Button>
      </div>
    </div>
  )
}
