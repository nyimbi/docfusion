# Snippet Context Fixture Verification

Run date: 2026-05-03

## Target

- Command target: `db.lindela.io/docfusion`
- Guard classification: production-like because `DATABASE_URL` host contains `db.lindela.io`
- Mutation confirmation used: `--confirm-host db.lindela.io`
- Fixture source: `snippet-context-fixtures`

## Seed Contract

- `/dc-exec-summary` exists in `DATACRAFT_RESPONSE_SNIPPETS`.
- The seed-contract test proves the shortcut contains both `{{client_name}}` and `{{opportunity_name}}`.

## Audit Before Apply

- `documents`: 7
- `proposalDocumentLinks`: 0
- `singleLinkDocuments`: 0
- `ambiguousLinkDocuments`: 0
- `metadataFallbackDocuments`: 0
- `duplicateProposalDocumentPairs`: 0
- Existing reserved fixture rows: none

## Apply Result

Created or reset only reserved fixture rows:

- Canonical opportunity: `38b77d62-166b-4b4b-8d2d-330db92e521a`
- Metadata fallback opportunity: `1b673854-0044-49c1-91f2-f3e1614a6ebe`
- Ambiguous opportunity A: `b81c23f6-3699-409e-b953-992258914d8e`
- Ambiguous opportunity B: `f9714cdf-c446-44bc-a44c-66091daf3061`
- Canonical document: `53c4e667-95f1-4487-8e97-779dff133008`
- Metadata fallback document: `5b06aae8-fa43-4324-bc2b-665523122b5d`
- Ambiguous document: `a830f4f1-0099-4b41-b03e-5b346483be08`

Manual verification URLs printed by the script:

- `/documents/53c4e667-95f1-4487-8e97-779dff133008`
- `/documents/5b06aae8-fa43-4324-bc2b-665523122b5d`
- `/documents/a830f4f1-0099-4b41-b03e-5b346483be08`

## Concurrency Proof

Two `--apply --confirm-host db.lindela.io --json` invocations were launched concurrently. Both completed successfully.

The follow-up audit still showed:

- one document per reserved `documents.metadata.fixtureKey`,
- one opportunity per reserved `(source_id, source_file)`,
- `proposalDocumentLinks`: 3,
- canonical fixture link count: 1,
- metadata fallback fixture link count: 0,
- ambiguous fixture distinct opportunity count: 2,
- `duplicateDocumentKeys`: none,
- `duplicateOpportunityKeys`: none,
- `duplicateProposalDocumentPairs`: none.

## Final Audit

After the architect-requested duplicate-pair apply guard was added, `--apply --confirm-host db.lindela.io` was run again and accepted the clean topology with `duplicateProposalDocumentPairs: 0`.

- `documents`: 10
- `proposalDocumentLinks`: 3
- `singleLinkDocuments`: 1
- `ambiguousLinkDocuments`: 1
- `metadataFallbackDocuments`: 1
- `duplicateProposalDocumentPairs`: 0

Fixture topology:

- `snippet-context-single-link`: document `53c4e667-95f1-4487-8e97-779dff133008`, 1 link to opportunity `38b77d62-166b-4b4b-8d2d-330db92e521a`
- `snippet-context-metadata-fallback`: document `5b06aae8-fa43-4324-bc2b-665523122b5d`, 0 links, `metadata.opportunityId` points to opportunity `1b673854-0044-49c1-91f2-f3e1614a6ebe`
- `snippet-context-ambiguous`: document `a830f4f1-0099-4b41-b03e-5b346483be08`, 2 links to opportunities `b81c23f6-3699-409e-b953-992258914d8e` and `f9714cdf-c446-44bc-a44c-66091daf3061`

## Resolution Proof

Direct live resolution against `db.lindela.io` using `resolveSnippetContent({ shortcut: "/dc-exec-summary", documentId })` proved:

- Canonical document resolves `client_name` to `Single Link Fixture Ministry` and `opportunity_name` to `Datacraft Sovereign Intelligence Platform Response` from the single `proposal_documents` link.
- Metadata fallback document resolves `client_name` to `Metadata Fallback Fixture Authority` and `opportunity_name` to `Datacraft Metadata Fallback Verification Response` from `documents.metadata.opportunityId`.
- Ambiguous document resolves `client_name` to `Ambiguous Fixture Client`, leaves `{{opportunity_name}}` unresolved, and returns the expected `ambiguousOpportunityLink` diagnostic.

During this proof, live resolution initially failed because `loadSnippetPlaceholderContext` selected every opportunity column and the deployed database does not currently expose the schema's `search_vector` column. The resolver was narrowed to select only placeholder-required opportunity columns.

## Browser Route Status

Attempted dev route verification on ports `32129`, `32130`, and `32131`:

- `next dev --port 32129`
- `next dev --turbo --port 32130`
- `ulimit -n 8192; npx next dev --port 32131`

All attempts hit repeated `Watchpack Error (watcher): Error: EMFILE: too many open files, watch` and served `_not-found`, including for `/documents` and the three generated `/documents/{id}` URLs. Therefore, this run has live DB fixture proof plus direct resolver proof, but not successful local browser-route proof.

Production build/start did register the document route:

- `npm run build` listed `/documents/[id]` as a dynamic route.
- `npm run start -- -p 32132` served the built app.
- `curl -I /documents/53c4e667-95f1-4487-8e97-779dff133008` returned `307` to `/auth/sign-in?callbackUrl=...`, proving the built route exists and is protected by middleware.

Authenticated editor interaction was not completed in this run because no browser session credentials were introduced for this fixture proof.

Because the route proof did not reach the editor, no snippet analytics mutation was accepted and no persisted fixture document content/version mutation was observed from browser insertion.

## Final Quality Gates

- `npm test -- --run __tests__/actions/snippet-placeholder-context.test.ts __tests__/actions/snippet-context-fixtures.test.ts`: 12 tests passed.
- `npm run test:e2e -- e2e/snippet-expansion.spec.ts`: 2 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with no ESLint warnings or errors.
- `npm run build`: passed and listed `/documents/[id]` as a dynamic route.
- `git diff --check` on scoped Ralph files: passed.
- Architect review: initially requested duplicate `proposal_documents` pair hard-fail coverage; fix was applied and re-review returned `APPROVED`.
- Deslop pass: scoped file inspection plus file-scoped ESLint found no dead code or cleanup edit worth making.
