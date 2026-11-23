import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Html, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { EquipmentType } from '@/types/api'
import { useExplorerStore } from '../stores/explorerStore'

const boxGeo = new THREE.BoxGeometry(1, 1, 1)
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12)
/** Single accent used by every terminal / kiosk screen in the scene. */
export const TERMINAL_ACCENT = '#2563EB'
const darkMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.7 })
const metalMat = new THREE.MeshStandardMaterial({ color: '#9aa4b8', roughness: 0.4, metalness: 0.4 })
const whiteMat = new THREE.MeshStandardMaterial({ color: '#e5e7eb', roughness: 0.6 })
const boardMat = new THREE.MeshStandardMaterial({ color: '#5f7b72', roughness: 0.7 })
const screenMat = new THREE.MeshStandardMaterial({ color: '#9fb6d6', emissive: '#7f9cc4', emissiveIntensity: 0.35 })
const woodMat = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.85 })
const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.9 })
const leafMat = new THREE.MeshStandardMaterial({ color: '#5e8a58', roughness: 0.9, flatShading: true })
const trunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 1.6, 6)
const leafGeo = new THREE.ConeGeometry(1.1, 2.6, 7)

/** Information terminal: neutral pedestal + softly lit screen in the single accent colour. Short label only. */
export function Terminal({ x, z, color, label, rotY = 0 }: { x: number; z: number; color: string; label: string; rotY?: number }) {
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ring.current && !useExplorerStore.getState().reduceMotion) ring.current.rotation.y = clock.elapsedTime
  })
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh geometry={cylGeo} material={darkMat} position={[0, 0.45, 0]} scale={[0.6, 0.9, 0.6]} castShadow />
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[1.2, 0.8, 0.08]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.45} />
      </mesh>
      <mesh ref={ring} position={[0, 2.3, 0]}>
        <torusGeometry args={[0.22, 0.03, 6, 20]} />
        <meshStandardMaterial color="#cfd4dc" emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <Billboard position={[0, 2.8, 0]}>
        <Text fontSize={0.34} color="#1f2937" outlineWidth={0.035} outlineColor="#ffffff" anchorX="center">{label}</Text>
      </Billboard>
    </group>
  )
}

export function Kiosk({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={boxGeo} material={whiteMat} position={[0, 0.6, 0]} scale={[1.6, 1.2, 1.2]} castShadow />
      <mesh position={[0, 1.55, 0]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[1.4, 0.8, 0.1]} />
        <meshStandardMaterial color={TERMINAL_ACCENT} emissive={TERMINAL_ACCENT} emissiveIntensity={0.4} roughness={0.45} />
      </mesh>
      <mesh geometry={cylGeo} material={metalMat} position={[0, 2.3, 0]} scale={[0.5, 0.1, 0.5]} />
      <Billboard position={[0, 2.9, 0]}>
        <Text fontSize={0.34} color="#1f2937" outlineWidth={0.035} outlineColor="#ffffff" anchorX="center">Information Kiosk</Text>
      </Billboard>
    </group>
  )
}

export function WelcomeSign({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={boxGeo} material={woodMat} position={[-1.4, 1.1, 0]} scale={[0.2, 2.2, 0.2]} />
      <mesh geometry={boxGeo} material={woodMat} position={[1.4, 1.1, 0]} scale={[0.2, 2.2, 0.2]} />
      <mesh geometry={boxGeo} material={darkMat} position={[0, 1.9, 0]} scale={[3.4, 1, 0.15]} castShadow />
      <Text position={[0, 2.05, 0.1]} fontSize={0.38} color="#ffffff" anchorX="center">
        Welcome to LabLink Campus
      </Text>
      <Text position={[0, 1.65, 0.1]} fontSize={0.2} color="#cbd5e1" anchorX="center">
        Sample campus data
      </Text>
    </group>
  )
}

/** Deterministic pseudo-random */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function Trees({ count, avoid }: { count: number; avoid: { x: number; z: number; r: number }[] }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const leaves = useRef<THREE.InstancedMesh>(null)
  const pts = useMemo(() => {
    const r = rng(42)
    const out: { x: number; z: number; s: number }[] = []
    let guard = 0
    while (out.length < count && guard++ < count * 40) {
      const x = (r() - 0.5) * 108
      const z = (r() - 0.5) * 108
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) continue
      if (Math.abs(x) < 3 && Math.abs(z) < 50) continue // central avenue
      if (Math.abs(z) < 3) continue
      out.push({ x, z, s: 0.8 + r() * 0.7 })
    }
    return out
  }, [count, avoid])
  useEffect(() => {
    const m = new THREE.Matrix4()
    pts.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, 0.8 * p.s, p.z), new THREE.Quaternion(), new THREE.Vector3(p.s, p.s, p.s))
      trunks.current?.setMatrixAt(i, m)
      m.compose(new THREE.Vector3(p.x, 2.7 * p.s, p.z), new THREE.Quaternion(), new THREE.Vector3(p.s, p.s, p.s))
      leaves.current?.setMatrixAt(i, m)
    })
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true
    if (leaves.current) leaves.current.instanceMatrix.needsUpdate = true
  }, [pts])
  return (
    <group>
      <instancedMesh ref={trunks} args={[trunkGeo, trunkMat, pts.length]} castShadow={false} />
      <instancedMesh ref={leaves} args={[leafGeo, leafMat, pts.length]} />
    </group>
  )
}

export function WaypointBeacon() {
  const wp = useExplorerStore((s) => s.waypoint)
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.y = useExplorerStore.getState().reduceMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 3) * 0.08
  })
  if (!wp) return null
  return (
    <group position={[wp.x, 0, wp.z]}>
      <mesh ref={ref} position={[0, 6, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 12, 10, 1, true]} />
        <meshBasicMaterial color="#2563EB" transparent opacity={0.28} />
      </mesh>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1, 1.4, 24]} />
        <meshBasicMaterial color="#2563EB" />
      </mesh>
    </group>
  )
}

/* ---------------- Equipment anchors ---------------- */
type Kind = 'workstation' | 'scope' | 'camera' | 'printer' | 'microscope' | 'robot' | 'board' | 'tester' | 'generic'
export function modelKind(e: Pick<EquipmentType, 'name' | 'category'>): Kind {
  const t = `${e.name} ${e.category}`.toLowerCase()
  if (/workstation|server|gpu|jetson|computer/.test(t)) return 'workstation'
  if (/oscilloscope|analy[sz]er|spectro|fpga/.test(t)) return 'scope'
  if (/camera|vision/.test(t)) return 'camera'
  if (/printer|cnc|laser|3d|fabric/.test(t)) return 'printer'
  if (/microscope|centrifuge|pcr|thermocycler/.test(t)) return 'microscope'
  if (/robot/.test(t)) return 'robot'
  if (/arduino|raspberry|sensor|lora|board|soldering|iot/.test(t)) return 'board'
  if (/tester|materials|concrete|press/.test(t)) return 'tester'
  return 'generic'
}

function Model({ kind }: { kind: Kind }) {
  switch (kind) {
    case 'workstation':
      return (
        <group>
          <mesh geometry={boxGeo} material={darkMat} position={[0.6, 1.2, 0]} scale={[0.4, 0.6, 0.6]} />
          <mesh geometry={boxGeo} material={darkMat} position={[-0.2, 1.35, 0]} scale={[0.9, 0.55, 0.06]} />
          <mesh geometry={boxGeo} material={screenMat} position={[-0.2, 1.35, 0.04]} scale={[0.8, 0.45, 0.02]} />
        </group>
      )
    case 'scope':
      return (
        <group>
          <mesh geometry={boxGeo} material={metalMat} position={[0, 1.25, 0]} scale={[0.9, 0.6, 0.5]} />
          <mesh geometry={boxGeo} material={screenMat} position={[-0.1, 1.28, 0.26]} scale={[0.5, 0.4, 0.02]} />
        </group>
      )
    case 'camera':
      return (
        <group>
          <mesh geometry={boxGeo} material={darkMat} position={[0, 1.2, 0]} scale={[0.5, 0.4, 0.35]} />
          <mesh geometry={cylGeo} material={metalMat} position={[0, 1.2, 0.3]} rotation={[Math.PI / 2, 0, 0]} scale={[0.14, 0.25, 0.14]} />
          <mesh geometry={cylGeo} material={metalMat} position={[0, 0.98, 0]} scale={[0.05, 0.3, 0.05]} />
        </group>
      )
    case 'printer':
      return (
        <group>
          <mesh geometry={boxGeo} material={whiteMat} position={[0, 1.3, 0]} scale={[0.9, 0.8, 0.8]} />
          <mesh geometry={boxGeo} material={darkMat} position={[0, 1.3, 0.35]} scale={[0.7, 0.6, 0.08]} />
          <mesh geometry={boxGeo} material={screenMat} position={[0.3, 1.55, 0.41]} scale={[0.2, 0.1, 0.02]} />
        </group>
      )
    case 'microscope':
      return (
        <group>
          <mesh geometry={cylGeo} material={metalMat} position={[0, 1.0, 0]} scale={[0.35, 0.1, 0.35]} />
          <mesh geometry={cylGeo} material={whiteMat} position={[0, 1.4, -0.1]} rotation={[0.35, 0, 0]} scale={[0.12, 0.8, 0.12]} />
          <mesh geometry={cylGeo} material={darkMat} position={[0, 1.25, 0.15]} scale={[0.07, 0.3, 0.07]} />
        </group>
      )
    case 'robot':
      return (
        <group>
          <mesh geometry={boxGeo} material={whiteMat} position={[0, 1.25, 0]} scale={[0.5, 0.45, 0.4]} />
          <mesh geometry={boxGeo} material={metalMat} position={[0, 1.65, 0]} scale={[0.3, 0.3, 0.3]} />
          <mesh geometry={boxGeo} material={darkMat} position={[-0.4, 1.2, 0]} scale={[0.1, 0.5, 0.1]} />
          <mesh geometry={boxGeo} material={darkMat} position={[0.4, 1.2, 0]} scale={[0.1, 0.5, 0.1]} />
        </group>
      )
    case 'board':
      return (
        <group>
          <mesh geometry={boxGeo} material={boardMat} position={[0, 1.0, 0]} scale={[0.9, 0.05, 0.55]} />
          <mesh geometry={boxGeo} material={darkMat} position={[0.1, 1.08, 0]} scale={[0.3, 0.1, 0.3]} />
          <mesh geometry={boxGeo} material={metalMat} position={[-0.35, 1.08, 0.15]} scale={[0.2, 0.1, 0.12]} />
        </group>
      )
    case 'tester':
      return (
        <group>
          <mesh geometry={boxGeo} material={metalMat} position={[0, 1.4, 0]} scale={[0.8, 0.9, 0.5]} />
          <mesh geometry={boxGeo} material={darkMat} position={[0, 1.4, 0.26]} scale={[0.2, 0.7, 0.04]} />
        </group>
      )
    default:
      return <mesh geometry={boxGeo} material={metalMat} position={[0, 1.2, 0]} scale={[0.7, 0.5, 0.5]} />
  }
}

export function statusBadge(e: Pick<EquipmentType, 'status' | 'quantity_available' | 'quantity_total'>) {
  if (e.status === 'available') return { icon: '●', text: `Available ${e.quantity_available}/${e.quantity_total}`, bg: '#15803D', fg: '#ffffff' }
  if (e.status === 'occupied') return { icon: '◐', text: 'Fully booked now', bg: '#B45309', fg: '#ffffff' }
  return { icon: '▲', text: 'Maintenance', bg: '#B91C1C', fg: '#ffffff' }
}

export function EquipmentAnchor({ x, z, equipment, highlighted, showBadge }: {
  x: number; z: number; equipment: EquipmentType; highlighted: boolean; showBadge: boolean
}) {
  const ring = useRef<THREE.Mesh>(null)
  const kind = useMemo(() => modelKind(equipment), [equipment])
  useFrame(({ clock }) => {
    if (!ring.current) return
    const reduce = useExplorerStore.getState().reduceMotion
    const s = reduce ? 1.1 : 1 + 0.18 * Math.sin(clock.elapsedTime * 4)
    ring.current.scale.set(s, s, s)
  })
  const b = statusBadge(equipment)
  return (
    <group position={[x, 0, z]}>
      <Model kind={kind} />
      {highlighted && (
        <mesh ref={ring} position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.05, 1.2, 40]} />
          <meshBasicMaterial color="#2f62d8" transparent opacity={0.85} />
        </mesh>
      )}
      {showBadge && (
        <Html position={[0, 2.35, 0]} center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{ background: b.bg, color: b.fg, border: highlighted ? '2px solid #2563EB' : '1px solid rgba(255,255,255,.35)', borderRadius: 8, padding: '3px 9px', fontSize: 12, lineHeight: 1.35, whiteSpace: 'nowrap', textAlign: 'center', fontFamily: 'system-ui, "Segoe UI", sans-serif', boxShadow: '0 1px 3px rgba(16,24,40,.12)' }}
          >
            <div style={{ fontWeight: 600, color: '#ffffff' }}>{equipment.name}</div>
            <div style={{ fontWeight: 500 }}>{b.icon} {b.text}{highlighted ? ' · ★ Project Lab match' : ''}</div>
          </div>
        </Html>
      )}
    </group>
  )
}
