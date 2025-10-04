// map/js/dm.js

(function(window) {
    'use strict';

    // This will be our connection to the main map script
    let bridge = {};

    // Module instances
    let dmControls = null;
    let dmModals = null;

    // Track the most recently selected vertex during editing
    let selectedVertexInfo = null;

    /**
     * Initializes the DM module.
     * This function is called by the main map script.
     * @param {object} nimeaBridge - The global bridge object from map.js
     */
    function initDmModule(nimeaBridge) {
        bridge = nimeaBridge;
        if (!bridge || !bridge.map) {
            console.error("DM module requires the global Nimea bridge with a map instance.");
            return;
        }

        // Check if required classes are available
        if (!window.DmControls) {
            console.error("DmControls class not found. Make sure dm-controls.js is loaded before dm.js");
            return;
        }
        if (!window.DmModals) {
            console.error("DmModals class not found. Make sure dm-modals.js is loaded before dm.js");
            return;
        }

        // Initialize sub-modules
        dmControls = new window.DmControls(bridge);
        dmModals = new window.DmModals(bridge);

        // Expose public functions via the bridge
        bridge.dmModule = {
            setupDmMode,
            saveMarkerFromForm: () => dmModals.saveMarkerFromForm(),
            updateMarkerPosition,
            editMarker: (markerData) => dmModals.editMarker(markerData),
            deleteMarker,
            deleteSelectedVertex,
            openBulkImportModal: () => dmModals.openBulkImportModal(),
            mergeSelectedPolygons: () => dmModals.mergeSelectedPolygons(),
            exportData,
            publishAll
        };
        
        // Add helper functions from the main script that we need to the bridge if they aren't there
        // This makes the DM module more self-contained
        bridge.generateIdFromName = bridge.generateIdFromName || generateIdFromName;
        bridge.styleTerrainLayer = bridge.styleTerrainLayer || styleTerrainLayer;
        bridge.renderExistingTerrain = bridge.renderExistingTerrain || function() {
            if (bridge.terrainModule) {
                bridge.terrainModule.renderTerrain();
            }
        };
        bridge.openInfoSidebar = bridge.openInfoSidebar || function() { 
            console.error('openInfoSidebar not implemented on bridge'); 
        };
    }

    /**
     * Sets up all DM-related controls and event listeners.
     * This is the main entry point for DM functionality.
     */
    async function setupDmMode() {
        // If not in DM mode, we're done here.
        if (!bridge.state.isDmMode) {
            return;
        }

        // Initialize Git Gateway for live CMS functionality
        await initializeGitClient();

        // Add Leaflet-Geoman controls for drawing
        addGeomanControls();

        // Add all custom DM controls via the controls module
        dmControls.addAllControls();

        // Set up modals via the modals module
        dmModals.setupAllModals();

        // Set up Leaflet-Geoman event listeners
        setupMapEventListeners();
    }

    /**
     * Initializes the Git client for live CMS functionality
     */
    async function initializeGitClient() {
        try {
            await window.gitClient.initialize();
            if (window.gitClient.isAuthenticated) {
                bridge.state.isLiveCMS = true;
                bridge.showNotification('Live CMS mode enabled - changes save directly to repository!', 'success');
            } else {
                bridge.showNotification('Click "Login" to enable live CMS mode', 'info');
            }
        } catch (error) {
            console.warn('Git Gateway not available:', error);
            bridge.showNotification('Offline mode - use Export button to save data', 'info');
        }
    }

    /**
     * Adds Leaflet-Geoman drawing controls to the map
     */
    function addGeomanControls() {
        bridge.map.pm.addControls({
            position: 'topleft',
            drawMarker: true,
            drawPolygon: true,
            drawPolyline: true,
            editMode: true,
            removalMode: true,
        });
    }

    /**
     * Sets up all map event listeners for Geoman interactions
     */
    function setupMapEventListeners() {
        // Track vertex selections for node deletion
        bridge.map.on('pm:vertexclick', handleVertexClick);
        bridge.map.on('pm:globaleditmodeend', clearSelectedVertex);
        bridge.map.on('pm:drawstart', clearSelectedVertex);
        bridge.map.on('pm:drawend', clearSelectedVertex);

        // Listen for new shapes created by Geoman
        bridge.map.on('pm:create', async (e) => {
            if (e.shape === 'Marker') {
                const marker = e.layer;
                marker.options.isPending = true; // Mark to avoid cleanup by other functions
                dmModals.setPendingMarker(marker);
                dmModals.openMarkerCreationModal(marker.getLatLng());
            } else if (e.shape === 'Polygon' || e.shape === 'Line') {
                dmModals.setPendingTerrain(e.layer);
                await dmModals.openTerrainTypeModal(dmControls); 
            }
        });

        // Listen for shapes being removed by Geoman
        bridge.map.on('pm:remove', (e) => {
            if (selectedVertexInfo && selectedVertexInfo.layer === e.layer) {
                clearSelectedVertex();
            }
            if (e.layer && e.layer.feature) {
                const removedId = e.layer.feature.properties._internal_id;
                if (!removedId) return; 

                const features = bridge.state.terrain.features;
                const index = features.findIndex(f => f.properties._internal_id === removedId);

                if (index > -1) {
                    features.splice(index, 1);
                    bridge.markDirty('terrain');
                    bridge.showNotification('Terrain feature removed.', 'success');
                }
            }
        });

        // Listen for shapes being edited by Geoman
        bridge.map.on('pm:edit', (e) => {
            if (e.layer && e.layer.feature) {
                const editedId = e.layer.feature.properties._internal_id;
                if (!editedId) return;

                const featureToUpdate = bridge.state.terrain.features.find(f => f.properties._internal_id === editedId);

                if (featureToUpdate) {
                    featureToUpdate.geometry = e.layer.toGeoJSON().geometry;
                    bridge.markDirty('terrain');
                    bridge.showNotification('Terrain feature updated.', 'info');
                }
            }
        });
    }

    /**
     * Updates an existing marker's position when dragged.
     * @param {object} markerData - The marker data object to update
     */
    function updateMarkerPosition(markerData) {
        // Find the marker in the state and update it
        const markerIndex = bridge.state.markers.findIndex(m => m.id === markerData.id);
        if (markerIndex !== -1) {
            bridge.state.markers[markerIndex] = markerData;
            bridge.markDirty('markers');
            console.log(`Updated marker "${markerData.name}" position to [${markerData.y}, ${markerData.x}]`);
            bridge.showNotification(`Moved "${markerData.name}"`, 'success');
        } else {
            console.error('Could not find marker to update:', markerData.id);
        }
    }
    
    /**
     * Deletes a marker by its ID
     * @param {string} markerId - The ID of the marker to delete
     */
    function deleteMarker(markerId) {
        if (!markerId) return;
        
        const markerIndex = bridge.state.markers.findIndex(m => m.id === markerId);
        if (markerIndex === -1) {
            console.error('Could not find marker to delete:', markerId);
            return;
        }
        
        const markerName = bridge.state.markers[markerIndex].name;
        
        // Remove the marker from the state
        bridge.state.markers.splice(markerIndex, 1);
        
        // Re-render all markers to remove it from the map
        if (bridge.markersModule && bridge.markersModule.renderMarkers) {
            bridge.markersModule.renderMarkers();
        }
        
        bridge.markDirty('markers');
        bridge.showNotification(`Marker "${markerName}" deleted`, 'success');
    }

    /**
     * Triggers a file download for the current marker and terrain data.
     */
    function exportData() {
        const markersBlob = new Blob([JSON.stringify({ markers: bridge.state.markers }, null, 2)], { type: 'application/json' });
        download(markersBlob, 'markers.json');

        const terrainBlob = new Blob([JSON.stringify(bridge.state.terrain, null, 2)], { type: 'application/json' });
        download(terrainBlob, 'terrain.geojson');
    }

    /**
     * Publishes all dirty data (markers, terrain) to the Git repository.
     */
    async function publishAll() {
        if (!window.gitClient || !window.gitClient.isAuthenticated) {
            bridge.showNotification('Login required to publish changes. Use Download button to save offline.', 'error');
            return;
        }
        bridge.showNotification('Publishing changes...', 'info');
        try {
            if (bridge.state.dirty.markers) {
                await window.gitClient.saveMarkersData({ markers: bridge.state.markers });
            }
            if (bridge.state.dirty.terrain) {
                await window.gitClient.saveTerrainData(bridge.state.terrain);
            }
            await window.gitClient.triggerRedeploy();
            
            bridge.state.dirty.markers = false;
            bridge.state.dirty.terrain = false;
            dmControls.updatePublishUI();
            
            bridge.showNotification('Published & site rebuild triggered!', 'success');
        } catch (e) {
            console.error('Publish failed:', e);
            bridge.showNotification('Publish failed. Try Download button to save offline, then manually commit files.', 'error');
        }
    }

    /**
     * Helper function to download a blob as a file
     * @param {Blob} blob - The blob to download
     * @param {string} filename - The filename for the download
     */
    function download(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }


    /**
     * Clears the stored vertex selection metadata.
     */
    function clearSelectedVertex() {
        selectedVertexInfo = null;
    }

    /**
     * Handles vertex click events so we can remove them via a dedicated control.
     * @param {object} event - Leaflet-Geoman vertex click event payload
     */
    function handleVertexClick(event) {
        if (!event || !event.layer || !event.marker) {
            return;
        }

        const layer = event.layer;
        const latlng = event.marker.getLatLng ? event.marker.getLatLng() : event.latlng;
        if (!latlng) {
            return;
        }

        const path = findLatLngPath(layer.getLatLngs(), latlng);
        if (!path) {
            console.warn('Could not determine vertex index path for deletion.');
            selectedVertexInfo = null;
            return;
        }

        const featureId = layer.feature?.properties?._internal_id || null;
        const isPendingTerrain = !!(dmModals && dmModals.pendingTerrain === layer);
        const geometryType = detectLayerGeometry(layer);

        selectedVertexInfo = {
            layer,
            path,
            geometryType,
            featureId,
            isPendingTerrain
        };
    }

    /**
     * Deletes the currently selected vertex from its parent layer.
     */
    function deleteSelectedVertex() {
        if (!selectedVertexInfo) {
            bridge.showNotification('Select a vertex in edit mode, then press Delete Node.', 'info');
            return;
        }

        const { layer, path, geometryType, featureId, isPendingTerrain } = selectedVertexInfo;
        if (!layer || !layer._map) {
            bridge.showNotification('The selected layer is no longer active.', 'error');
            clearSelectedVertex();
            return;
        }

        const removal = removeLatLngAtPath(layer.getLatLngs(), path, geometryType);
        if (!removal.success) {
            bridge.showNotification(removal.message || 'Unable to remove vertex.', 'error');
            return;
        }

        layer.setLatLngs(removal.latlngs);
        if (typeof layer.redraw === 'function') {
            layer.redraw();
        }

        if (layer.pm && typeof layer.pm.disable === 'function' && typeof layer.pm.enable === 'function') {
            try {
                layer.pm.disable();
                layer.pm.enable();
            } catch (err) {
                console.warn('Could not refresh Geoman edit state after vertex deletion:', err);
            }
        }

        if (!isPendingTerrain && featureId) {
            const feature = bridge.state.terrain.features.find(f => f.properties?._internal_id === featureId);
            if (feature) {
                feature.geometry = layer.toGeoJSON().geometry;
                bridge.markDirty('terrain');
            }
        }

        bridge.showNotification('Vertex removed.', 'success');
        clearSelectedVertex();
    }

    /**
     * Determines the geometry type for the provided layer.
     * @param {L.Layer} layer
     * @returns {string}
     */
    function detectLayerGeometry(layer) {
        if (!layer) {
            return 'Unknown';
        }
        if (layer.feature && layer.feature.geometry && layer.feature.geometry.type) {
            return layer.feature.geometry.type;
        }
        if (layer.pm && typeof layer.pm.getShape === 'function') {
            return layer.pm.getShape();
        }
        if (layer instanceof L.Polygon) {
            return 'Polygon';
        }
        if (layer instanceof L.Polyline) {
            return 'LineString';
        }
        return 'Unknown';
    }

    /**
     * Recursively locates the index path for a given latlng.
     * @param {Array} latlngs
     * @param {L.LatLng} target
     * @param {Array<number>} [path]
     * @returns {Array<number>|null}
     */
    function findLatLngPath(latlngs, target, path = []) {
        if (!Array.isArray(latlngs)) {
            return null;
        }
        for (let i = 0; i < latlngs.length; i++) {
            const value = latlngs[i];
            if (Array.isArray(value)) {
                const nested = findLatLngPath(value, target, path.concat(i));
                if (nested) {
                    return nested;
                }
            } else if (value && typeof value.lat === 'number' && typeof value.lng === 'number') {
                if (latLngsEqual(value, target)) {
                    return path.concat(i);
                }
            }
        }
        return null;
    }

    /**
     * Removes a latlng from the nested structure at the provided path.
     * @param {Array} latlngs
     * @param {Array<number>} path
     * @param {string} geometryType
     * @returns {{ success: boolean, latlngs?: Array, message?: string }}
     */
    function removeLatLngAtPath(latlngs, path, geometryType) {
        if (!Array.isArray(path) || path.length === 0) {
            return { success: false, message: 'Invalid vertex selection.' };
        }

        const clone = cloneLatLngStructure(latlngs);
        let parent = clone;
        for (let i = 0; i < path.length - 1; i++) {
            parent = parent[path[i]];
            if (!Array.isArray(parent)) {
                return { success: false, message: 'Vertex path mismatch.' };
            }
        }

        const removeIndex = path[path.length - 1];
        if (!Array.isArray(parent) || removeIndex < 0 || removeIndex >= parent.length) {
            return { success: false, message: 'Vertex index out of range.' };
        }

        parent.splice(removeIndex, 1);

        if (geometryType && geometryType.toLowerCase().includes('polygon')) {
            const rings = extractPolygonRings(clone);
            if (!rings.length) {
                return { success: false, message: 'Unable to adjust polygon vertices.' };
            }
            for (const ring of rings) {
                normalizePolygonRing(ring);
                const distinct = countDistinctVertices(ring);
                if (distinct < 3) {
                    return { success: false, message: 'Polygons must keep at least three unique vertices.' };
                }
            }
        } else if (geometryType && geometryType.toLowerCase().includes('line')) {
            const segments = extractLineSegments(clone);
            if (!segments.length) {
                return { success: false, message: 'Unable to adjust line vertices.' };
            }
            for (const segment of segments) {
                if (segment.length < 2) {
                    return { success: false, message: 'Lines must keep at least two points.' };
                }
            }
        }

        return { success: true, latlngs: clone };
    }

    /**
     * Deep clones a latlng structure without duplicating LatLng instances unnecessarily.
     * @param {Array} latlngs
     * @returns {Array}
     */
    function cloneLatLngStructure(latlngs) {
        if (!Array.isArray(latlngs)) {
            return latlngs;
        }
        return latlngs.map(item => {
            if (Array.isArray(item)) {
                return cloneLatLngStructure(item);
            }
            if (item && typeof item.lat === 'number' && typeof item.lng === 'number') {
                return item.clone ? item.clone() : L.latLng(item.lat, item.lng);
            }
            return item;
        });
    }

    function latLngsEqual(a, b, epsilon = 1e-6) {
        if (!a || !b) {
            return false;
        }
        return Math.abs(a.lat - b.lat) <= epsilon && Math.abs(a.lng - b.lng) <= epsilon;
    }

    function extractPolygonRings(latlngs) {
        const rings = [];
        const stack = [latlngs];
        while (stack.length) {
            const current = stack.pop();
            if (!Array.isArray(current) || !current.length) {
                continue;
            }
            if (current[0] && typeof current[0].lat === 'number') {
                rings.push(current);
            } else {
                for (const entry of current) {
                    stack.push(entry);
                }
            }
        }
        return rings;
    }

    function extractLineSegments(latlngs) {
        const segments = [];
        const stack = [latlngs];
        while (stack.length) {
            const current = stack.pop();
            if (!Array.isArray(current) || !current.length) {
                continue;
            }
            if (current[0] && typeof current[0].lat === 'number') {
                segments.push(current);
            } else {
                for (const entry of current) {
                    stack.push(entry);
                }
            }
        }
        return segments;
    }

    function normalizePolygonRing(ring) {
        if (!Array.isArray(ring) || !ring.length) {
            return;
        }
        while (ring.length > 1 && latLngsEqual(ring[ring.length - 1], ring[0])) {
            ring.pop();
        }
        if (ring.length === 0) {
            return;
        }
        const first = ring[0];
        const closing = first.clone ? first.clone() : L.latLng(first.lat, first.lng);
        ring.push(closing);
    }

    function countDistinctVertices(ring) {
        if (!Array.isArray(ring)) {
            return 0;
        }
        const seen = [];
        for (let i = 0; i < ring.length; i++) {
            const point = ring[i];
            if (i === ring.length - 1 && latLngsEqual(point, ring[0])) {
                continue;
            }
            if (!seen.some(existing => latLngsEqual(existing, point))) {
                seen.push(point);
            }
        }
        return seen.length;
    }

    /**
     * Helper function to generate ID from name (fallback if not available on bridge)
     * @param {string} name - The name to convert to ID
     * @returns {string} The generated ID
     */
    function generateIdFromName(name) {
        if (!name) return '';
        return name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Helper function to style terrain layers (fallback if not available on bridge)
     * @param {L.Layer} layer - The layer to style
     * @param {string} terrainType - The type of terrain
     */
    function styleTerrainLayer(layer, terrainType) {
        const styles = bridge.config.terrainStyles || {
            road: { color: '#4a90e2', weight: 4, opacity: 0.9, dashArray: '0' },
            unpassable: { color: '#d0021b', weight: 3, opacity: 0.9, fillColor: '#d0021b', fillOpacity: 0.4 },
            difficult: { color: '#f5a623', weight: 3, opacity: 0.85, fillColor: '#f5a623', fillOpacity: 0.25, dashArray: '4,4' },
        };

        if (layer.setStyle && styles[terrainType]) {
            layer.setStyle(styles[terrainType]);
        }
    }

    // Expose the initializer function to the global scope
    window.__nimea_dm_init = initDmModule;

})(window);
