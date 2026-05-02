# Snippet Context Hardening Surface Discovery

## Decision

Do not rewrite `ContentInsertDialog` in this hardening pass.

## Evidence

- `/documents/[id]` mounts `TiptapEditor` and passes `documentId`.
- `TiptapEditor` calls `expandShortcut({ shortcut, documentId, opportunityId })`; current route does not pass `opportunityId`.
- `/content-library` mounts `ContentLibraryBrowser` in browse mode.
- `ContentInsertDialog` is exported from `frontend/components/content-library/index.ts`, but repository search found no mounted document-context caller.
- Existing browser specs live under `frontend/e2e/`, including a harness-style Playwright test.
- The existing Vitest component project names jsdom, but `jsdom` is not installed; using a harness-style Playwright test avoids adding a new dependency.

## Resulting Scope

- Add editor shortcut coverage through `frontend/e2e/snippet-expansion.spec.ts`.
- Keep `ContentInsertDialog` unchanged until a real mounted document insertion caller exists.
- Verify route context branches through resolver tests and safe read-only DB evidence.
