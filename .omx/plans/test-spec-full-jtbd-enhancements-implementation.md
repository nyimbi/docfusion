# Test Spec: Full JTBD And Enhancements Implementation

Status: Approved for Ralph execution  
Source plan: `.omx/plans/full-jtbd-enhancements-implementation-plan.md`  
Created: 2026-05-05  

## Verification Principles

- Every wave must run mechanical ledger checks before implementation status is promoted.
- Historical `pass` rows do not prove expanded behavior; expanded subrows must pass.
- Current `frontend/e2e/golden-path.spec.ts` is request-level FastAPI coverage and current `frontend/e2e/workflow-action-panel.spec.ts` is a harness test. They remain useful regressions but do not count as authenticated `next start` journey proof.
- Authenticated browser proof must run from `frontend/` against `next start`, use `E2E_BASE_URL`, establish a real test session, and operate on disposable fixtures.
- Live-safe proof must record run ID, fixture IDs, service target, cleanup status, and failure transcript.

## Baseline Commands

Run from repo root:

```bash
git diff --check
make lint
make type-check
make test
```

Run from `frontend/`:

```bash
npm test -- --run
npx tsc --noEmit
npm run lint
npm run build
npm run workflow:validate-db
npm run test:e2e
```

## Mechanical Ledger Checks

Before and after every wave:

- 75 unique JTBD rows exist in the implementation ledger.
- 25 unique enhancement rows exist in the implementation ledger.
- Every JTBD and enhancement has exactly one primary owning wave.
- Every facility/strategic ledger row has a wave ownership-register entry.
- Every planned expanded/split proof subrow exists in `.omx/state/platform-e2e-facility-ledger.md`.
- No JTBD proof target uses split-parent rows where a subrow owns proof.
- No JTBD proof target names a later-wave facility without declaring that wave in the wave column.
- Every proof target exists in the facility ownership register.

## Wave Proof Matrix

| Wave | Required proof |
|---:|---|
| 0 | Ledger/status contract validates mechanically; catalogue has Live promotion checklist; no missing ownership/proof targets. |
| 1 | Authenticated command-center/inbox/action-panel/audit/sandbox/notification proof; O-003A, O-004B, O-006B, O-015A can move only with evidence. |
| 2 | Discovery/search -> shortlist -> qualify -> ingest -> E3 storage -> parse -> requirement acceptance -> task projection proof; F-005B/F-006B/F-006C cleanup proof. |
| 3 | Compliance lifecycle, readiness blocker, evidence/claim remediation, DLP allow/deny, clarification lifecycle proof. |
| 4 | Proposal plan baseline, task lifecycle, comment-to-task, workload, section-health projection proof. |
| 5 | Editor persistence, context-aware snippets, AI provenance, content library, search/RAG, personnel/past performance/win-theme proof. |
| 6 | Approval cards, review gates, pricing approval, render/export, final checklist, submission receipt, compensation proof. |
| 7 | CRM/partner/import/integration/reporting/health/backup/incident proof with operational dashboards and cleanup. |
| 8 | Strategic rows either pass with proof or remain strategic with owner, rationale, and revisit trigger. |

## Authz And Audit Tests

Every new route/server action must include:

- unauthenticated denial;
- wrong-organization or wrong-resource denial where applicable;
- insufficient-role denial;
- authorized success;
- audit event for sensitive success and denied attempts where appropriate;
- no leakage of unrelated resource existence.

## Browser Proof Requirements

Each authenticated browser spec must:

- create or select a disposable fixture namespace;
- authenticate through the app-supported test session path;
- navigate through the user-facing surface, not only API requests;
- assert visible state, next allowed action, disabled-action reason, and audit/history where applicable;
- assert persisted database or API state;
- clean up all live-mutating data or record cleanup-pending/failure honestly.

## Live Service Proof Requirements

| Service | Required evidence |
|---|---|
| db.lindela.io | Migration validation output, table/column/index presence, fixture cleanup proof. |
| Linode E3 | Server-side PUT/GET/readback checksum and object deletion proof for RFP/final artifacts. |
| Stalwart | Notification row plus terminal delivery-attempt state and transcript; mailbox proof where available. |

## Exit Criteria

Ralph may report completion only when:

- all non-strategic JTBD are `Live` in the catalogue and pass in the implementation ledger;
- all 25 enhancements are implemented or explicitly deferred with owner/rationale;
- all facility rows required by non-strategic JTBD have passing proof or approved exceptions;
- root and frontend verification commands pass after deslop;
- architect verification approves the changed files.
