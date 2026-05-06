# Full Platform Capability Implementation Plan

Date: 2026-05-06

Status: Planning baseline

Primary sources: `docs/platform-jtbd-catalogue.md`, `docs/enhancements.md`, `docs/jtbd-implementation-ledger.md`, `docs/plans/2026-04-22-master-completion-plan.md`, current workflow implementation notes, and recent facility-ledger proof obligations.

This document defines the implementation plan for making DocFusion easier to use and operationally complete across the full proposal lifecycle: RFP discovery, selection, intake, storage, parsing, requirement extraction, compliance, drafting, evidence, approvals, production, dispatch, receipt, outcome capture, and platform operations.

The goal is not to add isolated screens. The goal is to make every important user and system job workflow-backed, visible, reversible where appropriate, auditable, and provable through live-safe tests.

## Completion Standard

A capability is complete only when all applicable items below are true:

- The subject type and owning domain are explicit.
- The state model is explicit, including terminal states, reopen paths, cancellation, retry, reversal, and compensation semantics.
- Server mutations enforce authentication, organization/resource scope, role permissions, and authority rules.
- Human work projects into a task, inbox item, approval, exception item, or portal request with owner, due date, priority, blocker state, and status.
- Workflow actions expose next allowed actions and disabled-action reasons.
- SLA timers, escalation, and notification behavior are implemented or explicitly marked not applicable.
- Audit events capture actor, reason, before/after state, subject, evidence, correlation ID, timestamp, and immutable artifact references where relevant.
- Portal visibility is explicitly scoped for external users.
- Operational dashboards show stuck, failed, breached, and blocked work.
- Browser or API tests cover happy path, invalid transition, authority denial, blocked gate, notification/audit side effects, and reversal or retry where relevant.
- A facility-ledger proof row or subrow is updated with run ID, test artifacts, data fixtures, and cleanup evidence.

No status should be promoted to `Live` only because a UI page or table exists. The job must work as an end-to-end workflow.

## Implementation Waves

| Wave | Theme | Primary outcome |
|---:|---|---|
| 0 | Baseline and proof harness | Build a reliable test/proof harness against disposable fixtures and live-safe services. |
| 1 | Unified work surface | Make users see one command center, one inbox, one action model, and one audit trail. |
| 2 | Discovery to intake | Make RFP discovery, selection, Linode E3 storage, parsing, and requirement extraction seamless. |
| 3 | Compliance, evidence, readiness | Make gaps, waivers, evidence, DLP, and readiness measurable and blocking. |
| 4 | Planning, collaboration, tasks | Make assignments, comments, section health, workload, and deadlines workflow-backed. |
| 5 | Authoring, AI, content, memory | Make writing assistance contextual, traceable, governed, reusable, and high quality. |
| 6 | Approval, pricing, production, submission | Make final artifacts, approval, signing, dispatch, receipt, and correction complete. |
| 7 | Integrations, partners, operations, reporting | Make CRM, partners, imports, webhooks, incidents, dashboards, and migration operations robust. |
| 8 | Strategic differentiators | Add offline/mobile, finance workflows, rule packs, proposal memory, and advanced simulation. |

Waves can overlap when teams are independent, but live promotion must respect dependency gates in `docs/jtbd-implementation-ledger.md`.

## Wave 0: Baseline and Proof Harness

### Goal

Create the verification substrate needed to prove that later features work end to end against real application surfaces and live-safe infrastructure.

### Capabilities

- Disposable opportunity/RFP/proposal fixture factory.
- Authenticated browser test user provisioning.
- Live-safe Linode E3 bucket smoke validation for upload, download, metadata, object hash, and cleanup.
- Live-safe Stalwart SMTP validation for queued email, delivered status, bounce/failure handling, and acknowledgement links.
- Live-safe LiteLLM validation for configured providers, prompt metadata, budget guardrails, and fallback behavior.
- Live-safe `db.lindela.io` validation for migrations, seed data, transactional rollbacks, and fixture cleanup.
- Facility-ledger writer that records proof evidence with run ID, data IDs, artifact hashes, and cleanup evidence.

### Functional Work

- Add a `scripts/platform-proof/` test harness with typed scenario definitions.
- Add reusable fixture builders for opportunity, RFP document, requirements, compliance matrix, document sections, evidence, review package, pricing package, submission package, portal contributor, import job, and workflow instance.
- Add a cleanup registry that deletes generated rows and object-storage artifacts by run ID.
- Add proof runners for:
  - discovery to parse;
  - requirement to compliance matrix;
  - document authoring to final artifact;
  - approval to submission;
  - Stalwart notification delivery;
  - Linode E3 object lifecycle;
  - import preview, execution, and rollback;
  - workflow reversal and audit reconstruction.
- Add CI jobs that can run in two modes:
  - local deterministic mode using isolated test DB/object store fixtures;
  - live-safe mode using deployed infrastructure and disposable records.

### Data and Workflow Requirements

- Every generated fixture must include `proofRunId`.
- Every workflow instance created during proof must include `metadata.proofRunId`.
- Every object stored in Linode E3 during proof must include deterministic key prefix such as `proof-runs/{runId}/`.
- Every notification sent during proof must include a proof marker in metadata, not in user-facing copy unless required for debugging.

### Acceptance Criteria

- A single command can execute the golden path and write proof evidence.
- Failed proof cleanup leaves no RFP files, mail test records, or durable workflow instances behind except immutable audit evidence explicitly retained by policy.
- Facility proof rows can distinguish `not-run`, `blocked`, `failed`, `pass`, and `pass-with-known-risk`.

## Wave 1: Unified Work Surface

### Goal

Reduce navigation and uncertainty by giving every role one primary place to see work, blockers, next actions, and audit history.

### UX-001 Opportunity Command Center

#### User Job

Proposal teams need to understand the current state of an opportunity and act without jumping across unrelated pages.

#### Functional Capabilities

- Opportunity header with pursuit stage, bid decision, deadline, owner, value, client, source, and current risk.
- Current workflow state across discovery, intake, requirements, compliance, drafting, evidence, approvals, production, and submission.
- Next best action card with action label, reason, authority needed, blocker state, owner, and due date.
- Blockers grouped by severity: compliance, evidence, parse, assignment, approval, production, notification, integration, and dispatch.
- Readiness summary with links to full readiness score and final checklist.
- Timeline of lifecycle events from source discovery to receipt and outcome.
- Linked artifacts: RFP source file, parsed document, compliance matrix, proposal document, final package, submission receipt.

#### Backend Work

- Build an opportunity projection service that reads workflow instances, tasks, approvals, requirements, compliance rows, documents, evidence, pricing, submission packages, notifications, and audit events.
- Add stable projection DTOs so dashboard and API tests do not depend on raw table shapes.
- Add cache invalidation on workflow transition, task update, audit event, and document artifact change.

#### UI Work

- Add `/opportunities/[id]/command-center`.
- Reuse existing opportunity detail components where possible.
- Add command-center tabs: Overview, Timeline, Requirements, Compliance, Drafting, Evidence, Reviews, Production, Submission, Audit.
- Add compact command-center widgets for deadline, owner, blockers, readiness, and action eligibility.

#### Workflow Requirements

- Every card links to a workflow action or a disabled-action reason.
- Blocking actions must be server-validated, not only hidden in UI.
- Timeline events must be derived from audit/workflow records rather than duplicated UI state.

#### Acceptance Criteria

- Authenticated browser proof opens a real opportunity and verifies visible state, blockers, next action, and linked artifacts.
- Command center displays no false "ready" state when compliance, approval, production, or submission gates are incomplete.

### UX-003 Next Best Action Queue and UX-011 Operational Inbox

#### User Job

Each user needs one queue that tells them what to do now across tasks, approvals, comments, notifications, exceptions, and portal requests.

#### Functional Capabilities

- Work-item projection across tasks, approvals, comments, clarification requests, evidence requests, workflow exceptions, SLA breaches, imports, and partner contributions.
- Priority ranking based on due date, SLA breach, role authority, blocker impact, opportunity value, and downstream dependency.
- Bulk actions for acknowledge, assign, snooze, escalate, mark blocked, and complete where safe.
- Filters for role, opportunity, workflow type, due date, severity, owner, and portal/internal source.
- Deep links to command center, document section, compliance row, approval card, import job, or exception item.

#### Backend Work

- Create a canonical work-item projection table or materialized view.
- Add server actions/API for acknowledge, snooze, assign, escalate, and bulk transition.
- Implement idempotent projection refresh on source changes.

#### Acceptance Criteria

- Inbox browser tests verify that a generated requirement task, approval, failed parse exception, and comment-resolution item all appear in one queue with correct actions.
- Permission tests prove users cannot act on work items outside their organization or authority.

### UX-006 Smart Blocker Dashboard

#### User Job

Managers and operators need to see only blockers that affect completion and know who owns each one.

#### Functional Capabilities

- Normalized blocker taxonomy.
- Severity and impact score.
- Owner, due date, age, SLA status, workflow state, and remediation action.
- Cross-opportunity rollup and single-opportunity drilldown.
- Exportable blocker report for daily standups and gate meetings.

#### Acceptance Criteria

- Blocker projection tests cover missing evidence, unresolved placeholder, failed parse, stale assignment, late review, failed notification, import conflict, and submission gate failure.

### UX-009 One-Click Remediation Actions

#### User Job

Users need direct, safe actions from every failed or blocked state.

#### Functional Capabilities

- Remediation action registry keyed by subject type and state.
- Examples:
  - retry parse;
  - assign owner;
  - request evidence;
  - waive with authority;
  - reopen review;
  - escalate approval;
  - regenerate section;
  - rerun DLP scan;
  - re-render artifact;
  - resend notification;
  - rollback import;
  - open correction package.
- Disabled-action explanations with missing permission, missing prerequisite, locked artifact, expired window, or unsupported subject state.

#### Acceptance Criteria

- Browser action-panel test covers mouse and keyboard activation, disabled actions, server denial, success feedback, audit event, and resulting state projection.

### UX-010 Role-Based Homepages

#### User Job

Proposal managers, writers, reviewers, approvers, partners, operators, administrators, and auditors need default landing pages that reflect their actual work.

#### Functional Capabilities

- Proposal manager homepage: active pursuits, deadlines, blockers, next best actions, submission readiness.
- Writer homepage: assigned sections, requirements, evidence gaps, comments, AI suggestions.
- Reviewer homepage: review packages, approvals, comments needing resolution, due dates.
- Approver homepage: pending decisions, authority thresholds, frozen artifacts, rationale history.
- Partner homepage: scoped assignments, upload requests, comments, deadlines.
- Operator homepage: failed jobs, SLA breaches, source freshness, notification failures, import failures.
- Admin homepage: workflow template changes, configuration approvals, system health, audit exceptions.
- Auditor homepage: searchable audit events, artifact hashes, decision chains, export jobs.

#### Acceptance Criteria

- Role-based browser tests verify that each persona sees only authorized work and receives the correct default route.

### UX-020 Workflow Template Studio

#### User Job

Administrators need to design, simulate, version, publish, retire, and roll back workflow templates safely.

#### Functional Capabilities

- Draft workflow template editing.
- State and transition editor with guards, permission rules, SLA rules, notification rules, and audit event mapping.
- Simulation against fixture subjects.
- Compatibility report showing affected active workflows.
- Version policy with draft, review, published, deprecated, retired, and rolled-back states.
- Admin approval and publication history.

#### Acceptance Criteria

- Template governance proof covers draft creation, simulation failure, simulation success, publication, version bump, deprecation, and blocked incompatible migration.

### UX-021 Audit Explorer

#### User Job

Auditors and operators need to reconstruct who did what, when, why, under which authority, and against which artifact.

#### Functional Capabilities

- Search by actor, opportunity, subject type, workflow ID, artifact hash, action, reason code, date range, and correlation ID.
- Timeline reconstruction for an opportunity, workflow instance, document artifact, or submission package.
- Decision-chain view for bid/no-bid, waiver, approval, pricing, DLP, signature, dispatch, and correction.
- Export to CSV/JSON and immutable audit bundle.

#### Acceptance Criteria

- Audit reconstruction proof starts from a submitted package and resolves back to RFP source, requirements, compliance signoff, evidence, approvals, artifact hash, dispatch, and receipt.

### UX-022 Safe Sandbox Mode

#### User Job

Admins and operators need to test imports, workflow templates, snippets, parse jobs, and exports without mutating live opportunities.

#### Functional Capabilities

- Sandbox namespace and banner.
- Preview-only mutations with rollback guarantee.
- Fake dispatch channel and fake external portal invitations.
- Object-store and mail isolation by prefix/recipient policy.
- Cleanup dashboard.

#### Acceptance Criteria

- Sandbox cleanup proof shows that generated records and objects are removed or retained only under documented audit-retention policy.

## Wave 2: Discovery to Intake

### Goal

Make the first mile seamless: source discovery, opportunity selection, RFP download, Linode E3 storage, parse, and requirement extraction should feel like one reliable guided workflow.

### UX-002 Guided RFP Intake Wizard

#### User Job

Proposal managers need to ingest an RFP from discovery, URL, upload, or source document without manual rework or uncertainty.

#### Functional Capabilities

- Intake source selection: discovered opportunity document, URL fetch, manual upload, email attachment, or object-store key.
- Server-side download/fetch to Linode E3 because Linode E3 does not support browser CORS.
- Source validation: URL reachability, content type, size, filename, hash, virus/security scan, duplicate detection, and source provenance.
- Object-store receipt: bucket, key, version or ETag, SHA-256 hash, byte size, timestamp, source URL, actor, and proof run ID if applicable.
- Parse status polling and progress events.
- Parser failure remediation: retry, choose parser, manual extraction, reject source, upload replacement.
- Requirement extraction review handoff.
- Audit events for every state transition.

#### Backend Work

- Consolidate RFP download and upload paths so every path stores object bytes in Linode E3 before parsing.
- Ensure RFP processing reads from Linode E3 rather than local or browser-transient storage.
- Add object metadata persistence and signed server-side download route.
- Add parse job state model: queued, stored, scanning, parsing, extraction_review, failed, rejected, accepted, superseded.
- Add idempotency keys for source URL plus opportunity plus hash.
- Add duplicate handling: reuse existing object, link existing RFP, or create amendment.

#### UI Work

- Add intake wizard to command center and opportunity detail.
- Show object-storage receipt and parse state.
- Show parser errors with concrete remediation actions.
- Show accepted source text preview and extracted metadata before requirement review.

#### Workflow Requirements

- Intake must create or update a workflow instance with owner, SLA, notifications, and exceptions.
- Failed download, failed storage, scan failure, parse failure, and extraction low confidence must create operational work items.
- Superseded RFPs must preserve old artifacts and start amendment impact analysis.

#### Acceptance Criteria

- Authenticated browser proof covers discovered opportunity to server-side E3 object to parse job to extracted requirements.
- API tests prove browser clients cannot upload directly to E3.
- Object cleanup proof removes disposable test keys.

### Discovery Source Health and Opportunity Triage

#### User Job

System jobs need to keep sources fresh; proposal managers need to triage relevant opportunities.

#### Functional Capabilities

- Source run workflow with scheduled, queued, running, degraded, completed, failed, disabled states.
- Source freshness SLA.
- Duplicate candidate review.
- Fit scoring and explainable opportunity recommendation.
- Saved searches and daily digest connected to triage queue.
- Promote to capture or reject/archive with reason.

#### Acceptance Criteria

- Tests prove repeated source failure creates an exception item and escalation.
- Triage browser flow promotes a discovered opportunity and creates command-center state.

### Proposal Timeline

#### User Job

Users need to see the full journey from discovery to outcome at a glance.

#### Functional Capabilities

- Timeline events for discovery, source run, shortlist, stage changes, bid decision, RFP intake, parse, requirement acceptance, compliance, drafting, reviews, approvals, production, dispatch, receipt, outcome, and corrections.
- Event filters by type, actor, workflow, and artifact.
- Missed deadline and SLA breach markers.

#### Acceptance Criteria

- Timeline data-source tests prove events are generated from audit/workflow records and not hand-maintained UI state.

## Wave 3: Compliance, Evidence, Readiness

### Goal

Make proposal quality measurable and enforceable before final production.

### UX-004 Response Readiness Score

#### User Job

Proposal managers need to know whether a response is ready to submit and exactly what remains.

#### Functional Capabilities

- Score dimensions:
  - mandatory requirement coverage;
  - compliance row status;
  - evidence support;
  - unresolved placeholders;
  - incomplete sections;
  - comments/findings;
  - approvals;
  - pricing lock;
  - production validation;
  - DLP/security status;
  - artifact render status;
  - dispatch channel readiness.
- Each dimension exposes pass/fail/warn, score contribution, blocker owner, due date, and action.
- Readiness trend over time.

#### Backend Work

- Add readiness scoring service with deterministic rules and versioned scoring policy.
- Persist score snapshots for audit and dashboards.
- Add blocker projection integration.

#### Acceptance Criteria

- Readiness tests cover blocked, warning, pass, waived, and stale-score states.
- Final checklist cannot pass if readiness contains unwaived critical blockers.

### Compliance Matrix Governance

#### User Job

Compliance officers need every requirement mapped, reviewed, locked, waived, or remediated before submission.

#### Functional Capabilities

- Matrix lifecycle: draft, populated, in review, gap remediation, locked, reopened, superseded.
- Row lifecycle: draft, assigned, submitted, approved, rejected, waived, reopened, superseded.
- Mandatory row gate.
- Waiver authority with rationale and expiration.
- Gap task projection.
- Requirement-to-response traceability.
- Final lock and export package.

#### Acceptance Criteria

- Tests prove final submission is blocked when mandatory rows are unmapped, rejected, stale, or waived without authority.
- Audit explorer reconstructs a row approval or waiver decision.

### UX-016 Requirement-to-Response Traceability

#### User Job

Users need to click a requirement and see where it is answered, what evidence supports it, who approved it, and whether it appears in the final export.

#### Functional Capabilities

- Bidirectional links between requirement, document section, paragraph/block, evidence item, compliance row, approval, review comment, and final artifact position.
- Export-time trace records that bind final artifact hash to requirement coverage.
- Traceability panel in requirements, document editor, compliance matrix, and final package.

#### Acceptance Criteria

- Traceability proof starts from a requirement and resolves to source text, response block, evidence, approval, and final exported artifact reference.

### Evidence and Claim Remediation

#### User Job

Writers and compliance officers need unsupported claims to become owned, resolvable work.

#### Functional Capabilities

- Evidence lifecycle: imported, draft, verified, approved, stale, expired, archived.
- Claim lifecycle: detected, assigned, evidence needed, rewrite needed, waiver requested, resolved, removed, reopened.
- Evidence strength score and acceptable evidence types.
- Evidence expiry and renewal tasks.
- Claim-to-requirement and claim-to-section linkage.
- Reviewer approval for high-risk claims.

#### Acceptance Criteria

- Unsupported critical claim blocks readiness until evidenced, rewritten, waived by authority, or removed.

### Clarification Tracker

#### User Job

Proposal teams need to manage questions to the client, answers, addenda, and downstream requirement changes.

#### Functional Capabilities

- Clarification lifecycle: draft question, internal review, submitted, answered, addendum received, impact review, incorporated, closed.
- Owner, deadline, client channel, submitted text, answer text, affected requirements, affected sections.
- Addendum ingestion and diff against current requirement set.
- Tasks for impacted owners.

#### Acceptance Criteria

- Clarification lifecycle test covers question submission, answer capture, requirement impact, and downstream task creation.

### Privacy and DLP Remediation

#### User Job

Security and proposal teams need sensitive data findings to block unsafe sharing and guide remediation.

#### Functional Capabilities

- DLP scan tied to documents, evidence, partner uploads, exports, and final packages.
- Finding lifecycle: detected, assigned, false positive, redaction required, approved exception, remediated, reopened.
- Redaction artifacts and approval rationale.
- External sharing gate.

#### Acceptance Criteria

- Final export and partner sharing are blocked by unresolved critical DLP findings.

## Wave 4: Planning, Collaboration, Tasks

### Goal

Make the work plan, assignments, comments, section status, and team coordination first-class.

### Proposal Plan and Task Baseline

#### User Job

Proposal managers need to turn requirements and deadlines into an owned, realistic plan.

#### Functional Capabilities

- Generated proposal plan from requirements, sections, deadlines, review gates, pricing, partner needs, and production tasks.
- Baseline approval.
- Rebaseline with reason and audit trail.
- Critical path view.
- Dependencies and blocked-by links.
- Capacity and workload warnings.

#### Acceptance Criteria

- Plan generation creates owned tasks for accepted requirements, compliance gaps, review packages, pricing, production, and submission.

### UX-015 Proposal Section Health Indicators

#### User Job

Writers and managers need section-level visibility into draft, review, evidence, compliance, approval, and export readiness.

#### Functional Capabilities

- Section state: assigned, drafting, AI pending review, ready for review, in review, changes requested, approved, locked, reopened.
- Health indicators for requirement coverage, evidence, comments, placeholders, AI provenance, approval, and export validation.
- Section-level owner, due date, and next action.

#### Acceptance Criteria

- Browser test verifies health indicators update after snippet insertion, requirement link, evidence link, review completion, and export validation.

### UX-019 Comment Resolution Workflow

#### User Job

Comments need to become owned, trackable work rather than loose discussion.

#### Functional Capabilities

- Convert comment to task.
- Assign owner, severity, due date, and affected section.
- Resolve with rationale and optional evidence.
- Reopen after reviewer rejection.
- Notifications and inbox projection.

#### Acceptance Criteria

- Comment-to-task E2E proves a reviewer comment appears in inbox, is resolved, and is reflected in section health and audit.

### Collaboration and Conflict Handling

#### User Job

Multiple authors need to edit without losing work or violating section permissions.

#### Functional Capabilities

- Presence and activity tracking.
- Section locks or soft ownership.
- Conflict detection and resolution workflow.
- Offline edit reconciliation.
- Operation audit for material changes.

#### Acceptance Criteria

- Tests cover section permission denial, conflict detection, conflict resolution, and resulting audit event.

### Workload and Deadline Management

#### User Job

Managers need to balance work by capacity, skill, availability, and deadline pressure.

#### Functional Capabilities

- Workload snapshots by user, role, proposal, and due date.
- Assignment recommendations with rationale.
- Reassignment workflow.
- Deadline dependency graph.
- SLA breach and at-risk prediction.
- Calendar integration and reminders.

#### Acceptance Criteria

- Workload tests prove over-capacity warning and reassignment audit.

## Wave 5: Authoring, AI, Content, Memory

### Goal

Make drafting faster and better while preserving context, traceability, provenance, and human control.

### UX-007 Context-Aware Writing Assistant

#### User Job

Writers need high-quality, context-specific response help grounded in the current requirement, client, opportunity, and Datacraft knowledge.

#### Functional Capabilities

- Requirement-aware content retrieval.
- Datacraft snippet suggestions by section, requirement type, domain, client, geography, and evaluation criteria.
- Placeholder resolution before insertion.
- AI adaptation after deterministic substitution.
- Narrative continuity check against neighboring section text.
- Source/evidence citations and confidence.
- Human accept, reject, edit, regenerate, and explain actions.

#### Backend Work

- Use the same placeholder context resolution path for snippets and templates.
- Record prompt, model, provider, prompt version, retrieval source IDs, substitutions, unresolved placeholders, and output hash.
- Route all AI calls through LiteLLM with budget, fallback, timeout, and provenance capture.

#### UI Work

- Add assistant side panel in document editor.
- Show suggestions grouped by requirement, evidence, past performance, personnel, win theme, and compliance language.
- Show unresolved placeholders before insertion.
- Show AI adaptation diff and source trace.

#### Acceptance Criteria

- Editor browser E2E covers slash shortcut, snippet insertion, placeholder resolution, unresolved placeholder highlight, AI adaptation, accept/reject, and audit/provenance logging.

### UX-014 Snippet Preview With Live Placeholder Resolution

#### User Job

Users need to see exactly how a snippet will read for the current opportunity before insertion.

#### Functional Capabilities

- Preview with resolved client, opportunity, RFP, company, personnel, requirement, document metadata, and explicit override values.
- Highlight unresolved tokens.
- Explain source precedence for each placeholder.
- Prevent silent deletion of unknown slash shortcuts or unresolved content.

#### Acceptance Criteria

- Component and browser tests cover explicit values, context values, unresolved tokens, ambiguous opportunity links, document metadata, company variables, defaults, and unknown slash shortcuts.

### UX-013 Explainability Panels

#### User Job

Users and auditors need to understand how generated or adapted content was produced.

#### Functional Capabilities

- Source list with retrieval reason.
- Placeholder substitution log.
- Prompt and model version.
- AI provider and cost.
- Assumptions and unresolved facts.
- Human edit history after AI generation.

#### Acceptance Criteria

- AI provenance tests prove explainability is stored and visible for generated text and adapted snippets.

### UX-023 Proposal Memory

#### User Job

The platform should learn from prior wins, losses, reviews, evidence usage, and client preferences.

#### Functional Capabilities

- Outcome-linked memory records.
- Reusable language performance metrics.
- Reviewer feedback patterns.
- Evidence strength and reuse history.
- Client preference memory with governance and expiry.
- Safe retrieval policy that avoids leaking restricted content.

#### Acceptance Criteria

- Memory tests prove outcome capture changes future recommendations only through approved, scoped memory records.

### UX-024 Win Theme Builder

#### User Job

Strategists need coherent win themes that connect client needs, RFP evaluation criteria, Datacraft strengths, competitors, and evidence.

#### Functional Capabilities

- Theme workspace with proposed, approved, injected, validated, retired states.
- Requirement mapping.
- Competitor and ghost-theme linkage.
- Section-level theme consistency checks.
- Theme occurrence tracking in final artifacts.

#### Acceptance Criteria

- Theme injection E2E proves approved themes are suggested in relevant sections and flagged when absent from final response.

### Content Library and Knowledge Governance

#### User Job

Content managers need reusable content, templates, personnel data, company data, and past performance to stay approved, fresh, searchable, and safe.

#### Functional Capabilities

- Content lifecycle: draft, review, approved, stale, refresh requested, archived.
- Template version lifecycle and compatibility checks.
- Company master-data approval with effective dates.
- Personnel resume/certification expiry workflow.
- Past performance reference permission and freshness workflow.
- Semantic search index refresh and quality checks.

#### Acceptance Criteria

- Content governance tests cover stale content detection, refresh task creation, approval, snippet insertion, and usage telemetry.

## Wave 6: Approval, Pricing, Production, Submission

### Goal

Make the final mile enforceable: approvals, pricing authority, artifact production, signing, dispatch, receipt, and correction must be complete and auditable.

### UX-012 Inline Approval Cards

#### User Job

Approvers need to approve, reject, request changes, or waive from the context where the decision is made.

#### Functional Capabilities

- Embeddable approval cards for documents, sections, compliance rows, evidence, pricing, reviews, DLP findings, final artifacts, and submissions.
- Authority matrix by role, amount, risk level, domain, and stage.
- Frozen artifact references.
- Signed rationale.
- Delegation and recusal.
- Reopen and rejection cycle.

#### Acceptance Criteria

- Approval E2E covers authority denial, approval, rejection, changes requested, waiver, frozen artifact hash, and audit chain.

### Pricing Workflow

#### User Job

Pricing analysts and executives need cost volumes and final prices to be justified, approved, locked, and aligned to technical commitments.

#### Functional Capabilities

- Pricing package lifecycle: draft, in review, changes requested, approved, locked, reopened, superseded.
- Cost element lifecycle with owner, basis of estimate, rate source, evidence, and approval.
- Threshold-based authority.
- Sensitivity and cost-realism checks.
- Technical/pricing consistency checks.
- Redaction and external-sharing controls.

#### Acceptance Criteria

- Pricing tests cover threshold authority, missing BOE evidence, final lock, reopen, and audit.

### Production Formatting and Rendering

#### User Job

Production leads need final artifacts to satisfy instructions, accessibility, page limits, format rules, and reproducibility.

#### Functional Capabilities

- Render job lifecycle: queued, rendering, validating, failed, completed, approved, superseded.
- Artifact storage in Linode E3 with hash and manifest.
- PDF/DOCX/HTML/Markdown/LaTeX output validation where supported.
- Page limits, fonts, headers/footers, table of contents, bookmarks, alt text, attachments, and file naming checks.
- Error reporting and retry.

#### Acceptance Criteria

- Render proof creates an artifact, stores it in object storage, validates it, records hash, and links it to final submission.

### UX-005 Final Submission Checklist and UX-025 Submission Concierge

#### User Job

Proposal managers need guided final submission that prevents incomplete packages, dispatches through the right channel, captures proof, and supports corrections.

#### Functional Capabilities

- Final checklist:
  - required documents present;
  - attachments selected;
  - artifact hashes captured;
  - compliance matrix locked;
  - evidence blockers resolved;
  - DLP passed or exception approved;
  - pricing locked;
  - approvals complete;
  - signatures complete where required;
  - page/format/accessibility checks passed;
  - delivery channel selected;
  - receipt required and captured.
- Submission package lifecycle: draft, final review, ready, dispatched, receipt pending, submitted, failed, correction requested, corrected, cancelled.
- Dispatch adapters for email, portal/manual upload record, and future API integrations.
- Receipt capture with timestamp, reference, channel, actor, and artifact manifest.
- Correction workflow with superseded artifact tracking and reason.

#### Acceptance Criteria

- Final submission E2E covers checklist failure, checklist pass, dispatch, receipt capture, audit, correction, and final command-center update.

### E-Signature

#### User Job

Executives and legal approvers need to sign version-locked documents and preserve legal audit trails.

#### Functional Capabilities

- Signature request lifecycle: draft, sent, viewed, signed, declined, expired, cancelled, superseded.
- Signer identity, order, consent text, signed artifact hash, callback verification, and audit bundle.
- Provider abstraction with a manual-signature fallback record for environments without provider integration.

#### Acceptance Criteria

- E-signature tests cover request creation, callback verification, expiry, decline, signed artifact hash binding, and final submission gate integration.

## Wave 7: Integrations, Partners, Operations, Reporting

### Goal

Make the platform reliable beyond the core proposal team: CRM, partner portal, imports, webhooks, reporting, incidents, migrations, and operational dashboards.

### UX-017 Partner Contribution Portal

#### User Job

External partners need scoped requests, due dates, uploads, comments, and review status without seeing internal material.

#### Functional Capabilities

- Invitation lifecycle: invited, accepted, expired, revoked.
- Scoped ACL by opportunity, section, evidence request, and document.
- External evidence upload to Linode E3 through server-side route.
- Contribution lifecycle: assigned, in progress, submitted, changes requested, accepted, rejected, expired.
- Partner comments and clarification exchange.
- Internal review queue for partner submissions.

#### Acceptance Criteria

- Portal scoped-access E2E proves partner can see only assigned work, upload evidence, respond to comments, and cannot access internal sections.

### CRM Integration

#### User Job

Capture and CRM users need account, contact, deal, activity, and stage data to support proposal work without duplicate manual updates.

#### Functional Capabilities

- CRM stage events linked to capture stages.
- Account/contact/deal import and reconciliation.
- Activity timeline sync into command center.
- Proposal status updates back to CRM where configured.
- Conflict queue for duplicate or mismatched records.

#### Acceptance Criteria

- CRM integration tests cover import preview, conflict resolution, committed sync, rollback, and command-center event projection.

### Import Governance

#### User Job

Admins need imports to be previewed, validated, executed, audited, and reversible.

#### Functional Capabilities

- Import lifecycle: uploaded, mapped, previewed, validated, approved, executing, committed, rollback requested, rolled back, failed.
- Field mapping templates.
- Duplicate detection.
- Row-level validation and remediation tasks.
- Rollback manifest and proof.
- Destructive rollback approval.

#### Acceptance Criteria

- Import proof covers preview, validation failure, remediation, commit, rollback, and audit reconstruction.

### API and Webhooks

#### User Job

External systems need reliable, authenticated integration points with retries and observability.

#### Functional Capabilities

- API keys or OAuth client credentials with scoped permissions.
- Webhook subscriptions, signing secrets, retry policy, dead-letter queue, replay, and delivery logs.
- Event types for opportunity, RFP intake, requirement, compliance, document, approval, submission, and outcome.
- Rate limits and audit trail.

#### Acceptance Criteria

- Webhook tests cover signature validation, retry, replay, authorization denial, and dead-letter queue projection.

### Operations Control Plane

#### User Job

Operators need to detect, triage, assign, resolve, retry, waive, or escalate failures.

#### Functional Capabilities

- Exception queue for parser, scraper, render, import, notification, webhook, mail, object storage, migration, and workflow failures.
- Incident lifecycle: open, triage, assigned, mitigated, resolved, postmortem, reopened.
- SLA and on-call escalation.
- Failed-job retry and dead-letter controls.
- Service health dashboards.

#### Acceptance Criteria

- Operations proof creates failures in parser, notification, import, and render flows, then verifies queue projection and remediation actions.

### Reporting and Drill-Down Analytics

#### User Job

Leaders need dashboards that create work, not just display metrics.

#### Functional Capabilities

- Pipeline, readiness, source freshness, proposal throughput, review quality, approval latency, compliance gap, evidence strength, AI usage, cost, win/loss, and operational health dashboards.
- Drilldown from metric to underlying work items.
- Scheduled reports through Stalwart email.
- Export with filter metadata.

#### Acceptance Criteria

- Dashboard tests prove drilldown links resolve to filtered records and remediation actions.

### Migration, Backup, Restore, and Data Quality

#### User Job

Platform admins need migration and data repair work to be safe, observable, reversible, and proven.

#### Functional Capabilities

- Migration run lifecycle: planned, dry run, approved, executing, validated, rolled back, failed.
- Pre-migration backup check.
- Restore rehearsal evidence.
- Duplicate repair workflow.
- Search index rebuild workflow.
- Data quality issue queue.

#### Acceptance Criteria

- Backup/restore proof includes backup creation, restore rehearsal against disposable target, validation query, and rollback evidence.

## Wave 8: Strategic Differentiators

### Goal

Add capabilities that make DocFusion more adaptive and extensible after the core workflow system is proven.

### Mobile and Offline

#### Capabilities

- Offline task queue for comments, evidence capture, approvals, and field notes.
- Offline action batch lifecycle with explicit state model.
- Conflict reconciliation on sync.
- Mobile-friendly command center, inbox, and partner portal.

#### Acceptance Criteria

- Offline tests cover queue, sync, conflict, rejection, and audit.

### Finance and Revenue Workflows

#### Capabilities

- Proposal investment tracking.
- Bid budget approval.
- ROI and cost-of-capture analytics.
- Payment/revenue event tracking after award.
- Finance approvals for high-value or high-risk bids.

#### Acceptance Criteria

- Finance workflow proof links capture investment, pricing, outcome, and revenue event.

### Rule Packs and Domain Packs

#### Capabilities

- Reusable workflow, checklist, compliance, content, and scoring packs by client type, geography, sector, and procurement regime.
- Versioning, simulation, publication, and rollback.
- Impact analysis for existing opportunities.

#### Acceptance Criteria

- Rule-pack tests cover install, simulate, publish, apply to new opportunity, deprecate, and rollback.

### Advanced Simulation

#### Capabilities

- Simulate opportunity pursuit timelines.
- Simulate workflow template impact.
- Simulate staffing and deadline scenarios.
- Simulate compliance/readiness risk under alternative plans.

#### Acceptance Criteria

- Simulation proof produces a recommendation without mutating live workflow state.

## Cross-Cutting Architecture Requirements

### Auth and Authorization

- All new API routes must use the canonical actor/session resolution path.
- Organization and resource scope checks are mandatory.
- Authority checks must be server-side for approvals, waivers, pricing, submission, DLP exceptions, destructive imports, workflow publication, and correction.
- UI visibility is convenience, not security.
- Tests must include same-org allowed, cross-org denied, insufficient-role denied, and missing-auth denied cases.

### Workflow Runtime

- Every workflow-backed capability must declare:
  - subject type;
  - owning domain;
  - states;
  - transitions;
  - allowed actors;
  - guards;
  - SLA policy;
  - notification policy;
  - audit events;
  - portal visibility;
  - reversal, retry, cancellation, and compensation behavior.
- Subjects without explicit domain state models must remain audit-only until their state model is made explicit.

### Notifications

- Use Stalwart email for mail delivery.
- Every actionable notification needs:
  - recipient;
  - channel;
  - priority;
  - subject/workflow link;
  - acknowledgement requirement;
  - quiet-hours behavior;
  - fallback/escalation behavior;
  - delivery and failure audit.
- Notification center and inbox must reflect the same underlying notification/work-item state.

### Object Storage

- RFPs, uploaded evidence, partner uploads, rendered artifacts, signed artifacts, and final submission packages must be stored through server-side Linode E3 paths.
- Browser clients must not depend on CORS access to Linode E3.
- Stored objects must record bucket, key, hash, byte size, content type, actor, source, timestamp, and retention policy.
- Every mutating proof run must clean up disposable objects or document retention reason.

### AI Governance

- All provider calls must route through the configured LiteLLM path.
- AI records must include provider, model, prompt version, input references, retrieval sources, deterministic substitutions, unresolved placeholders, output hash, cost, latency, human decision, and downstream artifact links.
- AI output cannot bypass human approval for final proposal content, evidence claims, compliance waivers, pricing, DLP exceptions, or submissions.

### Data and Schema Governance

- Avoid duplicate schema concepts for requirements, compliance, workflow state, tasks, and audit.
- Add generated type/schema parity checks where Python and TypeScript share contracts.
- Every migration needs deployed validation and rollback evidence.
- Every new table needs owner, retention policy, and audit strategy.

### Accessibility and Usability

- Every core workflow action must be keyboard accessible.
- Disabled actions must explain why they are disabled.
- Critical state must not rely on color alone.
- Tables must support filtering, sorting, pagination, empty states, and error recovery.
- Forms must preserve user input after validation failures.
- Long-running jobs must show progress, retry, and failure details.

## Detailed Capability Matrix

| Capability | Primary JTBD / UX | First implementation surface | Required workflow state | Proof target |
|---|---|---|---|---|
| Opportunity Command Center | UX-001, JTBD-002, JTBD-006, JTBD-063 | `/opportunities/[id]/command-center` | Opportunity projection and lifecycle events | Command-center browser proof |
| RFP Intake Wizard | UX-002, JTBD-004, JTBD-011, JTBD-012 | Opportunity detail and command center | RFP intake/parse workflow | Discovery-to-parse browser proof |
| Next Best Action Queue | UX-003, UX-011, JTBD-020, JTBD-051, JTBD-072 | Inbox/homepage | Work-item projection | Inbox E2E plus DB proof |
| Response Readiness Score | UX-004, JTBD-016, JTBD-070 | Command center and final checklist | Readiness snapshot workflow | Readiness blocked/pass tests |
| Final Submission Checklist | UX-005, UX-025, JTBD-049 | Submission concierge | Submission package workflow | Final submission E2E |
| Smart Blocker Dashboard | UX-006, JTBD-063, JTBD-064 | Operations and command center | Blocker projection | Blocker projection tests |
| Context-Aware Writing Assistant | UX-007, JTBD-023, JTBD-031, JTBD-054 | Document editor | AI draft/adaptation workflow | Editor browser E2E |
| Proposal Timeline | UX-008, JTBD-010, JTBD-060 | Command center timeline | Audit/workflow event projection | Timeline data-source test |
| Remediation Actions | UX-009, JTBD-075 | Workflow action panel | Subject action registry | Action-panel E2E |
| Role-Based Homepages | UX-010 | `/home` or dashboard routing | Persona work projection | Role-based browser tests |
| Inline Approval Cards | UX-012, JTBD-027, JTBD-037 | Documents, compliance, pricing, final checklist | Approval workflow | Approval E2E |
| Explainability Panels | UX-013, JTBD-056, JTBD-069 | Editor and AI governance | AI provenance workflow | AI provenance tests |
| Snippet Preview | UX-014, JTBD-031, JTBD-032 | Content insert dialog/editor | Placeholder resolution workflow | Snippet browser E2E |
| Section Health | UX-015, JTBD-022, JTBD-025 | Document outline and command center | Section workflow | Section health E2E |
| Traceability | UX-016, JTBD-013, JTBD-015 | Requirements, compliance, document, artifact | Requirement-to-artifact trace | Traceability proof |
| Partner Portal | UX-017, JTBD-043, JTBD-044 | External portal | Partner contribution workflow | Portal scoped-access E2E |
| Clarification Tracker | UX-018, JTBD-018 | Clarifications workspace | Clarification workflow | Clarification lifecycle test |
| Comment Resolution | UX-019, JTBD-026 | Comments panel and inbox | Comment task workflow | Comment-to-task E2E |
| Workflow Template Studio | UX-020, JTBD-057, JTBD-073 | Workflow templates admin | Template governance workflow | Template governance proof |
| Audit Explorer | UX-021, JTBD-060 | Audit explorer | Audit reconstruction | Run reconstruction proof |
| Safe Sandbox | UX-022 | Admin/testing surfaces | Sandbox namespace workflow | Sandbox cleanup proof |
| Proposal Memory | UX-023, JTBD-041, JTBD-056 | AI governance/outcomes | Memory approval workflow | Memory/outcome tests |
| Win Theme Builder | UX-024, JTBD-038, JTBD-039 | Strategy/editor | Win theme workflow | Theme injection E2E |
| Pricing Governance | JTBD-036, JTBD-037 | Pricing workspace | Pricing approval workflow | Pricing package proof |
| Production Render | JTBD-047, JTBD-048 | Production workspace | Render artifact workflow | Render artifact proof |
| E-Signature | JTBD-050 | Submission concierge | Signature request workflow | Signature lifecycle proof |
| CRM Integration | JTBD-042 | CRM workspace and command center | Integration sync workflow | CRM sync proof |
| Import Governance | JTBD-053, JTBD-061, JTBD-074 | Import wizard/admin | Import job workflow | Import rollback proof |
| Operations Control Plane | JTBD-064, JTBD-072 | Operations dashboard | Incident/exception workflow | Ops exception proof |
| Reporting Analytics | JTBD-063 | Analytics/dashboard | Report drilldown workflow | Dashboard drilldown proof |
| Mobile/Offline | JTBD-067 | Mobile/offline surfaces | Offline action batch workflow | Offline sync proof |
| Finance | JTBD-068 | Finance workflow | Revenue/payment workflow | Finance workflow proof |
| Rule Packs | JTBD-066, JTBD-073 | Rule/domain-pack studio | Rule-pack governance workflow | Rule-pack proof |

## Sequenced Backlog

### P0: Must Land Before Claiming Full Happy Path

1. Build Wave 0 proof harness and fixture cleanup.
2. Implement command-center projection.
3. Implement unified work-item projection and inbox.
4. Complete guided RFP intake wizard with server-side Linode E3 object lifecycle.
5. Prove RFP processing reads from Linode E3.
6. Implement parser failure remediation and source provenance.
7. Implement compliance matrix final lock and waiver authority.
8. Implement readiness score with hard final-gate blockers.
9. Implement evidence and claim remediation blockers.
10. Implement final submission checklist and submission concierge.
11. Implement production render artifact storage and validation.
12. Implement approval authority checks and inline approval cards.
13. Implement Stalwart notification acknowledgement and escalation.
14. Implement audit explorer reconstruction for final submitted package.
15. Run authenticated browser proof for discovery to receipt.

### P1: Complete Workflow Coverage and Collaboration

1. Partner portal with scoped access and contribution review.
2. Clarification tracker with addendum impact analysis.
3. Comment-to-task workflow.
4. Section health workflow and document outline integration.
5. Proposal plan baseline and rebaseline.
6. Workload balancing and deadline graph.
7. CRM stage and activity integration.
8. Import governance UI with rollback proof.
9. Operations exception adapters for render, import, notification, scraper, parser, and webhooks.
10. Workflow template studio simulation and publication governance.
11. Report drilldowns that create work items.

### P2: Strategic Product Capability

1. Proposal memory based on outcomes, feedback, and approved reuse.
2. Win theme builder with section injection validation.
3. Advanced rule packs and domain packs.
4. Mobile/offline action batch sync.
5. Finance and capture investment workflows.
6. Advanced simulation for staffing, timelines, workflow templates, and readiness risk.
7. Expanded API/webhook ecosystem.

## Verification Strategy

### Required Test Layers

- Unit tests for state transitions, scoring rules, placeholder resolution, authority checks, and pure policy logic.
- Server action/API tests for auth, authorization, invalid transitions, audit side effects, task projection, and notification side effects.
- Integration tests for database state, object storage, Stalwart email, LiteLLM calls, and workflow runtime.
- Browser tests for command center, inbox, intake wizard, editor insertion, action panel, approval cards, final checklist, partner portal, and audit explorer.
- Live-safe smoke tests against `db.lindela.io`, Linode E3, Stalwart, and LiteLLM using disposable fixtures.
- Migration tests for forward migration, deployed validation, rollback plan, and data parity.

### Golden Path Proof

The main golden path must prove:

1. Source discovery identifies an opportunity.
2. Proposal manager selects or promotes it.
3. RFP is downloaded or uploaded server-side into Linode E3.
4. Stored object receipt is persisted.
5. Parser reads bytes from Linode E3.
6. Requirements are extracted and reviewed.
7. Compliance matrix is generated and governed.
8. Proposal plan and section tasks are created.
9. Datacraft snippets are inserted with placeholder resolution.
10. AI adaptation runs through LiteLLM and records provenance.
11. Evidence and claim gates pass or are resolved.
12. Review and approval workflow completes with authority checks.
13. Pricing and production gates pass where applicable.
14. Final artifact is rendered, stored, hashed, and validated.
15. Final submission checklist passes.
16. Dispatch occurs through a configured channel or manual dispatch record.
17. Receipt is captured.
18. Audit explorer reconstructs the full decision and artifact chain.
19. Notifications, tasks, blockers, and command center all reflect final state.
20. Disposable proof data and E3 objects are cleaned up or retained with documented audit reason.

### Facility-Ledger Requirements

- Every proof run writes run ID, actor, environment, branch, commit SHA, fixture IDs, object keys, artifact hashes, and cleanup result.
- Every blocked proof row records the blocking reason and owner.
- Every failed proof row records failure step, logs/artifacts, and remediation task.
- No expanded capability can reuse an old proof row unless behavior and proof obligations are unchanged.

## Delivery Rules

- Keep implementation slices small enough to review.
- Do not promote status labels without proof.
- Do not add new abstractions where existing workflow/runtime/task/audit primitives fit.
- Do not bypass server-side authz in favor of UI hiding.
- Do not use mock-only proof for live claims.
- Do not introduce direct browser object-storage paths for Linode E3.
- Do not introduce direct LLM provider calls outside LiteLLM routing.
- Do not send mail through non-Stalwart paths unless explicitly configured as a fallback.
- Do not claim compensation semantics for a subject until its domain state model is explicit.

## Definition of Platform Complete

The platform can be considered fully implemented for the documented JTBD and enhancements when:

- All P0 rows in `docs/jtbd-implementation-ledger.md` and `docs/enhancements.md` have implementation and facility proof.
- All P1 rows are either live or have explicit product deferral with a tested non-workflow rationale.
- Strategic P2 rows have either implemented foundations or a documented phase gate.
- The golden path passes in authenticated browser and API proof.
- Live-safe infrastructure smoke tests pass for `db.lindela.io`, Linode E3, Stalwart, and LiteLLM.
- Audit explorer can reconstruct every major decision and artifact in the golden path.
- Operations dashboard shows no unowned exceptions, stuck workflows, failed notifications, or stale proof fixtures.
- Backup/restore and migration validation evidence exists.
- Documentation reflects actual behavior and no longer describes outdated Postfix, Azure, local-only storage, mock parser, or direct provider assumptions as current defaults.

