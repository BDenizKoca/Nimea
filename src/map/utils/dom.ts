// DOM utility functions

/**
 * Type-safe getElementById
 */
export function getElement<T extends HTMLElement = HTMLElement>(
  id: string
): T | null {
  return document.getElementById(id) as T | null
}

/**
 * Type-safe querySelector
 */
export function query<T extends Element = Element>(
  selector: string,
  parent: Element | Document = document
): T | null {
  return parent.querySelector<T>(selector)
}

/**
 * Type-safe querySelectorAll
 */
export function queryAll<T extends Element = Element>(
  selector: string,
  parent: Element | Document = document
): T[] {
  return Array.from(parent.querySelectorAll<T>(selector))
}

/**
 * DOM element cache for performance
 */
export class DOMCache {
  private cache: Map<string, HTMLElement> = new Map()

  get<T extends HTMLElement = HTMLElement>(id: string): T | null {
    if (!this.cache.has(id)) {
      const element = getElement<T>(id)
      if (element) {
        this.cache.set(id, element)
      }
    }
    return (this.cache.get(id) as T) || null
  }

  clear(): void {
    this.cache.clear()
  }

  remove(id: string): void {
    this.cache.delete(id)
  }
}
