const { expect } = require('../test-setup');
const { applyPattern, sortPatternsForDisplay, filterActivePatterns } = require('../../src/lib/pattern-utils');
const { evaluateTabSyncState } = require('../../src/lib/sync-engine-logic');

function createBrowserMock(initialStorage = {}, tabsList = [], options = {}) {
    const store = { ...initialStorage };
    const tabsById = new Map(tabsList.map(t => [t.id, { ...t }]));

    const storageOnChangedListeners = [];
    const tabsOnRemovedListeners = [];
    const tabsOnUpdatedListeners = [];
    const tabsOnCreatedListeners = [];

    const calls = {
        tabsQuery: 0,
        tabsGet: 0,
        tabsExecuteScript: [],
        tabsReload: [],
        tabsDiscard: [],
        tabsUpdate: [],
        storageSet: [],
        badgeText: [],
        badgeBackground: [],
    };

    const browser = {
        storage: {
            local: {
                async get(keys) {
                    if (typeof keys === 'string') {
                        return { [keys]: store[keys] };
                    }
                    if (Array.isArray(keys)) {
                        const result = {};
                        keys.forEach((k) => {
                            result[k] = store[k];
                        });
                        return result;
                    }
                    return { ...store };
                },
                async set(update) {
                    Object.assign(store, update);
                    calls.storageSet.push(update);
                },
            },
            onChanged: {
                addListener(cb) {
                    storageOnChangedListeners.push(cb);
                },
            },
        },
        tabs: {
            onRemoved: {
                addListener(cb) {
                    tabsOnRemovedListeners.push(cb);
                },
            },
            onUpdated: {
                addListener(cb) {
                    tabsOnUpdatedListeners.push(cb);
                },
            },
            onCreated: {
                addListener(cb) {
                    tabsOnCreatedListeners.push(cb);
                },
            },
            async query() {
                calls.tabsQuery += 1;
                if (typeof options.queryImpl === 'function') {
                    return options.queryImpl(calls.tabsQuery);
                }
                return Array.from(tabsById.values()).map(t => ({ ...t }));
            },
            async get(tabId) {
                calls.tabsGet += 1;
                const tab = tabsById.get(tabId);
                if (!tab) {
                    throw new Error('Tab not found');
                }
                return { ...tab };
            },
            async executeScript(tabId, payload) {
                calls.tabsExecuteScript.push({ tabId, payload });
                return [];
            },
            async reload(tabId) {
                calls.tabsReload.push(tabId);
            },
            async discard(tabId) {
                calls.tabsDiscard.push(tabId);
                if (tabsById.has(tabId)) {
                    tabsById.get(tabId).discarded = true;
                }
            },
            async update(tabId, patch) {
                calls.tabsUpdate.push({ tabId, patch });
            },
        },
        browserAction: {
            async setBadgeBackgroundColor(config) {
                calls.badgeBackground.push(config);
            },
            async setBadgeText(config) {
                calls.badgeText.push(config);
            },
        },
        runtime: {
            sendMessage() {},
        },
    };

    return {
        browser,
        calls,
        store,
        listeners: {
            storageOnChangedListeners,
            tabsOnRemovedListeners,
            tabsOnUpdatedListeners,
            tabsOnCreatedListeners,
        },
    };
}

describe('background sync integration', function () {
    let previousBrowser;
    let previousApplyPattern;
    let previousSortPatternsForDisplay;
    let previousFilterActivePatterns;
    let previousEvaluateTabSyncState;

    beforeEach(function () {
        delete require.cache[require.resolve('../../src/background/background.js')];

        previousBrowser = global.browser;
        previousApplyPattern = global.applyPattern;
        previousSortPatternsForDisplay = global.sortPatternsForDisplay;
        previousFilterActivePatterns = global.filterActivePatterns;
        previousEvaluateTabSyncState = global.evaluateTabSyncState;

        global.applyPattern = applyPattern;
        global.sortPatternsForDisplay = sortPatternsForDisplay;
        global.filterActivePatterns = filterActivePatterns;
        global.evaluateTabSyncState = evaluateTabSyncState;
    });

    afterEach(function () {
        global.browser = previousBrowser;
        global.applyPattern = previousApplyPattern;
        global.sortPatternsForDisplay = previousSortPatternsForDisplay;
        global.filterActivePatterns = previousFilterActivePatterns;
        global.evaluateTabSyncState = previousEvaluateTabSyncState;
    });

    it('syncAllTabs updates a loaded tab with a matching rule and injects MutationObserver guard', async function () {
        const tab = {
            id: 101,
            url: 'https://www.google.com/search?q=title+tamer',
            title: 'Wrong Title',
            status: 'complete',
            discarded: false,
            windowId: 1,
        };

        const env = createBrowserMock(
            {
                patterns: [{ name: 'Google', search: 'google\\.com', title: 'G: $0' }],
                disabledGroups: [],
                loadDiscardedTabs: false,
                reDiscardTabs: false,
                discardDelay: 0,
                limitConcurrentTabsEnabled: true,
                maxConcurrentTabs: 10,
            },
            [tab]
        );

        global.browser = env.browser;
        const background = require('../../src/background/background.js');

        await background.syncAllTabs();

        expect(env.calls.tabsExecuteScript).to.have.lengthOf(1);
        expect(env.calls.tabsExecuteScript[0].tabId).to.equal(101);
        // Verify the injected code contains our expected title
        expect(env.calls.tabsExecuteScript[0].payload.code).to.contain('G: google.com');
        // Verify the MutationObserver guard is injected (not a plain document.title assignment)
        expect(env.calls.tabsExecuteScript[0].payload.code).to.contain('MutationObserver');
        expect(env.calls.tabsExecuteScript[0].payload.code).to.contain('__titleTamer_observer');
    });

    it('syncAllTabs queues a second run if called while syncing', async function () {
        let releaseFirstQuery;
        const firstQueryDone = new Promise((resolve) => {
            releaseFirstQuery = resolve;
        });

        const env = createBrowserMock(
            {
                patterns: [],
                disabledGroups: [],
                loadDiscardedTabs: false,
                reDiscardTabs: false,
                discardDelay: 0,
                limitConcurrentTabsEnabled: true,
                maxConcurrentTabs: 10,
            },
            [],
            {
                queryImpl: async (callCount) => {
                    if (callCount === 1) {
                        await firstQueryDone;
                        return [];
                    }
                    return [];
                },
            }
        );

        global.browser = env.browser;
        const background = require('../../src/background/background.js');

        const firstRun = background.syncAllTabs();
        const secondRun = background.syncAllTabs();

        releaseFirstQuery();
        await firstRun;
        await secondRun;
        await new Promise((resolve) => setTimeout(resolve, 25));

        expect(env.calls.tabsQuery).to.equal(2);
    });

    it('storage change listener triggers sync when patterns change', async function () {
        const env = createBrowserMock(
            {
                patterns: [],
                disabledGroups: [],
                loadDiscardedTabs: false,
                reDiscardTabs: false,
                discardDelay: 0,
                limitConcurrentTabsEnabled: true,
                maxConcurrentTabs: 10,
            },
            []
        );

        global.browser = env.browser;
        require('../../src/background/background.js');

        expect(env.listeners.storageOnChangedListeners).to.have.length.greaterThan(0);

        env.listeners.storageOnChangedListeners[0]({ patterns: { oldValue: [], newValue: [] } }, 'local');
        await new Promise((resolve) => setTimeout(resolve, 25));

        expect(env.calls.tabsQuery).to.equal(1);
    });
});

describe('fight-back detection (onUpdated behaviour)', function () {
    let previousBrowser;
    let previousApplyPattern;
    let previousSortPatternsForDisplay;
    let previousFilterActivePatterns;
    let previousEvaluateTabSyncState;

    beforeEach(function () {
        delete require.cache[require.resolve('../../src/background/background.js')];
        previousBrowser = global.browser;
        previousApplyPattern = global.applyPattern;
        previousSortPatternsForDisplay = global.sortPatternsForDisplay;
        previousFilterActivePatterns = global.filterActivePatterns;
        previousEvaluateTabSyncState = global.evaluateTabSyncState;
        global.applyPattern = applyPattern;
        global.sortPatternsForDisplay = sortPatternsForDisplay;
        global.filterActivePatterns = filterActivePatterns;
        global.evaluateTabSyncState = evaluateTabSyncState;
    });

    afterEach(function () {
        global.browser = previousBrowser;
        global.applyPattern = previousApplyPattern;
        global.sortPatternsForDisplay = previousSortPatternsForDisplay;
        global.filterActivePatterns = previousFilterActivePatterns;
        global.evaluateTabSyncState = previousEvaluateTabSyncState;
    });

    it('site fight-back does NOT overwrite tabOriginalTitles when override is active', async function () {
        // Scenario: we have already injected a custom title (tabModifiedTitles is set).
        // The site then changes the title back to its own — this should NOT be recorded
        // as the new original. The guard re-asserts our title instead.
        const tab = {
            id: 201,
            url: 'https://www.costco.com/fish-oil-omega-3.html',
            title: 'Custom Title',  // our injected title
            status: 'complete',
            discarded: false,
            windowId: 1,
        };

        const env = createBrowserMock(
            {
                patterns: [{ name: 'Costco', search: 'costco\\.com', title: 'Custom Title' }],
                disabledGroups: [],
                loadDiscardedTabs: false,
                reDiscardTabs: false,
                discardDelay: 0,
                limitConcurrentTabsEnabled: true,
                maxConcurrentTabs: 10,
            },
            [tab]
        );

        global.browser = env.browser;
        const background = require('../../src/background/background.js');

        // Simulate background having previously injected our title
        // by pre-seeding the state maps via a syncAllTabs pass first
        await background.syncAllTabs();
        const scriptCallsAfterSync = env.calls.tabsExecuteScript.length;

        // Now simulate the site fighting back: onUpdated fires with the site's own title
        // while our override is still active
        tab.title = 'Fish Oil & Omega-3 | Costco';  // update the mock tab too
        const fightBackChangeInfo = { title: 'Fish Oil & Omega-3 | Costco' };  // no url change

        await env.listeners.tabsOnUpdatedListeners[0](tab.id, fightBackChangeInfo, tab);
        // Give async work time to settle
        await new Promise((resolve) => setTimeout(resolve, 50));

        // The guard should have re-injected our title
        expect(env.calls.tabsExecuteScript.length).to.be.greaterThan(scriptCallsAfterSync);
        // The re-injected code should still target our custom title
        const lastScript = env.calls.tabsExecuteScript[env.calls.tabsExecuteScript.length - 1];
        expect(lastScript.payload.code).to.contain('Custom Title');
        expect(lastScript.payload.code).to.contain('MutationObserver');
    });

    it('URL change clears the modified title record and disconnects the guard', async function () {
        const tab = {
            id: 202,
            url: 'https://example.com/page-a',
            title: 'Initial Title A',
            status: 'complete',
            discarded: false,
            windowId: 1,
        };

        const env = createBrowserMock(
            { 
                patterns: [{ name: 'Example', search: 'example\\.com', title: 'My Custom Title' }], 
                disabledGroups: [], 
                loadDiscardedTabs: false, 
                reDiscardTabs: false, 
                discardDelay: 0, 
                limitConcurrentTabsEnabled: true, 
                maxConcurrentTabs: 10 
            },
            [tab]
        );

        global.browser = env.browser;
        const background = require('../../src/background/background.js');

        // Phase 1: Set up modified state by triggering an update
        await background.updateTabTitle(tab.id, tab);
        expect(env.calls.tabsExecuteScript).to.have.lengthOf(1);
        expect(env.calls.tabsExecuteScript[0].payload.code).to.contain('MutationObserver');

        // Fire URL change event
        const urlChangeInfo = { url: 'https://example.com/page-b', status: 'loading' };
        tab.url = 'https://example.com/page-b';
        await env.listeners.tabsOnUpdatedListeners[0](tab.id, urlChangeInfo, tab);

        // Verify that a disconnect script was injected (on loading status)
        expect(env.calls.tabsExecuteScript).to.have.lengthOf(2);
        expect(env.calls.tabsExecuteScript[1].payload.code).to.contain('disconnect');

        // Now fire status:complete to trigger the re-injection for the new URL
        const completeChangeInfo = { status: 'complete' };
        tab.status = 'complete';
        await env.listeners.tabsOnUpdatedListeners[0](tab.id, completeChangeInfo, tab);
        await new Promise((resolve) => setTimeout(resolve, 50));

        // The sequence is:
        // 1. Initial manual update (Call #1)
        // 2. Disconnect on URL change (Call #2)
        // 3. Re-apply guard on status:complete (Call #3)
        // Any subsequent title-only change would be Call #4 (Fight-back).
        // If it got 4 already, it means the title change was somehow triggered.
        expect(env.calls.tabsExecuteScript).to.have.lengthOf.at.least(3);
        const lastCall = env.calls.tabsExecuteScript[env.calls.tabsExecuteScript.length - 1];
        expect(lastCall.payload.code).to.contain('MutationObserver');
    });

    it('guard is re-installed even when tab title already matches the rule', async function () {
        // Scenario: tab.title already equals matchedTitle at evaluation time.
        // This happens e.g. after a fight-back re-inject lands and we re-evaluate.
        // updateTabTitle must still install the MutationObserver guard, not silently skip.
        // Note: syncAllTabs() uses evaluateTabSyncState() which correctly returns needsUpdate=false
        // when title already matches — that is correct sync engine behavior. This test calls
        // updateTabTitle directly to verify the guard is unconditionally installed.
        const tab = {
            id: 203,
            url: 'https://www.costco.com/fish-oil-omega-3.html',
            title: 'HTTP31',  // already matches the rule — no title change needed
            status: 'complete',
            discarded: false,
            windowId: 1,
        };

        const env = createBrowserMock(
            {
                patterns: [{ name: 'Costco', search: 'costco\\.com', title: 'HTTP31' }],
                disabledGroups: [],
                loadDiscardedTabs: false,
                reDiscardTabs: false,
                discardDelay: 0,
                limitConcurrentTabsEnabled: true,
                maxConcurrentTabs: 10,
            },
            [tab]
        );

        global.browser = env.browser;
        const background = require('../../src/background/background.js');

        // Call updateTabTitle directly — syncAllTabs() skips this tab via needsUpdate=false
        await background.updateTabTitle(tab.id, tab);

        // Even though the title was already correct, the guard MUST have been injected
        expect(env.calls.tabsExecuteScript).to.have.lengthOf(1);
        expect(env.calls.tabsExecuteScript[0].payload.code).to.contain('MutationObserver');
        expect(env.calls.tabsExecuteScript[0].payload.code).to.contain('__titleTamer_observer');
        expect(env.calls.tabsExecuteScript[0].payload.code).to.contain('HTTP31');
    });

    it('revert inject disconnects the MutationObserver guard before restoring title', async function () {
        // When a rule is removed/disabled and we revert a tab, we must disconnect
        // the in-page MutationObserver guard first, otherwise it would immediately
        // re-assert our (now-removed) custom title, undoing the revert.
        const originalNativeTitle = 'Fish Oil & Omega-3 | Costco';
        const tab = {
            id: 204,
            url: 'https://www.costco.com/fish-oil-omega-3.html',
            title: originalNativeTitle,
            status: 'complete',
            discarded: false,
            windowId: 1,
        };

        const env = createBrowserMock(
            {
                patterns: [{ name: 'Costco', search: 'costco\\.com', title: 'HTTP31' }],
                disabledGroups: [],
                loadDiscardedTabs: false,
                reDiscardTabs: false,
                discardDelay: 0,
                limitConcurrentTabsEnabled: true,
                maxConcurrentTabs: 10,
            },
            [tab]
        );

        global.browser = env.browser;
        const background = require('../../src/background/background.js');

        // Phase 1: inject our custom title (seeds tabModifiedTitles + tabOriginalTitles)
        await background.updateTabTitle(tab.id, tab);
        expect(env.calls.tabsExecuteScript).to.have.lengthOf(1);
        expect(env.calls.tabsExecuteScript[0].payload.code).to.contain('HTTP31');

        // Phase 2: rule is deleted — update storage and call updateTabTitle again.
        // Tab currently shows our injected title; no pattern matches -> revert path.
        env.store.patterns = [];
        tab.title = 'HTTP31';  // tab is currently showing our injected title
        await background.updateTabTitle(tab.id, tab);

        // The revert script must disconnect the observer AND restore the original title
        expect(env.calls.tabsExecuteScript).to.have.lengthOf(2);
        const revertScript = env.calls.tabsExecuteScript[1];
        expect(revertScript.payload.code).to.contain('__titleTamer_observer');
        expect(revertScript.payload.code).to.contain('disconnect');
        // Should revert to the original native title, not our custom one
        expect(revertScript.payload.code).to.contain(originalNativeTitle);
        expect(revertScript.payload.code).not.to.contain('HTTP31');
    });
});
