# Test Spec: Platform End-To-End Exercise

## Objective

Verify DocFusion through a facility-ledger-first, topology-gated, evidence-strict campaign. This test spec defines what evidence is required before a facility can be marked `pass` or `partial`.

## Verification Buckets

| Bucket | Purpose | Expected Evidence |
|---|---|---|
| Unit | Local business rules, classifiers, guards, cleanup helpers | Test output, facility row validator output |
| Integration | DB/API/storage/mail/worker interactions with seeded dependencies | API transcripts, SQL snapshots, worker output, adapter proof |
| E2E | Browser or operator-driven behavior over real app/runtime boundaries | Playwright traces/screenshots/videos, browser transcripts |
| Observability | Audit events, queue state, logs, delivery traces, storage objects, cleanup audits | Audit rows, object manifests, mail/notification records, cleanup reports |

## Deliberate Pre-Mortem

| Scenario | Detection | Mitigation | Fallback Disposition |
|---|---|---|---|
| Topology misclassification | Facility needs a higher/lower topology than ledgered, or dependencies contradict the classification | Review topology before execution, require dependency note per facility, reclassify before rerun | Mark `fail` or `credential-missing`/`legacy-topology` as applicable; remove any prior coverage claim |
| Stale or non-isolated evidence | Artifact timestamps, run IDs, or fixture hashes do not match; reused objects, email, or logs appear across runs | Per-run namespace, artifact naming standard, freshness check before roll-up | Downgrade affected row to `fail`; no credit until rerun with isolated evidence |
| Cleanup or restore side effects | Post-run audit differs from baseline, residual objects/messages/jobs remain, or rollback is incomplete | Baseline audit, reserved fixtures, mandatory post-run audit, explicit restore checklist | Block lane exit; row becomes `fail` or bounded `partial` only if residual impact is documented and accepted |

## Evidence Schema

Every `pass` or `partial` result must include:

- `facility`
- `journey`
- `run_id`
- `artifact_ids`
- `topology_tier`
- `verification_bucket`
- `timestamp`
- `operator`
- `cleanup_status`
- `disposition`
- `notes`

Missing any required field fails the row.

## Product Lane Exit Criteria

- `J1`-`J9` each have all in-scope facility rows dispositioned.
- Every `pass` or `partial` row has artifact IDs and cleanup status.
- No stale or cross-run evidence remains attached.
- All P0 product facilities are full `pass`.
- Acceptable partials are limited to bounded non-P0 edges, with no more than 2 journey-level partials and no more than 10% partial credit across eligible product facilities.
- Any `cleanup-pending` or `cleanup-failed` row blocks lane exit.

## Operator/Control-Plane Exit Criteria

- Workflow runtime, template governance, worker execution, notification/mail, storage, authz/audit, operational exceptions, observability, scraper scheduling/health, health checks, and backup/restore smoke are all dispositioned.
- Every `pass` or `partial` row has artifact IDs and cleanup status.
- All mutating checks are `restored` or `idempotent-noop`.
- No stuck queued jobs, orphaned fixture artifacts, or unresolved exception items created by the campaign remain.
- Acceptable partials are allowed only for bounded external-delivery or credential-dependent edges where queueing, audit, error surfacing, and rollback/cleanup were still proven.

## Initial Command Gates

Run these before live/destructive checks:

```bash
cd frontend
npx tsc --noEmit
npm run lint
npm run build
npm test -- --run
npm run test:e2e -- e2e/snippet-expansion.spec.ts e2e/workflow-action-panel.spec.ts
npx tsx scripts/validate-workflow-runtime-migration.ts
npx tsx scripts/ensure-snippet-context-fixtures.ts --audit --confirm-host db.lindela.io
```

Live authenticated and external integration gates are opt-in and must use the facility ledger run ID and fixture namespace:

```bash
cd frontend
E2E_BASE_URL=http://localhost:32133 RUN_LIVE_SNIPPET_FIXTURE_E2E=1 npx playwright test e2e/snippet-fixture-authenticated.live.spec.ts --workers=1 --reporter=line
```

## Roll-Up Verification

Apply this formula exactly:

```text
CampaignScopeCount = all in-scope facility rows excluding docs-only, strategic, unsupported, and legacy-topology rows
PassCredit = count(pass rows with valid evidence)
PartialCredit = 0.5 * count(valid partial rows), capped at min(2, floor(CampaignScopeCount * 0.10))
ValidatedCoverage = (PassCredit + PartialCredit) / CampaignScopeCount
```

Final success requires:

- all P0 facilities full `pass`
- no `cleanup-pending` or `cleanup-failed`
- no stale-evidence rows
- bounded partials within the cap above
