# Platform E2E Facility Ledger

Run namespace: `e2e_20260503_docfusion`

Status: Phase 0 seed ledger. Rows start as `blocked` until evidence artifacts are attached during execution. `docs-only`, `strategic`, `unsupported`, `credential-missing`, and `legacy-topology` rows never count as validated coverage.

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
| F-005 | RFP upload/fetch with durable storage receipt | J2 | shared-prod-like | P0 | live-mutating | e2e + integration + observability | `s3://` storage path, E3 object checksum, parse/job row | `e2e_20260503_docfusion_rfp` | product-lane | blocked |  | cleanup-pending |
| F-006 | RFP parse status and failed-parse remediation | J2/O1 | local-production | P0 | local-mutating | integration + observability | Parse job status/history, retry/reject/manual action audit | `e2e_20260503_docfusion_rfp_parse` | product-lane | blocked |  | cleanup-pending |
| F-007 | Requirement extraction, acceptance, rejection, reopen | J3 | local-production | P0 | local-mutating | e2e + integration | Requirement metadata/history and task projection row | `e2e_20260503_docfusion_req` | product-lane | blocked |  | cleanup-pending |
| F-008 | Compliance matrix row submit/approve/reject/waive/reopen | J3/J6 | local-production | P0 | local-mutating | e2e + integration | Compliance row workflow metadata and matrix stat delta | `e2e_20260503_docfusion_compliance` | product-lane | blocked |  | cleanup-pending |
| F-009 | Proposal planning and task projection | J4 | local-production | P0 | local-mutating | e2e + integration | Task row, assignment, activity/audit event | `e2e_20260503_docfusion_tasks` | product-lane | blocked |  | cleanup-pending |
| F-010 | Document creation from template | J5 | local-production | P0 | local-mutating | e2e + integration | Document row/content JSON/version metadata | `e2e_20260503_docfusion_docs` | product-lane | blocked |  | cleanup-pending |
| F-011 | HDSI/editor authoring and content persistence | J5 | local-production | P0 | local-mutating | e2e + observability | Browser trace and persisted document content/version | `e2e_20260503_docfusion_hdsi` | product-lane | blocked |  | cleanup-pending |
| F-012 | Snippet/template/partial insertion with context resolution | J5 | shared-prod-like | P0 | live-mutating | e2e + integration | Authenticated browser proof, resolved placeholders, unresolved highlight when expected | `snippet-context-fixtures` | product-lane | blocked |  | cleanup-pending |
| F-013 | Content library search/browse/rating/reuse | J5 | local-production | P1 | local-mutating | e2e + integration | Search result trace and rating/reuse DB/API evidence | `e2e_20260503_docfusion_content` | product-lane | blocked |  | cleanup-pending |
| F-014 | Comments, review, and approval gates | J6 | local-production | P0 | local-mutating | e2e + integration | Comment/review/approval row and gate audit | `e2e_20260503_docfusion_review` | product-lane | blocked |  | cleanup-pending |
| F-015 | CRM accounts, contacts, deals, and activities | J7 | local-production | P1 | local-mutating | e2e + integration | CRM entity rows and activity timeline evidence | `e2e_20260503_docfusion_crm` | product-lane | blocked |  | cleanup-pending |
| F-016 | Partners assignment and portal-facing visibility | J7 | local-production | P1 | local-mutating | e2e + integration | Partner assignment row and portal/API visibility evidence | `e2e_20260503_docfusion_partner` | product-lane | blocked |  | cleanup-pending |
| F-017 | Personnel and past-performance resource reuse | J7 | local-production | P1 | local-mutating | e2e + integration | Personnel/past-performance row linked into proposal context | `e2e_20260503_docfusion_resources` | product-lane | blocked |  | cleanup-pending |
| F-018 | Pricing, evidence, competitive-intel, and win-theme support surfaces | J7 | local-production | P1 | local-mutating | integration + e2e | Domain action/API/browser evidence and task/audit where present | `e2e_20260503_docfusion_support` | product-lane | blocked |  | cleanup-pending |
| F-019 | Import parse, preview, execute, rollback | J7/O1 | local-production | P0 | local-mutating | e2e + integration + observability | Import status rows, rollback proof, validation report | `e2e_20260503_docfusion_import` | product-lane | blocked |  | cleanup-pending |
| F-020 | Render/export/download artifact | J8 | local-production | P0 | local-mutating | e2e + observability | Rendered file/hash/download metadata | `e2e_20260503_docfusion_render` | product-lane | blocked |  | cleanup-pending |
| F-021 | Submission package and receipt | J8 | local-production | P0 | local-mutating | e2e + integration | Submission record, protected download, receipt evidence | `e2e_20260503_docfusion_submission` | product-lane | blocked |  | cleanup-pending |
| F-022 | Outcome capture, win/loss, reporting, debrief | J9 | local-production | P1 | local-mutating | e2e + integration | Outcome/debrief row and dashboard/report evidence | `e2e_20260503_docfusion_outcome` | product-lane | blocked |  | cleanup-pending |

## Operator / Control-Plane Lane

| ID | facility | journey | topology_tier | priority | mutability | evidence_class | side_effect_proof | fixture_namespace | cleanup_owner | disposition | artifact_ids | cleanup_status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| O-001 | Auth.js/Keycloak session and protected route enforcement | O1 | local-production | P0 | read-only | e2e + integration | Session endpoint proof and redirect/deny proof | `e2e_20260503_docfusion_auth` | security-lane | blocked |  | not-applicable |
| O-002 | Authz/SpiceDB/resource permission checks | O1 | local-production | P0 | read-only | integration + observability | Permit/deny transcript and sensitive action audit | `e2e_20260503_docfusion_authz` | security-lane | blocked |  | not-applicable |
| O-003 | Workflow runtime start/transition/reversal | O1/J4/J6 | shared-prod-like | P0 | live-mutating | e2e + integration + observability | Workflow instance/task/audit rows before/after | `e2e_20260503_docfusion_workflow` | operator-lane | blocked |  | cleanup-pending |
| O-004 | Workflow template governance, simulation, publication, deprecation | O1 | shared-prod-like | P0 | live-mutating | e2e + integration | Template version/status rows and simulation transcript | `e2e_20260503_docfusion_templates` | operator-lane | blocked |  | cleanup-pending |
| O-005 | Workflow worker loop: SLA, exception sync, notification delivery | O1 | operator | P0 | operator-mutating | integration + observability | Worker JSON/log output, processed counts, DB deltas | `e2e_20260503_docfusion_worker` | operator-lane | blocked |  | cleanup-pending |
| O-006 | Notification dispatch through Stalwart | O1/J8 | shared-prod-like | P0 | live-mutating | integration + observability | Notification row plus delivery-attempt or mailbox proof | `e2e_20260503_docfusion_mail` | operator-lane | blocked |  | cleanup-pending |
| O-007 | Linode E3 server-side upload/download/readback | O1/J2/J8 | shared-prod-like | P0 | live-mutating | integration + observability | Object key, checksum, byte-for-byte readback | `e2e_20260503_docfusion_e3` | operator-lane | blocked |  | cleanup-pending |
| O-008 | Operational exception sync and remediation | O1 | local-production | P0 | local-mutating | integration + observability | Exception workflow instance, task, SLA/escalation metadata | `e2e_20260503_docfusion_exception` | operator-lane | blocked |  | cleanup-pending |
| O-009 | Scraper schedule, manual run, cancel, health, SSE | O1/J1 | operator | P0 | operator-mutating | integration + observability | Scheduled/manual run status, health endpoint, logs/SSE event | `e2e_20260503_docfusion_scraper` | operator-lane | blocked |  | cleanup-pending |
| O-010 | API/admin health and service probes | O1 | operator | P0 | read-only | observability | Health probe outputs for app/scraper/search/LLM where configured | `e2e_20260503_docfusion_health` | operator-lane | blocked |  | not-applicable |
| O-011 | Backup/restore smoke validation | O1 | operator | P0 | operator-mutating | observability | Backup command output and smoke restore validation | `e2e_20260503_docfusion_backup` | operator-lane | credential-missing |  | cleanup-pending |
| O-012 | Migration validation and remediation | O1 | shared-prod-like | P0 | live-mutating | integration + observability | Migration validate/apply output and table presence proof | `e2e_20260503_docfusion_migration` | operator-lane | blocked |  | cleanup-pending |
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
