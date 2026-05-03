# Platform E2E Topology Matrix

Run namespace: `e2e_20260503_docfusion`

## Source-Of-Truth Rules

- Current code and environment configuration beat older roadmap/design docs for executable claims.
- Legacy docs remain useful for planned/strategic rows but do not count as live topology proof.
- A facility can run only in a topology tier where its auth, data, storage, mail, worker, and cleanup dependencies are available.

## Matrix

| Concern | Local dev/source | Local production (`next start`) | Shared prod-like/live | Operator/control-plane | Legacy/reference docs | Resolution |
|---|---|---|---|---|---|---|
| Auth/session | `frontend/lib/auth.ts`, Auth.js v5 / NextAuth with Keycloak provider | Signed Auth.js cookie or real Keycloak session against built app | Keycloak/Auth.js validated by `/api/auth/session` and protected route behavior | Scheduler/admin routes use workflow API auth and secrets where implemented | Older Better Auth references in README/plans | Treat Auth.js/Keycloak as current source of truth. Better Auth references are legacy. |
| Authorization | `frontend/lib/authz.ts`, `frontend/lib/workflows/api-auth.ts`, route-level permission checks | Permit/deny transcripts against API/routes | Same plus sensitive workflow/resource checks | Scheduler/admin secret for worker/dispatch/evaluate/sync routes | Broad RBAC/ABAC docs | Treat current authz modules and route guards as executable; broader enterprise ABAC is partial unless proven. |
| Database | Drizzle schemas and `DATABASE_URL` | Local configured DB or test DB | `db.lindela.io` for live seeded validation | Migration/worker scripts use configured DB | Azure/PostgreSQL deployment docs | Current configured DB host and Drizzle schema are executable truth; deployment docs are reference unless host matches. |
| Object storage | `frontend/lib/storage/linode-e3.ts` can be mocked or dev-prefix isolated | Server-side upload/download routes only | Linode E3 endpoint/bucket/env; no browser CORS | Object prefix cleanup required | Local-file storage references | Linode E3 server-side path is current live truth for RFP storage. |
| Mail/notifications | Notification queue tests or local sink | Notification route/worker can queue/send depending env | Stalwart SMTP dispatch and mailbox/delivery-attempt proof | Worker notification job and scheduler secret | Postfix references in production-readiness docs | Stalwart is current requested mail provider; Postfix is legacy/reference. |
| Workflow runtime | `frontend/lib/actions/workflow-runtime.ts`, runtime schema, workflow tests | `/workflows/**` pages/routes and worker script | Live DB runtime tables/templates/workers | SLA evaluate, exception sync, notification dispatch worker | Workflow roadmap docs | Current workflow runtime tables/routes/scripts are executable truth. |
| Scrapers/discovery | `frontend/app/api/scrapers/**`, scraper actions, backend scrapers | Admin scraper API and UI where configured | Firecrawl/stealth/SearXNG/Ollama services if reachable | systemd timers/scripts in deployment docs, admin health routes | Azure service docs | Split app scraper APIs from operator service health; operator checks require credentials/service reachability. |
| AI/search | `frontend/lib/ai/**`, docs/INFRASTRUCTURE_SERVICES.md, README env vars | Model list/completion endpoints where configured | Azure OpenAI/Ollama/SearXNG/Firecrawl depending env | Health/sample query/scrape proof | Azure VM docs | Current env/provider code decides executable status; stale Azure deployment references cannot imply pass. |
| Health/monitoring | Unit/integration health tests and route checks | App health/API route probes | Live app/service probes | `/opt/docfusion/monitoring/*`, scraper status, worker logs if accessible | Deployment runbooks | Operator tier required for real monitoring proof. |
| Backup/restore | Not normally local | Not normally local | Requires live backup system and restore sandbox | `pgbackrest`/deployment commands, restore smoke | Deployment README | `credential-missing` until operator backup credentials/sandbox are available. |

## Phase 1 Resolutions

| Concern | Resolution evidence | Remaining gap |
|---|---|---|
| Auth/session | Signed Auth.js session cookie accepted by `/api/auth/session`; protected workflow API read returned `200`; unauthenticated dashboard returned `401`. | Real Keycloak browser login was not exercised. |
| Authorization | Workflow API auth tests passed; scheduler endpoints rejected without a configured secret and returned `200` after `WORKFLOW_CRON_SECRET` was configured. | Broader resource-specific SpiceDB checks remain covered by tests, not live SpiceDB policy data. |
| Database | `db.lindela.io` validation now covers workflow runtime, RFP core, compliance core, scraper tables, and `opportunities.search_vector`. | Backup/restore sandbox remains unavailable. |
| Object storage | Linode E3 signed PUT/GET readback passed in bucket `mansa`; RFP upload stored to `s3://mansa/rfp/unassigned/...`. | Proof objects are retained under `rfp/e2e` and the RFP fixture namespace until cleanup is explicitly scheduled. |
| Mail/notifications | Notification route and worker path execute with zero queued notifications. | No Stalwart mailbox delivery proof because there were no queued notification rows to dispatch. |
| Workflow runtime | Strict worker completed; browser workflow action panel passed; live submission emitted a `production_submission` workflow transition. | Reversal/compensation remains covered by unit/domain tests, not a live browser reversal fixture in this phase. |
| RFP intake/parse | Upload, E3 storage, parse kickoff, status polling, and completed requirement extraction passed after rewrite and migration repairs. | Failed-parse remediation remains partial; happy path is proven. |

## Topology Tiers

| Tier | Meaning | Counts as validated coverage? |
|---|---|---|
| `offline` | Unit or mocked/in-memory validation. | Only for non-stateful/internal facilities, never for live side effects. |
| `local-production` | Built app / local `next start` / local configured services. | Yes when evidence and cleanup rules are met. |
| `shared-prod-like` | `db.lindela.io`, Linode E3, Stalwart, live configured services. | Yes when fixture namespace and cleanup rules are met. |
| `operator` | Service timers, backup, health, worker, external service probes. | Yes only with operator proof artifacts and cleanup status. |
| `legacy-reference` | Historical/planned documentation only. | No. |

## Remaining Blockers

- Confirm Stalwart test mailbox/sink and dispatch credentials.
- Confirm whether operator backup/restore smoke has a safe restore sandbox. Until then, `O-011` remains `credential-missing`.
- Confirm scraper/admin scheduler secret and service reachability before O-009/O-014.
