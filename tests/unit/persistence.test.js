/**
 * persistence.test.js
 * 
 * Unit tests for production state persistence helpers.
 */

const { expect } = require('../test-setup');
const { serializeSyncState, hydrateSyncState } = require('../../src/lib/sync-state-utils');

describe('State Persistence Logic', function () {
    
    it('should correctly serialize Maps to storage format', function () {
        const modified = new Map([[1, 'Title 1'], [20, 'Title 20']]);
        const original = new Map([[1, 'Orig 1'], [20, 'Orig 20']]);

        const data = serializeSyncState(modified, original);
        
        expect(data.modifiedTitles).to.deep.equal([[1, 'Title 1'], [20, 'Title 20']]);
        expect(data.originalTitles).to.deep.equal([[1, 'Orig 1'], [20, 'Orig 20']]);
    });

    it('should correctly deserialize storage format back to Maps', function () {
        const storageState = {
            modifiedTitles: [[100, 'Mod 100'], [200, 'Mod 200']],
            originalTitles: [[100, 'Site 100'], [200, 'Site 200']],
        };

        const resultModified = new Map();
        const resultOriginal = new Map();

        hydrateSyncState(storageState, resultModified, resultOriginal);

        expect(resultModified.get(100)).to.equal('Mod 100');
        expect(resultModified.get(200)).to.equal('Mod 200');
        expect(resultOriginal.get(100)).to.equal('Site 100');
        expect(resultOriginal.get(200)).to.equal('Site 200');
        expect(resultModified.size).to.equal(2);
    });

    it('should handle empty or missing storage data gracefully', function () {
        const resultModified = new Map();
        hydrateSyncState(undefined, resultModified, new Map());
        
        expect(resultModified.size).to.equal(0);
    });

    it('should ignore malformed state arrays', function () {
        const resultModified = new Map();
        const resultOriginal = new Map();
        hydrateSyncState({ modifiedTitles: 'bad', originalTitles: null }, resultModified, resultOriginal);
        expect(resultModified.size).to.equal(0);
        expect(resultOriginal.size).to.equal(0);
    });
});
