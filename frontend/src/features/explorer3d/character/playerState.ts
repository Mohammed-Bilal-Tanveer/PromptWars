// Mutable, non-reactive state shared between input handlers and the render loop.
export const playerState = { x: 0, z: 9, heading: Math.PI, yaw: 0, speed: 0 }
export const input = {
  keys: new Set<string>(),
  joy: { x: 0, y: 0 },
  orbitDelta: 0,
  sprint: false,
  reset() { this.keys.clear(); this.joy.x = 0; this.joy.y = 0; this.orbitDelta = 0; this.sprint = false },
}
export function resetPlayer() { playerState.x = 0; playerState.z = 9; playerState.heading = Math.PI; playerState.yaw = 0; playerState.speed = 0 }
