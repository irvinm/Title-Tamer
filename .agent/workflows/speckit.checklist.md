---
description: Generate a quality checklist for the feature
---

# /speckit.checklist — Quality Checklist Generation

Generate a targeted quality checklist for the current feature based on the user's requested focus area.

## Inputs

- User specifies a checklist type (e.g., "requirements", "security", "performance", "launch", "accessibility", or custom)
- `specs/<branch-name>/spec.md` (for requirements context)
- `specs/<branch-name>/plan.md` (for technical context)
- `specs/<branch-name>/tasks.md` (for implementation status)
- `.specify/templates/checklist-template.md` for the output format
- `.specify/memory/constitution.md` for principle alignment

## Steps

1. Determine the current feature:
   - Check `$env:SPECIFY_FEATURE` or detect from git branch
   - Locate documents in `specs/<branch-name>/`

2. Read `.specify/templates/checklist-template.md` for the output structure.

3. Read feature documents (spec.md, plan.md, tasks.md) for context.

4. Based on the requested checklist type, generate appropriate items:

   **Requirements Checklist**:
   - All FRs have acceptance scenarios
   - All user stories are independently testable
   - Edge cases are covered
   - Success criteria are measurable

   **Security Checklist**:
   - Input validation on all user inputs
   - Permission checks on sensitive operations
   - No hardcoded secrets or credentials
   - Minimal permission requests
   - Data sanitization for storage

   **Performance Checklist**:
   - Performance targets from spec are met
   - No blocking operations on the main thread
   - Memory usage is bounded for large inputs
   - Batch operations are optimized
   - Load testing completed

   **Launch Checklist**:
   - All tests pass
   - Documentation is up to date
   - Quickstart.md validation passes
   - No `[NEEDS CLARIFICATION]` markers remain
   - All tasks in tasks.md are marked `[x]`
   - Agent context files are updated
   - Version number is correct in manifest/package

   **Custom**: Generate items based on the user's specific focus area.

5. Number all items with CHK### prefix for trackability.

6. Write the checklist to `specs/<branch-name>/checklists/<type>.md`:

```markdown
# [Type] Checklist: [Feature Name]

**Purpose**: [description based on type]
**Created**: [DATE]
**Feature**: [link to spec.md]

## [Category 1]

- [ ] CHK001 [specific, actionable item]
- [ ] CHK002 [specific, actionable item]

## [Category 2]

- [ ] CHK003 [specific, actionable item]

## Notes

- Check items off as completed: `[x]`
- Add comments or findings inline
```

7. Present the checklist to the user. Items can be checked off as they are completed.
