/**
 * DM Mode Service
 * Main integration point for all DM functionality
 * Lazy-loaded when DM mode is enabled
 */

import type { Map as LeafletMap } from 'leaflet'
import type { MarkersService } from './markers'
import type { TerrainService } from './terrain'
import { DmControls } from './dm-controls'
import { DmModals } from './dm-modals'
import { $markers, $terrain, $isAuthenticated, markClean } from '../stores'
import { eventBus } from '../utils/events'
import { setupUndoRedoShortcuts, undoRedoManager } from './undo-redo'

export async function initDmMode(
  map: LeafletMap,
  markersService: MarkersService,
  terrainService: TerrainService
): Promise<void> {
  console.log('🎮 DM Mode initializing...')

  // Initialize Git client if available
  await initializeGitClient()

  // Setup undo/redo system with keyboard shortcuts
  setupUndoRedoShortcuts()

  // Add Leaflet-Geoman controls for drawing
  addGeomanControls(map)

  // Initialize DM controls
  const dmControls = new DmControls(map)
  dmControls.addAllControls()

  // Initialize DM modals
  const dmModals = new DmModals(map)
  dmModals.setupAllModals()

  // Setup event listeners
  setupMapEventListeners(map, dmModals, dmControls)
  setupDmEventHandlers()

  console.log('✅ DM Mode initialized (Undo/Redo: Ctrl+Z / Ctrl+Shift+Z)')
  eventBus.emit('dm:ready', { map, markersService, terrainService, dmControls, dmModals })
}

/**
 * Initialize Git client for live CMS functionality
 */
async function initializeGitClient(): Promise<void> {
  try {
    if (window.gitClient) {
      await window.gitClient.initialize()
      if (window.gitClient.isAuthenticated) {
        $isAuthenticated.set(true)
        eventBus.emit('notification', {
          message: 'Live CMS mode enabled - changes save directly to repository!',
          type: 'success'
        })
      } else {
        eventBus.emit('notification', {
          message: 'Click "Login" to enable live CMS mode',
          type: 'info'
        })
      }
    }
  } catch (error) {
    console.warn('Git Gateway not available:', error)
    eventBus.emit('notification', {
      message: 'Offline mode - use Export button to save data',
      type: 'info'
    })
  }
}

/**
 * Add Leaflet-Geoman drawing controls
 */
function addGeomanControls(map: LeafletMap): void {
  const pm = (map as any).pm

  if (pm && pm.addControls) {
    pm.addControls({
      position: 'topleft',
      drawMarker: true,
      drawPolygon: true,
      drawPolyline: true,
      editMode: true,
      removalMode: true
    })
  }
}

/**
 * Setup map event listeners for Geoman interactions
 */
function setupMapEventListeners(
  map: LeafletMap,
  dmModals: DmModals,
  dmControls: DmControls
): void {
  // Listen for new shapes created by Geoman
  map.on('pm:create', (e: any) => {
    if (e.shape === 'Marker') {
      const marker = e.layer
      dmModals.showMarkerCreationModal(marker.getLatLng())
    } else if (e.shape === 'Polygon' || e.shape === 'Line') {
      // Terrain creation
      const terrainType = dmControls.getCurrentTerrainMode() || 'open'
      eventBus.emit('terrain:created', { layer: e.layer, type: terrainType })
    }
  })

  // Track marker edits
  map.on('pm:markerdragend', (e: any) => {
    const marker = e.layer
    const markerData = (marker as any).markerData
    if (markerData) {
      const latLng = marker.getLatLng()
      eventBus.emit('marker:position-changed', {
        id: markerData.id,
        x: latLng.lng,
        y: latLng.lat
      })
    }
  })

  // Track terrain edits
  map.on('pm:edit', (e: any) => {
    const layer = e.layer
    if (layer.feature) {
      eventBus.emit('terrain:edited', { layer })
    }
  })

  // Track deletions
  map.on('pm:remove', (e: any) => {
    const layer = e.layer
    const markerData = (layer as any).markerData

    if (markerData) {
      eventBus.emit('marker:deleted', markerData.id)
    } else if (layer.feature) {
      eventBus.emit('terrain:deleted', { layer })
    }
  })

  // Handle marker click in DM mode for editing
  eventBus.on('marker:click:dm', (markerData) => {
    dmModals.showMarkerEditModal(markerData)
  })
}

/**
 * Setup DM event handlers
 */
function setupDmEventHandlers(): void {
  // Export data
  eventBus.on('dm:export', () => {
    exportData()
  })

  // Publish data
  eventBus.on('dm:publish', async () => {
    await publishAll()
  })

  // Optimize/merge terrain (async for lazy-loading Turf.js)
  eventBus.on('dm:optimize-terrain', async () => {
    await mergeSelectedTerrain()
  })

  // Delete node
  eventBus.on('dm:delete-node', () => {
    eventBus.emit('notification', {
      message: 'Select a vertex in edit mode first',
      type: 'info'
    })
  })

  // Undo/Redo
  eventBus.on('dm:undo', () => {
    undoRedoManager.undo()
  })

  eventBus.on('dm:redo', () => {
    undoRedoManager.redo()
  })
}

/**
 * Export data to JSON files
 */
function exportData(): void {
  const markers = $markers.get()
  const terrain = $terrain.get()

  // Download markers
  const markersBlob = new Blob([JSON.stringify({ markers }, null, 2)], { type: 'application/json' })
  const markersUrl = URL.createObjectURL(markersBlob)
  const markersLink = document.createElement('a')
  markersLink.href = markersUrl
  markersLink.download = 'markers.json'
  markersLink.click()
  URL.revokeObjectURL(markersUrl)

  // Download terrain
  const terrainBlob = new Blob([JSON.stringify(terrain, null, 2)], { type: 'application/json' })
  const terrainUrl = URL.createObjectURL(terrainBlob)
  const terrainLink = document.createElement('a')
  terrainLink.href = terrainUrl
  terrainLink.download = 'terrain.geojson'
  terrainLink.click()
  URL.revokeObjectURL(terrainUrl)

  eventBus.emit('notification', {
    message: 'Data exported successfully',
    type: 'success'
  })
}

/**
 * Publish all changes to repository
 */
async function publishAll(): Promise<void> {
  if (!$isAuthenticated.get()) {
    eventBus.emit('notification', {
      message: 'Please login first',
      type: 'error'
    })
    return
  }

  try {
    const markers = $markers.get()
    const terrain = $terrain.get()

    if (!window.gitClient) {
      throw new Error('Git client not available')
    }

    // Save markers
    await window.gitClient.saveFile(
      'map/data/markers.json',
      JSON.stringify({ markers }, null, 2),
      'Update markers from DM mode'
    )

    // Save terrain
    await window.gitClient.saveFile(
      'map/data/terrain.geojson',
      JSON.stringify(terrain, null, 2),
      'Update terrain from DM mode'
    )

    markClean()

    eventBus.emit('notification', {
      message: 'Changes published successfully!',
      type: 'success'
    })
  } catch (error) {
    console.error('Publish failed:', error)
    eventBus.emit('notification', {
      message: `Publish failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'error'
    })
  }
}

/**
 * Merge selected terrain polygons into one
 * Uses Turf.js union to combine overlapping polygons (lazy-loaded)
 */
async function mergeSelectedTerrain(): Promise<void> {
  const terrain = $terrain.get()

  // Find selected features (features with selected=true in properties)
  const selectedFeatures = terrain.features.filter((f: any) => f.properties?.selected === true)

  if (selectedFeatures.length < 2) {
    eventBus.emit('notification', {
      message: 'Please select at least 2 terrain polygons to merge',
      type: 'info'
    })
    return
  }

  try {
    // Lazy-load Turf.js only when needed (DM-only operation)
    eventBus.emit('notification', {
      message: 'Loading terrain merge library...',
      type: 'info'
    })

    // Check if already loaded globally
    let turf = (window as any).turf
    if (!turf) {
      // Dynamically import Turf.js
      // Note: @turf/turf is loaded via CDN script tag in HTML
      // If not available, fall back to error
      throw new Error('Turf.js library not loaded. Please check CDN script in HTML.')
    }

    // Merge all selected polygons using Turf.js union
    let merged = selectedFeatures[0]
    for (let i = 1; i < selectedFeatures.length; i++) {
      merged = turf.union(merged, selectedFeatures[i])
    }

    // Use the terrain type of the first selected feature
    const terrainType = selectedFeatures[0].properties.kind

    // Create new merged feature
    const mergedFeature = {
      type: 'Feature' as const,
      properties: {
        kind: terrainType,
        selected: false
      },
      geometry: merged.geometry
    }

    // Remove selected features and add merged one
    const newFeatures = terrain.features.filter((f: any) => f.properties?.selected !== true)
    newFeatures.push(mergedFeature as any) // Cast to any since Turf types may not match exactly

    // Update terrain store
    $terrain.set({
      type: 'FeatureCollection',
      features: newFeatures
    })

    eventBus.emit('notification', {
      message: `Merged ${selectedFeatures.length} terrain polygons`,
      type: 'success'
    })

    eventBus.emit('dirty')
  } catch (error) {
    console.error('Terrain merge failed:', error)
    eventBus.emit('notification', {
      message: `Merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'error'
    })
  }
}
