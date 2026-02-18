---
description: Review spec for ambiguities and conduct clarification Q&A
---

# /speckit.clarify — Specification Clarification

Review an existing spec.md for ambiguities, gaps, and unclear requirements, then conduct a clarification dialogue with the user.

## Inputs

- `specs/<branch-name>/spec.md` (required)
- `.specify/memory/constitution.md` for principle alignment
- User may optionally specify which areas to focus on

## Steps

1. Determine the current feature:
   - Check `$env:SPECIFY_FEATURE` or detect from git branch
   - Locate `specs/<branch-name>/spec.md`

2. Read `spec.md` thoroughly, analyzing:
   - **Ambiguous language** — Words like "should", "might", "possibly", "etc.", "and/or"
   - **Missing edge cases** — What happens at boundaries, with empty inputs, under load?
   - **Undefined terms** — Domain-specific language without explanation
   - **Conflicting requirements** — FR items that contradict each other
   - **`[NEEDS CLARIFICATION]` markers** — Any previously flagged items
   - **Untestable acceptance criteria** — Given/When/Then that can't be objectively verified
   - **Missing user stories** — Gaps in the user journey not covered

3. Read `.specify/memory/constitution.md` and check for principle violations in the spec.

4. Compile a list of clarification questions, grouped by category:
   - **Scope** — Boundaries and exclusions
   - **Behavior** — How the system should react in specific scenarios
   - **Data** — Input/output formats, validation rules, persistence
   - **Integration** — Interactions with other features or external systems
   - **Performance** — Thresholds, limits, acceptable degradation
   - **Error Handling** — What happens when things go wrong

5. Present the questions to the user (max 10–12 per round to avoid overwhelm).

6. After receiving answers, update `spec.md`:
   - Append a new dated session to the **Clarifications** section:
     ```markdown
     ### Session [DATE]
     - Q: [question] → A: [answer]
     ```
   - Update affected **User Stories**, **Requirements**, and **Edge Cases** with the new information
   - Remove resolved `[NEEDS CLARIFICATION]` markers
   - Add new markers for any follow-up questions

7. If more questions remain, repeat steps 5–6.

8. Present the updated spec to the user for final review.
