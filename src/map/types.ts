// Type definitions for Nimea map system

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

export type TerrainType =
  | 'road'
  | 'normal'
  | 'forest'
  | 'medium'
  | 'difficult'
  | 'water'
  | 'sea'
  | 'unpassable'
  | 'blocked'

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
  terrainCosts: Record<TerrainType, number>
  waterTerrainKinds: TerrainType[]
  profiles: {
    walking: TravelProfile
    wagon: TravelProfile
    horse: TravelProfile
  }
}

export interface TravelProfile {
  label: string
  landSpeed: number
  seaSpeed: number
}

export interface AppState {
  isDmMode: boolean
  focusMarker: string | null
  markers: Marker[]
  terrain: TerrainCollection
  route: RouteStop[]
  routeLegs: any[]
  routePolylines: any[]
  overlays: Record<string, any>
  markersLayer: L.LayerGroup | null
  showMarkers: boolean
  isLiveCMS: boolean
  routePolyline: L.Polyline | null
  dirty: {
    markers: boolean
    terrain: boolean
  }
  travelMode: 'walking' | 'wagon' | 'horse'
  enableSeaTravel: boolean
  travelProfile: 'walking' | 'wagon' | 'horse'
}

export type Language = 'tr' | 'en'
