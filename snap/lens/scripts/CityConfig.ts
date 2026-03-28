/**
 * CityConfig.ts — Ayana Teleport Me Lens
 *
 * Each city has 3 stations (viewpoints). The lens lets the user tap
 * navigation arrows to walk between them.
 *
 * Cubemap filenames match generate_cubemaps.py output:
 *   {city_id}_s{station_index}.png
 *
 * SET ACTIVE_CITY_ID before publishing each lens.
 */

export interface StationDefinition {
  index: number
  label: string          // shown on the location dot tooltip / mini-map
  sublabel: string       // e.g. "200 m north" — distance/direction cue for user
}

export interface CityDefinition {
  id: string
  displayName: string
  country: string
  tagline: string
  accentColor: string    // hex — used for UI accent line
  stations: StationDefinition[]
}

export const CITIES: Record<string, CityDefinition> = {

  eiffeltower: {
    id: 'eiffeltower',
    displayName: 'Eiffel Tower',
    country: 'Paris, France',
    tagline: 'The iron lady of Paris',
    accentColor: '#F59E0B',
    stations: [
      { index: 0, label: 'Trocadéro',      sublabel: 'Classic full view'       },
      { index: 1, label: 'Champ de Mars',  sublabel: 'Garden approach'         },
      { index: 2, label: 'Pont d\'Iéna',   sublabel: 'Under the tower'         },
    ],
  },

  cancunbeach: {
    id: 'cancunbeach',
    displayName: 'Cancun Beach',
    country: 'Cancun, Mexico',
    tagline: 'Caribbean blue, infinite sky',
    accentColor: '#06B6D4',
    stations: [
      { index: 0, label: 'Hotel Zone',     sublabel: 'Resort + beachfront'     },
      { index: 1, label: 'Playa Delfines', sublabel: 'Open beach & clear water'},
      { index: 2, label: 'Lagoon Side',    sublabel: 'Turquoise lagoon view'   },
    ],
  },

  mountfuji: {
    id: 'mountfuji',
    displayName: 'Mount Fuji',
    country: 'Shizuoka, Japan',
    tagline: 'Roof of Japan',
    accentColor: '#8B5CF6',
    stations: [
      { index: 0, label: 'Lake Kawaguchi', sublabel: 'Classic lake reflection' },
      { index: 1, label: 'Fujiyoshida',    sublabel: 'Town at the base'        },
      { index: 2, label: '5th Station',    sublabel: 'On the mountain'         },
    ],
  },

}

/**
 * Change this to the city this lens represents before publishing.
 * One lens = one city, all 3 stations included.
 */
export const ACTIVE_CITY_ID = 'eiffeltower'
export const ACTIVE_CITY: CityDefinition = CITIES[ACTIVE_CITY_ID]
