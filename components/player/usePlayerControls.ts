"use client"

import { useEffect, useRef, type RefObject } from "react"
import { type KeyState, type MovementKey } from "./player-config"

// MovementKey -> Physical keyboard code
const KEY_MAP: Record<string, MovementKey> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
}

const ALL_KEYS: MovementKey[] = ["forward", "back", "left", "right"]

// Keyboard input for the player. Returns a stable ref so the movement loop can
// read the key state in useFrame without re-rendering on every key press.
export function usePlayerControls(): RefObject<KeyState> {
  const keys = useRef<KeyState>({
    forward: false,
    back: false,
    left: false,
    right: false,
  })

  useEffect(() => {
    const setKey = (code: string, down: boolean): boolean => {
      const key = KEY_MAP[code]
      if (!key) return false
      keys.current[key] = down
      return true
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (setKey(e.code, true)) e.preventDefault()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (setKey(e.code, false)) e.preventDefault()
    }
    // Release stuck keys when the window loses focus (alt-tab) mid-press
    const clearKeys = () => {
      for (const key of ALL_KEYS) keys.current[key] = false
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", clearKeys)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", clearKeys)
      clearKeys()
    }
  }, [])

  return keys
}
