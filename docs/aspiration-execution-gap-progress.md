# Aspiration Execution Gap Progress

## Objective

Close the aspiration execution gap and rapidly reach a fully functional platform that reliably finds opportunities and creates winning responses to them. The target state includes working opportunity discovery, search/download, scraping, RFP intake, response generation, governance, verification, and deployment readiness.

## Operating Rules

- Keep the full objective intact; do not redefine completion around partial slices.
- Track every concrete slice here.
- Commit and push coherent, verified work regularly.
- Use SearXNG at `https://search.lindela.io` for web search.
- Use Firecrawl at `http://84.247.181.100:3002` for scraping.
- Use the Playwright/headless browser service at `http://84.247.181.100:3003` for pages that require browser/stealth behavior.
- Do not connect app/session/cache traffic to the connectivity-local Redis on `84.247.181.100`; that Redis is for Firecrawl/SearXNG internals only.

## Progress Log

### 2026-05-26 - Discovery Infrastructure Alignment

Status: implemented and verified.

Purpose: make the product's configured search/scraping infrastructure match the available services, so opportunity discovery work starts from the correct live endpoints instead of stale host defaults.

Changes in this slice:
- Point Python SearXNG defaults to `https://search.lindela.io`.
- Point Next.js SearXNG defaults to `https://search.lindela.io`.
- Keep Firecrawl defaults on the connectivity host at `http://84.247.181.100:3002`.
- Move Docling default to the same connectivity host at `http://84.247.181.100:3600`.
- Update infrastructure docs and environment examples to reflect the search/scrape host topology.
- Add config regression tests so SearXNG does not drift back to raw IP/port defaults.

Verification:
- `npm run test -- __tests__/services/searxng-client-config.test.ts` passed.
- `PYTHONPATH=src uv run pytest tests/ci/test_search_infrastructure_config.py tests/ci/test_secrets_manager_docling.py -q` passed.
- `npm run lint -- --max-warnings=0` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.
- Live SearXNG probe returned JSON search results from `https://search.lindela.io/search?q=rfp&format=json`.
- Live Firecrawl probe successfully scraped `https://example.com` through `http://84.247.181.100:3002/v1/scrape`.

Testing scope note:
- Full-suite tests and production build were intentionally skipped for this slice because the machine is on battery. Prefer focused tests and lightweight checks until power is available or a larger code chunk warrants broader verification.
- `ruff check` on touched Python files is not currently a useful narrow gate: it reports a large set of pre-existing style/docstring/import diagnostics in `src/docfusion/api/dependencies.py`, `src/docfusion/config/secrets.py`, and `src/docfusion/infrastructure/searxng_client.py`.

Remaining after this slice:
- Connect discovery search results to a durable opportunity ingestion workflow where gaps remain.
- Add or strengthen fallback behavior for browser-only sources, including CloakHQ/cloakbrowser only if existing Firecrawl/Playwright paths cannot handle a target source.
- Continue auditing the full opportunity-to-winning-response workflow against the JTBD catalogue.

### 2026-05-26 - SearXNG Opportunity Ingestion

Status: implemented and verified.

Purpose: connect live external search results to durable opportunity records instead of leaving web discovery as a document-only helper.

Changes in this slice:
- Add `discoverAndImportOpportunities`, a server action that searches SearXNG, filters likely opportunity notices, deduplicates by normalized URL fingerprint and source ID, and records an audited import job.
- Support optional Firecrawl enrichment for top search results so high-value runs can store cleaner titles and summaries without making every search import expensive.
- Assign discovered opportunities to the importing user and store provenance metadata including search query, engine, score, normalized URL, and Firecrawl scrape status.
- Persist scraper/discovery identity fields in `createOpportunity` so `source`, `fingerprint`, `portalUrl`, `documentUrl`, and scrape dates are not dropped on new records.
- Add focused tests for SearXNG ingestion, Firecrawl enrichment, duplicate update handling, and unauthenticated access blocking.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/actions/import-opportunities-auth.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally deferred while on battery. This slice used focused Vitest coverage plus TypeScript checking because the changed surface is a server action boundary.

Remaining after this slice:
- Wire the discovery import action into scheduled/source workflows or an operator UI so target query sets can run without a developer console.
- Add browser-only fallback behavior for pages Firecrawl cannot scrape cleanly, using the existing Playwright service first and CloakHQ/cloakbrowser only if needed.
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.

### 2026-05-26 - Operator Discovery Run Endpoint

Status: implemented and verified.

Purpose: make live opportunity discovery triggerable through an operational API surface, not only as an internal server action.

Changes in this slice:
- Add `POST /api/opportunities/discovery/run` for scraper-operator/admin controlled discovery runs.
- Validate discovery request fields before any live search work starts.
- Route authorized requests into `discoverAndImportOpportunities` so the same audited import, dedupe, SearXNG, and optional Firecrawl enrichment path is used.
- Add route tests for unauthorized access, malformed request bodies, and successful operator-triggered discovery imports.

Verification:
- `npm run test -- __tests__/api/opportunity-discovery-route.test.ts __tests__/actions/discovery-opportunity-import.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used focused route/action tests and TypeScript checking.

Remaining after this slice:
- Add scheduled discovery execution with a service actor or configured assignee, rather than requiring an interactive operator session.
- Add browser-only fallback behavior for pages Firecrawl cannot scrape cleanly, using the existing Playwright service first and CloakHQ/cloakbrowser only if needed.
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.

### 2026-05-26 - Scheduled Discovery Assignee Path

Status: implemented and verified.

Purpose: let cron/API-key discovery runs persist opportunities under an explicit configured assignee while keeping the interactive server action bound to the authenticated user.

Changes in this slice:
- Move live discovery import execution into a reusable server-side service that accepts an explicit assignee user ID.
- Keep `discoverAndImportOpportunities` authenticated: it still derives the assignee from the current user before calling the service.
- Allow `POST /api/opportunities/discovery/run` to accept `SCRAPER_API_KEY` authorization for scheduled runs when `DISCOVERY_IMPORT_USER_ID` is configured.
- Return a clear `503` configuration error when an API-key discovery run is attempted without `DISCOVERY_IMPORT_USER_ID`.
- Extend route tests to cover session-triggered runs, API-key scheduled runs, missing service assignee configuration, invalid request bodies, and unauthorized access.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/actions/import-opportunities-auth.test.ts __tests__/api/opportunity-discovery-route.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used focused action/route coverage plus TypeScript checking.

Remaining after this slice:
- Add browser-only fallback behavior for pages Firecrawl cannot scrape cleanly, using the existing Playwright service first and CloakHQ/cloakbrowser only if needed.
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.

### 2026-05-26 - Browser Fallback for Discovery Enrichment

Status: implemented and verified.

Purpose: keep live opportunity ingestion useful when Firecrawl cannot scrape a high-value result cleanly by falling back to the available Playwright/stealth browser service before considering any new browser dependency.

Changes in this slice:
- Add browser fallback enrichment to `executeOpportunityDiscoveryImport` when `scrapeTopResults` is enabled and Firecrawl fails or returns sparse content.
- Default the stealth browser service to `http://84.247.181.100:3003`, while still honoring `STEALTH_SCRAPER_URL`.
- Record whether enrichment came from Firecrawl or browser fallback in discovery metadata, including the fallback reason.
- Expose `browserFallback` and `browserFallbackLimit` through the operator discovery API request parser.
- Align frontend scraper fallback defaults and `.env.example` with the connectivity host Playwright service.
- Add a focused regression test proving a Firecrawl failure is recovered through the browser service and persisted with browser fallback provenance.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/api/opportunity-discovery-route.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used targeted action/route tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Consider CloakHQ/cloakbrowser only after a real target source fails both Firecrawl and the existing Playwright/stealth service.

### 2026-05-26 - Requirement-Traceable Proposal Package Creation

Status: implemented and verified.

Purpose: move the response-generation path beyond generic document creation by making the standard proposal set idempotent and immediately traceable to extracted RFP requirements.

Changes in this slice:
- Make `createStandardProposalSet` skip already-created standard document types instead of duplicating proposal documents on repeated package creation.
- Link actionable RFP requirements to matching proposal document sections by category, preserving existing section requirement IDs.
- Update each linked requirement with the response document and section that will address it.
- Keep all requirement and section updates scoped through the assigned opportunity.
- Add focused tests covering unauthenticated access, assigned-opportunity scoping, duplicate avoidance, requirement-to-section linking, and traceability updates.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/proposal-documents-auth.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used targeted proposal-document action tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Strengthen generation quality by using opportunity context, accepted requirements, win themes, past performance, and compliance gaps to seed section-specific draft content.

### 2026-05-26 - Requirement-Aware Proposal Draft Seeding

Status: implemented and verified.

Purpose: make newly created proposal documents start from opportunity-specific response guidance instead of generic Datacraft boilerplate alone.

Changes in this slice:
- Enrich new proposal documents with an opportunity-specific response plan covering client context, sector, region, deadline, budget, fit score, win probability, scope, submission signals, and strategic notes.
- Pull actionable extracted RFP requirements for the document type and seed requirement-by-requirement response cues directly into the draft content.
- Add Datacraft proof points tailored by document type so writers can connect requirements to Lindela, MeGuard, Wakala, delivery governance, cost logic, and past performance evidence.
- Add compliance gap closure prompts for requirements that are not yet addressed or compliant.
- Store seeded requirement IDs and a response-plan version in document metadata for traceability.
- Add focused tests that capture the inserted document payload and verify that matching technical requirements are seeded while unrelated cost requirements are excluded.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/proposal-documents-auth.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used targeted proposal-document action tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Strengthen downstream section generation/review so accepted requirement links can drive per-section drafting, evaluator scoring checks, and final compliance verification.

### 2026-05-26 - Requirement-Aware Section Draft Persistence

Status: implemented and verified.

Purpose: turn linked proposal-section requirements into persisted draft content and compliance progress, rather than leaving the links as passive metadata.

Changes in this slice:
- Add a requirement-aware section draft action that loads the scoped proposal section, proposal document, underlying document, opportunity context, and linked requirements.
- Generate section-level draft content with direct requirement responses, evaluator win angle, evidence checklist, and review gate prompts.
- Persist the generated section draft into the underlying document while replacing any previous generated draft for the same section to avoid repeated duplicate blocks.
- Create a new document version for the persisted draft.
- Update section word count/status and mark linked not-addressed requirements as partially covered with response document/section traceability.
- Store generated section draft metadata on the document for later audit and refresh logic.
- Add focused tests covering document persistence, version creation, section progress, requirement status advancement, and assigned-opportunity scoping.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/proposal-documents-auth.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used targeted proposal-document action tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Connect the requirement-aware section draft action to an operator-visible UI/control path or response package workflow.
- Strengthen final review so compliance status is promoted from partial to compliant only after evidence and evaluator-readiness checks pass.

### 2026-05-26 - Operator Control for Requirement-Aware Drafting

Status: implemented and verified.

Purpose: make requirement-aware drafting accessible from the proposal document workflow instead of leaving it as a server-only capability.

Changes in this slice:
- Add a document-level requirement-aware draft action that drafts every section in a proposal document and returns drafted section/requirement coverage.
- Mark the proposal document as drafting after linked section drafts are generated.
- Add a visible `Draft` control to proposal document cards and a matching dropdown action for operator workflows.
- Wire the UI control to the server action and update the local document status after generation.

Verification:
- `npx tsc --noEmit` passed.
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/proposal-documents-auth.test.ts` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used targeted proposal-document action tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add final evaluator-readiness/compliance promotion checks so drafts become submission-ready only after evidence, cross-reference, and review gates pass.

### 2026-05-26 - Requirement-Gated Proposal Approval

Status: implemented and verified.

Purpose: prevent draft-generation progress from being mistaken for final response readiness.

Changes in this slice:
- Add an approval/final-status gate for proposal documents with linked requirements.
- Before a proposal document can be marked approved or final, load its linked section requirements through the assigned-opportunity scope.
- Block approval when linked requirements remain partial, not addressed, non-compliant, or otherwise unresolved.
- Allow final status only when linked requirements are addressed, compliant, or not applicable.
- Add focused coverage proving unresolved linked requirements prevent proposal document approval and no update is written.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/proposal-documents-auth.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used targeted proposal-document action tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add evidence-aware promotion workflows so compliant status can be earned from verified response evidence instead of manual status changes alone.

### 2026-05-26 - Evidence-Backed Requirement Promotion

Status: implemented and verified.

Purpose: let requirements legitimately move from drafted/partial coverage to compliant after compliance review verifies response evidence.

Changes in this slice:
- Strengthen compliance entry approval so approval promotes the entry to `compliant` instead of leaving reviewed evidence at `partial`.
- Sync approved compliance entries back to the underlying RFP requirement, setting its compliance status to `compliant`.
- Sync waived compliance entries back to the underlying requirement as `not_applicable`.
- Reopen previously compliant requirements back to partial coverage when compliance review is reopened.
- Preserve existing compliance justifications when approval occurs, while using the review reason as a fallback.
- Update focused compliance workflow tests to verify matrix statistics, entry updates, and underlying requirement promotion.

Verification:
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts __tests__/actions/proposal-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This slice used targeted compliance/proposal workflow tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add operator-visible review controls that make the evidence promotion path easy to use from proposal/compliance screens.

### 2026-05-26 - Operator Matrix Final Lock Controls

Status: implemented and verified.

Purpose: make final compliance review and matrix locking accessible to operators, not only available as an internal server action.

Changes in this slice:
- Add a tenant-scoped matrix workflow API route for submitting a matrix for review, locking the final matrix, and reopening it.
- Add a `Matrix Review` control to the compliance matrix UI.
- Show valid matrix workflow actions by current matrix state: draft matrices can be submitted for review, review matrices can be locked or reopened, and final/submitted matrices can be reopened.
- Reuse the existing workflow reason dialog so matrix lock decisions preserve an explicit audit reason.
- Surface server-side matrix lock blockers directly in the UI error message.

Verification:
- `npx tsc --noEmit` passed.
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used the focused compliance workflow test and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add route-level tests for the new matrix workflow API when broader API testing is worth the battery cost.

### 2026-05-26 - Operator Live Discovery Control

Status: implemented and verified.

Purpose: make live SearXNG/Firecrawl opportunity discovery runnable from the product UI, not only through server actions or API calls.

Changes in this slice:
- Add a `Discover` control to the Opportunities command center header.
- Add a live discovery dialog that accepts multiple SearXNG queries, optional region/category hints, result limits, enrichment limits, Firecrawl enrichment, browser fallback, and broad-match inclusion.
- Wire the dialog to the authenticated `discoverAndImportOpportunities` server action.
- Show created/updated/skipped/failed import counts after a run.
- Refresh opportunity list/stat query caches after discovery completes.

Verification:
- `npx tsc --noEmit` passed.
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/api/opportunity-discovery-route.test.ts` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used TypeScript checking plus focused discovery action/API tests.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add persisted discovery run presets/schedules in the UI so repeated searches can be operated without re-entering query sets.

### 2026-05-26 - Persisted Discovery Run Presets

Status: implemented and verified.

Purpose: make repeated live opportunity searches operable without re-entering the same SearXNG query sets and enrichment settings.

Changes in this slice:
- Reuse the existing `saved_searches` table for discovery run presets through a tagged JSON payload, avoiding a new migration.
- Add authenticated server actions to create, list, and delete discovery presets.
- Keep normal saved searches separate from discovery presets so saved opportunity filters do not show live-discovery run configurations.
- Add preset save/load/delete controls to the live discovery dialog.
- Persist multi-query input, region/category hints, result limits, enrichment limits, Firecrawl enrichment, browser fallback, broad-match inclusion, and update behavior.
- Add focused tests for discovery preset persistence and unauthenticated access.

Verification:
- `npm run test -- __tests__/actions/saved-searches-auth.test.ts __tests__/actions/discovery-presets.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used focused saved-search/discovery action tests plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add scheduled execution for saved discovery presets so recurring searches can run unattended under a configured assignee.

### 2026-05-26 - Scheduled Discovery Preset Runs

Status: implemented and verified.

Purpose: let recurring opportunity discovery run unattended from saved presets under the configured import assignee.

Changes in this slice:
- Add `POST /api/opportunities/discovery/presets/run` for cron/API-key scheduled discovery.
- Load discovery presets owned by `DISCOVERY_IMPORT_USER_ID`, with optional `presetIds`, `limit`, and `dryRun` request controls.
- Run presets sequentially through `executeOpportunityDiscoveryImport` so scheduled search does not fan out aggressively while on constrained compute.
- Return per-preset import results and continue running later presets if one preset fails.
- Add dry-run output that reports the exact saved preset inputs without contacting SearXNG/Firecrawl.
- Add focused route tests for unauthorized access, missing assignee configuration, dry-run behavior, scheduled execution, and request validation.

Verification:
- `npm run test -- __tests__/api/opportunity-discovery-presets-route.test.ts __tests__/api/opportunity-discovery-route.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used focused route tests plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add operator-facing documentation or a settings surface for wiring cron to discovery preset runs.

### 2026-05-26 - Discovery Operations Runbook

Status: implemented and verified.

Purpose: make the live and scheduled discovery controls operable by deployment operators without reverse-engineering endpoint details.

Changes in this slice:
- Add an opportunity discovery operations runbook under technical runbooks.
- Document required app environment for SearXNG, Firecrawl, browser fallback, API-key auth, and scheduled import ownership.
- Document manual API-key discovery runs and scheduled preset dry-run/execution calls.
- Add an example cron entry and operating guidance for bounded search/enrichment settings.
- Link the runbook from the technical runbooks index.

Verification:
- `git diff --check` passed.

Testing scope note:
- This was a documentation-only slice, so no code tests or TypeScript checks were run.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add an operator settings/status surface for discovery scheduler health if UI visibility is needed beyond the runbook and API responses.

### 2026-05-26 - Direct Opportunity Source RFP Intake

Status: implemented and verified.

Purpose: close the discovery-to-RFP intake gap when a discovered opportunity already has a direct RFP/document source link.

Changes in this slice:
- Add an authenticated `ingestOpportunitySourceDocument` action that scopes access to the assigned opportunity.
- Create an `opportunity_documents` record from `documentUrl` or `rfpLink` when the source document has not already been discovered.
- Reuse the existing server-side download, storage receipt, duplicate detection, workflow audit, and parser queue path from `downloadDocument`.
- Return an idempotent success when the matching source document is already downloaded.
- Add an `Ingest Source Link` control to the empty RFP documents panel so operators can bridge a discovered opportunity into RFP intake without manual upload.
- Add focused action coverage for the direct source-ingest path.

Verification:
- `npm run test -- __tests__/actions/opportunity-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used focused opportunity-document action tests plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Improve post-ingest UI visibility for parser progress after source-link ingestion, if operators need live status without refreshing.

### 2026-05-26 - Source Intake Queue Feedback

Status: implemented and verified.

Purpose: keep parser-queue evidence visible immediately after direct source-link ingestion.

Changes in this slice:
- Stop refreshing the opportunity page immediately after source-link ingest succeeds.
- Show the existing RFP intake step tracker in the empty documents state when source-link ingestion returns a result.
- Surface stored/queued counts from the returned storage path and parsing job instead of hiding them behind a reload.

Verification:
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and component tests remain intentionally skipped while on battery. This slice used TypeScript checking for the small UI state change.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add persisted parser progress polling on the opportunity detail page if source-link ingestion needs live background status updates.

### 2026-05-26 - Opportunity Parser Progress Visibility

Status: implemented and verified.

Purpose: keep RFP parser status visible on the opportunity detail page after source-link or document ingestion, including after navigation or refresh.

Changes in this slice:
- Enrich opportunity document reads with linked `rfpDocumentId`, latest `parsingJobId`, parser status, and parser progress by matching downloaded document hashes to RFP documents and latest parse jobs.
- Render the existing RFP parse progress card below the opportunity document panel whenever linked parser records exist.
- Keep completion/error toasts limited to fresh intake results so reloading an opportunity with an already-completed parse does not fire stale notifications.
- Return linked parser references when direct source ingestion is retried against an already-downloaded source document.
- Make `RFPParseProgress` understand the human-readable parser step strings currently stored by the backend, falling back to progress percentages when no exact step text is available.

Verification:
- `npm run test -- __tests__/actions/opportunity-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used focused action coverage plus TypeScript checking because it touches one read model and two client surfaces.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Add a broader joined parse/status test for `getOpportunityDocuments` when running on power, or when a service-level test harness for this DB read model is already active.

### 2026-05-26 - Parser to Requirements Handoff

Status: implemented and verified.

Purpose: let operators continue directly from completed RFP parsing into requirements review from the opportunity detail page.

Changes in this slice:
- Add optional completion destination props to `RFPParseProgress`.
- Render a `Review Requirements` action when parser status is completed and a completion URL is supplied.
- Point opportunity detail parser progress cards to `/opportunities/{id}/requirements`.

Verification:
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and component tests remain intentionally skipped while on battery. This slice is a small UI handoff addition verified by TypeScript and whitespace checks.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Strengthen the requirements review page next if accepted requirements do not yet reliably trigger response-package work.

### 2026-05-26 - Accepted Requirements Response Package Handoff

Status: implemented and verified.

Purpose: turn reviewed requirements into the next response-package workflow step without letting unreviewed parser output drive proposal sections.

Changes in this slice:
- Add a `Build Response Package` control to the opportunity requirements page.
- Route the control through the existing `createStandardProposalSet` action, then send operators to the proposal documents workspace.
- Gate the requirements-page response-package action on at least one accepted requirement.
- Restrict standard proposal section linking to accepted, applicable requirements instead of every extracted actionable requirement.
- Update focused proposal-document coverage so linked package creation uses accepted requirement workflow metadata.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and component tests remain intentionally skipped while on battery. This slice used the existing proposal-document server-action test plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Consider an explicit one-click "draft all linked sections" orchestration after response package creation, so accepted requirements can proceed from package creation into initial narrative without per-document manual drafting.

### 2026-05-26 - One Click Response Package Drafting

Status: implemented and verified.

Purpose: move accepted requirements from review directly into drafted response content, not just empty proposal package records.

Changes in this slice:
- Add `createAndDraftStandardProposalSet`, a server action that requires accepted applicable requirements before orchestration starts.
- Reuse standard package creation/linking, then draft every standard proposal document with linked sections.
- Return created document count, drafted document count, drafted section count, linked requirement IDs, document IDs, and the latest version number.
- Change the requirements page handoff to build and draft the response package in one operator action.
- Add focused coverage for the create/link/draft orchestration path.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and broad proposal workflow tests remain intentionally skipped while on battery. This slice used focused proposal action coverage plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Strengthen final evaluator/compliance review so generated drafts are promoted only after evidence, compliance, and readiness gates pass.

### 2026-05-26 - Response Package Compliance Matrix Seeding

Status: implemented and verified.

Purpose: produce compliance proof rows at the same time accepted requirements are drafted into the response package.

Changes in this slice:
- Extend `createAndDraftStandardProposalSet` to create or reuse an opportunity compliance matrix for accepted applicable requirements.
- Add missing compliance entries for accepted requirements, carrying response document, response section, owner, due date, risk, and response summary into the matrix rows.
- Refresh matrix counts and store response-package synchronization metadata.
- Return `complianceMatrixId` and `complianceEntriesCreated` from the create/link/draft orchestration.
- Surface the number of compliance rows added in the requirements-page success toast.
- Extend focused proposal-document action coverage for the matrix seeding path.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and broad compliance workflow tests remain intentionally skipped while on battery. This slice used focused proposal action coverage plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Expose the generated compliance matrix from the opportunity requirements/documents workflow if operators need a first-class navigation target before final lock/review.

### 2026-05-26 - Opportunity Compliance Matrix Visibility

Status: implemented and verified.

Purpose: make generated compliance proof reviewable in the opportunity requirements workflow instead of leaving it hidden behind APIs.

Changes in this slice:
- Load latest compliance matrices for the opportunity requirements page.
- Pass compliance matrix summaries into the requirements client surface.
- Render the existing `ComplianceMatrix` review component inline when a matrix exists.
- Update the requirements-page create/link/draft action to reveal newly created matrix IDs immediately after orchestration succeeds.

Verification:
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and component tests remain intentionally skipped while on battery. This slice is a UI visibility/read-model change verified with TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Strengthen the final document approval/render/submission path so compliance matrix lock and document finalization are required before submission.

### 2026-05-26 - Final Submission Checklist Alignment

Status: implemented and verified.

Purpose: ensure the submission UI shows the same readiness blockers that the server enforces before recording a submission.

Changes in this slice:
- Replace the legacy pre-submission checklist source with `evaluateFinalSubmissionChecklistWorkflow`.
- Map final checklist categories into the existing submission checklist UI model.
- Preserve hard-gate status, required flags, messages, and assigned roles from the enforced final checklist.
- Add focused coverage proving the operator checklist is loaded from the final submission gate.

Verification:
- `npm run test -- __tests__/actions/submissions-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and broad submission workflow tests remain intentionally skipped while on battery. This slice used focused submission action coverage plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Improve the submission form interaction so final-gate items are clearly system-verified rather than manually toggleable checklist items.

### 2026-05-26 - System Verified Submission Checklist Items

Status: implemented and verified.

Purpose: prevent operators from thinking final submission gates can be satisfied by manually checking boxes in the UI.

Changes in this slice:
- Add an `isSystemVerified` flag to pre-submission checklist items.
- Mark final-gate checklist rows returned by `getPreSubmissionChecklist` as system verified.
- Disable manual toggling for system-verified rows in the submission form.
- Add a visible `System checked` badge for those rows.
- Extend focused submission action coverage for the new flag.

Verification:
- `npm run test -- __tests__/actions/submissions-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, browser visual pass, and component tests remain intentionally skipped while on battery. This slice used focused submission action coverage plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Strengthen final artifact/signoff creation paths if operators cannot yet produce the metadata required by the final submission gate.

### 2026-05-26 - Proposal Final Package Signoff Path

Status: implemented and verified.

Purpose: give operators a first-class path to produce the artifact hash and executive/legal signoff metadata required by the enforced final submission gate.

Changes in this slice:
- Add a `signoff` transition to the final artifact workflow that requires authority, only runs after an approved final artifact exists, and records `finalSubmissionSignoff` metadata.
- Clear final submission signoff metadata when a final artifact is reopened for correction.
- Surface rendered artifact, approved artifact, and signoff summaries on proposal document records.
- Add a proposal-document finalization server action that renders/approves/signs/reopens a final package and returns the refreshed proposal document.
- Add final package controls to the opportunity proposal document cards for render, approve, sign off, and reopen actions.

Verification:
- `npm run test -- __tests__/actions/final-artifact-workflow.test.ts` passed.
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, production build, and browser visual pass remain intentionally skipped while on battery. This slice used focused final artifact/proposal action coverage plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Check whether compliance matrix final lock/approval is similarly reachable from the operator workflow before final submission.

### 2026-05-26 - Valid Compliance Entry Seeding

Status: implemented and verified.

Purpose: keep generated compliance matrices on the review/lock path by avoiding invalid seeded entry statuses.

Changes in this slice:
- Seed accepted requirement compliance entries with `compliant` instead of the unsupported `full` status.
- Extend response-package coverage to assert compliant accepted requirements create reviewable compliance entries with response evidence and strong assessment metadata.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This was a narrow data-shape fix covered by the touched proposal action test and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether matrix entry workflow bulk actions are needed for large RFPs so final lock remains operational at scale.

### 2026-05-26 - Actionable DLP Checklist Details

Status: implemented and verified.

Purpose: make final submission privacy blockers actionable by showing which documents and DLP rules caused the gate to fail.

Changes in this slice:
- Include DLP severity summary in the final submission checklist privacy row.
- Include the first matching document/rule details for blocking and advisory DLP findings.
- Add focused checklist coverage for the document/rule detail in the DLP row.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This was a narrow checklist-message change covered by the touched workflow test and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether matrix entry workflow bulk actions are needed for large RFPs so final lock remains operational at scale.

### 2026-05-26 - Final Gate Task Navigation

Status: implemented and verified.

Purpose: send operators from workflow tasks to the opportunity screens where final submission and compliance blockers can actually be resolved.

Changes in this slice:
- Point final submission checklist workflow tasks to `/opportunities/{id}/submission`.
- Point compliance matrix final-lock workflow tasks to the opportunity requirements page when the matrix is opportunity-scoped.
- Add focused assertions for both workflow action URLs.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts` passed.
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This was a narrow workflow metadata fix covered by focused action tests and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether matrix entry workflow bulk actions are needed for large RFPs so final lock remains operational at scale.

### 2026-05-26 - Submission Checklist Refresh

Status: implemented and verified.

Purpose: let operators re-check final submission readiness after fixing artifact, signoff, compliance, or DLP blockers without leaving the submission form.

Changes in this slice:
- Add a refresh action to the pre-submission checklist panel.
- Show checklist refresh loading state and prevent submission while readiness is being refreshed.
- Preserve server-derived final gate rows as system-verified checklist evidence.

Verification:
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, component tests, and production build remain intentionally skipped while on battery. This was a narrow client interaction change verified with TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether matrix entry workflow bulk actions are needed for large RFPs so final lock remains operational at scale.
