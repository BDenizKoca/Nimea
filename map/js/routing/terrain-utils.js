// map/js/routing/terrain-utils.js - Terrain cost calculation and geometry utilities

(function(window) {
    'use strict';

    // This will be set by the main routing module
    let bridge = {};
    let TERRAIN_COSTS = {};
    let WATER_KINDS = new Set(['sea', 'water', 'unpassable']);
    let cachedBounds = null;

    /**
     * Initialize terrain utilities with dependencies
     */
    function initTerrainUtils(bridgeObj, terrainCosts, options = {}) {
        bridge = bridgeObj;
        TERRAIN_COSTS = terrainCosts || {};

        if (Array.isArray(options.waterKinds) && options.waterKinds.length) {
            WATER_KINDS = new Set(options.waterKinds);
        } else if (bridge.config && Array.isArray(bridge.config.waterTerrainKinds)) {
            WATER_KINDS = new Set(bridge.config.waterTerrainKinds);
        }

        cachedBounds = null;
    }

    function isWaterKind(kind) {
        return !!kind && WATER_KINDS.has(kind);
    }

    function polygonRings(geometry) {
        if (!geometry) return [];
        if (geometry.type === 'Polygon') return geometry.coordinates || [];
        if (geometry.type === 'MultiPolygon') {
            return geometry.coordinates ? geometry.coordinates.flat() : [];
        }
        return [];
    }

    function pointInAnyRing(point, geometry) {
        const rings = polygonRings(geometry);
        for (const ring of rings) {
            if (ring && ring.length && pointInPolygon(point, ring)) {
                return true;
            }
        }
        return false;
    }

    function lineIntersectsGeometry(lineStart, lineEnd, geometry) {
        const rings = polygonRings(geometry);
        for (const ring of rings) {
            if (ring && ring.length && lineIntersectsPolygon(lineStart, lineEnd, ring)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get terrain cost at a specific point
     * Checks terrain features to determine movement cost
     */
    function getTerrainCostAtPoint(x, y) {
        if (!bridge.state || !bridge.state.terrain) {
            return TERRAIN_COSTS.normal || 1.0;
        }

        const terrainFeatures = bridge.state.terrain.features || [];
        let cost = TERRAIN_COSTS.normal || 1.0;

        for (const feature of terrainFeatures) {
            const geometry = feature.geometry;
            if (!geometry || !geometry.type) continue;

            if (!pointInAnyRing([x, y], geometry)) {
                continue;
            }

            const kind = feature.properties ? feature.properties.kind : null;

            if (kind === 'blocked' || kind === 'unpassable') {
                return TERRAIN_COSTS[kind] || TERRAIN_COSTS.unpassable || TERRAIN_COSTS.blocked || 50;
            }

            if (isWaterKind(kind)) {
                return TERRAIN_COSTS.unpassable || TERRAIN_COSTS.blocked || 50;
            }

            if (kind === 'difficult') {
                return TERRAIN_COSTS.difficult || cost;
            }

            if (kind === 'medium') {
                cost = Math.max(cost, TERRAIN_COSTS.medium || cost);
            }

            if (kind === 'forest') {
                cost = Math.max(cost, TERRAIN_COSTS.forest || cost);
            }
        }

        return cost;
    }

    /**
     * Calculate terrain cost between two points based on terrain features
     * Used for bridge connections between graph layers
     */
    function getTerrainCostBetweenPoints(from, to) {
        if (!bridge.state || !bridge.state.terrain) {
            return TERRAIN_COSTS.normal || 1.0;
        }

        const terrainFeatures = bridge.state.terrain.features || [];
        let cost = TERRAIN_COSTS.normal || 1.0;

        for (const feature of terrainFeatures) {
            const geometry = feature.geometry;
            if (!geometry || !geometry.type) continue;

            if (!lineIntersectsGeometry([from.x, from.y], [to.x, to.y], geometry)) {
                continue;
            }

            const kind = feature.properties ? feature.properties.kind : null;

            if (kind === 'blocked' || kind === 'unpassable') {
                return TERRAIN_COSTS[kind] || TERRAIN_COSTS.unpassable || TERRAIN_COSTS.blocked || 50;
            }

            if (isWaterKind(kind)) {
                return TERRAIN_COSTS.unpassable || TERRAIN_COSTS.blocked || 50;
            }

            if (kind === 'difficult') {
                return TERRAIN_COSTS.difficult || cost;
            }

            if (kind === 'medium') {
                cost = Math.max(cost, TERRAIN_COSTS.medium || cost);
            }

            if (kind === 'forest') {
                cost = Math.max(cost, TERRAIN_COSTS.forest || cost);
            }
        }

        return cost;
    }

    /**
     * Determine if a point lies inside a water feature
     */
    function isWaterAtPoint(x, y) {
        if (!bridge.state || !bridge.state.terrain) {
            return false;
        }

        const terrainFeatures = bridge.state.terrain.features || [];
        for (const feature of terrainFeatures) {
            const kind = feature.properties ? feature.properties.kind : null;
            if (!isWaterKind(kind)) continue;
            if (!feature.geometry) continue;
            if (pointInAnyRing([x, y], feature.geometry)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Compute cached data bounds including terrain and marker footprint
     */
    function computeDataBounds() {
        if (cachedBounds) {
            return cachedBounds;
        }

        const bounds = {
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity
        };

        const update = (x, y) => {
            if (x < bounds.minX) bounds.minX = x;
            if (x > bounds.maxX) bounds.maxX = x;
            if (y < bounds.minY) bounds.minY = y;
            if (y > bounds.maxY) bounds.maxY = y;
        };

        const markers = (bridge.state && Array.isArray(bridge.state.markers)) ? bridge.state.markers : [];
        markers.forEach(marker => {
            if (typeof marker.x === 'number' && typeof marker.y === 'number') {
                update(marker.x, marker.y);
            }
        });

        const features = bridge.state && bridge.state.terrain ? bridge.state.terrain.features : [];
        (features || []).forEach(feature => {
            if (!feature.geometry) return;
            const geom = feature.geometry;

            function pushCoords(coords) {
                coords.forEach(pt => {
                    if (Array.isArray(pt[0])) {
                        pushCoords(pt);
                    } else if (typeof pt[0] === 'number' && typeof pt[1] === 'number') {
                        update(pt[0], pt[1]);
                    }
                });
            }

            if (geom.type === 'Point') {
                update(geom.coordinates[0], geom.coordinates[1]);
            } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
                pushCoords(geom.coordinates);
            } else if (geom.type === 'MultiLineString' || geom.type === 'Polygon') {
                pushCoords(geom.coordinates);
            } else if (geom.type === 'MultiPolygon') {
                pushCoords(geom.coordinates);
            }
        });

        if (!isFinite(bounds.minX) || !isFinite(bounds.minY) ||
            !isFinite(bounds.maxX) || !isFinite(bounds.maxY)) {
            cachedBounds = { minX: 0, minY: 0, maxX: 2500, maxY: 2500 };
            return cachedBounds;
        }

        const padding = 50;
        cachedBounds = {
            minX: Math.max(0, bounds.minX - padding),
            minY: Math.max(0, bounds.minY - padding),
            maxX: bounds.maxX + padding,
            maxY: bounds.maxY + padding
        };

        return cachedBounds;
    }

    /**
     * Check if point is inside polygon using ray casting algorithm
     */
    function pointInPolygon(point, polygon) {
        const [x, y] = point;
        let inside = false;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];

            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    /**
     * Simple line-polygon intersection test
     * Checks if a line segment intersects any edge of a polygon
     */
    function lineIntersectsPolygon(lineStart, lineEnd, polygon) {
        for (let i = 0; i < polygon.length - 1; i++) {
            if (linesIntersect(
                lineStart, lineEnd,
                polygon[i], polygon[i + 1]
            )) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if two line segments intersect
     * Uses parametric line intersection formula
     */
    function linesIntersect(line1Start, line1End, line2Start, line2End) {
        const x1 = line1Start[0], y1 = line1Start[1];
        const x2 = line1End[0], y2 = line1End[1];
        const x3 = line2Start[0], y3 = line2Start[1];
        const x4 = line2End[0], y4 = line2End[1];

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (denom === 0) return false; // Lines are parallel

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    /**
     * Compute direct distance between two points in kilometers
     */
    function computeDirectKm(a, b, kmPerPixel) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        return distPx * kmPerPixel;
    }

    // Expose module functions
    window.__nimea_terrain_utils = {
        initTerrainUtils,
        getTerrainCostAtPoint,
        getTerrainCostBetweenPoints,
        isWaterAtPoint,
        computeDataBounds,
        pointInPolygon,
        lineIntersectsPolygon,
        linesIntersect,
        computeDirectKm
    };

})(window);
