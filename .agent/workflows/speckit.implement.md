---
description: Execute all tasks from tasks.md to build the feature
---

# /speckit.implement — Feature Implementation

Execute all tasks from `tasks.md` in order to build the feature according to the specification and plan.

## Inputs

- `specs/<branch-name>/tasks.md` (required — run `/speckit.tasks` first)
- `specs/<branch-name>/plan.md` (for technical context)
- `specs/<branch-name>/spec.md` (for acceptance criteria validation)
- `specs/<branch-name>/data-model.md` (for entity implementations)
- `specs/<branch-name>/contracts/` (for API/message implementations)
- `specs/<branch-name>/quickstart.md` (for final validation)
- `.specify/memory/constitution.md` (for principle adherence)

## Steps

1. Determine the current feature:
   - Check `$env:SPECIFY_FEATURE` or detect from git branch
   - Locate `specs/<branch-name>/tasks.md`

2. Read all relevant documents for implementation context.

3. Execute tasks **in phase order**, following the dependency chain in `tasks.md`:

### Phase 1: Setup
- Execute all setup tasks (project structure, dependencies, tooling)
- Mark each completed task as `[x]` in tasks.md
- Commit: "chore: project setup for <feature>"

### Phase 2: Foundational
- Execute foundational infrastructure tasks
- Parallel-safe tasks `[P]` can be done together
- Mark each completed task as `[x]` in tasks.md
- Commit: "feat: foundational infrastructure for <feature>"
- **CHECKPOINT**: Verify foundational layer before proceeding

### Phase 3+: User Stories (P1 → P2 → P3...)
For each user story phase:

a. **Write Tests First** (if applicable):
   - Create test files per task descriptions
   - Run tests to confirm they FAIL (Red phase)
   - Commit: "test: add failing tests for US# <story title>"

b. **Implement**:
   - Build models, then services, then endpoints/features
   - Follow exact file paths from task descriptions
   - Run tests after each logical group to confirm they PASS (Green phase)
   - Commit: "feat: implement US# <story title>"

c. **Refactor** (if needed):
   - Clean up code while keeping tests green
   - Commit: "refactor: clean up US# implementation"

d. **Story Checkpoint**:
   - Verify the user story works independently
   - Check acceptance scenarios from spec.md
   - Mark all story tasks as `[x]` in tasks.md

### Phase N: Polish
- Execute documentation, performance, and security tasks
- Run quickstart.md validation steps
- Final commit: "chore: polish and documentation for <feature>"

4. After all tasks are complete:
   - Verify ALL tasks in tasks.md are marked `[x]`
   - Run the full test suite to confirm nothing is broken
   - Run linting and formatting checks
   - Update the agent context:
     ```powershell
     # turbo
     pwsh -File ".specify/scripts/powershell/update-agent-context.ps1" -AgentType gemini
     ```

5. Present a completion summary to the user showing:
   - Tasks completed vs total
   - Test results
   - Any issues encountered and how they were resolved
   - Suggestion to run `/speckit.checklist` for a quality review

## Important Notes

- NEVER skip the Red-Green-Refactor cycle — tests must fail before implementation
- Commit after each logical group of tasks, not after every individual task
- If a task reveals a design flaw, STOP and discuss with the user before proceeding
- If implementation diverges from the plan, update plan.md to reflect the actual approach
- Preserve the `[x]` checkmarks in tasks.md as a living progress record
