"use client"

import { useLayoutEffect, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import {
  CapsuleCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier"
import * as THREE from "three"
import { playerPosition } from "./player-state"
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

type CharacterSpawnProps = {
  position?: [number, number, number]
}

// The GLB scene is cached by drei and reused via <primitive>; it is detached on
// unmount but never disposed, so the cache stays valid.
useGLTF.preload(CHARACTER_PATH)

// Compose the player: physics body + input + movement + animations + ground marks.
export function CharacterSpawn({ position = [0, 0, 0] }: CharacterSpawnProps) {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const bob = useRef<THREE.Group>(null)
  const modelRoot = useRef<THREE.Group>(null)

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
  })

  return (
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
  )
}
