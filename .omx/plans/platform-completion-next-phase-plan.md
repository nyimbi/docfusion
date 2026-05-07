# Platform Completion Next Phase Plan

**Date:** 2026-05-04  
**Mode:** Deliberate consensus execution plan  
**Inputs:** `.omx/context/platform-completion-next-phase-20260504T200747Z.md`, `docs/platform-jtbd-catalogue.md`, `docs/plans/2026-04-22-master-completion-plan.md`, `.omx/state/platform-e2e-facility-ledger.md`, `.omx/state/platform-e2e-topology-matrix.md`, `.omx/plans/prd-platform-e2e-exercise.md`

## Evidence Reconciliation

| Area | Current evidence | Planning consequence |
|---|---|---|
| Workflow runtime control plane | Workflow runtime tables, actions, API routes, worker scripts, migration apply/validate scripts, and tests exist in `frontend/lib/actions/workflow-runtime.ts`, `frontend/app/api/v1/workflows/**`, `frontend/scripts/*workflow-runtime*`, `frontend/__tests__/actions/workflow-runtime.test.ts`, and `frontend/e2e/workflow-action-panel.spec.ts`. | April plan items claiming runtime absence are stale. Remaining work is reliability, domain adoption, and live proof, not net-new runtime creation. |
| RFP/discovery endpoints | `src/docfusion/api/endpoints/rfp_endpoints.py` and `discovery_endpoints.py` exist. | “Create endpoints” is stale. Remaining work is persistence and real workflow bridging where these endpoints must become production-grade. |
| Canonical RFP path | `frontend/app/api/v1/rfp/upload/route.ts` writes to Linode E3 when configured and only proxies to FastAPI when `USE_PYTHON_RFP` is enabled and E3 config is absent. `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts` runs local parse jobs for frontend-owned documents. | Do not reopen a Python-first canonicalization project in P0. Treat the current Next.js plus E3 path as canonical for the first tranche. |
| Stub inventory | `rg -n "NotImplementedError" src/docfusion backend -g '*.py'` only reports `backend/discovery/scrapers/base.py` plus a sanctioned replacement note. | The April stub-closure programme is stale and should not drive the next phase. |
| `ai_agents` placeholder | `docs/technical/design_decisions/2026-04-22-ai-agents-placeholder.md` already resolves the namespace question. | Remove this from remaining-work scope. |
| Infra assumptions | March readiness docs still target Azure VM and Postfix; current context and code assume `db.lindela.io`, Linode E3, and Stalwart. | Treat old infrastructure docs as engineering-debt cleanup, not architecture truth. |
| Remaining high-risk P0 gaps | `docs/platform-jtbd-catalogue.md` still marks P0 gaps in bid/no-bid authority and package freeze, compliance final lock/report packaging, production/render/submission workflow, workflow runtime idempotency and pause/resume, operations/backup/restore proof, and live validation. | These become the real P0 completion backlog after the proof tranche. |
| May 3 E2E evidence state | `.omx/state/platform-e2e-facility-ledger.md` records pass/partial evidence for the current proof campaign. F-005, F-012, F-021, O-001, O-002, O-005, O-007, O-008, and O-012 are `pass`. F-006, O-003, O-004, and O-006 remain `partial`. | Phase 0/1 must reuse the existing facility-ledger/topology contract and upgrade named partial P0 rows instead of creating a blank proof model. |
| Notification topology | `.omx/state/platform-e2e-topology-matrix.md` records Stalwart as the current mail provider and says queue-only notification execution is partial because no mailbox/delivery-attempt proof was captured. | Phase 1 cannot pass on notification queue creation alone. It must capture delivered mail or delivery-attempt evidence. |

## RALPLAN-DR

### Principles

1. Prove readiness with run-correlated evidence before broadening scope.
2. Reconcile against current code and topology, not stale plan inventories.
3. Preserve the current runtime split for the proof tranche only: Next.js + E3 owns the active product path until Phase 1 evidence forces or clears a long-term ownership decision.
4. Keep P0 tranches small, reversible, fixture-isolated, and operationally auditable.
5. Harden the workflow runtime enough for critical paths before expanding it across more domains.

### Top Drivers

- The biggest immediate risk is claiming platform completeness from local tests without live proof on `db.lindela.io`, Linode E3, and Stalwart.
- The highest business-risk gaps are still P0: submission/render/compliance/gate correctness and operational recovery.
- The repo already contains broad partial implementation, so breadth-first expansion would create churn and hide the real blockers.

### Options Considered

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A | Live-proof-first narrow tranche, then close P0 gaps | Fastest truth signal; validates current topology; limits wasted implementation | Surfaces blockers early; may delay polish work | **Chosen** |
| B | Breadth-first closure of all partial JTBD rows before live proof | More apparent feature breadth | Large diff; weak operational confidence; likely rework after first live exercise | Rejected |
| C | Canonicalize around Python/FastAPI first, then validate | Single-backend theory | Conflicts with current E3-backed product path; reopens already-settled runtime ownership | Rejected |

### Decision

Adopt an evidence-first next phase:

- First, close the current May 3 partial P0 proof rows using the existing facility-ledger/topology contract.
- Second, use the blockers exposed by that tranche to finish the true P0 functional and operational gaps.
- Third, expand P1 workflow coverage and deferred product capability only after P0 proof is stable.

## Deliberate Pre-Mortem

| Scenario | Detection | Mitigation | Fallback |
|---|---|---|---|
| Live proof is blocked by credential or topology drift | Preflight fails for DB, E3, Stalwart, or authenticated UI | Add a Phase 0 credential matrix, per-run namespace, and explicit preflight command gate before any mutating run | Downgrade to seeded integration proof only for the blocked facility and keep it open for live rerun |
| The “small” first tranche expands into a platform rewrite | New issues pull in submission, partner, portal, or e-signature work not needed for proof | Tranche exit is fixed to one product journey and one ops journey plus blocker fixes only | Stop tranche work, document blockers, and move remaining changes into Phase 2 or later |
| Workflow runtime fails under retries, notifications, or remediation | Duplicate runtime rows, stuck notifications, missing audit events, or uncleared exception items appear during proof | Include induced failure, SLA, notification, exception, and cleanup evidence in tranche acceptance | Treat runtime reliability as the next blocking P0 lane before any broader workflow adoption |

## Phased Work Packages

### Phase 0 — Reality Gate And Proof Harness

**Purpose:** Start from the current May 3 proof state and make the next proof run repeatable without losing the existing ledger semantics.

**Scope**

- Reuse the facility-ledger/topology contract from `.omx/plans/prd-platform-e2e-exercise.md`.
- Load the current starting state from `.omx/state/platform-e2e-facility-ledger.md` and `.omx/state/platform-e2e-topology-matrix.md`.
- Freeze these current P0 partial rows for the next phase:
  - `F-006` RFP parse status and failed-parse remediation.
  - `O-003` workflow runtime start/transition/reversal, with live remediation/reversal proof.
  - `O-004` workflow template governance publication/deprecation lifecycle.
  - `O-006` notification dispatch through Stalwart.
- Standardize run ID, fixture namespace, cleanup owner, and artifact naming.
- Record which live credentials exist locally, in CI, and only in operator environments.
- Update the active topology assumptions for `db.lindela.io`, Linode E3, and Stalwart.

**Deliverables**

- Updated facility ledger based on `.omx/state/platform-e2e-facility-ledger.md`, not a blank replacement.
- Preflight checklist and cleanup contract.
- Stale-doc list to correct later in the debt lane.
- Evidence artifact destinations:
  - Ledger updates: `.omx/state/platform-e2e-facility-ledger.md`
  - Topology updates: `.omx/state/platform-e2e-topology-matrix.md`
  - Phase evidence roll-up: `.omx/state/platform-completion-phase1-evidence.md`
  - Raw run logs/artifacts: `.omx/logs/platform-completion/<run-id>/`

**Acceptance Criteria**

- Every first-tranche facility has a named owner, mutability class, evidence class, and cleanup status rule.
- A single preflight gate can say `go`, `seeded-only`, or `blocked` per facility.
- No execution plan step still depends on Azure VM or Postfix assumptions.
- The starting ledger retains existing `pass` rows and only changes rows with fresh evidence.
- No Phase 1 work starts until `O-006` Stalwart credentials/test mailbox status is either `go` or explicitly `blocked`.

### Phase 1 — P0 First Tranche: Close Current Partial P0 Proof Rows

**Purpose:** Close the named current partial P0 proof rows into explicit `pass` or `blocked` outcomes before broader buildout.

**Product journey in scope**

- `F-006`: failed-parse remediation, not just happy-path parse. Exercise retry, reject, or manual-extraction remediation with parse job status/history, audit metadata, and cleanup proof.
- Reuse existing `F-005` RFP storage proof only as prerequisite evidence; do not re-run E3 upload unless needed to create a disposable failed-parse fixture.

**Operator journey in scope**

- `O-006`: workflow notification dispatch through Stalwart with delivered mailbox proof or captured SMTP delivery-attempt/failure proof. Queue creation alone remains `partial`.
- `O-003`: one live workflow reversal/remediation path with before/after instance/task/audit evidence, unless `O-004` provides the safe mutable governance proof and `O-003` has a documented blocker.
- `O-004`: template publication/deprecation mutation proof if credentials and cleanup semantics permit, unless `O-003` provides the safe mutable workflow proof and `O-004` has a documented blocker.

**Not in scope**

- Full submission dispatch, e-signature, partner portal, and broad cross-domain adoption.
- Converting FastAPI placeholder surfaces into production-grade systems unless directly required to pass the tranche.
- Re-proving existing `pass` rows such as `F-005`, `F-021`, `O-005`, `O-007`, `O-008`, or `O-012` without a new blocker.

**Acceptance Criteria**

- `F-006` moves from `partial` to `pass` only if failed-parse remediation is exercised and ledgered with parse job status/history, retry/reject/manual action evidence, and cleanup status `restored` or `idempotent-noop`.
- `O-006` moves from `partial` to `pass` only if a workflow notification has delivered-mailbox proof or a concrete Stalwart SMTP delivery-attempt transcript with row status. A queued row without delivery attempt remains `partial`.
- Phase 1 completion uses these per-row exit rules:

  | Row | Required exit for Phase 1 complete | Allowed blocked exit | Phase 1 result if blocked |
  |---|---|---|---|
  | `F-006` | `pass` with failed-parse remediation evidence and cleanup proof. | Only for a fixture/runtime blocker that prevents exercising remediation after a narrowed fix attempt. | Phase 1 is `blocked`, not complete. |
  | `O-006` | `pass` with Stalwart mailbox proof or concrete SMTP delivery-attempt transcript. Queue-only evidence remains `partial`. | Missing/invalid Stalwart credential, unavailable test mailbox, or unreachable SMTP endpoint after preflight. | Phase 1 is `blocked`, not complete. |
  | `O-003` | `pass` unless `O-004` supplies the safe mutable proof. | Subject state model or compensation semantics are not explicit enough for live reversal/remediation. | Phase 1 can complete only if `O-004` passes and `O-003` is changed from `partial` to `blocked` with evidence. |
  | `O-004` | `pass` unless `O-003` supplies the safe mutable proof. | Template publication/deprecation is not safely mutable or cleanup cannot be guaranteed. | Phase 1 can complete only if `O-003` passes and `O-004` is changed from `partial` to `blocked` with evidence. |

- Phase 1 cannot complete with any targeted row still `partial`; required rows `F-006` and `O-006` must be `pass`.
- At least one safe mutable operator/governance row, `O-003` or `O-004`, must be `pass`. If both are blocked, Phase 1 is `blocked`, not complete.
- Cleanup status is `restored` or `idempotent-noop` for every mutated facility.
- Fixes made during the tranche are limited to blockers required to pass these checks.
- Completion evidence is recorded in the exact artifact destinations named in Phase 0.

### Phase 2 — P0 Functional Completeness

**Purpose:** Close the business-critical gaps exposed by the tranche and still marked P0 in the JTBD catalogue.

**Scope bucket: P0 functional completeness**

- Bid/no-bid authority policy, scoring/rubric lock, package snapshot, and immutable decision evidence.
- Compliance matrix final lock, waiver/sign-off completeness, report packaging linkage, and audit package retention hooks.
- Document approval state machine with server-enforced transitions, delegation rules, and SLA/escalation hooks.
- Production/render/submission workflow with immutable artifact receipts, approval gates, correction/reversal path, and dispatch-proof capture.

**Explicit sequencing**

- Do not treat e-signature as blocking for this phase unless the actual dispatch path in use requires it.
- Prefer receipt capture and immutable artifact proof first; provider-backed signatures stay behind that unless a real deployment requirement forces promotion.

**Acceptance Criteria**

- A bid/no-bid package cannot pass without authority, rationale, and snapshot evidence.
- A compliance matrix cannot be marked final without mandatory-row coverage, waiver evidence, and report-package linkage.
- A submission cannot be recorded without approved artifacts, receipt proof, and a reversible audit trail.
- Approval and submission transitions are server-enforced and visible in workflow audit data.

### Phase 3 — P0 Operational Hardening

**Purpose:** Make the control plane safe for critical-path use.

**Scope bucket: P0 operational hardening**

- Runtime idempotency for start, transition, retry, and notification dispatch.
- Pause/resume and explicit recovery semantics for active workflows.
- Health-alert worker wiring, notification retry behavior, and exception triage visibility.
- Backup verification and restore smoke for the active topology.
- Migration precheck, rollback evidence, and operator-safe deployment gates.

**Architectural guardrail**

- Choose one recovery model for critical paths: explicit runtime/event-bus orchestration or documented scheduler-driven retry semantics. Do not half-build both in P0.

**Acceptance Criteria**

- Replayed or duplicated events do not create duplicate runtime truth for the same workflow subject.
- Operators can pause, resume, and remediate the in-scope workflow paths with audit evidence.
- A backup/restore smoke run and a migration rollback drill produce stored evidence, not just scripts.
- Health and exception signals surface before the queue silently stalls.

### Phase 4 — P1 Workflow Coverage

**Purpose:** Extend the proven control plane into adjacent workflows once P0 is stable.

**Scope bucket: P1 workflow coverage**

- Discovery-to-intake persistence bridge beyond placeholder ingestion behavior.
- Daily digest and task projection coverage.
- Partner and external portal workflows.
- Actionable notification center and richer portal actions.
- Broader workflow-runtime adoption across domains already emitting best-effort events.

**Acceptance Criteria**

- Each added workflow has a named owner, runtime coverage, notification/escalation path, and reversal rule.
- New coverage lands only after the owning business transition is reliable enough to fail closed or compensate safely.

### Phase 5 — P1/P2 Product Capability

**Purpose:** Tackle deferred capability once the core platform is proven and hardened.

**Scope bucket: P1/P2 product capability**

- E-signature and provider-backed signing if still in scope after Phase 2 reality.
- Presentation/graphics/export edges not required for core proposal dispatch.
- AI-agent workflow integration beyond today’s broad-but-partial specialist capability.
- Additional analytics or external integrations that depend on stable P0/P1 workflows.

**Acceptance Criteria**

- Each promoted feature is attached to a proven workflow owner and verification path.
- No P1/P2 feature reopens unresolved P0 topology or control-plane ambiguity.

### Phase 6 — Engineering Debt And Topology Cleanup

**Purpose:** Remove stale assumptions and dual-path confusion that would otherwise recreate drift.

**Scope bucket: engineering debt**

- Replace stale Azure/Postfix documentation and runbooks.
- Document canonical ownership for Next.js versus FastAPI surfaces.
- Delete or quarantine obsolete fallback paths and outdated master-plan items.
- Add parity or drift checks where schema and runtime ownership are split.
- Raise verification floors only after the first-proof baseline is stable.

**Acceptance Criteria**

- A new contributor can tell which runtime owns each critical path without consulting stale plans.
- Old docs no longer contradict the active deployment topology.
- Debt reductions do not widen scope beyond the owning proven workflow.

## Verification Plan

| Layer | What it must prove | Initial focus |
|---|---|---|
| Unit | Guards, transitions, validators, cleanup helpers, ledger validation | Workflow transition rules, submission/compliance validators, pause/resume and idempotency guards |
| Integration | Real interactions across DB, object store, mail, worker, and migration tools | `workflow_instances`/`workflow_audit_events` writes, failed-parse remediation records, Stalwart delivery attempts, migration apply/validate/rollback evidence |
| E2E | Browser-visible behavior over real app boundaries | Existing workflow action panel plus one authenticated golden-path UI exercise when credentials allow |
| Live observability | Run-correlated operational proof and cleanup | Audit rows, delivered notification state or SMTP transcript, mail traces, storage receipts, worker logs, exception queue state, cleanup report |

### First-Tranche Verification Gate

1. Local quality gate for touched paths.
2. Seeded integration proof where live systems are unavailable.
3. Live fixture-scoped partial-row closure run for `F-006`, `O-006`, and whichever of `O-003`/`O-004` is safely mutable.
4. Live fixture-scoped operator/remediation run with Stalwart delivery-attempt evidence.
5. Cleanup audit and evidence roll-up.

A facility does not count as passed without run-correlated evidence and cleanup status.

## ADR

**Decision:** Use an evidence-first P0 completion sequence, treating the current Next.js + Linode E3 path as canonical for the proof tranche only, with workflow-runtime hardening before broader platform expansion.

**Drivers**

- The active product path already lives in the Next.js plus E3 runtime.
- The biggest remaining risk is false confidence from local coverage without live proof.
- The workflow runtime already exists and is the shortest path to proving or disproving platform readiness.
- The May 3 facility ledger already identifies which P0 proof rows remain partial, so the next phase should close those rows rather than start from a blank proof model.

**Alternatives considered**

- Breadth-first completion of all partial JTBD rows before live proof.
- Python/FastAPI-first canonicalization before validating the current product path.

**Why chosen**

- It aligns with current evidence instead of reopening stale architecture debates.
- It minimizes wasted implementation by letting one live proof run expose the real blockers.
- It keeps the first tranche small enough for `ralph` or a small `team` to execute safely.

**Consequences**

- Some placeholder FastAPI surfaces remain deferred unless the proof tranche shows they block the active platform path.
- P0 completion becomes proof-driven rather than backlog-count-driven.
- Documentation cleanup becomes a real work lane because topology drift is now a material source of delivery risk.
- A post-Phase-1 ownership ADR checkpoint is mandatory before declaring Next.js/FastAPI long-term boundaries settled.

**Follow-ups**

- Reassess whether any deferred FastAPI surfaces should be promoted after Phase 1 evidence.
- Reassess whether e-signature is required for real submission dispatch before Phase 5 starts.
- Convert the first-tranche facility ledger into the standing release-readiness ledger if the model works.
- Write or update a post-Phase-1 ADR covering long-term RFP/discovery ownership if discovery ingest, heavy parsing, or runtime durability failures show the current split is blocking.

## Agent Roster

| Agent type | Primary role in this programme | Suggested reasoning |
|---|---|---|
| `planner` | Maintain phase boundaries, acceptance criteria, and evidence roll-up | `medium` |
| `architect` | Resolve runtime ownership and hardening tradeoffs | `high` |
| `executor` | Implement bounded product and ops changes | `high` |
| `debugger` | Investigate live-proof failures and retry/idempotency bugs | `high` |
| `test-engineer` | Build or tighten unit, integration, and E2E gates | `medium` |
| `verifier` | Validate evidence, cleanup, and phase exit claims | `high` |
| `researcher` | Confirm external/operator docs and deployment assumptions | `high` |

## Follow-Up Staffing Guidance

### Ralph path

Use `ralph` for **Phase 0 and Phase 1 only**.

- Keep a single owner responsible for the proof tranche.
- Require verifier checkpoints after preflight, live product run, live ops run, and cleanup.
- Do not let `ralph` widen into Phase 2 without a fresh checkpoint against this plan.

**Launch hint**

```text
$ralph "Execute Phase 0 and Phase 1 from .omx/plans/platform-completion-next-phase-plan.md only. Start from .omx/state/platform-e2e-facility-ledger.md, make F-006 and O-006 pass, make at least one of O-003/O-004 pass, convert any unsafe targeted row to blocked with evidence, capture run-correlated evidence in the named artifact paths, and stop after proof plus blocker fixes."
```

### Team path

Use `team` for **Phase 1 if live proof needs parallel lanes**, and for **Phases 2-3** once blockers are known.

**Recommended Phase 1 lanes**

1. Product proof lane: `F-006` failed-parse remediation and cleanup.
2. Ops proof lane: `O-006` Stalwart dispatch proof plus at least one safe `O-003`/`O-004` mutation and blocker evidence for any unsafe targeted row.
3. Test lane: unit/integration/E2E harnesses and fixture helpers.
4. Verification lane: evidence ledger, artifact collection, cleanup sign-off.

**Recommended Phase 2-3 lanes**

1. P0 functional completeness lane.
2. P0 operational hardening lane.
3. Verification and release-readiness lane.

**Launch hint**

```text
$team "Execute Phase 1 from .omx/plans/platform-completion-next-phase-plan.md with four lanes: F-006 proof, O-006/O-003/O-004 proof, test harness, verification. Required pass rows are F-006 and O-006; at least one of O-003/O-004 must pass; unsafe targeted rows must become blocked with evidence, not remain partial. Reuse the existing facility ledger/topology matrix and keep writes scoped to tranche blockers only."
```

### Team verification path

1. Each lane reports facility-level evidence and cleanup status.
2. The verifier lane reruns the agreed proof gates independently.
3. The leader does not mark Phase 1 complete until targeted rows satisfy the per-row exit table: `F-006` and `O-006` are `pass`, at least one of `O-003`/`O-004` is `pass`, and no targeted row remains `partial`.

## Handoff

This plan is ready for execution handoff. Start with Phase 0 and Phase 1 only; use the results of the first proof tranche to refine Phase 2 scope instead of implementing the whole remaining backlog in one pass.
