// background.js

// Function to update tab title based on stored REGEX patterns
async function updateTabTitle(tabId, changeInfo, tab) {
    if (changeInfo.title || changeInfo.url) {
        try {
            const result = await browser.storage.local.get('patterns');
            const patterns = result.patterns || [];
            for (const pattern of patterns) {
                try {
                    const regex = new RegExp(pattern.regex);
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
}

// Function to update tab title and handle discarded tabs
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

// Monitor tab creation and title changes
browser.tabs.onCreated.addListener((tab) => updateTabTitle(tab.id, { title: tab.title, url: tab.url }, tab));
browser.tabs.onUpdated.addListener(updateTabTitle);

// Handle messages from options.js
browser.runtime.onMessage.addListener(async (message) => {
    if (message.action === 'newPattern') {
        const { regex, title } = message.pattern;
        const tabs = await browser.tabs.query({});
        for (const tab of tabs) {
            await updateTabTitleForPattern(tab, regex, title);
        }
    }
});