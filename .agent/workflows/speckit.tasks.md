---
description: Generate executable task breakdown from the implementation plan
---

# /speckit.tasks — Task Breakdown

Analyze the implementation plan and supporting documents to generate an ordered, executable task list organized by user story.

## Inputs

- `specs/<branch-name>/plan.md` (required)
- `specs/<branch-name>/spec.md` (required — for user stories and priorities)
- `specs/<branch-name>/data-model.md` (optional)
- `specs/<branch-name>/contracts/` (optional)
- `specs/<branch-name>/research.md` (optional)
- `.specify/templates/tasks-template.md` for the output format

## Steps

1. Determine the current feature:
   - Check `$env:SPECIFY_FEATURE` or detect from git branch
   - Locate all plan documents in `specs/<branch-name>/`

2. Read all input documents:
   - `plan.md` — technical context, project structure, constitution check
   - `spec.md` — user stories with priorities, acceptance scenarios, requirements
   - `data-model.md` — entities, attributes, relationships
   - `contracts/` — API contracts, message formats
   - `research.md` — technology decisions and constraints

3. Read `.specify/templates/tasks-template.md` for the output structure.

4. Generate tasks organized by this phase structure:

   **Phase 1: Setup** — Project initialization and scaffolding
   - Create project structure per plan
   - Install/configure dependencies
   - Set up linting and formatting

   **Phase 2: Foundational** — Core infrastructure that blocks ALL user stories
   - Shared models, utilities, base classes
   - Framework setup (API routing, storage layer, etc.)
   - Mark this phase as CRITICAL — no story work until complete

   **Phase 3+: User Stories** — One phase per user story, ordered by priority (P1 → P2 → P3...)
   - Each story phase includes:
     - Tests (if applicable) — written FIRST, must FAIL before implementation
     - Implementation tasks — models → services → endpoints
     - Integration tasks — connecting with other stories if needed
   - Each story has a checkpoint confirming it's independently testable

   **Phase N: Polish** — Cross-cutting concerns
   - Documentation updates
   - Performance optimization
   - Security hardening
   - Run quickstart.md validation

5. Apply task conventions:
   - Sequential task IDs: T001, T002, T003...
   - Tag parallel-safe tasks with `[P]`
   - Tag user story ownership with `[US1]`, `[US2]`, etc.
   - Include exact file paths in descriptions
   - Format: `- [ ] T### [P] [US#] Description in path/to/file.ext`

6. Add dependency and execution order documentation:
   - Phase dependencies (what blocks what)
   - User story dependencies (which can run in parallel)
   - Within-story ordering (tests → models → services → endpoints)
   - Parallel opportunities

7. Write the completed task list to `specs/<branch-name>/tasks.md`.

8. Present the tasks to the user for review. Confirm they approve before running `/speckit.implement`.

## Important Notes

- Tasks MUST be atomic and independently completable
- Each user story MUST be independently testable at its checkpoint
- Tests are written FIRST per the TDD constitution principle
- Avoid vague task descriptions — each task should be unambiguous
- Avoid cross-story dependencies that break story independence
