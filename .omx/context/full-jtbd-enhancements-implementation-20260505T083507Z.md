# Full JTBD And Enhancements Implementation Context

Timestamp: 2026-05-05T08:35:07Z

## Task Statement

Plan the full implementation of all pending Jobs To Be Done in `docs/platform-jtbd-catalogue.md` and all product usability enhancements in `docs/enhancements.md`.

## Desired Outcome

Produce a consensus-reviewed implementation plan that can be handed to `$ralph` or `$team` for execution. The plan must cover backend, frontend, workflow runtime, UI surfacing, verification, live proof, and operational hardening required to move pending JTBD from `Partial`/`Planned`/`Strategic` toward fully implemented and surfaced capability.

## Known Facts And Evidence

- `docs/platform-jtbd-catalogue.md` lists 75 JTBD.
- Current catalogue status count from local inspection:
  - `Live`: 7
  - `Partial`: 61
  - `Planned`: 3
  - `Planned/Partial`: 1
  - `Strategic`: 2
  - `Strategic/Planned`: 1
- Live JTBD are concentrated in opportunity search, pipeline movement, capture activities, document authoring, comments, color-team reviews, and template lifecycle.
- `.omx/state/platform-e2e-facility-ledger.md` shows important proof rows already passing: RFP E3 storage, failed-parse remediation, snippet insertion, submission package, auth/session, authz, workflow template governance, workflow worker loop, Stalwart delivery-attempt path, E3 readback, operational exception sync, and migration validation.
- The same ledger still marks many product lanes `blocked`, including opportunity triage proof, scraper schedule/health proof, requirement extraction/review proof, compliance lifecycle, proposal planning/tasks, document creation from template, editor persistence, reviews/approval gates, CRM/partner/personnel reuse, pricing/evidence/competitive support, imports, render/export, outcomes, audit explorer, DLP/export checks, health probes, backup/restore, AI provider governance, and research/search integration proof.
- `docs/enhancements.md` lists 25 usability enhancements. Recommended first five are Opportunity Command Center, Next Best Action Queue, Context-Aware Writing Assistant, Response Readiness Score, and Final Submission Checklist.
- Frontend routes exist for analytics, calendar, company, competitive, content library, CRM, documents, HDSI, import, opportunities, partners, past performance, personnel, pipeline, reviews, settings, tasks, templates, and workflows.
- Workflow runtime sidecar exists in frontend code with instances, tasks, audit events, notifications, templates, dashboard/operations/portal APIs, worker scripts, Stalwart dispatch, and template governance.
- `docs/plans/2026-04-22-master-completion-plan.md` remains relevant for Python-heavy and infrastructure gaps: RFP pipeline unification, agent subsystem completion, LaTeX/render pipeline, schema parity, API bridge, production readiness, and stub removal.

## Constraints

- Do not overclaim: a screen or route is not full JTBD completion unless the underlying job is workflow-backed, authorized, auditable, tested, and surfaced with relevant user actions.
- User wants a plan, not immediate implementation.
- Planning must account for live infrastructure choices already made: db.lindela.io, Linode E3 object storage, and Stalwart email.
- Scope is high-risk because it touches authz, workflow state, migrations, audit, DLP, external integrations, and proposal submission.
- Execution must preserve unrelated dirty worktree changes, including existing `.serena/project.yml` drift.

## Unknowns / Open Questions

- Exact release timeline and team capacity are not specified.
- Whether strategic JTBD such as payments and mobile/offline must ship in the same release as P0/P1 proposal operations, or can be planned as later work.
- Whether Python services remain first-class for RFP parsing/agent orchestration or whether the Next.js implementation should continue absorbing workflow execution.
- Final external provider choices for e-signature, calendar writeback, CRM sync, and payment/revenue workflows are not visible in the current repo.

## Likely Codebase Touchpoints

- `docs/platform-jtbd-catalogue.md`
- `docs/enhancements.md`
- `.omx/state/platform-e2e-facility-ledger.md`
- `docs/plans/2026-04-22-master-completion-plan.md`
- `frontend/app/(app)/**`
- `frontend/app/api/v1/**`
- `frontend/lib/actions/**`
- `frontend/lib/db/schema-*.ts`
- `frontend/lib/actions/workflow-runtime.ts`
- `frontend/lib/workflows/default-templates.ts`
- `frontend/scripts/workflow-runtime-worker.ts`
- `frontend/e2e/**`
- `frontend/__tests__/**`
- `src/docfusion/rfp/**`
- `src/docfusion/api/endpoints/**`
- `src/docfusion/agents/**`
- `src/docfusion/workflow/**`
- `src/docfusion/document_engine/**`
- `deployment/**`
- `.github/workflows/**`

