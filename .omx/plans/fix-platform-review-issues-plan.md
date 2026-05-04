# Fix Platform Review Issues Plan

## Requirements Summary

Fix every issue identified by the whole-platform code review, including low-priority items, with no deferrals. The work is security-sensitive because it changes authentication, authorization, file import, document download, workflow visibility, OAuth, and vulnerable dependency exposure.

Primary findings to resolve:
- Unauthenticated competitive-intelligence import can read arbitrary server paths and mutate the database in `frontend/app/api/import/competitive-intelligence/route.ts`.
- RFP upload can proxy to FastAPI before authentication in `frontend/app/api/v1/rfp/upload/route.ts`.
- Admin scraper health/stats endpoints lack auth in `frontend/app/api/admin/scraper/health/route.ts` and `frontend/app/api/admin/scraper/stats/route.ts`.
- Workflow portal listing accepts caller-selected portal role and lacks principal/resource scoping in `frontend/app/api/v1/workflows/portal/route.ts` and `frontend/lib/actions/workflow-runtime.ts`.
- Opportunity document download ignores the opportunity route parameter in `frontend/app/api/v1/opportunities/[id]/documents/[documentId]/download/route.ts` and `frontend/lib/services/rfp-document-service.ts`.
- Workflow reversal actions bypass template authority checks in `frontend/lib/actions/workflow-domain.ts` and `frontend/lib/actions/workflow-runtime.ts`.
- Workflow dashboard can expose global workflow data from `frontend/app/api/v1/workflows/dashboard/route.ts` and `frontend/lib/actions/workflow-runtime.ts`.
- `frontend` has unresolved audit findings, especially `xlsx` in `frontend/package.json` plus server-side parsing use.
- Google OAuth/docs routes under `frontend/app/api/v1/google/*` need app-session binding and same-origin-relative return URL handling.

## RALPLAN-DR Summary

Principles:
- Deny by default on every externally reachable route.
- Bind access to the concrete resource, not just a generic authenticated session.
- Remove dangerous input classes instead of validating them indefinitely, especially arbitrary filesystem paths.
- Keep workflow state transitions and reversal/compensation semantics under the same authority model.
- Prove fixes with negative tests that fail under the reviewed implementation.

Decision drivers:
- Security correctness before compatibility.
- Minimal alignment with existing helpers: `requireServerSession`, `requireWorkflowApiActor`, `requireScraperAccess`, `checkPermission`, and `lookupResources`.
- Verifiable behavior through focused route/action tests, audit checks, lint/typecheck, and build.
- One canonical boundary per trust model: session auth, control-plane admin, resource-scoped workflow access, and app-user-bound OAuth tokens.

Viable options:
- Option A: Patch each route/service with existing authz helpers and resource-scoped filters. Pros: fastest, least invasive, aligns with current architecture. Cons: duplicated scoping logic can drift unless helper extraction is done carefully.
- Option B: Introduce a centralized route-policy layer for all API handlers. Pros: more consistent long term. Cons: broad API refactor with higher regression risk and slower delivery.
- Option C: Disable or remove risky surfaces first, then rebuild access around them. Pros: strongest immediate risk reduction. Cons: may disrupt admin workflows if used operationally.

Chosen approach: combine A and C. Remove arbitrary-path and public-danger behavior immediately, use existing authz primitives for scoped access, and extract only small shared helpers where duplication would weaken correctness.

Required architectural seams:
- `frontend/lib/auth/route-session.ts`: `requireRouteSessionOr401(): Promise<{ session } | NextResponse>` returns `401` JSON for missing app session and never throws for expected unauthenticated requests.
- `frontend/lib/auth/control-plane.ts`: `requireControlPlaneAdmin(request, options): Promise<{ actor } | NextResponse>` returns `401` for no session/API key, `403` for wrong role, and supports only explicit `allowedRoles` plus optional `allowApiKeyEnv`. Initial sensitive role set is `["admin", "operations"]`; `proposal_manager` is intentionally excluded from import and telemetry administration.
- `frontend/lib/workflows/viewer-scope.ts`: `buildWorkflowViewerScope(actor): WorkflowViewerScope` returns actor id, roles, global workflow-view flag, allowed assigned roles, and portal roles. Runtime read functions must require this scope and have no unscoped overload. This module must define a distinct `isGlobalWorkflowViewer()` predicate; do not reuse `hasAdminRole()` because it currently includes `proposal_manager`.
- `frontend/lib/google/bound-tokens.ts`: `getBoundGoogleTokens(sessionUserId): Promise<GoogleTokens | null>` reads tokens only when their stored app user id matches the current app session user id. Token mismatch returns `null` and routes respond `401` or reconnect-required, not a Google API call.

## Pre-Mortem

- A route appears authenticated but still leaks cross-tenant data because the query remains globally scoped. Mitigation: add negative tests for different users/roles/opportunities and inspect generated query filters.
- A fallback path reintroduces bypass behavior under missing env config. Mitigation: auth and validation must execute before all branches; add tests for missing Linode config and Python fallback enabled.
- Workflow reversal compensation mutates domain state under generic write permission. Mitigation: map reversals through transition/template authority and add explicit non-authorized actor tests.
- A helper returns/throws in a shape the route catch block misclassifies as 500. Mitigation: route handlers use response-returning auth helpers or catch auth errors explicitly and test 401/403 status codes.
- OAuth tokens remain valid across app-user switches because cookies are trusted directly. Mitigation: bind token metadata to app user and reject mismatches at every token read.

## Authorization Scope Contracts

Control-plane admin:
- Applies to competitive-intelligence import and scraper telemetry.
- Allowed session roles: `admin`, `operations`.
- Optional API key: only where the route is automation-safe and uses an explicitly named env var such as `SCRAPER_API_KEY`.
- Denied roles: `proposal_manager`, `workflow_admin`, generic authenticated users, and anonymous users.

Workflow viewer scope:
- Global workflow dashboard visibility is limited to `admin`, `workflow_admin`, and `operations`.
- Non-global actors may see an instance only when at least one concrete row-local rule matches: `workflowInstances.assignedTo === actor.userId`, `workflowInstances.authorityPolicy.allowedActorIds` contains actor id, `workflowInstances.assignedRole` intersects actor roles, or the instance is opportunity-bound and the linked `opportunities.assignedTo === actor.userId`.
- No SpiceDB opportunity rule is assumed in this fix because repository inspection found no established `checkPermission("opportunity", ...)` usage.
- Missing `opportunityId`, missing linked opportunity row, unknown `subjectType`, or missing actor scope fails closed: API route returns `403` where the request is for a concrete resource; list/dashboard functions return only rows matching another concrete rule or empty results.

Portal workflow scope:
- Portal reads require `visibility IN ("portal", "external")`, `portalVisibility.visibleToPortal === true`, and `portalVisibility.portalRole` either absent or present in `WorkflowViewerScope.portalRoles`.
- `portalRoles` are derived only from `session.user.roles` plus `session.user.role` as normalized by `requireWorkflowApiActor`; there is no separate partner relation in this fix. If those roles do not include `partner`, `contributor`, or the row's required portal role, the row is hidden unless the actor is a global workflow viewer.
- Portal role alone is insufficient. A non-admin actor also needs `assignedTo`, `authorityPolicy.allowedActorIds`, or opportunity assignment as above.
- Query-string `portalRole` is ignored for non-admin actors. Admins may filter by role for diagnostics, but the filter cannot expand non-admin scope.

Opportunity document download scope:
- Add a concrete `requireOpportunityDocumentRead(actor, opportunityId, documentId)` path; do not call unscoped `getDocumentFile(documentId)` from routes.
- Replace route usage with a mandatory scoped service function `getOpportunityDocumentFileForActor(actor, opportunityId, documentId)`. Do not make `opportunityId` optional on `getDocumentFile`; keep or deprecate the unscoped helper only for internal call sites that are separately audited and not route-reachable.
- Fetch `opportunityDocuments` joined to `opportunities` by both `documentId` and `opportunityId`.
- Allow if actor role is `admin` or `operations`, if `opportunityDocuments.downloadedBy === actor.userId`, or if `opportunities.assignedTo === actor.userId`.
- Deny with `404` for no document/opportunity match and `403` for a matched row without permission.

Workflow viewer-scope matrix:

| Subject type | Visibility rule |
|---|---|
| `opportunity` | Global viewer, assigned/allowed actor, assigned role, or `opportunities.assignedTo === actor.userId` using `subjectId` when `opportunityId` is absent. |
| `rfp_parse`, `rfp_document`, `rfp_parsing_job` | Global viewer, assigned/allowed actor, assigned role, or linked `opportunityId -> opportunities.assignedTo`. Missing `opportunityId` falls back only to assigned/allowed/global. |
| `requirement`, `rfp_requirement`, `compliance_entry`, `gate_review`, `proposal_task`, `proposal_review`, `review_comment`, `document_approval`, `submission`, `pricing_package`, `cost_element`, `partner_assignment`, `evidence_claim` | Global viewer, assigned/allowed actor, assigned role, or linked `opportunityId -> opportunities.assignedTo`. |
| `scraper_run`, `import_sync_job`, `ai_governance_event`, `audit_report_package`, `offline_action_batch` | Global viewer, assigned/allowed actor, or assigned role only; no broad portal/org fallback. |
| Unknown subject type | Global viewer, assigned/allowed actor, or assigned role only; otherwise hidden. |

Required runtime signatures:
- `getWorkflowDashboard(scope: WorkflowViewerScope, filters?: WorkflowDashboardFilters): Promise<WorkflowDashboard>`
- `listPortalWorkflowItems(scope: WorkflowViewerScope, options?: PortalWorkflowOptions): Promise<WorkflowInstanceRow[]>`
- `getWorkflowDashboard` and `listPortalWorkflowItems` must reject/throw on missing scope in tests; direct SSR callers in `frontend/app/(app)/workflows/page.tsx`, `frontend/app/(app)/workflows/portal/page.tsx`, and `frontend/app/(app)/workflows/operations/page.tsx` must derive actor scope from the app session before calling them.

## Acceptance Criteria

- `POST /api/import/competitive-intelligence` cannot be called anonymously, cannot read caller-provided absolute paths, cannot reveal local paths in responses, and cannot mutate data without an admin-equivalent actor.
- `GET /api/import/competitive-intelligence` no longer reveals host filesystem paths or operationally sensitive import details to anonymous callers.
- RFP upload requires an application session before parsing form data or proxying to Python, including when Linode object-store config is absent.
- RFP upload fallback enforces the same file type and size restrictions as local storage before proxying or rejects fallback when it cannot safely validate.
- Scraper health and stats endpoints reject anonymous requests and allow only the same authenticated/API-key access model used by existing scraper admin routes.
- Scraper health and stats are treated as control-plane telemetry: `admin` and `operations` sessions are allowed, `proposal_manager` and generic sessions are denied, and API-key access is allowed only if the endpoint is documented as automation-safe.
- Portal workflow listing derives portal roles from the authenticated actor unless the actor is admin, and returns only workflow items the actor may see.
- Dashboard workflow listing is scoped by actor, assignment, assigned role, global workflow-view role, explicit allowed actor id, or linked opportunity assignment; anonymous/global reads are impossible.
- Server-rendered workflow pages that call `getWorkflowDashboard()` or `listPortalWorkflowItems()` directly must pass actor scope and must not have an unscoped fallback.
- Opportunity document downloads require the document to belong to the route opportunity and require the actor to have read access to that opportunity/document.
- Reversal actions (`reopen`, `cancel`, `resolve`) enforce template authority or an equivalent explicit admin/reversal policy before changing runtime or domain state.
- Google auth, callback, docs, and status-style routes require a valid application session where tokens are initiated, read, or used; callback state is tied to the initiating app user; return URLs are sanitized to same-origin relative paths.
- Google token reads reject cookies/storage entries whose bound app user id does not match the current session user id.
- `xlsx` server-side request exposure is removed. Any remaining Excel parsing must be either replaced with CSV-only request parsing or moved to local scripts that are not reachable from HTTP routes.
- High audit findings have package-specific outcomes: upgrade, remove, replace, or disable the dependent feature. The implementation may not land with undocumented high audit failures.
- All changed behavior has negative and positive automated tests.

## Implementation Steps

1. Harden competitive-intelligence import.
   - Update `frontend/app/api/import/competitive-intelligence/route.ts`.
   - Add/use `requireControlPlaneAdmin(request, { allowedRoles: ["admin", "operations"] })` on both `GET` and `POST`; explicitly test that `proposal_manager` is denied.
   - Remove `body.filePath` support. Use only a configured server-side import source or move import into a script/server action that is not externally reachable.
   - Return generic errors without absolute paths or `String(error)`.
   - Remove `xlsx` from this HTTP route. If the endpoint remains, make it CSV-only through existing CSV parsing utilities; Excel imports must move to non-HTTP local scripts outside deployed route/runtime code.
   - Add route tests for anonymous rejection, no path leak, ignored/rejected `filePath`, and authorized import behavior via mocked import.

2. Authenticate and validate RFP upload before every branch.
   - Update `frontend/app/api/v1/rfp/upload/route.ts`.
   - Move session validation before object-store config checks and before `request.formData()`, using `requireRouteSessionOr401()` or explicit auth-error handling so unauthenticated requests return 401 rather than falling into the generic 500 catch block.
   - Parse and validate file size, extension, and MIME once before local upload or Python proxy.
   - If proxying, forward only validated file/opportunity fields and include authenticated user context if the Python service expects it.
   - Add tests for unauthenticated upload with missing Linode config, invalid type in proxy mode, valid proxy path, and local object-store path.

3. Protect scraper admin telemetry.
   - Update `frontend/app/api/admin/scraper/health/route.ts` and `frontend/app/api/admin/scraper/stats/route.ts`.
   - Treat these as control-plane telemetry and use `requireControlPlaneAdmin(request, { allowedRoles: ["admin", "operations"], allowApiKeyEnv: "SCRAPER_API_KEY" })` or equivalent.
   - Do not use `requireScraperAccess()` alone because it currently permits any authenticated session.
   - Add tests proving anonymous, generic authenticated, and `proposal_manager` actors are denied; `admin`, `operations`, and configured API key are allowed.

4. Scope workflow portal visibility.
   - Update `frontend/app/api/v1/workflows/portal/route.ts` to stop trusting query `portalRole` except for admins.
   - Update `listPortalWorkflowItems` in `frontend/lib/actions/workflow-runtime.ts` to require `WorkflowViewerScope` and enforce the portal workflow scope contract above: portal visibility plus assigned user, allowed actor id, assigned role, linked opportunity assignment, or global workflow viewer.
   - Preserve `portalVisibility.portalRole` as a content filter only after actor eligibility is established.
   - Update server-rendered callers such as `frontend/app/(app)/workflows/portal/page.tsx` so they pass the same actor scope and cannot call the function unscoped.
   - Add tests for role escalation attempt, cross-user item leak, admin role filter, legitimate portal user visibility, and direct SSR/action caller behavior.

5. Scope workflow dashboard visibility.
   - Update `frontend/app/api/v1/workflows/dashboard/route.ts` to pass actor context into `getWorkflowDashboard`.
   - Update `getWorkflowDashboard` in `frontend/lib/actions/workflow-runtime.ts` to require `WorkflowViewerScope` and apply actor-scoped predicates by default: assigned-to actor, allowed actor id, assigned role, global workflow viewer, and linked opportunity assignment when `opportunityId` is present.
   - Ensure aggregate metrics do not include rows hidden from the actor.
   - Update server-rendered callers such as `frontend/app/(app)/workflows/page.tsx` and `frontend/app/(app)/workflows/operations/page.tsx` so they pass actor scope and cannot call the function unscoped.
   - Add tests proving a regular actor cannot see another actor's workflow, while admins retain global dashboard access, for both API and direct server/action callers.

6. Fix opportunity document download authorization.
   - Update `frontend/app/api/v1/opportunities/[id]/documents/[documentId]/download/route.ts` to read both `id` and `documentId`.
   - Add mandatory scoped service function `getOpportunityDocumentFileForActor(actor, opportunityId, documentId)`.
   - Query by both document id and opportunity id in `frontend/lib/services/rfp-document-service.ts`.
   - Enforce `requireOpportunityDocumentRead(actor, opportunityId, documentId)`: allow `admin`/`operations`, `opportunityDocuments.downloadedBy === actor.userId`, or `opportunities.assignedTo === actor.userId`; no SpiceDB opportunity assumption in this pass.
   - Leave `getDocumentFile(documentId)` out of route handlers; add a search/test guard so new route code cannot use it without an explicit scoped wrapper.
   - Add tests for wrong opportunity id, no permission, permission granted, and missing document.

7. Enforce authority on workflow reversals.
   - Update `frontend/lib/actions/workflow-domain.ts` so reversal actions load template/instance and call authority checks before `reverseWorkflowRuntimeState`.
   - Add reversal authority policy in templates or a local `getReversalAuthorityPolicy(action, instance, template)` that requires admin/workflow_admin or explicit transition role.
   - Update `reverseWorkflowRuntimeState` in `frontend/lib/actions/workflow-runtime.ts` to accept actor roles/policy or document that callers must check, with tests protecting the caller path.
   - Add tests for unauthorized writer rejected, authorized role accepted, compensation only runs after authority passes, and audit event still records valid reversal.

8. Bind Google OAuth/docs routes to app sessions and sanitize redirects.
   - Update `frontend/app/api/v1/google/auth/route.ts` to require app session before creating OAuth state.
   - Store state with the initiating user id, either encoded/signed in state or in an httpOnly cookie keyed to session user; avoid accepting callback for a different app user.
   - Sanitize `returnUrl` to same-origin relative paths; reject or replace absolute URLs and protocol-relative URLs.
   - Update `frontend/app/api/v1/google/callback/route.ts` to verify app session and state user before token cookie/storage.
   - Bind token cookies/storage to the app session user id, or move token storage server-side keyed by app user id.
   - Update `frontend/app/api/v1/google/docs/[docId]/route.ts` and any Google status route to require app session and use `getBoundGoogleTokens(session.user.id)` before using Google tokens.
   - Add tests for anonymous initiation rejection, external return URL sanitization, callback user mismatch, token-user mismatch, status rejection on mismatch, and authenticated docs fetch.

9. Remediate dependency audit exposure.
   - Run `npm audit --json` in `frontend` and classify runtime-reachable versus build/dev advisories.
   - Apply this package decision table:

| Package/advisory group | Current evidence | Required outcome |
|---|---|---|
| `xlsx` | Direct high dependency; used by HTTP import route, universal parser, client importer, and scripts. | Remove from HTTP/server request paths. Convert HTTP imports to CSV-only via `papaparse` or disable Excel upload until replaced. Keep any Excel-only jobs as local scripts outside Next route/runtime. Remove dependency from app package if no runtime/server imports remain; otherwise split script-only tooling outside deployable frontend package. |
| `next-pwa` / Workbox / `serialize-javascript` | Direct high dependency chain via `next-pwa`; configured in `frontend/next.config.ts`. | Remove `next-pwa` integration and dependency unless a patched replacement is available immediately. Build must still pass without PWA wrapping. |
| `lodash-es` via Excalidraw/Mermaid parser stack | High transitive advisory through diagram/drawing features. | Upgrade dependency chain if possible; if not, disable or lazy-isolate affected diagram conversion features that parse untrusted diagram text until the chain is clean. No high advisory may remain reachable from public/user input. |
| `next`/`postcss`, `next-auth`, `@sentry/nextjs`, `drizzle-kit`, `esbuild`, `mermaid`, `uuid`, `nanoid` moderate groups | Audit reported moderate advisories, many with no direct fix. | Upgrade where available. For no-fix moderate advisories, remove unused feature/dependency where practical; otherwise document in a security decisions file only after high findings are eliminated. |

   - Acceptance target: `npm audit --audit-level=high` passes. Moderate unresolved advisories require a committed package-specific security decision only after all high findings are eliminated or unreachable.

10. Add regression tests and end-to-end smoke coverage.
   - Add focused unit/route tests under existing `frontend/__tests__` conventions for each fixed route/service/action.
   - Add Playwright/API smoke where useful for authenticated RFP upload and workflow dashboard/portal access if existing e2e fixtures support it.
   - Keep tests negative-first for auth bypasses.

11. Run verification and clean up.
   - Run targeted tests for changed areas.
   - Run `npm run lint`, `npx tsc --noEmit`, `npm test -- --run`, and `npm run build` from `frontend` unless the repo defines a more specific quality target.
   - Run `npm audit --audit-level=high` or equivalent documented audit check.
   - Confirm `git status --short` only includes intentional changes.

## Risks and Mitigations

- Risk: existing sessions may not contain roles/org ids needed for strict scoping. Mitigation: fail closed. If actor scope cannot be derived, workflow APIs/pages return `403` or empty scoped lists; if `opportunityId`/linked opportunity is missing, only global/assigned/allowed actor rules can expose the row.
- Risk: opportunity permissions are not backed by a proven SpiceDB convention in the inspected code. Mitigation: use concrete row-local assignment rules now and fail closed for everything else.
- Risk: removing arbitrary `filePath` breaks a manual admin import workflow. Mitigation: replace it with a documented non-HTTP script or configured server-side import source, not a public request body.
- Risk: dependency remediation can break frontend features. Mitigation: prefer removal/disablement over keeping high vulnerable chains; run build/e2e smoke and keep feature-specific tests for any upgraded rendering/import path.

## Expanded Test Plan

Unit:
- Auth helper mocks for admin, non-admin, anonymous, scheduler/API key.
- Control-plane admin helper tests, including `proposal_manager` denial.
- Route auth helper tests proving unauthenticated requests return 401 instead of generic 500 in broad catch handlers.
- Workflow runtime/domain tests for portal/dashboard scoping and reversal authority.
- Document service tests for opportunity/document matching.
- Return URL sanitizer tests for Google OAuth.
- Bound Google token read tests for matching and mismatched app users.

Integration/API:
- Route tests for competitive import, RFP upload fallback/local paths, scraper health/stats, workflow portal/dashboard, document download, Google OAuth/docs.
- Negative tests for anonymous, wrong role, wrong opportunity, wrong portal role, and user mismatch.
- Direct server/action caller tests for workflow dashboard and portal functions so SSR callers cannot bypass API route scoping.
- Fail-closed tests for missing workflow actor scope, missing `opportunityId`, missing linked opportunity row, unknown `subjectType`, and non-admin portal role escalation.

E2E:
- Authenticated smoke for RFP discovery/upload path where available.
- Authenticated workflow dashboard/portal smoke proving hidden rows are absent for regular users and visible for admin.

Observability:
- Confirm auth failures are logged without sensitive paths/tokens.
- Confirm reversal/domain compensation audit events identify actor, action, subject, and outcome.
- Confirm import errors expose correlation-safe messages only.

## Verification Commands

From `frontend`:

```sh
npm run lint
npx tsc --noEmit
npm test -- --run
npm run build
npm audit --audit-level=high
```

Also run targeted tests added for changed files before the full suite.

## ADR

Decision: Fix every reviewed issue by hardening existing route/service boundaries with current authz primitives, removing arbitrary filesystem import behavior, scoping workflow/document data by principal and concrete row-local relationships, enforcing workflow authority on reversals, binding Google OAuth to the app session, and eliminating high audit exposure from reachable application code.
Refinement from architecture review: introduce four narrow shared seams before patching individual routes: control-plane admin, route-session-or-401, workflow viewer scope, and app-user-bound Google token access.

Drivers:
- Reviewed issues include unauthenticated file read, auth bypass, and cross-principal data leakage.
- Existing code already has route-level auth helpers and workflow authority primitives.
- The user requested no deferrals, including low-priority items.

Alternatives considered:
- Central policy framework rewrite: rejected for this fix because it broadens blast radius before closing active vulnerabilities.
- Disable all affected routes: rejected as the only plan because several are core platform facilities; use removal only for dangerous arbitrary import behavior.
- Document vulnerabilities without code fixes: rejected because the request explicitly requires all issues resolved.

Why chosen:
- The chosen approach closes exploitable paths quickly while preserving the platform's current architecture and test conventions.

Consequences:
- Some routes may become stricter than current UI assumptions; UI callers may need to include resource context or handle 403s.
- Admin/import workflows may need a script/configured import source instead of request-body file paths.
- Audit remediation may require dependency replacement or disabling affected features where no patched upstream exists.

Follow-ups:
- After implementation, perform a second security review focused on API route auth coverage and workflow data scoping.
- Consider a centralized route policy layer once urgent reviewed issues are closed and covered by tests.

## Available Agent Types Roster

- `executor`: implementation across route/service/action files.
- `security-reviewer`: focused authz and data-leak review.
- `test-engineer`: negative/positive regression test coverage.
- `build-fixer`: build/type/lint failures after changes.
- `verifier`: final evidence collection and claim validation.
- `code-reviewer`: post-implementation review.
- `dependency-expert`: audit remediation options when upgrades/replacements are non-obvious.

## Follow-Up Staffing Guidance

Ralph path:
- Use one persistent `executor` owner with high reasoning for the full fix set.
- Add `security-reviewer` after implementation for authz review.
- Add `test-engineer` for test coverage if the executor is blocked by fixture complexity.
- Finish with `verifier` for command evidence and residual-risk check.

Team path:
- Lane 1 `executor`: competitive import, RFP upload, scraper endpoints.
- Lane 2 `executor`: workflow portal/dashboard/reversal authority.
- Lane 3 `executor`: document download and Google OAuth/docs routes.
- Lane 4 `dependency-expert`: audit remediation and package decisions.
- Lane 5 `test-engineer`: regression tests across all lanes.
- Lane 6 `security-reviewer`: cross-lane authz review before merge.

Suggested reasoning:
- Implementation lanes: high.
- Dependency lane: high.
- Test lane: medium-high.
- Final verifier/security review: high.

Launch hints:

```sh
$ralph .omx/plans/fix-platform-review-issues-plan.md
$team implement .omx/plans/fix-platform-review-issues-plan.md
```

Team verification path:
- Each implementation lane reports changed files, tests added, and targeted verification.
- Security reviewer confirms every reviewed issue is closed with file references.
- Test engineer runs targeted suites and escalates fixture gaps.
- Ralph or lead verifier runs final lint, typecheck, full tests, build, audit, and `git status --short`.

## Plan Changelog

- Initial plan created from the whole-platform code review findings and context snapshot `.omx/context/fix-platform-review-issues-20260504T011232Z.md`.
