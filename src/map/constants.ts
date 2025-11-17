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

/**
 * Terrain Styles - Clean 4-type system
 * Maps terrain types to Leaflet path options
 */
export const TERRAIN_STYLES = {
  road: {
    color: '#4a90e2',      // Blue - roads
    weight: 4,
    opacity: 0.9,
    dashArray: '0'
  },
  open: {
    color: '#228B22',      // Green - open terrain (was 'medium')
    weight: 2,
    opacity: 0.7,
    fillColor: '#228B22',
    fillOpacity: 0.3,
    dashArray: '4, 8'
  },
  difficult: {
    color: '#f5a623',      // Orange - rough terrain
    weight: 3,
    opacity: 0.85,
    fillColor: '#f5a623',
    fillOpacity: 0.25,
    dashArray: '4,4'
  },
  impassable: {
    color: '#d0021b',      // Red - cannot cross (was 'unpassable')
    weight: 3,
    opacity: 0.9,
    fillColor: '#d0021b',
    fillOpacity: 0.4
  }
} as const

/**
 * Terrain Costs - Clean 4-type system
 * Lower = faster travel, higher = slower
 */
export const TERRAIN_COSTS = {
  road: 0.7,        // Fast travel on roads
  open: 1.0,        // Normal speed on open terrain
  difficult: 2.0,   // Slow travel on rough terrain
  impassable: 999   // Cannot cross (water in land mode, land in sea mode)
} as const

/**
 * Get terrain cost based on travel mode
 * User's brilliant insight: just flip the logic!
 *
 * - Land mode: impassable = water (can't cross)
 * - Sea mode: impassable = fast sailing, everything else = can't cross
 */
export function getTerrainCost(
  terrainType: keyof typeof TERRAIN_COSTS,
  isSeaMode: boolean
): number {
  if (isSeaMode) {
    // Sea mode: only water (impassable in land mode) is passable
    return terrainType === 'impassable' ? 0.3 : 999
  } else {
    // Land mode: normal costs
    return TERRAIN_COSTS[terrainType]
  }
}

export function getTerrainStyle(terrainType: keyof typeof TERRAIN_STYLES) {
  return TERRAIN_STYLES[terrainType] || {
    color: '#cccccc',
    weight: 1,
    opacity: 0.5
  }
}

/**
 * Map configuration
 */
export const MAP_CONFIG = {
  kmPerPixel: 100 / 115, // 0.8695652174 (115 pixels = 100 km)

  travelProfiles: {
    walking: { label: 'Walking', landSpeed: 30, seaSpeed: 120 },
    wagon:   { label: 'Wagon',   landSpeed: 50, seaSpeed: 120 },
    horse:   { label: 'Horse',   landSpeed: 60, seaSpeed: 120 }
  }
} as const

/**
 * Marker rendering constants
 * Controls how markers appear and scale on the map
 */
export const MARKER_CONSTANTS = {
  // Zoom behavior
  ZOOM_THROTTLE_MS: 100,           // Throttle marker updates during zoom (100ms)

  // Icon sizing
  ICON_SIZE_MIN: 22,               // Minimum icon size at lowest zoom (px)
  ICON_SIZE_MAX: 140,              // Maximum icon size at highest zoom (px)
  ZOOM_EASE_FACTOR: 1.15,          // Power curve for zoom interpolation (>1 = larger bias)

  // Emoji scaling
  EMOJI_FONT_SCALE: 0.78,          // Font size as percentage of icon size (78%)

  // Default size
  DEFAULT_ICON_SIZE: 32            // Fallback icon size (px)
} as const

/**
 * Routing performance constants
 * Controls debouncing and throttling for route calculations
 */
export const ROUTING_CONSTANTS = {
  // Debounce timings
  TERRAIN_REBUILD_DEBOUNCE_MS: 500,  // Wait 500ms after terrain drawing stops
  ROUTE_UPDATE_DEBOUNCE_MS: 300,     // Wait 300ms after route changes

  // Graph building
  ROAD_ENTRY_PENALTY: 0.35,          // Cost penalty for entering road network
  ROAD_COST_MULTIPLIER: 0.4,         // Final multiplier for road costs
  SEA_TRAVEL_COST: 0.25,             // Cost for sea travel
  MIN_ROAD_COST: 0.15,               // Minimum road cost after calculations

  // Connection limits
  MAX_ROAD_CONNECTIONS: 3,           // Max road connections per node
  MAX_TERRAIN_CONNECTIONS: 4,        // Max terrain grid connections per node
  SEARCH_RADIUS: 100                 // Radius for searching nearby nodes
} as const
