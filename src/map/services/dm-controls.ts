/**
 * DM Controls Service
 * Creates and manages all DM-specific UI controls
 */

import L from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import { $isDmMode, $isAuthenticated, $isDirty } from '../stores'
import { eventBus } from '../utils/events'

export class DmControls {
  private map: LeafletMap
  private currentTerrainMode: string | null = null
  private publishControl: L.Control | null = null

  constructor(map: LeafletMap) {
    this.map = map
  }

  /**
   * Add all DM controls to the map
   */
  addAllControls(): void {
    if (!$isDmMode.get()) return

    this.addPublishControls()
    this.addTerrainModeControls()
    this.addTerrainMergeButton()
    this.addDeleteNodeButton()
    this.addBulkImportButton()
    this.addAuthenticationControls()

    console.log('✅ DM controls added')
  }

  /**
   * Localization strings for DM interface
   */
  private t(key: string): string {
    const strings: Record<string, string> = {
      'dm.publish': 'Publish',
      'dm.download': 'Download',
      'dm.publishTitle': 'Save changes to repository',
      'dm.downloadTitle': 'Download data files locally',
      'dm.login': 'Login',
      'dm.logout': 'Logout',
      'dm.loginTitle': 'Login to enable publishing',
      'dm.status': 'Status',
      'dm.unsaved': 'Unsaved',
      'dm.noChanges': 'No changes to publish',
      'dm.terrainRoad': 'Road',
      'dm.terrainOpen': 'Open',
      'dm.terrainDifficult': 'Difficult',
      'dm.terrainImpassable': 'Impassable',
      'dm.terrainRoadTitle': 'Paint road terrain (fast travel)',
      'dm.terrainOpenTitle': 'Paint open terrain (normal speed)',
      'dm.terrainDifficultTitle': 'Paint difficult terrain (slow travel)',
      'dm.terrainImpassableTitle': 'Paint impassable terrain',
      'dm.optimizeTerrain': 'Optimize',
      'dm.optimizeTerrainTitle': 'Merge and simplify terrain features',
      'dm.import': 'Import',
      'dm.importTitle': 'Bulk import markers from CSV',
      'dm.deleteNode': 'Delete Node',
      'dm.deleteNodeTitle': 'Remove the selected vertex from the active shape'
    }
    return strings[key] || key
  }

  /**
   * Add publish/download controls
   */
  private addPublishControls(): void {
    const PublishControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control dm-publish-controls')
        container.style.display = 'flex'
        container.style.flexDirection = 'column'
        container.innerHTML = `
          <a class="leaflet-control-button" id="dm-download-json"
             title="${this.t('dm.downloadTitle')}">${this.t('dm.download')}</a>
          <a class="leaflet-control-button" id="dm-publish-json"
             title="${this.t('dm.publishTitle')}">${this.t('dm.publish')}</a>
          <span class="dm-dirty-indicator" style="display:none; background:#d9534f; color:#fff; font-size:10px; padding:2px 4px; text-align:center;">
            ${this.t('dm.unsaved')}
          </span>
        `

        const downloadBtn = container.querySelector('#dm-download-json') as HTMLElement
        const publishBtn = container.querySelector('#dm-publish-json') as HTMLElement

        downloadBtn.onclick = () => {
          eventBus.emit('dm:export')
        }

        publishBtn.onclick = async () => {
          if (!$isDirty.get()) {
            eventBus.emit('notification', { message: this.t('dm.noChanges'), type: 'info' })
            return
          }
          eventBus.emit('dm:publish')
        }

        // Update UI when dirty state changes
        $isDirty.subscribe((dirty) => {
          const indicator = container.querySelector('.dm-dirty-indicator') as HTMLElement
          if (indicator) {
            indicator.style.display = dirty ? 'block' : 'none'
          }
        })

        // Update UI when authentication changes
        $isAuthenticated.subscribe((authenticated) => {
          publishBtn.style.opacity = authenticated ? '1' : '0.5'
          publishBtn.style.cursor = authenticated ? 'pointer' : 'not-allowed'
        })

        return container
      }
    })

    this.publishControl = new PublishControl()
    this.map.addControl(this.publishControl)
  }

  /**
   * Add terrain painting mode selector
   */
  private addTerrainModeControls(): void {
    const TerrainControls = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'terrain-controls')
        container.innerHTML = `
          <div class="leaflet-bar leaflet-control">
            <a class="leaflet-control-button terrain-mode-btn" data-mode="road"
               title="${this.t('dm.terrainRoadTitle')}">${this.t('dm.terrainRoad')}</a>
            <a class="leaflet-control-button terrain-mode-btn" data-mode="open"
               title="${this.t('dm.terrainOpenTitle')}">${this.t('dm.terrainOpen')}</a>
            <a class="leaflet-control-button terrain-mode-btn" data-mode="difficult"
               title="${this.t('dm.terrainDifficultTitle')}">${this.t('dm.terrainDifficult')}</a>
            <a class="leaflet-control-button terrain-mode-btn" data-mode="impassable"
               title="${this.t('dm.terrainImpassableTitle')}">${this.t('dm.terrainImpassable')}</a>
            <a class="leaflet-control-button" id="clear-terrain-mode">Clear</a>
          </div>
        `

        container.addEventListener('click', (e) => {
          const button = (e.target as HTMLElement).closest('.terrain-mode-btn') as HTMLElement
          if (button) {
            const mode = button.dataset.mode
            this.setTerrainMode(mode!)
            container.querySelectorAll('.terrain-mode-btn').forEach(btn => btn.classList.remove('active'))
            button.classList.add('active')
          }

          if ((e.target as HTMLElement).id === 'clear-terrain-mode') {
            this.clearTerrainMode()
            container.querySelectorAll('.terrain-mode-btn').forEach(btn => btn.classList.remove('active'))
          }
        })

        return container
      }
    })

    this.map.addControl(new TerrainControls())
  }

  /**
   * Add terrain merge button
   */
  private addTerrainMergeButton(): void {
    const MergeControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
        container.innerHTML = `
          <a class="leaflet-control-button" id="dm-merge-terrain"
             title="${this.t('dm.optimizeTerrainTitle')}">${this.t('dm.optimizeTerrain')}</a>
        `

        const button = container.querySelector('#dm-merge-terrain') as HTMLElement
        button.onclick = () => {
          eventBus.emit('dm:optimize-terrain')
        }

        return container
      }
    })

    this.map.addControl(new MergeControl())
  }

  /**
   * Add delete node button
   */
  private addDeleteNodeButton(): void {
    const DeleteNodeControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
        container.innerHTML = `
          <a class="leaflet-control-button" id="dm-delete-node"
             title="${this.t('dm.deleteNodeTitle')}">${this.t('dm.deleteNode')}</a>
        `

        const button = container.querySelector('#dm-delete-node') as HTMLElement
        button.onclick = () => {
          eventBus.emit('dm:delete-node')
        }

        return container
      }
    })

    this.map.addControl(new DeleteNodeControl())
  }

  /**
   * Add bulk import button
   */
  private addBulkImportButton(): void {
    const ImportControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
        container.innerHTML = `
          <a class="leaflet-control-button" id="dm-bulk-import"
             title="${this.t('dm.importTitle')}">${this.t('dm.import')}</a>
        `

        const button = container.querySelector('#dm-bulk-import') as HTMLElement
        button.onclick = () => {
          eventBus.emit('dm:show-import-modal')
        }

        return container
      }
    })

    this.map.addControl(new ImportControl())
  }

  /**
   * Add authentication controls
   */
  private addAuthenticationControls(): void {
    const AuthControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
        container.innerHTML = `
          <a class="leaflet-control-button" id="dm-auth-btn">
            <span id="dm-auth-label">${this.t('dm.login')}</span>
          </a>
        `

        const button = container.querySelector('#dm-auth-btn') as HTMLElement
        const label = container.querySelector('#dm-auth-label') as HTMLElement

        button.onclick = () => {
          if ($isAuthenticated.get()) {
            if (window.netlifyIdentity) {
              window.netlifyIdentity.logout()
            }
          } else {
            if (window.netlifyIdentity) {
              window.netlifyIdentity.open('login')
            }
          }
        }

        // Update UI when authentication changes
        $isAuthenticated.subscribe((authenticated) => {
          label.textContent = authenticated ? this.t('dm.logout') : this.t('dm.login')
          button.style.background = authenticated ? '#5cb85c' : '#f0ad4e'
        })

        return container
      }
    })

    this.map.addControl(new AuthControl())
  }

  /**
   * Set terrain painting mode
   */
  private setTerrainMode(mode: string): void {
    this.currentTerrainMode = mode
    eventBus.emit('dm:terrain-mode-changed', mode)
    console.log(`Terrain mode: ${mode}`)
  }

  /**
   * Clear terrain painting mode
   */
  private clearTerrainMode(): void {
    this.currentTerrainMode = null
    eventBus.emit('dm:terrain-mode-cleared')
    console.log('Terrain mode cleared')
  }

  /**
   * Get current terrain mode
   */
  getCurrentTerrainMode(): string | null {
    return this.currentTerrainMode
  }
}
