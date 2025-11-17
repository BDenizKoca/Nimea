// Undo/Redo system for DM operations using Command pattern

import { $terrain, addMarker, updateMarker, removeMarker } from '../stores'
import type { Marker, TerrainFeature } from '../types'
import { eventBus } from '../utils/events'

/**
 * Command interface for undo/redo operations
 */
interface Command {
  execute(): void
  undo(): void
  description: string
}

/**
 * Add Marker Command
 */
class AddMarkerCommand implements Command {
  description: string
  private marker: Marker

  constructor(marker: Marker) {
    this.marker = marker
    this.description = `Add marker: ${marker.name}`
  }

  execute(): void {
    addMarker(this.marker)
  }

  undo(): void {
    removeMarker(this.marker.id)
  }
}

/**
 * Remove Marker Command
 */
class RemoveMarkerCommand implements Command {
  description: string
  private marker: Marker

  constructor(marker: Marker) {
    this.marker = marker
    this.description = `Delete marker: ${marker.name}`
  }

  execute(): void {
    removeMarker(this.marker.id)
  }

  undo(): void {
    addMarker(this.marker)
  }
}

/**
 * Update Marker Command
 */
class UpdateMarkerCommand implements Command {
  description: string
  private markerId: string
  private oldData: Partial<Marker>
  private newData: Partial<Marker>

  constructor(markerId: string, oldData: Partial<Marker>, newData: Partial<Marker>) {
    this.markerId = markerId
    this.oldData = oldData
    this.newData = newData
    this.description = `Update marker: ${newData.name || markerId}`
  }

  execute(): void {
    updateMarker(this.markerId, this.newData)
  }

  undo(): void {
    updateMarker(this.markerId, this.oldData)
  }
}

/**
 * Add Terrain Feature Command
 */
class AddTerrainCommand implements Command {
  description: string
  private feature: TerrainFeature

  constructor(feature: TerrainFeature) {
    this.feature = feature
    this.description = `Add terrain: ${feature.properties.kind}`
  }

  execute(): void {
    const terrain = $terrain.get()
    $terrain.set({
      ...terrain,
      features: [...terrain.features, this.feature]
    })
  }

  undo(): void {
    const terrain = $terrain.get()
    $terrain.set({
      ...terrain,
      features: terrain.features.filter((f) => f !== this.feature)
    })
  }
}

/**
 * Remove Terrain Feature Command
 */
class RemoveTerrainCommand implements Command {
  description: string
  private feature: TerrainFeature
  private index: number

  constructor(feature: TerrainFeature, index: number) {
    this.feature = feature
    this.index = index
    this.description = `Delete terrain: ${feature.properties.kind}`
  }

  execute(): void {
    const terrain = $terrain.get()
    $terrain.set({
      ...terrain,
      features: terrain.features.filter((_, i) => i !== this.index)
    })
  }

  undo(): void {
    const terrain = $terrain.get()
    const newFeatures = [...terrain.features]
    newFeatures.splice(this.index, 0, this.feature)
    $terrain.set({
      ...terrain,
      features: newFeatures
    })
  }
}

/**
 * Undo/Redo Manager
 */
class UndoRedoManager {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private maxStackSize = 50

  /**
   * Execute a command and add it to undo stack
   */
  execute(command: Command): void {
    command.execute()
    this.undoStack.push(command)

    // Clear redo stack when new command is executed
    this.redoStack = []

    // Limit stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift()
    }

    this.emitStateChange()
  }

  /**
   * Undo the last command
   */
  undo(): void {
    const command = this.undoStack.pop()
    if (command) {
      command.undo()
      this.redoStack.push(command)
      this.emitStateChange()
      eventBus.emit('notification', {
        message: `Undone: ${command.description}`,
        type: 'info'
      })
    }
  }

  /**
   * Redo the last undone command
   */
  redo(): void {
    const command = this.redoStack.pop()
    if (command) {
      command.execute()
      this.undoStack.push(command)
      this.emitStateChange()
      eventBus.emit('notification', {
        message: `Redone: ${command.description}`,
        type: 'info'
      })
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.emitStateChange()
  }

  /**
   * Emit state change event
   */
  private emitStateChange(): void {
    eventBus.emit('undo-redo:state-changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length
    })
  }
}

// Export singleton instance
export const undoRedoManager = new UndoRedoManager()

// Export command classes for external use
export { AddMarkerCommand, RemoveMarkerCommand, UpdateMarkerCommand, AddTerrainCommand, RemoveTerrainCommand }

/**
 * Setup keyboard shortcuts for undo/redo
 */
export function setupUndoRedoShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    // Ctrl+Z or Cmd+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (undoRedoManager.canUndo()) {
        undoRedoManager.undo()
      }
    }

    // Ctrl+Shift+Z or Cmd+Shift+Z for redo (or Ctrl+Y)
    if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) || (e.ctrlKey && e.key === 'y')) {
      e.preventDefault()
      if (undoRedoManager.canRedo()) {
        undoRedoManager.redo()
      }
    }
  })

  console.log('✅ Undo/Redo shortcuts enabled (Ctrl+Z / Ctrl+Shift+Z)')
}
