/** Shared player / camera tuning values (world units, seconds, radians). */
export const WALK_SPEED = 4.2
export const RUN_SPEED = 8
export const PLAYER_RADIUS = 0.45
/** Speed above which the run/sprint animation is used. */
export const RUN_ANIM_THRESHOLD = 6
/** Speed below which the character is considered idle. */
export const IDLE_SPEED = 0.1
/** Fixed three-quarter top-down camera pitch. */
export const CAMERA_PITCH = (52 * Math.PI) / 180
export const CAMERA_DISTANCE_OUTSIDE = 16
export const CAMERA_DISTANCE_INSIDE = 12
export const CAMERA_START = { x: 0, y: 12, z: 26 } as const
/** Exponential camera follow rate (1/s). */
export const CAMERA_FOLLOW_RATE = 6
/** Camera look-at height above the ground. */
export const CAMERA_LOOK_HEIGHT = 0.8
/** Camera orbit speed with Q/R keys (rad/s). */
export const ORBIT_SPEED = 1.8
/** Longest simulated frame step, to avoid tunnelling after a stall. */
export const MAX_FRAME_DT = 0.05
/** Auto-walk gives up after this many seconds, or this long being blocked. */
export const AUTOWALK_MAX_AGE = 60
export const AUTOWALK_MAX_STUCK = 1.2
/** Interactable detection period (s). */
export const DETECT_INTERVAL = 0.1
/** Ground-click drag distance (px) beyond which a click is treated as an orbit drag. */
export const CLICK_DRAG_PX = 6
