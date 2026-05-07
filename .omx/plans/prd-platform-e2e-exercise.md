# PRD: Platform End-To-End Exercise

## Intent

Execute a facility-ledger-first, topology-gated, evidence-strict end-to-end exercise of the DocFusion platform. The campaign must prove facilities with run-correlated artifacts and side-effect evidence, not route reachability or harness success alone.

## Context

- Context snapshot: `.omx/context/platform-e2e-exercise-20260503T121602Z.md`
- Consensus result: Architect and Critic approved a two-lane execution model:
  - Product lane: `J1`-`J9`
  - Operator/control-plane lane: `O1`
- Current constraints:
  - Active worktree contains many unrelated modifications; use explicit pathspecs for any commits.
  - Live checks can mutate `db.lindela.io`, Linode E3, Stalwart mail, workflow workers, and external integrations; all live mutation requires fixture namespaces and cleanup status.
  - Harness-only proof cannot mark a facility as passed.

## Principles

1. Facility-ledger-first: validate named facilities, not vague platform claims.
2. Topology-gated: classify each facility before execution so unsupported or legacy surfaces do not contaminate coverage.
3. Evidence-strict: only run-correlated artifacts count.
4. Cleanup-aware: every mutating check must have cleanup status and restore trail.
5. Lane-owned: product `J1`-`J9` and operator/control-plane `O1` exit only through explicit dispositions.

## Scope

### Product Journeys

| Journey | Scope |
|---|---|
| `J1` | Discovery, shortlist, and opportunity triage |
| `J2` | Intake, storage receipt, parse kickoff, provenance |
| `J3` | Requirements acceptance, compliance baseline, evidence linkage |
| `J4` | Proposal planning, task projection, workflow start/transition |
| `J5` | Authoring, snippets/templates/partials, content and knowledge use |
| `J6` | Review, comments, approvals, gate decisions |
| `J7` | Pricing, partners, imports/sync edges |
| `J8` | Render, submission, notifications, receipt |
| `J9` | Outcome capture, reporting, debrief, continuity learning |

### Operator/Control-Plane Journey

| Journey | Scope |
|---|---|
| `O1` | Workflow runtime, template governance, workers, exceptions, scraper scheduling/health, notifications/mail, storage, authz/audit, health checks, backup/restore smoke, observability/remediation |

## Facility Ledger Contract

Every facility row must include:

- `facility`
- `journey`
- `topology_tier`
- `priority`
- `mutability`
- `evidence_class`
- `side_effect_proof`
- `fixture_namespace`
- `cleanup_owner`
- `disposition`
- `artifact_ids`
- `cleanup_status`

Allowed dispositions:

- `pass`
- `partial`
- `fail`
- `docs-only`
- `legacy-topology`
- `credential-missing`
- `strategic`
- `unsupported`

Allowed cleanup statuses:

- `not-applicable`
- `idempotent-noop`
- `restored`
- `cleanup-pending`
- `cleanup-failed`

## Roll-Up Formula

```text
CampaignScopeCount = all in-scope facility rows excluding docs-only, strategic, unsupported, and legacy-topology rows
PassCredit = count(pass rows with valid evidence)
PartialCredit = 0.5 * count(valid partial rows), capped at min(2, floor(CampaignScopeCount * 0.10))
ValidatedCoverage = (PassCredit + PartialCredit) / CampaignScopeCount
```

`credential-missing` rows stay in scope if campaign-relevant and score zero until exercised.

Final success requires:

- all P0 facilities full `pass`
- no `cleanup-pending` or `cleanup-failed`
- no stale-evidence rows
- bounded partials within the formula cap

## Phases

1. Facility ledger and topology gate.
2. Evidence harness and fixture isolation.
3. Product lane execution, `J1`-`J3`.
4. Product lane execution, `J4`-`J6`.
5. Product lane execution, `J7`-`J9`.
6. Operator/control-plane lane, `O1`.
7. Roll-up and gap disposition.

## Acceptance Criteria

- Phase 0 produces a complete facility ledger and topology matrix before live or destructive checks run.
- Every facility is classified with a journey, topology tier, evidence class, mutability, cleanup owner, and disposition.
- Product lane and operator/control-plane lane have separate exit criteria and a merged final report.
- Every `pass` or `partial` has artifact IDs, topology class, verification bucket, timestamp, operator, and cleanup status.
- Mutating live/seeded runs without post-run audit and cleanup status are downgraded to `fail`.
- Final report uses the approved roll-up formula and does not count `docs-only`, `strategic`, `unsupported`, `credential-missing`, or `legacy-topology` as validated coverage.

## Non-Goals

- Do not flatten all surfaces into a single “platform works” claim.
- Do not run destructive live checks before facility ledger, fixtures, and cleanup rules exist.
- Do not commit unrelated dirty worktree changes.
