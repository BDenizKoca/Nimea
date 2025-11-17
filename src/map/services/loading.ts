// Loading state manager - shows/hides loading overlay

class LoadingManager {
  private overlay: HTMLElement | null = null

  /**
   * Initialize loading overlay
   */
  init(): void {
    // Create overlay if it doesn't exist
    if (!this.overlay) {
      this.overlay = document.createElement('div')
      this.overlay.id = 'map-loading-overlay'
      this.overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        flex-direction: column;
        gap: 20px;
      `

      const spinner = document.createElement('div')
      spinner.style.cssText = `
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      `

      const text = document.createElement('div')
      text.textContent = 'Loading map...'
      text.style.cssText = `
        color: white;
        font-size: 18px;
        font-family: sans-serif;
      `

      this.overlay.appendChild(spinner)
      this.overlay.appendChild(text)

      // Add CSS animation
      const style = document.createElement('style')
      style.textContent = `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `
      document.head.appendChild(style)

      document.body.appendChild(this.overlay)
    }
  }

  /**
   * Show loading overlay with optional message
   */
  show(message: string = 'Loading map...'): void {
    this.init()
    if (this.overlay) {
      const textEl = this.overlay.querySelector('div:last-child')
      if (textEl) {
        textEl.textContent = message
      }
      this.overlay.style.display = 'flex'
    }
  }

  /**
   * Hide loading overlay
   */
  hide(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none'
    }
  }

  /**
   * Remove overlay completely
   */
  destroy(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay)
      this.overlay = null
    }
  }
}

// Export singleton instance
export const loadingManager = new LoadingManager()
