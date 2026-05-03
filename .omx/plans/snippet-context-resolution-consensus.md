# Snippet Context Resolution and AI Adaptation Plan (Revised v6)

## Revision Notes

Updated after architect review and repo verification.

What changed from the prior draft:
- Phase 0 now starts with checked-in schema review plus live DB validation for `template_snippets.placeholders`; the repo does **not** currently define that column in `frontend/lib/db/schema-additions.ts` or `frontend/drizzle/0003_closed_betty_ross.sql`.
- Content normalization is now its own early phase because `/api/v1/content/snippets` returns `unknown` JSONB while content-library UI types still assume `content: string`.
- Primary consumer order changed: `expandShortcut` and `frontend/components/editor/extensions/snippet-expansion.ts` come before `ContentInsertDialog.tsx`.
- Context precedence is now explicit and deterministic.
- All existing placeholder engines are now in cleanup scope: the active production template engine in `frontend/lib/actions/templates.ts`, the duplicate template action in `frontend/app/actions/templates.ts`, and partial substitution in `frontend/lib/actions/partials.ts`.
- The plan now defines explicit `resolveSnippetContent(...)` and `adaptResolvedSnippet(...)` contracts so deterministic resolution and optional AI refinement cannot blur during implementation.
- Context precedence is now total-ordered rather than grouped.
- Consumer state is now stated accurately: slash-expansion infrastructure exists but is dormant because `TiptapEditor` does not currently pass snippet callbacks into `createExtensions`; activating that editor path is explicitly in scope.
- Required auto-resolved placeholders now have a source-field mapping table tied to concrete accessor modules.
- Unresolved-placeholder highlighting is now mandatory in preview and inserted editor content, with test expectations.
- AI adaptation is now explicitly optional and only runs after deterministic resolution; slash expansion must not depend on AI.
- v5 tightens the placeholder source table to exact helper/accessor contracts, adds narrative-flow/relevance/context-continuity acceptance criteria for AI adaptation, and assigns Phase 5/6 implementation explicitly in the execution handoff.
- v6 adds a read-only context-loading contract that resolves document-to-opportunity links through `proposal_documents`, canonicalizes placeholder keys as raw keys with derived `{{key}}` tokens, and defines slash-trigger arbitration.
- Architect-approved execution gate: do not begin Phase 5 AI/highlighting work until Phase 0 branch selection is documented and Phase 1-4 tests prove shared resolution, precedence, read-only context loading, and slash-trigger arbitration.
- Final critic iteration resolved the last ambiguity: multi-opportunity `proposal_documents` links must not be guessed; they return an explicit diagnostic unless the caller supplies `opportunityId`.
- Final architect tie-breaker revision aligns document-link handling with the global precedence model: explicit `opportunityId` always wins, and mismatched document links are surfaced through diagnostics rather than silently overriding explicit context.
- Ambiguous canonical `proposal_documents` links also block `Document.metadata.opportunityId` from rehydrating opportunity values; only direct scalar document metadata fallbacks remain allowed.
- Final critic verification fix: planned tests must live in the existing Vitest-reachable `frontend/__tests__` project lanes rather than colocated `__tests__` directories unless `frontend/vitest.config.ts` is explicitly expanded.

## RALPLAN-DR Summary

### Principles
- Deterministic placeholder resolution must be the default path everywhere snippets are expanded or inserted.
- Schema and payload contracts must be verified from checked-in code and live DB state before planning migrations.
- Normalize snippet content at API/UI/editor boundaries before adding context resolution logic.
- Reuse one canonical placeholder engine for templates, snippets, and partials rather than maintaining parallel implementations.
- AI adaptation is additive only: it may refine resolved content in rich-context flows, but it must never be required for slash expansion.

### Decision Drivers
- Checked-in schema currently lacks `template_snippets.placeholders`, while seed content and future resolution logic assume placeholder metadata.
- Slash-expansion infrastructure exists (`expandShortcut`, `SnippetExpansion`, `createExtensions`) but is currently dormant in mounted editors because `TiptapEditor` does not pass snippet callbacks into `createExtensions`.
- Content-library consumers currently treat snippet content as plain string even though storage/API use JSONB/Tiptap content.
- Snippet resolution must be deterministic and consistent with template and partial substitution semantics.

### Viable Options

#### Option A: Verify schema, normalize content, extract one shared resolver, wire all live consumers, keep AI optional
- Pros: one deterministic path; fixes current schema/type mismatch; works for slash expansion and insertion flows.
- Cons: broader than a dialog-only patch; requires migration/repair branching and some consumer cleanup.

#### Option B: Add placeholder handling only in `ContentInsertDialog`
- Pros: smaller immediate surface.
- Cons: misses the existing but dormant slash-expansion infrastructure, leaves API/UI content mismatch intact, and preserves inconsistent behavior across consumers once the editor path is activated.

#### Option C: Shared resolver/schema normalization first, UI activation later
- Pros: lower immediate UI blast radius; establishes schema, type, and deterministic service foundations before editor wiring.
- Cons: does not meet the user request end-to-end because authors still cannot insert resolved/adapted snippets in a live document flow; unresolved-placeholder highlighting remains unobservable outside tests.

#### Option D: Use AI adaptation to fill context without a shared deterministic resolver
- Pros: less schema work up front.
- Cons: non-deterministic, inconsistent with templates, and unsuitable for shortcut expansion or unresolved-token handling.

### Chosen Direction
Choose **Option A**.

### Invalidation Rationale
- Reject **Option B** because it does not solve the editor-first insertion path or the API/content contract mismatch.
- Reject **Option C** as a final delivery because it produces a foundation but no reachable author workflow. It can be used as an internal milestone only.
- Reject **Option D** because it makes core expansion behavior probabilistic and breaks the requirement that snippets resolve the same way as templates.

## ADR

### Decision
Build a shared snippet/template placeholder pipeline with this order:
1. validate schema and live DB state,
2. normalize snippet content shape at API/UI/editor boundaries,
3. converge templates, snippets, and partials on one placeholder utility,
4. resolve placeholders deterministically with explicit precedence,
5. activate and wire primary consumers (`expandShortcut`, editor extension callbacks in `TiptapEditor`, content-library insertion where document context exists),
6. optionally run AI adaptation for rich-context insertion flows only.

### Drivers
- `frontend/lib/actions/snippets.ts` currently returns raw snippet content from `expandShortcut`.
- `frontend/components/editor/extensions/snippet-expansion.ts` can expand snippets, but mounted editors currently leave its callbacks unset through `TiptapEditor`.
- `frontend/app/api/v1/content/snippets/route.ts` emits `content: unknown`, while content-library components type it as `string`.
- The active production template path uses `frontend/lib/actions/templates.ts`, while `frontend/app/actions/templates.ts` and `frontend/lib/actions/partials.ts` also contain placeholder logic that must converge on the shared utility.

### Alternatives Considered
- Dialog-only insertion path.
- AI-only context filling.
- Seed-time pre-resolution of snippet content.

### Why Chosen
This is the only direction that makes snippet expansion deterministic across editor, API, and library flows while still allowing richer AI-assisted insertion where document context exists.

### Consequences
- The first implementation step is validation, not coding against an assumed `placeholders` column.
- Content-library types and API payloads need a normalized snippet content contract.
- Template, snippet, and partial placeholder logic will converge on one shared utility, with local duplicate logic removed or reduced to wrappers after migration.
- Context resolution must not call read accessors that mutate audit/access timestamps; slash expansion needs a read-only path.

### Follow-ups
- Decide whether content-library cards should show unresolved placeholder badges or only insertion surfaces should.
- Decide whether browse-only library pages need full rich preview rendering for JSON content or only normalized summaries.

## Canonical Resolver Contracts

### `resolveSnippetContent(request)`
Purpose: deterministic normalization, context merge, substitution, and unresolved-token reporting. This function must not call AI.

Recommended request shape:

```ts
interface ResolveSnippetContentRequest {
	snippetId?: string;
	shortcut?: string;
	content?: DocumentContent | string;
	placeholders?: SnippetPlaceholder[];
	placeholderValues?: Record<string, string | number | boolean | string[] | null>;
	documentId?: string;
	opportunityId?: string;
	requirementId?: string;
	requirementText?: string;
	sectionTitle?: string;
	surroundingText?: string;
}
```

Recommended response shape:

```ts
interface ResolveSnippetContentResult {
	snippetId?: string;
	shortcut?: string;
	originalContent: DocumentContent;
	resolvedContent: DocumentContent;
	plainTextPreview: string;
	unresolvedPlaceholders: Array<{ token: string; key: string; path: string }>;
	resolvedValues: Record<string, string | number | boolean | string[]>;
	valueSources: Record<string, string>;
	placeholderMetadata: SnippetPlaceholder[];
}
```

Consumers:
- `expandShortcut` calls `resolveSnippetContent(...)` and returns resolved content plus unresolved-token metadata.
- The editor snippet extension consumes the resolved content and may decorate unresolved tokens.
- Content-library APIs expose normalized content, plain-text preview, and placeholder metadata.
- Content-library/dialog insertion calls `resolveSnippetContent(...)` before any optional AI adaptation.

### `adaptResolvedSnippet(resolved, richContext)`
Purpose: optional post-resolution prose adaptation for flows with real section/requirement/surrounding-text context. This function must receive already-resolved content and unresolved-token metadata.

Recommended request shape:

```ts
interface AdaptResolvedSnippetRequest {
	resolved: ResolveSnippetContentResult;
	richContext: {
		requirementText?: string;
		sectionTitle?: string;
		surroundingText?: string;
		proposalTone?: string;
	};
}
```

Recommended response shape:

```ts
interface AdaptResolvedSnippetResult {
	adaptedContent: DocumentContent;
	plainTextPreview: string;
	unresolvedPlaceholders: ResolveSnippetContentResult["unresolvedPlaceholders"];
	adaptationNotes: string[];
}
```

Consumers:
- Rich content-library insertion and `ContentInsertDialog` may call `adaptResolvedSnippet(...)`.
- Slash expansion does **not** require AI. If slash expansion has no rich context, it stops after deterministic resolution.

## Deterministic Context Precedence

### Context precedence
Use this exact order when building placeholder values:
1. explicit `placeholderValues`
2. explicitly selected `requirementText` / `requirementId` values for requirement-specific keys only
3. explicitly provided `opportunityId` lookup values
4. document-linked proposal/opportunity relation values
5. document metadata fallback values, including `metadata.opportunityId`
6. selected requirement lookup values derived from `requirementId`
7. opportunity-linked RFP fields derived from the resolved opportunity
8. company variables from `getAllTemplateVariables()`
9. placeholder `defaultValue` metadata

Rules:
- Later sources do not override earlier ones.
- Missing values stay as unresolved `{{placeholder}}` tokens.
- AI adaptation receives already-resolved content plus unresolved-token metadata; it does not invent deterministic values.
- Tests must prove each precedence tier with at least one conflict case.

## Canonical Placeholder Key Format

- Store placeholder metadata keys as raw keys, for example `client_name`, `submission_date`, and `requirement_text`.
- Accept legacy `variableName` values with or without moustaches at read boundaries, but normalize them immediately with `normalizePlaceholderKey(variableName)`.
- Derive rendered token strings only at substitution/reporting time as `{{${key}}}`.
- `unresolvedPlaceholders[].key` must contain the raw key, and `unresolvedPlaceholders[].token` must contain the exact token found in content.
- Migrations and seeds must not persist mixed canonical forms for new snippet metadata. Existing template metadata may retain moustache-wrapped `variableName`, but the shared substitution utility must normalize before matching.
- Tests must cover `client_name`, `{{client_name}}`, whitespace variants such as `{{ client_name }}` if supported by the parser, and unknown tokens.

## Auto-Resolved Placeholder Mapping

The resolver must support this initial mapping. Unsupported placeholders remain unresolved and highlighted.

Implement these source lookups through a new read-only helper contract rather than call-site guesses:

```ts
// frontend/lib/placeholders/context-resolution.ts
async function loadSnippetPlaceholderContext(input: {
	documentId?: string;
	opportunityId?: string;
	requirementId?: string;
	requirementText?: string;
}): Promise<SnippetPlaceholderContext>
```

The helper must read from exact sources and must not update `documents.lastAccessedAt`:
- Query `frontend/lib/db/schema.ts#documents` directly for document `id`, `title`, and `metadata`; do not call `frontend/app/actions/documents.ts#getDocument` because that action updates `lastAccessedAt`.
- Query `frontend/lib/db/schema.ts#proposalDocuments` directly to derive `documentId -> opportunityId` from `proposal_documents.document_id` when no explicit `opportunityId` is provided.
- Query `frontend/lib/db/schema.ts#opportunities` directly, or call `frontend/lib/actions/opportunities.ts#getOpportunity` only if execution confirms that import path is server-safe and side-effect free.
- Query `frontend/lib/db/schema-rfp.ts#rfpRequirements` directly, or call `frontend/lib/actions/requirements.ts#getRequirement` only if execution confirms that import path is server-safe and side-effect free.
- If multiple proposal-document links exist for a document, use this exact rule:
  1. explicit `opportunityId` always wins because explicit caller context outranks document-linked relation values in the global precedence model,
  2. if no explicit `opportunityId` and all links point to the same `opportunityId`, use that opportunity,
  3. if no explicit `opportunityId` and links point to multiple distinct opportunities, do not guess; leave opportunity-scoped placeholders unresolved, continue using direct scalar document metadata fallbacks, and return an `ambiguousOpportunityLink` diagnostic containing candidate `proposal_documents.id` and `opportunityId` values.
  4. if explicit `opportunityId` does not match any document link, still use the explicit opportunity but return an `explicitOpportunityLinkMismatch` diagnostic containing the explicit `opportunityId` and candidate linked `opportunityId` values.
  This rule preserves explicit user/system intent while making stale or cross-document context visible.
- Once `proposal_documents` resolution is ambiguous, `Document.metadata.opportunityId` must not be used to rehydrate opportunity-scoped values. Only direct scalar document metadata values such as `clientName`, `rfpNumber`, `dueDate`, and `projectValue` may continue as fallbacks.

| Placeholder key | Source order | Accessor/module | Notes |
|---|---|---|---|
| `client_name` | explicit value -> explicitly provided opportunity context -> resolved opportunity `organization` -> document metadata `clientName` -> company variable/default | `loadSnippetPlaceholderContext` reading `opportunities.organization`, `documents.metadata.clientName` | Datacraft snippets use this heavily; do not infer from free text. |
| `opportunity_name` | explicit value -> resolved opportunity `title` -> document `title` -> document metadata title-like value if execution adds one later | `loadSnippetPlaceholderContext` reading `opportunities.title`, `documents.title` | Prefer opportunity title over document title when opportunity is linked. |
| `solicitation_number` | explicit value -> document metadata `rfpNumber` -> allowlisted opportunity metadata keys `solicitationNumber`, `solicitation_number`, `rfpNumber`, `rfp_number` -> parsed RFP metadata only if execution adds a typed link | `loadSnippetPlaceholderContext` reading `documents.metadata`, `opportunities.metadata` | Do not derive from `rfpLink` URL unless an explicit parser exists. |
| `submission_date` | explicit value -> opportunity `deadline` -> document metadata `dueDate` -> placeholder default | `loadSnippetPlaceholderContext` reading `opportunities.deadline`, `documents.metadata.dueDate` | Format consistently for display, but preserve source value in provenance. |
| `requirement_text` | explicit value -> provided `requirementText` rich context -> selected requirement `requirementText`/mapped `Requirement.text` | `loadSnippetPlaceholderContext` reading `rfp_requirements.requirement_text` or side-effect-free `getRequirement(id).text` | Matches the global precedence: explicit provided context wins over derived lookup. |
| `requirement_number` | explicit value -> selected requirement `requirementNumber`/mapped `Requirement.requirementId` | `loadSnippetPlaceholderContext` reading `rfp_requirements.requirement_number` or side-effect-free `getRequirement(id).requirementId` | Remains unresolved if no selected requirement. |
| `rfp_url` | explicit value -> opportunity `rfpLink` | `loadSnippetPlaceholderContext` reading `opportunities.rfp_link` | Keep as URL text; do not fetch during resolution. |
| `project_value` | explicit value -> opportunity `budgetValue` -> document metadata `projectValue` | `loadSnippetPlaceholderContext` reading `opportunities.budget_value`, `documents.metadata.projectValue` | Use display-safe string for text substitution. |

## Implementation Plan

### Phase 0: Validate checked-in schema and live DB state
Files:
- `frontend/lib/db/schema.ts`
- `frontend/lib/db/schema-additions.ts`
- `frontend/drizzle/0003_closed_betty_ross.sql`
- `frontend/drizzle.config.ts`
- `.env` / runtime `DATABASE_URL` for live validation during execution

Work:
- Verify checked-in schema source of truth: `frontend/lib/db/schema.ts` re-exports `schema-additions.ts`, and Drizzle points at `./lib/db/schema.ts`.
- Validate live DB shape before any migration decision:
  - confirm whether `template_snippets.placeholders` exists,
  - inspect type/default/nullability if it exists,
  - inspect a sample of existing `template_snippets` rows for current `content` shape.
- Choose one branch explicitly:
  - **Repair branch:** live DB already has `placeholders`; fix ORM/types/API only and remove checked-in drift.
  - **Forward migration branch:** live DB lacks `placeholders`; add a migration for `jsonb not null default '[]'::jsonb` and plan backfill.

Acceptance criteria:
- Plan records which branch is required before implementation starts.
- No implementation task assumes `template_snippets.placeholders` exists without live confirmation.
- Live validation includes both column presence and real stored `content` shape sampling.

### Phase 1: Normalize snippet content contract at boundaries
Files:
- `frontend/app/api/v1/content/snippets/route.ts`
- `frontend/lib/types/snippets.ts`
- `frontend/components/content-library/ContentSnippetCard.tsx`
- `frontend/components/content-library/ContentLibraryBrowser.tsx`
- `frontend/components/content-library/ContentInsertDialog.tsx`
- `frontend/components/editor/extensions/snippet-expansion.ts`
- Recommended new helper: `frontend/lib/snippets/content-normalization.ts`

Work:
- Define one normalized snippet payload shape for API, actions, and UI.
- Normalize JSONB/Tiptap content into a consistent representation for:
  - content-library display/search preview,
  - editor insertion,
  - optional custom editing/adaptation.
- Remove assumptions that snippet content is always a plain string in content-library UI models.
- Ensure editor insertion path no longer has to guess between string and JSON at every call site.

Acceptance criteria:
- API and client types agree on snippet content shape.
- Content-library components no longer require `content: string` for raw snippet payloads.
- Editor insertion receives normalized insertable content without ad hoc parsing branches scattered across consumers.

### Phase 2: Extract canonical placeholder engine and deterministic snippet resolver
Files:
- `frontend/lib/actions/templates.ts`
- `frontend/app/actions/templates.ts`
- `frontend/lib/actions/partials.ts`
- `frontend/lib/actions/snippets.ts`
- Recommended new shared utilities:
  - `frontend/lib/placeholders/substitution.ts`
  - `frontend/lib/placeholders/context-resolution.ts`
  - `frontend/lib/snippets/resolve-snippet-content.ts`

Work:
- Extract the active recursive substitution logic from `frontend/lib/actions/templates.ts` into shared utilities.
- Migrate `frontend/app/actions/templates.ts` and `frontend/lib/actions/partials.ts` to use the same utilities or explicitly deprecate unused paths after verifying no live callers.
- Implement the explicit `resolveSnippetContent(request)` contract from this plan.
- Implement `normalizePlaceholderKey(...)`, `toPlaceholderToken(...)`, and unresolved-token extraction in the shared placeholder utility so templates, snippets, and partials compare the same raw keys.
- Implement `loadSnippetPlaceholderContext(...)` as a read-only context loader; it must not call accessors that mutate `lastAccessedAt` or other usage metadata.
- Encode the precedence contract exactly as specified above.
- Mark template-local and partial-local substitution helpers for removal/deprecation once callers are migrated.

Acceptance criteria:
- Templates still resolve content exactly as before after extraction.
- Partials still resolve placeholder values exactly as before after migration.
- Snippets, templates, and partials use the same deterministic substitution engine.
- Resolver tests prove precedence and unresolved-token preservation.
- `resolveSnippetContent(...)` has unit tests for request/response shape, content normalization handoff, value provenance, and unresolved-token metadata.
- Placeholder metadata tests prove legacy moustache-wrapped `variableName` values and new raw snippet keys normalize to the same raw key.
- Context-loader tests prove document-to-opportunity resolution through `proposal_documents` without updating `documents.lastAccessedAt`.
- Context-loader tests prove explicit `opportunityId` wins even when document links disagree, with an `explicitOpportunityLinkMismatch` diagnostic, and ambiguous document links across multiple opportunities do not auto-select an opportunity when no explicit opportunity is supplied.
- Context-loader tests prove `Document.metadata.opportunityId` is ignored for opportunity rehydration after ambiguous canonical `proposal_documents` links, while direct scalar document metadata fallbacks still resolve.

### Phase 3: Repair schema/types/seed metadata for placeholders
Files:
- `frontend/lib/db/schema-additions.ts`
- `frontend/lib/types/snippets.ts`
- `frontend/lib/data/datacraft-response-content.ts`
- `frontend/lib/db/seed.ts`
- `frontend/lib/db/seed-templates.ts`
- `frontend/drizzle/*` only if Phase 0 selects the forward-migration branch

Work:
- Add `placeholders` to snippet ORM/types only if required by the Phase 0 branch decision.
- Extend `TemplateSnippet`, `SnippetSummary`, and write/update inputs so placeholder metadata is represented consistently.
- Update Datacraft snippet source typing so placeholder definitions are first-class, not implied, and store raw placeholder keys rather than moustache-wrapped tokens for new snippet metadata.
- Update both seed paths to persist placeholder metadata.
- Define the backfill path for already-seeded rows:
  - idempotent reseed if sufficient, or
  - explicit data migration/script if production rows need repair.

Acceptance criteria:
- Snippet schema, types, and seeds agree on placeholder metadata.
- New and reseeded Datacraft snippets persist placeholder metadata consistently.
- New snippet metadata uses canonical raw keys, while read-time normalization preserves compatibility with existing template/partial `variableName` fields.
- Backfill approach is explicit and idempotent.

### Phase 4: Activate and wire real consumers in priority order
Files:
- `frontend/lib/actions/snippets.ts`
- `frontend/components/editor/TiptapEditor.tsx`
- `frontend/components/editor/extensions/snippet-expansion.ts`
- `frontend/components/editor/extensions/index.ts`
- `frontend/app/(app)/documents/[id]/page.tsx`
- `frontend/components/document/DocumentEditorWithOutline.tsx`
- `frontend/components/document/HDSINodeEditor.tsx`
- `frontend/app/api/v1/content/snippets/route.ts`
- `frontend/components/content-library/ContentLibraryBrowser.tsx`
- `frontend/components/content-library/ContentInsertDialog.tsx`

Work:
- Make `expandShortcut` call `resolveSnippetContent(...)` before returning content.
- Update `SnippetExpansionRequest` / expansion return types so `expandShortcut` can accept context inputs and return resolved content plus unresolved-token metadata.
- Activate the dormant editor path by adding snippet callback props to `TiptapEditor` and passing them through `createExtensions` to `SnippetExpansion`.
- Wire mounted document editor entrypoints (`/documents/[id]`, `DocumentEditorWithOutline`, `HDSINodeEditor` where applicable) with callbacks that call `expandShortcut` using document/opportunity context.
- Define slash-trigger arbitration before wiring: known `/shortcut` followed by Space/Enter expands the snippet and suppresses the command palette; plain `/` at line start still opens the palette; unknown `/shortcut` falls back to normal typing/palette behavior without deleting content.
- Update `SlashCommandTrigger` / `SnippetExpansion` ordering or callback coordination so the above arbitration is testable rather than relying on extension order side effects.
- Update the editor extension to consume the normalized resolved payload, including unresolved-token metadata where needed.
- Ensure content-library fetch/display paths use the normalized content contract.
- Treat `ContentInsertDialog` as secondary: wire it to the same service only where it is mounted inside a document insertion flow, but do not make it the primary path.

Acceptance criteria:
- Slash expansion no longer inserts raw placeholder-bearing content when the required deterministic context is available.
- The mounted document editor has a reachable path to snippet expansion because `TiptapEditor` receives and passes snippet callbacks.
- Slash/palette behavior is deterministic: existing AI palette access remains available, and valid snippet shortcuts do not also open/leave behind palette state.
- Editor insertion and library insertion call the same shared resolution path.
- Dialog behavior, if used, matches the shared pipeline instead of introducing a separate one.
- No consumer reimplements placeholder replacement inline.

### Phase 5: Add mandatory unresolved-placeholder highlighting and optional AI adaptation
Execution gate:
- Do not start Phase 5 until:
  - Phase 0 has documented the repair-vs-migration branch,
  - Phase 1-4 tests pass for shared substitution, context precedence, read-only context loading, document-to-opportunity resolution, normalized snippet content, mounted editor callback wiring, and slash-trigger arbitration.

Files:
- `frontend/lib/actions/snippets.ts`
- `frontend/components/editor/extensions/snippet-expansion.ts`
- New or existing editor decoration extension, e.g. `frontend/components/editor/extensions/unresolved-placeholders.ts`
- `frontend/components/content-library/ContentInsertDialog.tsx`
- Any narrow AI helper introduced for snippet adaptation

Work:
- Add unresolved-placeholder highlighting in inserted editor content through a ProseMirror decoration or equivalent mark/decoration that does not mutate token text.
- Show unresolved placeholder count and token list in insertion preview/customization surfaces where those surfaces are mounted.
- Preserve unresolved tokens exactly as `{{placeholder}}` so authors can search and fix them manually.
- Run AI adaptation only after deterministic substitution is complete.
- Implement the explicit `adaptResolvedSnippet(resolved, richContext)` contract from this plan.
- Restrict AI adaptation to flows with real context such as selected requirement text, section title, or surrounding document text.
- Require the adaptation prompt/guardrails to optimize for narrative flow, requirement relevance, context awareness, and continuity with surrounding section text, while preserving resolved structured facts verbatim.
- Keep shortcut expansion deterministic when no rich context is present.
- Pass unresolved-token metadata through so AI cannot silently mask missing structured values.

Acceptance criteria:
- Unresolved placeholders are highlighted in inserted editor content after slash expansion.
- Insertion preview/customization surfaces show unresolved placeholder count and token names before insert when available.
- Tests assert unresolved tokens remain in document content and are discoverable by the highlighting/decorator logic.
- AI adaptation is optional, not required, for snippet insertion.
- Slash expansion works without AI.
- Adapted content preserves resolved facts and does not replace deterministic values with hallucinated prose.
- Tests or prompt fixtures prove adaptation is invoked only after `resolveSnippetContent(...)`.
- Prompt fixtures prove the adapted output explicitly addresses the selected requirement text, avoids generic boilerplate when requirement text is available, and keeps the same client/opportunity/RFP facts as deterministic resolution.
- Prompt fixtures or deterministic mocks prove adapted output can bridge from preceding/surrounding text without abrupt topic shifts, repeated openings, or contradictory voice.
- Adaptation returns `adaptationNotes` that identify which requirement/context inputs were used and whether any unresolved placeholders remained unaddressed.

### Phase 6: Cleanup and verification
Files:
- `frontend/lib/actions/templates.ts`
- `frontend/app/actions/templates.ts`
- `frontend/lib/actions/partials.ts`
- New or updated tests under:
  - `frontend/__tests__/actions/`
  - `frontend/__tests__/components/`
  - `frontend/__tests__/integration/`

Work:
- Remove or deprecate duplicate placeholder engines after all callers use the shared utility:
  - production template helpers in `frontend/lib/actions/templates.ts`,
  - duplicate template action helpers in `frontend/app/actions/templates.ts`,
  - partial helpers in `frontend/lib/actions/partials.ts`.
- Add targeted tests for schema branch behavior, normalization, precedence, unresolved-token handling, and consumer wiring.
- Place tests in paths already included by `frontend/vitest.config.ts`:
  - actions/project `node` tests under `frontend/__tests__/actions/**/*.test.ts`,
  - component/editor `jsdom` tests under `frontend/__tests__/components/**/*.test.{ts,tsx}`,
  - API/DB integration tests under `frontend/__tests__/integration/**/*.test.ts`.
  Only choose colocated tests if Phase 6 also updates `frontend/vitest.config.ts` to include those paths.
- Verify seed/backfill path on a real database after schema branch selection.

Acceptance criteria:
- No duplicate production placeholder engine remains for templates, snippets, or partials.
- Tests cover deterministic resolution and content normalization across the real consumer paths.
- Verification explicitly covers both slash expansion and content-library insertion behavior.

## Tests and Verification

### Unit tests
- `frontend/__tests__/actions/placeholders-substitution.test.ts`
  - recursive substitution in Tiptap JSON
  - unresolved token preservation
  - precedence order correctness
  - canonical raw-key normalization from bare keys, moustache-wrapped keys, and unresolved tokens
  - compatibility with the former template and partial behaviors
- `frontend/__tests__/actions/placeholders-context-resolution.test.ts`
  - read-only document context lookup does not update `documents.lastAccessedAt`
  - `documentId -> proposal_documents -> opportunityId` resolution uses explicit opportunity first, reports `explicitOpportunityLinkMismatch` when explicit context conflicts with links, uses same-opportunity links second, and does not guess across multiple distinct opportunities
  - ambiguous multi-opportunity links produce an `ambiguousOpportunityLink` diagnostic and leave opportunity-scoped placeholders unresolved
  - `metadata.opportunityId` does not override ambiguous canonical proposal-document links
  - requirement context precedence keeps explicit `requirementText` ahead of derived requirement lookup
- `frontend/__tests__/actions/snippet-content-normalization.test.ts`
  - JSONB/Tiptap to preview/edit/insert normalization
  - string legacy payload handling
- `frontend/__tests__/actions/snippets.test.ts`
  - `expandShortcut` resolves deterministic values before returning content
  - `resolveSnippetContent(...)` returns unresolved-token metadata and value provenance
  - `adaptResolvedSnippet(...)` is optional and post-resolution only
  - adaptation prompt fixtures preserve deterministic facts while improving requirement relevance, narrative flow, and continuity with surrounding text

### Integration tests
- `frontend/__tests__/integration/content-snippets-route.test.ts`
  - normalized content payload shape
  - placeholder metadata exposure
- `frontend/__tests__/components/snippet-expansion.test.ts`
  - resolved insertion path
  - unresolved-token preservation when context is missing
  - slash-trigger arbitration: known shortcut expands without opening the palette; plain slash still opens the palette; unknown shortcut does not delete content
- `frontend/__tests__/components/unresolved-placeholders.test.ts`
  - finds `{{placeholder}}` tokens
  - returns decoration ranges or equivalent highlight metadata
  - does not alter document text

### Test runner mapping
- From `frontend/`, run actions/unit coverage with `npm test -- --project actions --run __tests__/actions/placeholders-substitution.test.ts __tests__/actions/placeholders-context-resolution.test.ts __tests__/actions/snippet-content-normalization.test.ts __tests__/actions/snippets.test.ts`.
- From `frontend/`, run component coverage with `npm test -- --project unit --run __tests__/components/snippet-expansion.test.ts __tests__/components/unresolved-placeholders.test.ts`.
- From `frontend/`, run API/integration coverage with `npm test -- --project integration --run __tests__/integration/content-snippets-route.test.ts`.

### Manual / execution-time verification
- Validate live DB column presence with an `information_schema.columns` query before choosing repair vs migration.
- Sample existing `template_snippets.content` rows to confirm actual stored shape.
- Reseed or backfill Datacraft snippets and verify placeholder metadata persistence.
- Verify new snippet placeholder metadata stores raw keys and that legacy moustache-wrapped template/partial metadata still resolves.
- Open the concrete mounted document editor route `/documents/[id]` after implementation wires `TiptapEditor` snippet callbacks.
- Expand a Datacraft slash shortcut in an opportunity-linked document and confirm:
  - deterministic fields resolve,
  - unresolved tokens remain visible when missing,
  - unresolved tokens are highlighted in the editor,
  - no AI dependency exists for shortcut expansion.
- Run a content-library/dialog insertion flow only if mounted in a document-context entrypoint during implementation; otherwise verify its service-level behavior through action/component tests and record UI mounting as a follow-up.
- Run rich-context insertion with requirement text and confirm AI adaptation, if enabled, happens only after deterministic resolution.

## Migration / Live DB Validation Plan

Execution must follow this branch logic:
1. Compare checked-in schema:
   - `frontend/lib/db/schema-additions.ts`
   - `frontend/drizzle/0003_closed_betty_ross.sql`
2. Query live DB for:
   - `template_snippets.placeholders` presence
   - data type, nullability, and default
   - sample stored `content` payloads
3. Choose one path:
   - **Repair path:** live DB already has the column. Update ORM/types/API/seeds to match live reality, then regenerate checked-in schema artifacts as needed.
   - **Migration path:** live DB does not have the column. Add forward migration, backfill existing rows to `[]`, then update ORM/types/API/seeds.

Migration acceptance criteria:
- The chosen branch is documented before code changes.
- Checked-in Drizzle schema and migration history match the selected live DB reality after execution.
- Existing snippet rows remain readable and insertable throughout the transition.

## Risks
- **Schema drift risk:** checked-in ORM/migration state already disagrees with the intended plan.
- **Content-shape risk:** content-library UI currently assumes string content while storage and API return JSONB/Tiptap.
- **Behavioral divergence risk:** fixing only dialog insertion would leave slash expansion inconsistent.
- **AI coupling risk:** allowing AI to fill deterministic context would make expansion non-repeatable.
- **Backfill risk:** seeded/public snippets may need idempotent repair without breaking analytics associations.
- **Read-side-effect risk:** using document server actions that update access timestamps would make snippet resolution mutate state unexpectedly.
- **Trigger-collision risk:** `/` is already used by both AI command palette and snippet shortcut expansion, so implementation must preserve deterministic arbitration.

## Execution Handoff Guidance

### Available Agent Types
- `explore`: fast read-only codebase mapping.
- `planner`: task sequencing and risk flags.
- `architect`: architecture review and boundary validation.
- `executor`: implementation and refactoring.
- `debugger`: root-cause analysis for failed tests/build issues.
- `test-engineer`: test strategy and coverage design.
- `verifier`: completion evidence and claim validation.
- `code-reviewer`: final code review across correctness, maintainability, and regressions.

### Sequential `$ralph` Staffing
Use one main execution owner and keep the phases sequential because Phase 0 schema/live DB validation controls later migration choices.

Recommended sequence:
1. `explore` or local inspection: confirm schema, live DB shape, mounted editor entrypoints, and actual callers.
2. `executor` high reasoning: implement Phase 1 through Phase 4 in small commits or reviewable chunks.
3. `executor` high reasoning: implement Phase 5 unresolved-placeholder highlighting and optional AI adaptation once deterministic insertion is working.
4. `executor` medium reasoning: complete Phase 6 duplicate-engine cleanup after all callers use the shared utility.
5. `test-engineer` medium reasoning: add unit/integration/editor tests around resolver, normalization, expansion, highlighting, AI adaptation, and cleanup regressions.
6. `debugger` high reasoning: handle build, type, and test failures after implementation.
7. `verifier` high reasoning: validate acceptance criteria, live DB branch decision, manual document-editor flow, unresolved-placeholder highlighting, and rich-context adaptation evidence.
8. `code-reviewer` high reasoning: review the final diff for duplicate placeholder logic, auth/data exposure, and AI coupling mistakes.

Launch hint:

```text
$ralph implement .omx/plans/snippet-context-resolution-consensus.md
```

### Parallel `$team` Staffing
Use team mode only after Phase 0 chooses the DB branch, because migration/schema direction is a shared blocker.

Suggested lanes after Phase 0:
- Lane A, `executor` high reasoning: schema/types/seed placeholder metadata and any migration/backfill.
- Lane B, `executor` high reasoning: shared substitution, canonical placeholder-key normalization, read-only context resolution, and content normalization utilities.
- Lane C, `executor` high reasoning: editor/content-library consumer wiring, slash-trigger arbitration, and unresolved-placeholder highlighting.
- Lane D, `executor` high reasoning: AI adaptation helper, prompt fixtures, rich-context insertion contract, and adaptation notes.
- Lane E, `executor` medium reasoning: duplicate placeholder-engine cleanup for templates, duplicate app actions, and partials.
- Lane F, `test-engineer` medium reasoning: resolver, API, editor extension, insertion-flow, highlighting, and adaptation tests.
- Lane G, `verifier` high reasoning: live DB checks, manual editor verification, and acceptance evidence.

Launch hint:

```text
$team implement .omx/plans/snippet-context-resolution-consensus.md after first completing Phase 0 live DB validation
```

### Team Verification Path
- Phase 0 evidence: checked-in schema review plus `information_schema.columns` result for `template_snippets.placeholders` and sampled `template_snippets.content` rows.
- Resolver evidence: tests proving precedence order, canonical key normalization, unresolved-token preservation, read-only context loading, document-to-opportunity resolution, and provenance reporting.
- Ambiguity evidence: tests proving explicit `opportunityId` wins with mismatch diagnostics, and a document linked to multiple distinct opportunities does not auto-substitute client/opportunity/RFP fields without explicit `opportunityId`.
- Consumer evidence: tests proving `expandShortcut` and the mounted `TiptapEditor` callback path use the shared resolver and deterministic slash arbitration.
- UI evidence: browser/manual verification on `/documents/[id]` showing resolved insertion, highlighted unresolved placeholders, and no AI dependency for slash expansion.
- AI evidence: a rich-context adaptation test or fixture proving adaptation runs only after deterministic resolution, preserves resolved structured facts, uses selected requirement text, and improves narrative continuity with surrounding section text.
- Cleanup evidence: static search or test evidence showing template, snippet, and partial consumers no longer maintain separate production placeholder engines.
