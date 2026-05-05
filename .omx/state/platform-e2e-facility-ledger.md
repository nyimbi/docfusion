# Platform E2E Facility Ledger

Run namespace: `e2e_20260503_docfusion`

Status: Phase 1 evidence ledger. Rows still marked `blocked` require deeper browser/operator proof before they count as validated coverage. `docs-only`, `strategic`, `unsupported`, `credential-missing`, and `legacy-topology` rows never count as validated coverage.

## Schema

| Field | Meaning |
|---|---|
| `facility` | Named capability or operational surface being exercised. |
| `journey` | Product journey `J1`-`J9` or operator/control-plane journey `O1`. |
| `topology_tier` | `offline`, `local-production`, `shared-prod-like`, `operator`, or `legacy-reference`. |
| `priority` | `P0`, `P1`, `P2`, or `Strategic`. |
| `mutability` | `read-only`, `local-mutating`, `live-mutating`, or `operator-mutating`. |
| `evidence_class` | Required proof bucket: `unit`, `integration`, `e2e`, `observability`, or combined. |
| `side_effect_proof` | Observable state, artifact, queue, delivery, audit, or cleanup proof required. |
| `fixture_namespace` | Fixture/object/mail/run namespace for mutating checks. |
| `cleanup_owner` | Lane responsible for cleanup or residue disposition. |
| `disposition` | `pass`, `partial`, `fail`, `blocked`, `docs-only`, `legacy-topology`, `credential-missing`, `strategic`, or `unsupported`. |
| `artifact_ids` | Run-correlated evidence IDs. Empty until execution. |
| `cleanup_status` | `not-applicable`, `idempotent-noop`, `restored`, `cleanup-pending`, or `cleanup-failed`. |

## Wave Ownership Register

This register is the pass-authority overlay for facility rows and proof subrows. It does not change current dispositions; it defines which implementation wave may move each row to `pass`. Parent rows with subrows close only after all required subrows pass or receive an explicit dated exception. JTBD and UX ownership are canonical in `.omx/plans/full-jtbd-enhancements-implementation-plan.md`; this table binds those wave decisions to the facility ledger rows that executors will update.

| ID | Owning wave | Dependency / closure waves | Pass authority |
|---|---:|---|---|
| F-001 | 2 | none | Wave 2 verifier |
| F-002 | 2 | none | Wave 2 verifier |
| F-003 | 2 | none | Wave 2 verifier |
| F-004 | 7 | 2 via F-004A | Wave 7 verifier after F-004A and F-004B pass |
| F-004A | 2 | none | Wave 2 verifier |
| F-004B | 7 | none | Wave 7 verifier |
| F-005 | 2 | prior-scope pass; expanded scope via F-005B | Wave 2 verifier for expanded closure |
| F-005B | 2 | none | Wave 2 verifier |
| F-006 | 2 | prior-scope pass; expanded scope via F-006B/F-006C | Wave 2 verifier for expanded closure |
| F-006B | 2 | none | Wave 2 verifier |
| F-006C | 2 | none | Wave 2 verifier |
| F-007 | 2 | none | Wave 2 verifier |
| F-008 | 3 | none | Wave 3 verifier |
| F-009 | 4 | none | Wave 4 verifier |
| F-010 | 5 | none | Wave 5 verifier |
| F-011 | 5 | none | Wave 5 verifier |
| F-012 | 5 | prior-scope pass; expanded scope via F-012B | Wave 5 verifier for expanded closure |
| F-012B | 5 | none | Wave 5 verifier |
| F-013 | 5 | none | Wave 5 verifier |
| F-014 | 6 | 4 via F-014A | Wave 6 verifier after F-014A and F-014B pass |
| F-014A | 4 | none | Wave 4 verifier |
| F-014B | 6 | none | Wave 6 verifier |
| F-015 | 7 | none | Wave 7 verifier |
| F-016 | 7 | none | Wave 7 verifier |
| F-017 | 5 | none | Wave 5 verifier |
| F-018 | 6 | 3 via F-018A; 5 via F-018B | Wave 6 verifier after F-018A/F-018B/F-018C pass |
| F-018A | 3 | none | Wave 3 verifier |
| F-018B | 5 | none | Wave 5 verifier |
| F-018C | 6 | none | Wave 6 verifier |
| F-019 | 7 | none | Wave 7 verifier |
| F-020 | 6 | none | Wave 6 verifier |
| F-021 | 6 | prior-scope pass; expanded scope via F-021B | Wave 6 verifier for expanded closure |
| F-021B | 6 | none | Wave 6 verifier |
| F-022 | 7 | none | Wave 7 verifier |
| O-001 | 1 | prior-scope pass; must be rechecked when authz-sensitive surfaces change | Security reviewer + wave verifier |
| O-002 | 1 | prior-scope pass; must be rechecked when authz-sensitive surfaces change | Security reviewer + wave verifier |
| O-003 | 6 | 1 via O-003A | Wave 6 verifier after O-003A and O-003B pass |
| O-003A | 1 | none | Wave 1 verifier |
| O-003B | 6 | none | Wave 6 verifier |
| O-004 | 1 | prior-scope pass; expanded scope via O-004B | Wave 1 verifier for expanded closure |
| O-004B | 1 | none | Wave 1 verifier |
| O-005 | 7 | prior-scope pass; revalidated for scheduled-worker expansion | Wave 7 verifier |
| O-006 | 1 | prior-scope pass; expanded scope via O-006B | Wave 1 verifier for expanded closure |
| O-006B | 1 | none | Wave 1 verifier |
| O-007 | 2 | prior-scope pass; revalidated by RFP/final artifact flows | Wave 2 verifier for RFP; Wave 6 verifier for final artifacts |
| O-008 | 7 | prior-scope pass; revalidated for exception remediation expansion | Wave 7 verifier |
| O-009 | 2 | none | Wave 2 verifier |
| O-010 | 7 | none | Wave 7 verifier |
| O-011 | 7 | none | Wave 7 verifier |
| O-012 | 7 | prior-scope pass; expanded scope via O-012B | Wave 7 verifier for expanded closure |
| O-012B | 7 | none | Wave 7 verifier |
| O-013 | 5 | none | Wave 5 verifier |
| O-014 | 7 | 5 via O-014A | Wave 7 verifier after O-014A and O-014B pass or credential-blocked exceptions |
| O-014A | 5 | none | Wave 5 verifier |
| O-014B | 7 | none | Wave 7 verifier |
| O-015 | 7 | 1 via O-015A; 3 via O-015B | Wave 7 verifier after O-015A/O-015B/O-015C pass |
| O-015A | 1 | none | Wave 1 verifier |
| O-015B | 3 | none | Wave 3 verifier |
| O-015C | 7 | none | Wave 7 verifier |
| O-016 | 6 | 3 via O-016A | Security reviewer + Wave 6 verifier after O-016A/O-016B pass |
| O-016A | 3 | none | Security reviewer + Wave 3 verifier |
| O-016B | 6 | none | Security reviewer + Wave 6 verifier |
| X-001 | 8 | strategic deferral allowed only with owner/rationale/revisit trigger | Wave 8 verifier + business owner |
| X-002 | 8 | strategic deferral allowed only with owner/rationale/revisit trigger | Wave 8 verifier + business owner |
| X-003 | 8 | strategic deferral allowed only with owner/rationale/revisit trigger | Wave 8 verifier + business owner |

## Wave Acceptance Artifact Register

Each wave must record its closing evidence in a run-scoped artifact before any listed row or subrow moves to `pass`.

| Wave | Rows/subrows controlled | Required acceptance artifact |
|---:|---|---|
| 0 | All JTBD/enhancement/facility ownership metadata | `docs/jtbd-implementation-ledger.md` plus this ledger's ownership register and mechanical validation transcript. |
| 1 | O-001, O-002, O-003A, O-004, O-004B, O-006, O-006B, O-015A | `.omx/logs/platform-completion/wave1-<run_id>/control-plane-proof.json` with authenticated command-center, inbox, audit, action-panel, sandbox, notification, authz, and cleanup evidence. |
| 2 | F-001, F-002, F-003, F-004A, F-005, F-005B, F-006, F-006B, F-006C, F-007, O-007, O-009 | `.omx/logs/platform-completion/wave2-<run_id>/discovery-rfp-proof.json` with discovery, shortlist, ingest, E3, parse, requirements, deadline, source-health, and cleanup evidence. |
| 3 | F-008, F-018A, O-015B, O-016A | `.omx/logs/platform-completion/wave3-<run_id>/compliance-evidence-proof.json` with compliance, clarification, evidence, readiness, DLP, audit export, and cleanup evidence. |
| 4 | F-009, F-014A | `.omx/logs/platform-completion/wave4-<run_id>/planning-workload-proof.json` with plan baseline, tasks, comment-to-task, workload, section health, and cleanup evidence. |
| 5 | F-010, F-011, F-012, F-012B, F-013, F-017, F-018B, O-013, O-014A | `.omx/logs/platform-completion/wave5-<run_id>/authoring-ai-proof.json` with editor, snippets, AI provenance, content, personnel, past performance, search/RAG, win-theme, and cleanup evidence. |
| 6 | F-014B, F-018C, F-020, F-021, F-021B, O-003B, O-016B | `.omx/logs/platform-completion/wave6-<run_id>/approval-submission-proof.json` with approval, pricing, render/export, final checklist, submission, compensation, DLP, and cleanup evidence. |
| 7 | F-004B, F-015, F-016, F-019, F-022, O-005, O-008, O-010, O-011, O-012, O-012B, O-014B, O-015C | `.omx/logs/platform-completion/wave7-<run_id>/operations-integrations-proof.json` with CRM, partner, import, integration, health, backup/restore, worker, reporting, incident, audit, and cleanup evidence. |
| 8 | X-001, X-002, X-003 plus strategic UX extensions | `.omx/logs/platform-completion/wave8-<run_id>/strategic-proof-or-deferral.json` with implementation proof or explicit owner/rationale/revisit-trigger deferral records. |

## Product Lane

| ID | facility | journey | topology_tier | priority | mutability | evidence_class | side_effect_proof | fixture_namespace | cleanup_owner | disposition | artifact_ids | cleanup_status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-001 | Opportunity search, filter, and shortlist | J1 | local-production | P1 | local-mutating | e2e + integration | Shortlist or saved-search DB delta and browser trace | `e2e_20260503_docfusion_opportunity` | product-lane | blocked | `code:opportunity-bulk-triage`, `vitest:opportunity-lifecycle`, `log:.omx/logs/platform-completion/wave2-20260505T130220Z/opportunity-bulk-triage-proof.json` | cleanup-pending |
| F-002 | Opportunity source health and scraper run visibility | J1/O1 | operator | P0 | operator-mutating | integration + observability | Scraper run/status row or health command output | `e2e_20260503_docfusion_scraper` | operator-lane | blocked | `code:scraper-source-workflows`, `code:scraper-source-health`, `code:opportunity-digest-workflow`, `vitest:scraper-workflows`, `vitest:opportunity-digest`, `log:.omx/logs/platform-completion/wave2-20260505T125120Z/scraper-source-workflow-proof.json`, `log:.omx/logs/platform-completion/wave2-20260505T130855Z/scraper-source-health-proof.json`, `log:.omx/logs/platform-completion/wave2-20260505T130630Z/opportunity-digest-workflow-proof.json` | cleanup-pending |
| F-003 | Opportunity qualification and pipeline stage transition | J1 | local-production | P0 | local-mutating | e2e + integration | Pipeline stage/history row and browser trace | `e2e_20260503_docfusion_pipeline` | product-lane | blocked | `code:opportunity-lifecycle`, `code:opportunity-bulk-triage`, `vitest:opportunity-lifecycle`, `log:.omx/logs/platform-completion/wave2-20260505T115633Z/opportunity-lifecycle-proof.json`, `log:.omx/logs/platform-completion/wave2-20260505T130220Z/opportunity-bulk-triage-proof.json` | cleanup-pending |
| F-004 | Analytics and PWin dashboard readout | J1 | local-production | P1 | read-only | e2e | Browser trace and data-source/API transcript | `e2e_20260503_docfusion_analytics` | verifier | blocked |  | not-applicable |
| F-004A | PWin dashboard actionability | J1 | local-production | P1 | read-only | e2e + observability | PWin/readout data-source transcript plus drill-down to opportunity work | `e2e_20260503_docfusion_analytics_pwin` | verifier | blocked | `code:recordOpportunityAnalysisAcceptance`, `vitest:opportunity-lifecycle`, `log:.omx/logs/platform-completion/wave2-20260505T115633Z/opportunity-lifecycle-proof.json` | not-applicable |
| F-004B | Portfolio/reporting dashboard actionability | J9/O1 | local-production | P1 | read-only | e2e + observability | Portfolio dashboard creates or deep-links to work items and scheduled reports | `e2e_20260503_docfusion_analytics_reporting` | verifier | blocked |  | not-applicable |
| F-005 | RFP upload/fetch with durable storage receipt | J2 | shared-prod-like | P0 | live-mutating | e2e + integration + observability | `s3://` storage path, E3 object checksum, parse/job row | `e2e_20260503_docfusion_rfp` | product-lane | pass | `rfp:50fa33d1-7521-4a36-9b1f-9686c5cc45fe`, `s3://mansa/rfp/unassigned/50fa33d1-7521-4a36-9b1f-9686c5cc45fe/ralph-e2e-rfp-1777840364944.html` | restored |
| F-005B | Discovery-linked intake storage | J2 | shared-prod-like | P0 | live-mutating | e2e + integration + observability | Discovered source document fetched server-side, stored in Linode E3, linked to RFP record, and cleaned up | `e2e_20260503_docfusion_rfp_discovery` | product-lane | blocked | `code:downloadDocument.storageReceipt`, `code:discovery_rfp_ingest`, `vitest:rfp-document-service`, `log:.omx/logs/platform-completion/wave2-20260505T122152Z/discovery-rfp-proof.json` | cleanup-pending |
| F-006 | RFP parse status and failed-parse remediation | J2/O1 | local-production | P0 | local-mutating | integration + observability | Parse job status/history, retry/reject/manual action audit | `phase1_20260505T041149Z` | product-lane | pass | `rfp:c5277035-c134-4f78-a8fb-9322111c96c8`, `retry:6e8dd319-f774-4525-9494-1b30e24f5579`, `manual_extraction:7e08781a-708d-480b-9b2d-13c60b0b18bd`, `reject:2982c339-acf2-4ee2-bcba-d5fffb0ed15c`, `log:.omx/logs/platform-completion/phase1_20260505T041149Z/f006-rfp-parse-remediation.json` | restored |
| F-006B | Parser selection and confidence review | J2 | local-production | P0 | local-mutating | e2e + integration + observability | Parser policy, confidence score, human correction, and versioned parse artifact | `e2e_20260503_docfusion_parse_review` | product-lane | blocked | `code:reviewRfpParseConfidence`, `code:ParseReviewPanel`, `vitest:rfp-parse-workflow`, `log:.omx/logs/platform-completion/wave2-20260505T122152Z/discovery-rfp-proof.json` | cleanup-pending |
| F-006C | Amendment and supersession handling | J2/J3 | local-production | P0 | local-mutating | e2e + integration + observability | Amendment import updates/supersedes requirements with before/after audit and downstream task impact | `e2e_20260503_docfusion_amendment` | product-lane | blocked | `code:applyRfpAmendmentSupersession`, `vitest:rfp-parse-workflow`, `log:.omx/logs/platform-completion/wave2-20260505T125725Z/rfp-amendment-supersession-proof.json` | cleanup-pending |
| F-007 | Requirement extraction, acceptance, rejection, reopen | J3 | local-production | P0 | local-mutating | e2e + integration | Requirement metadata/history and task projection row | `e2e_20260503_docfusion_req` | product-lane | blocked | `code:parser-source-trace`, `code:requirement-clarification-workflow`, `vitest:requirements-workflow`, `vitest:clarification-workflow`, `log:.omx/logs/platform-completion/wave2-20260505T122152Z/discovery-rfp-proof.json` | cleanup-pending |
| F-008 | Compliance matrix row submit/approve/reject/waive/reopen | J3/J6 | local-production | P0 | local-mutating | e2e + integration | Compliance row workflow metadata and matrix stat delta | `e2e_20260503_docfusion_compliance` | product-lane | blocked | `code:compliance-entry-workflow`, `code:compliance-matrix-final-lock`, `code:requirement-clarification-workflow`, `vitest:compliance-entry-workflow`, `vitest:clarification-workflow`, `log:.omx/logs/platform-completion/wave3-20260505T131420Z/compliance-matrix-lock-proof.json` | cleanup-pending |
| F-009 | Proposal planning and task projection | J4 | local-production | P0 | local-mutating | e2e + integration | Task row, assignment, activity/audit event | `e2e_20260503_docfusion_tasks` | product-lane | blocked | `code:proposal-task-lifecycle`, `vitest:proposal-task-workflow` | cleanup-pending |
| F-010 | Document creation from template | J5 | local-production | P0 | local-mutating | e2e + integration | Document row/content JSON/version metadata | `e2e_20260503_docfusion_docs` | product-lane | blocked | `code:document-authoring-workflow`, `vitest:document-authoring-workflow` | cleanup-pending |
| F-011 | HDSI/editor authoring and content persistence | J5 | local-production | P0 | local-mutating | e2e + observability | Browser trace and persisted document content/version | `e2e_20260503_docfusion_hdsi` | product-lane | blocked | `code:document-authoring-workflow`, `vitest:document-authoring-workflow` | cleanup-pending |
| F-012 | Snippet/template/partial insertion with context resolution | J5 | shared-prod-like | P0 | live-mutating | e2e + integration | Authenticated browser proof, resolved placeholders, unresolved highlight when expected | `snippet-context-fixtures` | product-lane | pass | `doc:53c4e667-95f1-4487-8e97-779dff133008`, `doc:5b06aae8-fa43-4324-bc2b-665523122b5d`, `doc:a830f4f1-0099-4b41-b03e-5b346483be08`, `unresolvedHighlighted:1` | idempotent-noop |
| F-012B | Snippet preview and explainability | J5 | shared-prod-like | P0 | live-mutating | e2e + integration | Preview resolves client/opportunity/RFP fields before insertion, highlights unresolved placeholders, and records provenance | `e2e_20260503_docfusion_snippet_preview` | product-lane | blocked | `code:snippet-expansion-provenance`, `vitest:snippet-expansion-provenance` | cleanup-pending |
| F-013 | Content library search/browse/rating/reuse | J5 | local-production | P1 | local-mutating | e2e + integration | Search result trace and rating/reuse DB/API evidence | `e2e_20260503_docfusion_content` | product-lane | blocked | `code:content-governance-workflow`, `vitest:content-governance-workflow` | cleanup-pending |
| F-014 | Comments, review, and approval gates | J6 | local-production | P0 | local-mutating | e2e + integration | Comment/review/approval row and gate audit | `e2e_20260503_docfusion_review` | product-lane | blocked |  | cleanup-pending |
| F-014A | Comment-to-task workflow | J4/J6 | local-production | P0 | local-mutating | e2e + integration | Comment creates owned task with resolution, reopen, audit, and browser proof | `e2e_20260503_docfusion_comment_task` | product-lane | blocked | `code:review-comment-resolution-workflow`, `vitest:review-comment-workflow` | cleanup-pending |
| F-014B | Review package and approval gate | J6 | local-production | P0 | local-mutating | e2e + integration | Review package freeze, reviewer completion, approval/reject/waive, and gate audit proof | `e2e_20260503_docfusion_review_gate` | product-lane | blocked | `code:review-package-workflow`, `vitest:review-package-workflow` | cleanup-pending |
| F-015 | CRM accounts, contacts, deals, and activities | J7 | local-production | P1 | local-mutating | e2e + integration | CRM entity rows and activity timeline evidence | `e2e_20260503_docfusion_crm` | product-lane | blocked |  | cleanup-pending |
| F-016 | Partners assignment and portal-facing visibility | J7 | local-production | P1 | local-mutating | e2e + integration | Partner assignment row and portal/API visibility evidence | `e2e_20260503_docfusion_partner` | product-lane | blocked |  | cleanup-pending |
| F-017 | Personnel and past-performance resource reuse | J7 | local-production | P1 | local-mutating | e2e + integration | Personnel/past-performance row linked into proposal context | `e2e_20260503_docfusion_resources` | product-lane | blocked | `code:resource-reuse-workflow`, `vitest:resource-reuse-workflow` | cleanup-pending |
| F-018 | Pricing, evidence, competitive-intel, and win-theme support surfaces | J7 | local-production | P1 | local-mutating | integration + e2e | Domain action/API/browser evidence and task/audit where present | `e2e_20260503_docfusion_support` | product-lane | blocked |  | cleanup-pending |
| F-018A | Evidence and claim remediation | J3/J5 | local-production | P0 | local-mutating | e2e + integration | Evidence/claim gap workflow blocks or resolves section readiness with audit proof | `e2e_20260503_docfusion_evidence_claims` | product-lane | blocked | `code:evidence-claim-remediation`, `vitest:claim-remediation` | cleanup-pending |
| F-018B | Competitive intelligence and win themes | J5 | local-production | P1 | local-mutating | e2e + integration | Competitive data and win themes are sourced, inserted, and checked for section consistency | `e2e_20260503_docfusion_win_themes` | product-lane | blocked | `code:competitive-win-theme-workflow`, `vitest:competitive-win-theme-workflow` | cleanup-pending |
| F-018C | Pricing and price approval | J6 | local-production | P0 | local-mutating | e2e + integration | Pricing package, BOE, authority approval, lock, and reopen proof | `e2e_20260503_docfusion_pricing` | product-lane | blocked |  | cleanup-pending |
| F-019 | Import parse, preview, execute, rollback | J7/O1 | local-production | P0 | local-mutating | e2e + integration + observability | Import status rows, rollback proof, validation report | `e2e_20260503_docfusion_import` | product-lane | blocked |  | cleanup-pending |
| F-020 | Render/export/download artifact | J8 | local-production | P0 | local-mutating | e2e + observability | Rendered file/hash/download metadata | `e2e_20260503_docfusion_render` | product-lane | blocked |  | cleanup-pending |
| F-021 | Submission package and receipt | J8 | local-production | P0 | local-mutating | e2e + integration | Submission record, protected download, receipt evidence | `e2e_20260503_docfusion_submission` | product-lane | pass | `opp:2e9b9767-2b8e-4695-b71e-1b046fbba146`, `submission:766bd7b2-d897-4ba1-b5f2-887588829a79`, `attachments:4` | restored |
| F-021B | Final checklist hard gate | J8 | local-production | P0 | local-mutating | e2e + integration | Submission blocks on missing approvals, signatures, DLP, compliance lock, or artifact hash and passes after remediation | `e2e_20260503_docfusion_submission_gate` | product-lane | blocked |  | cleanup-pending |
| F-022 | Outcome capture, win/loss, reporting, debrief | J9 | local-production | P1 | local-mutating | e2e + integration | Outcome/debrief row and dashboard/report evidence | `e2e_20260503_docfusion_outcome` | product-lane | blocked |  | cleanup-pending |

## Operator / Control-Plane Lane

| ID | facility | journey | topology_tier | priority | mutability | evidence_class | side_effect_proof | fixture_namespace | cleanup_owner | disposition | artifact_ids | cleanup_status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| O-001 | Auth.js/Keycloak session and protected route enforcement | O1 | local-production | P0 | read-only | e2e + integration | Session endpoint proof and redirect/deny proof | `e2e_20260503_docfusion_auth` | security-lane | pass | `api:/api/auth/session`, `dashboard_unauth:401`, `dashboard_auth:200` | not-applicable |
| O-002 | Authz/SpiceDB/resource permission checks | O1 | local-production | P0 | read-only | integration + observability | Permit/deny transcript and sensitive action audit | `e2e_20260503_docfusion_authz` | security-lane | pass | `vitest:__tests__/workflows/api-auth.test.ts`, `scheduler_unauth:401`, `scheduler_secret:200` | not-applicable |
| O-003 | Workflow runtime start/transition/reversal | O1/J4/J6 | shared-prod-like | P0 | live-mutating | e2e + integration + observability | Workflow instance/task/audit rows before/after | `phase1_20260505T041149Z` | operator-lane | blocked | `playwright:e2e/workflow-action-panel.spec.ts`, `submission_workflow:production_submission`, `phase1-exit:O-004-supplied-safe-mutable-proof` | restored |
| O-003A | Shared action-panel and runtime transition | O1/J4/J6 | shared-prod-like | P0 | live-mutating | e2e + integration + observability | Shared start/transition/reversal semantics, authz, audit, task cancellation, and dashboard proof | `e2e_20260503_docfusion_runtime_action_panel` | operator-lane | blocked | `code:WorkflowOperationsActions`, `api:/api/v1/workflows/[workflowId]/transition:403-authority`, `vitest:workflow-runtime/domain/api-auth`, `build:2026-05-05T11:15Z` | cleanup-pending |
| O-003B | Finalization compensation scenarios | O1/J8 | shared-prod-like | P0 | live-mutating | e2e + integration + observability | Artifact-change, approval reopen, submission correction, and domain compensation proof | `e2e_20260503_docfusion_finalization_compensation` | operator-lane | blocked |  | cleanup-pending |
| O-004 | Workflow template governance, simulation, publication, deprecation | O1 | shared-prod-like | P0 | live-mutating | e2e + integration | Template version/status rows and simulation transcript | `phase1_20260505T041149Z` | operator-lane | pass | `template:70e72a60-6e74-4fb5-a915-9040d1418004:deprecated`, `template:19400c06-0a44-4d34-b665-1f4dc4c129c3:active`, `log:.omx/logs/platform-completion/phase1_20260505T041149Z/o004-template-governance.json` | restored |
| O-004B | Visual/template studio governance | O1 | shared-prod-like | P0 | live-mutating | e2e + integration | Admin edits, simulates, publishes, deprecates, and rolls back through UI with approval/signoff semantics | `e2e_20260503_docfusion_template_studio` | operator-lane | blocked | `code:WorkflowTemplateGovernanceActions`, `vitest:workflow-runtime-template-governance`, `build:2026-05-05T11:15Z` | cleanup-pending |
| O-005 | Workflow worker loop: SLA, exception sync, notification delivery | O1 | operator | P0 | operator-mutating | integration + observability | Worker JSON/log output, processed counts, DB deltas | `e2e_20260503_docfusion_worker` | operator-lane | pass | `worker:breached=0,escalated=0,synced=1,attempted=0` | idempotent-noop |
| O-006 | Notification dispatch through Stalwart | O1/J8 | shared-prod-like | P0 | live-mutating | integration + observability | Notification row plus delivery-attempt or mailbox proof | `phase1_20260505T041149Z` | operator-lane | pass | `workflow:a14f6012-b9c0-458e-a2fd-aeee20e59bb0`, `notification:297ea107-c476-443f-987c-41981719a39b`, `dispatch:{"attempted":1,"delivered":0,"failed":1,"skipped":0}`, `log:.omx/logs/platform-completion/phase1_20260505T041149Z/o006-stalwart-dispatch.json` | restored |
| O-006B | Notification acknowledgement and preferences | O1/J4/J8 | shared-prod-like | P0 | live-mutating | e2e + integration + observability | Acknowledgement, quiet hours/suppression, fallback status, preference override, and failed-delivery remediation | `e2e_20260503_docfusion_notification_preferences` | operator-lane | blocked | `code:OperationalInbox`, `code:acknowledgeWorkflowNotification`, `code:updateWorkflowNotificationQuietHours`, `code:retryWorkflowNotificationDelivery`, `build:2026-05-05T11:15Z` | cleanup-pending |
| O-007 | Linode E3 server-side upload/download/readback | O1/J2/J8 | shared-prod-like | P0 | live-mutating | integration + observability | Object key, checksum, byte-for-byte readback | `e2e_20260503_docfusion_e3` | operator-lane | pass | `s3://mansa/rfp/e2e/ralph-platform-proof-1777840274128.txt`, `bytes:44`, `digest:0a2a1cc223e68dd5` | restored |
| O-008 | Operational exception sync and remediation | O1 | local-production | P0 | local-mutating | integration + observability | Exception workflow instance, task, SLA/escalation metadata | `e2e_20260503_docfusion_exception` | operator-lane | pass | `worker:exceptions.synced=1`, `api:exceptions/sync limit0:200` | idempotent-noop |
| O-009 | Scraper schedule, manual run, cancel, health, SSE | O1/J1 | operator | P0 | operator-mutating | integration + observability | Scheduled/manual run status, health endpoint, logs/SSE event | `e2e_20260503_docfusion_scraper` | operator-lane | blocked | `code:scraper-source-workflows`, `code:scraper-source-health`, `vitest:scraper-workflows`, `log:.omx/logs/platform-completion/wave2-20260505T125120Z/scraper-source-workflow-proof.json`, `log:.omx/logs/platform-completion/wave2-20260505T130855Z/scraper-source-health-proof.json` | cleanup-pending |
| O-010 | API/admin health and service probes | O1 | operator | P0 | read-only | observability | Health probe outputs for app/scraper/search/LLM where configured | `e2e_20260503_docfusion_health` | operator-lane | blocked |  | not-applicable |
| O-011 | Backup/restore smoke validation | O1 | operator | P0 | operator-mutating | observability | Backup command output and smoke restore validation | `e2e_20260503_docfusion_backup` | operator-lane | credential-missing |  | cleanup-pending |
| O-012 | Migration validation and remediation | O1 | shared-prod-like | P0 | live-mutating | integration + observability | Migration validate/apply output and table presence proof | `e2e_20260503_docfusion_migration` | operator-lane | pass | `migration:0019_restore_rfp_core_tables`, `migration:0020_repair_opportunity_search_vector`, `validate-workflow-runtime-migration:ok` | idempotent-noop |
| O-012B | Wave migration preflight and rollback evidence | O1 | shared-prod-like | P0 | live-mutating | integration + observability | New migration precheck, validation, rollback/repair, and disposable restore evidence for each schema-affecting wave | `e2e_20260503_docfusion_wave_migration` | operator-lane | blocked |  | cleanup-pending |
| O-013 | AI/model provider health and governance | O1/J5 | shared-prod-like | P1 | read-only | integration + observability | Provider/model list or health transcript with fallback behavior | `e2e_20260503_docfusion_ai` | operator-lane | blocked | `code:ai-provider-governance-snapshot`, `vitest:ai-governance` | not-applicable |
| O-014 | Research/search integrations: Firecrawl, stealth scraper, SearXNG, Ollama | O1/J1 | operator | P1 | operator-mutating | integration + observability | Health and sample query/scrape transcript | `e2e_20260503_docfusion_research` | operator-lane | blocked |  | cleanup-pending |
| O-014A | Search/RAG and AI retrieval health | O1/J5 | operator | P1 | operator-mutating | integration + observability | Search/RAG provider health, ACL filtering, stale-index repair, and sample query proof | `e2e_20260503_docfusion_search_rag` | operator-lane | blocked | `code:search-rag-health`, `vitest:search-rag-health` | cleanup-pending |
| O-014B | Connector/research integration health | O1/J1 | operator | P1 | operator-mutating | integration + observability | Firecrawl, SearXNG, Ollama, stealth, or configured research connector sample proof, or credential-blocked record | `e2e_20260503_docfusion_research_connectors` | operator-lane | blocked |  | cleanup-pending |
| O-015 | Audit/governance reportability | O1/J9 | local-production | P0 | read-only | observability + e2e | Auditor-visible event trail for selected run ID | `e2e_20260503_docfusion_audit` | verifier | blocked |  | not-applicable |
| O-015A | Core audit explorer run reconstruction | O1 | local-production | P0 | read-only | observability + e2e | Audit explorer reconstructs a workflow run by run ID and subject | `e2e_20260503_docfusion_audit_core` | verifier | blocked | `code:/workflows/audit`, `code:getWorkflowAuditExplorerProjection`, `build:2026-05-05T11:15Z` | not-applicable |
| O-015B | Compliance/reporting audit package | O1/J3 | local-production | P0 | read-only | observability + e2e | Compliance/report snapshot has immutable references and audit export proof | `e2e_20260503_docfusion_audit_compliance` | verifier | blocked | `code:compliance-matrix-final-lock`, `vitest:compliance-entry-workflow`, `log:.omx/logs/platform-completion/wave3-20260505T131420Z/compliance-matrix-lock-proof.json` | not-applicable |
| O-015C | Operations/reporting audit coverage | O1/J9 | local-production | P0 | read-only | observability + e2e | Ops/import/integration/backup audit sources are searchable and exportable | `e2e_20260503_docfusion_audit_operations` | verifier | blocked |  | not-applicable |
| O-016 | Privacy/DLP/access-sensitive export checks | O1/J8 | local-production | P0 | local-mutating | integration + observability | DLP/security finding or protected export deny/allow transcript | `e2e_20260503_docfusion_privacy` | security-lane | blocked |  | cleanup-pending |
| O-016A | DLP policy and evidence/export allow-deny | O1/J3/J5 | local-production | P0 | local-mutating | e2e + integration + observability | DLP finding, redaction/waiver, and protected export allow/deny proof | `e2e_20260503_docfusion_dlp_policy` | security-lane | blocked | `code:privacy-dlp-export-gate`, `vitest:dlp-policy` | cleanup-pending |
| O-016B | Final package DLP enforcement | O1/J8 | local-production | P0 | local-mutating | e2e + integration + observability | Final submission/export is blocked by unresolved DLP and passes after approved remediation | `e2e_20260503_docfusion_dlp_submission` | security-lane | blocked |  | cleanup-pending |

## Strategic / Non-Credited Rows

| ID | facility | journey | topology_tier | priority | disposition | reason |
|---|---|---|---|---|---|---|
| X-001 | Mobile/offline full app workflow | O1/J6 | legacy-reference | Strategic | strategic | PWA/offline concepts exist, but no full mobile/offline workflow surface is validated in this campaign. |
| X-002 | Payment/revenue recognition | J8/O1 | legacy-reference | Strategic | strategic | No visible implemented payment gateway/reconciliation surface. |
| X-003 | Configurable domain/rule packs beyond workflow templates | O1 | legacy-reference | Strategic | strategic | Workflow template seeding exists; broader visual rule-pack authoring remains strategic. |

## Phase 1 Targeted Row Exit Summary

| ID | Phase 1 exit | Evidence |
|---|---|---|
| F-006 | pass | Authenticated parse API retry, manual extraction, and reject proof under `phase1_20260505T041149Z`. |
| O-006 | pass | Targeted Stalwart SMTP delivery attempt reached terminal `failed` row status with timeout transcript under `phase1_20260505T041149Z`. |
| O-004 | pass | Template draft, publication, successor publication, and prior-version deprecation proof under `phase1_20260505T041149Z`. |
| O-003 | blocked | O-004 supplied the safe mutable operator/governance proof; broad reversal remains blocked for this tranche to avoid overclaiming. |

## Phase 1 Evidence Log

| Timestamp (UTC) | Evidence | Facilities |
|---|---|---|
| 2026-05-03T20:14Z | `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test -- --run` passed with 30 files / 495 tests. | Cross-cutting |
| 2026-05-03T20:15Z | `npm run test:e2e -- e2e/snippet-expansion.spec.ts e2e/workflow-action-panel.spec.ts` passed 3 browser tests. | F-012, O-003 |
| 2026-05-03T20:16Z | Live authenticated snippet fixture Playwright passed against `next start`; canonical and metadata fallback resolved, ambiguous placeholder highlighted. | F-012, O-001 |
| 2026-05-03T20:17Z | Live fixture audit against `db.lindela.io` found 10 documents, 3 proposal links, no duplicate proposal-document pairs. | F-012, O-012 |
| 2026-05-03T20:27Z | Strict workflow worker passed after migration repair: SLA `0/0`, exception sync `1`, notifications `0 attempted`. | O-005, O-008 |
| 2026-05-03T20:28Z | Workflow API probe: unauth dashboard `401`; authenticated dashboard/portal/templates `200`; template simulation `200`; scheduler SLA/exception/notification APIs `200`. | O-001, O-002, O-004, O-005, O-006 |
| 2026-05-03T20:31Z | Live Linode E3 signed PUT/GET readback passed for `s3://mansa/rfp/e2e/ralph-platform-proof-1777840274128.txt`. | O-007 |
| 2026-05-03T20:36Z | RFP upload/parse/status proof: RFP `50fa33d1-7521-4a36-9b1f-9686c5cc45fe`, parse job `f73ac921-2fb9-4a80-9aa4-44bed77462d9`, completed with 1 requirement. | F-005, F-006 |
| 2026-05-03T20:43Z | Live submission dispatch proof: submission `766bd7b2-d897-4ba1-b5f2-887588829a79`, 4 locked attachments with hashes, opportunity moved to `submitted`. | F-021, O-003 |
| 2026-05-03T21:27Z | Cleanup proof: deleted 2 Linode E3 objects; removed RFP document, 1 requirement, 2 parse jobs, submission, submission workflow, opportunity, and 4 fixture documents; follow-up DB absence check returned zero rows. | F-005, F-006, F-021, O-003, O-007 |
| 2026-05-03T21:27Z | Search-vector repair proof: reapplied `0020_repair_opportunity_search_vector` with 9 statements; validator now checks opportunity search index, trigram indexes, trigger, function, and stale vectors. | O-012 |
| 2026-05-03T21:29Z | Post-repair verification passed: `git diff --check`, live migration validator, `npx tsc --noEmit`, `npm run lint`, `npm test -- --run` with 30 files / 496 tests, targeted Playwright with 3 tests, and `npm run build`. | Cross-cutting |
| 2026-05-05T04:12Z | Phase 1 failed-parse remediation proof exercised authenticated parse API retry, manual extraction, and reject transitions against disposable failed RFP fixtures; cleanup restored DB state. | F-006 |
| 2026-05-05T04:12Z | Phase 1 Stalwart dispatch proof targeted one disposable workflow notification; SMTP path attempted delivery and recorded terminal failed status with timeout transcript; cleanup restored DB state. | O-006 |
| 2026-05-05T04:12Z | Phase 1 template governance proof created draft v1, published it, created draft v2, published v2, and observed v1 deprecated; cleanup removed disposable templates. | O-004 |
| 2026-05-05T04:12Z | Phase 1 exit rule used O-004 as the safe mutable operator/governance pass row; O-003 remains supported by prior action-panel/submission evidence but is marked blocked for this tranche instead of partial. | O-003 |
| 2026-05-05T04:21Z | Post-Phase-1 verification gates passed: `git diff --check`, `npm test -- --run` with 38 files / 531 tests, `npx tsc --noEmit`, `npm run lint`, and `npm run build`; recorded in `verification-gates.json`. | Cross-cutting |
| 2026-05-05T12:21Z | Wave 2 discovery-linked RFP intake proof added storage receipt/provenance propagation, workflow runtime/audit transitions, parser confidence review metadata/actions, parser source-trace requirement metadata, and intake stepper UI; verification passed focused Vitest, lint, build, tsc, and diff checks. | F-005B, F-006B, F-007 |
| 2026-05-05T12:51Z | Wave 2 scraper source workflow proof added auditable run, duplicate-review, disabled-source, enable/disable, and cancel transitions behind UI/API actions; focused Vitest and TypeScript checks passed. Rows remain blocked until authenticated operator/browser schedule, health, cancel, and SSE proof is captured. | F-002, O-009 |
| 2026-05-05T12:57Z | Wave 2 amendment/supersession proof added an explicit amendment impact state model: affected requirements return to review with before-state metadata, target/amendment documents record supersession state, and workflow runtime projects an impact-review task. Rows remain blocked until authenticated disposable amendment proof is captured. | F-006C, F-007 |
| 2026-05-05T13:02Z | Wave 2 opportunity bulk triage proof routed opportunities-list interested, shortlist, pursuing, and declined actions through the workflow-backed triage action instead of direct status mutation; focused Vitest and TypeScript checks passed. Rows remain blocked until authenticated browser search/filter/select/shortlist proof is captured. | F-001, F-003 |
| 2026-05-05T13:06Z | Wave 2 opportunity digest proof added a Next-side workflow-runtime digest path over persisted saved searches with queued notification delivery for non-empty matches and audit-only skipped-empty policy. Rows remain blocked until scheduled runtime and Stalwart delivery proof are captured. | F-002, O-006 |
| 2026-05-05T13:08Z | Wave 2 scraper source-health proof added deterministic freshness, failure, and data-quality evaluation with operations remediation task projection. Rows remain blocked until scheduled/operator runtime and browser proof are captured. | F-002, O-009 |
| 2026-05-05T13:14Z | Wave 3 compliance matrix lock proof added matrix-level review/final/reopen state handling, blocked final lock for unresolved mandatory entries, and workflow audit for successful locks. Rows remain blocked until authenticated disposable matrix proof and audit export proof are captured. | F-008, O-015B |
| 2026-05-05T13:40Z | Wave 3 evidence-claim remediation proof added an explicit `evidence_claim_remediation` state model for start, add-evidence, rewrite, waive, remove, and reopen transitions with workflow runtime audit and remediation task projection. F-018A remains blocked until browser section-readiness and disposable evidence/claim cleanup proof are captured. | F-018A, O-016A |
| 2026-05-05T13:44Z | Wave 3 DLP/export proof added deterministic sensitive-content findings, pre-submission audit blocking for critical/high findings, cleared-scan audit, and security-review task projection for blocking findings. O-016A remains blocked until protected export allow/deny, redaction/waiver, browser, and cleanup proof are captured. | O-016A, O-016B |
| 2026-05-05T13:47Z | Wave 3 clarification proof added a requirement clarification lifecycle for draft, approval request, approval, customer submission, answer ingestion, incorporation, and reopen with requirement metadata, workflow runtime audit, and task projection. F-007/F-008 remain blocked until authenticated requirement-to-compliance browser proof and cleanup are captured. | F-007, F-008 |
| 2026-05-05T13:51Z | Wave 4 proposal task proof added a task lifecycle workflow wrapper for assign, start, block, resume, submit-review, complete, cancel, and reopen transitions with task activity, workflow runtime audit, and operational queue mirroring. F-009 remains blocked until proposal plan baseline, workload browser proof, and cleanup evidence are captured. | F-009 |
| 2026-05-05T13:54Z | Wave 4 review comment proof added comment-to-task projection and resolution/reopen workflow alignment across review comments, proposal task rows, task activity, workflow runtime audit, and operational queue tasks. F-014A remains blocked until browser comment-panel proof and cleanup evidence are captured. | F-014A |
| 2026-05-05T14:51Z | Wave 5 snippet explainability proof added insertion provenance to shortcut expansion: resolved/unresolved placeholder keys, value sources, context IDs, diagnostics, and AI adaptation notes. F-012B remains blocked until authenticated preview/browser insertion proof and cleanup evidence are captured. | F-012B |
| 2026-05-05T15:05Z | Wave 5 content governance proof added a workflow-backed state model for reusable snippet freshness: review-needed, stale, current approval, archive, and reopened review transitions update analytics, enforce owner/org authorization, and project content-governor tasks. F-013 remains blocked until authenticated content-library search, browse, rating, reuse, and cleanup proof is captured. | F-013 |
| 2026-05-05T15:16Z | Wave 5 AI governance proof added an authenticated read-only provider snapshot with active/effective provider, fallback readiness, provider diagnostics, model inventory, cost-metadata flags, and redacted configuration posture. O-013 remains blocked until shared-prod-like provider health transcript and fallback behavior are captured. | O-013 |
| 2026-05-05T19:14Z | Wave 5 resource reuse proof added workflow-backed personnel assignment, confirmation, release/reopen, and past-performance select/approve/reject/deselect/reopen transitions with domain row updates, workflow runtime audit, task projection, access checks, and assignment compensation through current proposal membership. F-017 remains blocked until authenticated personnel/past-performance browser reuse and cleanup evidence are captured. | F-017 |
| 2026-05-05T19:19Z | Wave 5 competitive/win-theme proof added workflow-backed competitive-intelligence review/staleness approval, win-theme active/archive approval, theme-injection accept/modify/reject/reopen, and consistency-gap runtime projection over existing strategy state surfaces. F-018B remains blocked until authenticated competitive/theme browser insertion, section consistency, and cleanup evidence are captured. | F-018B |
| 2026-05-05T19:22Z | Wave 5 search/RAG health proof added deterministic content-library embedding health evaluation, stale-index detection, sample retrieval checks, repair-action projection, and workflow runtime task/audit coverage. O-014A remains blocked until operator/browser/API retrieval proves ACL filtering through joined content metadata and cleanup evidence is captured. | O-014A |
| 2026-05-05T21:40Z | Wave 5 document authoring proof added workflow-backed template/blank document creation with placeholder substitution, content JSON persistence, initial document version creation, proposal-document/section projection, editor content versioning, section word-count progress, AI accept/reject metadata, review handoff, ready/reopen transitions, and workflow runtime task/audit coverage. F-010/F-011 remain blocked until authenticated HDSI/browser persistence and cleanup evidence are captured. | F-010, F-011 |
| 2026-05-05T21:44Z | Wave 6 review package proof added workflow-backed package freeze with document snapshot, review start, reviewer completion, quorum enforcement, unresolved-critical-comment approval block, package approval/rejection, authority waiver, reopen semantics, and workflow runtime task/audit coverage. F-014B remains blocked until authenticated review UI and cleanup evidence are captured. | F-014B |

## Structured Evidence Records

| facility | journey | run_id | artifact_ids | topology_tier | verification_bucket | timestamp | operator | cleanup_status | disposition | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| F-005 | J2 | `e2e_20260503_docfusion` | `rfp:50fa33d1-7521-4a36-9b1f-9686c5cc45fe`, `s3://mansa/rfp/unassigned/50fa33d1-7521-4a36-9b1f-9686c5cc45fe/ralph-e2e-rfp-1777840364944.html` | shared-prod-like | e2e + integration + observability | 2026-05-03T20:36Z | Ralph | restored | pass | Server-side upload stored the RFP in Linode E3, persisted the RFP document, and later deleted both object and DB row with zero-row absence proof. |
| F-006 | J2/O1 | `e2e_20260503_docfusion` | `parse_job:f73ac921-2fb9-4a80-9aa4-44bed77462d9`, `requirementsExtracted:1` | local-production | integration + observability | 2026-05-03T20:36Z | Ralph | restored | partial | Happy-path parse completed and extracted 1 requirement; failed-parse remediation UI/workflow was not exercised in this run. |
| F-012 | J5 | `e2e_20260503_docfusion` | `doc:53c4e667-95f1-4487-8e97-779dff133008`, `doc:5b06aae8-fa43-4324-bc2b-665523122b5d`, `doc:a830f4f1-0099-4b41-b03e-5b346483be08`, `unresolvedHighlighted:1` | shared-prod-like | e2e + integration | 2026-05-03T20:16Z | Ralph | idempotent-noop | pass | Existing snippet fixtures were read through authenticated Playwright; no new live fixture rows were created. |
| F-021 | J8 | `e2e_20260503_docfusion` | `opp:2e9b9767-2b8e-4695-b71e-1b046fbba146`, `submission:766bd7b2-d897-4ba1-b5f2-887588829a79`, `attachments:4` | local-production | e2e + integration | 2026-05-03T20:43Z | Ralph | restored | pass | Submission locked four attachments, created receipt state, and moved the fixture opportunity to submitted; cleanup deleted the submission, workflow, opportunity, and fixture documents. |
| O-001 | O1 | `e2e_20260503_docfusion` | `api:/api/auth/session`, `dashboard_unauth:401`, `dashboard_auth:200` | local-production | e2e + integration | 2026-05-03T20:28Z | Ralph | not-applicable | pass | Protected workflow dashboard denied unauthenticated access and accepted a signed test session cookie. |
| O-002 | O1 | `e2e_20260503_docfusion` | `vitest:__tests__/workflows/api-auth.test.ts`, `scheduler_unauth:401`, `scheduler_secret:200` | local-production | integration + observability | 2026-05-03T20:28Z | Ralph | not-applicable | pass | Scheduler/API authorization was exercised through tests and cron-secret probes. |
| O-003 | O1/J4/J6 | `e2e_20260503_docfusion` | `playwright:e2e/workflow-action-panel.spec.ts`, `submission_workflow:f3fea0ac-e928-48a0-97d1-718c7c935694` | shared-prod-like | e2e + integration + observability | 2026-05-03T20:43Z | Ralph | restored | partial | Browser action-panel workflow and production-submission workflow were exercised; broad reversal/compensation coverage remains outside this run. |
| O-004 | O1 | `e2e_20260503_docfusion` | `api:/api/v1/workflows/templates simulateOnly:200` | shared-prod-like | e2e + integration | 2026-05-03T20:28Z | Ralph | idempotent-noop | partial | Template listing and simulation worked; publication/deprecation lifecycle was not mutated. |
| O-005 | O1 | `e2e_20260503_docfusion` | `worker:breached=0,escalated=0,synced=1,attempted=0` | operator | integration + observability | 2026-05-03T20:27Z | Ralph | idempotent-noop | pass | Strict worker ran successfully; exception sync projected an existing scraper exception into the operational workflow queue. |
| O-006 | O1/J8 | `e2e_20260503_docfusion` | `api:/api/v1/workflows/notifications/dispatch limit0:200`, `worker_attempted:0` | shared-prod-like | integration + observability | 2026-05-03T20:28Z | Ralph | idempotent-noop | partial | Dispatch route and worker path are callable, but no queued Stalwart delivery was present to prove mailbox delivery. |
| O-007 | O1/J2/J8 | `e2e_20260503_docfusion` | `s3://mansa/rfp/e2e/ralph-platform-proof-1777840274128.txt`, `bytes:44`, `digest:0a2a1cc223e68dd5` | shared-prod-like | integration + observability | 2026-05-03T20:31Z | Ralph | restored | pass | Signed PUT/GET readback matched expected bytes; cleanup deleted the object and confirmed subsequent download returned not found. |
| O-008 | O1 | `e2e_20260503_docfusion` | `worker:exceptions.synced=1`, `api:exceptions/sync limit0:200` | local-production | integration + observability | 2026-05-03T20:27Z | Ralph | idempotent-noop | pass | Exception sync was idempotent against existing scraper exception state; no artificial exception fixture was left behind. |
| O-012 | O1 | `e2e_20260503_docfusion` | `migration:0019_restore_rfp_core_tables`, `migration:0020_repair_opportunity_search_vector`, `validate-workflow-runtime-migration:ok` | shared-prod-like | integration + observability | 2026-05-03T21:27Z | Ralph | idempotent-noop | pass | Validator checks required tables/columns plus opportunity search indexes, trigger, function, and stale-vector count. |
| F-006 | J2/O1 | `phase1_20260505T041149Z` | `retry:6e8dd319-f774-4525-9494-1b30e24f5579`, `manual_extraction:7e08781a-708d-480b-9b2d-13c60b0b18bd`, `reject:2982c339-acf2-4ee2-bcba-d5fffb0ed15c`, `log:.omx/logs/platform-completion/phase1_20260505T041149Z/f006-rfp-parse-remediation.json` | local-production | integration + observability | 2026-05-05T04:12Z | Ralph | restored | pass | Authenticated parse API exercised retry, manual extraction, and reject remediation with parse workflow history, job rows, runtime instance rows, and audit events. |
| O-006 | O1/J8 | `phase1_20260505T041149Z` | `notification:297ea107-c476-443f-987c-41981719a39b`, `dispatch:{"attempted":1,"delivered":0,"failed":1,"skipped":0}`, `log:.omx/logs/platform-completion/phase1_20260505T041149Z/o006-stalwart-dispatch.json` | shared-prod-like | integration + observability | 2026-05-05T04:12Z | Ralph | restored | pass | Targeted disposable notification entered the Stalwart SMTP dispatch path and ended with a terminal failed delivery status plus timeout transcript. |
| O-004 | O1 | `phase1_20260505T041149Z` | `template:70e72a60-6e74-4fb5-a915-9040d1418004:deprecated`, `template:19400c06-0a44-4d34-b665-1f4dc4c129c3:active`, `log:.omx/logs/platform-completion/phase1_20260505T041149Z/o004-template-governance.json` | shared-prod-like | integration + observability | 2026-05-05T04:12Z | Ralph | restored | pass | Disposable template governance proof showed valid simulation, publication, successor publication, and automatic deprecation of the prior active version. |
| O-003 | O1/J4/J6 | `phase1_20260505T041149Z` | `phase1-exit:O-004-supplied-safe-mutable-proof`, `playwright:e2e/workflow-action-panel.spec.ts`, `submission_workflow:f3fea0ac-e928-48a0-97d1-718c7c935694` | shared-prod-like | e2e + integration + observability | 2026-05-05T04:12Z | Ralph | restored | blocked | O-004 supplied the safe mutable operator/governance pass required by Phase 1. Broad O-003 reversal remains blocked for this tranche to avoid overclaiming beyond the prior action-panel/submission evidence. |
| Cross-cutting | Phase 1 verification gates | `phase1_20260505T041149Z` | `git diff --check`, `vitest:38 files/531 tests`, `tsc:no-errors`, `lint:no-warnings`, `build:success`, `log:.omx/logs/platform-completion/phase1_20260505T041149Z/verification-gates.json` | local-production | unit + integration + build | 2026-05-05T04:21Z | Ralph | not-applicable | pass | Fresh post-diff verification gate evidence for the Phase 1 implementation and ledger updates. |
