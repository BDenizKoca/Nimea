// map/js/routing/validation.js - Input validation utilities

(function(window) {
    'use strict';

    /**
     * Validate a marker object
     * @throws {Error} if marker is invalid
     */
    function validateMarker(marker, context = '') {
        const prefix = context ? `${context}: ` : '';

        if (!marker) {
            throw new Error(`${prefix}Marker is null or undefined`);
        }

        if (!marker.id || typeof marker.id !== 'string') {
            throw new Error(`${prefix}Invalid marker ID: ${marker.id}`);
        }

        if (typeof marker.x !== 'number' || typeof marker.y !== 'number') {
            throw new Error(`${prefix}Invalid coordinates for marker ${marker.id}: x=${marker.x}, y=${marker.y}`);
        }

        if (!isFinite(marker.x) || !isFinite(marker.y)) {
            throw new Error(`${prefix}Non-finite coordinates for marker ${marker.id}: x=${marker.x}, y=${marker.y}`);
        }

        if (!marker.name || typeof marker.name !== 'string') {
            console.warn(`${prefix}Marker ${marker.id} has no name, setting default`);
            marker.name = `Unnamed (${marker.id})`;
        }

        return true;
    }

    /**
     * Validate route array
     * @throws {Error} if route is invalid
     */
    function validateRoute(route, context = '') {
        const prefix = context ? `${context}: ` : '';

        if (!Array.isArray(route)) {
            throw new Error(`${prefix}Route is not an array: ${typeof route}`);
        }

        if (route.length > 50) {
            throw new Error(`${prefix}Route too long: ${route.length} stops (max 50)`);
        }

        const seenIds = new Set();
        route.forEach((marker, index) => {
            validateMarker(marker, `${prefix}Route[${index}]`);

            if (seenIds.has(marker.id)) {
                throw new Error(`${prefix}Duplicate marker in route: ${marker.id} at index ${index}`);
            }
            seenIds.add(marker.id);
        });

        return true;
    }

    /**
     * Validate graph structure
     */
    function validateGraph(graph, context = '') {
        const prefix = context ? `${context}: ` : '';

        if (!graph) {
            throw new Error(`${prefix}Graph is null or undefined`);
        }

        if (!(graph.nodes instanceof Map)) {
            throw new Error(`${prefix}Graph nodes is not a Map`);
        }

        if (!Array.isArray(graph.edges)) {
            throw new Error(`${prefix}Graph edges is not an array`);
        }

        if (!(graph.edgeMap instanceof Map)) {
            throw new Error(`${prefix}Graph edgeMap is not a Map`);
        }

        // Validate node structure
        for (let [nodeId, node] of graph.nodes) {
            if (typeof node.x !== 'number' || typeof node.y !== 'number') {
                throw new Error(`${prefix}Node ${nodeId} has invalid coordinates`);
            }
            if (!isFinite(node.x) || !isFinite(node.y)) {
                throw new Error(`${prefix}Node ${nodeId} has non-finite coordinates`);
            }
            if (!node.type) {
                throw new Error(`${prefix}Node ${nodeId} has no type`);
            }
        }

        // Validate edges
        graph.edges.forEach((edge, index) => {
            if (!edge.from || !edge.to) {
                throw new Error(`${prefix}Edge ${index} missing from/to: ${JSON.stringify(edge)}`);
            }
            if (!graph.nodes.has(edge.from)) {
                throw new Error(`${prefix}Edge ${index} references non-existent node: ${edge.from}`);
            }
            if (!graph.nodes.has(edge.to)) {
                throw new Error(`${prefix}Edge ${index} references non-existent node: ${edge.to}`);
            }
            if (typeof edge.cost !== 'number' || !isFinite(edge.cost) || edge.cost < 0) {
                throw new Error(`${prefix}Edge ${index} has invalid cost: ${edge.cost}`);
            }
            if (typeof edge.distance !== 'number' || !isFinite(edge.distance) || edge.distance < 0) {
                throw new Error(`${prefix}Edge ${index} has invalid distance: ${edge.distance}`);
            }
        });

        return true;
    }

    /**
     * Validate coordinates
     */
    function validateCoordinates(lat, lng, context = '') {
        const prefix = context ? `${context}: ` : '';

        if (typeof lat !== 'number' || typeof lng !== 'number') {
            throw new Error(`${prefix}Coordinates must be numbers: lat=${lat}, lng=${lng}`);
        }

        if (!isFinite(lat) || !isFinite(lng)) {
            throw new Error(`${prefix}Coordinates must be finite: lat=${lat}, lng=${lng}`);
        }

        return true;
    }

    /**
     * Safe wrapper for validation - returns error instead of throwing
     */
    function safeValidate(validationFn, ...args) {
        try {
            validationFn(...args);
            return { valid: true, error: null };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // Expose validation functions
    window.__nimea_validation = {
        validateMarker,
        validateRoute,
        validateGraph,
        validateCoordinates,
        safeValidate
    };

})(window);
