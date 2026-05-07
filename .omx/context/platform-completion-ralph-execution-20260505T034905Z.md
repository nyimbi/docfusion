# Platform Completion Ralph Execution Context

## Task Statement

Execute Phase 0 and Phase 1 from `.omx/plans/platform-completion-next-phase-plan.md`.

## Desired Outcome

- Reuse the existing May 3 facility ledger and topology contract.
- Make `F-006` and `O-006` pass with run-correlated evidence.
- Make at least one of `O-003` or `O-004` pass.
- Convert any unsafe targeted row to `blocked` with evidence rather than leaving it `partial`.
- Capture evidence in `.omx/state/platform-completion-phase1-evidence.md`, `.omx/state/platform-e2e-facility-ledger.md`, `.omx/state/platform-e2e-topology-matrix.md`, and `.omx/logs/platform-completion/<run-id>/`.

## Known Facts / Evidence

- The approved execution plan is `.omx/plans/platform-completion-next-phase-plan.md`.
- Existing PRD and test spec gates are present in `.omx/plans/prd-platform-e2e-exercise.md` and `.omx/plans/test-spec-platform-e2e-exercise.md`.
- May 3 ledger rows currently targeted by this tranche are:
  - `F-006`: `partial`, happy-path parse only; failed-parse remediation not exercised.
  - `O-003`: `partial`, action panel/submission workflow exercised; live reversal/remediation proof missing.
  - `O-004`: `partial`, template simulation exercised; publication/deprecation lifecycle missing.
  - `O-006`: `partial`, dispatch route/worker callable but no Stalwart mailbox or delivery-attempt proof.
- Current topology assumes `db.lindela.io`, Linode E3 object storage, and Stalwart mail.
- The branch is one commit ahead of origin from the ralplan artifact commit.
- `.serena/project.yml` has unrelated generated tooling drift and must not be included in Ralph commits unless intentionally resolved.
- `docs/shared/agent-tiers.md` is absent in this checkout; Ralph will use the AGENTS.md roster and native role selection instead.

## Constraints

- Keep implementation scoped to Phase 0/1 only.
- Do not re-prove already passing rows unless needed as prerequisite evidence.
- Use disposable fixtures, run namespaces, cleanup proof, and audit artifacts for any live mutation.
- Queue-only notification evidence is insufficient for `O-006`.
- No targeted row may remain `partial` at Phase 1 exit.
- Do not commit unrelated dirty worktree changes.

## Unknowns / Open Questions

- Whether Stalwart credentials/test mailbox are available in the current environment.
- Whether the current local environment can safely reach `db.lindela.io` and Linode E3 during this run.
- Which of `O-003` or `O-004` has the safer explicit state model for a live mutable pass in this tranche.

## Likely Codebase Touchpoints

- `frontend/app/api/v1/rfp/[rfpId]/parse/route.ts`
- `frontend/lib/actions/rfp-parser.ts`
- `frontend/lib/services/rfp-document-service.ts`
- `frontend/lib/actions/workflow-runtime.ts`
- `frontend/lib/actions/workflow-domain.ts`
- `frontend/app/api/v1/workflows/**`
- `frontend/scripts/*workflow*`
- `frontend/__tests__/**`
- `frontend/e2e/**`
- `.omx/state/platform-e2e-facility-ledger.md`
- `.omx/state/platform-e2e-topology-matrix.md`
- `.omx/state/platform-completion-phase1-evidence.md`
