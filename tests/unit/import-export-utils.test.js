const { expect } = require('../test-setup');
const {
    sortPatternsForVisualOrder,
    buildExportPayload,
    normalizeImportPayload,
    mergeImportPayload,
} = require('../../src/lib/import-export-utils');

describe('import-export utils', function () {
    it('sortPatternsForVisualOrder keeps ungrouped first and groups by first appearance', function () {
        const raw = [
            { search: 'a', title: 'A', group: 'B' },
            { search: 'b', title: 'B' },
            { search: 'c', title: 'C', group: 'A' },
            { search: 'd', title: 'D', group: 'B' },
        ];

        const sorted = sortPatternsForVisualOrder(raw);
        expect(sorted.map(p => p.search)).to.deep.equal(['b', 'a', 'd', 'c']);
    });

    it('buildExportPayload includes metadata and sorted patterns', function () {
        const raw = [
            { search: 'grouped', title: 'G', group: 'Work' },
            { search: 'plain', title: 'P' },
        ];

        const result = buildExportPayload(raw, ['Work', 'Ghost'], ['Work']);

        expect(result.metadata.version).to.equal('1.0');
        expect(result.metadata.collapsedGroups).to.deep.equal(['Work', 'Ghost']);
        expect(result.metadata.disabledGroups).to.deep.equal(['Work']);
        expect(result.patterns.map(p => p.search)).to.deep.equal(['plain', 'grouped']);
    });

    it('normalizeImportPayload supports legacy array payloads', function () {
        const result = normalizeImportPayload([
            { search: 'x', title: 'X', group: 'Work' },
            { search: 'y', title: 'Y' },
        ]);

        expect(result.patterns.map(p => p.search)).to.deep.equal(['y', 'x']);
        expect(result.collapsedGroups).to.deep.equal([]);
        expect(result.disabledGroups).to.deep.equal([]);
    });

    it('normalizeImportPayload filters stale metadata groups', function () {
        const payload = {
            metadata: {
                collapsedGroups: ['Work', 'Ghost'],
                disabledGroups: ['Ghost', 'Home'],
            },
            patterns: [
                { search: 'w', title: 'W', group: 'Work' },
                { search: 'h', title: 'H', group: 'Home' },
            ],
        };

        const result = normalizeImportPayload(payload);

        expect(result.collapsedGroups).to.deep.equal(['Work']);
        expect(result.disabledGroups).to.deep.equal(['Home']);
    });

    it('mergeImportPayload drops exact duplicates and retains customized ones', function () {
        const current = {
            patterns: [
                { search: 'a', title: 'A', group: 'G1' },
                { search: 'b', title: 'B', group: 'G2' }
            ],
            collapsedGroups: ['G1'],
            disabledGroups: ['G1']
        };
        const imported = {
            patterns: [
                { search: 'a', title: 'A', group: 'G1' }, // Exact duplicate -> should drop
                { search: 'b', title: 'DifferentB', group: 'G2' }, // Title differs -> keep
                { search: 'a', title: 'A', group: 'DifferentGroup' }, // Group differs -> keep
                { search: 'c', title: 'C', group: 'G3' } // Completely new -> keep
            ],
            collapsedGroups: ['G1', 'G3'],
            disabledGroups: ['G2']
        };

        const result = mergeImportPayload(current, imported);

        expect(result.patterns.length).to.equal(5);
        expect(result.stats.added).to.equal(3);
        expect(result.stats.duplicatesSkipped).to.equal(1);
        
        expect(result.collapsedGroups).to.deep.equal(['G1', 'G3']);
        expect(result.disabledGroups).to.deep.equal(['G1', 'G2']);
    });
    it('mergeImportPayload deduplicates internally within the import batch', function () {
        const current = {
            patterns: [{ search: 'existing', title: 'E' }],
            collapsedGroups: [],
            disabledGroups: []
        };
        const imported = {
            patterns: [
                { search: 'new', title: 'N' },
                { search: 'new', title: 'N' }, // Internal duplicate
                { search: 'existing', title: 'E' } // Duplicate against existing
            ],
            collapsedGroups: [],
            disabledGroups: []
        };

        const result = mergeImportPayload(current, imported);

        expect(result.patterns.length).to.equal(2); // 'existing' and one 'new'
        expect(result.stats.added).to.equal(1);
        expect(result.stats.duplicatesSkipped).to.equal(2);
    });
});
