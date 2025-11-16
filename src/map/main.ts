/**
 * Nimea Interactive Map - Main Entry Point
 * Zero-backend TTRPG map with Eleventy + Decap CMS
 */

import { $isDmMode, $markers, $terrain } from './stores'
import { DataLoader } from './services/data-loader'
import { eventBus } from './utils/events'

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

    // Initialize map (will be implemented next)
    console.log('Map initialization will be implemented next...')

    // Emit ready event
    eventBus.emit('ready')

  } catch (error) {
    console.error('Fatal initialization error:', error)
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
