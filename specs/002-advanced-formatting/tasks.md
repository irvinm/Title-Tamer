# Tasks: Advanced String Formatting

**Input**: Design documents from `/specs/002-advanced-formatting/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are NON-NEGOTIABLE per Project Constitution Principle IV. Every user story MUST include unit tests that are written and seen to FAIL before implementation begins.

**Organization**: Tasks are grouped by foundational infrastructure and user stories to enable independent implementation and testing of each phase.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure verification.

- [x] T001 Verify standard linting passes and npm test suite is green in repository root.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core parser infrastructure that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Implement character-by-character tokenization state machine `parseExpressionChain(input, startIndex)` in `src/lib/pattern-utils.js` to parse capture groups and method call chains safely, respecting quote boundaries and backslash escaping.
- [x] T003 Implement `executeTransform(value, methodCall)` in `src/lib/pattern-utils.js` to apply whitelisted string transformation methods to individual capture groups.
- [x] T004 Modify `buildTitle(titleTemplate, matches)` in `src/lib/pattern-utils.js` to integrate the expression parser, perform group-level percent-decoding before executing methods, and evaluate the full replacement title.

**Checkpoint**: Foundation ready - parser and execution loop framework are fully implemented.

---

## Phase 3: User Story 1 - Case Transformations and Trimming (Priority: P1) 🎯 MVP

**Goal**: Support `.upper()`, `.lower()`, `.trim()`, and `.capitalize()` methods.

**Independent Test**: Assert that rules using case and trimming transformations produce expected results under `npm test`.

### Tests for User Story 1
- [x] T005 [US1] Write unit tests in `tests/unit/pattern-matching.test.js` verifying `.upper()`, `.lower()`, `.trim()`, and `.capitalize()` transformations (must fail initially).

### Implementation for User Story 1
- [x] T006 [US1] Implement casing and trimming handlers inside `executeTransform()` in `src/lib/pattern-utils.js`.

**Checkpoint**: User Story 1 is functional and testable independently.

---

## Phase 4: User Story 2 - Characters Replacement, Truncation, and Slicing (Priority: P2)

**Goal**: Support `.replace()`, `.limit()`, and `.slice()` methods.

**Independent Test**: Assert that rules using replacements, clean limits, and slicing produce expected results under `npm test`.

### Tests for User Story 2
- [x] T007 [US2] Write unit tests in `tests/unit/pattern-matching.test.js` verifying `.replace(old, new)`, `.limit(n, [suffix])`, and `.slice(start, end)` transformations (must fail initially).

### Implementation for User Story 2
- [x] T008 [US2] Implement `.replace()`, `.limit()` (with optional suffix defaulting to `""`), and `.slice()` handlers inside `executeTransform()` in `src/lib/pattern-utils.js`.

**Checkpoint**: User Stories 1 and 2 are functional and testable independently.

---

## Phase 5: User Story 3 - Chaining and Fallback Safety (Priority: P3)

**Goal**: Support chaining multiple transformations and falling back gracefully on syntax/parser errors.

**Independent Test**: Assert that chained rules and malformed rules fall back safely under `npm test`.

### Tests for User Story 3
- [x] T009 [US3] Write unit tests in `tests/unit/pattern-matching.test.js` verifying sequential method chaining (e.g. `.trim().upper()`), unknown methods, and malformed syntax.

### Implementation for User Story 3
- [x] T010 [US3] Finalize AST evaluation loop and syntax error try-catch blocks in `src/lib/pattern-utils.js` to ensure graceful fallbacks to literal templates.

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, cleanups, and optimization.

- [x] T011 Run the full unit test suite via `npm test` and assert all tests are green.
- [x] T012 Run extension linter via `npm run lint` and verify zero errors.
- [x] T013 Perform manual validation using steps defined in `specs/002-advanced-formatting/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies
1. **Setup (Phase 1)** $\rightarrow$ **Foundational (Phase 2)**: Scaffolds parser infrastructure.
2. **Foundational (Phase 2)** $\rightarrow$ **User Story 1 (Phase 3)**: Implements base case transformations.
3. **User Story 1 (Phase 3)** $\rightarrow$ **User Story 2 (Phase 4)**: Implements replacement and limit transformations.
4. **User Story 2 (Phase 4)** $\rightarrow$ **User Story 3 (Phase 5)**: Implements chaining and fallbacks.
5. **User Story 3 (Phase 5)** $\rightarrow$ **Polish (Phase 6)**: Runs final validation.
