---
description: Create AI vision canvas and vision brief for a selected idea
---

# /speckit.structure — Vision Canvas + Vision Brief

Transform a selected idea into a structured vision canvas and concise vision brief document.

## Inputs

- `specs/backlog/selection.md` (recommended — or user provides the idea directly)
- `.specify/memory/constitution.md` for principle alignment
- User description of the idea (if not coming from selection report)

## Steps

1. Identify the selected idea:
   - If `specs/backlog/selection.md` exists, use the top recommendation
   - Otherwise, ask the user to describe the idea they want to structure

2. Read `.specify/memory/constitution.md` for project principles.

3. Develop the **Vision Canvas** covering these dimensions:
   - **Problem Statement** — What pain point does this solve? Who experiences it?
   - **Target User** — Who benefits? What are their characteristics and context?
   - **Value Proposition** — What unique value does this deliver? Why now?
   - **Key Features** — 3–5 core capabilities (not implementation details)
   - **Success Metrics** — How will we measure success? (quantifiable)
   - **Assumptions** — What must be true for this to work?
   - **Risks & Mitigations** — What could go wrong? How do we address it?
   - **Constraints** — Technical, time, resource, or policy limitations
   - **Dependencies** — External systems, APIs, or features required

4. Write a concise **Vision Brief** — a 1-page summary suitable for stakeholder buy-in.

5. Create the output at `specs/backlog/vision-brief.md`:

```markdown
# Vision Brief: [Idea Title]

**Created**: [DATE]
**Status**: Phase 0 — Pre-Specification
**Origin**: [link to selection.md or "User-provided"]

## Vision Canvas

### Problem
[2-3 sentences describing the pain point]

### Target User
[Who benefits and in what context]

### Value Proposition
[What unique value this delivers]

### Key Features
1. [Feature 1]
2. [Feature 2]
3. [Feature 3]

### Success Metrics
| Metric | Target | How Measured |
|--------|--------|-------------|
| [metric] | [target] | [method] |

### Assumptions
- [assumption 1]
- [assumption 2]

### Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [risk] | High/Med/Low | High/Med/Low | [strategy] |

### Constraints
- [constraint 1]

### Dependencies
- [dependency 1]

## Executive Summary

[3-5 sentence vision brief suitable for quick stakeholder review]

## Next Step

Run `/speckit.validate` to confirm this idea passes Gate G0 before entering the core SDD workflow.
```

6. Present the vision brief to the user for review and refinement.
