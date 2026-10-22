# threegame

A 3D island battlefield game built with Next.js 16, React Three Fiber, Rapier physics, and drei.

- Walk the island with **WASD** / **Arrow keys**; drag the mouse to orbit the camera.
- The whole battlefield (village, farm, mine, camp, forest) is data-driven from
  `components/world/battlefield-placements.ts`; props render as instanced meshes and solid props get auto-generated physics colliders.

## Structure

```
app/            Next.js app (layout, page, global styles)
components/
  world/        Terrain generation, battlefield placement data, instanced prop rendering
  player/       Character controller: physics body, input, movement, animations
  camera/       Third-person follow camera with drag orbit
  ui/           shadcn/ui primitives
lib/            Shared pure helpers (2D geometry, model baking)
scripts/        check-placements: validates every prop footprint sits inside the island
```

## Commands

```bash
pnpm dev            # start dev server
pnpm build          # production build
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit
node --experimental-transform-types scripts/check-placements.ts
```
