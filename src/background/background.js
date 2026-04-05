// background.js

// Background State Machine to track title modifications over the lifecycle of tabs
const tabOriginalTitles = new Map(); // tabId -> String (the site's true, native title)
const tabModifiedTitles = new Map(); // tabId -> String (the manipulated title we set)

// Clean up state when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
    tabOriginalTitles.delete(tabId);
    tabModifiedTitles.delete(tabId);
});

// Monitor tab updates (navigation, title changes, loading complete)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Intercept title changes
    if (changeInfo.title) {
        if (changeInfo.title === tabModifiedTitles.get(tabId)) {
            // Echo from our own executeScript modifier. Ignore to prevent loops.
            return;
        }
        // Genuine native title change by the website (e.g. SPA navigation)
        tabOriginalTitles.set(tabId, changeInfo.title);
    }
    
    // Evaluate rules when key tab properties change
    if (changeInfo.title || changeInfo.url || changeInfo.status === 'complete') {
        updateTabTitle(tabId, tab);
    }
});

// Capture native title on tab creation
browser.tabs.onCreated.addListener((tab) => {
    if (tab.title) {
        tabOriginalTitles.set(tab.id, tab.title);
    }
    updateTabTitle(tab.id, tab);
});

// Core logic: Evaluate against all active rules and apply or revert the title
async function updateTabTitle(tabId, tab) {
    // We only actively inject scripts into LOADED tabs.
    // Discarded tabs are evaluated via the sync engine wake-up process.
    if (!tab || tab.discarded) return;

    try {
        const result = await browser.storage.local.get(['patterns', 'disabledGroups']);
        const rawPatterns = result.patterns || [];
        const disabledGroups = result.disabledGroups || [];
        
        // These utility functions are automatically injected globally via manifest.json background script array
        const sorted = sortPatternsForDisplay(rawPatterns);
        const activePatterns = filterActivePatterns(sorted, disabledGroups);

        let matchedTitle = null;
        for (const pattern of activePatterns) {
            const matchTest = applyPattern(tab.url, pattern);
            if (matchTest && matchTest.matched && matchTest.newTitle) {
                matchedTitle = matchTest.newTitle;
                break;
            }
        }

        if (matchedTitle) {
            // A pattern matched.
            if (tab.title !== matchedTitle) {
                // Ensure we have captured the original title before overwriting it
                if (!tabOriginalTitles.has(tabId) && typeof tab.title === 'string') {
                     tabOriginalTitles.set(tabId, tab.title);
                }
                
                // Record our change
                tabModifiedTitles.set(tabId, matchedTitle);
                
                // Inject the change
                await browser.tabs.executeScript(tabId, {
                    code: `document.title = ${JSON.stringify(matchedTitle)};`
                }).catch(e => console.log('executeScript failed (e.g., strict CSP or privileged page)', e));
            }
        } else {
            // NO patterns matched. 
            // If we previously modified this tab, we need to REVERT it natively.
            if (tabModifiedTitles.has(tabId)) {
                const revertTo = tabOriginalTitles.get(tabId) || tab.title;
                tabModifiedTitles.delete(tabId);
                // We keep the original in the map just in case.
                
                // Inject the revert
                if (tab.title !== revertTo) {
                    await browser.tabs.executeScript(tabId, {
                        code: `document.title = ${JSON.stringify(revertTo)};`
                    }).catch(e => console.log('executeScript revert failed', e));                
                }
            }
        }

    } catch (e) {
        console.error('Error in updateTabTitle:', e);
    }
}

// Universal Sync Receiver: Triggered automatically whenever rules or active statuses change in storage
browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        if (changes.patterns || changes.disabledGroups) {
            console.log('Rule set updated. Triggering universal sync.');
            syncAllTabs();
        }
    }
});

// The Sync Engine: Intelligently handles full browser re-evaluation
async function syncAllTabs() {
    try {
        const storageValues = await browser.storage.local.get(['loadDiscardedTabs', 'reDiscardTabs', 'discardDelay']);
        const loadDiscardedTabs = storageValues.loadDiscardedTabs || false;
        const reDiscardTabs = storageValues.reDiscardTabs || false;
        const discardDelay = storageValues.discardDelay || 0;

        const activeTabArray = await browser.tabs.query({ active: true, currentWindow: true });
        const activeTab = activeTabArray.length > 0 ? activeTabArray[0] : null;

        const previouslyDiscardedTabs = [];
        const tabs = await browser.tabs.query({});

        // Pre-fetch rules once instead of per-tab
        const result = await browser.storage.local.get(['patterns', 'disabledGroups']);
        const rawPatterns = result.patterns || [];
        const disabledGroups = result.disabledGroups || [];
        const sorted = sortPatternsForDisplay(rawPatterns);
        const activePatterns = filterActivePatterns(sorted, disabledGroups);

        // Phase 1: Re-evaluate tabs intelligently
        for (const tab of tabs) {
            
            // Calculate what the title SHOULD be
            let matchedTitle = null;
            for (const pattern of activePatterns) {
                const matchTest = applyPattern(tab.url, pattern);
                if (matchTest && matchTest.matched && matchTest.newTitle) {
                    matchedTitle = matchTest.newTitle;
                    break;
                }
            }

            let needsUpdate = false;
            if (matchedTitle) {
                // Determine if the string diverges
                if (tab.title !== matchedTitle) {
                    needsUpdate = true;
                }
            } else {
                // If no rules match currently, but we know we previously modified this tab, REVERT it
                if (tabModifiedTitles.has(tab.id)) {
                    needsUpdate = true;
                } else if (tab.discarded) {
                    // AMNESIA RECOVERY: If the extension reloaded (wiping memory maps) and the user disabled a rule, 
                    // we must deduce if this tab happens to hold an orphaned manipulated title.
                    // We check if its current physical title exactly matches what any INACTIVE rule would have produced!
                    for (const oldPattern of sorted) {
                        // Only test patterns that are currently inactive
                        if (oldPattern.enabled === false || (oldPattern.group && disabledGroups.includes(oldPattern.group))) {
                            const oldTest = applyPattern(tab.url, oldPattern);
                            if (oldTest && oldTest.matched && tab.title === oldTest.newTitle) {
                                needsUpdate = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (needsUpdate) {
                if (tab.discarded) {
                    if (loadDiscardedTabs) {
                        // Wake it up. Natively forces full re-eval via onUpdated.
                        await browser.tabs.update(tab.id, { active: true });
                        previouslyDiscardedTabs.push(tab.id);
                    }
                } else {
                    // Update loaded tabs in-place
                    await updateTabTitle(tab.id, tab);
                }
            }
        }

        // Safely return focus to the original active tab to prevent UI flashing
        if (activeTab) {
            await browser.tabs.update(activeTab.id, { active: true }).catch(err => console.log('Could not return focus:', err));
        }

        // Phase 2: Handle Woken-Up Discarded Tabs
        if (previouslyDiscardedTabs.length > 0) {
            console.log(`Waiting for ${previouslyDiscardedTabs.length} awoken tabs to finish loading...`);
            
            await Promise.all(previouslyDiscardedTabs.map(tabId => new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    browser.tabs.onUpdated.removeListener(listener);
                    resolve(); // Resolve anyway so we don't block the rest
                }, 10000); // 10 second timeout

                const listener = (updatedTabId, changeInfo) => {
                    if (updatedTabId === tabId && changeInfo.status === 'complete') {
                        clearTimeout(timeout);
                        browser.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                };

                browser.tabs.onUpdated.addListener(listener);
            }))).catch(error => console.error(error));

            if (reDiscardTabs) {
                if (discardDelay > 0) {
                    console.log(`Waiting ${discardDelay} seconds delay before re-discarding tabs...`);
                    await new Promise(resolve => setTimeout(resolve, discardDelay * 1000));
                }
                
                // Re-discard
                for (const tabId of previouslyDiscardedTabs) {
                    // Force stop any lingering network requests to prevent the infinite throbber bug
                    await browser.tabs.executeScript(tabId, { code: 'window.stop();' }).catch(() => {});
                    browser.tabs.discard(tabId).catch(e => console.log('Could not re-discard:', e));
                }
            }
        }
    } catch (e) {
        console.error('Error in syncAllTabs:', e);
    }
}