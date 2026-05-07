# Context Snapshot: Platform End-To-End Exercise

Task statement: Ensure every aspect of the DocFusion platform works end to end and exercise every facility.

Desired outcome: A consensus plan for a comprehensive platform verification campaign that proves core product journeys, live integrations, background workers, workflow runtime, authz, storage, mail, reporting, and operational runbooks work coherently without confusing offline unit coverage with true live end-to-end validation.

Known facts/evidence:
- Frontend app is under `frontend/` and exposes scripts for `dev`, `build`, `start`, `lint`, `test`, `test:e2e`, workflow DB validation/migration, workflow template seeding, and workflow worker execution.
- Existing frontend Playwright specs include `golden-path`, `hdsa-workflow`, `snippet-expansion`, `workflow-action-panel`, and opt-in live authenticated snippet fixture coverage.
- Existing frontend Vitest suites cover workflow runtime/domain actions, RFP parse workflows/routes, snippet placeholder resolution/context fixtures, Linode E3 storage, workflow API auth, Datacraft response content, and other proposal modules.
- Python/backend tests exist under `tests/`, including CI, security, storage, RFP, document engine, workflow, scraper, auth, performance, and integration suites.
- Recent work added live DB fixture validation against `db.lindela.io`, authenticated browser coverage against `next start`, workflow runtime DB migrations/templates, Linode E3 RFP storage paths, and Datacraft snippet resolution.
- The active worktree is dirty with many unrelated files, while `main` and `origin/main` have the recent merge commit `067dcb3`.

Constraints:
- Do not overclaim “every facility works” from unit tests alone; classify evidence by offline, local production, live seeded, and live external integration.
- Live database, object storage, email, scheduled workers, and external discovery integrations can mutate state and must use reserved fixtures, idempotent seeds, or explicit cleanup/audit checks.
- The active worktree has many unrelated modifications; any implementation or verification artifacts must use explicit pathspecs or a clean worktree to avoid sweeping unrelated work.
- Normal Playwright browser launch may require elevated execution on macOS due Chromium sandbox permissions.
- Linode E3 does not support CORS, so object storage validation must exercise server-side upload/download paths.
- Stalwart email delivery should be validated through configured server paths, not mocked delivery, when running live integration gates.

Unknowns/open questions:
- Which facilities are mandatory for the first verification campaign versus strategic or experimental surfaces?
- Whether valid live credentials exist for every external source, object bucket, mail account, AI provider, and deployed worker.
- Whether CI currently has enough services/secrets to run live gates, or whether live gates must remain operator-run.
- Whether destructive paths such as reversals, compensation, rejection, and cleanup can use disposable fixtures in the live database.

Likely codebase touchpoints:
- `frontend/app/**`, `frontend/components/**`, `frontend/lib/actions/**`, `frontend/lib/workflows/**`, `frontend/lib/storage/**`, `frontend/lib/snippets/**`, `frontend/scripts/**`, `frontend/e2e/**`, `frontend/__tests__/**`.
- `backend/stealth-scraper/**`, `backend/discovery/**`, `src/docfusion/**`, `tests/**`.
- `.omx/plans/**`, `docs/platform-jtbd-catalogue.md`, `docs/jtbd-workflow-implementation-plan.md`, deployment and infrastructure docs.

Risk framing:
- This request is broad and production-adjacent. The plan should produce staged gates, evidence artifacts, ownership lanes, and non-destructive fixture strategy before execution.
