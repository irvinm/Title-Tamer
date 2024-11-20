// background.js

// Function to update tab title based on stored REGEX patterns
async function updateTabTitle(tabId, changeInfo, tab, pattern) {

    console.log('Entering updateTabTitle -> tabId:', tabId, 'changeInfo:', changeInfo, 'tab:', tab, 'Pattern:', pattern);
    
    var wasDiscarded = false;

    // If pattern is provided, check only against that pattern for all tabs (new or updated pattern)
    if (pattern) {
        try {
            console.log('Checking pattern for all tabs');

            const { loadDiscardedTabs = false, reDiscardTabs = false, discardDelay = 0 } = await browser.storage.local.get(['loadDiscardedTabs', 'reDiscardTabs', 'discardDelay']); // Retrieve the values from storage
            const tabs = await browser.tabs.query({});
            const regex = new RegExp(pattern.search);
            const activeTab = (await browser.tabs.query({ active: true, currentWindow: true }))[0];  // Track the currently active tab
            const wokenUpTabs = [];

            for (const tab of tabs) {
                const matches = tab.url.match(regex);
                wasDiscarded = false;

                if (matches) {
                    console.log('tab.id', tab.id, 'Matches:', matches);
                    const newTitle = pattern.title.replace(/\$(\d+)/g, (match, number) => {
                        return matches[number] || match;
                    });

                    if (tab.discarded) {
                        if (loadDiscardedTabs) {    /* If discarded and loadDiscardedTabs is true, load the tab then update the title */
                            wasDiscarded = true;
                            console.log('Tab is discarded and loadDiscardedTabs is true, waking tab up.');
                            browser.tabs.update(tab.id, { active: true });
                            wokenUpTabs.push(tab.id);

                        } else {    /* If discarded and loadDiscardedTabs is false, do nothing */
                            console.log('Tab is discarded but loadDiscardedTabs is false, skipping update.');
                        }
                    } else {  /* Not discarded, just change title now */
                        console.log('Tab is not discarded, updating title: ', newTitle);  /* Tab should be awake now, update the title */
                        await browser.tabs.executeScript(tab.id, {
                            code: `document.title = "${newTitle}";`
                        });
                    }
                }
            }

            // Set the active tab back to the original active tab
            await browser.tabs.update(activeTab.id, { active: true });

            if (wokenUpTabs.length > 0) {
                await Promise.all(wokenUpTabs.map(tabId => new Promise((resolve) => {
                    const listener = (updatedTabId, changeInfo) => {
                        if (updatedTabId === tabId && changeInfo.status === 'complete') {
                            browser.tabs.onUpdated.removeListener(listener);
                            resolve();
                        }
                    };
                    browser.tabs.onUpdated.addListener(listener);
                })));
              
                // Update the titles of all woken-up tabs
                for (const { tabId, newTitle } of wokenUpTabs) {
                    await browser.tabs.executeScript(tabId, {
                        code: `document.title = "${newTitle}";`
                    });
                }

                // Add a delay after all tabs have finished loading based on discardDelay value
                await new Promise(resolve => setTimeout(resolve, discardDelay * 1000));
            }

            // Set the active tab back to the original active tab
            // await browser.tabs.update(activeTab.id, { active: true });

            // Discard all the tabs that were woken up if reDiscardTabs is true
            if (reDiscardTabs) {
                for (const tabId of wokenUpTabs) {
                    await browser.tabs.discard(tabId);
                }
            }

        } catch (e) {
            console.error(`Invalid regex pattern: ${pattern.regex}`, e);
        }
    } else {
        // Check all patterns just for the single tab (new or updated tab)
        console.log('Checking all patterns for single tab: changeInfo ->', changeInfo);
        try {
            const { loadDiscardedTabs = false, reDiscardTabs = false, discardDelay = 0 } = await browser.storage.local.get(['loadDiscardedTabs', 'reDiscardTabs', 'discardDelay']); // Retrieve the values from storage
            const result = await browser.storage.local.get('patterns');
            const patterns = result.patterns || [];
            
            wasDiscarded = false;  // Initialize wasDiscarded to false

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
                        /*
                        if (wasDiscarded) {
                            await browser.tabs.discard(tab.id);
                        }
                        */
                        break; // Exit the loop once a match is found
                    }
                } catch (e) {
                    console.error(`Invalid regex pattern: ${pattern.regex}`, e);
                }
            }
        } catch (e) {
            console.error('Error retrieving patterns:', e);
        }
    }

    console.log('Exiting updateTabTitle -> wasDiscarded:', wasDiscarded);
    return wasDiscarded;
    // Old working code
    /*
    if (changeInfo.title || changeInfo.url) {
        try {
            const result = await browser.storage.local.get('patterns');
            const patterns = result.patterns || [];
            for (const pattern of patterns) {
                try {
                    const regex = new RegExp(pattern.search);
                    const matches = tab.url.match(regex);
                    if (matches) {
                        console.log('Matches:', matches);
                        const newTitle = pattern.title.replace(/\$(\d+)/g, (match, number) => {
                            return matches[number] || match;
                        });
                        let wasDiscarded = false;
                        if (tab.discarded) {
                            wasDiscarded = true;
                            await browser.tabs.update(tabId, { active: true });
                        }
                        await browser.tabs.executeScript(tabId, {
                            code: `document.title = "${newTitle}";`
                        });
                        if (wasDiscarded) {
                            await browser.tabs.discard(tabId);
                        }
                        break;
                    }
                } catch (e) {
                    console.error(`Invalid regex pattern: ${pattern.regex}`, e);
                }
            }
        } catch (error) {
            console.error('Error accessing storage:', error);
        }
    }
    */
}

// Function to update tab title and handle discarded tabs
/*
async function updateTabTitleForPattern(tab, regex, title) {
    try {
        const regexObj = new RegExp(regex);
        const matches = tab.url.match(regexObj);
        if (matches) {
            console.log('Matches:', matches);
            const newTitle = title.replace(/\$(\d+)/g, (match, number) => {
                return matches[number] || match;
            });
            let wasDiscarded = false;
            if (tab.discarded) {
                wasDiscarded = true;
                await browser.tabs.update(tab.id, { active: true });
            }
            await browser.tabs.executeScript(tab.id, {
                code: `document.title = "${newTitle}";`
            });
            if (wasDiscarded) {
                await browser.tabs.discard(tab.id);
            }
        }
    } catch (e) {
        console.error(`Invalid regex pattern: ${regex}`, e);
    }
}
*/

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
        console.log('Rerunning patterns:', patterns);

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

        await new Promise(resolve => setTimeout(resolve, discardDelay * 1000));

        // Set the active tab back to the starting tab
        await browser.tabs.update(activeTab.id, { active: true });

        // Discard all the tabs that were previously discarded
        for (const tabId of previouslyDiscardedTabs) {
            await browser.tabs.discard(tabId);
        }
    } catch (error) {
        console.error('Error in rerunPatterns:', error);
    }
}