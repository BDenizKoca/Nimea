/**
 * DM Modals Service
 * Manages all DM-related modals and their functionality
 * Integrates with DMFormHandler for proper i18n data handling
 */

import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'
import { addMarker, updateMarker } from '../stores'
import { DMFormHandler } from './dm-forms'
import { eventBus } from '../utils/events'
import type { Marker } from '../types'

export class DmModals {
  private map: LeafletMap
  private formHandler: DMFormHandler
  private pendingMarker: LeafletMarker | null = null
  private elements: Record<string, HTMLElement> = {}

  constructor(map: LeafletMap) {
    this.map = map
    this.formHandler = new DMFormHandler()
  }

  /**
   * Cache frequently accessed DOM elements
   */
  private cacheFormElements(): void {
    const elementIds = [
      'marker-creation-modal', 'marker-form', 'marker-name-tr', 'marker-name-en',
      'marker-id', 'marker-type', 'marker-faction-tr', 'marker-faction-en',
      'marker-summary-tr', 'marker-summary-en', 'marker-icon', 'marker-icon-url',
      'marker-wiki-slug', 'marker-public', 'marker-is-port', 'marker-lat', 'marker-lng',
      'marker-coordinates', 'marker-image-url', 'marker-images-list', 'add-image-url',
      'cancel-marker', 'save-marker', 'bulk-import-modal', 'csv-input', 'csv-file',
      'cancel-import', 'process-import', 'terrain-type-modal', 'cancel-terrain'
    ]

    elementIds.forEach(id => {
      const element = document.getElementById(id)
      if (element) {
        this.elements[id] = element
      } else {
        console.warn(`Element not found: ${id}`)
      }
    })
  }

  /**
   * Get cached DOM element
   */
  private el(id: string): HTMLElement | null {
    return this.elements[id] || null
  }

  /**
   * Setup all modal event listeners
   */
  setupAllModals(): void {
    this.cacheFormElements()
    this.setupMarkerCreationModal()
    this.setupBulkImportModal()
    this.setupTerrainTypeModal()
    this.setupModalClickOutsideToClose()

    // Listen to events from DM controls
    eventBus.on('dm:show-import-modal', () => this.showBulkImportModal())

    console.log('✅ DM modals initialized')
  }

  /**
   * Setup marker creation modal
   */
  private setupMarkerCreationModal(): void {
    const modal = this.el('marker-creation-modal')
    const form = this.el('marker-form') as HTMLFormElement
    const nameTrInput = this.el('marker-name-tr') as HTMLInputElement
    const idInput = this.el('marker-id') as HTMLInputElement
    const cancelBtn = this.el('cancel-marker')
    const addImageBtn = this.el('add-image-url')
    const imageUrlInput = this.el('marker-image-url') as HTMLInputElement
    const imagesListEl = this.el('marker-images-list')

    if (!modal || !form) return

    // Auto-generate ID from Turkish name (primary language)
    nameTrInput?.addEventListener('input', () => {
      if (!form.dataset.editMode && !idInput.dataset.manuallyEdited) {
        idInput.value = this.generateIdFromName(nameTrInput.value)
      }
    })

    // Track manual ID edits
    idInput?.addEventListener('input', () => {
      idInput.dataset.manuallyEdited = 'true'
    })

    // Cancel button
    cancelBtn?.addEventListener('click', () => {
      if (this.pendingMarker) {
        this.map.removeLayer(this.pendingMarker)
        this.pendingMarker = null
      }
      modal.classList.add('hidden')
    })

    // Add image URL
    const addImageRow = (val = '') => {
      if (!imagesListEl) return
      const row = document.createElement('div')
      row.className = 'image-list-item'
      row.innerHTML = `
        <input type="url" placeholder="Image URL" value="${val}">
        <button type="button" class="remove-image">Remove</button>
      `
      row.querySelector('.remove-image')?.addEventListener('click', () => row.remove())
      imagesListEl.appendChild(row)
    }

    addImageBtn?.addEventListener('click', () => {
      const val = imageUrlInput?.value.trim() || ''
      if (!val) {
        eventBus.emit('notification', { message: 'Please enter an image URL', type: 'error' })
        return
      }
      addImageRow(val)
      if (imageUrlInput) imageUrlInput.value = ''
    })

    imageUrlInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        addImageBtn?.click()
      }
    })

    // Form submit
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      this.saveMarkerFromForm()
    })

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cancelBtn?.click()
    })
  }

  /**
   * Setup bulk import modal
   */
  private setupBulkImportModal(): void {
    const modal = this.el('bulk-import-modal')
    const csvInput = this.el('csv-input') as HTMLTextAreaElement
    const csvFile = this.el('csv-file') as HTMLInputElement
    const cancelBtn = this.el('cancel-import')
    const processBtn = this.el('process-import')

    if (!modal) return

    csvFile?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          if (csvInput) csvInput.value = event.target?.result as string
        }
        reader.readAsText(file)
      }
    })

    cancelBtn?.addEventListener('click', () => {
      modal.classList.add('hidden')
      if (csvInput) csvInput.value = ''
      if (csvFile) csvFile.value = ''
    })

    processBtn?.addEventListener('click', () => {
      const csv = csvInput?.value || ''
      if (!csv.trim()) {
        eventBus.emit('notification', { message: 'Please enter CSV data', type: 'error' })
        return
      }
      this.processCSVImport(csv)
    })

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cancelBtn?.click()
    })
  }

  /**
   * Setup terrain type modal
   */
  private setupTerrainTypeModal(): void {
    const modal = this.el('terrain-type-modal')
    const cancelBtn = this.el('cancel-terrain')

    if (!modal) return

    // Terrain type buttons
    modal.querySelectorAll('.terrain-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = (btn as HTMLElement).dataset.type
        if (type) {
          eventBus.emit('terrain:type-selected', type)
          modal.classList.add('hidden')
        }
      })
    })

    cancelBtn?.addEventListener('click', () => {
      modal.classList.add('hidden')
    })

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cancelBtn?.click()
    })
  }

  /**
   * Setup click outside to close for all modals
   */
  private setupModalClickOutsideToClose(): void {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden')
        }
      })
    })
  }

  /**
   * Show marker creation modal
   */
  showMarkerCreationModal(latLng: L.LatLng): void {
    const modal = this.el('marker-creation-modal')
    const form = this.el('marker-form') as HTMLFormElement
    const latInput = this.el('marker-lat') as HTMLInputElement
    const lngInput = this.el('marker-lng') as HTMLInputElement
    const coordsInput = this.el('marker-coordinates') as HTMLInputElement

    if (!modal || !form) return

    // Reset form
    form.reset()
    delete form.dataset.editMode
    delete (this.el('marker-id') as HTMLInputElement).dataset.manuallyEdited

    // Set coordinates
    if (latInput) latInput.value = latLng.lat.toString()
    if (lngInput) lngInput.value = latLng.lng.toString()
    if (coordsInput) coordsInput.value = `${latLng.lat.toFixed(2)}, ${latLng.lng.toFixed(2)}`

    // Clear image list
    const imagesListEl = this.el('marker-images-list')
    if (imagesListEl) imagesListEl.innerHTML = ''

    modal.classList.remove('hidden')
  }

  /**
   * Show bulk import modal
   */
  showBulkImportModal(): void {
    const modal = this.el('bulk-import-modal')
    if (modal) {
      modal.classList.remove('hidden')
    }
  }

  /**
   * Save marker from form using DMFormHandler (with i18n fix)
   */
  private saveMarkerFromForm(): void {
    const markerData = this.formHandler.getMarkerFormData()

    if (!markerData) {
      eventBus.emit('notification', { message: 'Invalid marker data', type: 'error' })
      return
    }

    // Check if editing existing marker
    const form = this.el('marker-form') as HTMLFormElement
    const isEditing = form.dataset.editMode === 'true'
    const editingId = form.dataset.editingId

    if (isEditing && editingId) {
      // Update existing marker
      updateMarker(editingId, markerData as Partial<Marker>)
      eventBus.emit('notification', { message: 'Marker updated', type: 'success' })
    } else {
      // Add new marker
      addMarker(markerData as Marker)
      eventBus.emit('notification', { message: 'Marker saved', type: 'success' })
    }

    // Close modal
    const modal = this.el('marker-creation-modal')
    if (modal) modal.classList.add('hidden')

    // Clean up pending marker
    if (this.pendingMarker) {
      this.map.removeLayer(this.pendingMarker)
      this.pendingMarker = null
    }
  }

  /**
   * Process CSV import
   */
  private processCSVImport(csv: string): void {
    const lines = csv.trim().split('\n')
    const hasHeader = lines[0].toLowerCase().includes('name')
    const dataLines = hasHeader ? lines.slice(1) : lines

    let imported = 0
    const errors: string[] = []

    dataLines.forEach((line, idx) => {
      const parts = line.split(',').map(p => p.trim())
      if (parts.length < 6) {
        errors.push(`Line ${idx + 1}: Not enough fields`)
        return
      }

      const [name, x, y, type, faction, summary, isPublic] = parts

      try {
        const marker: Marker = {
          id: this.generateIdFromName(name),
          name: name,
          x: parseFloat(x),
          y: parseFloat(y),
          type: type as any,
          faction,
          summary,
          public: isPublic === 'true',
          i18n: {
            tr: { name, summary, faction },
            en: { name, summary, faction }
          }
        }

        addMarker(marker)
        imported++
      } catch (err) {
        errors.push(`Line ${idx + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    })

    if (errors.length > 0) {
      console.error('Import errors:', errors)
    }

    eventBus.emit('notification', {
      message: `Imported ${imported} markers${errors.length ? ` (${errors.length} errors)` : ''}`,
      type: imported > 0 ? 'success' : 'error'
    })

    // Close modal
    const modal = this.el('bulk-import-modal')
    if (modal) modal.classList.add('hidden')
  }

  /**
   * Generate ID from name (slugify)
   */
  private generateIdFromName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[şŞ]/g, 's')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[ıİ]/g, 'i')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}
