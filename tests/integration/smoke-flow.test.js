const { expect } = require('../test-setup');
const { applyPattern, sortPatternsForDisplay, filterActivePatterns } = require('../../src/lib/pattern-utils');
const { evaluateTabSyncState } = require('../../src/lib/sync-engine-logic');
const { buildSavePatternUpdate } = require('../../src/lib/options-mutation-utils');
const { normalizeImportPayload } = require('../../src/lib/import-export-utils');

function createBrowserMock(initialStorage = {}, tabsList = []) {
    const store = { ...initialStorage };
    const tabsById = new Map(tabsList.map(t => [t.id, { ...t }]));

    const storageOnChangedListeners = [];
    const tabsOnRemovedListeners = [];
    const tabsOnUpdatedListeners = [];
    const tabsOnCreatedListeners = [];

    const calls = {
        tabsQuery: 0,
        tabsExecuteScript: [],
        storageSet: [],
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
            onRemoved: { addListener(cb) { tabsOnRemovedListeners.push(cb); } },
            onUpdated: { addListener(cb) { tabsOnUpdatedListeners.push(cb); } },
            onCreated: { addListener(cb) { tabsOnCreatedListeners.push(cb); } },
            async query() {
                calls.tabsQuery += 1;
                return Array.from(tabsById.values()).map(t => ({ ...t }));
            },
            async get(tabId) {
                const tab = tabsById.get(tabId);
                if (!tab) throw new Error('Tab not found');
                return { ...tab };
            },
            async executeScript(tabId, payload) {
                calls.tabsExecuteScript.push({ tabId, payload });
                return [];
            },
            async reload() {},
            async discard() {},
            async update() {},
        },
        browserAction: {
            async setBadgeBackgroundColor() {},
            async setBadgeText() {},
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

describe('cross-module smoke flows', function () {
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

    it('options-style save update triggers background sync and title update', async function () {
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
            [{
                id: 401,
                url: 'https://www.google.com/search?q=smoke',
                title: 'Untouched',
                status: 'complete',
                discarded: false,
                windowId: 1,
            }]
        );

        global.browser = env.browser;
        require('../../src/background/background.js');

        const update = buildSavePatternUpdate(env.store.patterns, {
            search: 'google\\.com',
            title: 'G: $0',
            groupValue: '',
        });

        await env.browser.storage.local.set(update);
        env.listeners.storageOnChangedListeners[0]({ patterns: { oldValue: [], newValue: update.patterns } }, 'local');
        await new Promise(resolve => setTimeout(resolve, 25));

        expect(env.calls.tabsExecuteScript).to.have.lengthOf(1);
        expect(env.calls.tabsExecuteScript[0].tabId).to.equal(401);
        expect(env.calls.tabsExecuteScript[0].payload.code).to.contain('G: google.com');
    });

    it('import normalization writes filtered metadata and still triggers sync path', async function () {
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
            [{
                id: 402,
                url: 'https://example.com',
                title: 'Example',
                status: 'complete',
                discarded: false,
                windowId: 1,
            }]
        );

        global.browser = env.browser;
        require('../../src/background/background.js');

        const normalized = normalizeImportPayload({
            metadata: {
                collapsedGroups: ['Work', 'Ghost'],
                disabledGroups: ['Ghost', 'Work'],
            },
            patterns: [
                { search: 'example\\.com', title: 'EX', group: 'Work' },
                { search: 'plain', title: 'P' },
            ],
        });

        await env.browser.storage.local.set(normalized);
        expect(env.store.collapsedGroups).to.deep.equal(['Work']);
        expect(env.store.disabledGroups).to.deep.equal(['Work']);

        env.listeners.storageOnChangedListeners[0]({ patterns: { oldValue: [], newValue: normalized.patterns } }, 'local');
        await new Promise(resolve => setTimeout(resolve, 25));

        expect(env.calls.tabsQuery).to.equal(1);
    });
});
