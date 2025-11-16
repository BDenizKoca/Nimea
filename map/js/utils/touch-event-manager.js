// Touch event handler for marker tap detection
// Eliminates duplicate code in DM marker creation

(function(window) {
    'use strict';

    const TOUCH_DURATION_MS = 500;
    const TOUCH_DISTANCE_PX = 10;

    class TouchEventManager {
        /**
         * Add touch tap detection to a marker
         * Triggers callback only if touch duration < 500ms and distance < 10px
         */
        static addTouchTap(marker, callback) {
            marker.on('touchstart', (e) => {
                e.originalEvent.preventDefault();
                marker._touchStartTime = Date.now();
                marker._touchStartPos = e.originalEvent.touches[0];
            });

            marker.on('touchend', (e) => {
                e.originalEvent.preventDefault();

                if (marker._touchStartTime && marker._touchStartPos) {
                    const touchDuration = Date.now() - marker._touchStartTime;
                    const touchEnd = e.originalEvent.changedTouches[0];

                    const deltaX = Math.abs(touchEnd.clientX - marker._touchStartPos.clientX);
                    const deltaY = Math.abs(touchEnd.clientY - marker._touchStartPos.clientY);
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                    if (touchDuration < TOUCH_DURATION_MS && distance < TOUCH_DISTANCE_PX) {
                        callback(e);
                    }

                    marker._touchStartTime = null;
                    marker._touchStartPos = null;
                }
            });
        }
    }

    // Export
    window.TouchEventManager = TouchEventManager;

})(window);
