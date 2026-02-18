---
description: AI-RICE scoring and idea selection from the backlog
---

# /speckit.select — Idea Selection via AI-RICE Scoring

Score and rank ideas from the backlog using the RICE prioritization framework, then recommend the top candidate for specification.

## Inputs

- `specs/backlog/ideas.md` (required — run `/speckit.ideate` first if missing)
- `.specify/memory/constitution.md` for alignment checks
- User may optionally provide weighting preferences or constraints

## Steps

1. Read `specs/backlog/ideas.md` to load the ideas list.

2. Read `.specify/memory/constitution.md` to understand project principles and constraints.

3. For each idea, estimate **RICE** scores:
   - **R**each — How many users/sessions will this affect in a given period? (1–10 scale)
   - **I**mpact — How much will it improve the experience? (3 = massive, 2 = high, 1 = medium, 0.5 = low, 0.25 = minimal)
   - **C**onfidence — How confident are we in R and I estimates? (100% = high, 80% = medium, 50% = low)
   - **E**ffort — How many person-weeks of work? (lower = better)
   - **RICE Score** = (Reach × Impact × Confidence) ÷ Effort

4. Check each idea for **constitutional alignment** — flag any that conflict with the project's principles.

5. Generate a ranked selection table sorted by RICE score descending:

```markdown
# Idea Selection Report

**Generated**: [DATE]
**Ideas Evaluated**: [N]

## RICE Scoring

| Rank | Idea | Reach | Impact | Confidence | Effort | RICE Score | Constitution | Recommendation |
|------|------|-------|--------|------------|--------|------------|-------------|----------------|
| 1 | [title] | 8 | 3 | 80% | 2w | 9.6 | ✅ Aligned | 🏆 Top Pick |
| 2 | [title] | 6 | 2 | 100% | 3w | 4.0 | ✅ Aligned | Strong |

## Top Recommendation

**Selected Idea**: [title]
**Why**: [brief rationale citing RICE score and constitutional alignment]
**Next Step**: Run `/speckit.structure` to create the vision canvas for this idea.

## Notes & Caveats

- [any assumptions, dependencies, or risks noted during scoring]
```

6. Write the report to `specs/backlog/selection.md`.

7. Present the ranking to the user. Ask if they approve the top pick or want to override the selection before proceeding to `/speckit.structure`.
