/**
 * Routing Service
 * Complete routing system with A* pathfinding, terrain costs, and multi-layer graph
 */

import type { Map as LeafletMap } from 'leaflet'
import { $route, $terrain, addRouteStop, removeRouteStop, clearRoute } from '../stores'
import { eventBus } from '../utils/events'
import { debounce } from '../utils/debounce'
import { MAP_CONFIG } from '../constants'
import type { Marker, RouteStop } from '../types'
import type { RoutingGraph, TerrainCosts } from './routing/types'
import { buildRoutingGraph } from './routing/graph-builder'
import { findShortestPathAStar, computeActualDistance } from './routing/pathfinding'

export class RoutingService {
  private map: LeafletMap
  private travelMode: 'land' | 'sea' = 'land'
  private travelProfile: 'walking' | 'wagon' | 'horse' = 'walking'
  private currentPolyline: any = null
  private currentGraph: RoutingGraph | null = null
  private unsubscribeRoute?: () => void
  private unsubscribeTerrain?: () => void
  private eventHandlers: Array<{ event: string; handler: (...args: any[]) => void }> = []

  // Routing configuration
  private readonly TERRAIN_GRID_SIZE = 20 // High-density grid (20px)
  private readonly ROAD_CONNECTION_DISTANCE = 300

  // Terrain costs (from config)
  private readonly TERRAIN_COSTS: TerrainCosts = {
    road: 0.7,
    open: 1.0,
    difficult: 2.0,
    impassable: 50.0
  }

  constructor(map: LeafletMap) {
    this.map = map

    // Debounced terrain rebuild - prevents performance death spiral during drawing
    const debouncedTerrainRebuild = debounce(() => {
      this.currentGraph = null // Invalidate graph
      this.recalculateRoute()
    }, 500) // Wait 500ms after user stops drawing

    // Debounced route recalculation - prevents rapid recalculations on quick clicks
    const debouncedRouteUpdate = debounce((route: RouteStop[]) => {
      this.updateRouteDisplay([...route]) // Create mutable copy
    }, 300) // Wait 300ms after last route change

    // Subscribe to route changes
    this.unsubscribeRoute = $route.subscribe((route) => {
      debouncedRouteUpdate(route as RouteStop[])
    })

    // Rebuild graph when terrain changes (debounced to prevent excessive rebuilds)
    this.unsubscribeTerrain = $terrain.subscribe(() => {
      debouncedTerrainRebuild()
    })

    // Setup event listeners
    this.setupEventListeners()

    console.log('✅ Routing service initialized with A* pathfinding (debounced)')
  }

  /**
   * Cleanup all event listeners and subscriptions
   */
  destroy(): void {
    // Unsubscribe from stores
    if (this.unsubscribeRoute) {
      this.unsubscribeRoute()
    }
    if (this.unsubscribeTerrain) {
      this.unsubscribeTerrain()
    }

    // Remove all event bus listeners
    this.eventHandlers.forEach(({ event, handler }) => {
      eventBus.off(event, handler)
    })
    this.eventHandlers = []

    // Clear route from map
    this.clearRouteFromMap()

    this.currentGraph = null

    console.log('✅ Routing service destroyed')
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Helper to track event handlers
    const addTrackedListener = <T = any>(event: string, handler: (data: T) => void): void => {
      eventBus.on(event, handler)
      this.eventHandlers.push({ event, handler })
    }

    // Listen for marker clicks to add to route
    addTrackedListener<Marker>('marker:click', (marker) => {
      if (this.isRoutingActive()) {
        this.addToRoute(marker)
      }
    })

    // Listen for route control events
    addTrackedListener('route:clear', () => {
      clearRoute()
    })

    addTrackedListener<number>('route:remove-stop', (index) => {
      removeRouteStop(index)
    })

    addTrackedListener<'land' | 'sea'>('route:set-travel-mode', (mode) => {
      this.travelMode = mode
      this.currentGraph = null // Rebuild graph for new mode
      this.recalculateRoute()
    })

    addTrackedListener<'walking' | 'wagon' | 'horse'>('route:set-travel-profile', (profile) => {
      this.travelProfile = profile
      this.recalculateRoute()
    })
  }

  /**
   * Check if routing is currently active
   */
  private isRoutingActive(): boolean {
    // Check if route sidebar is open
    const routeSidebar = document.getElementById('route-sidebar')
    return routeSidebar?.classList.contains('open') || false
  }

  /**
   * Add marker to route
   */
  private addToRoute(marker: Marker): void {
    const currentRoute = $route.get()
    const index = currentRoute.length

    const stop: RouteStop = {
      marker,
      index
    }

    addRouteStop(stop)
    eventBus.emit('notification', {
      message: `Added ${marker.name} to route`,
      type: 'success'
    })
  }

  /**
   * Update route display
   */
  private updateRouteDisplay(route: RouteStop[]): void {
    if (route.length === 0) {
      this.clearRouteFromMap()
      return
    }

    if (route.length < 2) {
      // Need at least 2 stops to show a route
      return
    }

    // Calculate and display route using pathfinding
    this.calculateAndDisplayRoute(route)
  }

  /**
   * Build or get cached routing graph
   */
  private getRoutingGraph(): RoutingGraph {
    if (!this.currentGraph) {
      const seaTravelEnabled = this.travelMode === 'sea'
      console.log('Building routing graph...')
      this.currentGraph = buildRoutingGraph(
        this.TERRAIN_COSTS,
        this.TERRAIN_GRID_SIZE,
        this.ROAD_CONNECTION_DISTANCE,
        seaTravelEnabled
      )
      console.log(`Graph built: ${this.currentGraph.nodes.size} nodes, ${this.currentGraph.edges.length} edges`)
    }
    return this.currentGraph
  }

  /**
   * Calculate and display route using A* pathfinding
   */
  private calculateAndDisplayRoute(route: RouteStop[]): void {
    // Show operation-specific loading state
    this.updateRouteSummaryLoading('Calculating route...')

    // Get routing graph
    const graph = this.getRoutingGraph()

    // Build complete path through all waypoints
    const fullPath: Array<[number, number]> = []
    let totalDistance = 0
    let pathfindingFailed = false

    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i].marker
      const to = route[i + 1].marker

      // Update loading state for each segment
      this.updateRouteSummaryLoading(`Finding path: ${from.name} → ${to.name}...`)

      // Find path between consecutive markers
      const startNodeId = `marker_${from.id}`
      const endNodeId = `marker_${to.id}`

      console.log(`Finding path from ${from.name} to ${to.name}...`)
      const pathIds = findShortestPathAStar(graph, startNodeId, endNodeId)

      if (!pathIds) {
        console.error(`No path found between ${from.name} and ${to.name}`)
        pathfindingFailed = true
        // Fall back to straight line for this segment
        fullPath.push([from.y, from.x])
        if (i === route.length - 2) {
          fullPath.push([to.y, to.x])
        }
        continue
      }

      // Convert node IDs to coordinates
      const segmentPath = pathIds.map((nodeId) => {
        const node = graph.nodes.get(nodeId)!
        return [node.y, node.x] as [number, number]
      })

      // Add to full path (avoid duplicating connection points)
      if (fullPath.length === 0) {
        fullPath.push(...segmentPath)
      } else {
        fullPath.push(...segmentPath.slice(1))
      }

      // Calculate actual distance for this segment
      const segmentDistance = computeActualDistance(
        pathIds,
        graph.edgeMap,
        MAP_CONFIG.kmPerPixel
      )
      totalDistance += segmentDistance
      console.log(`  Path found: ${pathIds.length} nodes, ${segmentDistance.toFixed(1)} km`)
    }

    // Remove old route if exists
    this.clearRouteFromMap()

    // Draw new route
    const polylineColor = pathfindingFailed ? '#ff9800' : '#e74c3c' // Orange if pathfinding failed
    this.currentPolyline = (window as any).L.polyline(fullPath, {
      color: polylineColor,
      weight: 4,
      opacity: 0.8,
      pane: 'routePane'
    }).addTo(this.map)

    // Calculate time
    const time = this.calculateRouteTime(totalDistance)

    // Update route summary
    this.updateRouteSummary(route, totalDistance, time, pathfindingFailed)

    // Emit event
    eventBus.emit('route:calculated', { route, distance: totalDistance, time })

    if (pathfindingFailed) {
      eventBus.emit('notification', {
        message: 'Some route segments use straight lines (no path found)',
        type: 'warning'
      })
    }
  }

  /**
   * Calculate route time based on distance and travel profile
   */
  private calculateRouteTime(distance: number): number {
    const profile = MAP_CONFIG.travelProfiles[this.travelProfile]
    const speed = this.travelMode === 'sea' ? profile.seaSpeed : profile.landSpeed
    return distance / speed
  }

  /**
   * Update route summary with loading state
   */
  private updateRouteSummaryLoading(message: string): void {
    const summaryEl = document.getElementById('route-summary')
    if (!summaryEl) return

    summaryEl.innerHTML = `
      <div class="route-stats route-loading">
        <p><strong>⏳ ${message}</strong></p>
      </div>
    `
  }

  /**
   * Update route summary in UI
   */
  private updateRouteSummary(
    route: RouteStop[],
    distance: number,
    time: number,
    pathfindingFailed: boolean
  ): void {
    const summaryEl = document.getElementById('route-summary')
    if (!summaryEl) return

    const days = Math.floor(time / 24)
    const hours = Math.floor(time % 24)

    const warningIcon = pathfindingFailed
      ? '<span style="color: #ff9800;">⚠</span> '
      : ''

    summaryEl.innerHTML = `
      <div class="route-stats">
        <p><strong>Distance:</strong> ${warningIcon}${distance.toFixed(1)} km</p>
        <p><strong>Time:</strong> ${days}d ${hours}h</p>
        <p><strong>Mode:</strong> ${this.travelMode} (${this.travelProfile})</p>
      </div>
    `

    // Update stops list
    const stopsEl = document.getElementById('route-stops')
    if (stopsEl) {
      stopsEl.innerHTML = route
        .map(
          (stop, idx) => `
        <div class="route-stop" data-index="${idx}">
          <span class="stop-number">${idx + 1}</span>
          <span class="stop-name">${stop.marker.name}</span>
          <button class="remove-stop" data-index="${idx}">×</button>
        </div>
      `
        )
        .join('')

      // Add remove handlers
      stopsEl.querySelectorAll('.remove-stop').forEach((btn) => {
        btn.addEventListener('click', () => {
          const index = parseInt((btn as HTMLElement).dataset.index || '0')
          removeRouteStop(index)
        })
      })
    }
  }

  /**
   * Clear route from map
   */
  private clearRouteFromMap(): void {
    if (this.currentPolyline && this.map.hasLayer(this.currentPolyline)) {
      this.map.removeLayer(this.currentPolyline)
    }
    this.currentPolyline = null
  }

  /**
   * Recalculate current route
   */
  private recalculateRoute(): void {
    const route = $route.get()
    if (route.length >= 2) {
      this.calculateAndDisplayRoute(route)
    }
  }

  /**
   * Toggle route sidebar
   */
  toggleRouteSidebar(): void {
    const sidebar = document.getElementById('route-sidebar')
    if (sidebar) {
      sidebar.classList.toggle('open')
    }
  }
}
