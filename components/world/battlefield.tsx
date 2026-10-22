"use client"

import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier"
import { CharacterSpawn } from "../player/character-spawn"
import { AssetModel, SolidRigidBody } from "./asset-model"
import { RENDER_GROUPS, SOLID_PROTOS } from "./battlefield-placements.ts"
import { Terrain } from "./terrain"

// Renders every battlefield prop as one instanced mesh set per model path and
// generates fixed colliders for each group declared solid.
function Props() {
  return (
    <>
      {RENDER_GROUPS.map((group) => (
        <AssetModel
          key={group.path}
          path={group.path}
          placements={group.spots}
        />
      ))}

      {SOLID_PROTOS.map((group, i) => (
        <SolidRigidBody key={i} path={group.path} spots={group.spots} />
      ))}
    </>
  )
}

export function Battlefield() {
  return (
    <Physics gravity={[0, -9.81, 0]}>
      {/* Flat ground collider matching the terrain surface */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[95, 1, 95]} position={[0, -1, 0]} />
      </RigidBody>

      {/* Island and shoreline */}
      <Terrain />

      <Props />

      <CharacterSpawn position={[0, 0, 0]} />
    </Physics>
  )
}
