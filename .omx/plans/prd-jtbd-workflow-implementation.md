# PRD: JTBD Workflow Implementation Program

## Purpose

Extend DocFusion from feature-rich proposal tooling into a workflow-backed platform that supports the JTBD catalogue with explicit states, gates, tasks, notifications, audit evidence, and authority controls.

## Source Of Truth

- `docs/platform-jtbd-catalogue.md`
- This PRD covers the Ralph execution program and will be updated as slices complete.

## Initial Vertical Slice

### Slice P0-A: Requirement Acceptance And Assignment Workflow

Related JTBDs: JTBD-013, JTBD-014, JTBD-019, JTBD-020, JTBD-060.

Problem:
Extracted requirements currently persist as records and can be assigned, but the platform lacks explicit accept/reject workflow transitions, reason codes, checklist/evidence gates, task projection, and audit activity for the point where extracted requirements become actionable proposal work.

Users:
- Proposal manager
- Content writer
- Compliance officer
- Auditor

Desired behavior:
- Proposal manager accepts a requirement only when minimum source trace, category, priority, owner, and due date gates pass.
- Accepting a requirement updates requirement workflow metadata and compliance status.
- Accepting with an owner projects or resyncs a proposal writing task if one already exists for the requirement.
- Rejection records reason and terminal workflow state without creating writing work.
- Reopening a rejected/accepted requirement records reason and restores review state.
- Every transition records metadata history with evidence; transitions with a projected task also emit task activity using existing infrastructure.

Acceptance criteria:
- Server action exposes legal transitions: accept, reject, reopen.
- Invalid transitions fail with actionable errors.
- Acceptance gate fails without source trace, category, priority, reason, owner, or due date.
- Acceptance projects one linked writing task, guarded by a transaction-level advisory lock, and resyncs the task on later review-state acceptance.
- Rejection does not create a writing task.
- Reopen records prior state and reason.
- Tests cover happy path, blocked gate, authority/minimum input failure, illegal transition failure, task projection/resync, audit metadata/activity emission, UI gate logic, and reopen.

## Future P0 Slices

1. RFP intake parse lifecycle and exception queue. Pilot implemented with metadata-backed retry/reject/manual-extraction/cancel transitions plus optional server-side Linode E3 RFP storage; security scan, SSE, notifications, and global exception queue remain.
2. Compliance matrix row governance and waiver gates.
3. Gate review and approval enforcement.
4. Production/render/submission workflow.
5. Runtime transition/audit normalization.

### Slice P0-B: RFP Intake Parse Lifecycle

Related JTBDs: JTBD-011, JTBD-012, JTBD-072.

Problem:
RFP upload and parse tables/routes exist, but failed parsing did not have a governed remediation path and the uploader treated upload completion as if parsing were complete.

Desired behavior:
- Failed or cancelled parse jobs can be retried with reason and audit history.
- Operators can reject a failed parse or mark it for manual extraction with reason.
- Retry creates a fresh queued parsing job and resets document parse status.
- Parse API retries failed documents through the workflow action rather than bypassing lifecycle history.
- The uploader polls parse status and exposes failed parse retry separately from upload retry.
- RFP binaries are stored server-side in Linode E3 object storage when configured; browser uploads never depend on object-store CORS.

Acceptance criteria:
- Server action exposes retry, reject, manual extraction, and cancel transitions.
- Invalid transitions fail before creating or updating jobs.
- Retry records attempt history in existing metadata and creates one queued job.
- Parse completion/failure records terminal metadata history.
- Uploader displays parse progress/current step, terminal parse errors, and parse retry.
- Linode E3 storage configuration is server-only, uses placeholder env vars, and writes a storage receipt into existing document metadata.

## Non-Goals For Initial Slice

- No new dependency.
- No broad redesign of the Python workflow engine.
- No schema migration unless existing metadata/task tables are insufficient.
- No claim of full JTBD completion; catalogue status may move from `Partial` to more specific evidence only.
