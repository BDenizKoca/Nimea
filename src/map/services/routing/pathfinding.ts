// Pathfinding algorithms module - A* and Dijkstra's implementation

import type { RoutingGraph, GraphNode, GraphEdge } from './types'
import { $markers } from '../../stores'

/**
 * A* algorithm implementation for efficient pathfinding
 * Uses heuristic to guide search toward target
 *
 * @param graph - The routing graph
 * @param startNodeId - Starting node ID
 * @param endNodeId - Target node ID
 * @param maxIterations - Maximum iterations before timeout (default: 50000)
 * @param maxTimeMs - Maximum execution time in milliseconds (default: 5000)
 * @returns Path as array of node IDs, or null if no path found
 */
export function findShortestPathAStar(
  graph: RoutingGraph,
  startNodeId: string,
  endNodeId: string,
  maxIterations: number = 50000,
  maxTimeMs: number = 5000
): string[] | null {
  if (!graph.nodes.has(startNodeId) || !graph.nodes.has(endNodeId)) {
    console.warn(`Node not found: start=${startNodeId}, end=${endNodeId}`)
    return null
  }

  const startNode = graph.nodes.get(startNodeId)!
  const endNode = graph.nodes.get(endNodeId)!

  // A* data structures
  const openSet = new Set([startNodeId])
  const cameFrom = new Map<string, string>()
  const gScore = new Map<string, number>() // Cost from start to node
  const fScore = new Map<string, number>() // gScore + heuristic

  // Initialize scores
  for (const nodeId of graph.nodes.keys()) {
    gScore.set(nodeId, Infinity)
    fScore.set(nodeId, Infinity)
  }
  gScore.set(startNodeId, 0)
  fScore.set(startNodeId, heuristic(startNode, endNode))

  // Timeout protection
  let iterations = 0
  const startTime = performance.now()

  while (openSet.size > 0) {
    iterations++

    // Check iteration limit
    if (iterations >= maxIterations) {
      console.error(
        `A* pathfinding timeout: exceeded ${maxIterations} iterations after ${(
          performance.now() - startTime
        ).toFixed(0)}ms`
      )
      console.error(
        `  Start: ${startNodeId}, End: ${endNodeId}, Graph: ${graph.nodes.size} nodes, ${graph.edges.length} edges`
      )
      return null
    }

    // Check time limit (checked every 1000 iterations for performance)
    if (iterations % 1000 === 0) {
      const elapsed = performance.now() - startTime
      if (elapsed > maxTimeMs) {
        console.error(
          `A* pathfinding timeout: exceeded ${maxTimeMs}ms (${iterations} iterations)`
        )
        console.error(
          `  Start: ${startNodeId}, End: ${endNodeId}, Graph: ${graph.nodes.size} nodes, ${graph.edges.length} edges`
        )
        return null
      }
    }

    // Find node in openSet with lowest fScore
    let current: string | null = null
    let lowestF = Infinity
    for (const nodeId of openSet) {
      const f = fScore.get(nodeId)!
      if (f < lowestF) {
        lowestF = f
        current = nodeId
      }
    }

    if (!current) break

    if (current === endNodeId) {
      // Reconstruct path
      const path: string[] = []
      let node: string | undefined = current
      while (node !== undefined) {
        path.unshift(node)
        node = cameFrom.get(node)
      }

      const elapsed = performance.now() - startTime
      console.log(
        `A* found path in ${iterations} iterations, ${elapsed.toFixed(2)}ms (${path.length} nodes)`
      )

      return path
    }

    openSet.delete(current)

    // Check all neighbors
    for (const edge of graph.edges) {
      if (edge.from === current) {
        const neighbor = edge.to
        const currentNode = graph.nodes.get(current)!
        const neighborNode = graph.nodes.get(neighbor)!

        // Calculate edge cost
        let edgeCost = edge.distance * edge.cost

        // Port gate logic: Check if transitioning between land and water
        if (currentNode.isWater !== undefined && neighborNode.isWater !== undefined) {
          // Crossing land/water boundary - only allowed at ports
          if (currentNode.isWater !== neighborNode.isWater) {
            // Check if either current or neighbor is a port
            const currentIsPort = isPortNode(current, graph.nodes)
            const neighborIsPort = isPortNode(neighbor, graph.nodes)

            if (!currentIsPort && !neighborIsPort) {
              // Can't cross land/water boundary without a port - skip this edge
              continue
            }
          }
        }

        const tentativeGScore = gScore.get(current)! + edgeCost

        if (tentativeGScore < gScore.get(neighbor)!) {
          cameFrom.set(neighbor, current)
          gScore.set(neighbor, tentativeGScore)

          fScore.set(neighbor, tentativeGScore + heuristic(neighborNode, endNode))

          if (!openSet.has(neighbor)) {
            openSet.add(neighbor)
          }
        }
      }
    }
  }

  const elapsed = performance.now() - startTime
  console.warn(`A* found no path after ${iterations} iterations, ${elapsed.toFixed(2)}ms`)
  console.warn(`  Start: ${startNodeId}, End: ${endNodeId}, OpenSet size: ${openSet.size}`)

  return null // No path found
}

/**
 * Check if a node is a port (can access both land and water)
 */
function isPortNode(nodeId: string, nodesMap: Map<string, GraphNode>): boolean {
  const node = nodesMap.get(nodeId)
  if (!node) return false

  // Check if this is a marker node
  if (node.type === 'marker') {
    // Check if node has isPort flag
    if (node.isPort !== undefined) {
      return !!node.isPort
    }
    // Check marker store for isPort flag
    if (node.markerId) {
      const markers = $markers.get()
      const marker = markers.find((m) => m.id === node.markerId)
      return marker?.isPort === true
    }
  }
  return false
}

/**
 * Heuristic function for A* (Euclidean distance)
 * Provides optimistic estimate of remaining cost to goal
 */
function heuristic(nodeA: GraphNode, nodeB: GraphNode): number {
  return Math.sqrt(Math.pow(nodeB.x - nodeA.x, 2) + Math.pow(nodeB.y - nodeA.y, 2))
}

/**
 * Dijkstra's algorithm implementation for pathfinding (fallback)
 * Guaranteed to find optimal path but slower than A*
 */
export function findShortestPath(
  graph: RoutingGraph,
  startNodeId: string,
  endNodeId: string
): string[] | null {
  if (!graph.nodes.has(startNodeId) || !graph.nodes.has(endNodeId)) {
    console.warn(`Node not found: start=${startNodeId}, end=${endNodeId}`)
    return null
  }

  const distances = new Map<string, number>()
  const previous = new Map<string, string>()
  const unvisited = new Set<string>()

  // Initialize distances
  for (const nodeId of graph.nodes.keys()) {
    distances.set(nodeId, Infinity)
    unvisited.add(nodeId)
  }
  distances.set(startNodeId, 0)

  while (unvisited.size > 0) {
    // Find unvisited node with minimum distance
    let currentNode: string | null = null
    let minDistance = Infinity
    for (const nodeId of unvisited) {
      const dist = distances.get(nodeId)!
      if (dist < minDistance) {
        minDistance = dist
        currentNode = nodeId
      }
    }

    if (currentNode === null || minDistance === Infinity) {
      break // No more reachable nodes
    }

    unvisited.delete(currentNode)

    if (currentNode === endNodeId) {
      break // Found target
    }

    // Check all edges from current node
    for (const edge of graph.edges) {
      if (edge.from === currentNode && unvisited.has(edge.to)) {
        const totalCost = edge.distance * edge.cost
        const altDistance = distances.get(currentNode)! + totalCost

        if (altDistance < distances.get(edge.to)!) {
          distances.set(edge.to, altDistance)
          previous.set(edge.to, currentNode)
        }
      }
    }
  }

  // Reconstruct path
  if (!previous.has(endNodeId)) {
    return null // No path found
  }

  const path: string[] = []
  let currentNode: string | undefined = endNodeId
  while (currentNode !== undefined) {
    path.unshift(currentNode)
    currentNode = previous.get(currentNode)
  }

  return path
}

/**
 * Compute actual physical distance of path (no terrain cost weighting)
 */
export function computeActualDistance(
  pathIds: string[],
  edgeMap: Map<string, GraphEdge>,
  kmPerPixel: number
): number {
  if (!pathIds || pathIds.length < 2) return 0

  let totalDistancePx = 0

  for (let i = 1; i < pathIds.length; i++) {
    const edgeKey = `${pathIds[i - 1]}|${pathIds[i]}`
    const edge = edgeMap.get(edgeKey)

    if (!edge) {
      console.warn(`Missing edge: ${edgeKey}`)
      return Infinity
    }

    totalDistancePx += edge.distance // No cost multiplier!
  }

  return totalDistancePx * kmPerPixel
}

/**
 * Compute total cost of graph path in weighted distance (for pathfinding comparison)
 * NOTE: This is used internally by A* - NOT for display to users!
 */
export function computeGraphPathCost(
  pathIds: string[],
  edgeMap: Map<string, GraphEdge>,
  kmPerPixel: number
): number {
  if (!pathIds || pathIds.length < 2) return 0

  let totalCostPx = 0

  for (let i = 1; i < pathIds.length; i++) {
    const edgeKey = `${pathIds[i - 1]}|${pathIds[i]}`
    const edge = edgeMap.get(edgeKey)

    if (!edge) {
      console.warn(`Missing edge: ${edgeKey}`)
      return Infinity
    }

    totalCostPx += edge.distance * edge.cost
  }

  return totalCostPx * kmPerPixel
}
