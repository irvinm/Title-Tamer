// pattern-matching.test.js — Tests for URL pattern matching
const { expect } = require('../test-setup');
const { matchUrl, buildTitle, applyPattern } = require('../../src/lib/pattern-utils');

describe('matchUrl', function () {
    it('should match a simple domain substring', function () {
        const result = matchUrl('https://www.google.com/search?q=test', 'google.com');
        expect(result).to.not.be.null;
    });

    it('should return null for non-matching URL', function () {
        const result = matchUrl('https://www.github.com', 'jira.com');
        expect(result).to.be.null;
    });

    it('should capture regex groups', function () {
        const result = matchUrl(
            'https://www.jira.com/browse/SOLDEF-843',
            'jira.com\\/browse\\/(.*)'
        );
        expect(result).to.not.be.null;
        expect(result[1]).to.equal('SOLDEF-843');
    });

    it('should capture multiple regex groups', function () {
        const result = matchUrl(
            'https://github.com/irvinm/Title-Tamer',
            'https?:\\/\\/(www\\.)?github\\.com/([^/]+)/([^/]+)'
        );
        expect(result).to.not.be.null;
        expect(result[2]).to.equal('irvinm');
        expect(result[3]).to.equal('Title-Tamer');
    });

    it('should return null for invalid regex', function () {
        const result = matchUrl('https://example.com', '[invalid(');
        expect(result).to.be.null;
    });

    it('should match exact URL with anchors', function () {
        const result = matchUrl(
            'https://firefox-source-docs.mozilla.org/',
            '^https:\\/\\/firefox-source-docs\\.mozilla\\.org\\/$'
        );
        expect(result).to.not.be.null;
    });

    it('should NOT match extended URL with exact anchors', function () {
        const result = matchUrl(
            'https://firefox-source-docs.mozilla.org/contributing/quickref.html',
            '^https:\\/\\/firefox-source-docs\\.mozilla\\.org\\/$'
        );
        expect(result).to.be.null;
    });
});

describe('buildTitle', function () {
    it('should replace $1 with the first capture group', function () {
        const matches = 'https://www.jira.com/browse/SOLDEF-843'.match(/jira.com\/browse\/(.*)/);
        const result = buildTitle('JIRA - $1', matches);
        expect(result).to.equal('JIRA - SOLDEF-843');
    });

    it('should replace multiple groups ($2, $3)', function () {
        const matches = 'https://github.com/irvinm/Title-Tamer'.match(
            /https?:\/\/(www\.)?github\.com\/([^/]+)\/([^/]+)/
        );
        const result = buildTitle('Repo: $2/$3', matches);
        expect(result).to.equal('Repo: irvinm/Title-Tamer');
    });

    it('should leave unmatched group references as-is', function () {
        const matches = 'https://example.com'.match(/(example)/);
        const result = buildTitle('$1 - $2 - $3', matches);
        expect(result).to.equal('example - $2 - $3');
    });

    it('should return the template as-is if no groups are used', function () {
        const matches = 'https://google.com'.match(/google\.com/);
        const result = buildTitle('Google (USA)', matches);
        expect(result).to.equal('Google (USA)');
    });
});

describe('applyPattern', function () {
    it('should return matched:true and the new title for a matching URL', function () {
        const result = applyPattern('https://www.jira.com/browse/SOLDEF-843', {
            search: 'jira.com\\/browse\\/(.*)',
            title: 'JIRA - $1',
        });
        expect(result.matched).to.be.true;
        expect(result.newTitle).to.equal('JIRA - SOLDEF-843');
    });

    it('should return matched:false for a non-matching URL', function () {
        const result = applyPattern('https://www.github.com', {
            search: 'jira.com',
            title: 'Jira',
        });
        expect(result.matched).to.be.false;
        expect(result.newTitle).to.be.null;
    });

    it('should handle Google search query extraction', function () {
        const result = applyPattern(
            'https://www.google.com/search?client=firefox-b-1-d&q=url+regex+examples',
            {
                search: 'https?:\\/\\/www\\.google\\.com\\/.*[?&]q=([^&]+)',
                title: 'Google: $1',
            }
        );
        expect(result.matched).to.be.true;
        expect(result.newTitle).to.equal('Google: url+regex+examples');
    });

    it('should handle StackOverflow slug extraction', function () {
        const result = applyPattern(
            'https://stackoverflow.com/questions/68646141/regex-matching-the-entire-string',
            {
                search: 'https?:\\/\\/(www\\.)?stackoverflow\\.com\\/questions\\/\\d+\\/([^/]+)',
                title: 'SO: $2',
            }
        );
        expect(result.matched).to.be.true;
        expect(result.newTitle).to.equal('SO: regex-matching-the-entire-string');
    });

    it('should handle simple string match (substring)', function () {
        const result = applyPattern('https://www.mozilla.org/en-US/firefox/', {
            search: 'firefox',
            title: 'Firefox related',
        });
        expect(result.matched).to.be.true;
        expect(result.newTitle).to.equal('Firefox related');
    });

    it('should handle invalid regex gracefully', function () {
        const result = applyPattern('https://example.com', {
            search: '[invalid(',
            title: 'Test',
        });
        expect(result.matched).to.be.false;
        expect(result.newTitle).to.be.null;
    });
});
