// Touch event handler for mobile marker tap detection
// Eliminates false touches from panning/zooming

import type { Marker as LeafletMarker } from 'leaflet'

const TOUCH_DURATION_MS = 500
const TOUCH_DISTANCE_PX = 10

interface TouchState {
  startTime: number | null
  startPos: { clientX: number; clientY: number } | null
}

/**
 * Add touch tap detection to a marker
 * Triggers callback only if touch duration < 500ms and distance < 10px
 * This prevents false taps during map panning
 */
export function addTouchTap(marker: LeafletMarker, callback: (e: any) => void): void {
  const touchState: TouchState = {
    startTime: null,
    startPos: null
  }

  marker.on('touchstart', (e: any) => {
    e.originalEvent.preventDefault()
    touchState.startTime = Date.now()
    touchState.startPos = e.originalEvent.touches[0]
      ? {
          clientX: e.originalEvent.touches[0].clientX,
          clientY: e.originalEvent.touches[0].clientY
        }
      : null
  })

  marker.on('touchend', (e: any) => {
    e.originalEvent.preventDefault()

    if (touchState.startTime && touchState.startPos) {
      const touchDuration = Date.now() - touchState.startTime
      const touchEnd = e.originalEvent.changedTouches[0]

      if (!touchEnd) {
        touchState.startTime = null
        touchState.startPos = null
        return
      }

      const deltaX = Math.abs(touchEnd.clientX - touchState.startPos.clientX)
      const deltaY = Math.abs(touchEnd.clientY - touchState.startPos.clientY)
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      if (touchDuration < TOUCH_DURATION_MS && distance < TOUCH_DISTANCE_PX) {
        callback(e)
      }

      touchState.startTime = null
      touchState.startPos = null
    }
  })
}

/**
 * Enable tap support on Leaflet map for mobile devices
 * Leaflet has tap support built-in via the 'tap' option
 */
export function enableMapTap(mapOptions: any): any {
  return {
    ...mapOptions,
    tap: true, // Enable tap support for mobile
    tapTolerance: 15 // Tap tolerance in pixels
  }
}
