/**
 * Nimea Interactive Map - Main Entry Point
 * Zero-backend TTRPG map with Eleventy + Decap CMS
 */

import type { Map as LeafletMap } from 'leaflet'
import type { MapService } from './services/map'
import type { MarkersService } from './services/markers'
import type { TerrainService } from './services/terrain'
import type { RoutingService } from './services/routing'
import { $isDmMode, $markers, $terrain } from './stores'
import { DataLoader } from './services/data-loader'
import { eventBus } from './utils/events'
import './services/i18n' // Initialize i18n system (imported for side effects)
import './services/keyboard-shortcuts' // Initialize keyboard shortcuts (imported for side effects)
import { loadingManager } from './services/loading'

/**
 * Type declarations for global window extensions
 */
declare global {
  interface Window {
    __nimea?: {
      stores: {
        $isDmMode: typeof $isDmMode
        $markers: typeof $markers
        $terrain: typeof $terrain
      }
      eventBus: typeof eventBus
    }
  }
}

console.log('🗺️  Nimea Map v2.0 - Modernized Stack')

// App-level cleanup tracking
const appCleanup = {
  routeToggleHandler: null as (() => void) | null,
  netlifyLoginHandler: null as (() => void) | null,
  netlifyLogoutHandler: null as (() => void) | null,
  routeToggleBtn: null as Element | null,
  services: {
    map: null as MapService | null,
    markers: null as MarkersService | null,
    terrain: undefined as TerrainService | undefined,
    routing: undefined as RoutingService | undefined
  }
}

/**
 * Cleanup all app resources and event listeners
 * Call this when navigating away or unmounting the app
 */
export function cleanup(): void {
  console.log('🧹 Cleaning up app resources...')

  // Remove DOM event listeners
  if (appCleanup.routeToggleBtn && appCleanup.routeToggleHandler) {
    appCleanup.routeToggleBtn.removeEventListener('click', appCleanup.routeToggleHandler)
  }

  // Remove Netlify Identity listeners
  // Note: netlifyIdentity doesn't provide an 'off' method in the public API
  // Handlers will be cleaned up when the page unloads
  // If using an SPA framework, consider using netlifyIdentity.close() to clean up

  // Cleanup services (if they have destroy methods)
  if (appCleanup.services.routing?.destroy) {
    appCleanup.services.routing.destroy()
  }
  if (appCleanup.services.terrain?.destroy) {
    appCleanup.services.terrain.destroy()
  }
  if (appCleanup.services.markers?.destroy) {
    appCleanup.services.markers.destroy()
  }

  // Clear loading manager
  loadingManager.destroy()

  console.log('✅ App cleanup complete')
}

// Initialize DM mode from URL or localStorage
function initDmMode(): void {
  const urlParams = new URLSearchParams(window.location.search)
  const urlDm = urlParams.has('dm')

  let storedDm = false
  try {
    storedDm = localStorage.getItem('nimea.dm') === '1'
  } catch (e) {
    console.warn('localStorage not available:', e)
    eventBus.emit('notification', {
      message: 'Local storage unavailable - settings will not persist',
      type: 'warning'
    })
  }

  const identityDm = !!(
    window.netlifyIdentity &&
    typeof window.netlifyIdentity.currentUser === 'function' &&
    window.netlifyIdentity.currentUser()
  )

  const isDm = urlDm || storedDm || identityDm
  $isDmMode.set(isDm)

  // Persist DM mode
  if (urlDm && !storedDm) {
    try {
      localStorage.setItem('nimea.dm', '1')
    } catch (e) {
      console.warn('Could not persist DM mode:', e)
    }
  }

  console.log(`DM Mode: ${isDm ? 'ENABLED' : 'DISABLED'}`)
}

// Main initialization
async function init(): Promise<void> {
  try {
    // Show loading overlay
    loadingManager.show('Loading map data...')

    console.log('Initializing...')

    // Set DM mode
    initDmMode()

    // Load data
    const loader = new DataLoader()
    const result = await loader.loadAll()

    if (!result.success) {
      console.error('Data loading errors:', result.errors)

      // Check for critical errors (Markers or Config)
      const hasCriticalErrors = result.errors.some(e =>
        e.includes('Markers') || e.includes('markers.json')
      )

      if (hasCriticalErrors) {
        loadingManager.hide()
        eventBus.emit('error', {
          title: 'Critical data missing',
          message: 'Cannot initialize map without markers. Please refresh or contact support.'
        })
        throw new Error('Critical data loading failed: ' + result.errors.join(', '))
      }

      // Non-critical errors (terrain) - show warning but continue
      eventBus.emit('notification', {
        message: `Some features unavailable: ${result.errors.join(', ')}`,
        type: 'warning'
      })
    } else {
      console.log('✅ Data loaded successfully')
      console.log('  Markers:', $markers.get().length)
      console.log('  Terrain features:', $terrain.get().features.length)
    }

    // Load config
    const config = await loader.loadConfig()
    console.log('✅ Config loaded')

    // Initialize Leaflet map
    let map: LeafletMap
    let mapService: MapService
    try {
      const mapModule = await import('./services/map')
      mapService = mapModule.mapService
      map = mapService.initialize()

      // Set up map bounds and background
      if (config.bounds) {
        mapService.setBounds(config.bounds.sw, config.bounds.ne)
        mapService.fitBounds(config.bounds.sw, config.bounds.ne)
      }

      if (config.backgroundImage) {
        mapService.addBackgroundImage(config.backgroundImage.url, config.backgroundImage.bounds)
      }
    } catch (error) {
      console.error('Failed to initialize map service:', error)
      throw new Error('Map initialization failed')
    }

    // Initialize marker service
    let markersService: MarkersService
    try {
      const { MarkersService: MarkersServiceClass } = await import('./services/markers')
      markersService = new MarkersServiceClass(map)
    } catch (error) {
      console.error('Failed to initialize markers service:', error)
      eventBus.emit('notification', {
        message: 'Failed to load markers',
        type: 'error'
      })
      throw error
    }

    // Detect language from URL
    const currentLang = window.location.pathname.startsWith('/en/') ? 'en' : 'tr'
    markersService.setLanguage(currentLang)

    // Check if we need to focus on a specific marker
    const urlParams = new URLSearchParams(window.location.search)
    const focusMarker = urlParams.get('focus')
    if (focusMarker) {
      // Wait for markers to render, then focus
      eventBus.once('markers:rendered', () => {
        markersService.focusMarker(focusMarker)
      })
    }

    // Initialize terrain service
    let terrainService: TerrainService | undefined
    try {
      const { TerrainService: TerrainServiceClass } = await import('./services/terrain')
      terrainService = new TerrainServiceClass(map)
    } catch (error) {
      console.error('Failed to initialize terrain service:', error)
      eventBus.emit('notification', {
        message: 'Failed to load terrain',
        type: 'error'
      })
      // Continue - terrain is optional
    }

    // Initialize routing service
    let routingService: RoutingService | undefined
    try {
      const { RoutingService: RoutingServiceClass } = await import('./services/routing')
      routingService = new RoutingServiceClass(map)
    } catch (error) {
      console.error('Failed to initialize routing service:', error)
      eventBus.emit('notification', {
        message: 'Routing unavailable',
        type: 'warning'
      })
      // Continue - routing is optional
    }

    // Setup route toggle button with cleanup tracking
    const routeToggleBtn = document.querySelector('.route-toggle')
    if (routeToggleBtn && routingService) {
      appCleanup.routeToggleBtn = routeToggleBtn
      appCleanup.routeToggleHandler = () => {
        routingService.toggleRouteSidebar()
      }
      routeToggleBtn.addEventListener('click', appCleanup.routeToggleHandler)
    }

    // Track services for cleanup
    appCleanup.services.markers = markersService
    appCleanup.services.terrain = terrainService
    appCleanup.services.routing = routingService

    // Initialize DM mode if enabled
    if ($isDmMode.get()) {
      console.log('🎮 Initializing DM mode...')
      try {
        // DM controls and modals will be lazy-loaded here
        const { initDmMode } = await import('./services/dm')
        await initDmMode(map, markersService, terrainService)
      } catch (error) {
        console.error('Failed to initialize DM mode:', error)
        eventBus.emit('notification', {
          message: 'DM mode initialization failed',
          type: 'error'
        })
        // Continue - core map still works
      }
    }

    // Emit ready event
    eventBus.emit('ready')
    console.log('🎉 Map ready!')

    // Hide loading overlay
    loadingManager.hide()

  } catch (error) {
    console.error('Fatal initialization error:', error)

    // Hide loading overlay
    loadingManager.hide()

    eventBus.emit('error', {
      title: 'Initialization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

// Handle Netlify Identity with cleanup tracking
if (window.netlifyIdentity) {
  appCleanup.netlifyLoginHandler = () => {
    try {
      localStorage.setItem('nimea.dm', '1')
    } catch (e) {
      console.warn('Could not persist DM mode to localStorage:', e)
    }
    if (!$isDmMode.get()) {
      window.location.reload()
    }
  }

  appCleanup.netlifyLogoutHandler = () => {
    try {
      localStorage.removeItem('nimea.dm')
    } catch (e) {
      console.warn('Could not remove DM mode from localStorage:', e)
    }
    if ($isDmMode.get()) {
      window.location.reload()
    }
  }

  window.netlifyIdentity.on('login', appCleanup.netlifyLoginHandler)
  window.netlifyIdentity.on('logout', appCleanup.netlifyLogoutHandler)
}

// Cleanup on page unload (for SPA navigation)
window.addEventListener('beforeunload', cleanup)

// Export for debugging
if (import.meta.env.DEV) {
  window.__nimea = {
    stores: { $isDmMode, $markers, $terrain },
    eventBus
  }
}
