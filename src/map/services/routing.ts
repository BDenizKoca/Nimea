/**
 * Routing Service
 * Integration layer for the routing system with reactive stores
 * Wraps existing routing logic and connects it to the new architecture
 */

import type { Map as LeafletMap } from 'leaflet'
import { $route, addRouteStop, removeRouteStop, clearRoute } from '../stores'
import { eventBus } from '../utils/events'
import { MAP_CONFIG } from '../constants'
import type { Marker, RouteStop } from '../types'

export class RoutingService {
  private map: LeafletMap
  private travelMode: 'land' | 'sea' = 'land'
  private travelProfile: 'walking' | 'wagon' | 'horse' = 'walking'

  constructor(map: LeafletMap) {
    this.map = map

    // Subscribe to route changes
    $route.subscribe((route) => {
      this.updateRouteDisplay([...route]) // Create mutable copy
    })

    // Setup event listeners
    this.setupEventListeners()

    console.log('✅ Routing service initialized')
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for marker clicks to add to route
    eventBus.on('marker:click', (marker: Marker) => {
      if (this.isRoutingActive()) {
        this.addToRoute(marker)
      }
    })

    // Listen for route control events
    eventBus.on('route:clear', () => {
      clearRoute()
    })

    eventBus.on('route:remove-stop', (index: number) => {
      removeRouteStop(index)
    })

    eventBus.on('route:set-travel-mode', (mode: 'land' | 'sea') => {
      this.travelMode = mode
      this.recalculateRoute()
    })

    eventBus.on('route:set-travel-profile', (profile: 'walking' | 'wagon' | 'horse') => {
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

    // Calculate and display route
    this.calculateAndDisplayRoute(route)
  }

  /**
   * Calculate and display route
   */
  private calculateAndDisplayRoute(route: RouteStop[]): void {
    // For now, just draw a simple polyline between markers
    // The full pathfinding algorithm can be integrated later
    const points = route.map(stop => [stop.marker.y, stop.marker.x])

    // Remove old route if exists
    this.clearRouteFromMap()

    // Draw new route
    const polyline = (window as any).L.polyline(points, {
      color: '#e74c3c',
      weight: 4,
      opacity: 0.8,
      pane: 'routePane'
    }).addTo(this.map)

    // Store reference for later removal
    ;(this as any).currentPolyline = polyline

    // Calculate distance and time
    const distance = this.calculateRouteDistance(route)
    const time = this.calculateRouteTime(distance)

    // Update route summary
    this.updateRouteSummary(route, distance, time)

    // Emit event
    eventBus.emit('route:calculated', { route, distance, time })
  }

  /**
   * Calculate route distance (simple straight-line for now)
   */
  private calculateRouteDistance(route: RouteStop[]): number {
    let totalDistance = 0

    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i].marker
      const to = route[i + 1].marker

      const dx = (to.x - from.x) * MAP_CONFIG.kmPerPixel
      const dy = (to.y - from.y) * MAP_CONFIG.kmPerPixel

      const distance = Math.sqrt(dx * dx + dy * dy)
      totalDistance += distance
    }

    return totalDistance
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
   * Update route summary in UI
   */
  private updateRouteSummary(route: RouteStop[], distance: number, time: number): void {
    const summaryEl = document.getElementById('route-summary')
    if (!summaryEl) return

    const days = Math.floor(time / 24)
    const hours = Math.floor(time % 24)

    summaryEl.innerHTML = `
      <div class="route-stats">
        <p><strong>Distance:</strong> ${distance.toFixed(1)} km</p>
        <p><strong>Time:</strong> ${days}d ${hours}h</p>
        <p><strong>Mode:</strong> ${this.travelMode} (${this.travelProfile})</p>
      </div>
    `

    // Update stops list
    const stopsEl = document.getElementById('route-stops')
    if (stopsEl) {
      stopsEl.innerHTML = route.map((stop, idx) => `
        <div class="route-stop" data-index="${idx}">
          <span class="stop-number">${idx + 1}</span>
          <span class="stop-name">${stop.marker.name}</span>
          <button class="remove-stop" data-index="${idx}">×</button>
        </div>
      `).join('')

      // Add remove handlers
      stopsEl.querySelectorAll('.remove-stop').forEach(btn => {
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
    const polyline = (this as any).currentPolyline
    if (polyline && this.map.hasLayer(polyline)) {
      this.map.removeLayer(polyline)
    }
    ;(this as any).currentPolyline = null
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
