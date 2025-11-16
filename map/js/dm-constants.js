// DM (Dungeon Master) mode constants
// Centralized configuration for all DM features

(function(window) {
    'use strict';

    const DM_CONSTANTS = {
        // Touch event thresholds (moved to TouchEventManager, kept here for reference)
        TOUCH_DURATION_MS: 500,
        TOUCH_DISTANCE_PX: 10,

        // Terrain merge settings
        TERRAIN_MERGE_BUFFER: 0.0005, // degrees (~50m at equator)
        TERRAIN_SIMPLIFY_TOLERANCE: 0.0001, // degrees for polygon simplification

        // Map animation
        DEFAULT_ZOOM: 2.2,
        FLY_DURATION_SEC: 1.0,
        EASE_LINEARITY: 0.25,

        // Port configuration (synced with graph-builder.js)
        PORT_TO_SEA_DISTANCE_MULTIPLIER: 3,
        MAX_PORT_SEA_LINKS: 6,

        // Validation limits
        MAX_ROUTE_STOPS: 50,
        MAX_MARKER_NAME_LENGTH: 100,
        MAX_SUMMARY_LENGTH: 500,

        // Grid and terrain
        TERRAIN_GRID_SIZE: 20, // px (synced with routing.js)
        ROAD_CONNECTION_DISTANCE: 300, // px

        // Performance
        PATHFINDING_MAX_ITERATIONS: 50000,
        PATHFINDING_TIMEOUT_MS: 5000
    };

    // Export
    window.DM_CONSTANTS = DM_CONSTANTS;

})(window);
