# Feature Specification: Advanced Formatting Requirements

**Feature Branch**: `002-advanced-formatting`  
**Created**: 2026-05-30  
**Status**: Draft  
**Input**: User description: "Implement advanced string formatting transformations on regex capture groups in replacement fields, using dot notation and method chaining."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Case Transformations and Trimming (Priority: P1)

As a user, I want to convert capture groups to uppercase, lowercase, capitalized, or title-cased, and trim surrounding whitespace, so that my tab titles have clean, consistent, and standardized casing.

**Why this priority**: Correcting text casing (such as uppercase Jira ticket IDs or title-casing directory names) is the most critical and frequently requested capability in Issue #13.

**Independent Test**: Can be fully tested by creating a rule with a title pattern like `Ticket: $1.upper().trim()` and asserting that a matched URL (e.g., containing `/browse/ tit-123 `) results in `Ticket: TIT-123`.

**Acceptance Scenarios**:

1. **Given** a tab URL `https://jira.com/browse/tit-123`,  
   **When** matched against `jira\.com/browse/([a-z0-9-]+)` with template `Ticket: $1.upper()`,  
   **Then** the tab title is set to `Ticket: TIT-123`.

2. **Given** a tab URL `https://example.com/name/%20john-doe%20`,  
   **When** matched against `name/([^/]+)` with template `User: $1.trim().title()`,  
   **Then** the tab title is set to `User: John-Doe`.

3. **Given** a capture group containing `hello WORLD`,  
   **When** `.capitalize()` is applied,  
   **Then** the output is `Hello world` (converts the first letter to uppercase and lowercases all other letters).

---

### User Story 2 - Characters Replacement, Truncation, and Slicing (Priority: P2)

As a user, I want to replace characters, slice out sub-segments, or limit the length of capture groups, so that I can clean up slugs (e.g., replace underscores/hyphens with spaces) and prevent excessively long tab titles from cluttering the browser UI.

**Why this priority**: String replacements and truncation are vital for transforming dirty URL paths and slugs into human-readable text.

**Independent Test**: Can be tested by creating a rule using `$1.replace("_", " ").limit(10)` on a long slug like `advanced_string_formatting` and verifying the output is `advanced s...`.

**Acceptance Scenarios**:

1. **Given** a capture group `$1` matching `some_long_wiki_slug`,  
   **When** evaluated with `$1.replace("_", " ").title()`,  
   **Then** the result is `Some Long Wiki Slug`.

2. **Given** a capture group `$1` matching `unnecessarily-long-tab-title-text`,  
   **When** evaluated with `$1.limit(10)` or `$1.limit(10, "")`,  
   **Then** the result is `unnecessar` (the character limit `10` does a clean truncation with no suffix by default).

3. **Given** a capture group `$1` matching `unnecessarily-long-tab-title-text`,  
   **When** evaluated with `$1.limit(10, "...")`,  
   **Then** the result is `unnecessar...` (conditionally appends `...` if the string was actually truncated).

4. **Given** a capture group `$1` matching `short`,  
   **When** evaluated with `$1.limit(10)`,  
   **Then** the result is `short` (no suffix is appended since the length is less than the limit).

5. **Given** a capture group `$1` matching `abcdefg`,  
   **When** evaluated with `$1.slice(1, 4)`,  
   **Then** the result is `bcd`.

---

### User Story 3 - Chaining and Fallback Safety (Priority: P3)

As a user, I want to chain multiple methods together and have malformed syntax or unknown methods fall back gracefully to literal text, so that complex transformations work reliably and existing simple rules are never broken.

**Why this priority**: Chainability adds immense versatility, while graceful fallback ensures the extension is completely backward-compatible and robust against typos.

**Independent Test**: Can be tested by verifying that a template like `$1.upper().invalidMethod()` or `$1.replace("a", )` evaluates the valid portions or falls back to literal text without crashing the extension.

**Acceptance Scenarios**:

1. **Given** a capture group `$1` matching ` slug `,  
   **When** evaluated with `$1.trim().upper()`,  
   **Then** the result is `SLUG`.

2. **Given** a template containing `$1.unknownMethod()`,  
   **When** evaluated,  
   **Then** the parser treats it as literal text: `$1.unknownMethod()` (preserving compatibility).

3. **Given** a template containing `$1.replace("a", "b"`,  
   **When** parsing fails due to unmatched parentheses/quotes,  
   **Then** the parser falls back to literal text representation without throwing a runtime error.

---

### Edge Cases

- **Empty or Undefined Capture Group**: If a capture group (e.g., `$2`) did not match anything, it should be treated as `""` (empty string). Applying `.upper().trim()` should output `""` safely without throwing an error.
- **Nested Parentheses/Quotes**: An argument like `.replace("(", "[")` contains nested parentheses. The parser must not split on the inner parenthesis.
- **Escaped Quotes**: An argument like `.replace("\'", "\"")` contains escaped characters. The parser must decode these correctly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST parse dot-notation method calls appended to capture groups: `$n.method()`, `$n.method1().method2()`.
- **FR-002**: The system MUST support case transformations: `.upper()`, `.lower()`, `.capitalize()`, `.title()`.
- **FR-003**: The system MUST support string manipulation: `.trim()`, `.replace(old, new)`, `.limit(n, [suffix])`, `.slice(start, end)`.
- **FR-004**: The system MUST execute transformations in sequence from left to right.
- **FR-005**: The system MUST fallback to literal text representation of any unrecognized method or syntactically malformed method chain.
- **FR-006**: The system MUST treat undefined or empty capture groups as empty strings, allowing methods to execute safely on them.
- **FR-007**: The system MUST support parsing single-quoted and double-quoted string literals with backslash-escaped characters in parameters.
- **FR-008**: The system MUST be sandbox-safe and MUST NOT use unsafe functions like `eval()` or `new Function()` to parse or execute the template.
- **FR-009**: The system MUST decode URI percent-encoding on each capture group individually before executing method chains (ensuring string manipulation methods operate on readable, decoded characters).

### Key Entities *(include if feature involves data)*

- **ReplacementEngine**: Core component responsible for parsing title templates, matching capture groups, executing string methods in sequence, and constructing final titles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All existing replacement rules without dot-notation continue to work identically (100% backward compatibility).
- **SC-002**: Malformed dot-notation rules do not crash the extension background worker or page script.
- **SC-003**: Title template resolution executes in under 2ms per title update to prevent browser lagging.
- **SC-004**: 100% unit test coverage for all parsed methods, chaining combinations, and fallback edge cases.

## Clarifications

### Session 2026-05-30
- **Q**: How should the `.capitalize()` transformation behave when handling string casing?  
  **A**: Convert the first letter to uppercase and lowercase all other letters (e.g., `"my TAB" -> "My tab"`).
- **Q**: How should the `.limit(n)` truncation limit character count behave?  
  **A**: Exclude the suffix length from the character count `n`, returning `n` characters from the group plus the suffix. Suffix defaults to `""` (no suffix / clean cut) but can be overridden (e.g., `$1.limit(5) -> "title"`, while `$1.limit(5, "...") -> "title..."`).
- **Q**: When should percent-encoded characters in URL capture groups (e.g., `%20`) be decoded?  
  **A**: Decode each capture group individually before applying any string formatting methods (e.g., `$1.replace(" ", "-")` will match decoded spaces).
