import { mapRef } from './mapRef'
import { playSwoosh } from './sound'

// ── Fly to lat/lng ──────────────────────────────────────────────────────────

export async function flyTo(
  lat: number,
  lng: number,
  opts: { range?: number; tilt?: number; heading?: number; durationMs?: number } = {}
): Promise<{ ok: boolean }> {
  const map = mapRef.current
  console.log('[cam] flyTo', { lat, lng, ...opts }, 'map:', !!map)
  if (!map) return { ok: false }
  await map.flyCameraTo({
    endCamera: {
      center: { lat, lng, altitude: 0 },
      tilt: opts.tilt ?? 68,
      heading: opts.heading ?? 0,
      range: opts.range ?? 900,
    },
    durationMillis: opts.durationMs ?? 3_000,
  }).catch((e) => console.log('[cam] flyTo interrupted', e))
  return { ok: true }
}

// ── Cinematic fly-in + single orbit ─────────────────────────────────────────

export async function flyInWithOrbit(lat: number, lng: number): Promise<{ ok: boolean }> {
  const map = mapRef.current
  console.log('[cam] flyInWithOrbit', { lat, lng }, 'map:', !!map)
  if (!map) return { ok: false }
  await map.flyCameraTo({
    endCamera: { center: { lat, lng, altitude: 0 }, tilt: 68, heading: 0, range: 900 },
    durationMillis: 3_500,
  }).catch((e) => console.log('[cam] flyInWithOrbit swoop interrupted', e))
  console.log('[cam] flyInWithOrbit complete')
  return { ok: true }
}

// ── Navigate between locations: pull back → swoosh → swoop in ───────────────

export async function navigateToLocation(
  lat: number,
  lng: number,
  arrivalRange = 450,
  arrivalTilt  = 68,
): Promise<{ ok: boolean }> {
  const map = mapRef.current
  console.log('[cam] navigateToLocation', { lat, lng, arrivalRange, arrivalTilt }, 'map:', !!map)
  if (!map) return { ok: false }

  playSwoosh()

  // Step 1 — pull back high enough to clearly see the zoom-out (2s)
  await map.flyCameraTo({
    endCamera: { center: map.center, tilt: 10, heading: map.heading, range: 200_000 },
    durationMillis: 2_000,
  }).catch((e) => console.log('[cam] navigateToLocation pullback interrupted', e))

  // Step 2 — swoop into destination at per-location arrival range + tilt
  await map.flyCameraTo({
    endCamera: { center: { lat, lng, altitude: 0 }, tilt: arrivalTilt, heading: 0, range: arrivalRange },
    durationMillis: 3_000,
  }).catch((e) => console.log('[cam] navigateToLocation swoop interrupted', e))

  return { ok: true }
}

// ── Quick fly between locations ──────────────────────────────────────────────

export async function flyToLocation(lat: number, lng: number): Promise<{ ok: boolean }> {
  console.log('[cam] flyToLocation', { lat, lng })
  return flyTo(lat, lng, { range: 900, tilt: 68, durationMs: 3_000 })
}

// ── Continuous orbit ────────────────────────────────────────────────────────

export async function orbit(opts: {
  speed?: 'slow' | 'medium' | 'fast'
  repeatCount?: number
} = {}): Promise<{ ok: boolean }> {
  const map = mapRef.current
  console.log('[cam] orbit', opts, 'map:', !!map)
  if (!map) return { ok: false }
  const durationMs =
    opts.speed === 'fast' ? 8_000 :
    opts.speed === 'medium' ? 15_000 : 25_000
  await map.flyCameraAround({
    camera: { center: map.center, tilt: map.tilt, heading: map.heading, range: map.range },
    durationMillis: durationMs,
    repeatCount: opts.repeatCount ?? 1,
  }).catch((e) => console.log('[cam] orbit interrupted', e))
  return { ok: true }
}

// ── Stop animation ──────────────────────────────────────────────────────────

export function stopAnimation(): { ok: boolean } {
  console.log('[cam] stopAnimation, map:', !!mapRef.current)
  mapRef.current?.stopCameraAnimation()
  return { ok: !!mapRef.current }
}

// ── Zoom in/out ──────────────────────────────────────────────────────────────

export async function zoomIn(): Promise<{ ok: boolean }> {
  const map = mapRef.current
  console.log('[cam] zoomIn, current range:', map?.range)
  if (!map) return { ok: false }
  await map.flyCameraTo({
    endCamera: {
      center: map.center,
      tilt: map.tilt,
      heading: map.heading,
      range: Math.max(150, map.range * 0.5),
    },
    durationMillis: 1_200,
  }).catch((e) => console.log('[cam] zoomIn interrupted', e))
  return { ok: true }
}

export async function zoomOut(): Promise<{ ok: boolean }> {
  const map = mapRef.current
  console.log('[cam] zoomOut, current range:', map?.range)
  if (!map) return { ok: false }
  await map.flyCameraTo({
    endCamera: {
      center: map.center,
      tilt: map.tilt,
      heading: map.heading,
      range: Math.min(22_000_000, map.range * 2),
    },
    durationMillis: 1_200,
  }).catch((e) => console.log('[cam] zoomOut interrupted', e))
  return { ok: true }
}

// ── Preset views ────────────────────────────────────────────────────────────

export async function groundLevel(): Promise<{ ok: boolean }> {
  const map = mapRef.current
  console.log('[cam] groundLevel, map:', !!map)
  if (!map) return { ok: false }
  await map.flyCameraTo({
    endCamera: { center: map.center, tilt: 78, heading: map.heading, range: 150 },
    durationMillis: 2_000,
  }).catch((e) => console.log('[cam] groundLevel interrupted', e))
  return { ok: true }
}

export async function cityView(): Promise<{ ok: boolean }> {
  const map = mapRef.current
  console.log('[cam] cityView, map:', !!map)
  if (!map) return { ok: false }
  await map.flyCameraTo({
    endCamera: { center: map.center, tilt: 45, heading: 0, range: 8_000 },
    durationMillis: 2_500,
  }).catch((e) => console.log('[cam] cityView interrupted', e))
  return { ok: true }
}

export async function overviewPullback(): Promise<{ ok: boolean }> {
  const map = mapRef.current
  console.log('[cam] overviewPullback, map:', !!map)
  if (!map) return { ok: false }
  await map.flyCameraTo({
    endCamera: { center: map.center, tilt: 15, heading: 0, range: 60_000 },
    durationMillis: 3_000,
  }).catch((e) => console.log('[cam] overviewPullback interrupted', e))
  return { ok: true }
}

// ── Tilt adjust ─────────────────────────────────────────────────────────────

export async function tiltUp(): Promise<{ ok: boolean }> {
  const map = mapRef.current
  console.log('[cam] tiltUp, current tilt:', map?.tilt)
  if (!map) return { ok: false }
  await map.flyCameraTo({
    endCamera: {
      center: map.center,
      heading: map.heading,
      range: map.range,
      tilt: Math.min(90, map.tilt + 10),
    },
    durationMillis: 800,
  }).catch((e) => console.log('[cam] tiltUp interrupted', e))
  return { ok: true }
}

export async function tiltDown(): Promise<{ ok: boolean }> {
  const map = mapRef.current
  console.log('[cam] tiltDown, current tilt:', map?.tilt)
  if (!map) return { ok: false }
  await map.flyCameraTo({
    endCamera: {
      center: map.center,
      heading: map.heading,
      range: map.range,
      tilt: Math.max(0, map.tilt - 10),
    },
    durationMillis: 800,
  }).catch((e) => console.log('[cam] tiltDown interrupted', e))
  return { ok: true }
}

// ── Street View bridge ───────────────────────────────────────────────────────
// Register the StreetViewOverlay enter function from CameraWidget so that
// flyToPlaceStreetView can open Street View without a direct React ref dependency.

let _svEnter: ((lat: number, lng: number) => Promise<void>) | null = null

export function registerSVEnter(fn: (lat: number, lng: number) => Promise<void>): void {
  _svEnter = fn
}

// ── Fly to a nearby POI then drop into Street View ───────────────────────────

export async function flyToPlaceStreetView(lat: number, lng: number): Promise<{ ok: boolean }> {
  console.log('[cam] flyToPlaceStreetView', { lat, lng })
  await navigateToLocation(lat, lng, 400)
  await _svEnter?.(lat, lng)
  return { ok: true }
}
