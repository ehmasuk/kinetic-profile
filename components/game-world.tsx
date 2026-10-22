"use client"

import { Canvas } from "@react-three/fiber"
import { Suspense } from "react"
import { FollowCamera } from "./camera/follow-camera"
import { LoadingScreen } from "./loading-screen"
import { Battlefield } from "./world/battlefield"

export default function GameWorld() {
  return (
    <div className="relative h-screen w-full bg-sky-200">
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-full bg-black/45 px-4 py-2 text-xs font-medium tracking-wide text-white/95 backdrop-blur-sm select-none">
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
