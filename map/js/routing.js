// map/js/routing.js - Core routing system orchestrator

(function(window) {
    'use strict';

    // Bridge object will be initialized from main script
    let bridge = {};

    // DOM element cache to reduce repeated getElementById calls
    const domCache = {
        elements: {},
        get(id) {
            try {
                if (!this.elements[id]) {
                    this.elements[id] = document.getElementById(id);
                }
                return this.elements[id];
            } catch (error) {
                console.error(`Error accessing DOM element '${id}':`, error);
                return null;
            }
        },
        clear(id) {
            try {
                if (id) {
                    delete this.elements[id];
                } else {
                    this.elements = {};
                }
            } catch (error) {
                console.error('Error clearing DOM cache:', error);
            }
        }
    };

    // Sub-modules
    let routeCore = null;
    let routeUI = null;
    let routeDragDrop = null;
    let waypointManager = null;

    // Existing routing modules
    let graphBuilder = null;
    let pathfinding = null;
    let terrainUtils = null;
    let visualizer = null;
    let pathNaturalizer = null;

    // Configuration constants
    // Time multipliers: How much time it takes to cross terrain (lower = faster)
    const TERRAIN_COSTS = {
        road: 0.7,       // Roads are 30% faster than normal terrain
        normal: 1.0,     // Baseline travel time (open plains, etc.)
        medium: 1.5,     // 50% more time (hills, light forest)
        difficult: 2.0,  // 2x more time (mountains, dense forest)
        unpassable: 50.0, // Effectively blocked on land
        blocked: 50.0,   // Water when sea travel disabled
        sea: 0.25        // Sea travel: 120 km/day vs 30 km/day walking = 4x faster
    };

    const TERRAIN_GRID_SIZE = 25;  // Denser grid for better connectivity
    const ROAD_CONNECTION_DISTANCE = 300; // Increased range for road connections

    /**
     * Initialize routing system with all dependencies
     */
    function initRouting(map) {
        bridge = window.__nimea;
        if (!bridge) {
            console.error("Routing module requires the global bridge.");
            return;
        }

        // Initialize existing sub-modules
        graphBuilder = window.__nimea_graph_builder;
        pathfinding = window.__nimea_pathfinding;
        terrainUtils = window.__nimea_terrain_utils;
        visualizer = window.__nimea_visualizer;
        pathNaturalizer = window.__nimea_path_naturalizer;

        if (!graphBuilder || !pathfinding || !terrainUtils || !visualizer || !pathNaturalizer) {
            console.error("Routing modules not loaded. Required: graph-builder, pathfinding, terrain-utils, visualizer, path-naturalizer");
            return;
        }

        // Initialize existing modules with dependencies
        graphBuilder.initGraphBuilder(bridge, TERRAIN_COSTS, TERRAIN_GRID_SIZE, ROAD_CONNECTION_DISTANCE, terrainUtils);
        terrainUtils.initTerrainUtils(bridge, TERRAIN_COSTS);
        pathNaturalizer.initPathNaturalizer(bridge, terrainUtils);
        visualizer.initVisualizer(bridge);

        // Initialize new modular components
        routeDragDrop = window.__nimea_route_drag_drop;
        routeUI = window.__nimea_route_ui;
        routeCore = window.__nimea_route_core;
        waypointManager = window.__nimea_waypoint_manager;

        if (!routeDragDrop || !routeUI || !routeCore || !waypointManager) {
            console.error("New routing modules not loaded. Required: route-drag-drop, route-ui, route-core, waypoint-manager");
            return;
        }

        // Initialize new modules
        routeDragDrop.initRouteDragDrop(bridge, domCache);
        routeUI.initRouteUI(bridge, domCache, routeDragDrop);
        routeCore.initRouteCore(bridge, routeUI);
        waypointManager.initWaypointManager(bridge);
        
        // Set up permanent event delegation for route buttons
        routeUI.setupRouteEventDelegation();
        
        // Expose public functions on the bridge
        bridge.routingModule = {
            addToRoute: routeCore.addToRoute,
            reorderRoute: routeCore.reorderRoute,
            recomputeRoute: routeCore.recomputeRoute,
            invalidateGraph: routeCore.invalidateGraph,
            createWaypoint: waypointManager.createWaypoint,
            deleteWaypoint: waypointManager.deleteWaypoint,
            clearAllWaypoints: waypointManager.clearAllWaypoints,
            removeRouteIndex: routeCore.removeRouteIndex,
            clearRoute: routeCore.clearRoute,
            initRouting: () => { /* no-op, already initialized */ }
        };
        
        console.log("Routing system initialized with modular architecture.");
    }

    // Expose the init function to the global scope
    window.__nimea_routing_init = initRouting;

})(window);
