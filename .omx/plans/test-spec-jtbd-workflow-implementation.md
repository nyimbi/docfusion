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

## Slice P0-B: RFP Intake Parse Lifecycle

Target file: `frontend/__tests__/actions/rfp-parse-workflow.test.ts`

Required cases:
- Latest parse lifecycle reports document/job state, progress, step, and error.
- Retry from failed state creates a new queued job, resets document status/progress, and writes metadata history.
- Reject from failed state records terminal workflow state and reason.
- Retry from processing state fails before creating or updating jobs.

Storage helper target file: `frontend/__tests__/storage/linode-e3.test.ts`

Required cases:
- Object storage remains disabled unless bucket, access key ID, and secret access key are all configured.
- RFP object keys are stable and sanitize unsafe filename characters.
- Stored `s3://bucket/key` paths parse back into bucket/key.
- Uploads use a server-side AWS v4 signed PUT request against the Linode E3 endpoint.

Fetched-document target file: `frontend/__tests__/services/rfp-document-service.test.ts`

Required cases:
- Downloading a discovered RFP stores the fetched binary in Linode E3 and records the `s3://` storage path.
- Later text extraction re-fetches bytes from Linode E3 before Docling processing.

Verification command:
- `cd frontend && npm test -- rfp-parse-workflow.test.ts linode-e3.test.ts rfp-document-service.test.ts`

Additional checks:
- `cd frontend && npx tsc --noEmit --pretty false`
- Targeted lint for `lib/actions/rfp-parser.ts`, `lib/services/rfp-document-service.ts`, `app/api/v1/rfp/[rfpId]/parse/route.ts`, `app/api/v1/rfp/upload/route.ts`, `components/rfp/RFPUploader.tsx`, `lib/storage/linode-e3.ts`, and the workflow/storage/fetch tests.
