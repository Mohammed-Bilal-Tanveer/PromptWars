import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { input, playerState } from './playerState'
import { AABB, locationFor, resolveCollisions } from '../environments/layout'
import { findNearest, getInteractables } from '../interactions/registry'
import { useExplorerStore } from '../stores/explorerStore'
import { autoWalk, cancelWalk, startWalk } from '../interactions/navigation'
import { PlayerModel } from './KenneyCharacter'

const WALK = 4.2
const RUN = 8
const RADIUS = 0.45
const PITCH = (52 * Math.PI) / 180

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
  const marker = useRef<THREE.Mesh>(null)
  const { camera } = useThree()
  const acc = useRef(0)
  const camPos = useMemo(() => new THREE.Vector3(0, 12, 26), [])
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
    if (mag > 0.05 && autoWalk.target) cancelWalk()
    const sy = Math.sin(playerState.yaw), cy = Math.cos(playerState.yaw)
    let mx = 0, mz = 0
    const faceTo = (tx: number, tz: number, dtt: number) => {
      let diff = Math.atan2(tx, tz) - playerState.heading
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      playerState.heading += diff * Math.min(1, dtt * 12)
    }
    if (mag > 0.05) {
      mx = -sy * fw + cy * rt
      mz = -cy * fw - sy * rt
      const l = Math.hypot(mx, mz) || 1
      mx /= l; mz /= l
      const running = k.has('shift') || input.sprint || Math.hypot(input.joy.x, input.joy.y) > 0.92
      const speed = (running ? RUN : WALK) * (input.sprint ? 1 : mag)
      pos.x = playerState.x + mx * speed * dt
      pos.z = playerState.z + mz * speed * dt
      resolveCollisions(pos, RADIUS, colliders)
      playerState.x = pos.x
      playerState.z = pos.z
      playerState.speed = speed
      faceTo(mx, mz, dt)
    } else if (autoWalk.target && !paused) {
      const wp = autoWalk.path[0]
      autoWalk.age += dt
      if (!wp || autoWalk.age > 60 || autoWalk.stuck > 1.2) {
        cancelWalk()
        playerState.speed = 0
      } else {
        const dx = wp.x - playerState.x, dz = wp.z - playerState.z
        const d = Math.hypot(dx, dz)
        const last = autoWalk.path.length === 1
        if (d < (last ? 0.6 : 0.8)) {
          autoWalk.path.shift()
          if (!autoWalk.path.length) { cancelWalk(); playerState.speed = 0 }
        } else {
          const speed = input.sprint ? RUN : WALK
          const step = Math.min(speed * dt, d)
          pos.x = playerState.x + (dx / d) * step
          pos.z = playerState.z + (dz / d) * step
          resolveCollisions(pos, RADIUS, colliders)
          const moved = Math.hypot(pos.x - playerState.x, pos.z - playerState.z)
          autoWalk.stuck = moved < step * 0.3 ? autoWalk.stuck + dt : 0
          playerState.x = pos.x
          playerState.z = pos.z
          playerState.speed = speed
          faceTo(dx / d, dz / d, dt)
        }
      }
    } else {
      playerState.speed = 0
    }

    if (group.current) {
      group.current.position.set(playerState.x, 0, playerState.z)
      group.current.rotation.y = playerState.heading
    }

    // follow camera: fixed three-quarter top-down pitch, horizontal orbit only
    const inside = st.insideBuilding != null
    const dist = inside ? 12 : 16
    const horiz = dist * Math.cos(PITCH), height = dist * Math.sin(PITCH)
    const want = new THREE.Vector3(playerState.x + sy * horiz, height, playerState.z + cy * horiz)
    if (reduce) camPos.copy(want)
    else camPos.lerp(want, 1 - Math.exp(-6 * dt))
    camera.position.copy(camPos)
    look.set(playerState.x, 0.8, playerState.z)
    camera.lookAt(look)

    // destination marker
    if (marker.current) {
      const t = autoWalk.target
      marker.current.visible = !!t
      if (t) {
        marker.current.position.set(t.x, 0.12, t.z)
        const sc = reduce ? 1 : 1 + Math.sin(performance.now() / 250) * 0.12
        marker.current.scale.set(sc, sc, sc)
      }
    }

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
    <>
      <group ref={group}>
        <BlobShadow size={1.7} />
        <PlayerModel id={characterId} fallback={<ProceduralBody />} />
      </group>
      {/* invisible click-to-walk ground; ignores drags (orbit) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        onClick={(e) => {
          if (paused || e.delta > 6) return
          startWalk({ x: e.point.x, z: e.point.z })
        }}
      >
        <planeGeometry args={[600, 600]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.45, 0.65, 32]} />
        <meshBasicMaterial color="#1d4ed8" transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </>
  )
}
