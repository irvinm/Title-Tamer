// background.js

// Background State Machine to track title modifications over the lifecycle of tabs
const tabOriginalTitles = new Map(); // tabId -> String (the site's true, native title)
const tabModifiedTitles = new Map(); // tabId -> String (the manipulated title we set)

// Persistence Helpers
let isInitialStateLoaded = false;
let saveTimeout = null;

async function saveState() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        const data = {
            modifiedTitles: Array.from(tabModifiedTitles.entries()),
            originalTitles: Array.from(tabOriginalTitles.entries())
        };
        await browser.storage.local.set({ '_sync_state': data }).catch(() => {});
        saveTimeout = null;
    }, 500); // Debounce to allow batch updates
}

async function loadState() {
    try {
        const result = await browser.storage.local.get('_sync_state');
        if (result && result._sync_state) {
            if (result._sync_state.modifiedTitles) {
                result._sync_state.modifiedTitles.forEach(([id, title]) => {
                    tabModifiedTitles.set(id, title);
                });
            }
            if (result._sync_state.originalTitles) {
                result._sync_state.originalTitles.forEach(([id, title]) => {
                    tabOriginalTitles.set(id, title);
                });
            }
            console.log(`[STATE] Loaded records from storage (Modified: ${tabModifiedTitles.size}, Original: ${tabOriginalTitles.size})`);
        }
    } catch (e) {
        console.error('[STATE] Failed to load sync state:', e);
    }
    isInitialStateLoaded = true;
}

// Initial load
loadState();

// Helper to identify tabs that we are legally allowed to inject script into
function isInjectable(tab) {
    if (!tab || !tab.url) return false;
    // We strictly limit injection to web pages to avoid "Missing host permission" on system pages.
    const injectableSchemes = ['http:', 'https:', 'file:', 'ftp:'];
    return injectableSchemes.some(scheme => tab.url.startsWith(scheme));
}

// Clean up state when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
    tabOriginalTitles.delete(tabId);
    if (tabModifiedTitles.has(tabId)) {
        tabModifiedTitles.delete(tabId);
        saveState();
    }
});

// Monitor tab updates (navigation, title changes, loading complete)
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Intercept title changes
    if (changeInfo.title) {
        if (changeInfo.title === tabModifiedTitles.get(tabId)) {
            // Echo from our own executeScript modifier. Ignore to prevent loops.
            return;
        }
        // Genuine native title change by the website (e.g. SPA navigation)
        tabOriginalTitles.set(tabId, changeInfo.title);
        if (tabModifiedTitles.has(tabId)) {
            saveState();
        }
    }
    
    // Evaluate rules when key tab properties change (title, url, or status: "complete")
    if (changeInfo.title || changeInfo.url || changeInfo.status === 'complete') {
        // Fetch fresh tab to avoid race conditions (e.g. tab.url or tab.status being out-of-date)
        const freshTab = await browser.tabs.get(tabId).catch(() => null);
        if (freshTab && freshTab.status === 'complete' && isInjectable(freshTab)) {
            updateTabTitle(tabId, freshTab);
        }
    }
});

// Capture native title on tab creation
browser.tabs.onCreated.addListener((tab) => {
    if (!isInjectable(tab)) return;
    if (tab.title) {
        tabOriginalTitles.set(tab.id, tab.title);
    }
    updateTabTitle(tab.id, tab);
});

// Core logic: Evaluate against all active rules and apply or revert the title
async function updateTabTitle(tabId, tab) {
    // We only actively inject scripts into LOADED tabs.
    // Discarded tabs are evaluated via the sync engine wake-up process.
    if (!tab || tab.discarded || !isInjectable(tab)) return;

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
                     saveState();
                }
                
                // Record our change
                tabModifiedTitles.set(tabId, matchedTitle);
                saveState();
                
                // Inject the change
                await browser.tabs.executeScript(tabId, {
                    code: `document.title = ${JSON.stringify(matchedTitle)};`
                }).catch(e => {
                    // Suppress "Missing host permission" noise for transient reload states
                    if (e.message && e.message.includes("Missing host permission")) {
                        console.log(`[TAB ${tabId}] NOTICE: Transient host permission mismatch (Sync Engine will retry)`);
                    } else {
                        console.log(`[TAB ${tabId}] executeScript failed for ${tab.url}:`, e);
                    }
                });
            }
        } else {
            // NO patterns matched. 
            // If we previously modified this tab, we need to REVERT it natively.
            if (tabModifiedTitles.has(tabId)) {
                const revertTo = tabOriginalTitles.get(tabId) || tab.title;
                tabModifiedTitles.delete(tabId);
                saveState();
                // We keep the original in the map just in case.
                
                // Inject the revert
                if (tab.title !== revertTo) {
                    await browser.tabs.executeScript(tabId, {
                        code: `document.title = ${JSON.stringify(revertTo)};`
                    }).catch(e => console.log(`[TAB ${tabId}] executeScript revert failed for ${tab.url}:`, e));                
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
let isSyncing = false;
let syncQueued = false;

async function syncAllTabs() {
    if (isSyncing) {
        syncQueued = true;
        return;
    }
    isSyncing = true;
    let badgeUpdateInterval = null;
    try {
        const storageValues = await browser.storage.local.get(['loadDiscardedTabs', 'reDiscardTabs', 'discardDelay', 'limitConcurrentTabsEnabled', 'maxConcurrentTabs']);
        const loadDiscardedTabs = storageValues.loadDiscardedTabs || false;
        const reDiscardTabs = storageValues.reDiscardTabs || false;
        const discardDelay = storageValues.discardDelay || 0;
        const limitConcurrentTabsEnabled = storageValues.limitConcurrentTabsEnabled !== undefined ? storageValues.limitConcurrentTabsEnabled : true;
        const maxConcurrentTabs = storageValues.maxConcurrentTabs || 10;

        const previouslyDiscardedTabs = [];
        const tabs = await browser.tabs.query({});

        // Pre-fetch rules once instead of per-tab
        const result = await browser.storage.local.get(['patterns', 'disabledGroups']);
        const rawPatterns = result.patterns || [];
        const disabledGroups = result.disabledGroups || [];
        const sorted = sortPatternsForDisplay(rawPatterns);
        const activePatterns = filterActivePatterns(sorted, disabledGroups);
        
        console.log(`[SYNC ENGINE] Total Patterns: ${rawPatterns.length}, Active: ${activePatterns.length}, Disabled Groups: ${disabledGroups.length}`);

        // Phase 1: Re-evaluate tabs intelligently
        for (const tab of tabs) {
            const decision = evaluateTabSyncState(
                tab, 
                activePatterns, 
                sorted, // all patterns for amnesia recovery
                disabledGroups, 
                tabModifiedTitles, 
                tabOriginalTitles
            );

            if (decision.needsUpdate) {
                console.log(`[PHASE1] Tab ${tab.id} needs update: ${decision.updateReason}`);
                if (tab.discarded) {
                    if (loadDiscardedTabs) {
                        console.log(`[PHASE1] Tab ${tab.id} is discarded. Routing to Phase 2 (Reloading enabled)`);
                        previouslyDiscardedTabs.push(tab.id);
                    } else {
                        console.log(`[PHASE1] Tab ${tab.id} is discarded. SKIPPING (Reloading disabled)`);
                    }
                } else if (tab.status !== 'complete') {
                    // Zombie tab: not discarded but stuck loading (e.g., from a prior aborted run).
                    if (loadDiscardedTabs) {
                        console.log(`[PHASE1] Tab ${tab.id} is a ZOMBIE (stuck loading). Routing to Phase 2 for stop-reload cycle.`);
                        previouslyDiscardedTabs.push(tab.id);
                    } else {
                        console.log(`[PHASE1] Tab ${tab.id} is a ZOMBIE. SKIPPING (Reloading disabled)`);
                    }
                } else {
                    console.log(`[PHASE1] Tab ${tab.id} is loaded. Updating in-place.`);
                    await updateTabTitle(tab.id, tab);
                }
            } else if (decision.matchedTitle && (tab.status !== 'complete' || (!tab.discarded && tab.status === 'loading'))) {
                // No update needed to title, but tab looks like a zombie
                console.log(`[PHASE1] Tab ${tab.id} already matches rule "${decision.matchingPattern.name}" but looks like a ZOMBIE (status=${tab.status})`);
            }
        }

        // Phase 2: Handle Woken-Up Discarded Tabs
        if (previouslyDiscardedTabs.length > 0) {
            console.log(`Need to wake up ${previouslyDiscardedTabs.length} discarded tabs...`);

            const concurrencyLimit = limitConcurrentTabsEnabled && maxConcurrentTabs > 0 ? maxConcurrentTabs : previouslyDiscardedTabs.length;
            console.log(`[SYNC] limitConcurrentTabsEnabled=${limitConcurrentTabsEnabled}, maxConcurrentTabs=${maxConcurrentTabs}, concurrencyLimit=${concurrencyLimit}, totalTabs=${previouslyDiscardedTabs.length}`);

            let completedCount = 0;
            const totalToWake = previouslyDiscardedTabs.length;

            await browser.browserAction.setBadgeBackgroundColor({ color: "#FF0000" }).catch(() => {});
            await browser.browserAction.setBadgeText({ text: totalToWake.toString() }).catch(() => {});

            badgeUpdateInterval = setInterval(() => {
                const remaining = totalToWake - completedCount;
                browser.browserAction.setBadgeText({ text: remaining > 0 ? remaining.toString() : "" }).catch(() => {});
            }, 1000);

            // Process one tab completely: wake, wait for FULL load, verify title, discard
            const processOneTab = async (tabId) => {
                try {
                    const originalTab = await browser.tabs.get(tabId).catch(() => null);
                    if (!originalTab) { console.log(`[TAB ${tabId}] SKIP: tab no longer exists`); return; }

                    console.log(`[TAB ${tabId}] START: discarded=${originalTab.discarded}, status=${originalTab.status}, title="${originalTab.title?.substring(0, 40)}", url=${originalTab.url?.substring(0, 60)}`);

                    // If the tab is in a zombie state (loading but stuck from a prior run),
                    // force-discard it first to reset its state, then reload fresh
                    if (!originalTab.discarded) {
                        console.log(`[PHASE2][TAB ${tabId}] RELOAD REASON: Tab is a loaded zombie (stuck throbber). Stopping and discarding first to force a clean reload.`);
                        await browser.tabs.executeScript(tabId, { code: 'window.stop();' }).catch(() => {});
                        await new Promise(r => setTimeout(r, 500));
                        await browser.tabs.discard(tabId).catch((e) => console.log(`[TAB ${tabId}] ZOMBIE discard failed:`, e));
                        await new Promise(r => setTimeout(r, 500));
                        
                        const recheck = await browser.tabs.get(tabId).catch(() => null);
                        if (recheck && !recheck.discarded) {
                            console.log(`[PHASE2][TAB ${tabId}] ZOMBIE: still not discarded after recovery, skipping`);
                            return;
                        }
                    } else {
                        console.log(`[PHASE2][TAB ${tabId}] RELOAD REASON: Tab is currently discarded. Waking it up.`);
                    }

                    // Calculate expected title
                    let expectedTitle = null;
                    let matchingPattern = null;
                    for (const pattern of activePatterns) {
                        const matchTest = applyPattern(originalTab.url, pattern);
                        if (matchTest && matchTest.matched && matchTest.newTitle) {
                            expectedTitle = matchTest.newTitle;
                            matchingPattern = pattern;
                            break;
                        }
                    }

                    if (matchingPattern) {
                        const ruleId = matchingPattern.name || matchingPattern.search;
                        console.log(`[TAB ${tabId}] MATCHED: rule="${ruleId}" -> want="${expectedTitle?.substring(0, 40)}"`);
                    } else {
                        console.log(`[TAB ${tabId}] NO ACTIVE RULES MATCHED URL: ${originalTab.url?.substring(0, 80)}`);
                    }

                    // Wake up the tab
                    console.log(`[TAB ${tabId}] RELOAD: calling browser.tabs.reload()`);
                    await browser.tabs.reload(tabId);

                    // Wait 1s for the real load to start (skip stale 'complete' from undiscarding)
                    await new Promise(r => setTimeout(r, 1000));

                    // Poll until 'complete' or 15s timeout — simple, can't get stuck
                    const deadline = Date.now() + 15000;
                    let resolvedBy = 'timeout';
                    while (Date.now() < deadline) {
                        const pollTab = await browser.tabs.get(tabId).catch(() => null);
                        if (!pollTab) { resolvedBy = 'closed'; break; }
                        if (pollTab.status === 'complete') { resolvedBy = 'complete'; break; }
                        await new Promise(r => setTimeout(r, 500));
                    }

                    console.log(`[TAB ${tabId}] LOADED: resolvedBy=${resolvedBy}`);

                    // Check current state
                    const afterLoad = await browser.tabs.get(tabId).catch(() => null);
                    if (afterLoad) {
                        console.log(`[TAB ${tabId}] STATE: discarded=${afterLoad.discarded}, status=${afterLoad.status}, title="${afterLoad.title?.substring(0, 40)}"`);
                    }

                    // Re-discard the tab if required
                    if (reDiscardTabs) {
                        if (discardDelay > 0) {
                            await new Promise(r => setTimeout(r, discardDelay * 1000));
                        }

                        // Verify/inject the correct title
                        try {
                            const finalTab = await browser.tabs.get(tabId);
                            if (expectedTitle && finalTab.title !== expectedTitle) {
                                console.log(`[TAB ${tabId}] TITLE UPDATE REQUIRED: have="${finalTab.title?.substring(0, 30)}...", want="${expectedTitle?.substring(0, 30)}..."`);
                                await browser.tabs.executeScript(tabId, {
                                    code: `document.title = ${JSON.stringify(expectedTitle)};`
                                }).catch((e) => console.log(`[TAB ${tabId}] INJECT FAILED for ${originalTab.url}:`, e));
                                tabModifiedTitles.set(tabId, expectedTitle);
                                saveState();
                            } else {
                                if (expectedTitle) {
                                    const ruleId = matchingPattern.name || matchingPattern.search;
                                    console.log(`[TAB ${tabId}] TITLE OK: Matches rule "${ruleId}"`);
                                } else {
                                    // No rule matches, and title is correct? ensure we are clean.
                                    if (tabModifiedTitles.has(tabId)) {
                                        tabModifiedTitles.delete(tabId);
                                        saveState();
                                        console.log(`[TAB ${tabId}] REVERT COMPLETE: Persistent record cleared.`);
                                    } else {
                                        console.log(`[TAB ${tabId}] TITLE RETAINED: No active rule match.`);
                                    }
                                }
                            }
                        } catch (e) {
                            console.log(`[TAB ${tabId}] TITLE CHECK ERROR:`, e);
                        }

                        // Stop page loading and wait for Firefox to settle the throbber
                        await browser.tabs.executeScript(tabId, { code: 'window.stop();' }).catch(() => {});
                        await new Promise(r => setTimeout(r, 2000));

                        // Discard with retries
                        let discarded = false;
                        for (let attempt = 0; attempt < 5; attempt++) {
                            try {
                                await browser.tabs.discard(tabId);
                                const check = await browser.tabs.get(tabId).catch(() => null);
                                if (!check || check.discarded) { discarded = true; break; }
                            } catch (e) {
                                console.log(`[TAB ${tabId}] DISCARD attempt ${attempt + 1} failed:`, e);
                                try {
                                    const windowTabs = await browser.tabs.query({ windowId: originalTab.windowId });
                                    const otherTab = windowTabs.find(t => t.id !== tabId && !t.discarded);
                                    if (otherTab) {
                                        await browser.tabs.update(otherTab.id, { active: true });
                                    }
                                } catch (_) {}
                            }
                            await new Promise(r => setTimeout(r, 500));
                        }
                        console.log(`[TAB ${tabId}] DONE: discarded=${discarded}`);
                    }
                } catch (e) {
                    console.error(`[TAB ${tabId}] ERROR:`, e);
                }
            };

            // Rolling worker pool: each worker pulls from a shared queue sequentially.
            // As soon as one tab finishes, the next starts — keeps exactly concurrencyLimit in-flight.
            let nextIndex = 0;
            const worker = async () => {
                while (true) {
                    const myIndex = nextIndex++;
                    if (myIndex >= previouslyDiscardedTabs.length) return;
                    await processOneTab(previouslyDiscardedTabs[myIndex]);
                    completedCount++;
                }
            };

            const workers = [];
            for (let i = 0; i < Math.min(concurrencyLimit, previouslyDiscardedTabs.length); i++) {
                workers.push(worker());
            }
            await Promise.all(workers);
        }

    } catch (e) {
        console.error('Error in syncAllTabs:', e);
    } finally {
        isSyncing = false;
        if (badgeUpdateInterval) clearInterval(badgeUpdateInterval);
        await browser.browserAction.setBadgeText({ text: "" }).catch(() => {});
        if (syncQueued) {
            syncQueued = false;
            syncAllTabs();
        }
    }
}
