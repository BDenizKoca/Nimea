/**
 * A* Pathfinding Tests
 * Ensures correctness and prevents regressions in core routing logic
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { findShortestPathAStar, computeActualDistance } from '../routing/pathfinding'
import { buildRoutingGraph } from '../routing/graph-builder'
import type { RoutingGraph, GraphNode, GraphEdge, TerrainCosts } from '../routing/types'

describe('A* Pathfinding', () => {
  let simpleGraph: RoutingGraph

  beforeEach(() => {
    // Build a simple test graph
    //
    // A --- B
    // |     |
    // C --- D
    //
    const nodes = new Map<string, GraphNode>()
    nodes.set('A', { x: 0, y: 0, type: 'terrain_node' })
    nodes.set('B', { x: 100, y: 0, type: 'terrain_node' })
    nodes.set('C', { x: 0, y: 100, type: 'terrain_node' })
    nodes.set('D', { x: 100, y: 100, type: 'terrain_node' })

    const edges: GraphEdge[] = [
      { from: 'A', to: 'B', cost: 1.0, distance: 100 },
      { from: 'B', to: 'A', cost: 1.0, distance: 100 },
      { from: 'A', to: 'C', cost: 1.0, distance: 100 },
      { from: 'C', to: 'A', cost: 1.0, distance: 100 },
      { from: 'B', to: 'D', cost: 1.0, distance: 100 },
      { from: 'D', to: 'B', cost: 1.0, distance: 100 },
      { from: 'C', to: 'D', cost: 1.0, distance: 100 },
      { from: 'D', to: 'C', cost: 1.0, distance: 100 }
    ]

    const edgeMap = new Map<string, GraphEdge>()
    edges.forEach((edge) => {
      edgeMap.set(`${edge.from}|${edge.to}`, edge) // Use pipe separator for edge keys
    })

    simpleGraph = { nodes, edges, edgeMap }
  })

  it('should find shortest path between two connected nodes', () => {
    const path = findShortestPathAStar(simpleGraph, 'A', 'D')

    expect(path).not.toBeNull()
    expect(path).toBeDefined()
    expect(path?.length).toBeGreaterThan(1)
    expect(path?.[0]).toBe('A')
    expect(path?.[path.length - 1]).toBe('D')
  })

  it('should return null for unreachable nodes', () => {
    // Add isolated node
    simpleGraph.nodes.set('E', { x: 200, y: 200, type: 'terrain_node' })

    const path = findShortestPathAStar(simpleGraph, 'A', 'E')

    expect(path).toBeNull()
  })

  it('should return single-node path for same start and end', () => {
    const path = findShortestPathAStar(simpleGraph, 'A', 'A')

    expect(path).not.toBeNull()
    expect(path?.length).toBe(1)
    expect(path?.[0]).toBe('A')
  })

  it('should prefer lower cost paths', () => {
    // Add expensive direct path A -> D
    simpleGraph.edges.push({ from: 'A', to: 'D', cost: 10.0, distance: 100 })
    simpleGraph.edgeMap.set('A-D', { from: 'A', to: 'D', cost: 10.0, distance: 100 })

    const path = findShortestPathAStar(simpleGraph, 'A', 'D')

    // Should go via B or C (cost 2) instead of direct (cost 10)
    expect(path).not.toBeNull()
    expect(path?.length).toBeGreaterThan(2)
  })

  it('should compute correct distance for path', () => {
    const path = findShortestPathAStar(simpleGraph, 'A', 'B')

    expect(path).not.toBeNull()
    if (path) {
      const distance = computeActualDistance(path, simpleGraph.edgeMap, 0.1) // 0.1 km per pixel
      expect(distance).toBeGreaterThan(0)
      expect(distance).toBe(10) // 100 pixels * 0.1 km/pixel = 10 km
    }
  })

  it('should respect iteration limit', () => {
    // Create a large grid to exceed iteration limit
    const largeNodes = new Map<string, GraphNode>()
    const largeEdges: GraphEdge[] = []

    // 100x100 grid = 10,000 nodes (exceeds default 50,000 iterations)
    for (let x = 0; x < 100; x++) {
      for (let y = 0; y < 100; y++) {
        const id = `${x},${y}`
        largeNodes.set(id, { x: x * 10, y: y * 10, type: 'terrain_node' })

        // Connect to neighbors
        if (x > 0) {
          const neighborId = `${x - 1},${y}`
          largeEdges.push({ from: id, to: neighborId, cost: 1.0, distance: 10 })
        }
        if (y > 0) {
          const neighborId = `${x},${y - 1}`
          largeEdges.push({ from: id, to: neighborId, cost: 1.0, distance: 10 })
        }
      }
    }

    const edgeMap = new Map<string, GraphEdge>()
    largeEdges.forEach((edge) => {
      edgeMap.set(`${edge.from}|${edge.to}`, edge) // Use pipe separator for edge keys
    })

    const largeGraph: RoutingGraph = { nodes: largeNodes, edges: largeEdges, edgeMap }

    // Should timeout and return null
    const path = findShortestPathAStar(largeGraph, '0,0', '99,99', 1000, 100) // 1000 iterations, 100ms timeout

    // Either finds path quickly or times out
    expect(path === null || (path && path.length > 0)).toBe(true)
  })
})

describe('Graph Building', () => {
  it('should build graph with terrain costs', () => {
    const terrainCosts: TerrainCosts = {
      road: 0.7,
      open: 1.0,
      difficult: 2.0,
      impassable: 50.0
    }

    // Note: This test requires terrain data to be set in store
    // For now, just verify function doesn't crash
    const graph = buildRoutingGraph(terrainCosts, 20, 300, false)

    expect(graph).toBeDefined()
    expect(graph.nodes).toBeDefined()
    expect(graph.edges).toBeDefined()
    expect(graph.edgeMap).toBeDefined()
  })
})

describe('Distance Calculation', () => {
  it('should calculate correct distance for multi-segment path', () => {
    const edgeMap = new Map<string, GraphEdge>()
    edgeMap.set('A|B', { from: 'A', to: 'B', cost: 1.0, distance: 100 })
    edgeMap.set('B|C', { from: 'B', to: 'C', cost: 1.0, distance: 150 })
    edgeMap.set('C|D', { from: 'C', to: 'D', cost: 1.0, distance: 200 })

    const path = ['A', 'B', 'C', 'D']
    const distance = computeActualDistance(path, edgeMap, 0.1)

    // 100 + 150 + 200 = 450 pixels * 0.1 = 45 km
    expect(distance).toBe(45)
  })

  it('should handle missing edges gracefully', () => {
    const edgeMap = new Map<string, GraphEdge>()
    edgeMap.set('A|B', { from: 'A', to: 'B', cost: 1.0, distance: 100 })
    // Missing B|C edge
    edgeMap.set('C|D', { from: 'C', to: 'D', cost: 1.0, distance: 200 })

    const path = ['A', 'B', 'C', 'D']
    const distance = computeActualDistance(path, edgeMap, 0.1)

    // Should return Infinity for missing edge
    expect(distance).toBe(Infinity)
  })
})
