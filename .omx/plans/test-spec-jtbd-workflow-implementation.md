# Test Specification: JTBD Workflow Implementation

## Scope

Initial test scope is Slice P0-A: requirement acceptance and assignment workflow.

## Backend / Server Action Tests

Target file: `frontend/__tests__/actions/requirements-workflow.test.ts`

Required cases:
- Happy path accepts a requirement, updates workflow metadata, sets compliance in progress, creates a linked writing task, and logs task activity.
- Evidence/checklist gate failure blocks acceptance when source trace/category/priority/owner/due date/reason are missing.
- Rejection records terminal workflow state and reason and does not create a writing task.
- Reopen transitions accepted or rejected requirement back to review and logs reason.
- Idempotent task projection does not duplicate an existing requirement writing task and resyncs assignment fields.
- Invalid transitions fail before task or requirement writes.
- Transaction-level requirement lock is acquired before transition reads.

Verification command:
- `cd frontend && npm test -- requirements-workflow.test.ts RequirementDetailWorkflow.test.ts`

## Frontend UI Tests

Add or extend component tests if a UI component is changed in this slice. Required assertions:
- Workflow actions are visible with current state.
- Blocked action states surface missing gates.
- Reason/owner/due-date inputs are required before accept.

Current focused coverage:
- `frontend/__tests__/components/RequirementDetailWorkflow.test.ts` verifies gate readiness and form-edit remediation logic.
- Full DOM interaction coverage remains deferred until the project standardizes React Testing Library or equivalent UI test helpers.

## Broader Verification

Where practical:
- `cd frontend && npm test -- requirements-unification.test.ts requirements-workflow.test.ts`
- `cd frontend && npm run lint` if configured and not blocked by repository-wide unrelated issues.
- Targeted TypeScript check if available.

## Evidence Requirements

Final report must include exact commands run and results read. If broad lint/build is skipped or fails for unrelated dirty-tree issues, record the limitation in `docs/jtbd-workflow-implementation-plan.md`.
