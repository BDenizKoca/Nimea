// map/js/routing/graph-builder.js - Graph construction module

(function(window) {
    'use strict';

    // This will be set by the main routing module
    let bridge = {};
    let TERRAIN_COSTS = {};
    let TERRAIN_GRID_SIZE = 50;
    let ROAD_CONNECTION_DISTANCE = 40;
    const PORT_TO_SEA_DISTANCE_MULTIPLIER = 3;
    const MAX_PORT_SEA_LINKS = 6;
    const ROAD_ENTRY_PENALTY = 0.35;
    const ROAD_COST_MULTIPLIER = 0.4;

    // Terrain utility functions (will be imported)
    let getTerrainCostAtPoint, getTerrainCostBetweenPoints, isWaterAtPoint;
    let terrainUtils = null;

    /**
     * Initialize the graph builder with dependencies
     */
    function initGraphBuilder(bridgeObj, terrainCosts, gridSize, roadDistance, terrainUtilsModule) {
        bridge = bridgeObj;
        TERRAIN_COSTS = terrainCosts;
        TERRAIN_GRID_SIZE = gridSize;
        ROAD_CONNECTION_DISTANCE = roadDistance;
        terrainUtils = terrainUtilsModule;
        getTerrainCostAtPoint = terrainUtilsModule.getTerrainCostAtPoint;
        getTerrainCostBetweenPoints = terrainUtilsModule.getTerrainCostBetweenPoints;
        isWaterAtPoint = terrainUtilsModule.isWaterAtPoint;
    }

    /**
     * Build the complete hybrid multilayer routing graph
     */
    function buildRoutingGraph(seaTravelEnabled = false) {
        const nodes = new Map(); // nodeId -> {x, y, type, cost}
        const edges = []; // {from, to, cost, distance, type}
        const edgeMap = new Map(); // `${from}|${to}` -> edge
        const activeMarkers = getActiveRoutingMarkers();
        
        console.log(`Building hybrid multilayer routing graph... (Sea Travel: ${seaTravelEnabled ? 'ENABLED' : 'DISABLED'})`);
        
        // Build each layer of the graph
        buildRoadsLayer(nodes, edges, edgeMap);
        buildTerrainGridLayer(nodes, edges, edgeMap, seaTravelEnabled);
        buildMarkersLayer(nodes, activeMarkers);
        buildBridgeConnections(nodes, edges, edgeMap, seaTravelEnabled, activeMarkers);
        
        const graph = { nodes, edges, edgeMap };
        console.log(`Built graph with ${nodes.size} nodes and ${edges.length} edges`);
        return graph;
    }

    /**
     * Determine which markers should participate in the routing graph
     * Only currently selected route stops are connected to avoid "magnet" detours.
     */
    function getActiveRoutingMarkers() {
        if (!bridge || !bridge.state) {
            return [];
        }

        const markersById = new Map();
        if (Array.isArray(bridge.state.markers)) {
            bridge.state.markers.forEach(marker => {
                if (marker && marker.id) {
                    markersById.set(marker.id, marker);
                }
            });
        }

        const active = [];
        const seen = new Set();
        if (Array.isArray(bridge.state.route)) {
            bridge.state.route.forEach(routeEntry => {
                if (!routeEntry || !routeEntry.id || seen.has(routeEntry.id)) {
                    return;
                }
                const resolved = markersById.get(routeEntry.id) || routeEntry;
                if (typeof resolved.x === 'number' && typeof resolved.y === 'number') {
                    active.push(resolved);
                    seen.add(routeEntry.id);
                }
            });
        }

        if (!active.length) {
            console.warn('No active route markers found; marker layer will be skipped for this graph build.');
        } else {
            console.log(`Active routing markers: ${active.map(m => m.name || m.id).join(', ')}`);
        }

        return active;
    }

    /**
     * Build the roads layer - high-priority road network
     */
    function buildRoadsLayer(nodes, edges, edgeMap) {
        const roadFeatures = bridge.state.terrain.features.filter(f => f.properties.kind === 'road');
        const roadNodes = new Map(); // Track road intersections
        
        roadFeatures.forEach((roadFeature, roadIndex) => {
            if (roadFeature.geometry.type !== 'LineString') return;
            
            const coordinates = roadFeature.geometry.coordinates;
            
            // Create nodes for each point in the road
            coordinates.forEach((coord, coordIndex) => {
                const nodeId = `road_${roadIndex}_${coordIndex}`;
                nodes.set(nodeId, {
                    x: coord[0],
                    y: coord[1],
                    type: 'road_node',
                    roadIndex,
                    coordIndex
                });
                
                // Track for intersection detection
                const posKey = `${Math.round(coord[0])},${Math.round(coord[1])}`;
                if (!roadNodes.has(posKey)) {
                    roadNodes.set(posKey, []);
                }
                roadNodes.get(posKey).push(nodeId);
            });
            
            // Create edges between consecutive road points
            for (let i = 0; i < coordinates.length - 1; i++) {
                const fromId = `road_${roadIndex}_${i}`;
                const toId = `road_${roadIndex}_${i + 1}`;
                const from = coordinates[i];
                const to = coordinates[i + 1];
                
                const distance = Math.sqrt(
                    Math.pow(to[0] - from[0], 2) + 
                    Math.pow(to[1] - from[1], 2)
                );
                
                // Roads have cost = 1 (primary paths)
                const roadCost = Math.max((TERRAIN_COSTS.road || 0.7) * ROAD_COST_MULTIPLIER, 0.15);
                const fwd = { from: fromId, to: toId, cost: roadCost, distance, type: 'road' };
                const rev = { from: toId, to: fromId, cost: roadCost, distance, type: 'road' };
                edges.push(fwd, rev);
                edgeMap.set(`${fromId}|${toId}`, fwd);
                edgeMap.set(`${toId}|${fromId}`, rev);
            }
        });
        
        // Connect road intersections (where roads cross or meet)
        connectRoadIntersections(roadNodes, edges, edgeMap);
    }

    /**
     * Connect road intersections where multiple roads meet
     */
    function connectRoadIntersections(roadNodes, edges, edgeMap) {
        for (let [posKey, nodeIds] of roadNodes) {
            if (nodeIds.length > 1) {
                // Create connections between all road nodes at this position
                for (let i = 0; i < nodeIds.length; i++) {
                    for (let j = i + 1; j < nodeIds.length; j++) {
                        const fromId = nodeIds[i];
                        const toId = nodeIds[j];
                        
                        // Zero-cost transition between road networks at intersections
                        const fwd = { from: fromId, to: toId, cost: 0, distance: 0, type: 'road_intersection' };
                        const rev = { from: toId, to: fromId, cost: 0, distance: 0, type: 'road_intersection' };
                        edges.push(fwd, rev);
                        edgeMap.set(`${fromId}|${toId}`, fwd);
                        edgeMap.set(`${toId}|${fromId}`, rev);
                    }
                }
            }
        }
    }

    /**
     * Build terrain grid layer - fallback pathfinding network
     */
    function buildTerrainGridLayer(nodes, edges, edgeMap, seaTravelEnabled = false) {
        const mapBounds = getMapBounds();
        const terrainNodes = new Map();

        // Create terrain grid nodes (include all nodes, even high-cost ones)
        for (let x = mapBounds.minX; x <= mapBounds.maxX; x += TERRAIN_GRID_SIZE) {
            for (let y = mapBounds.minY; y <= mapBounds.maxY; y += TERRAIN_GRID_SIZE) {
                const nodeId = `terrain_${Math.round(x)}_${Math.round(y)}`;
                const originalCost = getTerrainCostAtPoint(x, y);

                // Determine if this is water using proper terrain feature detection
                const isWaterNode = isWaterAtPoint
                    ? isWaterAtPoint(x, y)
                    : (originalCost >= 50.0); // fallback to cost-based detection

                // If this is water and sea travel is enabled, make it navigable
                let terrainCost = originalCost;
                if (isWaterNode && seaTravelEnabled) {
                    // Sea travel: 120 km/day vs 30 km/day walking = 4x faster
                    // Cost = 0.25 (time multiplier: takes 1/4 the time)
                    terrainCost = TERRAIN_COSTS.sea;
                    console.log(`Making water node ${nodeId} navigable (cost: ${terrainCost})`);
                }

                // Add all nodes, even high-cost ones (no infinite costs anymore)
                nodes.set(nodeId, {
                    x: x,
                    y: y,
                    type: 'terrain_node',
                    terrainCost: terrainCost,
                    isWater: isWaterNode  // Based on proper water detection
                });
                terrainNodes.set(`${Math.round(x)},${Math.round(y)}`, nodeId);
            }
        }

        // Connect adjacent terrain grid nodes
        connectTerrainNodes(terrainNodes, nodes, edges, edgeMap);
    }

    /**
     * Connect adjacent terrain grid nodes
     */
    function connectTerrainNodes(terrainNodes, nodes, edges, edgeMap) {
        for (let [posKey, nodeId] of terrainNodes) {
            const [x, y] = posKey.split(',').map(Number);
            const node = nodes.get(nodeId);
            
            // Check 8-directional neighbors
            const neighbors = [
                [x + TERRAIN_GRID_SIZE, y], // right
                [x - TERRAIN_GRID_SIZE, y], // left
                [x, y + TERRAIN_GRID_SIZE], // down
                [x, y - TERRAIN_GRID_SIZE], // up
                [x + TERRAIN_GRID_SIZE, y + TERRAIN_GRID_SIZE], // diagonal
                [x - TERRAIN_GRID_SIZE, y - TERRAIN_GRID_SIZE], // diagonal
                [x + TERRAIN_GRID_SIZE, y - TERRAIN_GRID_SIZE], // diagonal
                [x - TERRAIN_GRID_SIZE, y + TERRAIN_GRID_SIZE]  // diagonal
            ];
            
            neighbors.forEach(([nx, ny]) => {
                const neighborKey = `${nx},${ny}`;
                const neighborId = terrainNodes.get(neighborKey);
                
                if (neighborId) {
                    const neighborNode = nodes.get(neighborId);
                    const distance = Math.sqrt(
                        Math.pow(nx - x, 2) + Math.pow(ny - y, 2)
                    );
                    
                    // Cost is the average of the two nodes' terrain costs
                    const avgCost = (node.terrainCost + neighborNode.terrainCost) / 2;
                    if (avgCost >= 10) {
                        return;
                    }
                    
                    const edge = {
                        from: nodeId,
                        to: neighborId,
                        cost: avgCost,
                        distance: distance,
                        type: 'terrain'
                    };
                    
                    edges.push(edge);
                    edgeMap.set(`${nodeId}|${neighborId}`, edge);
                }
            });
        }
    }

    /**
     * Build markers layer - add all map markers as nodes
     */
    function buildMarkersLayer(nodes, activeMarkers = []) {
        if (!Array.isArray(activeMarkers) || !activeMarkers.length) {
            return;
        }

        console.log(`Building markers layer with ${activeMarkers.length} active markers`);
        activeMarkers.forEach(marker => {
            const nodeId = `marker_${marker.id}`;
            console.log(`Adding marker node: ${nodeId} (${marker.name}) at (${marker.x}, ${marker.y}) isWaypoint: ${marker.isWaypoint}`);
            nodes.set(nodeId, {
                x: marker.x,
                y: marker.y,
                type: 'marker',
                markerId: marker.id,
                isWaypoint: marker.isWaypoint || false
            });
        });
        console.log(`Markers layer built with ${nodes.size} total nodes`);
    }

    /**
     * Build bridge connections - connect markers to road and terrain layers
     */
    function buildBridgeConnections(nodes, edges, edgeMap, seaTravelEnabled = false, activeMarkers = []) {
        if (!Array.isArray(activeMarkers) || !activeMarkers.length) {
            return;
        }

        console.log(`Building bridge connections for ${activeMarkers.length} markers`);
        activeMarkers.forEach(marker => {
            console.log(`Connecting marker ${marker.name} (${marker.id}) to road and terrain layers`);
            const roadInfo = connectMarkerToRoads(marker, nodes, edges, edgeMap);

            // Track if marker is actually connected to sea
            let connectedToSea = false;
            if (seaTravelEnabled) {
                const allowSea = marker.isPort === true || marker.isWaypoint === true;
                if (allowSea) {
                    connectedToSea = connectMarkerToSea(marker, nodes, edges, edgeMap, seaTravelEnabled);
                }
            }

            // Pass sea connection info to terrain connector
            connectMarkerToTerrain(marker, nodes, edges, edgeMap, roadInfo, connectedToSea);
        });
    }

    /**
     * Connect marker to nearest road network
     */
    function connectMarkerToRoads(marker, nodes, edges, edgeMap) {
        const markerNodeId = `marker_${marker.id}`;
        const markerPos = { x: marker.x, y: marker.y };
        const isWaypoint = marker.isWaypoint === true;
        const baseRadius = ROAD_CONNECTION_DISTANCE;
        const searchRadius = isWaypoint ? Math.max(baseRadius * 2.5, baseRadius + 50) : baseRadius;
        const candidates = [];
        let nearestDistance = Infinity;
        let nearestCandidate = null;
        let connectedCount = 0;

        for (let [nodeId, node] of nodes) {
            if (node.type !== 'road_node') continue;
            const distance = Math.sqrt(
                Math.pow(node.x - markerPos.x, 2) + 
                Math.pow(node.y - markerPos.y, 2)
            );
            const candidate = { nodeId, node, distance };
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestCandidate = candidate;
            }
            if (distance <= searchRadius) {
                candidates.push({ nodeId, node, distance });
            }
        }

        let snapNodeId = null;

        if (!candidates.length && nearestCandidate && nearestDistance <= searchRadius * 1.75) {
            candidates.push(nearestCandidate);
        }

        if (!candidates.length) {
            return { connectedCount, nearestDistance };
        }

        candidates
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3)
            .forEach(candidate => {
                const { nodeId, node, distance } = candidate;
                const connectionCost = getTerrainCostBetweenPoints(markerPos, node);
                const distanceRatio = Math.min(1, distance / Math.max(1, searchRadius));
                const distancePenalty = 1 + distanceRatio * (isWaypoint ? 0.35 : 0.75);
                const entryPenalty = isWaypoint ? ROAD_ENTRY_PENALTY * 0.25 : ROAD_ENTRY_PENALTY;
                const baseCost = Math.min(connectionCost, TERRAIN_COSTS.road || 0.7);
                const rawCost = (baseCost + entryPenalty) * distancePenalty;
                const scaling = isWaypoint ? 0.1 : 1;
                const bridgeCost = Math.max(isWaypoint ? 0.1 : 0.9, rawCost * scaling);
                const edgeType = isWaypoint ? 'road_bridge_waypoint' : 'road_bridge';

                const fwd = { 
                    from: markerNodeId, 
                    to: nodeId, 
                    cost: bridgeCost, 
                    distance,
                    type: edgeType
                };
                const rev = { 
                    from: nodeId, 
                    to: markerNodeId, 
                    cost: bridgeCost, 
                    distance,
                    type: edgeType
                };
                
                edges.push(fwd, rev);
                edgeMap.set(`${markerNodeId}|${nodeId}`, fwd);
                edgeMap.set(`${nodeId}|${markerNodeId}`, rev);
                connectedCount++;
            });

        if (isWaypoint && nearestCandidate && nearestDistance <= searchRadius * 1.75) {
            snapNodeId = `road_snap_${marker.id}`;
            const nearestNodeId = nearestCandidate.nodeId;
            const nearestNode = nearestCandidate.node;
            const baseRoadCost = Math.max((TERRAIN_COSTS.road || 0.7) * ROAD_COST_MULTIPLIER, 0.15);
            const snapLinkCost = Math.min(baseRoadCost, 0.12);

            if (!nodes.has(snapNodeId)) {
                nodes.set(snapNodeId, {
                    x: marker.x,
                    y: marker.y,
                    type: 'road_node',
                    synthetic: true
                });

                const snapToNearest = {
                    from: snapNodeId,
                    to: nearestNodeId,
                    cost: snapLinkCost,
                    distance: nearestDistance,
                    type: 'road_snap_link'
                };
                const nearestToSnap = {
                    from: nearestNodeId,
                    to: snapNodeId,
                    cost: snapLinkCost,
                    distance: nearestDistance,
                    type: 'road_snap_link'
                };
                edges.push(snapToNearest, nearestToSnap);
                edgeMap.set(`${snapNodeId}|${nearestNodeId}`, snapToNearest);
                edgeMap.set(`${nearestNodeId}|${snapNodeId}`, nearestToSnap);
            }

            const snapCost = Math.max(0.05, Math.min(0.18, (nearestDistance / Math.max(searchRadius, 1)) * 0.2));
            const markerToSnap = {
                from: markerNodeId,
                to: snapNodeId,
                cost: snapCost,
                distance: nearestDistance,
                type: 'road_bridge_snap'
            };
            const snapToMarker = {
                from: snapNodeId,
                to: markerNodeId,
                cost: snapCost,
                distance: nearestDistance,
                type: 'road_bridge_snap'
            };
            edges.push(markerToSnap, snapToMarker);
            edgeMap.set(`${markerNodeId}|${snapNodeId}`, markerToSnap);
            edgeMap.set(`${snapNodeId}|${markerNodeId}`, snapToMarker);
            connectedCount++;
        }

        return { connectedCount, nearestDistance, snapNodeId };
    }

    /**
     * Connect marker to terrain grid
     */
    function connectMarkerToTerrain(marker, nodes, edges, edgeMap, roadInfo = null, connectedToSea = false) {
        const markerNodeId = `marker_${marker.id}`;
        const markerPos = { x: marker.x, y: marker.y };
        const connectionsAttempted = [];
        const nearestRoadDistance = roadInfo && isFinite(roadInfo.nearestDistance) ? roadInfo.nearestDistance : Infinity;
        const roadInfluenceRadius = Math.max(ROAD_CONNECTION_DISTANCE * 2.5, ROAD_CONNECTION_DISTANCE + 50);

        // CRITICAL FIX: Only apply road preference penalty if marker is actually connected to sea
        // This prevents sea travel from affecting land-only routes
        const preferRoad = connectedToSea &&
            marker.isWaypoint === true &&
            roadInfo &&
            roadInfo.connectedCount > 0 &&
            nearestRoadDistance <= roadInfluenceRadius * 1.25;

        const addConnection = (terrainNodeId, edgeType) => {
            if (!terrainNodeId || connectionsAttempted.includes(terrainNodeId)) return;
            const terrainNode = nodes.get(terrainNodeId);
            if (!terrainNode) return;
            if (terrainNode.isWater) return;

            const distance = Math.sqrt(
                Math.pow(terrainNode.x - marker.x, 2) +
                Math.pow(terrainNode.y - marker.y, 2)
            );
            const maxDistance = TERRAIN_GRID_SIZE * 12;
            if (distance > maxDistance) return;

            const connectionCost = getTerrainCostBetweenPoints(markerPos, terrainNode);
            const penaltyMultiplier = preferRoad ? 50 : 1;
            const adjustedCost = Math.max(connectionCost * penaltyMultiplier, connectionCost);
            const fwd = {
                from: markerNodeId,
                to: terrainNodeId,
                cost: adjustedCost,
                distance,
                type: edgeType
            };
            const rev = {
                from: terrainNodeId,
                to: markerNodeId,
                cost: adjustedCost,
                distance,
                type: edgeType
            };

            edges.push(fwd, rev);
            edgeMap.set(`${markerNodeId}|${terrainNodeId}`, fwd);
            edgeMap.set(`${terrainNodeId}|${markerNodeId}`, rev);
            connectionsAttempted.push(terrainNodeId);
        };

        const gridX = Math.round(marker.x / TERRAIN_GRID_SIZE) * TERRAIN_GRID_SIZE;
        const gridY = Math.round(marker.y / TERRAIN_GRID_SIZE) * TERRAIN_GRID_SIZE;
        addConnection(`terrain_${gridX}_${gridY}`, preferRoad ? 'terrain_bridge_road_bias' : 'terrain_bridge');

        const preferredDistance = TERRAIN_GRID_SIZE * 6;
        const fallbackDistance = TERRAIN_GRID_SIZE * 12;
        const preferred = [];
        const fallback = [];

        for (let [nodeId, node] of nodes) {
            if (node.type !== 'terrain_node') continue;
            if (node.isWater) continue;

            const distance = Math.sqrt(
                Math.pow(node.x - marker.x, 2) +
                Math.pow(node.y - marker.y, 2)
            );

            if (distance <= preferredDistance) {
                preferred.push({ nodeId, distance });
            } else if (distance <= fallbackDistance) {
                fallback.push({ nodeId, distance });
            }
        }

        let candidates = preferred.length ? preferred : fallback;

        if (candidates.length) {
            const maxConnections = preferRoad ? 2 : 4;
            candidates
                .sort((a, b) => a.distance - b.distance)
                .slice(0, maxConnections)
                .forEach(candidate => {
                    const edgeType = candidate.distance <= preferredDistance ? 'terrain_bridge_backup' : 'terrain_bridge_extended';
                    addConnection(candidate.nodeId, edgeType);
                });
        }

        if (!connectionsAttempted.length) {
            console.error(`? CRITICAL: Failed to connect marker ${marker.name} to ANY terrain nodes!`);
        } else {
            console.log(`? Connected marker ${marker.name} to ${connectionsAttempted.length} terrain nodes`);
        }
    }


    /**
     * Connect marker to sea nodes
     * Returns true if successfully connected to sea, false otherwise
     */
    function connectMarkerToSea(marker, nodes, edges, edgeMap, seaTravelEnabled) {
        if (!seaTravelEnabled) return false;

        const markerNodeId = `marker_${marker.id}`;
        const markerPos = { x: marker.x, y: marker.y };
        const maxDistance = TERRAIN_GRID_SIZE * PORT_TO_SEA_DISTANCE_MULTIPLIER;
        const fallbackDistance = maxDistance * 2;
        const candidates = [];

        for (let [nodeId, node] of nodes) {
            if (node.type !== 'terrain_node' || !node.isWater) continue;
            const distance = Math.sqrt(
                Math.pow(node.x - markerPos.x, 2) +
                Math.pow(node.y - markerPos.y, 2)
            );
            if (distance <= fallbackDistance) {
                candidates.push({ nodeId, distance });
            }
        }

        if (!candidates.length) {
            console.log(`No navigable sea nodes found near ${marker.name} - not connected to sea`);
            return false; // Not connected to sea
        }

        candidates.sort((a, b) => a.distance - b.distance);
        const links = candidates.slice(0, MAX_PORT_SEA_LINKS);
        const portCost = Math.min(TERRAIN_COSTS.road || 0.7, TERRAIN_COSTS.normal || 1.0);

        links.forEach(({ nodeId, distance }) => {
            const fwd = {
                from: markerNodeId,
                to: nodeId,
                cost: portCost,
                distance,
                type: 'sea_port_link'
            };
            const rev = {
                from: nodeId,
                to: markerNodeId,
                cost: portCost,
                distance,
                type: 'sea_port_link'
            };
            edges.push(fwd, rev);
            edgeMap.set(`${markerNodeId}|${nodeId}`, fwd);
            edgeMap.set(`${nodeId}|${markerNodeId}`, rev);
        });

        console.log(`✓ Connected ${marker.name} to ${links.length} sea nodes`);
        return true; // Successfully connected to sea
    }

    /**
     * Get map bounds for terrain grid generation
     */
    function getMapBounds() {
        // Default bounds - could be enhanced to use actual map data
        return {
            minX: 0,
            maxX: 2500,
            minY: 0,
            maxY: 2500
        };
    }

    // Expose module functions
    window.__nimea_graph_builder = {
        initGraphBuilder,
        buildRoutingGraph
    };

})(window);
