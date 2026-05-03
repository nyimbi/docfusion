# Test Spec: Snippet Context Resolution and AI Adaptation

## Required Automated Tests

Run from `frontend/`.

### Actions Project
Command:

```bash
npm test -- --project actions --run __tests__/actions/placeholders-substitution.test.ts __tests__/actions/placeholders-context-resolution.test.ts __tests__/actions/snippet-content-normalization.test.ts __tests__/actions/snippets.test.ts
```

Coverage:
- recursive placeholder substitution in Tiptap JSON,
- raw-key and moustache-wrapped placeholder normalization,
- unresolved token preservation,
- read-only context loading without `documents.lastAccessedAt` mutation,
- `documentId -> proposal_documents -> opportunityId` resolution,
- explicit-opportunity mismatch and ambiguous-link diagnostics,
- `metadata.opportunityId` guard after ambiguous canonical links,
- `expandShortcut`, `resolveSnippetContent`, and `adaptResolvedSnippet` contracts.

### Component Project
Command:

```bash
npm test -- --project unit --run __tests__/components/snippet-expansion.test.ts __tests__/components/unresolved-placeholders.test.ts
```

Coverage:
- resolved insertion path,
- slash-trigger arbitration,
- unresolved-placeholder scan/decorator behavior,
- unresolved tokens remain unmodified.

### Integration Project
Command:

```bash
npm test -- --project integration --run __tests__/integration/content-snippets-route.test.ts
```

Coverage:
- normalized content payload shape,
- placeholder metadata exposure.

## Required Build Checks

```bash
npx tsc --noEmit
```

## Manual Verification
- Validate live `template_snippets.placeholders` shape before choosing repair vs migration.
- Sample live `template_snippets.content` rows.
- Confirm Datacraft snippets persist raw placeholder keys.
- In a mounted `/documents/[id]` editor, expand a Datacraft shortcut and confirm deterministic fields resolve, missing placeholders remain visible, and slash expansion does not require AI.
- Run a rich-context adaptation fixture or flow and confirm adaptation happens only after deterministic resolution.
