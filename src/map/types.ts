// Type definitions for Nimea map system

import type * as L from 'leaflet'

export interface Marker {
  id: string
  name: string
  x: number
  y: number
  type: MarkerType
  faction?: string
  summary?: string
  customIcon?: string
  iconUrl?: string
  wikiSlug?: string
  images?: string[]
  public: boolean
  isPort?: boolean
  banner?: string
  i18n?: {
    tr: {
      name: string
      summary: string
      faction?: string
    }
    en: {
      name: string
      summary: string
      faction?: string
    }
  }
}

export type MarkerType =
  | 'city'
  | 'town'
  | 'village'
  | 'fortress'
  | 'ruin'
  | 'landmark'
  | 'dungeon'
  | 'character'
  | 'other'

export interface TerrainFeature {
  type: 'Feature'
  properties: {
    kind: TerrainType
    _internal_id: string
  }
  geometry: GeoJSON.Geometry
}

/**
 * Terrain Types - CLEAN MODEL
 *
 * Only 4 types needed:
 * - road: Fast travel roads
 * - open: Normal terrain (was 'medium')
 * - difficult: Rough terrain (mountains, swamps)
 * - impassable: Cannot cross in current mode
 *
 * Logic:
 * - Land mode: impassable = water/cliffs
 * - Sea mode: impassable = land (flip logic)
 *
 * No need for separate water/sea types - just flip what "impassable" means.
 */
export type TerrainType =
  | 'road'        // Roads (fast land travel)
  | 'open'        // Open terrain (normal speed)
  | 'difficult'   // Rough terrain (slow travel)
  | 'impassable'  // Cannot cross (water for land mode, land for sea mode)

export interface TerrainCollection {
  type: 'FeatureCollection'
  features: TerrainFeature[]
}

export interface RouteStop {
  marker: Marker
  index: number
}

export interface AppConfig {
  kmPerPixel: number
  terrainCosts: {
    road: number
    open: number
    difficult: number
    impassable: number
  }
  profiles: {
    walking: TravelProfile
    wagon: TravelProfile
    horse: TravelProfile
  }
  bounds?: {
    sw: [number, number]
    ne: [number, number]
  }
  backgroundImage?: {
    url: string
    bounds: [[number, number], [number, number]]
  }
}

export interface TravelProfile {
  label: string
  landSpeed: number
  seaSpeed: number
}

/**
 * Represents a segment of a route between two markers
 */
export interface RouteLeg {
  from: Marker
  to: Marker
  distance: number
  duration: number
  path: [number, number][]
}

export interface AppState {
  isDmMode: boolean
  focusMarker: string | null
  markers: Marker[]
  terrain: TerrainCollection
  route: RouteStop[]
  routeLegs: RouteLeg[]
  routePolylines: L.Polyline[]
  overlays: Record<string, L.LayerGroup>
  markersLayer: L.LayerGroup | null
  showMarkers: boolean
  isLiveCMS: boolean
  routePolyline: L.Polyline | null
  dirty: {
    markers: boolean
    terrain: boolean
  }
  travelMode: 'land' | 'sea'
  travelProfile: 'walking' | 'wagon' | 'horse'
}

export type Language = 'tr' | 'en'
