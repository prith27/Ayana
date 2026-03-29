/**
 * Transcript store — captures every AI and user turn during a live session,
 * persists to localStorage so the /recap page can read it after navigation.
 */

const STORAGE_KEY = 'ayana-session-transcript'

export interface TranscriptTurn {
  speaker: 'ai' | 'user'
  text: string
  timestamp: number
  /** Landmark or city that was active when this turn happened */
  location?: string
}

export interface LocationEvent {
  type: 'city' | 'landmark'
  name: string
  city?: string
  country?: string
  timestamp: number
}

export interface SessionTranscript {
  persona: string | null
  turns: TranscriptTurn[]
  locationEvents: LocationEvent[]
  startedAt: number
}

// ─── In-memory singleton ───────────────────────────────────────────────────

let _store: SessionTranscript = _emptyStore()
let _currentLocation: string | undefined

function _emptyStore(): SessionTranscript {
  return { persona: null, turns: [], locationEvents: [], startedAt: Date.now() }
}

function _persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_store))
  } catch {
    // localStorage may be unavailable (SSR / private browsing)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

/** Start a new transcript for the given persona, clearing any previous data. */
export function initTranscript(persona: string): void {
  _store = { ..._emptyStore(), persona, startedAt: Date.now() }
  _currentLocation = undefined
  _persist()
}

/** Record a completed AI utterance. */
export function addAITurn(text: string): void {
  if (!text.trim()) return
  _store.turns.push({
    speaker: 'ai',
    text: text.trim(),
    timestamp: Date.now(),
    location: _currentLocation,
  })
  _persist()
}

/** Record a completed user utterance. */
export function addUserTurn(text: string): void {
  if (!text.trim()) return
  _store.turns.push({
    speaker: 'user',
    text: text.trim(),
    timestamp: Date.now(),
    location: _currentLocation,
  })
  _persist()
}

/** Called when a city is activated (choose_itinerary applied). */
export function recordCityEvent(name: string, country: string): void {
  _currentLocation = `${name}, ${country}`
  _store.locationEvents.push({
    type: 'city',
    name,
    country,
    timestamp: Date.now(),
  })
  _persist()
}

/** Called when a landmark is activated (move_to_landmark applied). */
export function recordLandmarkEvent(name: string, city: string, country: string): void {
  _currentLocation = name
  _store.locationEvents.push({
    type: 'landmark',
    name,
    city,
    country,
    timestamp: Date.now(),
  })
  _persist()
}

/** Read the current in-memory transcript. */
export function getTranscript(): Readonly<SessionTranscript> {
  return _store
}

/** Load persisted transcript from localStorage (call on recap page). */
export function loadPersistedTranscript(): SessionTranscript | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionTranscript
  } catch {
    return null
  }
}
