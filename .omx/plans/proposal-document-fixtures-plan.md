# Proposal Document Fixture Plan

## Requirements Summary

Solve the missing data-fixture gap that prevented full manual snippet expansion verification through `/documents/[id]`:

- materialize canonical `proposal_documents` links in a repeatable way,
- materialize `documents.metadata.opportunityId` fallback fixtures in a repeatable way,
- materialize an ambiguous multi-link negative fixture,
- provide safe audit/apply commands and verification evidence without relying on ad hoc production fixture mutation.

## RALPLAN-DR Summary

### Principles

- Treat `proposal_documents` as the canonical document-to-opportunity relationship.
- Treat `documents.metadata.opportunityId` as fallback compatibility and fixture coverage, not the preferred relationship.
- Make fixture creation deterministic, idempotent, auditable, and clearly marked as verification/demo data.
- Keep implementation narrow: data fixture support and verification, not a broad document-domain remodel.
- Preserve existing resolver semantics unless tests prove an actual bug.

### Decision Drivers

- The current schema already supports both required branches; live/dev data does not.
- Manual `/documents/[id]` verification needs real document IDs that exercise each branch.
- Production-safety matters because fixture creation can mutate live database rows.
- Document fixture identity is metadata-backed rather than constrained by a database index, so apply-time serialization is required.
- Browser-route verification is not fully read-only because shortcut expansion increments snippet analytics; current `/documents/[id]` route proof should not claim persisted document content/version writes unless an explicit save or Yjs persistence path is separately verified.

### Viable Options

#### Option A: Idempotent fixture/audit command plus focused tests

Create a dedicated script/action that can audit current data and, when explicitly run with `--apply`, ensure deterministic fixture opportunities/documents for canonical, metadata fallback, and ambiguous branches.

Pros:
- repeatable across local/dev/live-like databases,
- avoids broad application refactors,
- gives manual verification concrete document URLs,
- keeps production mutation behind an explicit command.

Cons:
- fixture rows must be clearly separated from real pipeline data,
- does not automatically repair every historical document.

#### Option B: Backfill all metadata-only documents into `proposal_documents`

Scan existing documents with `metadata.opportunityId` and create canonical links.

Pros:
- improves canonical data hygiene for real documents,
- reduces reliance on fallback over time.

Cons:
- risky if old metadata is stale or ambiguous,
- can silently change context resolution for documents,
- does not create a deliberate metadata-only fallback fixture.

#### Option C: Modify all document creation flows to require opportunity context

Change template, generated, imported, duplicate, and proposal creation flows to accept or infer `opportunityId`.

Pros:
- long-term product consistency.

Cons:
- much larger blast radius,
- does not solve current live fixture verification quickly,
- risks pushing opportunity-specific assumptions into generic document flows.

### Chosen Direction

Choose **Option A** now. Keep this plan fixture-only: do not change general production document creation behavior, and do not convert metadata fallback into the primary source.

### Invalidation Rationale

- Reject Option B as the default because automatic historical backfill can change document context semantics without owner review.
- Reject Option C for this pass because generic document creation surfaces are not all opportunity-scoped.

## ADR

### Decision

Add an explicit snippet-context fixture/audit path that creates three deterministic verification documents:

1. **Canonical single-link document**: one `proposal_documents` row points to one opportunity.
2. **Metadata fallback document**: zero `proposal_documents` rows; `documents.metadata.opportunityId` points to one opportunity.
3. **Ambiguous document**: two `proposal_documents` rows point to two different opportunities and trigger an ambiguity diagnostic.

### Drivers

- The resolver branches are implemented and unit-tested.
- Manual route verification requires concrete, linked rows.
- The solution should be safe to run repeatedly against `db.lindela.io` or local dev without duplicating data.
- Live-like mutation must require an explicit second confirmation beyond `--apply`.

### Alternatives Considered

- Historical metadata-to-link backfill.
- Full document creation API refactor.
- Leaving verification purely at resolver-test level.

### Why Chosen

Fixture/audit support directly solves the validation gap while preserving the platform's canonical relationship model.

### Consequences

- Fixture rows become part of controlled dev/demo/test data and must be tagged/flagged.
- Future production repair can reuse the audit classification ideas, but touching historical non-fixture rows requires a separate operator-reviewed tool and plan.
- Manual verification can cite generated document URLs and branch summaries, but route-based shortcut expansion may increment snippet analytics.
- Fixture apply uses a transaction-scoped advisory lock rather than a new schema-level unique index for `documents.metadata.fixtureKey`.

### Follow-ups

- Add an operator-approved historical repair mode after fixture support is proven.
- Consider making opportunity-aware document creation APIs stamp `metadata.opportunityId` in a separate product pass with downstream-consumer tests.

## Implementation Steps

### 1. Add Data-Audit Helpers

Files:

- `frontend/lib/snippets/snippet-context-fixtures.ts`
- `frontend/scripts/ensure-snippet-context-fixtures.ts`

Work:

- Implement read-only audit helpers that return:
  - total documents,
  - total `proposal_documents`,
  - number of single-link documents,
  - number of ambiguous-link documents,
  - number of zero-link metadata fallback documents,
  - existing fixture IDs by fixture key.
- Keep output free of secrets.

Acceptance criteria:

- Audit mode runs without mutation.
- Audit distinguishes canonical, metadata fallback, and ambiguous branches.

### 2. Add Idempotent Fixture Creation

Files:

- `frontend/lib/snippets/snippet-context-fixtures.ts`
- `frontend/scripts/ensure-snippet-context-fixtures.ts`

Work:

- Add `--apply` gated fixture creation.
- Import `frontend/scripts/load-env.ts` before importing database modules so `.env` / `.env.local` resolution matches existing operational scripts.
- Define production-like targets conservatively:
  - `NODE_ENV=production`,
  - `DATABASE_URL` host contains `db.lindela.io`,
  - `DATABASE_URL` database name or host contains `prod` or `production`.
- Add a second mutation guard for production-like targets:
  - audit mode is always read-only,
  - `--apply` prints the resolved database host/name,
  - if the target is production-like, mutation requires `--allow-production` or `--confirm-host <expected-host>`.
- Run the full apply operation in one transaction and take a namespace advisory lock before reading or writing fixture rows, using the repo's existing pattern, for example `pg_advisory_xact_lock(hashtext('snippet-context-fixtures'))`.
- Use reserved fixture keys in `documents.metadata.fixtureKey`, `opportunities.metadata.fixtureKey`, and a composite opportunity identity of `opportunities.sourceId = <fixture-key>` plus `opportunities.sourceFile = "snippet-context-fixtures"`, for example:
  - `snippet-context-single-link`,
  - `snippet-context-metadata-fallback`,
  - `snippet-context-ambiguous-a`,
  - `snippet-context-ambiguous-b`.
- Ensure fixture opportunities include realistic Datacraft/client fields used by placeholders:
  - `organization`,
  - `title`,
  - `deadline`,
  - `rfpLink`,
  - `budgetValue`,
  - `metadata.solicitationNumber`.
- Ensure fixture documents include realistic metadata scalar fallback fields where relevant:
  - `clientName` set to a distinctive value such as `Ambiguous Fixture Client` for the ambiguous fixture so the browser proof can distinguish document-scalar resolution from opportunity resolution,
  - `rfpNumber`,
  - `dueDate`,
  - `projectValue`,
  - `opportunityId` only for the metadata fallback fixture.
- Create canonical `proposal_documents` rows with `onConflictDoNothing` or equivalent duplicate-safe logic.
- For metadata fallback fixture, assert zero `proposal_documents` rows for that document.
- For ambiguous fixture, assert two distinct linked opportunity IDs.
- Hard-fail before applying if any fixture key resolves to more than one opportunity under the reserved `(sourceId, sourceFile)` identity.
- Hard-fail before applying if any fixture key resolves to more than one document under `documents.metadata.fixtureKey`.
- The current `--apply` mode may create or update only rows identified by these reserved fixture keys. It must never infer, relink, backfill, or repair unlabeled historical documents.
- Reserved fixture drift behavior:
  - missing reserved fixture opportunities, documents, and expected `proposal_documents` links may be created,
  - existing reserved fixture rows may be updated only for fixture metadata/content/plain-text/count fields needed to make the fixture identifiable, useful, and reset to its baseline verification content before manual proof,
  - unexpected extra links on reserved fixture documents are treated as topology drift and cause a hard failure,
  - `--apply` must not delete unexpected links automatically; a future `--reset-fixtures` command can handle destructive reserved-fixture cleanup if needed.
- `--apply` must reset reserved fixture document content/plain text/word counts to baseline before manual browser proof so repeated route verification starts from a deterministic document body. This reset is fixture setup, not evidence that browser insertion persisted document content. It should not delete append-only document version history unless a future destructive reset command is explicitly added.

Acceptance criteria:

- Running `--apply` twice produces the same fixture IDs/counts.
- Two concurrent apply attempts serialize under the advisory lock rather than creating duplicate metadata-keyed documents.
- Fixture rows are clearly identifiable and do not collide with real RFP data.
- Script prints `/documents/{id}` URLs for manual verification.
- Duplicate fixture-key matches fail loudly rather than choosing an arbitrary row.
- Production-like mutation is impossible without both `--apply` and the second confirmation guard.
- Reserved topology drift fails loudly instead of silently normalizing or deleting links.
- Re-running `--apply` restores reserved fixture document content to baseline before the next proof while preserving append-only version history.

### 3. Document Product Metadata Stamp Follow-Up

Files:

- no implementation in this fixture plan.

Work:

- Do not modify `createProposalDocument` in this pass.
- Record a follow-up decision: stamping `metadata.opportunityId` during canonical proposal document creation may be useful, but it changes production document behavior and affects downstream consumers such as compliance validation.
- If pursued later, require a separate plan covering `createProposalDocument`, `linkExistingDocument`, duplicate/import/template-generated documents, resolver precedence, and compliance-validator tests.

Acceptance criteria:

- This pass remains fixture-only.
- No production document creation flow behavior changes.

### 4. Add Tests For Fixture/Audit Behavior

Files:

- `frontend/__tests__/actions/snippet-context-fixtures.test.ts`
- Existing `frontend/__tests__/actions/snippet-placeholder-context.test.ts` only if a small resolver assertion is needed.

Work:

- Mock DB calls or use the repository's existing action test pattern to verify:
  - audit classifies branch counts,
  - create is idempotent,
  - apply takes the advisory lock before read/write fixture work,
  - production-like targets require the second confirmation flag,
  - duplicate reserved fixture keys hard-fail,
  - reserved topology drift hard-fails,
  - metadata fallback fixture remains zero-link,
  - ambiguous fixture has two opportunity links,
  - canonical fixture has exactly one link.
- Add a seed-contract assertion for the manual browser proof:
  - `DATACRAFT_RESPONSE_SNIPPETS` contains `/dc-exec-summary`,
  - `/dc-exec-summary` content contains `{{client_name}}`,
  - `/dc-exec-summary` content contains `{{opportunity_name}}`.

Acceptance criteria:

- Tests fail if fixture creation starts using metadata fallback for canonical fixture resolution.
- Tests fail if duplicate `proposal_documents` rows are created on repeated runs.
- Tests fail if production-like `--apply` can mutate without the second confirmation guard.
- Tests fail if unexpected reserved-fixture topology drift is silently normalized.
- Tests fail if the manual verification shortcut loses either the document-scalar token `{{client_name}}` or the opportunity-scoped token `{{opportunity_name}}`.

### 5. Live/Dev Verification Procedure

Files:

- `.omx/state/snippet-context-fixture-verification.md`

Work:

- Run audit mode first.
- Run `--apply` only against the intended environment; for production-like targets, include the configured second confirmation flag after verifying the printed host/database.
- Run a concurrency proof against the same target environment:
  - launch two `--apply` invocations concurrently,
  - run audit after both complete,
  - prove exactly one document per `documents.metadata.fixtureKey`,
  - prove exactly one opportunity per reserved `(sourceId, sourceFile)`,
  - prove no duplicate `proposal_documents` rows and the target 0/1/2 link topology.
- Run audit again and record fixture IDs/counts.
- Open each generated `/documents/{id}`:
  - canonical document: expand `/dc-exec-summary` and verify opportunity/client fields resolve from the canonical link,
  - metadata fallback document: expand the same shortcut and verify opportunity/client fields resolve from metadata fallback,
  - ambiguous document: expand `/dc-exec-summary`, then verify the visible editor output contains the ambiguous document's distinctive metadata `clientName` value and leaves `{{opportunity_name}}` unresolved/highlighted.
- Acknowledge browser-route side effects:
  - `/documents/[id]` shortcut expansion currently increments `template_snippets.use_count` / `updated_at`,
  - the current route mounts the collaborative editor; shortcut expansion should not be reported as persisted document content/version mutation unless an explicit save/Yjs persistence path is observed,
  - browser proof is therefore not fully read-only because of snippet analytics,
  - prefer dev or live-like verification environments for browser proof,
  - if browser proof is run against a production-like target, explicitly record that the snippet-analytics mutation was accepted.
- After browser proof, run audit. If audit or direct document inspection shows persisted fixture document content changed, run `--apply` again or an equivalent non-destructive baseline reset and record that persisted document mutation occurred. If no persisted content/version write is observed, record that the browser proof was UI-level plus snippet analytics only.

Acceptance criteria:

- Evidence includes exact fixture document IDs, linked opportunity IDs, and branch classification.
- Evidence records the database host/name printed by the script and whether production confirmation was required.
- Evidence records concurrency proof results.
- Evidence records whether browser proof ran in dev/live-like or production-like mode and whether snippet `useCount` mutation was acceptable.
- Evidence records whether persisted fixture document content/version mutation was observed; if observed, evidence includes the post-browser baseline reset result.
- No AI call is required for slash expansion.
- The verification note distinguishes live verified behavior from resolver-test coverage.
- Ambiguous-route evidence is limited to visible unresolved-token highlighting and resolved scalar text; do not claim diagnostic UI unless such UI exists.
- Evidence names `/dc-exec-summary` as the shortcut used for the ambiguous proof and records that the seed-contract test proved both required tokens are present.

### 6. Commit Hygiene

Files:

- Fixture helper/script/tests,
- verification plan/state notes.

Work:

- Stage only fixture/context-resolution files.
- Leave unrelated dirty worktree changes untouched.
- Use Lore protocol commit trailers with test and live/dev verification evidence.

## Verification Commands

Run from `frontend/`:

```bash
npm test -- --run __tests__/actions/snippet-placeholder-context.test.ts __tests__/actions/snippet-context-fixtures.test.ts
npm run test:e2e -- e2e/snippet-expansion.spec.ts
npx tsc --noEmit
npm run lint
npm run build
```

Run fixture audit/apply:

```bash
tsx scripts/ensure-snippet-context-fixtures.ts --audit
tsx scripts/ensure-snippet-context-fixtures.ts --apply
tsx scripts/ensure-snippet-context-fixtures.ts --audit
```

If the repo uses `tsx` through another runner, adapt the command to the existing package script pattern.

Run concurrency proof with the final runner command, for example:

```bash
tsx scripts/ensure-snippet-context-fixtures.ts --apply & tsx scripts/ensure-snippet-context-fixtures.ts --apply & wait
tsx scripts/ensure-snippet-context-fixtures.ts --audit
```

## Available Agent Types

- `explore`: inspect existing seed, proposal-document, and document creation paths.
- `executor`: implement fixture helper/script.
- `test-engineer`: add fixture/audit tests and manual verification checklist.
- `verifier`: run DB audit/apply, browser verification, and build gates.
- `architect`: review relationship semantics and production-safety boundary.
- `critic`: challenge fixture safety, overclaiming, and test sufficiency.
- `git-master`: stage/commit only scoped files with Lore trailers.

## Follow-Up Staffing Guidance

### Ralph Sequential Path

Use:

```text
$ralph .omx/plans/proposal-document-fixtures-plan.md
```

Recommended lane sequence:

1. `explore`: confirm runner conventions and current fixture/audit gaps.
2. `executor`: add idempotent fixture helper/script.
3. `test-engineer`: add unit tests for audit/idempotency/classification.
4. `verifier`: run audit/apply in target DB, browser-check the three document URLs, and run build gates.
5. `architect`: final sign-off on relationship semantics and overclaiming.
6. `git-master`: scoped commit.

### Team Parallel Path

Use:

```text
$team implement .omx/plans/proposal-document-fixtures-plan.md
```

Suggested lanes:

- Lane A, `executor`: fixture helper and script.
- Lane B, `test-engineer`: fixture/idempotency tests.
- Lane C, `verifier`: DB audit/apply and manual document-route verification.
- Lane D, `architect`: relationship safety and production-mutation review.

## Team Verification Path

- Unit tests for fixture helper pass.
- Existing snippet context resolver tests still pass.
- Playwright snippet expansion e2e still passes.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.
- Fixture audit before/after apply proves the three branch documents exist.
- Fixture apply evidence shows advisory-lock serialization and production-confirmation behavior.
- Browser/manual verification records generated `/documents/{id}` URLs and observed placeholder resolution behavior, including visible unresolved-token highlighting for the ambiguous fixture.
- Browser/manual verification records whether shortcut insertion's snippet analytics mutation was acceptable in the target environment and whether any persisted reserved fixture document/version mutation was observed.
