import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/** Kenney CC0 assets (see public/assets/ASSET_CREDITS.md). */
export const BUILDING_PIECES = [
  'wall', 'wall-window-square', 'wall-window-wide-square', 'wall-doorway-wide-square',
  'column', 'floor', 'roof-flat-center', 'roof-flat-side', 'roof-flat-corner',
] as const
export type BuildingPiece = (typeof BUILDING_PIECES)[number]

export const pieceUrl = (n: string) => `/assets/models/building/${n}.glb`

export const CHARACTERS = [
  { id: 'male-a', label: 'Alex' },
  { id: 'female-a', label: 'Aisha' },
  { id: 'male-c', label: 'Carlos' },
  { id: 'female-c', label: 'Chen' },
  { id: 'male-e', label: 'Eli' },
  { id: 'female-e', label: 'Elena' },
] as const
export type CharacterId = (typeof CHARACTERS)[number]['id']
export const characterUrl = (id: string) => `/assets/models/characters/character-${id}.glb`

/** Kit module size: pieces are 2 units wide and 2.4 tall. */
export const MODULE = 2
export const FLOOR_H = 2.4
/** Mini characters are ~0.7 units tall; scale to ~1.8 world units. */
export const CHARACTER_SCALE = 2.6

export interface PieceMesh { geometry: THREE.BufferGeometry; material: THREE.Material }

/** Extracts world-baked geometry + material of every mesh in a building-kit GLB. */
export function usePieceMeshes(name: BuildingPiece): PieceMesh[] {
  const { scene } = useGLTF(pieceUrl(name))
  return useMemo(() => {
    const out: PieceMesh[] = []
    scene.updateMatrixWorld(true)
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        const g = m.geometry.clone()
        g.applyMatrix4(m.matrixWorld)
        out.push({ geometry: g, material: m.material as THREE.Material })
      }
    })
    return out
  }, [scene])
}

export function preloadKenney() {
  BUILDING_PIECES.forEach((p) => useGLTF.preload(pieceUrl(p)))
  useGLTF.preload(characterUrl('male-a'))
}
