# Ralph Context Snapshot: JTBD Workflow Implementation

## Task Statement

Continue `ralph @~/src/pjs/jtbd-impl-promptx.md`: implement the JTBD workflow catalogue in priority order, one coherent vertical slice at a time, with verification, tracker/catalogue updates, Lore-style commit, and push after each slice.

## Desired Outcome

DocFusion steadily moves from feature surfaces to workflow-backed JTBD support. Each slice should include backend workflow logic, frontend affordances where applicable, tests, evidence, tracker updates, and conservative catalogue status changes.

## Known Facts / Evidence

- JTBD catalogue exists at `docs/platform-jtbd-catalogue.md`.
- PRD exists at `.omx/plans/prd-jtbd-workflow-implementation.md`.
- Test spec exists at `.omx/plans/test-spec-jtbd-workflow-implementation.md`.
- Tracker exists at `docs/jtbd-workflow-implementation-plan.md`.
- Current branch is `ralph-jtbd-workflow-requirements`.
- P0-A requirement acceptance and assignment workflow was implemented and pushed in commit `e7842d5`.
- P0-B RFP intake/parse lifecycle, Linode E3 manual uploads, fetched RFP object storage, and bucket reads were implemented and pushed through commit `27727a0`.
- Linode E3 runtime credentials live in ignored env files only; committed examples contain no secrets.

## Constraints

- Do not commit secrets or modify ignored env files unless explicitly required for local validation.
- Do not revert unrelated dirty worktree changes.
- Use existing project patterns and avoid new dependencies unless clearly necessary.
- Keep commits coherent and reviewable.
- Use the repository Lore commit protocol.
- Verification must be fresh and read before claiming completion.

## Unknowns / Open Questions

- Some broad test suites may be affected by unrelated existing dirty tree changes.
- P0-C compliance matrix governance needs inspection before exact implementation scope.
- Existing compliance matrix UI/API surfaces may be partial or placeholder-heavy.

## Likely Codebase Touchpoints

- `docs/platform-jtbd-catalogue.md`
- `docs/jtbd-workflow-implementation-plan.md`
- `.omx/plans/prd-jtbd-workflow-implementation.md`
- `.omx/plans/test-spec-jtbd-workflow-implementation.md`
- `frontend/lib/db/schema-rfp.ts`
- `frontend/lib/actions/compliance-validator.ts`
- `frontend/app/api/v1/compliance-matrix/[matrixId]/route.ts`
- `frontend/components/compliance/*`
- `frontend/components/rfp/ComplianceMatrix.tsx`
- `frontend/__tests__/**`
