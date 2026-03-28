export interface GeocodedPlace {
  lat: number
  lng: number
  formattedAddress: string
  types: string[]
  viewport?: {
    getNorthEast(): { lat(): number; lng(): number }
    getSouthWest(): { lat(): number; lng(): number }
  }
}

const CITY_LIKE_TYPES = [
  'locality',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
  'country',
] as const

function waitForGoogleMaps(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (typeof window !== 'undefined' && typeof window.google?.maps?.importLibrary === 'function') {
        resolve()
      } else {
        window.setTimeout(check, 100)
      }
    }

    check()
  })
}

function scoreResult(result: google.maps.GeocoderResult): number {
  return result.types.reduce((score, type) => {
    return score + (CITY_LIKE_TYPES.includes(type as (typeof CITY_LIKE_TYPES)[number]) ? 1 : 0)
  }, 0)
}

function normalizeResult(result: google.maps.GeocoderResult): GeocodedPlace {
  return {
    lat: result.geometry.location.lat(),
    lng: result.geometry.location.lng(),
    formattedAddress: result.formatted_address,
    types: result.types,
    viewport: result.geometry.viewport,
  }
}

export async function geocodePlaceQuery(query: string): Promise<GeocodedPlace> {
  await waitForGoogleMaps()

  return new Promise((resolve, reject) => {
    try {
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ address: query }, (results, status) => {
        if (status !== 'OK' || !results?.length) {
          reject(new Error(`Unable to resolve "${query}".`))
          return
        }

        const rankedResults = [...results].sort((a, b) => scoreResult(b) - scoreResult(a))
        resolve(normalizeResult(rankedResults[0]))
      })
    } catch {
      reject(new Error(`Unable to resolve "${query}".`))
    }
  })
}

export function buildCityGeocodeQuery(cityName: string, countryName: string): string {
  return `${cityName}, ${countryName}`
}
