'use client'

/**
 * GestureMapAdapter — invisible component that applies gesture state to the map.
 *
 * Zoom (3D map):
 *   zoom-in  (Thumbs Up):  rAF loop multiplying map.range by ZOOM_IN_FACTOR each frame
 *   zoom-out (Open Palm):  rAF loop multiplying map.range by ZOOM_OUT_FACTOR each frame
 *   Direct map.range assignment (no animation) for smooth frame-by-frame feel.
 *
 * Orbit (Fist, 3D map):
 *   flyCameraAround using CURRENT map position — re-enter does not reset camera.
 *   Stops when gesture is dropped.
 *
 * Street View adapts automatically:
 *   zoom-in  → walkForward  (with cooldown)
 *   zoom-out → walkBackward (with cooldown)
 *   orbit    → spin panorama heading
 */

import { useEffect, useRef } from 'react'
import { mapRef } from '@/lib/maps/mapRef'
import { MAP_RANGE_MIN, MAP_RANGE_MAX, THRESHOLDS } from '@/lib/gesture/config'
import type { GestureEngineState } from '@/lib/gesture/types'
import type { StreetViewOverlayHandle } from './StreetViewOverlay'

interface Props {
  gestureState: GestureEngineState
  inStreetView: boolean
  svRef:        React.RefObject<StreetViewOverlayHandle | null>
}

export function GestureMapAdapter({ gestureState, inStreetView, svRef }: Props) {
  const orbitActive   = useRef(false)
  const svOrbitActive = useRef(false)
  const svWalkLastMs  = useRef(0)

  // ── Continuous zoom via rAF ─────────────────────────────────────────────────

  useEffect(() => {
    const { activeGesture, gestureMode } = gestureState
    if (gestureMode === 'off') return
    if (activeGesture !== 'zoom-in' && activeGesture !== 'zoom-out') return

    const factor = activeGesture === 'zoom-in'
      ? THRESHOLDS.zoomInFactor
      : THRESHOLDS.zoomOutFactor

    let rafId: number

    const tick = () => {
      if (!inStreetView) {
        // 3D map — adjust range directly
        const map = mapRef.current
        if (map) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const m = map as any
          const current: number = m.range ?? 1_000
          const next = Math.max(MAP_RANGE_MIN, Math.min(MAP_RANGE_MAX, current * factor))
          m.range = next
        }
      } else {
        // Street View — walk with cooldown
        const now = Date.now()
        if (now - svWalkLastMs.current >= THRESHOLDS.svWalkCooldownMs) {
          svWalkLastMs.current = now
          if (activeGesture === 'zoom-in') {
            svRef.current?.walkForward()
          } else {
            svRef.current?.walkBackward()
          }
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [gestureState.activeGesture, gestureState.gestureMode, inStreetView, svRef])

  // ── Orbit ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const { activeGesture, gestureMode } = gestureState
    if (gestureMode === 'off') {
      // Tear down if mode turned off mid-orbit
      if (orbitActive.current)   { mapRef.current?.stopCameraAnimation(); orbitActive.current = false }
      if (svOrbitActive.current) { svRef.current?.stopGestureOrbit();     svOrbitActive.current = false }
      return
    }

    if (activeGesture === 'orbit') {
      if (!inStreetView) {
        if (!orbitActive.current) {
          const map = mapRef.current
          if (map) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m = map as any
            // Use current position so re-entering orbit doesn't reset the camera
            const center   = m.center   ?? { lat: 35.6762, lng: 139.6503, altitude: 0 }
            const range    = m.range    ?? 2_000
            const tilt     = m.tilt     ?? 45
            const heading  = m.heading  ?? 0
            map.flyCameraAround({
              camera: { center, tilt, heading, range },
              durationMillis: 20_000,
              repeatCount: 999,
            }).catch(() => null)
            orbitActive.current = true
          }
        }
      } else {
        if (!svOrbitActive.current) {
          svRef.current?.startGestureOrbit()
          svOrbitActive.current = true
        }
      }
    } else {
      // Gesture dropped — stop orbit
      if (orbitActive.current)   { mapRef.current?.stopCameraAnimation(); orbitActive.current = false }
      if (svOrbitActive.current) { svRef.current?.stopGestureOrbit();     svOrbitActive.current = false }
    }
  }, [gestureState.activeGesture, gestureState.gestureMode, inStreetView, svRef])

  return null
}
