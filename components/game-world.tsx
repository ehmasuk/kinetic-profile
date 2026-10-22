"use client"

import { useGLTF } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier"
import { Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import * as THREE from "three"
import { CharacterSpawn } from "./CharacterSpawn"
import { FollowCamera } from "./follow-camera"
import { LoadingScreen } from "./loading-screen"
import { MAP_SCALE, createIslandShape } from "./map-config"
import {
  CAMP_END,
  CAMP_GATE,
  CAMP_PROPS,
  CAMP_ROAD,
  DOCK,
  DOCK_PATH,
  FARM_BUILDINGS,
  FARM_PROPS,
  FOREST_EXTRAS,
  FOREST_PINES,
  GOLD_SPOT,
  HOUSES,
  KAY_GROUPS,
  M,
  MINE_PROPS,
  POND,
  POND_PROPS,
  ROAD_SEGMENTS,
  SOLID_PROTOS,
  VILLAGE_PROPS,
  WEST_GATE,
  type Placement,
  type Vec2,
} from "./battlefield-placements"

const WATER_GEO = new THREE.CircleGeometry(1, 24)

function AssetPart({
  part,
  placements,
  castShadow,
}: {
  part: { geometry: THREE.BufferGeometry; material: THREE.Material }
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

type ModelPart = {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  center: THREE.Vector3
  size: THREE.Vector3
}

// Shared per-path so visuals and physics colliders reuse the same computed data
const partsCache = new Map<string, ModelPart[]>()

function useModelParts(path: string): ModelPart[] {
  const { scene } = useGLTF(path)

  return useMemo(() => {
    const cached = partsCache.get(path)
    if (cached) return cached

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
      part.geometry.computeBoundingBox()

      const box = part.geometry.boundingBox
      if (!box) continue
      minY = Math.min(minY, box.min.y)
      minX = Math.min(minX, box.min.x)
      maxX = Math.max(maxX, box.max.x)
      minZ = Math.min(minZ, box.min.z)
      maxZ = Math.max(maxZ, box.max.z)
    }

    // Shift all parts together so the model is XZ-centered on its origin and
    // its bottom sits at y = 0. (Some packed assets park their content far
    // from the origin, e.g. rows of trees shipped along +x.)
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

    partsCache.set(path, out)
    return out
  }, [scene, path])
}

function AssetModel({
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

function PropGroup({ proto }: { proto: { path: string; spots: Placement[] } }) {
  return <AssetModel path={proto.path} placements={proto.spots} />
}

// Static cuboid colliders derived from each part's real bounding box
function SolidRigidBody({ path, spots }: { path: string; spots: Placement[] }) {
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

const GROUND_TEX_SIZE = 2048

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pointInPolygon(x: number, z: number, poly: { x: number; z: number }[]) {
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

function distToSegment(px: number, pz: number, a: Vec2, b: Vec2) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const t = Math.max(
    0,
    Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz))
  )
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t))
}

type ScatterItem = {
  x: number
  y: number
  z: number
  rotY: number
  tiltX: number
  tiltZ: number
  sx: number
  sy: number
  color: string
}

const TUFT_TONES = ["#5da53d", "#6db147", "#4f9a37", "#7abc50", "#63aa41"]
const PEBBLE_TONES = ["#9aa3a8", "#b3babd", "#878f94", "#c0c6c8"]

function ScatterField({
  items,
  children,
}: {
  items: ScatterItem[]
  children: ReactNode
}) {
  const ref = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const mat4 = new THREE.Matrix4()
    const quat = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()
    const col = new THREE.Color()
    items.forEach((item, i) => {
      euler.set(item.tiltX, item.rotY, item.tiltZ)
      quat.setFromEuler(euler)
      pos.set(item.x, item.y, item.z)
      scl.set(item.sx, item.sy, item.sx)
      mat4.compose(pos, quat, scl)
      mesh.setMatrixAt(i, mat4)
      mesh.setColorAt(i, col.set(item.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [items])

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, items.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      {children}
    </instancedMesh>
  )
}

function GroundDecor({ outline }: { outline: THREE.Vector2[] }) {
  const { tufts, pebbles } = useMemo(() => {
    const poly = outline.map((p) => ({ x: p.x, z: -p.y }))
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    poly.forEach((p) => {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minZ = Math.min(minZ, p.z)
      maxZ = Math.max(maxZ, p.z)
    })

    const pondX = POND[0] * MAP_SCALE
    const pondZ = POND[1] * MAP_SCALE
    const roads = ROAD_SEGMENTS.map(
      ([a, b]) =>
        [
          a[0] * MAP_SCALE,
          a[1] * MAP_SCALE,
          b[0] * MAP_SCALE,
          b[1] * MAP_SCALE,
        ] as [number, number, number, number]
    )
    const rand = mulberry32(97531)

    const clear = (x: number, z: number, margin: number) =>
      pointInPolygon(x, z, poly) &&
      Math.hypot(x - pondX, z - pondZ) > 8.2 &&
      Math.hypot(x, z) > margin &&
      !roads.some(
        ([ax, az, bx, bz]) =>
          distToSegment(x, z, [ax, az], [bx, bz]) < 4.4
      )

    const scatter = (
      count: number,
      margin: number,
      build: () => Omit<ScatterItem, "x" | "z">
    ) => {
      const items: ScatterItem[] = []
      for (let i = 0; i < count; i++) {
        for (let t = 0; t < 60; t++) {
          const x = minX + rand() * (maxX - minX)
          const z = minZ + rand() * (maxZ - minZ)
          if (!clear(x, z, margin)) continue
          items.push({ x, z, ...build() })
          break
        }
      }
      return items
    }

    const tufts = scatter(240, 4.8, () => ({
      y: 0.06,
      rotY: rand() * Math.PI,
      tiltX: (rand() - 0.5) * 0.5,
      tiltZ: (rand() - 0.5) * 0.5,
      sx: 0.9 + rand() * 1.1,
      sy: 0.9 + rand() * 1.1,
      color: TUFT_TONES[Math.floor(rand() * TUFT_TONES.length)],
    }))

    const pebbles = scatter(140, 4, () => ({
      y: 0.05,
      rotY: rand() * Math.PI * 2,
      tiltX: (rand() - 0.5) * 0.7,
      tiltZ: (rand() - 0.5) * 0.7,
      sx: 0.8 + rand() * 1.2,
      sy: 0.4 + rand() * 0.5,
      color: PEBBLE_TONES[Math.floor(rand() * PEBBLE_TONES.length)],
    }))

    return { tufts, pebbles }
  }, [outline])

  return (
    <>
      <ScatterField items={tufts}>
        <coneGeometry args={[0.22, 0.6, 5]} />
        <meshStandardMaterial roughness={1} />
      </ScatterField>
      <ScatterField items={pebbles}>
        <dodecahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </ScatterField>
    </>
  )
}

function Terrain() {
  const islandShape = useMemo(() => createIslandShape(MAP_SCALE), [])
  const outline = useMemo(() => islandShape.getPoints(96), [islandShape])

  const islandGeometry = useMemo(
    () =>
      new THREE.ExtrudeGeometry(islandShape, {
        depth: 0.8,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.45,
        bevelThickness: 0.35,
        curveSegments: 8,
      }),
    [islandShape]
  )

  const bounds = useMemo(() => {
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    outline.forEach((p) => {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minZ = Math.min(minZ, -p.y)
      maxZ = Math.max(maxZ, -p.y)
    })
    return {
      minX: minX - 4,
      maxX: maxX + 4,
      minZ: minZ - 4,
      maxZ: maxZ + 4,
    }
  }, [outline])

  const groundTexture = useMemo<THREE.CanvasTexture | null>(() => {
    if (typeof document === "undefined") return null

    const size = GROUND_TEX_SIZE
    const spanX = bounds.maxX - bounds.minX
    const spanZ = bounds.maxZ - bounds.minZ
    const cx = (x: number) => ((x - bounds.minX) / spanX) * size
    const cy = (z: number) => ((z - bounds.minZ) / spanZ) * size
    const ux = (w: number) => (w / spanX) * size
    const uz = (w: number) => (w / spanZ) * size
    const rand = mulberry32(5171)
    const poly = outline.map((p) => ({ x: p.x, z: -p.y }))

    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")!

    ctx.fillStyle = "#87d760"
    ctx.fillRect(0, 0, size, size)

    const blobTones = ["#7ccc50", "#a6e980", "#6dbf45", "#bdf09a", "#57b038"]
    for (let i = 0; i < 80; i++) {
      const x = bounds.minX + rand() * spanX
      const z = bounds.minZ + rand() * spanZ
      if (!pointInPolygon(x, z, poly)) continue
      ctx.globalAlpha = 0.5 + rand() * 0.35
      ctx.fillStyle = blobTones[Math.floor(rand() * blobTones.length)]
      ctx.beginPath()
      ctx.ellipse(
        cx(x),
        cy(z),
        ux(3.5 + rand() * 6.5),
        uz(2.5 + rand() * 5.5),
        rand() * Math.PI,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }
    ctx.globalAlpha = 1

    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    outline.forEach((p, i) => {
      const x = cx(p.x)
      const y = cy(-p.y)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.strokeStyle = "#e6d295"
    ctx.globalAlpha = 0.95
    ctx.lineWidth = ux(5.5)
    ctx.stroke()
    ctx.strokeStyle = "#c9ae74"
    ctx.globalAlpha = 0.65
    ctx.lineWidth = ux(1.8)
    ctx.stroke()
    ctx.globalAlpha = 1

    for (const [a, b] of ROAD_SEGMENTS) {
      const ax = cx(a[0] * MAP_SCALE)
      const az = cy(a[1] * MAP_SCALE)
      const bx = cx(b[0] * MAP_SCALE)
      const bz = cy(b[1] * MAP_SCALE)
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz) || 1
      const nx = (-dz / len) * ux(1.8)
      const nz = (dx / len) * uz(1.8)

      ctx.strokeStyle = "#dbc28c"
      ctx.globalAlpha = 0.85
      ctx.lineWidth = ux(4.6)
      ctx.beginPath()
      ctx.moveTo(ax, az)
      ctx.lineTo(bx, bz)
      ctx.stroke()

      ctx.strokeStyle = "#9c7a4c"
      ctx.globalAlpha = 0.7
      ctx.lineWidth = ux(0.75)
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(ax + nx * side, az + nz * side)
        ctx.lineTo(bx + nx * side, bz + nz * side)
        ctx.stroke()
      }

      ctx.fillStyle = "#79583a"
      ctx.globalAlpha = 0.55
      for (let t = 0.1; t < 0.95; t += 0.08) {
        ctx.beginPath()
        ctx.ellipse(
          ax + dx * t,
          az + dz * t,
          ux(0.35),
          uz(0.22),
          Math.atan2(dz, dx),
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    ctx.strokeStyle = "#cdbd8e"
    ctx.lineWidth = ux(0.8)
    for (let i = 0; i < 8; i++) {
      const x = bounds.minX + rand() * spanX
      const z = bounds.minZ + rand() * spanZ
      if (!pointInPolygon(x, z, poly)) continue
      const r = 3 + rand() * 3.5
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.ellipse(cx(x), cy(z), ux(r), uz(r), 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    const ring = (
      x: number,
      z: number,
      r: number,
      color: string,
      lw: number,
      alpha: number,
      dash?: number[]
    ) => {
      ctx.save()
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha
      ctx.lineWidth = ux(lw)
      ctx.setLineDash(dash ?? [])
      ctx.beginPath()
      ctx.ellipse(cx(x), cy(z), ux(r), uz(r), 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    ring(0, 0, 4.2, "#3fe4d0", 0.6, 0.95)
    ctx.globalAlpha = 0.18
    ctx.fillStyle = "#3fe4d0"
    ctx.beginPath()
    ctx.ellipse(cx(0), cy(0), ux(4), uz(4), 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    ring(
      WEST_GATE[0] * MAP_SCALE,
      WEST_GATE[1] * MAP_SCALE,
      5.4,
      "#fff1bf",
      0.45,
      0.9,
      [18, 12]
    )
    ring(
      GOLD_SPOT[0] * MAP_SCALE,
      GOLD_SPOT[1] * MAP_SCALE,
      5.6,
      "#e5b53a",
      0.45,
      0.9,
      [14, 12]
    )

    ctx.save()
    ctx.translate(
      cx(CAMP_GATE[0] * MAP_SCALE),
      cy(CAMP_GATE[1] * MAP_SCALE)
    )
    ctx.rotate(
      Math.atan2(
        (CAMP_END[1] - CAMP_ROAD[1]) * MAP_SCALE,
        (CAMP_END[0] - CAMP_ROAD[0]) * MAP_SCALE
      )
    )
    ctx.globalAlpha = 0.8
    for (let i = -3; i <= 3; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#f6d34a" : "#3a3f42"
      ctx.fillRect(i * ux(1.5), -uz(4), ux(1.5), uz(8))
    }
    ctx.restore()
    ctx.globalAlpha = 1

    for (let i = 0; i < 4; i++) {
      const x = bounds.minX + rand() * spanX
      const z = bounds.minZ + rand() * spanZ
      if (
        !pointInPolygon(x, z, poly) ||
        Math.hypot(x, z) < 8 ||
        Math.hypot(x - POND[0] * MAP_SCALE, z - POND[1] * MAP_SCALE) < 9
      ) {
        continue
      }
      const r = 1.2 + rand() * 2.4
      const grad = ctx.createRadialGradient(cx(x), cy(z), 0, cx(x), cy(z), ux(r))
      grad.addColorStop(0, "rgba(61,54,40,0.65)")
      grad.addColorStop(0.75, "rgba(61,54,40,0.2)")
      grad.addColorStop(1, "rgba(61,54,40,0)")
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.ellipse(cx(x), cy(z), ux(r), uz(r), 0, 0, Math.PI * 2)
      ctx.fill()
    }

    const speckles = ["#6aa23e", "#b7e37c", "#4f8a30", "#d9eda0"]
    ctx.globalAlpha = 0.8
    for (let i = 0; i < 360; i++) {
      const x = bounds.minX + rand() * spanX
      const z = bounds.minZ + rand() * spanZ
      if (!pointInPolygon(x, z, poly)) continue
      ctx.fillStyle = speckles[Math.floor(rand() * speckles.length)]
      ctx.beginPath()
      ctx.ellipse(
        cx(x),
        cy(z),
        ux(0.2 + rand() * 0.35),
        uz(0.2 + rand() * 0.35),
        rand() * Math.PI,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }
    ctx.globalAlpha = 1

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    texture.repeat.set(1 / spanX, 1 / spanZ)
    texture.offset.set(-bounds.minX / spanX, bounds.maxZ / spanZ)
    texture.needsUpdate = true
    return texture
  }, [bounds, outline])

  return (
    <>
      {/* Ocean */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.25, 0]}
        receiveShadow
      >
        <planeGeometry args={[960, 960]} />
        <meshStandardMaterial color="#4cabc9" roughness={0.85} />
      </mesh>

      {/* Dark earth beneath the island */}
      <mesh
        geometry={islandGeometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.95, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#536d43" roughness={1} flatShading />
      </mesh>

      {/* Main island surface */}
      {groundTexture && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.015, 0]}
          receiveShadow
        >
          <shapeGeometry args={[islandShape]} />
          <meshStandardMaterial
            map={groundTexture}
            roughness={0.95}
            flatShading
          />
        </mesh>
      )}

      <GroundDecor outline={outline} />

      {/*
        Pond water discs. Float a hair above the island surface (y 0.015) to
        avoid z-fighting; lower/raise the two y values here to tune the height.
      */}
      <mesh
        geometry={WATER_GEO}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[POND[0] * MAP_SCALE, 0.019, POND[1] * MAP_SCALE]}
        scale={5.35}
      >
        <meshStandardMaterial color="#6c9c4a" roughness={1} />
      </mesh>

      <mesh
        geometry={WATER_GEO}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[POND[0] * MAP_SCALE, 0.026, POND[1] * MAP_SCALE]}
        scale={4.9}
      >
        <meshStandardMaterial
          color="#46b8e5"
          roughness={0.24}
          metalness={0.05}
        />
      </mesh>
    </>
  )
}

function Battlefield() {
  return (
    <Physics gravity={[0, -9.81, 0]}>
      {/* Flat ground collider matching the terrain surface */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[95, 1, 95]} position={[0, -1, 0]} />
      </RigidBody>

      {/* Island and shoreline */}
      <Terrain />

      {/* Village architecture */}
      <AssetModel path={M.house1} placements={[HOUSES[0]]} />
      <AssetModel path={M.house2} placements={[HOUSES[2], HOUSES[3]]} />
      <AssetModel path={M.house3} placements={[HOUSES[1]]} />

      <AssetModel path={M.pine} placements={FOREST_PINES} />

      <AssetModel path={DOCK_PATH} placements={DOCK} />

      {/* Existing environment props */}
      {[
        ...VILLAGE_PROPS,
        ...FARM_BUILDINGS,
        ...FARM_PROPS,
        ...POND_PROPS,
        ...MINE_PROPS,
        ...CAMP_PROPS,
        ...FOREST_EXTRAS,
        ...KAY_GROUPS,
      ].map((proto, i) => (
        <PropGroup key={i} proto={proto} />
      ))}

      {/* Static collision for every solid prop group */}
      {SOLID_PROTOS.map((proto, i) => (
        <SolidRigidBody key={i} path={proto.path} spots={proto.spots} />
      ))}

      <CharacterSpawn position={[0, 0, 0]} />
    </Physics>
  )
}

export default function GameWorld() {
  return (
    <div className="relative h-screen w-full bg-sky-200">
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 select-none rounded-full bg-black/45 px-4 py-2 text-xs font-medium tracking-wide text-white/95 backdrop-blur-sm">
        Move: <span className="font-semibold">WASD</span> /{" "}
        <span className="font-semibold">Arrow Keys</span>
      </div>

      <LoadingScreen />

      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
        camera={{
          position: [68, 84, 96],
          fov: 42,
          near: 0.1,
          far: 700,
        }}
      >
        <color attach="background" args={["#b8dced"]} />

        <ambientLight intensity={0.8} />

        <hemisphereLight args={["#dff3ff", "#526b3e", 1.2]} />

        <directionalLight
          position={[-45, 80, 35]}
          intensity={2.2}
          castShadow
          shadow-mapSize-width={4096}
          shadow-mapSize-height={4096}
          shadow-camera-left={-135}
          shadow-camera-right={135}
          shadow-camera-top={135}
          shadow-camera-bottom={-135}
          shadow-camera-far={420}
          shadow-bias={-0.0003}
          shadow-normalBias={0.04}
        />

        <fog attach="fog" args={["#c5e4f2", 130, 320]} />

        <Suspense fallback={null}>
          <Battlefield />
        </Suspense>

        <FollowCamera />
      </Canvas>
    </div>
  )
}
