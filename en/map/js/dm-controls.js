// map/js/dm-controls.js
// UI Controls for DM Mode

(function(window) {
    'use strict';

    /**
     * Creates and manages all DM-specific UI controls
     */
    class DmControls {
        constructor(bridge) {
            this.bridge = bridge;
            this.currentTerrainMode = null;
        }
        
        /**
         * Simple English strings for DM interface
         */
        t(key) {
            const strings = {
                'dm.publish': 'Publish',
                'dm.download': 'Download',
                'dm.publishTitle': 'Save changes to repository',
                'dm.downloadTitle': 'Download data files locally',
                'dm.login': 'Login',
                'dm.logout': 'Logout',
                'dm.loginTitle': 'Login to enable publishing',
                'dm.status': 'Status',
                'dm.terrainRoad': 'Road',
                'dm.terrainMedium': 'Medium',
                'dm.terrainDifficult': 'Difficult',
                'dm.terrainUnpassable': 'Unpassable',
                'dm.terrainNormal': 'Normal',
                'dm.terrainRoadTitle': 'Paint road terrain (fast travel)',
                'dm.terrainMediumTitle': 'Paint medium difficulty terrain',
                'dm.terrainDifficultTitle': 'Paint difficult terrain (slow travel)',
                'dm.terrainUnpassableTitle': 'Paint impassable terrain',
                'dm.terrainNormalTitle': 'Paint normal terrain',
                'dm.optimizeTerrain': 'Optimize',
                'dm.optimizeTerrainTitle': 'Merge and simplify terrain features',
                'dm.import': 'Import',
                'dm.importTitle': 'Bulk import markers from CSV',
                'dm.deleteNode': 'Delete Node',
                'dm.deleteNodeTitle': 'Remove the selected vertex from the active shape'
            };
            return strings[key] || key;
        }

        /**
         * Adds all DM controls to the map
         */
        addAllControls() {
            this.addPublishControls();
            this.addTerrainModeControls();
            this.addTerrainMergeButton();
            this.addDeleteNodeButton();
            this.addBulkImportButton();
            this.addAuthenticationControls();
        }

        /**
         * Adds the control for publishing changes or downloading data.
         */
        addPublishControls() {
            const self = this;
            const PublishControl = L.Control.extend({
                options: { position: 'topleft' },
                onAdd: function () {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control dm-publish-controls');
                    container.style.display = 'flex';
                    container.style.flexDirection = 'column';
                    container.innerHTML = `
                        <a class="leaflet-control-button" id="dm-download-json" 
                           title="${self.t('dm.downloadTitle')}">${self.t('dm.download')}</a>
                        <a class="leaflet-control-button" id="dm-publish-json" 
                           title="${self.t('dm.publishTitle')}">${self.t('dm.publish')}</a>
                        <span class="dm-dirty-indicator" style="display:none; background:#d9534f; color:#fff; font-size:10px; padding:2px 4px; text-align:center;">
                            ${self.t('dm.unsaved')}
                        </span>
                    `;
                    
                    const downloadBtn = container.querySelector('#dm-download-json');
                    const publishBtn = container.querySelector('#dm-publish-json');

                    downloadBtn.onclick = () => self.bridge.dmModule.exportData();
                    publishBtn.onclick = async () => {
                        if (!self.bridge.state.dirty.markers && !self.bridge.state.dirty.terrain) {
                            self.bridge.showNotification(self.t('dm.noChanges'), 'info');
                            return;
                        }
                        await self.bridge.dmModule.publishAll();
                    };

                    // Initial UI update
                    setTimeout(() => self.updatePublishUI(), 50);
                    return container;
                }
            });
            this.bridge.map.addControl(new PublishControl());
        }

        /**
         * Adds the terrain painting mode selector.
         */
        addTerrainModeControls() {
            const self = this;
            const TerrainControls = L.Control.extend({
                options: { position: 'topleft' },
                onAdd: function () {
                    const container = L.DomUtil.create('div', 'terrain-controls');
                    container.innerHTML = `
                        <div class="leaflet-bar leaflet-control">
                            <a class="leaflet-control-button terrain-mode-btn" data-mode="road" 
                               title="${self.t('dm.terrainRoadTitle')}">${self.t('dm.terrainRoad')}</a>
                            <a class="leaflet-control-button terrain-mode-btn" data-mode="medium" 
                               title="${self.t('dm.terrainMediumTitle')}">${self.t('dm.terrainMedium')}</a>
                            <a class="leaflet-control-button terrain-mode-btn" data-mode="difficult" 
                               title="${self.t('dm.terrainDifficultTitle')}">${self.t('dm.terrainDifficult')}</a>
                            <a class="leaflet-control-button terrain-mode-btn" data-mode="unpassable" 
                               title="${self.t('dm.terrainUnpassableTitle')}">${self.t('dm.terrainUnpassable')}</a>
                            <a class="leaflet-control-button" id="clear-terrain-mode" 
                               title="${self.t('dm.terrainNormalTitle')}">${self.t('dm.terrainNormal')}</a>
                        </div>
                    `;
                    
                    container.addEventListener('click', (e) => {
                        const button = e.target.closest('.terrain-mode-btn');
                        if (button) {
                            const mode = button.dataset.mode;
                            self.setTerrainMode(mode);
                            container.querySelectorAll('.terrain-mode-btn').forEach(btn => btn.classList.remove('active'));
                            button.classList.add('active');
                        }
                        
                        if (e.target.id === 'clear-terrain-mode') {
                            self.clearTerrainMode();
                            container.querySelectorAll('.terrain-mode-btn').forEach(btn => btn.classList.remove('active'));
                        }
                    });

                    return container;
                }
            });
            this.bridge.map.addControl(new TerrainControls());
        }

        /**
         * Adds the "Merge Selected" button for manual polygon merging
         */
        addTerrainMergeButton() {
            const self = this;
            
            // Initialize selection array
            this.bridge.selectedTerrainForMerge = [];
            
            const MergeButton = L.Control.extend({
                options: { position: 'topleft' },
                onAdd: function () {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                    const button = L.DomUtil.create('a', 'leaflet-control-button', container);
                    button.innerHTML = 'Merge Selected';
                    button.title = 'Click polygons to select, then click to merge them';
                    button.onclick = () => {
                        if (self.bridge.dmModule && self.bridge.dmModule.mergeSelectedPolygons) {
                            self.bridge.dmModule.mergeSelectedPolygons();
                        }
                    };
                    return container;
                }
            });
            
            this.bridge.map.addControl(new MergeButton());
            
            // Add click handler to terrain layers for selection
            this.enableTerrainSelection();
        }
        

        /**
         * Adds a button to delete the last selected vertex while editing.
         */
        addDeleteNodeButton() {
            const self = this;
            const DeleteNodeControl = L.Control.extend({
                options: { position: 'topleft' },
                onAdd: function () {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                    const button = L.DomUtil.create('a', 'leaflet-control-button dm-delete-node-btn', container);
                    button.innerHTML = self.t('dm.deleteNode');
                    button.title = self.t('dm.deleteNodeTitle');
                    button.href = '#';
                    button.onclick = (e) => {
                        L.DomEvent.stopPropagation(e);
                        L.DomEvent.preventDefault(e);
                        if (self.bridge.dmModule && self.bridge.dmModule.deleteSelectedVertex) {
                            self.bridge.dmModule.deleteSelectedVertex();
                        }
                    };
                    return container;
                }
            });

            this.bridge.map.addControl(new DeleteNodeControl());
        }

        /**
         * Enable clicking on terrain polygons to select them for merging
         */
        enableTerrainSelection() {
            const self = this;
            
            // Store reference to terrain layers for selection
            if (!this.bridge.terrainLayerMap) {
                this.bridge.terrainLayerMap = new Map(); // _internal_id -> layer
            }
            
            // Hook into terrain rendering to track layers
            const originalRenderTerrain = this.bridge.terrainModule.renderTerrain;
            this.bridge.terrainModule.renderTerrain = function() {
                originalRenderTerrain.call(this);
                
                // After rendering, store layer references
                self.bridge.terrainLayerMap.clear();
                if (self.bridge.terrainModule.terrainLayer) {
                    self.bridge.terrainModule.terrainLayer.eachLayer(function(layer) {
                        const feature = layer.feature;
                        if (feature && feature.properties._internal_id) {
                            self.bridge.terrainLayerMap.set(feature.properties._internal_id, layer);
                            
                            // Add click handler to each layer
                            layer.off('click'); // Remove old handlers
                            layer.on('click', function(e) {
                                L.DomEvent.stopPropagation(e); // Prevent map click
                                if (self.bridge.state.isDmMode) {
                                    self.toggleTerrainSelection(layer, feature);
                                }
                            });
                        }
                    });
                }
            };
            
            // Initial render
            if (this.bridge.terrainModule.terrainLayer) {
                this.bridge.terrainModule.renderTerrain();
            }
        }
        
        /**
         * Toggle selection state of a terrain feature
         */
        toggleTerrainSelection(layer, feature) {
            if (!this.bridge.selectedTerrainForMerge) {
                this.bridge.selectedTerrainForMerge = [];
            }
            
            const selected = this.bridge.selectedTerrainForMerge;
            const featureId = feature.properties._internal_id;
            const index = selected.findIndex(f => f.properties._internal_id === featureId);
            
            if (index >= 0) {
                // Deselect
                selected.splice(index, 1);
                
                // Restore original style based on terrain type
                const kind = feature.properties.kind;
                const originalStyle = this.getTerrainStyle(kind);
                layer.setStyle(originalStyle);
                
                console.log(`Deselected ${kind}. Now ${selected.length} selected.`);
            } else {
                // Select
                selected.push(feature);
                
                // Highlight in bright magenta with thick border
                layer.setStyle({
                    color: '#ff00ff',
                    weight: 5,
                    opacity: 1.0,
                    fillColor: '#ff00ff',
                    fillOpacity: 0.3
                });
                
                // Bring to front so it's visible
                layer.bringToFront();
                
                console.log(`Selected ${feature.properties.kind}. Now ${selected.length} selected.`);
            }
            
            // Show notification
            if (selected.length > 0) {
                this.bridge.showNotification(`${selected.length} polygon(s) selected for merging`, 'info');
            } else {
                this.bridge.showNotification('Selection cleared', 'info');
            }
        }
        
        /**
         * Get default style for terrain type (matches terrain.js rendering)
         */
        getTerrainStyle(kind) {
            switch (kind) {
                case 'road':
                    return { color: "#6a8caf", weight: 3, opacity: 0.8 };
                case 'difficult':
                    return { color: "#a0522d", weight: 2, opacity: 0.7, fillColor: "#a0522d", fillOpacity: 0.2, dashArray: '8, 8' };
                case 'medium':
                    return { color: "#228B22", weight: 2, opacity: 0.7, fillColor: "#228B22", fillOpacity: 0.3, dashArray: '4, 8' };
                case 'unpassable':
                    return { color: "#c0392b", weight: 2, opacity: 0.8, fillColor: "#c0392b", fillOpacity: 0.4 };
                default:
                    return { color: "#cccccc", weight: 1, opacity: 0.5 };
            }
        }

        /**
         * Adds the "Import" button for bulk marker import.
         */
        addBulkImportButton() {
            const self = this;
            const ImportButton = L.Control.extend({
                options: { position: 'topleft' },
                onAdd: function () {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                    const button = L.DomUtil.create('a', 'leaflet-control-button', container);
                    button.innerHTML = self.t('dm.import');
                    button.title = self.t('dm.importTitle');
                    button.onclick = () => self.bridge.dmModule.openBulkImportModal();
                    return container;
                }
            });
            this.bridge.map.addControl(new ImportButton());
        }

        /**
         * Adds the login/logout and status controls for authentication.
         */
        addAuthenticationControls() {
            const self = this;
            const AuthControls = L.Control.extend({
                options: { position: 'topright' },
                onAdd: function () {
                    const container = L.DomUtil.create('div', 'auth-controls');
                    container.innerHTML = `
                        <div class="leaflet-bar leaflet-control">
                            <a class="leaflet-control-button" id="dm-login-btn" 
                               title="${self.t('dm.loginTitle')}">${self.t('dm.login')}</a>
                            <a class="leaflet-control-button" id="dm-status-btn" 
                               title="${self.t('dm.statusTitle')}">${self.t('dm.status')}</a>
                        </div>
                    `;
                    
                    const loginBtn = container.querySelector('#dm-login-btn');
                    const statusBtn = container.querySelector('#dm-status-btn');
                    
                    loginBtn.addEventListener('click', async () => {
                        try {
                            if (window.gitClient.isAuthenticated) {
                                window.gitClient.logout();
                            } else {
                                if (!window.gitClient.initialized) {
                                    await window.gitClient.initialize();
                                }
                                await window.gitClient.login();
                            }
                        } catch (e) {
                            console.error('Login button error:', e);
                            self.bridge.showNotification(self.t('dm.notifications.authNotInitialized'), 'error');
                        }
                    });

                    statusBtn.addEventListener('click', () => {
                        const status = self.bridge.state.isLiveCMS 
                            ? self.t('dm.notifications.authStatusAuthenticated')
                            : self.t('dm.notifications.authStatusNotAuthenticated');
                        self.bridge.showNotification(status, 'info');
                    });

                    // Initial UI update and event listeners
                    self.updateAuthUI();
                    if (window.netlifyIdentity) {
                        window.netlifyIdentity.on('login', () => {
                            self.bridge.state.isLiveCMS = true;
                            self.updateAuthUI();
                            self.bridge.showNotification(self.t('dm.notifications.loginSuccess'), 'success');
                        });
                        window.netlifyIdentity.on('logout', () => {
                            self.bridge.state.isLiveCMS = false;
                            self.updateAuthUI();
                            self.bridge.showNotification(self.t('dm.notifications.logoutSuccess'), 'info');
                        });
                    }

                    return container;
                }
            });
            this.bridge.map.addControl(new AuthControls());
        }

        /**
         * Sets the terrain painting mode
         * @param {string} mode - The terrain mode to set
         */
        setTerrainMode(mode) {
            this.currentTerrainMode = mode;
            const modeKey = mode === 'road' ? 'terrainRoad' : 
                           mode === 'medium' ? 'terrainMedium' :
                           mode === 'difficult' ? 'terrainDifficult' : 
                           mode === 'unpassable' ? 'terrainUnpassable' : 'terrainNormal';
            const modeName = this.t(`dm.${modeKey}`);
            this.bridge.showNotification(`${modeName}: ${this.t(`dm.${modeKey}Title`)}`, 'success');
        }

        /**
         * Clears the terrain painting mode
         */
        clearTerrainMode() {
            this.currentTerrainMode = null;
            this.bridge.showNotification(this.t('dm.terrainNormalTitle'), 'success');
        }

        /**
         * Gets the current terrain mode
         * @returns {string|null} The current terrain mode
         */
        getCurrentTerrainMode() {
            return this.currentTerrainMode;
        }

        /**
         * Updates the UI of the publish control based on auth and dirty state.
         */
        updatePublishUI() {
            const dirty = this.bridge.state.dirty.markers || this.bridge.state.dirty.terrain;
            const publishBtn = document.getElementById('dm-publish-json');
            const badge = document.querySelector('.dm-dirty-indicator');

            if (publishBtn) {
                const canPublish = window.gitClient && window.gitClient.isAuthenticated;
                publishBtn.style.opacity = canPublish ? '1' : '0.5';
                publishBtn.style.pointerEvents = canPublish ? 'auto' : 'none';
            }
            if (badge) {
                badge.style.display = dirty ? 'block' : 'none';
            }
        }

        /**
         * Updates the UI of the authentication controls.
         */
        updateAuthUI() {
            const loginBtn = document.getElementById('dm-login-btn');
            const statusBtn = document.getElementById('dm-status-btn');
            const isAuthenticated = window.gitClient && window.gitClient.isAuthenticated;

            if (loginBtn) {
                loginBtn.textContent = isAuthenticated ? this.t('dm.logout') : this.t('dm.login');
                loginBtn.title = isAuthenticated ? this.t('dm.logout') : this.t('dm.loginTitle');
            }
            
            if (statusBtn) {
                const statusText = this.bridge.state.isLiveCMS ? 
                    this.t('dm.notifications.authStatusAuthenticated') : 
                    this.t('dm.notifications.authStatusNotAuthenticated');
                statusBtn.textContent = `${this.t('dm.status')}: ${statusText}`;
                statusBtn.style.color = this.bridge.state.isLiveCMS ? '#28a745' : '#6c757d';
            }
            
            // Also update the publish UI since it depends on auth state
            this.updatePublishUI();
        }
    }

    // Export the class to global scope
    window.DmControls = DmControls;

})(window);



