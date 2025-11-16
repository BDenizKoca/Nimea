// Centralized constants for the map system

export const DM_CONSTANTS = {
  // Touch interaction
  TOUCH_DURATION_MS: 500,
  TOUCH_DISTANCE_PX: 10,

  // Terrain operations
  TERRAIN_MERGE_BUFFER: 0.0005, // degrees (~50m at equator)
  TERRAIN_SIMPLIFY_TOLERANCE: 0.0001,

  // Map defaults
  DEFAULT_ZOOM: 2.2,
  FLY_DURATION_SEC: 1.0,
  EASE_LINEARITY: 0.25,

  // Routing
  PORT_TO_SEA_DISTANCE_MULTIPLIER: 3,
  MAX_PORT_SEA_LINKS: 6,
  MAX_ROUTE_STOPS: 50,

  // Validation limits
  MAX_MARKER_NAME_LENGTH: 100,
  MAX_SUMMARY_LENGTH: 500,

  // Pathfinding
  TERRAIN_GRID_SIZE: 20,
  ROAD_CONNECTION_DISTANCE: 300,
  PATHFINDING_MAX_ITERATIONS: 50000,
  PATHFINDING_TIMEOUT_MS: 5000
} as const

export const TERRAIN_STYLES = {
  road: {
    color: '#4a90e2',
    weight: 4,
    opacity: 0.9,
    dashArray: '0'
  },
  normal: {
    color: '#90ee90',
    weight: 2,
    opacity: 0.4,
    fillOpacity: 0.2
  },
  forest: {
    color: '#228b22',
    weight: 2,
    opacity: 0.5,
    fillOpacity: 0.25
  },
  medium: {
    color: '#228B22',
    weight: 2,
    opacity: 0.7,
    fillColor: '#228B22',
    fillOpacity: 0.3,
    dashArray: '4, 8'
  },
  difficult: {
    color: '#f5a623',
    weight: 3,
    opacity: 0.85,
    fillColor: '#f5a623',
    fillOpacity: 0.25,
    dashArray: '4,4'
  },
  water: {
    color: '#4682b4',
    weight: 2,
    opacity: 0.6,
    fillOpacity: 0.3
  },
  unpassable: {
    color: '#d0021b',
    weight: 3,
    opacity: 0.9,
    fillColor: '#d0021b',
    fillOpacity: 0.4
  },
  blocked: {
    color: '#c0392b',
    weight: 2,
    opacity: 0.8,
    fillColor: '#c0392b',
    fillOpacity: 0.4
  }
} as const

export function getTerrainStyle(terrainType: keyof typeof TERRAIN_STYLES) {
  return TERRAIN_STYLES[terrainType] || {
    color: '#cccccc',
    weight: 1,
    opacity: 0.5
  }
}
