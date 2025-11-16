/**
 * Terrain Service
 * Handles terrain rendering and styling
 */

import L from 'leaflet'
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON } from 'leaflet'
import { $terrain, $isDmMode } from '../stores'
import type { TerrainCollection } from '../types'
import { TERRAIN_STYLES } from '../constants'
import { eventBus } from '../utils/events'

export class TerrainService {
  private map: LeafletMap | null = null
  private terrainLayer: LeafletGeoJSON | null = null

  constructor(map: LeafletMap) {
    this.map = map

    // Subscribe to terrain changes
    $terrain.subscribe((terrain) => {
      if ($isDmMode.get()) {
        this.renderTerrain(terrain)
      }
    })

    // Subscribe to DM mode changes
    $isDmMode.subscribe((isDm) => {
      if (isDm) {
        this.renderTerrain($terrain.get())
      } else {
        this.hideTerrain()
      }
    })

    console.log('✅ Terrain service initialized')
  }

  /**
   * Get terrain style for a terrain type
   */
  private getTerrainStyle(terrainType: string): L.PathOptions {
    return TERRAIN_STYLES[terrainType as keyof typeof TERRAIN_STYLES] || TERRAIN_STYLES.open
  }

  /**
   * Render terrain on the map
   */
  renderTerrain(terrain: TerrainCollection): void {
    if (!this.map || !$isDmMode.get()) {
      return
    }

    // Remove existing layer
    if (this.terrainLayer) {
      this.map.removeLayer(this.terrainLayer)
      this.terrainLayer = null
    }

    // Create new terrain layer
    this.terrainLayer = L.geoJSON(terrain, {
      style: (feature) => {
        if (feature?.properties?.kind) {
          return this.getTerrainStyle(feature.properties.kind)
        }
        return this.getTerrainStyle('open')
      },
      onEachFeature: (feature, layer) => {
        // Store feature reference on layer for DM tools
        ;(layer as any).feature = feature

        // Add click handler for DM mode
        layer.on('click', () => {
          if ($isDmMode.get()) {
            eventBus.emit('terrain:click', feature)
          }
        })
      }
    }).addTo(this.map)

    console.log(`Rendered ${terrain.features.length} terrain features`)

    // Emit event for DM tools
    eventBus.emit('terrain:rendered', { terrainLayer: this.terrainLayer })
  }

  /**
   * Hide terrain layer
   */
  hideTerrain(): void {
    if (this.terrainLayer && this.map && this.map.hasLayer(this.terrainLayer)) {
      this.map.removeLayer(this.terrainLayer)
      this.terrainLayer = null
      eventBus.emit('terrain:hidden')
    }
  }

  /**
   * Show terrain layer
   */
  showTerrain(): void {
    if (!this.terrainLayer && $isDmMode.get()) {
      this.renderTerrain($terrain.get())
    } else if (this.terrainLayer && this.map && !this.map.hasLayer(this.terrainLayer)) {
      this.terrainLayer.addTo(this.map)
      eventBus.emit('terrain:shown')
    }
  }

  /**
   * Get terrain as GeoJSON
   */
  getTerrainAsGeoJSON(): TerrainCollection {
    const geojson: TerrainCollection = {
      type: 'FeatureCollection',
      features: []
    }

    if (this.terrainLayer) {
      this.terrainLayer.eachLayer((layer) => {
        const feature = (layer as any).toGeoJSON()
        // Ensure properties are preserved
        if ((layer as any).feature && (layer as any).feature.properties) {
          feature.properties = (layer as any).feature.properties
        }
        geojson.features.push(feature)
      })
    }

    return geojson
  }

  /**
   * Get the terrain layer (for DM tools)
   */
  getTerrainLayer(): LeafletGeoJSON | null {
    return this.terrainLayer
  }
}
