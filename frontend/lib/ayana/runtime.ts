import { navigateToLocation } from '@/lib/maps/cameraControls'
import { calcArrivalRange } from '@/lib/maps/smartRange'
import { buildCityGeocodeQuery, geocodePlaceQuery } from '@/lib/maps/geocoding'
import { EXIT_MS, HOLD_MS, LETTER_MS, TAGLINE_DELAY_MS } from '@/components/map/CityOverlay'

export type OverlayPreset =
  | 'urban-neon'
  | 'tropical'
  | 'heritage'
  | 'modern-minimal'
  | 'nature'

export const OVERLAY_PRESET_OPTIONS: OverlayPreset[] = [
  'urban-neon',
  'tropical',
  'heritage',
  'modern-minimal',
  'nature',
]

export interface CityActivationInput {
  itineraryId: string
  cityName: string
  countryName: string
  overlayPreset: OverlayPreset
  tagline: string
}

export interface CityActivationResult {
  itineraryId: string
  cityName: string
  countryName: string
  overlayPreset: OverlayPreset
  tagline: string
  placeQuery: string
  formattedAddress: string
  placeTypes: string[]
  lat: number
  lng: number
  arrivalRange: number
  arrivalTilt: number
}

export interface LandmarkActivationInput {
  itineraryId: string
  cityName: string
  countryName: string
  landmarkName: string
  overlayPreset: OverlayPreset
  tagline: string
  onOverlayStart?: (payload: LandmarkOverlayPayload) => void
}

export interface LandmarkActivationResult {
  itineraryId: string
  cityName: string
  countryName: string
  landmarkName: string
  overlayPreset: OverlayPreset
  tagline: string
  placeQuery: string
  formattedAddress: string
  placeTypes: string[]
  lat: number
  lng: number
  arrivalRange: number
  arrivalTilt: number
  settleDelayMs: number
  overlayDurationMs: number
}

export interface LandmarkOverlayPayload {
  displayName: string
  preset: OverlayPreset
  tagline: string
}

export async function activateCity(
  input: CityActivationInput
): Promise<CityActivationResult> {
  const placeQuery = buildCityGeocodeQuery(input.cityName, input.countryName)
  const resolvedPlace = await geocodePlaceQuery(placeQuery)
  const { range, tilt } = calcArrivalRange(
    resolvedPlace.viewport,
    resolvedPlace.types,
    input.cityName
  )

  const navigation = await navigateToLocation(
    resolvedPlace.lat,
    resolvedPlace.lng,
    range,
    tilt
  )

  if (!navigation.ok) {
    throw new Error('Map is not ready yet.')
  }

  return {
    itineraryId: input.itineraryId,
    cityName: input.cityName,
    countryName: input.countryName,
    overlayPreset: input.overlayPreset,
    tagline: input.tagline,
    placeQuery,
    formattedAddress: resolvedPlace.formattedAddress,
    placeTypes: resolvedPlace.types,
    lat: resolvedPlace.lat,
    lng: resolvedPlace.lng,
    arrivalRange: range,
    arrivalTilt: tilt,
  }
}

export async function activateLandmark(
  input: LandmarkActivationInput
): Promise<LandmarkActivationResult> {
  const placeQuery = buildLandmarkGeocodeQuery(
    input.landmarkName,
    input.cityName,
    input.countryName
  )
  const resolvedPlace = await geocodePlaceQuery(placeQuery)
  const { range, tilt } = calcArrivalRange(
    resolvedPlace.viewport,
    resolvedPlace.types,
    input.landmarkName
  )

  const navigation = await navigateToLocation(
    resolvedPlace.lat,
    resolvedPlace.lng,
    range,
    tilt
  )

  if (!navigation.ok) {
    throw new Error('Map is not ready yet.')
  }

  const settleDelayMs = 1_000
  const overlayDurationMs = getOverlayDurationMs(input.landmarkName)

  await sleep(settleDelayMs)
  input.onOverlayStart?.({
    displayName: input.landmarkName,
    preset: input.overlayPreset,
    tagline: input.tagline,
  })
  await sleep(overlayDurationMs)

  return {
    itineraryId: input.itineraryId,
    cityName: input.cityName,
    countryName: input.countryName,
    landmarkName: input.landmarkName,
    overlayPreset: input.overlayPreset,
    tagline: input.tagline,
    placeQuery,
    formattedAddress: resolvedPlace.formattedAddress,
    placeTypes: resolvedPlace.types,
    lat: resolvedPlace.lat,
    lng: resolvedPlace.lng,
    arrivalRange: range,
    arrivalTilt: tilt,
    settleDelayMs,
    overlayDurationMs,
  }
}

function buildLandmarkGeocodeQuery(
  landmarkName: string,
  cityName: string,
  countryName: string
): string {
  return `${landmarkName}, ${cityName}, ${countryName}`
}

function getOverlayDurationMs(displayName: string): number {
  return displayName.length * LETTER_MS + TAGLINE_DELAY_MS + HOLD_MS + EXIT_MS
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
