/**
 * Keyboard Shortcuts System
 * Provides help modal and manages global shortcuts
 */

import { eventBus } from '../utils/events'

interface Shortcut {
  keys: string
  description: string
  category: 'Navigation' | 'DM Mode' | 'Route Planning' | 'General'
}

const SHORTCUTS: Shortcut[] = [
  // General
  { keys: '?', description: 'Show this help dialog', category: 'General' },
  { keys: 'Esc', description: 'Close modals', category: 'General' },

  // Navigation
  { keys: '+/-', description: 'Zoom in/out', category: 'Navigation' },
  { keys: 'Arrow keys', description: 'Pan map', category: 'Navigation' },
  { keys: 'Click marker', description: 'View marker info', category: 'Navigation' },

  // Route Planning
  { keys: 'Click markers', description: 'Add to route (when route sidebar open)', category: 'Route Planning' },
  { keys: 'Ctrl + R', description: 'Toggle route sidebar', category: 'Route Planning' },

  // DM Mode
  { keys: 'Ctrl + Z', description: 'Undo last action', category: 'DM Mode' },
  { keys: 'Ctrl + Shift + Z', description: 'Redo action', category: 'DM Mode' },
  { keys: 'Ctrl + Y', description: 'Redo action (alternative)', category: 'DM Mode' },
  { keys: 'Ctrl + S', description: 'Export data', category: 'DM Mode' },
  { keys: 'Ctrl + P', description: 'Publish changes', category: 'DM Mode' },
  { keys: 'Delete', description: 'Delete selected feature', category: 'DM Mode' }
]

export class KeyboardShortcutsManager {
  private modalElement: HTMLElement | null = null
  private isModalOpen = false
  private globalKeydownHandler: ((e: KeyboardEvent) => void) | null = null
  private modalCloseHandler: (() => void) | null = null
  private overlayClickHandler: (() => void) | null = null

  constructor() {
    this.setupGlobalShortcuts()
    this.createModal()
  }

  /**
   * Setup global keyboard shortcuts
   */
  private setupGlobalShortcuts(): void {
    this.globalKeydownHandler = (e: KeyboardEvent) => {
      // ? - Show help
      if (e.key === '?' && !this.isInputFocused()) {
        e.preventDefault()
        this.toggleModal()
      }

      // Escape - Close modal
      if (e.key === 'Escape' && this.isModalOpen) {
        e.preventDefault()
        this.closeModal()
      }

      // Ctrl + R - Toggle route sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !this.isInputFocused()) {
        e.preventDefault()
        const routeSidebar = document.getElementById('route-sidebar')
        if (routeSidebar) {
          routeSidebar.classList.toggle('open')
        }
      }

      // Ctrl + S - Export data (DM mode)
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !this.isInputFocused()) {
        e.preventDefault()
        eventBus.emit('dm:export')
      }

      // Ctrl + P - Publish changes (DM mode)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !this.isInputFocused()) {
        e.preventDefault()
        eventBus.emit('dm:publish')
      }
    }

    document.addEventListener('keydown', this.globalKeydownHandler)
    console.log('✅ Keyboard shortcuts enabled (press ? for help)')
  }

  /**
   * Cleanup all event listeners and remove modal
   * Call this when app is being destroyed
   */
  destroy(): void {
    // Remove global keydown listener
    if (this.globalKeydownHandler) {
      document.removeEventListener('keydown', this.globalKeydownHandler)
      this.globalKeydownHandler = null
    }

    // Remove modal event listeners
    if (this.modalElement) {
      const closeBtn = this.modalElement.querySelector('.modal-close')
      if (closeBtn && this.modalCloseHandler) {
        closeBtn.removeEventListener('click', this.modalCloseHandler)
      }

      const overlay = this.modalElement.querySelector('.modal-overlay')
      if (overlay && this.overlayClickHandler) {
        overlay.removeEventListener('click', this.overlayClickHandler)
      }

      // Remove modal element
      this.modalElement.remove()
      this.modalElement = null
    }

    // Remove injected styles
    const styles = document.getElementById('keyboard-shortcuts-styles')
    if (styles) {
      styles.remove()
    }

    console.log('✅ Keyboard shortcuts destroyed')
  }

  /**
   * Check if an input element is focused
   */
  private isInputFocused(): boolean {
    const activeElement = document.activeElement
    return !!(
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.hasAttribute('contenteditable'))
    )
  }

  /**
   * Create keyboard shortcuts modal
   */
  private createModal(): void {
    const modal = document.createElement('div')
    modal.id = 'keyboard-shortcuts-modal'
    modal.className = 'keyboard-shortcuts-modal hidden'
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>⌨️ Keyboard Shortcuts</h2>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          ${this.renderShortcutsList()}
        </div>
        <div class="modal-footer">
          <p class="hint">Press <kbd>?</kbd> to toggle this dialog</p>
        </div>
      </div>
    `

    document.body.appendChild(modal)
    this.modalElement = modal

    // Close button handler (track for cleanup)
    this.modalCloseHandler = () => this.closeModal()
    const closeBtn = modal.querySelector('.modal-close')
    closeBtn?.addEventListener('click', this.modalCloseHandler)

    // Overlay click handler (track for cleanup)
    this.overlayClickHandler = () => this.closeModal()
    const overlay = modal.querySelector('.modal-overlay')
    overlay?.addEventListener('click', this.overlayClickHandler)

    // Add CSS styles
    this.injectStyles()
  }

  /**
   * Render shortcuts list grouped by category
   */
  private renderShortcutsList(): string {
    const groupedShortcuts: Record<string, Shortcut[]> = {}

    SHORTCUTS.forEach((shortcut) => {
      if (!groupedShortcuts[shortcut.category]) {
        groupedShortcuts[shortcut.category] = []
      }
      groupedShortcuts[shortcut.category].push(shortcut)
    })

    let html = ''
    for (const category in groupedShortcuts) {
      html += `
        <div class="shortcuts-category">
          <h3>${category}</h3>
          <ul class="shortcuts-list">
            ${groupedShortcuts[category]
              .map(
                (s) => `
              <li>
                <kbd>${s.keys}</kbd>
                <span>${s.description}</span>
              </li>
            `
              )
              .join('')}
          </ul>
        </div>
      `
    }

    return html
  }

  /**
   * Inject CSS styles for modal
   */
  private injectStyles(): void {
    if (document.getElementById('keyboard-shortcuts-styles')) return

    const style = document.createElement('style')
    style.id = 'keyboard-shortcuts-styles'
    style.textContent = `
      .keyboard-shortcuts-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .keyboard-shortcuts-modal.hidden {
        display: none;
      }

      .keyboard-shortcuts-modal .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
      }

      .keyboard-shortcuts-modal .modal-content {
        position: relative;
        background: white;
        border-radius: 8px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 1;
      }

      .keyboard-shortcuts-modal .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #ddd;
      }

      .keyboard-shortcuts-modal .modal-header h2 {
        margin: 0;
        font-size: 24px;
      }

      .keyboard-shortcuts-modal .modal-close {
        background: none;
        border: none;
        font-size: 32px;
        cursor: pointer;
        color: #999;
        line-height: 1;
      }

      .keyboard-shortcuts-modal .modal-close:hover {
        color: #333;
      }

      .keyboard-shortcuts-modal .modal-body {
        padding: 20px;
      }

      .keyboard-shortcuts-modal .shortcuts-category {
        margin-bottom: 24px;
      }

      .keyboard-shortcuts-modal .shortcuts-category h3 {
        margin: 0 0 12px 0;
        font-size: 18px;
        color: #555;
      }

      .keyboard-shortcuts-modal .shortcuts-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .keyboard-shortcuts-modal .shortcuts-list li {
        display: flex;
        align-items: center;
        padding: 8px 0;
        gap: 16px;
      }

      .keyboard-shortcuts-modal kbd {
        display: inline-block;
        min-width: 120px;
        padding: 4px 8px;
        font-family: monospace;
        font-size: 13px;
        background: #f5f5f5;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      .keyboard-shortcuts-modal .modal-footer {
        padding: 16px 20px;
        border-top: 1px solid #ddd;
        background: #f9f9f9;
        text-align: center;
      }

      .keyboard-shortcuts-modal .hint {
        margin: 0;
        color: #666;
        font-size: 14px;
      }
    `
    document.head.appendChild(style)
  }

  /**
   * Toggle modal visibility
   */
  toggleModal(): void {
    if (this.isModalOpen) {
      this.closeModal()
    } else {
      this.openModal()
    }
  }

  /**
   * Open modal
   */
  openModal(): void {
    if (this.modalElement) {
      this.modalElement.classList.remove('hidden')
      this.isModalOpen = true
    }
  }

  /**
   * Close modal
   */
  closeModal(): void {
    if (this.modalElement) {
      this.modalElement.classList.add('hidden')
      this.isModalOpen = false
    }
  }
}

// Export singleton instance
export const keyboardShortcuts = new KeyboardShortcutsManager()
