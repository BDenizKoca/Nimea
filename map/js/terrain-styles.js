// Centralized terrain styling configuration
// Single source of truth for all terrain feature styles

(function(window) {
    'use strict';

    // Terrain style definitions
    const TERRAIN_STYLES = {
        road: {
            color: '#4a90e2',
            weight: 4,
            opacity: 0.9,
            dashArray: '0'
        },
        normal: {
            color: '#90ee90',
            weight: 2,
            opacity: 0.4,
            fillOpacity: 0.2
        },
        forest: {
            color: '#228b22',
            weight: 2,
            opacity: 0.5,
            fillOpacity: 0.25
        },
        medium: {
            color: '#228B22',
            weight: 2,
            opacity: 0.7,
            fillColor: '#228B22',
            fillOpacity: 0.3,
            dashArray: '4, 8'
        },
        difficult: {
            color: '#f5a623',
            weight: 3,
            opacity: 0.85,
            fillColor: '#f5a623',
            fillOpacity: 0.25,
            dashArray: '4,4'
        },
        water: {
            color: '#4682b4',
            weight: 2,
            opacity: 0.6,
            fillOpacity: 0.3
        },
        unpassable: {
            color: '#d0021b',
            weight: 3,
            opacity: 0.9,
            fillColor: '#d0021b',
            fillOpacity: 0.4
        },
        blocked: {
            color: '#c0392b',
            weight: 2,
            opacity: 0.8,
            fillColor: '#c0392b',
            fillOpacity: 0.4
        }
    };

    /**
     * Get style for a terrain type
     * @param {string} terrainType - The terrain type (road, difficult, etc.)
     * @returns {Object} Leaflet style object
     */
    function getTerrainStyle(terrainType) {
        return TERRAIN_STYLES[terrainType] || {
            color: '#cccccc',
            weight: 1,
            opacity: 0.5
        };
    }

    /**
     * Get style from a feature object
     * Handles both terrain_type and kind properties
     * @param {Object} feature - GeoJSON feature with properties
     * @returns {Object} Leaflet style object
     */
    function getStyleFromFeature(feature) {
        const kind = feature.properties?.terrain_type || feature.properties?.kind || 'normal';
        return getTerrainStyle(kind);
    }

    // Export
    window.TERRAIN_STYLES = TERRAIN_STYLES;
    window.getTerrainStyle = getTerrainStyle;
    window.getStyleFromFeature = getStyleFromFeature;

})(window);
