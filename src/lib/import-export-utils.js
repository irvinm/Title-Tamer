// import-export-utils.js — Shared pure helpers for import/export flows.

/**
 * Sort patterns to match visual ordering used by the options UI:
 * ungrouped first, then grouped sections ordered by first group appearance.
 * @param {Array<{group?: string}>} rawPatterns
 * @returns {Array<object>}
 */
function sortPatternsForVisualOrder(rawPatterns) {
    const groupOrder = [...new Set(rawPatterns.map(p => p.group).filter(Boolean))];
    const patterns = [...rawPatterns.filter(p => !p.group)];
    for (const groupName of groupOrder) {
        patterns.push(...rawPatterns.filter(p => p.group === groupName));
    }
    return patterns;
}

/**
 * Build export payload from runtime storage values.
 * @param {Array<object>} rawPatterns
 * @param {string[]} collapsedGroups
 * @param {string[]} disabledGroups
 * @returns {{ metadata: { version: string, collapsedGroups: string[], disabledGroups: string[] }, patterns: Array<object> }}
 */
function buildExportPayload(rawPatterns, collapsedGroups = [], disabledGroups = []) {
    return {
        metadata: {
            version: '1.0',
            collapsedGroups: Array.isArray(collapsedGroups) ? collapsedGroups : [],
            disabledGroups: Array.isArray(disabledGroups) ? disabledGroups : [],
        },
        patterns: sortPatternsForVisualOrder(Array.isArray(rawPatterns) ? rawPatterns : []),
    };
}

/**
 * Normalize imported payload shape and remove stale UI metadata groups.
 * @param {Array<object>|{patterns?: Array<object>, metadata?: {collapsedGroups?: string[], disabledGroups?: string[]}}} parsedData
 * @returns {{ patterns: Array<object>, collapsedGroups: string[], disabledGroups: string[] }}
 */
function normalizeImportPayload(parsedData) {
    const rawPatterns = Array.isArray(parsedData)
        ? parsedData
        : (Array.isArray(parsedData?.patterns) ? parsedData.patterns : []);

    const importedCollapsedGroups = Array.isArray(parsedData?.metadata?.collapsedGroups)
        ? parsedData.metadata.collapsedGroups
        : [];

    const importedDisabledGroups = Array.isArray(parsedData?.metadata?.disabledGroups)
        ? parsedData.metadata.disabledGroups
        : [];

    const patterns = sortPatternsForVisualOrder(rawPatterns);
    const activeGroups = [...new Set(patterns.map(p => p.group).filter(Boolean))];
    const activeSet = new Set(activeGroups);

    return {
        patterns,
        collapsedGroups: importedCollapsedGroups.filter(g => activeSet.has(g)),
        disabledGroups: importedDisabledGroups.filter(g => activeSet.has(g)),
    };
}

/**
 * Merges an imported payload into the current storage payload (Append mode).
 * Drops exact duplicates (search + title + group).
 * @param {{ patterns: Array<object>, collapsedGroups: string[], disabledGroups: string[] }} current 
 * @param {{ patterns: Array<object>, collapsedGroups: string[], disabledGroups: string[] }} imported 
 * @returns {{ patterns: Array<object>, collapsedGroups: string[], disabledGroups: string[], stats: { added: number, duplicatesSkipped: number } }}
 */
function mergeImportPayload(current, imported) {
    const existingPatterns = current.patterns || [];
    const importedPatterns = imported.patterns || [];
    
    const isSame = (p1, p2) => p1.search === p2.search && p1.title === p2.title && (p1.group || '') === (p2.group || '');

    // Step 1: Internal deduplication of the imported set
    const deDuplicatedImported = [];
    for (const p of importedPatterns) {
        if (!deDuplicatedImported.some(e => isSame(e, p))) {
            deDuplicatedImported.push(p);
        }
    }

    // Step 2: Filter against existing patterns
    const uniqueImportedPatterns = deDuplicatedImported.filter(p => !existingPatterns.some(e => isSame(e, p)));
    const mergedPatterns = sortPatternsForVisualOrder([...existingPatterns, ...uniqueImportedPatterns]);

    const mergedCollapsed = [...new Set([...(current.collapsedGroups || []), ...(imported.collapsedGroups || [])])];
    const mergedDisabled = [...new Set([...(current.disabledGroups || []), ...(imported.disabledGroups || [])])];

    // Filter to only active groups
    const activeGroups = new Set(mergedPatterns.map(p => p.group).filter(Boolean));
    
    return {
        patterns: mergedPatterns,
        collapsedGroups: mergedCollapsed.filter(g => activeGroups.has(g)),
        disabledGroups: mergedDisabled.filter(g => activeGroups.has(g)),
        stats: {
            added: uniqueImportedPatterns.length,
            duplicatesSkipped: importedPatterns.length - uniqueImportedPatterns.length
        }
    };
}

if (typeof globalThis !== 'undefined') {
    globalThis.sortPatternsForVisualOrder = sortPatternsForVisualOrder;
    globalThis.buildExportPayload = buildExportPayload;
    globalThis.normalizeImportPayload = normalizeImportPayload;
    globalThis.mergeImportPayload = mergeImportPayload;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sortPatternsForVisualOrder, buildExportPayload, normalizeImportPayload, mergeImportPayload };
}
