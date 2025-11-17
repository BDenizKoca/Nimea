/**
 * Debounce utility - delays function execution until after a wait period
 * Prevents expensive operations from running too frequently
 */

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function debounced(...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delayMs)
  }
}

/**
 * Throttle utility - ensures function runs at most once per wait period
 * Useful for high-frequency events like scroll/resize
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let lastRun = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function throttled(...args: Parameters<T>) {
    const now = Date.now()
    const timeSinceLastRun = now - lastRun

    if (timeSinceLastRun >= delayMs) {
      fn(...args)
      lastRun = now
    } else {
      // Schedule for later if not already scheduled
      if (timeoutId === null) {
        timeoutId = setTimeout(
          () => {
            fn(...args)
            lastRun = Date.now()
            timeoutId = null
          },
          delayMs - timeSinceLastRun
        )
      }
    }
  }
}
