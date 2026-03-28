'use client'

import { useEffect, useRef, useState } from 'react'
import { GestureEngine } from '@/lib/gesture/engine'
import type { GestureEngineState } from '@/lib/gesture/types'

const INITIAL_STATE: GestureEngineState = {
  cameraState:        'idle',
  trackingState:      'no-hand',
  modelState:         'uninitialized',
  gestureMode:        'off',
  activeGesture:      'none',
  stableGestureId:    null,
  stableGestureLabel: null,
}

export function useGestureEngine() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const engineRef = useRef<GestureEngine | null>(null)
  const [gestureState, setGestureState] = useState<GestureEngineState>(INITIAL_STATE)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const engine = new GestureEngine()
    engineRef.current = engine

    const unsub = engine.onStateChange(setGestureState)

    // Defer init slightly so the video element has mounted
    const t = setTimeout(async () => {
      if (videoRef.current) {
        await engine.init(videoRef.current)
      }
    }, 200)

    return () => {
      clearTimeout(t)
      unsub()
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  return { videoRef, gestureState }
}
