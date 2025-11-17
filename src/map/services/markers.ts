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
import { throttle } from '../utils/debounce'

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

    // Throttle zoom updates to improve performance (max once per 100ms)
    const throttledUpdate = throttle(() => this.updateAllMarkerSizes(), 100)

    this.map.on('zoom', throttledUpdate)
    this.map.on('zoomend', () => this.updateAllMarkerSizes()) // Final update for accuracy

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
    const isDm = $isDmMode.get()

    let html = `<div class="marker-popup">
      <h3>${name}</h3>`

    if (faction) {
      html += `<p class="faction"><em>${faction}</em></p>`
    }

    // Show port indicator
    if (marker.isPort) {
      const portText = this.currentLanguage === 'en' ? 'Port' : 'Liman'
      html += `<p class="port-indicator" style="color: #2196F3; font-weight: 500;">⚓ ${portText}</p>`
    }

    if (summary) {
      html += `<p>${summary}</p>`
    }

    // Add wiki link if exists
    if (marker.wikiSlug) {
      html += `<p><a href="/${this.currentLanguage}/lore/${marker.wikiSlug}/" target="_blank">Read more →</a></p>`
    }

    // Add DM controls (Edit/Delete buttons)
    if (isDm) {
      const editText = this.currentLanguage === 'en' ? 'Edit' : 'Düzenle'
      const deleteText = this.currentLanguage === 'en' ? 'Delete' : 'Sil'

      html += `
        <div class="marker-popup-actions" style="margin-top: 12px; display: flex; gap: 8px;">
          <button
            class="marker-edit-btn"
            data-marker-id="${marker.id}"
            style="flex: 1; padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;"
          >
            ✏️ ${editText}
          </button>
          <button
            class="marker-delete-btn"
            data-marker-id="${marker.id}"
            style="flex: 1; padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;"
          >
            🗑️ ${deleteText}
          </button>
        </div>
      `
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

      // Setup popup button event handlers (for DM mode Edit/Delete buttons)
      if (isDm) {
        marker.on('popupopen', () => {
          // Find the popup element
          const popup = marker.getPopup()
          if (!popup) return

          const popupElement = popup.getElement()
          if (!popupElement) return

          // Add Edit button handler
          const editBtn = popupElement.querySelector('.marker-edit-btn')
          if (editBtn) {
            editBtn.addEventListener('click', (e) => {
              e.stopPropagation() // Prevent marker click event
              marker.closePopup() // Close popup first
              eventBus.emit('marker:click:dm', markerData)
            })
          }

          // Add Delete button handler
          const deleteBtn = popupElement.querySelector('.marker-delete-btn')
          if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
              e.stopPropagation() // Prevent marker click event
              const confirmText =
                this.currentLanguage === 'en'
                  ? `Delete marker "${markerData.name}"? This cannot be undone.`
                  : `"${markerData.name}" işaretini silmek istediğine emin misin? Bu işlem geri alınamaz.`

              if (confirm(confirmText)) {
                marker.closePopup()
                eventBus.emit('marker:delete', markerData.id)
              }
            })
          }
        })
      }

      // Add to layer
      if (this.markersLayer) {
        marker.addTo(this.markersLayer)
      }

      // Store reference
      this.allMarkers.push(marker as any)

      // Add click handler for desktop (only for non-DM mode or when popup is closed)
      marker.on('click', () => {
        // In regular mode, emit click event
        if (!isDm) {
          eventBus.emit('marker:click', markerData)
        }
        // In DM mode, clicking the marker itself (not popup buttons) does nothing
        // Edit/Delete buttons in popup handle those actions
      })

      // Add touch tap handler for mobile
      addTouchTap(marker, () => {
        // In regular mode, emit click event
        if (!isDm) {
          eventBus.emit('marker:click', markerData)
        }
        // In DM mode, tapping just opens the popup with Edit/Delete buttons
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
