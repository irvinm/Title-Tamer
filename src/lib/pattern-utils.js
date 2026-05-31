// pattern-utils.js — Pure pattern matching and title replacement logic
// Extracted from background.js for testability

/**
 * Test whether a URL matches a search pattern (regex string).
 * Decodes percent-encoding before matching so patterns can use
 * human-readable characters (Issue #7).
 * @param {string} url - The tab URL to test.
 * @param {string} searchPattern - The regex pattern string.
 * @returns {RegExpMatchArray|null} The match result, or null if no match.
 */
function matchUrl(url, searchPattern) {
    try {
        let decodedUrl;
        try { decodedUrl = decodeURIComponent(url); } catch (e) { decodedUrl = url; }
        const regex = new RegExp(searchPattern);
        return decodedUrl.match(regex);
    } catch (e) {
        return null;
    }
}

/**
 * Parse a string argument enclosed in quotes with backslash escaping.
 * @param {string} input - The full template string.
 * @param {number} startPos - The index of the opening quote.
 * @returns {{value: string, endPos: number}|null} Parsed string and end position, or null.
 */
function parseStringLiteral(input, startPos) {
    const quote = input[startPos];
    let pos = startPos + 1;
    let str = "";
    while (pos < input.length) {
        const char = input[pos];
        if (char === "\\") {
            if (pos + 1 >= input.length) return null;
            const nextChar = input[pos + 1];
            if (nextChar === "n") str += "\n";
            else if (nextChar === "t") str += "\t";
            else if (nextChar === "r") str += "\r";
            else str += nextChar;
            pos += 2;
        } else if (char === quote) {
            return { value: str, endPos: pos + 1 };
        } else {
            str += char;
            pos++;
        }
    }
    return null;
}

/**
 * Parse a capture group dot-notation expression chain.
 * @param {string} input - The full template string.
 * @param {number} startIndex - The index of the "$" character.
 * @returns {{groupNumber: number, methods: Array<{name: string, args: Array}>, length: number}|null} Parsed chain or null.
 */
function parseExpressionChain(input, startIndex) {
    let pos = startIndex;
    if (input[pos] !== "$") return null;
    pos++;

    let digits = "";
    while (pos < input.length && /[0-9]/.test(input[pos])) {
        digits += input[pos];
        pos++;
    }
    if (digits === "") return null;
    const groupNumber = parseInt(digits, 10);

    const methods = [];
    const chainStart = startIndex;

    while (pos < input.length && input[pos] === ".") {
        let peekPos = pos + 1;
        let methodName = "";
        while (peekPos < input.length && /[a-zA-Z_0-9]/.test(input[peekPos])) {
            methodName += input[peekPos];
            peekPos++;
        }
        if (methodName === "" || !/^[a-zA-Z_]/.test(methodName)) {
            break;
        }
        if (peekPos >= input.length || input[peekPos] !== "(") {
            break;
        }
        peekPos++; // Consume (

        const args = [];
        let expectArg = false;
        let syntaxError = false;

        while (peekPos < input.length) {
            while (peekPos < input.length && /\s/.test(input[peekPos])) {
                peekPos++;
            }
            if (peekPos >= input.length) {
                syntaxError = true;
                break;
            }
            const char = input[peekPos];
            if (char === ")") {
                peekPos++;
                break;
            }

            if (char === "'" || char === '"') {
                const strResult = parseStringLiteral(input, peekPos);
                if (!strResult) {
                    syntaxError = true;
                    break;
                }
                args.push(strResult.value);
                peekPos = strResult.endPos;
                expectArg = false;
            } else if (/[0-9-]/.test(char)) {
                let numStr = "";
                while (peekPos < input.length && (/[0-9]/.test(input[peekPos]) || (numStr === "" && input[peekPos] === "-"))) {
                    numStr += input[peekPos];
                    peekPos++;
                }
                args.push(parseInt(numStr, 10));
                expectArg = false;
            } else {
                syntaxError = true;
                break;
            }

            while (peekPos < input.length && /\s/.test(input[peekPos])) {
                peekPos++;
            }
            if (peekPos >= input.length) {
                syntaxError = true;
                break;
            }

            if (input[peekPos] === ",") {
                peekPos++;
                expectArg = true;
            } else if (input[peekPos] !== ")") {
                syntaxError = true;
                break;
            }
        }

        if (syntaxError || expectArg) {
            return { error: true, length: peekPos - chainStart };
        }

        methods.push({ name: methodName, args });
        pos = peekPos;
    }

    if (methods.length === 0) {
        return null;
    }

    return {
        groupNumber,
        methods,
        length: pos - chainStart
    };
}

/**
 * Execute a whitelisted transformation method on a string value.
 * @param {string} value - The input string value.
 * @param {{name: string, args: Array}} methodCall - The method name and arguments.
 * @returns {string} The transformed string.
 */
function executeTransform(value, methodCall) {
    const { name, args } = methodCall;
    switch (name) {
        case "upper":
            return value.toUpperCase();
        case "lower":
            return value.toLowerCase();
        case "trim":
            return value.trim();
        case "capitalize":
            return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
        case "title":
            return value.replace(/(?:^|[\s\-_])([a-z])/gi, match => match.toUpperCase());
        case "replace":
            if (args.length < 2) throw new Error("replace requires 2 arguments");
            return value.split(args[0]).join(args[1]);
        case "limit":
            if (args.length < 1) throw new Error("limit requires at least 1 argument");
            const limitVal = parseInt(args[0], 10);
            const suffix = args.length > 1 ? String(args[1]) : "";
            return value.length > limitVal ? value.substring(0, limitVal) + suffix : value;
        case "slice":
            if (args.length < 1) throw new Error("slice requires at least 1 argument");
            const start = parseInt(args[0], 10);
            const end = args.length > 1 ? parseInt(args[1], 10) : undefined;
            return value.slice(start, end);
        default:
            throw new Error(`Unknown method: ${name}`);
    }
}

/**
 * Build the new title by substituting regex capture groups into the title template.
 * Replaces $1, $2, etc. with the corresponding capture group values, supporting optional method chains.
 * @param {string} titleTemplate - The title template (e.g. "Jira - $1.upper()").
 * @param {RegExpMatchArray} matches - The regex match result from matchUrl.
 * @returns {string} The resolved title string.
 */
function buildTitle(titleTemplate, matches) {
    let result = "";
    let pos = 0;

    while (pos < titleTemplate.length) {
        if (titleTemplate[pos] === "$") {
            const chain = parseExpressionChain(titleTemplate, pos);
            if (chain) {
                if (chain.error) {
                    result += titleTemplate.substring(pos, pos + chain.length);
                    pos += chain.length;
                    continue;
                }
                try {
                    let val = matches[chain.groupNumber] || "";
                    try { val = decodeURIComponent(val); } catch (e) { /* keep as-is */ }
                    for (const method of chain.methods) {
                        val = executeTransform(val, method);
                    }
                    result += val;
                    pos += chain.length;
                    continue;
                } catch (e) {
                    result += titleTemplate.substring(pos, pos + chain.length);
                    pos += chain.length;
                    continue;
                }
            }

            let nextPos = pos + 1;
            let digits = "";
            while (nextPos < titleTemplate.length && /[0-9]/.test(titleTemplate[nextPos])) {
                digits += titleTemplate[nextPos];
                nextPos++;
            }
            if (digits !== "") {
                const groupNumber = parseInt(digits, 10);
                const val = matches[groupNumber] || ("$" + digits);
                result += val;
                pos = nextPos;
                continue;
            }
        }

        result += titleTemplate[pos];
        pos++;
    }

    try { result = decodeURIComponent(result); } catch (e) { /* malformed URI — keep as-is */ }

    return result;
}


/**
 * Process a single pattern against a URL: match the URL and build the new title.
 * @param {string} url - The tab URL.
 * @param {{ search: string, title: string }} pattern - The pattern object.
 * @returns {{ matched: boolean, newTitle: string|null }} Result object.
 */
function applyPattern(url, pattern) {
    const matches = matchUrl(url, pattern.search);
    if (!matches) {
        return { matched: false, newTitle: null };
    }
    return { matched: true, newTitle: buildTitle(pattern.title, matches) };
}

/**
 * Sort a flat patterns array into the order used for tab-title matching:
 * ungrouped patterns first (preserving their relative order), followed by
 * grouped patterns ordered by the first appearance of each group name.
 * This mirrors the top-to-bottom visual rendering in the options table.
 * @param {Array<{group?: string}>} rawPatterns
 * @returns {Array<{group?: string}>}
 */
function sortPatternsForDisplay(rawPatterns) {
    const groupOrder = [...new Set(rawPatterns.map(p => p.group).filter(Boolean))];
    const sorted = [...rawPatterns.filter(p => !p.group)];
    for (const g of groupOrder) {
        sorted.push(...rawPatterns.filter(p => p.group === g));
    }
    return sorted;
}

/**
 * Filter a sorted patterns array to only those that should be applied:
 * - skips patterns where `enabled === false`
 * - skips patterns whose group is in the disabledGroups list
 * @param {Array<{group?: string, enabled?: boolean}>} patterns
 * @param {string[]} disabledGroups
 * @returns {Array<{group?: string, enabled?: boolean}>}
 */
function filterActivePatterns(patterns, disabledGroups = []) {
    const groups = Array.isArray(disabledGroups) ? disabledGroups : [];
    return patterns.filter(p => {
        if (p.enabled === false) return false;
        if (p.group && groups.includes(p.group)) return false;
        return true;
    });
}

// Export for both Node (testing) and browser (extension)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { matchUrl, buildTitle, applyPattern, sortPatternsForDisplay, filterActivePatterns };
}
