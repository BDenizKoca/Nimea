// map/js/routing/visualizer.js - Route visualization and UI module

(function(window) {
    'use strict';

    // This will be set by the main routing module
    let bridge = {};
    let pathNaturalizer = null;

    // Simple i18n helpers for TR/EN
    function isEnglishPage() {
        const lang = (document.documentElement.lang || '').toLowerCase();
        return lang.startsWith('en') || location.pathname.startsWith('/en');
    }
    function t(tr, en) { return isEnglishPage() ? en : tr; }

    /**
     * Initialize the visualizer with dependencies
     */
    function initVisualizer(bridgeObj) {
        bridge = bridgeObj;
        pathNaturalizer = window.__nimea_path_naturalizer;
        if (!pathNaturalizer) {
            console.warn("Path naturalizer not available - using basic path rendering");
        }
    }

    function buildNaturalizeOptions(pointCount, baseOverrides = {}) {
        const isShortPath = pointCount <= 4;
        const defaults = {
            nudgeStep: 8,
            nudgeOffset: 4,
            smoothRatio: 0.25,
            terrainSensitivity: 1.0
        };
        const adaptive = {
            nudgeStrength: isShortPath ? 0.3 : 0.8,
            smoothIterations: isShortPath ? 1 : 2
        };
        return Object.assign({}, defaults, baseOverrides, adaptive);
    }

    /**
     * Analyze path segments to distinguish between road and terrain traversal
     */
    function analyzePathSegments(pathIds, routingGraph, startMarker = null, endMarker = null) {
        console.log(`analyzePathSegments: Analyzing path with ${pathIds.length} nodes:`, pathIds);
        const segments = [];
        let currentSegment = null;
        
        for (let i = 0; i < pathIds.length; i++) {
            const nodeId = pathIds[i];
            const node = routingGraph.nodes.get(nodeId);
            if (!node) {
                console.error(`Node ${nodeId} not found in graph!`);
                continue;
            }
            
            const point = [node.y, node.x]; // Leaflet uses [lat, lng]
            const isMarkerNode = node.type === 'marker';
            console.log(`Node ${i}: ${nodeId} (${node.type}) at [${node.y}, ${node.x}]`);
            
            // Determine segment type based on next edge
            let segmentType = 'terrain';
            if (i < pathIds.length - 1) {
                const nextNodeId = pathIds[i + 1];
                const edgeKey = `${nodeId}|${nextNodeId}`;
                const edge = routingGraph.edgeMap.get(edgeKey);
                
                if (edge && (edge.type === 'road' || edge.type === 'road_intersection')) {
                    segmentType = 'road';
                } else if (edge && edge.type.includes('bridge')) {
                    if (edge.type.startsWith('terrain')) {
                        segmentType = 'terrain';
                    } else if (edge.type.startsWith('road')) {
                        segmentType = 'road';
                    } else {
                        segmentType = 'bridge';
                    }
                } else if (edge && edge.type.indexOf('sea') === 0) {
                    segmentType = 'sea';
                }
            }
            
            // Group consecutive points of the same type
            if (!currentSegment || currentSegment.type !== segmentType) {
                if (currentSegment) {
                    segments.push(currentSegment);
                }
                currentSegment = {
                    type: segmentType,
                    points: [point],
                    markerFlags: [isMarkerNode]
                };
            } else {
                currentSegment.points.push(point);
                if (!currentSegment.markerFlags) currentSegment.markerFlags = [];
                currentSegment.markerFlags.push(isMarkerNode);
            }
        }
        
        if (currentSegment) {
            segments.push(currentSegment);
        }
        
        // CRITICAL FIX: Ensure path connects properly to both start and end markers
        if (pathIds.length > 0 && segments.length > 0) {
            // Fix starting point
            const firstNodeId = pathIds[0];
            const firstNode = routingGraph.nodes.get(firstNodeId);
            if (firstNode && firstNode.type === 'marker') {
                const firstSegment = segments[0];
                firstSegment.points[0] = [firstNode.y, firstNode.x];
                if (!firstSegment.markerFlags) firstSegment.markerFlags = [];
                firstSegment.markerFlags[0] = true;
                console.log(`Fixed path start to marker position: [${firstNode.y}, ${firstNode.x}]`);
            } else if (startMarker) {
                const firstSegment = segments[0];
                firstSegment.points.unshift([startMarker.y, startMarker.x]);
                if (!firstSegment.markerFlags) firstSegment.markerFlags = [];
                firstSegment.markerFlags.unshift(true);
                console.log(`Extended path from provided start marker: [${startMarker.y}, ${startMarker.x}]`);
            }
        }
        
        // CRITICAL FIX: Ensure the path actually reaches destination markers
        // If the last node is not a marker but the path should end at a marker,
        // extend the path to the actual marker position
        if (pathIds.length > 0) {
            const lastNodeId = pathIds[pathIds.length - 1];
            const lastNode = routingGraph.nodes.get(lastNodeId);
            
            console.log(`Last node in path: ${lastNodeId} (${lastNode?.type}) at [${lastNode?.y}, ${lastNode?.x}]`);
            
            // Check if this is supposed to end at a marker but doesn't
            if (lastNode && lastNode.type === 'marker') {
                // The path already ends at the marker node, so coordinates should be correct
                // But let's double-check the last segment ends at the exact marker position
                if (segments.length > 0) {
                    const lastSegment = segments[segments.length - 1];
                    const lastPoint = lastSegment.points[lastSegment.points.length - 1];
                    
                    // Always force the endpoint to match the marker position exactly
                    lastSegment.points[lastSegment.points.length - 1] = [lastNode.y, lastNode.x];
                    if (!lastSegment.markerFlags) lastSegment.markerFlags = [];
                    lastSegment.markerFlags[lastSegment.markerFlags.length - 1] = true;
                    console.log(`Fixed path endpoint to marker position: [${lastNode.y}, ${lastNode.x}]`);
                }
            } else {
                console.warn(`Path does not end at a marker node! Last node type: ${lastNode?.type}`);
                
                // If the path doesn't end at a marker, use provided endMarker if available
                if (endMarker && segments.length > 0) {
                    const lastSegment = segments[segments.length - 1];
                    lastSegment.points.push([endMarker.y, endMarker.x]);
                    if (!lastSegment.markerFlags) lastSegment.markerFlags = [];
                    lastSegment.markerFlags.push(true);
                    console.log(`Extended path to provided destination marker: [${endMarker.y}, ${endMarker.x}]`);
                }
            }
        }
        
        console.log(`analyzePathSegments: Generated ${segments.length} segments for visualization`);
        segments.forEach((seg, idx) => {
            console.log(`  Segment ${idx}: type=${seg.type}, points=${seg.points?.length || 0}`);
        });

        const sanitizedSegments = [];
        segments.forEach(segment => {
            const dedupedPoints = [];
            const dedupedFlags = [];

            if (segment.points && segment.points.length) {
                segment.points.forEach((pt, idx) => {
                    const last = dedupedPoints.length ? dedupedPoints[dedupedPoints.length - 1] : null;
                    const flag = segment.markerFlags ? segment.markerFlags[idx] : false;
                    if (last && last[0] === pt[0] && last[1] === pt[1]) {
                        if (flag && dedupedFlags.length) {
                            dedupedFlags[dedupedFlags.length - 1] = true;
                        }
                        return;
                    }
                    dedupedPoints.push(pt);
                    dedupedFlags.push(flag);
                });
            }

            if (dedupedPoints.length >= 2) {
                sanitizedSegments.push({
                    type: segment.type,
                    points: dedupedPoints,
                    markerFlags: dedupedFlags
                });
            }
        });

        if (sanitizedSegments.length) {
            console.log(`analyzePathSegments: Returning ${sanitizedSegments.length} sanitized segments`);
            sanitizedSegments.forEach((seg, idx) => {
                console.log(`  Sanitized segment ${idx}: type=${seg.type}, points=${seg.points?.length || 0}`);
            });
            return sanitizedSegments;
        }

        console.log(`analyzePathSegments: No sanitization needed, returning ${segments.length} original segments`);
        return segments;
    }

    /**
     * Render hybrid path with different styles for different segment types
     */
    function renderHybridPath(segments) {
        // Option 1: Unified blue route line only (recommended for cleaner look)
        renderUnifiedRouteLine(segments);
        
        // Option 2: Detailed segments on top (uncomment if you want detailed segment visualization)
        /* 
        segments.forEach(segment => {
            if (segment.points.length < 2) return;
            
            let style;
            switch (segment.type) {
                case 'road':
                    style = { 
                        color: '#2563eb', // Blue for roads
                        weight: 4, 
                        opacity: 0.9,
                        pane: 'routePane'
                    };
                    break;
                case 'terrain':
                    style = { 
                        color: '#dc2626', // Red for terrain traversal
                        weight: 3, 
                const isEnglish = ((document.documentElement.lang || '').toLowerCase().startsWith('en')) || location.pathname.startsWith('/en');
                        dashArray: '8, 8', // Dashed for off-road
                        pane: 'routePane'
                    };
                    break;
                const daily = computeDailyBreakdown(bridge.state.routeLegs, kmPerDay);
                    style = { 
                        color: '#7c3aed', // Purple for bridges
                        weight: 3, 
                        opacity: 0.7,
                        dashArray: '4, 4',
                        pane: 'routePane'
                    };
                    break;
                default:
                    style = { 
                        color: '#6b7280', // Gray fallback
                        weight: 2, 
                        opacity: 0.6,
                        pane: 'routePane'
                    };
            }
            
            const polyline = L.polyline(segment.points, style).addTo(bridge.map);
            bridge.state.routePolylines.push(polyline);
        });
        */
    }

    /**
     * Render a unified smooth blue route line connecting all segments
     */
    function renderUnifiedRouteLine(segments) {
        if (!segments || segments.length === 0) {
            console.warn('renderUnifiedRouteLine: No segments provided');
            return;
        }

        const terrainOnly = segments.every(segment => segment.type === 'terrain');
        const bridgeOnly = segments.every(segment => segment.type === 'bridge');

        console.log(`renderUnifiedRouteLine: ${segments.length} segments, terrainOnly=${terrainOnly}, bridgeOnly=${bridgeOnly}`);

        // Collect all points from all segments to create a continuous path
        const allPoints = [];
        const markerFlags = [];

        segments.forEach((segment, index) => {
            if (!segment.points || segment.points.length === 0) {
                console.warn(`Segment ${index} has no points`);
                return;
            }

            // For subsequent segments, skip first point only if segment has more than 1 point
            // and the first point matches the last point we already have
            let pointsToAdd = segment.points;
            let flagsSource = segment.markerFlags || new Array(segment.points.length).fill(false);
            let flagsToAdd = flagsSource;

            if (index > 0 && segment.points.length > 1) {
                // Check if first point duplicates the last point we have
                const lastPoint = allPoints.length ? allPoints[allPoints.length - 1] : null;
                if (lastPoint &&
                    lastPoint[0] === segment.points[0][0] &&
                    lastPoint[1] === segment.points[0][1]) {
                    // Skip the duplicate first point
                    pointsToAdd = segment.points.slice(1);
                    flagsToAdd = flagsSource.slice(1);
                }
            }

            for (let i = 0; i < pointsToAdd.length; i++) {
                const point = pointsToAdd[i];
                const flag = flagsToAdd[i] ?? false;
                const lastPoint = allPoints.length ? allPoints[allPoints.length - 1] : null;
                if (lastPoint && lastPoint[0] === point[0] && lastPoint[1] === point[1]) {
                    if (flag && !markerFlags[markerFlags.length - 1]) {
                        markerFlags[markerFlags.length - 1] = true;
                    }
                    continue;
                }
                allPoints.push(point);
                markerFlags.push(flag);
            }
        });

        if (markerFlags.length !== allPoints.length) {
            while (markerFlags.length < allPoints.length) markerFlags.push(false);
        }

        if (allPoints.length < 2) {
            console.warn(`renderUnifiedRouteLine: Insufficient points (${allPoints.length}), cannot render`);
            return;
        }

        console.log(`renderUnifiedRouteLine: Collected ${allPoints.length} points from segments`);

        const shouldNaturalize = pathNaturalizer && !terrainOnly && !bridgeOnly;

        console.log(`renderUnifiedRouteLine: shouldNaturalize=${shouldNaturalize}`);

        // Convert Leaflet [lat, lng] format to [x, y] for naturalization when needed
        const coordinatesForNaturalization = shouldNaturalize
            ? allPoints.map(point => [point[1], point[0]])
            : [];

        let finalPoints = allPoints; // Default to original points

        // Apply path naturalization if available and the path isn't pure terrain
        if (shouldNaturalize) {
            try {
                const anchorSet = new Set([0, coordinatesForNaturalization.length - 1]);
                markerFlags.forEach((flag, idx) => {
                    if (flag) anchorSet.add(idx);
                });
                const anchors = Array.from(anchorSet).sort((a, b) => a - b);

                let combined = [];
                for (let i = 0; i < anchors.length - 1; i++) {
                    const startIdx = anchors[i];
                    const endIdx = anchors[i + 1];
                    if (endIdx <= startIdx) continue;
                    const slice = coordinatesForNaturalization.slice(startIdx, endIdx + 1);
                    let processedSlice = slice;
                    if (slice.length > 1) {
                        const sliceOptions = buildNaturalizeOptions(slice.length);
                        processedSlice = pathNaturalizer.naturalizePath(
                            slice,
                            null,
                            sliceOptions
                        );
                    }
                    if (combined.length) {
                        processedSlice = processedSlice.slice(1);
                    }
                    combined.push(...processedSlice);
                }

                const naturalizedCoords = combined.length ? combined : coordinatesForNaturalization;

                // Convert back to Leaflet format [lat, lng]
                finalPoints = pathNaturalizer.coordinatesToLeafletFormat(naturalizedCoords);

                console.log(`Naturalized path: ${allPoints.length} -> ${finalPoints.length} points`);
                if (!finalPoints || finalPoints.length < 2) {
                    console.warn('Naturalization produced insufficient points, reverting to original path');
                    finalPoints = allPoints;
                }
            } catch (error) {
                console.warn("Path naturalization failed, using original path:", error);
                finalPoints = allPoints;
            }
        }

        // Create a unified blue route line with natural curves
        const unifiedStyle = {
            color: '#1e3a8a', // Slightly deeper blue
            weight: 3,        // Thinner per user request
            opacity: 0.85,
            pane: 'routePane',
            className: 'unified-route-line',
            smoothFactor: 1.0,
            lineCap: 'round',
            lineJoin: 'round'
        };

        // Replace existing polyline if present
        if (bridge.state.routeUnifiedPolyline) {
            if (bridge.map.hasLayer(bridge.state.routeUnifiedPolyline)) {
                bridge.map.removeLayer(bridge.state.routeUnifiedPolyline);
            }
            bridge.state.routeUnifiedPolyline = null;
        }

        console.log(`renderUnifiedRouteLine: Creating polyline with ${finalPoints.length} points`);
        console.log(`First point: [${finalPoints[0][0]}, ${finalPoints[0][1]}]`);
        console.log(`Last point: [${finalPoints[finalPoints.length-1][0]}, ${finalPoints[finalPoints.length-1][1]}]`);

        const unifiedPolyline = L.polyline(finalPoints, unifiedStyle).addTo(bridge.map);
        bridge.state.routeUnifiedPolyline = unifiedPolyline;
        console.log('renderUnifiedRouteLine: Polyline added to map successfully');
    }

    function renderTerrainOnlyPolyline(segments) {
        if (!segments || !segments.length) return;

        const mergedPoints = [];
        segments.forEach((segment, index) => {
            if (!segment.points || segment.points.length === 0) return;
            const section = index === 0 ? segment.points : segment.points.slice(1);
            mergedPoints.push(...section);
        });

        if (mergedPoints.length < 2) return;

        if (bridge.state.routeUnifiedPolyline) {
            if (bridge.map.hasLayer(bridge.state.routeUnifiedPolyline)) {
                bridge.map.removeLayer(bridge.state.routeUnifiedPolyline);
            }
            bridge.state.routeUnifiedPolyline = null;
        }

        const style = {
            color: '#1e3a8a',
            weight: 3,
            opacity: 0.85,
            pane: 'routePane',
            className: 'terrain-route-line',
            smoothFactor: 1
        };

        console.log(`Rendering terrain-only leg with ${mergedPoints.length} points`);
        const polyline = L.polyline(mergedPoints, style).addTo(bridge.map);
        bridge.state.routeUnifiedPolyline = polyline;
    }

    /**
     * Render a single unified route spanning all legs (post-Ayak computation) with gentle waviness.
     * Uses the already computed Ayak segments to collect original node sequences.
     */
    function renderFullUnifiedRoute(routeLegs) {
        if (!routeLegs || !routeLegs.length) return;

        // Gather all segment points in Leaflet [lat,lng]
        const rawPoints = [];
        const rawFlags = [];
        routeLegs.forEach((leg, li) => {
            if (!leg.segments) return;
            leg.segments.forEach((segment, si) => {
                if (!segment.points || segment.points.length === 0) return;

                // For subsequent segments, skip first point only if segment has more than 1 point
                // and the first point matches the last point we already have
                let pointsToAdd = segment.points;
                let flagsSource = segment.markerFlags || new Array(segment.points.length).fill(false);
                let flagsToAdd = flagsSource;

                if (rawPoints.length > 0 && segment.points.length > 1) {
                    // Check if first point duplicates the last point we have
                    const lastPoint = rawPoints[rawPoints.length - 1];
                    if (lastPoint &&
                        lastPoint[0] === segment.points[0][0] &&
                        lastPoint[1] === segment.points[0][1]) {
                        // Skip the duplicate first point
                        pointsToAdd = segment.points.slice(1);
                        flagsToAdd = flagsSource.slice(1);
                    }
                }

                rawPoints.push(...pointsToAdd);
                rawFlags.push(...flagsToAdd);
            });
        });
        if (rawFlags.length !== rawPoints.length) {
            while (rawFlags.length < rawPoints.length) rawFlags.push(false);
        }

        const points = [];
        const markerFlags = [];
        for (let i = 0; i < rawPoints.length; i++) {
            const pt = rawPoints[i];
            const flag = rawFlags[i] || false;
            const last = points.length ? points[points.length - 1] : null;
            if (last && last[0] === pt[0] && last[1] === pt[1]) {
                if (flag && markerFlags.length) {
                    markerFlags[markerFlags.length - 1] = true;
                }
                continue;
            }
            points.push(pt);
            markerFlags.push(flag);
        }

        if (points.length < 2) return;

        // Convert to [x,y] for optional naturalization (reuse existing naturalize pipeline)
        let processed = points.map(p => [p[1], p[0]]);
        const anchorSetFull = new Set([0, processed.length - 1]);
        markerFlags.forEach((flag, idx) => {
            if (flag) anchorSetFull.add(idx);
        });
        const anchors = Array.from(anchorSetFull).sort((a, b) => a - b);
        let combinedAnchors = [];

        if (pathNaturalizer) {
            try {
                let combined = [];
                for (let i = 0; i < anchors.length - 1; i++) {
                    const startIdx = anchors[i];
                    const endIdx = anchors[i + 1];
                    if (endIdx <= startIdx) continue;
                    const slice = processed.slice(startIdx, endIdx + 1);
                    let processedSlice = slice;
                    if (slice.length > 1) {
                        const sliceOptions = buildNaturalizeOptions(slice.length, {
                            nudgeStep: 10,
                            nudgeOffset: 5,
                            smoothRatio: 0.22,
                            terrainSensitivity: 0.8
                        });
                        processedSlice = pathNaturalizer.naturalizePath(processedSlice, null, sliceOptions);
                    }
                    if (combined.length) {
                        processedSlice = processedSlice.slice(1);
                    } else {
                        combinedAnchors.push(0);
                    }
                    const prevLength = combined.length;
                    combined.push(...processedSlice);
                    combinedAnchors.push(combined.length - 1);
                }
                if (combined.length) {
                    processed = combined;
                }
            } catch (e) {
                console.warn('Naturalization in unified route failed, falling back to raw:', e);
            }
        }

        if (!combinedAnchors.length) {
            combinedAnchors = Array.from(anchorSetFull);
        }
        const lockedForWave = Array.from(new Set(combinedAnchors)).sort((a, b) => a - b);

        const wavy = applyWaviness(processed, 6, 3, lockedForWave); // wavelength px, amplitude px
        let leafletPts = pathNaturalizer ? pathNaturalizer.coordinatesToLeafletFormat(wavy) : wavy.map(c => [c[1], c[0]]);

        if (!leafletPts || leafletPts.length < 2) {
            console.warn('Unified route waviness produced insufficient points, reverting to raw polyline');
            leafletPts = points;
        }

        if (!leafletPts || leafletPts.length < 2) {
            console.warn('Unified route fallback still insufficient points, skipping render');
            return;
        }

        // HARD SNAP: Ensure the full unified route starts/ends exactly at the current route's first/last markers
        if (bridge && bridge.state && Array.isArray(bridge.state.route) && bridge.state.route.length >= 2) {
            const startStop = bridge.state.route[0];
            const endStop = bridge.state.route[bridge.state.route.length - 1];
            if (startStop && endStop) {
                leafletPts[0] = [startStop.y, startStop.x];
                leafletPts[leafletPts.length - 1] = [endStop.y, endStop.x];
                console.log('Snapped full unified route endpoints to markers:', leafletPts[0], leafletPts[leafletPts.length - 1]);
            }
        }

        // Render using same unified style (reuse function but here direct to map)
        if (bridge.state.routeUnifiedPolyline) {
            if (bridge.map.hasLayer(bridge.state.routeUnifiedPolyline)) {
                bridge.map.removeLayer(bridge.state.routeUnifiedPolyline);
            }
            bridge.state.routeUnifiedPolyline = null;
        }
        const unifiedPolyline = L.polyline(leafletPts, {
            color: '#1e3a8a',
            weight: 3,
            opacity: 0.85,
            pane: 'routePane',
            className: 'unified-route-line',
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(bridge.map);
        bridge.state.routeUnifiedPolyline = unifiedPolyline;
    }

    /**
     * Apply a subtle waviness to a polyline by offsetting points along perpendicular directions.
     * amplitudePx: maximum perpendicular displacement
     * wavelengthPx: distance over which wave completes one cycle
     */
    function applyWaviness(points, wavelengthPx = 8, amplitudePx = 2, lockedIndices = []) {
        if (!points || points.length < 3) return points;
        const lockedSet = Array.isArray(lockedIndices) ? new Set(lockedIndices) : null;
        let total = 0;
        const out = [points[0]];
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const cur = points[i];
            const next = points[i + 1];
            const dx = cur[0] - prev[0];
            const dy = cur[1] - prev[1];
            const segLen = Math.sqrt(dx*dx + dy*dy) || 1;
            total += segLen;
            if (lockedSet && lockedSet.has(i)) {
                out.push([cur[0], cur[1]]);
                continue;
            }
            // Unit direction
            const ux = dx / segLen;
            const uy = dy / segLen;
            // Perpendicular
            const px = -uy;
            const py = ux;
            const phase = (2 * Math.PI * (total / wavelengthPx));
            // Taper amplitude near endpoints
            const t = i / (points.length - 1);
            const taper = Math.sin(Math.PI * t); // 0 at ends, 1 mid
            const offset = Math.sin(phase) * amplitudePx * taper;
            out.push([cur[0] + px * offset, cur[1] + py * offset]);
        }
        out.push(points[points.length - 1]);
        return out;
    }

    function computeSegmentDistance(points) {
        if (!points || points.length < 2) return 0;
        
        let totalDistancePx = 0;
        for (let i = 1; i < points.length; i++) {
            const dx = points[i][1] - points[i-1][1]; // x coordinates
            const dy = points[i][0] - points[i-1][0]; // y coordinates (lat)
            totalDistancePx += Math.sqrt(dx * dx + dy * dy);
        }
        
        return totalDistancePx * bridge.config.kmPerPixel;
    }

    /**
     * Generate comprehensive route summary with composition analysis
     * NOTE: All displayed distances are ACTUAL physical distances, never weighted costs!
     * Weighted costs (distance × terrain_cost) are used internally for pathfinding only.
     */
    function updateRouteSummaryFromLegs() {
        const summaryDiv = document.getElementById("route-summary");
        if (!summaryDiv) return;
        if (!bridge.state.routeLegs.length) {
            updateRouteSummaryEmpty();
            return;
        }

        const profiles = (bridge.config && bridge.config.profiles) || {};
        const defaultProfile = profiles.walking || profiles.walk || { landSpeed: 30, seaSpeed: 120, label: "Walking" };
        const activeProfileKey = bridge.state.travelProfile || bridge.state.travelMode || "walking";
        const activeProfile = profiles[activeProfileKey] || defaultProfile;
        bridge.state.travelProfile = activeProfileKey;

        const totalKm = bridge.state.routeLegs.reduce((sum, leg) => sum + (leg.distanceKm || 0), 0);
        const totalDays = bridge.state.routeLegs.reduce((sum, leg) => sum + (leg.travelDays || 0), 0);
        const hasUnreachable = bridge.state.routeLegs.some(leg => leg.unreachable);

        const breakdown = bridge.state.routeLegs.reduce((acc, leg) => {
            const legBreakdown = leg.distanceBreakdown || {};
            acc.road += legBreakdown.roadKm || 0;
            acc.terrain += legBreakdown.terrainKm || 0;
            acc.sea += legBreakdown.seaKm || 0;
            acc.port += legBreakdown.portKm || 0;
            return acc;
        }, { road: 0, terrain: 0, sea: 0, port: 0 });

        const effectiveTerrainKm = breakdown.terrain + breakdown.port;
        const compositionTotal = breakdown.road + effectiveTerrainKm + breakdown.sea;
        const percent = (value) => compositionTotal > 0 ? Math.round((value / compositionTotal) * 100) : 0;

        const legsHtml = bridge.state.routeLegs.map((leg, idx) => {
            let legInfo = `${t("Ayak", "Leg")} ${idx + 1}: ${leg.from.name} -> ${leg.to.name}: ${leg.distanceKm.toFixed(2)} km`;
            if (leg.travelDays) {
                legInfo += ` <span class="leg-time">(${formatDuration(leg.travelDays)})</span>`;
            }
            if (leg.unreachable) {
                legInfo += ` <span class="route-status blocked">${t("ENGELLENDI!", "BLOCKED!")}</span>`;
                if (leg.error) {
                    legInfo += `<br><small class="route-error">${t("Hata", "Error")}: ${leg.error}</small>`;
                }
            } else if (leg.usesSea) {
                legInfo += ` <span class="route-status hybrid">${t("deniz gecisi", "sea leg")}</span>`;
            }
            return `<li>${legInfo}</li>`;
        }).join('');

        let alertsHtml = "";
        if (hasUnreachable) {
            alertsHtml += `<div class="route-alert warning">⚠️ ${t("Bazi hedefler arazi engelleri nedeniyle ulasilamaz!", "Some destinations are unreachable due to terrain obstacles!")}</div>`;
        } else if (effectiveTerrainKm > breakdown.road && effectiveTerrainKm > 0) {
            alertsHtml += `<div class="route-alert info">ℹ️ ${t("Rota agirlikli olarak arazi disi yollari kullanir (daha yavas seyahat)", "The route is mostly off-road (slower travel)")}</div>`;
        } else if (breakdown.sea > 0) {
            alertsHtml += `<div class="route-alert info">🌊 ${t("Rota deniz yolculugu iceriyor", "Route includes sea travel")}</div>`;
        }

        const compositionHtml = `
            <div class="route-composition">
                <h4>${t("Rota Bilesimi", "Route Composition")}</h4>
                <div class="composition-item road">
                    <span class="composition-color" style="background-color: #2563eb;"></span>
                    ${t("Yollar", "Roads")}: ${breakdown.road.toFixed(1)} km (${percent(breakdown.road)}%)
                </div>
                <div class="composition-item terrain">
                    <span class="composition-color" style="background-color: #dc2626;"></span>
                    ${t("Arazi", "Terrain")}: ${effectiveTerrainKm.toFixed(1)} km (${percent(effectiveTerrainKm)}%)
                </div>
                ${breakdown.sea > 0 ? `
                <div class="composition-item bridge">
                    <span class="composition-color" style="background-color: #0f766e;"></span>
                    ${t("Deniz", "Sea")}: ${breakdown.sea.toFixed(1)} km (${percent(breakdown.sea)}%)
                </div>` : ''}
            </div>
        `;

        const totalDurationText = formatDuration(totalDays);
        const landSpeed = activeProfile.landSpeed || defaultProfile.landSpeed;
        const daily = computeDailyBreakdown(bridge.state.routeLegs, landSpeed);

        summaryDiv.innerHTML = `
            <h3>${t("Hibrit Rota Ozeti", "Hybrid Route Summary")}</h3>
            ${alertsHtml}
            <div class="route-totals">
                <p><strong>${t("Toplam Mesafe", "Total Distance")}:</strong> ${totalKm.toFixed(2)} km</p>
                <p><strong>${t("Tahmini Sure", "Estimated Duration")}:</strong> ${totalDurationText}</p>
                ${compositionHtml}
            </div>
            <details id="advanced-travel" class="advanced-travel">
                <summary>${t("Gelismis", "Advanced")}</summary>
                <div class="travel-profile">
                    <span class="profile-info">${t("Gunluk mesafe isaretcilerini gosterir", "Shows daily distance markers")} (${activeProfile.label || capitalize(activeProfileKey)}: ${landSpeed} ${t("km/gun", "km/day")})</span>
                </div>
            </details>
            <div class="route-legs">
                <h4>${t("Rota Ayaklari", "Route Legs")}</h4>
                <ul>${legsHtml}</ul>
            </div>
            <div class="route-share">
                <button id="copy-route-link" class="wiki-link">${t("Rota Baglantisini Kopyala", "Copy Route Link")}</button>
            </div>
        `;

        const copyBtn = document.getElementById('copy-route-link');
        if(copyBtn && window.__nimea_route_share){
            copyBtn.addEventListener('click', () => window.__nimea_route_share.copyShareLink());
        }

        ensureRoutingStyles();

        const adv = document.getElementById('advanced-travel');
        if (adv) {
            const updateAdv = () => {
                if (adv.open) {
                    try {
                        // Use the current travel mode's speed for day markers
                        const currentProfile = profiles[bridge.state.travelProfile || activeProfileKey] || activeProfile;
                        const currentSpeed = currentProfile.landSpeed || defaultProfile.landSpeed;
                        const breakdown = computeDailyBreakdown(bridge.state.routeLegs, currentSpeed);
                        renderDayMarkers(breakdown, t);
                    } catch (e) { console.warn('Failed to render day markers:', e); }
                } else {
                    clearDayMarkers();
                }
            };
            adv.addEventListener('toggle', updateAdv);
            adv.addEventListener('click', (ev) => {
                const path = ev.composedPath ? ev.composedPath() : [];
                const clickedSummary = path.find && path.find(el => el && el.tagName === 'SUMMARY');
                if (!clickedSummary) {
                    ev.stopPropagation();
                }
            });
            updateAdv();
        }
    }


    /**
     * Update route summary for calculating state
     */
    function updateRouteSummaryCalculating() {
        const summaryDiv = document.getElementById('route-summary');
        if (!summaryDiv) return;

        const loadingHtml = `
            <div style="padding: 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                <div style="margin-bottom: 15px;">
                    <div class="route-loading-spinner" style="
                        display: inline-block;
                        width: 40px;
                        height: 40px;
                        border: 4px solid rgba(255,255,255,0.3);
                        border-top-color: white;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    "></div>
                </div>
                <p style="margin: 0; font-size: 16px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                    ${t('Rota hesaplanıyor...', 'Calculating route...')}
                </p>
                <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.9;">
                    ${t('Lütfen bekleyin', 'Please wait')}
                </p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        summaryDiv.innerHTML = loadingHtml;
    }

    /**
     * Update route summary for empty state
     */
    function updateRouteSummaryEmpty() {
        const summaryDiv = document.getElementById('route-summary');
        if (!summaryDiv) return;
        if (!bridge.state.route.length) { 
            summaryDiv.innerHTML = `<p>${t('Henüz rota tanımlanmadı. Bir işaretçi ekleyin.', 'No route yet. Add a marker.')}</p>`; 
            return; 
        }
        if (bridge.state.route.length === 1) { 
            summaryDiv.innerHTML = `<p>${t('Rota hesaplamak için ikinci bir durak ekleyin.', 'Add a second stop to calculate a route.')}</p>`; 
            return; 
        }
    }

    /**
     * Ensure routing styles are added to the document
     */
    function ensureRoutingStyles() {
        if (!document.getElementById('hybrid-routing-styles')) {
            const style = document.createElement('style');
            style.id = 'hybrid-routing-styles';
            style.textContent = `
                .route-alert { padding: 8px 12px; margin: 8px 0; border-radius: 4px; font-size: 14px; }
                .route-alert.warning { background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; }
                .route-alert.info { background: #dbeafe; border: 1px solid #3b82f6; color: #1e40af; }
                .route-status { font-size: 11px; padding: 2px 6px; border-radius: 3px; color: white; }
                .route-status.blocked { background: #dc2626; }
                .route-status.hybrid { background: #059669; }
                .route-status.terrain { background: #d97706; }
                .route-composition { margin: 10px 0; }
                .composition-item { display: flex; align-items: center; margin: 4px 0; font-size: 13px; }
                .composition-color { width: 12px; height: 12px; margin-right: 8px; border-radius: 2px; }
                .route-totals, .route-legs, .travel-times { margin: 12px 0; }
                .travel-time-item { margin: 4px 0; }
                .travel-time-item small { color: #666; display: block; margin-left: 20px; }
                .advanced-travel { margin: 10px 0; }
                .advanced-travel > summary { cursor: pointer; font-weight: 600; }
                .travel-profile { padding: 10px 0; }
                .profile-info { font-size: 13px; color: #666; font-style: italic; }
                .profile-note { font-size: 12px; color: #666; }
            `;
            document.head.appendChild(style);
        }
    }

    // Compute daily distances and waypoints along the unified route legs
    function computeDailyBreakdown(routeLegs, kmPerDay) {
        const days = [];
        let remaining = kmPerDay;
        let day = 1;
        let cursor = 0; // km progressed along full route
        const totalKm = routeLegs.reduce((a,l)=>a + (l.distanceKm||0), 0);
        const dayMarkers = [];

        for (let i = 0; i < routeLegs.length; i++) {
            const leg = routeLegs[i];
            let legKmLeft = leg.distanceKm || 0;
            while (legKmLeft > 0) {
                if (remaining >= legKmLeft) {
                    // Finish this leg within the current day
                    cursor += legKmLeft;
                    const consumed = legKmLeft;
                    days.push({ day, distance: consumed, from: leg.from, to: leg.to });
                    remaining -= consumed;
                    legKmLeft = 0;
                    // If the day is exactly filled, reset remaining and increment day
                    if (remaining <= 0.0001) { day++; remaining = kmPerDay; }
                } else {
                    // We stop in the middle of this leg today
                    cursor += remaining;
                    days.push({ day, distance: remaining, from: leg.from, to: null });
                    dayMarkers.push({ day, legIndex: i, kmIntoLeg: (leg.distanceKm - legKmLeft) + remaining, leg });
                    day++;
                    legKmLeft -= remaining;
                    remaining = kmPerDay;
                }
            }
        }

        // Create day markers using proportional distances along the polyline
        const poly = bridge.state.routeUnifiedPolyline;
        const polylines = (poly && typeof poly.getLatLngs === 'function' && poly.getLatLngs()) || [];
        const points = Array.isArray(polylines[0]) ? polylines[0] : polylines; // Leaflet may nest
        if (!points || points.length < 2) {
            // No polyline yet; skip markers this pass
            bridge.state.dayMarkers = [];
            return { days, markers: [] };
        }
        const cumUnits = [0];
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].lng - points[i-1].lng;
            const dy = points[i].lat - points[i-1].lat;
            const segUnits = Math.sqrt(dx*dx + dy*dy); // arbitrary units; we use fractions, not km
            cumUnits.push(cumUnits[cumUnits.length - 1] + segUnits);
        }
        const totalUnits = cumUnits[cumUnits.length - 1] || 0;

        const markers = [];
        const fullDays = Math.floor(totalKm / kmPerDay);
        for (let d = 1; d <= fullDays; d++) {
            const frac = (d * kmPerDay) / totalKm; // 0..1
            const targetUnits = frac * totalUnits;
            // find segment where cumulative surpasses targetUnits
            let idx = cumUnits.findIndex(u => u >= targetUnits);
            if (idx <= 0) idx = 1; // ensure valid segment
            const prevU = cumUnits[idx - 1];
            const segU = (cumUnits[idx] - prevU) || 1e-6;
            const t = (targetUnits - prevU) / segU;
            const a = points[idx - 1] || points[0];
            const b = points[idx] || points[points.length - 1] || a;
            const lat = a.lat + (b.lat - a.lat) * t;
            const lng = a.lng + (b.lng - a.lng) * t;
            markers.push({ day: d, lat, lng });
        }

        // Store markers for rendering
        bridge.state.dayMarkers = markers;
        return { days, markers };
    }

    function renderDayMarkers(daily, tFn) {
        // Clear previous
        clearDayMarkers();
        if (!daily || !daily.markers || !daily.markers.length) return;
        daily.markers.forEach(d => {
            const icon = L.divIcon({
                className: 'waypoint-icon',
                html: `<div class=\"waypoint-marker\" title=\"${tFn('Gün Sonu', 'End of Day')} ${d.day}\">${d.day}</div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            const marker = L.marker([d.lat, d.lng], { icon, pane: 'routePane' }).addTo(bridge.map);
            bridge.state.dayMarkerLayers.push(marker);
        });
    }

    function clearDayMarkers() {
        if (bridge.state.dayMarkerLayers) {
            bridge.state.dayMarkerLayers.forEach(m => bridge.map.removeLayer(m));
        }
        bridge.state.dayMarkerLayers = [];
    }

    function formatDuration(days) {
        if (!isFinite(days) || days <= 0) {
            return t('<1 gun', '<1 hour');
        }
        const totalHours = Math.round(days * 24);
        const dayCount = Math.floor(totalHours / 24);
        const hourCount = totalHours % 24;
        const parts = [];
        if (dayCount) {
            parts.push(`${dayCount}${isEnglishPage() ? 'd' : 'g'}`);
        }
        if (hourCount) {
            parts.push(`${hourCount}h`);
        }
        if (!parts.length) {
            parts.push(isEnglishPage() ? '<1h' : '<1s');
        }
        return parts.join(' ');
    }

    function capitalize(s){ return (s||'').charAt(0).toUpperCase() + (s||'').slice(1); }

    /**
     * Show user-friendly routing error in the UI
     */
    function showRoutingError(errorMessage) {
        const summaryEl = document.getElementById('route-summary');
        if (!summaryEl) return;

        const errorHtml = `
            <div style="padding: 15px; background: #fee; border: 2px solid #c33; border-radius: 8px; margin: 10px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 24px; margin-right: 10px;">⚠️</span>
                    <strong style="color: #c33; font-size: 16px;">
                        ${t('Rota Hesaplama Hatası', 'Routing Error')}
                    </strong>
                </div>
                <p style="margin: 8px 0; color: #333; font-size: 14px;">
                    ${escapeHtml(errorMessage)}
                </p>
                <button
                    onclick="window.__nimea_route_core?.recomputeRoute?.()"
                    style="margin-top: 10px; padding: 8px 16px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    ${t('Tekrar Dene', 'Retry')}
                </button>
                <button
                    onclick="window.__nimea_route_core?.clearRoute?.()"
                    style="margin-top: 10px; margin-left: 8px; padding: 8px 16px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    ${t('Rotayı Temizle', 'Clear Route')}
                </button>
            </div>
        `;

        summaryEl.innerHTML = errorHtml;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Expose module functions
    window.__nimea_visualizer = {
        initVisualizer,
        analyzePathSegments,
        renderHybridPath,
        computeSegmentDistance,
        updateRouteSummaryFromLegs,
        updateRouteSummaryCalculating,
        updateRouteSummaryEmpty,
        renderFullUnifiedRoute,
        showRoutingError
    };

})(window);

