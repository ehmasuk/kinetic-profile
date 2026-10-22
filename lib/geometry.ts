// Pure 2D math helpers shared by the renderer, placement data, and the
// placement checker script. No THREE or React imports so every module that
// pulls this in stays cheap.

export type PolyPoint = { x: number; z: number }

// Deterministic PRNG (mulberry32) so scattering looks identical on every load.
export function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pointInPolygon(
  x: number,
  z: number,
  poly: PolyPoint[]
): boolean {
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

export function distToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const dx = bx - ax
  const dz = bz - az
  const len = dx * dx + dz * dz
  if (len === 0) return Math.hypot(px - ax, pz - az)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len))
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t))
}

// Axis-aligned bounds of a point cloud.
export function boundsOf(points: PolyPoint[]): {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
} {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.z < minZ) minZ = p.z
    if (p.z > maxZ) maxZ = p.z
  }
  return { minX, maxX, minZ, maxZ }
}

// Mean point of a polygon outline (good enough as an "island center").
export function centroidOf(points: PolyPoint[]): PolyPoint {
  let x = 0
  let z = 0
  for (const p of points) {
    x += p.x
    z += p.z
  }
  return { x: x / points.length, z: z / points.length }
}
