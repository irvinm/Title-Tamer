---
description: Cross-check spec, plan, and tasks for consistency and gaps
---

# /speckit.analyze — Consistency Analysis

Cross-check spec.md, plan.md, and tasks.md for consistency, gaps, contradictions, and constitutional violations.

## Inputs

- `specs/<branch-name>/spec.md` (required)
- `specs/<branch-name>/plan.md` (required)
- `specs/<branch-name>/tasks.md` (optional but recommended)
- `specs/<branch-name>/data-model.md` (optional)
- `specs/<branch-name>/contracts/` (optional)
- `.specify/memory/constitution.md` for principle checks

## Steps

1. Determine the current feature:
   - Check `$env:SPECIFY_FEATURE` or detect from git branch
   - Locate all documents in `specs/<branch-name>/`

2. Read all available documents.

3. Perform **Traceability Analysis**:
   - Every functional requirement (FR-###) in spec.md should map to at least one task in tasks.md
   - Every user story in spec.md should have a corresponding phase in tasks.md
   - Every entity in data-model.md should appear in tasks.md implementation
   - Every contract in contracts/ should have implementation tasks
   - Flag any orphaned items (requirements without tasks, tasks without requirements)

4. Perform **Consistency Analysis**:
   - Technical context in plan.md matches actual project structure
   - Performance goals in plan.md align with success criteria in spec.md
   - Entity definitions in data-model.md match requirements in spec.md
   - Task phases follow the dependency order specified in tasks.md

5. Perform **Gap Analysis**:
   - Missing test tasks for user stories
   - Requirements without acceptance criteria
   - Edge cases without handling described in tasks
   - Missing error handling or logging tasks
   - Missing documentation tasks

6. Perform **Constitutional Compliance**:
   - For each principle in constitution.md, verify all documents respect it
   - Check that the constitution check in plan.md is accurate

7. Generate an analysis report:

```markdown
# Analysis Report: [Feature Name]

**Date**: [DATE]
**Documents Analyzed**: [list]

## Traceability Matrix

| Requirement | Spec | Plan | Tasks | Data Model | Contract | Status |
|-------------|------|------|-------|------------|----------|--------|
| FR-001 | ✅ | ✅ | ✅ | N/A | N/A | Complete |
| FR-002 | ✅ | ✅ | ❌ | N/A | N/A | Missing task |

## Issues Found

### 🔴 Critical (blocks implementation)
- [issue description]

### 🟡 Warning (should fix before implementation)
- [issue description]

### 🔵 Info (nice to fix)
- [issue description]

## Constitutional Compliance

| Principle | Status | Notes |
|-----------|--------|-------|
| [Principle I] | ✅/❌ | [notes] |

## Recommendations

1. [actionable recommendation]
```

8. Write the report to `specs/<branch-name>/analysis.md`.

9. Present the report to the user with recommendations for resolution.
