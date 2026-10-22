"use client"

import { useCallback, useEffect, useRef, type RefObject } from "react"
import { useAnimations } from "@react-three/drei"
import * as THREE from "three"
import { ANIM_FADE, IDLE_CLIPS, RUN_CLIPS } from "./player-config"

// Picks the first candidate clip that actually exists in the GLB, falling back
// to the first available action so a re-exported model never breaks loading.
// Returns null when the model has no actions at all.
function resolveAction(
  actions: Record<string, THREE.AnimationAction | null>,
  candidates: string[]
): THREE.AnimationAction | null {
  for (const name of candidates) {
    const action = actions[name]
    if (action) return action
  }
  return Object.values(actions)[0] ?? null
}

type CharacterAnimationControl = {
  actions: Record<string, THREE.AnimationAction | null>
  mixer: THREE.AnimationMixer
  // Advance the mixer once per frame and crossfade between idle/run as needed.
  // drei's useAnimations does not auto-update the mixer, so this single call is
  // the only place the mixer is advanced.
  update: (delta: number, running: boolean) => void
}

// Idle/running animation handling for the player model.
export function useCharacterAnimations(
  clips: THREE.AnimationClip[],
  target: RefObject<THREE.Object3D | null>
): CharacterAnimationControl {
  const { actions, mixer } = useAnimations(clips, target)
  const mode = useRef<"idle" | "run">("idle")

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[player] animation clips:", Object.keys(actions))
    }
    const idle = resolveAction(actions, IDLE_CLIPS)
    idle?.reset().play()
    mode.current = "idle"
    return () => {
      mixer.stopAllAction()
    }
  }, [actions, mixer])

  const update = useCallback(
    (delta: number, running: boolean) => {
      mixer.update(delta)

      if (running !== (mode.current === "run")) {
        const next = resolveAction(actions, running ? RUN_CLIPS : IDLE_CLIPS)
        const current = resolveAction(actions, running ? IDLE_CLIPS : RUN_CLIPS)
        if (next) {
          current?.fadeOut(ANIM_FADE)
          next.reset().fadeIn(ANIM_FADE).play()
          mode.current = running ? "run" : "idle"
        }
      }
    },
    [actions, mixer]
  )

  return { actions, mixer, update }
}
