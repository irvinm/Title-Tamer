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

// Export for both Node (testing) and browser (extension)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { matchUrl, buildTitle, applyPattern };
}
