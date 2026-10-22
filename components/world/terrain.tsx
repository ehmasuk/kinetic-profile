"use client"

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import * as THREE from "three"
import {
  boundsOf,
  distToSegment,
  mulberry32,
  pointInPolygon,
} from "@/lib/geometry"
import { POND, ROAD_SEGMENTS } from "./battlefield-placements.ts"
import { createGroundTexture, type Outline } from "./ground-texture.ts"
import { createIslandShape, MAP_SCALE } from "./map-config.ts"

const WATER_GEO = new THREE.CircleGeometry(1, 24)

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

function GroundDecor({ outline }: { outline: Outline }) {
  const { tufts, pebbles } = useMemo(() => {
    const poly = outline.map((p) => ({ x: p.x, z: -p.y }))
    const { minX, maxX, minZ, maxZ } = boundsOf(poly)

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
        ([ax, az, bx, bz]) => distToSegment(x, z, ax, az, bx, bz) < 4.4
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

export function Terrain() {
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
    const b = boundsOf(outline.map((p) => ({ x: p.x, z: -p.y })))
    return {
      minX: b.minX - 4,
      maxX: b.maxX + 4,
      minZ: b.minZ - 4,
      maxZ: b.maxZ + 4,
    }
  }, [outline])

  const groundTexture = useMemo(
    () => createGroundTexture(bounds, outline),
    [bounds, outline]
  )

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
