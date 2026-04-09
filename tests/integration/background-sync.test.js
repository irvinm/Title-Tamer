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

    it('syncAllTabs updates a loaded tab with a matching rule', async function () {
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
        expect(env.calls.tabsExecuteScript[0].payload.code).to.contain('G: google.com');
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
