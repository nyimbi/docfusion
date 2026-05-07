# Ralph Context Snapshot: JTBD Domain Handler Completion

## Task Statement

Ensure completion of catalogue domains that still need workflow domain handlers as their durable state models become clear, and add browser interaction coverage for the workflow action panel.

## Desired Outcome

- Workflow runtime has concrete compensation/transition handlers for every catalogue domain where a stable existing domain table or action surface exists.
- Missing handlers are not overclaimed where no durable state model is evident.
- Workflow action panel has browser-style interaction coverage proving start and transition submissions call the expected APIs.
- Fresh verification, architect review, deslop pass, post-deslop verification, commit, push, and Ralph state cleanup are completed.

## Known Facts / Evidence

- Existing pushed commits:
  - `8e7dc3c` hardened runtime, authz, templates, workers, Stalwart dispatch, migration validation, UI screens.
  - `cc8febf` added `workflow-domain.ts`, `/api/v1/workflows/start`, template-aware transitions, compensation for evidence claims, pricing package/cost element, import sync job, and partner assignment, plus `WorkflowActionPanel`.
- Existing focused verification for the last slice passed:
  - `npx tsc --noEmit`
  - 9 workflow-related Vitest files, 40 tests passed.
- Worktree is heavily dirty with unrelated changes. Stage only Ralph-owned hunks.
- Branch is `ralph-jtbd-workflow-requirements`; previous pushes succeed remotely but local remote-tracking ref update may warn due `.git` lock permissions.

## Constraints

- Do not revert unrelated dirty worktree changes.
- Use existing domain schemas and repo patterns; avoid new dependencies.
- No scope reduction or overclaiming.
- Mandatory Ralph requirements: fresh verification, architect verification, deslop pass on changed files, post-deslop verification, clean state completion.

## Unknowns / Open Questions

- Which catalogue domains have sufficiently stable durable state models beyond the already-covered evidence/pricing/import/partner domains.
- Existing UI test infrastructure may not support full Playwright/browser interaction for isolated components; use available Vitest/jsdom/browser-style coverage if Playwright component coverage is absent.
- Some domains may have multiple overlapping schema files; prefer canonical exported tables used by current actions.

## Likely Codebase Touchpoints

- `frontend/lib/actions/workflow-domain.ts`
- `frontend/components/workflows/WorkflowActionPanel.tsx`
- `frontend/app/api/v1/workflows/**`
- `frontend/__tests__/actions/workflow-domain.test.ts`
- new component/browser interaction test under `frontend/__tests__/components` or similar existing pattern
- `docs/jtbd-workflow-implementation-plan.md`
- `docs/platform-jtbd-catalogue.md`
