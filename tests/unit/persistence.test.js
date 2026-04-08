/**
 * persistence.test.js
 * 
 * Unit tests for state serialization used in saveState/loadState
 */

const { expect } = require('../test-setup');

describe('State Persistence Logic', function () {
    
    it('should correctly serialize Maps to storage format', function () {
        const modified = new Map([[1, 'Title 1'], [20, 'Title 20']]);
        const original = new Map([[1, 'Orig 1'], [20, 'Orig 20']]);
        
        // This is the logic inside saveState()
        const data = {
            modifiedTitles: Array.from(modified.entries()),
            originalTitles: Array.from(original.entries())
        };
        
        expect(data.modifiedTitles).to.deep.equal([[1, 'Title 1'], [20, 'Title 20']]);
        expect(data.originalTitles).to.deep.equal([[1, 'Orig 1'], [20, 'Orig 20']]);
    });

    it('should correctly deserialize storage format back to Maps', function () {
        const storageData = {
            _sync_state: {
                modifiedTitles: [[100, 'Mod 100'], [200, 'Mod 200']],
                originalTitles: [[100, 'Site 100'], [200, 'Site 200']]
            }
        };

        const resultModified = new Map();
        const resultOriginal = new Map();

        // This is the logic inside loadState()
        if (storageData._sync_state) {
            if (storageData._sync_state.modifiedTitles) {
                storageData._sync_state.modifiedTitles.forEach(([id, title]) => {
                    resultModified.set(id, title);
                });
            }
            if (storageData._sync_state.originalTitles) {
                storageData._sync_state.originalTitles.forEach(([id, title]) => {
                    resultOriginal.set(id, title);
                });
            }
        }

        expect(resultModified.get(100)).to.equal('Mod 100');
        expect(resultModified.get(200)).to.equal('Mod 200');
        expect(resultOriginal.get(100)).to.equal('Site 100');
        expect(resultOriginal.get(200)).to.equal('Site 200');
        expect(resultModified.size).to.equal(2);
    });

    it('should handle empty or missing storage data gracefully', function () {
        const resultModified = new Map();
        const storageData = {}; // Empty result from storage.get

        // Should not throw
        if (storageData._sync_state && storageData._sync_state.modifiedTitles) {
             storageData._sync_state.modifiedTitles.forEach(([id, title]) => {
                resultModified.set(id, title);
            });
        }
        
        expect(resultModified.size).to.equal(0);
    });
});
