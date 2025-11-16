import { describe, it, expect, beforeEach } from 'vitest'
import { DMFormHandler } from '../services/dm-forms'
import type { Marker } from '../types'

describe('DMFormHandler - i18n Bug Fix', () => {
  let handler: DMFormHandler

  beforeEach(() => {
    handler = new DMFormHandler()

    // Create mock form elements
    document.body.innerHTML = `
      <form id="marker-form">
        <input id="marker-id" value="test-city" />
        <input id="marker-name-tr" value="Test Şehir" />
        <input id="marker-name-en" value="Test City" />
        <textarea id="marker-summary-tr">TR özet</textarea>
        <textarea id="marker-summary-en">EN summary</textarea>
        <input id="marker-faction-tr" value="TR Faction" />
        <input id="marker-faction-en" value="EN Faction" />
        <select id="marker-type"><option value="city" selected>City</option></select>
        <input id="marker-lat" value="100" />
        <input id="marker-lng" value="200" />
        <input type="checkbox" id="marker-public" checked />
        <input type="checkbox" id="marker-is-port" />
        <input id="marker-icon" value="" />
        <input id="marker-icon-url" value="" />
        <input id="marker-wiki-slug" value="" />
        <input id="marker-coordinates" value="" />
      </form>
    `
  })

  it('should extract bilingual data correctly', () => {
    const marker = handler.getMarkerFormData()

    expect(marker).toBeTruthy()
    expect(marker!.i18n).toBeTruthy()
    expect(marker!.i18n!.tr.name).toBe('Test Şehir')
    expect(marker!.i18n!.en.name).toBe('Test City')
    expect(marker!.i18n!.tr.summary).toBe('TR özet')
    expect(marker!.i18n!.en.summary).toBe('EN summary')
    expect(marker!.i18n!.tr.faction).toBe('TR Faction')
    expect(marker!.i18n!.en.faction).toBe('EN Faction')
  })

  it('should fallback EN to TR if EN not provided', () => {
    // Clear EN fields
    const nameEn = document.getElementById('marker-name-en') as HTMLInputElement
    const summaryEn = document.getElementById('marker-summary-en') as HTMLTextAreaElement
    nameEn.value = ''
    summaryEn.value = ''

    const marker = handler.getMarkerFormData()

    expect(marker!.i18n!.en.name).toBe('Test Şehir') // Falls back to TR
    expect(marker!.i18n!.en.summary).toBe('TR özet') // Falls back to TR
  })

  it('should populate form with new i18n structure', () => {
    const testMarker: Marker = {
      id: 'valmoris',
      name: 'Valmoris',
      x: 1251,
      y: 1115,
      type: 'city',
      public: true,
      i18n: {
        tr: {
          name: 'Valmoris',
          summary: 'TR summary text',
          faction: 'Bağımsız şehir'
        },
        en: {
          name: 'Valmoris',
          summary: 'EN summary text',
          faction: 'Independent city'
        }
      }
    }

    handler.populateMarkerForm(testMarker)

    const nameTr = document.getElementById('marker-name-tr') as HTMLInputElement
    const nameEn = document.getElementById('marker-name-en') as HTMLInputElement
    const summaryTr = document.getElementById('marker-summary-tr') as HTMLTextAreaElement
    const summaryEn = document.getElementById('marker-summary-en') as HTMLTextAreaElement

    expect(nameTr.value).toBe('Valmoris')
    expect(nameEn.value).toBe('Valmoris')
    expect(summaryTr.value).toBe('TR summary text')
    expect(summaryEn.value).toBe('EN summary text')
  })

  it('should handle old flat data structure gracefully', () => {
    const oldMarker: any = {
      id: 'old-city',
      name: 'Old City',
      x: 100,
      y: 200,
      type: 'city',
      faction: 'Old Faction',
      summary: 'Old summary',
      public: true
      // No i18n field!
    }

    handler.populateMarkerForm(oldMarker as Marker)

    const nameTr = document.getElementById('marker-name-tr') as HTMLInputElement
    const nameEn = document.getElementById('marker-name-en') as HTMLInputElement

    // Should duplicate to both fields
    expect(nameTr.value).toBe('Old City')
    expect(nameEn.value).toBe('Old City')
  })
})
