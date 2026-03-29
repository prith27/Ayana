'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import {
  navigateToLocation,
  flyInWithOrbit,
  orbit,
  stopAnimation,
  zoomIn,
  zoomOut,
  groundLevel,
  cityView,
  overviewPullback,
  tiltUp,
  tiltDown,
  flyToPlaceStreetView,
  registerSVEnter,
  registerSVExit,
} from '@/lib/maps/cameraControls'
import { JAPAN_CENTER, JAPAN_STOPS } from '@/lib/locations/japan'
import { StreetViewOverlay, type StreetViewOverlayHandle } from './StreetViewOverlay'
import { Sidebar } from './Sidebar'
import { GestureMapAdapter } from './GestureMapAdapter'
import type { GestureEngineState } from '@/lib/gesture/types'
import { CityOverlay, LETTER_MS, TAGLINE_DELAY_MS, HOLD_MS, EXIT_MS } from './CityOverlay'
import { resolveArrivalRange } from '@/lib/maps/smartRange'
import {
  registerSidebarSetters,
  reportSidebarError,
  reportSidebarResults,
  showCategorySidebar,
  hideSidebar,
  setAgentSpeaking,
  setAgentIdle,
  type SidebarData,
} from '@/lib/maps/sidebarControls'
import type { NearbyPlace, PlaceCategory } from '@/lib/places/nearbySearch'

// idx = -1 means "arrived at city view, no specific stop yet"
// idx = 0..4 means one of the 5 Japan stops

interface CameraWidgetProps {
  gestureState: GestureEngineState
}

export function CameraWidget({ gestureState }: CameraWidgetProps) {
  const [idx, setIdx] = useState(-1)
  const [inStreetView, setInStreetView] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [sidebarData, setSidebarData] = useState<SidebarData | null>(null)
  const [revealKey, setRevealKey] = useState<number | null>(null)
  const [revealName, setRevealName] = useState('')
  const [sidebarCategory, setSidebarCategory] = useState<PlaceCategory>('food')
  const [sidebarRequestId, setSidebarRequestId] = useState(0)
  const svRef = useRef<StreetViewOverlayHandle>(null)

  // Register singleton setters and Street View bridge once on mount
  useEffect(() => {
    registerSidebarSetters({
      setVisible: setSidebarVisible,
      setData: setSidebarData,
      setCategory: setSidebarCategory,
      setRequestId: setSidebarRequestId,
    })
    const enterStreetView = (lat: number, lng: number) =>
      svRef.current?.enter(lat, lng) ?? Promise.resolve()
    const exitStreetView = () => {
      svRef.current?.exit()
    }
    registerSVEnter(enterStreetView)
    registerSVExit(exitStreetView)
  }, [])

  const current = idx >= 0 ? JAPAN_STOPS[idx] : null
  const locationName = current ? current.name : 'Tokyo Overview'
  const currentLat = current ? current.lat : JAPAN_CENTER.lat
  const currentLng = current ? current.lng : JAPAN_CENTER.lng

  const go = async (newIdx: number) => {
    console.log('[widget] go() newIdx:', newIdx)
    if (newIdx < 0 || newIdx >= JAPAN_STOPS.length) {
      console.log('[widget] go() out of bounds, ignoring')
      return
    }
    setIdx(newIdx)
    const stop = JAPAN_STOPS[newIdx]

    // Auto-refresh sidebar if it's already open
    if (sidebarVisible) {
      setSidebarData({
        locationName: stop.name,
        locationSub: 'Tokyo, Japan',
        tags: [],
        sceneIndex: newIdx,
        sceneTotal: JAPAN_STOPS.length,
        lat: stop.lat,
        lng: stop.lng,
      })
    }

    const { range, tilt } = await resolveArrivalRange(
      stop.lat, stop.lng,
      stop.name,
      { range: stop.range, tilt: stop.tilt },
    )
    console.log('[widget] flying to', stop.name, 'range:', range, 'tilt:', tilt)
    await navigateToLocation(stop.lat, stop.lng, range, tilt)

    // Delay overlay 1s after landing so the landmark settles first
    await new Promise(r => setTimeout(r, 1_000))
    setRevealName(stop.name)
    setRevealKey(k => (k ?? 0) + 1)

    // Wait for overlay to fully finish, then orbit once slowly
    const overlayDuration = stop.name.length * LETTER_MS + TAGLINE_DELAY_MS + HOLD_MS + EXIT_MS
    await new Promise(r => setTimeout(r, overlayDuration))
    await orbit({ speed: 'slow' })
  }

  const enterStreetView = async () => {
    console.log('[widget] entering Street View at', locationName, currentLat, currentLng)
    await svRef.current?.enter(currentLat, currentLng)
    setInStreetView(true)
  }

  const handleSidebarPlacesReady = useCallback((
    requestId: number,
    category: PlaceCategory,
    data: SidebarData,
    places: NearbyPlace[]
  ) => {
    reportSidebarResults({ requestId, category, data, places })
  }, [])

  const handleSidebarPlacesError = useCallback((
    requestId: number,
    errorMessage: string
  ) => {
    reportSidebarError(requestId, errorMessage)
  }, [])

  const btn = (
    label: string,
    onClick: () => void,
    opts: { span2?: boolean; disabled?: boolean } = {}
  ) => (
    <button
      key={label}
      onClick={() => {
        console.log('[widget] button clicked:', label)
        onClick()
      }}
      disabled={opts.disabled}
      className={[
        opts.span2 ? 'col-span-2' : '',
        'px-3 py-2 rounded-lg text-[11px] tracking-wide uppercase cursor-pointer',
        'border border-white/10 bg-white/5 text-white/70 transition-all duration-150 active:scale-95',
        'hover:bg-white/15 hover:text-white',
        'disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:bg-white/5 disabled:hover:text-white/70',
      ].join(' ')}
    >
      {label}
    </button>
  )

  const counter = idx === -1
    ? 'City View'
    : `${idx + 1} / ${JAPAN_STOPS.length}`

  return (
    <>
      {/* Gesture map adapter — invisible, applies gesture state to map */}
      <GestureMapAdapter
        gestureState={gestureState}
        inStreetView={inStreetView}
        svRef={svRef}
      />

      <StreetViewOverlay
        ref={svRef}
        onExit={() => {
          console.log('[widget] Street View exited')
          setInStreetView(false)
        }}
      />

      <Sidebar
        visible={sidebarVisible}
        requestId={sidebarRequestId}
        data={sidebarData}
        category={sidebarCategory}
        onClose={() => hideSidebar()}
        onPlaceStreetView={(lat, lng) => {
          setInStreetView(true)
          flyToPlaceStreetView(lat, lng)
        }}
        onPlacesReady={handleSidebarPlacesReady}
        onPlacesError={handleSidebarPlacesError}
      />

      {!inStreetView && (
        <>
        {revealKey !== null && (
          <CityOverlay key={revealKey} cityName={revealName} />
        )}
        <div className="absolute bottom-8 left-8 z-10 select-none">
          <div className="bg-black/65 backdrop-blur-md border border-white/10 rounded-2xl p-4 w-52">

            <p className="text-white/40 text-[10px] tracking-widest uppercase mb-1">Location</p>
            <p className="text-white/90 text-sm font-light mb-4 truncate">{locationName}</p>

            <p className="text-white/30 text-[10px] tracking-widest uppercase mb-2">Navigate</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {btn('← Prev', () => go(idx - 1), { disabled: idx <= 0 })}
              {btn('Next →', () => go(idx + 1), { disabled: idx >= JAPAN_STOPS.length - 1 })}
              {btn('Fly In + Orbit', () => flyInWithOrbit(currentLat, currentLng), { span2: true })}
            </div>

            <p className="text-white/30 text-[10px] tracking-widest uppercase mb-2">View</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {btn('Ground',      () => groundLevel())}
              {btn('City',        () => cityView())}
              {btn('Overview',    () => overviewPullback())}
              {/* eslint-disable-next-line react-hooks/refs */}
              {btn('Street View', enterStreetView, { disabled: idx === -1 })}
            </div>

            <p className="text-white/30 text-[10px] tracking-widest uppercase mb-2">Camera</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {btn('Zoom In',  () => zoomIn())}
              {btn('Zoom Out', () => zoomOut())}
              {btn('Tilt ↑',   () => tiltUp())}
              {btn('Tilt ↓',   () => tiltDown())}
              {btn('Orbit',    () => orbit({ speed: 'slow' }))}
              {btn('Stop',     () => stopAnimation())}
            </div>

            <p className="text-white/30 text-[10px] tracking-widest uppercase mb-2">Sidebar</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {btn('Food', () => showCategorySidebar('food', {
                locationName: current?.name ?? 'Tokyo Overview',
                locationSub: 'Tokyo, Japan',
                tags: [], sceneIndex: Math.max(idx, 0), sceneTotal: JAPAN_STOPS.length,
                lat: currentLat, lng: currentLng,
              }), { disabled: idx === -1 })}
              {btn('Shop', () => showCategorySidebar('shopping', {
                locationName: current?.name ?? 'Tokyo Overview',
                locationSub: 'Tokyo, Japan',
                tags: [], sceneIndex: Math.max(idx, 0), sceneTotal: JAPAN_STOPS.length,
                lat: currentLat, lng: currentLng,
              }), { disabled: idx === -1 })}
              {btn('Activity', () => showCategorySidebar('activities', {
                locationName: current?.name ?? 'Tokyo Overview',
                locationSub: 'Tokyo, Japan',
                tags: [], sceneIndex: Math.max(idx, 0), sceneTotal: JAPAN_STOPS.length,
                lat: currentLat, lng: currentLng,
              }), { disabled: idx === -1 })}
              {btn('✕ Hide', () => hideSidebar())}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {btn('🟢', () => setAgentSpeaking())}
              {btn('⚪', () => setAgentIdle())}
            </div>

            <p className="mt-3 text-white/25 text-[10px] text-center">{counter}</p>
          </div>
        </div>
        </>
      )}
    </>
  )
}
