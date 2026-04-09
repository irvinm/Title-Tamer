// sync-state-utils.js — Shared persistence helpers for sync-state serialization.

/**
 * Convert runtime maps into the storage payload used by background state persistence.
 * @param {Map<number, string>} modifiedTitles
 * @param {Map<number, string>} originalTitles
 * @returns {{ modifiedTitles: Array<[number, string]>, originalTitles: Array<[number, string]> }}
 */
function serializeSyncState(modifiedTitles, originalTitles) {
    return {
        modifiedTitles: Array.from(modifiedTitles.entries()),
        originalTitles: Array.from(originalTitles.entries()),
    };
}

/**
 * Hydrate runtime maps from a stored _sync_state payload.
 * @param {object} statePayload
 * @param {Map<number, string>} targetModified
 * @param {Map<number, string>} targetOriginal
 */
function hydrateSyncState(statePayload, targetModified, targetOriginal) {
    if (!statePayload) return;

    if (Array.isArray(statePayload.modifiedTitles)) {
        statePayload.modifiedTitles.forEach(([id, title]) => {
            targetModified.set(id, title);
        });
    }

    if (Array.isArray(statePayload.originalTitles)) {
        statePayload.originalTitles.forEach(([id, title]) => {
            targetOriginal.set(id, title);
        });
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.serializeSyncState = serializeSyncState;
    globalThis.hydrateSyncState = hydrateSyncState;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { serializeSyncState, hydrateSyncState };
}
