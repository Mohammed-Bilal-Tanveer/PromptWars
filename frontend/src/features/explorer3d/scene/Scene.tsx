import { useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import * as THREE from 'three'
import type { EquipmentType } from '@/types/api'
import { PlayerRig } from '../character/Player'
import { Npcs, type NpcDef } from '../character/KenneyCharacter'
import { preloadKenney } from './kenney'
import { Building, Bench } from './Building'
import { EquipmentAnchor, Kiosk, TERMINAL_ACCENT, Terminal, Trees, WaypointBeacon, WelcomeSign } from './Props'
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

const pathMat = new THREE.MeshStandardMaterial({ color: '#D8D0C2', roughness: 1 })
const plazaMat = new THREE.MeshStandardMaterial({ color: '#D4D4D0', roughness: 0.9 })
const boxGeo = new THREE.BoxGeometry(1, 1, 1)

function Paths() {
  const strips: { x: number; z: number; w: number; d: number }[] = [
    { x: 0, z: 0, w: 4, d: 80 },
    { x: 0, z: 0, w: 56, d: 4 },
  ]
  for (const b of BUILDINGS) {
    if (b.special) continue
    const door = doorOutside(b, 0)
    strips.push({ x: b.x, z: (door.z + 0) / 2, w: 3.6, d: Math.abs(door.z) })
  }
  return (
    <group>
      {strips.map((s, i) => (
        <mesh key={i} geometry={boxGeo} material={pathMat} position={[s.x, 0.03, s.z]} scale={[s.w, 0.06, s.d]} receiveShadow />
      ))}
      <mesh material={plazaMat} position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[10, 10, 0.12, 32]} />
      </mesh>
    </group>
  )
}

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
  const avoid = useMemo(() => [{ x: 0, z: 0, r: 14 }, ...BUILDINGS.map((b) => ({ x: b.x, z: b.z + b.facing * 7, r: 14 }))], [])
  const hi = useMemo(() => new Set(highlightedIds), [highlightedIds])
  const treeCount = quality === 'high' ? 110 : 40
  const high = quality === 'high'

  return (
    <>
      <color attach="background" args={['#dfe8ee']} />
      <fog attach="fog" args={['#dfe8ee', 60, 150]} />
      <Sky distance={450000} sunPosition={[30, 50, 20]} turbidity={2.5} rayleigh={0.9} mieCoefficient={0.004} />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#eef3f7', '#7d9670', 0.8]} />
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[130, 130]} />
        <meshStandardMaterial color="#8DB88A" roughness={1} />
      </mesh>
      <Paths />
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
      <Trees count={treeCount} avoid={avoid} />
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
      camera={{ fov: 55, near: 0.2, far: 220, position: [0, 6, 19] }}
      gl={{ antialias: high, powerPreference: 'high-performance' }}
      aria-label="3D campus view"
    >
      <World {...props} />
    </Canvas>
  )
}
