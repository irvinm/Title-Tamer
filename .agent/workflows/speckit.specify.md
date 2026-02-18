---
description: Create a new feature specification with branch, directory, and spec.md
---

# /speckit.specify — Feature Specification

Create a new feature specification from a user description. Scaffolds the branch/directory structure and generates a detailed spec.md using the template.

## Inputs

- User provides a feature description (e.g., "Add keyboard shortcut customization for sorting")
- `.specify/memory/constitution.md` for principle alignment
- `.specify/templates/spec-template.md` for the output format

## Steps

1. Run the feature scaffolding script to create the branch and directory:
   ```powershell
   # turbo
   pwsh -File ".specify/scripts/powershell/create-new-feature.ps1" -Json "<user's feature description>"
   ```
   This creates:
   - A new git branch (e.g., `002-keyboard-shortcuts`)
   - A directory at `specs/<branch-name>/`
   - A copy of `spec-template.md` as `spec.md`

2. Read the output to get the `BRANCH_NAME`, `SPEC_FILE`, and `FEATURE_NUM`.

3. Set the `SPECIFY_FEATURE` environment variable:
   ```powershell
   # turbo
   $env:SPECIFY_FEATURE = "<BRANCH_NAME>"
   ```

4. Read `.specify/memory/constitution.md` to understand project principles.

5. Read the generated `spec.md` template file.

6. Begin a **clarification dialogue** with the user. Ask questions to fill gaps in the feature description:
   - Scope boundaries (what's in/out?)
   - User interactions and workflows
   - Edge cases and error handling
   - Performance expectations
   - Integration points with existing features
   - Ask at most 8–12 questions per round to avoid overwhelming the user

7. Once clarifications are gathered, fill in the `spec.md` with:
   - **Feature metadata** (branch, date, status, input description)
   - **Clarifications section** documenting all Q&A from step 6
   - **User Stories** prioritized P1, P2, P3... — each independently testable with:
     - Plain language description
     - Priority rationale
     - Independent test description
     - Given/When/Then acceptance scenarios
   - **Edge Cases** specific to this feature
   - **Functional Requirements** (FR-001, FR-002...) using MUST/SHOULD/MAY language
   - **Key Entities** if the feature involves data
   - **Success Criteria** with measurable outcomes (SC-001, SC-002...)

8. Mark any unclear requirements with `[NEEDS CLARIFICATION: ...]` for follow-up.

9. Write the completed spec to `specs/<branch-name>/spec.md`.

10. Present the spec to the user for review. Iterate on clarifications until the user is satisfied.

## Important Notes

- Focus on the **what** and **why**, NOT the technical how
- User stories must be independently testable — each should be a viable MVP slice
- All requirements must be technology-agnostic where possible
- The spec is a living document — it can be updated with `/speckit.clarify` later
