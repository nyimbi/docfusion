# Snippet Context Resolution Hardening Plan

## Requirements Summary

Finish the remaining validation and hardening around the completed snippet context-resolution implementation:

- add browser or component-level interaction coverage for real `/shortcut` expansion,
- verify the real document editor flow against an opportunity-linked document,
- integrate `ContentInsertDialog` with the shared `resolveSnippetContent` / `adaptResolvedSnippet` path if it is mounted in a document insertion flow,
- add richer AI adaptation fixtures for narrative continuity and requirement relevance,
- broaden precedence tests across all resolver source tiers,
- isolate this work for clean commit hygiene in a dirty worktree.

Existing core implementation already includes schema/migration, deterministic resolver, context loader, editor extension wiring, unresolved-placeholder highlighting, Datacraft snippet placeholders, live DB migration, and live seeding.

## RALPLAN-DR Summary

### Principles

- Keep deterministic snippet resolution as the single source of truth.
- Treat browser/manual validation as evidence collection, not a reason to fork logic.
- Avoid widening the diff into unrelated dirty-worktree cleanup.
- Prefer tests that exercise the real mounted/editor path over duplicating unit assertions.
- Keep AI adaptation optional and post-resolution.

### Decision Drivers

- The highest residual risk is interaction behavior in the real Tiptap editor: valid shortcut expansion, plain `/` palette behavior, and unknown shortcut preservation.
- `ContentInsertDialog` may or may not be mounted in a document insertion path; implementation should be conditional on actual caller discovery.
- The resolver is covered by focused tests, but source-tier precedence and AI adaptation quality can be strengthened with targeted fixtures.

### Viable Options

#### Option A: Evidence-first hardening, then conditional integration

- Add interaction tests and manual verification first.
- Inspect actual `ContentInsertDialog` callers before modifying it.
- Add only the precedence/adaptation fixtures that close real gaps.
- Commit only the snippet/context-resolution files.

Pros: low regression risk; avoids speculative UI rewiring; produces the evidence most likely to catch real defects.
Cons: may leave `ContentInsertDialog` unchanged if no real document insertion caller exists.

#### Option B: Fully rework ContentInsertDialog now

- Convert the dialog to normalized `DocumentContent` everywhere and wire it to resolver/adaptation regardless of current mounting.

Pros: makes the dialog future-ready.
Cons: higher UI blast radius; likely speculative if the dialog is not used by the active document authoring flow.

#### Option C: Browser-only validation, no new unit fixtures

- Add Playwright/manual coverage and stop there.

Pros: fastest.
Cons: misses deterministic precedence and AI prompt-regression risks that are cheap to lock down in tests.

### Chosen Direction

Choose **Option A**.

### Invalidation Rationale

- Reject Option B unless caller inspection proves the dialog is part of a live document insertion flow; otherwise it is speculative.
- Reject Option C because the resolver has several source tiers that should be locked by tests rather than only by manual exercise.

## ADR

### Decision

Proceed with evidence-first hardening: add real editor interaction coverage, perform live document-flow verification, inspect and conditionally wire `ContentInsertDialog`, expand AI and precedence fixtures, then prepare a narrow commit containing only snippet/context-resolution changes.

### Drivers

- Core code is already implemented and build-verified.
- Remaining risk is mostly behavioral proof and edge-case coverage.
- The repository has a broad pre-existing dirty state, so scope isolation is essential.

### Alternatives Considered

- Dialog-first integration.
- Manual-only validation.
- Deferring all remaining work to future QA.

### Why Chosen

It targets the remaining uncertainty directly while keeping the implementation small, testable, and separable from unrelated changes.

### Consequences

- Browser tests may require a deterministic auth/test-data setup or a component-level fallback if e2e auth is too expensive.
- `ContentInsertDialog` may be left as a documented follow-up if not mounted in a real document-context insertion flow.
- If `ContentInsertDialog` is mounted later, integration requires an explicit client/server adapter contract rather than extending the current string-only callbacks.
- The final commit should use pathspecs to stage only files touched by this snippet work.

### Follow-ups

- Consider migrating `next lint` to ESLint CLI separately; it is unrelated to this feature.
- Consider a dedicated editor e2e fixture document/opportunity seed if repeated browser testing becomes important.

## Implementation Steps

### 0. Pre-Flight Surface Discovery Gate

Files:

- `frontend/app/(app)/documents/[id]/page.tsx`
- `frontend/app/(app)/content-library/page.tsx`
- `frontend/components/content-library/ContentInsertDialog.tsx`
- `frontend/components/content-library/ContentLibraryBrowser.tsx`
- Existing e2e specs under `frontend/e2e/`

Work:

- Confirm active insertion surfaces before changing UI:
  - `/documents/[id]` mounts `TiptapEditor` and reaches `expandShortcut`.
  - `/content-library` mounts `ContentLibraryBrowser`.
  - `ContentInsertDialog` has a mounted caller or does not.
- Confirm what document context the active route passes:
  - current route passes `documentId`,
  - `opportunityId` is not passed unless execution changes that explicitly,
  - resolver therefore exercises `proposalDocuments` link resolution or `metadata.opportunityId` fallback.
- Confirm browser-test convention:
  - use `frontend/e2e/snippet-expansion.spec.ts` only if a stable harness/auth path exists,
  - otherwise prefer `frontend/__tests__/components/snippet-expansion.test.ts` in the Vitest component lane.

Acceptance criteria:

- Execution records the active insertion surface decision before touching `ContentInsertDialog`.
- Execution records whether browser coverage will be Playwright harness/e2e or component-level.
- No speculative dialog rewrite begins before this gate passes.

### 1. Add Editor Interaction Coverage

Files:

- `frontend/__tests__/components/snippet-expansion.test.ts` or an existing component test harness.
- Optionally `frontend/e2e/snippet-expansion.spec.ts` if the repo has a stable Playwright harness/auth/test-data path.
- `frontend/components/editor/extensions/snippet-expansion.ts` only if tests reveal behavior bugs.

Work:

- Test known `/shortcut + Space` expands resolved content and removes the shortcut token.
- Test known `/shortcut + Enter` expands, inserts the expected node structure, appends a paragraph, and places selection in the intended location.
- Test plain `/` at line start remains available to the command palette path.
- Test unknown `/shortcut + Space` preserves typed text, including the trailing space.
- Test unknown `/shortcut + Enter` preserves content and inserts a newline/paragraph without deleting the shortcut.

Acceptance criteria:

- Valid shortcuts expand once and do not leave `/shortcut` behind.
- Plain `/` behavior remains available.
- Unknown shortcuts do not delete or swallow user input.
- Enter expansion assertions cover document node shape and selection/caret behavior, not only plain text.
- Tests run in the existing Vitest component lane unless a stable Playwright lane is available.

### 2. Perform Manual Document-Flow Verification

Files:

- No source changes expected unless defects are found.
- Record results in `.omx/state/` or a short verification note if useful.

Work:

- Identify or create live/dev documents that exercise the real route's context branches:
  - one document with a single `proposalDocuments` opportunity link,
  - one document with zero proposal links plus `metadata.opportunityId`,
  - one ambiguous document linked to multiple opportunities as a negative case.
- Start the frontend locally.
- Open `/documents/[id]`.
- Type a Datacraft shortcut such as `/dc-exec-summary` plus Space.
- Confirm deterministic fields resolve from opportunity/document context.
- Confirm unresolved placeholders remain as `{{...}}` and are visually highlighted.
- Confirm the flow works with AI disabled or without rich context.

Acceptance criteria:

- A real document route demonstrates deterministic insertion through the single-link branch.
- The zero-link metadata fallback branch is verified manually or by a targeted resolver test if building a browser fixture would be excessive.
- The ambiguous multi-link branch is verified as a negative resolver/manual case and does not silently substitute opportunity-scoped values.
- No AI call is required for slash expansion.
- Evidence includes document id/opportunity relationship, shortcut used, and observed result.

### 3. Inspect and Conditionally Integrate `ContentInsertDialog`

Files:

- `frontend/components/content-library/ContentInsertDialog.tsx`
- Actual callers discovered through `rg "ContentInsertDialog|onInsertSnippet|onAIAdapt"`.
- A server action or API adapter only if a real mounted caller requires client-to-server resolution.

Work:

- Confirm whether `ContentInsertDialog` is mounted in a real document insertion flow.
- If not mounted in a real document flow, document it as intentionally deferred and add no speculative UI rewrite.
- If mounted with document context, replace the older `onAIAdapt` string-only flow through an explicit adapter contract that returns:
  - `resolvedContent: DocumentContent`,
  - `plainTextPreview: string`,
  - `unresolvedPlaceholders`,
  - `diagnostics`,
  - optional `adaptedContent` / `adaptationNotes`.
- The adapter must call the shared server-side resolver/adaptation path:
  - resolve deterministic placeholders,
  - show unresolved count/token list,
  - optionally call `adaptResolvedSnippet`,
  - insert normalized content or plain text according to the caller’s editor contract.

Acceptance criteria:

- No duplicate placeholder resolution logic is introduced.
- If changed, dialog insertion uses the same resolver/adaptation path as slash expansion.
- If unchanged, the plan records why no code change was warranted.
- The dialog is not converted by importing `"use server"` modules directly into client code.

### 4. Add Richer AI Adaptation Fixtures

Files:

- `frontend/__tests__/actions/snippet-placeholder-resolution.test.ts` or a dedicated `frontend/__tests__/actions/snippet-ai-adaptation.test.ts`.
- `frontend/lib/snippets/resolve-snippet-content.ts` only if tests expose weak diagnostics.

Work:

- Mock the AI client with requirement-aware adapted prose.
- Assert `adaptResolvedSnippet` receives already-resolved content.
- Assert deterministic facts such as client/opportunity/RFP values remain unchanged.
- Assert unresolved tokens remain unchanged.
- Assert adaptation notes identify which context inputs were used.
- Add a negative fixture where AI fails and deterministic content is preserved with `aiAdaptationUnavailable`.

Acceptance criteria:

- Tests prove adaptation is post-resolution.
- Tests prove narrative adaptation uses requirement/section/surrounding context.
- Tests prove fallback preserves deterministic content.

### 5. Broaden Context Precedence Coverage

Files:

- `frontend/__tests__/actions/snippet-placeholder-context.test.ts`
- `frontend/__tests__/actions/snippet-placeholder-resolution.test.ts`

Work:

- Add cases for:
  - requirement lookup by `requirementId`,
  - explicit `requirementText` overriding derived requirement text,
  - document scalar metadata fallback (`clientName`, `rfpNumber`, `dueDate`, `projectValue`),
  - opportunity metadata fallback for solicitation number,
  - company variables,
  - placeholder defaults,
  - explicit `placeholderValues` overriding every derived source.
- Add type hygiene for `DocumentMetadata` if execution locks `metadata.opportunityId` as a supported fallback rather than only an untyped metadata convention.

Acceptance criteria:

- Each precedence tier has at least one conflict or fallback test.
- Ambiguous opportunity-link behavior remains locked.
- Direct scalar document metadata remains allowed after ambiguous links, while opportunity rehydration through `metadata.opportunityId` remains blocked.

### 6. Commit Hygiene

Files:

- Only files related to snippet context resolution, tests, migration, and plan artifacts.

Work:

- Produce a scoped file list with `git status --short -- <pathspecs>`.
- Stage via explicit pathspecs only.
- Avoid staging unrelated dirty files already present in the repo.
- Commit with Lore protocol trailers.

Acceptance criteria:

- Commit excludes unrelated dirty worktree changes.
- Commit message records live migration/seed validation and test evidence.
- Remaining unstaged unrelated changes are left untouched.

## Verification Steps

Run from `frontend/`:

```bash
npm test -- --run __tests__/actions/snippet-placeholder-resolution.test.ts __tests__/actions/snippet-placeholder-context.test.ts __tests__/actions/snippet-content-normalization.test.ts __tests__/components/unresolved-placeholders.test.ts __tests__/integration/content-snippets-route.test.ts
npm run test:e2e -- e2e/snippet-expansion.spec.ts
npx tsc --noEmit
npm run lint
npm run build
```

Run live/dev DB checks from repo root without printing secrets:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "select count(*) filter (where jsonb_array_length(placeholders) > 0) || '/' || count(*) from template_snippets where created_by='system' and is_public=true;"
```

Manual/browser verification:

- start dev server,
- open real `/documents/[id]`,
- expand a Datacraft shortcut,
- capture evidence of resolved fields, highlighted unresolved placeholders, and no AI dependency.

## Risks and Mitigations

- **Auth/test-data e2e risk:** Use component-level editor tests if Playwright setup is not stable.
- **Speculative dialog rewrite risk:** Inspect callers first; change `ContentInsertDialog` only if it is part of a real insertion flow.
- **Dirty worktree risk:** Use explicit pathspecs for status, staging, and commit.
- **AI non-determinism risk:** Mock AI for fixtures; keep deterministic fallback asserted.
- **Editor flakiness risk:** Prefer direct Tiptap/component tests for shortcut arbitration; add Playwright only for one happy path if stable.

## Available Agent Types

- `explore`: quick caller/test-data mapping.
- `executor`: implementation and focused refactors.
- `test-engineer`: editor/component/e2e tests and fixtures.
- `debugger`: failing test/build diagnosis.
- `verifier`: final evidence validation.
- `architect`: review integration boundaries.
- `critic`: final plan/diff quality challenge.
- `git-master`: scoped commit hygiene.

## Follow-Up Staffing Guidance

### Ralph Sequential Path

Use `$ralph .omx/plans/snippet-context-resolution-hardening-plan.md`.

Recommended sequence:

1. `explore` low effort: identify `ContentInsertDialog` callers, e2e auth/test data, and a real opportunity-linked document.
2. `test-engineer` medium effort: add component/editor interaction tests and precedence/adaptation fixtures.
3. `executor` high effort: fix any discovered editor/dialog defects.
4. `verifier` high effort: run automated gates plus manual document-flow verification.
5. `git-master` high effort: stage only scoped files and prepare Lore commit.

### Team Parallel Path

Use `$team implement .omx/plans/snippet-context-resolution-hardening-plan.md`.

Suggested lanes:

- Lane A, `test-engineer`: component/editor shortcut tests.
- Lane B, `test-engineer`: AI adaptation and precedence fixtures.
- Lane C, `explore` then `executor`: `ContentInsertDialog` caller inspection and conditional integration.
- Lane D, `verifier`: browser/manual document-flow setup and evidence capture.
- Lane E, `git-master`: pathspec list and commit hygiene plan.

## Launch Hints

```text
$ralph .omx/plans/snippet-context-resolution-hardening-plan.md
```

```text
$team implement .omx/plans/snippet-context-resolution-hardening-plan.md
```

## Team Verification Path

- Team proves all new targeted tests pass.
- Team proves `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.
- Team provides manual/browser evidence for `/documents/[id]` expansion or records a concrete blocker.
- Team provides explicit `ContentInsertDialog` caller finding and resulting decision.
- Ralph/verifier re-runs final gates and confirms the commit scope excludes unrelated dirty files.

## Consensus Review Changelog

- Architect review iteration 1 required a pre-flight insertion-surface gate before any dialog work.
- Added an explicit `ContentInsertDialog` adapter contract and a warning against importing server modules directly into client code.
- Expanded manual verification into the real route branches: single proposal-document link, zero-link `metadata.opportunityId`, and ambiguous multi-link negative case.
- Corrected optional Playwright location to `frontend/e2e/snippet-expansion.spec.ts`.
- Tightened editor interaction coverage to assert ProseMirror node structure and selection behavior for Enter expansion.
- Added a type-hygiene note for `DocumentMetadata.metadata.opportunityId` if that fallback is treated as supported behavior.
- Critic approved the revised plan and noted that, if React Testing Library is not already available, executor should use a direct Tiptap/jsdom harness for component-lane shortcut tests.
