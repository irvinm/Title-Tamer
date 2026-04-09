// options-mutation-utils.js — Pure state update helpers for options page mutations.

/**
 * Build the storage update for adding a new pattern from the Add Rule form.
 * @param {Array<object>} existingPatterns
 * @param {{ search: string, title: string, groupValue?: string }} input
 * @returns {{ patterns: Array<object>, recentGroupSelection?: string }}
 */
function buildSavePatternUpdate(existingPatterns, input) {
    const patterns = Array.isArray(existingPatterns) ? [...existingPatterns] : [];
    const pattern = {
        search: input.search,
        title: input.title,
    };

    const groupValue = input.groupValue || '';
    if (groupValue) {
        pattern.group = groupValue;
    }

    patterns.push(pattern);

    const update = { patterns };
    if (groupValue) {
        update.recentGroupSelection = groupValue;
    }

    return update;
}

/**
 * Build the storage update for saving edits to an existing row.
 * Preserves enabled state and group-relative ordering behavior.
 * @param {Array<object>} existingPatterns
 * @param {number} index
 * @param {{ search: string, title: string, groupValue?: string }} input
 * @returns {{ patterns: Array<object>, recentGroupSelection?: string }}
 */
function buildSaveRowUpdate(existingPatterns, index, input) {
    const patterns = Array.isArray(existingPatterns)
        ? existingPatterns.map(p => ({ ...p }))
        : [];

    if (!patterns[index]) {
        return { patterns };
    }

    const oldGroup = patterns[index].group || '';
    const newGroup = input.groupValue || '';

    const updatedPattern = {
        search: input.search,
        title: input.title,
        enabled: patterns[index].enabled !== false,
    };

    if (newGroup) {
        updatedPattern.group = newGroup;
    }

    if (newGroup !== oldGroup) {
        patterns.splice(index, 1);
        let insertAt = -1;
        for (let i = 0; i < patterns.length; i++) {
            if ((patterns[i].group || '') === newGroup) {
                insertAt = i;
            }
        }
        if (insertAt === -1) {
            patterns.push(updatedPattern);
        } else {
            patterns.splice(insertAt + 1, 0, updatedPattern);
        }
    } else {
        patterns[index] = updatedPattern;
    }

    const update = { patterns };
    if (newGroup) {
        update.recentGroupSelection = newGroup;
    }

    return update;
}

/**
 * Build the storage update for changing an individual pattern enabled state.
 * @param {Array<object>} existingPatterns
 * @param {number} index
 * @param {boolean} isEnabled
 * @returns {{ patterns: Array<object> }}
 */
function buildPatternEnabledUpdate(existingPatterns, index, isEnabled) {
    const patterns = Array.isArray(existingPatterns)
        ? existingPatterns.map(p => ({ ...p }))
        : [];

    if (patterns[index]) {
        patterns[index].enabled = isEnabled;
    }

    return { patterns };
}

/**
 * Build the next disabled groups array from current values.
 * @param {Set<string>|Array<string>} currentDisabledGroups
 * @param {string} groupName
 * @param {boolean} isDisabled
 * @returns {Array<string>}
 */
function buildDisabledGroupsUpdate(currentDisabledGroups, groupName, isDisabled) {
    const next = new Set(Array.isArray(currentDisabledGroups)
        ? currentDisabledGroups
        : Array.from(currentDisabledGroups || []));

    if (isDisabled) {
        next.add(groupName);
    } else {
        next.delete(groupName);
    }

    return Array.from(next);
}

if (typeof globalThis !== 'undefined') {
    globalThis.buildSavePatternUpdate = buildSavePatternUpdate;
    globalThis.buildSaveRowUpdate = buildSaveRowUpdate;
    globalThis.buildPatternEnabledUpdate = buildPatternEnabledUpdate;
    globalThis.buildDisabledGroupsUpdate = buildDisabledGroupsUpdate;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        buildSavePatternUpdate,
        buildSaveRowUpdate,
        buildPatternEnabledUpdate,
        buildDisabledGroupsUpdate,
    };
}
