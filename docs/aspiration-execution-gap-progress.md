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

### 2026-05-26 - Discovery Source Document Seeding Warning Telemetry

Status: implemented and verified.

Purpose: keep live discovery imports honest when an opportunity is created or updated but its source-document handoff row cannot be seeded.

Changes in this slice:
- Make source-document row seeding non-blocking after a successful opportunity create/update.
- Add `source_document_seed_failed` discovery warnings with query, title, document URL, and failure reason.
- Persist source-document seeding warnings into the import record audit config alongside Firecrawl/browser fallback warnings.
- Extend focused discovery import coverage to prove an opportunity remains imported while the source-document seeding failure is reported.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts` from `frontend/` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, live SearXNG/Firecrawl calls, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies warning telemetry with the focused discovery import action test.

Remaining after this slice:
- Continue reducing manual steps from source-document records into bounded download/parse orchestration and generated response package proof.

### 2026-05-26 - Discovery Source Document Count Visibility

Status: implemented and verified.

Purpose: make the discovery-to-intake bridge visible to operators by reporting how many source-document rows were seeded from discovered RFP/tender document URLs.

Changes in this slice:
- Return `sourceDocumentsCreated` and `sourceDocumentsExisting` from the live discovery import result.
- Count newly seeded and already-linked source-document rows separately when opportunities are created or updated.
- Surface source-document seeding counts in the live discovery dialog summary.
- Extend focused discovery import coverage to prove direct document-link imports report seeded source-document rows.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts` from `frontend/` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, live SearXNG/Firecrawl calls, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies the result contract with the focused discovery import action test; the UI change is a small typed consumer of that result.

Remaining after this slice:
- Continue reducing manual steps from seeded source-document rows into bounded download/parse orchestration and response-package generation.

### 2026-05-26 - Discovery Document Row Auto-Seeding

Status: implemented and verified.

Purpose: move live opportunity discovery closer to RFP intake by creating the selected source-document row as soon as discovery identifies a direct RFP/tender document URL.

Changes in this slice:
- Create an `opportunity_documents` record for discovered `documentUrl` values during SearXNG/Firecrawl opportunity import.
- Avoid duplicate source-document rows by checking the opportunity/source URL pair before insert.
- Infer document name and RFP/attachment type from the discovered URL, mark it selected, and preserve the opportunity `documentUrl` handoff.
- Extend focused discovery import coverage to prove extracted RFP document links now create selected source-document records.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts` from `frontend/` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, live SearXNG/Firecrawl calls, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies the discovery import bridge with the focused action test.

Remaining after this slice:
- Continue reducing manual steps from discovered source-document records into download, parse acceptance, requirements approval, and response package drafting.

### 2026-05-26 - Final Checklist Win Theme Consistency Gate

Status: implemented and verified.

Purpose: prevent final submission readiness from ignoring known critical win-theme consistency gaps that would weaken evaluator-facing response quality.

Changes in this slice:
- Load opportunity theme analysis snapshots as part of the final submission checklist evaluation.
- Add a win-theme consistency checklist item that blocks known critical gaps and surfaces missing, major, or minor gaps as warnings.
- Include the latest theme analysis ID, gap summary, and capture-manager ownership in the checklist item.
- Extend focused final submission checklist coverage to prove critical theme gaps block readiness while clean theme analysis still allows final readiness.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts` from `frontend/` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies the final checklist gate logic with the focused final submission workflow action test.

Remaining after this slice:
- Continue strengthening final package evidence, submission packaging receipts, and the live opportunity discovery-to-response proof path.

### 2026-05-26 - Regenerated Section Win Theme Seeding

Status: implemented and verified.

Purpose: keep regenerated requirement-aware section drafts aligned with approved capture strategy after the initial proposal document draft is refreshed.

Changes in this slice:
- Load active win themes for the assigned opportunity when regenerating a requirement-aware proposal section draft.
- Add approved win-theme guidance to regenerated section draft content before the evaluator win angle and evidence checklist.
- Store regenerated section draft win theme IDs in document metadata and return them from the section draft action result.
- Extend focused proposal document coverage to prove regenerated section drafts include active win themes and preserve traceability metadata.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` from `frontend/` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice reuses the focused proposal documents action test because it exercises both initial proposal seeding and regenerated section drafting.

Remaining after this slice:
- Continue hardening final package readiness, win-theme consistency checks, and submission review gates.

### 2026-05-26 - Win Theme Response Draft Seeding

Status: implemented and verified.

Purpose: make generated proposal drafts carry active win themes so response package content starts from approved capture strategy rather than generic proof points alone.

Changes in this slice:
- Load active win themes for the assigned opportunity when seeding a new proposal document draft.
- Add an "Approved Win Themes To Weave In" response-plan section with theme statement, short version, type, priority, and supporting evidence.
- Store seeded win theme IDs in document metadata alongside seeded requirement IDs for traceability.
- Extend focused proposal document coverage to prove active win themes appear in generated draft text and metadata.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies proposal draft seed content with the focused proposal documents action test.

Remaining after this slice:
- Continue hardening win-theme injection into regenerated section drafts and final review gates.

### 2026-05-26 - Response Package Draft Runtime Evidence

Status: implemented and verified.

Purpose: make generated standard response packages visible in workflow runtime/audit evidence instead of only creating proposal documents and compliance rows.

Changes in this slice:
- Record a `proposal_response_package` workflow transition after standard response package drafting completes.
- Link the workflow event directly to the generated compliance matrix, accepted requirements, proposal document rows, document rows, and document version.
- Preserve drafting behavior when workflow telemetry is unavailable so response generation is not blocked by audit persistence.
- Extend focused response-package coverage to assert runtime evidence links and metadata for the generated draft.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies response-package workflow evidence with the focused proposal documents action test.

Remaining after this slice:
- Continue hardening generated response quality, win-theme injection, and final package readiness evidence.

### 2026-05-26 - Discovered Document URL Intake Handoff

Status: implemented and verified.

Purpose: ensure scraped discovery document links are the URLs operators view and ingest into the RFP parser pipeline.

Changes in this slice:
- Prefer `opportunity.documentUrl` over portal/RFP page links for the opportunity detail page direct RFP link and source ingest controls.
- Keep the portal/RFP link fallback for opportunities that do not yet have a direct document URL.
- Extend opportunity document action coverage to prove source intake creates the discovered source document from `documentUrl`, not the portal page.

Verification:
- `npm run test -- __tests__/actions/opportunity-documents-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies the server-action intake source selection and applies a small page wiring change.

Remaining after this slice:
- Continue closing gaps between discovered RFP documents, requirements extraction, and response package generation.

### 2026-05-26 - Discovery Scrape Document URL Extraction

Status: implemented and verified.

Purpose: make live opportunity discovery carry usable RFP/tender document links from scraped portal pages instead of only saving the portal URL.

Changes in this slice:
- Extract likely PDF/DOC/DOCX/XLS/XLSX/ZIP document links from Firecrawl or browser-fallback markdown.
- Resolve relative document links against the discovered portal URL and strip fragments before persistence.
- Prefer links whose labels or URLs indicate RFP, tender, bid, solicitation, download, attachment, or terms-of-reference content.
- Store the selected document URL on `OpportunityInput.documentUrl` and in discovery metadata for auditability.
- Add focused discovery import coverage for a portal page containing multiple document links.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, live SearXNG/Firecrawl calls, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies the document-link extraction behavior with mocked discovery services.

Remaining after this slice:
- Continue strengthening the discovery-to-RFP-intake bridge, especially automatic document download/parse handoff from discovered `documentUrl` values.

### 2026-05-26 - Submission Runtime Artifact Evidence Links

Status: implemented and verified.

Purpose: make production submission workflow events reconstructable from the recorded portal receipt back to submitted final artifact storage and source receipts.

Changes in this slice:
- Expand submission workflow runtime evidence links to include the raw receipt, namespaced submission receipt, artifact SHA-256, artifact storage path, and source document SHA-256.
- Preserve the full locked attachment receipt metadata on the workflow event.
- Extend focused submission workflow coverage to assert evidence links and metadata include the final artifact receipt chain.

Verification:
- `npm run test -- __tests__/actions/submission-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies the submission workflow runtime evidence payload only.

Remaining after this slice:
- Continue focused proof-path hardening until power allows running `wave9-discovery-to-submission-core`.

### 2026-05-26 - Submission History Artifact Receipt Visibility

Status: implemented and verified.

Purpose: make submitted package history show the stored final artifact receipts that are already locked into submission attachments.

Changes in this slice:
- Add a pure submission attachment receipt formatter for file size, artifact hash, storage location, source freshness, approval, and lock receipts.
- Show receipt details and final artifact download links in the submission history attachment list.
- Preserve legacy attachment display by falling back to document title and storage path when newer receipt fields are absent.
- Add focused coverage for rich final artifact receipts and legacy attachment fallback formatting.

Verification:
- `npm run test -- __tests__/submissions/attachment-receipts.test.ts __tests__/actions/submission-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies receipt formatting plus the existing submission workflow receipt-locking path.

Remaining after this slice:
- Add audit explorer reconstruction proof from submitted package receipt back to final stored artifacts when the power budget allows.

### 2026-05-26 - RFP Parser Stored Hash Guard

Status: implemented and verified.

Purpose: prevent parse jobs from extracting requirements from corrupted or mismatched stored RFP bytes.

Changes in this slice:
- Pass the recorded RFP document `fileHash` into parser text extraction when stored text is not already available.
- Verify the fetched local, HTTP, storage-key, or Linode E3 bytes against the recorded SHA-256 before PDF/DOCX/HTML parsing or AI extraction.
- Preserve existing unreadable-document fallback behavior while allowing hash mismatch failures to stop the parse job explicitly.
- Add focused workflow coverage proving mismatched stored bytes fail before AI extraction.
- Add the parser workflow test to `wave9-discovery-to-submission-core` so the aggregate non-live path covers RFP parse integrity.

Verification:
- `npm run test -- __tests__/actions/rfp-parse-workflow.test.ts __tests__/actions/platform-proof-scenarios.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate wave9 proof scenario remain intentionally skipped while on battery. This slice verifies parser integrity behavior and proof manifest wiring only.

Remaining after this slice:
- Continue closing discovery-to-submission integrity gaps with focused checks until power allows running `wave9-discovery-to-submission-core`.

### 2026-05-26 - Opportunity Document Download Route Integrity Coverage

Status: implemented and verified.

Purpose: prove the RFP document download API surfaces scoped storage integrity failures cleanly and remains part of the aggregate proof lane.

Changes in this slice:
- Add focused API coverage for successful opportunity document downloads, authorization denials, and hash-mismatch conflict responses.
- Update the route comment to reflect server-side storage rather than local-only storage.
- Add `opportunity-document-download-route.test.ts` to `wave9-discovery-to-submission-core`.
- Add the route proof artifact to the wave9 expected artifact list.

Verification:
- `npm run test -- __tests__/api/opportunity-document-download-route.test.ts __tests__/actions/platform-proof-scenarios.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate proof scenario remain intentionally skipped while on battery. This slice verifies route behavior and proof manifest wiring only.

Remaining after this slice:
- Continue adding focused proof for discovery-to-submission integrity until power allows running `wave9-discovery-to-submission-core`.

### 2026-05-26 - RFP Document Read Integrity Guard

Status: implemented and verified.

Purpose: prevent stored RFP documents from being served or parsed if the bytes no longer match the recorded download hash.

Changes in this slice:
- Verify downloaded RFP bytes against `fileHash` when reading from Linode E3 or legacy local storage.
- Preserve a 409 `OpportunityDocumentIntegrityError` for scoped route callers when stored bytes do not match the recorded hash.
- Apply hash verification to document download serving and later Docling extraction reads.
- Add focused coverage for rejecting mismatched stored bytes before serving a scoped opportunity document.

Verification:
- `npm run test -- __tests__/services/rfp-document-service.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate proof scenario remain intentionally skipped while on battery. This slice targets RFP document read integrity with one focused service test file and whitespace validation.

Remaining after this slice:
- Add route-level coverage for the opportunity document download endpoint and include it in the aggregate proof lane.

### 2026-05-26 - Proof Lane Artifact Download Coverage

Status: implemented and verified.

Purpose: keep the aggregate discovery-to-submission proof lane aligned with the final artifact retrieval guard.

Changes in this slice:
- Add `documents-final-artifact-route.test.ts` to `wave9-discovery-to-submission-core`.
- Add the final artifact route proof artifact to the wave9 expected artifact list.
- Extend manifest coverage so the aggregate scenario asserts this route guard remains included.

Verification:
- `npm run test -- __tests__/actions/platform-proof-scenarios.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- The aggregate proof scenario itself remains intentionally unrun while on battery. This slice only verifies manifest wiring.

Remaining after this slice:
- Run `wave9-discovery-to-submission-core` when power allows and use failures to drive the next remediation chunks.

### 2026-05-26 - Submission Attachment Live Source Lock

Status: implemented and verified.

Purpose: prevent a selected submission attachment from being locked after the final checklist if its artifact receipt no longer matches the live document.

Changes in this slice:
- Refetch selected proposal documents with title, content, plain text, and current version before submission persistence.
- Recompute the live source hash during submission attachment locking.
- Require selected final artifact receipts to match the live document source version and hash before inserting the submission record.
- Preserve stored approval/source receipt metadata on locked submission attachments.
- Add focused coverage for a stale selected attachment after checklist success.

Verification:
- `npm run test -- __tests__/actions/submission-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate proof scenario remain intentionally skipped while on battery. This slice targets submission attachment locking with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue closing discovery-to-submission integrity gaps with focused checks until power allows running `wave9-discovery-to-submission-core`.

### 2026-05-26 - Final Checklist Live Source Freshness

Status: implemented and verified.

Purpose: prevent the final submission checklist from passing artifacts whose source receipts no longer match the live document.

Changes in this slice:
- Load document `plainText` and `currentVersion` with final checklist proposal documents.
- Hash the live document title, structured content, and plain text during checklist evaluation.
- Require approved final artifact source version and source hash to match the live document before the artifact gate passes.
- Return an explicit stale-artifact blocker directing operators to re-render the current document version.
- Add focused coverage for stale final artifacts after a document version change.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate proof scenario remain intentionally skipped while on battery. This slice targets final checklist source freshness with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue closing the discovery-to-submission path with focused remediation until power allows running `wave9-discovery-to-submission-core`.

### 2026-05-26 - Final Artifact Download Freshness Guard

Status: implemented and verified.

Purpose: prevent final artifact downloads from streaming stale or unapproved stored objects after document source changes.

Changes in this slice:
- Load the current document source version and content when resolving final artifact downloads.
- Require approved final artifacts to include approval metadata and source freshness receipts before object storage access.
- Require rendered artifact previews to match the current document source before object storage access.
- Reject stale or incomplete artifact receipts with a 409 re-render response before downloading from Linode E3.
- Add focused API coverage for approved download success, stale receipt rejection, and missing approval receipt rejection.

Verification:
- `npm run test -- __tests__/api/documents-final-artifact-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, production build, and the aggregate proof scenario remain intentionally skipped while on battery. This slice targets final artifact retrieval with one focused API test file and whitespace validation.

Remaining after this slice:
- Continue tightening final checklist freshness against live document content, then run `wave9-discovery-to-submission-core` when power allows.

### 2026-05-26 - Discovery-to-Submission Proof Scenario

Status: implemented and verified.

Purpose: make the non-live proof harness explicitly represent the core journey from opportunity discovery through final submission gates.

Changes in this slice:
- Add `wave9-discovery-to-submission-core` as an aggregate platform proof scenario.
- Route the scenario through focused tests for opportunity discovery/import, document discovery, RFP intake, requirements, response package drafting, final artifact readiness, final checklist, submission dispatch, and submission scoping.
- Record expected proof artifacts for each covered test lane.
- Extend manifest coverage so the aggregate scenario remains uniquely addressable.

Verification:
- `npm run test -- __tests__/actions/platform-proof-scenarios.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- The aggregate proof scenario itself was not executed while on battery. Only the manifest test and whitespace validation were run in this slice.

Remaining after this slice:
- Execute `wave9-discovery-to-submission-core` when power allows, then use failures to drive the next remediation chunks.

### 2026-05-26 - Submission Mutation Authority Preflight

Status: implemented and verified.

Purpose: prevent assigned-but-unauthorized users from changing submitted package status, outcome, or receipt confirmation state.

Changes in this slice:
- Require proposal manager or executive submission authority before direct submission status updates.
- Require the same submission authority before recording win/loss/withdrawn/no-award outcomes.
- Require explicit correction workflow authority before confirming a post-dispatch submission receipt.
- Add focused coverage that unauthorized mutation attempts stop before submission row reads or writes.

Verification:
- `npm run test -- __tests__/actions/submissions-scope.test.ts __tests__/actions/submission-correction-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets submission mutation authority with two focused action test files and whitespace validation.

Remaining after this slice:
- Continue hardening submission artifact retrieval and end-to-end discovery-to-submission proof.

### 2026-05-26 - Final Submission Artifact Freshness Gate

Status: implemented and verified.

Purpose: prevent final submission readiness from accepting a stored artifact that lacks approval or source freshness receipts.

Changes in this slice:
- Require final submission checklist artifacts to include storage, approval, source document version, and source content hash receipts.
- Require selected submission attachments to carry the same approval and source freshness receipts before locking them into a submission record.
- Snapshot artifact approval and source freshness metadata on submission attachments.
- Surface final artifact source freshness metadata in proposal document summaries.
- Add focused coverage for missing final artifact freshness and attachment receipt metadata.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts __tests__/actions/submission-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets final submission artifact readiness with two focused action test files and whitespace validation.

Remaining after this slice:
- Continue hardening submission package retrieval, correction/withdrawal compensation, and end-to-end discovery-to-submission proof.

### 2026-05-26 - Final Artifact Stale Render Guard

Status: implemented and verified.

Purpose: prevent an obsolete rendered proposal artifact from being approved after the source document changes.

Changes in this slice:
- Store the source document version and source content hash on rendered final artifact manifests.
- Require final artifact approval to match the current document version and content hash.
- Block approval with a re-render error when a late document edit makes the rendered artifact stale.
- Add focused final-artifact coverage for stale render rejection while preserving normal render, approval, signoff, and reopen behavior.

Verification:
- `npm run test -- __tests__/actions/final-artifact-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets final artifact readiness with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue hardening final submission checklist coverage, submission artifact retrieval, and end-to-end discovery-to-submission proof.

### 2026-05-26 - Accepted-Only Response Package Seeding

Status: implemented and verified.

Purpose: prevent unaccepted or draft-only requirements from leaking into automatically generated response-package draft content.

Changes in this slice:
- Add an accepted-only requirement seeding option for proposal document creation.
- Use accepted-only seeding when `createAndDraftStandardProposalSet` creates standard response-package documents.
- Preserve standalone proposal document creation behavior, which can still seed applicable document-type requirements for planning.
- Mark generated document metadata with the requirement seed policy and seeded requirement IDs.
- Add focused coverage with one accepted and one unaccepted same-type requirement to prove only the accepted requirement appears in package draft seed content.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets response-package draft relevance with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue hardening response-generation workflow visibility, final artifact readiness, and end-to-end discovery-to-submission proof.

### 2026-05-26 - Response Package Compliance Link Refresh

Status: implemented and verified.

Purpose: ensure generated response-package compliance entries trace to the proposal document and section after requirements are linked.

Changes in this slice:
- Refetch accepted requirements after standard proposal sections are linked.
- Build or update compliance matrix entries from fresh requirement rows instead of stale pre-link rows.
- Preserve response-package drafting behavior while ensuring `responseDocumentId` and `responseReference` are available for compliance traceability.
- Update focused coverage so an initially unlinked accepted requirement creates a compliance row with the generated response document and section reference.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets response-package traceability with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue hardening response-generation workflow visibility, final artifact readiness, and end-to-end discovery-to-submission proof.

### 2026-05-26 - Legacy Document Classifier Token Matching

Status: implemented and verified.

Purpose: prevent the legacy RFP document discovery service from misclassifying `platform` URLs as form documents.

Changes in this slice:
- Replace raw substring URL checks with token-based document type matching in `discoverDocuments`.
- Preserve amendment, specification, evaluation, form, and RFP classification behavior for delimited URL keywords.
- Add focused coverage for `Records-Platform-RFP.pdf` being stored as an RFP document.

Verification:
- `npm run test -- __tests__/services/rfp-document-service.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets legacy document discovery classification with one focused service test file and whitespace validation.

Remaining after this slice:
- Continue hardening parse retry coverage and response-generation readiness after RFP intake.

### 2026-05-26 - Parse Queue Remediation for Missing Workspace

Status: implemented and verified.

Purpose: prevent downloaded RFPs from silently stopping after storage when parser queueing cannot resolve a default workspace.

Changes in this slice:
- Record `parse_queue_failed` ingest workflow state when a downloaded document cannot be queued because the user has no default workspace.
- Create the existing remediation task for proposal/capture follow-up instead of only logging the condition.
- Preserve downloaded-document success semantics while making the parse-queue gap operationally visible.
- Add focused coverage for the missing-workspace queue path.

Verification:
- `npm run test -- __tests__/services/rfp-document-service.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets parser queue remediation visibility with one focused service test file and whitespace validation.

Remaining after this slice:
- Continue hardening document classification, parse retry coverage, and response-generation readiness after RFP intake.

### 2026-05-26 - Post-Download RFP Size Guard

Status: implemented and verified.

Purpose: prevent oversized RFP payloads from entering storage, Docling extraction, or parser queueing when a source omits or understates `content-length`.

Changes in this slice:
- Re-check downloaded byte length after reading the response body.
- Fail oversized downloads before hashing, object storage upload, Docling processing, or parser job creation.
- Preserve existing failure status and ingest workflow recording behavior.
- Add focused coverage for an oversized response with no `content-length` header without allocating a large test buffer.

Verification:
- `npm run test -- __tests__/services/rfp-document-service.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets downloaded RFP intake safety with one focused service test file and whitespace validation.

Remaining after this slice:
- Continue hardening document classification, parse queue recovery, and response-generation readiness after RFP intake.

### 2026-05-26 - Primary Portal Browser Fallback for Document Discovery

Status: implemented and verified.

Purpose: keep RFP document discovery productive when Firecrawl cannot scrape a primary portal or returns no downloadable document links.

Changes in this slice:
- Add Playwright/headless browser fallback for primary portal document discovery using the configured stealth scraper service defaulting to `http://84.247.181.100:3003`.
- Reuse existing primary-portal link extraction and persistence behavior for browser-discovered document links.
- Avoid browser fallback calls when Firecrawl link extraction already finds documents.
- Tighten URL document-type classification so words like `platform` no longer get misclassified as `form`.
- Add focused service coverage for blocked Firecrawl recovery and no-extra-browser-call Firecrawl link extraction.

Verification:
- `npm run test -- __tests__/services/document-discovery-agent.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets primary portal document discovery recovery with one focused service test file and whitespace validation.

Remaining after this slice:
- Continue hardening the discovery-to-response path, especially document download/intake resilience and response generation readiness after discovered source persistence.

### 2026-05-26 - Compliance Governance Authority Preflight

Status: implemented and verified.

Purpose: prevent non-authorized actors from inspecting compliance entry or matrix state before approval, waiver, bulk approval, final lock, rejection, or reopen authority is enforced.

Changes in this slice:
- Require compliance entry authority before entering the entry workflow transaction for all non-submit actions.
- Require compliance matrix authority before entering the matrix workflow transaction for all non-submit matrix actions.
- Preserve submit-for-review behavior for assigned writers and preserve existing workflow gates for authorized compliance/proposal reviewers.
- Add focused coverage that unauthorized entry approval and matrix final-lock attempts stop before transactions, DB reads, or mutations.

Verification:
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts __tests__/api/compliance-workflow-routes.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets compliance governance authority preflight behavior with focused action/API tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate discovery, response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Unsupported Claim Waiver Authority Check

Status: implemented and verified.

Purpose: prevent unsupported proposal claims from being accepted as-is unless the authenticated actor has proposal, capture, or compliance risk authority.

Changes in this slice:
- Require `proposal_manager`, `capture_manager`, `compliance_officer`, or admin authority before loading claim state for waiver actions.
- Preserve evidence-addition, rewrite, removal, start, and reopen remediation paths for assigned opportunity response workers.
- Stop unauthorized claim waiver attempts before DB reads, claim updates, workflow runtime recording, or task projection.
- Add focused coverage for denied claim waivers and authorized proposal-manager waivers.

Verification:
- `npm run test -- __tests__/actions/claim-remediation.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets unsupported-claim risk acceptance with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Win Strategy Authority Preflight

Status: implemented and verified.

Purpose: prevent non-authorized actors from approving competitive intelligence, win themes, theme injection text, or consistency signoff before proposal strategy authority is enforced.

Changes in this slice:
- Require `proposal_strategist`, `capture_manager`, `proposal_manager`, or admin authority before terminal competitive-intelligence approval.
- Require the same strategy authority before terminal win-theme approval/archive, theme injection accept/modify/reject, and theme consistency approval.
- Preserve non-terminal strategy review, stale-flagging, activation, gap-flagging, and reopen behavior for assigned opportunity users.
- Add focused coverage that unauthorized terminal win-theme decisions stop before DB reads, mutations, workflow runtime recording, or task projection.

Verification:
- `npm run test -- __tests__/actions/competitive-win-theme-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets win strategy authority preflight behavior with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Submission Correction Authority Preflight

Status: implemented and verified.

Purpose: prevent non-authorized actors from inspecting or mutating submitted proposal packages before post-dispatch correction and withdrawal authority is enforced.

Changes in this slice:
- Require submission authority before loading submitted package state for `apply_correction`.
- Require submission authority before loading submitted package state for `withdraw`.
- Preserve existing receipt, attachment, opportunity compensation, and runtime task behavior for authorized correction and withdrawal actions.
- Add focused coverage that unauthorized correction and withdrawal attempts stop before database reads or mutations.

Verification:
- `npm run test -- __tests__/actions/submission-correction-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets submission correction authority preflight behavior with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Pricing Approval Authority Preflight

Status: implemented and verified.

Purpose: prevent non-authorized actors from inspecting or mutating cost element and pricing package approval state before the pricing authority gate is enforced.

Changes in this slice:
- Require pricing approval authority before loading cost elements for approval.
- Require pricing approval authority before loading pricing package state for lock or reopen actions.
- Preserve existing status, BOE, approved-cost, and critical alignment gates for authorized pricing approvers.
- Add focused coverage that unauthorized pricing approval and lock attempts stop before database reads or mutations.

Verification:
- `npm run test -- __tests__/actions/pricing-approval-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets pricing authority preflight behavior with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Reusable Content Governance Authority Check

Status: implemented and verified.

Purpose: prevent reusable response-library content from being approved as current or archived unless the authenticated actor has content-governance or proposal-management authority.

Changes in this slice:
- Require `content_governor`, `proposal_manager`, or admin authority for terminal reusable-content `approve_current` and `archive` actions before snippet lookup or analytics mutation.
- Preserve mark-review-needed, mark-stale, and reopen-review behavior for visible organization snippets.
- Stop unauthorized reusable-content approval before DB reads, analytics updates/inserts, workflow runtime recording, or task projection.
- Add focused coverage for non-authority reusable-content approval attempts.

Verification:
- `npm run test -- __tests__/actions/content-governance-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets reusable content governance authority with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Customer Clarification Authority Check

Status: implemented and verified.

Purpose: prevent customer-facing clarification approval and submission from changing requirement clarification metadata unless the authenticated actor has proposal or capture authority.

Changes in this slice:
- Require `proposal_manager`, `capture_manager`, or admin authority for clarification `approve` and `submit` actions before requirement lookup or mutation.
- Preserve draft, approval-request, answer-recording, incorporation, and reopen behavior for assigned opportunity users.
- Stop unauthorized customer-facing clarification submission before DB reads, metadata updates, workflow runtime recording, or task projection.
- Add focused coverage for non-authority clarification submission attempts.

Verification:
- `npm run test -- __tests__/actions/clarification-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets customer-facing clarification authority with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that mutate response, governance, or submission state without enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Opportunity Digest Authority Check

Status: implemented and verified.

Purpose: prevent opportunity digest delivery workflows from evaluating saved-search matches and queueing notifications unless the authenticated actor has proposal or capture authority.

Changes in this slice:
- Resolve role-bearing user context for opportunity digest execution.
- Preserve the existing self-only digest guard while adding `proposal_manager`, `capture_manager`, or admin authority before saved-search reads.
- Stop unauthorized digest attempts before saved-search evaluation, opportunity matching, notification queueing, or workflow runtime recording.
- Add focused coverage for non-authority digest attempts.

Verification:
- `npm run test -- __tests__/actions/opportunity-digest.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets opportunity-digest authority with one focused action test file and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that only store authority metadata after mutations rather than enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Final Submission Authority Check

Status: implemented and verified.

Purpose: prevent final submission recording from inserting submission receipts and marking opportunities submitted unless the authenticated actor has proposal or executive authority.

Changes in this slice:
- Require `proposal_manager`, `executive`, or admin authority before running final submission readiness workflows or database mutations.
- Stop unauthorized submission attempts before opportunity lookup, pre-submission audit, final checklist evaluation, submission insert, opportunity status update, or runtime transition.
- Preserve existing audit, checklist, required-attachment, and final-artifact gates for authorized submitters.
- Add focused coverage for unauthorized submission recording and update submission auth/scope mocks for role-aware authorization.

Verification:
- `npm run test -- __tests__/actions/submission-workflow.test.ts __tests__/actions/submissions-scope.test.ts __tests__/actions/submissions-auth.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets final-submission authority with focused submission action tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that only store authority metadata after mutations rather than enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - RFP Parse Reject Authority Check

Status: implemented and verified.

Purpose: prevent terminal RFP parse rejection from changing parsing job and document workflow metadata unless the authenticated actor has proposal or operations authority.

Changes in this slice:
- Resolve role-bearing user context for explicit parse rejection.
- Require `proposal_manager`, `operations`, or admin authority before opening the parse workflow transaction.
- Throw the shared workflow authority-denied error so the existing parse API returns a 403 denial.
- Preserve retry, cancel, and manual extraction behavior on the existing tenant-context path.
- Add focused coverage for unauthorized parse rejection before mutation.

Verification:
- `npm run test -- __tests__/actions/rfp-parse-workflow.test.ts __tests__/api/rfp-parse-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets parse-reject authority with focused workflow/API tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that only store authority metadata after mutations rather than enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - RFP Amendment Impact Authority Check

Status: implemented and verified.

Purpose: prevent amendment impact processing from changing RFP document metadata, requirement workflow state, or impact-review tasks unless the authenticated actor has proposal or capture authority.

Changes in this slice:
- Resolve role-bearing user context before applying RFP amendment supersession or supplement impact.
- Require `proposal_manager`, `capture_manager`, or admin authority before opening the amendment-impact transaction.
- Return a non-mutating authority failure for writer or other non-authority roles.
- Preserve existing amendment metadata updates, requirement impact review projection, and runtime task creation for authorized reviewers.
- Add focused coverage for unauthorized amendment impact attempts.

Verification:
- `npm run test -- __tests__/actions/rfp-parse-workflow.test.ts __tests__/api/rfp-parse-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets amendment-impact authority with focused workflow/API tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that only store authority metadata after mutations rather than enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Parser Confidence Review Authority Check

Status: implemented and verified.

Purpose: prevent parser confidence review acceptance or correction requests from mutating RFP document review metadata unless the authenticated actor has proposal or capture authority.

Changes in this slice:
- Resolve role-bearing user context in `reviewRfpParseConfidence`.
- Require `proposal_manager`, `capture_manager`, or admin authority before loading or updating parser review metadata.
- Return a non-mutating authority failure when a writer or other non-authority role attempts parser confidence review.
- Preserve completed-parse gating and existing review workflow/task recording for authorized reviewers.
- Add focused coverage for unauthorized parser confidence review.

Verification:
- `npm run test -- __tests__/actions/rfp-parse-workflow.test.ts __tests__/api/rfp-parse-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets parser confidence-review authority with focused workflow/API tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that only store authority metadata after mutations rather than enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Requirement Acceptance Authority Check

Status: implemented and verified.

Purpose: prevent accepted requirements from projecting proposal writing tasks unless the authenticated actor has proposal or capture authority.

Changes in this slice:
- Resolve role-bearing user context in `transitionRequirementWorkflow`.
- Require `proposal_manager`, `capture_manager`, or admin authority before accepting a requirement.
- Stop unauthorized acceptance before opening the transaction, creating proposal tasks, updating requirement workflow metadata, or writing task activity.
- Keep reject and reopen behavior on the existing assigned-opportunity path.
- Add focused coverage for unauthorized acceptance and mock `revalidatePath` in the workflow test harness.

Verification:
- `npm run test -- __tests__/actions/requirements-workflow.test.ts __tests__/actions/proposal-task-workflow.test.ts __tests__/api/rfp-requirements-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets requirement acceptance authority with focused workflow/API tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct workflow transitions that only store authority metadata after mutations rather than enforcing authority up front.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - RFP Parse Authority Denial Response

Status: implemented and verified.

Purpose: make explicit RFP parse workflow actions return 403 when workflow authority is denied instead of surfacing those denials as generic 500 parse errors.

Changes in this slice:
- Map `WorkflowAuthorityDeniedError` from `transitionRfpParseWorkflow` to a generic 403 `Forbidden` response.
- Preserve existing parse queue, retry, manual extraction, legacy proxy, and internal-error behavior for non-authority paths.
- Add focused route coverage for authority-denied explicit parse workflow actions.

Verification:
- `npm run test -- __tests__/api/rfp-parse-route.test.ts __tests__/actions/rfp-parse-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets RFP parse workflow authority response behavior with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct API routes that mutate discovery, intake, or response workflow state without corresponding authority checks or clear 403 mappings.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Scraper Source Delete Authority Check

Status: implemented and verified.

Purpose: prevent broad scraper-operator access from deleting discovery sources directly through the scraper batch API.

Changes in this slice:
- Require `operations` or `admin` scraper access before batch `delete` fetches or deletes scraper sources.
- Preserve broader scraper-operator access for non-destructive batch run/enable/disable requests that flow through workflow guards.
- Add focused route coverage for denied scraper-operator deletes and allowed operations deletes.

Verification:
- `npm run test -- __tests__/api/scraper-batch-route.test.ts __tests__/api/scraper-run-routes.test.ts __tests__/actions/scraper-workflows.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets destructive scraper source deletion authority with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct API routes that mutate discovery, intake, or response workflow state without corresponding authority checks.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Live Import Execution Authority Check

Status: implemented and verified.

Purpose: prevent the direct live import execution API from bypassing the import governance workflow's approval-authority requirement while preserving non-mutating preview sandbox behavior.

Changes in this slice:
- Resolve full user context, including roles, in the import execute route.
- Require `import_approver` authority, or admin authority through the shared helper, before live import mutation.
- Keep sandbox/preview mode available to authenticated tenant users without import approval authority because it does not mutate records.
- Return a generic 403 `Forbidden` response for unauthorized live import execution.
- Extend route coverage for unauthenticated, no-organization, preview-only, unauthorized-live, and authorized-live import execution paths.

Verification:
- `npm run test -- __tests__/api/import-execute-route.test.ts __tests__/api/import-rollback-route.test.ts __tests__/actions/import-governance-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets live import execution authority with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct API routes that mutate governed workflow state without going through the corresponding authority checks.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Direct Import Rollback Authority Check

Status: implemented and verified.

Purpose: prevent the direct import rollback API from bypassing the import governance workflow's approval-authority requirement for destructive rollbacks.

Changes in this slice:
- Resolve full user context, including roles, in the import rollback route.
- Require `import_approver` authority, or admin authority through the shared helper, before calling `rollbackImport`.
- Return a generic 403 `Forbidden` response for unauthorized rollback attempts without exposing required role details.
- Add route coverage for denied and authorized rollback requests.

Verification:
- `npm run test -- __tests__/api/import-rollback-route.test.ts __tests__/actions/import-governance-workflow.test.ts __tests__/api/import-execute-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets direct import rollback authority with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct API routes that mutate governed workflow state without going through the corresponding authority checks.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Scraper Run Authority Denial Responses

Status: implemented and verified.

Purpose: make individual scraper run and cancel API routes return explicit 403 responses when the workflow authority layer denies the operation instead of surfacing authority failures as generic 500 errors.

Changes in this slice:
- Map manual scraper run `WorkflowAuthorityDeniedError` failures to generic 403 `Forbidden` responses.
- Map scraper job cancellation authority denials to generic 403 `Forbidden` responses.
- Add focused route coverage for run and cancel authority denial responses.

Verification:
- `npm run test -- __tests__/api/scraper-run-routes.test.ts __tests__/api/scraper-batch-route.test.ts __tests__/actions/scraper-workflows.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets scraper run/cancel API authority response behavior with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue checking API routes that wrap authority-enforced workflows and currently collapse authorization denials into generic success/error envelopes.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Scraper Batch Authority Denial Response

Status: implemented and verified.

Purpose: make scraper batch operations return an explicit 403 when the workflow authority layer denies a bulk run/enable/disable operation instead of hiding the denial inside a 200 batch result.

Changes in this slice:
- Propagate `WorkflowAuthorityDeniedError` out of per-source scraper batch processing.
- Map scraper batch workflow authority denials to a generic 403 `Forbidden` response.
- Preserve ordinary per-source workflow failures as batch result entries for recoverable operational errors.
- Add route coverage for authority-denied and non-authority scraper batch failures.

Verification:
- `npm run test -- __tests__/api/scraper-batch-route.test.ts __tests__/actions/scraper-workflows.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets scraper batch API authority response behavior with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue checking API routes that wrap authority-enforced workflows and currently collapse authorization denials into generic success/error envelopes.
- Continue closing discovery-to-response workflow gaps.

### 2026-05-26 - Actor-Scoped Opportunity Import Telemetry

Status: implemented and verified.

Purpose: keep opportunity import history and discovery warning telemetry scoped to the actor or service assignee that ran the import instead of mixing import records globally.

Changes in this slice:
- Scope opportunity import history reads to the current opportunity user.
- Persist `importedBy` when spreadsheet, scraper-export, and SearXNG discovery imports create import records.
- Finalize import records only for the same actor that created the import record.
- Pass the scheduled discovery assignee through import creation/finalization so service-run warning telemetry stays attached to that assignee.
- Apply the same owner-scoped import-history contract to the opportunity repository helper.
- Add focused coverage for actor-scoped import history, current-user import record creation, explicit service-run owners, and discovery import record finalization.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/actions/opportunities.test.ts __tests__/actions/import-opportunities-auth.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets opportunity import/discovery telemetry ownership with focused action tests and whitespace validation.

Remaining after this slice:
- Continue scanning opportunity import/export and discovery surfaces for direct tenant-wide reads or writes that should be actor-scoped.
- Continue closing gaps between discovery results, RFP intake, and response-generation workflows.

### 2026-05-26 - Compliance API Authority Denial Responses

Status: implemented and verified.

Purpose: make compliance workflow API routes return explicit 403 responses for server-enforced authority failures instead of generic 500 workflow failures.

Changes in this slice:
- Raise the shared `WorkflowAuthorityDeniedError` from compliance workflow role gates.
- Map compliance matrix workflow authority denials to a generic 403 without leaking required role names.
- Map compliance entry workflow authority denials to a generic 403 without leaking required role names.
- Add focused API coverage for matrix and entry authority denial responses while preserving non-authority failures as workflow errors.

Verification:
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts __tests__/api/compliance-workflow-routes.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets compliance API authority response behavior with focused route/action tests and whitespace validation.

Remaining after this slice:
- Continue adding explicit 403 mapping to any API route that directly exposes hardened workflow server actions.
- Continue closing direct approval/status mutation surfaces outside the final-mile workflow.

### 2026-05-26 - Document Authoring Ready Approval Authority Checks

Status: implemented and verified.

Purpose: prevent the authoring workflow from marking proposal documents approved through `mark_ready` without proposal approval authority.

Changes in this slice:
- Require proposal or capture authority before authoring `mark_ready` can set document/proposal status to approved.
- Require the same authority before authoring `reopen` clears approval fields.
- Require linked requirements to be addressed, compliant, or not applicable before authoring `mark_ready` can approve a proposal document.
- Preserve drafting, persistence, review submission, and AI accept/reject transitions for writer sessions.
- Add focused denial, readiness-blocker, and authorized-ready coverage for the authoring workflow.

Verification:
- `npm run test -- __tests__/actions/document-authoring-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets authoring ready-approval authority with focused workflow tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct approval/status mutation surfaces outside the hardened final-mile workflows.
- Add explicit 403 response mapping for API routes that surface authority-denied workflow errors.

### 2026-05-26 - Proposal Document Direct Approval Authority Checks

Status: implemented and verified.

Purpose: prevent direct proposal document status updates from bypassing finalization approval workflows and marking documents approved/final through assignment scope alone.

Changes in this slice:
- Require proposal approval authority before direct single-document transitions to approved or final status.
- Require proposal approval authority before bulk status transitions to approved or final status.
- Keep drafting and review status updates on the existing assigned-opportunity path.
- Preserve linked-requirement readiness checks for final statuses and add bulk readiness checks before bulk final updates.
- Add focused denial coverage for unauthorized direct and bulk proposal document approval attempts.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/proposal-documents-auth.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets direct proposal document approval authority with focused action tests and whitespace validation.

Remaining after this slice:
- Continue scanning direct approval/status mutation surfaces outside the final-mile workflow.
- Add explicit 403 response mapping for API routes that surface authority-denied workflow errors.

### 2026-05-26 - Compliance Workflow Server Authority Checks

Status: implemented and verified.

Purpose: prevent compliance entry approvals, waivers, bulk approvals, final matrix locks, and privileged reopens from relying on tenant membership alone.

Changes in this slice:
- Enforce compliance/proposal authority roles before entry approval, rejection, waiver, and reopen transitions mutate compliance state.
- Enforce compliance authority before bulk ready-entry approval, and compliance/proposal authority before final matrix lock and privileged matrix reopen transitions.
- Preserve submit-for-review as a tenant-scoped non-approval flow so writers can still advance evidence for review.
- Add focused denial coverage for unauthorized entry approval and final matrix lock attempts.

Verification:
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets compliance workflow authority enforcement with focused workflow tests and whitespace validation.

Remaining after this slice:
- Continue scanning non-workflow approval surfaces such as direct proposal document status updates.
- Surface authorization failures as explicit 403 responses in compliance API routes instead of generic workflow failures.

### 2026-05-26 - Review Waiver Server Authority Checks

Status: implemented and verified.

Purpose: prevent review finding waivers from trusting a client-supplied authority role.

Changes in this slice:
- Enforce the shared server-side authority-role helper before review findings can be waived.
- Preserve waiver runtime metadata while ensuring the claimed authority role belongs to the authenticated session.
- Add focused forged-authority and authorized-waiver coverage for review package transitions.

Verification:
- `npm run test -- __tests__/actions/review-package-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets review waiver authority enforcement with focused workflow tests and whitespace validation.

Remaining after this slice:
- Continue scanning for privileged exception workflows that still accept client-supplied authority metadata.
- Surface authority denial states in review and command-center work items where the UI does not already distinguish authorization failure.

### 2026-05-26 - Import Governance Server Authority Checks

Status: implemented and verified.

Purpose: prevent import execution approval, rollback, and cancellation from trusting a client-supplied import authority role.

Changes in this slice:
- Enforce the shared server-side authority-role helper in import approval, rollback, and cancel transitions.
- Preserve role-aware user context through rollback execution so destructive import compensation remains scoped and auditable.
- Add focused forged-authority coverage for import execution approval.

Verification:
- `npm run test -- __tests__/actions/import-governance-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets import governance authority enforcement with focused workflow tests and whitespace validation.

Remaining after this slice:
- Apply the shared authority helper to review waivers and any remaining privileged exception workflows.
- Surface import governance blockers in the operational inbox where they are not already projected.

### 2026-05-26 - Pricing Approval Server Authority Checks

Status: implemented and verified.

Purpose: prevent cost element approval and final pricing package lock/reopen from trusting a client-supplied pricing authority role.

Changes in this slice:
- Enforce the shared server-side authority-role helper in cost element pricing approval.
- Enforce the shared authority helper in pricing package lock and reopen transitions.
- Preserve existing workflow authority-policy metadata while ensuring it reflects a role the session actually holds.
- Add focused forged-authority coverage for cost element approval and package lock.

Verification:
- `npm run test -- __tests__/actions/pricing-approval-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets pricing authority enforcement with focused workflow tests and whitespace validation.

Remaining after this slice:
- Continue applying the same role-authority helper to import governance, review waivers, and any remaining authorityRole workflow surfaces.
- Connect pricing lock status into final submission readiness and command-center blockers where not already projected.

### 2026-05-26 - Final-Mile Server Authority Checks

Status: implemented and verified.

Purpose: prevent final artifact approval, executive signoff, artifact reopen, submission correction, and submission withdrawal from trusting a client-supplied authority role.

Changes in this slice:
- Add normalized session role capture to `requireUserContext`.
- Add reusable authority-role checks with admin bypass and executive/legal alias handling.
- Enforce server-side authority in final artifact approve, signoff, and reopen transitions.
- Enforce server-side authority in submission correction apply and withdrawal transitions.
- Add focused forged-authority tests for final artifact approval and submission correction.

Verification:
- `npm run test -- __tests__/actions/final-artifact-workflow.test.ts __tests__/actions/submission-correction-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets authority enforcement in final-mile workflows with focused workflow tests and whitespace validation.

Remaining after this slice:
- Continue applying the same role-authority helper to pricing, import governance, review waiver, and other authorityRole workflows.
- Surface authority denial states in inline approval cards and command-center work items.

### 2026-05-26 - Submission Attachments Bind Stored Artifacts

Status: implemented and verified.

Purpose: ensure recorded submissions point to the exact approved final artifact receipt instead of hashing mutable document content at dispatch time.

Changes in this slice:
- Replace submission attachment content hashing with final artifact manifest binding.
- Persist artifact filename, MIME type, size, download URL, Linode E3 storage path, bucket, key, ETag, endpoint, and SHA-256 hash into each submission attachment.
- Fail submission recording if a selected final package document lacks an approved stored final artifact manifest.
- Extend submission attachment types and focused submission workflow tests for stored artifact receipts.

Verification:
- `npm run test -- __tests__/actions/submission-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets submission attachment evidence binding and used the focused submission workflow test plus whitespace validation.

Remaining after this slice:
- Surface stored artifact receipt details in the submission history UI.
- Add audit explorer reconstruction proof from submitted package receipt back to final stored artifacts when the power budget allows.

### 2026-05-26 - Final Artifact Object Storage Receipt

Status: implemented and verified.

Purpose: make production render artifacts durable and auditable before they can satisfy final submission readiness.

Changes in this slice:
- Require Linode E3 object storage before running final artifact renders, avoiding expensive render work when final artifact storage is not configured.
- Upload rendered final artifact bytes to Linode E3 and persist storage path, bucket, key, ETag, endpoint, SHA-256 hash, and download route in artifact metadata.
- Add an authenticated final-artifact download route that reads the stored object, verifies the SHA-256 hash, and enforces owner or assigned-opportunity document access.
- Require final submission checklist artifacts to include an object-storage receipt, not just a hash.
- Preserve storage receipt fields in proposal document summaries.

Verification:
- `npm run test -- __tests__/actions/final-artifact-workflow.test.ts __tests__/actions/final-submission-checklist-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This slice targets final-artifact storage and final-checklist readiness gates with focused tests.

Remaining after this slice:
- Continue wiring the submission concierge to surface the stored final artifact receipt and signed artifact evidence inline.
- Add route-level final artifact download tests and authenticated browser proof when the power budget allows.

### 2026-05-26 - Submission Page Scoped Data Loading

Status: implemented and verified.

Purpose: prevent the submission tracking page from bypassing assigned-opportunity scoping when loading proposal documents and submission history.

Changes in this slice:
- Replace direct submission-page database reads by raw opportunity ID with scoped `getOpportunity`, `getProposalDocuments`, and `getSubmissionsByOpportunity` action calls.
- Preserve the submission client contract while taking proposal document titles and submission records from action-level transformers.
- Mock Next route revalidation in the focused submission scope test so mutation scoping can be verified outside the Next runtime.

Verification:
- Targeted source check found no direct DB/Drizzle reads left in `frontend/app/(app)/opportunities/[id]/submission/page.tsx`.
- `npm run test -- __tests__/actions/submissions-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a focused page data-boundary slice covered by source verification, existing action scoping tests, and whitespace validation.

Remaining after this slice:
- Continue connecting final submission UI to render artifact, signature, approval, and receipt blockers.
- Add broader authenticated submission-page browser proof when the power budget allows.

### 2026-05-26 - Command Center Claim Blocker Projection

Status: implemented and verified.

Purpose: make opportunity command-center readiness expose unresolved high-risk proposal claims before final submission workflows are run.

Changes in this slice:
- Load unresolved high-risk `claimAnalysis` rows directly into the opportunity command-center projection under assigned-opportunity scope.
- Project blocking claims as critical command-center work items with document deep links and evidence/claim ownership.
- Make readiness labels hard-block whenever any blocker exists, even if the numeric score would otherwise be in watch range.
- Add focused command-center coverage for open versus resolved high-risk claims.

Verification:
- `npm run test -- __tests__/actions/work-items-command-center.test.ts __tests__/work-items/projections.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a focused command-center/readiness projection slice covered by affected projection tests and whitespace validation.

Remaining after this slice:
- Continue connecting command-center readiness to other final-gate blockers such as signature, render artifact, and submission receipt state.
- Add authenticated browser proof for the command center when the power budget allows.

### 2026-05-26 - Final Submission Claim Evidence Gate

Status: implemented and verified.

Purpose: prevent final submission readiness from passing while high-risk unsupported proposal claims remain unresolved.

Changes in this slice:
- Add claim-analysis state to the final submission checklist under the same assigned-opportunity scope as documents and compliance matrices.
- Add a required evidence gate that blocks unresolved high-risk claims and points operators to the first blocking claim.
- Map the new evidence checklist category into the existing pre-submission checklist category model.
- Repair the submission workflow test harness so route revalidation is mocked during focused submission tests.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts __tests__/actions/submission-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a focused final-gate/evidence-claim blocker slice covered by the directly affected workflow tests and whitespace validation.

Remaining after this slice:
- Continue auditing evidence matrix coverage and claim remediation handoff into writer tasks.
- Add broader authenticated discovery-to-receipt proof when the power budget allows.

### 2026-05-26 - Final Submission Compliance Gap Gate

Status: implemented and verified.

Purpose: prevent final submission readiness from passing on a locked/approved compliance matrix that still reports unresolved or mandatory compliance gaps.

Changes in this slice:
- Tighten the final submission checklist compliance item to require approval, zero unresolved compliance counts, and 100% mandatory compliance.
- Return explicit blocker messages when a locked matrix still has unresolved gaps or incomplete mandatory compliance.
- Add focused workflow coverage proving a stale final matrix cannot make the opportunity submission-ready.

Verification:
- `npm run test -- __tests__/actions/final-submission-checklist-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a narrow submission readiness gate covered by the affected workflow test file and whitespace validation.

Remaining after this slice:
- Continue auditing final submission and compliance lock workflows for stale matrix counters or waiver-authority gaps.
- Add broader browser proof for discovery-to-receipt once power budget allows.

### 2026-05-26 - RFP Upload Starts Real Parse Jobs

Status: implemented and verified.

Purpose: make browser/API RFP upload actually start the queued parser instead of returning a "Parsing started" success response while leaving the job idle.

Changes in this slice:
- Wire the local/E3-backed RFP upload route to `processRfpParsingJob` after the document and parsing job are persisted.
- Preserve Python fallback behavior for validated uploads when local object storage is absent.
- Add focused route assertions that invalid, unauthorized, out-of-scope, and proxied uploads do not start local parsing.
- Add focused route coverage that E3-backed uploads start the real parser with tenant context.

Verification:
- `npm run test -- __tests__/api/rfp-upload-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a narrow upload-to-parse wiring slice covered by the affected API route tests and whitespace validation.

Remaining after this slice:
- Continue auditing discovery-to-RFP intake so discovered source documents can reach the same E3-backed parser path without manual re-upload.
- Review stale docs that still describe the parse route as simulated.

### 2026-05-26 - Empty RFP Text Extraction Failure Gate

Status: implemented and verified.

Purpose: prevent failed or empty RFP text extraction from flowing into AI parsing and creating unreliable parse, requirements, or compliance state.

Changes in this slice:
- Remove stale simulated-extraction comments from the active RFP parsing job.
- Normalize cached and newly extracted RFP text before parsing.
- Fail the parsing job and document with audit metadata when extraction produces no readable text.
- Add focused workflow coverage that proves blank extraction does not call `parseRFPWithAI`.

Verification:
- `npm run test -- __tests__/actions/rfp-parse-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Typecheck, full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a narrow parser failure-gate slice covered by the affected workflow test file and whitespace validation.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether extraction errors should expose source-specific remediation hints in operator UI.

### 2026-05-26 - Proposal Task Workflow Revalidation

Status: implemented and verified.

Purpose: keep proposal task and opportunity workflow views fresh after task creation, updates, deletion, compliance-task generation, assignment, and escalation.

Changes in this slice:
- Replace task-management revalidation of the literal `/opportunities/[id]/tasks` route token with real route invalidation.
- Revalidate `/tasks`, the affected opportunity overview, and the affected opportunity requirements page after task mutations that know the opportunity ID.
- Keep bulk assignment revalidation on the global task list while each successful `updateTask` call refreshes its own opportunity workflow paths.
- Add focused assertions that task creation/update/delete refresh real paths and do not call the stale dynamic-route token.

Verification:
- `npm run test -- __tests__/actions/task-management-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit` from `frontend/` passed.
- `git diff --check` passed.
- Targeted search found no stale `revalidatePath("/opportunities/[id]/tasks", "page")` calls in task management.

Testing scope note:
- Full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a proposal task workflow invalidation slice covered by focused action tests and TypeScript.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether opportunity overview pages should expose richer task summary freshness now that server invalidation reaches them.

### 2026-05-26 - Structure Document Creation Without Fake Content

Status: implemented and verified.

Purpose: prevent AI-generated document outlines from becoming draft documents that contain invented placeholder section text.

Changes in this slice:
- Replace generated structure placeholder paragraphs like `(medium content for technical approach)` with editable blank paragraphs.
- Make the unused `autoFill` option fail explicitly instead of silently creating placeholder-filled documents.
- Update the structure creation description so it no longer claims inline AI content filling.
- Add focused tests for unauthorized owner spoofing, explicit auto-fill rejection, and blank outline content.

Verification:
- `npm run test -- __tests__/actions/document-generation-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit` from `frontend/` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a narrow response-generation honesty fix covered by focused action tests and TypeScript.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Wire any future structure auto-fill path to real section generation instead of reintroducing template placeholder prose.

### 2026-05-26 - Service Fallback Honesty Wording

Status: implemented and verified.

Purpose: keep service diagnostics aligned with the current behavior after discovery and intelligence wrappers were changed from placeholder responses to live fallback or honest unavailable states.

Changes in this slice:
- Replace stale discovery-service logging that said missing discovery modules would return stubs.
- Replace stale intelligence-service logging that said missing intelligence modules would return stubs.
- Reword the intelligence wrapper comment for `OpportunityData` from "minimal stub" to "minimal typed reference".

Verification:
- `uv run python -m py_compile src/docfusion/services/discovery_service.py src/docfusion/services/intelligence_service.py` passed.
- `git diff --check` passed.
- Targeted search found no stale `service will return stubs`, `minimal stub`, `not_implemented`, or `placeholder` wording in the two service wrappers.

Testing scope note:
- Broader Python tests remain intentionally skipped while on battery. This was a diagnostics/comment honesty slice with no behavior change.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Prefer service responses that expose real fallback data or explicit unavailable states over any new placeholder wording or success claims.

### 2026-05-26 - Requirement Workflow Refresh Integrity

Status: implemented and verified.

Purpose: keep requirement edits, extraction, acceptance workflow changes, and response-package creation synchronized with authoritative requirement statistics and compliance matrix state.

Changes in this slice:
- Add route revalidation to requirement create, bulk create, update, bulk update, assignment, workflow transition, and delete actions.
- Extend proposal-package revalidation to include the opportunity requirements page.
- Replace simplified requirements-page stats updates with server-backed requirements, statistics, and compliance-matrix refreshes.
- Sync the requirements table's internal row state when refreshed parent data arrives.
- Remove the local compliance matrix projection used after response-package creation and refresh the real matrix list instead.

Verification:
- `npx tsc --noEmit` from `frontend/` passed.
- `git diff --check` passed.
- Targeted search found no simplified requirements refresh placeholder or full-page reload in the touched requirements surfaces.

Testing scope note:
- Full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a requirements workflow refresh integrity slice verified with TypeScript, whitespace validation, and targeted source search.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review remaining non-opportunity placeholder/simplified paths separately unless they directly block response production.

### 2026-05-26 - Opportunity Workflow Refresh Integrity

Status: implemented and verified.

Purpose: keep proposal-document, RFP-document, and submission workflow screens synchronized with authoritative server state without full browser reloads or partial client-side progress guesses.

Changes in this slice:
- Add route revalidation to proposal-document mutations for opportunity overview, proposal documents, and submission pages.
- Add route revalidation to submission status, submission recording, and outcome recording actions.
- Replace opportunity document discovery full-page reloads with App Router refreshes and server-backed document refreshes.
- Replace submission completion reload with local submission insertion plus App Router refresh.
- Replace proposal-document progress recalculation with server-backed document and progress refreshes.
- Remove a dead header-level discovery handler that still contained a full browser reload.

Verification:
- `npx tsc --noEmit` from `frontend/` passed.
- `git diff --check` passed.
- Targeted search found no `window.location.reload()` or simplified progress placeholder in the touched opportunity workflow surfaces.

Testing scope note:
- Full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a client/server refresh integrity slice verified with TypeScript, whitespace validation, and targeted source search.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review remaining non-opportunity reloads in CRM/document error surfaces separately if they affect response workflows.

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

### 2026-05-26 - Persistent Discovery Warning History

Status: implemented and verified.

Purpose: preserve discovery enrichment warning telemetry after the run dialog closes so operators can audit degraded Firecrawl/browser fallback runs from import history.

Changes in this slice:
- Add non-blocking import audit warnings to opportunity import config metadata.
- Persist SearXNG discovery warnings when finalizing the import record.
- Show warning counts and the first warning message in Recent Imports without counting them as failed rows.
- Add focused assertions that browser fallback usage and Firecrawl/browser fallback degradation are stored in the import record.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, component tests, browser checks, and production build remain intentionally skipped while on battery. This slice used focused discovery import coverage, TypeScript checking, and whitespace validation.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether import history needs a detail drawer for full warning/error inspection beyond the first warning line.

### 2026-05-26 - Final Package Attachment Guard

Status: implemented and verified.

Purpose: prevent a recorded submission from passing final readiness gates while omitting required final-package documents from the selected attachments.

Changes in this slice:
- Add a server-side submission guard that compares selected attachment IDs against required final-package document IDs from the final checklist.
- Reject submission recording when an operator deselects a required final document after the checklist has passed.
- Add focused regression coverage for the missing-required-attachment path.

Verification:
- `npm run test -- __tests__/actions/submission-workflow.test.ts` passed.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

Testing scope note:
- Full frontend suite, browser checks, and production build remain intentionally skipped while on battery. This was a narrow server-side gate change covered by focused submission workflow coverage and TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review simplified client-side state refreshes on proposal documents and submission pages so workflow projections refresh without full-page reloads.

### 2026-05-26 - Python Discovery Service SearXNG Fallback

Status: implemented and verified.

Purpose: make the Python discovery service contract perform real search-backed discovery instead of returning empty or `not_implemented` placeholders while the frontend discovery path is live.

Changes in this slice:
- Add a SearXNG JSON-search fallback to `DefaultDiscoveryService`, defaulting to `https://search.lindela.io`.
- Normalize opportunity-like search results into cached discovery records for later details lookup.
- Route discovery analysis and qualification through cached opportunity data when analyzers are available.
- Return honest `unavailable` details when analysis is requested for an uncached opportunity instead of returning `status: not_implemented`.
- Expose SearXNG through `list_sources`.
- Add focused service-contract coverage without importing heavier agent modules.

Verification:
- `uv run pytest tests/ci/test_discovery_service_contract.py -q` passed.
- `uv run python -m py_compile src/docfusion/services/discovery_service.py tests/ci/test_discovery_service_contract.py` passed.
- `git diff --check` passed.

Testing scope note:
- Full Python suite and live network checks remain intentionally skipped while on battery. The new test uses a mocked `httpx.AsyncClient` to verify request shape, result normalization, cache use, and honest unavailable states.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Consider whether the Python intelligence service should consume this cache or database-backed opportunity details before replacing its remaining `not_implemented` placeholders.

### 2026-05-26 - Python Intelligence Service Contract Wiring

Status: implemented and verified.

Purpose: remove intelligence service `not_implemented` placeholders from competitive, strategic, and content recommendation methods while preserving honest unavailable states when required data or optional ML modules are absent.

Changes in this slice:
- Add an opportunity-details cache path and discovery-service lookup for intelligence wrapper methods.
- Route competitive assessment through cached opportunity data when a competitive analyzer is available.
- Route strategic recommendations through a real opportunity context when a strategy recommender is available.
- Route content recommendations through the content recommender when section text and optional section models are available.
- Return `status: unavailable` instead of placeholder success for missing details, missing recommenders, empty section text, or unavailable optional model imports.
- Add focused service-contract coverage using fakes to avoid importing heavier ML dependencies.

Verification:
- `uv run pytest tests/ci/test_intelligence_service_contract.py -q` passed.
- `uv run python -m py_compile src/docfusion/services/intelligence_service.py tests/ci/test_intelligence_service_contract.py` passed.
- `git diff --check` passed.

Testing scope note:
- Full Python suite and live intelligence integrations remain intentionally skipped while on battery. This slice verifies the wrapper contract without loading optional heavy ML modules such as `joblib`.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Review whether API endpoints or agents should share persisted frontend opportunity records with these Python service caches.

### 2026-05-26 - Bulk Compliance Entry Approval

Status: implemented and verified.

Purpose: make final compliance matrix lock operational at large RFP scale by avoiding one-by-one approval for generated compliant entries that already have response evidence.

Changes in this slice:
- Add a `approve_ready_entries` compliance matrix workflow action.
- Bulk-approve compliant/addressed entries that have response evidence, update linked requirement compliance, recalculate matrix statistics, and record runtime evidence.
- Expose the action through the existing compliance matrix workflow API and Matrix Review menu.
- Block the bulk action after a matrix is locked and report when no ready entries exist.
- Add focused workflow coverage for bulk approval behavior and runtime evidence.

Verification:
- `npm run test -- __tests__/actions/compliance-entry-workflow.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite, component tests, and production build remain intentionally skipped while on battery. This slice used the focused compliance workflow test plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Check opportunity discovery/intake for current SearXNG and Firecrawl configuration drift.

### 2026-05-26 - SearXNG Health Probe Fallback

Status: implemented and verified.

Purpose: keep discovery health checks aligned with the live Lindela SearXNG deployment, where `/health` is unavailable but JSON search is operational.

Changes in this slice:
- Normalize the configured SearXNG base URL before building request paths.
- Keep `/health` as the first health probe when deployments expose it.
- Fall back to a lightweight `search?q=rfp&format=json` probe when `/health` is unavailable.
- Add config coverage for the fallback behavior.

Verification:
- Live probe: `https://search.lindela.io/health` returned `404`.
- Live probe: `https://search.lindela.io/search?q=rfp&format=json` returned `200`.
- `npm run test -- __tests__/services/searxng-client-config.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This was a narrow discovery health-check fix covered by service config tests, TypeScript checking, and live service probes.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Check Firecrawl scrape health and discovery run telemetry for similarly misleading readiness signals.

### 2026-05-26 - Firecrawl Environment Alias Hardening

Status: implemented and verified.

Purpose: prevent discovery enrichment from silently losing Firecrawl when operators follow older runbook wording.

Changes in this slice:
- Keep `FIRECRAWL_URL` as the canonical frontend Firecrawl environment variable.
- Accept legacy `FIRECRAWL_API_URL` when `FIRECRAWL_URL` is absent.
- Update the opportunity discovery runbook to document `FIRECRAWL_URL`.
- Add Firecrawl client configuration coverage for default host, canonical override, and legacy alias fallback.

Verification:
- Live probe: `http://84.247.181.100:3002/v1/scrape` successfully scraped `https://example.com` and returned `200`.
- `npm run test -- __tests__/services/firecrawl-client-config.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite and production build remain intentionally skipped while on battery. This was a narrow Firecrawl configuration fix covered by service config tests, TypeScript checking, and a live scrape probe.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Check discovery run telemetry and UI surfacing for partial SearXNG/Firecrawl failures.

### 2026-05-26 - Discovery Partial Failure Telemetry

Status: implemented and verified.

Purpose: make live discovery runs operationally honest by surfacing enrichment warnings and failed records instead of showing only aggregate created/updated counts.

Changes in this slice:
- Add `warnings` to discovery import results for Firecrawl failures, browser fallback failures, and browser fallback recoveries.
- Preserve imports when search metadata is sufficient while reporting enrichment degradation separately from hard row failures.
- Surface discovery warnings and failed record details in the live discovery dialog.
- Update the discovery action return type so callers can consume the warning telemetry.
- Add focused coverage for browser fallback recovery warnings and Firecrawl/browser fallback failure warnings.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts` passed.
- `npx tsc --noEmit` passed.

Testing scope note:
- Full frontend suite, component tests, and production build remain intentionally skipped while on battery. This slice used focused discovery import coverage plus TypeScript checking.

Remaining after this slice:
- Continue auditing the opportunity-to-winning-response workflow against the JTBD catalogue.
- Improve discovery run/import history so warning telemetry remains visible after the dialog closes.

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
