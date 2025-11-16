// map/js/terrain.js

(function(window) {
    'use strict';

    let bridge = {};
    let terrainLayer = null;

    function initTerrainModule(nimeaBridge) {
        bridge = nimeaBridge;
        if (!bridge) {
            console.error("Terrain module requires the global Nimea bridge.");
            return;
        }

        bridge.terrainModule = {
            renderTerrain,
            hideTerrain,
            getTerrainAsGeoJSON,
            get terrainLayer() { return terrainLayer; } // Expose layer for DM selection
        };

        // Only render terrain if in DM mode
        if (bridge.state.isDmMode) {
            renderTerrain();
        }
    }

    function renderTerrain() {
        if (!bridge.state.isDmMode) {
            return;
        }

        if (terrainLayer) {
            bridge.map.removeLayer(terrainLayer);
        }

        terrainLayer = L.geoJSON(bridge.state.terrain, {
            style: function(feature) {
                const kind = feature.properties.kind;
                return window.getTerrainStyle(kind);
            },
            onEachFeature: function (feature, layer) {
                // Store feature reference on layer for DM tools
                layer.feature = feature;
            }
        }).addTo(bridge.map);

        // Emit event for DM tools to hook into without monkey-patching
        if (bridge.events) {
            bridge.events.emit('terrainRendered', { terrainLayer });
        }
    }

    function hideTerrain() {
        if (terrainLayer && bridge.map.hasLayer(terrainLayer)) {
            bridge.map.removeLayer(terrainLayer);
            terrainLayer = null;
        }
    }

    function getTerrainAsGeoJSON() {
        const geojson = {
            type: 'FeatureCollection',
            features: []
        };
        if (terrainLayer) {
            terrainLayer.eachLayer(layer => {
                const feature = layer.toGeoJSON();
                // Ensure properties are preserved
                if (layer.feature && layer.feature.properties) {
                    feature.properties = layer.feature.properties;
                }
                geojson.features.push(feature);
            });
        }
        return geojson;
    }

    window.__nimea_terrain_init = initTerrainModule;

})(window);
