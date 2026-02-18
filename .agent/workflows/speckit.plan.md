---
description: Generate technical implementation plan from a feature specification
---

# /speckit.plan — Implementation Plan

Generate a comprehensive technical implementation plan from an existing feature specification.

## Inputs

- `specs/<branch-name>/spec.md` (required — run `/speckit.specify` first)
- `.specify/memory/constitution.md` for constitutional compliance checks
- `.specify/templates/plan-template.md` for the output format
- User provides tech stack and architecture decisions (or confirms existing ones)

## Steps

1. Determine the current feature branch:
   - Check `$env:SPECIFY_FEATURE` or detect from git branch
   - Locate `specs/<branch-name>/spec.md`

2. Run the plan setup script to scaffold the plan file:
   ```powershell
   # turbo
   pwsh -File ".specify/scripts/powershell/setup-plan.ps1" -Json
   ```

3. Read `specs/<branch-name>/spec.md` to understand all requirements, user stories, and acceptance criteria.

4. Read `.specify/memory/constitution.md` to load project principles.

5. Ask the user for any tech stack decisions not already established:
   - Language/version
   - Primary dependencies/frameworks
   - Storage solution
   - Testing framework
   - Target platform
   - Performance goals and constraints

6. Fill in `plan.md` with:
   - **Summary** — Primary requirement + technical approach
   - **Technical Context** — Language, dependencies, storage, testing, platform, performance goals, constraints, scale
   - **Constitution Check** — A checkbox for each constitutional principle with pass/fail assessment
   - **Project Structure** — Documentation tree and source code layout with exact paths
   - **Complexity Tracking** — Any constitutional violations with justification

7. Generate supporting documents in the feature's `specs/<branch-name>/` directory:

   **research.md** — Technology research and comparisons:
   - Library/API evaluations
   - Performance benchmarks from documentation
   - Security considerations
   - Alternatives considered and why they were rejected

   **data-model.md** — Entity definitions and relationships:
   - Key entities from the spec
   - Attributes and types
   - Relationships between entities
   - State transitions (if applicable)

   **contracts/** directory — API/interface contracts:
   - Message formats
   - Event schemas
   - Endpoint definitions
   - One file per contract area (e.g., `contracts/messages.md`)

   **quickstart.md** — Key validation scenarios:
   - How to build and run the feature
   - Key test commands
   - Manual validation steps
   - Expected outcomes for smoke testing

8. Run the agent context update script:
   ```powershell
   # turbo
   pwsh -File ".specify/scripts/powershell/update-agent-context.ps1" -AgentType gemini
   ```

9. Present the plan and supporting docs to the user for review. The plan must pass the constitution check before proceeding to `/speckit.tasks`.

## Important Notes

- Every technology choice must have documented rationale
- Every architectural decision must trace back to specific requirements in spec.md
- The constitution check is a GATE — do not proceed if any principle is violated without documented justification
- Supporting docs should be thorough enough to enable task generation without referring back to the spec
