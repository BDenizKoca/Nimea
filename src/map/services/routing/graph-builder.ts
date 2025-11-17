// Graph construction module - builds multi-layer routing graph

import type { RoutingGraph, GraphNode, GraphEdge, TerrainCosts } from './types'
import type { Marker } from '../../types'
import { $terrain, $route } from '../../stores'
import { getTerrainCostAtPoint, getTerrainCostBetweenPoints, isWaterAtPoint, getMapBounds } from './terrain-utils'

const ROAD_ENTRY_PENALTY = 0.35
const ROAD_COST_MULTIPLIER = 0.4

/**
 * Build the complete hybrid multilayer routing graph
 */
export function buildRoutingGraph(
  terrainCosts: TerrainCosts,
  gridSize: number,
  roadConnectionDistance: number,
  seaTravelEnabled: boolean = false
): RoutingGraph {
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const edgeMap = new Map<string, GraphEdge>()
  const activeMarkers = getActiveRoutingMarkers()

  console.log(
    `Building hybrid multilayer routing graph... (Sea Travel: ${seaTravelEnabled ? 'ENABLED' : 'DISABLED'})`
  )

  // Build each layer of the graph
  buildRoadsLayer(nodes, edges, edgeMap, terrainCosts)
  buildTerrainGridLayer(nodes, edges, edgeMap, gridSize, terrainCosts, seaTravelEnabled)
  buildMarkersLayer(nodes, activeMarkers)
  buildBridgeConnections(
    nodes,
    edges,
    edgeMap,
    terrainCosts,
    roadConnectionDistance,
    seaTravelEnabled,
    activeMarkers
  )

  const graph = { nodes, edges, edgeMap }
  console.log(`Built graph with ${nodes.size} nodes and ${edges.length} edges`)
  return graph
}

/**
 * Get markers currently in the route (only these connect to the graph)
 */
function getActiveRoutingMarkers(): Marker[] {
  const route = $route.get()
  const active: Marker[] = []
  const seen = new Set<string>()

  for (const routeStop of route) {
    if (!routeStop.marker || seen.has(routeStop.marker.id)) continue
    active.push(routeStop.marker)
    seen.add(routeStop.marker.id)
  }

  if (!active.length) {
    console.warn('No active route markers found; marker layer will be skipped')
  } else {
    console.log(`Active routing markers: ${active.map((m) => m.name).join(', ')}`)
  }

  return active
}

/**
 * Build the roads layer - high-priority road network
 */
function buildRoadsLayer(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  edgeMap: Map<string, GraphEdge>,
  terrainCosts: TerrainCosts
): void {
  const terrain = $terrain.get()
  if (!terrain || !terrain.features) return

  const roadFeatures = terrain.features.filter((f) => f.properties?.kind === 'road')
  const roadNodes = new Map<string, string[]>() // Track road intersections

  roadFeatures.forEach((roadFeature, roadIndex) => {
    if (roadFeature.geometry.type !== 'LineString') return

    const coordinates = roadFeature.geometry.coordinates

    // Create nodes for each point in the road
    coordinates.forEach((coord: number[], coordIndex: number) => {
      const nodeId = `road_${roadIndex}_${coordIndex}`
      nodes.set(nodeId, {
        x: coord[0],
        y: coord[1],
        type: 'road_node',
        roadIndex,
        coordIndex
      })

      // Track for intersection detection
      const posKey = `${Math.round(coord[0])},${Math.round(coord[1])}`
      if (!roadNodes.has(posKey)) {
        roadNodes.set(posKey, [])
      }
      roadNodes.get(posKey)!.push(nodeId)
    })

    // Create edges between consecutive road points
    for (let i = 0; i < coordinates.length - 1; i++) {
      const fromId = `road_${roadIndex}_${i}`
      const toId = `road_${roadIndex}_${i + 1}`
      const from = coordinates[i]
      const to = coordinates[i + 1]

      const distance = Math.sqrt(Math.pow(to[0] - from[0], 2) + Math.pow(to[1] - from[1], 2))

      // Roads have low cost (fast travel)
      const roadCost = Math.max((terrainCosts.road || 0.7) * ROAD_COST_MULTIPLIER, 0.15)
      const fwd = { from: fromId, to: toId, cost: roadCost, distance, type: 'road' as const }
      const rev = { from: toId, to: fromId, cost: roadCost, distance, type: 'road' as const }
      edges.push(fwd, rev)
      edgeMap.set(`${fromId}|${toId}`, fwd)
      edgeMap.set(`${toId}|${fromId}`, rev)
    }
  })

  // Connect road intersections (where roads cross or meet)
  connectRoadIntersections(roadNodes, edges, edgeMap)
}

/**
 * Connect road intersections where multiple roads meet
 */
function connectRoadIntersections(
  roadNodes: Map<string, string[]>,
  edges: GraphEdge[],
  edgeMap: Map<string, GraphEdge>
): void {
  for (const nodeIds of roadNodes.values()) {
    if (nodeIds.length > 1) {
      // Create connections between all road nodes at this position
      for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
          const fromId = nodeIds[i]
          const toId = nodeIds[j]

          // Zero-cost transition between road networks at intersections
          const fwd = {
            from: fromId,
            to: toId,
            cost: 0,
            distance: 0,
            type: 'road_intersection' as const
          }
          const rev = {
            from: toId,
            to: fromId,
            cost: 0,
            distance: 0,
            type: 'road_intersection' as const
          }
          edges.push(fwd, rev)
          edgeMap.set(`${fromId}|${toId}`, fwd)
          edgeMap.set(`${toId}|${fromId}`, rev)
        }
      }
    }
  }
}

/**
 * Build terrain grid layer - fallback pathfinding network
 */
function buildTerrainGridLayer(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  edgeMap: Map<string, GraphEdge>,
  gridSize: number,
  terrainCosts: TerrainCosts,
  seaTravelEnabled: boolean
): void {
  const mapBounds = getMapBounds()
  const terrainNodes = new Map<string, string>()

  // Create terrain grid nodes
  for (let x = mapBounds.minX; x <= mapBounds.maxX; x += gridSize) {
    for (let y = mapBounds.minY; y <= mapBounds.maxY; y += gridSize) {
      const nodeId = `terrain_${Math.round(x)}_${Math.round(y)}`
      const originalCost = getTerrainCostAtPoint(x, y, terrainCosts)

      // Determine if this is water
      const isWaterNode = isWaterAtPoint(x, y)

      // If this is water and sea travel is enabled, make it navigable
      let terrainCost = originalCost
      if (isWaterNode && seaTravelEnabled) {
        // Sea travel is faster (cost = 0.25)
        terrainCost = 0.25
      }

      // Skip if impassable and not water/sea mode
      if (terrainCost >= 10 && !(isWaterNode && seaTravelEnabled)) {
        continue
      }

      nodes.set(nodeId, {
        x: x,
        y: y,
        type: 'terrain_node',
        cost: terrainCost,
        isWater: isWaterNode
      })
      terrainNodes.set(`${Math.round(x)},${Math.round(y)}`, nodeId)
    }
  }

  // Connect adjacent terrain grid nodes (8-directional)
  connectTerrainNodes(terrainNodes, nodes, edges, edgeMap, gridSize)
}

/**
 * Connect adjacent terrain grid nodes
 */
function connectTerrainNodes(
  terrainNodes: Map<string, string>,
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  edgeMap: Map<string, GraphEdge>,
  gridSize: number
): void {
  for (const [posKey, nodeId] of terrainNodes) {
    const [x, y] = posKey.split(',').map(Number)
    const node = nodes.get(nodeId)!

    // Check 8-directional neighbors
    const neighbors = [
      [x + gridSize, y], // right
      [x - gridSize, y], // left
      [x, y + gridSize], // down
      [x, y - gridSize], // up
      [x + gridSize, y + gridSize], // diagonal
      [x - gridSize, y - gridSize], // diagonal
      [x + gridSize, y - gridSize], // diagonal
      [x - gridSize, y + gridSize] // diagonal
    ]

    neighbors.forEach(([nx, ny]) => {
      const neighborKey = `${nx},${ny}`
      const neighborId = terrainNodes.get(neighborKey)

      if (neighborId) {
        const neighborNode = nodes.get(neighborId)!
        const distance = Math.sqrt(Math.pow(nx - x, 2) + Math.pow(ny - y, 2))

        // Cost is the average of the two nodes' terrain costs
        const avgCost = ((node.cost || 1) + (neighborNode.cost || 1)) / 2

        // Don't connect high-cost terrain
        if (avgCost >= 10) {
          return
        }

        const edge: GraphEdge = {
          from: nodeId,
          to: neighborId,
          cost: avgCost,
          distance: distance,
          type: 'terrain'
        }

        edges.push(edge)
        edgeMap.set(`${nodeId}|${neighborId}`, edge)
      }
    })
  }
}

/**
 * Build markers layer - add route markers as nodes
 */
function buildMarkersLayer(nodes: Map<string, GraphNode>, activeMarkers: Marker[]): void {
  if (!activeMarkers.length) return

  console.log(`Building markers layer with ${activeMarkers.length} active markers`)
  activeMarkers.forEach((marker) => {
    const nodeId = `marker_${marker.id}`
    nodes.set(nodeId, {
      x: marker.x,
      y: marker.y,
      type: 'marker',
      markerId: marker.id,
      isPort: marker.isPort || false
    })
  })
}

/**
 * Build bridge connections - connect markers to road and terrain layers
 */
function buildBridgeConnections(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  edgeMap: Map<string, GraphEdge>,
  terrainCosts: TerrainCosts,
  roadConnectionDistance: number,
  _seaTravelEnabled: boolean, // Prefix with _ to indicate intentionally unused
  activeMarkers: Marker[]
): void {
  if (!activeMarkers.length) return

  console.log(`Building bridge connections for ${activeMarkers.length} markers`)
  activeMarkers.forEach((marker) => {
    // Connect to roads
    connectMarkerToRoads(
      marker,
      nodes,
      edges,
      edgeMap,
      terrainCosts,
      roadConnectionDistance
    )

    // Connect to terrain grid
    connectMarkerToTerrain(marker, nodes, edges, edgeMap, terrainCosts)
  })
}

/**
 * Connect marker to nearest road network
 */
function connectMarkerToRoads(
  marker: Marker,
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  edgeMap: Map<string, GraphEdge>,
  terrainCosts: TerrainCosts,
  searchRadius: number
): void {
  const markerNodeId = `marker_${marker.id}`
  const markerPos = { x: marker.x, y: marker.y }
  const candidates: Array<{ nodeId: string; node: GraphNode; distance: number }> = []

  // Find nearby road nodes
  for (const [nodeId, node] of nodes) {
    if (node.type !== 'road_node') continue
    const distance = Math.sqrt(Math.pow(node.x - markerPos.x, 2) + Math.pow(node.y - markerPos.y, 2))

    if (distance <= searchRadius) {
      candidates.push({ nodeId, node, distance })
    }
  }

  // Connect to 3 nearest road nodes
  candidates
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .forEach(({ nodeId, node, distance }) => {
      const connectionCost = getTerrainCostBetweenPoints(markerPos, node, terrainCosts)
      const bridgeCost = Math.max(0.5, (connectionCost + ROAD_ENTRY_PENALTY))

      const fwd: GraphEdge = {
        from: markerNodeId,
        to: nodeId,
        cost: bridgeCost,
        distance,
        type: 'marker_bridge'
      }
      const rev: GraphEdge = {
        from: nodeId,
        to: markerNodeId,
        cost: bridgeCost,
        distance,
        type: 'marker_bridge'
      }

      edges.push(fwd, rev)
      edgeMap.set(`${markerNodeId}|${nodeId}`, fwd)
      edgeMap.set(`${nodeId}|${markerNodeId}`, rev)
    })
}

/**
 * Connect marker to terrain grid
 */
function connectMarkerToTerrain(
  marker: Marker,
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  edgeMap: Map<string, GraphEdge>,
  _terrainCosts: TerrainCosts // Prefix with _ to indicate intentionally unused
): void {
  const markerNodeId = `marker_${marker.id}`
  const markerPos = { x: marker.x, y: marker.y }
  const searchRadius = 100 // Search within 100px

  const candidates: Array<{ nodeId: string; node: GraphNode; distance: number }> = []

  // Find nearby terrain nodes
  for (const [nodeId, node] of nodes) {
    if (node.type !== 'terrain_node') continue
    const distance = Math.sqrt(Math.pow(node.x - markerPos.x, 2) + Math.pow(node.y - markerPos.y, 2))

    if (distance <= searchRadius) {
      candidates.push({ nodeId, node, distance })
    }
  }

  // Connect to 4 nearest terrain nodes
  candidates
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4)
    .forEach(({ nodeId, node, distance }) => {
      const terrainCost = node.cost || 1.0
      const bridgeCost = Math.max(0.5, terrainCost * 1.2)

      const fwd: GraphEdge = {
        from: markerNodeId,
        to: nodeId,
        cost: bridgeCost,
        distance,
        type: 'marker_bridge'
      }
      const rev: GraphEdge = {
        from: nodeId,
        to: markerNodeId,
        cost: bridgeCost,
        distance,
        type: 'marker_bridge'
      }

      edges.push(fwd, rev)
      edgeMap.set(`${markerNodeId}|${nodeId}`, fwd)
      edgeMap.set(`${nodeId}|${markerNodeId}`, rev)
    })
}
