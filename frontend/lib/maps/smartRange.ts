// Smart arrival range — calculates ideal camera distance and tilt for any location.
// Priority: explicit override → keyword scale classifier → Places API viewport → type presets → default.

const DEFAULT_RANGE = 900
const DEFAULT_TILT  = 68

// First match wins
const TYPE_RANGES: [string, number][] = [
  ['natural_feature',      25_000],
  ['mountain',             25_000],
  ['peak',                 25_000],
  ['park',                  8_000],
  ['national_park',         8_000],
  ['locality',             15_000],
  ['sublocality',           5_000],
  ['neighborhood',          5_000],
  ['tourist_attraction',    1_200],
  ['museum',                1_200],
  ['restaurant',              400],
  ['food',                    400],
  ['store',                   400],
  ['shopping_mall',           800],
  ['point_of_interest',       900],
  ['establishment',           900],
]

// Keywords indicating a large geographic-scale feature — pull back far, lower tilt
const GEOGRAPHIC_KEYWORDS = [
  'mountain', 'mount', 'mt.', 'mt ', 'fuji', 'peak', 'summit',
  'volcano', 'canyon', 'valley', 'lake', 'falls', 'waterfall',
  'glacier', 'fjord', 'cape', 'island', 'bay', 'coast', 'cliff',
]

// Keywords indicating a tall narrow structure — medium range, steep tilt to look up
const TALL_STRUCTURE_KEYWORDS = [
  'tower', 'bridge', 'arch', 'spire', 'obelisk', 'statue',
  'needle', 'pagoda', 'minaret', 'steeple', 'lighthouse', 'column',
]

const SCALE_PRESETS = {
  geographic:       { range: 18_000, tilt: 50 },
  'tall-structure': { range: 750,    tilt: 78 },
}

function classifyByName(name: string): { range: number; tilt: number } | null {
  const lower = name.toLowerCase()
  if (GEOGRAPHIC_KEYWORDS.some(k => lower.includes(k)))     return SCALE_PRESETS['geographic']
  if (TALL_STRUCTURE_KEYWORDS.some(k => lower.includes(k))) return SCALE_PRESETS['tall-structure']
  return null
}

interface Viewport {
  getNorthEast(): { lat(): number; lng(): number }
  getSouthWest(): { lat(): number; lng(): number }
}

export interface ArrivalCamera {
  range: number
  tilt: number
  altitude: number
}

// Altitude estimate by type — used as sync fallback when ElevationService unavailable
function altitudeEstimateFromTypes(types: string[]): number {
  for (const t of types) {
    if (['mountain', 'peak', 'natural_feature'].includes(t)) return 1_500
  }
  return 0
}

// Adjust range to account for elevation so the camera maintains correct visual distance
function altitudeAdjustedRange(baseRange: number, altitude: number): number {
  if (altitude < 100) return baseRange
  return Math.round(Math.sqrt(baseRange ** 2 + altitude ** 2) * 1.1)
}

/**
 * Pure sync calculation. Priority: keyword name → viewport → type presets → default.
 * Accepts optional elevation (metres) to adjust range and tilt for elevated terrain.
 */
export function calcArrivalRange(
  viewport?: Viewport,
  types?: string[],
  name?: string,
  elevation?: number,
): ArrivalCamera {
  const altitude = elevation ?? altitudeEstimateFromTypes(types ?? [])

  if (name) {
    const classified = classifyByName(name)
    if (classified) {
      const range = altitudeAdjustedRange(classified.range, altitude)
      const tilt = altitude > 500 && classified.tilt >= 50 ? 45 : classified.tilt
      return { range, tilt, altitude }
    }
  }
  if (viewport) {
    const ne = viewport.getNorthEast()
    const sw = viewport.getSouthWest()
    const diag = haversineDistance(
      { lat: ne.lat(), lng: ne.lng() },
      { lat: sw.lat(), lng: sw.lng() }
    )
    const baseRange = clamp(diag * 2, 300, 50_000)
    return { range: altitudeAdjustedRange(baseRange, altitude), tilt: DEFAULT_TILT, altitude }
  }
  const baseRange = rangeFromTypes(types ?? [])
  return { range: altitudeAdjustedRange(baseRange, altitude), tilt: DEFAULT_TILT, altitude }
}

/**
 * Fetch terrain elevation for a lat/lng via google.maps.ElevationService.
 * Resolves to 0 on any failure or timeout (safe fallback for flat terrain).
 */
function fetchElevation(lat: number, lng: number): Promise<number> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(0), 1_500)
    if (typeof window === 'undefined' || !window.google?.maps?.ElevationService) {
      clearTimeout(timeout)
      resolve(0)
      return
    }
    try {
      const elevator = new google.maps.ElevationService()
      elevator.getElevationForLocations(
        { locations: [{ lat, lng }] },
        (results: google.maps.ElevationResult[] | null, status: google.maps.ElevationStatus) => {
          clearTimeout(timeout)
          if (status === 'OK' && results?.[0]) {
            resolve(Math.max(0, results[0].elevation))
          } else {
            resolve(0)
          }
        }
      )
    } catch {
      clearTimeout(timeout)
      resolve(0)
    }
  })
}

/**
 * Async — fetches terrain elevation + reverse geocodes lat/lng, then calls calcArrivalRange.
 * Accepts optional name for keyword classification and overrides for per-stop control.
 * Returns DEFAULT_RANGE/TILT/altitude:0 on any failure.
 */
export async function resolveArrivalRange(
  lat: number,
  lng: number,
  name?: string,
  overrides?: { range?: number; tilt?: number },
): Promise<ArrivalCamera> {
  // Always fetch elevation — never skip, even when range/tilt are overridden.
  // Elevation determines whether the camera targets the right 3D point.
  const elevationPromise = fetchElevation(lat, lng)

  // Explicit range+tilt override — use them, but still apply real elevation
  if (overrides?.range !== undefined && overrides?.tilt !== undefined) {
    const altitude = await elevationPromise
    const range = altitudeAdjustedRange(overrides.range, altitude)
    const tilt = altitude > 500 && overrides.tilt >= 50 ? 45 : overrides.tilt
    return { range, tilt, altitude }
  }

  // Keyword classifier — still needs elevation before returning
  if (name) {
    const classified = classifyByName(name)
    if (classified) {
      const altitude = await elevationPromise
      const range = altitudeAdjustedRange(classified.range, altitude)
      const tilt = altitude > 500 && classified.tilt >= 50 ? 45 : classified.tilt
      return { range, tilt, altitude }
    }
  }

  if (typeof window === 'undefined' || !window.google?.maps) {
    return { range: DEFAULT_RANGE, tilt: DEFAULT_TILT, altitude: 0 }
  }

  return new Promise((resolve) => {
    try {
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, async (results, status) => {
        const altitude = await elevationPromise
        if (status === 'OK' && results?.[0]) {
          const r = results[0]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const viewport = (r as any).geometry?.viewport as Viewport | undefined
          resolve(calcArrivalRange(viewport, r.types, name, altitude))
        } else {
          resolve({ range: DEFAULT_RANGE, tilt: DEFAULT_TILT, altitude })
        }
      })
    } catch {
      resolve({ range: DEFAULT_RANGE, tilt: DEFAULT_TILT, altitude: 0 })
    }
  })
}

function rangeFromTypes(types: string[]): number {
  for (const [type, range] of TYPE_RANGES) {
    if (types.includes(type)) return range
  }
  return DEFAULT_RANGE
}

function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function toRad(deg: number) { return (deg * Math.PI) / 180 }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }
