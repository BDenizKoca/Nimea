import { describe, it, expect, beforeEach } from 'vitest'
import { $markers, $isDmMode, $dirtyMarkers, addMarker, updateMarker, removeMarker } from '../stores'
import type { Marker } from '../types'

describe('Marker Store', () => {
  beforeEach(() => {
    // Reset stores before each test
    $markers.set([])
    $isDmMode.set(false)
    $dirtyMarkers.set(false)
  })

  it('should start empty', () => {
    expect($markers.get()).toEqual([])
  })

  it('should add a marker', () => {
    const marker: Marker = {
      id: 'test-1',
      name: 'Test City',
      x: 100,
      y: 200,
      type: 'city',
      public: true
    }

    addMarker(marker)
    expect($markers.get()).toHaveLength(1)
    expect($markers.get()[0]).toEqual(marker)
  })

  it('should update a marker', () => {
    const marker: Marker = {
      id: 'test-1',
      name: 'Test City',
      x: 100,
      y: 200,
      type: 'city',
      public: true
    }

    addMarker(marker)
    updateMarker('test-1', { name: 'Updated City' })

    expect($markers.get()[0].name).toBe('Updated City')
  })

  it('should remove a marker', () => {
    const marker: Marker = {
      id: 'test-1',
      name: 'Test City',
      x: 100,
      y: 200,
      type: 'city',
      public: true
    }

    addMarker(marker)
    expect($markers.get()).toHaveLength(1)

    removeMarker('test-1')
    expect($markers.get()).toHaveLength(0)
  })

  it('should mark dirty when marker added in DM mode', () => {
    $isDmMode.set(true)

    const marker: Marker = {
      id: 'test-1',
      name: 'Test City',
      x: 100,
      y: 200,
      type: 'city',
      public: true
    }

    addMarker(marker)
    expect($dirtyMarkers.get()).toBe(true)
  })

  it('should not mark dirty when not in DM mode', () => {
    $isDmMode.set(false)

    const marker: Marker = {
      id: 'test-1',
      name: 'Test City',
      x: 100,
      y: 200,
      type: 'city',
      public: true
    }

    addMarker(marker)
    expect($dirtyMarkers.get()).toBe(false)
  })
})
