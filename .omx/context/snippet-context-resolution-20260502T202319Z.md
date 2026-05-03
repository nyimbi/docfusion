# Snippet Context Resolution Context Snapshot

## Task Statement
Give content snippets the same context-resolution path as templates: add snippet placeholder metadata, resolve opportunity/client/RFP fields automatically, run substitution on insert, AI-adapt against requirement text, and highlight placeholders that remain unresolved.

## Desired Outcome
Proposal writers can insert Datacraft and other snippets into an RFP response without manually replacing `{{client_name}}`, `{{opportunity_name}}`, `{{solicitation_number}}`, and similar tokens. The inserted result should be context-aware, optionally AI-adapted for narrative flow and requirement relevance, and visibly flag unresolved placeholders before final insertion.

## Known Facts / Evidence
- Template document creation already performs recursive placeholder replacement in `frontend/lib/actions/templates.ts` via `createDocumentFromTemplate`, `substitutePlaceholders`, and `substitutePlaceholdersInString`.
- The placeholder regex currently supports simple and dotted keys: `{{client_name}}`, `{{company.name}}`, `{{custom.variable_name}}`.
- Template substitution merges `getAllTemplateVariables()` with user-provided `placeholderValues`; user values win.
- Datacraft templates define common placeholders in `frontend/lib/data/datacraft-response-content.ts`.
- Datacraft snippets contain the same `{{...}}` tokens, but snippet insertion/search currently returns raw snippet content.
- `template_snippets` already has a `placeholders` JSONB column in `frontend/lib/db/schema-additions.ts`; current Datacraft seed does not populate it.
- `ContentInsertDialog` already has `documentContext` and `onAIAdapt` props but is not wired as the general content-library insertion path.
- `ContentLibraryBrowser` supports `onInsertSnippet`, but the `/content-library` page renders it without an insertion callback.
- Content library APIs return raw JSON content from `templateSnippets`; `ContentSnippet` types currently treat content as `string` in some client surfaces, while APIs return JSONB.
- Requirement text exists in RFP/compliance components and APIs, but there is no unified snippet context object tying opportunity/client/RFP/requirement/document section together.

## Constraints
- Reuse existing template substitution behavior rather than inventing incompatible syntax.
- Do not introduce a full Jinja/Handlebars runtime unless explicitly requested.
- Keep Datacraft snippets narrative-first and proposal-ready.
- Unresolved placeholders must remain visible and actionable, not silently removed.
- AI adaptation must preserve Datacraft proof points and not hallucinate client-specific claims.
- Existing template creation behavior must not regress.
- Existing live seeded Datacraft snippets should remain idempotently seedable.

## Unknowns / Open Questions
- Exact editor insertion surface for snippets into documents is not fully wired; the content library page currently browses snippets without insertion.
- Whether snippets should be inserted as raw Tiptap JSON nodes or converted to plain text in every current editor surface needs implementation inspection during execution.
- Whether opportunity context should be inferred from current route, document metadata, selected opportunity, or explicit user selection likely needs a shared resolver.
- AI provider availability should be treated as optional/fallback because the app already has `/api/v1/ai/completion` but runtime configuration may vary.

## Likely Codebase Touchpoints
- `frontend/lib/actions/templates.ts`: extract reusable placeholder utilities from template-only code.
- `frontend/lib/actions/content-library.ts`: add snippet context resolution/adaptation server actions.
- `frontend/lib/actions/snippets.ts`: expose/create/update snippet placeholders.
- `frontend/app/api/v1/content/snippets/route.ts`: include placeholder metadata and/or add resolve endpoint.
- `frontend/app/api/v1/content/search/route.ts`: normalize returned content/metadata if needed.
- `frontend/components/content-library/ContentInsertDialog.tsx`: add resolution preview, unresolved placeholder highlighting, and AI adaptation flow.
- `frontend/components/content-library/ContentLibraryBrowser.tsx`: pass context and insertion/adaptation callbacks.
- `frontend/components/content-library/ContentSnippetCard.tsx`: expose unresolved-placeholder badges or metadata as needed.
- `frontend/lib/data/datacraft-response-content.ts`: add placeholder metadata to Datacraft snippets.
- `frontend/lib/db/seed-templates.ts`: seed snippet placeholders.
- Tests under `frontend/__tests__`: placeholder utility tests, snippet resolution tests, API/action tests, and component tests where available.
