'use client'
import { useEffect, useRef } from 'react'
import { loadMaps3D } from '@/lib/maps/loader'

export function EarthGlobe() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let isMounted = true
    let mapEl: google.maps.maps3d.Map3DElement | null = null

    const init = async () => {
      const { Map3DElement } = await loadMaps3D()
      if (!isMounted || !containerRef.current) return

      mapEl = new Map3DElement({
        center: { lat: 20, lng: 10, altitude: 0 },
        range: 22_000_000, // 22,000 km — full Earth visible
        tilt: 12,
        heading: 0,
        mode: 'HYBRID', // required — renders black without this
      })
      mapEl.style.cssText = 'display:block;position:absolute;top:0;right:0;bottom:0;left:0;'
      containerRef.current.appendChild(mapEl)

      // Infinite slow orbit — 30s per full rotation
      mapEl.flyCameraAround({
        camera: { center: { lat: 20, lng: 10, altitude: 0 }, tilt: 12, heading: 0, range: 22_000_000 },
        durationMillis: 30_000,
        repeatCount: Infinity,
      }).catch(() => null)
    }

    init()
    return () => {
      isMounted = false
      if (mapEl && containerRef.current?.contains(mapEl)) {
        containerRef.current.removeChild(mapEl)
      }
      mapEl = null
    }
  }, [])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
