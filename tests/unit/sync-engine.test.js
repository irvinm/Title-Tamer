/**
 * sync-engine.test.js
 * 
 * Unit tests for evaluateTabSyncState in src/lib/sync-engine-logic.js
 */

const { expect } = require('../test-setup');
const { applyPattern } = require('../../src/lib/pattern-utils');
const { evaluateTabSyncState } = require('../../src/lib/sync-engine-logic');

// Mock applyPattern (or use the real one since it's pure)
// The test environment needs applyPattern to be in scope for evaluateTabSyncState.
global.applyPattern = applyPattern;

describe('Sync Engine Decision Logic', function () {
    const activePatterns = [
        { name: 'Google', search: 'google\\.com', title: 'G: $0' },
        { name: 'Amazon', search: 'amazon\\.com/dp/([^/]+)', title: 'AZ: $1' }
    ];

    const inactivePatterns = [
        { name: 'Old Rule', search: 'old\\.com', title: 'OLD!', enabled: false }
    ];

    const disabledGroups = [];
    const tabModifiedTitles = new Map();
    const tabOriginalTitles = new Map();

    beforeEach(() => {
        tabModifiedTitles.clear();
        tabOriginalTitles.clear();
    });

    it('should stay quiet if title already matches active rule', function () {
        const tab = { id: 1, url: 'https://www.google.com', title: 'G: google.com' };
        const result = evaluateTabSyncState(tab, activePatterns, activePatterns, disabledGroups, tabModifiedTitles, tabOriginalTitles);
        
        expect(result.needsUpdate).to.be.false;
    });

    it('should trigger update if active rule matches but title is wrong', function () {
        const tab = { id: 1, url: 'https://www.google.com', title: 'Wrong Title' };
        const result = evaluateTabSyncState(tab, activePatterns, activePatterns, disabledGroups, tabModifiedTitles, tabOriginalTitles);
        
        expect(result.needsUpdate).to.be.true;
        expect(result.updateReason).to.contain('Title mismatch');
        expect(result.matchedTitle).to.equal('G: google.com');
    });

    it('should trigger update for "Elephant Memory" (dirty tab with no rule)', function () {
        // Tab was modified to "STUCK" in a previous session, but now no rule matches it.
        const tab = { id: 1, url: 'https://example.com', title: 'STUCK' };
        tabModifiedTitles.set(1, 'STUCK');

        const result = evaluateTabSyncState(tab, activePatterns, activePatterns, disabledGroups, tabModifiedTitles, tabOriginalTitles);
        
        expect(result.needsUpdate).to.be.true;
        expect(result.updateReason).to.contain('Elephant Memory');
    });

    it('should trigger update for "Skeptical Engine" (discarded tab with HTTP! marker)', function () {
        // Tab is discarded and has the old "HTTP!" markers. No rule matches it.
        const tab = { id: 1, url: 'https://some-site.com', title: 'HTTP30!', discarded: true };
        
        const result = evaluateTabSyncState(tab, activePatterns, activePatterns, disabledGroups, tabModifiedTitles, tabOriginalTitles);
        
        expect(result.needsUpdate).to.be.true;
        expect(result.updateReason).to.contain('Skeptical Engine');
    });

    it('should trigger update for "Amnesia Recovery" (discarded tab matching inactive rule)', function () {
        // Tab is discarded and matches a rule that is currently disabled.
        const tab = { id: 1, url: 'https://old.com', title: 'OLD!', discarded: true };
        
        const result = evaluateTabSyncState(tab, activePatterns, inactivePatterns, disabledGroups, tabModifiedTitles, tabOriginalTitles);
        
        expect(result.needsUpdate).to.be.true;
        expect(result.updateReason).to.contain('Amnesia Recovery');
    });

    it('should NOT trigger update for discarded tab with generic title and no rule', function () {
        const tab = { id: 1, url: 'https://random.com', title: 'Random Page', discarded: true };
        
        const result = evaluateTabSyncState(tab, activePatterns, inactivePatterns, disabledGroups, tabModifiedTitles, tabOriginalTitles);
        
        expect(result.needsUpdate).to.be.false;
    });
});
