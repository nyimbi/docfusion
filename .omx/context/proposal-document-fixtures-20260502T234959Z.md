# Proposal Document Fixture Context Snapshot

## Task Statement

Plan how to solve the missing `proposal_documents` links and `documents.metadata.opportunityId` document fixtures that blocked full manual `/documents/[id]` snippet-expansion verification.

## Desired Outcome

Produce a consensus plan that creates durable, repeatable fixture/repair support for:

- a document with exactly one canonical `proposal_documents` link,
- a document with no canonical link but `metadata.opportunityId`,
- a document with multiple proposal-document links as an ambiguity negative case,
- safe live/dev validation of snippet context resolution through `/documents/[id]`.

## Known Facts / Evidence

- `documents` has a nullable JSONB `metadata` field.
- `proposal_documents` is the canonical join between `opportunities` and `documents`, with a unique `(opportunity_id, document_id)` index.
- `loadSnippetPlaceholderContext` resolves opportunity context in this order:
  - explicit `opportunityId`,
  - exactly one `proposal_documents` link for the document,
  - ambiguous-link diagnostic when there are multiple linked opportunity IDs,
  - `documents.metadata.opportunityId` when there are zero canonical links.
- `createProposalDocument` already creates an underlying `documents` row and the canonical `proposal_documents` link.
- `linkExistingDocument` already links an existing document to an opportunity.
- Previous read-only live DB evidence found `documents=7`, `proposal_document_links=0`, `single_link_docs=0`, `ambiguous_docs=0`, `metadata_opp_docs=0`.
- The snippet hardening pass committed resolver tests for all three branches, but not live/dev fixture materialization.

## Constraints

- Do not mutate production data casually; live fixture creation should require an explicit, idempotent seed/repair command and should mark fixture data clearly.
- Do not introduce a second relationship model that competes with `proposal_documents`.
- Preserve `metadata.opportunityId` as fallback compatibility, not as the preferred canonical link.
- Avoid broad refactors in the existing dirty worktree.
- Verification must be repeatable in local/dev/live-like environments.

## Unknowns / Open Questions

- Which existing live opportunities, if any, should be used for manual fixtures versus creating deterministic Datacraft verification opportunities.
- Whether fixture rows should be permanent demo data, ephemeral e2e seed data, or both.
- Whether document creation flows should always stamp `metadata.opportunityId` when an opportunity context is known, even when a canonical link is also created.

## Likely Codebase Touchpoints

- `frontend/lib/db/schema.ts`
- `frontend/lib/actions/proposal-documents.ts`
- `frontend/lib/actions/templates.ts`
- `frontend/lib/actions/document-generation.ts`
- `frontend/lib/actions/documents-enhanced.ts`
- `frontend/lib/placeholders/context-resolution.ts`
- `frontend/__tests__/actions/snippet-placeholder-context.test.ts`
- `frontend/e2e/snippet-expansion.spec.ts`
- new fixture/repair script under `frontend/scripts/`
- optional new live verification notes under `.omx/state/`
