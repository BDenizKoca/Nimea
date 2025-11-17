// Terrain cost calculation and geometry utilities

import type { TerrainCosts } from './types'
import { $terrain } from '../../stores'

// Water terrain kinds that should be treated as impassable (unless sea travel mode)
const WATER_KINDS = new Set(['impassable'])

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function pointInPolygon(point: [number, number], ring: number[][]): boolean {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1]
    const xj = ring[j][0],
      yj = ring[j][1]

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Get all polygon rings from a geometry (handles Polygon and MultiPolygon)
 */
function polygonRings(geometry: any): number[][][] {
  if (!geometry) return []
  if (geometry.type === 'Polygon') return geometry.coordinates || []
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates ? geometry.coordinates.flat() : []
  }
  return []
}

/**
 * Check if point is in any ring of the geometry
 */
function pointInAnyRing(point: [number, number], geometry: any): boolean {
  const rings = polygonRings(geometry)
  for (const ring of rings) {
    if (ring && ring.length && pointInPolygon(point, ring)) {
      return true
    }
  }
  return false
}

/**
 * Check if a line segment intersects a polygon
 */
function lineIntersectsPolygon(
  lineStart: [number, number],
  lineEnd: [number, number],
  ring: number[][]
): boolean {
  // Simple check: if either endpoint is inside, line intersects
  if (pointInPolygon(lineStart, ring) || pointInPolygon(lineEnd, ring)) {
    return true
  }

  // Check if line segment crosses any polygon edge
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const p1 = ring[j]
    const p2 = ring[i]

    if (lineSegmentsIntersect(lineStart, lineEnd, [p1[0], p1[1]], [p2[0], p2[1]])) {
      return true
    }
  }

  return false
}

/**
 * Check if two line segments intersect
 */
function lineSegmentsIntersect(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number]
): boolean {
  const det =
    (a2[0] - a1[0]) * (b2[1] - b1[1]) - (b2[0] - b1[0]) * (a2[1] - a1[1])

  if (det === 0) return false

  const lambda =
    ((b2[1] - b1[1]) * (b2[0] - a1[0]) + (b1[0] - b2[0]) * (b2[1] - a1[1])) / det
  const gamma =
    ((a1[1] - a2[1]) * (b2[0] - a1[0]) + (a2[0] - a1[0]) * (b2[1] - a1[1])) / det

  return lambda > 0 && lambda < 1 && gamma > 0 && gamma < 1
}

/**
 * Check if line intersects any ring in geometry
 */
function lineIntersectsGeometry(
  lineStart: [number, number],
  lineEnd: [number, number],
  geometry: any
): boolean {
  const rings = polygonRings(geometry)
  for (const ring of rings) {
    if (ring && ring.length && lineIntersectsPolygon(lineStart, lineEnd, ring)) {
      return true
    }
  }
  return false
}

/**
 * Get terrain cost at a specific point
 * Checks terrain features to determine movement cost
 */
export function getTerrainCostAtPoint(
  x: number,
  y: number,
  terrainCosts: TerrainCosts
): number {
  const terrain = $terrain.get()
  if (!terrain || !terrain.features) {
    return terrainCosts.open || 1.0
  }

  let cost = terrainCosts.open || 1.0

  for (const feature of terrain.features) {
    const geometry = feature.geometry
    if (!geometry || !geometry.type) continue

    if (!pointInAnyRing([x, y], geometry)) {
      continue
    }

    const kind = feature.properties?.kind

    // Impassable terrain
    if (kind === 'impassable') {
      return terrainCosts.impassable || 50
    }

    // Difficult terrain
    if (kind === 'difficult') {
      return terrainCosts.difficult || 2.0
    }

    // Road (best terrain)
    if (kind === 'road') {
      return terrainCosts.road || 0.7
    }

    // Open/normal terrain
    if (kind === 'open') {
      cost = terrainCosts.open || 1.0
    }
  }

  return cost
}

/**
 * Calculate terrain cost between two points
 * Used for bridge connections between graph layers
 */
export function getTerrainCostBetweenPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  terrainCosts: TerrainCosts
): number {
  const terrain = $terrain.get()
  if (!terrain || !terrain.features) {
    return terrainCosts.open || 1.0
  }

  let cost = terrainCosts.open || 1.0

  for (const feature of terrain.features) {
    const geometry = feature.geometry
    if (!geometry || !geometry.type) continue

    if (!lineIntersectsGeometry([from.x, from.y], [to.x, to.y], geometry)) {
      continue
    }

    const kind = feature.properties?.kind

    // Impassable terrain
    if (kind === 'impassable') {
      return terrainCosts.impassable || 50
    }

    // Difficult terrain
    if (kind === 'difficult') {
      return terrainCosts.difficult || 2.0
    }

    // Road (best terrain)
    if (kind === 'road') {
      return terrainCosts.road || 0.7
    }

    // Open/normal terrain
    if (kind === 'open') {
      cost = Math.max(cost, terrainCosts.open || 1.0)
    }
  }

  return cost
}

/**
 * Check if a point is in water
 */
export function isWaterAtPoint(x: number, y: number): boolean {
  const terrain = $terrain.get()
  if (!terrain || !terrain.features) {
    return false
  }

  for (const feature of terrain.features) {
    const geometry = feature.geometry
    if (!geometry) continue

    if (!pointInAnyRing([x, y], geometry)) {
      continue
    }

    const kind = feature.properties?.kind
    if (kind && WATER_KINDS.has(kind)) {
      return true
    }
  }

  return false
}

/**
 * Get map bounds from terrain data
 */
export function getMapBounds(): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  const terrain = $terrain.get()

  // Default bounds if no terrain
  if (!terrain || !terrain.features || terrain.features.length === 0) {
    return { minX: 0, maxX: 1000, minY: 0, maxY: 1000 }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const feature of terrain.features) {
    const rings = polygonRings(feature.geometry)
    for (const ring of rings) {
      for (const point of ring) {
        minX = Math.min(minX, point[0])
        maxX = Math.max(maxX, point[0])
        minY = Math.min(minY, point[1])
        maxY = Math.max(maxY, point[1])
      }
    }
  }

  return { minX, maxX, minY, maxY }
}
