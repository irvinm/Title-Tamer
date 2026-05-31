# Implementation Plan: Advanced Formatting Requirements

**Branch**: `002-advanced-formatting` | **Date**: 2026-05-30 | **Spec**: [spec.md](file:///E:/OneDrive/Documents/GitHub/Title-Tamer/specs/002-advanced-formatting/spec.md)
**Input**: Feature specification from `/specs/002-advanced-formatting/spec.md`

## Summary

Build a secure, lightweight replacement engine in `src/lib/pattern-utils.js` that parses and evaluates chained dot-notation formatting methods on regex capture groups (e.g. `$1.trim().replace("-", " ").upper()`). The parser will tokenize string arguments safely tracking quote boundaries, resolve empty matches without crashing, and degrade to literal text when encountering unsupported methods or syntax errors.

## Technical Context

**Language/Version**: JavaScript (ES6+ / Node.js 24+ compatible)  
**Primary Dependencies**: None (pure JS parser to minimize footprint and maintain extension simplicity)  
**Storage**: N/A (runs inline during title construction)  
**Testing**: Mocha & Chai (existing suite in `tests/unit/`)  
**Target Platform**: Chrome / Firefox Extension context (Manifest V3 compatible)  
**Project Type**: Browser Extension (single project)  
**Performance Goals**: String replacement evaluation in < 2ms per title  
**Constraints**: Must NOT use `eval()` or `new Function()` due to Manifest V3 CSP restrictions; must operate directly on URL strings.  
**Scale/Scope**: Tab title updates on tab loading and page mutation events.  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] I. Precision over Aggression: Avoid unintended pattern matches? (Yes, only parses valid `$n.method()` chains; degrades to literal fallback).
- [x] II. Performance First: Optimized evaluation logic? (Yes, pure JS linear string parser, avoiding heavy backtracking).
- [x] III. Privacy by Design: Minimized data exposure/local storage? (Yes, zero data stored or transmitted).
- [x] IV. Test-Driven Development: Are unit tests written and failing first? (Yes, tests will be added to `tests/unit/pattern-matching.test.js`).
- [x] V. Graceful Degradation: Silent failure and redirect handling? (Yes, fallbacks ensure malformed inputs print as literals instead of crashing).
- [x] VI. User Control: Easy revert/disable mechanisms? (Yes, works with existing group/rule toggles).

## Project Structure

### Documentation (this feature)

```text
specs/002-advanced-formatting/
├── plan.md              # This file
├── research.md          # Parsing technology research
├── data-model.md        # Parser AST and intermediate representations
├── quickstart.md        # Test commands and manual verification setup
└── contracts/
    └── replacement.md   # JavaScript API contract for pattern utils
```

### Source Code (repository root)

```text
src/
└── lib/
    └── pattern-utils.js               # Modified to support the new parser

tests/
└── unit/
    └── pattern-matching.test.js       # Unit tests for transformations
```

**Structure Decision**: Standard single-project structure mapping directly to `src/lib/` and `tests/unit/`.

## Complexity Tracking

*No violations of the project constitution detected.*
