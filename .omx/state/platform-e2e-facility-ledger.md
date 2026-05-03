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

## Product Lane

| ID | facility | journey | topology_tier | priority | mutability | evidence_class | side_effect_proof | fixture_namespace | cleanup_owner | disposition | artifact_ids | cleanup_status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-001 | Opportunity search, filter, and shortlist | J1 | local-production | P1 | local-mutating | e2e + integration | Shortlist or saved-search DB delta and browser trace | `e2e_20260503_docfusion_opportunity` | product-lane | blocked |  | cleanup-pending |
| F-002 | Opportunity source health and scraper run visibility | J1/O1 | operator | P0 | operator-mutating | integration + observability | Scraper run/status row or health command output | `e2e_20260503_docfusion_scraper` | operator-lane | blocked |  | cleanup-pending |
| F-003 | Opportunity qualification and pipeline stage transition | J1 | local-production | P0 | local-mutating | e2e + integration | Pipeline stage/history row and browser trace | `e2e_20260503_docfusion_pipeline` | product-lane | blocked |  | cleanup-pending |
| F-004 | Analytics and PWin dashboard readout | J1 | local-production | P1 | read-only | e2e | Browser trace and data-source/API transcript | `e2e_20260503_docfusion_analytics` | verifier | blocked |  | not-applicable |
| F-005 | RFP upload/fetch with durable storage receipt | J2 | shared-prod-like | P0 | live-mutating | e2e + integration + observability | `s3://` storage path, E3 object checksum, parse/job row | `e2e_20260503_docfusion_rfp` | product-lane | pass | `rfp:50fa33d1-7521-4a36-9b1f-9686c5cc45fe`, `s3://mansa/rfp/unassigned/50fa33d1-7521-4a36-9b1f-9686c5cc45fe/ralph-e2e-rfp-1777840364944.html` | restored |
| F-006 | RFP parse status and failed-parse remediation | J2/O1 | local-production | P0 | local-mutating | integration + observability | Parse job status/history, retry/reject/manual action audit | `e2e_20260503_docfusion_rfp_parse` | product-lane | partial | `parse_job:f73ac921-2fb9-4a80-9aa4-44bed77462d9`, `requirementsExtracted:1` | restored |
| F-007 | Requirement extraction, acceptance, rejection, reopen | J3 | local-production | P0 | local-mutating | e2e + integration | Requirement metadata/history and task projection row | `e2e_20260503_docfusion_req` | product-lane | blocked |  | cleanup-pending |
| F-008 | Compliance matrix row submit/approve/reject/waive/reopen | J3/J6 | local-production | P0 | local-mutating | e2e + integration | Compliance row workflow metadata and matrix stat delta | `e2e_20260503_docfusion_compliance` | product-lane | blocked |  | cleanup-pending |
| F-009 | Proposal planning and task projection | J4 | local-production | P0 | local-mutating | e2e + integration | Task row, assignment, activity/audit event | `e2e_20260503_docfusion_tasks` | product-lane | blocked |  | cleanup-pending |
| F-010 | Document creation from template | J5 | local-production | P0 | local-mutating | e2e + integration | Document row/content JSON/version metadata | `e2e_20260503_docfusion_docs` | product-lane | blocked |  | cleanup-pending |
| F-011 | HDSI/editor authoring and content persistence | J5 | local-production | P0 | local-mutating | e2e + observability | Browser trace and persisted document content/version | `e2e_20260503_docfusion_hdsi` | product-lane | blocked |  | cleanup-pending |
| F-012 | Snippet/template/partial insertion with context resolution | J5 | shared-prod-like | P0 | live-mutating | e2e + integration | Authenticated browser proof, resolved placeholders, unresolved highlight when expected | `snippet-context-fixtures` | product-lane | pass | `doc:53c4e667-95f1-4487-8e97-779dff133008`, `doc:5b06aae8-fa43-4324-bc2b-665523122b5d`, `doc:a830f4f1-0099-4b41-b03e-5b346483be08`, `unresolvedHighlighted:1` | idempotent-noop |
| F-013 | Content library search/browse/rating/reuse | J5 | local-production | P1 | local-mutating | e2e + integration | Search result trace and rating/reuse DB/API evidence | `e2e_20260503_docfusion_content` | product-lane | blocked |  | cleanup-pending |
| F-014 | Comments, review, and approval gates | J6 | local-production | P0 | local-mutating | e2e + integration | Comment/review/approval row and gate audit | `e2e_20260503_docfusion_review` | product-lane | blocked |  | cleanup-pending |
| F-015 | CRM accounts, contacts, deals, and activities | J7 | local-production | P1 | local-mutating | e2e + integration | CRM entity rows and activity timeline evidence | `e2e_20260503_docfusion_crm` | product-lane | blocked |  | cleanup-pending |
| F-016 | Partners assignment and portal-facing visibility | J7 | local-production | P1 | local-mutating | e2e + integration | Partner assignment row and portal/API visibility evidence | `e2e_20260503_docfusion_partner` | product-lane | blocked |  | cleanup-pending |
| F-017 | Personnel and past-performance resource reuse | J7 | local-production | P1 | local-mutating | e2e + integration | Personnel/past-performance row linked into proposal context | `e2e_20260503_docfusion_resources` | product-lane | blocked |  | cleanup-pending |
| F-018 | Pricing, evidence, competitive-intel, and win-theme support surfaces | J7 | local-production | P1 | local-mutating | integration + e2e | Domain action/API/browser evidence and task/audit where present | `e2e_20260503_docfusion_support` | product-lane | blocked |  | cleanup-pending |
| F-019 | Import parse, preview, execute, rollback | J7/O1 | local-production | P0 | local-mutating | e2e + integration + observability | Import status rows, rollback proof, validation report | `e2e_20260503_docfusion_import` | product-lane | blocked |  | cleanup-pending |
| F-020 | Render/export/download artifact | J8 | local-production | P0 | local-mutating | e2e + observability | Rendered file/hash/download metadata | `e2e_20260503_docfusion_render` | product-lane | blocked |  | cleanup-pending |
| F-021 | Submission package and receipt | J8 | local-production | P0 | local-mutating | e2e + integration | Submission record, protected download, receipt evidence | `e2e_20260503_docfusion_submission` | product-lane | pass | `opp:2e9b9767-2b8e-4695-b71e-1b046fbba146`, `submission:766bd7b2-d897-4ba1-b5f2-887588829a79`, `attachments:4` | restored |
| F-022 | Outcome capture, win/loss, reporting, debrief | J9 | local-production | P1 | local-mutating | e2e + integration | Outcome/debrief row and dashboard/report evidence | `e2e_20260503_docfusion_outcome` | product-lane | blocked |  | cleanup-pending |

## Operator / Control-Plane Lane

| ID | facility | journey | topology_tier | priority | mutability | evidence_class | side_effect_proof | fixture_namespace | cleanup_owner | disposition | artifact_ids | cleanup_status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| O-001 | Auth.js/Keycloak session and protected route enforcement | O1 | local-production | P0 | read-only | e2e + integration | Session endpoint proof and redirect/deny proof | `e2e_20260503_docfusion_auth` | security-lane | pass | `api:/api/auth/session`, `dashboard_unauth:401`, `dashboard_auth:200` | not-applicable |
| O-002 | Authz/SpiceDB/resource permission checks | O1 | local-production | P0 | read-only | integration + observability | Permit/deny transcript and sensitive action audit | `e2e_20260503_docfusion_authz` | security-lane | pass | `vitest:__tests__/workflows/api-auth.test.ts`, `scheduler_unauth:401`, `scheduler_secret:200` | not-applicable |
| O-003 | Workflow runtime start/transition/reversal | O1/J4/J6 | shared-prod-like | P0 | live-mutating | e2e + integration + observability | Workflow instance/task/audit rows before/after | `e2e_20260503_docfusion_workflow` | operator-lane | partial | `playwright:e2e/workflow-action-panel.spec.ts`, `submission_workflow:production_submission` | restored |
| O-004 | Workflow template governance, simulation, publication, deprecation | O1 | shared-prod-like | P0 | live-mutating | e2e + integration | Template version/status rows and simulation transcript | `e2e_20260503_docfusion_templates` | operator-lane | partial | `api:/api/v1/workflows/templates simulateOnly:200` | idempotent-noop |
| O-005 | Workflow worker loop: SLA, exception sync, notification delivery | O1 | operator | P0 | operator-mutating | integration + observability | Worker JSON/log output, processed counts, DB deltas | `e2e_20260503_docfusion_worker` | operator-lane | pass | `worker:breached=0,escalated=0,synced=1,attempted=0` | idempotent-noop |
| O-006 | Notification dispatch through Stalwart | O1/J8 | shared-prod-like | P0 | live-mutating | integration + observability | Notification row plus delivery-attempt or mailbox proof | `e2e_20260503_docfusion_mail` | operator-lane | partial | `api:/api/v1/workflows/notifications/dispatch limit0:200`, `worker_attempted:0` | idempotent-noop |
| O-007 | Linode E3 server-side upload/download/readback | O1/J2/J8 | shared-prod-like | P0 | live-mutating | integration + observability | Object key, checksum, byte-for-byte readback | `e2e_20260503_docfusion_e3` | operator-lane | pass | `s3://mansa/rfp/e2e/ralph-platform-proof-1777840274128.txt`, `bytes:44`, `digest:0a2a1cc223e68dd5` | restored |
| O-008 | Operational exception sync and remediation | O1 | local-production | P0 | local-mutating | integration + observability | Exception workflow instance, task, SLA/escalation metadata | `e2e_20260503_docfusion_exception` | operator-lane | pass | `worker:exceptions.synced=1`, `api:exceptions/sync limit0:200` | idempotent-noop |
| O-009 | Scraper schedule, manual run, cancel, health, SSE | O1/J1 | operator | P0 | operator-mutating | integration + observability | Scheduled/manual run status, health endpoint, logs/SSE event | `e2e_20260503_docfusion_scraper` | operator-lane | blocked |  | cleanup-pending |
| O-010 | API/admin health and service probes | O1 | operator | P0 | read-only | observability | Health probe outputs for app/scraper/search/LLM where configured | `e2e_20260503_docfusion_health` | operator-lane | blocked |  | not-applicable |
| O-011 | Backup/restore smoke validation | O1 | operator | P0 | operator-mutating | observability | Backup command output and smoke restore validation | `e2e_20260503_docfusion_backup` | operator-lane | credential-missing |  | cleanup-pending |
| O-012 | Migration validation and remediation | O1 | shared-prod-like | P0 | live-mutating | integration + observability | Migration validate/apply output and table presence proof | `e2e_20260503_docfusion_migration` | operator-lane | pass | `migration:0019_restore_rfp_core_tables`, `migration:0020_repair_opportunity_search_vector`, `validate-workflow-runtime-migration:ok` | idempotent-noop |
| O-013 | AI/model provider health and governance | O1/J5 | shared-prod-like | P1 | read-only | integration + observability | Provider/model list or health transcript with fallback behavior | `e2e_20260503_docfusion_ai` | operator-lane | blocked |  | not-applicable |
| O-014 | Research/search integrations: Firecrawl, stealth scraper, SearXNG, Ollama | O1/J1 | operator | P1 | operator-mutating | integration + observability | Health and sample query/scrape transcript | `e2e_20260503_docfusion_research` | operator-lane | blocked |  | cleanup-pending |
| O-015 | Audit/governance reportability | O1/J9 | local-production | P0 | read-only | observability + e2e | Auditor-visible event trail for selected run ID | `e2e_20260503_docfusion_audit` | verifier | blocked |  | not-applicable |
| O-016 | Privacy/DLP/access-sensitive export checks | O1/J8 | local-production | P0 | local-mutating | integration + observability | DLP/security finding or protected export deny/allow transcript | `e2e_20260503_docfusion_privacy` | security-lane | blocked |  | cleanup-pending |

## Strategic / Non-Credited Rows

| ID | facility | journey | topology_tier | priority | disposition | reason |
|---|---|---|---|---|---|---|
| X-001 | Mobile/offline full app workflow | O1/J6 | legacy-reference | Strategic | strategic | PWA/offline concepts exist, but no full mobile/offline workflow surface is validated in this campaign. |
| X-002 | Payment/revenue recognition | J8/O1 | legacy-reference | Strategic | strategic | No visible implemented payment gateway/reconciliation surface. |
| X-003 | Configurable domain/rule packs beyond workflow templates | O1 | legacy-reference | Strategic | strategic | Workflow template seeding exists; broader visual rule-pack authoring remains strategic. |

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
