'use client'

import { useEffect, useRef, useState } from 'react'
import { loadMaps3D } from '@/lib/maps/loader'
import { mapRef } from '@/lib/maps/mapRef'

interface MapCanvasProps {
  coords?: { lat: number; lng: number }
  onReady?: () => void
}

export function MapCanvas({ coords, onReady }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const introStartedRef = useRef(false)
  const readyFiredRef = useRef(false)
  const onReadyRef = useRef(onReady)
  const coordsRef = useRef(coords)
  const [mapLoaded, setMapLoaded] = useState(false)

  onReadyRef.current = onReady
  coordsRef.current = coords

  const fireReady = () => {
    if (readyFiredRef.current) return
    readyFiredRef.current = true
    onReadyRef.current?.()
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    let isMounted = true
    let fallback: ReturnType<typeof setTimeout> | null = null

    const init = async () => {
      const { Map3DElement } = await loadMaps3D()
      if (!isMounted || !containerRef.current) return

      const map = new Map3DElement({
        center: { lat: 20, lng: 0, altitude: 0 },
        range: 22_000_000,
        tilt: 10,
        heading: 0,
        mode: 'HYBRID', // required — renders black without this
      })
      map.style.cssText = 'display:block;position:absolute;top:0;right:0;bottom:0;left:0;'
      containerRef.current.appendChild(map)
      mapRef.current = map

      const onTilesLoaded = () => {
        if (fallback) clearTimeout(fallback)
        setMapLoaded(true)
        if (isMounted && (!coordsRef.current || introStartedRef.current)) fireReady()
      }

      map.addEventListener('gmp-tilesloaded', onTilesLoaded, { once: true } as AddEventListenerOptions)
      fallback = setTimeout(() => {
        map.removeEventListener('gmp-tilesloaded', onTilesLoaded)
        setMapLoaded(true)
        if (isMounted && (!coordsRef.current || introStartedRef.current)) fireReady()
      }, 5_000)
    }

    init()
    return () => {
      isMounted = false
      if (fallback) clearTimeout(fallback)
      if (mapRef.current && containerRef.current?.contains(mapRef.current)) {
        containerRef.current.removeChild(mapRef.current)
      }
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fly-in when coords + map are both ready
  useEffect(() => {
    if (!coords || !mapRef.current || !mapLoaded || introStartedRef.current) return
    if (coords.lat === 0 && coords.lng === 0) return
    introStartedRef.current = true

    ;(async () => {
      try {
        await mapRef.current?.flyCameraTo({
          endCamera: {
            center: { lat: coords.lat, lng: coords.lng, altitude: 0 },
            tilt: 68,
            heading: 0,
            range: 900,
          },
          durationMillis: 3_500,
        })
        await mapRef.current?.flyCameraAround({
          camera: {
            center: { lat: coords.lat, lng: coords.lng, altitude: 0 },
            tilt: 67,
            heading: 360,
            range: 650,
          },
          durationMillis: 5_500,
          repeatCount: 1,
        })
      } catch {
        // interrupted — not fatal
      } finally {
        fireReady()
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, mapLoaded])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
