"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { playerPosition } from "../player/player-state"
import { cameraOrbit } from "./camera-state"

// Third-person camera orbiting the player. The default angle reproduces the
// old fixed isometric offset (10, 15, 10.5); mouse drag spins the orbit.
const ORBIT_RADIUS = Math.hypot(10, 15, 10.5)
// Look at upper-body height (~1.4 of the 1.76-tall character) so the whole
// body stays framed and the head is not cut off by the closer view.
const LOOK_HEIGHT = 1.4
const FOLLOW_DAMP = 8
const MAX_DELTA = 1 / 20
const DEFAULT_ELEVATION = Math.atan2(15, Math.hypot(10, 10.5))
const MIN_ELEVATION = Math.PI * 0.09
const MAX_ELEVATION = Math.PI * 0.42
const DRAG_SENSITIVITY = 0.0042

export function FollowCamera() {
  const camera = useThree((state) => state.camera)
  const desired = useMemo(() => new THREE.Vector3(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])
  const lookCurrent = useMemo(() => new THREE.Vector3(), [])
  const initialized = useRef(false)
  const orbit = useRef({
    yaw: cameraOrbit.yaw,
    elevation: DEFAULT_ELEVATION,
  })
  const drag = useRef({ active: false, lastX: 0, lastY: 0 })

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (!(event.target instanceof HTMLCanvasElement)) return
      drag.current.active = true
      drag.current.lastX = event.clientX
      drag.current.lastY = event.clientY
      event.preventDefault()
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!drag.current.active) return
      const dx = event.clientX - drag.current.lastX
      const dy = event.clientY - drag.current.lastY
      drag.current.lastX = event.clientX
      drag.current.lastY = event.clientY
      orbit.current.yaw -= dx * DRAG_SENSITIVITY
      orbit.current.elevation = Math.min(
        MAX_ELEVATION,
        Math.max(
          MIN_ELEVATION,
          orbit.current.elevation + dy * DRAG_SENSITIVITY * 0.8
        )
      )
      cameraOrbit.yaw = orbit.current.yaw
    }
    const onPointerUp = () => {
      drag.current.active = false
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
    window.addEventListener("blur", onPointerUp)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
      window.removeEventListener("blur", onPointerUp)
    }
  }, [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, MAX_DELTA)
    const blend = 1 - Math.exp(-FOLLOW_DAMP * delta)

    const horizontal = ORBIT_RADIUS * Math.cos(orbit.current.elevation)
    desired.set(
      playerPosition.x + horizontal * Math.sin(orbit.current.yaw),
      ORBIT_RADIUS * Math.sin(orbit.current.elevation),
      playerPosition.z + horizontal * Math.cos(orbit.current.yaw)
    )
    lookTarget.set(playerPosition.x, LOOK_HEIGHT, playerPosition.z)

    if (!initialized.current) {
      camera.position.copy(desired)
      lookCurrent.copy(lookTarget)
      initialized.current = true
    } else {
      camera.position.lerp(desired, blend)
      lookCurrent.lerp(lookTarget, blend)
    }

    camera.lookAt(lookCurrent)
  })

  return null
}
