'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { loadMaps3D } from '@/lib/maps/loader'
import { mapRef } from '@/lib/maps/mapRef'
import { LiveAgentSession } from '@/components/live-agent/LiveAgentSession'
import {
  forwardAudioInput,
  requestMicrophoneStream,
  resumeAudioContext,
  startAudioPlayerWorklet,
  startAudioRecorderWorklet,
  stopAudioPlayer,
  stopAudioRecorder,
  type AudioPlayerResources,
  type AudioRecorderResources,
} from '@/lib/live-agent/audio'
import { AgentStatusNotch } from '@/components/map/AgentStatusNotch'
import { ItinerarySelection } from '@/components/map/ItinerarySelection'
import { useGestureEngine } from '@/hooks/useGestureEngine'
import { ControlNotch } from '@/components/map/ControlNotch'
import { MicNotch } from '@/components/map/MicNotch'
import { useAgentState } from '@/hooks/useAgentState'
import {
  fetchAyanaPrep,
  PERSONA_META,
  type AyanaPrepItinerary,
  type AyanaPrepResponse,
  type Persona,
} from '@/lib/ayana/prep'
import { initTranscript } from '@/lib/ayana/transcript'
import { PrepLoadingOverlay } from '@/components/map/PrepLoadingOverlay'
import { GeneratedItineraryOverlay } from '@/components/map/GeneratedItineraryOverlay'
import { CityOverlay } from '@/components/map/CityOverlay'
import { AyanaRuntimeWidget } from '@/components/map/AyanaRuntimeWidget'
import {
  activateCity,
  activateLandmark,
  openPlaceStreetView,
  showNearby,
  type CityActivationInput,
  type LandmarkActivationInput,
  type LandmarkActivationResult,
  type OpenPlaceStreetViewResult,
  type OverlayPreset,
  type ShowNearbyResult,
} from '@/lib/ayana/runtime'
import type { PlaceCategory } from '@/lib/places/nearbySearch'
import type { SidebarData } from '@/lib/maps/sidebarControls'

type Stage =
  | 'selectingPersona'
  | 'prepLoading'
  | 'connectingSession'
  | 'selectingGeneratedItinerary'
  | 'runtimePrimed'
const LIVE_AGENT_ENABLED = process.env.NEXT_PUBLIC_ENABLE_LIVE_AGENT === 'true'
const DEFAULT_CITY_OVERLAY_PRESET: OverlayPreset = 'modern-minimal'
const ITINERARY_OVERLAY_REVEAL_DELAY_MS = 5_000
// Set to 'HYBRID' to re-enable country/city/road labels on the globe
const GLOBE_MAP_MODE: 'SATELLITE' | 'HYBRID' = 'SATELLITE'

interface ChooseItineraryExecutionRequest {
  itineraryId: string
  overlayPreset: OverlayPreset
  tagline: string
}

interface ChooseItineraryExecutionResult {
  itineraryId: string
  cityName: string
  countryName: string
}

interface MoveToLandmarkExecutionRequest {
  landmarkName: string
  overlayPreset: OverlayPreset
  tagline: string
}

interface ShowNearbyExecutionRequest {
  category: PlaceCategory
}

interface OpenPlaceStreetViewExecutionRequest {
  placeName: string
}

function PersonaBadge({ type, visible }: { type: Persona; visible: boolean }) {
  const { label, accent, borderAlpha } = PERSONA_META[type]
  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 13px 7px 10px',
        background: 'rgba(4,4,12,0.6)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${borderAlpha}`,
        borderRadius: '3px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)',
        pointerEvents: 'none',
      }}
    >
      {/* Diamond mark */}
      <div style={{
        width: '5px',
        height: '5px',
        background: accent,
        transform: 'rotate(45deg)',
        opacity: 0.75,
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: '"SF Mono", "Fira Code", monospace',
        fontSize: '10px',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: accent,
        opacity: 0.82,
      }}>
        {label}
      </span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const { videoRef, gestureState } = useGestureEngine()
  const agentState = useAgentState()

  const [stage, setStage] = useState<Stage>('selectingPersona')
  const [persona, setPersona] = useState<Persona | null>(null)
  const [prepResponse, setPrepResponse] = useState<AyanaPrepResponse | null>(null)
  const [selectedGeneratedItineraryId, setSelectedGeneratedItineraryId] = useState<string | null>(null)
  const [activatingItineraryId, setActivatingItineraryId] = useState<string | null>(null)
  const [generatedOverlayExiting, setGeneratedOverlayExiting] = useState(false)
  const [micMuted, setMicMuted] = useState(true)
  const [landmarkInput, setLandmarkInput] = useState('')
  const [landmarkPreset, setLandmarkPreset] = useState<OverlayPreset>(DEFAULT_CITY_OVERLAY_PRESET)
  const [landmarkPending, setLandmarkPending] = useState(false)
  const [prepError, setPrepError] = useState<string | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [landmarkError, setLandmarkError] = useState<string | null>(null)
  const [loadingCueVisible, setLoadingCueVisible] = useState(false)
  const [audioPlayerResources, setAudioPlayerResources] =
    useState<AudioPlayerResources | null>(null)
  const [cityOverlay, setCityOverlay] = useState<{
    key: number
    cityName: string
    preset: OverlayPreset
    tagline: string
  } | null>(null)
  const [currentRuntimeLocation, setCurrentRuntimeLocation] = useState<{
    locationName: string
    locationSub: string
    lat: number
    lng: number
    sceneIndex: number
    sceneTotal: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInitRef = useRef(false)
  const audioRecorderRef = useRef<AudioRecorderResources | null>(null)
  const audioPlayerRef = useRef<AudioPlayerResources | null>(null)
  const itineraryRevealTimerRef = useRef<number | null>(null)

  // Mount Map3DElement once — runs immediately, map loads while user picks itinerary
  // Hide the Google Maps alpha channel warning banner
  useEffect(() => {
    const hide = () => {
      document.querySelectorAll('div').forEach(el => {
        if (el.textContent?.includes('alpha channel') && el.children.length < 5) {
          el.style.display = 'none'
        }
      })
    }
    const observer = new MutationObserver(hide)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || mapInitRef.current) return
    mapInitRef.current = true
    let isMounted = true

    const init = async () => {
      const { Map3DElement } = await loadMaps3D()
      if (!isMounted || !containerRef.current) return

      const map = new Map3DElement({
        center: { lat: 20, lng: 10, altitude: 0 },
        range: 22_000_000,
        tilt: 12,
        heading: 0,
        mode: GLOBE_MAP_MODE,
      })
      map.style.cssText = 'display:block;position:absolute;top:0;right:0;bottom:0;left:0;'
      containerRef.current.appendChild(map)
      mapRef.current = map

      map.flyCameraAround({
        camera: { center: { lat: 20, lng: 10, altitude: 0 }, tilt: 12, heading: 0, range: 22_000_000 },
        durationMillis: 30_000,
        repeatCount: Infinity,
      }).catch(() => null)
    }

    init()
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    if (!LIVE_AGENT_ENABLED) {
      return
    }

    let isMounted = true

    const resumeOutput = () => {
      void resumeAudioContext(audioPlayerRef.current?.context ?? null)
    }

    document.addEventListener('pointerdown', resumeOutput)
    document.addEventListener('keydown', resumeOutput)
    window.addEventListener('focus', resumeOutput)

    void (async () => {
      try {
        console.info('[live-agent] requesting microphone permission')
        const microphoneStream = await requestMicrophoneStream()
        console.info('[live-agent] microphone permission granted')

        const recorderResources = await startAudioRecorderWorklet(
          (pcmData) => {
            forwardAudioInput(pcmData)
          },
          microphoneStream
        )
        if (!isMounted) {
          stopAudioRecorder(recorderResources)
          return
        }
        audioRecorderRef.current = recorderResources

        try {
          const playerResources = await startAudioPlayerWorklet()
          if (!isMounted) {
            stopAudioPlayer(playerResources)
            return
          }
          audioPlayerRef.current = playerResources
          setAudioPlayerResources(playerResources)
          console.info('[live-agent] audio player ready')
        } catch (error) {
          console.warn('[live-agent] audio player initialization failed', error)
        }
      } catch (error) {
        console.warn('[live-agent] microphone initialization failed', error)
      }
    })()

    return () => {
      isMounted = false
      document.removeEventListener('pointerdown', resumeOutput)
      document.removeEventListener('keydown', resumeOutput)
      window.removeEventListener('focus', resumeOutput)

      stopAudioRecorder(audioRecorderRef.current)
      stopAudioPlayer(audioPlayerRef.current)
      audioRecorderRef.current = null
      audioPlayerRef.current = null
    }
  }, [])

  useEffect(() => {
    audioRecorderRef.current?.stream.getAudioTracks().forEach((track) => {
      track.enabled = !micMuted
    })
  }, [micMuted])

  useEffect(() => {
    return () => {
      if (itineraryRevealTimerRef.current) {
        clearTimeout(itineraryRevealTimerRef.current)
        itineraryRevealTimerRef.current = null
      }
    }
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleItinerarySelect = (selectedPersona: Persona) => {
    void runPrep(selectedPersona)
  }

  const handleGeneratedItinerarySelect = async (itineraryId: string) => {
    const itinerary = prepResponse?.itineraries.find((candidate) => candidate.id === itineraryId)
    if (!itinerary) return

    try {
      await executeItineraryActivation({
        itineraryId,
        overlayPreset: DEFAULT_CITY_OVERLAY_PRESET,
        tagline: itinerary.title,
      })
    } catch {
      // State is already updated inside executeItineraryActivation.
    }
  }

  const handleLandmarkSubmit = async () => {
    const itinerary = selectedGeneratedItinerary
    const landmarkName = landmarkInput.trim()
    if (!itinerary || !landmarkName || landmarkPending) return

    try {
      await executeLandmarkActivation({
        landmarkName,
        overlayPreset: landmarkPreset,
        tagline: buildLandmarkTagline(itinerary, landmarkName),
      })
    } catch {
      // Landmark error state is already updated inside executeLandmarkActivation.
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  // Badge only shows from city-selection onwards — no flicker during the loading cinematic
  const badgeVisible = persona !== null && (stage === 'selectingGeneratedItinerary' || stage === 'runtimePrimed')
  const selectedGeneratedItinerary =
    prepResponse?.itineraries.find((itinerary) => itinerary.id === selectedGeneratedItineraryId) ??
    null
  const showLoadingState =
    persona !== null &&
    (
      stage === 'prepLoading' ||
      stage === 'connectingSession' ||
      (stage === 'selectingGeneratedItinerary' && loadingCueVisible)
    )

  function toggleMic() {
    setMicMuted((previous) => !previous)
  }

  function handleCinematicComplete() {
    setStage('selectingGeneratedItinerary')
    window.setTimeout(() => setLoadingCueVisible(false), 1200)
  }

  async function runPrep(selectedPersona: Persona) {
    if (itineraryRevealTimerRef.current) {
      clearTimeout(itineraryRevealTimerRef.current)
      itineraryRevealTimerRef.current = null
    }

    setPersona(selectedPersona)
    initTranscript(selectedPersona)
    setPrepError(null)
    setRuntimeError(null)
    setLandmarkError(null)
    setPrepResponse(null)
    setSelectedGeneratedItineraryId(null)
    setActivatingItineraryId(null)
    setLandmarkInput('')
    setLandmarkPreset(DEFAULT_CITY_OVERLAY_PRESET)
    setLandmarkPending(false)
    setCityOverlay(null)
    setCurrentRuntimeLocation(null)
    setLoadingCueVisible(true)
    setStage('prepLoading')

    try {
      const response = await fetchAyanaPrep({ persona: selectedPersona })
      setPrepResponse(response)
      if (LIVE_AGENT_ENABLED) {
        setStage('connectingSession')
      }
      // Non-live-agent path: stage advance driven by PrepLoadingOverlay via onComplete
    } catch (error) {
      setPrepError(error instanceof Error ? error.message : 'Unable to prepare journeys right now.')
      setLoadingCueVisible(true)
      setStage('prepLoading')
    }
  }

  async function executeItineraryActivation(
    request: ChooseItineraryExecutionRequest
  ): Promise<ChooseItineraryExecutionResult> {
    if (!prepResponse) {
      throw new Error('Journeys are not ready yet.')
    }
    if (activatingItineraryId) {
      throw new Error('A city transition is already in progress.')
    }

    const itinerary = prepResponse.itineraries.find((candidate) => {
      return candidate.id === request.itineraryId
    })
    if (!itinerary) {
      throw new Error(`Unable to find itinerary "${request.itineraryId}".`)
    }

    setRuntimeError(null)
    setActivatingItineraryId(request.itineraryId)
    setGeneratedOverlayExiting(true)
    await new Promise(r => setTimeout(r, 300))

    try {
      const result = await activateCity(
        buildCityActivationInput(
          itinerary,
          request.overlayPreset,
          request.tagline
        )
      )
      // Restore map labels now that a real location is chosen
      if (mapRef.current) (mapRef.current as HTMLElement).setAttribute('mode', 'HYBRID')
      setSelectedGeneratedItineraryId(result.itineraryId)
      setLandmarkError(null)
      setCurrentRuntimeLocation({
        locationName: result.cityName,
        locationSub: `${result.cityName}, ${result.countryName}`,
        lat: result.lat,
        lng: result.lng,
        sceneIndex: 0,
        sceneTotal: itinerary.landmarks.length + 1,
      })
      setCityOverlay((previous) => ({
        key: (previous?.key ?? 0) + 1,
        cityName: result.cityName,
        preset: result.overlayPreset,
        tagline: result.tagline,
      }))
      setStage('runtimePrimed')
      return {
        itineraryId: result.itineraryId,
        cityName: result.cityName,
        countryName: result.countryName,
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Unable to move to this city right now.'
      setGeneratedOverlayExiting(false)
      setRuntimeError(message)
      throw error instanceof Error ? error : new Error(message)
    } finally {
      setActivatingItineraryId(null)
    }
  }

  async function executeLandmarkActivation(
    request: MoveToLandmarkExecutionRequest
  ): Promise<LandmarkActivationResult> {
    const itinerary = selectedGeneratedItinerary
    if (!itinerary) {
      throw new Error('Choose a city before moving to a landmark.')
    }
    if (landmarkPending) {
      throw new Error('A landmark transition is already in progress.')
    }

    setLandmarkPending(true)
    setLandmarkError(null)

    try {
      const result = await activateLandmark(
        buildLandmarkActivationInput(
          itinerary,
          request.landmarkName,
          request.overlayPreset,
          request.tagline,
          (payload) => {
            setCityOverlay((previous) => ({
              key: (previous?.key ?? 0) + 1,
              cityName: payload.displayName,
              preset: payload.preset,
              tagline: payload.tagline,
            }))
          }
        )
      )
      const matchedLandmarkIndex = itinerary.landmarks.findIndex((landmark) => {
        return landmark.name.toLowerCase() === request.landmarkName.toLowerCase()
      })

      setCurrentRuntimeLocation({
        locationName: result.landmarkName,
        locationSub: `${result.cityName}, ${result.countryName}`,
        lat: result.lat,
        lng: result.lng,
        sceneIndex: matchedLandmarkIndex >= 0 ? matchedLandmarkIndex + 1 : 0,
        sceneTotal: itinerary.landmarks.length + 1,
      })
      return result
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Unable to move to this landmark right now.'
      setLandmarkError(message)
      throw error instanceof Error ? error : new Error(message)
    } finally {
      setLandmarkPending(false)
    }
  }

  async function executeShowNearby(
    request: ShowNearbyExecutionRequest
  ): Promise<ShowNearbyResult> {
    const sidebarData = buildSidebarDataForRuntimeLocation(currentRuntimeLocation)
    if (!sidebarData) {
      throw new Error('Move to a city or landmark before opening nearby discovery.')
    }

    return showNearby({
      category: request.category,
      sidebarData,
    })
  }

  async function executeOpenPlaceStreetView(
    request: OpenPlaceStreetViewExecutionRequest
  ): Promise<OpenPlaceStreetViewResult> {
    return openPlaceStreetView(request.placeName)
  }

  async function executeEndSession(): Promise<void> {
    router.push('/recap')
  }

  return (
    <main className="relative flex h-screen items-center justify-center bg-black overflow-hidden">
      {LIVE_AGENT_ENABLED && persona && prepResponse && (
        <LiveAgentSession
          persona={persona}
          prepResponse={prepResponse}
          onChooseItineraryAction={executeItineraryActivation}
          onMoveToLandmarkAction={executeLandmarkActivation}
          onShowNearbyAction={executeShowNearby}
          onOpenPlaceStreetViewAction={executeOpenPlaceStreetView}
          onEndSessionAction={executeEndSession}
          audioPlayerResources={audioPlayerResources}
          onSessionBootstrapped={() => {
            if (itineraryRevealTimerRef.current) {
              clearTimeout(itineraryRevealTimerRef.current)
            }
            itineraryRevealTimerRef.current = window.setTimeout(() => {
              setStage('selectingGeneratedItinerary')
              window.setTimeout(() => setLoadingCueVisible(false), 420)
              itineraryRevealTimerRef.current = null
            }, ITINERARY_OVERLAY_REVEAL_DELAY_MS)
          }}
        />
      )}

      {/* Persistent Map3DElement */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Top-left controls */}
      {LIVE_AGENT_ENABLED && (stage === 'selectingGeneratedItinerary' || stage === 'runtimePrimed') && (
        <div
          style={{
            position: 'absolute',
            top: 18,
            left: 18,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <MicNotch
            gestureState={gestureState}
            micMuted={micMuted}
            onToggle={toggleMic}
          />
          {stage === 'runtimePrimed' && (
            <ControlNotch gestureState={gestureState} />
          )}
        </div>
      )}

      {/* Agent notch — bottom-center, from city-selection onwards */}
      {LIVE_AGENT_ENABLED && (stage === 'selectingGeneratedItinerary' || stage === 'runtimePrimed') && (
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
          <AgentStatusNotch state={agentState} />
        </div>
      )}

      {/* Hidden video for gesture camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
      />

      {/* Itinerary selection — very first screen */}
      {stage === 'selectingPersona' && (
        <ItinerarySelection onSelect={handleItinerarySelect} />
      )}

      {showLoadingState && persona && (
        <PrepLoadingOverlay
          persona={persona}
          errorMessage={prepError}
          onRetry={prepError ? () => void runPrep(persona) : undefined}
          fadeOut={stage === 'selectingGeneratedItinerary' && !prepError}
          isLoaded={prepResponse !== null}
          onComplete={handleCinematicComplete}
        />
      )}

      {stage === 'selectingGeneratedItinerary' && persona && prepResponse && (
        <GeneratedItineraryOverlay
          persona={persona}
          itineraries={prepResponse.itineraries}
          selectedItineraryId={activatingItineraryId}
          onSelect={(itineraryId) => void handleGeneratedItinerarySelect(itineraryId)}
          exiting={generatedOverlayExiting}
        />
      )}

      {cityOverlay && (
        <CityOverlay
          key={cityOverlay.key}
          cityName={cityOverlay.cityName}
          preset={cityOverlay.preset}
          tagline={cityOverlay.tagline}
        />
      )}

      {selectedGeneratedItinerary && (
        <AyanaRuntimeWidget
          gestureState={gestureState}
          itinerary={selectedGeneratedItinerary}
          currentLocation={currentRuntimeLocation}
          landmarkInput={landmarkInput}
          onLandmarkInputChange={setLandmarkInput}
          selectedPreset={landmarkPreset}
          onPresetChange={setLandmarkPreset}
          onLandmarkSubmit={() => void handleLandmarkSubmit()}
          landmarkBusy={landmarkPending}
          landmarkError={landmarkError}
        />
      )}

      {/* Persona badge — persists after selection through the whole experience */}
      {persona && (
        <PersonaBadge type={persona} visible={badgeVisible} />
      )}

      {runtimeError && stage === 'selectingGeneratedItinerary' && (
        <div
          style={{
            position: 'absolute',
            bottom: '92px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            padding: '10px 16px',
            background: 'rgba(52,10,16,0.56)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,140,140,0.18)',
            borderRadius: '4px',
            fontFamily: '"SF Mono","Fira Code",monospace',
            fontSize: '9px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'rgba(255,214,214,0.82)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {runtimeError}
        </div>
      )}

      {/* Recap preview link — persistent bottom-left */}
      <Link
        href="/recap"
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '6px 12px',
          background: 'rgba(4,4,12,0.55)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '3px',
          fontFamily: '"SF Mono","Fira Code",monospace',
          fontSize: '9px',
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.3)',
          textDecoration: 'none',
          transition: 'color 0.2s ease, border-color 0.2s ease',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget
          el.style.color = 'rgba(255,255,255,0.7)'
          el.style.borderColor = 'rgba(255,255,255,0.2)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget
          el.style.color = 'rgba(255,255,255,0.3)'
          el.style.borderColor = 'rgba(255,255,255,0.08)'
        }}
      >
        <span>Journey Recap</span>
        <span style={{ opacity: 0.5 }}>↗</span>
      </Link>
    </main>
  )
}

function buildCityActivationInput(
  itinerary: AyanaPrepItinerary,
  overlayPreset: OverlayPreset,
  tagline: string
): CityActivationInput {
  return {
    itineraryId: itinerary.id,
    cityName: itinerary.city_name,
    countryName: itinerary.country_name,
    overlayPreset,
    tagline,
  }
}

function buildSidebarDataForRuntimeLocation(
  runtimeLocation: {
    locationName: string
    locationSub: string
    lat: number
    lng: number
    sceneIndex: number
    sceneTotal: number
  } | null
): SidebarData | null {
  if (!runtimeLocation) {
    return null
  }

  return {
    locationName: runtimeLocation.locationName,
    locationSub: runtimeLocation.locationSub,
    tags: [],
    sceneIndex: runtimeLocation.sceneIndex,
    sceneTotal: runtimeLocation.sceneTotal,
    lat: runtimeLocation.lat,
    lng: runtimeLocation.lng,
  }
}

function buildLandmarkActivationInput(
  itinerary: AyanaPrepItinerary,
  landmarkName: string,
  overlayPreset: OverlayPreset,
  tagline: string,
  onOverlayStart: NonNullable<LandmarkActivationInput['onOverlayStart']>
): LandmarkActivationInput {
  return {
    itineraryId: itinerary.id,
    cityName: itinerary.city_name,
    countryName: itinerary.country_name,
    landmarkName,
    overlayPreset,
    tagline,
    onOverlayStart,
  }
}

function buildLandmarkTagline(
  itinerary: AyanaPrepItinerary,
  landmarkName: string
): string {
  const matchedLandmark = itinerary.landmarks.find((landmark) => {
    return landmark.name.toLowerCase() === landmarkName.toLowerCase()
  })
  return matchedLandmark?.why_this_stop ?? itinerary.title
}
