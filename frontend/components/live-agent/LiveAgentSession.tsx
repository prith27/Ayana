'use client'

import html2canvas from 'html2canvas'
import { useEffect, useRef } from 'react'
import type { AyanaPrepResponse, Persona } from '@/lib/ayana/prep'
import {
  OVERLAY_PRESET_OPTIONS,
  type OverlayPreset,
  type OpenPlaceStreetViewResult,
} from '@/lib/ayana/runtime'
import {
  base64ToArray,
  resumeAudioContext,
  setAudioInputSink,
  type AudioPlayerResources,
} from '@/lib/live-agent/audio'
import {
  setAgentConnecting,
  setAgentDisconnected,
  setAgentIdle,
  setAgentSpeaking,
} from '@/lib/maps/sidebarControls'
import {
  buildFrontendAckMessage,
  type EndSessionActionPayload,
  isFrontendActionMessage,
  isToolResultMessage,
  type ChooseItineraryActionPayload,
  type FrontendAction,
  type FrontendAck,
  type MoveToLandmarkActionPayload,
  type OpenPlaceStreetViewActionPayload,
  type ShowNearbyActionPayload,
  type ToolResult,
} from '@/lib/live-agent/protocol'
import {
  addAITurn,
  addUserTurn,
  recordCityEvent,
  recordLandmarkEvent,
} from '@/lib/ayana/transcript'
import type { PlaceCategory } from '@/lib/places/nearbySearch'
interface ChooseItineraryActionResult {
  itineraryId: string
  cityName: string
  countryName: string
}

interface MoveToLandmarkActionResult {
  itineraryId: string
  cityName: string
  countryName: string
  landmarkName: string
  formattedAddress: string
  lat: number
  lng: number
  overlayPreset: OverlayPreset
  tagline: string
}

interface ShowNearbyActionResult {
  category: PlaceCategory
  locationName: string
  locationSub: string
  places: Array<{
    name: string
    rating: number | null
    userRatingCount: number | null
    types: string[]
    address: string | null
    lat: number
    lng: number
  }>
}

interface LiveAgentSessionProps {
  persona: Persona | null
  prepResponse: AyanaPrepResponse | null
  audioPlayerResources: AudioPlayerResources | null
  onSessionBootstrapped: () => void
  onChooseItineraryAction: (
    request: {
      itineraryId: string
      overlayPreset: OverlayPreset
      tagline: string
    }
  ) => Promise<ChooseItineraryActionResult>
  onMoveToLandmarkAction: (
    request: {
      landmarkName: string
      overlayPreset: OverlayPreset
      tagline: string
    }
  ) => Promise<MoveToLandmarkActionResult>
  onShowNearbyAction: (
    request: {
      category: PlaceCategory
    }
  ) => Promise<ShowNearbyActionResult>
  onOpenPlaceStreetViewAction: (request: {
    placeName: string
  }) => Promise<OpenPlaceStreetViewResult>
  onEndSessionAction: () => Promise<void>
}

interface LiveAgentEventPart {
  text?: string
  thought?: boolean
  inlineData?: {
    mimeType?: string
    data?: string
  }
}

interface LiveAgentEvent {
  turnComplete?: boolean
  interrupted?: boolean
  partial?: boolean
  inputTranscription?: {
    text?: string
    finished?: boolean
  }
  outputTranscription?: {
    text?: string
    finished?: boolean
  }
  content?: {
    parts?: LiveAgentEventPart[]
  }
}

const MAX_RETRIES = 5
const USER_ID_STORAGE_KEY = 'ayana-live-user-id'
const END_SESSION_IDLE_DRAIN_MS = 2_000
const END_SESSION_MAX_DRAIN_MS = 15_000

export function LiveAgentSession({
  persona,
  prepResponse,
  audioPlayerResources,
  onSessionBootstrapped,
  onChooseItineraryAction,
  onMoveToLandmarkAction,
  onShowNearbyAction,
  onOpenPlaceStreetViewAction,
  onEndSessionAction,
}: LiveAgentSessionProps) {
  const websocketRef = useRef<WebSocket | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const sessionPersonaRef = useRef<Persona | null>(null)
  const sessionPrepResponseRef = useRef<AyanaPrepResponse | null>(null)
  const playerRef = useRef<AudioPlayerResources | null>(audioPlayerResources)
  const chooseItineraryActionRef = useRef(onChooseItineraryAction)
  const moveToLandmarkActionRef = useRef(onMoveToLandmarkAction)
  const showNearbyActionRef = useRef(onShowNearbyAction)
  const openPlaceStreetViewActionRef = useRef(onOpenPlaceStreetViewAction)
  const endSessionActionRef = useRef(onEndSessionAction)
  const bootstrappedSessionRef = useRef<string | null>(null)
  const shouldReconnectRef = useRef(false)
  const frontendActionQueueRef = useRef<FrontendAction[]>([])
  const processingFrontendActionRef = useRef(false)
  const latestToolResultRef = useRef<ToolResult | null>(null)
  const prepFingerprintRef = useRef<string | null>(null)
  // Transcript accumulation buffers (partial chunks → flush on finished)
  const aiTurnBufferRef = useRef<string>('')
  const userTurnBufferRef = useRef<string>('')
  const pendingEndSessionRef = useRef(false)
  const finalizingEndSessionRef = useRef(false)
  const endSessionIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endSessionMaxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    chooseItineraryActionRef.current = onChooseItineraryAction
  }, [onChooseItineraryAction])

  useEffect(() => {
    moveToLandmarkActionRef.current = onMoveToLandmarkAction
  }, [onMoveToLandmarkAction])

  useEffect(() => {
    showNearbyActionRef.current = onShowNearbyAction
  }, [onShowNearbyAction])

  useEffect(() => {
    openPlaceStreetViewActionRef.current = onOpenPlaceStreetViewAction
  }, [onOpenPlaceStreetViewAction])

  useEffect(() => {
    endSessionActionRef.current = onEndSessionAction
  }, [onEndSessionAction])

  useEffect(() => {
    playerRef.current = audioPlayerResources
  }, [audioPlayerResources])

  useEffect(() => {
    setAudioInputSink((pcmData) => {
      const socket = websocketRef.current
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(pcmData)
      }
    })

    return () => {
      setAudioInputSink(null)
      disconnect(false)
      setAgentIdle()
    }
  }, [])

  useEffect(() => {
    if (!persona || !prepResponse) {
      return
    }

    const nextFingerprint = buildPrepFingerprint(persona, prepResponse)
    if (
      sessionPersonaRef.current === persona &&
      prepFingerprintRef.current === nextFingerprint &&
      websocketRef.current
    ) {
      return
    }

    disconnect(false)
    sessionPersonaRef.current = persona
    sessionPrepResponseRef.current = prepResponse
    prepFingerprintRef.current = nextFingerprint
    sessionIdRef.current = `ayana-session-${crypto.randomUUID()}`
    bootstrappedSessionRef.current = null
    retryCountRef.current = 0
    openSocket()
    // openSocket reads only refs so the effect stays keyed to persona changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, prepResponse])

  return null

  function openSocket(): void {
    const activePersona = sessionPersonaRef.current
    const activePrepResponse = sessionPrepResponseRef.current
    const sessionId = sessionIdRef.current
    if (!activePersona || !activePrepResponse || !sessionId) {
      return
    }

    if (websocketRef.current && websocketRef.current.readyState <= WebSocket.OPEN) {
      return
    }

    shouldReconnectRef.current = true
    setAgentConnecting()
    const url = buildWebSocketUrl(
      getOrCreateUserId(),
      sessionId,
      activePrepResponse.prep_id
    )
    console.info('[live-agent] opening websocket', { url, persona: activePersona, sessionId })
    const socket = new WebSocket(url)
    websocketRef.current = socket

    socket.onopen = () => {
      console.info('[live-agent] websocket connected', { sessionId })
      retryCountRef.current = 0
      void resumeAudioContext(playerRef.current?.context ?? null)
      setAgentIdle()

      if (bootstrappedSessionRef.current !== sessionId) {
        socket.send(JSON.stringify({
          type: 'text',
          text: buildStartupBootstrapText(activePrepResponse),
        }))
        bootstrappedSessionRef.current = sessionId
        onSessionBootstrapped()
      }
    }

    socket.onmessage = (event) => {
      handleServerMessage(event.data)
    }

    socket.onerror = () => {
      // Browser gives a generic Event here; use onclose code/reason for diagnosis.
      console.error(
        '[live-agent] websocket error (if backend is down, start FastAPI on the URL from NEXT_PUBLIC_LIVE_AGENT_WS_URL or port 8000)'
      )
      setAgentDisconnected()
    }

    socket.onclose = (event) => {
      console.info('[live-agent] websocket closed', {
        sessionId,
        code: event.code,
        reason: event.reason || '(none)',
        wasClean: event.wasClean,
      })
      websocketRef.current = null
      setAgentDisconnected()
      if (pendingEndSessionRef.current && !finalizingEndSessionRef.current) {
        void finalizePendingEndSession()
        return
      }
      scheduleReconnect()
    }
  }

  function handleServerMessage(rawEvent: string): void {
    let parsedEvent: unknown

    try {
      parsedEvent = JSON.parse(rawEvent) as unknown
    } catch (error) {
      console.warn('[live-agent] failed to parse event', error)
      return
    }

    if (isToolResultMessage(parsedEvent)) {
      latestToolResultRef.current = parsedEvent.result
      console.info('[live-agent] tool result received', parsedEvent.result)
      return
    }

    if (isFrontendActionMessage(parsedEvent)) {
      enqueueFrontendAction(parsedEvent.action)
      return
    }

    handleLiveAgentEvent(parsedEvent as LiveAgentEvent)
  }

  function handleLiveAgentEvent(liveEvent: LiveAgentEvent): void {
    if (!liveEvent || typeof liveEvent !== 'object') {
      return
    }

    if (liveEvent.turnComplete) {
      setAgentIdle()
      return
    }

    if (liveEvent.interrupted) {
      playerRef.current?.node.port.postMessage({ command: 'endOfAudio' })
      setAgentIdle()
      return
    }

    if (liveEvent.outputTranscription?.text) {
      markAssistantOutputActivity()
      setAgentSpeaking()
      aiTurnBufferRef.current += liveEvent.outputTranscription.text
      if (liveEvent.outputTranscription.finished) {
        addAITurn(aiTurnBufferRef.current)
        aiTurnBufferRef.current = ''
      }
    }

    if (liveEvent.inputTranscription?.text) {
      userTurnBufferRef.current += liveEvent.inputTranscription.text
      if (liveEvent.inputTranscription.finished) {
        addUserTurn(userTurnBufferRef.current)
        userTurnBufferRef.current = ''
      }
    }

    const parts = liveEvent.content?.parts ?? []
    for (const part of parts) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/pcm') && playerRef.current) {
        markAssistantOutputActivity()
        setAgentSpeaking()
        void resumeAudioContext(playerRef.current.context)
        playerRef.current.node.port.postMessage(base64ToArray(part.inlineData.data))
      }

      if (part.text && !part.thought) {
        markAssistantOutputActivity()
        setAgentSpeaking()
      }
    }
  }

  function enqueueFrontendAction(action: FrontendAction): void {
    frontendActionQueueRef.current.push(action)
    void flushFrontendActions()
  }

  async function flushFrontendActions(): Promise<void> {
    if (processingFrontendActionRef.current) {
      return
    }

    processingFrontendActionRef.current = true
    try {
      while (frontendActionQueueRef.current.length > 0) {
        const action = frontendActionQueueRef.current.shift()
        if (!action) {
          continue
        }
        await handleFrontendAction(action)
      }
    } finally {
      processingFrontendActionRef.current = false
    }
  }

  async function handleFrontendAction(action: FrontendAction): Promise<void> {
    console.info('[live-agent] frontend action received', action)

    if (action.action_type === 'ayana.choose_itinerary') {
      const payload = parseChooseItineraryActionPayload(action.payload)
      if (!payload) {
        await sendFrontendAck({
          status: 'failed',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary: 'Invalid ayana.choose_itinerary payload from backend.',
        })
        return
      }

      try {
        const result = await chooseItineraryActionRef.current({
          itineraryId: payload.itinerary_id,
          overlayPreset: payload.overlay_preset,
          tagline: payload.tagline,
        })
        recordCityEvent(result.cityName, result.countryName)
        await sendImageBeforeAck(action.job_id, result.cityName)
        await sendFrontendAck({
          status: 'applied',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary: `Ayana arrived in ${result.cityName}, ${result.countryName}.`,
          payload: {
            itinerary_id: result.itineraryId,
            city_name: result.cityName,
            country_name: result.countryName,
          },
        })
      } catch (error) {
        const summary = error instanceof Error
          ? error.message
          : 'Unable to apply ayana.choose_itinerary.'
        await sendFrontendAck({
          status: 'failed',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary,
        })
      }
      return
    }

    if (action.action_type === 'ayana.move_to_landmark') {
      const payload = parseMoveToLandmarkActionPayload(action.payload)
      if (!payload) {
        await sendFrontendAck({
          status: 'failed',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary: 'Invalid ayana.move_to_landmark payload from backend.',
        })
        return
      }

      try {
        const result = await moveToLandmarkActionRef.current({
          landmarkName: payload.landmark_name,
          overlayPreset: payload.overlay_preset,
          tagline: payload.tagline,
        })
        recordLandmarkEvent(result.landmarkName, result.cityName, result.countryName)
        await sendImageBeforeAck(action.job_id, result.landmarkName)
        await sendFrontendAck({
          status: 'applied',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary: `Ayana arrived at ${result.landmarkName} in ${result.cityName}, ${result.countryName}.`,
          payload: {
            itinerary_id: result.itineraryId,
            city_name: result.cityName,
            country_name: result.countryName,
            landmark_name: result.landmarkName,
            formatted_address: result.formattedAddress,
            lat: result.lat,
            lng: result.lng,
            overlay_preset: result.overlayPreset,
            tagline: result.tagline,
          },
        })
      } catch (error) {
        const summary = error instanceof Error
          ? error.message
          : 'Unable to apply ayana.move_to_landmark.'
        await sendFrontendAck({
          status: 'failed',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary,
        })
      }
      return
    }

    if (action.action_type === 'ayana.show_nearby') {
      const payload = parseShowNearbyActionPayload(action.payload)
      if (!payload) {
        await sendFrontendAck({
          status: 'failed',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary: 'Invalid ayana.show_nearby payload from backend.',
        })
        return
      }

      try {
        const result = await showNearbyActionRef.current({
          category: payload.category,
        })
        await sendImageBeforeAck(action.job_id, result.locationName)
        await sendFrontendAck({
          status: 'applied',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary: `${capitalizeCategory(result.category)} sidebar opened with ${result.places.length} nearby places around ${result.locationName}.`,
          payload: {
            category: result.category,
            city_name: payload.city_name,
            country_name: payload.country_name,
            landmark_name: payload.landmark_name,
            location_name: result.locationName,
            location_sub: result.locationSub,
            places: result.places.map((place) => ({
              name: place.name,
              rating: place.rating,
              user_rating_count: place.userRatingCount,
              types: place.types,
              address: place.address,
              lat: place.lat,
              lng: place.lng,
            })),
          },
        })
      } catch (error) {
        const summary = error instanceof Error
          ? error.message
          : 'Unable to apply ayana.show_nearby.'
        await sendFrontendAck({
          status: 'failed',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary,
        })
      }
      return
    }

    if (action.action_type === 'ayana.open_place_street_view') {
      const payload = parseOpenPlaceStreetViewActionPayload(action.payload)
      if (!payload) {
        await sendFrontendAck({
          status: 'failed',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary: 'Invalid ayana.open_place_street_view payload from backend.',
        })
        return
      }

      try {
        const result = await openPlaceStreetViewActionRef.current({
          placeName: payload.place_name,
        })
        await sendImageBeforeAck(action.job_id, result.placeName)
        await sendFrontendAck({
          status: 'applied',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary: `Street View opened for ${result.placeName}.`,
          payload: {
            category: result.category,
            location_name: result.locationName,
            location_sub: result.locationSub,
            place_name: result.placeName,
            address: result.address,
            rating: result.rating,
            user_rating_count: result.userRatingCount,
            types: result.types,
            lat: result.lat,
            lng: result.lng,
          },
        })
      } catch (error) {
        const summary = error instanceof Error
          ? error.message
          : 'Unable to apply ayana.open_place_street_view.'
        await sendFrontendAck({
          status: 'failed',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary,
        })
      }
      return
    }

    if (action.action_type === 'ayana.end_session') {
      const payload = parseEndSessionActionPayload(action.payload)
      if (!payload) {
        await sendFrontendAck({
          status: 'failed',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary: 'Invalid ayana.end_session payload from backend.',
        })
        return
      }

      try {
        await sendFrontendAck({
          status: 'applied',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary: 'Ayana is wrapping up and the recap will open once the response finishes.',
        })
        beginPendingEndSession()
      } catch (error) {
        const summary = error instanceof Error
          ? error.message
          : 'Unable to apply ayana.end_session.'
        await sendFrontendAck({
          status: 'failed',
          action_type: action.action_type,
          source_tool: action.source_tool,
          job_id: action.job_id,
          summary,
        })
      }
      return
    }

    await sendFrontendAck({
      status: 'failed',
      action_type: action.action_type,
      source_tool: action.source_tool,
      job_id: action.job_id,
      summary: `No frontend handler is implemented yet for ${action.action_type}.`,
    })
  }

  async function sendFrontendAck(ack: FrontendAck): Promise<void> {
    const socket = websocketRef.current
    if (socket?.readyState !== WebSocket.OPEN) {
      console.warn('[live-agent] unable to send frontend ack: socket not open', ack)
      return
    }

    socket.send(JSON.stringify(buildFrontendAckMessage(ack)))
  }

  async function sendImageBeforeAck(
    jobId: string,
    sceneLabel: string
  ): Promise<void> {
    const socket = websocketRef.current
    if (socket?.readyState !== WebSocket.OPEN) {
      throw new Error('Live socket is not open for screenshot upload.')
    }

    const imageDataUrl = await captureViewportImage(sceneLabel)
    const [, base64Payload = ''] = imageDataUrl.split(',', 2)
    socket.send(JSON.stringify({
      type: 'image',
      mimeType: 'image/png',
      data: base64Payload,
      job_id: jobId,
    }))
  }

  function flushTranscriptBuffers(): void {
    if (aiTurnBufferRef.current.trim()) {
      addAITurn(aiTurnBufferRef.current)
      aiTurnBufferRef.current = ''
    }
    if (userTurnBufferRef.current.trim()) {
      addUserTurn(userTurnBufferRef.current)
      userTurnBufferRef.current = ''
    }
  }

  function beginPendingEndSession(): void {
    pendingEndSessionRef.current = true
    finalizingEndSessionRef.current = false
    shouldReconnectRef.current = false
    schedulePendingEndSessionDrain()

    if (endSessionMaxTimerRef.current) {
      clearTimeout(endSessionMaxTimerRef.current)
    }
    endSessionMaxTimerRef.current = setTimeout(() => {
      void finalizePendingEndSession()
    }, END_SESSION_MAX_DRAIN_MS)
  }

  function markAssistantOutputActivity(): void {
    if (!pendingEndSessionRef.current || finalizingEndSessionRef.current) {
      return
    }
    schedulePendingEndSessionDrain()
  }

  function schedulePendingEndSessionDrain(): void {
    if (!pendingEndSessionRef.current || finalizingEndSessionRef.current) {
      return
    }

    if (endSessionIdleTimerRef.current) {
      clearTimeout(endSessionIdleTimerRef.current)
    }
    endSessionIdleTimerRef.current = setTimeout(() => {
      void finalizePendingEndSession()
    }, END_SESSION_IDLE_DRAIN_MS)
  }

  async function finalizePendingEndSession(): Promise<void> {
    if (!pendingEndSessionRef.current || finalizingEndSessionRef.current) {
      return
    }

    pendingEndSessionRef.current = false
    finalizingEndSessionRef.current = true
    clearPendingEndSessionTimers()

    try {
      flushTranscriptBuffers()
      disconnect(false)
      setAgentDisconnected()
      await endSessionActionRef.current()
    } finally {
      finalizingEndSessionRef.current = false
    }
  }

  function clearPendingEndSessionTimers(): void {
    if (endSessionIdleTimerRef.current) {
      clearTimeout(endSessionIdleTimerRef.current)
      endSessionIdleTimerRef.current = null
    }
    if (endSessionMaxTimerRef.current) {
      clearTimeout(endSessionMaxTimerRef.current)
      endSessionMaxTimerRef.current = null
    }
  }

  function scheduleReconnect(): void {
    if (!shouldReconnectRef.current || !sessionIdRef.current || !sessionPersonaRef.current) {
      return
    }

    if (retryCountRef.current >= MAX_RETRIES) {
      console.warn('[live-agent] max retries reached, giving up')
      return
    }

    const delay = Math.min(1000 * 2 ** retryCountRef.current, 30_000)
    retryCountRef.current += 1
    retryTimerRef.current = setTimeout(() => {
      openSocket()
    }, delay)
  }

  function disconnect(allowReconnect: boolean): void {
    shouldReconnectRef.current = allowReconnect
    clearPendingEndSessionTimers()
    pendingEndSessionRef.current = false

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }

    const socket = websocketRef.current
    websocketRef.current = null
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close()
    }
  }
}

function buildWebSocketUrl(
  userId: string,
  sessionId: string,
  prepId: string
): string {
  const configuredBase =
    process.env.NEXT_PUBLIC_LIVE_AGENT_WS_URL ?? process.env.NEXT_PUBLIC_WS_URL

  if (configuredBase) {
    const trimmed = configuredBase.replace(/\/$/, '')
    const base = trimmed.endsWith('/ws') ? trimmed : `${trimmed}/ws`
    const query = new URLSearchParams({ prep_id: prepId })
    return `${base}/${encodeURIComponent(userId)}/${encodeURIComponent(sessionId)}?${query.toString()}`
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const query = new URLSearchParams({ prep_id: prepId })
  return `${protocol}//${window.location.hostname}:8000/ws/${encodeURIComponent(userId)}/${encodeURIComponent(sessionId)}?${query.toString()}`
}

function getOrCreateUserId(): string {
  const existingUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY)
  if (existingUserId) {
    return existingUserId
  }

  const userId = `ayana-user-${crypto.randomUUID()}`
  window.localStorage.setItem(USER_ID_STORAGE_KEY, userId)
  return userId
}

function buildStartupBootstrapText(prepResponse: AyanaPrepResponse): string {
  const optionLines = prepResponse.itineraries
    .map((itinerary, index) => {
      return [
        `Option ${index + 1}:`,
        `itinerary_id=${itinerary.id};`,
        `city=${itinerary.city_name}, ${itinerary.country_name};`,
        `title=${itinerary.title};`,
        `pitch=${itinerary.pitch}`,
      ].join(' ')
    })
    .join(' ')

  return [
    'Greet the user as Ayana in one or two short spoken sentences.',
    'Present only the three generated itinerary options listed below, naturally and clearly.',
    'Invite the user to choose one of the options.',
    'Do not invent other options or cities.',
    'When the user makes a choice, call choose_itinerary with the exact itinerary_id for that option.',
    optionLines,
  ].join(' ')
}

function parseChooseItineraryActionPayload(
  payload: Record<string, unknown>
): ChooseItineraryActionPayload | null {
  const itineraryId = payload.itinerary_id
  const cityName = payload.city_name
  const countryName = payload.country_name
  const overlayPreset = payload.overlay_preset
  const tagline = payload.tagline

  if (
    typeof itineraryId !== 'string' ||
    typeof cityName !== 'string' ||
    typeof countryName !== 'string' ||
    typeof overlayPreset !== 'string' ||
    typeof tagline !== 'string'
  ) {
    return null
  }

  if (!OVERLAY_PRESET_OPTIONS.includes(overlayPreset as OverlayPreset)) {
    return null
  }

  return {
    itinerary_id: itineraryId,
    city_name: cityName,
    country_name: countryName,
    overlay_preset: overlayPreset as OverlayPreset,
    tagline,
  }
}

function parseMoveToLandmarkActionPayload(
  payload: Record<string, unknown>
): MoveToLandmarkActionPayload | null {
  const itineraryId = payload.itinerary_id
  const cityName = payload.city_name
  const countryName = payload.country_name
  const landmarkName = payload.landmark_name
  const overlayPreset = payload.overlay_preset
  const tagline = payload.tagline

  if (
    typeof itineraryId !== 'string' ||
    typeof cityName !== 'string' ||
    typeof countryName !== 'string' ||
    typeof landmarkName !== 'string' ||
    typeof overlayPreset !== 'string' ||
    typeof tagline !== 'string'
  ) {
    return null
  }

  if (!OVERLAY_PRESET_OPTIONS.includes(overlayPreset as OverlayPreset)) {
    return null
  }

  return {
    itinerary_id: itineraryId,
    city_name: cityName,
    country_name: countryName,
    landmark_name: landmarkName,
    overlay_preset: overlayPreset as OverlayPreset,
    tagline,
  }
}

function parseShowNearbyActionPayload(
  payload: Record<string, unknown>
): ShowNearbyActionPayload | null {
  const category = payload.category
  const cityName = payload.city_name
  const countryName = payload.country_name
  const landmarkName = payload.landmark_name

  if (
    category !== 'food' &&
    category !== 'shopping' &&
    category !== 'activities'
  ) {
    return null
  }

  if (cityName !== undefined && typeof cityName !== 'string') {
    return null
  }
  if (countryName !== undefined && typeof countryName !== 'string') {
    return null
  }
  if (landmarkName !== undefined && typeof landmarkName !== 'string') {
    return null
  }

  return {
    category,
    city_name: cityName,
    country_name: countryName,
    landmark_name: landmarkName,
  }
}

function parseOpenPlaceStreetViewActionPayload(
  payload: Record<string, unknown>
): OpenPlaceStreetViewActionPayload | null {
  const placeName = payload.place_name
  if (typeof placeName !== 'string' || !placeName.trim()) {
    return null
  }
  return { place_name: placeName.trim() }
}

function parseEndSessionActionPayload(
  payload: Record<string, unknown>
): EndSessionActionPayload | null {
  return typeof payload === 'object' && payload !== null ? {} : null
}

function buildPrepFingerprint(
  persona: Persona,
  prepResponse: AyanaPrepResponse
): string {
  return JSON.stringify({
    prep_id: prepResponse.prep_id,
    persona,
    itineraries: prepResponse.itineraries.map((itinerary) => ({
      id: itinerary.id,
      city_name: itinerary.city_name,
      country_name: itinerary.country_name,
      title: itinerary.title,
    })),
  })
}

async function captureViewportImage(sceneLabel: string): Promise<string> {
  try {
    const canvas = await html2canvas(document.body, {
      backgroundColor: '#000000',
      logging: false,
      useCORS: true,
      scale: Math.min(window.devicePixelRatio || 1, 2),
    })
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.warn('[live-agent] html2canvas capture failed, using fallback', error)
    return buildFallbackImage(sceneLabel)
  }
}

function buildFallbackImage(sceneLabel: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to create fallback screenshot canvas.')
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#060815')
  gradient.addColorStop(0.5, '#121b34')
  gradient.addColorStop(1, '#2a3f63')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = 'rgba(255,255,255,0.88)'
  context.font = '600 84px system-ui'
  context.fillText('AYANA', 96, 164)

  context.fillStyle = 'rgba(255,255,255,0.7)'
  context.font = '500 44px system-ui'
  context.fillText(sceneLabel, 96, 250)

  context.strokeStyle = 'rgba(255,255,255,0.18)'
  context.lineWidth = 2
  context.strokeRect(72, 72, canvas.width - 144, canvas.height - 144)

  context.fillStyle = 'rgba(255,255,255,0.52)'
  context.font = '400 26px system-ui'
  context.fillText('Cinematic transition completed on frontend', 96, 324)

  return canvas.toDataURL('image/png')
}

function capitalizeCategory(category: PlaceCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}
