import { useEffect, useState } from 'react'
import { playerState } from './playerState'

export interface PlayerPose { x: number; z: number; h: number }

/** How often HUD overlays resample the mutable player state (ms). */
export const POSE_POLL_MS = 150

const readPose = (): PlayerPose => ({ x: playerState.x, z: playerState.z, h: playerState.heading })

/** Low-frequency snapshot of the (non-reactive) player pose for minimap/map overlays. */
export function usePlayerPose(): PlayerPose {
  const [pose, setPose] = useState<PlayerPose>(readPose)
  useEffect(() => {
    const t = setInterval(() => setPose(readPose()), POSE_POLL_MS)
    return () => clearInterval(t)
  }, [])
  return pose
}
