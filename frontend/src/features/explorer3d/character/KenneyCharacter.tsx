import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { CHARACTER_SCALE, characterUrl } from '../scene/kenney'
import { playerState } from './playerState'
import { useExplorerStore } from '../stores/explorerStore'

export type AnimName = 'idle' | 'walk' | 'sprint' | 'interact-right' | 'emote-yes'

/** Cross-fading controller over the Kenney clip set (idle / walk / sprint / interact …). */
function useAnimationDriver(actions: Record<string, THREE.AnimationAction | null>) {
  const current = useRef('')
  return (name: AnimName, timeScale = 1, once = false) => {
    const next = actions[name]
    if (!next) return
    if (current.current !== name) {
      const prev = current.current ? actions[current.current] : null
      next.reset()
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity)
      next.clampWhenFinished = once
      next.fadeIn(0.22).play()
      prev?.fadeOut(0.22)
      current.current = name
    }
    next.timeScale = timeScale
  }
}

function Model({ id, onFrame, castShadow = true }: { id: string; onFrame: (play: ReturnType<typeof useAnimationDriver>, dt: number) => void; castShadow?: boolean }) {
  const { scene, animations } = useGLTF(characterUrl(id))
  const root = useRef<THREE.Group>(null)
  const model = useMemo(() => cloneSkinned(scene) as THREE.Object3D, [scene])
  const { actions } = useAnimations(animations, root)
  const play = useAnimationDriver(actions as Record<string, THREE.AnimationAction | null>)

  useLayoutEffect(() => {
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) { m.castShadow = castShadow; m.receiveShadow = false; m.frustumCulled = false }
    })
  }, [model, castShadow])
  useEffect(() => { play('idle') }, [model]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => onFrame(play, Math.min(dt, 0.05)))

  return (
    <group ref={root} scale={CHARACTER_SCALE}>
      <primitive object={model} />
    </group>
  )
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

/** Player body: Kenney model driven by actual movement speed; plays a short "interact" gesture when a panel opens. */
export function PlayerModel({ id, fallback }: { id: string; fallback: ReactNode }) {
  const interactUntil = useRef(0)
  useEffect(() => {
    return useExplorerStore.subscribe((s, prev) => {
      if (s.panel && !prev.panel && s.panel.kind !== 'settings') interactUntil.current = performance.now() + 1100
    })
  }, [])
  return (
    <ModelBoundary key={id} fallback={fallback}>
      <Suspense fallback={fallback}>
        <Model
          id={id}
          onFrame={(play) => {
            const reduce = useExplorerStore.getState().reduceMotion
            const sp = playerState.speed
            if (performance.now() < interactUntil.current && sp < 0.1) play('interact-right', 1, true)
            else if (sp > 6) play('sprint', reduce ? 0.8 : 1)
            else if (sp > 0.1) play('walk', Math.min(1.35, Math.max(0.7, sp / 4.2)))
            else play('idle', reduce ? 0.5 : 1)
          }}
        />
      </Suspense>
    </ModelBoundary>
  )
}

/* ---------- ambient NPC students (purely decorative, no collisions or data) ---------- */
export interface NpcDef {
  id: string
  x: number
  z: number
  heading: number
  /** optional patrol between two points */
  to?: { x: number; z: number }
}

function Npc({ def }: { def: NpcDef }) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(Math.random() * 10)
  const state = useRef({ x: def.x, z: def.z, dir: 1, heading: def.heading, pause: 0 })
  const reduce = useExplorerStore((s) => s.reduceMotion)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = state.current
    t.current += dt
    if (def.to && !reduce) {
      if (s.pause > 0) s.pause -= dt
      else {
        const tx = s.dir === 1 ? def.to.x : def.x
        const tz = s.dir === 1 ? def.to.z : def.z
        const dx = tx - s.x, dz = tz - s.z
        const dist = Math.hypot(dx, dz)
        if (dist < 0.2) { s.dir *= -1; s.pause = 2.5 }
        else {
          const sp = 1.7
          s.x += (dx / dist) * sp * dt
          s.z += (dz / dist) * sp * dt
          const target = Math.atan2(dx, dz)
          let diff = target - s.heading
          diff = Math.atan2(Math.sin(diff), Math.cos(diff))
          s.heading += diff * Math.min(1, dt * 8)
        }
      }
    }
    if (g.current) {
      g.current.position.set(s.x, 0, s.z)
      g.current.rotation.y = s.heading
    }
  })

  return (
    <group ref={g} position={[def.x, 0, def.z]}>
      <ModelBoundary fallback={null}>
        <Suspense fallback={null}>
          <Model
            id={def.id}
            castShadow={false}
            onFrame={(play) => {
              const moving = !!def.to && !reduce && state.current.pause <= 0
              if (moving) play('walk', 0.75)
              else play('idle', reduce ? 0.4 : 1)
            }}
          />
        </Suspense>
      </ModelBoundary>
    </group>
  )
}

export function Npcs({ npcs }: { npcs: NpcDef[] }) {
  return <>{npcs.map((n) => <Npc key={n.id + n.x + n.z} def={n} />)}</>
}
