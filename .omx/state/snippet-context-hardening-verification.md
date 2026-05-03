# Snippet Context Hardening Verification Notes

## Live DB Read-Only Evidence

Read-only checks against the configured database showed:

- `documents=7`
- `proposal_document_links=0`
- `single_link_docs=0`
- `ambiguous_docs=0`
- `metadata_opp_docs=0`
- `seeded_snippets_with_placeholders=85/85`

Because the live database currently has no `proposal_documents` links and no document `metadata.opportunityId` fixtures, full `/documents/[id]` manual branch verification would require creating test data. This hardening pass did not mutate production data solely for verification.

## Branch Evidence Substitute

The route-relevant context branches are covered through resolver tests:

- single proposal-document link resolves opportunity fields,
- zero-link `metadata.opportunityId` fallback resolves opportunity context,
- ambiguous multi-link documents do not auto-hydrate opportunity-scoped fields,
- direct scalar document metadata remains usable after ambiguity.

## Browser Evidence

`frontend/e2e/snippet-expansion.spec.ts` exercises the live Tiptap/ProseMirror extension in a browser harness:

- known shortcut plus Space expands,
- known shortcut plus Enter expands and appends/focuses a paragraph,
- unknown shortcut plus Space preserves the shortcut and trailing space,
- unknown shortcut plus Enter preserves shortcut content and inserts a newline,
- plain slash remains available to the command-palette trigger.
