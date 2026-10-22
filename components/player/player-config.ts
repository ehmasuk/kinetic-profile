// Central tuning values and measured geometry for the player character.
// Pure data: no React, three, or Rapier imports so every module stays cheap.

export const CHARACTER_PATH = "/models/characters/man.glb"

// Actual clip names found in the GLB (verified via GLTFLoader inspection).
export const IDLE_CLIPS = ["CharacterArmature|Idle", "Idle", "idle"]
export const RUN_CLIPS = ["CharacterArmature|Run", "Run", "run", "Walk", "Walking"]

// Seconds for the idle/run crossfade.
export const ANIM_FADE = 0.25
// Horizontal speed at/above which the run clip plays.
export const RUN_SPEED_THRESHOLD = 0.55

// Movement tuning.
export const PLAYER_SPEED = 8
export const PLAYER_ACCEL = 12
export const TURN_RATE = 11
// Heading only updates above this speed so turning doesn't jitter at rest.
export const TURN_MIN_SPEED = 0.05

// Island boundary (sampled once from the real island outline in map-config).
export const BOUNDARY_MARGIN = 0.9
export const BOUNDARY_BINS = 96

// Frame-time clamp so a tab-switch spike can't teleport movement or physics.
export const MAX_DELTA = 1 / 20

// Capsule geometry: total height 0.9 + 2 * 0.5 = 1.9 with the bottom at body feet.
// Measured skinned character at MODEL_SCALE 1 is ~2.12 tall idle / ~2.47 on Run
// arm swings; the capsule covers stride to head height while staying forgiving
// on obstacle collisions.
export const CAPSULE_HALF_HEIGHT = 0.45
export const CAPSULE_RADIUS = 0.5
// Rest height of the rigid body origin above the ground so the capsule bottom
// starts slightly off the floor and gravity settles it.
export const SPAWN_BODY_Y = 0.05

// Visual model tuning, measured via GLTFLoader (skinned-mesh vertex bounds).
// The GLB origin sits at the feet: idle foot level is -0.021 raw at scale 1,
// and the Run stride (no root motion) dips the planted foot to -0.099 raw.
export const MODEL_SCALE = 0.8
// MODEL_Y_OFFSET = -(-0.021) puts idle feet exactly on the terrain.
export const MODEL_Y_OFFSET = 0.25
// Lifting the model by runAmount * RUN_FOOT_LIFT while sprinting cancels most
// of the stride dip (residual worst case ~ -0.018) without floating in idle.
export const RUN_FOOT_LIFT = 0.06
// Forward lean of the model while running.
export const RUN_BOB_TILT = 0.07

// Ground markings inside the visual group; the terrain surface sits at y=0.015,
// so these keep a small gap above the grass texture.
export const CONTACT_SHADOW_Y = 0.022
export const CONTACT_SHADOW_RADIUS = 0.6
export const SPAWN_RING_Y = 0.027
export const SPAWN_RING_INNER = 0.62
export const SPAWN_RING_OUTER = 0.76

export type MovementKey = "forward" | "back" | "left" | "right"
export type KeyState = Record<MovementKey, boolean>
