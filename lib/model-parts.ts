import * as THREE from "three"

// Shared model-baking pipeline used by the runtime instancer (useModelParts)
// and by scripts/check-placements.ts, so visual meshes, physics colliders, and
// bounds validation all operate on identical geometry numbers.

export type ModelPart = {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  center: THREE.Vector3
  size: THREE.Vector3
}

// Bakes a GLTF scene into flat world-space parts:
// - clones each mesh geometry and applies its world transform
// - XZ-centers the whole model on its origin and grounds its bottom at y=0
//   (some packed assets park their content far from the origin)
export function bakeModelParts(scene: THREE.Object3D): ModelPart[] {
  scene.updateWorldMatrix(true, true)

  const out: ModelPart[] = []

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return

    const geometry = mesh.geometry.clone()

    // Preserve the mesh's original position, rotation, and scale.
    geometry.applyMatrix4(mesh.matrixWorld)
    geometry.computeBoundingBox()

    const material = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material

    out.push({
      geometry,
      material,
      center: new THREE.Vector3(),
      size: new THREE.Vector3(),
    })
  })

  // Find the lowest point and the XZ center of the complete model.
  let minY = Infinity
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (const part of out) {
    const box = part.geometry.boundingBox
    if (!box) continue
    minY = Math.min(minY, box.min.y)
    minX = Math.min(minX, box.min.x)
    maxX = Math.max(maxX, box.max.x)
    minZ = Math.min(minZ, box.min.z)
    maxZ = Math.max(maxZ, box.max.z)
  }

  if (Number.isFinite(minY)) {
    const centerX = Number.isFinite(minX) ? (minX + maxX) / 2 : 0
    const centerZ = Number.isFinite(minZ) ? (minZ + maxZ) / 2 : 0
    for (const part of out) {
      part.geometry.translate(-centerX, -minY, -centerZ)
      part.geometry.computeBoundingBox()
      part.geometry.computeBoundingSphere()
    }
  }

  for (const part of out) {
    part.geometry.boundingBox?.getCenter(part.center)
    part.geometry.boundingBox?.getSize(part.size)
  }

  return out
}
