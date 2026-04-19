// pattern-utils.js — Pure pattern matching and title replacement logic
// Extracted from background.js for testability

/**
 * Test whether a URL matches a search pattern (regex string).
 * Decodes percent-encoding before matching so patterns can use
 * human-readable characters (Issue #7).
 * @param {string} url - The tab URL to test.
 * @param {string} searchPattern - The regex pattern string.
 * @returns {RegExpMatchArray|null} The match result, or null if no match.
 */
function matchUrl(url, searchPattern) {
    try {
        let decodedUrl;
        try { decodedUrl = decodeURIComponent(url); } catch (e) { decodedUrl = url; }
        const regex = new RegExp(searchPattern);
        return decodedUrl.match(regex);
    } catch (e) {
        return null;
    }
}

/**
 * Build the new title by substituting regex capture groups into the title template.
 * Replaces $1, $2, etc. with the corresponding capture group values.
 * @param {string} titleTemplate - The title template (e.g. "Jira - $1").
 * @param {RegExpMatchArray} matches - The regex match result from matchUrl.
 * @returns {string} The resolved title string.
 */
function buildTitle(titleTemplate, matches) {
    let newTitle = titleTemplate.replace(/\$(\d+)/g, (match, number) => {
        return matches[number] || match;
    });

    // Decode URL percent-encoding from captured groups (Issue #7)
    try { newTitle = decodeURIComponent(newTitle); } catch (e) { /* malformed URI — keep as-is */ }

    return newTitle;
}

/**
 * Process a single pattern against a URL: match the URL and build the new title.
 * @param {string} url - The tab URL.
 * @param {{ search: string, title: string }} pattern - The pattern object.
 * @returns {{ matched: boolean, newTitle: string|null }} Result object.
 */
function applyPattern(url, pattern) {
    const matches = matchUrl(url, pattern.search);
    if (!matches) {
        return { matched: false, newTitle: null };
    }
    return { matched: true, newTitle: buildTitle(pattern.title, matches) };
}

/**
 * Sort a flat patterns array into the order used for tab-title matching:
 * ungrouped patterns first (preserving their relative order), followed by
 * grouped patterns ordered by the first appearance of each group name.
 * This mirrors the top-to-bottom visual rendering in the options table.
 * @param {Array<{group?: string}>} rawPatterns
 * @returns {Array<{group?: string}>}
 */
function sortPatternsForDisplay(rawPatterns) {
    const groupOrder = [...new Set(rawPatterns.map(p => p.group).filter(Boolean))];
    const sorted = [...rawPatterns.filter(p => !p.group)];
    for (const g of groupOrder) {
        sorted.push(...rawPatterns.filter(p => p.group === g));
    }
    return sorted;
}

/**
 * Filter a sorted patterns array to only those that should be applied:
 * - skips patterns where `enabled === false`
 * - skips patterns whose group is in the disabledGroups list
 * @param {Array<{group?: string, enabled?: boolean}>} patterns
 * @param {string[]} disabledGroups
 * @returns {Array<{group?: string, enabled?: boolean}>}
 */
function filterActivePatterns(patterns, disabledGroups = []) {
    const groups = Array.isArray(disabledGroups) ? disabledGroups : [];
    return patterns.filter(p => {
        if (p.enabled === false) return false;
        if (p.group && groups.includes(p.group)) return false;
        return true;
    });
}

// Export for both Node (testing) and browser (extension)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { matchUrl, buildTitle, applyPattern, sortPatternsForDisplay, filterActivePatterns };
}
