// map/js/utils/event-emitter.js - Simple event emitter for module communication

(function(window) {
    'use strict';

    /**
     * Minimal event emitter for decoupling modules
     * Replaces monkey-patching with clean event-based communication
     */
    class EventEmitter {
        constructor() {
            this.listeners = new Map();
        }

        /**
         * Register an event listener
         * @param {string} event - Event name
         * @param {Function} callback - Handler function
         */
        on(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }
            this.listeners.get(event).push(callback);
        }

        /**
         * Remove an event listener
         * @param {string} event - Event name
         * @param {Function} callback - Handler function to remove
         */
        off(event, callback) {
            if (!this.listeners.has(event)) return;

            const handlers = this.listeners.get(event);
            const index = handlers.indexOf(callback);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }

        /**
         * Emit an event to all registered listeners
         * @param {string} event - Event name
         * @param {*} data - Data to pass to listeners
         */
        emit(event, data) {
            if (!this.listeners.has(event)) return;

            const handlers = this.listeners.get(event);
            handlers.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for "${event}":`, error);
                }
            });
        }

        /**
         * Register a one-time event listener
         * @param {string} event - Event name
         * @param {Function} callback - Handler function
         */
        once(event, callback) {
            const wrapper = (data) => {
                callback(data);
                this.off(event, wrapper);
            };
            this.on(event, wrapper);
        }
    }

    window.EventEmitter = EventEmitter;

})(window);
