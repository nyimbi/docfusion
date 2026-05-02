# Test Spec: Snippet Context Resolution Hardening

## Targeted Test Command

Run from `frontend/`:

```bash
npm test -- --run __tests__/actions/snippet-placeholder-resolution.test.ts __tests__/actions/snippet-placeholder-context.test.ts __tests__/actions/snippet-content-normalization.test.ts __tests__/components/unresolved-placeholders.test.ts __tests__/integration/content-snippets-route.test.ts
```

Run shortcut interaction coverage through the existing Playwright harness lane:

```bash
npm run test:e2e -- e2e/snippet-expansion.spec.ts
```

## Required Coverage

- `SnippetExpansion` known shortcut plus Space replaces shortcut with resolved content.
- `SnippetExpansion` known shortcut plus Enter inserts resolved nodes, appends/focuses a paragraph, and removes shortcut text.
- Unknown shortcut plus Space preserves text and trailing space.
- Unknown shortcut plus Enter preserves shortcut text and inserts a paragraph/newline.
- Plain `/` remains available to slash-command palette handling.
- Resolver covers explicit request values, requirement lookup, explicit requirement text, document scalar metadata, opportunity metadata, company variables, placeholder defaults, and unresolved tokens.
- AI adaptation runs after deterministic resolution, preserves facts/tokens, records context notes, and falls back with `aiAdaptationUnavailable` on AI failure.
- Content snippets route keeps normalized content and placeholder metadata.

## Build and Static Checks

Run from `frontend/`:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Live/Manual Evidence

- Query live/dev DB for snippet placeholder seeding count.
- Identify representative document/opportunity context branches.
- If feasible, open `/documents/[id]` and expand a Datacraft shortcut.
- If browser auth/test data blocks full manual verification, record the blocker and provide resolver-level evidence for the same branches.
