// group-utils.js — Pure group-related utilities extracted from options.js for testability

/**
 * Escape HTML special characters to prevent injection in table cells.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Return unique group names from the patterns array in the requested order.
 * - 'alphabetic' (default): sorted locale-case-insensitively.
 * - 'table': first-appearance order as stored in the patterns array.
 * @param {Array<{group?: string}>} patterns
 * @param {'alphabetic'|'table'} sortOrder
 * @returns {string[]}
 */
function getOrderedGroupNames(patterns, sortOrder) {
    const groupNames = [...new Set(patterns.map(p => p.group).filter(Boolean))];
    if (sortOrder === 'table') {
        return groupNames;
    }
    return groupNames.sort((left, right) => left.localeCompare(right));
}

/**
 * Compute the overlay scrollbar thumb position and height.
 * All lengths are in CSS pixels.
 *
 * @param {object} opts
 * @param {number} opts.scrollTop       - Current scroll offset of the container.
 * @param {number} opts.viewportHeight  - Visible height of the container (clientHeight).
 * @param {number} opts.scrollHeight    - Total scrollable content height.
 * @param {number} opts.trackHeight     - Pixel height of the thumb track.
 * @param {number} [opts.minThumbHeight=18] - Minimum thumb height.
 * @returns {{ thumbHeight: number, thumbOffsetY: number, maxScrollTop: number }}
 */
function computeScrollThumb({ scrollTop, viewportHeight, scrollHeight, trackHeight, minThumbHeight = 18 }) {
    const maxScrollTop = Math.max(0, scrollHeight - viewportHeight);

    if (maxScrollTop <= 0 || trackHeight <= 0) {
        return { thumbHeight: 0, thumbOffsetY: 0, maxScrollTop: 0 };
    }

    const thumbHeight = Math.max(minThumbHeight, (viewportHeight / scrollHeight) * trackHeight);
    const maxTravel = Math.max(0, trackHeight - thumbHeight);
    const ratio = Math.min(1, Math.max(0, scrollTop / maxScrollTop));
    const thumbOffsetY = ratio * maxTravel;

    return { thumbHeight, thumbOffsetY, maxScrollTop };
}

// Export for Node (testing) and browser (extension)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHTML, getOrderedGroupNames, computeScrollThumb };
}
