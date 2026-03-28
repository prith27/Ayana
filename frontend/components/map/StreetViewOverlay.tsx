'use client'

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { loadStreetView } from '@/lib/maps/loader'

export interface StreetViewOverlayHandle {
  enter: (lat: number, lng: number) => Promise<void>
  exit: () => void
  orbit: () => void
  // Gesture controls
  startGestureOrbit: () => void
  stopGestureOrbit:  () => void
  walkForward:       () => void
  walkBackward:      () => void
}

interface Props {
  onExit?: () => void
}

/** Smallest angle between two headings (0–360°) */
function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

export const StreetViewOverlay = forwardRef<StreetViewOverlayHandle, Props>(
  function StreetViewOverlay({ onExit }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null)
    const exitBtnRef = useRef<HTMLButtonElement>(null)
    const orbitBtnRef = useRef<HTMLButtonElement>(null)
    const orbitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const gestureOrbitRef  = useRef<ReturnType<typeof setInterval> | null>(null)
    const walkCooldownRef  = useRef<number>(0)
    const exitingRef = useRef(false)   // guard against the double-call loop
    const [visible, setVisible] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Keep stable refs so native listeners never go stale
    const exitFnRef = useRef<() => void>(() => {})
    const orbitFnRef = useRef<() => void>(() => {})

    function stopOrbit() {
      if (orbitIntervalRef.current !== null) {
        clearInterval(orbitIntervalRef.current)
        orbitIntervalRef.current = null
        console.log('[StreetView] orbit stopped')
      }
    }

    function startOrbit() {
      const pano = panoramaRef.current
      if (!pano) return
      stopOrbit() // cancel any running orbit first

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = pano as any
      const startHeading: number = p.getPov().heading
      const totalSteps = 200        // ~14 seconds at 70ms per step
      const stepDeg = 360 / totalSteps
      let step = 0

      console.log('[StreetView] orbit started from heading', startHeading)
      orbitIntervalRef.current = setInterval(() => {
        step++
        if (step > totalSteps) {
          stopOrbit()
          return
        }
        const pitch: number = p.getPov().pitch
        p.setPov({ heading: startHeading + step * stepDeg, pitch })
      }, 70)
    }

    orbitFnRef.current = startOrbit

    function exit() {
      if (exitingRef.current) {
        console.log('[StreetView] exit() already in progress, skipping')
        return
      }
      exitingRef.current = true
      console.log('[StreetView] exit() called')

      stopOrbit()

      // Google Maps StreetViewPanorama injects elements at document.body level,
      // not only inside our container div. Hiding the container alone doesn't
      // remove those elements. Destroying the container's DOM and nulling the
      // ref forces a full teardown and recreation on next entry.
      if (panoramaRef.current) {
        panoramaRef.current.setVisible(false)
        panoramaRef.current = null
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }

      setVisible(false)
      setError(null)
      onExit?.()

      // Reset guard after React commits the update
      setTimeout(() => { exitingRef.current = false }, 200)
    }

    exitFnRef.current = exit

    // Attach native pointerdown listener in CAPTURE phase.
    // Google Maps registers document-level handlers that swallow clicks before
    // React's synthetic events fire. Capture phase runs first, so this always
    // wins regardless of what Maps does below us.
    useEffect(() => {
      const btn = exitBtnRef.current
      if (!btn) return
      const handler = (e: PointerEvent) => {
        console.log('[StreetView] exit button native pointerdown fired')
        e.stopImmediatePropagation()
        e.preventDefault()
        exitFnRef.current()
      }
      btn.addEventListener('pointerdown', handler, { capture: true })
      return () => btn.removeEventListener('pointerdown', handler, { capture: true })
    }, [visible]) // re-bind whenever button mounts/unmounts

    useEffect(() => {
      const btn = orbitBtnRef.current
      if (!btn) return
      const handler = (e: PointerEvent) => {
        console.log('[StreetView] orbit button native pointerdown fired')
        e.stopImmediatePropagation()
        e.preventDefault()
        orbitFnRef.current()
      }
      btn.addEventListener('pointerdown', handler, { capture: true })
      return () => btn.removeEventListener('pointerdown', handler, { capture: true })
    }, [visible]) // re-bind whenever button mounts/unmounts

    useImperativeHandle(ref, () => ({
      async enter(lat: number, lng: number) {
        console.log('[StreetView] enter() called at', lat, lng)
        setError(null)

        const { StreetViewPanorama, StreetViewService } = await loadStreetView()
        const service = new StreetViewService()

        let data: google.maps.StreetViewPanoramaData | null = null
        try {
          const response = await service.getPanorama({
            location: { lat, lng },
            radius: 100,
            sources: ['google'],
          })
          data = response.data
          console.log('[StreetView] coverage found, pano id:', data?.location?.pano)
        } catch (err) {
          console.log('[StreetView] ZERO_RESULTS — no coverage within 100m', err)
          setError('No Street View coverage at this location')
          setVisible(true)
          return
        }

        if (!containerRef.current) return

        // panoramaRef is always null here because exit() nulls it on teardown.
        // We always create a fresh instance so body-level Maps elements are clean.
        console.log('[StreetView] creating new StreetViewPanorama')
        panoramaRef.current = new StreetViewPanorama(containerRef.current, {
          position: { lat, lng },
          pov: { heading: 34, pitch: 10 },
          disableDefaultUI: false,
          clickToGo: true,
          showRoadLabels: true,
        })
        panoramaRef.current.addListener('visible_changed', () => {
          if (!panoramaRef.current?.getVisible()) {
            console.log('[StreetView] visible_changed → false, calling exit')
            exitFnRef.current()
          }
        })

        if (data?.location?.pano) {
          panoramaRef.current.setPano(data.location.pano)
        }

        setVisible(true)
        console.log('[StreetView] overlay visible')

        // Auto-orbit once after a short delay so the panorama has time to render
        setTimeout(() => { orbitFnRef.current() }, 800)
      },

      exit() {
        console.log('[StreetView] exit() called via ref')
        exitFnRef.current()
      },

      orbit() {
        console.log('[StreetView] orbit() called via ref')
        orbitFnRef.current()
      },

      startGestureOrbit() {
        const pano = panoramaRef.current
        if (!pano) return
        if (gestureOrbitRef.current !== null) return   // already running
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = pano as any
        gestureOrbitRef.current = setInterval(() => {
          const pov = p.getPov()
          p.setPov({ heading: pov.heading + 3, pitch: pov.pitch })
        }, 50)
      },

      stopGestureOrbit() {
        if (gestureOrbitRef.current !== null) {
          clearInterval(gestureOrbitRef.current)
          gestureOrbitRef.current = null
        }
      },

      walkForward() {
        const pano = panoramaRef.current
        if (!pano) return
        const now = Date.now()
        if (now - walkCooldownRef.current < 800) return
        walkCooldownRef.current = now
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = pano as any
        const links: { heading: number; pano: string }[] = p.getLinks() ?? []
        if (links.length === 0) return
        const currentHeading: number = p.getPov().heading
        // Find link closest to current heading
        const best = links.reduce((a, b) =>
          angleDiff(b.heading, currentHeading) < angleDiff(a.heading, currentHeading) ? b : a
        )
        p.setPano(best.pano)
      },

      walkBackward() {
        const pano = panoramaRef.current
        if (!pano) return
        const now = Date.now()
        if (now - walkCooldownRef.current < 800) return
        walkCooldownRef.current = now
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = pano as any
        const links: { heading: number; pano: string }[] = p.getLinks() ?? []
        if (links.length === 0) return
        const currentHeading: number = p.getPov().heading
        // Find link OPPOSITE to current heading
        const opposite = (currentHeading + 180) % 360
        const best = links.reduce((a, b) =>
          angleDiff(b.heading, opposite) < angleDiff(a.heading, opposite) ? b : a
        )
        p.setPano(best.pano)
      },
    }))

    return (
      <>
        {/* Panorama container — Street View renders here */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: visible || error ? 'block' : 'none',
          }}
        >
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center space-y-3">
                <p className="text-white/60 text-sm">{error}</p>
                <button
                  onClick={() => {
                    console.log('[StreetView] Back to Map clicked (error state)')
                    exit()
                  }}
                  className="px-4 py-2 rounded-full text-xs text-white/60 border border-white/20 hover:text-white hover:border-white/40 transition-all cursor-pointer"
                >
                  Back to Map
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Buttons rendered OUTSIDE the panorama container so they get
            their own stacking context. Native pointerdown capture handlers
            fire before Google Maps' document-level event interceptors. */}
        {visible && !error && (
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 9999, display: 'flex', gap: 8 }}>
            <button
              ref={orbitBtnRef}
              className="px-4 py-2 rounded-full text-xs text-white/80 bg-black/60 border border-white/20 hover:bg-black/80 backdrop-blur-sm transition-all cursor-pointer"
            >
              ↻ Orbit
            </button>
            <button
              ref={exitBtnRef}
              className="px-4 py-2 rounded-full text-xs text-white/80 bg-black/60 border border-white/20 hover:bg-black/80 backdrop-blur-sm transition-all cursor-pointer"
            >
              ✕ Exit Street View
            </button>
          </div>
        )}
      </>
    )
  }
)
