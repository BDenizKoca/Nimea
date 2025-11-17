// Simple typed event emitter for module communication

type EventCallback<T = any> = (data: T) => void

export class EventEmitter {
  private listeners: Map<string, EventCallback[]> = new Map()

  on<T = any>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off<T = any>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) return

    const handlers = this.listeners.get(event)!
    const index = handlers.indexOf(callback)
    if (index > -1) {
      handlers.splice(index, 1)
    }
  }

  emit<T = any>(event: string, data?: T): void {
    if (!this.listeners.has(event)) return

    const handlers = this.listeners.get(event)!
    handlers.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in event listener for "${event}":`, error)
      }
    })
  }

  once<T = any>(event: string, callback: EventCallback<T>): void {
    const wrapper: EventCallback<T> = (data) => {
      callback(data)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }

  /**
   * Remove all listeners for a specific event, or all events if no event specified
   * @param event - Optional event name. If omitted, removes all listeners for all events
   */
  removeAll(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  /**
   * Clear all event listeners and destroy the emitter
   * Alias for removeAll() for consistency with other cleanup methods
   */
  destroy(): void {
    this.removeAll()
  }

  /**
   * @deprecated Use removeAll() or destroy() instead
   */
  clear(): void {
    this.removeAll()
  }

  /**
   * Get count of listeners for an event (useful for debugging)
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0
  }

  /**
   * Get all events that have listeners (useful for debugging)
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys())
  }
}

// Global event bus for the application
export const eventBus = new EventEmitter()
