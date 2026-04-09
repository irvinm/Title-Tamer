const { expect } = require('../test-setup');
const {
    buildSavePatternUpdate,
    buildSaveRowUpdate,
    buildPatternEnabledUpdate,
    buildDisabledGroupsUpdate,
} = require('../../src/lib/options-mutation-utils');

describe('options mutation utils', function () {
    it('buildSavePatternUpdate appends new ungrouped pattern', function () {
        const result = buildSavePatternUpdate([{ search: 'a', title: 'A' }], {
            search: 'b',
            title: 'B',
            groupValue: '',
        });

        expect(result.patterns).to.have.length(2);
        expect(result.patterns[1]).to.deep.equal({ search: 'b', title: 'B' });
        expect(result).to.not.have.property('recentGroupSelection');
    });

    it('buildSavePatternUpdate stores recentGroupSelection when grouped', function () {
        const result = buildSavePatternUpdate([], {
            search: 'a',
            title: 'A',
            groupValue: 'Work',
        });

        expect(result.patterns[0].group).to.equal('Work');
        expect(result.recentGroupSelection).to.equal('Work');
    });

    it('buildSaveRowUpdate preserves enabled state and updates in-place if same group', function () {
        const result = buildSaveRowUpdate([
            { search: 'x', title: 'X', enabled: false, group: 'Work' },
        ], 0, {
            search: 'x2',
            title: 'X2',
            groupValue: 'Work',
        });

        expect(result.patterns[0]).to.deep.equal({
            search: 'x2',
            title: 'X2',
            enabled: false,
            group: 'Work',
        });
    });

    it('buildSaveRowUpdate moves pattern next to destination group members', function () {
        const result = buildSaveRowUpdate([
            { search: 'u1', title: 'U1' },
            { search: 'w1', title: 'W1', group: 'Work' },
            { search: 'u2', title: 'U2' },
            { search: 'w2', title: 'W2', group: 'Work' },
        ], 2, {
            search: 'u2x',
            title: 'U2X',
            groupValue: 'Work',
        });

        expect(result.patterns.map(p => p.search)).to.deep.equal(['u1', 'w1', 'w2', 'u2x']);
        expect(result.patterns[3].group).to.equal('Work');
        expect(result.recentGroupSelection).to.equal('Work');
    });

    it('buildPatternEnabledUpdate toggles target enabled value', function () {
        const result = buildPatternEnabledUpdate([
            { search: 'a', title: 'A', enabled: true },
            { search: 'b', title: 'B' },
        ], 1, false);

        expect(result.patterns[1].enabled).to.equal(false);
        expect(result.patterns[0].enabled).to.equal(true);
    });

    it('buildDisabledGroupsUpdate adds and removes groups', function () {
        const afterAdd = buildDisabledGroupsUpdate(['Work'], 'Home', true);
        expect(afterAdd).to.have.members(['Work', 'Home']);

        const afterRemove = buildDisabledGroupsUpdate(new Set(afterAdd), 'Work', false);
        expect(afterRemove).to.deep.equal(['Home']);
    });
});
