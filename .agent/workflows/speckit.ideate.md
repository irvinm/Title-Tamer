---
description: Generate ideas backlog using SCAMPER + HMW brainstorming
---

# /speckit.ideate — Ideas Backlog Generation

Use SCAMPER and "How Might We" frameworks to brainstorm feature ideas for this project.

## Inputs

- User provides an optional theme or problem area (e.g., "tab organization", "performance")
- If no theme given, use the project's constitution at `.specify/memory/constitution.md` and README.md for context

## Steps

1. Read `.specify/memory/constitution.md` and `README.md` to understand the project's domain, principles, and current capabilities.

2. Run a **SCAMPER** analysis against the project's current feature set:
   - **S**ubstitute — What components, processes, or inputs could be replaced?
   - **C**ombine — What features or ideas could be merged for new value?
   - **A**dapt — What could be adapted from other tools or domains?
   - **M**odify (Magnify/Minify) — What could be scaled up, down, or altered?
   - **P**ut to another use — What existing features could serve new purposes?
   - **E**liminate — What could be removed or simplified?
   - **R**everse/Rearrange — What could be inverted or reordered?

3. Generate **"How Might We" (HMW)** questions based on the SCAMPER outputs:
   - Frame each idea as a user-centric question: "How might we [verb] [object] so that [benefit]?"
   - Aim for 5–10 HMW questions

4. Compile the ideas into a structured backlog. Create `specs/backlog/` directory if it doesn't exist.

5. Write the backlog to `specs/backlog/ideas.md` with this format:

```markdown
# Ideas Backlog

**Generated**: [DATE]
**Theme**: [theme or "General"]

## SCAMPER Analysis

### Substitute
- [idea]

### Combine
- [idea]

### Adapt
- [idea]

### Modify
- [idea]

### Put to Another Use
- [idea]

### Eliminate
- [idea]

### Reverse / Rearrange
- [idea]

## How Might We

| # | HMW Question | Origin (SCAMPER) | Potential Impact |
|---|---|---|---|
| 1 | How might we ... | Combine | High/Med/Low |

## Raw Ideas List

| # | Idea | Category | Notes |
|---|---|---|---|
| 1 | [short title] | [SCAMPER letter] | [brief note] |
```

6. Present the backlog to the user for review. Ask if they want to add, remove, or refine any ideas before moving to `/speckit.select`.
