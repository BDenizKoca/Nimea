import { validateMarkers } from '../schemas/marker'
import { validateTerrainCollection } from '../schemas/terrain'
import { $markers, $terrain } from '../stores'
import type { Marker, AppConfig } from '../types'

export class DataLoader {
  private basePath: string

  constructor(basePath = '') {
    this.basePath = basePath
  }

  async loadAll(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      await this.loadMarkers()
    } catch (e) {
      errors.push(`Markers: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }

    try {
      await this.loadTerrain()
    } catch (e) {
      errors.push(`Terrain: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }

    return {
      success: errors.length === 0,
      errors
    }
  }

  async loadMarkers(): Promise<void> {
    try {
      const response = await fetch(`${this.basePath}data/markers.json`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const markers = data.markers || []

      // Validate markers
      const validation = validateMarkers(markers)

      if (!validation.success) {
        console.error('Marker validation errors:', validation.error.issues)
        throw new Error(`Invalid marker data: ${validation.error.issues.length} errors`)
      }

      // Migrate legacy markers without i18n structure
      const migratedMarkers = markers.map((marker: Marker) => {
        if (!marker.i18n && marker.name) {
          return {
            ...marker,
            i18n: {
              tr: {
                name: marker.name,
                summary: marker.summary || '',
                faction: marker.faction
              },
              en: {
                name: marker.name,
                summary: marker.summary || '',
                faction: marker.faction
              }
            }
          }
        }
        return marker
      })

      $markers.set(migratedMarkers)
    } catch (error) {
      console.error('Failed to load markers:', error)
      // Set empty array on error
      $markers.set([])
      throw error
    }
  }

  async loadTerrain(): Promise<void> {
    try {
      const response = await fetch(`${this.basePath}data/terrain.geojson`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Validate terrain
      const validation = validateTerrainCollection(data)

      if (!validation.success) {
        console.error('Terrain validation errors:', validation.error.issues)
        throw new Error(`Invalid terrain data: ${validation.error.issues.length} errors`)
      }

      // Ensure all features have internal IDs
      const migratedFeatures = data.features.map((feature: any, index: number) => {
        if (!feature.properties._internal_id) {
          feature.properties._internal_id = `terrain_${Date.now()}_${index}`
        }
        return feature
      })

      $terrain.set({
        type: 'FeatureCollection',
        features: migratedFeatures
      })
    } catch (error) {
      console.error('Failed to load terrain:', error)
      // Set empty collection on error
      $terrain.set({ type: 'FeatureCollection', features: [] })
      throw error
    }
  }

  async loadConfig(): Promise<AppConfig> {
    try {
      const response = await fetch(`${this.basePath}data/config.json`)

      if (!response.ok) {
        // Return defaults if config doesn't exist
        return this.getDefaultConfig()
      }

      const config = await response.json()
      return { ...this.getDefaultConfig(), ...config }
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error)
      return this.getDefaultConfig()
    }
  }

  private getDefaultConfig(): AppConfig {
    return {
      kmPerPixel: 100 / 115,
      terrainCosts: {
        road: 0.7,
        open: 1.0,
        difficult: 2.0,
        impassable: 999
      },
      profiles: {
        walking: { label: 'Walking', landSpeed: 30, seaSpeed: 120 },
        wagon: { label: 'Wagon', landSpeed: 50, seaSpeed: 120 },
        horse: { label: 'Horse', landSpeed: 60, seaSpeed: 120 }
      }
    }
  }
}
