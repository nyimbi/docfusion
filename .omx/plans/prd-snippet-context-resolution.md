# PRD: Snippet Context Resolution and AI Adaptation

## Objective
Execute `.omx/plans/snippet-context-resolution-consensus.md` so reusable response snippets follow the same deterministic context-resolution and placeholder-substitution path as templates, while preserving an optional post-resolution AI adaptation step for rich requirement-aware insertion.

## User Stories

### US-001: Schema, Types, and Content Contract
As an authoring-system maintainer, I want snippet content and placeholder metadata represented consistently so snippets can be resolved, displayed, inserted, and seeded without ad hoc string/JSON handling.

Acceptance criteria:
- Live DB shape for `template_snippets.placeholders` is validated before migration/repair work.
- Checked-in schema, types, API payloads, and seed data represent snippet placeholders consistently.
- Snippet content boundaries expose normalized Tiptap content and plain-text previews.

### US-002: Deterministic Context Resolution
As a proposal author, I want snippets to automatically resolve opportunity, client, RFP, and requirement fields so inserted content is immediately proposal-specific.

Acceptance criteria:
- Templates, snippets, and partials share one placeholder substitution utility.
- Snippet resolution returns resolved content, unresolved placeholder metadata, value provenance, and diagnostics.
- Context loading is read-only and resolves document-to-opportunity through `proposal_documents`.
- Ambiguous opportunity links do not guess, and explicit opportunity context wins with diagnostics.

### US-003: Editor and Library Insertion
As a proposal author, I want slash shortcuts and insertion surfaces to insert resolved snippets without breaking the existing slash command palette.

Acceptance criteria:
- `expandShortcut` uses the shared resolver.
- Mounted document editors pass snippet callbacks into `TiptapEditor`.
- Slash trigger arbitration is deterministic.
- Unresolved placeholders remain visible and highlighted after insertion.

### US-004: AI Adaptation
As a proposal author, I want resolved snippets optionally adapted to the active requirement and surrounding text so inserted prose is relevant and continuous.

Acceptance criteria:
- AI adaptation only runs after deterministic resolution.
- Adaptation preserves resolved structured facts and unresolved placeholder tokens.
- Prompt fixtures verify requirement relevance, narrative flow, context awareness, and continuity.

## Out of Scope
- Browser-side object storage or RFP download changes.
- A redesign of the full content-library browsing page.
- Making AI mandatory for slash expansion.
