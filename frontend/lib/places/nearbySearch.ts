export interface NearbyPlace {
  placeId: string
  name: string
  rating: number | null
  userRatingCount: number | null
  address: string | null
  lat: number
  lng: number
  types: string[]
  photoUrl: string | null
  priceLevel: number | null
}

export type PlaceCategory = 'food' | 'shopping' | 'activities'

const CATEGORY_TYPES: Record<PlaceCategory, string[]> = {
  food:       ['restaurant', 'cafe', 'bakery', 'bar'],
  shopping:   ['shopping_mall', 'store', 'clothing_store'],
  activities: ['tourist_attraction', 'museum', 'park', 'spa'],
}

/**
 * Fetch up to maxResults nearby places for a category.
 * Sorted by rating × log(reviewCount) — balances quality and popularity.
 */
export async function fetchNearbyPlacesOrThrow(
  lat: number,
  lng: number,
  category: PlaceCategory,
  radiusMetres = 800,
  maxResults = 3
): Promise<NearbyPlace[]> {
  const lib = await google.maps.importLibrary('places') as google.maps.PlacesLibrary
  const { Place } = lib

  const { places } = await Place.searchNearby({
    fields: [
      'id', 'displayName', 'formattedAddress', 'location',
      'rating', 'userRatingCount', 'types', 'photos', 'priceLevel',
    ],
    locationRestriction: {
      center: new google.maps.LatLng(lat, lng),
      radius: radiusMetres,
    },
    includedTypes: CATEGORY_TYPES[category],
    maxResultCount: 10,
    language: 'en-US',
  })

  return places
    .map((p) => ({
      placeId: p.id ?? '',
      name: p.displayName ?? 'Unknown',
      rating: p.rating ?? null,
      userRatingCount: p.userRatingCount ?? null,
      address: p.formattedAddress ?? null,
      lat: p.location?.lat() ?? lat,
      lng: p.location?.lng() ?? lng,
      types: p.types ?? [],
      photoUrl: p.photos?.[0]?.getURI({ maxWidth: 640 }) ?? null,
      priceLevel: p.priceLevel ?? null,
    }))
    .sort((a, b) => {
      const score = (p: NearbyPlace) =>
        (p.rating ?? 0) * Math.log10(Math.max(p.userRatingCount ?? 1, 10))
      return score(b) - score(a)
    })
    .slice(0, maxResults)
}

/**
 * Compatibility wrapper for UI callers that prefer an empty state over a thrown error.
 */
export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  category: PlaceCategory,
  radiusMetres = 800,
  maxResults = 3
): Promise<NearbyPlace[]> {
  try {
    return await fetchNearbyPlacesOrThrow(
      lat,
      lng,
      category,
      radiusMetres,
      maxResults
    )
  } catch (err) {
    console.warn('[nearbySearch] failed:', err)
    return []
  }
}

export function formatPriceLevel(level: number | null): string {
  if (level === null) return ''
  return ['Free', '¥', '¥¥', '¥¥¥', '¥¥¥¥'][level] ?? ''
}
