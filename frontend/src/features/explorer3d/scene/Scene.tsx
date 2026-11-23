import { useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import type { EquipmentType } from '@/types/api'
import { PlayerRig } from '../character/Player'
import { Npcs, type NpcDef } from '../character/KenneyCharacter'
import { preloadKenney } from './kenney'
import { Clouds, EdgeWall, FOG_COLOR, Forest, Ground, Hills, Pond, SUN_DIR, SunDisc, Undergrowth } from './Scenery'
import { Building, Bench } from './Building'
import { EquipmentAnchor, Kiosk, TERMINAL_ACCENT, Terminal, WaypointBeacon, WelcomeSign } from './Props'
import {
  BENCHES_PLAZA, BUILDINGS, PLAZA, benchBox, buildAnchors, consolePos, csAiTerminal, doorOutside, staticColliders, buildingById,
} from '../environments/layout'
import { Interactable, registerInteractable } from '../interactions/registry'
import { resolveQuality, useExplorerStore } from '../stores/explorerStore'

export interface SceneProps {
  equipment: EquipmentType[]
  highlightedIds: string[]
  paused: boolean
}

preloadKenney()

/** Decorative students: two chatting at the plaza benches, two strolling along the paths. */
const NPCS_HIGH: NpcDef[] = [
  { id: 'female-c', x: -6.6, z: 5.0, heading: 1.0 },
  { id: 'male-e', x: -4.2, z: 5.8, heading: -1.1 },
  { id: 'female-e', x: 2.6, z: -16, heading: 0, to: { x: 2.6, z: 16 } },
  { id: 'male-c', x: -14, z: 3.4, heading: 1.57, to: { x: 14, z: 3.4 } },
]

/** Registers every interactive object (static + equipment from the API). */
function useRegisterInteractables(anchors: ReturnType<typeof buildAnchors>) {
  useEffect(() => {
    const items: Interactable[] = [
      { id: 'kiosk', type: 'kiosk', position: PLAZA.kiosk, radius: 3.2, label: 'Information Kiosk', prompt: 'Press E to open the campus kiosk' },
      { id: 'plaza-ai', type: 'ai_terminal', position: PLAZA.ai, radius: 3, label: 'Project Lab terminal', prompt: 'Press E to open Project Lab' },
      { id: 'plaza-booking', type: 'booking_terminal', position: PLAZA.booking, radius: 3, label: 'Booking terminal', prompt: 'Press E to open bookings' },
      { id: 'plaza-sched', type: 'scheduling_hub', position: PLAZA.scheduling, radius: 3, label: 'Scheduling hub', prompt: 'Press E to open the scheduling studio' },
    ]
    for (const b of BUILDINGS) {
      if (b.special) {
        const c = consolePos(b)
        items.push(b.special === 'operations'
          ? { id: 'ops', type: 'operations_desk', position: c, radius: 7, label: 'Operations Desk', prompt: 'Press E to open the Approval Desk' }
          : { id: 'ana', type: 'analytics_centre', position: c, radius: 7, label: 'Analytics Control Centre', prompt: 'Press E to open analytics' })
        continue
      }
      b.departmentIds.forEach((dep, i) => {
        const o = doorOutside(b, 2.6)
        const dx = b.departmentIds.length > 1 ? (i === 0 ? -1.8 : 1.8) : 0
        items.push({ id: `dept-${dep}`, type: 'department', position: { x: o.x + dx, z: o.z }, radius: b.departmentIds.length > 1 ? 2.2 : 3.4, label: `${b.short} department`, prompt: `Press E to view the ${b.label} department`, recordId: dep })
      })
    }
    const cs = buildingById('CS-B')!
    items.push({ id: 'cs-ai', type: 'ai_terminal', position: csAiTerminal(cs), radius: 2.8, label: 'Project Lab terminal (CS-B)', prompt: 'Press E to open Project Lab' })
    for (const a of anchors) {
      items.push({ id: `eq-${a.equipment.id}`, type: 'equipment', position: { x: a.x, z: a.z }, radius: 2.4, label: a.equipment.name, prompt: `Press E to inspect ${a.equipment.name}`, recordId: a.equipment.id })
    }
    const offs = items.map(registerInteractable)
    return () => offs.forEach((o) => o())
  }, [anchors])
}

function World({ equipment, highlightedIds, paused }: SceneProps) {
  const quality = useExplorerStore((s) => resolveQuality(s.quality))
  const inside = useExplorerStore((s) => s.insideBuilding)
  const anchors = useMemo(() => buildAnchors(equipment), [equipment])
  useRegisterInteractables(anchors)
  const colliders = useMemo(() => [...staticColliders(), ...anchors.map((a) => benchBox(a.x, a.z))], [anchors])
  const hi = useMemo(() => new Set(highlightedIds), [highlightedIds])
  const high = quality === 'high'

  return (
    <>
      <color attach="background" args={[FOG_COLOR]} />
      <fog attach="fog" args={[FOG_COLOR, 70, 215]} />
      <Sky distance={450000} sunPosition={SUN_DIR.toArray()} turbidity={3.5} rayleigh={1.3} mieCoefficient={0.004} />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#cfe4f5', '#6f8f5a', 0.8]} />
      <directionalLight
        position={[30, 50, 20]}
        color="#fff1d6"
        intensity={1.5}
        castShadow={high}
        shadow-bias={-0.0004}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={1}
        shadow-camera-far={140}
      />
      <SunDisc />
      <Clouds count={high ? 16 : 8} />
      <Hills count={high ? 90 : 48} />
      <Ground />
      <Pond />
      <EdgeWall />
      <Forest interior={high ? 300 : 110} belt={high ? 380 : 150} />
      <Undergrowth high={high} />
      <WelcomeSign x={PLAZA.sign.x} z={PLAZA.sign.z} />
      <Kiosk x={PLAZA.kiosk.x} z={PLAZA.kiosk.z} />
      <Terminal x={PLAZA.ai.x} z={PLAZA.ai.z} color={TERMINAL_ACCENT} label="Project Lab" />
      <Terminal x={PLAZA.booking.x} z={PLAZA.booking.z} color={TERMINAL_ACCENT} label="Bookings" />
      <Terminal x={PLAZA.scheduling.x} z={PLAZA.scheduling.z} color={TERMINAL_ACCENT} label="Scheduling" />
      {BENCHES_PLAZA.map((b, i) => <Bench key={i} x={b.x} z={b.z} rot={b.rot} height={0.6} />)}
      {BUILDINGS.map((b) => (
        <Building key={b.id} def={b} hasAiTerminal={b.id === 'CS-B'} benchSlots={anchors.filter((a) => a.buildingId === b.id).map((a) => ({ x: a.x, z: a.z }))} />
      ))}
      {anchors.map((a) => (
        <EquipmentAnchor key={a.equipment.id} x={a.x} z={a.z} equipment={a.equipment} highlighted={hi.has(a.equipment.id)} showBadge={inside === a.buildingId} />
      ))}
      <WaypointBeacon />
      <Npcs npcs={high ? NPCS_HIGH : NPCS_HIGH.slice(2)} />
      <PlayerRig colliders={colliders} paused={paused} />
    </>
  )
}

export default function Scene(props: SceneProps) {
  const quality = useExplorerStore((s) => resolveQuality(s.quality))
  const high = quality === 'high'
  return (
    <Canvas
      shadows={high ? 'soft' : false}
      dpr={high ? [1, 2] : [1, 1.25]}
      frameloop={props.paused ? 'demand' : 'always'}
      camera={{ fov: 55, near: 0.2, far: 330, position: [0, 6, 19] }}
      gl={{ antialias: high, powerPreference: 'high-performance' }}
      aria-label="3D campus view"
    >
      <World {...props} />
    </Canvas>
  )
}
