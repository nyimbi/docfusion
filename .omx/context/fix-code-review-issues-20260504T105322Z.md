# Fix Code Review Issues Context

## Task Statement

Fix all issues identified in the `$code-review` pass, including low-priority issues.

## Desired Outcome

Produce a bounded implementation plan that can be executed without deferring any review finding:

- Workflow start authorization failures return correct forbidden semantics without leaking internal details.
- Google Docs access-token refresh persists refreshed tokens on all successful refresh paths.
- OAuth callback behavior has route-level regression coverage for state/user binding, redirect sanitization, token cookie writes, and state-cookie cleanup.

## Known Facts / Evidence

- Current branch: `ralph-jtbd-workflow-requirements`.
- Worktree was clean before planning.
- Review diff scope was `HEAD~4..HEAD`, covering 59 changed files.
- `frontend/app/api/v1/workflows/start/route.ts` catches all exceptions and returns raw `error.message` with HTTP `400`.
- `frontend/lib/actions/workflow-domain.ts` enforces start authority through `assertWorkflowAuthority`.
- `frontend/app/api/v1/google/docs/[docId]/route.ts` refreshes from a refresh token when the access token is absent, but only persists refreshed tokens on the later `401` retry path.
- `frontend/app/api/v1/google/callback/route.ts` now validates OAuth state and binds Google tokens to the app session user, but visible tests are helper-level rather than route-level.

## Constraints

- Do not introduce new dependencies.
- Keep changes small, behavior-preserving except for the reviewed corrections.
- Preserve existing auth/session helpers and cookie helper patterns.
- No mocks or stubs in product code; tests may mock framework/session/network dependencies as existing route tests already do.
- Run lint, typecheck, unit tests, and build before claiming completion.

## Unknowns / Open Questions

- Whether workflow authority denials have a typed error class today. If not, the implementation should add a small local typed error or predicate rather than string-matching route errors.
- Whether Google callback route tests already exist under a less obvious name. Confirm with search before adding new coverage.

## Likely Codebase Touchpoints

- `frontend/lib/actions/workflow-domain.ts`
- `frontend/app/api/v1/workflows/start/route.ts`
- `frontend/app/api/v1/google/docs/[docId]/route.ts`
- `frontend/app/api/v1/google/callback/route.ts`
- `frontend/__tests__/actions/workflow-domain.test.ts`
- `frontend/__tests__/api/*google*`
- `frontend/__tests__/google/bound-tokens.test.ts`
