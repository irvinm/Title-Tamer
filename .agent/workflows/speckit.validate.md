---
description: Gate G0 validation — confirm readiness to enter core SDD workflow
---

# /speckit.validate — Gate G0 Validation

Run a pass/fail gate check against the constitution and Phase 0 artifacts to confirm the idea is ready for the core Spec-Driven Development workflow.

## Inputs

- `.specify/memory/constitution.md` (required)
- `specs/backlog/vision-brief.md` (required — run `/speckit.structure` first)
- `specs/backlog/ideas.md` (optional — for traceability)
- `specs/backlog/selection.md` (optional — for RICE context)

## Steps

1. Read `.specify/memory/constitution.md` to load all project principles.

2. Read `specs/backlog/vision-brief.md` to load the structured idea.

3. Evaluate the idea against the **Gate G0 Checklist**:

### Constitutional Alignment
For each principle in the constitution, check:
- Does the proposed idea respect this principle?
- Does it require any constitutional exceptions?

### Completeness Checks
- [ ] Problem statement is clear and specific
- [ ] Target user is identified
- [ ] Value proposition is articulated
- [ ] At least 3 key features are defined
- [ ] At least 2 success metrics are quantifiable
- [ ] Risks have been identified with mitigations
- [ ] Constraints and dependencies are documented

### Feasibility Checks
- [ ] Idea is technically feasible within the project's tech stack
- [ ] No blocking dependencies remain unresolved
- [ ] Effort estimate from RICE is reasonable for the team/timeline
- [ ] Idea does not duplicate existing functionality

### Strategic Checks
- [ ] Idea aligns with the project's core purpose
- [ ] Idea provides value to the target user base
- [ ] RICE score justifies investment (if scored)

4. Generate the Gate G0 report:

```markdown
# Gate G0 Validation Report

**Idea**: [Title]
**Date**: [DATE]
**Verdict**: ✅ PASS / ❌ FAIL / ⚠️ CONDITIONAL PASS

## Constitutional Alignment

| Principle | Status | Notes |
|-----------|--------|-------|
| [Principle I] | ✅/❌/⚠️ | [notes] |

## Checklist Results

### Completeness: [X/7 passed]
- [x/✗] Problem statement clear
- [x/✗] Target user identified
- [x/✗] Value proposition articulated
- [x/✗] Key features defined (≥3)
- [x/✗] Success metrics quantifiable (≥2)
- [x/✗] Risks identified with mitigations
- [x/✗] Constraints/dependencies documented

### Feasibility: [X/4 passed]
- [x/✗] Technically feasible
- [x/✗] No blocking dependencies
- [x/✗] Effort is reasonable
- [x/✗] Not duplicating existing features

### Strategic: [X/3 passed]
- [x/✗] Aligns with project purpose
- [x/✗] Provides user value
- [x/✗] RICE score justifies investment

## Blocking Issues

- [list any FAIL items that must be resolved]

## Recommendations

- [suggestions for addressing issues or improving the proposal]

## Next Step

If PASS: Run `/speckit.specify <idea description>` to create the feature specification.
If FAIL: Address blocking issues and re-run `/speckit.validate`.
```

5. Write the report to `specs/backlog/g0-validation.md`.

6. Present the verdict to the user. If PASS, confirm they're ready to proceed to `/speckit.specify`. If FAIL or CONDITIONAL, explain what needs to be addressed.
