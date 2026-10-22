// Static battlefield layout data: every prop placement on the island.
// Coordinates are authored in MAP units and converted to world units (x3) by
// `on()` / `fillLine`. Pure data and helpers, imported by the scene renderer
// and by scripts/check-placements.ts so bounds validation always tests the
// same numbers the game renders.
// NOTE: relative imports use explicit `.ts` extensions because the checker
// script loads this module under Node's type-stripping loader (which, unlike
// the bundler, does not resolve extensionless imports).

import {
  mulberry32,
  pointInPolygon,
  distToSegment as distToSeg,
  type PolyPoint,
} from "../../lib/geometry.ts"
import { MAP_SCALE, createIslandShape } from "./map-config.ts"

export type Vec2 = [number, number]

export type Placement = {
  position: [number, number, number]
  rotationY?: number
  scale?: number
}

export type PropGroupDef = {
  path: string
  spots: Placement[]
  solid?: boolean
}

/**
 * Declares a prop group that blocks the character (colliders are generated).
 */
export function solid(path: string, spots: Placement[]): PropGroupDef {
  return { path, spots, solid: true }
}

/**
 * Declares a prop group the character can walk through (no colliders).
 * Flip the call site to `solid(...)` to make it block again.
 */
export function passable(path: string, spots: Placement[]): PropGroupDef {
  return { path, spots, solid: false }
}

const face = (from: Vec2, to: Vec2): number =>
  Math.atan2(to[0] - from[0], to[1] - from[1])

const along = (from: Vec2, to: Vec2): number =>
  Math.atan2(-(to[1] - from[1]), to[0] - from[0])

const place = (
  p: Vec2,
  y: number,
  rotationY: number,
  scale: number
): Placement => ({ position: [p[0], y, p[1]], rotationY, scale })

const on = (p: Vec2, y: number, rotationY: number, scale: number): Placement =>
  place([p[0] * MAP_SCALE, p[1] * MAP_SCALE], y, rotationY, scale)

const fillLine = (
  from: Vec2,
  to: Vec2,
  span: number,
  scale: number,
  y = 0
): Placement[] => {
  const a: Vec2 = [from[0] * MAP_SCALE, from[1] * MAP_SCALE]
  const b: Vec2 = [to[0] * MAP_SCALE, to[1] * MAP_SCALE]
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.max(1, Math.ceil(dist / (span * scale * 0.97)))
  const rotationY = along(a, b)
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n
    return place(
      [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
      y,
      rotationY,
      scale
    )
  })
}

export const M = {
  house1: "/models/environment/Houses_FirstAge_1_Level2.gltf",
  house2: "/models/environment/Houses_FirstAge_2_Level2.gltf",
  house3: "/models/environment/Houses_FirstAge_3_Level2.gltf",
  barracks: "/models/environment/Barracks_FirstAge_Level1.gltf",
  market: "/models/environment/Market_FirstAge_Level1.gltf",
  townCenter: "/models/environment/TownCenter_FirstAge_Level2.gltf",
  storage: "/models/environment/Storage_FirstAge_Level1.gltf",
  towerHouse: "/models/environment/TowerHouse_FirstAge.gltf",
  watchTower1: "/models/environment/WatchTower_FirstAge_Level1.gltf",
  watchTower3: "/models/environment/WatchTower_FirstAge_Level3.gltf",
  windmill: "/models/environment/Windmill_FirstAge.gltf",
  mine: "/models/environment/Mine.gltf",
  archery: "/models/environment/Archery_FirstAge_Level1.gltf",
  wall: "/models/environment/WallTowers_FirstAge.gltf",
  palmRow: "/models/trees/palm/palm-tress.glb",
  wallDoor: "/models/environment/WallTowers_Door_FirstAge.gltf",
  pine: "/models/environment/Resource_PineTree.gltf",
  pineGroup: "/models/environment/Resource_PineTree_Group.gltf",
  tree1: "/models/environment/Resource_Tree1.gltf",
  treeGroup: "/models/environment/Resource_Tree_Group.gltf",
  treeGroupCut: "/models/environment/Resource_Tree_Group_Cut.gltf",
  rock: "/models/environment/Rock.gltf",
  gold1: "/models/environment/Resource_Gold_1.gltf",
  gold2: "/models/environment/Resource_Gold_2.gltf",
  gold3: "/models/environment/Resource_Gold_3.gltf",
  barrel: "/models/environment/Barrel.gltf",
  crate: "/models/environment/Crate.gltf",
  crateStack: "/models/environment/Crate_Stack2.gltf",
  logs: "/models/environment/Logs.gltf",
  bench: "/models/skate/bench.glb",
  benches: "/models/skate/benches.glb",
  fence: "/models/skate/fence.glb",
  pallet: "/models/skate/pallet.glb",
  plank: "/models/skate/plank.glb",
  box: "/models/skate/obstacle-box.glb",
  kayTree1: "/models/trees/tree_1.glb",
  kayTree2: "/models/trees/tree_2.glb",
  kayTree3: "/models/trees/tree_3.glb",
  kayTree4: "/models/trees/tree_4.glb",
  kayTree5: "/models/trees/tree_5.glb",
  kayTree6: "/models/trees/tree_6.glb",
  kayPine1: "/models/trees/tree_pine_1.glb",
  kayPine2: "/models/trees/tree_pine_2.glb",
  kayPine3: "/models/trees/tree_pine_3.glb",
  kayBush1: "/models/trees/bush_1.glb",
  kayBush2: "/models/trees/bush_2.glb",
  kayBush3: "/models/trees/bush_3.glb",
  kayBush4: "/models/trees/bush_4.glb",
  kayDead1: "/models/trees/dead_tree_1.glb",
  kayDead2: "/models/trees/dead_tree_2.glb",
  kayDead3: "/models/trees/dead_tree_3.glb",
  kayTrunk1: "/models/trees/trunk_1.glb",
  kayTrunk2: "/models/trees/trunk_2.glb",
  kayTrunk3: "/models/trees/trunk_3.glb",
  kayTrunk4: "/models/trees/trunk_4.glb",
  kayGrass1: "/models/trees/grass_1.glb",
  kayGrass2: "/models/trees/grass_2.glb",
  kayGrass3: "/models/trees/grass_3.glb",
  kayGrass4: "/models/trees/grass_4.glb",
  kayGrass5: "/models/trees/grass_5.glb",
  kayGrass6: "/models/trees/grass_6.glb",
  kayGrass7: "/models/trees/grass_7.glb",
  kayGrass8: "/models/trees/grass_8.glb",
  kayGrass9: "/models/trees/grass_9.glb",
  kayGrass10: "/models/trees/grass_10.glb",
  kayGrass11: "/models/trees/grass_11.glb",
  kayLog1: "/models/trees/log_1.glb",
  kayLog2: "/models/trees/log_2.glb",
  kayLog3: "/models/trees/log_3.glb",
  kayLog4: "/models/trees/log_4.glb",
  kayStick1: "/models/trees/stick_1.glb",
  kayStick2: "/models/trees/stick_2.glb",
  kayStick3: "/models/trees/stick_3.glb",
}

export const WELL: Vec2 = [-2.7, -0.4]

export const FARM_GATE: Vec2 = [8.0, -4.3]

export const CAMP_GATE: Vec2 = [7.8, 4.6]
export const CAMP_ROAD: Vec2 = [10.4, 7.6]
export const CAMP_END: Vec2 = [10.6, 11.8]

export const WEST_GATE: Vec2 = [0, 17.6]

export const ROAD_SEGMENTS: [Vec2, Vec2][] = [
  // Central town loop
  [
    [-5.5, -4.5],
    [5.5, -4.5],
  ],
  [
    [5.5, -4.5],
    [7, 3.5],
  ],
  [
    [7, 3.5],
    [-4.5, 6],
  ],
  [
    [-4.5, 6],
    [-5.5, -4.5],
  ],

  // North: drop zone and forest camp
  [
    [0, 1],
    [0, 17.6],
  ],
  [
    [0, 10],
    [10.4, 7.6],
  ],
  [
    [10.4, 7.6],
    [10.6, 11.8],
  ],

  // West: mining district
  [
    [-3, 2],
    [-8, 4.6],
  ],
  [
    [-8, 4.6],
    [-12, 7.6],
  ],

  // Southwest: lakeside retreat
  [
    [-3, -2],
    [-7.8, -5.6],
  ],
  [
    [-7.8, -5.6],
    [-12.2, -8],
  ],

  // East: farm outpost
  [
    [4, -2],
    [8, -4.3],
  ],
  [
    [8, -4.3],
    [12.4, -6.4],
  ],
]

export const GOLD_SPOT: Vec2 = [-14.6, 9.4]

export const WALL_DOOR: Placement = on([0.26, 21.35], 0, 0, 4.6)

export const HOUSES: Placement[] = [
  on([-6.6, -2.6], 0, face([-6.6, -2.6], WELL), 4.6),
  on([7.4, 6.4], 0, face([7.4, 6.4], WELL), 4.6),
  on([6.4, -5.4], 0, face([6.4, -5.4], WELL), 4.6),
  on([-6.2, 6.8], 0, face([-6.2, 6.8], WELL), 4.6),
]

export const VILLAGE_PROPS: PropGroupDef[] = [
  solid(M.townCenter, [on(WELL, 1.0, 0.4, 4)]),
  solid(M.market, [
    on([2.6, -1.0], 1.0, face([2.6, -1.0], WELL), 3.6),
    on([2.9, 2.4], 1.0, face([2.9, 2.4], WELL), 3.6),
  ]),
  passable(M.bench, [
    on([2.2, 7.4], 0, face([2.2, 7.4], WELL), 2.6),
    on([-7.9, 0.9], 0, face([-7.9, 0.9], WELL), 2.6),
    on([11.5, 7.4], 0, face([11.5, 7.4], [8, 8]), 2.6),
  ]),
  passable(M.barrel, [
    on([-0.9, -2.8], 1.0, 0.2, 4.6),
    on([-0.42, -2.4], 1.0, 1.3, 4.6),
    on([1.3, 9.4], 0, 1.2, 4.6),
    on([1.6, 18.4], 0, 0.5, 4.6),
  ]),
  passable(M.crateStack, [
    on([4.6, -2.1], 0.93, -0.3, 4),
    on([-1.7, 18.6], 0, 0.4, 4),
  ]),
  passable(M.crate, [on([8.5, -0.6], 0, 0.7, 4)]),
  passable(M.box, [on([7.6, 2.6], 0, 0.1, 3.6)]),
  passable(M.logs, [on([2.4, 8.4], 0, -0.5, 3.4)]),
  solid(M.watchTower1, [on([-2.2, 8.2], 0, face([-2.2, 8.2], [1, -8.2]), 4.4)]),
]

export const FARM_BUILDINGS: PropGroupDef[] = [
  solid(M.storage, [on([14.4, -7.4], 0.9, face([14.4, -7.4], FARM_GATE), 4.4)]),
  solid(M.watchTower1, [on([19.6, -6.4], 0, face([19.6, -6.4], WELL), 4.4)]),
  solid(M.watchTower3, [
    on([16.47, -16.98], 0, face([16.47, -16.98], WELL), 4.4),
  ]),
]

export const FARM_PROPS: PropGroupDef[] = [
  passable(M.pallet, [on([13.3, -17.3], 0.92, 0.4, 3.4)]),
  passable(M.plank, [on([14.0, -16.9], 0.92, 0.5, 2.6)]),
  passable(M.logs, [on([15.0, -17.9], 0.92, 0.3, 3.4)]),
  passable(M.barrel, [on([13.9, -13.6], 0.92, 0.4, 4.6)]),
  solid(M.fence, [
    ...fillLine([7.7, -6.0], [7.7, -14.9], 1.0, 2.2),
    ...fillLine([8.0, -7.8], [10.0, -7.8], 1.0, 2.2),
  ]),
  passable(M.pine, [
    on([9.2, -19.2], 0, 0.4, 6),
    on([14.4, -19.5], 0, 1.1, 6.1),
  ]),
]

export const POND: Vec2 = [-13.4, -13.2]

export const POND_PROPS: PropGroupDef[] = [
  passable(M.bench, [on([-8.9, -9.7], 0, -0.91, 2.6)]),
  passable(M.benches, [on([-10.8, -8.0], 0, 0.8, 2.6)]),
  passable(M.pine, [
    on([-20.3, -10.2], 0, 0.2, 6.2),
    on([-20.1, -14.3], 0, 2.4, 6.4),
    on([-16.63, -17.54], 0, 0.9, 5.6),
    on([-15.01, -19.0], 0, 0.3, 6),
  ]),
]

export const DOCK: Placement[] = [on([-10.6, -10.4], 0.06, -2.356, 2.6)]

export const MINE_PROPS: PropGroupDef[] = [
  solid(M.mine, [on([-14.2, 13.2], 0, face([-14.2, 13.2], [-11, 7.5]), 4)]),
  solid(M.gold1, [on([-13.5, 9.2], 0.85, 0.35, 4)]),
  solid(M.gold2, [on([-15.9, 9.7], 0.85, 1.2, 4)]),
  solid(M.gold3, [on([-11.8, 8.4], 0.85, -0.3, 4)]),
  passable(M.barrel, [
    on([-10.9, 10.9], 0, 0.4, 4.6),
    on([-10.3, 10.2], 0, 1.4, 4.6),
  ]),
  passable(M.crateStack, [on([-10.9, 12.6], 0, 0.7, 4)]),
  solid(M.watchTower1, [
    on([-9.9, 15.1], 0, face([-9.9, 15.1], [-12, 9.5]), 4.4),
  ]),
  passable(M.pine, [
    on([-20.2, 6.1], 0, 0.5, 6.2),
    on([-19.6, 19.8], 0, 0.8, 6.5),
  ]),
]

export const CAMPFIRE: Vec2 = [10.3, 12.6]

export const CAMPFIRE_ROCKS: Placement[] = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2
  return on(
    [CAMPFIRE[0] + Math.cos(a) * 1.15, CAMPFIRE[1] + Math.sin(a) * 1.15],
    0,
    a,
    4
  )
})

export const CAMP_PROPS: PropGroupDef[] = [
  solid(M.windmill, [on([16.2, 14.6], 0, face([16.2, 14.6], [2, 6]), 3.3)]),
  solid(M.barracks, [on([14.0, 8.9], 0, face([14.0, 8.9], CAMP_ROAD), 4.6)]),
  solid(M.archery, [on([7.6, 14.9], 0, face([7.6, 14.9], [2, 10]), 3.4)]),
  solid(M.towerHouse, [on([17.6, 17.5], 0, face([17.6, 17.5], WELL), 4.6)]),
  solid(M.watchTower1, [on([8.6, 17.6], 0, face([8.6, 17.6], [6, 4]), 4.4)]),
  passable(M.logs, [on(CAMPFIRE, 0, 0.6, 1.8), on([13.9, 18.9], 0, 0.2, 3.4)]),
  solid(M.rock, [...CAMPFIRE_ROCKS]),
  passable(M.bench, [
    on([8.8, 12.6], 0, Math.PI / 2, 2.6),
    on([12.2, 12.6], 0, -Math.PI / 2, 2.6),
  ]),
  passable(M.barrel, [
    on([14.9, 11.9], 0, 0.3, 4.6),
    on([13.2, 12.2], 0, 1.5, 4.6),
    on([13.4, 16.0], 0, 0.8, 4.6),
  ]),
  passable(M.crateStack, [on([12.6, 14.5], 0, 0.6, 4)]),
  passable(M.pallet, [on([15.8, 11.6], 0, 0.4, 3.4)]),
  passable(M.plank, [on([16.6, 11.0], 0, 0.9, 2.6)]),
  passable(M.box, [on([13.2, 6.15], 0, 0.5, 3.6)]),
  solid(M.fence, [
    on([14.6, 11.3], 0, 0.2, 2.2),
    on([12.4, 10.8], 0, 0.35, 2.2),
    on([18.9, 12.2], 0, Math.PI / 2 + 0.2, 2.2),
  ]),
  passable(M.pine, [
    on([12.3, 19.9], 0, 0.3, 6),
    on([15.4, 20.0], 0, 0.8, 6.2),
    on([20.0, 7.4], 0, 1.3, 5.8),
    on([-2.9, 19.9], 0, 0.4, 6),
  ]),
]

export const FOREST_PINES: Placement[] = [
  on([-12.5, -19.7], 0, 0.2, 5.8),
  on([-9.0, -19.1], 0, 0.9, 6.1),
  on([-4.6, -19.6], 0, 0.35, 5.6),
  on([-0.5, -19.0], 0, 0.75, 6.2),
  on([3.8, -19.5], 0, 0.15, 5.9),
  on([7.9, -19.2], 0, 0.55, 6.3),
]

export const FOREST_EXTRAS: PropGroupDef[] = [
  passable(M.pineGroup, [on([-13.6, -16.3], 0, -0.4, 3.2)]),
  passable(M.treeGroup, [on([2.2, -16.6], 0, 0.6, 3)]),
  passable(M.treeGroupCut, [on([-8.4, -14.8], 0, 0.3, 4)]),
  passable(M.logs, [on([-4.2, -13.9], 0, -0.5, 3.4)]),
  passable(M.barrel, [on([-3.1, -15.9], 0, 0.6, 4.6)]),
  passable(M.palmRow, [on([12.0, 0.0], 0, 0.2, 1.1)]),
  passable(M.tree1, [
    on([-16.6, -6.4], 0, 0.3, 5),
    on([17.2, -6.6], 0, 0.2, 5.2),
    on([-18.9, 3.1], 0, 0.5, 5.4),
    on([5.9, -12.9], 0, 0.4, 4.8),
  ]),
]

export const DOCK_PATH = "/models/environment/Dock_FirstAge.gltf"

// ---------- kaykit nature packs ----------
// Live (big) trees form a dense ring along the island shore, just inside the
// outline. Bushes, small trees, dead trees and stumps are scattered across the
// whole map with a seeded generator that keeps clear of every existing prop,
// the roads, the pond, and the shoreline. Numbers below are world units.

const rnd = mulberry32(1337)

// Island outline in world units (shape y maps to world -z).
const ISLAND_OUTLINE: PolyPoint[] = createIslandShape(MAP_SCALE)
  .extractPoints(192)
  .shape.map((p) => ({ x: p.x, z: -p.y }))

const islandCenter = ISLAND_OUTLINE.reduce(
  (acc, p) => ({ x: acc.x + p.x, z: acc.z + p.z }),
  { x: 0, z: 0 }
)
islandCenter.x /= ISLAND_OUTLINE.length
islandCenter.z /= ISLAND_OUTLINE.length

const insideIsland = (x: number, z: number): boolean =>
  pointInPolygon(x, z, ISLAND_OUTLINE)

// Distance from a point to the island outline (shoreline).
const shoreDistance = (x: number, z: number): number => {
  let min = Infinity
  for (let i = 0; i < ISLAND_OUTLINE.length; i++) {
    const a = ISLAND_OUTLINE[i]
    const b = ISLAND_OUTLINE[(i + 1) % ISLAND_OUTLINE.length]
    min = Math.min(min, distToSeg(x, z, a.x, a.z, b.x, b.z))
  }
  return min
}

const WALL_R = 21.35 * MAP_SCALE

const wallDistance = (x: number, z: number): number => {
  const c = WALL_R
  let min = Infinity
  for (const [a, b] of [
    [
      { x: -c, z: -c },
      { x: c, z: -c },
    ],
    [
      { x: c, z: -c },
      { x: c, z: c },
    ],
    [
      { x: c, z: c },
      { x: -c, z: c },
    ],
    [
      { x: -c, z: c },
      { x: -c, z: -c },
    ],
  ] as [PolyPoint, PolyPoint][]) {
    min = Math.min(min, distToSeg(x, z, a.x, a.z, b.x, b.z))
  }
  return min
}

const roadDistance = (x: number, z: number): number => {
  let min = Infinity
  for (const [a, b] of ROAD_SEGMENTS) {
    min = Math.min(
      min,
      distToSeg(
        x,
        z,
        a[0] * MAP_SCALE,
        a[1] * MAP_SCALE,
        b[0] * MAP_SCALE,
        b[1] * MAP_SCALE
      )
    )
  }
  return min
}

// Keeps buffer zones (world units) around each existing prop model.
const KAY_CLEARANCE: Partial<Record<string, number>> = {
  [M.house1]: 12,
  [M.house2]: 12,
  [M.house3]: 12,
  [M.townCenter]: 11,
  [M.market]: 9,
  [M.storage]: 10.5,
  [M.towerHouse]: 12,
  [M.watchTower1]: 7,
  [M.watchTower3]: 7,
  [M.windmill]: 6.5,
  [M.barracks]: 11,
  [M.archery]: 7,
  [M.mine]: 10,
  [M.gold1]: 5,
  [M.gold2]: 5,
  [M.gold3]: 5,
  // trees only need trunk-level clearance: bush/grass may sit under canopies
  [M.pine]: 1.8,
  [M.pineGroup]: 1.8,
  [M.tree1]: 1.8,
  [M.treeGroup]: 1.8,
  [M.treeGroupCut]: 1.8,
  [M.palmRow]: 13,
  [M.crateStack]: 4.5,
  [M.crate]: 3.5,
  [M.logs]: 4,
  [M.barrel]: 3.5,
  [M.bench]: 3,
  [M.benches]: 3,
  [M.rock]: 4.5,
  [M.fence]: 2.6,
  [DOCK_PATH]: 7.5,
}

type Guard = { x: number; z: number; r: number }

const KAY_GUARDS: Guard[] = (() => {
  const out: Guard[] = []
  const push = (spot: Placement, path: string) => {
    out.push({
      x: spot.position[0],
      z: spot.position[2],
      r: KAY_CLEARANCE[path] ?? 5.7,
    })
  }
  for (const group of [
    ...VILLAGE_PROPS,
    ...FARM_BUILDINGS,
    ...FARM_PROPS,
    ...POND_PROPS,
    ...MINE_PROPS,
    ...CAMP_PROPS,
    ...FOREST_EXTRAS,
  ]) {
    for (const spot of group.spots) push(spot, group.path)
  }
  for (const spot of HOUSES) push(spot, M.house1)
  for (const spot of FOREST_PINES) push(spot, M.pine)
  for (const spot of DOCK) push(spot, DOCK_PATH)
  push(WALL_DOOR, "")
  out.push({ x: POND[0] * MAP_SCALE, z: POND[1] * MAP_SCALE, r: 10.4 })
  return out
})()

const POND_CENTER = { x: POND[0] * MAP_SCALE, z: POND[1] * MAP_SCALE }

const pondDistance = (x: number, z: number): number =>
  Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z)

const inDoorBand = (x: number, z: number): boolean => Math.abs(x) < 7 && z > 57

function suitsSpot(
  x: number,
  z: number,
  radius: number,
  prior: Guard[],
  pad = 0.8
): boolean {
  for (const g of KAY_GUARDS) {
    if (Math.hypot(x - g.x, z - g.z) < g.r + radius) return false
  }
  for (const a of prior) {
    if (Math.hypot(x - a.x, z - a.z) < a.r + radius + pad) return false
  }
  return true
}

type Entry = { path: string; placement: Placement }

const BORDER_RAW: Entry[] = []
// Border ring: several rows of big trees along the shoreline for a dense
// forest fringe. Foliage may overlap freely; only trunks need spacing, and a
// small inward shift keeps trunks clear of the wall ring.
const borderPrior: Guard[] = []
const RING_TRUNK_R = 1.6

const borderRow = (
  step: number,
  start: number,
  insetMin: number,
  insetVar: number
): void => {
  const variants = [
    M.kayTree1,
    M.kayTree4,
    M.kayTree2,
    M.kayTree5,
    M.kayPine1,
    M.kayPine2,
  ]
  for (let i = start; i < ISLAND_OUTLINE.length; i += step) {
    const p = ISLAND_OUTLINE[i]
    if (inDoorBand(p.x, p.z)) continue
    const hyp = Math.hypot(p.x - islandCenter.x, p.z - islandCenter.z)
    const ux = (islandCenter.x - p.x) / hyp
    const uz = (islandCenter.z - p.z) / hyp
    const inset = insetMin + rnd() * insetVar
    let x = p.x + ux * inset
    let z = p.z + uz * inset
    const wd = wallDistance(x, z)
    if (wd < 2.4) {
      x += ux * (2.4 - wd)
      z += uz * (2.4 - wd)
    }
    if (!insideIsland(x, z) || shoreDistance(x, z) < 5.2) continue
    if (!suitsSpot(x, z, RING_TRUNK_R, borderPrior, 0)) continue
    borderPrior.push({ x, z, r: RING_TRUNK_R })
    BORDER_RAW.push({
      path: variants[Math.floor(rnd() * variants.length)],
      placement: {
        position: [x, 0, z],
        rotationY: rnd() * Math.PI * 2,
        scale: 0.85 + rnd() * 0.35,
      },
    })
  }
}

borderRow(2, 1, 3.2, 1.4) // outer row, tight along the shore
borderRow(6, 0, 6.4, 1.8) // inner row filling the gaps
borderRow(12, 6, 9.6, 2.2) // third row for a deeper tree line
borderRow(24, 18, 12.8, 2.0) // sparse tips scattering farther inland

type ScatterSpec = {
  paths: string[]
  radius: number
  scaleMin: number
  scaleVar: number
  count: number
  shoreMax?: number // when set, items are biased onto the edge of the island
}

const SCATTER_SPECS: ScatterSpec[] = [
  {
    paths: [M.kayTree3, M.kayTree6, M.kayPine3],
    radius: 3.3,
    scaleMin: 1.0,
    scaleVar: 0.4,
    count: 14,
  },
  {
    paths: [M.kayDead1, M.kayDead2, M.kayDead3],
    radius: 3.0,
    scaleMin: 0.9,
    scaleVar: 0.5,
    count: 14,
    shoreMax: 20,
  },
  {
    paths: [M.kayTrunk1, M.kayTrunk2, M.kayTrunk3, M.kayTrunk4],
    radius: 3.3,
    scaleMin: 1.4,
    scaleVar: 1.2,
    count: 10,
    shoreMax: 18,
  },
  {
    paths: [M.kayLog1, M.kayLog2, M.kayLog3, M.kayLog4],
    radius: 2.4,
    scaleMin: 1.4,
    scaleVar: 0.6,
    count: 10,
    shoreMax: 16,
  },
  {
    paths: [M.kayStick1, M.kayStick2, M.kayStick3],
    radius: 1.2,
    scaleMin: 1.8,
    scaleVar: 1.4,
    count: 14,
    shoreMax: 18,
  },
]

const SCATTERS_RAW: Entry[][] = SCATTER_SPECS.map((spec) => {
  const entries: Entry[] = []
  const prior: Guard[] = BORDER_RAW.map((e) => ({
    x: e.placement.position[0],
    z: e.placement.position[2],
    r: 3.0, // canopies may overlap; keep a mid gap for trunks
  }))
  let tries = 0
  while (entries.length < spec.count && tries < 12000) {
    tries++
    const x = (rnd() * 2 - 1) * 62
    const z = (rnd() * 2 - 1) * 62
    if (!insideIsland(x, z) || shoreDistance(x, z) < 5.4) continue
    if (spec.shoreMax && shoreDistance(x, z) > spec.shoreMax) continue
    if (inDoorBand(x, z)) continue
    if (roadDistance(x, z) < 4.8) continue
    if (pondDistance(x, z) < 10.4) continue
    if (!suitsSpot(x, z, spec.radius, prior)) continue
    prior.push({ x, z, r: spec.radius })
    entries.push({
      path: spec.paths[Math.floor(rnd() * spec.paths.length)],
      placement: {
        position: [x, 0, z],
        rotationY: rnd() * Math.PI * 2,
        scale: spec.scaleMin + rnd() * spec.scaleVar,
      },
    })
  }
  return entries
})

// Bushes + grass use an even jittered grid over the whole island so they
// spread uniformly; every accepted cell contributes exactly one bush and one
// grass tuft (equal proportions), placed apart inside the cell.
const BUSH_GRID_RAW: Entry[] = []
const GRASS_GRID_RAW: Entry[] = []

const bushPrior: Guard[] = BORDER_RAW.map((e) => ({
  x: e.placement.position[0],
  z: e.placement.position[2],
  r: 1.0,
}))
const grassPrior: Guard[] = BORDER_RAW.map((e) => ({
  x: e.placement.position[0],
  z: e.placement.position[2],
  r: 1.0,
}))

const gridScatter = (): void => {
  const cell = 9.8
  const half = 62
  const bushes = [M.kayBush1, M.kayBush2, M.kayBush3, M.kayBush4]
  const grass = [
    M.kayGrass1,
    M.kayGrass2,
    M.kayGrass3,
    M.kayGrass4,
    M.kayGrass5,
    M.kayGrass6,
    M.kayGrass7,
    M.kayGrass8,
    M.kayGrass9,
    M.kayGrass10,
    M.kayGrass11,
  ]
  for (let cx = -half; cx <= half; cx += cell) {
    for (let cz = -half; cz <= half; cz += cell) {
      const jx = (rnd() - 0.5) * cell * 0.62
      const jz = (rnd() - 0.5) * cell * 0.62
      const bx = cx + jx
      const bz = cz + jz
      const gx = cx - jx
      const gz = cz - jz
      // one bush per cell if the cell is fair ground
      if (
        insideIsland(bx, bz) &&
        shoreDistance(bx, bz) >= 5.4 &&
        !inDoorBand(bx, bz) &&
        roadDistance(bx, bz) >= 4.8 &&
        pondDistance(bx, bz) >= 10.4 &&
        suitsSpot(bx, bz, 2.4, bushPrior)
      ) {
        bushPrior.push({ x: bx, z: bz, r: 2.4 })
        BUSH_GRID_RAW.push({
          path: bushes[Math.floor(rnd() * bushes.length)],
          placement: {
            position: [bx, 0, bz],
            rotationY: rnd() * Math.PI * 2,
            scale: 1.0 + rnd() * 0.9,
          },
        })
      }
      // one grass tuft per cell (even where the bush was rejected, e.g. near
      // buildings, so grass stays denser and fully even)
      if (
        insideIsland(gx, gz) &&
        shoreDistance(gx, gz) >= 3.4 &&
        !inDoorBand(gx, gz) &&
        roadDistance(gx, gz) >= 3.4 &&
        pondDistance(gx, gz) >= 7.4 &&
        suitsSpot(gx, gz, 1.1, grassPrior, 0)
      ) {
        grassPrior.push({ x: gx, z: gz, r: 1.1 })
        GRASS_GRID_RAW.push({
          path: grass[Math.floor(rnd() * grass.length)],
          placement: {
            position: [gx, 0, gz],
            rotationY: rnd() * Math.PI * 2,
            scale: 1.4 + rnd() * 1.2,
          },
        })
      }
    }
  }
}

gridScatter()

function groupByPath(entries: Entry[]): PropGroupDef[] {
  const map = new Map<string, Placement[]>()
  for (const e of entries) {
    const list = map.get(e.path) ?? []
    list.push(e.placement)
    map.set(e.path, list)
  }
  return Array.from(map.entries(), ([path, spots]) => passable(path, spots))
}

export const BORDER_TREES: PropGroupDef[] = groupByPath(BORDER_RAW)
export const KAY_BUSHES: PropGroupDef[] = groupByPath(BUSH_GRID_RAW)
export const KAY_SMALL_TREES: PropGroupDef[] = groupByPath(SCATTERS_RAW[0])
export const KAY_DEAD_TREES: PropGroupDef[] = groupByPath(SCATTERS_RAW[1])
export const KAY_STUMPS: PropGroupDef[] = groupByPath(SCATTERS_RAW[2])
export const KAY_FALLEN_LOGS: PropGroupDef[] = groupByPath(SCATTERS_RAW[3])
export const KAY_STICKS: PropGroupDef[] = groupByPath(SCATTERS_RAW[4])
export const KAY_GRASS: PropGroupDef[] = groupByPath(
  GRASS_GRID_RAW.slice(0, BUSH_GRID_RAW.length)
)

export const KAY_GROUPS: PropGroupDef[] = [
  ...BORDER_TREES,
  ...KAY_BUSHES,
  ...KAY_SMALL_TREES,
  ...KAY_DEAD_TREES,
  ...KAY_STUMPS,
  ...KAY_FALLEN_LOGS,
  ...KAY_STICKS,
  ...KAY_GRASS,
]

// Every prop group on the battlefield, with its declared solidity. The scene
// renders RENDER_GROUPS (merged by path into one instanced draw call each)
// and only solid groups receive physics colliders.
export const ALL_PROTOS: PropGroupDef[] = [
  ...VILLAGE_PROPS,
  ...FARM_BUILDINGS,
  ...FARM_PROPS,
  ...POND_PROPS,
  ...MINE_PROPS,
  ...CAMP_PROPS,
  ...FOREST_EXTRAS,
  ...KAY_GROUPS,
  solid(M.house1, [HOUSES[0]]),
  solid(M.house2, [HOUSES[2], HOUSES[3]]),
  solid(M.house3, [HOUSES[1]]),
  passable(M.pine, FOREST_PINES),
  solid(DOCK_PATH, DOCK),
]

export const SOLID_PROTOS: PropGroupDef[] = ALL_PROTOS.filter(
  (group) => group.solid !== false
)

// Render groups: ALL_PROTOS merged by model path so each asset renders as a
// single instanced mesh set, regardless of how many logical groups use it.
export const RENDER_GROUPS: { path: string; spots: Placement[] }[] = (() => {
  const map = new Map<string, Placement[]>()
  for (const group of ALL_PROTOS) {
    const list = map.get(group.path) ?? []
    list.push(...group.spots)
    map.set(group.path, list)
  }
  return Array.from(map, ([path, spots]) => ({ path, spots }))
})()
