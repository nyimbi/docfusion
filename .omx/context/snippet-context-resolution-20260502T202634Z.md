# Context Snapshot: snippet-context-resolution

## Task Statement
Give snippets the same context-resolution path as templates: add snippet placeholder metadata, resolve opportunity/client/RFP fields automatically, run the same substitution function on insert, and then AI-adapt against requirement text. Unreplaced placeholders must be highlightable. AI adaptation must preserve narrative flow, relevance, context awareness, and continuity.

## Desired Outcome
- Snippets carry placeholder definitions the same way templates do.
- Snippet insertion resolves context-derived values automatically before insertion.
- The same placeholder substitution logic used by templates is reused for snippets.
- AI adaptation runs after substitution, with requirement text and surrounding document context.
- Any unresolved placeholders remain visible and highlightable instead of silently disappearing.

## Known Facts / Evidence
- Template substitution currently lives in `frontend/lib/actions/templates.ts` via `createDocumentFromTemplate()`, `substitutePlaceholders()`, and `substitutePlaceholdersInString()`.
- Datacraft snippet source content in `frontend/lib/data/datacraft-response-content.ts` contains `{{client_name}}`, `{{opportunity_name}}`, and related tokens; common placeholder definitions exist in that file but are only attached to templates today.
- Datacraft snippet seed paths in `frontend/lib/db/seed-templates.ts` and `frontend/lib/db/seed.ts` write snippet content/tags/etc. but do not populate placeholder metadata.
- `ContentInsertDialog` has `documentContext` and `onAIAdapt` props, but `ContentLibraryBrowser` is mounted in browse-only mode on `frontend/app/(app)/content-library/page.tsx`.
- The shortcut expansion path in `frontend/components/editor/extensions/snippet-expansion.ts` inserts raw snippet content today.
- Content APIs and client code currently mix string assumptions and JSON/Tiptap content assumptions for snippets.
- Repo inconsistency: drizzle SQL/snapshots show `template_snippets.placeholders`, but `frontend/lib/db/schema-additions.ts` currently defines `templateSnippets` without a `placeholders` field.
- Opportunity context is available from `frontend/lib/actions/opportunities.ts` / `frontend/lib/db/schema.ts` (`title`, `organization`, submission-related fields, metadata).
- Requirement text is already present in RFP/compliance APIs and components.

## Constraints
- Planning only; no implementation in this step.
- Keep the solution aligned with current template behavior rather than inventing a parallel snippet-only pipeline.
- Avoid silent loss of unresolved placeholders.
- Respect existing mixed content shapes during transition.

## Unknowns / Open Questions
- Whether requirement-aware adaptation must also run for `/shortcut` expansion, or only for explicit insertion surfaces where requirement context is available.
- Whether unresolved placeholder highlighting should be limited to editor decorations or also exposed in list/preview surfaces.

## Likely Codebase Touchpoints
- `frontend/lib/actions/templates.ts`
- `frontend/lib/actions/snippets.ts`
- `frontend/lib/actions/content-library.ts`
- `frontend/lib/data/datacraft-response-content.ts`
- `frontend/lib/db/schema-additions.ts`
- `frontend/lib/db/seed-templates.ts`
- `frontend/lib/db/seed.ts`
- `frontend/lib/types/snippets.ts`
- `frontend/app/api/v1/content/snippets/route.ts`
- `frontend/components/content-library/ContentLibraryBrowser.tsx`
- `frontend/components/content-library/ContentInsertDialog.tsx`
- `frontend/components/editor/extensions/snippet-expansion.ts`
