import {
  exitStreetView,
  flyToPlaceStreetView,
  navigateToLocation,
} from '@/lib/maps/cameraControls'
import { calcArrivalRange } from '@/lib/maps/smartRange'
import { buildCityGeocodeQuery, geocodePlaceQuery } from '@/lib/maps/geocoding'
import { EXIT_MS, HOLD_MS, LETTER_MS, TAGLINE_DELAY_MS } from '@/components/map/CityOverlay'
import {
  getLatestNearbyResult,
  hideSidebar,
  openCategorySidebar,
  type SidebarData,
} from '@/lib/maps/sidebarControls'
import type { NearbyPlace, PlaceCategory } from '@/lib/places/nearbySearch'

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

export interface ShowNearbyInput {
  category: PlaceCategory
  sidebarData: SidebarData
}

export interface ShowNearbyResult {
  category: PlaceCategory
  locationName: string
  locationSub: string
  places: NearbyPlace[]
}

export interface OpenPlaceStreetViewResult {
  category: PlaceCategory
  locationName: string
  locationSub: string
  placeName: string
  address: string | null
  rating: number | null
  userRatingCount: number | null
  types: string[]
  lat: number
  lng: number
}

export async function activateCity(
  input: CityActivationInput
): Promise<CityActivationResult> {
  await exitStreetView()
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
  await exitStreetView()
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

export async function showNearby(
  input: ShowNearbyInput
): Promise<ShowNearbyResult> {
  await exitStreetView()
  const result = await openCategorySidebar(input.category, input.sidebarData)
  return {
    category: result.category,
    locationName: result.data.locationName,
    locationSub: result.data.locationSub,
    places: result.places,
  }
}

function normalizePlaceNameForMatch(value: string): string {
  return value.trim().toLowerCase()
}

export async function openPlaceStreetView(
  placeName: string
): Promise<OpenPlaceStreetViewResult> {
  const trimmed = placeName.trim()
  if (!trimmed) {
    throw new Error('place_name must be a non-empty string.')
  }

  const latest = getLatestNearbyResult()
  if (!latest) {
    throw new Error(
      'No nearby results are available. Run nearby discovery first.'
    )
  }

  const token = normalizePlaceNameForMatch(trimmed)
  const place = latest.places.find(
    (p) => normalizePlaceNameForMatch(p.name) === token
  )
  if (!place) {
    throw new Error(
      `"${trimmed}" is not in the current nearby results. Use an exact name from the list.`
    )
  }

  hideSidebar()
  await exitStreetView()

  const nav = await flyToPlaceStreetView(place.lat, place.lng)
  if (!nav.ok) {
    throw new Error('Unable to enter Street View.')
  }

  return {
    category: latest.category,
    locationName: latest.data.locationName,
    locationSub: latest.data.locationSub,
    placeName: place.name,
    address: place.address,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    types: place.types,
    lat: place.lat,
    lng: place.lng,
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
