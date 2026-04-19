/**
 * sync-engine-logic.js
 * 
 * Pure logic for evaluating whether a tab needs an update based on current rules,
 * persistent memory (Elephant Memory), and skeptical heuristics.
 */

/**
 * Evaluates the state of a single tab and decides if it needs a title update or restoration.
 * 
 * @param {Object} tab - The tab object (ID, URL, Title, etc.)
 * @param {Array} activePatterns - Patterns that are currently enabled.
 * @param {Array} allPatterns - All patterns (including disabled ones) for Amnesia Recovery.
 * @param {Array} disabledGroups - Names of disabled groups.
 * @param {Map} tabModifiedTitles - Elephant Memory: Tab ID -> Title we set.
 * @param {Map} tabOriginalTitles - Elephant Memory: Tab ID -> Native title.
 * @returns {Object} { needsUpdate, updateReason, matchedTitle, matchingPattern }
 */
function evaluateTabSyncState(tab, activePatterns, allPatterns, disabledGroups, tabModifiedTitles, tabOriginalTitles) {
    let matchedTitle = null;
    let matchingPattern = null;

    // Phase 0: Calculate what the title SHOULD be based on active rules
    for (const pattern of activePatterns) {
        // applyPattern is expected to be available globally (from pattern-utils.js)
        const matchTest = applyPattern(tab.url, pattern);
        if (matchTest && matchTest.matched && matchTest.newTitle) {
            matchedTitle = matchTest.newTitle;
            matchingPattern = pattern;
            break;
        }
    }

    let needsUpdate = false;
    let updateReason = "";

    if (matchedTitle) {
        // SCENARIO A: A rule matches this tab.
        if (tab.title !== matchedTitle) {
            needsUpdate = true;
            const ruleId = matchingPattern.name || matchingPattern.search;
            updateReason = `Title mismatch matching rule "${ruleId}"`;
        }
    } else {
        // SCENARIO B: No active rules match this tab.
        // We must check if this is an "Orphan" that needs to be reverted.
        
        // 1. ELEPHANT MEMORY: Check if we explicitly remember modifying this tab.
        if (tabModifiedTitles.has(tab.id)) {
            needsUpdate = true;
            updateReason = "Elephant Memory: Persistent record found with no active rule match.";
        } 
        // 2. DISCARDED TAB HEURISTICS (Skeptical Engine)
        else if (tab.discarded) {
             // 2a. SKEPTICAL MARKERS: Catch obvious Title-Tamer markers (like HTTP30 or HTTP!)
             // We use a regex check on the title itself.
             if (tab.title.match(/^HTTP\d*!/) || tab.title.match(/^HTTP!/)) {
                needsUpdate = true;
                updateReason = `Skeptical Engine: Suspicious title marker detected ("${tab.title}")`;
            } 
            // 2b. AMNESIA RECOVERY: Check against inactive rules (to catch tabs from just-disabled rules)
            else {
                for (const oldPattern of allPatterns) {
                    // Only test patterns that are currently inactive
                    const isInactive = oldPattern.enabled === false || (oldPattern.group && disabledGroups.includes(oldPattern.group));
                    if (isInactive) {
                        const oldMatch = applyPattern(tab.url, oldPattern);
                        if (oldMatch && oldMatch.matched && tab.title === oldMatch.newTitle) {
                            needsUpdate = true;
                            const ruleId = oldPattern.name || oldPattern.search;
                            updateReason = `Amnesia Recovery: Orphaned title matches inactive rule "${ruleId}"`;
                            break;
                        }
                    }
                }
            }
        }
    }

    return {
        needsUpdate,
        updateReason,
        matchedTitle,
        matchingPattern
    };
}

// Export for Node environments (Unit Tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { evaluateTabSyncState };
}
