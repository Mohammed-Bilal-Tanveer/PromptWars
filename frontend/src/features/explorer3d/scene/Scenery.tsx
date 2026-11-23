import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BUILDINGS, CAMPUS_BOUND, POND, doorOutside } from '../environments/layout'
import { useExplorerStore } from '../stores/explorerStore'

/* ---------- shared helpers ---------- */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length) % a.length]

interface Item { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry?: number; color?: THREE.Color }

/** One instanced mesh from a list of items; static, never touched per frame. */
function Inst({ geo, mat, items, cast = false }: { geo: THREE.BufferGeometry; mat: THREE.Material; items: Item[]; cast?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    items.forEach((it, i) => {
      o.position.set(it.x, it.y, it.z)
      o.rotation.set(0, it.ry ?? 0, 0)
      o.scale.set(it.sx, it.sy, it.sz)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      if (it.color) m.setColorAt(i, it.color)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [items])
  if (!items.length) return null
  return <instancedMesh key={items.length} ref={ref} args={[geo, mat, items.length]} frustumCulled={false} castShadow={cast} />
}

const col = (hex: string, jitter = 0.08, r?: () => number) => {
  const c = new THREE.Color(hex)
  if (r && jitter) c.offsetHSL((r() - 0.5) * jitter * 0.4, 0, (r() - 0.5) * jitter)
  return c
}

/* ---------- shared geometry & materials ---------- */
const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1, 6)
const coneGeo = new THREE.ConeGeometry(1, 1, 7)
const blobGeo = new THREE.IcosahedronGeometry(1, 0)
const sphereGeo = new THREE.SphereGeometry(1, 7, 5)
const boxGeo = new THREE.BoxGeometry(1, 1, 1)
const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 1, 6)
const discGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2)
const flat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true, ...extra })
const vcMat = flat('#ffffff')
const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.9 })
const rockMat = flat('#ffffff')
const lampPoleMat = new THREE.MeshStandardMaterial({ color: '#27384d', roughness: 0.6, metalness: 0.3 })
const lampGlowMat = new THREE.MeshStandardMaterial({ color: '#ffd37a', emissive: '#ffb84d', emissiveIntensity: 1.1 })
const woodMat = new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 0.85 })
const stoneWallMat = new THREE.MeshStandardMaterial({ color: '#85796a', roughness: 0.95 })
const wallCapMat = new THREE.MeshStandardMaterial({ color: '#5f5649', roughness: 0.95 })
const hedgeMat = flat('#2f6b3a')
const patchMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const waterMat = new THREE.MeshStandardMaterial({ color: '#2a8fb0', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 })
const sandMat = new THREE.MeshStandardMaterial({ color: '#d4b27a', roughness: 1 })

/* ---------- blocking test (keep scenery off paths, doors, plaza, pond, buildings) ---------- */
const RING = 70
function blocked(x: number, z: number, pad: number) {
  const ax = Math.abs(x), az = Math.abs(z)
  if (Math.hypot(x, z) < 17 + pad) return true // plaza + flower beds
  if (ax < 3.5 + pad && az < RING + 3) return true // avenue
  if (az < 3.5 + pad && ax < RING + 3) return true
  if (Math.abs(ax - RING) < 3 + pad && az < RING + 3) return true // ring road
  if (Math.abs(az - RING) < 3 + pad && ax < RING + 3) return true
  if ((Math.abs(z + 14) < 3 + pad || Math.abs(z - 16) < 3 + pad) && ax < 32) return true // building connectors
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 5 + pad) return true
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.x) < b.w / 2 + 4 + pad && Math.abs(z - b.z) < b.d / 2 + 4 + pad) return true
    const door = doorOutside(b, 0)
    const lo = Math.min(door.z, 0) - pad, hi = Math.max(door.z, 0) + pad
    if (Math.abs(x - b.x) < 3.5 + pad && z > lo && z < hi) return true
    // front garden
    const f = doorOutside(b, 7)
    if (Math.abs(x - f.x) < 6 + pad && Math.abs(z - f.z) < 5 + pad) return true
  }
  return false
}

/* ---------- ground, paths, plaza ---------- */
const pathMat = new THREE.MeshStandardMaterial({ color: '#cdb48b', roughness: 1 })
const pathEdgeMat = new THREE.MeshStandardMaterial({ color: '#8c7452', roughness: 1 })
const plazaOuter = new THREE.MeshStandardMaterial({ color: '#b8603f', roughness: 0.9 })
const plazaRing = new THREE.MeshStandardMaterial({ color: '#8a3f2c', roughness: 0.9 })
const plazaInner = new THREE.MeshStandardMaterial({ color: '#cf8a5c', roughness: 0.9 })

export function Ground() {
  const strips = useMemo(() => {
    const s: { x: number; z: number; w: number; d: number }[] = [
      { x: 0, z: 0, w: 4, d: RING * 2 },
      { x: 0, z: 0, w: RING * 2, d: 4 },
      // ring road
      { x: RING, z: 0, w: 3.2, d: RING * 2 + 3.2 }, { x: -RING, z: 0, w: 3.2, d: RING * 2 + 3.2 },
      { x: 0, z: RING, w: RING * 2 + 3.2, d: 3.2 }, { x: 0, z: -RING, w: RING * 2 + 3.2, d: 3.2 },
      // building connectors
      { x: 0, z: -14, w: 56, d: 3.2 }, { x: 0, z: 16, w: 56, d: 3.2 },
    ]
    for (const b of BUILDINGS) {
      if (b.special) continue
      const door = doorOutside(b, 0)
      s.push({ x: b.x, z: door.z / 2, w: 3.6, d: Math.abs(door.z) })
    }
    return s
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[420, 420]} />
        <meshStandardMaterial color="#6aa05a" roughness={1} />
      </mesh>
      {strips.map((s, i) => (
        <group key={i}>
          <mesh geometry={boxGeo} material={pathEdgeMat} position={[s.x, 0.02, s.z]} scale={[s.w + 0.7, 0.04, s.d + (s.d < 5 ? 0.7 : 0)]} receiveShadow />
          <mesh geometry={boxGeo} material={pathMat} position={[s.x, 0.035, s.z]} scale={[s.w, 0.07, s.d]} receiveShadow />
        </group>
      ))}
      <mesh material={plazaRing} position={[0, 0.05, 0]} receiveShadow><cylinderGeometry args={[11.6, 11.6, 0.1, 40]} /></mesh>
      <mesh material={plazaOuter} position={[0, 0.07, 0]} receiveShadow><cylinderGeometry args={[11, 11, 0.14, 40]} /></mesh>
      <mesh material={plazaRing} position={[0, 0.08, 0]} receiveShadow><cylinderGeometry args={[7.4, 7.4, 0.16, 40]} /></mesh>
      <mesh material={plazaInner} position={[0, 0.09, 0]} receiveShadow><cylinderGeometry args={[6.6, 6.6, 0.18, 40]} /></mesh>
    </group>
  )
}

/* ---------- pond ---------- */
export function Pond() {
  const fence = useMemo(() => {
    const posts: Item[] = [], rails: Item[] = []
    const n = 28, R = POND.r + 2.2
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      if (a > 0.2 && a < 1.5) continue // gap towards the campus (NE)
      posts.push({ x: POND.x + Math.cos(a) * R, y: 0.5, z: POND.z + Math.sin(a) * R, sx: 0.14, sy: 1, sz: 0.14 })
      const a2 = a + Math.PI / n
      rails.push({ x: POND.x + Math.cos(a2) * R, y: 0.75, z: POND.z + Math.sin(a2) * R, sx: 2 * R * Math.sin(Math.PI / n), sy: 0.08, sz: 0.08, ry: -a2 - Math.PI / 2 })
    }
    return { posts, rails }
  }, [])
  return (
    <group>
      <mesh position={[POND.x, 0.03, POND.z]} scale={[POND.r + 2.2, 1, POND.r + 2.2]} geometry={discGeo} material={sandMat} receiveShadow />
      <mesh position={[POND.x, 0.07, POND.z]} scale={[POND.r, 1, POND.r]} geometry={discGeo} material={waterMat} />
      <Inst geo={boxGeo} mat={woodMat} items={fence.posts} />
      <Inst geo={boxGeo} mat={woodMat} items={fence.rails} />
    </group>
  )
}

/* ---------- forest, bushes, rocks, patches, flowers, lamps ---------- */
const GREENS_DECID = ['#4f8f3c', '#62a047', '#7aae3f', '#3f7d3a', '#c9923a', '#b8553a'].map((c) => new THREE.Color(c))
const PINES = ['#2c6b45', '#245c3c', '#2f7a4c', '#1f5237']

export function Forest({ interior, belt }: { interior: number; belt: number }) {
  const data = useMemo(() => {
    const r = rng(1337)
    const trunks: Item[] = [], pineA: Item[] = [], pineB: Item[] = [], crowns: Item[] = []
    const add = (x: number, z: number, big: number) => {
      const s = (0.8 + r() * 0.7) * big
      trunks.push({ x, y: 0.9 * s, z, sx: s, sy: 1.8 * s, sz: s })
      if (r() < 0.5) {
        const c = col(pick(r, PINES), 0.1, r)
        pineA.push({ x, y: 2.3 * s, z, sx: 1.35 * s, sy: 2.8 * s, sz: 1.35 * s, ry: r() * 6, color: c })
        pineB.push({ x, y: 4.0 * s, z, sx: 0.95 * s, sy: 2.4 * s, sz: 0.95 * s, ry: r() * 6, color: c })
      } else {
        const c = pick(r, GREENS_DECID).clone().offsetHSL(0, 0, (r() - 0.5) * 0.08)
        crowns.push({ x, y: 2.9 * s, z, sx: 1.5 * s, sy: 1.35 * s, sz: 1.5 * s, ry: r() * 6, color: c })
      }
    }
    let n = 0, g = 0
    while (n < interior && g++ < interior * 60) {
      const x = (r() * 2 - 1) * (CAMPUS_BOUND - 2), z = (r() * 2 - 1) * (CAMPUS_BOUND - 2)
      if (blocked(x, z, 1.5)) continue
      add(x, z, 1)
      n++
    }
    n = 0; g = 0
    while (n < belt && g++ < belt * 20) {
      const x = (r() * 2 - 1) * 122, z = (r() * 2 - 1) * 122
      const m = Math.max(Math.abs(x), Math.abs(z))
      if (m < 84 || m > 122) continue
      if (m < 96 && blocked(x, z, 0)) continue
      if (Math.abs(m - 95.8) < 2.4) continue // keep the wall/hedge line clear
      add(x, z, 1.15)
      n++
    }
    return { trunks, pineA, pineB, crowns }
  }, [interior, belt])
  return (
    <group>
      <Inst geo={trunkGeo} mat={trunkMat} items={data.trunks} />
      <Inst geo={coneGeo} mat={vcMat} items={data.pineA} />
      <Inst geo={coneGeo} mat={vcMat} items={data.pineB} />
      <Inst geo={blobGeo} mat={vcMat} items={data.crowns} />
    </group>
  )
}

export function Undergrowth({ high }: { high: boolean }) {
  const d = useMemo(() => {
    const r = rng(77)
    const bushes: Item[] = [], rocks: Item[] = [], patches: Item[] = [], flowers: Item[] = [], lampsP: Item[] = [], lampsG: Item[] = []
    const bushCols = ['#3f7d3a', '#4f8f3c', '#2f6b3a', '#6a9a3a']
    const scatter = (n: number, max: number, pad: number, fn: (x: number, z: number) => void) => {
      let k = 0, g = 0
      while (k < n && g++ < n * 40) {
        const x = (r() * 2 - 1) * max, z = (r() * 2 - 1) * max
        if (blocked(x, z, pad)) continue
        fn(x, z); k++
      }
    }
    scatter(high ? 170 : 70, CAMPUS_BOUND - 2, 0.5, (x, z) => {
      const s = 0.6 + r() * 0.7
      bushes.push({ x, y: 0.4 * s, z, sx: 0.9 * s, sy: 0.7 * s, sz: 0.9 * s, ry: r() * 6, color: col(pick(r, bushCols), 0.12, r) })
    })
    scatter(high ? 90 : 40, CAMPUS_BOUND + 12, 0.5, (x, z) => {
      const s = 0.4 + r() * 0.9
      rocks.push({ x, y: 0.25 * s, z, sx: s * 1.2, sy: s * 0.7, sz: s, ry: r() * 6, color: col(pick(r, ['#8c857a', '#7a746b', '#9a8f7f', '#6f6a66']), 0.1, r) })
    })
    const pc = ['#5f9a4e', '#79ad4f', '#4f8a47', '#8aae52', '#a8a652']
    scatter(high ? 70 : 34, CAMPUS_BOUND + 10, -3, (x, z) => {
      const s = 5 + r() * 11
      patches.push({ x, y: 0.012 + r() * 0.01, z, sx: s, sy: 1, sz: s * (0.6 + r() * 0.5), ry: r() * 3, color: col(pick(r, pc), 0.06, r) })
    })
    // flower beds: ring around the plaza (skipping the paths) + beside each door
    const fc = ['#e0334a', '#f2b632', '#d9399a', '#f27a2a', '#8a4fd6', '#ff6f91']
    const bed = (cx: number, cz: number, rad: number, n: number) => {
      const color = col(pick(r, fc), 0)
      for (let i = 0; i < n; i++) {
        const a = r() * 6.28, rr = Math.sqrt(r()) * rad
        flowers.push({ x: cx + Math.cos(a) * rr, y: 0.28, z: cz + Math.sin(a) * rr, sx: 0.17, sy: 0.17, sz: 0.17, color: r() < 0.25 ? col(pick(r, fc), 0) : color })
      }
    }
    const per = high ? 16 : 8
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + 0.15
      const x = Math.cos(a) * 13.6, z = Math.sin(a) * 13.6
      if (Math.abs(x) < 3.2 || Math.abs(z) < 3.2) continue
      bed(x, z, 1.0, per)
      bushes.push({ x: Math.cos(a) * 12.4, y: 0.3, z: Math.sin(a) * 12.4, sx: 0.55, sy: 0.5, sz: 0.55, color: col('#2f6b3a') })
    }
    for (const b of BUILDINGS) {
      const o = doorOutside(b, 3.5)
      for (const sx of [-1, 1]) bed(o.x + sx * 3.4, o.z, 1.1, per)
    }
    // lamp posts along avenues & ring road
    const lamp = (x: number, z: number) => {
      lampsP.push({ x, y: 1.5, z, sx: 1, sy: 3, sz: 1 })
      lampsG.push({ x, y: 3.1, z, sx: 0.28, sy: 0.28, sz: 0.28 })
    }
    for (let t = -64; t <= 64; t += 16) {
      for (const s of [-1, 1]) {
        if (Math.abs(t) > 12) { lamp(s * 2.9, t); lamp(t, s * 2.9) }
        lamp(s * (RING - 2.6), t); lamp(t, s * (RING - 2.6))
      }
    }
    return { bushes, rocks, patches, flowers, lampsP, lampsG }
  }, [high])
  return (
    <group>
      <Inst geo={discGeo} mat={patchMat} items={d.patches} />
      <Inst geo={blobGeo} mat={vcMat} items={d.bushes} />
      <Inst geo={blobGeo} mat={rockMat} items={d.rocks} />
      <Inst geo={sphereGeo} mat={vcMat} items={d.flowers} />
      <Inst geo={poleGeo} mat={lampPoleMat} items={d.lampsP} />
      <Inst geo={sphereGeo} mat={lampGlowMat} items={d.lampsG} />
    </group>
  )
}

/* ---------- perimeter wall + hedge, hills ---------- */
export function EdgeWall() {
  const B = CAMPUS_BOUND
  const c = B + 1 // wall centre; inner face sits just past the clamp (radius ~0.45)
  const L = (B + 3) * 2
  return (
    <group>
      {[[0, c, L, 1], [0, -c, L, 1], [c, 0, 1, L], [-c, 0, 1, L]].map(([x, z, w, d], i) => (
        <group key={i}>
          <mesh geometry={boxGeo} material={stoneWallMat} position={[x, 0.45, z]} scale={[w, 0.9, d]} receiveShadow />
          <mesh geometry={boxGeo} material={wallCapMat} position={[x, 0.95, z]} scale={[w === 1 ? 1.25 : w, 0.15, d === 1 ? 1.25 : d]} />
          <mesh geometry={boxGeo} material={hedgeMat} position={[x + (w === 1 ? Math.sign(x) * 1.4 : 0), 0.9, z + (d === 1 ? Math.sign(z) * 1.4 : 0)]} scale={[w === 1 ? 1.6 : w, 1.8, d === 1 ? 1.6 : d]} />
        </group>
      ))}
    </group>
  )
}

export function Hills({ count }: { count: number }) {
  const d = useMemo(() => {
    const r = rng(2024)
    const cones: Item[] = [], blobs: Item[] = []
    for (let i = 0; i < count; i++) {
      const dist = 112 + r() * 48
      const t = (r() * 2 - 1) * (dist + 30)
      const side = Math.floor(r() * 4)
      const x = side < 2 ? t : (side === 2 ? dist : -dist)
      const z = side < 2 ? (side === 0 ? dist : -dist) : t
      const k = (dist - 112) / 48 // 0 near -> 1 far
      const h = 10 + r() * 16 + k * 26
      const w = 16 + r() * 16 + k * 10
      const rock = k * 0.8 + r() * 0.35
      const c = new THREE.Color('#4f8a45').lerp(new THREE.Color('#7b7a66'), Math.min(1, rock)).lerp(new THREE.Color('#6d6872'), Math.max(0, rock - 0.8) * 2)
      if (r() < 0.5 || k > 0.5) cones.push({ x, y: h / 2 - 1, z, sx: w, sy: h, sz: w, ry: r() * 6, color: c })
      else blobs.push({ x, y: h * 0.1, z, sx: w * 1.2, sy: h * 0.8, sz: w * 1.2, ry: r() * 6, color: c })
    }
    // a continuous low green skirt right behind the forest so no gap ever shows
    for (let i = 0; i < 44; i++) {
      const t = -150 + i * (300 / 43), dist = 124 + (i % 3) * 3
      for (const [x, z] of [[t, dist], [t, -dist], [dist, t], [-dist, t]] as [number, number][])
        blobs.push({ x, y: 2, z, sx: 17, sy: 9, sz: 17, ry: i, color: col('#4a8340', 0.1, r) })
    }
    return { cones, blobs }
  }, [count])
  return (
    <group>
      <Inst geo={coneGeo} mat={vcMat} items={d.cones} />
      <Inst geo={blobGeo} mat={vcMat} items={d.blobs} />
    </group>
  )
}

/* ---------- sky: sun disc + drifting low-poly clouds ---------- */
export const SUN_DIR = new THREE.Vector3(30, 50, 20).normalize()
export const FOG_COLOR = '#bdd3e2'

export function SunDisc() {
  const g = useRef<THREE.Group>(null)
  const { camera } = useThree()
  useFrame(() => { g.current?.position.copy(camera.position) })
  const p = SUN_DIR.clone().multiplyScalar(270)
  return (
    <group ref={g}>
      <mesh position={p} renderOrder={-1}>
        <sphereGeometry args={[11, 16, 12]} />
        <meshBasicMaterial color="#fff1b8" fog={false} depthWrite={false} />
      </mesh>
      <mesh position={p} renderOrder={-2}>
        <sphereGeometry args={[26, 16, 12]} />
        <meshBasicMaterial color="#ffe08a" fog={false} transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  )
}

const cloudMat = new THREE.MeshBasicMaterial({ color: '#f1ece6', fog: false, transparent: true, opacity: 0.88, depthWrite: false })
export function Clouds({ count }: { count: number }) {
  const g = useRef<THREE.Group>(null)
  const items = useMemo(() => {
    const r = rng(9)
    const out: Item[] = []
    for (let i = 0; i < count; i++) {
      const cx = (r() * 2 - 1) * 190, cz = (r() * 2 - 1) * 190, cy = 55 + r() * 25
      const puffs = 3 + Math.floor(r() * 3)
      for (let p = 0; p < puffs; p++) {
        const s = 7 + r() * 8
        out.push({ x: cx + (p - puffs / 2) * 9 + r() * 4, y: cy + r() * 3, z: cz + r() * 6, sx: s * 1.6, sy: s * 0.55, sz: s, ry: 0 })
      }
    }
    return out
  }, [count])
  useFrame(({ clock }) => {
    if (!g.current || useExplorerStore.getState().reduceMotion) return
    g.current.position.x = Math.sin(clock.elapsedTime * 0.02) * 45
  })
  return <group ref={g}><Inst geo={blobGeo} mat={cloudMat} items={items} /></group>
}
