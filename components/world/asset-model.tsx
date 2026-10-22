"use client"

import { useGLTF } from "@react-three/drei"
import { CuboidCollider, RigidBody } from "@react-three/rapier"
import { useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { bakeModelParts, type ModelPart } from "@/lib/model-parts"
import type { Placement } from "./battlefield-placements"

// Shared per-path so visuals and physics colliders reuse the same computed data
const partsCache = new Map<string, ModelPart[]>()

function useModelParts(path: string): ModelPart[] {
  const { scene } = useGLTF(path)

  return useMemo(() => {
    const cached = partsCache.get(path)
    if (cached) return cached

    const parts = bakeModelParts(scene)
    partsCache.set(path, parts)
    return parts
  }, [scene, path])
}

// One InstancedMesh per model part, covering every placement at once.
function AssetPart({
  part,
  placements,
  castShadow,
}: {
  part: ModelPart
  placements: Placement[]
  castShadow: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return

    placements.forEach((p, i) => {
      // Keep the model's horizontal position, but ground it automatically.
      dummy.position.set(p.position[0], 0.025, p.position[2])
      dummy.rotation.set(0, p.rotationY ?? 0, 0)

      const s = p.scale ?? 1
      dummy.scale.set(s, s, s)

      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })

    mesh.instanceMatrix.needsUpdate = true
  }, [placements, dummy])

  return (
    <instancedMesh
      ref={ref}
      args={[part.geometry, part.material, placements.length]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
    />
  )
}

export function AssetModel({
  path,
  placements,
  castShadow = true,
}: {
  path: string
  placements: Placement[]
  castShadow?: boolean
}) {
  const parts = useModelParts(path)

  return (
    <>
      {parts.map((part, i) => (
        <AssetPart
          key={i}
          part={part}
          placements={placements}
          castShadow={castShadow}
        />
      ))}
    </>
  )
}

// Static cuboid colliders derived from each part's real bounding box
export function SolidRigidBody({
  path,
  spots,
}: {
  path: string
  spots: Placement[]
}) {
  const parts = useModelParts(path)

  const colliders = useMemo(() => {
    const items: {
      key: string
      position: [number, number, number]
      half: [number, number, number]
      rotY: number
    }[] = []

    spots.forEach((p, j) => {
      const s = p.scale ?? 1
      const rotY = p.rotationY ?? 0
      const cos = Math.cos(rotY)
      const sin = Math.sin(rotY)

      parts.forEach((part, k) => {
        const halfX = (part.size.x * s) / 2
        const halfY = (part.size.y * s) / 2
        const halfZ = (part.size.z * s) / 2
        if (halfX < 0.05 || halfY < 0.05 || halfZ < 0.05) return

        const cx = part.center.x * s
        const cy = part.center.y * s
        const cz = part.center.z * s

        items.push({
          key: `${j}-${k}`,
          position: [
            p.position[0] + cx * cos + cz * sin,
            0.025 + cy,
            p.position[2] + -cx * sin + cz * cos,
          ],
          half: [halfX, halfY, halfZ],
          rotY,
        })
      })
    })

    return items
  }, [parts, spots])

  return (
    <RigidBody type="fixed" colliders={false}>
      {colliders.map((c) => (
        <CuboidCollider
          key={c.key}
          args={c.half}
          position={c.position}
          rotation={[0, c.rotY, 0]}
        />
      ))}
    </RigidBody>
  )
}
