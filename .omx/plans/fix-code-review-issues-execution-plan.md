# Fix Code Review Issues Execution Plan

Context: `.omx/context/fix-code-review-issues-20260504T105322Z.md`

## Requirements Summary

- Correct workflow-start authorization semantics so forbidden starts return a generic `403`, while validation and template/domain input failures remain `400`.
- Avoid brittle route-side string matching for authorization denials; add semantic typed error support at the workflow authority boundary without embedding HTTP status concepts in domain code.
- Persist refreshed Google access tokens on every successful refresh path in the Google Docs fetch route, including the "missing access token, refresh succeeds, first fetch succeeds" path.
- Add route-level OAuth callback regression coverage for invalid state, wrong bound app user, sanitized return URL handling, token cookie writes, and state-cookie cleanup.
- Do not add dependencies. Keep the diff small and aligned with existing auth/cookie helpers and Vitest route-test patterns.

## Codebase Evidence

- [frontend/app/api/v1/workflows/start/route.ts](/Users/nyimbiodero/src/pjs/docfusion/frontend/app/api/v1/workflows/start/route.ts:5) currently catches every thrown error and returns the raw message as `400`.
- [frontend/lib/actions/workflow-domain.ts](/Users/nyimbiodero/src/pjs/docfusion/frontend/lib/actions/workflow-domain.ts:94) calls `assertWorkflowAuthority(...)` before starting a workflow.
- [frontend/lib/actions/workflow-runtime.ts](/Users/nyimbiodero/src/pjs/docfusion/frontend/lib/actions/workflow-runtime.ts:415) currently throws a plain `Error` for authority denial, which is why the route cannot distinguish `403` from other domain failures.
- [frontend/app/api/v1/google/docs/[docId]/route.ts](/Users/nyimbiodero/src/pjs/docfusion/frontend/app/api/v1/google/docs/%5BdocId%5D/route.ts:197) refreshes when the access token is absent, but only persists cookies on the later `401` retry success path at [line 255](/Users/nyimbiodero/src/pjs/docfusion/frontend/app/api/v1/google/docs/%5BdocId%5D/route.ts:255).
- [frontend/app/api/v1/google/callback/route.ts](/Users/nyimbiodero/src/pjs/docfusion/frontend/app/api/v1/google/callback/route.ts:44) already validates state and bound app user, sanitizes redirects via `buildGoogleRedirect(...)`, writes token cookies, and deletes state cookies on success.
- Existing Google coverage is helper-level only in [frontend/__tests__/google/bound-tokens.test.ts](/Users/nyimbiodero/src/pjs/docfusion/frontend/__tests__/google/bound-tokens.test.ts:21); there is no current route-level callback test file under `frontend/__tests__/api/`.

## Acceptance Criteria

1. `POST /api/v1/workflows/start` returns `403` with a generic forbidden payload for workflow authority denials and does not expose required-role details in the response body.
2. The same route still returns `400` for malformed request bodies and for domain/template validation failures such as missing initial state or invalid action preconditions.
3. Workflow authorization differentiation is driven by `WorkflowAuthorityDeniedError` or an equivalent semantic typed discriminator, not message substring matching in the route.
4. `GET /api/v1/google/docs/[docId]` writes the refreshed access token cookie whenever a refresh succeeds and the request ultimately succeeds, regardless of whether success came after the initial missing-token refresh or the `401` retry refresh.
5. Route-level Vitest coverage exists for Google callback invalid state, wrong app user, sanitized return redirect, token cookie writes, and state-cookie cleanup on success.

## Implementation Steps

1. Introduce a typed workflow authorization error and route-aware response mapping.
   Files:
   - New `frontend/lib/workflows/authority-error.ts`
   - [frontend/lib/actions/workflow-runtime.ts](/Users/nyimbiodero/src/pjs/docfusion/frontend/lib/actions/workflow-runtime.ts:415)
   - [frontend/app/api/v1/workflows/start/route.ts](/Users/nyimbiodero/src/pjs/docfusion/frontend/app/api/v1/workflows/start/route.ts:5)
   - [frontend/__tests__/actions/workflow-runtime.test.ts](/Users/nyimbiodero/src/pjs/docfusion/frontend/__tests__/actions/workflow-runtime.test.ts:339)
   - New `frontend/__tests__/api/workflow-start-route.test.ts`
   Work:
   - Define `WorkflowAuthorityDeniedError` in a neutral workflow module, then replace the plain `Error` thrown by `assertWorkflowAuthority(...)` with that type, carrying semantic fields only such as `kind`, `action`, and optional `requiredRoles`.
   - Do not include HTTP status fields in the runtime/domain error.
   - Map only `instanceof WorkflowAuthorityDeniedError` to a generic `403 { error: "Forbidden" }` in the workflow-start route.
   - Keep existing `400` handling for request-shape failures and non-forbidden domain errors.
   Acceptance:
   - Forbidden workflow starts no longer leak `"requires finance_approver"` through the route response.
   - Runtime tests assert the typed denial details without depending on route messages.
   - Start-route tests prove `403` for typed authority denial and `400` for non-forbidden domain failures.

2. Normalize Google Docs refresh success handling so cookies are persisted on every successful refresh path.
   Files:
   - [frontend/app/api/v1/google/docs/[docId]/route.ts](/Users/nyimbiodero/src/pjs/docfusion/frontend/app/api/v1/google/docs/%5BdocId%5D/route.ts:145)
   - New targeted route test file under `frontend/__tests__/api/` for Google Docs fetch behavior
   Work:
   - Leave `refreshAccessToken(...)` focused on token exchange; do not move cookie concerns into it.
   - Centralize a single document success-response helper that optionally applies `setBoundGoogleTokenCookies(...)` when a new access token was refreshed during the request.
   - Use that helper for both the missing-access-token refresh path and the existing `401` retry refresh path.
   - Add regression coverage for the missing-access-token refresh path and the existing `401` retry refresh path.
   Acceptance:
   - A successful document fetch after refresh always emits `google_access_token` and preserves the bound refresh token/user metadata.

3. Add route-level Google callback regression coverage without changing product behavior.
   Files:
   - [frontend/app/api/v1/google/callback/route.ts](/Users/nyimbiodero/src/pjs/docfusion/frontend/app/api/v1/google/callback/route.ts:20)
   - New `frontend/__tests__/api/google-callback-route.test.ts`
   Work:
   - Use existing Vitest route-test style with mocked `requireRouteSessionOr401` and `fetch`.
   - Add one invalid/missing state case.
   - Add one mismatched `google_oauth_app_user` / wrong app-user case.
   - Add one hostile `returnUrl` case on the early Google `?error=` branch to prove route-level redirect sanitization.
   - Add one success case asserting `google_access_token`, `google_app_user_id`, and deletion of `google_oauth_state` plus `google_oauth_app_user`.
   Acceptance:
   - Callback route behavior is verified end-to-end at the route boundary, not only via helper tests.

4. Run focused and full verification before handoff.
   Working directory: `frontend/`
   Commands:
   - `npm test -- --run __tests__/actions/workflow-runtime.test.ts __tests__/api/workflow-start-route.test.ts __tests__/api/google-callback-route.test.ts __tests__/api/google-docs-route.test.ts __tests__/google/bound-tokens.test.ts`
   - `npx tsc -p tsconfig.json --noEmit`
   - `npm run lint`
   - `npm run build`
   Acceptance:
   - Targeted regressions pass first, then typecheck, lint, and production build pass with no new dependency changes.

## Risks And Mitigations

- Risk: a typed error added too low in the stack could spill into unrelated workflow routes.
  Mitigation: keep the new error narrowly scoped to workflow authority denial and change only the route mapping required by this review item.
- Risk: token persistence logic gets duplicated again between refresh branches.
  Mitigation: factor a single success-response helper or shared cookie-write branch in the Google Docs route.
- Risk: callback tests become brittle around redirect URLs and cookie serialization.
  Mitigation: assert on redirect search params and `Set-Cookie` substrings, matching the existing cookie-helper test style.

## RALPLAN-DR Summary

### Principles

- Prefer typed, stable error contracts over message parsing.
- Preserve current behavior except where the review explicitly requires correction.
- Verify fixes at the route boundary when the bug is route-observable.
- Reuse existing auth, session, and cookie helpers before introducing new layers.

### Top Decision Drivers

- Correct HTTP semantics for authz failures versus validation failures.
- Small, reviewable diff with no new dependencies or architectural spread.
- Regression confidence at the route level for cookie and redirect behavior.

### Viable Options

1. Typed domain/authz error plus explicit route mapping.
   Pros: robust, non-fragile, reusable for future workflow routes, keeps sensitive denial detail out of HTTP responses.
   Cons: touches both authority helper and route/test layers.
2. Route-local string or predicate matching on thrown error messages.
   Pros: smallest immediate patch.
   Cons: fragile, couples HTTP semantics to message text, fails the preference stated in the review context.
3. Broader shared workflow-route error adapter for all workflow APIs.
   Pros: centralizes API error policy.
   Cons: expands scope beyond the three review findings and increases regression risk for unrelated routes.

Invalidation:
- Option 2 is invalidated because the review explicitly prefers typed support over fragile string matching.
- Option 3 is invalidated because the current task is a bounded review-fix pass, not a workflow API error-handling redesign.

## Architect Review Adjustments

- Added route-level workflow-start coverage because the primary reviewed bug is observable in the API response, not just the domain/runtime helper.
- Constrained the new error to semantic workflow fields and explicitly excluded HTTP status from runtime/domain code.
- Kept HTTP mapping local to `frontend/app/api/v1/workflows/start/route.ts` and only for `instanceof WorkflowAuthorityDeniedError`.
- Clarified Google Docs token persistence as response assembly, not refresh-token exchange responsibility.
- Added the early Google `?error=` callback branch to route-level redirect sanitization coverage.
- Fixed verification paths to be relative to `frontend/` as the working directory.

## ADR

- Decision: implement a narrow typed workflow-forbidden error, map it to a generic `403` in the start route, centralize Google Docs refresh-success cookie persistence, and add dedicated route-level Google callback/docs regression tests.
- Drivers: correct authz semantics, bounded diff, durable regression coverage.
- Alternatives considered: message-based route mapping; broader workflow API error adapter.
- Why chosen: it fixes the observed issues directly, satisfies the review preference, and avoids widening scope.
- Consequences: a small new domain-error surface must be maintained; route tests become the source of truth for OAuth callback behavior.
- Follow-ups: if more workflow routes need differentiated domain errors later, reuse the same typed-error contract instead of adding ad hoc route logic.

## Verification Notes

- Prefer targeted Vitest runs first so regressions in workflow auth or Google OAuth behavior fail fast.
- Treat `npm run build` as the final integration gate because the frontend has no dedicated `typecheck` script and relies on Next.js build validation.
- Record any residual gap explicitly if a route test has to mock a framework surface that cannot be exercised more directly in Vitest.
