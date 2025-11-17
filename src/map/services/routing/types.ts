// Type definitions for routing system

export interface GraphNode {
  x: number
  y: number
  type: 'road_node' | 'terrain_node' | 'marker' | 'marker_node'
  cost?: number
  isWater?: boolean
  isPort?: boolean
  markerId?: string
  roadIndex?: number
  coordIndex?: number
}

export interface GraphEdge {
  from: string
  to: string
  cost: number
  distance: number
  type?: 'road' | 'terrain' | 'marker_bridge' | 'road_intersection'
}

export interface RoutingGraph {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
  edgeMap: Map<string, GraphEdge>
}

export interface TerrainCosts {
  road: number
  open: number
  difficult: number
  impassable: number
  [key: string]: number
}

export interface RoutingConfig {
  terrainGridSize: number
  roadConnectionDistance: number
  terrainCosts: TerrainCosts
}
