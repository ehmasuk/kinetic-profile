import * as THREE from "three"

import { mulberry32, pointInPolygon, type PolyPoint } from "@/lib/geometry"
import {
  CAMP_END,
  CAMP_GATE,
  CAMP_ROAD,
  GOLD_SPOT,
  POND,
  ROAD_SEGMENTS,
  WEST_GATE,
} from "./battlefield-placements.ts"
import { MAP_SCALE } from "./map-config.ts"

const GROUND_TEX_SIZE = 2048

// The island outline as THREE.Vector2 points (shape y = world -z).
export type Outline = THREE.Vector2[]

// Bounds of the textured ground plane in world units.
export type GroundBounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

// Paints the whole island surface (grass, roads, shoreline, markers) into a
// single canvas texture mapped 1:1 onto the ground plane. Pure function: same
// inputs always yield the same texture.
export function createGroundTexture(
  bounds: GroundBounds,
  outline: Outline
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null

  const size = GROUND_TEX_SIZE
  const spanX = bounds.maxX - bounds.minX
  const spanZ = bounds.maxZ - bounds.minZ
  const cx = (x: number) => ((x - bounds.minX) / spanX) * size
  const cy = (z: number) => ((z - bounds.minZ) / spanZ) * size
  const ux = (w: number) => (w / spanX) * size
  const uz = (w: number) => (w / spanZ) * size
  const rand = mulberry32(5171)
  const poly: PolyPoint[] = outline.map((p) => ({ x: p.x, z: -p.y }))

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
  ctx.translate(cx(CAMP_GATE[0] * MAP_SCALE), cy(CAMP_GATE[1] * MAP_SCALE))
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
}
