# PRD: Full JTBD And Enhancements Implementation

Status: Approved for Ralph execution  
Source plan: `.omx/plans/full-jtbd-enhancements-implementation-plan.md`  
Created: 2026-05-05  

## Objective

Implement every pending JTBD in `docs/platform-jtbd-catalogue.md` and every usability enhancement in `docs/enhancements.md` as workflow-backed, screen-surfaced, audited platform capabilities.

## Completion Definition

A JTBD is complete only when it has:

- explicit subject and state model;
- server-side mutation path with strict authz;
- task/work-item projection where human work is required;
- SLA, escalation, notification, and audit semantics where applicable;
- portal visibility and external actor boundaries where applicable;
- reversal, retry, cancellation, or audit-only compensation rationale;
- relevant UI surface with current state, next actions, blockers, owner, due date, and history;
- tests and facility-ledger proof with cleanup evidence for mutating flows.

## Execution Waves

| Wave | Outcome | Must prove |
|---:|---|---|
| 0 | Planning ledger and status contract | Every JTBD/enhancement/facility row has owner, wave, proof target, and promotion checklist. |
| 1 | Control plane and UX shell | Command center, operational inbox, action panel, audit explorer, sandbox, notification UX foundations. |
| 2 | Discovery to RFP intake | Source health, opportunity triage, RFP ingest, E3 storage, parse review, requirements, deadlines. |
| 3 | Requirements, compliance, evidence, DLP | Compliance lifecycle, clarification tracker, evidence/claim remediation, readiness/DLP policy. |
| 4 | Proposal planning and workload | Proposal baseline, tasks, workload, comment-to-task, collaboration projection. |
| 5 | Authoring, content, AI, knowledge reuse | Context-aware writing, snippets, provenance, search/RAG, personnel/past performance, win themes. |
| 6 | Review, approval, pricing, production, submission | Review gates, approvals, pricing, render/export, final checklist, submission receipt. |
| 7 | CRM, partners, integrations, reporting, operations | Partner portal, imports, health, backup/restore, reports, operational incidents. |
| 8 | Strategic expansion | Mobile/offline, payments/revenue, rule packs, proposal memory extensions. |

## Non-Negotiable Requirements

- Do not mark any JTBD or facility row `Live`/`pass` without fresh proof.
- Do not use historical parent proof for expanded behavior; use split/expanded subrows.
- Do not introduce competing Wave 1 routes: command center lives on opportunity detail, operational inbox lives on tasks page.
- Wave 2 discovery-to-RFP orchestration is canonical in Next.js/server actions/E3 storage; Python endpoints are compatibility/worker wrappers unless a later ADR changes this.
- Current request-level or harness Playwright specs do not count as authenticated `next start` proof. Wave closure requires matching authenticated browser specs.

## User Stories

| ID | Priority | Story | Acceptance |
|---|---:|---|---|
| US-000 | P0 | As an implementation owner, I need a normalized ledger so every JTBD can be assigned, implemented, verified, and promoted without ambiguity. | Wave 0 ledger and promotion checklist pass mechanical validation. |
| US-001 | P0 | As a proposal manager, I need one command center per opportunity so I can see status, blockers, next actions, and readiness. | Wave 1 command-center browser proof and O-003A/O-015A evidence pass. |
| US-002 | P0 | As any user, I need a role-aware operational inbox so I can act on all assigned work without searching across pages. | Wave 1/4 work-item projection and inbox E2E pass. |
| US-003 | P0 | As a capture manager, I need discovered RFPs to become durable RFP intake records automatically. | Wave 2 F-005B/F-006B/F-006C/F-007 proof passes with E3 cleanup. |
| US-004 | P0 | As a compliance officer, I need compliance and evidence gates to block unsafe progression. | Wave 3 F-008/F-018A/O-016A proof passes. |
| US-005 | P0 | As a proposal manager, I need proposal tasks, comments, workload, and section health to project into one plan. | Wave 4 F-009/F-014A proof passes. |
| US-006 | P0 | As a writer, I need context-aware content assistance with provenance and resolved placeholders. | Wave 5 F-010/F-011/F-012B/F-013/O-013/O-014A proof passes. |
| US-007 | P0 | As an approver, I need review, pricing, production, and submission gates with immutable rationale. | Wave 6 F-014B/F-018C/F-020/F-021B/O-003B/O-016B proof passes. |
| US-008 | P1 | As an operator/admin, I need imports, partners, reports, health, backup, and incidents to be visible and recoverable. | Wave 7 F-015/F-016/F-019/F-022/O-010/O-011/O-012B/O-015C proof passes. |
| US-009 | P2 | As a platform owner, I need strategic expansion tracked without overclaiming. | Wave 8 strategic rows are implemented or explicitly deferred with owner, rationale, and revisit trigger. |

## Out Of Scope For A Single Wave

No wave may close a downstream facility row unless the ledger names that wave as the pass authority or dependency wave. Support evidence may be added, but only the owning wave may move rows to `pass`.
