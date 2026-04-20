// background.js

// Background State Machine to track title modifications over the lifecycle of tabs
const tabOriginalTitles = new Map(); // tabId -> String (the site's true, native title)
const tabModifiedTitles = new Map(); // tabId -> String (the manipulated title we set)

// Diagnostic logging — off by default, toggled via Options → Developer Tools.
// The flag is cached in memory so diagLog() is a zero-cost boolean check when disabled.
let diagLoggingEnabled = false;
const loggingReady = browser.storage.local.get('diagLogging').then(r => {
    diagLoggingEnabled = r.diagLogging === true;
}).catch(() => {});

function diagLog(...args) {
    if (diagLoggingEnabled) console.log(...args);
}

const syncStateUtils = (() => {
    if (globalThis.serializeSyncState && globalThis.hydrateSyncState) {
        return {
            serializeSyncState: globalThis.serializeSyncState,
            hydrateSyncState: globalThis.hydrateSyncState,
        };
    }

    if (typeof require !== 'undefined') {
        try {
            return require('../lib/sync-state-utils');
        } catch (_) {
            // Fall through to local fallback implementation.
        }
    }

    return {
        serializeSyncState(modifiedTitles, originalTitles) {
            return {
                modifiedTitles: Array.from(modifiedTitles.entries()),
                originalTitles: Array.from(originalTitles.entries()),
            };
        },
        hydrateSyncState(statePayload, targetModified, targetOriginal) {
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
        },
    };
})();

// Persistence Helpers
let saveTimeout = null;

async function saveState() {
    await initialStateLoadedPromise;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        const data = syncStateUtils.serializeSyncState(tabModifiedTitles, tabOriginalTitles);
        await browser.storage.local.set({ '_sync_state': data }).catch(() => {});
        saveTimeout = null;
    }, 500); // Debounce to allow batch updates
}

async function loadState() {
    try {
        const result = await browser.storage.local.get('_sync_state');
        if (result && result._sync_state) {
            syncStateUtils.hydrateSyncState(result._sync_state, tabModifiedTitles, tabOriginalTitles);
            console.log(`[STATE] Loaded records from storage (Modified: ${tabModifiedTitles.size}, Original: ${tabOriginalTitles.size})`);
        }
    } catch (e) {
        console.error('[STATE] Failed to load sync state:', e);
    }
}

// Initial load
const initialStateLoadedPromise = loadState();

// Helper to identify tabs that we are legally allowed to inject script into
function isInjectable(tab) {
    if (!tab || !tab.url) return false;
    // We strictly limit injection to web pages to avoid "Missing host permission" on system pages.
    const injectableSchemes = ['http:', 'https:', 'file:', 'ftp:'];
    return injectableSchemes.some(scheme => tab.url.startsWith(scheme));
}

// Clean up state when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
    const hadOriginal = tabOriginalTitles.delete(tabId);
    const hadModified = tabModifiedTitles.delete(tabId);
    if (hadOriginal || hadModified) {
        saveState();
    }
});

// Monitor tab updates (navigation, title changes, loading complete)
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    await loggingReady;
    
    // [DIAG] Log every onUpdated event so we can see the full sequence
    const ci = {};
    if (changeInfo.title  !== undefined) ci.title  = changeInfo.title?.substring(0, 60);
    if (changeInfo.url    !== undefined) ci.url    = changeInfo.url?.substring(0, 60);
    if (changeInfo.status !== undefined) ci.status = changeInfo.status;
    diagLog(`[DIAG][TAB ${tabId}] onUpdated | changeInfo=${JSON.stringify(ci)} | storedModified="${tabModifiedTitles.get(tabId)?.substring(0,40) ?? '(none)'}" | storedOriginal="${tabOriginalTitles.get(tabId)?.substring(0,40) ?? '(none)'}"`);

    // A URL change signals genuine SPA/navigation. Reset our modified-title record so
    // the incoming title from the new page is treated as the new original, not as the
    // site "fighting back" against our override.
    if (changeInfo.url && tabModifiedTitles.has(tabId)) {
        diagLog(`[DIAG][TAB ${tabId}] URL change detected — clearing modified title record and disconnecting guard.`);
        
        // Explicitly disconnect the guard before clearing the record.
        // This prevents the observer from re-asserting the old custom title 
        // if the URL change was a partial SPA navigation without a Full Page Reload.
        const disconnectScript = `(function() {
            if (window.__titleTamer_observer) {
                window.__titleTamer_observer.disconnect();
                window.__titleTamer_observer = null;
            }
        })()`;
        await browser.tabs.executeScript(tabId, { code: disconnectScript }).catch(() => {});
        
        tabModifiedTitles.delete(tabId);
        saveState();
    }

    // Intercept title changes
    if (changeInfo.title) {
        if (changeInfo.title === tabModifiedTitles.get(tabId)) {
            // Echo from our own executeScript modifier. Ignore to prevent loops.
            diagLog(`[DIAG][TAB ${tabId}] ECHO GUARD hit — title matches our injected value. Returning early.`);
            return;
        }

        if (tabModifiedTitles.has(tabId)) {
            // We have an active override and the title changed WITHOUT a URL change.
            // This is almost certainly the site re-asserting its own title post-hydration
            // or via a JS framework (e.g. React, Angular, Costco-style SPA re-render).
            // Do NOT update tabOriginalTitles — the value we stored on first load is still
            // the true original. Simply fall through so updateTabTitle() re-applies our rule.
            diagLog(`[DIAG][TAB ${tabId}] FIGHT-BACK detected — site set title to "${changeInfo.title?.substring(0, 60)}" while override is active. Will re-assert.`);
        } else {
            // No active override: this is a genuine native title change (e.g. SPA nav, new page).
            diagLog(`[DIAG][TAB ${tabId}] Genuine native title change (no override active). Storing as original: "${changeInfo.title?.substring(0, 60)}".`);
            tabOriginalTitles.set(tabId, changeInfo.title);
        }
    }
    
    // Evaluate rules when key tab properties change (title, url, or status: "complete")
    if (changeInfo.title || changeInfo.url || changeInfo.status === 'complete') {
        // Fetch fresh tab to avoid race conditions (e.g. tab.url or tab.status being out-of-date)
        const freshTab = await browser.tabs.get(tabId).catch(() => null);
        if (!freshTab) {
            diagLog(`[DIAG][TAB ${tabId}] freshTab is null — tab may have closed. Skipping.`);
        } else if (freshTab.status !== 'complete') {
            diagLog(`[DIAG][TAB ${tabId}] freshTab.status=${freshTab.status} (not complete) — skipping updateTabTitle for now.`);
        } else if (!isInjectable(freshTab)) {
            diagLog(`[DIAG][TAB ${tabId}] freshTab is not injectable (url=${freshTab.url?.substring(0,60)}) — skipping.`);
        } else {
            diagLog(`[DIAG][TAB ${tabId}] Calling updateTabTitle | freshTab.title="${freshTab.title?.substring(0,60)}" | freshTab.status=${freshTab.status}`);
            updateTabTitle(tabId, freshTab);
        }
    }
});

// Capture native title on tab creation
browser.tabs.onCreated.addListener(async (tab) => {
    await loggingReady;
    if (!isInjectable(tab)) return;
    if (tab.title) {
        tabOriginalTitles.set(tab.id, tab.title);
    }
    updateTabTitle(tab.id, tab);
});

// Core logic: Evaluate against all active rules and apply or revert the title
async function updateTabTitle(tabId, tab) {
    await initialStateLoadedPromise;
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
        let matchedPattern = null;
        for (const pattern of activePatterns) {
            const matchTest = applyPattern(tab.url, pattern);
            if (matchTest && matchTest.matched && matchTest.newTitle) {
                matchedTitle = matchTest.newTitle;
                matchedPattern = pattern;
                break;
            }
        }

        diagLog(`[DIAG][TAB ${tabId}] updateTabTitle | tab.title="${tab.title?.substring(0,60)}" | matchedTitle="${matchedTitle ?? '(none)'}" | activePatterns=${activePatterns.length}`);

        if (matchedTitle) {
            // A pattern matched. Always (re)install the guard so the MutationObserver
            // is present regardless of whether the current title already matches.
            // This prevents a gap where the guard is absent if we skip injection because
            // tab.title happened to equal matchedTitle at evaluation time.

            const needsTitleChange = tab.title !== matchedTitle;
            if (needsTitleChange) {
                diagLog(`[DIAG][TAB ${tabId}] INJECTING title: "${matchedTitle}" (was: "${tab.title?.substring(0,60)}")`);
                // Ensure we have captured the original title before overwriting it
                if (!tabOriginalTitles.has(tabId) && typeof tab.title === 'string') {
                     tabOriginalTitles.set(tabId, tab.title);
                     saveState();
                }
            } else {
                diagLog(`[DIAG][TAB ${tabId}] Title already matches rule — (re)installing guard only. title="${tab.title?.substring(0,60)}"`);
            }

            // Inject the MutationObserver guard into the page regardless of whether the
            // title needed changing. This ensures the guard is always active when a rule
            // matches, even if the title happened to already be correct at evaluation time.
            const injectGuard = (
                `(function() {
                    const TARGET = ${JSON.stringify(matchedTitle)};
                    // Disconnect any previous Title Tamer observer first
                    if (window.__titleTamer_observer) {
                        window.__titleTamer_observer.disconnect();
                        window.__titleTamer_observer = null;
                    }
                    // Apply the title immediately
                    document.title = TARGET;
                    // Find or create the <title> element
                    let titleEl = document.querySelector('title');
                    if (!titleEl) {
                        titleEl = document.createElement('title');
                        document.head.appendChild(titleEl);
                    }
                    // Install a MutationObserver to re-assert our title if the site changes it
                    const obs = new MutationObserver(() => {
                        if (document.title !== TARGET) {
                            document.title = TARGET;
                        }
                    });
                    obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
                    // Also observe the <head> in case the site removes/replaces <title>
                    // We use subtree: true to ensure we catch characterData changes
                    // even if the <title> node itself is replaced by the site.
                    obs.observe(document.head, { childList: true, subtree: true, characterData: true });
                    window.__titleTamer_observer = obs;
                })()`
            );
            
            try {
                await browser.tabs.executeScript(tabId, { code: injectGuard });
                
                // Record that we are enforcing a title on this tab (via guard)
                // ONLY after successful injection.
                tabModifiedTitles.set(tabId, matchedTitle);
                await saveState();
                
                diagLog(`[DIAG][TAB ${tabId}] GUARD ${needsTitleChange ? 'INJECT+' : 're-'}installed. tabModifiedTitles: "${tabModifiedTitles.get(tabId)?.substring(0,60)}"`);
            } catch (e) {
                if (e.message && e.message.includes("Missing host permission")) {
                    console.log(`[TAB ${tabId}] NOTICE: Transient host permission mismatch (Sync Engine will retry)`);
                } else {
                    console.log(`[TAB ${tabId}] executeScript failed for ${tab.url}:`, e);
                }
            }
        } else {
            // NO patterns matched. 
            // If we previously modified this tab, we need to REVERT it natively.
            if (tabModifiedTitles.has(tabId)) {
                const revertTo = tabOriginalTitles.get(tabId) || tab.title;
                diagLog(`[DIAG][TAB ${tabId}] No pattern matched. REVERTING from "${tab.title?.substring(0,60)}" to "${revertTo?.substring(0,60)}".`);
                
                // We keep the original in the map just in case.
                
                // Tear down the MutationObserver guard and revert the title
                const revertScript = (
                    `(function() {
                        if (window.__titleTamer_observer) {
                            window.__titleTamer_observer.disconnect();
                            window.__titleTamer_observer = null;
                        }
                        document.title = ${JSON.stringify(revertTo)};
                    })()`
                );
                
                try {
                    await browser.tabs.executeScript(tabId, { code: revertScript });
                    
                    // We only stop tracking the modification if the revert script actually ran.
                    // This keeps the engine aware that the tab might still have an active guard
                    // if the revert failed.
                    tabModifiedTitles.delete(tabId);
                    await saveState();
                } catch (e) {
                    console.log(`[TAB ${tabId}] executeScript revert failed for ${tab.url}:`, e);
                }
            } else {
                diagLog(`[DIAG][TAB ${tabId}] No pattern matched, no override active. Nothing to do.`);
            }
        }

    } catch (e) {
        console.error('Error in updateTabTitle:', e);
    }
}

// Universal Sync Receiver: Triggered automatically whenever rules or active statuses change in storage
browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        // Keep the in-memory diagLogging flag in sync so the toggle takes effect immediately
        if (changes.diagLogging !== undefined) {
            diagLoggingEnabled = changes.diagLogging.newValue === true;
        }
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
    await initialStateLoadedPromise;
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

                    // Verify/inject the correct title after waking the tab.
                    // We delegate to updateTabTitle here so the MutationObserver guard 
                    // is installed consistently with the normal loaded-tab path,
                    // preventing fight-back on freshly-woken tabs.
                    try {
                        const finalTab = await browser.tabs.get(tabId);
                        if (finalTab) {
                            await updateTabTitle(tabId, finalTab);
                            console.log(`[TAB ${tabId}] Wake-up sync complete (via updateTabTitle).`);
                        }
                    } catch (e) {
                        console.log(`[TAB ${tabId}] TITLE UPDATE ERROR:`, e);
                    }

                    // Re-discard the tab if required
                    if (reDiscardTabs) {
                        if (discardDelay > 0) {
                            await new Promise(r => setTimeout(r, discardDelay * 1000));
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
                    }
                } catch (e) {}
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

// Export for Node test environments.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        saveState,
        loadState,
        isInjectable,
        updateTabTitle,
        syncAllTabs,
    };
}

