const { expect } = require('../test-setup');
const {
    sortPatternsForVisualOrder,
    buildExportPayload,
    normalizeImportPayload,
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
});
