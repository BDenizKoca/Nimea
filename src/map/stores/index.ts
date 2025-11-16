import { atom, computed } from 'nanostores'
import type { Marker, TerrainCollection, RouteStop, AppConfig } from '../types'

// Core reactive state stores
export const $markers = atom<Marker[]>([])
export const $terrain = atom<TerrainCollection>({ type: 'FeatureCollection', features: [] })
export const $route = atom<RouteStop[]>([])
export const $isDmMode = atom(false)
export const $isAuthenticated = atom(false)
export const $currentLanguage = atom<'tr' | 'en'>('tr')

// Dirty state tracking
export const $dirtyMarkers = atom(false)
export const $dirtyTerrain = atom(false)

// Computed stores
export const $isDirty = computed(
  [$dirtyMarkers, $dirtyTerrain],
  (markers, terrain) => markers || terrain
)

export const $canPublish = computed(
  [$isDmMode, $isAuthenticated, $isDirty],
  (dmMode, authenticated, dirty) => dmMode && authenticated && dirty
)

// Mark data as dirty when it changes (DM mode only)
$markers.subscribe(() => {
  if ($isDmMode.get()) {
    $dirtyMarkers.set(true)
  }
})

$terrain.subscribe(() => {
  if ($isDmMode.get()) {
    $dirtyTerrain.set(true)
  }
})

// Helper functions
export function markClean() {
  $dirtyMarkers.set(false)
  $dirtyTerrain.set(false)
}

export function addMarker(marker: Marker) {
  $markers.set([...$markers.get(), marker])
}

export function updateMarker(id: string, updates: Partial<Marker>) {
  $markers.set(
    $markers.get().map(m => m.id === id ? { ...m, ...updates } : m)
  )
}

export function removeMarker(id: string) {
  $markers.set($markers.get().filter(m => m.id !== id))
}

export function addRouteStop(stop: RouteStop) {
  $route.set([...$route.get(), stop])
}

export function removeRouteStop(index: number) {
  $route.set($route.get().filter((_, i) => i !== index))
}

export function clearRoute() {
  $route.set([])
}
