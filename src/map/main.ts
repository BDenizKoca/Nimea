/**
 * Nimea Interactive Map - Main Entry Point
 * Zero-backend TTRPG map with Eleventy + Decap CMS
 */

import { $isDmMode, $markers, $terrain } from './stores'
import { DataLoader } from './services/data-loader'
import { eventBus } from './utils/events'
import './services/i18n' // Initialize i18n system (imported for side effects)
import './services/keyboard-shortcuts' // Initialize keyboard shortcuts (imported for side effects)
import { loadingManager } from './services/loading'

console.log('🗺️  Nimea Map v2.0 - Modernized Stack')

// Initialize DM mode from URL or localStorage
function initDmMode(): void {
  const urlParams = new URLSearchParams(window.location.search)
  const urlDm = urlParams.has('dm')

  let storedDm = false
  try {
    storedDm = localStorage.getItem('nimea.dm') === '1'
  } catch (e) {
    console.warn('localStorage not available')
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
      console.warn('Could not persist DM mode')
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
      // Show user-friendly error
      eventBus.emit('error', {
        title: 'Failed to load map data',
        message: result.errors.join(', ')
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
    let map: any
    let mapService: any
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
    let markersService: any
    try {
      const { MarkersService } = await import('./services/markers')
      markersService = new MarkersService(map)
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
    let terrainService: any
    try {
      const { TerrainService } = await import('./services/terrain')
      terrainService = new TerrainService(map)
    } catch (error) {
      console.error('Failed to initialize terrain service:', error)
      eventBus.emit('notification', {
        message: 'Failed to load terrain',
        type: 'error'
      })
      // Continue - terrain is optional
    }

    // Initialize routing service
    let routingService: any
    try {
      const { RoutingService } = await import('./services/routing')
      routingService = new RoutingService(map)
    } catch (error) {
      console.error('Failed to initialize routing service:', error)
      eventBus.emit('notification', {
        message: 'Routing unavailable',
        type: 'warning'
      })
      // Continue - routing is optional
    }

    // Setup route toggle button
    const routeToggleBtn = document.querySelector('.route-toggle')
    if (routeToggleBtn && routingService) {
      routeToggleBtn.addEventListener('click', () => {
        routingService.toggleRouteSidebar()
      })
    }

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

// Handle Netlify Identity
if (window.netlifyIdentity) {
  window.netlifyIdentity.on('login', () => {
    try {
      localStorage.setItem('nimea.dm', '1')
    } catch (e) {}
    if (!$isDmMode.get()) {
      window.location.reload()
    }
  })

  window.netlifyIdentity.on('logout', () => {
    try {
      localStorage.removeItem('nimea.dm')
    } catch (e) {}
    if ($isDmMode.get()) {
      window.location.reload()
    }
  })
}

// Export for debugging
if (import.meta.env.DEV) {
  ;(window as any).__nimea = {
    stores: { $isDmMode, $markers, $terrain },
    eventBus
  }
}
