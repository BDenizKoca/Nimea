/**
 * DM Mode Service
 * Lazy-loaded when DM mode is enabled
 */

import type { Map as LeafletMap } from 'leaflet'
import type { MarkersService } from './markers'
import type { TerrainService } from './terrain'
import { eventBus } from '../utils/events'

export async function initDmMode(
  map: LeafletMap,
  markersService: MarkersService,
  terrainService: TerrainService
): Promise<void> {
  console.log('🎮 DM Mode initializing...')

  // TODO: Load DM controls module
  // TODO: Load DM modals module
  // TODO: Load DM forms handler
  // TODO: Setup DM-specific event handlers

  // For now, just log that DM mode is ready
  console.log('✅ DM Mode initialized')
  eventBus.emit('dm:ready', { map, markersService, terrainService })
}
