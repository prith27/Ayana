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
}

/**
 * Pure sync calculation. Priority: keyword name → viewport → type presets → default.
 */
export function calcArrivalRange(
  viewport?: Viewport,
  types?: string[],
  name?: string,
): ArrivalCamera {
  if (name) {
    const classified = classifyByName(name)
    if (classified) return classified
  }
  if (viewport) {
    const ne = viewport.getNorthEast()
    const sw = viewport.getSouthWest()
    const diag = haversineDistance(
      { lat: ne.lat(), lng: ne.lng() },
      { lat: sw.lat(), lng: sw.lng() }
    )
    return { range: clamp(diag * 2, 300, 50_000), tilt: DEFAULT_TILT }
  }
  return { range: rangeFromTypes(types ?? []), tilt: DEFAULT_TILT }
}

/**
 * Async — reverse geocodes lat/lng to get viewport + types, then calls calcArrivalRange.
 * Accepts optional name for keyword classification and overrides for per-stop control.
 * Returns DEFAULT_RANGE/TILT on any failure.
 */
export function resolveArrivalRange(
  lat: number,
  lng: number,
  name?: string,
  overrides?: { range?: number; tilt?: number },
): Promise<ArrivalCamera> {
  // Explicit per-stop override — highest priority, skip all logic
  if (overrides?.range !== undefined && overrides?.tilt !== undefined) {
    return Promise.resolve({ range: overrides.range, tilt: overrides.tilt })
  }

  // Keyword classifier is sync — if matched, skip the geocoder network call
  if (name) {
    const classified = classifyByName(name)
    if (classified) return Promise.resolve(classified)
  }

  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.google?.maps) {
      resolve({ range: DEFAULT_RANGE, tilt: DEFAULT_TILT })
      return
    }
    try {
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const r = results[0]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const viewport = (r as any).geometry?.viewport as Viewport | undefined
          resolve(calcArrivalRange(viewport, r.types, name))
        } else {
          resolve({ range: DEFAULT_RANGE, tilt: DEFAULT_TILT })
        }
      })
    } catch {
      resolve({ range: DEFAULT_RANGE, tilt: DEFAULT_TILT })
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
