# Full JTBD And Enhancements Implementation Plan

Status: Consensus draft v1  
Created: 2026-05-05T08:35:07Z  
Scope: Implement and surface all pending JTBD from `docs/platform-jtbd-catalogue.md` plus all usability enhancements from `docs/enhancements.md`.

## Requirements Summary

DocFusion currently has substantial domain coverage, but not all jobs are fully implemented as end-to-end, workflow-backed user capabilities. The target state is that every non-strategic JTBD has:

- a canonical domain subject;
- explicit state model and transitions;
- server-side permission and authority checks;
- task projection where human work is required;
- SLA, escalation, and notification semantics;
- audit events with actor, reason, before/after, evidence, and correlation IDs;
- relevant user screens with next actions, blockers, history, and status;
- integration, browser, and live-safe proof where the job touches infrastructure;
- facility-ledger disposition updated from `blocked`/`partial` to `pass`.

Strategic JTBD are included as later implementation waves rather than silently excluded. They must either ship as governed workflows or remain explicitly marked strategic with a documented non-shipping decision.

## Current-State Baseline

- `docs/platform-jtbd-catalogue.md` has 75 JTBD: 7 `Live`, 61 `Partial`, 3 `Planned`, 1 `Planned/Partial`, 2 `Strategic`, and 1 `Strategic/Planned`.
- `docs/enhancements.md` has 25 UX enhancements, with five recommended first: Opportunity Command Center, Next Best Action Queue, Context-Aware Writing Assistant, Response Readiness Score, and Final Submission Checklist.
- `.omx/state/platform-e2e-facility-ledger.md` already proves selected rows but still marks broad product lanes `blocked`.
- Frontend routes exist for most domains, but many are screen-level surfaces rather than complete workflow-backed JTBD.
- Workflow runtime, templates, audit rows, notification queue, SLA evaluation, operations/portal/dashboard surfaces, and Stalwart dispatch exist, but adoption is uneven across domain actions.

## RALPLAN-DR Summary

### Principles

1. **Job completion beats screen completion**: a JTBD is not complete until the underlying workflow, permissions, audit, tasks, notifications, and recovery paths are implemented.
2. **One command center, many domain modules**: users need unified orchestration while domains keep clear ownership boundaries.
3. **Evidence before status upgrades**: catalogue and facility-ledger status changes require fresh proof, not code inspection alone.
4. **Canonical runtime first**: every remaining domain should adopt the same workflow/task/audit/notification primitives unless a domain-specific exception is documented.
5. **Live-safe by construction**: mutating proof uses disposable fixtures, run IDs, cleanup audits, and no irreversible production side effects.

### Decision Drivers

1. **Proposal lifecycle continuity**: RFP discovery through dispatch must feel like one guided path.
2. **Governed risk control**: compliance, approvals, pricing, DLP, and submission need hard gates and audit evidence.
3. **Operator confidence**: background jobs, failed integrations, migrations, notifications, and live infrastructure need observable recovery paths.

### Viable Options

| Option | Description | Pros | Cons |
|---|---|---|---|
| A. Screen-first completion | Build missing pages and improve navigation before deep workflow hardening. | Fast visible improvement; easier demos. | Overclaims completion; leaves hidden state, audit, authz, and reversal gaps. |
| B. Runtime-first completion | Convert each pending JTBD into workflow-backed domain state first, then surface screens. | Strong correctness and audit foundation. | Slower visible UX; users may still feel fragmented until command-center work lands. |
| C. Journey-slice completion | Implement full vertical slices by user journey, pairing workflow hardening with the necessary screens. | Balances visible usability and correctness; each tranche can be proven end-to-end. | Requires careful sequencing and cross-domain coordination. |

Favored option: **C. Journey-slice completion**. It keeps each release useful while preserving the workflow/audit standard.

### Pre-Mortem

1. **Failure scenario: pages ship but jobs remain incomplete.**  
   Mitigation: every tranche has facility-ledger rows, workflow DoD, and browser/live proof before status upgrades.

2. **Failure scenario: runtime abstractions become too generic and slow delivery.**  
   Mitigation: define a small workflow adapter contract, then implement concrete domain handlers per journey; avoid speculative runtime redesign.

3. **Failure scenario: live proof leaves residue or damages shared data.**  
   Mitigation: use run-scoped fixture namespaces, disposable data, cleanup audits, and downgrade rows to blocked if cleanup cannot be proven.

## Decision

Implement the remaining platform work as **eight vertical completion waves** plus a cross-cutting verification and governance program.

The waves are ordered by proposal lifecycle dependency:

1. Control plane and UX shell.
2. Discovery to RFP intake.
3. Requirements and compliance governance.
4. Proposal planning, tasks, and workload.
5. Authoring, content, evidence, AI assistance, and traceability.
6. Review, approval, pricing, production, and submission.
7. CRM, partners, imports, integrations, reporting, and operations.
8. Strategic expansion: mobile/offline, payments/revenue, rule packs, and ecosystem workflows.

## Target Product Shape

The finished platform should expose four primary work surfaces:

1. **Opportunity Command Center**  
   One page per opportunity/RFP with lifecycle status, readiness score, next actions, blockers, tasks, documents, compliance, reviews, pricing, dispatch, and audit timeline.

2. **Operational Inbox / Next Best Action Queue**  
   A role-aware queue combining tasks, approvals, comments, notifications, SLA breaches, exceptions, portal requests, and remediation actions.

3. **Domain Workspaces**  
   Existing screens remain, but each domain page becomes a specialized workspace with workflow actions, state history, blockers, and audit evidence.

4. **Operator Control Plane**  
   Workflow operations, audit explorer, notification delivery, integration health, migration/backup validation, DLP findings, and exception remediation.

## Completion Definition

A JTBD can be marked `Live` only when all applicable items are true:

- Domain subject and state model are explicit.
- Server action/API owns state mutation.
- Strict authz and authority checks exist.
- Human work projects to tasks or queue items.
- SLA and escalation policy exists for non-instant work.
- Notifications are actionable or explicitly not applicable.
- Portal visibility is defined for external actors.
- Audit records include actor, reason, before/after, subject, evidence, correlation ID, and timestamp.
- Reopen/cancel/retry/reversal semantics exist or are explicitly audit-only with rationale.
- The relevant UI screen exposes current state, next actions, blockers, owner, due date, and history.
- Tests cover happy path, invalid transition, authority denial, blocked gate, and reversal/retry where applicable.
- Facility ledger has a passing row with cleanup proof for mutating flows.

## Exhaustive JTBD Coverage Matrix

This matrix is intentionally comprehensive. Existing `Live` entries are still included because they may need stronger workflow projection, command-center surfacing, or facility-ledger proof before the platform can claim full end-to-end completion.

Each row has exactly one **primary owning wave**. When a cell contains `A/B`, the first value is the primary owning wave and the later value is a dependency or follow-on verification wave. Wave sections below use explicit JTBD lists instead of broad ranges so execution agents do not accidentally claim ownership conflicts.

| JTBD | Current support | Wave | Primary surface | Workflow / capability target | Proof target |
|---|---|---:|---|---|---|
| JTBD-001 | Partial | 2 | Opportunity sources / operations | Scraper source run workflow with schedule, retry, cancel, health, dedupe, freshness SLA, source disable governance. | F-002, O-009 |
| JTBD-002 | Live | 2 | Opportunities / command center | Search, filter, saved search, shortlist, and triage task projection. | F-001 |
| JTBD-003 | Partial | 2 | Inbox / notifications / digest settings | Daily digest workflow with preference policy, empty-digest policy, delivery audit, and retry. | F-002, O-006 |
| JTBD-004 | Partial | 2 | Opportunity detail / RFP intake wizard | Discovery document to RFP ingest bridge with E3 storage, provenance, parse kickoff, idempotency. | F-005B, F-007 |
| JTBD-005 | Partial | 2 | Opportunity analysis panel | Opportunity qualification analysis with evidence, confidence, human override, and periodic re-analysis. | F-003, F-004A |
| JTBD-006 | Live | 2 | Pipeline / command center | Governed stage transitions with required artifacts, permission checks, notifications, reversal. | F-003 |
| JTBD-007 | Partial | 6 | Bid/no-bid package / gate cards | Bid decision workflow with PWin package, role authority, score lock, executive rationale, no-bid reversal. | F-003, F-014B |
| JTBD-008 | Partial | 6 | Gate review panel / inline approval cards | Gate workflow with checklist, quorum, votes, conditions, package snapshot, immutable audit. | F-014B |
| JTBD-009 | Live | 2/7 | Capture activity timeline | Capture activities emit CRM timeline updates, PWin factor updates, and next-step tasks. Primary ownership is Wave 2 for capture activity and pipeline effects; Wave 7 validates full CRM timeline projection. | F-003, F-015 |
| JTBD-010 | Partial | 2/7 | Calendar / command center timeline | Deadline workflow with acceptance, dependency graph, reminders, calendar sync, breach audit. Primary ownership is Wave 2 for deadline acceptance and calendar projection; Wave 7 revalidates scheduled-worker expansion. | F-003, O-005 |
| JTBD-011 | Partial | 2 | RFP intake wizard | Upload/fetch, E3 receipt, scan, parse start, status, failed-parse recovery, notifications. | F-005, F-006 |
| JTBD-012 | Partial | 2 | Parse review / source document viewer | Parser selection, confidence gate, human correction, versioned artifacts, real-file validation. | F-006B, F-007 |
| JTBD-013 | Partial | 2 | Requirements workspace | Extract, accept, edit, reject, reopen, flag ambiguity, source trace, clarification tasks. | F-007 |
| JTBD-014 | Partial | 2/4 | Requirements detail / inbox | Assign owner, section, due date, priority, compliance status, task projection, SLA. Primary ownership is Wave 2 for requirement assignment; Wave 4 validates proposal-wide task projection. | F-007, F-009 |
| JTBD-015 | Partial | 3 | Compliance matrix | Matrix lifecycle, row lifecycle, final lock, waiver authority, gap tasks, export approval. | F-008 |
| JTBD-016 | Partial | 3/6 | Compliance validator / readiness score | Content validation, severity policy, document-level blocking, gap remediation. Primary ownership is Wave 3 for compliance validation; Wave 6 validates production-format enforcement. | F-008, F-020 |
| JTBD-017 | Partial | 3 | Compliance report / audit explorer | Snapshot workflow, report approval, artifact retention, immutable audit package. | O-015B |
| JTBD-018 | Planned | 3 | Clarification tracker | Draft, approve, send, answer ingest, impact analysis, requirement and response update tasks. | F-007, F-008 |
| JTBD-019 | Partial | 4 | Proposal plan / command center | Baseline plan workflow with volumes, sections, schedule, dependencies, staffing, rebaseline. | F-009 |
| JTBD-020 | Partial | 4 | Operational inbox / tasks | Full task lifecycle with block, progress, logs, comments, completion evidence, reopen. | F-009 |
| JTBD-021 | Partial | 4 | Workload dashboard / assignment dialog | Skill/capacity matching, availability, rebalance recommendations, accept/reject rationale. | F-009 |
| JTBD-022 | Live | 5 | Document editor / section health | Editor events drive section workflow, autosave status, readiness, review handoff. | F-011 |
| JTBD-023 | Partial | 5 | Context-aware writing assistant | AI draft workflow with context contract, provenance, human accept/reject, cost tracking. | F-011, O-013 |
| JTBD-024 | Partial | 5/6 | Quality improvement panel | Suggestion lifecycle with before/after diff, accept/reject, reviewer routing, trend metrics. Primary ownership is Wave 5 for suggestion lifecycle; Wave 6 validates reviewer gate routing. | F-011, F-014B |
| JTBD-025 | Partial | 4/5 | Document editor / collaboration panel | Session lifecycle, operation audit, section locks, conflict workflow, offline reconciliation hooks. Primary ownership is Wave 4 for collaboration work projection; Wave 5 validates persisted editor state. | F-011, O-003A |
| JTBD-026 | Live | 4 | Comments panel / inbox | Comment-to-task projection with severity, owner, due date, proof, reopen. | F-014A |
| JTBD-027 | Partial | 6 | Inline approval cards / document approval | Section/document approval workflow with version lock, deadlines, rejection cycle, hash. | F-014B, F-020 |
| JTBD-028 | Live | 6 | Reviews workspace | Color-team package freeze, findings closure, scores, recommendations, export package. | F-014B |
| JTBD-029 | Partial | 3 | Evidence library / writing assistant | Evidence approval, claim/requirement/section binding, expiration, reuse governance. | F-018A |
| JTBD-030 | Partial | 3 | Claim remediation panel / inbox | Unsupported claim workflow: evidence, rewrite, waive, remove, or block section readiness. | F-018A, O-016A |
| JTBD-031 | Partial | 5 | Content library | Snippet/template/content governance, freshness, approval, usage analytics, refresh tasks. | F-013 |
| JTBD-032 | Live | 5 | Templates / template studio | Template lifecycle tied to workflow governance, placeholders, previews, publication, deprecation. | O-004B, F-013 |
| JTBD-033 | Partial | 5 | Company workspace | Company profile, services, clients, variables, roles, CV data with approval and reuse trace. | F-017, F-013 |
| JTBD-034 | Partial | 5 | Personnel workspace | Personnel/certification/resume/staffing workflows with expiration, match rationale, reuse trace. | F-017 |
| JTBD-035 | Partial | 5 | Past performance workspace | Project/reference relevance scoring, narrative generation, validation, insertion traceability. | F-017 |
| JTBD-036 | Partial | 6 | Pricing workspace | Cost volume, labor mix, BOE, rates, cost realism, technical alignment, package state. | F-018C |
| JTBD-037 | Partial | 6 | Pricing approval cards | Rate/cost/final price authority, approval rationale, sensitivity lock, reopen. | F-018C, F-021B |
| JTBD-038 | Partial | 5 | Competitive intelligence | Competitor profiles, battle cards, ghost themes, opportunity-specific sourced analysis. | F-018B |
| JTBD-039 | Partial | 5 | Win theme builder | Theme workspace, injection suggestions, occurrence tracking, consistency validation. | F-018B, F-011 |
| JTBD-040 | Partial | 2 | Pipeline analytics / command center | PWin factors, history, explainability, portfolio forecast, decision linkage. | F-004A |
| JTBD-041 | Partial | 7 | Outcomes / lessons dashboard | Outcome/debrief workflow, lessons, ROI, model/strategy handoff, future reuse. | F-022 |
| JTBD-042 | Partial | 7 | CRM workspace | Accounts, contacts, deals, activities, documents, imports, research, capture handoff. | F-015 |
| JTBD-043 | Partial | 7 | Partners workspace | Partner records, communications, assignments, teaming participation, contribution status. | F-016 |
| JTBD-044 | Planned | 7 | Partner portal | Scoped external contribution, evidence upload, internal review, reject/resubmit, audit. | F-016 |
| JTBD-045 | Partial | 6 | Presentations workspace | Slides, notes, Q&A, practice evidence, timing compliance, review/approval. | F-018C, F-020 |
| JTBD-046 | Partial | 6 | Graphics workspace / document insert | Graphic request, generation/edit, approval, caption/accessibility, reuse, insertion trace. | F-018C, F-020 |
| JTBD-047 | Partial | 6 | Production formatting / final checklist | Format templates, headers, TOC, page limits, accessibility, validation issue workflow. | F-020 |
| JTBD-048 | Partial | 6 | Render/export surface | Render job state, real artifacts, hashes, caching, error reporting, protected downloads. | F-020 |
| JTBD-049 | Partial | 6 | Final submission checklist / concierge | Pre-submit audit, locks, approvals, signatures, dispatch, receipt, correction path. | F-021B |
| JTBD-050 | Planned | 6 | E-signature workflow | Signer identity, order, version hash, consent, provider callback, rejection/expiry. | F-021B |
| JTBD-051 | Partial | 1 | Notification center / inbox | Preferences, quiet hours, acknowledgement, fallback channels, delivery dashboard, remediation. | O-006B |
| JTBD-052 | Partial | 2/7 | Calendar | Accepted deadlines to calendar events, reminders, changed-date propagation, sync status. Primary ownership is Wave 2 for deadline/calendar behavior; Wave 7 revalidates worker scheduling expansion. | O-005, F-003 |
| JTBD-053 | Partial | 7 | Import wizard | Parse, preview, validate, duplicate/conflict review, approve, commit, rollback, lineage. | F-019 |
| JTBD-054 | Partial | 5 | Search/RAG / writing assistant | Index workflow, embeddings, ACL filtering, stale repair, quality metrics. | O-014A, F-013 |
| JTBD-055 | Partial | 5 | Agent/task orchestration panel | Agent tasks, capability matching, tool permissions, human review, failure handling, cost. | O-013 |
| JTBD-056 | Partial | 5 | AI governance / memory settings | Persistent memory, TTL, classification, consent, purge audit, retrieval-quality metrics. | O-013 |
| JTBD-057 | Partial | 1 | Workflow template studio | Visual authoring, simulation, versioning, approval routing, publication, rollback/migration. | O-004B |
| JTBD-058 | Partial | 1/7 | Workflow runtime / operations | Event bus, idempotency, pause/resume, every-domain runtime adoption, monitoring. Primary ownership is Wave 1 for shared runtime/action semantics; Wave 7 revalidates scheduled-worker expansion. | O-003A, O-005 |
| JTBD-059 | Partial | 1 | Settings / all APIs | Uniform RBAC/ABAC, section access, delegated authority, fail-closed route/action checks. | O-001, O-002 |
| JTBD-060 | Partial | 1 | Audit explorer | Universal transition and mutation audit, hash/correlation, report/export packaging. | O-015A |
| JTBD-061 | Planned/Partial | 7 | Integrations settings | Connector auth, mapping, sync state, conflicts, retries, webhooks, audit. | F-019, O-014B |
| JTBD-062 | Partial | 7 | API/webhook admin | Idempotency keys, async job status, scopes, error taxonomy, rate limits, audit. | O-010, O-014B |
| JTBD-063 | Partial | 7 | Analytics / command center / operations | Drill-down dashboards that create or deep-link to work, scheduled report delivery. Wave 1 supplies the shared dashboard shell and command-center projection; Wave 7 owns full reporting/dashboard completion. | F-004B, O-015C |
| JTBD-064 | Partial | 7 | Operations control plane | Health, deploy approval, backup/restore, migration gate, incident workflow, runbooks. | O-010, O-011, O-012B |
| JTBD-065 | Partial | 2/7 | Data quality / operations | Schema drift, stale data, duplicates, scraper/source quality, suppression/waiver, trends. Primary ownership is Wave 2 for source/data quality; Wave 7 revalidates exception remediation expansion. | F-002, O-008 |
| JTBD-066 | Strategic | 8 | Rule/domain-pack studio | Domain/rule pack authoring, inheritance, versioning, simulation, tenant boundaries. | X-003 |
| JTBD-067 | Strategic/Planned | 8 | Mobile/offline surface | Offline queue, cached reviews/comments/approvals, sync conflict workflow, push actions. | X-001 |
| JTBD-068 | Strategic | 8 | Finance workflow | Milestone payment/invoice/revenue workflows, gateway callbacks, reconciliation, audit. | X-002 |
| JTBD-069 | Partial | 5 | AI governance | Provider health, fallback policy, prompt versions, eval gates, budgets, rollback. | O-013 |
| JTBD-070 | Partial | 3/6 | Readiness score / production checklist | Accessibility/readability/format checks, remediation, waiver approval, final evidence. Primary ownership is Wave 3 for quality/DLP policy; Wave 6 proves final production enforcement. | O-016A, F-020, O-016B |
| JTBD-071 | Partial | 3 | Privacy/DLP / export gate | Classification, DLP findings, redaction, retention, legal hold, export/delete workflow. | O-016A |
| JTBD-072 | Partial | 1/7 | Operations inbox | Failed jobs, blocked workflows, import/render/connector exceptions, assign/escalate/waive. Primary ownership is Wave 1 for shared exception handling; Wave 7 adds adapters. | O-008, O-010 |
| JTBD-073 | Partial | 1/8 | Rules/configuration studio | Governed config publishing for rules, checklists, templates, sources, thresholds. Primary ownership is Wave 1 for workflow/config governance; Wave 8 expands rule packs. | O-004B, X-003 |
| JTBD-074 | Partial | 7 | Migration/remediation console | Precheck, dry run, backup, apply, validate, rollback/repair, sign-off evidence. | O-011, O-012B |
| JTBD-075 | Partial | 1/6 | Workflow action panel / audit explorer | Reopen, reverse, cancel, rerun with reason, compensation, audit-only semantics where needed. | O-003A, O-003B |

## Exhaustive Enhancement Coverage Matrix

Each enhancement row also has exactly one primary owning wave. When a cell contains `A/B`, the first value is the primary owning wave and later values are dependency, enforcement, or extension waves. Wave sections may mention dependency enhancements only when they are extending a shared capability owned elsewhere.

| Enhancement | Priority | Wave | Target surface | Implementation target | Proof target |
|---|---:|---:|---|---|---|
| UX-001 Opportunity Command Center | P0 | 1 | Opportunity detail / command center | Consolidated lifecycle, blockers, next actions, readiness, tasks, docs, reviews, dispatch. | Command-center browser E2E |
| UX-002 Guided RFP Intake Wizard | P0 | 2 | RFP intake wizard | Guided upload/fetch/source-link/E3/parse/requirements flow with failure remediation. | Discovery-to-parse E2E |
| UX-003 Next Best Action Queue | P0 | 1/4 | Inbox / tasks | Role-aware work item projection across tasks, approvals, comments, notifications, exceptions. | Inbox E2E + DB proof |
| UX-004 Response Readiness Score | P0 | 3/6 | Command center / final checklist | Explainable score across compliance, evidence, placeholders, approvals, DLP, format, dispatch. | Readiness blocked/pass tests |
| UX-005 Final Submission Checklist | P0 | 6 | Submission concierge | Hard gate for documents, signatures, compliance, DLP, approvals, artifact hashes, receipt. | Final submission E2E |
| UX-006 Smart Blocker Dashboard | P0 | 1/3 | Command center / operations | Normalized blockers with owners, severity, due dates, links, escalation, closure audit. | Blocker projection tests |
| UX-007 Context-Aware Writing Assistant | P0 | 5 | Document editor | Requirement-aware snippets, Datacraft context, evidence, personnel, past performance, themes. | Editor browser E2E |
| UX-008 End-to-End Proposal Timeline | P1 | 2 | Command center timeline | Lifecycle event projection from discovery to outcome. | Timeline data-source test |
| UX-009 One-Click Remediation Actions | P1 | 1/2/3/7 | Action panels | Retry/assign/waive/reopen/escalate/regenerate actions with authz and audit. | Action-panel E2E |
| UX-010 Role-Based Homepages | P1 | 1/7 | Home/dashboard | Persona-scoped landing pages for managers, writers, reviewers, approvers, partners, admins, operators. | Role-based browser tests |
| UX-011 Operational Inbox | P1 | 1/4 | Inbox | Unified actionable queue with acknowledgement, preferences, quiet hours, escalation, bulk actions. | Inbox integration/E2E |
| UX-012 Inline Approval Cards | P1 | 6 | Documents/compliance/pricing/reviews/submission | Embeddable approval/reject/request-change/waive cards with authority and rationale. | Approval E2E |
| UX-013 Explainability Panels | P1 | 5 | Editor / AI governance | AI provenance, sources, substitutions, prompt/model, evidence, assumptions, edits. | AI provenance tests |
| UX-014 Snippet Preview With Live Placeholder Resolution | P1 | 5 | Content insert dialog / editor | Preview resolved client/opportunity/RFP context and unresolved token highlighting. | Snippet browser E2E |
| UX-015 Proposal Section Health Indicators | P1 | 4/5/6 | Document outline / command center | Section state: drafted, evidenced, compliant, reviewed, approved, export-ready. | Section health E2E |
| UX-016 Requirement-to-Response Traceability | P1 | 3/5 | Requirements / document / final artifact | Bidirectional links among requirement, section, evidence, review, approval, artifact. | Traceability proof |
| UX-017 Partner Contribution Portal | P1 | 7 | Portal / partners | Invitation, scoped access, external task, evidence upload, contribution review. | Portal scoped-access E2E |
| UX-018 Clarification Tracker | P1 | 3 | Clarifications workspace | Questions, approvals, submission record, answer ingestion, downstream updates. | Clarification lifecycle test |
| UX-019 Comment Resolution Workflow | P1 | 4 | Comments / inbox | Comments become owned trackable tasks with due date, status, resolution, reopen. | Comment-to-task E2E |
| UX-020 Workflow Template Studio | P1 | 1 | Workflow templates | Visual authoring/simulation/version/publication/deprecation/rollback/migration. | Template governance proof |
| UX-021 Audit Explorer | P1 | 1/3/7 | Audit explorer | Searchable run/actor/resource/artifact audit with export and retention controls. | Run reconstruction proof |
| UX-022 Safe Sandbox Mode | P1 | 1/7 | Admin / import / templates / parse | Isolated fixture namespace, preview mutations, fake dispatch, cleanup guarantees. | Sandbox cleanup proof |
| UX-023 Proposal Memory | P2 | 8 | AI governance / outcomes | Win/loss learning, reviewer feedback, evidence strength, client preferences. | Memory/outcome tests |
| UX-024 Win Theme Builder | P2 | 5/8 | Competitive / editor | Requirement/client/competitor-backed themes with section consistency checks. | Theme injection E2E |
| UX-025 Submission Concierge | P2 | 6/8 | Submission | Package validation, channel dispatch, receipt, outcome follow-up, future finance hooks. | Submission lifecycle proof |

## Enhancement Ownership Notes

These notes disambiguate enhancements that intentionally span multiple waves:

| Enhancement | Primary wave | Dependency / extension waves | Ownership rule |
|---|---:|---|---|
| UX-003 Next Best Action Queue | 1 | 4 | Wave 1 owns the shared queue and projection contract; Wave 4 adds proposal-plan/task/comment sources. |
| UX-004 Response Readiness Score | 3 | 6 | Wave 3 owns scoring policy and blocker semantics; Wave 6 enforces the score in final production/submission. |
| UX-006 Smart Blocker Dashboard | 1 | 3 | Wave 1 owns blocker taxonomy/projection; Wave 3 adds compliance/evidence/DLP blocker sources. |
| UX-009 One-Click Remediation Actions | 1 | 2, 3, 7 | Wave 1 owns action-panel semantics; later waves add domain-specific remediation actions. |
| UX-010 Role-Based Homepages | 1 | 7 | Wave 1 owns persona shell and routing; Wave 7 adds CRM/partner/operator role data. |
| UX-011 Operational Inbox | 1 | 4 | Wave 1 owns inbox shell and work-item projection; Wave 4 adds proposal plan/comment/task depth. |
| UX-015 Proposal Section Health Indicators | 4 | 5, 6 | Wave 4 owns section health state; Waves 5 and 6 add authoring/provenance and final approval/export states. |
| UX-016 Requirement-to-Response Traceability | 3 | 5 | Wave 3 owns requirement/evidence/compliance traceability; Wave 5 adds authoring insertion and AI provenance links. |
| UX-021 Audit Explorer | 1 | 3, 7 | Wave 1 owns audit explorer core; Waves 3 and 7 add compliance/reporting/operations audit sources. |
| UX-022 Safe Sandbox Mode | 1 | 7 | Wave 1 owns sandbox namespace semantics; Wave 7 extends them to imports/integrations/operations. |
| UX-023 Proposal Memory | 8 | 5 | Wave 8 owns outcome-aware proposal memory; Wave 5 implements prerequisite AI memory/provenance foundations. |
| UX-024 Win Theme Builder | 5 | 8 | Wave 5 owns initial builder and editor integration; Wave 8 extends learning from proposal memory/outcomes. |
| UX-025 Submission Concierge | 6 | 8 | Wave 6 owns proposal submission concierge; Wave 8 extends into finance/payment and outcome follow-up. |

## Exhaustive Facility-Ledger Closure Targets

| Current blocked/strategic row | Closure wave | Required result |
|---|---:|---|
| F-001 Opportunity search, filter, shortlist | 2 | Pass with browser shortlist/saved-search DB delta and triage task proof. |
| F-002 Opportunity source health and scraper run visibility | 2 | Pass with scheduled/manual/cancel run, health, SLA, and remediation proof. |
| F-003 Opportunity qualification and pipeline stage transition | 2 | Pass with stage history, gate/triage workflow, and browser proof. |
| F-004 Analytics and PWin dashboard readout | 2/7 | Pass with data-source transcript and drill-down action proof. |
| F-007 Requirement extraction, acceptance, rejection, reopen | 2 | Pass with requirement workflow metadata/history, task projection, and browser proof. |
| F-008 Compliance matrix row submit/approve/reject/waive/reopen | 3 | Pass with lifecycle, authority, matrix stats, final lock, and audit proof. |
| F-009 Proposal planning and task projection | 4 | Pass with baseline plan, tasks, assignments, dependencies, and audit proof. |
| F-010 Document creation from template | 5 | Pass with document row/content/version/template provenance proof. |
| F-011 HDSI/editor authoring and content persistence | 5 | Pass with authenticated editor persistence and section state proof. |
| F-013 Content library search/browse/rating/reuse | 5 | Pass with search result, insertion/reuse, rating, freshness, and audit proof. |
| F-014 Comments, review, and approval gates | 4/6 | Pass with comment task, review package, approval, gate audit proof. |
| F-015 CRM accounts, contacts, deals, and activities | 7 | Pass with CRM entity rows and capture/activity timeline proof. |
| F-016 Partners assignment and portal-facing visibility | 7 | Pass with scoped portal visibility and denial proof. |
| F-017 Personnel and past-performance resource reuse | 5 | Pass with linked insertion, relevance rationale, and source trace proof. |
| F-018 Pricing, evidence, competitive-intel, win-theme support | 3/5/6 | Split into F-018A evidence/claim remediation, F-018B competitive/win-theme support, and F-018C pricing/approval; close parent only after all required subrows pass. |
| F-019 Import parse, preview, execute, rollback | 7 | Pass with validation report, commit, rollback, lineage, and cleanup proof. |
| F-020 Render/export/download artifact | 6 | Pass with artifact hash, protected download, format/accessibility gates, error path. |
| F-022 Outcome capture, win/loss, reporting, debrief | 7 | Pass with outcome/debrief row, lessons handoff, dashboard proof. |
| O-003 Workflow runtime start/transition/reversal | 1/6 | Pass after broad domain reversal/compensation and action-panel proof. |
| O-009 Scraper schedule, manual run, cancel, health, SSE | 2 | Pass with operator run transcript and browser/observability evidence. |
| O-010 API/admin health and service probes | 7 | Pass with app/scraper/search/LLM health transcript where configured. |
| O-011 Backup/restore smoke validation | 7 | Pass with backup output and disposable restore validation. |
| O-013 AI/model provider health and governance | 5 | Pass with provider health, prompt/model version, budget, fallback proof. |
| O-014 Research/search integrations | 5/7 | Pass with Firecrawl/search/Ollama/SearXNG sample where configured or explicit blocked credential row. |
| O-015 Audit/governance reportability | 1/3/7 | Pass with audit explorer reconstructing selected run IDs. |
| O-016 Privacy/DLP/access-sensitive export checks | 3/6 | Pass with DLP allow/deny, protected export, redaction/waiver proof. |
| X-001 Mobile/offline full app workflow | 8 | Pass if implemented; otherwise remain strategic with owner and revisit trigger. |
| X-002 Payment/revenue recognition | 8 | Pass if implemented; otherwise remain strategic with owner and revisit trigger. |
| X-003 Configurable domain/rule packs | 8 | Pass with rule-pack authoring/simulation/publication proof. |

## Expanded-Proof Subrows For Already-Passing Facilities

Some facilities are already `pass` in the current ledger, but the plan expands their capability scope. These existing `pass` rows must not be used as inherited proof for new behavior. Wave 0 should add subrows or an equivalent evidence ledger section for these expanded proof obligations.

| Existing pass row | New subrow / proof obligation | Owning wave | Required evidence |
|---|---|---:|---|
| F-005 RFP upload/fetch with durable storage receipt | F-005B discovery-linked intake storage | 2 | Discovered opportunity document is fetched server-side, stored in E3, linked to an RFP record, and cleaned up with object/database absence proof. |
| F-006 RFP parse status and failed-parse remediation | F-006B parser selection and confidence review | 2 | Parser selection policy, parse confidence, human correction, and versioned parse artifact are exercised through browser/API proof. |
| F-006 RFP parse status and failed-parse remediation | F-006C amendment/supersession handling | 2 | Amendment import supersedes or updates requirements with before/after audit and downstream task impact proof. |
| F-012 snippet/template insertion with context resolution | F-012B snippet preview and explainability | 5 | Preview resolves client/opportunity/RFP fields before insertion, highlights unresolved placeholders, and records provenance/explainability. |
| F-021 submission package and receipt | F-021B final checklist hard gate | 6 | Submission is blocked when required approvals, signatures, DLP, compliance lock, or artifact hash are missing and passes when resolved. |
| O-004 workflow template governance | O-004B visual/template studio governance | 1 | Admin edits/simulates/publishes/deprecates via UI, with approval or signoff semantics and rollback/deprecation proof. |
| O-006 notification dispatch through Stalwart | O-006B notification acknowledgement and preferences | 1 | Acknowledgement, quiet hours/suppression, fallback status, preference override, and failed-delivery remediation are exercised. |
| O-012 migration validation and remediation | O-012B wave migration preflight and rollback evidence | 7 | New migration precheck, validation, rollback/repair, and disposable restore evidence are captured for each schema-affecting wave. |

## Stable Split-Proof Subrows For Multi-Wave Facilities

Some open facility rows span multiple domains. They must be split into stable subrows before any wave starts moving them to `pass`. Parent rows close only when all required subrows are passed or explicitly deferred with owner/rationale.

| Parent row | Stable subrow | Owning wave | Proof obligation |
|---|---|---:|---|
| F-004 Analytics and PWin dashboard readout | F-004A PWin dashboard actionability | 2 | PWin/readout has sourced data, decision linkage, and drill-down to opportunity work. |
| F-004 Analytics and PWin dashboard readout | F-004B portfolio/reporting dashboard actionability | 7 | Portfolio dashboards create or deep-link to work items and scheduled reports. |
| F-014 Comments, review, and approval gates | F-014A comment-to-task workflow | 4 | Comment creates owned task, resolution, reopen, audit, and browser proof. |
| F-014 Comments, review, and approval gates | F-014B review package and approval gate | 6 | Review package freeze, reviewer completion, approval/reject/waive, gate audit proof. |
| F-018 Pricing, evidence, competitive-intel, and win-theme support | F-018A evidence and claim remediation | 3 | Evidence/claim gap workflow blocks or resolves section readiness. |
| F-018 Pricing, evidence, competitive-intel, and win-theme support | F-018B competitive intelligence and win themes | 5 | Competitive data and win themes are sourced, inserted, and checked for section consistency. |
| F-018 Pricing, evidence, competitive-intel, and win-theme support | F-018C pricing and price approval | 6 | Pricing package, BOE, authority approval, lock, and reopen proof. |
| O-003 Workflow runtime start/transition/reversal | O-003A shared action-panel and runtime transition | 1 | Shared start/transition/reversal semantics, authz, audit, task cancellation, dashboard proof. |
| O-003 Workflow runtime start/transition/reversal | O-003B finalization compensation scenarios | 6 | Artifact-change, approval reopen, submission correction, and domain compensation proof. |
| O-014 Research/search integrations | O-014A search/RAG and AI retrieval health | 5 | Search/RAG provider health, ACL filtering, stale-index repair, and sample query proof. |
| O-014 Research/search integrations | O-014B connector/research integration health | 7 | Firecrawl/SearXNG/Ollama/stealth or configured research connector sample proof, or credential-blocked row. |
| O-015 Audit/governance reportability | O-015A core audit explorer run reconstruction | 1 | Audit explorer reconstructs a workflow run by run ID and subject. |
| O-015 Audit/governance reportability | O-015B compliance/reporting audit package | 3 | Compliance/report snapshot has immutable references and audit export proof. |
| O-015 Audit/governance reportability | O-015C operations/reporting audit coverage | 7 | Ops/import/integration/backup audit sources are searchable and exportable. |
| O-016 Privacy/DLP/access-sensitive export checks | O-016A DLP policy and evidence/export allow-deny | 3 | DLP finding, redaction/waiver, and protected export allow/deny proof. |
| O-016 Privacy/DLP/access-sensitive export checks | O-016B final package DLP enforcement | 6 | Final submission/export is blocked by unresolved DLP and passes after approved remediation. |

## Implementation Waves

### Wave 0: Planning Ledger And Status Contract

Purpose: make the remaining work measurable before changing domain code.

Primary JTBD: all.

Enhancements: supports all UX rows by defining shared primitives.

Tasks:

1. Add a machine-readable JTBD implementation ledger, for example `docs/jtbd-implementation-ledger.md` plus optional JSON under `.omx/state/`.
2. Normalize each JTBD into journey, primary owning wave, dependency waves, domain owner, subject type, target screen, current status, facility-ledger row, implementation owner, and proof requirement.
3. Add an explicit `Live` promotion checklist to `docs/platform-jtbd-catalogue.md`.
4. Create canonical mappings:
   - JTBD -> workflow template or explicit non-workflow reason.
   - JTBD -> user screen(s).
   - JTBD -> backend action/API.
   - JTBD -> test and proof row.
5. Update `.omx/state/platform-e2e-facility-ledger.md` so every blocked product row has a planned wave and acceptance artifact.
6. Confirm and maintain expanded-proof subrows for already-passing facilities whose scope will grow: F-005B, F-006B, F-006C, F-012B, F-021B, O-004B, O-006B, and O-012B. These rows now exist in `.omx/state/platform-e2e-facility-ledger.md` as blocked proof obligations.
7. Confirm and maintain stable split-proof subrows for multi-wave facilities: F-004A/B, F-014A/B, F-018A/B/C, O-003A/B, O-014A/B, O-015A/B/C, and O-016A/B. These rows now exist in `.omx/state/platform-e2e-facility-ledger.md` as blocked proof obligations.
8. Add a wave ownership table to the ledger so execution agents know which wave may change each JTBD, enhancement, facility row, and subrow.

Acceptance criteria:

- Every JTBD has an implementation owner, target screen, target workflow semantics, and verification row.
- Every JTBD has exactly one primary owning wave, with dependency waves explicitly labeled.
- Every enhancement has exactly one primary owning wave, with dependency/extension waves explicitly labeled.
- No `Partial` or `Planned` row lacks a stated path to `Live`.
- Strategic rows have explicit release-wave or non-shipping rationale.
- Already-`pass` rows with expanded scope have explicit subrows, so historical proof is not reused for new behavior.
- Multi-wave parent facilities have stable subrow IDs and cannot be closed through informal slice names.

Likely files:

- `docs/platform-jtbd-catalogue.md`
- `docs/enhancements.md`
- `.omx/state/platform-e2e-facility-ledger.md`
- new `docs/jtbd-implementation-ledger.md`

### Wave 1: Control Plane And UX Shell

Purpose: create the shared surfaces that make the platform easier to use before deep domain work expands.

Primary JTBD:

- JTBD-051 Notifications
- JTBD-057 Workflow design
- JTBD-058 Workflow runtime
- JTBD-059 Auth/authorization
- JTBD-060 Audit/governance
- JTBD-072 Support/exception handling
- JTBD-073 Rules/configuration
- JTBD-075 Reopen/reversal

Dependency note: JTBD-063 reporting/dashboards and JTBD-064 production operations are primarily owned by Wave 7 because full completion needs domain drill-down reports, scheduled delivery, backup/restore, health probes, deployment gates, migration controls, and incident workflows. Wave 1 only supplies the shared command-center, dashboard shell, operations UI, audit, and exception primitives that Wave 7 extends.

Enhancements:

- UX-001 Opportunity Command Center
- UX-003 Next Best Action Queue
- UX-006 Smart Blocker Dashboard
- UX-009 One-Click Remediation Actions
- UX-010 Role-Based Homepages
- UX-011 Operational Inbox
- UX-020 Workflow Template Studio
- UX-021 Audit Explorer
- UX-022 Safe Sandbox Mode

Implementation tasks:

1. Build an `opportunity_command_center` data projection that aggregates opportunity, RFP, requirements, compliance, documents, reviews, pricing, tasks, workflow instances, notifications, blockers, and submission state.
2. Make `frontend/app/(app)/opportunities/[id]/page.tsx` the canonical Opportunity Command Center surface. Build the command-center experience as page sections and reusable components, not as a competing `/opportunities/[id]/command-center` route in Wave 1.
3. Add a reusable `NextActionPanel` that renders allowed workflow/domain actions with disabled reasons.
4. Add a unified `work_items` projection in code, backed initially by workflow runtime tasks, domain tasks, approvals, comments, notifications, exceptions, and portal requests.
5. Make `frontend/app/(app)/tasks/page.tsx` the canonical Operational Inbox / Next Best Action Queue surface with role filters, acknowledgements, snooze, bulk assignment, and escalation. Do not introduce a separate `/inbox` route in Wave 1; add a later redirect or nav alias only if user testing proves the label is needed.
6. Extend workflow operations screens with blocker taxonomy, stuck-state grouping, and one-click retry/assign/escalate/waive actions.
7. Build `AuditExplorer` using `workflow_audit_events` first, then domain audit sources.
8. Add safe sandbox mode for imports, parsing, workflow templates, snippets, and exports using run-scoped fixtures and visible environment labels.
9. Finish notification center UX: preferences, quiet hours, acknowledgement, fallback status, delivery transcript, and failed-delivery remediation.
10. Add route-level and server-action authz tests for all new control-plane surfaces.

Acceptance criteria:

- User can open one opportunity and see next action, blockers, readiness, tasks, deadlines, compliance, documents, approval state, and dispatch state.
- Inbox shows all actionable work items for at least proposal manager, writer, reviewer, approver, partner, admin, and operator roles.
- Every action shown in the command center is backed by a server-side permission check and audit event.
- Workflow operations can remediate failed RFP parse, scraper exception, failed notification, stuck workflow, and failed import/render placeholder fixtures.
- Audit Explorer can reconstruct a run by `run_id` and subject ID.
- Expanded proof subrows O-004B and O-006B are added and passed; existing O-004/O-006 pass rows remain valid for prior template publication and Stalwart delivery-attempt proof only.

Likely files:

- `frontend/app/(app)/opportunities/[id]/page.tsx`
- `frontend/app/(app)/tasks/page.tsx`
- `frontend/app/(app)/workflows/page.tsx`
- `frontend/app/(app)/workflows/operations/page.tsx`
- `frontend/lib/actions/workflow-runtime.ts`
- `frontend/lib/actions/task-management.ts`
- `frontend/lib/authz.ts`
- `frontend/components/opportunities/OpportunityCommandCenter.tsx`
- `frontend/components/tasks/OperationalInbox.tsx`
- `frontend/components/workflows/**`
- `frontend/components/dashboard/**`
- `frontend/__tests__/workflows/**`
- `frontend/e2e/workflow-action-panel.spec.ts`

### Wave 2: Discovery To RFP Intake

Purpose: make opportunity discovery, qualification, and RFP intake a single guided journey.

Primary JTBD:

- JTBD-001 Source monitoring
- JTBD-002 Opportunity search/shortlist
- JTBD-003 Daily opportunity digest
- JTBD-004 Discovery-to-RFP intake
- JTBD-005 Opportunity analysis
- JTBD-006 Capture pipeline stage movement
- JTBD-009 Capture activities
- JTBD-010 Milestones/deadlines
- JTBD-011 RFP intake
- JTBD-012 RFP parsing
- JTBD-013 Requirements extraction
- JTBD-014 Requirement assignment
- JTBD-040 PWin and forecasting
- JTBD-052 Calendar sync
- JTBD-065 Data quality

Dependency note: JTBD-007 and JTBD-008 are adjacent capture gate jobs but primary ownership remains Wave 6 because their completion depends on approval cards, package freeze, pricing/submission gates, and broad reversal semantics.

Enhancements:

- UX-002 Guided RFP Intake Wizard
- UX-008 End-to-End Proposal Timeline

Implementation tasks:

1. Workflowize scraper source runs with schedule, manual run, cancel, health, duplicate detection, freshness SLA, retry/backoff, and source disable/enable governance.
2. Add source health and scraper run detail screens with remediation actions.
3. Complete opportunity triage workflow: new, duplicate-review, shortlisted, qualified, rejected, promoted, stale, archived.
4. Connect search/shortlist actions to triage tasks, digest inclusion, and capture owner assignment.
5. Implement opportunity analysis acceptance: eligibility, strategic fit, competition, deadline, value, recommendation, evidence, confidence, override reason.
6. Complete discovery-to-RFP ingest: selected opportunity document downloads/stores in Linode E3, creates RFP document, starts parse job, and records provenance.
7. Add RFP Intake Wizard covering upload, source link, storage receipt, parser selection, parse status, failure remediation, requirement extraction, and next step.
8. Add parser confidence gate, human correction UI, versioned parse artifacts, and amendment/supersession handling.
9. Complete requirement acceptance workflow: accept/edit/reject/reopen, ambiguity flag, clarification task, owner/due date/section assignment, task projection, and audit.
10. Complete calendar/deadline acceptance: extracted dates become accepted/rejected milestones, calendar events, reminders, and changed-date propagation tasks.

Canonical ownership: Wave 2 discovery-to-RFP orchestration is owned by the Next.js frontend/server-action path (`frontend/app`, `frontend/lib/actions`, `frontend/lib/storage/linode-e3.ts`) because it is the user-facing, workflow/audit, E3, and task-projection surface. Python discovery/RFP endpoints under `src/docfusion/api/endpoints/discovery_endpoints.py` and `src/docfusion/rfp/**` are compatibility/worker wrappers only unless a later ADR deliberately changes that boundary.

Acceptance criteria:

- Facility rows F-001, F-002, F-003, F-004A, F-007 and O-009 move to `pass`.
- Expanded proof subrows F-005B, F-006B, and F-006C are added and passed; existing F-005/F-006 proof may remain as historical evidence but cannot cover these new behaviors.
- A browser test proves discovery/search -> shortlist -> qualify -> ingest -> E3 storage -> parse -> requirement acceptance -> task projection.
- Failed scraper and failed parse fixtures create owned exception workflows with remediation and cleanup proof.
- Requirement acceptance cannot complete without source trace, owner, due date, category, priority, and response section unless waived by authority.

Likely files:

- `frontend/app/(app)/opportunities/page.tsx`
- `frontend/app/(app)/opportunities/[id]/page.tsx`
- `frontend/app/(app)/opportunities/sources/page.tsx`
- `frontend/app/(app)/opportunities/[id]/requirements/**`
- `frontend/components/opportunities/**`
- `frontend/components/rfp/**`
- `frontend/components/requirements/**`
- `frontend/lib/actions/opportunities*.ts`
- `frontend/lib/actions/rfp-parser.ts`
- `frontend/lib/actions/requirements.ts`
- `frontend/lib/actions/scraper-runs.ts`
- `frontend/lib/storage/linode-e3.ts`
- `src/docfusion/api/endpoints/discovery_endpoints.py`
- `src/docfusion/rfp/**`

### Wave 3: Requirements, Compliance, Clarifications, And Evidence Gates

Purpose: make the source-of-truth and compliance layer submission-safe.

Primary JTBD:

- JTBD-015 Compliance matrix
- JTBD-016 Compliance validation
- JTBD-017 Compliance reports
- JTBD-018 Clarifications
- JTBD-029 Evidence library
- JTBD-030 Claim remediation
- JTBD-070 Accessibility/quality
- JTBD-071 Privacy/DLP

Dependency note: JTBD-013 and JTBD-014 remain owned by Wave 2. Wave 3 consumes accepted/assigned requirements and may add supporting evidence, but it does not own requirement extraction or assignment completion.

Enhancements:

- UX-004 Response Readiness Score
- UX-016 Requirement-to-Response Traceability
- UX-018 Clarification Tracker

Implementation tasks:

1. Complete compliance matrix lifecycle: generate, populate, assign, submit row, approve, reject, waive, reopen, lock, supersede.
2. Add final matrix lock with mandatory gap blocking and authority-controlled waiver.
3. Project compliance gaps and ambiguous requirements into tasks and the next-action queue.
4. Implement clarification tracker: draft question, internal review, submit/send record, answer ingestion, impacted requirement update, response update tasks.
5. Implement evidence lifecycle: import/find evidence, approve evidence, link to requirement/claim/section, expire evidence, refresh evidence.
6. Implement claim remediation workflow: unsupported claim -> evidence task, rewrite, waive, remove, or block section readiness.
7. Add requirement-to-response traceability UI from requirement to document section, evidence, review, approval, and final artifact.
8. Add DLP/privacy checks on evidence upload, section readiness, export, and external sharing.
9. Add response readiness score combining compliance, evidence, DLP, placeholders, approvals, format, export, and dispatch readiness.
10. Add immutable report package for compliance/audit snapshots.

Acceptance criteria:

- Facility rows F-008, F-018A, O-015B, and O-016A move to `pass` for this wave's scope.
- Mandatory compliance gaps block final matrix lock unless waived with authority and rationale.
- Any unsupported high-risk claim blocks section readiness until evidenced, rewritten, waived, or removed.
- Readiness score is explainable and links to exact blockers.
- DLP finding proof exists for allow and deny paths.

Likely files:

- `frontend/components/rfp/ComplianceMatrix.tsx`
- `frontend/components/compliance/**`
- `frontend/components/evidence/**`
- `frontend/lib/actions/compliance-validator.ts`
- `frontend/lib/actions/evidence.ts`
- `frontend/lib/actions/requirements.ts`
- `frontend/app/api/v1/compliance-matrix/**`
- `src/docfusion/compliance/**`
- `src/docfusion/security/data_protection/**`

### Wave 4: Proposal Planning, Tasks, Workload, And Command-Center Execution

Purpose: turn accepted requirements and compliance rows into an executable proposal plan.

Primary JTBD:

- JTBD-019 Proposal planning
- JTBD-020 Task work queue
- JTBD-021 Workload balancing
- JTBD-025 Collaboration
- JTBD-026 Comments

Enhancements:

- UX-015 Proposal Section Health Indicators
- UX-019 Comment Resolution Workflow

Implementation tasks:

1. Create proposal baseline plan workflow: draft, generated, staffing review, approved baseline, rebaseline, cancelled.
2. Generate section plan from accepted requirements and compliance matrix.
3. Model dependencies, critical path, skill requirements, owner assignment, and impossible-deadline detection.
4. Upgrade task lifecycle: assigned, accepted, in progress, blocked, review, completed, reopened, cancelled.
5. Add time logs, blocker reason codes, reassignment history, and workload/capacity snapshots.
6. Convert comments, review findings, compliance gaps, evidence gaps, DLP findings, and clarification actions into task projections.
7. Add workload balancing recommendations with accept/reject rationale.
8. Add section health indicators: drafted, requirements linked, evidence linked, compliance clear, comments resolved, approved, export-ready.
9. Add conflict/presence/session audit for collaboration actions.

Acceptance criteria:

- Facility row F-009 moves to `pass`.
- A generated proposal plan cannot baseline with unowned mandatory work, impossible due dates, or unresolved compliance blockers.
- Comment-to-task projection is proven in browser and DB.
- Inbox shows proposal plan tasks, comment tasks, compliance tasks, evidence tasks, and review tasks in one queue.

Likely files:

- `frontend/app/(app)/tasks/page.tsx`
- `frontend/components/task-management/**`
- `frontend/components/document/**`
- `frontend/components/editor/**`
- `frontend/lib/actions/task-management.ts`
- `frontend/lib/actions/comments.ts`
- `frontend/lib/actions/requirements.ts`
- `frontend/lib/db/schema-tasks.ts`
- `src/docfusion/workflow/coordination/**`

### Wave 5: Authoring, Content Library, AI Assistance, And Knowledge Reuse

Purpose: make drafting fast, context-aware, evidence-backed, and governed.

Primary JTBD:

- JTBD-022 Document authoring
- JTBD-023 AI drafting
- JTBD-024 Content improvement
- JTBD-031 Content library governance
- JTBD-032 Template lifecycle
- JTBD-033 Company knowledge
- JTBD-034 Personnel
- JTBD-035 Past performance
- JTBD-038 Competitive intelligence
- JTBD-039 Win themes
- JTBD-054 Search/RAG
- JTBD-055 AI agent orchestration
- JTBD-056 Agent memory
- JTBD-069 Model governance

Dependency note: JTBD-025 collaboration is owned by Wave 4 because it depends on task/comment/section workflow foundations. Wave 5 consumes those collaboration primitives in the authoring experience.

Enhancements:

- UX-007 Context-Aware Writing Assistant
- UX-013 Explainability Panels
- UX-014 Snippet Preview With Live Placeholder Resolution
- UX-024 Win Theme Builder

Implementation tasks:

1. Create context-aware writing assistant inside document editor that retrieves requirement, client, opportunity, Datacraft snippets, evidence, personnel, past performance, competitor analysis, and win themes.
2. Extend snippet/template insertion with preview, deterministic placeholder resolution, unresolved highlighting, requirement-aware AI adaptation, and provenance.
3. Add AI explainability panels: source snippets, substitutions, evidence, prompt/model version, cost, assumptions, and human edits.
4. Add section-level AI generation workflow: requested, generated, human review, accepted, rejected, regenerated, archived.
5. Add content library governance: approval, freshness, stale-content blocking policy, usage analytics, and refresh tasks.
6. Add company knowledge governance for variables, clients, services, products, CV source data, and approved reuse status.
7. Add personnel/past-performance relevance selection workflows and insertion traceability.
8. Add competitive intelligence and win theme builder, including theme injection suggestions and section consistency checks.
9. Complete search/RAG indexing workflow: ingestion, embeddings, ACL filtering, stale index repair, quality metrics, and search health.
10. Complete agent subsystem from the master plan: remove stubs, persistent memory, channels, task fit, workflow integration, agent failure remediation, and cost/provenance reporting.
11. Add model governance control plane: provider health, fallback policy, prompt versions, eval gates, budget limits, and rollback.

Acceptance criteria:

- Facility rows F-010, F-011, F-012B, F-013, F-017, F-018B, O-013, and O-014A move to `pass`.
- Inserting a snippet in a live document previews resolved context and highlights unresolved placeholders before insertion.
- AI-generated text cannot mark a section ready without human accept/reject and provenance.
- Search results are ACL-filtered and freshness-scored.
- Personnel/past performance/evidence insertions are traceable to source and requirement.

Likely files:

- `frontend/app/(app)/documents/[id]/page.tsx`
- `frontend/app/(app)/content-library/page.tsx`
- `frontend/app/(app)/company/page.tsx`
- `frontend/app/(app)/personnel/page.tsx`
- `frontend/app/(app)/past-performance/page.tsx`
- `frontend/app/(app)/competitive/page.tsx`
- `frontend/components/content-library/**`
- `frontend/components/document/**`
- `frontend/components/evidence/**`
- `frontend/components/personnel/**`
- `frontend/components/past-performance/**`
- `frontend/components/competitive/**`
- `frontend/lib/actions/content*.ts`
- `frontend/lib/actions/evidence.ts`
- `frontend/lib/actions/pricing.ts`
- `frontend/lib/ai/**`
- `src/docfusion/agents/**`
- `src/docfusion/storage/rag/**`

### Wave 6: Reviews, Approvals, Pricing, Production, Rendering, And Submission

Purpose: make final proposal production controlled, auditable, and hard to submit incorrectly.

Primary JTBD:

- JTBD-007 Capture decision
- JTBD-008 Gate reviews
- JTBD-027 Document approvals
- JTBD-028 Color-team reviews
- JTBD-036 Pricing
- JTBD-037 Pricing governance
- JTBD-045 Oral presentations
- JTBD-046 Graphics
- JTBD-047 Production formatting
- JTBD-048 Rendering/export
- JTBD-049 Submission
- JTBD-050 E-signature

Enhancements:

- UX-005 Final Submission Checklist
- UX-012 Inline Approval Cards
- UX-025 Submission Concierge

Implementation tasks:

1. Finalize gate review authority: quorum, role requirements, checklist lock, decision package snapshot, signed rationale, conditions, follow-up tasks, and no-bid reversal.
2. Add inline approval cards across documents, sections, compliance rows, pricing packages, reviews, and submission package.
3. Complete color-team review workflow: package freeze, reviewer assignment, findings, critical finding closure, scores, recommendation, export package.
4. Complete document approval workflow with section/package version locks and artifact hashes.
5. Complete pricing package workflow: labor mix, BOE, cost realism, rate authority, sensitivity, review, approval, final lock, reopen.
6. Add presentations/graphics workflows: request, create, review, approve, accessibility/caption checks, insertion traceability.
7. Complete render/export pipeline: real PDF/DOCX/LaTeX/PPTX where in scope, artifact caching, error reporting, download protection, and hash logging.
8. Build final submission checklist: required docs, signatures, attachments, compliance matrix lock, DLP, format/accessibility, approvals, artifact hashes, delivery channel, receipt.
9. Add e-signature provider abstraction and at least one implementation or signed-manifest fallback if provider choice remains open.
10. Complete submission concierge: package manifest, dispatch channel adapter, Stalwart or configured delivery, receipt capture, failed dispatch remediation, outcome follow-up.
11. Define correction/reversal semantics for submitted packages and changed artifacts after approval.

Dependency note: JTBD-070 accessibility/quality and JTBD-075 reopen/reversal are primarily owned by Waves 3 and 1 respectively. Wave 6 proves their final-production enforcement for submission, render/export, approval, and artifact-change scenarios.

Acceptance criteria:

- Facility rows F-014B, F-018C, F-020, F-021B, O-003B, and O-016B move to `pass`.
- Final submission is impossible while required approvals, DLP, compliance lock, signatures, or artifact hashes are missing.
- Any artifact change after final approval reopens the appropriate approval/checklist state.
- Render/export failures create operator-visible exception workflows.
- Submission receipt is immutable and linked to the package manifest.

Likely files:

- `frontend/app/(app)/reviews/page.tsx`
- `frontend/app/(app)/opportunities/[id]/submission/**`
- `frontend/components/reviews/**`
- `frontend/components/render/**`
- `frontend/components/formatting/**`
- `frontend/components/graphics/**`
- `frontend/components/presentations/**`
- `frontend/lib/actions/reviews.ts`
- `frontend/lib/actions/submission*.ts`
- `frontend/lib/actions/pricing.ts`
- `frontend/lib/render/**`
- `src/docfusion/document_engine/**`
- `src/docfusion/composition/**`
- `src/docfusion/visualization/**`

### Wave 7: CRM, Partners, Imports, Integrations, Outcomes, Reporting, And Operations

Purpose: make non-authoring business workflows first-class and operator-safe.

Primary JTBD:

- JTBD-041 Outcomes/lessons
- JTBD-042 CRM
- JTBD-043 Partner management
- JTBD-044 External contribution
- JTBD-053 Data import
- JTBD-061 Integrations
- JTBD-062 API/webhooks
- JTBD-063 Reporting/dashboards
- JTBD-064 Production operations
- JTBD-074 Migration/remediation

Dependency note: JTBD-051, JTBD-052, JTBD-065, JTBD-072, and JTBD-073 have primary ownership in Waves 1 or 2. Wave 7 adds integration/import/operations adapters that feed those shared capabilities rather than owning the shared capability itself. JTBD-063 is owned by Wave 7 for full reporting/dashboard completion; Wave 1 builds only the shared dashboard shell.

Enhancements:

- UX-017 Partner Contribution Portal

Implementation tasks:

1. CRM workflowize accounts, contacts, deals, activities, stage history, imports, and capture handoff.
2. Add partner invitation, identity verification, NDA/teaming acceptance, scoped access, assignment, contribution, internal review, reject/resubmit, and expiry.
3. Complete portal visibility for partners and external reviewers with strict scope and audit boundaries.
4. Complete data import lifecycle: parse, preview, validate, duplicate/conflict review, approve, commit, rollback, lineage, and error remediation.
5. Implement connector framework for CRM, calendar writeback, document storage, webhooks, and communications with auth, scopes, retries, idempotency, conflict handling, and disable policy.
6. Add API/webhook contract: idempotency keys, async job status, error taxonomy, rate limits, audit, and external status polling.
7. Add outcome/debrief workflow: await outcome, win/loss, debrief, lessons, reusable insights, model/strategy handoff.
8. Build reporting dashboards that drill into work: portfolio, pipeline, workload, compliance, reviews, notifications, operational health, audit findings.
9. Complete production operations: health probes, backup/restore rehearsal, migration precheck/rollback, deployment approval, incident workflow, and operational runbooks.
10. Broaden operational exception adapters for imports, render/export, connector sync, AI provider failures, DLP findings, and stale indexes.

Acceptance criteria:

- Facility rows F-004B, F-015, F-016, F-019, F-022, O-010, O-011, O-012B, O-014B, and O-015C move to `pass`.
- Partner portal tests prove scoped access and denial for unrelated opportunity data.
- Import rollback proof includes before/after DB deltas and cleanup.
- Backup/restore proof exists against disposable database/object-store fixtures.
- Reports can create or deep-link to work items, not just display metrics.

Likely files:

- `frontend/app/(app)/crm/**`
- `frontend/app/(app)/partners/page.tsx`
- `frontend/app/(app)/workflows/portal/page.tsx`
- `frontend/app/(app)/import/page.tsx`
- `frontend/app/(app)/analytics/page.tsx`
- `frontend/lib/actions/import*.ts`
- `frontend/lib/actions/operational-exceptions.ts`
- `frontend/app/api/v1/import/**`
- `frontend/app/api/v1/workflows/**`
- `src/docfusion/integrations/**`
- `deployment/**`
- `.github/workflows/**`

### Wave 8: Strategic Expansion

Purpose: implement long-term ecosystem jobs or document scoped deferrals.

Primary JTBD:

- JTBD-066 Domain expansion
- JTBD-067 Mobile/offline
- JTBD-068 Payment/revenue

Enhancements:

- UX-023 Proposal Memory

Implementation tasks:

1. Add configurable domain/rule-pack authoring with inheritance, simulation, validation, migration compatibility, publication, rollback, and tenant boundaries.
2. Implement mobile/offline review/comment/approval/task client path or PWA offline mode with cached work queue, local draft actions, conflict reconciliation, sync audit, and push notifications.
3. Implement payment/revenue workflows: milestone triggers, invoice package, approval, gateway/callback abstraction, reconciliation, failure/refund handling, and finance audit.
4. Expand proposal memory into outcome-aware reuse: lessons, reviewer feedback, section performance, evidence strength, client preferences, and win/loss patterns.
5. Decide which strategic rows become release commitments and which remain documented future strategy.

Acceptance criteria:

- Strategic rows either become tested workflow-backed surfaces or remain explicitly strategic with owner, rationale, and revisit trigger.
- Mobile/offline conflict and sync proof exists if implemented.
- Payment workflow has sandbox provider proof if implemented.

## Inter-Wave Gates

Execution must honor these gates. A downstream wave may perform exploratory reads before its gate opens, but it may not claim completion or promote JTBD status until the gate is satisfied.

| Gate | Required before | Condition |
|---|---|---|
| G0 ownership gate | Any implementation wave | Wave 0 ledger exists with primary owning wave, dependency waves, target screen, workflow semantics, proof rows, expanded-proof subrows, and status-promotion checklist for every JTBD and enhancement. |
| G1 shared-control gate | Waves 2-8 completion claims | Wave 1 command center projection, next-action contract, work-item projection, authz/audit envelope, notification acknowledgement contract, and action-panel semantics are implemented or deliberately stubbed behind test-failing TODO rows. |
| G2 source-of-truth gate | Waves 3-6 completion claims | Wave 2 proves discovery/RFP/requirement source-of-truth paths, including expanded F-005B/F-006B/F-006C proof where relevant. |
| G3 compliance gate | Waves 4-6 final proposal claims | Wave 3 proves compliance lock, evidence/claim remediation, DLP policy, clarification lifecycle, and readiness-score blocker semantics. |
| G4 work-queue gate | Waves 5-7 human-work claims | Wave 4 proves proposal plan, task lifecycle, comment-to-task projection, workload, and section health foundations. |
| G5 authoring/provenance gate | Wave 6 final approval/submission claims | Wave 5 proves context-aware authoring, snippet preview, AI provenance, evidence/personnel/past performance traceability, and model governance basics. |
| G6 finalization gate | Wave 7 outcome/reporting claims | Wave 6 proves approvals, pricing governance, render/export, final checklist, e-signature or signed-manifest fallback, and submission receipt. |
| G7 operations gate | Wave 8 strategic expansion | Wave 7 proves imports, integrations, CRM/partner workflows, backup/restore, health probes, operational exceptions, and reporting. |

## Cross-Cutting Technical Work

### Workflow Adapter Contract

Every domain should expose:

- `subjectType`
- `subjectId`
- `loadSubjectState`
- `deriveWorkflowState`
- `applyTransition`
- `compensateTransition`
- `getPortalVisibility`
- `getAuthorityPolicy`
- `getAuditEvidence`
- `getDashboardProjection`

The adapter contract should live near `frontend/lib/actions/workflow-domain.ts` or a new `frontend/lib/workflows/domain-adapters.ts`.

### Readiness And Blocker Engine

Build a shared blocker/readiness engine that computes:

- missing owner;
- due soon/overdue;
- missing evidence;
- unresolved placeholder;
- compliance gap;
- DLP finding;
- unapproved waiver;
- unclosed review finding;
- stale content;
- failed integration/job;
- artifact changed after approval;
- missing receipt.

Use this engine for command center, inbox, readiness score, final checklist, and operations dashboard.

### Authorization And Audit

All new server actions/API routes must:

- derive actor from session;
- enforce organization/resource scope;
- enforce role/authority;
- fail closed on missing scope;
- write audit for sensitive transition attempts, including denied attempts where appropriate;
- avoid leaking unrelated resource existence.

### Data And Migration Discipline

Every wave with schema changes must include:

- forward migration;
- validation script;
- rollback or repair strategy;
- generated type/schema parity check;
- seeded fixture migration proof;
- deployed db.lindela.io validation where safe.

### UI Surfacing Rules

Every JTBD screen must show:

- current state;
- next allowed action;
- owner;
- due date/SLA;
- blockers;
- related documents/evidence;
- audit/history;
- disabled-action reason;
- portal visibility if external actors are involved.

## Expanded Test Plan

### Unit Tests

- Workflow adapter transition rules for every subject type.
- Readiness/blocker scoring.
- Permission and authority failures.
- Placeholder/context resolution.
- Compliance, evidence, DLP, pricing, and submission gates.
- Reversal/compensation semantics.

### Integration Tests

- Domain action -> workflow instance/task/audit/notification projection.
- Scheduler worker processing for SLA, exception sync, notification dispatch, freshness scans, evidence expiration, and import/render failures.
- Linode E3 upload/download/readback for RFP and final artifacts.
- Stalwart notification delivery-attempt handling and acknowledgement state.
- db.lindela.io migration validation for new tables.

### Browser / E2E Tests

- Discovery -> shortlist -> qualification -> ingest -> parse -> requirements -> compliance -> draft -> review -> approval -> render -> dispatch -> receipt.
- Command center next-action flow on the canonical opportunity detail page, `frontend/app/(app)/opportunities/[id]/page.tsx`.
- Operational inbox bulk and role-specific actions on the canonical tasks page, `frontend/app/(app)/tasks/page.tsx`.
- Partner portal scoped contribution and denial path.
- Final submission checklist blocked and pass paths.
- Audit Explorer run reconstruction.

### Observability And Live Proof

- Facility ledger proof row for each wave.
- Run-scoped fixture namespace for every mutating proof.
- Cleanup audit after every live-safe run.
- Stuck workflow dashboard proof.
- Failed job exception queue proof.
- Notification metrics proof.
- Backup/restore rehearsal proof.

## Repo-Accurate Verification Commands

These commands are intentionally split by working directory because this repository has Python/root tooling at the repo root and the Next.js application under `frontend/`.

### Root Working Directory

Run from `/Users/nyimbiodero/src/pjs/docfusion`:

```bash
git diff --check
make lint
make type-check
make test
```

Use `make quality-check` before closing a wave that changes Python, root project configuration, or shared scripts. Use `uv run pytest <path> -v --tb=short` for narrow Python regression loops before the full root test target.

### Frontend Working Directory

Run from `/Users/nyimbiodero/src/pjs/docfusion/frontend`:

```bash
npm test -- --run
npx tsc --noEmit
npm run lint
npm run build
npm run workflow:validate-db
npm run test:e2e
```

Use `npm run workflow:migrate-db` only when a wave adds or changes workflow runtime migrations and the target database is explicitly selected. Use `npm run workflow:worker` for scheduled-worker validation after worker behavior changes, with run-scoped fixtures and cleanup proof recorded in the facility ledger.

### Authenticated Browser And Live-Safe Proof

The current Playwright specs include useful request/harness coverage, but they do **not** by themselves satisfy authenticated `next start` journey proof:

- `frontend/e2e/golden-path.spec.ts` currently exercises request-level FastAPI endpoints at `localhost:8000`.
- `frontend/e2e/workflow-action-panel.spec.ts` currently exercises a bundled component harness at `workflow-panel.test`.

Those existing specs may remain in the regression suite, but a wave may claim authenticated browser proof only after adding or updating specs that run from `frontend/` against `next start`, use `E2E_BASE_URL`, establish an authenticated test session, and operate on disposable fixture data:

```bash
E2E_BASE_URL=http://127.0.0.1:<port> npm run test:e2e -- e2e/<wave-authenticated-journey>.spec.ts
E2E_BASE_URL=http://127.0.0.1:<port> npm run test:e2e -- e2e/<wave-action-surface>.spec.ts
```

Wave-specific live proofs must declare their target services before execution: db.lindela.io for deployed database validation, Linode E3 for RFP/final artifact upload-readback, and Stalwart for mail delivery-attempt proof. Live proof can update a facility row only when the run ID, fixture IDs, cleanup result, and failure transcript are recorded.

## Acceptance Criteria

1. All P0 JTBD are `Live`, workflow-backed, screen-surfaced, and facility-ledger `pass`.
2. All P1 JTBD are either `Live` or have an approved, dated, owner-assigned exception.
3. All P2/Strategic JTBD have either implemented workflow surfaces or explicit strategic deferral records.
4. All 25 enhancements in `docs/enhancements.md` are implemented or mapped to implemented screens/workflows.
5. The full RFP lifecycle browser test passes against `next start` with authenticated session:
   discovery -> selection -> E3 storage -> parse -> requirements -> compliance -> drafting -> review/approval -> render/export -> dispatch/receipt.
6. Every domain mutation touched by the plan has strict authz and audit coverage.
7. Repo-accurate verification passes from the correct working directories: root `git diff --check`, `make lint`, `make type-check`, `make test`; frontend `npm test -- --run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run workflow:validate-db`, Playwright golden paths, and wave-specific live-safe facility proof.
8. Documentation is updated: JTBD catalogue, enhancements, facility ledger, user/admin docs, operational runbooks, and ADRs.

## Risks And Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Scope is too broad for one execution lane | Partial delivery or regressions | Execute as waves with independent facility-ledger gates. |
| Existing screens hide incomplete domain actions | Overclaimed UX completion | Require workflow DoD plus browser proof before marking `Live`. |
| Workflow runtime becomes a bottleneck | Slow domain delivery | Use a minimal adapter contract and domain-owned handlers. |
| Authz gaps appear in new APIs | Data exposure | Fail closed, add negative tests, review every route/action. |
| Migrations against db.lindela.io drift | Deployment failure | Add preflight, validation, rollback/repair scripts, and disposable proof data. |
| Stalwart/E3/live services unavailable during proof | Blocked rows | Distinguish local integration from live proof; do not promote to `pass` without required evidence. |
| AI output becomes ungoverned | Compliance risk | Require provenance, human accept/reject, source links, cost, and model/prompt versioning. |

## ADR

### Decision

Use **journey-slice completion**: implement full vertical proposal lifecycle slices that combine workflow correctness, backend actions, necessary screens, and proof.

### Drivers

- Users need an easier guided experience, not more disconnected pages.
- JTBD completion requires workflow state, audit, authz, tasks, and recovery paths.
- Live proof must be run-scoped and cleanup-safe.

### Alternatives Considered

- **Screen-first completion**: rejected because it would create visible UI without durable workflow semantics.
- **Runtime-only completion**: rejected because it would improve correctness but leave the product hard to use.
- **Big-bang rewrite**: rejected because the existing repo has many valuable surfaces and tests that should be extended incrementally.

### Why Chosen

Journey slices let each tranche become user-visible and verifiable. They also allow `$team` lanes to work on disjoint domains while maintaining one shared runtime and UX contract.

### Consequences

- Execution will require multiple commits and probably multiple Ralph/team cycles.
- The command center, inbox, readiness engine, and workflow adapter contract become foundational shared surfaces.
- Some strategic items may remain explicitly deferred unless the user chooses to include them in the release scope.

### Follow-Ups

- Decide release expectations for mobile/offline and payment/revenue.
- Decide external providers for e-signature, calendar writeback, CRM sync, and payment gateway.
- Future ADRs may move RFP/agent service ownership, but Wave 2 treats Next.js as canonical for discovery-to-RFP orchestration and Python as compatibility/worker support.

## Available-Agent-Types Roster

Use only available role types from the current Codex/OMX roster:

- `planner`: wave sequencing and plan updates.
- `architect`: architecture review, boundaries, state model validation.
- `critic`: plan/design challenge and consensus review.
- `explore`: fast codebase mapping.
- `executor`: implementation and refactoring.
- `debugger`: failure diagnosis.
- `test-engineer`: test strategy and coverage.
- `security-reviewer`: authz, DLP, portal, and audit review.
- `designer`: UX/workflow screen design.
- `writer`: docs, ADRs, runbooks, release notes.
- `verifier`: completion evidence and proof validation.
- `build-fixer`: build/type/lint failures.
- `code-reviewer`: comprehensive review before merge.

## Follow-Up Staffing Guidance

### Ralph Path

Use `$ralph` for one wave at a time when sequential correctness matters.

Suggested command:

```text
$ralph .omx/plans/full-jtbd-enhancements-implementation-plan.md --wave 0
```

Ralph should staff:

- `explore` low effort for current file/symbol mapping.
- `executor` high effort for implementation.
- `test-engineer` medium effort for coverage.
- `security-reviewer` medium effort for authz-sensitive waves.
- `architect` high effort for final verification.
- `verifier` high effort for facility-ledger evidence.

Ralph must begin each wave by checking the relevant inter-wave gate. If the gate is not satisfied, Ralph should implement the missing gate prerequisite before continuing the requested wave, not bypass it.

### Team Path

Use `$team` for parallel wave execution after Wave 0 establishes the ledger and shared contracts.

Suggested command:

```text
$team "Execute Wave 1 from .omx/plans/full-jtbd-enhancements-implementation-plan.md. Use separate lanes for the opportunity detail command-center sections, the tasks-page operational inbox/work-items surface, audit/operations, notification center, and verification. Keep writes scoped and update the facility ledger with proof."
```

Recommended lanes:

1. **Runtime/control-plane lane**: workflow adapters, work items, operations actions.
2. **UX shell lane**: opportunity detail command-center sections, next-action panel, tasks-page operational inbox, blocker dashboard.
3. **Security/audit lane**: authz tests, audit explorer, denied-action proof.
4. **Notification/worker lane**: acknowledgement, preferences, fallback, dispatch dashboards.
5. **Verification lane**: Playwright, integration tests, facility-ledger proof, cleanup audit.

### Per-Wave Staffing And Signoff Map

| Wave | Primary lanes | Suggested roles / reasoning | Facility rows the wave may move | Required signoff |
|---|---|---|---|---|
| 0 | Ledger/status contract, proof model, docs | `planner` medium, `writer` high, `verifier` high, `architect` high | Adds subrows and ownership metadata; does not mark domain rows `pass` except documentation-only status contract | Architect + verifier |
| 1 | Control plane, UX shell, security/audit, notifications | `executor` high, `designer` high, `security-reviewer` medium, `test-engineer` medium, `verifier` high | O-003A, O-004B, O-006B, O-015A | Security-reviewer + architect + verifier |
| 2 | Discovery/RFP/requirements, scraper, calendar, data quality | `executor` high, `debugger` high, `test-engineer` medium, `verifier` high | F-001, F-002, F-003, F-004A, F-005B, F-006B, F-006C, F-007, O-009 | Architect + verifier |
| 3 | Compliance, clarifications, evidence, DLP/readiness | `executor` high, `security-reviewer` medium, `test-engineer` medium, `verifier` high | F-008, F-018A, O-015B, O-016A | Security-reviewer + verifier |
| 4 | Proposal plan, tasks, workload, comments | `executor` high, `designer` medium, `test-engineer` medium, `verifier` high | F-009, F-014A | Architect + verifier |
| 5 | Authoring, content, AI, search, knowledge reuse | `executor` high, `dependency-expert` high when provider docs are needed, `test-engineer` medium, `verifier` high | F-010, F-011, F-012B, F-013, F-017, F-018B, O-013, O-014A | Architect + verifier |
| 6 | Reviews, approvals, pricing, render, submission | `executor` high, `security-reviewer` medium, `test-engineer` medium, `verifier` high | F-014B, F-018C, F-020, F-021B, O-003B, O-016B | Security-reviewer + architect + verifier |
| 7 | CRM, partners, imports, integrations, outcomes, operations | `executor` high, `debugger` high, `security-reviewer` medium, `test-engineer` medium, `verifier` high | F-004B, F-015, F-016, F-019, F-022, O-010, O-011, O-012B, O-014B, O-015C | Security-reviewer + verifier |
| 8 | Strategic expansion | `architect` high, `executor` high, `security-reviewer` medium, `verifier` high | X-001, X-002, X-003 and strategic UX extensions | Architect + user/business owner + verifier |

Only the owning wave may mark its rows or subrows `pass`. Dependency waves may add supporting evidence but must not close another wave's row without explicit handoff in the ledger.

## Team Verification Path

Before team shutdown:

1. Each lane reports changed files and facility rows touched.
2. Tests pass for lane-owned units and integrations.
3. Cross-lane browser proof passes for the target journey.
4. Security lane signs off on route/action authz.
5. Verifier confirms ledger rows and cleanup proof.

After team handoff:

1. Ralph runs root checks from `/Users/nyimbiodero/src/pjs/docfusion`: `git diff --check`, `make lint`, `make type-check`, and `make test` when Python/root code changed.
2. Ralph runs frontend checks from `/Users/nyimbiodero/src/pjs/docfusion/frontend`: `npm test -- --run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `npm run workflow:validate-db`.
3. Ralph runs Playwright golden paths from `/Users/nyimbiodero/src/pjs/docfusion/frontend` against `next start` with `E2E_BASE_URL` set.
4. Ralph runs wave-specific live-safe proof scripts with run-scoped fixtures and records service targets, fixture IDs, cleanup proof, and failure transcripts in the facility ledger.
5. Architect verifies the facility ledger and repo-accurate command evidence before commit/push.

## Changelog

- v1: Initial grounded consensus draft based on JTBD catalogue, enhancements catalogue, facility ledger, route/component surface, and master completion plan.
- v2: Applied architect iteration feedback by adding primary-wave ownership semantics, expanded-proof subrows for already-passing facilities whose scope grows, hard inter-wave gates, and per-wave staffing/signoff ownership. Also removed ambiguous broad wave ranges and clarified dependency waves.
- v3: Applied architect iteration 3 feedback by adding enhancement ownership semantics and stable split-proof subrow IDs for multi-wave facility rows, then replacing informal staffing-map slice names with those IDs.
- v4: Normalized enhancement wave sections so each UX enhancement appears as a primary item in exactly one wave, and replaced remaining informal facility proof language with stable subrow IDs.
- v5: Added the previously dangling F-004A PWin dashboard actionability subrow to Wave 2 acceptance and staffing ownership.
- v6: Applied critic feedback by choosing canonical Wave 1 surfaces (`opportunities/[id]` for command center and `tasks` for operational inbox) and replacing ambiguous verification text with root/frontend working-directory-specific commands.
- v7: Materialized every planned expanded-proof and split-proof subrow in the facility ledger as a blocked proof obligation, then updated Wave 0 language from "add rows" to "confirm and maintain rows".
- v8: Replaced parent proof targets in the JTBD matrix with wave-owned subrows where available and marked later-wave facility dependencies in the wave column.
- v9: Marked scheduled-worker and exception-remediation dependency waves explicitly for deadline, runtime, calendar, and data-quality JTBD rows.
- v10: Corrected browser-proof language so current request/harness Playwright specs are not overclaimed as authenticated `next start` proof, and assigned Next.js as the canonical Wave 2 discovery-to-RFP orchestration owner.
