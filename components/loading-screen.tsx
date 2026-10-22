"use client"

import { useEffect, useRef, useState } from "react"
import { useProgress } from "@react-three/drei"
import Loader from "@/components/ui/box-loader"

export function LoadingScreen() {
  const { active, progress } = useProgress()
  const [ready, setReady] = useState(false)
  const hasLoadedSomething = useRef(false)
  const settleTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (active) hasLoadedSomething.current = true
  }, [active])

  // Latch the overlay until assets have settled: progress hitting 100 only
  // removes it after a short pause, so between-loads gaps cannot flash the
  // scene underneath.
  useEffect(() => {
    if (!hasLoadedSomething.current || active || progress < 100) {
      window.clearTimeout(settleTimer.current)
      return
    }
    settleTimer.current = window.setTimeout(() => setReady(true), 400)
    return () => window.clearTimeout(settleTimer.current)
  }, [active, progress])

  // Fallback for a fully-cached first load, where nothing ever registers as
  // active and progress stays at 0.
  useEffect(() => {
    if (hasLoadedSomething.current) return
    const t = window.setTimeout(() => setReady(true), 2000)
    return () => window.clearTimeout(t)
  }, [])

  if (ready) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
      <Loader />
    </div>
  )
}
