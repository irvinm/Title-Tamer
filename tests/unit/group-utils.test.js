// group-utils.test.js — Unit tests for group-related pure functions
const { expect } = require('../test-setup');
const { escapeHTML, getOrderedGroupNames, computeScrollThumb } = require('../../src/lib/group-utils');

// ─── escapeHTML ────────────────────────────────────────────────────────────────

describe('escapeHTML', function () {
    it('should return an empty string for null', function () {
        expect(escapeHTML(null)).to.equal('');
    });

    it('should return an empty string for undefined', function () {
        expect(escapeHTML(undefined)).to.equal('');
    });

    it('should return an empty string for an empty string', function () {
        expect(escapeHTML('')).to.equal('');
    });

    it('should escape &', function () {
        expect(escapeHTML('foo & bar')).to.equal('foo &amp; bar');
    });

    it('should escape <', function () {
        expect(escapeHTML('<script>')).to.equal('&lt;script&gt;');
    });

    it('should escape >', function () {
        expect(escapeHTML('a > b')).to.equal('a &gt; b');
    });

    it('should escape double quotes', function () {
        expect(escapeHTML('"hello"')).to.equal('&quot;hello&quot;');
    });

    it('should escape single quotes', function () {
        expect(escapeHTML("it's")).to.equal('it&#039;s');
    });

    it('should escape all special characters together', function () {
        expect(escapeHTML('<a href="x&y">it\'s</a>')).to.equal(
            '&lt;a href=&quot;x&amp;y&quot;&gt;it&#039;s&lt;/a&gt;'
        );
    });

    it('should leave plain text unchanged', function () {
        expect(escapeHTML('Hello World')).to.equal('Hello World');
    });

    it('should coerce a number to a string and escape it', function () {
        expect(escapeHTML(42)).to.equal('42');
    });
});

// ─── getOrderedGroupNames ──────────────────────────────────────────────────────

describe('getOrderedGroupNames', function () {
    const patterns = [
        { search: 's1', title: 't1', group: 'Zebra' },
        { search: 's2', title: 't2', group: 'apple' },
        { search: 's3', title: 't3', group: 'Mango' },
        { search: 's4', title: 't4', group: 'apple' }, // duplicate
        { search: 's5', title: 't5' },                  // no group
        { search: 's6', title: 't6', group: 'banana' },
    ];

    it('should return only unique, non-empty group names', function () {
        const result = getOrderedGroupNames(patterns, 'table');
        expect(result).to.not.include(undefined);
        expect(result).to.not.include('');
        expect(result.filter(g => g === 'apple')).to.have.lengthOf(1);
    });

    it('should sort alphabetically (case-insensitive locale sort) when sortOrder is "alphabetic"', function () {
        const result = getOrderedGroupNames(patterns, 'alphabetic');
        expect(result).to.deep.equal(['apple', 'banana', 'Mango', 'Zebra']);
    });

    it('should preserve first-appearance table order when sortOrder is "table"', function () {
        const result = getOrderedGroupNames(patterns, 'table');
        expect(result).to.deep.equal(['Zebra', 'apple', 'Mango', 'banana']);
    });

    it('should default to alphabetic when sortOrder is unknown', function () {
        const result = getOrderedGroupNames(patterns, 'unknown');
        expect(result).to.deep.equal(['apple', 'banana', 'Mango', 'Zebra']);
    });

    it('should return an empty array when no patterns have groups', function () {
        const ungrouped = [{ search: 's', title: 't' }];
        expect(getOrderedGroupNames(ungrouped, 'alphabetic')).to.deep.equal([]);
    });

    it('should return an empty array for an empty patterns array', function () {
        expect(getOrderedGroupNames([], 'alphabetic')).to.deep.equal([]);
    });

    it('should handle patterns where group is an empty string', function () {
        const mixed = [
            { search: 's1', title: 't1', group: '' },
            { search: 's2', title: 't2', group: 'Work' },
        ];
        const result = getOrderedGroupNames(mixed, 'alphabetic');
        expect(result).to.deep.equal(['Work']);
    });

    it('should sort uppercase and lowercase together (locale-aware)', function () {
        const mixed = [
            { group: 'zebra' },
            { group: 'Apple' },
            { group: 'Banana' },
            { group: 'cherry' },
        ];
        const result = getOrderedGroupNames(mixed, 'alphabetic');
        expect(result[0].toLowerCase()).to.equal('apple');
        expect(result[result.length - 1].toLowerCase()).to.equal('zebra');
    });

    it('should preserve stable order for identical groups in table mode', function () {
        const ordered = [
            { group: 'Work' },
            { group: 'Home' },
            { group: 'Work' },
            { group: 'Misc' },
        ];
        const result = getOrderedGroupNames(ordered, 'table');
        expect(result).to.deep.equal(['Work', 'Home', 'Misc']);
    });
});

// ─── computeScrollThumb ────────────────────────────────────────────────────────

describe('computeScrollThumb', function () {
    const defaultOpts = {
        scrollTop: 0,
        viewportHeight: 200,
        scrollHeight: 500,
        trackHeight: 100,
        minThumbHeight: 18,
    };

    it('should place thumb at offsetY=0 when scrollTop is 0', function () {
        const { thumbOffsetY } = computeScrollThumb(defaultOpts);
        expect(thumbOffsetY).to.equal(0);
    });

    it('should place thumb at maximum travel when scrolled to the bottom', function () {
        const opts = { ...defaultOpts, scrollTop: 300 }; // maxScrollTop = 500-200 = 300
        const { thumbOffsetY, thumbHeight } = computeScrollThumb(opts);
        const maxTravel = defaultOpts.trackHeight - thumbHeight;
        expect(thumbOffsetY).to.be.closeTo(maxTravel, 0.01);
    });

    it('should place thumb at the midpoint when scrolled halfway', function () {
        const opts = { ...defaultOpts, scrollTop: 150 }; // ratio = 0.5
        const { thumbOffsetY, thumbHeight } = computeScrollThumb(opts);
        const expectedTravel = (defaultOpts.trackHeight - thumbHeight) * 0.5;
        expect(thumbOffsetY).to.be.closeTo(expectedTravel, 0.01);
    });

    it('should size thumb proportionally to viewport/content ratio', function () {
        // viewportHeight 200, scrollHeight 400 → thumb should be 50% of trackHeight
        const opts = { ...defaultOpts, scrollHeight: 400, minThumbHeight: 0 };
        const { thumbHeight } = computeScrollThumb(opts);
        expect(thumbHeight).to.be.closeTo(50, 0.01); // 200/400 * 100
    });

    it('should enforce minThumbHeight floor', function () {
        // Even if proportional thumb would be tiny, it must be at least minThumbHeight
        const opts = { ...defaultOpts, scrollHeight: 100000, minThumbHeight: 18 };
        const { thumbHeight } = computeScrollThumb(opts);
        expect(thumbHeight).to.be.at.least(18);
    });

    it('should return zeroes when content does not overflow (maxScrollTop=0)', function () {
        const opts = { ...defaultOpts, scrollHeight: 200 }; // same as viewportHeight
        const result = computeScrollThumb(opts);
        expect(result.thumbHeight).to.equal(0);
        expect(result.thumbOffsetY).to.equal(0);
        expect(result.maxScrollTop).to.equal(0);
    });

    it('should return zeroes when trackHeight is 0', function () {
        const opts = { ...defaultOpts, trackHeight: 0 };
        const result = computeScrollThumb(opts);
        expect(result.thumbHeight).to.equal(0);
        expect(result.thumbOffsetY).to.equal(0);
    });

    it('should clamp ratio to 1 even if scrollTop overshoots', function () {
        const opts = { ...defaultOpts, scrollTop: 9999 };
        const { thumbOffsetY, thumbHeight } = computeScrollThumb(opts);
        const maxTravel = defaultOpts.trackHeight - thumbHeight;
        expect(thumbOffsetY).to.be.closeTo(maxTravel, 0.01);
    });

    it('should clamp ratio to 0 even if scrollTop is negative', function () {
        const opts = { ...defaultOpts, scrollTop: -100 };
        const { thumbOffsetY } = computeScrollThumb(opts);
        expect(thumbOffsetY).to.equal(0);
    });

    it('should use 18px as the default minThumbHeight when not supplied', function () {
        const { scrollTop, viewportHeight, scrollHeight, trackHeight } = defaultOpts;
        const result = computeScrollThumb({ scrollTop, viewportHeight, scrollHeight, trackHeight });
        expect(result.thumbHeight).to.be.at.least(18);
    });

    it('should expose the correct maxScrollTop value', function () {
        const { maxScrollTop } = computeScrollThumb(defaultOpts);
        expect(maxScrollTop).to.equal(300); // 500 - 200
    });
});
