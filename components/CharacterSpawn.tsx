"use client"

import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import {
  CapsuleCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier"
import * as THREE from "three"
import { playerPosition, shootRequests } from "./player-state"
import {
  CAPSULE_HALF_HEIGHT,
  CAPSULE_RADIUS,
  CHARACTER_PATH,
  CONTACT_SHADOW_RADIUS,
  CONTACT_SHADOW_Y,
  MAX_DELTA,
  MODEL_SCALE,
  MODEL_Y_OFFSET,
  RUN_BOB_TILT,
  RUN_FOOT_LIFT,
  RUN_SPEED_THRESHOLD,
  SPAWN_BODY_Y,
  SPAWN_RING_INNER,
  SPAWN_RING_OUTER,
  SPAWN_RING_Y,
} from "./player/player-config"
import { usePlayerControls } from "./player/usePlayerControls"
import { usePlayerMovement } from "./player/usePlayerMovement"
import { useCharacterAnimations } from "./player/useCharacterAnimations"
import { CROSSHAIR_Y } from "./crosshair"

type CharacterSpawnProps = {
  position?: [number, number, number]
}

// Weapon meshes shipped inside the character GLB (the equipped one is visible).
const WEAPON_NAMES =
  /^(Revolver|Sniper|Pistol|SMG|Shotgun|AK|GrenadeLauncher|RocketLauncher|ShortCannon|Revolver_Small)$/
const FLASH_LIFE = 0.09 // seconds the muzzle flash + tracer stay visible

// The GLB scene is cached by drei and reused via <primitive>; it is detached on
// unmount but never disposed, so the cache stays valid.
useGLTF.preload(CHARACTER_PATH)

// Compose the player: physics body + input + movement + animations + ground marks.
export function CharacterSpawn({ position = [0, 0, 0] }: CharacterSpawnProps) {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const bob = useRef<THREE.Group>(null)
  const modelRoot = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Group>(null)
  const tracer = useRef<THREE.Mesh>(null)
  const flashTimer = useRef(0)
  const lastShot = useRef(0)
  const camera = useThree((state) => state.camera)
  const aimWorld = useMemo(() => new THREE.Vector3(), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  const gltf = useGLTF(CHARACTER_PATH)

  const keys = usePlayerControls()
  const updateMovement = usePlayerMovement(body, keys)
  const { update: updateAnimation } = useCharacterAnimations(
    gltf.animations,
    modelRoot
  )

  useLayoutEffect(() => {
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = Boolean(
          (mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh
        )
        // Skinned bounding spheres are computed at the bind pose and can make
        // the camera cull the character; disable culling to keep it visible.
        mesh.frustumCulled = false
      }
    })
  }, [gltf.scene])

  // Lay the unit cylinder along +Z so lookAt() can aim the tracer.
  useEffect(() => {
    tracer.current?.geometry.rotateX(Math.PI / 2)
  }, [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, MAX_DELTA)

    const movement = updateMovement(delta)
    if (!movement) return

    // Face the movement direction; the visual model trails the physics heading
    if (visual.current) visual.current.rotation.y = movement.heading

    // Camera target follows the actual physics position
    playerPosition.set(movement.x, 0, movement.z)

    updateAnimation(delta, movement.speed > RUN_SPEED_THRESHOLD)

    if (bob.current) {
      bob.current.rotation.x = movement.runAmount * RUN_BOB_TILT
      // Compensate the Run clip's below-origin stride dip (measured -0.099 raw)
      bob.current.position.y = movement.runAmount * RUN_FOOT_LIFT
    }

    // Fire on crosshair taps: muzzle flash on the equipped weapon + tracer
    // beam toward the screen-center aim point.
    if (shootRequests.count !== lastShot.current) {
      lastShot.current = shootRequests.count
      // Prefer the visible weapon mesh; fall back to the first hidden one.
      const visible: { c: THREE.Vector3; s: number }[] = []
      const hidden: { c: THREE.Vector3; s: number }[] = []
      modelRoot.current?.traverse((obj) => {
        if (!WEAPON_NAMES.test(obj.name)) return
        const box = new THREE.Box3().setFromObject(obj)
        const found = {
          c: box.getCenter(new THREE.Vector3()),
          s: box.getSize(new THREE.Vector3()).length(),
        }
        if (obj.visible) visible.push(found)
        else hidden.push(found)
      })
      // Box3 is already world space, so no extra transform applies here.
      const gun = visible[0] ?? hidden[0]
      if (gun) {
        flashTimer.current = FLASH_LIFE
        if (flash.current) {
          flash.current.position.copy(gun.c)
          flash.current.scale.setScalar(Math.max(0.55, gun.s * 0.9))
          flash.current.visible = true
        }
        raycaster.setFromCamera(new THREE.Vector2(0, 1 - 2 * CROSSHAIR_Y), camera)
        const dir = raycaster.ray.direction
        // Tracer from the muzzle to where the screen-center ray reaches chest
        // height (1.2): visually the shot flies toward the crosshair.
        if (Math.abs(dir.y) > 1e-4) {
          const t = (1.2 - raycaster.ray.origin.y) / dir.y
          if (t > 0) {
            aimWorld.copy(raycaster.ray.origin).addScaledVector(dir, t)
            const distance = gun.c.distanceTo(aimWorld)
            if (tracer.current && distance > 1e-3) {
              // Cylinder geometry is z-aligned (rotated below): scale z to span.
              tracer.current
                .position.copy(gun.c)
                .add(aimWorld)
                .multiplyScalar(0.5)
              tracer.current.lookAt(aimWorld)
              tracer.current.scale.set(1, 1, distance)
              tracer.current.visible = true
            }
          }
        }
      }
    }

    if (flashTimer.current > 0) {
      flashTimer.current -= delta
      if (flashTimer.current <= 0) {
        flashTimer.current = 0
        if (flash.current) flash.current.visible = false
        if (tracer.current) tracer.current.visible = false
      }
    }
  })

  return (
    <>
      <RigidBody
        ref={body}
        type="dynamic"
        colliders={false}
        position={[position[0], SPAWN_BODY_Y, position[2]]}
        enabledRotations={[false, false, false]}
        canSleep={false}
        ccd
      >
      <CapsuleCollider
        args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]}
        position={[0, CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS, 0]}
      />

      {/* Visual player, synced to the physics transform */}
      <group ref={visual}>
        <group ref={bob}>
          {/* GLB character (idle / run clips drive the skinned rig) */}
          <group ref={modelRoot} position={[0, MODEL_Y_OFFSET, 0]}>
            <primitive object={gltf.scene} scale={MODEL_SCALE} />
          </group>
        </group>

        {/* Ground contact shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, CONTACT_SHADOW_Y, 0]}>
          <circleGeometry args={[CONTACT_SHADOW_RADIUS, 24]} />
          <meshBasicMaterial color="#2c4630" transparent opacity={0.22} />
        </mesh>

        {/* Spawn marker ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SPAWN_RING_Y, 0]}>
          <ringGeometry args={[SPAWN_RING_INNER, SPAWN_RING_OUTER, 40]} />
          <meshBasicMaterial
            color="#41e0d0"
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
        </group>
      </RigidBody>

      {/* Muzzle flash + tracer, positioned in world space on each shot */}
      <group ref={flash} visible={false}>
        <mesh scale={[0.9, 1.1, 0.9]} rotation={[0, 0, 0.6]}>
          <icosahedronGeometry args={[0.16, 1]} />
          <meshBasicMaterial color="#ffce8a" transparent opacity={0.95} />
        </mesh>
        <pointLight intensity={26} distance={7} color="#ffb066" />
      </group>
      <mesh ref={tracer} visible={false}>
        <cylinderGeometry args={[0.013, 0.013, 1, 6, 1, true]} />
        <meshBasicMaterial color="#fff1b8" transparent opacity={0.75} />
      </mesh>
    </>
  )
}
