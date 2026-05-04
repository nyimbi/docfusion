# Ralph Context Snapshot: JTBD Full Workflow Completion

Timestamp: 2026-05-02T11:25:47Z

## Task Statement

Fully implement all incomplete JTBD workflow work, including deployed migration validation, workflow UI screens, strict authz on workflow APIs, scheduled workers, Stalwart email delivery, reversal/compensation, all remaining P1/P2/strategic workflows, workflow template governance, and broader domain workflows.

## Desired Outcome

Move DocFusion from metadata-backed workflow pilots toward an operational workflow platform with:

- Durable runtime state, audit, notifications, SLA, portal visibility, and dashboard surfaces.
- Strict API authorization and authenticated scheduler endpoints.
- Worker entrypoints for SLA/exception processing and notification delivery.
- UI pages for workflow dashboard, operations queue, portal items, and template governance.
- Expanded workflow coverage for evidence, pricing, imports, partner contribution, AI governance, reporting, and mobile/offline intents.
- Updated tracker/catalogue evidence and verified commits.

## Known Facts / Evidence

- Ralph planning gate artifacts exist:
  - `.omx/plans/prd-jtbd-workflow-implementation.md`
  - `.omx/plans/test-spec-jtbd-workflow-implementation.md`
- P0-A through P0-G are committed/pushed on `ralph-jtbd-workflow-requirements`.
- Latest remote-verified commit before this continuation: `d04619606074bf0954f9d241b215523c07598f1a`.
- P0-G added:
  - `frontend/lib/db/schema-workflow-runtime.ts`
  - `frontend/lib/actions/workflow-runtime.ts`
  - `frontend/app/api/v1/workflows/**`
  - `frontend/drizzle/0016_workflow_runtime.sql`
  - `frontend/__tests__/actions/workflow-runtime.test.ts`
- P0-G verification passed:
  - `npm test -- --run __tests__/actions/workflow-runtime.test.ts __tests__/actions/requirements-workflow.test.ts __tests__/actions/rfp-parse-workflow.test.ts __tests__/actions/compliance-entry-workflow.test.ts __tests__/actions/gate-review-workflow.test.ts __tests__/actions/submission-workflow.test.ts __tests__/actions/operational-exceptions.test.ts`
  - `npx tsc --noEmit`
- Current dirty worktree contains many unrelated user changes. Known unstaged unrelated files include:
  - `frontend/lib/actions/compliance-validator.ts`
  - `frontend/lib/db/schema.ts`
  - `frontend/lib/db/domains/workflow.ts`

## Constraints

- Do not revert unrelated user changes.
- Stage only Ralph-owned hunks.
- No new dependencies unless unavoidable.
- Use existing auth/authz, UI, DB, and infra patterns.
- Linode/Stalwart infra docs are under `../infra/docs`; mail should use own Stalwart server.
- Push may succeed while local remote-tracking ref update warns about `.git/refs/remotes/origin/...lock`; remote must be verified with `git ls-remote`.

## Unknowns / Open Questions

- Whether deployed database credentials are present and safe to run migrations against.
- Exact production scheduler deployment target for DocFusion worker jobs.
- Which external portal identity model should be first-class versus internal authenticated views.
- How far full JTBD completion can go in one Ralph cycle without broad product redesign.

## Likely Codebase Touchpoints

- Runtime: `frontend/lib/actions/workflow-runtime.ts`, `frontend/lib/db/schema-workflow-runtime.ts`.
- Workflow APIs: `frontend/app/api/v1/workflows/**`.
- Auth/authz: `frontend/lib/auth-utils.ts`, `frontend/lib/authz.ts`, `frontend/middleware.ts`, `frontend/lib/auth.ts`.
- Notifications: workflow notification table, settings/actions, Stalwart SMTP env/config.
- Workers/scripts: `frontend/scripts/**`, scraper schedule APIs, package scripts.
- UI: `frontend/app/(app)/analytics`, `settings`, `tasks`, `pipeline`, app layout/navigation.
- Broader domains: evidence, pricing, import, partners, AI actions, reporting/export actions.
