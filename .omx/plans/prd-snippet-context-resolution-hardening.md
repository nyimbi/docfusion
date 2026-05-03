# PRD: Snippet Context Resolution Hardening

## Goal

Close the remaining evidence and hardening gaps for snippet context resolution after the core resolver, schema, seed, and editor wiring implementation.

## Scope

- Verify active insertion surfaces before changing UI.
- Add editor shortcut interaction coverage for `/shortcut` Space/Enter behavior.
- Verify real document context branches for opportunity-linked snippet resolution.
- Add richer AI adaptation and resolver precedence fixtures.
- Integrate `ContentInsertDialog` only if a real mounted document-context caller exists.
- Preserve commit hygiene in a dirty worktree.

## Out of Scope

- Broad content-library redesign.
- Speculative rewrite of unused dialog flows.
- New dependencies unless existing test harnesses cannot cover the behavior.
- Unrelated dirty-worktree cleanup.

## Acceptance Criteria

- Active insertion surface decision is recorded.
- Component or browser tests cover valid shortcut expansion, unknown shortcut preservation, plain slash behavior, and Enter node/selection behavior.
- Resolver tests cover all source tiers called out in the hardening plan.
- AI adaptation tests prove post-resolution adaptation and deterministic fallback on failure.
- Manual or resolver-level verification covers single proposal-document link, zero-link `metadata.opportunityId`, and ambiguous multi-link behavior.
- `npx tsc --noEmit`, lint, targeted tests, and build pass.
- Final commit scope can be expressed as explicit pathspecs excluding unrelated files.
