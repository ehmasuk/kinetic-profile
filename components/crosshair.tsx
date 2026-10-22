"use client"

import { useEffect, useRef } from "react"
import { shootRequests } from "./player-state"

const DRAG_TOLERANCE = 6 // px; moving further turns the click into a camera drag
const TAP_MAX_MS = 350

// Vertical placement as a fraction of screen height (0 = very top). Raising the
// crosshair above center lets the player aim at targets ahead of the character;
// CharacterSpawn reads this to align the tracer with the same screen point.
export const CROSSHAIR_Y = 0.3

// Screen-center crosshair. Also converts plain left-clicks/taps (not drags)
// into shoot requests.
export function Crosshair() {
  const down = useRef<{
    x: number
    y: number
    t: number
    moved: boolean
  } | null>(null)

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      down.current = {
        x: event.clientX,
        y: event.clientY,
        t: performance.now(),
        moved: false,
      }
    }
    const onMove = (event: PointerEvent) => {
      const d = down.current
      if (!d || d.moved) return
      if (Math.abs(event.clientX - d.x) > DRAG_TOLERANCE) d.moved = true
      else if (Math.abs(event.clientY - d.y) > DRAG_TOLERANCE) d.moved = true
    }
    const onUp = (event: PointerEvent) => {
      const d = down.current
      down.current = null
      if (!d || d.moved) return
      if (event.button !== 0) return
      if (performance.now() - d.t > TAP_MAX_MS) return
      shootRequests.count++
    }
    window.addEventListener("pointerdown", onDown)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-start justify-center">
      <svg
        style={{ marginTop: `${CROSSHAIR_Y * 100}vh` }}
        width="34"
        height="34"
        viewBox="0 0 34 34"
        className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
      >
        <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.95">
          <line x1="17" y1="2" x2="17" y2="9" />
          <line x1="17" y1="25" x2="17" y2="32" />
          <line x1="2" y1="17" x2="9" y2="17" />
          <line x1="25" y1="17" x2="32" y2="17" />
        </g>
        <circle cx="17" cy="17" r="1.6" fill="#ffffff" />
        <circle
          cx="17"
          cy="17"
          r="9"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1"
          opacity="0.35"
        />
      </svg>
    </div>
  )
}
