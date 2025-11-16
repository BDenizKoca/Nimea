/**
 * DM Form Handler - Fixes i18n data loss bug
 *
 * The bug: HTML forms have marker-name-tr/en but JavaScript was looking for marker-name
 * This caused complete data loss for bilingual fields.
 *
 * This module properly handles the bilingual form structure.
 */

import { getElement } from '../utils/dom'
import type { Marker } from '../types'
import { validateMarker } from '../schemas/marker'

export class DMFormHandler {
  /**
   * Extract marker data from the creation/edit form
   * Properly handles bilingual i18n structure
   */
  getMarkerFormData(): Partial<Marker> | null {
    try {
      // Basic fields
      const id = getElement<HTMLInputElement>('marker-id')?.value.trim()
      const type = getElement<HTMLSelectElement>('marker-type')?.value as any
      const x = parseFloat(getElement<HTMLInputElement>('marker-lng')?.value || '0')
      const y = parseFloat(getElement<HTMLInputElement>('marker-lat')?.value || '0')
      const publicChecked = getElement<HTMLInputElement>('marker-public')?.checked ?? true
      const isPort = getElement<HTMLInputElement>('marker-is-port')?.checked ?? false

      // Optional fields
      const customIcon = getElement<HTMLInputElement>('marker-icon')?.value.trim()
      const iconUrl = getElement<HTMLInputElement>('marker-icon-url')?.value.trim()
      const wikiSlug = getElement<HTMLInputElement>('marker-wiki-slug')?.value.trim()

      // Bilingual fields (THE FIX)
      const nameTr = getElement<HTMLInputElement>('marker-name-tr')?.value.trim()
      const nameEn = getElement<HTMLInputElement>('marker-name-en')?.value.trim()
      const summaryTr = getElement<HTMLTextAreaElement>('marker-summary-tr')?.value.trim()
      const summaryEn = getElement<HTMLTextAreaElement>('marker-summary-en')?.value.trim()
      const factionTr = getElement<HTMLInputElement>('marker-faction-tr')?.value.trim()
      const factionEn = getElement<HTMLInputElement>('marker-faction-en')?.value.trim()

      // Validation
      if (!id || !nameTr || !summaryTr) {
        throw new Error('Missing required fields: id, name (TR), or summary (TR)')
      }

      // Construct marker with proper i18n structure
      const marker: Partial<Marker> = {
        id,
        name: nameTr, // Primary name from TR
        x,
        y,
        type,
        public: publicChecked,
        isPort,
        i18n: {
          tr: {
            name: nameTr,
            summary: summaryTr,
            faction: factionTr || undefined
          },
          en: {
            name: nameEn || nameTr, // Fallback to TR if EN not provided
            summary: summaryEn || summaryTr,
            faction: factionEn || factionTr
          }
        }
      }

      // Optional fields
      if (customIcon) marker.customIcon = customIcon
      if (iconUrl) marker.iconUrl = iconUrl
      if (wikiSlug) marker.wikiSlug = wikiSlug

      // Validate with Zod schema
      const validation = validateMarker(marker)
      if (!validation.success) {
        console.error('Validation errors:', validation.error.issues)
        throw new Error(`Invalid marker data: ${validation.error.issues.map(i => i.message).join(', ')}`)
      }

      return validation.data
    } catch (error) {
      console.error('Failed to extract marker form data:', error)
      return null
    }
  }

  /**
   * Populate form with existing marker data
   * Properly handles both old (flat) and new (i18n) data structures
   */
  populateMarkerForm(marker: Marker): void {
    try {
      // Basic fields
      const idInput = getElement<HTMLInputElement>('marker-id')
      const typeSelect = getElement<HTMLSelectElement>('marker-type')
      const latInput = getElement<HTMLInputElement>('marker-lat')
      const lngInput = getElement<HTMLInputElement>('marker-lng')
      const coordsInput = getElement<HTMLInputElement>('marker-coordinates')
      const publicCheckbox = getElement<HTMLInputElement>('marker-public')
      const isPortCheckbox = getElement<HTMLInputElement>('marker-is-port')
      const iconInput = getElement<HTMLInputElement>('marker-icon')
      const iconUrlInput = getElement<HTMLInputElement>('marker-icon-url')
      const wikiSlugInput = getElement<HTMLInputElement>('marker-wiki-slug')

      // Bilingual fields
      const nameTrInput = getElement<HTMLInputElement>('marker-name-tr')
      const nameEnInput = getElement<HTMLInputElement>('marker-name-en')
      const summaryTrInput = getElement<HTMLTextAreaElement>('marker-summary-tr')
      const summaryEnInput = getElement<HTMLTextAreaElement>('marker-summary-en')
      const factionTrInput = getElement<HTMLInputElement>('marker-faction-tr')
      const factionEnInput = getElement<HTMLInputElement>('marker-faction-en')

      if (idInput) idInput.value = marker.id || ''
      if (typeSelect) typeSelect.value = marker.type || 'other'
      if (latInput) latInput.value = String(marker.y)
      if (lngInput) lngInput.value = String(marker.x)
      if (coordsInput) coordsInput.value = `X: ${Math.round(marker.x)}, Y: ${Math.round(marker.y)}`
      if (publicCheckbox) publicCheckbox.checked = marker.public !== false
      if (isPortCheckbox) isPortCheckbox.checked = marker.isPort === true
      if (iconInput) iconInput.value = marker.customIcon || ''
      if (iconUrlInput) iconUrlInput.value = marker.iconUrl || ''
      if (wikiSlugInput) wikiSlugInput.value = marker.wikiSlug || ''

      // Handle both old (flat) and new (i18n) data structures
      if (marker.i18n) {
        // New structure with proper i18n
        if (nameTrInput) nameTrInput.value = marker.i18n.tr.name
        if (nameEnInput) nameEnInput.value = marker.i18n.en.name
        if (summaryTrInput) summaryTrInput.value = marker.i18n.tr.summary
        if (summaryEnInput) summaryEnInput.value = marker.i18n.en.summary
        if (factionTrInput) factionTrInput.value = marker.i18n.tr.faction || ''
        if (factionEnInput) factionEnInput.value = marker.i18n.en.faction || ''
      } else {
        // Old structure - migrate on load
        console.warn('Marker using old data structure, migrating...', marker.id)
        if (nameTrInput) nameTrInput.value = marker.name || ''
        if (nameEnInput) nameEnInput.value = marker.name || ''
        if (summaryTrInput) summaryTrInput.value = marker.summary || ''
        if (summaryEnInput) summaryEnInput.value = marker.summary || ''
        if (factionTrInput) factionTrInput.value = marker.faction || ''
        if (factionEnInput) factionEnInput.value = marker.faction || ''
      }

      // Mark ID field as manually edited to prevent auto-generation
      if (idInput) {
        idInput.dataset.manuallyEdited = 'true'
      }
    } catch (error) {
      console.error('Failed to populate marker form:', error)
      throw error
    }
  }

  /**
   * Clear all form fields
   */
  clearMarkerForm(): void {
    const form = getElement<HTMLFormElement>('marker-form')
    if (form) {
      form.reset()

      // Clear manually tracked state
      const idInput = getElement<HTMLInputElement>('marker-id')
      if (idInput) {
        delete idInput.dataset.manuallyEdited
      }
    }
  }
}

// Singleton instance
export const dmFormHandler = new DMFormHandler()
