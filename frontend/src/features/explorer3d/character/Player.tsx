import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { input, playerState } from './playerState'
import { AABB, locationFor, resolveCollisions } from '../environments/layout'
import { findNearest, getInteractables } from '../interactions/registry'
import { useExplorerStore } from '../stores/explorerStore'
import { PlayerModel } from './KenneyCharacter'

const WALK = 4.2
const RUN = 8
const RADIUS = 0.45

const skin = new THREE.MeshStandardMaterial({ color: '#f1c27d', roughness: 0.8 })
const shirt = new THREE.MeshStandardMaterial({ color: '#4f8bff', roughness: 0.7 })
const pants = new THREE.MeshStandardMaterial({ color: '#2b2f4a', roughness: 0.8 })
const hair = new THREE.MeshStandardMaterial({ color: '#2b1b12', roughness: 0.9 })
const headGeo = new THREE.SphereGeometry(0.28, 12, 10)
const bodyGeo = new THREE.BoxGeometry(0.6, 0.75, 0.34)
const limbGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2)
const hairGeo = new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.8)

/** Procedural stand-in shown only while the Kenney model loads (or if it fails to load). */
function ProceduralBody() {
  const lArm = useRef<THREE.Group>(null)
  const rArm = useRef<THREE.Group>(null)
  const lLeg = useRef<THREE.Group>(null)
  const rLeg = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const t = useRef(0)
  useFrame((_, dt) => {
    const reduce = useExplorerStore.getState().reduceMotion
    const sp = playerState.speed
    t.current += dt * (sp > 6 ? 14 : 9) * (sp > 0.1 ? 1 : 0)
    const amp = reduce ? 0.12 : Math.min(1, sp / 4.2) * (sp > 6 ? 0.9 : 0.6)
    const s = Math.sin(t.current) * amp
    if (lLeg.current) lLeg.current.rotation.x = s
    if (rLeg.current) rLeg.current.rotation.x = -s
    if (lArm.current) lArm.current.rotation.x = -s
    if (rArm.current) rArm.current.rotation.x = s
    if (body.current) {
      const idle = sp < 0.1 && !reduce ? Math.sin(performance.now() / 600) * 0.015 : 0
      body.current.position.y = 0.95 + idle + (sp > 0.1 && !reduce ? Math.abs(Math.sin(t.current)) * 0.05 : 0)
    }
  })
  return (
    <>
      <group ref={body} position={[0, 0.95, 0]}>
        <mesh geometry={bodyGeo} material={shirt} position={[0, 0.2, 0]} castShadow />
        <mesh geometry={headGeo} material={skin} position={[0, 0.82, 0]} castShadow />
        <mesh geometry={hairGeo} material={hair} position={[0, 0.86, -0.02]} />
        <group ref={lArm} position={[-0.4, 0.5, 0]}>
          <mesh geometry={limbGeo} material={skin} position={[0, -0.3, 0]} castShadow />
        </group>
        <group ref={rArm} position={[0.4, 0.5, 0]}>
          <mesh geometry={limbGeo} material={skin} position={[0, -0.3, 0]} castShadow />
        </group>
        <group ref={lLeg} position={[-0.15, -0.2, 0]}>
          <mesh geometry={limbGeo} material={pants} position={[0, -0.35, 0]} castShadow />
        </group>
        <group ref={rLeg} position={[0.15, -0.2, 0]}>
          <mesh geometry={limbGeo} material={pants} position={[0, -0.35, 0]} castShadow />
        </group>
      </group>
    </>
  )
}

/** Soft contact shadow so the character is grounded even when real-time shadows are off. */
let blobCache: THREE.CanvasTexture | null = null
const blobTex = () => {
  if (blobCache) return blobCache
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (!g) return null
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30)
  grad.addColorStop(0, 'rgba(0,0,0,0.45)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  blobCache = new THREE.CanvasTexture(c)
  return blobCache
}
export function BlobShadow({ size = 1.5 }: { size?: number }) {
  const map = useMemo(() => blobTex(), [])
  if (!map) return null
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} />
    </mesh>
  )
}

export function PlayerRig({ colliders, paused }: { colliders: AABB[]; paused: boolean }) {
  const group = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const acc = useRef(0)
  const camPos = useMemo(() => new THREE.Vector3(0, 6, 16), [])
  const look = useMemo(() => new THREE.Vector3(), [])
  const pos = useMemo(() => ({ x: playerState.x, z: playerState.z }), [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const st = useExplorerStore.getState()
    const reduce = st.reduceMotion
    const k = input.keys

    // camera orbit
    let rot = 0
    if (!paused) {
      if (k.has('q')) rot -= 1
      if (k.has('r')) rot += 1
    }
    playerState.yaw += rot * 1.8 * dt + input.orbitDelta
    input.orbitDelta = 0

    // movement intent
    let fw = 0, rt = 0
    if (!paused) {
      if (k.has('w') || k.has('arrowup')) fw += 1
      if (k.has('s') || k.has('arrowdown')) fw -= 1
      if (k.has('d') || k.has('arrowright')) rt += 1
      if (k.has('a') || k.has('arrowleft')) rt -= 1
      fw += -input.joy.y
      rt += input.joy.x
    }
    const mag = Math.min(1, Math.hypot(fw, rt))
    const sy = Math.sin(playerState.yaw), cy = Math.cos(playerState.yaw)
    let mx = 0, mz = 0
    if (mag > 0.05) {
      mx = -sy * fw + cy * rt
      mz = -cy * fw - sy * rt
      const l = Math.hypot(mx, mz) || 1
      mx /= l; mz /= l
      const running = k.has('shift') || Math.hypot(input.joy.x, input.joy.y) > 0.92
      const speed = (running ? RUN : WALK) * mag
      pos.x = playerState.x + mx * speed * dt
      pos.z = playerState.z + mz * speed * dt
      resolveCollisions(pos, RADIUS, colliders)
      playerState.x = pos.x
      playerState.z = pos.z
      playerState.speed = speed
      const target = Math.atan2(mx, mz)
      let diff = target - playerState.heading
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      playerState.heading += diff * Math.min(1, dt * 12)
    } else {
      playerState.speed = 0
    }

    if (group.current) {
      group.current.position.set(playerState.x, 0, playerState.z)
      group.current.rotation.y = playerState.heading
    }

    // follow camera
    const inside = st.insideBuilding != null
    const dist = inside ? 7 : 10
    const height = inside ? 5.5 : 6.5
    const want = new THREE.Vector3(playerState.x + sy * dist, height, playerState.z + cy * dist)
    if (reduce) camPos.copy(want)
    else camPos.lerp(want, 1 - Math.exp(-6 * dt))
    camera.position.copy(camPos)
    look.set(playerState.x, 1.4, playerState.z)
    camera.lookAt(look)

    // throttled detection
    acc.current += dt
    if (acc.current > 0.1) {
      acc.current = 0
      const n = findNearest({ x: playerState.x, z: playerState.z }, getInteractables())
      st.setNearest(n)
      const loc = locationFor(playerState.x, playerState.z)
      st.setLocation(loc.label)
      st.setInside(loc.inside)
    }
  })

  const characterId = useExplorerStore((st) => st.character)
  return (
    <group ref={group}>
      <BlobShadow size={1.7} />
      <PlayerModel id={characterId} fallback={<ProceduralBody />} />
    </group>
  )
}
