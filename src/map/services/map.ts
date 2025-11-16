/**
 * Leaflet Map Service
 * Handles map initialization and configuration
 */

import L from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'

export class MapService {
  private map: LeafletMap | null = null
  private readonly containerId: string

  constructor(containerId: string = 'map') {
    this.containerId = containerId
  }

  /**
   * Initialize the Leaflet map
   */
  initialize(): LeafletMap {
    const mapElement = document.getElementById(this.containerId)
    if (!mapElement) {
      throw new Error(`Map container #${this.containerId} not found`)
    }

    // Create map instance
    this.map = L.map(this.containerId, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 4,
      zoomControl: false,
      attributionControl: false
      // Note: tap option removed as it's not in official MapOptions type
    })

    // Ensure viewport meta tag for mobile
    this.ensureViewportMeta()

    // Create custom panes for proper z-index stacking
    this.createCustomPanes()

    console.log('✅ Map initialized')
    return this.map
  }

  /**
   * Get the map instance
   */
  getMap(): LeafletMap {
    if (!this.map) {
      throw new Error('Map not initialized. Call initialize() first.')
    }
    return this.map
  }

  /**
   * Ensure viewport meta tag exists for proper mobile touch handling
   */
  private ensureViewportMeta(): void {
    if (!document.querySelector('meta[name="viewport"]')) {
      console.warn('No viewport meta tag found, adding one for proper mobile touch handling')
      const meta = document.createElement('meta')
      meta.name = 'viewport'
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
      document.head.appendChild(meta)
    }
  }

  /**
   * Create custom panes for z-index control
   */
  private createCustomPanes(): void {
    if (!this.map) return

    // Route pane - above overlays but below markers
    if (!this.map.getPane('routePane')) {
      const routePane = this.map.createPane('routePane')
      routePane.style.zIndex = '650' // Above overlays (400-600) but below markers (700)
    }

    // Regions pane - base layer
    if (!this.map.getPane('regionsPane')) {
      const regionsPane = this.map.createPane('regionsPane')
      regionsPane.style.zIndex = '480'
    }

    // Borders pane - above regions
    if (!this.map.getPane('bordersPane')) {
      const bordersPane = this.map.createPane('bordersPane')
      bordersPane.style.zIndex = '490'
    }

    console.log('Custom panes created')
  }

  /**
   * Set map bounds
   */
  setBounds(sw: [number, number], ne: [number, number]): void {
    if (!this.map) return
    const bounds = L.latLngBounds(L.latLng(sw[0], sw[1]), L.latLng(ne[0], ne[1]))
    this.map.setMaxBounds(bounds)
  }

  /**
   * Fit map to bounds
   */
  fitBounds(sw: [number, number], ne: [number, number]): void {
    if (!this.map) return
    const bounds = L.latLngBounds(L.latLng(sw[0], sw[1]), L.latLng(ne[0], ne[1]))
    this.map.fitBounds(bounds)
  }

  /**
   * Add background image
   */
  addBackgroundImage(imageUrl: string, bounds: [[number, number], [number, number]]): void {
    if (!this.map) return

    const imageBounds = L.latLngBounds(
      L.latLng(bounds[0][0], bounds[0][1]),
      L.latLng(bounds[1][0], bounds[1][1])
    )

    L.imageOverlay(imageUrl, imageBounds).addTo(this.map)
  }
}

// Singleton instance
export const mapService = new MapService()
