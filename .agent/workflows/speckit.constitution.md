---
description: Create or update the project constitution with governing principles
---

# /speckit.constitution — Project Constitution

Create or update the project's governing constitution at `.specify/memory/constitution.md`.

## Inputs

- User provides optional focus areas (e.g., "code quality, testing, performance")
- If `.specify/memory/constitution.md` already exists, this is an update operation
- Project context from `README.md` and existing `specs/` for domain understanding

## Steps

1. Check if `.specify/memory/constitution.md` already exists.
   - If YES: read it and note the current version number for amendment tracking
   - If NO: this is a fresh constitution creation

2. Read `README.md` and scan `specs/` directory to understand the project's domain, tech stack, and goals.

3. If UPDATING an existing constitution:
   - Ask the user what principles they want to add, modify, or remove
   - Preserve the existing structure and version history
   - Bump the version number (MINOR for additions, MAJOR for principle changes)
   - Add a Sync Impact Report comment at the top documenting what changed

4. If CREATING a new constitution:
   - Ask the user about their priorities. If they don't have specific ones, suggest principles based on the project domain
   - Draft 3–7 core principles, each with:
     - A Roman numeral and descriptive title
     - A clear statement using MUST/SHOULD/MAY language
     - Rationale for why this principle matters

5. Structure the constitution with these sections:
   - **Core Principles** (numbered I, II, III...)
   - **Technical Standards** (language, async patterns, permissions, etc.)
   - **Development Workflow** (spec-first, task-based, testing requirements)
   - **Governance** (versioning, amendment process)

6. Write to `.specify/memory/constitution.md` with a version footer:
   ```
   **Version**: X.Y.Z | **Ratified**: [DATE] | **Last Amended**: [DATE]
   ```

7. After writing the constitution, check if any existing templates need updating:
   - `.specify/templates/plan-template.md` — update the Constitution Check section
   - `.specify/templates/spec-template.md` — verify alignment
   - `.specify/templates/tasks-template.md` — verify alignment

8. Present the constitution to the user for review and ratification.
