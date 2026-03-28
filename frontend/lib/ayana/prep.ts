export type Persona = 'adventure' | 'romantic' | 'peaceful'

export type LandmarkFacet = 'sightseeing' | 'food' | 'activity' | 'shopping'

export const PERSONA_META: Record<
  Persona,
  { label: string; accent: string; borderAlpha: string }
> = {
  adventure: {
    label: 'Adventure',
    accent: '#D4692A',
    borderAlpha: 'rgba(212,105,42,0.28)',
  },
  romantic: {
    label: 'Romantic',
    accent: '#C45C72',
    borderAlpha: 'rgba(196,92,114,0.26)',
  },
  peaceful: {
    label: 'Peaceful',
    accent: '#22A898',
    borderAlpha: 'rgba(34,168,152,0.24)',
  },
}

export interface AyanaPrepRequest {
  persona: Persona
}

export interface AyanaPrepLandmark {
  id: string
  name: string
  short_label?: string | null
  order_index: number
  why_this_stop: string
  facts: string[]
  facets: LandmarkFacet[]
}

export interface AyanaPrepItinerary {
  id: string
  city_name: string
  country_name: string
  title: string
  pitch: string
  why_it_fits_persona: string
  city_facts: string[]
  landmarks: AyanaPrepLandmark[]
}

export interface AyanaPrepResponse {
  prep_id: string
  persona: Persona
  itineraries: AyanaPrepItinerary[]
}

export async function fetchAyanaPrep(
  request: AyanaPrepRequest
): Promise<AyanaPrepResponse> {
  const response = await fetch('/api/ayana/prep', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorDetail = await safeReadError(response)
    throw new Error(errorDetail)
  }

  return response.json() as Promise<AyanaPrepResponse>
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload?.detail) {
      return payload.detail
    }
  } catch {
    // Ignore JSON parse errors and fall back to a generic message.
  }

  return 'Unable to prepare journeys right now.'
}
