'use client'

import { useEffect, useRef, useState } from 'react'
import {
  cityView,
  flyInWithOrbit,
  flyToPlaceStreetView,
  groundLevel,
  orbit,
  overviewPullback,
  registerSVEnter,
  stopAnimation,
  tiltDown,
  tiltUp,
  zoomIn,
  zoomOut,
} from '@/lib/maps/cameraControls'
import { StreetViewOverlay, type StreetViewOverlayHandle } from './StreetViewOverlay'
import { Sidebar } from './Sidebar'
import { GestureMapAdapter } from './GestureMapAdapter'
import type { GestureEngineState } from '@/lib/gesture/types'
import type { AyanaPrepItinerary } from '@/lib/ayana/prep'
import {
  OVERLAY_PRESET_OPTIONS,
  type OverlayPreset,
} from '@/lib/ayana/runtime'
import {
  hideSidebar,
  registerSidebarSetters,
  setAgentIdle,
  setAgentSpeaking,
  showCategorySidebar,
  type SidebarData,
} from '@/lib/maps/sidebarControls'
import type { PlaceCategory } from '@/lib/places/nearbySearch'

interface RuntimeLocation {
  locationName: string
  locationSub: string
  lat: number
  lng: number
  sceneIndex: number
  sceneTotal: number
}

interface AyanaRuntimeWidgetProps {
  gestureState: GestureEngineState
  itinerary: AyanaPrepItinerary | null
  currentLocation: RuntimeLocation | null
  landmarkInput: string
  onLandmarkInputChange: (value: string) => void
  selectedPreset: OverlayPreset
  onPresetChange: (value: OverlayPreset) => void
  onLandmarkSubmit: () => void
  landmarkBusy: boolean
  landmarkError: string | null
}

export function AyanaRuntimeWidget({
  gestureState,
  itinerary,
  currentLocation,
  landmarkInput,
  onLandmarkInputChange,
  selectedPreset,
  onPresetChange,
  onLandmarkSubmit,
  landmarkBusy,
  landmarkError,
}: AyanaRuntimeWidgetProps) {
  const [inStreetView, setInStreetView] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [sidebarData, setSidebarData] = useState<SidebarData | null>(null)
  const [sidebarCategory, setSidebarCategory] = useState<PlaceCategory>('food')
  const svRef = useRef<StreetViewOverlayHandle>(null)

  useEffect(() => {
    registerSidebarSetters({
      setVisible: setSidebarVisible,
      setData: setSidebarData,
      setCategory: setSidebarCategory,
    })
    const enterStreetView = (lat: number, lng: number) =>
      svRef.current?.enter(lat, lng) ?? Promise.resolve()
    registerSVEnter(enterStreetView)
  }, [])

  const btn = (
    label: string,
    onClick: () => void,
    opts: { span2?: boolean; disabled?: boolean } = {}
  ) => (
    <button
      key={label}
      onClick={() => {
        console.log('[ayana-widget] button clicked:', label)
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
      type="button"
    >
      {label}
    </button>
  )

  const sidebarLocationData: SidebarData | null = currentLocation
    ? {
        locationName: currentLocation.locationName,
        locationSub: currentLocation.locationSub,
        tags: [],
        sceneIndex: currentLocation.sceneIndex,
        sceneTotal: currentLocation.sceneTotal,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
      }
    : null

  const enterStreetView = async () => {
    if (!currentLocation) return
    console.log(
      '[ayana-widget] entering Street View at',
      currentLocation.locationName,
      currentLocation.lat,
      currentLocation.lng
    )
    await svRef.current?.enter(currentLocation.lat, currentLocation.lng)
    setInStreetView(true)
  }

  return (
    <>
      <GestureMapAdapter
        gestureState={gestureState}
        inStreetView={inStreetView}
        svRef={svRef}
      />

      <StreetViewOverlay
        ref={svRef}
        onExit={() => {
          console.log('[ayana-widget] Street View exited')
          setInStreetView(false)
        }}
      />

      <Sidebar
        visible={sidebarVisible}
        data={sidebarData}
        category={sidebarCategory}
        onClose={() => setSidebarVisible(false)}
        onPlaceStreetView={(lat, lng) => {
          setInStreetView(true)
          void flyToPlaceStreetView(lat, lng)
        }}
      />

      {!inStreetView && (
        <div className="absolute bottom-8 left-8 z-10 select-none">
          <div className="bg-black/65 backdrop-blur-md border border-white/10 rounded-2xl p-4 w-72">
            <p className="text-white/40 text-[10px] tracking-widest uppercase mb-1">Location</p>
            <p className="text-white/90 text-sm font-light truncate">
              {currentLocation?.locationName ?? itinerary?.city_name ?? 'Awaiting journey'}
            </p>
            <p className="text-white/35 text-[11px] mt-1 mb-4 truncate">
              {currentLocation?.locationSub ?? (itinerary ? `${itinerary.city_name}, ${itinerary.country_name}` : 'Select an itinerary to begin')}
            </p>

            <p className="text-white/30 text-[10px] tracking-widest uppercase mb-2">Landmark</p>
            <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
              <input
                value={landmarkInput}
                onChange={(event) => onLandmarkInputChange(event.target.value)}
                placeholder="Enter landmark"
                disabled={!itinerary || landmarkBusy}
                className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80 outline-none placeholder:text-white/25 focus:border-white/20"
              />
              <button
                type="button"
                onClick={onLandmarkSubmit}
                disabled={!itinerary || landmarkBusy || !landmarkInput.trim()}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] tracking-wide uppercase text-white/70 transition-all duration-150 active:scale-95 hover:bg-white/15 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:bg-white/5 disabled:hover:text-white/70"
              >
                {landmarkBusy ? '...' : 'Go'}
              </button>
            </div>
            <div className="mb-2">
              <select
                value={selectedPreset}
                onChange={(event) => onPresetChange(event.target.value as OverlayPreset)}
                disabled={!itinerary || landmarkBusy}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-wide text-white/80 outline-none focus:border-white/20"
              >
                {OVERLAY_PRESET_OPTIONS.map((preset) => (
                  <option
                    key={preset}
                    value={preset}
                    className="bg-[#0b0b13] text-white"
                  >
                    {preset}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-white/25 text-[10px] leading-relaxed mb-4 min-h-[28px]">
              {landmarkError ??
                (itinerary
                  ? `Testing within ${itinerary.city_name}. Any landmark string will be grounded to this city.`
                  : 'Select a generated itinerary to unlock landmark testing.')}
            </p>

            <p className="text-white/30 text-[10px] tracking-widest uppercase mb-2">Navigate</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {btn('Fly In + Orbit', () => {
                if (!currentLocation) return
                void flyInWithOrbit(currentLocation.lat, currentLocation.lng)
              }, { span2: true, disabled: !currentLocation })}
            </div>

            <p className="text-white/30 text-[10px] tracking-widest uppercase mb-2">View</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {btn('Ground', () => { void groundLevel() })}
              {btn('City', () => { void cityView() })}
              {btn('Overview', () => { void overviewPullback() })}
              {/* eslint-disable-next-line react-hooks/refs */}
              {btn('Street View', () => { void enterStreetView() }, { disabled: !currentLocation })}
            </div>

            <p className="text-white/30 text-[10px] tracking-widest uppercase mb-2">Camera</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {btn('Zoom In', () => { void zoomIn() })}
              {btn('Zoom Out', () => { void zoomOut() })}
              {btn('Tilt ↑', () => { void tiltUp() })}
              {btn('Tilt ↓', () => { void tiltDown() })}
              {btn('Orbit', () => { void orbit({ speed: 'slow' }) })}
              {btn('Stop', () => stopAnimation())}
            </div>

            <p className="text-white/30 text-[10px] tracking-widest uppercase mb-2">Sidebar</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {btn('Food', () => {
                if (!sidebarLocationData) return
                showCategorySidebar('food', sidebarLocationData)
              }, { disabled: !sidebarLocationData })}
              {btn('Shop', () => {
                if (!sidebarLocationData) return
                showCategorySidebar('shopping', sidebarLocationData)
              }, { disabled: !sidebarLocationData })}
              {btn('Activity', () => {
                if (!sidebarLocationData) return
                showCategorySidebar('activities', sidebarLocationData)
              }, { disabled: !sidebarLocationData })}
              {btn('✕ Hide', () => hideSidebar())}
            </div>

            <div className="grid grid-cols-2 gap-1">
              {btn('🟢', () => setAgentSpeaking())}
              {btn('⚪', () => setAgentIdle())}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
