"use client"

import { useMemo, useRef, type RefObject } from "react"
import type { RapierRigidBody } from "@react-three/rapier"
import { createIslandShape, MAP_SCALE } from "../world/map-config"
import { cameraOrbit } from "../camera/camera-state"
import {
  BOUNDARY_BINS,
  BOUNDARY_MARGIN,
  PLAYER_ACCEL,
  PLAYER_SPEED,
  TURN_MIN_SPEED,
  TURN_RATE,
  type KeyState,
} from "./player-config"

type IslandBounds = {
  cx: number
  cz: number
  radii: Float32Array
}

// Which angular bin an offset direction falls into.
function binIndex(dx: number, dz: number): number {
  const angle = Math.atan2(dz, dx)
  return Math.min(
    BOUNDARY_BINS - 1,
    Math.floor(((angle + Math.PI) / (Math.PI * 2)) * BOUNDARY_BINS)
  )
}

// Sample the island outline once into angular bins: radii[bin] is the largest
// walkable radius from the island center at that compass angle. The shape is
// built in x/y, so shape y maps to world -z.
function buildIslandBounds(): IslandBounds {
  const points = createIslandShape(MAP_SCALE).extractPoints(64).shape

  let cx = 0
  let cz = 0
  for (const p of points) {
    cx += p.x
    cz += -p.y
  }
  cx /= points.length
  cz /= points.length

  const radii = new Float32Array(BOUNDARY_BINS)
  for (const p of points) {
    const dx = p.x - cx
    const dz = -p.y - cz
    radii[binIndex(dx, dz)] = Math.max(
      radii[binIndex(dx, dz)],
      Math.hypot(dx, dz)
    )
  }

  // Fill empty bins from the nearest occupied neighbor so sampling gaps in the
  // outline don't create false walls.
  for (let i = 0; i < BOUNDARY_BINS; i++) {
    if (radii[i] > 0) continue
    for (let offset = 1; offset < BOUNDARY_BINS; offset++) {
      const before = radii[(i - offset + BOUNDARY_BINS) % BOUNDARY_BINS]
      if (before > 0) {
        radii[i] = before
        break
      }
      const after = radii[(i + offset) % BOUNDARY_BINS]
      if (after > 0) {
        radii[i] = after
        break
      }
    }
  }

  return { cx, cz, radii }
}

export type MovementState = {
  // Player position the camera should track
  x: number
  z: number
  // Facing angle the visual model should rotate to
  heading: number
  // Horizontal speed and 0..1 blend into the run clip
  speed: number
  runAmount: number
}

// Horizontal movement and turning: reads key state, applies acceleration, keeps
// the player inside the island outline, and syncs horizontal velocity onto the
// Rapier body. Gravity is left untouched and translation is never written
// directly, so collision resolution keeps full control of the body. The visual
// heading is returned instead of applied here so refs stay owned by the caller.
export function usePlayerMovement(
  body: RefObject<RapierRigidBody | null>,
  keys: RefObject<KeyState>
): (delta: number) => MovementState | null {
  const bounds = useMemo(() => buildIslandBounds(), [])
  const velocity = useRef({ x: 0, z: 0 })
  const heading = useRef(0)

  // Plain per-render closure: cheap to recreate and keeps the React compiler
  // from having to reconcile manual memoization around ref reads.
  return (delta: number): MovementState | null => {
    const rb = body.current
    const keyState = keys.current
    if (!rb || !keyState) return null

    // Normalize the pressed-direction vector to a unit input
    let ix = 0
    let iz = 0
    if (keyState.forward) iz -= 1
    if (keyState.back) iz += 1
    if (keyState.left) ix -= 1
    if (keyState.right) ix += 1
    const inputLen = Math.hypot(ix, iz)
    if (inputLen > 0) {
      ix /= inputLen
      iz /= inputLen
    }

    // Rotate the input into world space using the camera yaw, so "W" always
    // moves away from the camera and dragging orbits the controls with it.
    const yaw = cameraOrbit.yaw
    const cosYaw = Math.cos(yaw)
    const sinYaw = Math.sin(yaw)
    const moveX = ix * cosYaw + iz * sinYaw
    const moveZ = -ix * sinYaw + iz * cosYaw

    const vel = velocity.current
    const blend = 1 - Math.exp(-PLAYER_ACCEL * delta)
    vel.x += (moveX * PLAYER_SPEED - vel.x) * blend
    vel.z += (moveZ * PLAYER_SPEED - vel.z) * blend

    const t = rb.translation()

    // Island boundary: predict one step ahead, then cancel the outward
    // velocity component if the prediction crosses the outline
    const nx = t.x + vel.x * delta
    const nz = t.z + vel.z * delta
    const dx = nx - bounds.cx
    const dz = nz - bounds.cz
    const dist = Math.hypot(dx, dz)
    if (dist > 1e-6) {
      const limit = Math.max(
        bounds.radii[binIndex(dx, dz)] - BOUNDARY_MARGIN,
        0
      )
      if (dist > limit) {
        const ox = dx / dist
        const oz = dz / dist
        const outward = vel.x * ox + vel.z * oz
        if (outward > 0) {
          vel.x -= ox * outward
          vel.z -= oz * outward
        }
      }
    }

    // Drive the physics body; preserve gravity's vertical velocity
    const currentY = rb.linvel().y
    rb.setLinvel({ x: vel.x, y: currentY, z: vel.z }, true)

    // Face the movement direction, wrapping the heading difference to [-pi, pi]
    const speed = Math.hypot(vel.x, vel.z)
    if (speed > TURN_MIN_SPEED) {
      const target = Math.atan2(vel.x, vel.z)
      let diff = target - heading.current
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      heading.current += diff * (1 - Math.exp(-TURN_RATE * delta))
    }

    return {
      x: t.x,
      z: t.z,
      heading: heading.current,
      speed,
      runAmount: Math.min(speed / PLAYER_SPEED, 1),
    }
  }
}
