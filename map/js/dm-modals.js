// map/js/dm-modals.js
// Modal management for DM Mode

(function(window) {
    'use strict';

    /**
     * Manages all DM-related modals and their functionality
     */
    class DmModals {
        constructor(bridge) {
            this.bridge = bridge;
            this.pendingMarker = null;
            this.pendingTerrain = null;
            this.elements = {}; // Cache for DOM elements
        }

        /**
         * Cache frequently accessed DOM elements for performance
         * Eliminates repeated getElementById calls
         */
        cacheFormElements() {
            const elementIds = [
                'marker-creation-modal', 'marker-form', 'marker-name', 'marker-id',
                'marker-type', 'marker-faction', 'marker-summary', 'marker-icon',
                'marker-icon-url', 'marker-wiki-slug', 'marker-public', 'marker-is-port',
                'marker-lat', 'marker-lng', 'marker-coordinates', 'marker-image-url',
                'marker-images-list', 'add-image-url', 'cancel-marker', 'save-marker',
                'bulk-import-modal', 'csv-input', 'csv-file', 'cancel-import', 'process-import',
                'terrain-type-modal', 'cancel-terrain'
            ];

            elementIds.forEach(id => {
                const element = this.el(id);
                if (element) {
                    this.elements[id] = element;
                } else {
                    console.warn(`Element not found: ${id}`);
                }
            });
        }

        /**
         * Get cached DOM element by ID
         * @param {string} id - Element ID
         * @returns {HTMLElement|null}
         */
        el(id) {
            return this.elements[id] || null;
        }
        
        /**
         * Simple English strings for DM interface
         */
        t(key) {
            const strings = {
                'dm.notifications.markerSaved': 'Marker saved',
                'dm.notifications.markerUpdated': 'Marker updated',
                'dm.notifications.markerDeleted': 'Marker deleted',
                'dm.notifications.terrainSaved': 'Terrain saved',
                'dm.notifications.terrainMerged': 'Merged {{count}} terrain type(s)',
                'dm.notifications.noTerrainToMerge': 'No terrain features to merge',
                'dm.notifications.terrainOptimized': 'Terrain optimized: {{before}} → {{after}} nodes ({{reduction}} reduction)',
                'dm.notifications.terrainOptimizeFailed': 'Could not optimize terrain',
                'dm.notifications.importSuccess': '{{count}} markers imported',
                'dm.notifications.importError': 'Import error',
                'dm.notifications.authStatusAuthenticated': 'Authenticated',
                'dm.notifications.authStatusNotAuthenticated': 'Not authenticated'
            };
            return strings[key] || key;
        }

        /**
         * Sets up all modal event listeners
         */
        setupAllModals() {
            this.cacheFormElements(); // Cache DOM elements first
            this.setupMarkerCreationModal();
            this.setupBulkImportModal();
            this.setupTerrainTypeModal();
            this.setupModalClickOutsideToClose(); // Add click-outside-to-close functionality
        }

        /**
         * Sets up event listeners for the marker creation modal.
         */
        setupMarkerCreationModal() {
            const modal = this.el('marker-creation-modal');
            const form = this.el('marker-form');
            const nameInput = this.el('marker-name');
            const idInput = this.el('marker-id');
            const iconInput = this.el('marker-icon');
            const cancelBtn = this.el('cancel-marker');
            const addImageBtn = this.el('add-image-url');
            const imageUrlInput = this.el('marker-image-url');
            const imagesListEl = this.el('marker-images-list');

            // Update ID when name changes, but only for new markers (not when editing)
            nameInput.addEventListener('input', () => {
                // Only auto-generate ID if we're creating a new marker (not editing)
                // and the ID field hasn't been manually modified
                if (!form.dataset.editMode && !idInput.dataset.manuallyEdited) {
                    idInput.value = this.bridge.generateIdFromName(nameInput.value);
                }
            });
            
            // Track if ID has been manually edited
            idInput.addEventListener('input', () => {
                idInput.dataset.manuallyEdited = 'true';
            });

            // Icon selector functionality
            const iconOptions = document.querySelectorAll('.icon-option');
            iconOptions.forEach(option => {
                option.addEventListener('click', () => {
                    const selectedIcon = option.dataset.icon;
                    iconInput.value = selectedIcon;
                    
                    // Visual feedback
                    iconOptions.forEach(opt => opt.style.background = 'white');
                    option.style.background = '#007bff';
                    option.style.color = 'white';
                });
            });

            // Clear icon selection visual when input changes manually
            iconInput.addEventListener('input', () => {
                iconOptions.forEach(opt => {
                    opt.style.background = 'white';
                    opt.style.color = 'initial';
                });
            });

            cancelBtn.addEventListener('click', () => {
                if (this.pendingMarker) {
                    this.bridge.map.removeLayer(this.pendingMarker);
                    this.pendingMarker = null;
                }
                modal.classList.add('hidden');
            });

            // Add image URL row to list
            const addImageRow = (val = '') => {
                const row = document.createElement('div');
                row.className = 'image-list-item';
                row.innerHTML = `<input type="url" placeholder="${this.t('dm.markerImageUrlPlaceholder')}" value="${val}"><button type="button" class="remove-image">${this.t('dm.markerRemoveImage')}</button>`;
                row.querySelector('.remove-image').addEventListener('click', () => row.remove());
                imagesListEl.appendChild(row);
            };
            addImageBtn?.addEventListener('click', () => {
                const v = (imageUrlInput?.value || '').trim();
                if (!v) {
                    this.bridge.showNotification(this.t('dm.notifications.enterImageUrl'), 'error');
                    return;
                }
                addImageRow(v);
                imageUrlInput.value = '';
            });
            imageUrlInput?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addImageBtn?.click();
                }
            });

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveMarkerFromForm();
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) cancelBtn.click();
            });
        }

        /**
         * Sets up event listeners for the bulk CSV import modal.
         */
        setupBulkImportModal() {
            const modal = this.el('bulk-import-modal');
            const csvInput = this.el('csv-input');
            const csvFile = this.el('csv-file');
            const cancelBtn = this.el('cancel-import');
            const processBtn = this.el('process-import');

            csvFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => { csvInput.value = event.target.result; };
                    reader.readAsText(file);
                }
            });

            cancelBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
                csvInput.value = '';
                csvFile.value = '';
            });

            processBtn.addEventListener('click', () => this.processBulkImport(csvInput.value));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) cancelBtn.click();
            });
        }

        /**
         * Sets up event listeners for the terrain type selection modal.
         */
        setupTerrainTypeModal() {
            const modal = this.el('terrain-type-modal');
            const cancelBtn = this.el('cancel-terrain');

            modal.querySelectorAll('.terrain-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const terrainType = button.dataset.type;
                    this.saveTerrainWithType(terrainType);
                    modal.classList.add('hidden');
                });
            });

            cancelBtn.addEventListener('click', () => {
                if (this.pendingTerrain) {
                    this.bridge.map.removeLayer(this.pendingTerrain);
                    this.pendingTerrain = null;
                }
                modal.classList.add('hidden');
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) cancelBtn.click();
            });
        }

        /**
         * Opens the marker creation modal at the specified coordinates
         * @param {L.LatLng} latLng - The coordinates for the new marker
         */
        openMarkerCreationModal(latLng) {
            console.log('Opening marker creation modal at:', latLng);
            const modal = this.el('marker-creation-modal');
            const form = this.el('marker-form');
            const saveBtn = this.el('save-marker');
            const title = modal.querySelector('h3');
            
            // Reset form and set to creation mode
            form.reset();
            form.removeAttribute('data-edit-mode');
            form.removeAttribute('data-original-id');
            this.el('marker-id').removeAttribute('data-manually-edited');
            // Reset images list
            const imagesListEl = this.el('marker-images-list');
            if (imagesListEl) imagesListEl.innerHTML = '';
            
            // Update UI for creation mode
            title.textContent = this.t('dm.markerCreateTitle');
            saveBtn.textContent = this.t('dm.markerSave');
            
            // Store raw coordinates in hidden fields
            this.el('marker-lat').value = latLng.lat;
            this.el('marker-lng').value = latLng.lng;

            // Display formatted coordinates for the user
            this.el('marker-coordinates').value = `X: ${Math.round(latLng.lng)}, Y: ${Math.round(latLng.lat)}`;
            
            this.el('marker-public').checked = true;
            modal.classList.remove('hidden');
            this.el('marker-name').focus();
        }

        /**
         * Opens the marker edit modal with existing marker data
         * @param {Object} markerData - The marker data to edit
         */
        editMarker(markerData) {
            if (!markerData || !markerData.id) {
                console.error('Invalid marker data for editing');
                return;
            }
            
            console.log('Opening edit modal for marker:', markerData.name);
            const modal = this.el('marker-creation-modal');
            const form = this.el('marker-form');
            const title = modal.querySelector('h3');
            const saveBtn = this.el('save-marker');
            
            // Set form to edit mode and store original ID
            form.dataset.editMode = 'true';
            form.dataset.originalId = markerData.id;
            
            // Update UI for edit mode
            title.textContent = this.t('dm.markerEditTitle');
            saveBtn.textContent = this.t('dm.markerUpdate');
            
            // Fill in all existing values
            this.el('marker-name').value = markerData.name || '';
            this.el('marker-id').value = markerData.id || '';
            this.el('marker-id').dataset.manuallyEdited = 'true'; // Prevent auto-generation
            this.el('marker-type').value = markerData.type || 'other';
            this.el('marker-faction').value = markerData.faction || '';
            this.el('marker-summary').value = markerData.summary || '';
            this.el('marker-wiki-slug').value = markerData.wikiSlug || '';
            this.el('marker-icon').value = markerData.customIcon || '';
            this.el('marker-icon-url').value = markerData.iconUrl || '';
            this.el('marker-public').checked = markerData.public !== false;
            this.el('marker-is-port').checked = markerData.isPort === true;
            
            // Update icon selector visual state
            const iconOptions = document.querySelectorAll('.icon-option');
            iconOptions.forEach(option => {
                if (option.dataset.icon === markerData.customIcon) {
                    option.style.background = '#007bff';
                    option.style.color = 'white';
                } else {
                    option.style.background = 'white';
                    option.style.color = 'initial';
                }
            });
            
            // Store coordinates
            this.el('marker-lat').value = markerData.y;
            this.el('marker-lng').value = markerData.x;
            this.el('marker-coordinates').value = `X: ${Math.round(markerData.x)}, Y: ${Math.round(markerData.y)}`;
            // Load existing images
            const imagesListEl = this.el('marker-images-list');
            if (imagesListEl) {
                imagesListEl.innerHTML = '';
                const images = Array.isArray(markerData.images) ? markerData.images : [];
                images.forEach(url => {
                    const row = document.createElement('div');
                    row.className = 'image-list-item';
                    row.innerHTML = `<input type=\"url\" placeholder=\"https://... or images/sample.jpg\" value=\"${url}\"><button type=\"button\" class=\"remove-image\">Remove</button>`;
                    row.querySelector('.remove-image').addEventListener('click', () => row.remove());
                    imagesListEl.appendChild(row);
                });
            }
            
            // Show the modal
            modal.classList.remove('hidden');
            this.el('marker-name').focus();
        }

        /**
         * Opens the bulk import modal
         */
        openBulkImportModal() {
            this.el('bulk-import-modal').classList.remove('hidden');
            this.el('csv-input').focus();
        }

        /**
         * Opens the terrain type modal or auto-saves if a terrain mode is active
         * @param {Object} controls - The DM controls instance to check terrain mode
         */
        async openTerrainTypeModal(controls) {
            // If a terrain mode is active, use it automatically without showing the modal
            if (controls && controls.getCurrentTerrainMode()) {
                await this.saveTerrainWithType(controls.getCurrentTerrainMode());
                return;
            }
            this.el('terrain-type-modal').classList.remove('hidden');
        }

        /**
         * Saves marker data from the form
         */
        saveMarkerFromForm() {
            const form = this.el('marker-form');
            const isEditMode = form.dataset.editMode === 'true';
            const originalId = isEditMode ? form.dataset.originalId : null;
            
            // When editing, we don't need a pending marker
            if (!isEditMode && !this.pendingMarker) {
                this.bridge.showNotification(this.t('dm.notifications.markerDeleteError'), 'error');
                this.el('marker-creation-modal').classList.add('hidden');
                return;
            }

            const formData = new FormData(form);
            
            const id = formData.get('marker-id');
            const name = formData.get('marker-name');
            const summary = formData.get('marker-summary');
            const type = formData.get('marker-type');
            const faction = formData.get('marker-faction');
            const customIcon = formData.get('marker-icon');
            const iconUrl = formData.get('marker-icon-url');
            const isPublic = formData.get('marker-public') === 'on';
            const isPort = formData.get('marker-is-port') === 'on';
            const wikiSlug = formData.get('marker-wiki-slug');
            
            // Get coordinates from the hidden fields
            const lat = parseFloat(this.el('marker-lat').value);
            const lng = parseFloat(this.el('marker-lng').value);

            // Validation
            if (!this.validateMarkerData(id, name, summary, lat, lng, isEditMode, originalId)) {
                return;
            }

            const markerData = {
                id, name,
                x: lng,
                y: lat,
                type,
                faction: faction || undefined,
                summary,
                customIcon: customIcon ? customIcon.trim() : undefined,
                iconUrl: iconUrl ? iconUrl.trim() : undefined,
                images: [], // Will populate from UI; preserve in edit mode handled below
                public: isPublic,
                isPort: isPort || undefined,
                wikiSlug: wikiSlug ? wikiSlug.trim() || undefined : undefined,
            };

            // Collect images from UI list
            const imagesListEl2 = this.el('marker-images-list');
            if (imagesListEl2) {
                const urls = Array.from(imagesListEl2.querySelectorAll('input[type="url"]'))
                    .map(inp => (inp.value || '').trim())
                    .filter(v => v.length > 0);
                markerData.images = urls;
            }

            if (isEditMode) {
                this.updateExistingMarker(markerData, originalId);
            } else {
                this.createNewMarker(markerData);
            }
            
            this.bridge.markDirty('markers');
            this.el('marker-creation-modal').classList.add('hidden');
        }

        /**
         * Validates marker form data
         * @param {string} id - Marker ID
         * @param {string} name - Marker name
         * @param {string} summary - Marker summary
         * @param {number} lat - Latitude
         * @param {number} lng - Longitude
         * @param {boolean} isEditMode - Whether we're editing an existing marker
         * @param {string} originalId - Original ID when editing
         * @returns {boolean} Whether the data is valid
         */
        validateMarkerData(id, name, summary, lat, lng, isEditMode, originalId) {
            if (!id || !name || !summary) {
                this.bridge.showNotification(this.t('dm.notifications.markerDeleteError'), 'error');
                return false;
            }
            if (isNaN(lat) || isNaN(lng)) {
                this.bridge.showNotification(this.t('dm.notifications.markerDeleteError'), 'error');
                return false;
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
                this.bridge.showNotification(this.t('dm.notifications.markerDeleteError'), 'error');
                return false;
            }
            
            // Check for ID conflicts, but allow the same ID when editing
            if (!isEditMode && this.bridge.state.markers.some(m => m.id === id)) {
                this.bridge.showNotification(this.t('dm.notifications.markerDeleteError'), 'error');
                return false;
            }
            
            // Also check if we're editing but changing the ID to one that already exists
            if (isEditMode && id !== originalId && this.bridge.state.markers.some(m => m.id === id)) {
                this.bridge.showNotification(this.t('dm.notifications.markerDeleteError'), 'error');
                return false;
            }

            return true;
        }

        /**
         * Updates an existing marker
         * @param {Object} markerData - The new marker data
         * @param {string} originalId - The original marker ID
         */
        updateExistingMarker(markerData, originalId) {
            const markerIndex = this.bridge.state.markers.findIndex(m => m.id === originalId);
            if (markerIndex === -1) {
                this.bridge.showNotification(this.t('dm.notifications.markerDeleteError'), 'error');
                return;
            }
            
            // IMPORTANT: markerData.images already reflects the current UI state (added/removed by the user).
            // We only ensure it's an array to avoid runtime issues.
            if (!Array.isArray(markerData.images)) markerData.images = [];
            
            // CRITICAL: Preserve fields not in the form (like banner, isWaypoint, etc.)
            const oldMarker = this.bridge.state.markers[markerIndex];
            const updatedMarker = {
                ...oldMarker,      // Keep all existing fields
                ...markerData,     // Override with new form data
            };
            
            // Replace the existing marker
            this.bridge.state.markers[markerIndex] = updatedMarker;
            
            // Need to refresh all markers to update the marker on the map
            if (this.bridge.markersModule && this.bridge.markersModule.renderMarkers) {
                this.bridge.markersModule.renderMarkers();
            }
            
            console.log('Marker updated:', markerData.name);
            this.bridge.showNotification(this.t('dm.notifications.markerUpdated'), 'success');
        }

        /**
         * Creates a new marker
         * @param {Object} markerData - The marker data
         */
        createNewMarker(markerData) {
            this.bridge.state.markers.push(markerData);
            this.pendingMarker.on('click', () => this.bridge.openInfoSidebar(markerData));

            // Add touch support for DM mode markers
            TouchEventManager.addTouchTap(this.pendingMarker, () => {
                this.bridge.openInfoSidebar(markerData);
            });
            
            this.pendingMarker.options.isPending = false; // Unmark it
            this.pendingMarker = null;
            
            console.log('New marker created:', markerData.name);
            this.bridge.showNotification(this.t('dm.notifications.markerSaved'), 'success');
        }

        /**
         * Saves terrain with the specified type
         * @param {string} terrainType - The type of terrain
         */
        saveTerrainWithType(terrainType) {
            if (!this.pendingTerrain) return;

            const feature = this.pendingTerrain.toGeoJSON();
            feature.properties.kind = terrainType;
            // *** THIS IS THE CRITICAL FIX: Assign a unique ID ***
            feature.properties._internal_id = `terrain_${Date.now()}_${Math.random()}`;
            
            // Add the new feature to the state before re-rendering
            this.bridge.state.terrain.features.push(feature);

            // The terrain module will now handle the visual representation
            if (this.bridge.terrainModule) {
                this.bridge.terrainModule.renderTerrain();
            }
            
            this.bridge.showNotification(this.t('dm.notifications.terrainSaved'), 'success');
            this.bridge.markDirty('terrain');

            // Refresh publish UI so the UNSAVED badge / button state updates immediately
            try {
                if (this.bridge.dmModule && this.bridge.state && this.bridge.state.isDmMode) {
                    if (this.bridge.uiModule && this.bridge.uiModule.updatePublishUI) {
                        this.bridge.uiModule.updatePublishUI();
                    } else if (window.DmControls) {
                        // Attempt to find existing control instance via DOM manipulation (lightweight fallback)
                        const publishBtn = this.el('dm-publish-json');
                        if (publishBtn) {
                            publishBtn.style.outline = '2px solid #d9534f';
                            setTimeout(()=>publishBtn.style.outline='',1200);
                        }
                    }
                }
            } catch (e) { console.warn('Failed to refresh publish UI after terrain save', e); }

            // Invalidate the routing graph so the next calculation uses the new terrain
            if (this.bridge.routingModule && this.bridge.routingModule.invalidateGraph) {
                this.bridge.routingModule.invalidateGraph();
            }
            
            // We no longer need the temporary layer drawn by Geoman, as renderTerrain has replaced it
            this.bridge.map.removeLayer(this.pendingTerrain);
            this.pendingTerrain = null;
        }



        /**
         * Processes bulk CSV import
         * @param {string} csvData - The CSV data to import
         */
        processBulkImport(csvData) {
            if (!csvData.trim()) {
                this.bridge.showNotification(this.t('dm.notifications.importInvalidCsv'), 'error');
                return;
            }

            const lines = csvData.trim().split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            const hasHeaders = ['name', 'x', 'y'].every(h => headers.includes(h));
            const dataLines = hasHeaders ? lines.slice(1) : lines;

            const result = this.importMarkerRows(dataLines, headers, hasHeaders);

            if (result.imported > 0) {
                const msg = this.t('dm.notifications.importSuccess').replace('{{count}}', result.imported);
                this.bridge.showNotification(msg, 'success');
                this.bridge.markDirty('markers');
            }
            if (result.errors.length > 0) {
                console.warn('Import errors:', result.errors);
                this.bridge.showNotification(this.t('dm.notifications.importError'), 'error');
            }

            this.el('bulk-import-modal').classList.add('hidden');
        }

        /**
         * Import marker rows from CSV data
         * @private
         */
        importMarkerRows(dataLines, headers, hasHeaders) {
            let imported = 0;
            let errors = [];

            dataLines.forEach((line, index) => {
                const values = line.split(',').map(v => v.trim());
                try {
                    const markerData = hasHeaders
                        ? this.parseCSVWithHeaders(headers, values)
                        : this.parseCSVWithoutHeaders(values);

                    const validationError = this.validateMarkerData(markerData, index);
                    if (validationError) {
                        errors.push(validationError);
                        return;
                    }

                    this.createImportedMarker(markerData);
                    imported++;

                } catch (error) {
                    errors.push(`Row ${index + 1}: ${error.message}`);
                }
            });

            return { imported, errors };
        }

        /**
         * Validate marker data from CSV
         * @private
         */
        validateMarkerData(markerData, rowIndex) {
            if (!markerData.name || isNaN(markerData.x) || isNaN(markerData.y)) {
                return `Row ${rowIndex + 1}: Missing or invalid required fields (name, x, y)`;
            }
            if (this.bridge.state.markers.some(m => m.id === markerData.id)) {
                return `Row ${rowIndex + 1}: Marker ID "${markerData.id}" already exists`;
            }
            return null;
        }

        /**
         * Create and add an imported marker to the map
         * @private
         */
        createImportedMarker(markerData) {
            this.bridge.state.markers.push(markerData);
            const marker = L.marker([markerData.y, markerData.x]).addTo(this.bridge.map);
            marker.on('click', () => this.bridge.openInfoSidebar(markerData));
            TouchEventManager.addTouchTap(marker, () => this.bridge.openInfoSidebar(markerData));
        }

        /**
         * Parses CSV data with headers
         * @param {Array} headers - The CSV headers
         * @param {Array} values - The CSV values
         * @returns {Object} Parsed marker data
         */
        parseCSVWithHeaders(headers, values) {
            const data = {};
            headers.forEach((header, i) => { data[header] = values[i] || ''; });
            
            return {
                id: data.id || this.bridge.generateIdFromName(data.name),
                name: data.name,
                x: parseFloat(data.x),
                y: parseFloat(data.y),
                type: data.type || 'other',
                faction: data.faction || undefined,
                summary: data.summary || '',
                images: [],
                public: ['true', '1', 'yes'].includes((data.public || '').toLowerCase()),
            };
        }

        /**
         * Parses CSV data without headers
         * @param {Array} values - The CSV values
         * @returns {Object} Parsed marker data
         */
        parseCSVWithoutHeaders(values) {
            // Assume order: name,x,y,type,faction,summary,public
            return {
                id: this.bridge.generateIdFromName(values[0]),
                name: values[0],
                x: parseFloat(values[1]),
                y: parseFloat(values[2]),
                type: values[3] || 'other',
                faction: values[4] || undefined,
                summary: values[5] || '',
                images: [],
                public: ['true', '1', 'yes'].includes((values[6] || '').toLowerCase()),
            };
        }

        /**
         * Sets the pending marker
         * @param {L.Marker} marker - The pending marker
         */
        setPendingMarker(marker) {
            this.pendingMarker = marker;
        }

        /**
         * Sets the pending terrain
         * @param {L.Layer} terrain - The pending terrain layer
         */
        setPendingTerrain(terrain) {
            this.pendingTerrain = terrain;
        }

        /**
         * Sets up click-outside-to-close functionality for all modals
         */
        setupModalClickOutsideToClose() {
            // Get all modal elements
            const modals = document.querySelectorAll('.modal');
            
            modals.forEach(modal => {
                // Skip if already has click outside handler
                if (modal.hasAttribute('data-click-outside-setup')) return;
                modal.setAttribute('data-click-outside-setup', 'true');
                
                modal.addEventListener('click', (e) => {
                    // Only close if clicking on the modal backdrop (not the content)
                    if (e.target === modal) {
                        modal.classList.add('hidden');
                        
                        // Clean up any pending operations
                        if (modal.id === 'marker-creation-modal' && this.pendingMarker) {
                            this.bridge.map.removeLayer(this.pendingMarker);
                            this.pendingMarker = null;
                        }
                        if (modal.id === 'terrain-type-modal' && this.pendingTerrain) {
                            this.bridge.map.removeLayer(this.pendingTerrain);
                            this.pendingTerrain = null;
                        }
                    }
                });
                
                // Prevent clicks on modal content from bubbling up to close the modal
                const modalContent = modal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });
                }
            });
        }



        /**
         * Manual merge tool: Merges selected polygons
         * Uses buffer to fill small gaps between polygons
         */
        mergeSelectedPolygons() {
            if (typeof turf === 'undefined') {
                this.bridge.showNotification('Turf.js not loaded', 'error');
                return;
            }

            const selected = this.bridge.selectedTerrainForMerge || [];
            const validationError = this.validateMergeSelection(selected);
            if (validationError) {
                this.bridge.showNotification(validationError.message, validationError.type);
                return;
            }

            try {
                const merged = this.performMerge(selected);
                this.applyMergedFeature(merged, selected);
                this.bridge.showNotification(`Merged ${selected.length} polygons (gaps filled)`, 'success');
            } catch (error) {
                console.error('Merge failed:', error);
                this.bridge.showNotification('Merge failed: ' + error.message, 'error');
            }
        }

        /**
         * Validate terrain selection for merging
         * @private
         */
        validateMergeSelection(selected) {
            if (selected.length < 2) {
                return { message: 'Click at least 2 polygons to select them, then click Merge', type: 'info' };
            }

            const firstType = selected[0].properties.kind;
            if (!selected.every(f => f.properties.kind === firstType)) {
                return { message: 'All selected polygons must be the same terrain type', type: 'error' };
            }

            const allPolygons = selected.every(f =>
                f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
            );
            if (!allPolygons) {
                return { message: 'Can only merge polygons, not roads/lines', type: 'error' };
            }

            return null;
        }

        /**
         * Perform the merge operation with fallback to buffer method
         * @private
         */
        performMerge(selected) {
            const firstType = selected[0].properties.kind;

            try {
                // Try direct union (for touching/overlapping polygons)
                const merged = turf.union(turf.featureCollection(selected));
                console.log('Direct union successful');
                merged.properties = { kind: firstType, _internal_id: `terrain_${firstType}_merged_${Date.now()}` };
                return merged;
            } catch (directError) {
                // Fallback: buffer method (fills gaps)
                console.log('Direct union failed, using buffer method');
                return this.mergeWithBuffer(selected, firstType);
            }
        }

        /**
         * Merge polygons using buffer method to fill gaps
         * @private
         */
        mergeWithBuffer(selected, terrainType) {
            const bufferSize = DM_CONSTANTS.TERRAIN_MERGE_BUFFER;
            const buffered = selected.map(f => turf.buffer(f, bufferSize, { units: 'degrees' }));
            let merged = turf.union(turf.featureCollection(buffered));

            // Try to shrink back to original size
            try {
                const shrunk = turf.buffer(merged, -bufferSize, { units: 'degrees' });
                if (shrunk && shrunk.geometry && shrunk.geometry.coordinates.length > 0) {
                    merged = shrunk;
                    console.log('Buffered union successful with shrink');
                } else {
                    console.log('Shrink too aggressive, keeping expanded union');
                }
            } catch (bufferError) {
                console.log('Shrink failed, keeping expanded union');
            }

            merged.properties = { kind: terrainType, _internal_id: `terrain_${terrainType}_merged_${Date.now()}` };
            return merged;
        }

        /**
         * Apply merged feature to terrain state and re-render
         * @private
         */
        applyMergedFeature(merged, selected) {
            const selectedIds = selected.map(f => f.properties._internal_id);
            this.bridge.state.terrain.features = this.bridge.state.terrain.features.filter(
                f => !selectedIds.includes(f.properties._internal_id)
            );
            this.bridge.state.terrain.features.push(merged);
            this.bridge.selectedTerrainForMerge = [];
            this.bridge.terrainModule.renderTerrain();
            this.bridge.markDirty('terrain');
            console.log('✅ Merge complete');
        }
    }

    // Export the class to global scope
    window.DmModals = DmModals;

})(window);