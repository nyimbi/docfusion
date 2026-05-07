# Platform Completion Next Phase Context

## Task Statement

Create a consensus plan for the remaining DocFusion platform work identified from `docs/platform-jtbd-catalogue.md` and `docs/plans/2026-04-22-master-completion-plan.md`, covering functional completeness, operational hardening, workflow coverage, product capability, and engineering debt.

## Desired Outcome

A bounded, execution-ready programme plan that:

- Reconciles older master-plan gaps with current repository state.
- Prioritizes P0 live end-to-end proof before broad feature expansion.
- Defines work packages, sequencing, acceptance criteria, verification gates, and staffing guidance.
- Avoids overclaiming from unit tests where live integration validation is still missing.
- Can be handed to `$ralph` or `$team` for implementation/execution.

## Known Facts / Evidence

- Current branch `ralph-jtbd-workflow-requirements` is clean and synced with origin at `af9f219`.
- Fresh branch-head verification passed: full frontend Vitest `38` files / `530` tests, TypeScript, lint, Next production build, and high-severity npm audit gate.
- The May 3 platform E2E campaign already has a facility-ledger/topology contract in `.omx/state/platform-e2e-facility-ledger.md`, `.omx/state/platform-e2e-topology-matrix.md`, and `.omx/plans/prd-platform-e2e-exercise.md`.
- Current May 3 evidence marks F-005 RFP storage, F-012 snippet fixtures, F-021 submission, O-001 auth/session, O-002 authz, O-005 worker loop, O-007 Linode E3, O-008 exception sync, and O-012 migration validation as `pass`.
- Current May 3 evidence marks F-006 failed-parse remediation, O-003 broad workflow reversal/remediation, O-004 template publication/deprecation, and O-006 Stalwart notification delivery as `partial`.
- Current May 3 topology matrix says queue-only notification exercise is not enough; Stalwart needs mailbox or delivery-attempt proof.
- `docs/platform-jtbd-catalogue.md` marks many JTBDs as `Partial` even after the workflow runtime sidecar was added.
- Workflow runtime sidecar now exists with durable workflow instances, tasks, audit events, notifications, templates, strict API authz, template governance, worker scripts, Stalwart dispatch, and tests.
- RFP intake has server-side Linode E3 support for manual uploads and fetched RFP downloads; Linode E3 has no CORS, so validation must remain server-side.
- `frontend/app/api/v1/rfp/upload/route.ts` and `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts` use FastAPI fallback/proxy behavior only when `USE_PYTHON_RFP` is enabled and local object-store config is absent.
- `src/docfusion/api/endpoints/rfp_endpoints.py` and `src/docfusion/api/endpoints/discovery_endpoints.py` now exist, so the April master-plan claim that these endpoints are absent is stale.
- `rg "NotImplementedError" src/docfusion -g '*.py'` currently only reports an abstract-style `raise NotImplementedError` in `backend/discovery/scrapers/base.py` plus documentation text; the large April stub list is stale or moved.
- `docs/plans/2026-03-01-production-readiness-design.md` still references Azure VM and Postfix, while current instructions and docs use `db.lindela.io`, Linode E3 object storage, and Stalwart mail.
- Remaining high-risk gaps in `docs/platform-jtbd-catalogue.md` include RFP security scan/SSE/notifications, compliance final lock/gap tasks/audit linkage, production/render/submission workflow, actionable notification center, runtime idempotency/event bus/pause-resume, portal workflows, observability, backup/restore proof, and live deployed validation.

## Constraints

- Do not implement during this planning turn.
- Treat live DB/object-store/mail validation as mutating production-adjacent work requiring disposable fixtures, namespace isolation, and cleanup/audit evidence.
- Do not blindly execute stale master-plan items; reconcile each major item against current code before assigning implementation.
- Keep the first implementation tranche small enough to verify end-to-end.
- Use Stalwart mail, `db.lindela.io`, and Linode E3 as current infrastructure assumptions; mark Azure/Postfix docs as hygiene debt.
- No new dependencies unless a future execution plan explicitly justifies them.

## Unknowns / Open Questions

- Which live credentials/secrets are available in CI versus only local operator environments.
- Whether the deployed `db.lindela.io` schema already contains all latest migrations after the most recent branch.
- Whether external discovery sources are stable enough for CI, or must be mocked/fixture-recorded for CI and run live only as operator smoke tests.
- Whether e-signature remains in scope for the immediate P0 submission workflow or should be deferred behind dispatch/receipt capture.
- Whether Python FastAPI or Next.js should be long-term canonical for RFP processing after the recent E3-backed Next-side work. The next proof tranche should treat Next.js + E3 as canonical only for proof, then force a post-Phase-1 ownership checkpoint.

## Likely Codebase Touchpoints

- `frontend/app/api/v1/rfp/**`
- `frontend/lib/actions/rfp-parser.ts`
- `frontend/lib/services/rfp-document-service.ts`
- `frontend/lib/storage/linode-e3.ts`
- `frontend/app/api/v1/compliance-matrix/**`
- `frontend/lib/actions/compliance-validator.ts`
- `frontend/lib/actions/submissions.ts`
- `frontend/lib/actions/workflow-runtime.ts`
- `frontend/lib/actions/workflow-domain.ts`
- `frontend/app/api/v1/workflows/**`
- `frontend/scripts/workflow-runtime-worker.ts`
- `frontend/e2e/**`
- `frontend/__tests__/**`
- `src/docfusion/api/endpoints/rfp_endpoints.py`
- `src/docfusion/api/endpoints/discovery_endpoints.py`
- `src/docfusion/document_engine/**`
- `src/docfusion/agents/**`
- `docs/platform-jtbd-catalogue.md`
- `docs/plans/2026-04-22-master-completion-plan.md`
- `docs/plans/2026-03-01-production-readiness-design.md`
- `docs/plans/2026-03-01-production-readiness-implementation.md`

## Deliberate-Mode Risk Notes

- Prematurely broad implementation will create unreviewable diffs and weak evidence.
- Live integration tests can mutate production-adjacent services; fixture cleanup and audit trails must be planned before execution.
- Older docs contain stale claims; the plan must start with a short reality-reconciliation lane instead of assuming every listed gap is current.
