// Dev tool: verifies that every rendered battlefield placement sits fully
// inside the island outline, so no object hangs over the water ("blue" area).
//
// It reproduces the runtime geometry pipeline (the useModelParts bounding-box
// math shared by AssetModel/SolidRigidBody), reads the same placement data the
// game renders, and prints a suggested map-coordinate fix for any placement
// whose footprint crosses the shoreline.
//
// Run:  node --experimental-strip-types scripts/check-placements.ts

import fs from "node:fs"
import path from "node:path"

import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

import {
  CAMP_PROPS,
  DOCK,
  DOCK_PATH,
  FARM_BUILDINGS,
  FARM_PROPS,
  FOREST_EXTRAS,
  FOREST_PINES,
  HOUSES,
  KAY_GROUPS,
  M,
  MINE_PROPS,
  POND_PROPS,
  VILLAGE_PROPS,
  type Placement,
} from "../components/battlefield-placements"
import { createIslandShape, MAP_SCALE } from "../components/map-config"

// ---------- browser shims so GLTFLoader runs offline ----------

const imageStub = (onload: () => void) => {
  const el = {
    width: 0,
    height: 0,
    onload,
    onerror: null as null | (() => void),
  }
  return {
    ...el,
    set src(_value: string) {
      setTimeout(onload, 0)
    },
  }
}

globalThis.document = {
  createElementNS: () => imageStub(() => {}),
  createElement: () => ({ getContext: () => null }),
} as unknown as Document
globalThis.self = globalThis as unknown as Window & typeof globalThis
// FileLoader dispatches a ProgressEvent on every chunk
;(globalThis as { ProgressEvent?: unknown }).ProgressEvent =
  class FakeProgressEvent {
    constructor(
      public type: string,
      public init?: { loaded: number; total: number }
    ) {}
  }
// Prefer the TextureLoader path (our image stub) over ImageBitmapLoader
;(globalThis as { createImageBitmap?: unknown }).createImageBitmap = undefined

const realFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = (async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  if (/^https?:/i.test(url)) return realFetch(input, init)

  // Embedded glTF assets (data: URIs) must not be treated as filesystem paths
  if (/^data:/i.test(url)) {
    const comma = url.indexOf(",")
    const meta = url.slice(5, comma)
    const payload = url.slice(comma + 1)
    const bytes = /;base64/i.test(meta)
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8")
    return new Response(new Uint8Array(bytes), { status: 200 })
  }

  const clean = url.split("?")[0].split("#")[0]
  const file = path.join(
    process.cwd(),
    decodeURIComponent(clean.split("\\").join("/"))
  )
  const data = await fs.promises.readFile(file)
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: { "content-type": "application/octet-stream" },
  })
}) as typeof fetch

// ---------- island polygon ----------

type PolyPoint = { x: number; z: number }

const POLY: PolyPoint[] = createIslandShape(MAP_SCALE)
  .extractPoints(128)
  .shape.map((p) => ({ x: p.x, z: -p.y }))

function pointInPolygon(x: number, z: number, poly: PolyPoint[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const zi = poly[i].z
    const xj = poly[j].x
    const zj = poly[j].z
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside
    }
  }
  return inside
}

const CENTROID = POLY.reduce(
  (acc, p) => ({ x: acc.x + p.x, z: acc.z + p.z }),
  { x: 0, z: 0 }
)
CENTROID.x /= POLY.length
CENTROID.z /= POLY.length

// ---------- model footprint loading (mirrors useModelParts) ----------

type PartBox = { cx: number; cz: number; hx: number; hz: number }

const modelCache = new Map<string, Promise<PartBox[]>>()

async function loadParts(asset: string): Promise<PartBox[]> {
  const cached = modelCache.get(asset)
  if (cached) return cached

  const promise = (async () => {
    const file = path.join(process.cwd(), "public", asset.split("?")[0])
    const buffer = fs.readFileSync(file)
    const data: ArrayBuffer | string = file.endsWith(".glb")
      ? buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        )
      : buffer.toString("utf8")
    const resourceBase = `${path.posix.dirname(asset)}/`

    const gltf = await new Promise<{ scene: THREE.Object3D }>(
      (resolve, reject) => {
        new GLTFLoader().parse(data, resourceBase, resolve, (error) => {
          console.error(
            `[check] parse failed for ${asset}:`,
            error?.message ?? error
          )
          reject(error)
        })
      }
    )

    gltf.scene.updateMatrixWorld(true)

    // Bake world transforms, mirroring useModelParts
    const baked: { geo: THREE.BufferGeometry }[] = []
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      baked.push({ geo: mesh.geometry.clone().applyMatrix4(mesh.matrixWorld) })
    })
    if (baked.length === 0) return []

    // Recenter XZ on the model's union bbox first, exactly like the runtime
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const { geo } of baked) {
      geo.computeBoundingBox()
      const b = geo.boundingBox
      if (!b) continue
      minX = Math.min(minX, b.min.x)
      maxX = Math.max(maxX, b.max.x)
      minZ = Math.min(minZ, b.min.z)
      maxZ = Math.max(maxZ, b.max.z)
    }
    const centerX = (minX + maxX) / 2
    const centerZ = (minZ + maxZ) / 2

    const parts: PartBox[] = []
    for (const { geo } of baked) {
      geo.translate(-centerX, 0, -centerZ)
      geo.computeBoundingBox()
      const box = geo.boundingBox
      if (!box) continue
      const halfX = (box.max.x - box.min.x) / 2
      const halfZ = (box.max.z - box.min.z) / 2
      // Same debris threshold as the runtime collider builder
      if (halfX < 0.05 || halfZ < 0.05) continue
      parts.push({
        cx: (box.min.x + box.max.x) / 2,
        cz: (box.min.z + box.max.z) / 2,
        hx: halfX,
        hz: halfZ,
      })
    }
    return parts
  })()

  modelCache.set(asset, promise)
  return promise
}

// ---------- placement footprint vs island polygon ----------

type AABB = { minX: number; maxX: number; minZ: number; maxZ: number }

function placementAABB(parts: PartBox[], p: Placement): AABB {
  const s = p.scale ?? 1
  const rotY = p.rotationY ?? 0
  const cos = Math.cos(rotY)
  const sin = Math.sin(rotY)

  const aabb: AABB = {
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  }

  for (const part of parts) {
    const ox = part.cx * s
    const oz = part.cz * s
    const worldX = p.position[0] + ox * cos + oz * sin
    const worldZ = p.position[2] + -ox * sin + oz * cos
    const extX = Math.abs(part.hx * s * cos) + Math.abs(part.hz * s * sin)
    const extZ = Math.abs(part.hx * s * sin) + Math.abs(part.hz * s * cos)

    aabb.minX = Math.min(aabb.minX, worldX - extX)
    aabb.maxX = Math.max(aabb.maxX, worldX + extX)
    aabb.minZ = Math.min(aabb.minZ, worldZ - extZ)
    aabb.maxZ = Math.max(aabb.maxZ, worldZ + extZ)
  }
  return aabb
}

function aabbSamples(box: AABB): PolyPoint[] {
  const pts: PolyPoint[] = []
  const steps = 5
  for (let i = 0; i <= steps; i++) {
    const x = box.minX + ((box.maxX - box.minX) * i) / steps
    for (let j = 0; j <= steps; j++) {
      pts.push({ x, z: box.minZ + ((box.maxZ - box.minZ) * j) / steps })
    }
  }
  return pts
}

function fitsAt(parts: PartBox[], p: Placement): boolean {
  return aabbSamples(placementAABB(parts, p)).every((s) =>
    pointInPolygon(s.x, s.z, POLY)
  )
}

// ---------- placements to check (mirrors the Battlefield render tree) ----------

type Spot = { label: string; path: string; placement: Placement }

const RENDERED_SPOTS: Spot[] = [
  { label: "HOUSES[0]", path: M.house1, placement: HOUSES[0] },
  { label: "HOUSES[1]", path: M.house3, placement: HOUSES[1] },
  { label: "HOUSES[2]", path: M.house2, placement: HOUSES[2] },
  { label: "HOUSES[3]", path: M.house2, placement: HOUSES[3] },
  ...FOREST_PINES.map((placement, i) => ({
    label: `FOREST_PINES[${i}]`,
    path: M.pine,
    placement,
  })),
  { label: "DOCK", path: DOCK_PATH, placement: DOCK[0] },
]

const PROP_GROUPS = [
  ...VILLAGE_PROPS,
  ...FARM_BUILDINGS,
  ...FARM_PROPS,
  ...POND_PROPS,
  ...MINE_PROPS,
  ...CAMP_PROPS,
  ...FOREST_EXTRAS,
  ...KAY_GROUPS,
]

PROP_GROUPS.forEach((group) => {
  const modelName = group.path.split("/").pop() ?? group.path
  group.spots.forEach((placement, i) => {
    RENDERED_SPOTS.push({
      label: `${modelName}[${i}]`,
      path: group.path,
      placement,
    })
  })
})

// Physics colliders (SolidRigidBody / SOLID_PROTOS) cover exactly the same
// spots as the rendered groups, so a single pass validates visuals and
// collision together.

// ---------- main ----------

const format = (v: number): string => (Math.abs(v) < 0.005 ? "0" : v.toFixed(2))

async function main(): Promise<void> {
  const violations: string[] = []

  for (const spot of RENDERED_SPOTS) {
    const parts = await loadParts(spot.path).catch(() => null)
    if (!parts) {
      violations.push(
        `${spot.label}: model failed to load (${spot.path})` // manual follow-up
      )
      continue
    }
    if (parts.length === 0) {
      console.warn(
        `[check] ${spot.label}: no solid parts above the 0.05 debris threshold (${spot.path})`
      )
      continue
    }
    if (fitsAt(parts, spot.placement)) continue

    const box = placementAABB(parts, spot.placement)
    const mapX = spot.placement.position[0] / MAP_SCALE
    const mapZ = spot.placement.position[2] / MAP_SCALE

    // Suggested fix: slide the object toward the island center along its own
    // bearing until the whole footprint is inside the outline.
    const dx = spot.placement.position[0] - CENTROID.x
    const dz = spot.placement.position[2] - CENTROID.z
    const dist = Math.hypot(dx, dz)
    let suggestion: { x: number; z: number } | null = null

    if (dist >= 1e-6) {
      const ux = dx / dist
      const uz = dz / dist
      const posAt = (r: number): Placement => ({
        ...spot.placement,
        position: [CENTROID.x + ux * r, spot.placement.position[1], CENTROID.z + uz * r],
      })

      if (fitsAt(parts, posAt(0))) {
        let lo = 0
        let hi = dist
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2
          if (fitsAt(parts, posAt(mid))) lo = mid
          else hi = mid
        }
        // 4% safety margin so printed rounding never pushes the footprint
        // back over the shoreline
        const r = lo * 0.96
        suggestion = { x: CENTROID.x + ux * r, z: CENTROID.z + uz * r }
      }
    }

    let line = `${spot.label}: pos(map)=(${format(mapX)}, ${format(mapZ)}) ` +
      `aabb x[${format(box.minX)}..${format(box.maxX)}] z[${format(box.minZ)}..${format(box.maxZ)}]`
    if (suggestion) {
      line += `\n  fix -> map=(${format(suggestion.x / MAP_SCALE)}, ${format(suggestion.z / MAP_SCALE)})`
    } else {
      line += `\n  fix -> none along the inward ray (footprint larger than the island at this bearing); reduce scale`
    }
    violations.push(line)
  }

  if (violations.length === 0) {
    console.log("OK: every rendered placement sits fully inside the island.")
    return
  }
  console.log(`${violations.length} placement(s) overlap water:\n`)
  console.log(violations.join("\n\n"))
  process.exitCode = 1
}

main().catch((error) => {
  console.error("checker failed:", error)
  process.exitCode = 1
})
