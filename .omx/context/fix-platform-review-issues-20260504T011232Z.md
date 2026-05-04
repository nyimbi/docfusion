# Context Snapshot: Fix Platform Review Issues

Task statement: fix every issue identified by the whole-platform code review, including low-priority items, with no deferrals.

Desired outcome: a security-first implementation plan that can be handed to execution with concrete file touchpoints, acceptance criteria, and verification for all findings.

Known facts and evidence:
- The competitive-intelligence import endpoint is unauthenticated in `frontend/app/api/import/competitive-intelligence/route.ts`. `POST` starts at line 98, accepts `body.filePath` at lines 100-106, reads the path at lines 111-121, parses with `xlsx` at line 121, mutates the database at line 145, and leaks paths/errors at lines 112-115 and 159-163.
- The RFP upload endpoint in `frontend/app/api/v1/rfp/upload/route.ts` proxies to FastAPI before auth when object-store config is missing. The fallback branch is lines 56-67; auth starts later at lines 69-71.
- Scraper admin telemetry endpoints `frontend/app/api/admin/scraper/health/route.ts` and `frontend/app/api/admin/scraper/stats/route.ts` expose operational details without route-level auth.
- Workflow portal listing in `frontend/app/api/v1/workflows/portal/route.ts` accepts caller-provided `portalRole`, and `frontend/lib/actions/workflow-runtime.ts` lists portal/external items without principal/resource scoping.
- Opportunity document download in `frontend/app/api/v1/opportunities/[id]/documents/[documentId]/download/route.ts` ignores the opportunity route parameter; `frontend/lib/services/rfp-document-service.ts` fetches documents by UUID only.
- Workflow reversal actions in `frontend/lib/actions/workflow-domain.ts` handle `reopen`, `cancel`, and `resolve` before the template transition authority check.
- Workflow dashboard in `frontend/app/api/v1/workflows/dashboard/route.ts` uses generic read permission, while `frontend/lib/actions/workflow-runtime.ts` can return broad workflow data without actor/org/resource scoping.
- `npm audit --json` in `frontend` reported 26 vulnerabilities including 7 high. `xlsx` is used in the import route and is listed in `frontend/package.json`.
- Google integration routes under `frontend/app/api/v1/google/*` are not clearly bound to the application session and allow return URL handling that should be made same-origin-relative.

Constraints:
- Do not defer low-priority findings.
- Keep fixes aligned with existing auth/session/workflow patterns.
- No new dependencies unless the execution agent explicitly verifies no existing parser or internal job path can satisfy the requirement.
- Changes must be covered by targeted automated tests plus lint/typecheck/build where feasible.
- Current planning mode is `$ralplan`; this artifact is for planning and execution handoff, not source modification.

Unknowns/open questions:
- Exact existing role names and relationship-check helpers for admin, scraper access, portal partner access, opportunity access, and Google integration access must be verified during implementation.
- Whether competitive-intelligence import should remain HTTP-accessible or become script-only should be decided by safest existing admin tooling pattern.
- Dependency remediation may require replacement, removal, or documented allowlist if upstream has no patched version.

Likely codebase touchpoints:
- `frontend/app/api/import/competitive-intelligence/route.ts`
- `frontend/app/api/v1/rfp/upload/route.ts`
- `frontend/app/api/admin/scraper/health/route.ts`
- `frontend/app/api/admin/scraper/stats/route.ts`
- `frontend/app/api/v1/workflows/portal/route.ts`
- `frontend/app/api/v1/workflows/dashboard/route.ts`
- `frontend/app/api/v1/workflows/[workflowId]/transition/route.ts`
- `frontend/lib/actions/workflow-runtime.ts`
- `frontend/lib/actions/workflow-domain.ts`
- `frontend/app/api/v1/opportunities/[id]/documents/[documentId]/download/route.ts`
- `frontend/lib/services/rfp-document-service.ts`
- `frontend/app/api/v1/google/auth/route.ts`
- `frontend/app/api/v1/google/callback/route.ts`
- `frontend/app/api/v1/google/docs/[docId]/route.ts`
- `frontend/package.json`, lockfile, and affected tests under `frontend/**/__tests__`, `frontend/tests`, or project-local test conventions.
