declare namespace google.maps {
  function importLibrary(library: string): Promise<unknown>
}

declare namespace google.maps.maps3d {
  class Map3DElement extends HTMLElement {
    constructor(options?: {
      center?: { lat: number; lng: number; altitude?: number }
      range?: number
      tilt?: number
      heading?: number
      roll?: number
      mode?: 'HYBRID' | 'SATELLITE'
      fov?: number
    })
    center: { lat: number; lng: number; altitude: number }
    heading: number
    tilt: number
    range: number
    roll: number
    flyCameraTo(opts: {
      endCamera: {
        center?: { lat: number; lng: number; altitude?: number }
        tilt?: number
        heading?: number
        range?: number
      }
      durationMillis?: number
    }): Promise<void>
    flyCameraAround(opts: {
      camera: {
        center?: { lat: number; lng: number; altitude?: number }
        tilt?: number
        heading?: number
        range?: number
      }
      durationMillis?: number
      repeatCount?: number
    }): Promise<void>
    stopCameraAnimation(): void
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ): void
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ): void
  }
}

declare namespace google.maps {
  class StreetViewPanorama {
    constructor(container: HTMLElement, opts?: StreetViewPanoramaOptions)
    setPosition(latLng: { lat: number; lng: number }): void
    setVisible(visible: boolean): void
    setPano(pano: string): void
    getVisible(): boolean
    addListener(event: string, handler: () => void): void
  }

  interface StreetViewPanoramaOptions {
    position?: { lat: number; lng: number }
    pov?: { heading: number; pitch: number }
    disableDefaultUI?: boolean
    clickToGo?: boolean
    showRoadLabels?: boolean
  }

  interface StreetViewPanoramaData {
    location?: {
      pano?: string
      latLng?: { lat: () => number; lng: () => number }
      description?: string
    }
  }

  class StreetViewService {
    getPanorama(request: {
      location: { lat: number; lng: number }
      radius?: number
      sources?: string[]
    }): Promise<{ data: StreetViewPanoramaData }>
  }

  const StreetViewStatus: {
    OK: string
    UNKNOWN_ERROR: string
    ZERO_RESULTS: string
  }
}

interface Window {
  google?: {
    maps?: {
      importLibrary?: (library: string) => Promise<unknown>
    }
  }
}

declare namespace google.maps {
  // Geocoder — callback form used by smartRange.ts
  class Geocoder {
    geocode(
      request: { address?: string; location?: { lat: number; lng: number } },
      callback: (results: GeocoderResult[] | null, status: string) => void
    ): void
  }

  interface GeocoderResult {
    types: string[]
    formatted_address: string
    geometry: {
      location: { lat(): number; lng(): number }
      viewport: {
        getNorthEast(): { lat(): number; lng(): number }
        getSouthWest(): { lat(): number; lng(): number }
      }
    }
    address_components: Array<{ long_name: string; short_name: string; types: string[] }>
  }

  // Places — used by nearbySearch.ts (v=alpha already loads this)
  interface PlacesLibrary {
    Place: typeof Place
  }

  class Place {
    id: string | null
    displayName: string | null
    formattedAddress: string | null
    location: { lat(): number; lng(): number } | null
    rating: number | null
    userRatingCount: number | null
    types: string[] | null
    photos: Array<{ getURI(opts: { maxWidth: number }): string }> | null
    priceLevel: number | null
    static searchNearby(request: {
      fields: string[]
      locationRestriction: { center: LatLng; radius: number }
      includedTypes: string[]
      maxResultCount: number
      rankPreference?: unknown
      language?: string
    }): Promise<{ places: Place[] }>
    static SearchNearbyRankPreference: { POPULARITY: unknown }
  }

  class LatLng {
    constructor(lat: number, lng: number)
    lat(): number
    lng(): number
  }
}
