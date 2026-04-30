# JTBD Workflow Implementation Plan

Static tracker for the workflow implementation program. Source of truth for scope is `docs/platform-jtbd-catalogue.md`.

## Status Legend

| Status | Meaning |
|---|---|
| Not started | No implementation work has begun in this tracker. |
| In progress | Current Ralph slice is actively changing code. |
| Verified | Slice has implementation and fresh targeted verification. |
| Committed | Slice has a local commit. |
| Pushed | Slice commit was pushed to remote. |
| Blocked | External issue prevents completion; blocker recorded. |

## Slice Tracker

| Slice | JTBD IDs | Current support | Backend changes required | Frontend changes required | Data model / migration changes | Workflow / task / notification / audit changes | Tests required | Status | Commit hash | Evidence / gaps |
|---|---|---|---|---|---|---|---|---|---|---|
| P0-A Requirement acceptance and assignment workflow | JTBD-013, JTBD-014, JTBD-019, JTBD-020, JTBD-060 | Requirements can be stored, accepted/rejected/reopened, and accepted requirements project a linked writing task. Broader SLA/notification/escalation remains future work. | Added `transitionRequirementWorkflow` around `rfpRequirements`, `proposalTasks`, and `taskActivity`. | Added workflow controls, gate visibility, session actor use, and history preview to `RequirementDetail`. | No migration; uses existing requirement `metadata` and task/activity tables. | Legal transitions, acceptance gates, Postgres advisory lock, task projection/resync, metadata history with evidence, and task activity audit implemented for pilot workflow. | `npm test -- requirements-unification.test.ts requirements-workflow.test.ts RequirementDetailWorkflow.test.ts`; `npx tsc --noEmit --pretty false`; targeted `npm run lint -- --file ...`. | Verified | TBD | 11 focused tests pass; TypeScript passes; targeted lint passes. Canonical workflow runtime, universal audit table, notifications, SLA escalation, and full UI rendering tests remain future work. Push pending commit. |
| P0-B RFP intake parse lifecycle | JTBD-011, JTBD-012, JTBD-072 | Upload/parse surfaces exist but storage/progress/failure paths are partial. | Durable parse job workflow and exception projection. | Parse status UI with blocked/error actions. | TBD | Parse states, retry/reject/manual extraction, notifications, audit. | Backend/API and UI tests. | Not started | TBD | Future slice. |
| P0-C Compliance matrix governance | JTBD-015, JTBD-016, JTBD-017 | Matrix schemas/generators exist; row lifecycle/waiver/final lock incomplete. | Matrix row workflow and waiver authority. | Matrix gate UI and waiver dialogs. | TBD | Gap tasks, waiver audit, lock workflow. | Action/API/UI tests. | Not started | TBD | Future slice. |
| P0-D Gate/review/approval enforcement | JTBD-007, JTBD-008, JTBD-027, JTBD-028 | Gate/review/approval data exists; enforcement is partial. | Gate transition service and authority checks. | Gate action UI. | TBD | Quorum, checklist, votes, notifications, audit. | Action/API/UI tests. | Not started | TBD | Future slice. |
| P0-E Production/render/submission | JTBD-047, JTBD-048, JTBD-049, JTBD-050, JTBD-070 | Rendering and submission surfaces exist; final package workflow incomplete. | Render job and submission package workflow. | Production checklist and final approval UI. | TBD | Artifact hashes, signatures, receipts, correction path. | Renderer/action/UI tests. | Not started | TBD | Future slice. |
| P0-F Exception queue and operations | JTBD-064, JTBD-065, JTBD-072, JTBD-074 | Monitoring exists in pieces; no unified exception queue. | Exception subject model/service. | Operator queue UI. | Likely migration needed. | Retry/reassign/escalate/audit. | Backend/frontend tests. | Not started | TBD | Future slice. |

## Continuation Notes

- Keep slices vertical and reviewable.
- Stage only files changed for the active Ralph slice.
- Update `docs/platform-jtbd-catalogue.md` only after verified implementation changes status/evidence.
- After each verified slice, commit using the Lore protocol and push if credentials/network permit.
