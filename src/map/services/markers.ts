/**
 * Markers Service
 * Handles marker rendering and icon scaling
 */

import L from 'leaflet'
import type { Map as LeafletMap, Marker as LeafletMarker, DivIcon } from 'leaflet'
import { $markers, $isDmMode } from '../stores'
import type { Marker } from '../types'
import { eventBus } from '../utils/events'
import { addTouchTap } from './touch-events'

export class MarkersService {
  private map: LeafletMap | null = null
  private markersLayer: L.LayerGroup | null = null
  private allMarkers: Array<LeafletMarker & { markerData?: Marker }> = []
  private currentLanguage: string = 'tr'
  private unsubscribeMarkers?: () => void

  constructor(map: LeafletMap) {
    this.map = map
    this.markersLayer = L.layerGroup().addTo(map)

    // Subscribe to marker changes
    this.unsubscribeMarkers = $markers.subscribe((markers) => {
      this.renderMarkers([...markers]) // Create mutable copy
    })

    // Setup marker scaling on zoom
    this.setupMarkerScaling()

    console.log('✅ Markers service initialized')
  }

  /**
   * Cleanup all event listeners and subscriptions
   */
  destroy(): void {
    // Unsubscribe from stores
    if (this.unsubscribeMarkers) {
      this.unsubscribeMarkers()
    }

    // Remove map event listeners
    if (this.map) {
      this.map.off('zoom')
      this.map.off('zoomend')
    }

    // Remove marker layer
    if (this.markersLayer && this.map) {
      this.map.removeLayer(this.markersLayer)
    }

    this.allMarkers = []
    this.map = null
    this.markersLayer = null

    console.log('✅ Markers service destroyed')
  }

  /**
   * Set current language for i18n
   */
  setLanguage(lang: 'tr' | 'en'): void {
    this.currentLanguage = lang
    this.renderMarkers($markers.get())
  }

  /**
   * Setup marker scaling on zoom
   */
  private setupMarkerScaling(): void {
    if (!this.map) return

    this.map.on('zoom', () => this.updateAllMarkerSizes())
    this.map.on('zoomend', () => this.updateAllMarkerSizes())

    // Ensure correct initial size
    setTimeout(() => this.updateAllMarkerSizes(), 0)
  }

  /**
   * Calculate icon size based on zoom level
   */
  private calculateIconSize(zoom: number): number {
    if (!this.map) return 32

    const minZ = this.map.getMinZoom()
    const maxZ = this.map.getMaxZoom()
    const span = Math.max(1, maxZ - minZ)
    const t = (zoom - minZ) / span // 0 at min zoom, 1 at max zoom

    // Apply slight ease to bias sizes larger at common zooms
    const eased = Math.pow(t, 1.15)

    // Size range: 22px at min zoom, 140px at max zoom
    const minSize = 22
    const maxSize = 140
    const size = minSize + eased * (maxSize - minSize)

    return Math.round(size)
  }

  /**
   * Update all marker sizes based on current zoom
   */
  private updateAllMarkerSizes(): void {
    if (!this.map) return

    const zoom = this.map.getZoom()
    const newSize = this.calculateIconSize(zoom)

    this.allMarkers.forEach((marker) => {
      // Only scale custom icons
      if (marker.markerData && (marker.markerData.iconUrl || marker.markerData.customIcon)) {
        const icon = marker.getIcon() as DivIcon
        if (icon) {
          // Update icon size and anchor
          icon.options.iconSize = [newSize, newSize]
          icon.options.iconAnchor = [newSize / 2, newSize]
          icon.options.popupAnchor = [0, -newSize]

          // For emoji/text icons, update font size
          if (marker.markerData.customIcon) {
            const fontSize = Math.round(newSize * 0.78)
            icon.options.html = `<div class="custom-marker-icon" style="font-size: ${fontSize}px">${marker.markerData.customIcon}</div>`
          }

          // Re-apply icon to force re-render
          marker.setIcon(icon)
        }
      }
    })
  }

  /**
   * Create custom marker icon
   */
  private createMarkerIcon(markerData: Marker, initialSize: number): L.Icon | L.DivIcon | null {
    let iconHtml = ''
    let iconClass = 'custom-marker'

    if (markerData.iconUrl) {
      iconHtml = `<img src="${markerData.iconUrl}" class="custom-marker-image" style="display:block; width:100%; height:100%; object-fit:contain;">`
      iconClass += ' custom-image-marker'
    } else if (markerData.customIcon) {
      const fontSize = Math.round(initialSize * 0.78)
      iconHtml = `<div class="custom-marker-icon" style="font-size:${fontSize}px; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">${markerData.customIcon}</div>`
    } else {
      return null // Use Leaflet's default icon
    }

    return L.divIcon({
      html: iconHtml,
      className: iconClass,
      iconSize: [initialSize, initialSize],
      iconAnchor: [initialSize / 2, initialSize],
      popupAnchor: [0, -initialSize]
    })
  }

  /**
   * Get marker name for current language
   */
  private getMarkerName(marker: Marker): string {
    if (marker.i18n) {
      return this.currentLanguage === 'en' ? marker.i18n.en.name : marker.i18n.tr.name
    }
    return marker.name
  }

  /**
   * Get marker summary for current language
   */
  private getMarkerSummary(marker: Marker): string {
    if (marker.i18n) {
      return this.currentLanguage === 'en' ? marker.i18n.en.summary : marker.i18n.tr.summary
    }
    return marker.summary || ''
  }

  /**
   * Get marker faction for current language
   */
  private getMarkerFaction(marker: Marker): string | undefined {
    if (marker.i18n) {
      return this.currentLanguage === 'en' ? marker.i18n.en.faction : marker.i18n.tr.faction
    }
    return marker.faction
  }

  /**
   * Create popup content for marker
   */
  private createPopupContent(marker: Marker): string {
    const name = this.getMarkerName(marker)
    const summary = this.getMarkerSummary(marker)
    const faction = this.getMarkerFaction(marker)

    let html = `<div class="marker-popup">
      <h3>${name}</h3>`

    if (faction) {
      html += `<p class="faction"><em>${faction}</em></p>`
    }

    if (summary) {
      html += `<p>${summary}</p>`
    }

    // Add wiki link if exists
    if (marker.wikiSlug) {
      html += `<p><a href="/${this.currentLanguage}/lore/${marker.wikiSlug}/" target="_blank">Read more →</a></p>`
    }

    html += `</div>`

    return html
  }

  /**
   * Render all markers on the map
   */
  renderMarkers(markers: Marker[]): void {
    if (!this.map || !this.markersLayer) return

    // Clear existing markers
    this.markersLayer.clearLayers()
    this.allMarkers = []

    const isDm = $isDmMode.get()
    const zoom = this.map.getZoom()
    const iconSize = this.calculateIconSize(zoom)

    markers.forEach((markerData) => {
      // Skip private markers in public mode
      if (!isDm && markerData.public === false) {
        return
      }

      // Create marker
      const latLng = L.latLng(markerData.y, markerData.x)
      const icon = this.createMarkerIcon(markerData, iconSize)

      const marker = icon
        ? L.marker(latLng, { icon })
        : L.marker(latLng)

      // Store marker data for later reference
      ;(marker as any).markerData = markerData

      // Add popup
      const popupContent = this.createPopupContent(markerData)
      marker.bindPopup(popupContent)

      // Add to layer
      if (this.markersLayer) {
        marker.addTo(this.markersLayer)
      }

      // Store reference
      this.allMarkers.push(marker as any)

      // Add click handler for desktop
      marker.on('click', () => {
        // In DM mode, emit special event for editing
        if (isDm) {
          eventBus.emit('marker:click:dm', markerData)
        } else {
          eventBus.emit('marker:click', markerData)
        }
      })

      // Add touch tap handler for mobile (prevents false taps during panning)
      addTouchTap(marker, () => {
        // In DM mode, emit special event for editing
        if (isDm) {
          eventBus.emit('marker:click:dm', markerData)
        } else {
          eventBus.emit('marker:click', markerData)
        }
      })
    })

    console.log(`Rendered ${this.allMarkers.length} markers`)

    // Emit event
    eventBus.emit('markers:rendered', { count: this.allMarkers.length })
  }

  /**
   * Show markers layer
   */
  show(): void {
    if (this.map && this.markersLayer) {
      if (!this.map.hasLayer(this.markersLayer)) {
        this.markersLayer.addTo(this.map)
      }
    }
  }

  /**
   * Hide markers layer
   */
  hide(): void {
    if (this.map && this.markersLayer && this.map.hasLayer(this.markersLayer)) {
      this.map.removeLayer(this.markersLayer)
    }
  }

  /**
   * Focus on a specific marker
   */
  focusMarker(markerId: string): void {
    const marker = this.allMarkers.find((m) => m.markerData?.id === markerId)
    if (marker && this.map) {
      this.map.setView(marker.getLatLng(), 1) // Zoom level 1
      marker.openPopup()
    }
  }
}
