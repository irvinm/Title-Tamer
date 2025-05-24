// background.js

// Function to update tab title based on stored REGEX patterns
async function updateTabTitle(tabId, changeInfo, tab, pattern) {
    let wasDiscarded = false;

    try {
        console.log('Entering updateTabTitle -> tabId:', tabId, 'changeInfo:', changeInfo, 'tab:', tab, 'Pattern:', pattern);
        
        // Retrieve the values from storage with error handling
        let loadDiscardedTabs = false;
        let reDiscardTabs = false;
        let discardDelay = 0;
        try {
            const storageValues = await browser.storage.local.get(['loadDiscardedTabs', 'reDiscardTabs', 'discardDelay']);
            loadDiscardedTabs = storageValues.loadDiscardedTabs || false;
            reDiscardTabs = storageValues.reDiscardTabs || false;
            discardDelay = storageValues.discardDelay || 0;
        } catch (storageError) {
            console.error('Error retrieving storage values:', storageError);
        }

        // If pattern is provided, check only against that pattern for all tabs (new or updated pattern)
        if (pattern) {
            try {
                console.log('Checking pattern for all tabs');
                const tabs = await browser.tabs.query({});
                const regex = new RegExp(pattern.search);

                // Track the currently active tab
                const activeTab = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
                const wokenUpTabs = [];

                for (const tab of tabs) {
                    const matches = tab.url.match(regex);
                    if (matches) {
                        console.log('tab.id', tab.id, 'Matches:', matches);
                        const newTitle = pattern.title.replace(/\$(\d+)/g, (match, number) => {
                            return matches[number] || match;
                        });
                        if (tab.discarded) {
                            if (loadDiscardedTabs) {    /* If discarded and loadDiscardedTabs is true, load the tab then update the title */
                                wasDiscarded = true;
                                console.log('Tab is discarded and loadDiscardedTabs is true, waking tab up.');
                                await browser.tabs.update(tab.id, { active: true });
                                wokenUpTabs.push({ tabId: tab.id, newTitle });
                            } else {    /* If discarded and loadDiscardedTabs is false, do nothing */
                                console.log('Tab is discarded and loadDiscardedTabs is false, skipping update.');
                            }
                        } else {    /* If not discarded, update the tab to make it active and update the title */
                            console.log('Tab is not discarded, updating title: ', newTitle);
                            await browser.tabs.executeScript(tab.id, {
                                code: `document.title = "${newTitle}";`
                            });
                        }
                    }
                }

                // Set the active tab back to the original active tab
                await browser.tabs.update(activeTab.id, { active: true });

                if (wokenUpTabs.length > 0) {
                    await Promise.all(wokenUpTabs.map(({ tabId }) => new Promise((resolve) => {
                        const listener = (updatedTabId, changeInfo) => {
                            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                                browser.tabs.onUpdated.removeListener(listener);
                                resolve();
                            }
                        };
                        browser.tabs.onUpdated.addListener(listener);
                    })));

                    // Add a delay after all tabs have finished loading based on discardDelay value
                    console.log(`Waiting for ${discardDelay} seconds delay before discarding tabs...`);
                    await new Promise(resolve => setTimeout(resolve, discardDelay * 1000));

                    // Update the titles of all woken-up tabs
                    for (const { tabId, newTitle } of wokenUpTabs) {
                        await browser.tabs.executeScript(tabId, {
                            code: `document.title = "${newTitle}";`
                        });
                    }
                }

                // Discard all the tabs that were woken up if reDiscardTabs is true
                if (reDiscardTabs) {
                    for (const { tabId } of wokenUpTabs) {
                        await browser.tabs.discard(tabId);
                    }
                }

            } catch (e) {
                console.error(`Invalid regex pattern: ${pattern.search}`, e);
            }
        } else {
            // Check all patterns just for the single tab (new or updated tab)
            console.log('Checking all patterns for single tab: changeInfo ->', changeInfo);
            try {
                const result = await browser.storage.local.get('patterns');
                const patterns = result.patterns || [];
                for (const pattern of patterns) {
                    console.log('tabId', tabId, 'Pattern:', pattern);
                    try {
                        const regex = new RegExp(pattern.search);
                        const matches = tab.url.match(regex);
                        if (matches) {
                            console.log('tabId', tabId, 'Matches:', matches);
                            const newTitle = pattern.title.replace(/\$(\d+)/g, (match, number) => {
                                return matches[number] || match;
                            });
                            if (tab.discarded && loadDiscardedTabs) {    /* If discarded, process single tab after transition */
                                wasDiscarded = true;
                                await browser.tabs.update(tab.id, { active: true });
                            } else {  /* Not discarded, just change title now */
                                await browser.tabs.executeScript(tab.id, {
                                    code: `document.title = "${newTitle}";`
                                });
                            }
                            if (wasDiscarded) {
                                await browser.tabs.discard(tab.id);
                            }
                            break; // Exit the loop once a match is found
                        }
                    } catch (e) {
                        console.error(`Invalid regex pattern: ${pattern.search}`, e);
                    }
                }
            } catch (e) {
                console.error('Error retrieving patterns:', e);
            }
        }
    } catch (error) {
        console.error('Error in updateTabTitle:', error);
    }

    return wasDiscarded;
}

// Monitor tab creation and title changes
browser.tabs.onCreated.addListener((tab) => {
    console.log('Tab created:', tab);
    updateTabTitle(tab.id, { title: tab.title, url: tab.url }, tab, undefined);
});

// Monitor tab updates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log('Tab updated:', tabId, changeInfo, tab);

    if (changeInfo.title || changeInfo.url || changeInfo.status === 'complete') {
        console.log('changeInfo = title, url or status=complete');
        updateTabTitle(tabId, changeInfo, tab, pattern=undefined);
    }
});

// Handle messages from options.js
// New or updated pattern ... check all tabs to see if they need to be updated against single pattern
browser.runtime.onMessage.addListener(async (message) => {
    if (message.action === 'newPattern') {
        console.log('Received new pattern message:', message.pattern);
        updateTabTitle(null, null, null, message.pattern);
    }
    // Handle deletePatternReload for restoring original titles
    if (message.action === 'deletePatternReload') {
        await handleDeletePatternReload(message.pattern, message.reloadDiscarded);
    }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'rerunPatterns') {
        rerunPatterns();
    }
});

async function rerunPatterns() {
    try {
        const result = await browser.storage.local.get('patterns');
        const discardDelay = await browser.storage.local.get('discardDelay');
        const patterns = result.patterns || [];
        console.log('Rerunning patterns with delay:', patterns, discardDelay);

        // Track the currently active tab
        const activeTab = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
        const previouslyDiscardedTabs = [];

        const tabs = await browser.tabs.query({});
        for (const tab of tabs) {
            const wasDiscarded = await updateTabTitle(tab.id, undefined, tab, undefined);
            if (wasDiscarded) {
                previouslyDiscardedTabs.push(tab.id);
            }
        }

        // Set the active tab back to the starting tab
        await browser.tabs.update(activeTab.id, { active: true });
        
        if (previouslyDiscardedTabs.length > 0) {
            await Promise.all(previouslyDiscardedTabs.map(tabId => new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    browser.tabs.onUpdated.removeListener(listener);
                    reject(new Error(`Timeout waiting for tab ${tabId} to load`));
                }, 10000); // 10 seconds timeout

                const listener = (updatedTabId, changeInfo) => {
                    if (updatedTabId === tabId && changeInfo.status === 'complete') {
                        clearTimeout(timeout);
                        browser.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                };

                browser.tabs.onUpdated.addListener(listener);
            }))).catch(error => {
                console.error('Error waiting for tabs to load:', error);
            });
        }
        
        // Delay handling
        console.log(`Waiting for ${discardDelay} seconds delay before discarding tabs...`);
        await new Promise(resolve => setTimeout(resolve, discardDelay.discardDelay * 1000));

        // Discard all the tabs that were previously discarded
        for (const tabId of previouslyDiscardedTabs) {
            browser.tabs.discard(tabId);
        }
    } catch (error) {
        console.error('Error in rerunPatterns:', error);
    }
}

// Handle restoring original titles after rule deletion
async function handleDeletePatternReload(deletedPattern, reloadDiscarded) {
    try {
        // Find all tabs that matched the deleted pattern
        const regex = new RegExp(deletedPattern.search);
        const tabs = await browser.tabs.query({});
        const affectedTabs = tabs.filter(tab => tab.url && regex.test(tab.url));
        const discardDelay = (await browser.storage.local.get('discardDelay')).discardDelay || 1;
        for (const tab of affectedTabs) {
            if (tab.discarded) {
                if (reloadDiscarded) {
                    // Wake up the tab (reload)
                    await browser.tabs.update(tab.id, { active: true });
                    // Wait for the tab to finish loading
                    await new Promise(resolve => {
                        const listener = (updatedTabId, changeInfo) => {
                            if (updatedTabId === tab.id && changeInfo.status === 'complete') {
                                browser.tabs.onUpdated.removeListener(listener);
                                resolve();
                            }
                        };
                        browser.tabs.onUpdated.addListener(listener);
                    });
                    // Wait for configured delay
                    await new Promise(resolve => setTimeout(resolve, discardDelay * 1000));
                    // Discard the tab again
                    await browser.tabs.discard(tab.id);
                }
                // If not reloading discarded tabs, do nothing
            } else {
                // Reload the tab to restore the original title
                await browser.tabs.reload(tab.id);
            }
        }
    } catch (error) {
        console.error('Error in handleDeletePatternReload:', error);
    }
}