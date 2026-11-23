import { Component, Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { BENCH_SIZE, BuildingDef, DOOR_WIDTH, consolePos, csAiTerminal, isInside } from '../environments/layout'
import { playerState } from '../character/playerState'
import { TERMINAL_ACCENT, Terminal } from './Props'
import { FLOOR_H, MODULE, usePieceMeshes, type PieceMesh } from './kenney'

const boxGeo = new THREE.BoxGeometry(1, 1, 1)
const benchMat = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.8 })
const lightMat = new THREE.MeshStandardMaterial({ color: '#ffd98a', emissive: '#ffc766', emissiveIntensity: 0.8 })
const SIGN_BOARD_MAT = new THREE.MeshStandardMaterial({ color: '#2f3744', roughness: 0.75 })
const doorMat = new THREE.MeshStandardMaterial({ color: '#5a3d2b', roughness: 1 })
const WALL_T = 0.5

export function Bench({ x, z, rot = 0, height = 0.9 }: { x: number; z: number; rot?: number; height?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh geometry={boxGeo} material={benchMat} position={[0, height / 2, 0]} scale={[BENCH_SIZE.w, height, BENCH_SIZE.d]} castShadow receiveShadow />
    </group>
  )
}

/* ---------- instanced kit modules ---------- */
interface Item { x: number; y: number; z: number; ry: number }

function InstSet({ geometry, material, items, shadow = true }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: Item[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const d = new THREE.Object3D()
    items.forEach((it, i) => {
      d.position.set(it.x, it.y, it.z)
      d.rotation.set(0, it.ry, 0)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [items])
  if (items.length === 0) return null
  return <instancedMesh key={items.length} ref={ref} args={[geometry, material, items.length]} castShadow={shadow} receiveShadow frustumCulled={false} />
}

function Modules({ meshes, items, material, shadow }: { meshes: PieceMesh[]; items: Item[]; material: THREE.Material; shadow?: boolean }) {
  return <>{meshes.map((pm, k) => <InstSet key={k} geometry={pm.geometry} material={material} items={items} shadow={shadow} />)}</>
}

const HALF_PI = Math.PI / 2

/** Mix a hex colour towards white so the kit's pale palette keeps a recognisable tint per building. */
const tint = (hex: string, _mix = 0) => new THREE.Color(hex)

/** Kenney Building Kit shell: two storeys of walls/windows, doorway, columns, floor and flat roof (roof hides when inside). */
function KitShell({ def }: { def: BuildingDef }) {
  const wall = usePieceMeshes('wall')
  const win = usePieceMeshes('wall-window-square')
  const winWide = usePieceMeshes('wall-window-wide-square')
  const doorWide = usePieceMeshes('wall-doorway-wide-square')
  const column = usePieceMeshes('column')
  const floor = usePieceMeshes('floor')
  const roofC = usePieceMeshes('roof-flat-center')
  const roofS = usePieceMeshes('roof-flat-side')
  const roofK = usePieceMeshes('roof-flat-corner')

  const { x, z, w, d, h, facing } = def
  const hw = w / 2, hd = d / 2
  const nx = Math.round(w / MODULE), nz = Math.round(d / MODULE)
  const fz = z + facing * hd, bz = z - facing * hd

  const map = (wall[0].material as THREE.MeshStandardMaterial).map
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ map, color: tint(def.color), emissive: tint(def.color), emissiveIntensity: 0.1, roughness: 0.92, side: THREE.DoubleSide, transparent: true }), [map, def.color])
  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ map, color: tint(def.roofColor), emissive: tint(def.roofColor), emissiveIntensity: 0.08, roughness: 0.88, side: THREE.DoubleSide }), [map, def.roofColor])
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ map, color: '#a98c68', roughness: 0.95 }), [map])
  const roofRef = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    const inside = isInside(def, playerState.x, playerState.z)
    wallMat.opacity += ((inside ? 0.3 : 1) - wallMat.opacity) * Math.min(1, dt * 8)
    wallMat.depthWrite = wallMat.opacity > 0.9
    if (roofRef.current) roofRef.current.visible = !inside
  })

  const sets = useMemo(() => {
    const plain: Item[] = [], windows: Item[] = [], wide: Item[] = [], doors: Item[] = [], cols: Item[] = []
    const xAt = (i: number) => x - hw + MODULE / 2 + MODULE * i
    const zAt = (j: number) => z - hd + MODULE / 2 + MODULE * j
    const doorSlots = new Set([nx / 2 - 1, nx / 2])
    for (let f = 0; f < 2; f++) {
      const y = f * FLOOR_H
      if (f === 0) {
        // front wall (with doorway) — runs along X so rotate 90°
        doors.push({ x, y, z: fz, ry: HALF_PI })
        for (let i = 0; i < nx; i++) {
          if (doorSlots.has(i)) continue
          const edge = i === 0 || i === nx - 1 || i === 2 || i === nx - 3
          ;(edge ? windows : plain).push({ x: xAt(i), y, z: fz, ry: HALF_PI })
        }
      } else {
        for (let k = 0; k < nx / 2; k++) wide.push({ x: x - hw + MODULE + 2 * MODULE * k, y, z: fz, ry: HALF_PI })
      }
      // back wall — wide windows
      for (let k = 0; k < nx / 2; k++) wide.push({ x: x - hw + MODULE + 2 * MODULE * k, y, z: bz, ry: HALF_PI })
      // side walls — run along Z
      for (let j = 0; j < nz; j++) {
        const isWin = f === 1 || j % 3 === 1
        for (const sx of [-1, 1]) (isWin ? windows : plain).push({ x: x + sx * hw, y, z: zAt(j), ry: 0 })
      }
      // corner columns
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cols.push({ x: x + sx * hw, y, z: z + sz * hd, ry: 0 })
    }
    // floor tiles
    const floors: Item[] = []
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) floors.push({ x: xAt(i), y: -0.02, z: zAt(j), ry: 0 })
    // roof: edge cells use side/corner pieces oriented so the overhang points outward
    const rc: Item[] = [], rs: Item[] = [], rk: Item[] = []
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const ex = i === 0 ? -1 : i === nx - 1 ? 1 : 0
        const ez = j === 0 ? -1 : j === nz - 1 ? 1 : 0
        const it = { x: xAt(i), y: h, z: zAt(j), ry: 0 }
        if (ex && ez) {
          rk.push({ ...it, ry: ex > 0 && ez > 0 ? 0 : ex < 0 && ez < 0 ? Math.PI : ex > 0 ? HALF_PI : -HALF_PI })
        } else if (ex || ez) {
          rs.push({ ...it, ry: ex > 0 ? 0 : ex < 0 ? Math.PI : ez > 0 ? -HALF_PI : HALF_PI })
        } else rc.push(it)
      }
    }
    return { plain, windows, wide, doors, cols, floors, rc, rs, rk }
  }, [x, z, hw, hd, nx, nz, fz, bz, h])

  return (
    <group>
      <Modules meshes={floor} items={sets.floors} material={floorMat} shadow={false} />
      <Modules meshes={wall} items={sets.plain} material={wallMat} />
      <Modules meshes={win} items={sets.windows} material={wallMat} />
      <Modules meshes={winWide} items={sets.wide} material={wallMat} />
      <Modules meshes={doorWide} items={sets.doors} material={wallMat} />
      <Modules meshes={column} items={sets.cols} material={wallMat} />
      <group ref={roofRef}>
        <Modules meshes={roofC} items={sets.rc} material={roofMat} />
        <Modules meshes={roofS} items={sets.rs} material={roofMat} />
        <Modules meshes={roofK} items={sets.rk} material={roofMat} />
      </group>
    </group>
  )
}

/** Primitive fallback used only if the kit models fail to load. */
function PrimitiveShell({ def }: { def: BuildingDef }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.85 }), [def.color])
  const { x, z, w, d, h, facing } = def
  const sideW = (w - DOOR_WIDTH) / 2, hw = w / 2, hd = d / 2, fz = z + facing * hd
  return (
    <group>
      <mesh geometry={boxGeo} material={floorMatPrim} position={[x, 0.05, z]} scale={[w, 0.1, d]} receiveShadow />
      <mesh geometry={boxGeo} material={mat} position={[x - hw + sideW / 2, h / 2, fz]} scale={[sideW, h, WALL_T]} castShadow />
      <mesh geometry={boxGeo} material={mat} position={[x + hw - sideW / 2, h / 2, fz]} scale={[sideW, h, WALL_T]} castShadow />
      <mesh geometry={boxGeo} material={mat} position={[x, h / 2, z - facing * hd]} scale={[w, h, WALL_T]} castShadow />
      <mesh geometry={boxGeo} material={mat} position={[x - hw, h / 2, z]} scale={[WALL_T, h, d]} castShadow />
      <mesh geometry={boxGeo} material={mat} position={[x + hw, h / 2, z]} scale={[WALL_T, h, d]} castShadow />
    </group>
  )
}
const floorMatPrim = new THREE.MeshStandardMaterial({ color: '#cfd6e6', roughness: 0.9 })

class ShellBoundary extends Component<{ def: BuildingDef; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <PrimitiveShell def={this.props.def} /> : this.props.children
  }
}

/** Building = Kenney kit shell + signage + interior props. Interior lights/benches/terminals are shared with the data layer. */
export function Building({ def, benchSlots, children, hasAiTerminal }: {
  def: BuildingDef
  benchSlots: { x: number; z: number }[]
  children?: ReactNode
  hasAiTerminal?: boolean
}) {
  const { x, z, d, h, facing } = def
  const hd = d / 2
  const fz = z + facing * hd
  const signMat = SIGN_BOARD_MAT
  const accentMat = useMemo(() => new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.8 }), [def.color])
  const rot = facing === 1 ? 0 : Math.PI
  const signRef = useRef<THREE.Group>(null)
  useFrame(() => {
    if (signRef.current) signRef.current.visible = !isInside(def, playerState.x, playerState.z)
  })

  return (
    <group>
      <ShellBoundary def={def}>
        <Suspense fallback={null}>
          <KitShell def={def} />
        </Suspense>
      </ShellBoundary>
      {/* door mat */}
      <mesh geometry={boxGeo} material={doorMat} position={[x, 0.09, fz + facing * 0.9]} scale={[DOOR_WIDTH, 0.04, 1.6]} />
      {/* roof sign board + short label */}
      <group ref={signRef} position={[x, h + 1.05, fz + facing * 0.3]} rotation={[0, rot, 0]}>
        <mesh geometry={boxGeo} material={signMat} scale={[7.4, 1.9, 0.22]} castShadow />
        <mesh geometry={boxGeo} material={accentMat} position={[0, -0.88, 0.02]} scale={[7.4, 0.14, 0.24]} />
        <Text position={[0, 0.3, 0.13]} fontSize={0.72} color="#ffffff" anchorX="center" anchorY="middle">
          {def.short}
        </Text>
        <Text position={[0, -0.38, 0.13]} fontSize={0.3} color="#d0d5dd" anchorX="center" anchorY="middle" maxWidth={7}>
          {def.label}
        </Text>
      </group>
      {/* interior lights + sign */}
      {[-4, 4].map((u) => (
        <mesh key={u} geometry={boxGeo} material={lightMat} position={[x + u, h - 0.5, z]} scale={[1.6, 0.1, 0.6]} />
      ))}
      <Text position={[x, 2.9, z - facing * (hd - 0.45)]} rotation={[0, rot, 0]} fontSize={0.5} color="#344054" anchorX="center">
        {def.short + ' interior'}
      </Text>
      {benchSlots.map((s, i) => (
        <Bench key={i} x={s.x} z={s.z} />
      ))}
      {hasAiTerminal && <Terminal x={csAiTerminal(def).x} z={csAiTerminal(def).z} color={TERMINAL_ACCENT} label="Project Lab" />}
      {def.special && (() => {
        const c = consolePos(def)
        return (
          <group position={[c.x, 0, c.z]}>
            <mesh geometry={boxGeo} material={benchMat} position={[0, 0.5, 0]} scale={[3, 1, 1]} castShadow />
            <mesh position={[0, 1.4, 0]}>
              <boxGeometry args={[2.6, 0.9, 0.12]} />
              <meshStandardMaterial color={TERMINAL_ACCENT} emissive={TERMINAL_ACCENT} emissiveIntensity={0.35} roughness={0.5} />
            </mesh>
            <Text position={[0, 2.3, 0]} rotation={[0, rot, 0]} fontSize={0.4} color="#ffffff" outlineWidth={0.04} outlineColor="#10243a" anchorX="center">
              {def.special === 'operations' ? 'Approval Desk' : 'Analytics Console'}
            </Text>
          </group>
        )
      })()}
      {children}
    </group>
  )
}
