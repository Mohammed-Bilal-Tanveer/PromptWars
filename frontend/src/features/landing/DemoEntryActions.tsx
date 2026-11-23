import { Link, useNavigate } from 'react-router-dom'
import { Button, buttonCls, IconCube, IconListChecks } from '@/components/ui'
import { ROUTES } from '@/lib/routes'
import { useAppStore } from '@/stores/appStore'

/** Start Guided Demo (primary), Explore Freely, Explore 3D Campus. Shared by landing and dashboard. */
export function DemoEntryActions({ freelyTo = ROUTES.discover, startTo = ROUTES.overview }: { freelyTo?: string; startTo?: string }) {
  const navigate = useNavigate()
  const start = () => {
    useAppStore.getState().setGuidedDemoOpen(true)
    navigate(startTo)
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg" onClick={start}><IconListChecks size={18} /> Start Guided Demo</Button>
      <Link to={freelyTo} className={buttonCls('secondary', 'lg')}>Explore Freely</Link>
      <Link to={ROUTES.campus3d} className={buttonCls('secondary', 'lg')}><IconCube size={18} /> Explore 3D Campus</Link>
    </div>
  )
}
