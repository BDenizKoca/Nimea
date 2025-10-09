// map/js/routing/route-core.js - Core routing logic and path calculation

(function(window) {
    'use strict';

    let bridge = {};
    let routeUI = {};
    
    // Routing state
    let routingGraph = null;
    let isCalculatingRoute = false; // Mutex to prevent concurrent calculations

    // Sub-modules
    let graphBuilder = null;
    let pathfinding = null;
    let visualizer = null;

    /**
     * Initialize the route core module
     */
    function initRouteCore(bridgeObj, routeUIObj) {
        bridge = bridgeObj;
        routeUI = routeUIObj;
        
        // Get sub-modules
        graphBuilder = window.__nimea_graph_builder;
        pathfinding = window.__nimea_pathfinding;
        visualizer = window.__nimea_visualizer;
        
        // Initialize travel mode (default to walking)
        if (!bridge.state.travelMode) {
            bridge.state.travelMode = 'walking';
        }
        
        // Set up travel mode selector listener (use delegation since it's dynamically rendered)
        document.addEventListener('change', (e) => {
            if (e.target.id === 'travel-mode-select') {
                bridge.state.travelMode = e.target.value;
                bridge.state.travelProfile = e.target.value;
                console.log(`Travel mode changed to: ${e.target.value}`);
                if (bridge.state.route.length >= 2) {
                    recomputeRoute();
                }
            }
        });
        
        // Set up sea travel checkbox listener (also use delegation)
        document.addEventListener('change', (e) => {
            if (e.target.id === 'sea-travel-checkbox') {
                bridge.state.enableSeaTravel = !!e.target.checked;
                console.log(`Sea travel ${bridge.state.enableSeaTravel ? 'enabled' : 'disabled'}`);
                // Invalidate graph when sea travel option changes
                invalidateGraph();
                // Recompute route with new settings
                if (bridge.state.route.length >= 2) {
                    recomputeRoute();
                }
            }
        });
        
        console.log("Route core module initialized");
    }

    /**
     * Invalidates the cached routing graph.
     * Called by the DM module when terrain is updated.
     */
    function invalidateGraph() {
        routingGraph = null;
        console.log("Routing graph invalidated");
    }

    /**
     * Add marker to route and open route sidebar
     */
    function addToRoute(marker) {
        if (bridge.state.isDmMode) {
            return; // routing disabled in DM mode
        }

        bridge.state.route.push(marker);
        
        if (routeUI && routeUI.openRouteSidebar) {
            routeUI.openRouteSidebar();
        }
        
        recomputeRoute();
    }

    /**
     * Reorder route stops
     */
    function reorderRoute(fromIndex, toIndex) {
        const item = bridge.state.route.splice(fromIndex, 1)[0];
        bridge.state.route.splice(toIndex, 0, item);
        recomputeRoute();
    }

    /**
     * Remove specific route stop by index
     */
    function removeRouteIndex(idx) {
        console.log("removeRouteIndex called with index:", idx, "current route length:", bridge.state.route.length);
        if (idx >= 0 && idx < bridge.state.route.length) {
            const removedStop = bridge.state.route[idx];
            console.log("Removing stop:", removedStop.name);
            bridge.state.route.splice(idx, 1);
            console.log("New route length:", bridge.state.route.length);
            recomputeRoute();
        } else {
            console.error("Invalid route index:", idx);
        }
    }

    /**
     * Clear entire route
     */
    function clearRoute() {
        console.log("clearRoute() called - current route length:", bridge.state.route.length);
        
        if (isCalculatingRoute) {
            isCalculatingRoute = false; // Signal to stop the calculation chain
        }

        bridge.state.route = [];
        bridge.state.routeLegs = [];
        
        // Clear all route polylines - be more thorough
        if (bridge.state.routePolylines && Array.isArray(bridge.state.routePolylines)) {
            bridge.state.routePolylines.forEach(pl => {
                if (pl && bridge.map.hasLayer(pl)) {
                    bridge.map.removeLayer(pl);
                }
            });
        }
        bridge.state.routePolylines = [];
        
        // Clear main route polyline
        if (bridge.state.routePolyline) { 
            if (bridge.map.hasLayer(bridge.state.routePolyline)) {
                bridge.map.removeLayer(bridge.state.routePolyline); 
            }
            bridge.state.routePolyline = null; 
        }

        // Remove unified route line if present
        if (bridge.state.routeUnifiedPolyline) {
            if (bridge.map.hasLayer(bridge.state.routeUnifiedPolyline)) {
                bridge.map.removeLayer(bridge.state.routeUnifiedPolyline);
            }
            bridge.state.routeUnifiedPolyline = null;
        }
        
        // Comprehensive layer cleanup - remove any lingering route-related layers
        bridge.map.eachLayer(layer => {
            // Remove any polylines that might be route-related
            if (layer instanceof L.Polyline) {
                // Check if this polyline has route-related styling or is in the routePane
                const element = layer.getElement();
                if (element && (
                    element.classList.contains('route-polyline') ||
                    layer.options.pane === 'routePane' ||
                    (layer.options.className && layer.options.className.includes('route'))
                )) {
                    console.log("Removing orphaned route polyline:", layer);
                    bridge.map.removeLayer(layer);
                }
            }
        });

        // Clear all waypoints when clearing the route
        if (bridge.routingModule && bridge.routingModule.clearAllWaypoints) {
            bridge.routingModule.clearAllWaypoints();
        }

        // Clear day markers from map if present
        try {
            if (bridge.state.dayMarkerLayers) {
                bridge.state.dayMarkerLayers.forEach(m => bridge.map.removeLayer(m));
                bridge.state.dayMarkerLayers = [];
            }
        } catch(e) { console.warn('Failed clearing day markers:', e); }

        console.log("Route and waypoints cleared, updating display");
        if (routeUI && routeUI.updateRouteDisplay) {
            routeUI.updateRouteDisplay(reorderRoute);
        }
        if (visualizer && visualizer.updateRouteSummaryEmpty) {
            visualizer.updateRouteSummaryEmpty();
        }
        console.log("Route display updated - new route length:", bridge.state.route.length);
    }

    /**
     * Recompute entire route with sequential leg processing
     */
    function recomputeRoute() {
        if (isCalculatingRoute) {
            console.warn("Route calculation already in progress. Ignoring new request.");
            return;
        }
        
        // Clear existing route visualization more thoroughly
        if (bridge.state.routePolylines && Array.isArray(bridge.state.routePolylines)) {
            bridge.state.routePolylines.forEach(pl => {
                if (pl && bridge.map.hasLayer(pl)) {
                    bridge.map.removeLayer(pl);
                }
            });
        }
        bridge.state.routePolylines = [];
        bridge.state.routeLegs = [];
        
        if (bridge.state.routePolyline) { 
            if (bridge.map.hasLayer(bridge.state.routePolyline)) {
                bridge.map.removeLayer(bridge.state.routePolyline); 
            }
            bridge.state.routePolyline = null; 
        }
        
        // Clear unified polyline as well
        if (bridge.state.routeUnifiedPolyline) {
            if (bridge.map.hasLayer(bridge.state.routeUnifiedPolyline)) {
                bridge.map.removeLayer(bridge.state.routeUnifiedPolyline);
            }
            bridge.state.routeUnifiedPolyline = null;
        }
        
        if (routeUI && routeUI.updateRouteDisplay) {
            routeUI.updateRouteDisplay(reorderRoute);
        }
        
        if (bridge.state.route.length < 2) { 
            if (visualizer && visualizer.updateRouteSummaryEmpty) {
                visualizer.updateRouteSummaryEmpty();
            }
            return; 
        }

        isCalculatingRoute = true;
        if (visualizer && visualizer.updateRouteSummaryCalculating) {
            visualizer.updateRouteSummaryCalculating();
        }
        
        // Build graph if it doesn't exist
        if (!routingGraph) {
            const seaTravelEnabled = !!bridge.state.enableSeaTravel;
            routingGraph = graphBuilder.buildRoutingGraph(seaTravelEnabled);
        }

        if (!routingGraph) {
            console.error("Failed to build routing graph");
            isCalculatingRoute = false;
            return;
        }

        // Process legs sequentially 
        const processLeg = (legIndex) => {
            // If calculation was cancelled, stop.
            if (!isCalculatingRoute) {
                if (visualizer && visualizer.updateRouteSummaryEmpty) {
                    visualizer.updateRouteSummaryEmpty();
                }
                return;
            }

            if (legIndex >= bridge.state.route.length - 1) {
                // All legs are calculated
                if (visualizer && visualizer.updateRouteSummaryFromLegs) {
                    visualizer.updateRouteSummaryFromLegs();
                }
                // Render a single unified line across all legs (prevents segment gaps)
                try {
                    if (visualizer && visualizer.renderFullUnifiedRoute) {
                        visualizer.renderFullUnifiedRoute(bridge.state.routeLegs);
                    }
                } catch (e) {
                    console.warn('Unified full-route rendering failed:', e);
                }
                isCalculatingRoute = false;
                return;
            }

            const start = bridge.state.route[legIndex];
            const end = bridge.state.route[legIndex + 1];
            
            calculateLegPath(start, end, () => {
                // When this leg is done, process the next one
                processLeg(legIndex + 1);
            });
        };

        // Start processing from the first leg (index 0)
        processLeg(0);
    }

    /**
     * Calculate path for a single route leg
     */
    function calculateLegPath(start, end, onComplete) {
        const startNodeId = `marker_${start.id}`;
        const endNodeId = `marker_${end.id}`;
        
        console.log(`Calculating path from ${start.name} (${start.x}, ${start.y}) to ${end.name} (${end.x}, ${end.y})`);
        
        // Check if nodes exist in graph
        if (!routingGraph.nodes.has(startNodeId)) {
            console.error(`Start node ${startNodeId} not found in graph`);
            bridge.state.routeLegs.push({ 
                from: start, 
                to: end, 
                distanceKm: 0, 
                unreachable: true,
                error: `Start marker ${start.name} not in routing graph`
            });
            if (typeof onComplete === 'function') onComplete();
            return;
        }
        
        if (!routingGraph.nodes.has(endNodeId)) {
            console.error(`End node ${endNodeId} not found in graph`);
            bridge.state.routeLegs.push({ 
                from: start, 
                to: end, 
                distanceKm: 0, 
                unreachable: true,
                error: `End marker ${end.name} not in routing graph`
            });
            if (typeof onComplete === 'function') onComplete();
            return;
        }
        
        console.log(`Graph contains ${routingGraph.nodes.size} nodes and ${routingGraph.edges.length} edges`);
        
        // Use A* algorithm for efficient pathfinding across the hybrid graph
        const graphPath = pathfinding.findShortestPathAStar(routingGraph, startNodeId, endNodeId);
        
        if (!graphPath || graphPath.length === 0) {
            console.warn(`No path found between ${start.name} and ${end.name} - checking connectivity...`);
            
            // Debug: Check if start/end have any connections
            const startConnections = routingGraph.edges.filter(e => e.from === startNodeId || e.to === startNodeId);
            const endConnections = routingGraph.edges.filter(e => e.from === endNodeId || e.to === endNodeId);
            
            console.log(`Start node ${startNodeId} has ${startConnections.length} connections`);
            console.log(`End node ${endNodeId} has ${endConnections.length} connections`);
            
            if (startConnections.length === 0) {
                console.error(`Start marker ${start.name} has no graph connections`);
            }
            if (endConnections.length === 0) {
                console.error(`End marker ${end.name} has no graph connections`);
            }
            
            bridge.state.routeLegs.push({ 
                from: start, 
                to: end, 
                distanceKm: 0, 
                unreachable: true,
                error: `No path found - Start: ${startConnections.length} connections, End: ${endConnections.length} connections`
            });
            if (typeof onComplete === 'function') onComplete();
            return;
        }
        
        console.log(`Found path with ${graphPath.length} nodes`);
        
        // Convert path to segments and gather traversal statistics
        const pathSegments = visualizer.analyzePathSegments(graphPath, routingGraph, start, end);
        const profile = getActiveProfile();
        const traversalStats = computeTraversalStats(graphPath, routingGraph, bridge.config.kmPerPixel, profile);
        
        // Add leg to route with detailed metrics
        bridge.state.routeLegs.push({ 
            from: start, 
            to: end, 
            distanceKm: traversalStats.distanceKm,
            weightedCostKm: traversalStats.weightedCostKm,
            travelDays: traversalStats.travelDays,
            travelHours: traversalStats.travelDays * 24,
            hybrid: true,
            usesSea: traversalStats.distanceBreakdown.seaKm > 0,
            distanceBreakdown: traversalStats.distanceBreakdown,
            segments: pathSegments
        });
        
        if (typeof onComplete === 'function') onComplete();
    }

    function getActiveProfile() {
        const profiles = (bridge.config && bridge.config.profiles) || {};
        const key = bridge.state.travelMode || 'walking';
        const fallback = profiles.walking || profiles.walk || { label: 'Walking', landSpeed: 30, seaSpeed: 120 };
        const profile = profiles[key] || fallback;
        return {
            label: profile.label || key,
            landSpeed: profile.landSpeed || profile.speed || 30,
            seaSpeed: profile.seaSpeed || 120
        };
    }

    function categorizeEdge(edge) {
        const type = (edge && edge.type) ? edge.type : '';
        if (!type) return 'terrain';
        if (type.startsWith('sea')) {
            return type === 'sea_port_link' ? 'port' : 'sea';
        }
        if (type.startsWith('road')) {
            return 'road';
        }
        return 'terrain';
    }

    function computeTraversalStats(graphPath, routingGraph, kmPerPixel, profile) {
        const kmPerPx = kmPerPixel || (100 / 115);
        const stats = {
            distanceKm: 0,
            travelDays: 0,
            weightedCostKm: 0,
            distanceBreakdown: {
                roadKm: 0,
                terrainKm: 0,
                seaKm: 0,
                portKm: 0
            }
        };

        if (!Array.isArray(graphPath) || graphPath.length < 2) {
            return stats;
        }

        const landSpeed = profile.landSpeed > 0 ? profile.landSpeed : 30;
        const seaSpeed = profile.seaSpeed > 0 ? profile.seaSpeed : 120;

        for (let i = 1; i < graphPath.length; i++) {
            const fromId = graphPath[i - 1];
            const toId = graphPath[i];
            const edgeKey = `${fromId}|${toId}`;
            const edge = routingGraph.edgeMap.get(edgeKey);
            if (!edge) continue;

            const segmentDistanceKm = (edge.distance || 0) * kmPerPx;
            if (!isFinite(segmentDistanceKm) || segmentDistanceKm <= 0) continue;

            stats.distanceKm += segmentDistanceKm;

            const category = categorizeEdge(edge);
            switch (category) {
                case 'road':
                    stats.distanceBreakdown.roadKm += segmentDistanceKm;
                    break;
                case 'sea':
                    stats.distanceBreakdown.seaKm += segmentDistanceKm;
                    break;
                case 'port':
                    stats.distanceBreakdown.portKm += segmentDistanceKm;
                    break;
                default:
                    stats.distanceBreakdown.terrainKm += segmentDistanceKm;
                    break;
            }

            let edgeTimeDays = 0;
            if (category === 'sea') {
                edgeTimeDays = seaSpeed > 0 ? (segmentDistanceKm / seaSpeed) : 0;
            } else {
                const multiplier = (edge.cost !== undefined && edge.cost > 0) ? edge.cost : 1;
                edgeTimeDays = landSpeed > 0 ? (segmentDistanceKm / landSpeed) * multiplier : 0;
            }
            stats.travelDays += edgeTimeDays;
        }

        stats.weightedCostKm = pathfinding.computeGraphPathCost(graphPath, routingGraph.edgeMap, kmPerPx);
        return stats;
    }

    // Expose public functions
    window.__nimea_route_core = {
        initRouteCore,
        invalidateGraph,
        addToRoute,
        reorderRoute,
        removeRouteIndex,
        clearRoute,
        recomputeRoute
    };

})(window);
