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

  clear(): void {
    this.listeners.clear()
  }
}

// Global event bus for the application
export const eventBus = new EventEmitter()
