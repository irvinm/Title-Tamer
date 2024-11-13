// background.js

// Function to update tab title based on stored REGEX patterns
async function updateTabTitle(tabId, changeInfo, tab, pattern) {

    console.log('Entering updateTabTitle -> tabId:', tabId, 'changeInfo:', changeInfo, 'tab:', tab, 'Pattern:', pattern);
    
    // If pattern is provided, check only against that pattern for all tabs (new or updated pattern)
    if (pattern) {
        try {
            console.log('Checking pattern for all tabs');
            const tabs = await browser.tabs.query({});
            const regex = new RegExp(pattern.search);
            for (const tab of tabs) {
                const matches = tab.url.match(regex);
                if (matches) {
                    console.log('tab.id', tab.id, 'Matches:', matches);
                    const newTitle = pattern.title.replace(/\$(\d+)/g, (match, number) => {
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
            }
        } catch (e) {
            console.error(`Invalid regex pattern: ${pattern.regex}`, e);
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
    if (changeInfo.title || changeInfo.url) {   /* Only call if title or url changes */
        updateTabTitle(tabId, changeInfo, tab, pattern=undefined);
    }
});

// Handle messages from options.js
// New or updated pattern ... check all tabs to see if they need to be updated against single pattern
browser.runtime.onMessage.addListener(async (message) => {
    if (message.action === 'newPattern') {
        console.log('New pattern:', message.pattern);
        const { search, title } = message.pattern;
        const tabs = await browser.tabs.query({});
        for (const tab of tabs) {
            /* await updateTabTitle(tab, search, title); */
            /* await updateTabTitle(tab.id, {title: tab.title, url: tab.url }, tab, message.pattern); */
            /* await updateTabTitle(null, null, null, message.pattern); */
        }
        await updateTabTitle(null, null, null, message.pattern);
    }
});