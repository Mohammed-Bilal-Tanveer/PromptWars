import { Component, useRef, type ComponentType, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* Procedural hero models: shared module-level geometry/materials, a handful of meshes each. */
const box = new THREE.BoxGeometry(1, 1, 1)
const cyl = new THREE.CylinderGeometry(1, 1, 1, 12)
const fanRing = new THREE.TorusGeometry(0.1, 0.018, 6, 20)
const fanHub = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 8)
const mat = (color: string, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o })
const M = {
  pcb: mat('#0e8a8f', { roughness: 0.5 }),
  black: mat('#14181f', { roughness: 0.7 }),
  silver: mat('#c4cad4', { roughness: 0.3, metalness: 0.7 }),
  gold: mat('#d6b24a', { roughness: 0.35, metalness: 0.6 }),
  led: mat('#22c55e', { emissive: '#22c55e', emissiveIntensity: 1.2 }),
  ledOrange: mat('#f59e0b', { emissive: '#f59e0b', emissiveIntensity: 0.9 }),
  case: mat('#242b38', { roughness: 0.5 }),
  glass: mat('#7cc4ff', { transparent: true, opacity: 0.22, roughness: 0.1 }),
  fanGlow: mat('#38bdf8', { emissive: '#38bdf8', emissiveIntensity: 1.4 }),
  screen: mat('#1d4ed8', { emissive: '#3b82f6', emissiveIntensity: 0.6 }),
  white: mat('#e5e7eb', { roughness: 0.55 }),
  frame: mat('#2b3140', { roughness: 0.5 }),
  rod: mat('#aeb6c4', { roughness: 0.3, metalness: 0.8 }),
  bed: mat('#3a4254', { roughness: 0.8 }),
  filament: mat('#f97316', { roughness: 0.5 }),
}
const Y = 0.95 // bench top

type P = { animate: boolean }

export function ArduinoModel({ animate }: P) {
  const led = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (animate && led.current) led.current.visible = Math.sin(clock.elapsedTime * 5) > -0.3
  })
  return (
    <group position={[0, Y, 0]} rotation={[0, 0.2, 0]}>
      <mesh geometry={box} material={M.pcb} position={[0, 0.03, 0]} scale={[1.0, 0.05, 0.62]} castShadow />
      <mesh geometry={box} material={M.silver} position={[-0.42, 0.11, -0.12]} scale={[0.22, 0.14, 0.2]} />
      <mesh geometry={box} material={M.black} position={[-0.43, 0.09, 0.2]} scale={[0.16, 0.1, 0.16]} />
      <mesh geometry={box} material={M.black} position={[0, 0.08, -0.27]} scale={[0.7, 0.07, 0.05]} />
      <mesh geometry={box} material={M.black} position={[0.04, 0.08, 0.27]} scale={[0.6, 0.07, 0.05]} />
      <mesh geometry={box} material={M.black} position={[0.2, 0.075, 0]} scale={[0.34, 0.05, 0.12]} />
      <mesh geometry={box} material={M.silver} position={[-0.1, 0.075, 0.06]} scale={[0.12, 0.045, 0.1]} />
      <mesh geometry={box} material={M.led} position={[0.38, 0.065, -0.1]} scale={[0.05, 0.03, 0.05]} />
      <mesh ref={led} geometry={box} material={M.ledOrange} position={[0.38, 0.065, 0.02]} scale={[0.05, 0.03, 0.05]} />
      <mesh geometry={box} material={M.gold} position={[-0.25, 0.062, 0.12]} scale={[0.05, 0.025, 0.05]} />
    </group>
  )
}

const FAN_Y = [0.22, 0.54, 0.76]

export function GpuWorkstationModel({ animate }: P) {
  const fans = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => {
    if (!animate) return
    const t = clock.elapsedTime * 4
    for (const f of fans.current) if (f) f.rotation.z = t
  })
  return (
    <group position={[0, Y, 0]}>
      <mesh geometry={box} material={M.case} position={[0.5, 0.45, 0]} scale={[0.42, 0.9, 0.62]} castShadow />
      <mesh geometry={box} material={M.glass} position={[0.5, 0.45, 0.32]} scale={[0.34, 0.78, 0.01]} />
      {FAN_Y.map((y, i) => (
        <mesh key={i} ref={(m) => { fans.current[i] = m }} geometry={fanRing} material={M.fanGlow} position={[0.5, y, 0.325]} scale={i === 0 ? 1.3 : 1}>
          <mesh geometry={fanHub} material={M.fanGlow} rotation={[Math.PI / 2, 0, 0]} />
        </mesh>
      ))}
      <mesh geometry={box} material={M.gold} position={[0.5, 0.38, 0.3]} scale={[0.26, 0.07, 0.04]} />
      <mesh geometry={cyl} material={M.black} position={[-0.3, 0.02, 0]} scale={[0.16, 0.04, 0.12]} />
      <mesh geometry={box} material={M.black} position={[-0.3, 0.2, -0.02]} scale={[0.05, 0.36, 0.05]} />
      <mesh geometry={box} material={M.black} position={[-0.3, 0.62, 0]} scale={[0.72, 0.44, 0.05]} castShadow />
      <mesh geometry={box} material={M.screen} position={[-0.3, 0.62, 0.03]} scale={[0.66, 0.38, 0.01]} />
      <mesh geometry={box} material={M.white} position={[-0.3, 0.02, 0.35]} scale={[0.4, 0.03, 0.14]} />
    </group>
  )
}

const POSTS = [-0.36, 0.36]

export function Printer3dModel({ animate }: P) {
  const head = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (animate && head.current) head.current.position.x = Math.sin(clock.elapsedTime * 1.6) * 0.14
  })
  return (
    <group position={[0, Y, 0]}>
      <mesh geometry={box} material={M.frame} position={[0, 0.03, 0]} scale={[0.8, 0.06, 0.7]} castShadow />
      <mesh geometry={box} material={M.bed} position={[0, 0.1, 0.02]} scale={[0.56, 0.03, 0.5]} />
      {POSTS.map((x) => (
        <mesh key={x} geometry={box} material={M.frame} position={[x, 0.45, -0.28]} scale={[0.05, 0.8, 0.05]} />
      ))}
      <mesh geometry={box} material={M.frame} position={[0, 0.86, -0.28]} scale={[0.8, 0.05, 0.05]} />
      <mesh geometry={cyl} material={M.rod} position={[0, 0.5, -0.1]} rotation={[0, 0, Math.PI / 2]} scale={[0.018, 0.38, 0.018]} />
      <mesh geometry={box} material={M.frame} position={[-0.36, 0.5, -0.1]} scale={[0.05, 0.05, 0.3]} />
      <mesh geometry={box} material={M.frame} position={[0.36, 0.5, -0.1]} scale={[0.05, 0.05, 0.3]} />
      <group ref={head} position={[0, 0.5, -0.1]}>
        <mesh geometry={box} material={M.black} position={[0, 0, 0.02]} scale={[0.14, 0.12, 0.12]} />
        <mesh geometry={cyl} material={M.gold} position={[0, -0.09, 0.02]} scale={[0.02, 0.06, 0.02]} />
      </group>
      <mesh geometry={box} material={M.filament} position={[0, 0.2, 0.02]} scale={[0.2, 0.17, 0.2]} />
      <mesh geometry={box} material={M.filament} position={[0, 0.3, 0.02]} scale={[0.14, 0.03, 0.14]} />
      <mesh geometry={box} material={M.screen} position={[0.28, 0.1, 0.38]} scale={[0.16, 0.08, 0.02]} />
      <mesh geometry={cyl} material={M.filament} position={[0.34, 0.95, -0.28]} rotation={[Math.PI / 2, 0, 0]} scale={[0.12, 0.05, 0.12]} />
    </group>
  )
}

/** Registry: equipment id -> hero model. All other equipment keeps the generic model. */
export const HERO_MODELS: Record<string, ComponentType<P>> = {
  'eq-arduino': ArduinoModel,
  'eq-gpu-workstation': GpuWorkstationModel,
  'eq-3d-printer': Printer3dModel,
}

/** Catches a throwing hero model and renders the primitive fallback instead. */
export class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { /* optional model: swallow */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export function HeroOrFallback({ equipmentId, animate, fallback }: { equipmentId: string; animate: boolean; fallback: ReactNode }) {
  const Hero = HERO_MODELS[equipmentId]
  if (!Hero) return <>{fallback}</>
  return <ModelBoundary fallback={fallback}><Hero animate={animate} /></ModelBoundary>
}
