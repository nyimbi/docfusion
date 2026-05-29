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

### 2026-05-29 - Add Zambia ZPPA Current Tender Collection

Status: implemented, focused-test verified, typechecked, live-proved, and live-imported.

Purpose: expand national-procurement collection with Zambia ZPPA's public e-GP current tenders, a high-volume source that returned 4,770 current tender rows from this environment.

Changes in this slice:
- Added a Zambia ZPPA parser for `eprocure.zppa.org.zm/epps/quickSearchAction.do?searchSelect=6`, extracting title, resource ID, procuring entity, submission deadline, procedure, status, portal URL, and notice PDF URL.
- Added bounded direct pagination with `ZPPA_MAX_PAGES`, defaulting to 3 pages and capped at 10, so scheduled collection can pull beyond the first page without overloading the source or database.
- Routed ZPPA through the direct source-parser path and added it to the broad default configured-source list plus targeted Zambia search query.
- Added ZPPA support to the live source-discovery proof script.

Verification:
- `npx --cache /private/tmp/docfusion-npm-cache vitest run __tests__/scrapers/zppa-zambia-parser.test.ts __tests__/scrapers/ghaneps-parser.test.ts __tests__/services/default-discovery-sources.test.ts __tests__/actions/discovery-opportunity-import.test.ts` passed with 52 tests.
- `npx --cache /private/tmp/docfusion-npm-cache tsc --noEmit --pretty false` passed.
- Live source proof `live_zppa_zambia_source_20260529T2304` parsed 30 ZPPA opportunities via `source_api` across the configured page window.
- Live DB import `live_zppa_zambia_import_20260529T2304` processed 30 Zambia ZPPA candidates, imported 30, failed 0, emitted 0 warnings, created 30 source-document rows, and marked the source healthy with downloads disabled.
- Post-run live database snapshot: 3,684 total opportunities, 1,768 RFP-typed opportunities, 30 ZPPA opportunities, 30 GHANEPS opportunities, and 48 Rwanda UMUCYO opportunities.

Remaining after this slice:
- Increase `ZPPA_MAX_PAGES` for scheduled runs if operators want deeper ZPPA coverage beyond the default bounded first 30 records.
- Continue adding source-specific national portals that expose stable public current-tender tables or APIs.

### 2026-05-29 - Add Ghana GHANEPS Current Tender Collection

Status: implemented, focused-test verified, typechecked, live-proved, and live-imported.

Purpose: expand national-procurement collection with Ghana GHANEPS current tenders, a public portal that returned 81 current tenders from this environment and exposes notice PDF links in the list table.

Changes in this slice:
- Added a Ghana GHANEPS parser for `quickSearchAction.do?searchSelect=6`, extracting title, resource ID, procuring entity, submission deadline, procedure, status, publication date, portal URL, and notice PDF URL.
- Added bounded direct pagination with `GHANEPS_MAX_PAGES`, defaulting to 3 pages and capped at 10, so the source can collect more than the first visible page without generic scraping.
- Routed GHANEPS through the direct source-parser path and added it to the broad default configured-source list plus targeted Ghana search query.
- Added GHANEPS support to the live source-discovery proof script.

Verification:
- `npx --cache /private/tmp/docfusion-npm-cache vitest run __tests__/scrapers/ghaneps-parser.test.ts __tests__/scrapers/umucyo-rwanda-parser.test.ts __tests__/services/default-discovery-sources.test.ts __tests__/actions/discovery-opportunity-import.test.ts` passed with 52 tests.
- `npx --cache /private/tmp/docfusion-npm-cache tsc --noEmit --pretty false` passed.
- Live source proof `live_ghaneps_source_20260529T2257` parsed 30 GHANEPS opportunities via `source_api` across the configured page window.
- Live DB import `live_ghaneps_import_20260529T2257` processed 30 Ghana GHANEPS candidates, imported 30, failed 0, emitted 0 warnings, created 30 source-document rows, and marked the source healthy with downloads disabled.
- Post-run live database snapshot: 3,654 total opportunities, 1,765 RFP-typed opportunities, 30 GHANEPS opportunities, and 48 Rwanda UMUCYO opportunities.

Remaining after this slice:
- Increase `GHANEPS_MAX_PAGES` for scheduled runs if operators want all currently advertised GHANEPS pages instead of the default bounded first 30 records.
- Continue adding source-specific national portals that expose stable public current-tender tables or APIs.

### 2026-05-29 - Add Rwanda UMUCYO Advertising Collection

Status: implemented, focused-test verified, typechecked, live-proved, and live-imported.

Purpose: expand broad RFP collection with Rwanda's public UMUCYO e-procurement advertising list, which is reachable from this environment and currently publishes dozens of active tender rows.

Changes in this slice:
- Added a Rwanda UMUCYO advertising parser for `selectListAdvertisingListForGU.do`, extracting tender title, tender number, status, advertising date, submission deadline, opening date, method, type, stage, procuring-entity shorthand, and stable source identity.
- Routed UMUCYO through the direct source-parser path so collection does not depend on generic search, Firecrawl, or browser rendering for this source.
- Added UMUCYO to the broad default configured-source list and added a targeted Rwanda default search query.
- Added UMUCYO support to the live source-discovery proof script.

Verification:
- `npx --cache /private/tmp/docfusion-npm-cache vitest run __tests__/scrapers/umucyo-rwanda-parser.test.ts __tests__/services/default-discovery-sources.test.ts __tests__/actions/discovery-opportunity-import.test.ts` passed with 50 tests.
- `npx --cache /private/tmp/docfusion-npm-cache tsc --noEmit --pretty false` passed.
- Live source proof `live_umucyo_rwanda_source_20260529T2250` parsed 48 UMUCYO opportunities via `source_api` with no Firecrawl/browser fallback.
- Live DB import `live_umucyo_rwanda_import_20260529T2252` processed 48 Rwanda UMUCYO candidates, imported 48, failed 0, emitted 0 warnings, created 48 source-document rows, and marked the source healthy with downloads disabled.
- Post-run live database snapshot: 3,624 total opportunities, 1,765 RFP-typed opportunities, and 48 Rwanda UMUCYO opportunities.

Remaining after this slice:
- Continue adding direct parsers for reachable national procurement portals with current public tender tables or APIs; these materially improve breadth more than generic retry tuning.

### 2026-05-29 - Retry Discovery Import Persistence After Broad Collection

Status: implemented, focused-test verified, typechecked, and live-failure characterized.

Purpose: avoid discarding expensive broad RFP discovery work when candidate collection succeeds but transient Postgres connectivity fails at import-record creation or completion update time.

Changes in this slice:
- Added bounded retry around discovery import-record creation and completion update persistence calls.
- Limited retry behavior to transient connection-style database failures such as `ECONNREFUSED`, reset/timeout, server-closed connection, startup, too-many-connections, and related Postgres transient connection codes.
- Added environment controls for retry attempts and delay so live operators can tune the persistence cushion without changing source collection behavior.
- Added regression coverage proving candidate discovery proceeds after a transient import-record creation failure and completion status can recover after a transient update failure.

Verification:
- `npx --cache /private/tmp/docfusion-npm-cache vitest run __tests__/actions/discovery-opportunity-import.test.ts` passed with 46 tests.
- `npx --cache /private/tmp/docfusion-npm-cache vitest run __tests__/services/searxng-client-config.test.ts` passed with 19 tests, including searx.space fallback fan-out coverage.
- `uv run pytest tests/ci/test_searxng_client_fallback.py tests/ci/test_discovery_service_contract.py -q` passed with 13 tests.
- `npx --cache /private/tmp/docfusion-npm-cache tsc --noEmit --pretty false` passed.
- Live broad source-only retry produced 118 candidates, then exhausted the new database retry window because Postgres continued returning `ECONNREFUSED`; the retry protects transient blips but cannot overcome sustained database unreachability.
- Forced-primary-failure live SearXNG probe with `SEARXNG_URL=http://127.0.0.1:9` discovered public fallback candidates from `https://searx.space/data/instances.json`, attempted two public SearXNG instances, and recovered 10 procurement-oriented results through direct DuckDuckGo HTML after the public instances returned 403/429.

Remaining after this slice:
- Check or stabilize db.lindela.io/Postgres reachability for long broad discovery runs; the importer now retries transient persistence failures, but reliable broad collection still needs the database reachable when writing the import record.
- Keep `search.lindela.io` as the primary search path and use searx.space public fan-out as best-effort resilience; public instances are useful for breadth but are often rate-limited against server-side search traffic.

### 2026-05-29 - Replace South Africa eTenders Scrape With OCDS API

Status: implemented, focused-test verified, typechecked, and live-imported.

Purpose: increase reliable RFP collection breadth by replacing generic South Africa eTenders page scraping with the official eTenders OCDS public releases API.

Changes in this slice:
- Added a South Africa eTenders OCDS parser that queries `https://ocds-api.etenders.gov.za/api/OCDSReleases` with a rolling date window, extracts active releases, deadlines, procuring entities, procurement method details, direct document/download URLs, briefing details, and contact metadata.
- Routed the eTenders OCDS endpoint through the configured-source source-API path so collection no longer depends on Firecrawl or browser scraping for this high-volume national portal.
- Replaced the default configured source `https://www.etenders.gov.za/Home/opportunities?id=1` with `https://ocds-api.etenders.gov.za/api/OCDSReleases`.
- Updated the default eTenders search query to target the OCDS API host.

Verification:
- `npx --cache /private/tmp/docfusion-npm-cache vitest run __tests__/scrapers/etenders-sa-parser.test.ts __tests__/services/default-discovery-sources.test.ts __tests__/actions/discovery-opportunity-import.test.ts __tests__/api/opportunity-discovery-route.test.ts` passed with 55 tests.
- `npx --cache /private/tmp/docfusion-npm-cache tsc --noEmit --pretty false` passed.
- Live source import `live_etenders_sa_ocds_import_20260529T1922` processed 25 South Africa eTenders candidates, imported 25, failed 0, emitted 0 warnings, created 25 source-document rows, and marked the source healthy with downloads disabled.
- Post-run live database snapshot: 3,576 total opportunities, 1,757 RFP-typed opportunities, and 25 South Africa eTenders opportunities.

Remaining after this slice:
- Continue adding or replacing source-specific collection with proven public APIs for high-yield procurement portals instead of relying on generic scraping where structured feeds exist.

### 2026-05-29 - Fan Out SearXNG On Default-Engine Degradation

Status: implemented, focused-test verified, typechecked, and live-probed.

Purpose: ensure broad RFP search does not silently accept partial `search.lindela.io` coverage when a SearXNG query relies on default engines instead of passing an explicit `engines` list.

Changes in this slice:
- Tightened the TypeScript SearXNG client so any primary response with results plus `unresponsive_engines` now triggers configured/public fallback fan-out, including default-engine searches with no explicit engine filter.
- Applied the same rule to the Python infrastructure SearXNG client.
- Documented the default-engine degraded-fanout behavior in the opportunity discovery runbook.
- Added TypeScript and Python regression coverage proving a default-engine primary result set with a degraded Google engine queries `https://searx.space/data/instances.json`, calls a healthy fallback instance, and merges primary plus fallback RFP results.

Verification:
- `npx --cache /private/tmp/docfusion-npm-cache vitest run __tests__/services/searxng-client-config.test.ts` passed with 19 tests.
- `uv run pytest tests/ci/test_searxng_client_fallback.py tests/ci/test_discovery_service_contract.py -q` passed with 13 tests.
- `npx --cache /private/tmp/docfusion-npm-cache tsc --noEmit --pretty false` passed.
- Forced-primary-failure live probe with `SEARXNG_URL=http://127.0.0.1:9` and `SEARXNG_PUBLIC_FALLBACK_LIMIT=4` reached four public `searx.space` fallback instances. All four public instances rejected the server-side request with 429, and the frontend client recovered 4 RFP-oriented results through direct DuckDuckGo HTML fallback.

Remaining after this slice:
- Public `searx.space` fallback fan-out is active but still rate-limited; reliable multi-engine breadth still requires keeping `search.lindela.io` healthy and adding a trusted `SEARXNG_FALLBACK_URLS` pool when available.

### 2026-05-29 - Reprove Live Opportunity To Response Readiness After Source Repairs

Status: live-proof verified.

Purpose: verify that the now-healthier opportunity collection path still carries through to usable response package creation.

Verification:
- `npm run platform:proof -- --include-live-safe --run live-opportunity-response-readiness` passed with run `live_response_readiness_20260529T190348Z`.
- The proof selected live UNGM opportunity `Enterprise (Occupational Health, Safety and Electronic Medical Records) Management Software` from UN Secretariat with source ID `296162` and deadline `2026-05-31`.
- The source PDF downloaded successfully, extracted 11,039 characters using local `pdftotext` (`doclingStatus: local_pdftotext`), and did not require Docling fallback.
- The response-readiness pipeline generated all six expected response draft types, produced 6,604 total draft words, matched 85 Datacraft evidence snippets, created 3 win-theme seeds, covered 12 source requirement signals, and returned `ready_for_review` with no blockers.

Remaining after this slice:
- Keep expanding source breadth and document intake, but the live path from found opportunity to review-ready draft package is currently functioning.

### 2026-05-29 - Confirm Broad Source Health And Replace Uganda Scrape With GPP API

Status: implemented, focused-test verified, typechecked, and live-imported.

Purpose: keep the broad default source profile focused on productive RFP sources after proving the SearXNG/searx.space fallback and source-specific repairs in one run.

Changes in this slice:
- Removed the duplicate World Bank tenders default URL from the broad source profile because it returns the same source-API opportunity set as the World Bank projects procurement URL and was marked `not_run` after the first World Bank source consumed those identities.
- Removed the currently empty UNICEF umbrella tender-calendars URL from the broad source profile while keeping the productive UNICEF service-contract calendar source and explicit UNICEF tender-calendar parser support.
- Replaced the blocked `egpuganda.go.ug/bid-notices` scrape default with Uganda PPDA GPP's public bid-invitations API at `https://cdn.ppda.go.ug/api/bid-invitations`.
- Added Uganda GPP API parsing for active bid invitations, including procuring entity, reference, method, procurement type, deadline, budget, funding source, OCDS ID, and public GPP detail URLs.

Verification:
- Broad live discovery import `live_broad_source_health_refresh_20260529T1330` processed 400 candidates, imported 43 new opportunities, updated 357, failed 0, created 39 source-document rows, and reused 297 existing source-document rows with downloads disabled.
- The broad run marked 28 configured sources healthy. The only non-healthy entries were the duplicate World Bank tenders URL marked `not_run` and the currently empty UNICEF umbrella tender-calendars page.
- Public SearXNG fallback fanout still encountered public-instance 403/418/429 responses during the run, but the client continued with source scraping and direct DuckDuckGo fallback where applicable; no import rows failed.
- `npx vitest run __tests__/scrapers/egp-uganda-parser.test.ts __tests__/services/default-discovery-sources.test.ts __tests__/api/opportunity-discovery-route.test.ts __tests__/actions/discovery-opportunity-import.test.ts` passed with 54 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live Uganda GPP API import `live_uganda_gpp_api_import_20260529T1355` processed 3 active Uganda candidates, imported 3, failed 0, emitted 0 warnings, and marked the source healthy.
- Pruned source-only health run `live_pruned_default_source_health_20260529T1356` processed 379 candidates from 28 configured sources, imported 2, updated 377, failed 0, emitted 0 warnings, created 2 source-document rows, reused 337 existing source-document rows, and marked every configured source healthy.
- Post-run live database snapshot: 3,551 total opportunities and 1,754 RFP-typed opportunities.

Remaining after this slice:
- Continue improving response-readiness and document intake, using lightweight text extraction before Docling for documents where direct text extraction works.

### 2026-05-29 - Recover Full UNICEF Service-Contracts Calendar Collection

Status: implemented, focused-test verified, typechecked, and live-imported.

Purpose: fix the last empty configured source from the broad refresh without losing UNICEF service-contract coverage.

Changes in this slice:
- Inspected the live UNICEF service-contracts page and confirmed it still publishes 9 tender-calendar rows, now in an HTML table shape rather than the markdown table shape the parser originally handled.
- Added UNICEF service-contract HTML table parsing for the current `Description of tender` / estimated duration / bidding exercise table.
- Fixed configured-source identity for same-page source rows so multiple opportunities with distinct source IDs are not collapsed when they share the same portal URL and have no direct document URL.

Verification:
- `npx vitest run __tests__/scrapers/unicef-parser.test.ts __tests__/actions/discovery-opportunity-import.test.ts` passed with 46 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live DB import `live_unicef_service_contracts_full_import_20260529T1327` passed with downloads disabled; it processed 9 UNICEF service-contract candidates, imported 8 new opportunities, updated 1, failed 0, emitted 0 warnings, and marked the source healthy.
- Post-run live database snapshot: 3,467 total opportunities, 1,748 RFP-typed opportunities, and 18 UNICEF opportunities.

Remaining after this slice:
- Rerun the broad default source-health profile when practical to verify every configured source is healthy in one run after the World Bank and UNICEF repairs.
- Continue improving response-readiness and document intake now that broad opportunity collection is materially healthier.

### 2026-05-29 - Add World Bank Notice API Fallback After Broad Health Refresh

Status: implemented, focused-test verified, typechecked, live-imported, and broad-health informed.

Purpose: keep World Bank configured-source collection healthy when the primary faceted `api/v2/procnotices` query returns a transient or parameter-sensitive HTTP 500.

Changes in this slice:
- Ran broad default discovery health refresh `live_broad_source_health_refresh_20260529T1310` after the AFDB/USAID/AIIB/CDB source fixes.
- Added a lean World Bank notice-list API fallback that removes the heavy facet/filter/sort parameters while preserving current notice parsing and award filtering.
- Preserved the primary richer API query as the first path; the lean query is used only after the primary path fails.

Verification:
- Broad refresh `live_broad_source_health_refresh_20260529T1310` processed 366 candidates across the default profile, imported 103, updated 263, failed 0, and created 91 source-document rows with downloads disabled.
- In that broad refresh, AFDB was healthy with 5 candidates, SAM.gov USAID was healthy with 5, AIIB was healthy with 33, CDB was healthy with 13, and the only configured-source health gaps were World Bank projects API 500 and the redundant UNICEF service-contracts page parsing empty while UNICEF tender calendars stayed healthy.
- `npx vitest run __tests__/scrapers/world-bank-parser.test.ts __tests__/actions/discovery-opportunity-import.test.ts` passed with 49 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live DB import `live_world_bank_api_fallback_import_20260529T1321` passed with downloads disabled; it processed 10 World Bank candidates, updated 10, failed 0, emitted 0 warnings, reused 10 source-document rows, and marked the World Bank projects source healthy.
- Post-run live database snapshot: 3,459 total opportunities, 1,748 RFP-typed opportunities, and 53 World Bank opportunities.

Remaining after this slice:
- Remove or repair the now-redundant UNICEF service-contracts default source, since `https://www.unicef.org/supply/tender-calendars` remains healthy and broader.
- Continue reducing SearXNG broad-query warnings by relying on curated source APIs for high-value procurement portals and adding trusted fallback search instances when available.

### 2026-05-29 - Recover AFDB Default Collection With Search-Document Fallback

Status: implemented, focused-test verified, typechecked, live-imported, and pushed through the normal configured-source importer.

Purpose: make AFDB default source collection productive even when the official AFDB procurement listing returns bot-protection or otherwise empty content to Firecrawl/browser scraping.

Changes in this slice:
- Added an AFDB-specific configured-source fallback that searches SearXNG for AFDB-funded procurement documents when the official AFDB listing scrape fails or parses empty.
- The fallback filters for direct PDF/DOC procurement documents, excludes AFDB-hosted protected listing/manual/policy URLs, verifies candidate documents with a ranged public HTTP probe, and imports verified results as AFDB source candidates.
- Preserved the existing AFDB listing parser and detail-page enrichment for cases where the official listing is scrapeable.

Verification:
- `npx vitest run __tests__/actions/discovery-opportunity-import.test.ts` passed with 43 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live DB import `live_afdb_search_fallback_import_20260529T1304` passed through the normal configured-source importer with downloads disabled; it processed 5 AFDB candidates, imported 5 new opportunities, failed 0, emitted 0 warnings, created 5 source-document rows, and marked the AFDB source healthy.
- During the live run, `search.lindela.io` reported degraded SearXNG engine fanout for some AFDB fallback queries and the client recovered extra results through direct DuckDuckGo HTML fallback.
- Post-run live database snapshot: 3,356 total opportunities, 1,735 RFP-typed opportunities, and 11 AFDB opportunities.

Remaining after this slice:
- Run another broad default source-health refresh to confirm AFDB and USAID no longer appear as unhealthy default configured sources.
- Keep improving source-specific collection for any remaining empty or low-yield configured sources instead of adding more generic scrape retries.

### 2026-05-29 - Remove Dead USAID Business Forecast From Default Collection

Status: implemented, focused-test verified, typechecked, live-proved, and live-imported.

Purpose: stop spending broad source-scrape budget on USAID Business Forecast pages that now return HTTP 404, while preserving USAID-related procurement coverage through the live SAM.gov source API.

Changes in this slice:
- Removed `https://www.usaid.gov/business-forecast` from the default configured-source list.
- Replaced the dead `site:usaid.gov "Request for Proposal" Africa` default query with `site:sam.gov USAID "response date"`.
- Kept the source-specific `https://sam.gov/search/?index=opp&keywords=USAID` configured source as the reliable USAID-related procurement path.

Verification:
- Live checks against `https://www.usaid.gov/business-forecast` and `https://www.usaid.gov/business-forecast/search` both returned HTTP 404 from this environment.
- `npx vitest run __tests__/services/default-discovery-sources.test.ts` passed with 2 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live source proof `live_sam_gov_usaid_recheck_20260529T125609Z` passed through the SAM.gov source API path and returned 5 USAID-related opportunities.
- Live DB import `live_sam_gov_usaid_recheck_import_20260529T1257` passed with downloads disabled; it processed 5 candidates, updated 5, failed 0, emitted 0 warnings, reused 5 source-document rows, and marked the SAM.gov USAID source healthy.

Remaining after this slice:
- If USAID publishes a replacement public forecast feed later, add it only after proving the URL returns current opportunities.
- AFDB remains the main default configured-source health gap because the official listing currently returns site-protection/empty content to our scrapers.

### 2026-05-29 - Stabilize AIIB Direct Feed Collection After Broad Health Refresh

Status: implemented, focused-test verified, typechecked, live-proved, and live-imported.

Purpose: remove a fragile AIIB listing-page network dependency after broad source health showed a transient AIIB `fetch failed` even though AIIB's official project-procurement data script was reachable and current.

Changes in this slice:
- Changed the AIIB parser to fetch the official `ppo-data-all.js` project-procurement feed directly before falling back to listing-page script discovery.
- Preserved listing-page discovery as a fallback if AIIB changes the data-script URL later.
- Updated the configured-source import regression to prove AIIB imports no longer require fetching the rendered listing page first.

Verification:
- Broad live source-health refresh `live_broad_source_health_refresh_20260529T1244` processed 128 candidates across the default profile, imported 28, updated 100, failed 0, and created 21 source-document rows with downloads disabled.
- The same broad refresh showed the remaining weak configured sources clearly: AIIB transient `fetch failed`, AFDB empty behind site protection, USAID business forecast empty/404, and one World Bank tender source not run under the source cap.
- `npx vitest run __tests__/actions/discovery-opportunity-import.test.ts` passed with 42 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live source proof `live_aiib_direct_feed_probe_20260529T125220Z` passed through the source API path and returned 33 current AIIB project procurement opportunities.
- Live DB import `live_aiib_direct_feed_import_20260529T1253` passed with downloads disabled; it processed 10 candidates, imported 1 new opportunity, updated 9, failed 0, emitted 0 warnings, created 1 source-document row, reused 9, and marked the AIIB source healthy.
- Post-run live database snapshot: 3,351 total opportunities, 1,735 RFP-typed opportunities, and 27 AIIB opportunities.

Remaining after this slice:
- Remove or replace the stale `https://www.usaid.gov/business-forecast` configured source; both `/business-forecast` and `/business-forecast/search` returned HTTP 404 from this environment.
- AFDB configured-source collection still needs a reliable challenge-resistant route or a source-specific search/document fallback for broad opportunity collection.

### 2026-05-29 - Replace Phased-Down DevBusiness Source With CDB Procurement

Status: implemented, focused-test verified, typechecked, live-proved, and live-imported.

Purpose: remove a guaranteed-empty configured source after UN Development Business ceased website activity and replace it with a live procurement source from the UNDB successor portal list.

Changes in this slice:
- Removed the default DevBusiness query and configured source URL because `https://devbusiness.un.org` is now a phase-down page, not a live opportunity feed.
- Added Caribbean Development Bank current procurement notices to the default source URL and indexed query set.
- Added a CDB source parser that extracts current notice titles, countries, sectors, procurement types, deadlines, and direct notice URLs from the static HTML table without Firecrawl/browser dependence.
- Routed CDB through the source API path in the discovery importer and live source proof script.

Verification:
- `npx vitest run __tests__/scrapers/cdb-parser.test.ts __tests__/services/default-discovery-sources.test.ts __tests__/actions/discovery-opportunity-import.test.ts` passed with 45 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live source proof `live_cdb_procurement_source_20260529T124017Z` passed through the source API path and returned 13 current CDB opportunities.
- Live DB import `live_cdb_procurement_import_20260529T1240` passed with downloads disabled; it processed 13 candidates, imported 13 new opportunities, failed 0, emitted 0 warnings, created 13 source-document rows, and marked the CDB source healthy.
- Post-run live database snapshot: 3,322 total opportunities, 1,731 RFP-typed opportunities, and 13 CDB opportunities.

Remaining after this slice:
- IDB, IFAD, and GCF replacement candidates remain blocked or portal-heavy from this environment; add them only if a reliable public API or browser path is proven.

### 2026-05-29 - Treat Partial SearXNG Engine Coverage As Failed Fan-Out

Status: implemented, focused-test verified, typechecked, and live-probed.

Purpose: ensure broad RFP search does not silently narrow to one engine when `search.lindela.io` returns some results but misses other explicitly requested engines.

Changes in this slice:
- Tightened the TypeScript SearXNG client so a primary response that covers only part of the requested engine set now triggers configured/public fallback fan-out from `searx.space`.
- Applied the same partial-engine coverage rule to the Python infrastructure SearXNG client.
- Added regression coverage for primary Google-only results recovering missing Bing and DuckDuckGo coverage through a healthy `searx.space` fallback instance.

Verification:
- `npx vitest run __tests__/services/searxng-client-config.test.ts` passed with 18 tests.
- `uv run pytest tests/ci/test_searxng_client_fallback.py tests/ci/test_discovery_service_contract.py -q` passed with 12 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- Live probe against `site:ungm.org/Public/Notice Request for Proposal software implementation deadline` with Google, DuckDuckGo, Bing, and Brave requested triggered fallback because `search.lindela.io` reported Google access denied. The client attempted four public `searx.space` instances, all rejected automated search with 403/418/429, then recovered 10 extra results through direct DuckDuckGo HTML fallback and returned 14 merged results.

Remaining after this slice:
- Public `searx.space` instances are still best-effort because many public nodes reject automated JSON/HTML traffic; reliable production capacity still benefits from a trusted `SEARXNG_FALLBACK_URLS` pool.

### 2026-05-29 - Recover IOM Procurement Source Collection

Status: implemented, focused-test verified, typechecked, live-proved, and live-imported.

Purpose: turn the empty IOM configured source into a reliable direct source path that imports current IOM RFP/RFQ/ITB/EOI opportunities and preserves solicitation attachments for response intake.

Changes in this slice:
- Added an IOM procurement parser for the Drupal table-card rows on `https://www.iom.int/procurement-opportunities`.
- The parser extracts title, notice/reference ID, category, country, publication date, closing date, summary text, and document attachments.
- It ranks attachments so RFP/RFQ/ITB/EOI/TOR documents beat supplier, vendor, conduct-code, declaration, guide, and spreadsheet attachments.
- Routed IOM through the source API path in discovery import and the live source proof script so collection uses direct public HTML fetch instead of Firecrawl/browser scraping, which returned no opportunities or 403 during live proof.

Verification:
- `npx vitest run __tests__/scrapers/iom-parser.test.ts __tests__/actions/discovery-opportunity-import.test.ts` passed with 43 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live source proof `live_iom_procurement_source_20260529T122410Z` passed; the IOM source API path returned 10 normalized opportunities with sample current 2026 RFP/RFQ records.
- Live DB import `live_iom_procurement_import_20260529T1224` passed with downloads disabled; it processed 10 candidates, imported 7 new opportunities, updated 3, failed 0, emitted 0 warnings, created 9 source-document rows, reused 1, and marked the IOM source healthy.
- Post-run live database snapshot: 3,309 total opportunities, 1,724 RFP-typed opportunities, and 10 IOM opportunities.

Remaining after this slice:
- DevBusiness is now a phase-down/static page and should not be treated as a live configured source unless a replacement feed is found.
- Continue replacing weak or empty generic sources with source-specific parsers/API paths and keep broad source health runs focused on material collection gains.

### 2026-05-29 - Add NeST Tanzania Source API Collection

Status: implemented, focused-test verified, typechecked, live-proved, and live-imported.

Purpose: replace the stale PPRA Tanzania configured source with the public NeST Tanzania OCDS releases API so Tanzania opportunities are collected through a reliable source feed instead of generic scraping of blocked or empty pages.

Changes in this slice:
- Added a NeST Tanzania source API parser for `https://nest.go.tz/gateway/nest-data-portal-api/api/releases`.
- The parser adds a rolling two-day `since` cursor when the configured URL has none, follows bounded `links.next` pagination, filters expired/cancelled/complete releases, and emits normalized opportunity records with buyer, notice ID, deadline, direct release URL, region, procurement method, OCDS metadata, and source tags.
- Routed NeST source URLs through the source API path in both discovery import and live source proof scripts.
- Replaced the default stale `https://www.ppra.go.tz/tenders` source URL and PPRA search query with the NeST releases API and an indexed NeST JSON search query.

Verification:
- `npx vitest run __tests__/scrapers/nest-tanzania-parser.test.ts __tests__/services/default-discovery-sources.test.ts __tests__/actions/discovery-opportunity-import.test.ts` passed with 45 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- Live source proof `live_nest_tanzania_source_20260529T120156Z` passed; the NeST source API path returned 100 normalized current opportunities and sample direct release URLs without Firecrawl/browser dependency.
- Live DB import `live_nest_tanzania_import_20260529T1202` passed with downloads disabled; it processed 50 candidates, imported 50 new opportunities, failed 0, emitted 0 warnings, created 50 source-document rows, and marked the NeST source healthy.
- Post-run live database snapshot: 3,302 total opportunities, 1,722 RFP-typed opportunities, and 50 NeST Tanzania opportunities.

Remaining after this slice:
- The NeST API is now a high-yield configured source, but public `searx.space` fallback instances are still best-effort because many reject server-side searches with 403/418/429. A trusted `SEARXNG_FALLBACK_URLS` pool remains the reliable fallback-capacity fix.
- Continue adding source-specific parsers/API paths for other empty configured sources instead of spending time on fine-grained generic parser edits.

### 2026-05-29 - Trigger SearXNG Fallback On Weak Primary Fan-Out

Status: implemented, focused-test verified, typechecked, and live-probed.

Purpose: keep RFP search breadth from collapsing when `search.lindela.io` returns an empty or incorrectly filtered primary response without explicitly reporting `unresponsive_engines`.

Changes in this slice:
- Updated the TypeScript SearXNG client so zero-result primary responses now trigger configured/public fallback fan-out even when no engine error is reported.
- Added requested-engine mismatch detection: if a requested-engine search returns results only from other engines, the client fans out to `searx.space` fallbacks and merges usable primary plus fallback results.
- Applied the same empty-result and requested-engine-mismatch fallback rules to the Python infrastructure SearXNG client.
- Updated the Python discovery service fallback trigger so empty primary SearXNG responses also try public/configured fallback instances.

Verification:
- `npx vitest run __tests__/services/searxng-client-config.test.ts` passed with 17 tests.
- `uv run pytest tests/ci/test_searxng_client_fallback.py tests/ci/test_discovery_service_contract.py -q` passed with 11 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- Live probe against `site:ungm.org/Public/Notice Request for Proposal software implementation deadline` with Google, DuckDuckGo, Bing, and Brave requested showed fallback fan-out reached eight public `searx.space` instances; those public instances rejected the server-side search with 403, 418, or 429, while `search.lindela.io` returned 3 Brave results.

Remaining after this slice:
- Public `searx.space` fallback is now triggered for more weak-primary cases, but public instances remain too throttled for dependable production breadth. A trusted `SEARXNG_FALLBACK_URLS` pool is still the reliable capacity fix if `search.lindela.io` under-delivers.
- Continue source-specific collection repairs for high-yield procurement portals such as Tanzania NeST and PPRA Tanzania.

### 2026-05-29 - Repair Uganda eGP Configured Source

Status: implemented, focused-test verified, typechecked, and live-run.

Purpose: turn the stale Uganda eGP configured source from an empty `/notices` scrape into a healthy public bid-notices source that imports current opportunities.

Changes in this slice:
- Replaced the default Uganda eGP source URL with `https://egpuganda.go.ug/bid-notices`, where the public bid table is currently available.
- Added a Uganda eGP source-specific parser for static bid-notice table rows, extracting notice URL, reference, procuring entity, category, published date, deadline, and source tags.
- Routed Uganda eGP source-scrape records through the dedicated parser and platform metadata instead of the generic parser.
- Narrowed the Uganda eGP high-intent search query to the active `/bid-notices` path.

Verification:
- Confirmed SearXNG fallback fan-out remains active for both TypeScript and Python clients: `npx vitest run __tests__/services/searxng-client-config.test.ts` passed with 15 tests, and `uv run pytest tests/ci/test_searxng_client_fallback.py tests/ci/test_discovery_service_contract.py -q` passed with 8 tests.
- Added regression coverage for the Uganda eGP parser extracting table rows with organizations and deadlines.
- `npx vitest run __tests__/actions/discovery-opportunity-import.test.ts __tests__/scrapers/egp-uganda-parser.test.ts __tests__/services/default-discovery-sources.test.ts __tests__/services/searxng-client-config.test.ts` passed with 58 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live source-only probe `live_egp_uganda_parser_probe_20260529` against `https://egpuganda.go.ug/bid-notices`, with downloads disabled, processed 5 records, imported 5 new opportunities, failed 0, emitted 0 warnings, and marked the source healthy.
- Post-run live database snapshot: 3,252 opportunities, 208 RFP documents, 206 completed RFP documents, 0 queued parse jobs, 1,412 RFP requirements, 176 RFP documents with requirements, 247 downloaded source-document rows, 240 discovered source-document rows, and 76 failed source-document rows.

Remaining after this slice:
- Public `searx.space` fallback fan-out is verified in code/tests but still best-effort in live broad runs; trusted `SEARXNG_FALLBACK_URLS` instances remain the reliable way to add fallback breadth if `search.lindela.io` degrades.
- Other configured source gaps remain, especially Tanzania NeST and PPRA Tanzania, which need source-specific API or browser parsing rather than generic scraping.

### 2026-05-29 - Page Configured Sources Before Capping Candidates

Status: implemented, focused-test verified, typechecked, and live-run.

Purpose: increase broad RFP collection from configured procurement portals by following pagination before applying each source's candidate cap, while keeping generic portal navigation rows out of the opportunity table.

Changes in this slice:
- Added bounded configured-source pagination for Firecrawl-scraped sources. The importer now follows parser-provided `nextPageUrl` or `hasNextPage`/`getPageUrl` up to `CONFIGURED_SOURCE_MAX_PAGES`, defaulting to 3 and capped at 5.
- Deduplicated opportunities found across source pages before import, using the same source identity logic as normal configured-source scraping.
- Tightened the generic parser so portal-menu rows such as `Current Tenders`, `Upcoming Tenders`, opened-bid details, annual procurement-plan publication, and generic electronic-procurement pages are not imported as opportunities.
- Documented `CONFIGURED_SOURCE_MAX_PAGES` in the opportunity discovery runbook.

Verification:
- Added regression coverage proving a configured source follows a `Next` page and imports opportunities from page 2 before applying `sourceScrapeLimit`.
- The same regression proves a generic `Current Tenders` navigation link is ignored while actual tender/RFP links are kept.
- `npx vitest run __tests__/actions/discovery-opportunity-import.test.ts __tests__/services/default-discovery-sources.test.ts` passed with 42 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- Live source-only probe `live_source_pagination_probe_20260529` against Tanzania NeST and Zambia ZPPA produced 3 imported configured-source records from ZPPA, 0 failures, and showed Tanzania NeST as empty under the current generic parser/browser path.
- Live direct ZPPA current-tenders probe `live_zambia_current_tenders_probe_20260529` processed 5 records, imported 2, updated 3, failed 0; the parser tightening now prevents those generic navigation labels from becoming future opportunity rows.
- Bounded broad live run `live_broad_after_source_pagination_20260529` processed 102 records, imported 2 new opportunities, updated 100, failed 0, created 1 new source-document row, attempted 0 downloads by design, and reported 0 queued parse jobs afterward.
- Post-run live database snapshot: 3,247 opportunities, 208 RFP documents, 206 completed RFP documents, 0 queued parse jobs, 1,412 RFP requirements, 176 RFP documents with requirements, 247 downloaded source-document rows, 240 discovered source-document rows, and 76 failed source-document rows.

Remaining after this slice:
- Public `searx.space` instances remain heavily throttled during broad server-side runs; direct DuckDuckGo fallback recovered some query result sets, but a trusted `SEARXNG_FALLBACK_URLS` pool remains needed for reliable multi-engine breadth.
- Some configured sources are still empty or failed under current parsers, including Tanzania NeST, USAID business forecast, DevBusiness, PPRA Tanzania, and Uganda EGP; these need source-specific parser/API work rather than more generic scraping.

### 2026-05-29 - Suppress Generic Intake Rows And Recover TLS-Blocked NRF PDF

Status: implemented, focused-test verified, typechecked, live-run, and parsed.

Purpose: keep source-document intake focused on documents that can produce requirements, while preserving broad recovery when `search.lindela.io` has degraded engine fan-out and public sources have host-specific fetch issues.

Changes in this slice:
- Suppressed generic non-solicitation source documents from intake selection, including bidder-instruction PDFs, quarterly entity listing PDFs, and GPPB NPM memo PDFs.
- Kept actual ITB/RFP/RFQ source documents eligible; the filter removes known generic guidance/listing/memo rows rather than low-fit but real tender documents.
- Added a narrow invalid-TLS allowlist for `nrf.ac.za`, with `SOURCE_DOCUMENT_INVALID_TLS_HOSTS` support for future evidence-backed host additions, while preserving public URL validation and DNS pinning.
- Documented the host-scoped TLS exception control in the opportunity discovery runbook.

Verification:
- `npx vitest run __tests__/scripts/run-source-document-intake.test.ts` passed with 5 tests.
- `npx vitest run __tests__/services/searxng-client-config.test.ts` passed with 15 tests.
- `uv run pytest tests/ci/test_searxng_client_fallback.py tests/ci/test_discovery_service_contract.py -q` passed with 8 tests.
- `npx vitest run __tests__/services/rfp-document-service.test.ts` passed with 37 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- Dry-run `source_intake_filter_generic_dryrun_20260529b` confirmed `bidder-instructions-goods-en.pdf`, `Entities - 2021 Quarter 1.pdf`, and `NPM-No.-122-2013.pdf` no longer enter the selected intake batch.
- Live intake `source_intake_filter_generic_live_20260529` selected 2, downloaded 1, failed 1, completed 1 parse, and extracted 10 requirements from `itb2023-0073-jibril.pdf` using local `pdftotext`.
- Live retry `source_intake_retry_nrf_tls_live_20260529` recovered an IOM 403 row through the search/scrape path, reached public `searx.space` fallback instances during recovery, stored an HTML source surrogate, completed parsing, and extracted 33 requirements.
- Live retry `source_intake_retry_nrf_tls_live_20260529b` reached public `searx.space` fallback fan-out for a degraded GTAI recovery query, then recovered the previously TLS-failed NRF PDF directly with local `pdftotext`, completed parsing, and extracted 11 requirements.
- Post-run live database snapshot: 3,240 opportunities, 208 RFP documents, 206 completed RFP documents, 0 queued parse jobs, 1,412 RFP requirements, 176 RFP documents with requirements, 247 downloaded source-document rows, 239 discovered source-document rows, and 76 failed source-document rows.

Remaining after this slice:
- Public `searx.space` fallback fan-out is active and sometimes recovers breadth, but many public instances still return 403/429; a trusted `SEARXNG_FALLBACK_URLS` pool remains the reliable path when `search.lindela.io` engine fan-out degrades.
- The GTAI HTML-disguised PDF still failed after search/scrape recovery and should be handled as a source-specific follow-up only if its opportunity value justifies more work.

### 2026-05-29 - Prioritize Response-Worthy Source Intake

Status: implemented, focused-test verified, typechecked, live-run, and parsed.

Purpose: spend bounded parser capacity on RFPs, TORs, data/software/policy, consulting, RFQ, and EOI documents before lower-fit commodity supply tenders when both are available in the fresh source-document backlog.

Changes in this slice:
- Added source-document intake scoring for response-worthy signals such as RFP/request for proposals, TOR/scope of work, RFQ, EOI/ITB, consulting/capacity building, and data/digital/software/policy work.
- Penalized low-fit commodity/framework supply patterns such as sports balls, football balls, road markings, and drainage PDFs without filtering them out entirely.
- Kept the existing host-diversity caps and protected-host suppression, but now applies them after response-worthiness sorting.

Verification:
- Added focused regression coverage proving RFP/data-policy and consulting/capacity-building documents score above commodity supply files.
- `npx vitest run __tests__/scripts/run-source-document-intake.test.ts` passed with 5 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- Dry-run `source_intake_priority_second_dryrun_20260529` moved the next batch from sports-ball/commodity-first ordering to response-worthy documents: Smart Africa data-policy RFP, EAC request for proposals/TOR, EIB updated TOR, sealed quotation, RFQ, EOI, and capacity-building documents.
- Live intake `source_intake_priority_second_live_20260529` selected 5, downloaded 5, failed 0, completed 5 parses, and extracted 39 requirements. Successful documents included Smart Africa Eswatini Data Policy RFP, EAC request-for-proposals/TOR, EIB updated TOR, Namibia sealed quotations, and AAU RFQ.
- Post-run live database snapshot: 3,240 opportunities, 200 RFP documents, 198 completed RFP documents, 0 queued parse jobs, 1,304 RFP requirements, 168 RFP documents with requirements, 239 downloaded source-document rows, 246 discovered source-document rows, and 77 failed source-document rows.

Remaining after this slice:
- Continue bounded intake from the still-large fresh backlog; the ranking now improves parser value, but source-specific recovery is still needed for failed protected hosts and HTML-disguised direct document URLs.

### 2026-05-29 - Third Prioritized Intake Batch Adds Five More Parsed Documents

Status: live-run, downloaded, parsed, and verified.

Purpose: continue converting the fresh source-document backlog after the response-worthy ordering fix, while keeping parser work bounded.

Verification:
- Dry-run `source_intake_priority_third_dryrun_20260529` selected 8 remaining direct documents, led by RFQ, EOI, capacity-building, project-document, and managed-services PDFs.
- Live intake `source_intake_priority_third_live_20260529` selected 5, downloaded 5, failed 0, completed 5 parses, and extracted 54 requirements.
- Successful documents used local `pdftotext`; no Docling fallback was needed in this batch.
- Post-run live database snapshot: 3,240 opportunities, 205 RFP documents, 203 completed RFP documents, 0 queued parse jobs, 1,358 RFP requirements, 173 RFP documents with requirements, 244 downloaded source-document rows, 241 discovered source-document rows, and 77 failed source-document rows.

Remaining after this slice:
- Keep draining fresh source documents in bounded prioritized batches; the remaining queue is still large enough to grow parsed RFP coverage without another broad reseed yet.

### 2026-05-29 - Broad Reseed After Reader Recovery Adds Fresh Parsed Documents

Status: live-run, downloaded, parsed, and verified.

Purpose: keep collection growth focused on fresh opportunities and source documents after protected UNICEF recovery, instead of inflating counts by retrying duplicate same-URL UNICEF rows.

Changes in this slice:
- Ran the broad default discovery profile with downloads disabled to seed fresh opportunities and source-document rows through SearXNG plus configured procurement sources.
- Confirmed public `searx.space` fallback fan-out is active from this environment, but most public instances rejected server-side search with 403, 418, 429, fetch failures, or timeouts.
- Ran a bounded source-document intake dry-run over the newly seeded backlog, then processed the top 5 direct documents live.

Verification:
- Live reseed `live_broad_reseed_after_reader_recovery_20260529` processed 380 candidates, imported 66 new opportunities, updated 314 opportunities, failed 0 imports, created 42 source-document rows, reused 270 existing source-document rows, and attempted 0 downloads by design.
- Healthy configured sources included Tenders Kenya, UNGM, UNOPS, IOM, WHO, ILO, FAO, IFAD, UNDP, World Bank, AFDB, ADB, AIIB, IsDB, EBRD, DGMarket, COMESA, UN Procurement, UNICEF tender calendars, SAM.gov, EU funding, South Africa eTenders, and GIZ.
- Source-intake dry-run `source_intake_after_reader_recovery_reseed_dryrun_20260529` selected 10 direct documents from the fresh backlog, including AIIB XLSX procurement-plan data and multiple PDF tender/RFP files.
- Live intake `source_intake_after_reader_recovery_reseed_live_20260529` selected 5, downloaded 4, failed 1 GTAI URL that returned HTML from a direct PDF path, completed 4 parses, and extracted 15 requirements.
- The successful intake used local `local_xlsx_parse` for the AIIB procurement-plan XLSX and local `pdftotext` for the PDF documents.
- Post-run live database snapshot: 3,240 opportunities, 195 RFP documents, 193 completed RFP documents, 0 queued parse jobs, 1,265 RFP requirements, 164 RFP documents with requirements, 234 downloaded source-document rows, and 77 failed source-document rows.

Remaining after this slice:
- Public SearXNG fallback is operating but too throttled for reliable breadth; populate `SEARXNG_FALLBACK_URLS` with trusted known-good instances if primary `search.lindela.io` does not provide enough engine fan-out.
- Continue the remaining fresh source-document backlog from the dry-run, but keep batches bounded because each successful download can trigger parser work.

### 2026-05-29 - Recover Protected UNICEF Landing Pages Through Reader Fallback

Status: implemented, focused-test verified, live-retried, and parsed.

Purpose: increase RFP-source collection reliability for public procurement pages that block direct server-side document fetches and still defeat Firecrawl/browser recovery.

Changes in this slice:
- Added a final reader fallback to source-document scrape recovery after Firecrawl, the browser service, and CloakBrowser fail or return unusable content.
- Preserved the existing direct PDF and scraped-link recovery flow: reader markdown is used only to discover linked documents or store a public landing-page HTML surrogate when the original binary remains unavailable.
- Added explicit `reader_link` and `reader_landing_page_html` provenance so recovered public-reader content is auditable.
- Added `SOURCE_DOCUMENT_READER_FALLBACKS=0` and `SOURCE_DOCUMENT_READER_FALLBACK_PREFIX` operator controls to disable or replace the public reader endpoint.
- Limited direct sparse-HTML scrape recovery to challenge pages and client-rendered shells, so ordinary sparse HTML still stores as `not_queued` instead of spending recovery capacity.
- Documented the reader fallback in the opportunity discovery runbook.

Verification:
- Added regression coverage proving a blocked UNICEF media-file URL can recover through a public reader landing page when Firecrawl, browser scraping, and CloakBrowser all fail.
- `npx vitest run __tests__/services/rfp-document-service.test.ts` passed with 36 tests.
- `npx vitest run __tests__/services/searxng-client-config.test.ts` passed with 15 tests.
- `uv run pytest tests/ci/test_searxng_client_fallback.py tests/ci/test_discovery_service_contract.py -q` passed with 8 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- Live retry recovered three previously failed UNICEF source documents: medical devices tender calendar via `reader_landing_page_html`, medicines tender calendar via `firecrawl_landing_page_html`, and education tender calendar via `reader_landing_page_html`.
- Queued parse drain `queued_parse_after_unicef_reader_recovery_20260529` completed 3 jobs, failed 0, and extracted 11 requirements.
- Post-run live database snapshot: 3,174 opportunities, 191 RFP documents, 189 completed RFP documents, 0 queued parse jobs, 1,250 RFP requirements, 161 RFP documents with requirements, 230 downloaded source-document rows, and 76 failed source-document rows.

Remaining after this slice:
- Public reader fallback is an external best-effort recovery path; keep direct/Firecrawl/browser/Cloak ahead of it, and configure a trusted reader or disable it if deployment policy requires no public reader egress.
- Continue source-specific recovery for high-intent failed hosts, especially DGMarket and remaining UNICEF rows that are not represented by these three tender-calendar URLs.

### 2026-05-29 - Profile And Probe Remaining Protected Source Documents

Status: live-profiled and partially recovered.

Purpose: choose the next RFP intake target from live failure evidence after the IOM recovery work, instead of making finer edits without material collection impact.

Findings:
- Failed source-document rows by host: DGMarket 44 total with 1 high-intent row, UNICEF 23 total with 23 high-intent rows, AFDB 5 total with 1 high-intent row, and IOM 1 high-intent row remaining.
- A bounded UNICEF retry attempted one representative row per unique failed UNICEF media-file URL: medical devices tender calendar, nutrition bid plan, medicines tender calendar, and education tender calendar.
- The UNICEF nutrition bid plan recovered from a UNICEF Supply Division landing page and stored `UNICEF-Nutrition-Bid-Plan-4Q-2024-2025.html`; queued parse drain `queued_parse_after_unicef_nutrition_recovery_20260529` completed but extracted 0 requirements.
- The medical devices, medicines, and education tender-calendar rows still failed because Firecrawl/browser recovery returned unusable or blocked source content and CloakBrowser is not configured.

Current live counts after this probe:
- 188 RFP documents, 186 completed RFP documents, 0 queued parse jobs, 1,239 RFP requirements, 159 RFP documents with requirements, 227 downloaded source-document rows, and 79 failed source-document rows.

Next target:
- Repair protected UNICEF landing-page extraction or configure CloakBrowser before spending more routine retries on UNICEF calendars; the existing browser service is still insufficient for these pages.

### 2026-05-29 - Recover Blocked IOM Procurement PDFs From Listing Pages

Status: implemented, unit-verified, live-retried, and parsed.

Purpose: convert IOM procurement PDFs that return HTTP 403 to server-side fetch into usable RFP source text instead of leaving discovered solicitations stuck as failed source documents.

Changes in this slice:
- Added a deterministic recovery candidate for blocked IOM procurement document URLs: `https://www.iom.int/procurement-opportunities`.
- Focus recovered listing-page text around the target document title/solicitation number before storing it as an HTML source surrogate, avoiding unrelated procurement guide content when a listing page contains many links.
- Normalized recovery title matching for lower-case concatenated filenames such as `rfp-livelihoodandagriculture_39901.pdf`, including split `and` compounds and short procurement acronyms such as RFP/RFQ/EOI/ITB.

Verification:
- Added regression coverage proving a blocked IOM procurement PDF can recover from the IOM procurement listing page and store focused solicitation text without nearby generic guide content.
- Added regression coverage for a lower-case concatenated IOM filename matching a camel-cased listing entry.
- `npx vitest run __tests__/services/rfp-document-service.test.ts` passed with 35 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- Live retry of previously failed document `27f945ce-0607-4881-8e9d-9031cc1e5c28` (`invitation-to-bid_30000024345_0.pdf`) succeeded after direct fetch returned 403, storing `invitation-to-bid_30000024345_0.html` from `https://www.iom.int/procurement-opportunities`.
- Queued parse drain `queued_parse_after_iom_recovery_20260529` completed 1 parser job and extracted 1 requirement.
- Live retry of previously failed document `7850d0d0-b471-48d0-a1d3-55db5101e1f8` (`solicitation-30000025693-successfully-published-on-ungm.pdf`) succeeded after direct fetch returned 403, storing `solicitation-30000025693-successfully-published-on-ungm.html` from `https://www.iom.int/procurement-opportunities`; queued parse drain `queued_parse_after_iom_second_recovery_20260529` completed 1 parser job and extracted 6 requirements.
- Live retry of previously failed document `77c913a6-3810-4fd2-96f0-f68a34993119` (`rfp-livelihoodandagriculture_39901.pdf`) succeeded after direct fetch returned 403, storing `rfp-livelihoodandagriculture_39901.html` from `https://www.iom.int/procurement-opportunities`; queued parse drain `queued_parse_after_iom_livelihood_recovery_20260529` completed 1 parser job and extracted 3 requirements.
- Post-run live database snapshot: `db.lindela.io:5432/docfusion` resolved to server `62.84.181.55:5432` and contained 3,174 opportunities, 1,703 RFP opportunities, 187 RFP documents, 185 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 1,239 RFP requirements, 159 RFP documents with requirements, 508 selected source-document rows, 226 downloaded source-document rows, and 80 failed source-document rows.

Remaining after this slice:
- The previous batch's IOM direct-PDF failures are now recovered except for older generic IOM guidance/document rows that are not necessarily solicitations.
- The browser service at `http://84.247.181.100:3003` still returns `/v1/scrape` 404 and intermittent `/scrape` failures for some blocked PDFs; repair or replace with CloakBrowser for the stubborn cases.

### 2026-05-29 - Expand Default RFP Sources Across UN And Multilateral Portals

Status: implemented, unit-verified, typechecked, live-reseeded, and live-intake verified.

Purpose: materially increase RFP collection breadth by adding high-yield UN and multilateral procurement sources rather than repeating the same discovery set.

Changes in this slice:
- Added default procurement search queries for UNOPS, IOM, WFP, WHO, ILO, IFAD, UNHCR, and FAO.
- Added routine configured-source scraping for live-verified 200-status procurement pages: UNOPS business opportunities, IOM procurement opportunities, WHO procurement, ILO procurement, FAO procurement, and IFAD corporate procurement.
- Marked the same UN/multilateral procurement pages, plus WFP, IFAD project procurement, and UNHCR bidding-opportunity URLs, as known high-intent procurement portals for search result acceptance.
- Tightened source-document intake filtering so generic procurement information PDFs such as IOM submission guides, tips, and supplier/conduct documents do not consume RFP parser capacity.

Verification:
- `npx vitest run __tests__/services/default-discovery-sources.test.ts` passed with 2 tests.
- `npx vitest run __tests__/scripts/run-source-document-intake.test.ts` passed with 4 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- Live reseed `live_broad_reseed_after_un_source_expansion_20260529`, with downloads disabled, produced 183 candidates, 40 new opportunities, 143 updates, 0 failed imports, and 68 new source-document rows.
- New configured sources were healthy in the live reseed: UNOPS imported 1, IOM imported 10, WHO imported 9, ILO imported 6, FAO imported 1, and IFAD corporate procurement imported 3.
- Filtered source-intake dry-run `source_intake_after_un_source_expansion_filtered_dryrun_20260529` selected 5 solicitation-looking PDFs after excluding generic procurement guidance rows.
- Live intake `source_intake_after_un_source_expansion_live_20260529` selected 5, downloaded 2, failed 3 IOM PDFs with HTTP 403 after recovery attempts, completed 2 parses, and extracted 16 requirements. The successful documents used local HTML text recovery for one IOM RFP and local `pdftotext` for one PDF.
- Post-run live database snapshot: 3,174 opportunities, 184 RFP documents, 182 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 1,229 RFP requirements, 156 RFP documents with requirements, 508 selected source-document rows, 223 downloaded source-document rows, and 83 failed source-document rows.

Remaining after this slice:
- IOM direct procurement PDFs frequently return 403; add a source-specific IOM/UNGM recovery path or repair the browser scraping endpoint before relying on direct IOM PDF intake.
- The expanded sources created many source-document rows, but only five passed current direct-document filters. Continue targeted intake improvements for source pages that list documents behind portal links.

### 2026-05-29 - Extend SearXNG Fanout to Python Infrastructure Client

Status: implemented and focused-test verified.

Purpose: ensure Python workflows that use `SearXNGClient` also fan out to `searx.space` public instances when `search.lindela.io` fails or reports degraded requested engines.

Changes in this slice:
- Added configured `SEARXNG_FALLBACK_URLS` and public `https://searx.space/data/instances.json` fallback discovery to the Python infrastructure SearXNG client.
- Filtered public instances for healthy HTTP status, normal network type, SearXNG git metadata, search success, and requested-engine error rates before fanout.
- Merged primary and fallback results with URL dedupe, preserved fallback provenance on `SearchResponse`, and accepted the existing workflow `limit` argument instead of letting that call path fail.

Verification:
- Added Python regression coverage for degraded-primary public searx.space fanout and primary-failure configured fallback recovery.
- `uv run pytest tests/ci/test_searxng_client_fallback.py tests/ci/test_discovery_service_contract.py -q` passed with 8 tests.
- `git diff --check` passed.

Remaining after this slice:
- Public searx.space instances are still best-effort and may throttle server-side traffic; `SEARXNG_FALLBACK_URLS` should be populated with trusted, known-good SearXNG instances when reliable multi-engine breadth is required.

### 2026-05-29 - Recover DuckDuckGo Results When Public SearXNG Fanout Fails

Status: implemented, unit-verified, typechecked, and live-probed.

Purpose: keep broad RFP sourcing productive when `search.lindela.io` reports degraded engine fanout and public `searx.space` instances reject server-side fallback searches.

Changes in this slice:
- Preserved the existing primary `search.lindela.io` search path and public SearXNG fallback fanout from `https://searx.space/data/instances.json`.
- Added a direct DuckDuckGo HTML fallback that runs only after SearXNG fallback fanout produces no usable results and DuckDuckGo is one of the requested engines.
- Parsed lightweight DuckDuckGo HTML results, normalized DuckDuckGo redirect URLs, deduped them through the existing SearXNG response merge path, and recorded fallback provenance.
- Documented the direct DuckDuckGo recovery path and `DUCKDUCKGO_DIRECT_FALLBACKS=0` disable switch in the opportunity discovery runbook.

Verification:
- Added regression coverage for a degraded primary response, a throttled public SearXNG fallback, and successful direct DuckDuckGo HTML recovery.
- `npx vitest run __tests__/services/searxng-client-config.test.ts` passed with 15 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live probe for `"request for proposals" Africa deadline` with requested engines `google`, `duckduckgo`, `bing`, and `brave` showed `search.lindela.io` degraded for Brave, DuckDuckGo, and Google; eight public `searx.space` fallbacks rejected with 403, 418, or 429; direct DuckDuckGo HTML recovered 4 additional results and returned 14 merged results total.
- `git diff --check` passed.

Remaining after this slice:
- Direct DuckDuckGo improves recall when public SearXNG is blocked, but a trusted `SEARXNG_FALLBACK_URLS` pool is still the reliable way to get multi-engine fallback breadth.
- Continue source/query expansion and live reseeding; the previous broad reseed updated existing records but did not add new RFPs.

### 2026-05-29 - Suppress Failing Public SearXNG Fallbacks Per Run

Status: implemented, unit-verified, typechecked, and live-run observed.

Purpose: reduce wasted broad-search time when public `searx.space` instances repeatedly reject server-side fallback traffic.

Changes in this slice:
- Added per-process suppression for fallback instances after access/throttle/transient failure patterns such as 403, 418, 429, 500, fetch failures, and timeouts.
- Kept primary `search.lindela.io` behavior unchanged and preserved fallback fan-out to any remaining non-suppressed configured or public instances.
- Recorded the next broad reseed after protected-source suppression.

Verification:
- Added regression coverage proving a fallback that returns 429 is not retried on the next degraded query in the same process.
- `npx vitest run __tests__/services/searxng-client-config.test.ts` passed with 14 tests.
- `npx tsc --noEmit --pretty false` passed.
- Broad reseed `live_broad_reseed_after_protected_skip_20260529` returned 151 candidate records, imported 0, updated 151, failed 0, created 0 source-document rows, and attempted 0 downloads by design.
- Follow-up source-intake dry-run `source_intake_after_protected_skip_reseed_dryrun_20260529` selected 0 rows with protected-host recovery off.
- Post-run live database snapshot: 3,134 opportunities, 182 RFP documents, 180 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 1,213 requirements, 154 RFP documents with requirements, 452 selected source-document rows, 221 downloaded source-document rows, and 80 failed source-document rows.
- `git diff --check` passed.

Remaining after this slice:
- Public `searx.space` remains best-effort only; a trusted `SEARXNG_FALLBACK_URLS` pool is still required for reliable search breadth when `search.lindela.io` engine fan-out degrades.
- The latest broad reseed produced only updates, so further RFP growth likely needs new source/query expansion, scheduled recurring discovery, or targeted source-specific connectors rather than repeating the same batch immediately.

### 2026-05-29 - Routine Intake Skips Protected Portal Rows

Status: implemented, unit-verified, typechecked, and live dry-run verified.

Purpose: keep routine RFP intake focused on downloadable source documents instead of repeatedly spending recovery time on protected DGMarket portal pages that return HTTP 403.

Changes in this slice:
- Changed source-document intake selection so routine batches skip known protected portal hosts, including newly discovered rows with zero prior attempts.
- Preserved the explicit `SOURCE_DOCUMENT_INTAKE_RETRY_PROTECTED_HOSTS=1` escape hatch for targeted protected-host recovery runs.
- Made the source-intake script importable for focused helper tests without running the live intake side effect.

Verification:
- Added regression coverage proving routine intake keeps a fresh direct Kenya PDF but skips newly discovered and previously failed DGMarket portal rows.
- `npx vitest run __tests__/scripts/run-source-document-intake.test.ts` passed with 3 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live dry-run `source_intake_protected_skip_dryrun_20260529`, with failed retries disabled and protected-host recovery off, selected 0 rows after the previous broad reseed. Before this change, newly discovered DGMarket rows were selected and then failed with HTTP 403.
- `git diff --check` passed.

Remaining after this slice:
- Add a source-specific DGMarket recovery path only if protected access becomes operationally worthwhile; routine intake should not spend broad-collection capacity there.
- Continue broad reseeding plus intake loops to keep growing the RFP and requirements corpus.

### 2026-05-29 - Broad Reseed Adds Five More Parsed RFPs

Status: live-run, downloaded, parsed, and verified.

Purpose: keep RFP collection growing after the fresh source-document backlog was exhausted.

Changes in this slice:
- Confirmed the fresh source-document intake backlog was empty with failed retries disabled.
- Ran a broad live discovery reseed with downloads disabled to create new opportunity and source-document rows without spending the search run on document processing.
- Ran a bounded source-document intake over the newly seeded direct documents.
- Drained the queued parser jobs created by that intake.

Verification:
- Dry-run `source_intake_remaining_backlog_dryrun_20260529` selected 0 rows, confirming the prior fresh backlog was exhausted.
- Broad reseed `live_broad_reseed_after_fallback_ranking_20260529` returned 165 candidate records, created 17 opportunities, updated 148 opportunities, failed 0 records, created 17 source-document rows, and attempted 0 downloads by design.
- The reseed reached public `searx.space` fallbacks, but most public fallback calls still returned 403, 429, 418, or 500. One recovery path did use `https://etsi.me` during DGMarket document recovery, confirming fallback fan-out is active but still opportunistic.
- Dry-run `source_intake_after_broad_reseed_dryrun_20260529` selected 8 fresh rows: 5 direct Kenya tender PDFs and 3 DGMarket HTML rows.
- Live intake `source_intake_after_broad_reseed_live_20260529` selected 8 rows, downloaded 5 direct PDFs, failed 3 DGMarket rows with HTTP 403, and queued 5 parser jobs. Successful PDFs used local `pdftotext`.
- Queued parse drain `queued_parse_after_broad_reseed_intake_20260529` selected 5 jobs, completed 5, failed 0, and extracted 44 requirements.
- Follow-up dry-run `source_intake_post_reseed_remaining_dryrun_20260529` selected 0 rows with failed retries disabled.
- Post-run live database snapshot: 3,134 opportunities, 182 RFP documents, 180 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 1,213 requirements, 154 RFP documents with requirements, 452 selected source-document rows, 221 downloaded source-document rows, and 80 failed source-document rows.

Remaining after this slice:
- DGMarket is now a recurring protected-source failure; normal intake should keep suppressing protected retries unless a source-specific recovery path is added.
- Public `searx.space` fallback is active but too rate-limited for reliable breadth. A trusted fallback pool remains the highest-leverage infrastructure improvement for broad RFP search.

### 2026-05-29 - Engine-Aware SearXNG Public Fallback Selection

Status: implemented, unit-verified, and typechecked.

Purpose: improve public `searx.space` fan-out quality when `search.lindela.io` is not delivering the requested engine coverage.

Changes in this slice:
- Kept the existing primary-failure and partial-degradation fallback path, but made public fallback selection aware of the requested engine.
- Filtered out public instances whose `searx.space` metadata shows every requested engine is effectively broken.
- Ranked public fallback instances by requested-engine health before general search success and median timing, so a slower Google-healthy instance beats a faster Google-broken instance for Google-specific RFP searches.
- Updated the opportunity discovery runbook to document engine-aware public fallback selection.

Verification:
- Added regression coverage proving a fast `searx.space` instance with `google` error rate 100 is skipped in favor of a slower instance with healthy `google` metadata.
- `npx vitest run __tests__/services/searxng-client-config.test.ts` passed with 13 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Public instances are still best-effort and can reject server-side traffic with 403/429; a trusted `SEARXNG_FALLBACK_URLS` pool remains the reliable fix for broad fallback capacity.
- Continue live discovery/import runs and track whether public fallback warnings produce more recovered candidates after the healthier instance ranking.

### 2026-05-29 - Remaining Fresh Backlog Adds Six Parsed RFPs

Status: live-run, downloaded, parsed, and verified.

Purpose: finish the current fresh source-document intake window and keep converting discovered RFP documents into extracted requirements.

Changes in this slice:
- Ran the remaining fresh source-document dry-run with failed retries disabled.
- Ran a bounded live intake batch over the remaining fresh rows.
- Drained all parser jobs created by that intake.

Verification:
- Dry-run `source_intake_remaining_fresh_dryrun_20260529` selected 8 fresh rows, including Kenya tender PDFs, Expertise France, timeline/data-system toolkit, SAM.gov HTML, and a DGMarket HTML page.
- Live intake `source_intake_remaining_fresh_live_20260529` selected 8 rows, downloaded 7, failed 1, and queued 6 parser jobs. DGMarket failed with HTTP 403 after fallback/search/scrape attempts. SAM.gov HTML was downloaded but did not queue a parser job.
- Queued parse drain `queued_parse_remaining_fresh_intake_20260529` selected 6 jobs, completed 6, failed 0, and extracted 36 requirements.
- Post-run live database snapshot: 3,117 opportunities, 177 RFP documents, 175 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 1,169 requirements, 149 RFP documents with requirements, 435 selected source-document rows, 216 downloaded source-document rows, and 77 failed source-document rows.

Remaining after this slice:
- Inspect remaining source-document rows; the fresh backlog may now be exhausted or dominated by protected/retry sources.
- Improve handling for downloaded HTML rows that do not queue parser jobs so they are explicit skips or recoverable parser inputs.

### 2026-05-29 - Fresh Tender Backlog Adds Twelve Parsed RFPs

Status: live-run, downloaded, parsed, and verified.

Purpose: keep converting broad discovery output into response-ready RFP documents and requirements.

Changes in this slice:
- Ran the next source-document dry-run with failed retries disabled to confirm a fresh direct-document batch remained after the previous RFQ/TOR drain.
- Ran a bounded live intake batch of 12 documents.
- Drained all queued parser jobs created by that intake.

Verification:
- Dry-run `source_intake_next_fresh_dryrun_20260529` selected 20 fresh rows, including Kenya tender PDFs, TOR/procurement consultant files, AFD EOI DOCX, ITB files, GIZ, IOM, Enisa, UK procurement guidance, and SAM.gov material.
- Live intake `source_intake_next_fresh_live_20260529` selected 12 documents, downloaded 12, failed 0, and queued 12 parser jobs. Extraction used local `pdftotext`/DOCX parsing first; ISSA and IOM protected direct PDFs recovered as HTML with usable text.
- Queued parse drain `queued_parse_next_fresh_intake_20260529` selected 12 jobs, completed 12, failed 0, and extracted 112 requirements.
- Post-run live database snapshot: 3,117 opportunities, 171 RFP documents, 169 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 1,133 requirements, 143 RFP documents with requirements, 435 selected source-document rows, 209 downloaded source-document rows, and 76 failed source-document rows.

Remaining after this slice:
- Continue fresh source-document backlog drains while the selector still finds direct documents.
- Public `searx.space` fallback remains noisy; a trusted fallback pool is still needed for reliable broad search coverage.

### 2026-05-29 - RFQ/TOR Source Backlog Converts Into Parsed Requirements

Status: live-run, downloaded, parsed, and verified.

Purpose: turn the newly broadened RFQ/ITB/TOR acceptance surface into concrete RFP document and requirement growth.

Changes in this slice:
- Ran source-document intake dry-run with failed retries disabled to confirm the next batch was fresh direct documents rather than protected retry noise.
- Ran a bounded live intake batch from that fresh backlog.
- Drained the queued RFP parser jobs created by the live intake.

Verification:
- Dry-run `source_intake_after_acceptance_probe_dryrun_20260529` selected 25 fresh documents with 0 DGMarket rows, including RFQ, ITB, TOR, and RFP files from Kenya PPIP, PPDA Malawi, IOM, AFD, AU, IsDB, GIZ, SAM.gov, and other sources.
- Live intake `source_intake_after_acceptance_probe_live_20260529` selected 12 documents, downloaded 10, failed 2, and queued 10 parser jobs. Successful downloads used local `pdftotext`/DOCX extraction before any heavier fallback.
- Failed intake rows were IOM `request-for-quotations.docx` with `HTTP 403: Forbidden` after search/scrape recovery attempts, and a British Council procurement-consultants DOCX that timed out.
- Queued parse drain `queued_parse_after_acceptance_probe_intake_20260529` selected 10 jobs, completed 10, failed 0, and extracted 90 requirements.
- Post-run live database snapshot: 3,117 opportunities, 159 RFP documents, 157 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 1,021 requirements, 131 RFP documents with requirements, 435 selected source-document rows, 197 downloaded source-document rows, and 76 failed source-document rows.

Remaining after this slice:
- Continue draining the fresh source-document backlog in bounded batches.
- Add a source-specific recovery path for IOM if those 403-protected document URLs remain valuable.

### 2026-05-29 - Search Acceptance Keeps More Procurement Notices

Status: implemented, unit-verified, and typechecked.

Purpose: reduce missed RFP intake when SearXNG returns high-intent procurement results whose snippets do not literally contain the old small keyword set.

Changes in this slice:
- Expanded opportunity search signals to include RFQ, request for quotations, request for bids, invitation to bid, call for proposals, and terms of reference language.
- Added high-intent query handling for known procurement portal result URLs, including UNGM, UNDP procurement notices, DevBusiness, World Bank procurement, AFDB, ADB, AIIB, IsDB, Kenya PPIP, SAM.gov, USAID forecast, eTenders South Africa, Tanzania PPRA, Uganda eGP, EBRD, COMESA, UN Procurement, UNICEF tender calendars, and GIZ tenders.
- Kept archive/wiki filtering ahead of acceptance so low-value mirror results are still rejected before scraping.
- Classified RFQ/ITB/request-for-bids results as `tender` opportunities instead of `other`.

Verification:
- Added regression coverage proving a high-intent UNGM notice URL with no RFP keyword in the snippet is imported instead of producing `search_no_candidates`.
- Added regression coverage proving RFQ language is accepted as a tender signal while a generic buyer archive result is ignored.
- `npx vitest run __tests__/actions/discovery-opportunity-import.test.ts` passed with 39 tests.
- `npx tsc --noEmit --pretty false` passed.
- Bounded live probe against `site:ungm.org/Public/Notice "Request for Proposal"` did not provide acceptance evidence because the primary SearXNG response produced no accepted results for that exact query, public fallbacks returned 403/429, and the local DB connection for the zero-record audit insert was refused at `88.80.188.224:5432`.
- Corrected live script-path probe `live_search_acceptance_probe_20260529`, using forced local env against `db.lindela.io`, completed successfully in search-only mode: 12 records, 0 imported, 12 updated, 0 failed, 0 source-document downloads by design, and 175 warnings dominated by SearXNG engine degradation/public fallback 403/429 noise.

Remaining after this slice:
- Continue live broad discovery through the normal scripts, which force local DB env, and compare `search_no_candidates` frequency against the prior runs.
- Add trusted `SEARXNG_FALLBACK_URLS` instances; public `searx.space` fallback remained rate-limited during the probe.

### 2026-05-29 - SearXNG Fallback Covers Partial Engine Degradation

Status: implemented, unit-verified, and typechecked.

Purpose: ensure `searx.space` fallback fan-out is used when `search.lindela.io` returns only partial engine coverage, not just when the primary search fails or returns zero results.

Changes in this slice:
- Changed SearXNG fallback selection so requested-engine degradation triggers fallback fan-out even when the primary host returned some results.
- Merged primary results with fallback instance results in partial-degradation cases, preserving the local host's usable hits while adding recovered results from fallback instances.
- Preserved provenance through `sourceInstances`, `fallbackFrom`, and `fallbackReason` so discovery warnings show when a result set came from primary plus fallback fan-out.
- Added equivalent fallback merging to the Python `DefaultDiscoveryService` path so agent/backend discovery is not left single-instance-only.
- Updated the opportunity discovery runbook to describe partial-degradation fallback behavior.

Verification:
- Added a regression test proving that a primary response with one usable result plus a degraded requested engine still queries a `searx.space` fallback instance and returns the merged two-result set.
- `npx vitest run __tests__/services/searxng-client-config.test.ts` passed with 12 tests.
- `npx tsc --noEmit --pretty false` passed.
- `uv run pytest tests/ci/test_discovery_service_contract.py -q` passed with 6 tests.
- Forced-primary-failure live probe attempted three public `searx.space` fallback instances; all returned 429, confirming that public fallback is being reached but remains unreliable under server-side traffic.

Remaining after this slice:
- Public `searx.space` instances remain opportunistic and often reject server-side API traffic. A trusted `SEARXNG_FALLBACK_URLS` pool would materially improve reliability.
- Continue live discovery runs to confirm the added fallback path increases accepted RFP candidates under real engine throttling.

### 2026-05-29 - Broad Reseed Adds Fresh RFP Documents And Requirements

Status: live-run, downloaded, parsed, and verified.

Purpose: turn the improved source intake selector into concrete RFP growth by reseeding fresh source documents, downloading a bounded high-signal batch, and draining parser jobs to requirements.

Changes in this slice:
- Ran a bounded broad live discovery import with default RFP queries and configured sources, downloads disabled, to seed fresh source-document rows without spending the import run on downloads.
- Ran source-document intake with failed retries disabled so the new fresh source backlog, not old protected failures, was selected.
- Drained all queued parser jobs created by that intake pass.

Verification:
- Live broad discovery import `live_broad_reseed_after_retry_backpressure_20260529` processed 229 records, imported 126 new opportunities, updated 103 existing opportunities, failed 0 imports, created 49 source-document rows, reused 79 existing source-document rows, and attempted 0 downloads by design.
- Source health from that run: 20 healthy configured sources, 4 empty/degraded/no-yield sources, and 1 failed source (`https://www.ppra.go.tz/tenders`, where Firecrawl and browser fallback both failed).
- Post-reseed dry-run `source_intake_after_broad_reseed_dryrun_20260529` selected 25 fresh direct PDF/DOCX source documents with 0 DGMarket rows.
- Live source intake `source_intake_after_broad_reseed_live_20260529` selected 12 fresh source documents, downloaded 12, failed 0, and queued 12 parser jobs. Local `pdftotext` handled the PDF downloads, and scrape/search recovery converted blocked or missing source URLs for IUCN and African Climate Foundation into parseable HTML.
- Queued parse drain `queued_parse_after_broad_reseed_intake_20260529` selected 12 jobs, completed 12, failed 0, and extracted 113 requirements.
- Post-run live database snapshot: 3,117 opportunities, 149 RFP documents, 147 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 931 requirements, 121 RFP documents with requirements, 423 selected source-document rows, 187 downloaded source-document rows, and 74 failed source-document rows.

Remaining after this slice:
- Continue draining the fresh direct source-document backlog in bounded batches.
- Improve query acceptance for broad SearXNG queries that returned no accepted opportunity candidates even when the search host responded.
- Investigate PPRA Tanzania browser fallback mismatch: the deployed browser service returned `Cannot POST /v1/scrape` and `/scrape` failed, so that source remains failed.

### 2026-05-29 - Source Intake Stops Protected 403 Hosts From Crowding Retry Batches

Status: implemented, dry-run verified, and typechecked.

Purpose: keep RFP source-document intake focused on recoverable rows after live probes showed DGMarket 403 failures dominating retry-enabled batches.

Changes in this slice:
- Added retry backpressure for known protected 403 hosts, currently DGMarket, so routine retry mode suppresses those rows unless `SOURCE_DOCUMENT_INTAKE_RETRY_PROTECTED_HOSTS=1` is set.
- Added `SOURCE_DOCUMENT_INTAKE_FILL_MAX_PER_HOST` so the second fill pass can relax host diversity without allowing one host to consume the entire batch.
- Ordered source-document candidates by direct-document rank and lower download-attempt count before recency, so one-attempt retries are tried before rows that have already failed twice.
- Recorded selected row status and last error in source-document intake proof output so future dry-runs show why a row was eligible.

Verification:
- Live database snapshot before the change: 2,991 opportunities, 137 RFP documents, 135 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 818 requirements, 110 RFP documents with requirements, 374 selected source-document rows, 175 downloaded source-document rows, and 74 failed source-document rows.
- Pre-change dry-run `source_intake_current_selector_probe_20260529` selected 25 rows, including 18 DGMarket rows that had already failed with `HTTP 403: Forbidden`.
- Fresh-only dry-run `source_intake_current_fresh_selector_probe_20260529` selected 0 rows after the non-solicitation filter, proving the remaining immediate queue is retry-focused rather than fresh source intake.
- Post-change dry-run `source_intake_retry_backpressure_probe_20260529` selected 7 rows and 0 DGMarket rows with the default `SOURCE_DOCUMENT_INTAKE_MAX_PER_HOST=2`, `SOURCE_DOCUMENT_INTAKE_FILL_MAX_PER_HOST=6`, and `SOURCE_DOCUMENT_INTAKE_RETRY_PROTECTED_HOSTS=false`.
- Opt-in dry-run `source_intake_retry_protected_optin_probe_20260529` selected 13 rows and capped DGMarket at 6 rows, proving targeted protected-host recovery is still available without batch flooding.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Run a fresh broad discovery import to seed new non-duplicate source-document rows before another live source intake drain.
- DGMarket still needs a portal-specific strategy if it is worth pursuing; routine retries now avoid spending most of the batch there.

### 2026-05-29 - SearXNG Public Fallback Fans Out Instead Of Stopping At First Instance

Status: implemented, live-probed, and verified.

Purpose: keep broad RFP search moving when `search.lindela.io` is unavailable or when requested engine fanout degrades, while recognizing that public `searx.space` instances are best-effort and often reject server-side API traffic.

Changes in this slice:
- Changed fallback search from serial first-success retry to bounded fan-out across configured or `searx.space` fallback instances.
- Deduplicated merged fallback results by normalized URL and preserved provenance with `sourceInstances`, `fallbackFrom`, and `fallbackReason`.
- Updated public instance selection for the current `searx.space` metadata shape by honoring `timing.search.success_percentage` and `timing.search.all.value`.
- Added parsing for standard SearXNG HTML result pages when a reachable instance does not return JSON.
- Raised the default public fallback limit from 4 to 8 because live probes showed the first several public instances commonly returned 403/429 to server-side JSON/API requests.

Verification:
- `npx vitest run __tests__/services/searxng-client-config.test.ts __tests__/services/rfp-document-service.test.ts` passed with 44 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live primary probe against `https://search.lindela.io` for `site:ungm.org RFP software development` across `google`, `duckduckgo`, `bing`, and `brave` returned 10 results; Brave reported `too many requests`, but DuckDuckGo returned UNGM RFP hits.
- Forced-public fallback probe with `SEARXNG_URL=http://127.0.0.1:1` confirmed the code fans out to public instances, but the public pool still returned 403/429 or no usable result for that server-side query. This is a coverage safety net, not a substitute for keeping `search.lindela.io` healthy.

Remaining after this slice:
- Configure a small trusted `SEARXNG_FALLBACK_URLS` pool if we operate additional private SearXNG instances; public instances are too inconsistent to be the only fallback.
- Continue monitoring warnings for engine-level degradation so missed RFP coverage is visible in discovery proof logs.

### 2026-05-29 - Protected Tender Pages Get Original-Page Scrape Recovery

Status: implemented, unit-verified, live DGMarket still blocked.

Purpose: recover source-document rows where the discovered URL is a tender detail page rather than a direct file, especially protected portals that return 403 to server-side direct fetches.

Changes in this slice:
- After search recovery candidates are exhausted, the source-document downloader now scrapes the original blocked source URL through the Firecrawl -> browser -> CloakBrowser ladder instead of only doing this for URLs that look like direct documents.
- Added a separate scrape-content acceptance gate so recovered landing-page content can be accepted without weakening the stricter final stored-HTML extraction gate.
- Expanded HTML RFP text signals and word counting for French, Spanish, and Cyrillic procurement language so non-English tender pages are not rejected by an ASCII-only gate.

Verification:
- `npx vitest run __tests__/services/rfp-document-service.test.ts` passed with 33 tests.
- Direct live retry of DGMarket document `f02c6466-3096-4d7d-b20b-818651ab19a4` still failed with `HTTP 403: Forbidden`; public SearXNG fallback candidates also mostly returned 403/429, and the source page scrape did not yield usable recoverable content.

Remaining after this slice:
- DGMarket remains a protected-source failure path. Keep it in failure telemetry, but do not let it crowd out higher-yield sources in routine source-document intake.
- If DGMarket is business-critical, it likely needs a portal-specific authenticated/feed path or a dedicated browser session strategy rather than generic SearXNG and Firecrawl recovery.

### 2026-05-28 - Source Intake Selector Fills Underused Batches

Status: implemented, live-run, parsed, and verified.

Purpose: keep routine source-document intake broad while preventing host diversity limits from underfilling the batch when only one or two high-yield hosts remain.

Changes in this slice:
- Kept the first source-intake selection pass host-diverse.
- Added a second fill pass that adds still-unseen eligible rows when the host cap leaves unused capacity.
- Preserved URL de-duplication so the fill pass does not select the same source twice.

Verification:
- `npx tsc --noEmit --pretty false` passed.
- Before this change, a default dry-run source intake selected only 4 rows after the high-yield binary drain.
- After this change, default dry-run source intake `source_document_intake_20260528T211522Z` selected 22 eligible rows with the same `SOURCE_DOCUMENT_INTAKE_LIMIT=25` and `SOURCE_DOCUMENT_INTAKE_MAX_PER_HOST=2` configuration.
- Live source-document intake run `source_intake_filled_selector_20260528T2118` selected 22 rows under the default host cap, downloaded 13 recovered World Bank HTML pages, failed 9 DGMarket 403 rows, and queued 13 parse jobs.
- Live queued-parse drain `queued_parse_after_filled_selector_20260528T2121` processed 13 parse jobs, completed 13, failed 0, and extracted 73 requirements.
- Post-run live database snapshot: 2,991 opportunities, 137 RFP documents, 135 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 818 requirements, 110 RFP documents with requirements, 125 selected discovered source documents, 175 downloaded source documents, and 74 failed source documents.

Remaining after this slice:
- DGMarket remains protected and likely needs a different recovery path than public SearXNG fallback.
- Continue selector analysis on the remaining 125 selected discovered rows; easy World Bank shell recovery is now working, while protected DGMarket rows dominate failures.

### 2026-05-28 - Direct HTML Shells Recover Through Scraping Before Storage

Status: implemented, live-run, parsed, and verified.

Purpose: recover RFP/RFQ detail from client-rendered source pages, especially World Bank procurement detail pages that direct server fetches return as 84-character HTML shells.

Changes in this slice:
- Moved source-document text extraction before storage so unusable direct HTML can be detected before the stored artifact and parse queue decision are finalized.
- Added scrape recovery for direct HTML pages whose fetched content fails the HTML RFP quality gate.
- Reused the existing Firecrawl -> browser service -> CloakBrowser recovery ladder and stored the recovered markdown-as-HTML page only when it produced usable RFP text.
- Added regression coverage proving a direct HTML shell is scraped, extracted, stored, and queued, while sparse HTML still avoids parser queueing.

Verification:
- `npx vitest run __tests__/services/rfp-document-service.test.ts` passed with 31 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live source-document intake run `source_intake_direct_html_recovery_20260528T2105` selected 20 HTML source rows with `SOURCE_DOCUMENT_INTAKE_MAX_PER_HOST=10`, downloaded 10 World Bank pages after direct-HTML scrape recovery, failed 10 DGMarket 403 rows, and queued 10 parse jobs. The recovered World Bank pages extracted between 4,086 and 88,268 characters instead of the 84-character direct-fetch shell.
- Live queued-parse drain `queued_parse_after_direct_html_recovery_20260528T2109` processed 10 parse jobs, completed 10, failed 0, and extracted 40 requirements.
- Post-run live database snapshot: 2,991 opportunities, 124 RFP documents, 122 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 745 requirements, 99 RFP documents with requirements, 147 selected discovered source documents, 162 downloaded source documents, and 65 failed source documents.

Remaining after this slice:
- DGMarket remains a hard protected-source failure path; current fallback searches against public SearXNG instances often return 403/429.
- Add a selector/retry mode that can safely raise `SOURCE_DOCUMENT_INTAKE_MAX_PER_HOST` for high-yield hosts like World Bank without over-focusing routine runs on one domain.

### 2026-05-28 - Eligible Binary Source Drain Reaches Diminishing Returns

Status: live-run, parsed, and selector rechecked.

Purpose: finish the remaining high-yield eligible source-document drain before switching from raw intake to selector/recovery improvements.

Changes in this slice:
- Ran a third bounded source-document intake pass against the remaining eligible rows under the current selector.
- Processed the parse jobs queued by that pass.
- Rechecked the selector afterward and confirmed the remaining immediately eligible rows are now mostly protected or notice-style HTML pages rather than direct binary RFP documents.

Verification:
- Live source-document intake run `source_intake_backlog_drain2_20260528T2056` selected 6 documents, downloaded 4, failed 2 DGMarket 403 rows, and queued 2 parse jobs.
- Live queued-parse drain `queued_parse_after_backlog_drain2_20260528T2057` processed 2 parse jobs, completed 2, failed 0, and extracted 19 requirements.
- Live source-document intake run `source_intake_backlog_drain3_20260528T2059` selected 5 documents, downloaded 3, failed 2 DGMarket 403 rows, and queued 1 parse job.
- Live queued-parse drain `queued_parse_after_backlog_drain3_20260528T2100` processed 1 parse job, completed 1, failed 0, and extracted 8 requirements.
- Post-run live database snapshot: 2,991 opportunities, 114 RFP documents, 112 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 705 requirements, 90 RFP documents with requirements, 167 selected discovered source documents, 152 downloaded source documents, and 55 failed source documents.
- A follow-up dry-run source intake selected only 4 fresh rows, all HTML/protected notice-style pages.

Remaining after this slice:
- Inspect why 167 selected discovered source rows are not eligible under the current selector; likely causes are unsupported URLs, duplicate-source suppression, stale/deadline filtering, or weak document naming.
- Improve protected-source recovery for DGMarket if those rows are worth keeping; public SearXNG fallback now frequently returns 403/429 for DGMarket-specific recovery queries.

### 2026-05-28 - Second Source Backlog Drain Adds Requirement-Bearing RFPs

Status: live-run and parsed.

Purpose: keep converting selected discovered source documents into downloaded RFP documents and extracted requirements after the HTML quality gate proved safe.

Changes in this slice:
- Ran another bounded source-document intake drain against the remaining selected discovered backlog.
- Processed all parse jobs queued by that drain.
- Confirmed the HTML gate is suppressing non-RFP expert/consultancy notice pages from parser queueing while still allowing an EBRD HTML procurement notice with requirement-bearing content through.

Verification:
- Live source-document intake run `source_intake_backlog_drain_20260528T2051` selected 8 source documents, downloaded 7, failed 1 DGMarket 403, and queued 4 parse jobs.
- Live queued-parse drain `queued_parse_after_backlog_drain_20260528T2052` processed 4 parse jobs, completed 4, failed 0, and extracted 28 requirements.
- Post-run live database snapshot: 2,991 opportunities, 111 RFP documents, 109 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 678 requirements, 87 RFP documents with requirements, 178 selected discovered source documents, 145 downloaded source documents, and 51 failed source documents.

Remaining after this slice:
- DGMarket remains the most visible protected-source failure mode: some pages recover through public search/cache paths, while others return hard 403 after fallback attempts.
- Continue draining selected discovered source documents and prioritize direct binary/high-yield source rows before weaker HTML notice pages.

### 2026-05-28 - Sparse HTML RFP Shells No Longer Enter The Parser Queue

Status: implemented and verified.

Purpose: keep broad RFP intake from treating portal shells and near-empty HTML pages as successful parse inputs while still accepting substantive HTML tender/RFP notices as source documents.

Changes in this slice:
- Added HTML and HTM as first-class discovered source-document extensions.
- Allowed direct `.html` and `.htm` source pages to be evaluated directly instead of being mistaken for blocked PDF/DOC downloads that need recovery.
- Raised the local and DocLing HTML extraction gate so HTML output must be substantive and include procurement/RFP language before it can seed parser text.
- Stopped queueing HTML documents for parsing when no usable extracted text is available; they remain stored with a `stored_unparseable` ingest workflow instead of becoming completed zero-requirement parses.
- Added regression coverage for both sparse HTML rejection and substantive HTML RFP acceptance.

Verification:
- `npx vitest run __tests__/services/rfp-document-service.test.ts` passed with 30 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live source-document intake run `source_intake_html_gate_live_20260528T2042` selected 10 discovered source documents, downloaded 9, failed 1 DGMarket 403, and queued 7 parse jobs. The run proved lightweight extraction paths in production data: 2 XLSX documents used local spreadsheet extraction, 3 PDFs used `pdftotext`, 2 substantive HTML pages queued, and 2 sparse World Bank HTML pages were stored without parser jobs after yielding only 84 characters.
- Live queued-parse drain `queued_parse_after_html_gate_live_20260528T2044` processed 7 queued parse jobs, completed 7, failed 0, and extracted 35 requirements.
- Post-run live database snapshot: 2,991 opportunities, 107 RFP documents, 105 completed RFP documents, 0 queued parse jobs, 8 failed parse jobs, 650 requirements, 83 RFP documents with requirements, 186 selected discovered source documents, 138 downloaded source documents, and 50 failed source documents.

Remaining after this slice:
- Continue fixing browser/CloakBrowser recovery for protected source-document pages that still block direct retrieval.
- Distinguish substantive procurement notice pages from full requirement-bearing RFP/RFQ documents; two live HTML pages had enough content to parse but still produced zero requirements.
- Continue bounded source-document intake against the remaining discovered source documents, then feed high-fit completed parses into response-package backfill.

### 2026-05-28 - SearXNG Can Fall Back Through Public Instance Discovery

Status: implemented and verified with a forced-primary-failure live probe.

Purpose: keep broad RFP search running when `search.lindela.io` is unavailable or fails to deliver the requested engine fanout.

Changes in this slice:
- Added SearXNG fallback search support after primary search failure or after a requested-engine degradation returns an empty result set.
- Added `SEARXNG_FALLBACK_URLS` for a trusted static fallback pool.
- Added public fallback discovery from `https://searx.space/data/instances.json`, filtering failed/non-normal instances and limiting attempts with `SEARXNG_PUBLIC_FALLBACK_LIMIT`.
- Added fallback provenance on search responses so discovery warnings can show when a primary SearXNG request recovered through another instance.
- Documented fallback configuration and the privacy-sensitive `SEARXNG_PUBLIC_FALLBACKS=0` disable switch in the opportunity-discovery runbook.

Verification:
- `npx vitest run __tests__/services/searxng-client-config.test.ts __tests__/actions/discovery-opportunity-import.test.ts` passed with 46 tests.
- `npx tsc --noEmit --pretty false` passed.
- Forced-primary-failure live probe with `SEARXNG_URL=http://127.0.0.1:9` and `SEARXNG_PUBLIC_FALLBACK_LIMIT=8` recovered through public instance `https://search.mdosch.de` and returned 10 results for `"request for proposals" procurement deadline`.
- A narrower UNGM site-restricted live probe demonstrated the realistic degradation path: several public instances rejected JSON/API access or had engine degradation, so the fallback pool helps but does not replace our own reliable SearXNG host.

Remaining after this slice:
- Add a trusted operator-controlled `SEARXNG_FALLBACK_URLS` pool if we want higher reliability than opportunistic public instances.
- Continue fixing browser/CloakBrowser recovery for protected source-document pages.

### 2026-05-28 - Broad RFP Search Runs Wider And In Parallel

Status: implemented, live-run, parsed, and verified.

Purpose: increase the number of RFPs the platform can source by widening default search coverage, using SearXNG fanout across Google, DuckDuckGo, Bing, and Brave without serial engine blocking, and converting the resulting source-document backlog into parsed RFP requirement data.

Changes in this slice:
- Expanded the broad default discovery profile from 24 to 37 RFP-intent queries, adding monitoring and evaluation, data platforms, ERP, cybersecurity, ICT equipment, consulting EOIs, digital health, UN Development Business, USAID, Kenya PPIP, South Africa eTenders, Tanzania PPRA, and Uganda eGP search coverage.
- Expanded configured source coverage from 20 to 25 sources with UN Development Business, USAID business forecast, South Africa eTenders, Tanzania PPRA, and Uganda eGP.
- Kept default SearXNG engine coverage on `google`, `duckduckgo`, `bing`, and `brave`, and changed the importer search phase to bounded parallel fanout so denied or slow engines do not serialize broad collection.
- Increased default broad discovery document seeding to 20 downloads, with a hard per-run cap of 25.
- Kept lightweight extraction ahead of expensive fallbacks for RFP intake: PDFs use `pdftotext`, XLSX/DOCX use local extractors, and queued parser PDF recovery now reuses `pdftotext` before `pdf-parse`.
- Updated the opportunity-discovery runbook to match the wider engine/source/query behavior.

Verification:
- `npx vitest run __tests__/services/default-discovery-sources.test.ts __tests__/actions/discovery-opportunity-import.test.ts __tests__/services/rfp-document-service.test.ts __tests__/actions/rfp-parse-workflow.test.ts __tests__/actions/platform-proof-scenarios.test.ts` passed with 90 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live broad discovery run `live_broad_search_sweep_expanded_parallel_20260528T1932` searched 37 default queries across Google, DuckDuckGo, Bing, and Brave through SearXNG, scraped 25 configured sources, produced 187 records, imported 29 new opportunities, updated 158 existing opportunities, and failed 0 imports.
- Live source-document intake `source_intake_after_expanded_parallel_sweep_20260528T1938` selected 21 discovered artifacts, downloaded 17, failed 4 protected/problem portal rows, and confirmed local extraction in live logs for PDFs and XLSX.
- Queued parse processing `queued_parse_after_expanded_source_intake_20260528T1940` selected 15 queued parse jobs, completed 15, failed 0, and extracted 110 requirements.
- Post-run live database snapshot: 2,991 opportunities, 100 RFP documents, 98 completed RFP parses, 2 failed RFP parses, 0 queued parse jobs, 615 requirements, 78 RFP documents with requirements, 208 discovered source documents, 129 downloaded source documents, and 49 failed source documents.

Remaining after this slice:
- Fix the browser fallback service contract or configure CloakBrowser; protected/problem sources still include DGMarket 403s, Tanzania PPRA timeout/fallback failure, Uganda eGP fetch/fallback failure, and some EBRD pages that require stronger recovery.
- Raise the quality gate for very short HTML extraction; several low-content HTML pages completed parsing but produced 0 requirements.
- Continue bounded source-document intake against the remaining 208 discovered source documents, then feed high-fit completed parses into response-package backfill.

### 2026-05-28 - Three Parsed RFPs Advanced To Final Stored Response Packages

Status: live response-package generation, requirement acceptance, readiness, final artifact publishing, and submission-record dry-run completed.

Purpose: convert parsed RFP intake into governed response packages and final stored artifacts, proving the platform can move from sourced RFP documents to submission-ready response packages.

Changes in this slice:
- Dry-ran response-package backfill `live_response_package_backfill_dryrun_20260528T1241` against parse-review-ready RFPs; 3 candidates passed the unattended pursuit-fit floor and 2 lower-fit candidates were skipped.
- Applied response-package backfill `live_response_package_backfill_apply_20260528T1242`, creating 18 draft response/proposal documents and 3 win-theme seeds across 3 opportunities.
- Dry-ran then applied requirement acceptance `live_requirement_acceptance_apply_20260528T1244`, accepting 36 parse-review-ready requirements with response-document links and workflow receipts.
- Dry-ran then applied response readiness `live_response_readiness_apply_20260528T1246`, moving all 3 packages to `ready_for_review`, creating/refreshing compliance matrices with 36 entries, and opening downstream review/final-render tasks.
- Fixed `run-final-artifact-publish.ts` so workflow-runtime DB imports happen after local env forcing; this prevents stale shell-level `DATABASE_URL` from binding the Node DB pool before scripts can target `db.lindela.io`.
- Dry-ran then applied final artifact publishing `live_final_artifact_publish_apply_20260528T1253`, rendering and storing 18 DOCX final artifacts with storage readback verification and locking 3 compliance matrices.
- Dry-ran final submission recording `live_final_submission_record_dryrun_20260528T1256`, confirming all 3 finalized packages are ready to record a real external submission receipt without fabricating one.

Verification:
- `npx tsc --noEmit --pretty false` passed.
- Post-fix final artifact dry run without manual env sourcing completed with 0 eligible candidates after publishing, proving the script no longer binds the stale shell-level database URL and does not republish finalized documents.
- Live final artifact publish reported 18/18 documents published, 18 storage readbacks, and 3/3 compliance matrices locked.
- Direct database verification showed 28 final proposal documents overall, 24 documents with final artifact metadata overall, and for the 3 newly finalized opportunities: 18/18 proposal documents final, 18/18 final artifacts present, 18/18 artifact hashes matching storage readback hashes, and minimum readback size 10,935 bytes.
- Submission dry run found all 3 finalized packages `readyToRecord: true`, with 0 blockers, 6 attachments each, locked compliance matrices, response-readiness workflow IDs, and 0 blocking DLP findings.

Remaining after this slice:
- Record submission receipts only after real portal/email/physical confirmation references exist.
- Continue parse-quality review for the 34 remaining `needs_review` RFP parses and continue direct RFP intake.

### 2026-05-28 - Configured Source Discovery Has CloakBrowser Last-Resort Fallback

Status: implemented and verified in focused regression coverage; live AFDB proof still requires a configured CloakBrowser CDP endpoint.

Purpose: keep broad RFP sourcing from stopping at protected configured-source pages when Firecrawl and the standard browser service cannot recover usable tender listings.

Changes in this slice:
- Added CloakBrowser as a last-resort configured-source scrape path after Firecrawl and the existing browser fallback fail or return content the source parser cannot use.
- Kept the existing configured-source order intact: source APIs and browser-primary JavaScript sources still use their faster/specific paths first.
- Added explicit `cloakbrowser_fallback` scrape metadata and audit warning types so source health can distinguish stealth-browser recovery from normal browser fallback.
- Gated the fallback on `CLOAKBROWSER_CDP_URL`, `CLOAKBROWSER_WS_ENDPOINT`, or `CLOAKBROWSER_REMOTE_DEBUGGING_URL` being configured, avoiding noisy failed attempts where CloakBrowser is not available.

Verification:
- `npm test -- discovery-opportunity-import.test.ts --run` passed with 34 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check -- frontend/lib/services/opportunity-discovery-import.ts frontend/__tests__/actions/discovery-opportunity-import.test.ts` passed.
- Local env inspection found no configured CloakBrowser endpoint in the checked frontend env files, so live AFDB remains blocked at infrastructure/configuration rather than importer code.

Remaining after this slice:
- Configure a real CloakBrowser CDP endpoint, then rerun the AFDB configured-source proof/import.
- Keep direct document intake draining while protected source pages are handled through this stronger fallback path.

### 2026-05-28 - Direct Source Document Intake Drained Another Bounded Batch

Status: live batch completed and verified.

Purpose: convert already discovered direct RFP artifacts into parsed RFP documents and requirements using the lightweight PDF extraction path before continuing broader sourcing.

Changes in this slice:
- Ran dry-run source document intake `source_document_intake_dryrun_20260528T1230` to confirm the selector prioritized direct Kenya PPIP and AIIB artifacts.
- Ran live intake `source_document_intake_direct_batch_20260528T1231` against 10 direct artifacts: 9 PDFs and 1 XLSX.
- The PDF files used `local_pdftotext`; the XLSX used the existing document parsing path.

Verification:
- Live intake downloaded 10/10 selected source documents.
- Live intake completed 10/10 parse jobs, with 0 failed parses and 0 parse timeouts.
- The run extracted 60 requirements directly from the selected batch.
- Post-run database snapshot: opportunity documents moved to 51 downloaded and 240 discovered; RFP documents increased to 44; RFP requirements increased to 232; parsing jobs showed 40 completed, 3 processing, and 2 failed.

Remaining after this slice:
- Continue bounded direct-artifact intake batches.
- Use the parsed RFP backlog to feed the governed response-package backfill and readiness workflow.

### 2026-05-28 - PDF RFP Intake Uses Lightweight Extraction Before Docling

Status: implemented and verified.

Purpose: make high-volume RFP document intake cheaper and more resilient by extracting PDF text locally before using the remote Docling service.

Changes in this slice:
- Changed PDF extraction in `lib/services/rfp-document-service.ts` to run local `pdftotext` first for PDFs.
- Docling is now the second path for PDFs, used only when `pdftotext` cannot produce usable text.
- Kept the existing JS `pdf-parse` fallback after Docling so ingestion can still complete when both `pdftotext` and Docling fail.
- Added regression coverage proving successful `pdftotext` extraction prevents Docling and `pdf-parse` from running.

Verification:
- `npx tsc --noEmit --pretty false` passed.
- `npm test -- rfp-document-service.test.ts --run` passed with 24 tests.
- Live source-health run `live_source_health_20260528T1148` produced 72 records, including 13 newly imported opportunities and 12 newly created source-document rows; it also showed SearXNG query degradation and AFDB source emptiness, making direct configured-source document intake more important.
- Live source-document intake run `source_document_intake_20260528T1158` drained 10 discovered Kenya PPIP PDF RFP documents: 10/10 downloaded, 10/10 parse jobs completed, 0 failures, 0 timeouts, and 84 requirements extracted. Docling was unstable during that run, but local PDF fallback preserved intake.
- Live proof run `source_document_intake_pdftotext_first_20260528T1217` downloaded and parsed one additional PDF using `local_pdftotext` first, without needing Docling, and extracted 18 requirements.
- Post-run database snapshot showed opportunity documents moved to 41 downloaded, RFP documents increased to 34, extracted RFP requirements increased to 162, and completed parsing jobs increased to 30.

Remaining after this slice:
- Continue draining the remaining discovered document backlog in bounded batches.
- Fix or route around AFDB Cloudflare blocking separately; the dedicated AFDB proof still fails because browser fallback receives HTTP 403.

### 2026-05-28 - Final Packages Have a Governed Submission Receipt Path

Status: implemented and verified for dry-run readiness; live submission apply correctly requires a real external receipt reference.

Purpose: close the gap between stored final artifacts and auditable submission history without fabricating portal dispatch evidence.

Changes in this slice:
- Added `scripts/run-final-submission-record.ts`, a bounded service/operator script for final-package submission receipt recording.
- The script selects finalized packages that have not already been submitted, verifies required proposal documents, final approvals, current stored final artifacts with readback receipts, final signoff metadata, compliance matrix lock, response-readiness coverage, high-risk claim clearance, DLP clearance, and deadline status.
- Apply mode inserts a `submissions` row, locks selected attachments to their final artifact storage receipts, marks the opportunity submitted, and records a terminal `production_submission` workflow transition, but only when `LIVE_FINAL_SUBMISSION_RECORD_CONFIRMATION_NUMBER` is supplied.
- Dry-run mode reports whether a package is ready to record and surfaces blockers/warnings without mutating live rows.

Verification:
- `npx tsc --noEmit --pretty false` passed.
- Dry run `live_final_submission_record_20260528T114541Z` assessed finalized opportunity `aa8f3263-3222-4757-b68d-d4b373eb0adb` as `readyToRecord: true` with 0 blockers, 6 final documents, 3 required documents, 6 submission attachments, compliance matrix `4cab1fd7-8da0-41c7-94df-927c9cfee53b`, response-readiness workflow `d6cab4b9-91f5-4ddf-b310-e04955b1fa70`, and 0 DLP findings.
- The dry run emitted only two warnings: no stored submission method, so service default `other` would be used unless supplied, and no evaluator-criteria win-theme coverage was reported because this RFQ has no persisted evaluator criteria.
- Direct database verification after dry run showed 0 submission rows for opportunity `aa8f3263-3222-4757-b68d-d4b373eb0adb` and opportunity decision status still `drafting`, confirming no fake submission receipt was recorded.
- `npm test -- submission-workflow.test.ts final-submission-checklist-workflow.test.ts submissions-scope.test.ts --run` passed with 33 tests.

Remaining after this slice:
- Apply the receipt recorder only after a real portal/email/physical submission confirmation is available.
- Continue expanding RFP sourcing and intake breadth; this path is now ready when final packages need auditable receipt capture.

### 2026-05-28 - Ready Response Packages Publish Stored Final Artifacts

Status: implemented and verified.

Purpose: turn response packages that have passed readiness into approved, stored final DOCX artifacts with object-storage readback receipts instead of leaving them as draft documents.

Changes in this slice:
- Added `scripts/run-final-artifact-publish.ts`, a bounded live-DB publisher for response packages whose `proposal_response_package` readiness is `ready_for_review`.
- The publisher renders each eligible proposal document to DOCX, uploads the artifact to Linode E3, downloads it back, verifies hash and byte size, and stores the artifact manifest on the document metadata.
- It records final artifact render/signoff workflow transitions, marks documents and proposal documents `final`, records final submission signoff metadata, and locks the compliance matrix as final only after artifact readback succeeds.
- It supports targeted runs by opportunity ID and is idempotent after final artifacts already exist.

Verification:
- Dry run `live_final_artifact_publish_20260528T113316Z` found 1 ready response package and 6 eligible proposal documents without mutating live rows.
- Live apply run `live_final_artifact_publish_20260528T113346Z` published 6 DOCX final artifacts for opportunity `aa8f3263-3222-4757-b68d-d4b373eb0adb` and locked the compliance matrix.
- Each artifact was uploaded to Linode E3 and read back with a matching SHA-256 hash; readback sizes ranged from 10,913 to 12,043 bytes.
- Direct database verification showed all 6 proposal documents and linked documents are `final`, each has `finalArtifact` metadata, matching artifact/readback hashes, nonzero readback sizes, and `finalSubmissionSignoff` by `system`.
- Direct database verification showed compliance matrix `4cab1fd7-8da0-41c7-94df-927c9cfee53b` is `final`, approved, has 0 not-addressed requirements, 0 non-compliant requirements, mandatory compliance score 100, and records run id `live_final_artifact_publish_20260528T113346Z`.
- Follow-up targeted apply run `live_final_artifact_publish_20260528T113542Z` found 0 eligible candidates, confirming the selector does not republish finalized documents.

Remaining after this slice:
- Submission dispatch/portal receipt recording remains the next material step after final artifacts are available.
- Replace the service-script `system` approval/signoff actor with an operator-authenticated approval path when running this through the production UI.

### 2026-05-28 - Persisted Response Packages Reach Standard Readiness

Status: implemented and verified.

Purpose: move accepted, backfilled response packages from governed draft state into the platform's standard `ready_for_review` response-readiness workflow without pretending final rendering or approval has already happened.

Changes in this slice:
- Added `scripts/run-response-readiness-pass.ts`, a bounded live-DB readiness pass for persisted proposal response packages with accepted requirements and drafted documents.
- The pass verifies accepted requirement linkage, source citation maps, Datacraft evidence citation maps, Datacraft evidence guidance, review gates, draft artifact hash/size integrity, document word floors, and win-theme targeting.
- It creates or updates compliance matrix coverage for accepted requirements, then records the real `proposal_response_package` workflow receipt and opens the review/final-render runtime tasks when readiness passes.
- It supports targeted runs by opportunity ID and unattended runs that find blocked response-package workflow receipts still needing assessment.

Verification:
- `npx tsc --noEmit --pretty false` passed.
- Dry run `live_response_readiness_pass_20260528T110904Z` assessed opportunity `aa8f3263-3222-4757-b68d-d4b373eb0adb` as `ready_for_review` with 1/1 accepted requirement coverage, 6 drafted documents, 7,155 total draft words, 892 minimum document words, and full source citation, evidence citation, evidence guidance, review gate, and draft artifact integrity coverage.
- Live apply run `live_response_readiness_pass_20260528T110925Z` created compliance matrix `4cab1fd7-8da0-41c7-94df-927c9cfee53b`, recorded 1 compliance entry, updated the existing `proposal_response_package` workflow receipt to `ready_for_review`, and opened the response-package review and final-package render runtime tasks.
- Metadata/status refresh run `live_response_readiness_pass_20260528T112225Z` preserved `ready_for_review`, recorded the actual 2 win-theme seeds, moved 6 proposal documents to `in_review`, and kept the existing compliance matrix and workflow instance.
- Direct database verification showed readiness blockers `[]`, accepted requirement count 1, drafted requirement count 1, requirement coverage 1, source citation coverage 1, evidence citation coverage 1, draft artifact integrity coverage 1, 2 win-theme seeds, run id `live_response_readiness_pass_20260528T112225Z`, and all 6 proposal documents in `in_review`.
- Direct database verification showed the compliance matrix has 1 total requirement, 1 partial requirement, compliance score 60, and the compliance entry is linked to a response document.
- Direct database verification showed runtime tasks `response-package-review:aa8f3263-3222-4757-b68d-d4b373eb0adb` and `final-package-render:aa8f3263-3222-4757-b68d-d4b373eb0adb` are open.
- Follow-up untargeted dry run `live_response_readiness_pass_20260528T111521Z` found 0 remaining blocked eligible packages, proving the selector no longer retries the ready package.

Remaining after this slice:
- Final rendering still correctly waits for proposal-manager review/approval; implement or run the final artifact render/approval path after response review is satisfied.
- Broaden readiness-pass execution to future accepted response packages as more high-fit parsed RFPs are drafted.

### 2026-05-28 - Parse-Reviewed Requirements Advance Into Response Execution

Status: implemented and verified.

Purpose: remove the pending-requirement-acceptance blocker from backfilled response packages without bypassing parse-confidence review or accepting unreviewed requirements.

Changes in this slice:
- Added `scripts/run-requirement-acceptance-backfill.ts`, a bounded live-DB backfill for requirements from RFP documents whose parse review is `accepted` or `auto_accepted` with no quality-signal flags.
- The backfill requires source trace, category, priority, a real owner, a real due date, and a matching response document before accepting a requirement. Owner and due date may come from persisted requirement/opportunity data or explicit operator-supplied defaults, but are not silently invented.
- Accepted requirements are linked to the matching response document, moved to `partial` compliance when previously unaddressed, recorded through the workflow runtime, and assigned an open runtime writing task.
- The script detects whether the live legacy `proposal_tasks` table supports the richer Drizzle projection; on `db.lindela.io` it does not, so the script uses workflow runtime tasks instead of crashing or writing incompatible task rows.
- Existing `proposal_response_package` workflow receipts are refreshed after acceptance so accepted-requirement counts are current while draft coverage remains blocked for the standard response readiness pass.

Verification:
- `npx tsc --noEmit --pretty false` passed.
- Dry run `live_requirement_acceptance_backfill_20260528T104903Z` found 1 eligible parse-review-ready requirement and confirmed `proposalTaskProjection: not-supported`.
- Live run `live_requirement_acceptance_backfill_20260528T104915Z` accepted requirement `67cfc4a8-231e-4e36-b0f7-aa0fa030485d`, linked response document `2dc80e4b-553a-49dc-b86a-2f38c556b585`, and skipped 0 requirements.
- Post-run database verification showed the requirement is `partial`, workflow state `accepted`, and has a linked response document.
- The refreshed response-package receipt for opportunity `aa8f3263-3222-4757-b68d-d4b373eb0adb` remains honestly `blocked`, but only for the standard response readiness pass.
- A workflow runtime task `requirement-writing:67cfc4a8-231e-4e36-b0f7-aa0fa030485d` exists, is open, assigned to `system`, and due on 2026-06-10.
- Follow-up dry run `live_requirement_acceptance_backfill_20260528T105245Z` found 0 remaining eligible requirements, confirming the acceptance path is idempotent after apply.
- Receipt refresh run `live_requirement_acceptance_backfill_20260528T105858Z` kept accepted requirement count at 1 but reset drafted requirement count and requirement coverage to 0 until the standard response readiness pass proves draft coverage.

Remaining after this slice:
- Run the standard response readiness pass so fully drafted packages can move from governed draft state toward final rendering.
- Decide whether to migrate the live `proposal_tasks` table to the richer task projection or keep requirement execution on the workflow runtime task layer.

### 2026-05-28 - Parsed RFPs Backfill Into Persisted Response Packages

Status: implemented and verified.

Purpose: turn already parsed live RFP documents into usable, persisted response packages instead of leaving source-grounded drafting as proof-only or manual UI work.

Changes in this slice:
- Added `scripts/run-response-package-backfill.ts`, a bounded live-DB backfill for parsed RFP documents that have requirements but no proposal documents yet.
- The backfill builds the same source-grounded Datacraft response package used by live readiness proofs, then persists response documents, proposal-document links, document versions, win-theme seeds, and a response-package workflow receipt.
- It respects parse-confidence review by default, only selecting `accepted` or `auto_accepted` RFP parses with no quality-signal review flags unless explicitly overridden.
- It does not force requirement acceptance; packages with pending requirement acceptance are drafted and blocked honestly from final rendering until the normal requirement review/acceptance workflow runs.
- Added a default unattended pursuit-fit floor of 60/100 so poor-fit parsed RFPs are skipped unless an operator explicitly overrides the threshold.
- The script is idempotent for opportunities that already have proposal documents and defaults to dry-run unless `LIVE_RESPONSE_BACKFILL_DRY_RUN=0` is set.

Verification:
- `npx tsc --noEmit --pretty false` passed.
- Review pass caught three real integration risks before commit: parse-review gating, unsafe requirement acceptance, and missing response-package workflow receipt; the script was updated before committing.
- A premature live package created before the parse-review fix was removed: 6 generated documents and 2 generated win themes were deleted, and 11 requirements were restored to review/not-addressed state.
- Dry run `live_response_package_backfill_20260528T102640Z` found 3 parse-review-ready candidates; it qualified the auto-accepted AV equipment RFQ with fit 83/100 and skipped two low-fit packages below the 60/100 fit floor.
- A superseded live package created before the structured-content/readiness fix was removed: 6 generated documents, 2 generated win themes, and 1 generated workflow receipt were deleted.
- Live run `live_response_package_backfill_20260528T103330Z` persisted draft response documents and win themes for auto-accepted opportunity `Request for Quotation: Supply and Delivery of Various Audio-Visual (AV) Equipment and Related Items`.
- Post-run database verification for opportunity `aa8f3263-3222-4757-b68d-d4b373eb0adb`: 6 proposal documents, 6 response documents, 2 win themes, 7,155 total draft words, and 892 minimum draft words.
- Stored document content uses structured Tiptap nodes; the first persisted node type is `heading`, not a raw markdown paragraph.
- The recorded `proposal_response_package` workflow receipt is `blocked`, with requirement coverage `0` and blockers for the standard readiness pass plus pending requirement acceptance.
- Global live database counts moved to 23 RFP documents, 60 RFP requirements, 13 proposal documents, 13 response documents, and 2 win themes.
- `npm test -- live-response-package.test.ts --run` passed with 21 tests.
- `git diff --check` passed.

Remaining after this slice:
- Continue running the backfill in bounded batches as more high-fit parsed RFPs accumulate.
- Add a controlled service path for accepting parse-review-ready requirements, or route the generated blocked workflow tasks to proposal managers, so drafted packages can move to final-render readiness without bypassing authority gates.
- Add an operator-facing queue view for parsed RFPs skipped by the pursuit-fit floor so bid/no-bid review can override intentionally.

### 2026-05-28 - Source Intake Prioritizes Direct RFP Artifacts

Status: implemented and verified.

Purpose: move the growing source-document backlog into parsed RFP documents and requirements by preventing protected portal HTML rows from crowding out direct downloadable artifacts.

Changes in this slice:
- Added DOC/XLS/XLSX to the source-document intake selector so formats already supported by the downloader/parser are eligible for scheduled intake.
- Ranked direct document URLs and direct document filenames ahead of HTML/portal rows during source-document intake selection.
- Preserved HTML eligibility for later portal-page intake, but stopped newest protected aggregator pages from consuming the first intake slots when direct PDFs/XLSX/ZIPs are available.

Verification:
- Initial live intake run `source_document_intake_20260528T0953` selected five fresh DGMarket `.html` portal rows and failed all five with HTTP 403, proving the selection order was blocking useful intake.
- Dry run `source_document_intake_dryrun_20260528T0955` selected five direct AIIB artifacts after the ranking change: four PDFs and one XLSX.
- Live intake `source_document_intake_20260528T0955` downloaded 5/5 direct AIIB artifacts, completed 5/5 parse jobs, had 0 failures and 0 timeouts, and extracted 16 total requirements.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- Post-run live database snapshot: 2,847 opportunities, 1,631 RFP opportunities, 291 source documents, 30 downloaded source documents, 23 RFP documents, and 60 extracted requirements.

Remaining after this slice:
- Add a dedicated strategy for protected DGMarket portal pages instead of retrying them as direct RFP documents.
- Continue draining direct source-document backlog in bounded batches while monitoring parse yield and document quality.

### 2026-05-28 - JavaScript Sources Use Browser as Primary Collection

Status: implemented and verified.

Purpose: remove false degradation and wasted Firecrawl attempts for configured sources that are known to require JavaScript rendering, starting with UN Procurement.

Changes in this slice:
- Honored parser `requiresJavascript` in configured-source imports by using the browser service as the primary source collection path when browser collection is enabled.
- Added `browser_source` scrape metadata so intentional browser-primary collection is distinguishable from emergency browser fallback.
- Kept browser fallback warnings for true fallback cases while avoiding degradation warnings for sources whose expected path is browser rendering.
- Updated UN Procurement regression coverage to prove Firecrawl is skipped and no warning is emitted when browser-primary collection succeeds.

Verification:
- `npm test -- discovery-opportunity-import.test.ts un-procurement-parser.test.ts --run` passed with 34 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- A source-only broad live import before this change, run `live_source_health_20260528T0940`, produced 152 candidates and 37 source-document rows but marked UN Procurement as degraded because it used browser fallback after Firecrawl found no opportunities.
- `LIVE_DISCOVERY_IMPORT_RUN_ID=live_un_procurement_browser_source_20260528T0949 LIVE_DISCOVERY_IMPORT_SOURCE_URLS='https://www.un.org/procurement/solicitations-opportunities' LIVE_DISCOVERY_IMPORT_SOURCE_SCRAPE_LIMIT=5 LIVE_DISCOVERY_IMPORT_SCRAPE_LIMIT=0 LIVE_DISCOVERY_IMPORT_BROWSER_FALLBACK_LIMIT=0 LIVE_DISCOVERY_IMPORT_DOWNLOAD_DOCUMENTS=0 npx tsx scripts/run-live-discovery-import.ts` passed; UN Procurement used the browser source path, returned 1 candidate, updated 1 opportunity, reused 1 source document, and produced 0 warnings with healthy source status.

Remaining after this slice:
- Re-run a full source-health import after the next sourcing slice to confirm all configured sources remain healthy together and the duplicate World Bank source does not distort health reporting.
- Add source-specific browser-primary routing for any future parser that genuinely requires JavaScript instead of treating browser rendering as an exceptional fallback.

### 2026-05-28 - World Bank Collection Uses Public Notice API

Status: implemented and verified.

Purpose: remove a Firecrawl dependency from World Bank procurement collection so a high-value global development-bank source can reliably produce current opportunities through its public notice API.

Changes in this slice:
- Made the World Bank parser fetch the public procurement notice list API when invoked as a configured source without scraped page content.
- Treated `world_bank` as a source-API parser in live imports and live source proofs, matching the direct paths already used for SAM.gov, EU Funding & Tenders, ADB, and AIIB.
- Kept existing detail enrichment from the World Bank notice detail API so imported opportunities retain borrower reference, procurement method, deadline, contact, and notice text.

Verification:
- `npm test -- world-bank-parser.test.ts discovery-opportunity-import.test.ts default-discovery-sources.test.ts --run` passed with 40 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- `LIVE_SOURCE_DISCOVERY_URL='https://projects.worldbank.org/en/projects-operations/procurement' LIVE_SOURCE_DISCOVERY_PROOF_PREFIX=live_world_bank_source_api npx tsx scripts/prove-live-source-discovery.ts` passed with run `live_world_bank_source_api_20260528T093705Z`; the source API path returned 22 current World Bank procurement opportunities with `scrapeMethod: source_api`.
- `LIVE_DISCOVERY_IMPORT_RUN_ID=live_world_bank_import_20260528T0937 LIVE_DISCOVERY_IMPORT_SOURCE_URLS='https://projects.worldbank.org/en/projects-operations/procurement' LIVE_DISCOVERY_IMPORT_SOURCE_SCRAPE_LIMIT=15 LIVE_DISCOVERY_IMPORT_SCRAPE_LIMIT=0 LIVE_DISCOVERY_IMPORT_BROWSER_FALLBACK_LIMIT=0 LIVE_DISCOVERY_IMPORT_DOWNLOAD_DOCUMENTS=0 npx tsx scripts/run-live-discovery-import.ts` passed; 15 candidates were processed, 1 opportunity was created, 14 were updated, source health was healthy, 1 source-document row was created, 14 were reused, and there were 0 failures or warnings.

Remaining after this slice:
- The second default World Bank URL, `https://tenders.worldbank.org/procurement-notices`, now routes through the same parser by host; verify whether it should remain as a duplicate coverage path or be removed after scheduled dedupe evidence.
- Continue replacing low-yield generic/default sources only when live evidence shows current opportunities are available.

### 2026-05-28 - XLSX Procurement Plans Survive Docling Outages

Status: implemented and verified.

Purpose: close the spreadsheet source-document intake gap where procurement plans in XLSX format could only become parseable when Docling was healthy, leaving structured package data unavailable during parser-service outages.

Changes in this slice:
- Added a server-side XLSX text extractor that reads workbook sheets, shared strings, and worksheet rows from the XLSX package without a remote document service.
- Wired the local XLSX extractor into source-document download fallback extraction.
- Added XLSX re-extraction support in the RFP parser for stored spreadsheet documents that need later parsing from bytes.
- Added regression coverage proving a downloaded procurement-plan XLSX is extracted, stored, linked to an RFP document, and queued for parsing when Docling is unavailable.

Verification:
- `npm test -- rfp-document-service.test.ts --run` passed with 23 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- Normal live XLSX intake selected AIIB `P000314_Publication_of_Procurement_Plan_May-12-2026.xlsx`, extracted 13,409 characters through Docling, stored 19,174 bytes in Linode E3, completed inline parsing job `a4cb66cd-55c6-4903-b50d-568a90e6a64b`, and extracted 8 requirements.
- Forced-fallback live XLSX intake set `DOCLING_URL=http://127.0.0.1:9`, selected AIIB `PP-of-S000656-Urban-Sustainable-Water-Supply-Development-Project-Version-2.xlsx`, used `local_xlsx_parse` after Docling failed, extracted 1,882 characters, stored 17,068 bytes in Linode E3, completed inline parsing job `9b091d1c-bb7d-4d12-82b1-c0db5e6cbaa7`, and extracted 1 requirement.

Remaining after this slice:
- Legacy binary `.xls` files still depend on Docling or pre-extracted text; add XLS conversion only if live sources produce material `.xls` volume.
- Procurement-plan parsing currently treats spreadsheet rows as general RFP text; improve package-level opportunity generation from procurement plan rows after broader source collection is stable.

### 2026-05-28 - ZIP Source Packages Become Parseable RFP Intake

Status: implemented and verified.

Purpose: close the source-document intake gap where ZIP tender packages were discovered and downloaded but stored as unparseable package shells, blocking requirement extraction for sources such as AIIB and GIZ that publish RFP/REOI documents inside ZIP archives.

Changes in this slice:
- Added server-side ZIP package inspection during source-document download.
- Selects the best supported inner document from a ZIP package, prioritizing PDF/DOC/DOCX/HTML files with RFP/tender/REOI/TOR naming signals.
- Stores and queues the extracted inner document for parsing while preserving the original source ZIP URL in provenance.
- Added ZIP to the source-document intake proof selector so scheduled intake can pick package documents.

Verification:
- `npm test -- rfp-document-service.test.ts --run` passed with 22 tests.
- `npx tsc --noEmit --pretty false` passed.
- A targeted live intake selected AIIB source document `REOI-for-S001088-Agriculture-Commercialization-and-Diversification-Project-Phase-2.zip`, extracted inner DOCX `TOR_consultant_firm_FS_and_DED_Component_2_PACD2_to_DAL_3Apr_edit_RN.docx`, stored it in Linode E3, extracted 56,373 characters with Docling, and completed inline RFP parsing with 5 requirements.

Remaining after this slice:
- Add scheduled evidence for recurring ZIP intake once more package documents accumulate across restored sources.
- Continue improving XLS/XLSX handling for procurement plans that contain structured future package data rather than narrative RFP requirements.

### 2026-05-28 - AIIB Project Procurement Source Recovered

Status: implemented and verified.

Purpose: replace the AIIB business landing-page scrape, which returned no opportunities, with a source-specific parser for AIIB's official project procurement data feed so current AIIB notices enter broad opportunity collection.

Changes in this slice:
- Added an `aiib` parser that reads AIIB's `ppo-data-all.js` project procurement dataset directly, resolves official document links, skips contract awards, filters out stale closed notices, and preserves AIIB source identity.
- Updated the default AIIB source from the redirecting business index page to the project procurement opportunity list.
- Routed AIIB project procurement URLs through the source-specific parser in discovery import and live source proof scripts.
- Treated AIIB as a direct source API path so collection does not depend on Firecrawl or browser fallback for the JavaScript-rendered list page.

Verification:
- `npm test -- aiib-parser.test.ts default-discovery-sources.test.ts discovery-opportunity-import.test.ts --run` passed with 37 tests.
- `npx tsc --noEmit --pretty false` passed.
- `LIVE_SOURCE_DISCOVERY_URL='https://www.aiib.org/en/opportunities/business/project-procurement/list.html' LIVE_SOURCE_DISCOVERY_PROOF_PREFIX=live_aiib_project_procurement_source npx tsx scripts/prove-live-source-discovery.ts` passed with run `live_aiib_project_procurement_source_20260528T085936Z`; the source API path returned 34 current AIIB project procurement opportunities.
- `LIVE_DISCOVERY_IMPORT_RUN_ID=live_aiib_import_20260528T0900 LIVE_DISCOVERY_IMPORT_SOURCE_URLS='https://www.aiib.org/en/opportunities/business/project-procurement/list.html' LIVE_DISCOVERY_IMPORT_SOURCE_SCRAPE_LIMIT=10 LIVE_DISCOVERY_IMPORT_SCRAPE_LIMIT=0 LIVE_DISCOVERY_IMPORT_BROWSER_FALLBACK_LIMIT=0 LIVE_DISCOVERY_IMPORT_DOWNLOAD_DOCUMENTS=0 npx tsx scripts/run-live-discovery-import.ts` passed; 10 AIIB candidates were created, 10 source-document rows were seeded, source health was healthy, and there were 0 failures or warnings.

Remaining after this slice:
- IsDB's currently visible tender rows are stale/closed as of 2026-05-28; do not add an IsDB parser unless a current/future endpoint is found.
- Continue improving source-document download and parsing coverage for newly restored sources, especially package formats such as ZIP/XLSX.

### 2026-05-28 - Live Import Proof Awaits RFP Parsing

Status: implemented and verified.

Purpose: close the proof gap where live discovery imports could download source documents but let RFP parsing continue in the background after the proof script closed the database pool, weakening evidence for response-creation readiness.

Changes in this slice:
- Added an explicit `inline` parse mode to source-document downloads while preserving the existing background parse default for app flows.
- Threaded inline parse mode through discovery import and `run-live-discovery-import.ts`, including parse attempted/succeeded/failed counters in import results and evidence notes.
- Made `processRfpParsingJob` return an explicit completed/failed result so callers can distinguish successful inline parsing from recorded parser failure.
- Hardened RFP parsing against malformed AI parse output that omits `sections`, normalizing to a fallback document section instead of crashing before requirement extraction.

Verification:
- `npm test -- rfp-document-service.test.ts discovery-opportunity-import.test.ts rfp-parse-workflow.test.ts --run` passed with 68 tests.
- `npx tsc --noEmit --pretty false` passed.
- `LIVE_DISCOVERY_IMPORT_ORGANIZATION_ID='__INLINE_PARSE_PROOF_2_20260528__' LIVE_DISCOVERY_IMPORT_SOURCE_URLS='https://www.adb.org/business/institutional-procurement/notices' LIVE_DISCOVERY_IMPORT_SOURCE_SCRAPE_LIMIT=10 LIVE_DISCOVERY_IMPORT_SCRAPE_LIMIT=0 LIVE_DISCOVERY_IMPORT_BROWSER_FALLBACK_LIMIT=0 LIVE_DISCOVERY_IMPORT_DOWNLOAD_LIMIT=1 npx tsx scripts/run-live-discovery-import.ts` passed with run `live_discovery_import_20260528T083619Z`; 6 ADB opportunities were created, 1 source document downloaded, 1 source document parsed inline, 0 parse failures, and the parser extracted 11 requirements before database shutdown.

Remaining after this slice:
- Docling on `84.247.181.100:3600` still timed out during the live proof; local PDF parsing recovered successfully, but Docling service health should be investigated separately.
- Continue replacing remaining empty or blocked generic sources, especially AIIB and IsDB.

### 2026-05-28 - ADB Institutional Procurement Source Recovered

Status: implemented and verified.

Purpose: replace the Cloudflare-blocked ADB project-tenders default source with an accessible institutional procurement source that produces current RFP/RFQ/bid opportunities and source documents without depending on Firecrawl or browser fallback.

Changes in this slice:
- Added an `adb` parser for ADB institutional procurement notice tables, including direct static-page fetch fallback, deadline/start-date parsing, document-link extraction, source IDs, platform identity, and ADB/development-bank tags.
- Updated the default ADB source from `https://www.adb.org/projects/tenders` to `https://www.adb.org/business/institutional-procurement/notices`.
- Routed ADB URLs through the source-specific parser in discovery import and live source proof scripts.
- Treated ADB as a direct source path in configured-source import/proof flows so ADB collection does not fail when scraper services return blocked or table-less content.

Verification:
- `npm test -- adb-parser.test.ts default-discovery-sources.test.ts discovery-opportunity-import.test.ts --run` passed with 35 tests.
- `npx tsc --noEmit --pretty false` passed.
- `LIVE_SOURCE_DISCOVERY_URL='https://www.adb.org/business/institutional-procurement/notices' LIVE_SOURCE_DISCOVERY_PROOF_PREFIX=live_adb_institutional_source npx tsx scripts/prove-live-source-discovery.ts` passed with run `live_adb_institutional_source_20260528T081201Z`; the direct source path returned 6 current ADB opportunities, including 2 RFPs, without Firecrawl/browser dependency.
- `LIVE_DISCOVERY_IMPORT_SOURCE_URLS='https://www.adb.org/business/institutional-procurement/notices' LIVE_DISCOVERY_IMPORT_SOURCE_SCRAPE_LIMIT=10 LIVE_DISCOVERY_IMPORT_SCRAPE_LIMIT=0 LIVE_DISCOVERY_IMPORT_BROWSER_FALLBACK_LIMIT=0 npx tsx scripts/run-live-discovery-import.ts` passed with run `live_discovery_import_20260528T081223Z`; 6 candidates were created, 0 failed, 0 warnings, source health was healthy, 6 source-document rows were created, and 5 documents downloaded.

Remaining after this slice:
- The background parse proof-harness issue was closed by the 2026-05-28 inline parse proof slice.
- Continue replacing remaining empty or blocked generic sources, especially AIIB and IsDB.

### 2026-05-28 - EU Funding & Tenders Source API Added

Status: implemented and verified.

Purpose: replace the zero-yield EU Funding & Tenders Angular-page scrape with source-specific SEDIA API collection so current EU calls enter opportunity and source-document intake.

Changes in this slice:
- Added an `eu_funding_tenders` parser backed by the public SEDIA search API, with future-deadline filtering, canonical portal URLs, grant/tender classification, budget/sector metadata, and source identity preservation.
- Updated the default EU source to the calls-for-proposals view with a `proposal` query, replacing the generic tenders Angular shell.
- Routed EU Funding & Tenders URLs through the source-specific parser in discovery import and live source proof scripts.
- Let API-backed configured sources (`sam_gov`, `eu_funding_tenders`) parse directly in the importer and source proof script instead of forcing Firecrawl/browser scraping first, eliminating misleading degraded source-health warnings when the API path succeeds.

Verification:
- `npm test -- eu-funding-tenders-parser.test.ts sam-gov-parser.test.ts ebrd-parser.test.ts default-discovery-sources.test.ts discovery-opportunity-import.test.ts --run` passed with 44 tests.
- `npx tsc --noEmit --pretty false` passed.
- `env LIVE_SOURCE_DISCOVERY_URL='https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?keywords=proposal' LIVE_SOURCE_DISCOVERY_PROOF_PREFIX=live_eu_funding_source_api npx tsx scripts/prove-live-source-discovery.ts` passed with run `live_eu_funding_source_api_20260528T075838Z`; the source API returned 2 current EU opportunities without Firecrawl/browser dependency.
- `env LIVE_DISCOVERY_IMPORT_RUN_ID=live_eu_funding_import_20260528T0757 LIVE_DISCOVERY_IMPORT_SOURCE_URLS='https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?keywords=proposal' LIVE_DISCOVERY_IMPORT_SOURCE_SCRAPE_LIMIT=10 LIVE_DISCOVERY_IMPORT_SCRAPE_LIMIT=0 LIVE_DISCOVERY_IMPORT_BROWSER_FALLBACK_LIMIT=0 LIVE_DISCOVERY_IMPORT_DOWNLOAD_DOCUMENTS=0 npx tsx scripts/run-live-discovery-import.ts` passed with 2 total candidates, 2 updates, 0 failures, 0 warnings, healthy source status, and 2 existing source-document rows.

Remaining after this slice:
- Expand EU search coverage beyond the first `proposal` query once dedupe behavior remains stable in scheduled broad imports.
- Continue replacing empty generic sources with source-specific API or browser paths, especially ADB and AIIB/IsDB coverage.

### 2026-05-28 - SAM.gov RFP and USAID Source Collection Added

Status: implemented and verified.

Purpose: replace the dead USAID funding page and generic SAM.gov scrape with source-specific collection from SAM.gov's public search endpoint, increasing broad RFP coverage and restoring a live USAID-related source path.

Changes in this slice:
- Added a `sam_gov` parser that converts configured SAM.gov search pages into public search endpoint requests, filters active non-canceled notices, and maps contract opportunities into importable source opportunities.
- Updated default discovery sources from a dead USAID page and generic SAM.gov search to two live SAM.gov searches: broad `"request for proposal"` and `USAID`.
- Routed SAM.gov URLs through the source-specific parser in discovery import and live source proof scripts.
- Preserved SAM.gov source identity, platform name, and `sam-gov`/`us-federal` tags through opportunity import instead of collapsing results into generic source-scrape records.

Verification:
- `npm test -- sam-gov-parser.test.ts ebrd-parser.test.ts default-discovery-sources.test.ts discovery-opportunity-import.test.ts --run` passed with 39 tests.
- `npx tsc --noEmit --pretty false` passed.
- `env LIVE_SOURCE_DISCOVERY_URL='https://sam.gov/search/?index=opp&keywords=%22request%20for%20proposal%22' LIVE_SOURCE_DISCOVERY_PROOF_PREFIX=live_sam_gov_rfp_source npx tsx scripts/prove-live-source-discovery.ts` passed with run `live_sam_gov_rfp_source_20260528T074007Z`; Firecrawl captured the page and the SAM.gov parser returned 10 current RFP-like opportunities.
- `env LIVE_SOURCE_DISCOVERY_URL='https://sam.gov/search/?index=opp&keywords=USAID' LIVE_SOURCE_DISCOVERY_PROOF_PREFIX=live_sam_gov_usaid_source npx tsx scripts/prove-live-source-discovery.ts` passed with run `live_sam_gov_usaid_source_20260528T074021Z`; the SAM.gov parser returned 5 active USAID-related opportunities.
- `env LIVE_DISCOVERY_IMPORT_RUN_ID=live_sam_gov_import_20260528T0740 LIVE_DISCOVERY_IMPORT_SOURCE_URLS='https://sam.gov/search/?index=opp&keywords=%22request%20for%20proposal%22,https://sam.gov/search/?index=opp&keywords=USAID' LIVE_DISCOVERY_IMPORT_SOURCE_SCRAPE_LIMIT=10 LIVE_DISCOVERY_IMPORT_SCRAPE_LIMIT=0 LIVE_DISCOVERY_IMPORT_BROWSER_FALLBACK_LIMIT=0 LIVE_DISCOVERY_IMPORT_DOWNLOAD_DOCUMENTS=0 npx tsx scripts/run-live-discovery-import.ts` passed with 15 total candidates, 15 created opportunities, 0 failures, 0 warnings, and 15 source-document rows seeded.

Remaining after this slice:
- Continue replacing empty generic sources with source-specific API or browser paths, especially EU Funding & Tenders, ADB, and remaining USAID/workwithusaid routes that are not represented in SAM.gov.
- Consider paginating SAM.gov after the first-page path has repeatable dedupe and freshness behavior under scheduled imports.

### 2026-05-28 - EBRD Procurement Notices Recovered

Status: implemented and verified.

Purpose: replace the empty generic EBRD landing-page scrape with a source-specific path that reads the EBRD procurement-notice JSON endpoint and turns current EBRD notices into importable opportunities.

Changes in this slice:
- Added an `ebrd` parser that posts the EBRD procurement-notices page configuration to `/bin/ebrd_dxp/filterlistservlet` and converts the returned notice records into opportunity candidates.
- Updated default discovery sources from the informational EBRD procurement landing page to the active EBRD procurement-notices page.
- Routed EBRD source URLs through the EBRD parser in both discovery import and live source proof scripts.
- Preserved EBRD source identity, platform name, and source tags through the import path so imported rows are not collapsed into generic `source-scrape` records.

Verification:
- `npm test -- ebrd-parser.test.ts default-discovery-sources.test.ts discovery-opportunity-import.test.ts --run` passed with 34 tests.
- `npx tsc --noEmit --pretty false` passed.
- `env LIVE_SOURCE_DISCOVERY_URL=https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices.html LIVE_SOURCE_DISCOVERY_PROOF_PREFIX=live_ebrd_source npx tsx scripts/prove-live-source-discovery.ts` passed with run `live_ebrd_source_20260528T072619Z`; Firecrawl captured the page and the EBRD parser returned 7 current procurement notices.
- `env LIVE_DISCOVERY_IMPORT_RUN_ID=live_ebrd_import_20260528T0727 LIVE_DISCOVERY_IMPORT_SOURCE_URLS=https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices.html LIVE_DISCOVERY_IMPORT_SOURCE_SCRAPE_LIMIT=10 LIVE_DISCOVERY_IMPORT_SCRAPE_LIMIT=0 LIVE_DISCOVERY_IMPORT_BROWSER_FALLBACK_LIMIT=0 LIVE_DISCOVERY_IMPORT_DOWNLOAD_DOCUMENTS=0 npx tsx scripts/run-live-discovery-import.ts` passed with 7 total candidates, 7 created opportunities, 0 failures, 0 warnings, and 7 source-document rows seeded.

Remaining after this slice:
- EBRD ECEPP remains protected behind a separate portal and returned HTTP 403 to direct curl; broader EBRD coverage may need browser or authenticated ECEPP handling later.
- Continue replacing empty generic sources, especially SAM.gov, EU Funding & Tenders, ADB, and USAID.

### 2026-05-28 - DB-Backed Kenya PPIP Import-to-Response Restored

Status: implemented and verified.

Purpose: remove the stale database-target blocker from live persisted import-to-response proofing and prove that a real Kenya PPIP tender can flow through PostgreSQL-backed opportunity, source document, RFP, requirement, response draft, and win-theme persistence.

Changes in this slice:
- Updated the live persisted import-response proof to force the local project `DATABASE_URL` before importing the Drizzle database module, so an inherited shell `DATABASE_URL` cannot silently bind the proof to a stale database host.
- Deferred Drizzle connection initialization until after the local env override, matching the safer pattern used by other DB-backed operational scripts.

Verification:
- `npm run platform:proof -- --run live-kenya-ppip-persisted-import-response --include-live-safe` first reproduced the stale target failure against `88.80.188.224:5432/lnd`.
- After the fix, the same proof passed with run `live_kenya_ppip_persisted_import_response_20260528T063442Z` against `db.lindela.io:5432/docfusion`; schema preflight passed.
- Kenya PPIP returned 836 active tenders, the proof selected `PROVISION OF COMPANY SECRETARIAL SERVICES`, downloaded a 1,559,699-byte PDF, extracted 90,748 Docling characters, generated 24 source requirements, 14 evaluator criteria, 6 response drafts, 14 win themes, and 11,914 draft words.
- The proof verified 1 opportunity row, 1 source-document row, 1 RFP document row, 24 requirement rows, 6 proposal-document rows, 6 response-document rows, and 14 win-theme rows, then cleaned all proof rows back to zero.

Remaining after this slice:
- Use the restored DB-backed proof path to harden broad recurring imports and product UI handoff from persisted opportunity history.

### 2026-05-28 - Broad Live Discovery Import Registered and Repaired

Status: implemented and verified.

Purpose: make broad RFP/opportunity collection a first-class platform proof and use the live run to improve source-document intake quality.

Changes in this slice:
- Registered `live-broad-discovery-import` in the Wave 9 platform proof manifest so the default broad discovery profile can be run through the standard proof harness.
- Added manifest coverage for the broad import limits and expected evidence artifacts.
- Tightened discovery document-link extraction so a markdown link whose label is itself a URL cannot leak `](` delimiters into a persisted source-document URL.
- Added a regression test for the malformed `archive.org` URL shape found in the live import run.
- Removed the single malformed duplicate `opportunity_documents` row left by the live run after verifying the same opportunity already had the correct downloaded PDF row.

Verification:
- `npm run platform:proof -- --run live-broad-discovery-import --include-live-safe` passed with run `live_discovery_import_20260528T064006Z`.
- The broad import processed 131 candidates, created 20 opportunities, updated 111 opportunities, created 24 source-document rows, reused 140 existing source documents, attempted 5 bounded downloads, and downloaded 1 source document.
- Source health covered 19 configured sources; 12 returned candidates or browser-fallback evidence, while 7 were recorded as empty/degraded with source-level warning evidence.
- `npm test -- discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts --run` passed with 31 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live DB verification after cleanup: 2,743 opportunities, 1,611 `rfp` opportunities, 187 source-document rows, 12 downloaded source documents, 8 RFP documents, 18 RFP requirements, and 0 source-document URLs containing malformed markdown delimiters.

Remaining after this slice:
- Improve low-yield configured sources such as SAM.gov, EU Funding & Tenders, ADB, EBRD, USAID, and GIZ with source-specific API or browser parsers instead of relying on the generic scraper.
- Investigate why the imported 446,783-character `RL32229.pdf` parse produced zero requirements despite successful text extraction.

### 2026-05-28 - GIZ Africa Tender Sources Added

Status: implemented and verified.

Purpose: replace the dead GIZ default source with stable GIZ country-office tender pages and prevent same-page tender blocks from collapsing into a single candidate.

Changes in this slice:
- Added a source-specific `giz` parser for GIZ country tender pages, extracting deadline blocks, procurement titles, downloadable ZIP/PDF/DOC/XLSX package links, country office, source IDs, and metadata.
- Replaced the 404 `https://www.giz.de/en/jobs/tenders.html` default source with live GIZ Ghana and GIZ South Africa tender pages.
- Routed `giz.de/.../tenders` pages through the GIZ parser in both discovery import and live source proof scripts.
- Fixed configured-source candidate identity and fingerprints to use source document URL/source ID when multiple tenders share one portal page.
- Added legacy matching by `sourceId` + `sourceFile` so rows created under older `source-scrape` identity are updated instead of causing duplicate insert failures after source identity becomes more specific.
- Kept source-specific document links scoped to each GIZ tender block so each opportunity does not inherit unrelated documents from the full country page.

Verification:
- `env LIVE_SOURCE_DISCOVERY_URL=https://www.giz.de/en/regions/africa/ghana/tenders LIVE_SOURCE_DISCOVERY_PROOF_PREFIX=live_giz_ghana_source npx tsx scripts/prove-live-source-discovery.ts` passed with run `live_giz_ghana_source_20260528T070228Z`; Firecrawl parsed 6 GIZ Ghana tender opportunities.
- `env LIVE_DISCOVERY_IMPORT_RUN_ID=live_giz_africa_import_20260528T0711 LIVE_DISCOVERY_IMPORT_SOURCE_URLS=https://www.giz.de/en/regions/africa/ghana/tenders,https://www.giz.de/en/regions/africa/south-africa/tenders LIVE_DISCOVERY_IMPORT_SOURCE_SCRAPE_LIMIT=10 LIVE_DISCOVERY_IMPORT_SCRAPE_LIMIT=0 LIVE_DISCOVERY_IMPORT_BROWSER_FALLBACK_LIMIT=0 LIVE_DISCOVERY_IMPORT_DOWNLOAD_DOCUMENTS=0 npx tsx scripts/run-live-discovery-import.ts` passed with 7 total candidates, 7 updates, 0 failures, 0 warnings, 6 healthy Ghana candidates, and 1 healthy South Africa candidate.
- `npm test -- giz-parser.test.ts default-discovery-sources.test.ts discovery-opportunity-import.test.ts --run` passed with 31 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live DB verification after this slice: 2,754 opportunities, 10 `giz` opportunities, 14 GIZ source-document rows, and 3 downloaded GIZ source documents.

Remaining after this slice:
- Continue replacing empty generic sources with source-specific paths, especially SAM.gov, EU Funding & Tenders, ADB, EBRD, and USAID.
- Decide whether to add intermittent non-Africa GIZ country pages only after they pass repeatable live source/import proofs.

### 2026-05-27 - Live Portfolio Expansion Recheck

Status: verified with live-source failures.

Purpose: refresh additional source-specific response-readiness candidates after the portfolio triage work, so the ranking can include more than UNGM and COMESA when live sources expose current response-ready material.

Attempted:
- `npm run platform:proof -- --run live-world-bank-response-readiness --include-live-safe` failed with run `live_world_bank_response_readiness_20260527T180622Z`; the live World Bank page parse returned no active source opportunities.
- `npm run platform:proof -- --run live-afdb-response-readiness --include-live-safe` failed with run `live_afdb_response_readiness_20260527T180709Z`; AFDB returned no response-ready opportunity with source material.
- `npm run platform:proof -- --run live-kenya-ppip-response-readiness --include-live-safe` failed with run `live_kenya_ppip_response_readiness_20260527T180736Z`; Docling extracted 0 characters from the selected source document.
- `npm run platform:proof -- --run live-opportunity-portfolio-triage --include-live-safe` passed with run `live_opportunity_portfolio_triage_20260527T181350Z`.

Result:
- Portfolio triage read 43 response-readiness proof artifacts, ignored failed/no-response entries, retained 4 completed response-package candidates, deduplicated them to 2 live opportunities, and kept the same verified order: UNGM `pursue_now`, COMESA `review_before_pursuit`.

Remaining after this slice:
- Revisit World Bank, AFDB, and Kenya PPIP live response-readiness acquisition after their source pages/API outputs expose response-ready source material again or after source-specific fallback logic is improved.
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.

### 2026-05-27 - Live Response Portfolio Operator Brief

Status: implemented and verified.

Purpose: make the portfolio triage proof directly usable by an operator without requiring them to inspect raw JSON.

Changes in this slice:
- Added a deterministic markdown formatter for live response portfolio triage.
- Updated the live-safe triage proof to write `live-opportunity-portfolio-triage.md` alongside the JSON artifact.
- Added the operator brief path to evidence rows and the platform proof manifest.
- Extended service tests to verify the brief includes the ranked pursue-now and review-before-pursuit opportunities plus the risk rationale.

Verification:
- `npm test -- live-response-portfolio-triage.test.ts platform-proof-scenarios.test.ts --run` passed with 9 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-opportunity-portfolio-triage --include-live-safe` passed with run `live_opportunity_portfolio_triage_20260527T180427Z`.
- The generated operator brief ranked UNGM run `live_response_readiness_20260527T174956Z` as `pursue_now` and COMESA run `live_comesa_response_readiness_20260527T175037Z` as `review_before_pursuit`, with source links, draft evidence counts, fit scores, and risk reasons.
- `npm run platform:proof -- --all --wave 9` passed after the manifest update.

Remaining after this slice:
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.
- Surface the same brief or ranking in the authenticated product UI once persisted opportunity history is available.

### 2026-05-27 - Live Response Portfolio Triage

Status: implemented and verified.

Purpose: turn source-specific live response-readiness proofs into an evidence-backed portfolio priority order, so operators can pursue the strongest winnable opportunity first instead of manually comparing proof artifacts.

Changes in this slice:
- Added a live response portfolio triage service that deduplicates repeated proof runs by opportunity and keeps the latest completed response package evidence.
- Ranked live opportunities from readiness, pursuit fit, source requirement coverage, evaluator criteria, draft word count, and response snippet evidence.
- Capped `review_before_pursuit` and partner/no-bid opportunities below `pursue_now` priority, so evidence-rich but strategically weak opportunities do not outrank strong-fit opportunities.
- Added a live-safe proof script that reads completed `live-opportunity-response-readiness.json` artifacts from `.omx/logs/platform-completion`, writes a portfolio triage artifact, and appends evidence rows.
- Registered `live-opportunity-portfolio-triage` in the Wave 9 platform proof manifest.

Verification:
- `npm test -- live-response-portfolio-triage.test.ts platform-proof-scenarios.test.ts --run` passed with 9 tests.
- `npm run platform:proof -- --run live-opportunity-portfolio-triage --include-live-safe` passed with run `live_opportunity_portfolio_triage_20260527T180019Z`.
- The triage proof read 40 source artifacts, found 4 completed response-package candidates, deduplicated them to 2 ranked live opportunities, and produced 1 `pursue_now` candidate.
- The top ranked opportunity was UNGM run `live_response_readiness_20260527T174956Z`, source `ungm`, `strong_fit`, fit score 89, portfolio score 100, readiness `ready_for_review`, recommendation `pursue_now`.
- The second ranked opportunity was COMESA run `live_comesa_response_readiness_20260527T175037Z`, source `comesa`, `review_required`, fit score 72, portfolio score 84, readiness `ready_for_review`, recommendation `review_before_pursuit`.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --all --wave 9` passed after this change.

Remaining after this slice:
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.
- Portfolio triage currently consumes live proof artifacts; connect the same ranking to persisted opportunity history once the database proof path is reachable.

### 2026-05-27 - Live Response Pursuit Fit Evidence

Status: implemented and verified.

Purpose: distinguish technical response-package readiness from whether Datacraft is actually positioned to win the opportunity, so the platform does not treat every parsed RFP as an equal pursue decision.

Changes in this slice:
- Added deterministic pursuit-fit assessment to live response packages with `strong_fit`, `review_required`, and `weak_fit` statuses.
- Added fit score, matched Datacraft capability signals, risk factors, and pursuit recommendation to response package output.
- Added readiness warnings when a technically draftable opportunity still needs bid/no-bid review or partner/no-bid consideration.
- Added pursuit-fit score to readiness metrics and live response-readiness evidence rows.
- Tightened fit keyword matching to word/phrase boundaries so domain-risk terms are not triggered by unrelated substrings.

Verification:
- `npm test -- live-response-package.test.ts --run` passed with 16 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-opportunity-response-readiness --include-live-safe` passed with run `live_response_readiness_20260527T174956Z`, recording UNGM as `strong_fit`, score 89, recommendation `pursue`, with no pursuit risk factors.
- `npm run platform:proof -- --run live-comesa-response-readiness --include-live-safe` passed with run `live_comesa_response_readiness_20260527T175037Z`, recording COMESA as `review_required`, score 72, recommendation `review_before_pursuit`, and an insurance-domain risk warning while still producing review-ready drafts.
- Source triage also revalidated `live-unicef-source` with run `live_unicef_source_20260527T174126Z` and `live-dgmarket-source` with run `live_dgmarket_source_20260527T174126Z`; both remain discovery-only inputs until they expose full solicitation material suitable for response drafting.
- `npm run platform:proof -- --all --wave 9` passed after the pursuit-fit change.

Remaining after this slice:
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.
- Fit scoring is deterministic and evidence-backed, but it should be calibrated with actual Datacraft bid/no-bid outcomes once persisted opportunity history is reachable.

### 2026-05-27 - COMESA Live DOCX Response Readiness

Status: implemented and verified.

Purpose: extend live regional-procurement response coverage to COMESA by resolving a detail-page RFP package and proving DOCX extraction can feed response drafting.

Changes in this slice:
- Added `comesa` as a live response-readiness source kind.
- Added `live-comesa-response-readiness` to the platform proof manifest.
- Reused the COMESA open-tenders parser and detail-page document ranking to attach downloadable RFP packages to live opportunities.
- Broadened direct source-document selection from PDF-only to PDF/DOC/DOCX for Docling-backed response-readiness proofs.
- Added a COMESA document-first selector so conventional RFP packages are not rejected by ICT-specific opportunity terms.

Verification:
- `npm run platform:proof -- --run live-comesa-source --include-live-safe` passed with run `live_comesa_source_20260527T173422Z`.
- `LIVE_RESPONSE_READINESS_SOURCE_KIND=comesa LIVE_RESPONSE_READINESS_SOURCE_URL=https://www.comesa.int/category/open-tenders/ LIVE_RESPONSE_READINESS_PROOF_PREFIX=live_comesa_response_readiness npx tsx scripts/prove-live-opportunity-response-readiness.ts` passed with run `live_comesa_response_readiness_20260527T173619Z`.
- `npm test -- platform-proof-scenarios.test.ts --run` passed with 6 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-comesa-response-readiness --include-live-safe` passed with run `live_comesa_response_readiness_20260527T173818Z`.
- `npm run platform:proof -- --all --wave 9` passed after the COMESA response-readiness change.
- The passing registered COMESA response run selected `Tender for Provision of Staff Medical Insurance Cover for Staff of The COMESA Secretariat`, downloaded `RFP-Medical-Scheme-2026-Final.docx` with HTTP 200 and 483278 bytes, extracted 19708 Docling characters, generated six response draft artifacts, captured 24 source requirement signals, 5 evaluator criteria, 5 win-theme seeds, 85 relevant snippets, 7975 draft words, readiness status `ready_for_review`, 0 warnings, and 0 blockers.

Remaining after this slice:
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.
- COMESA response readiness proves DOCX extraction and drafting; source-fit scoring remains a future product decision separate from technical response package readiness.

### 2026-05-27 - Persisted Kenya PPIP Proof Still DB Blocked After World Bank Slice

Status: superseded by later `db.lindela.io` verification and Kenya PPIP extraction fallback.

Purpose: recheck whether the DB-backed Kenya PPIP persisted import-to-response path became reachable after the live-safe source/readiness expansions.

Attempted:
- `npm run platform:proof -- --run live-kenya-ppip-persisted-import-response --include-live-safe` failed with run `live_kenya_ppip_persisted_import_response_20260527T173235Z`.
- The proof did not reach Kenya PPIP source discovery, source document persistence, RFP parsing, requirement persistence, or response draft persistence because PostgreSQL still refused the connection to `88.80.188.224:5432`.
- The proof recorded database target `88.80.188.224:5432`, database `lnd`, timeout 5000ms, schema preflight `not-run`, and no cleanup rows.

Remaining after this slice:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun `live-persisted-import-response` and `live-kenya-ppip-persisted-import-response`.

### 2026-05-27 - World Bank Live Response Readiness via Notice API

Status: implemented and verified.

Purpose: extend live source-to-response coverage to World Bank procurement notices, where the response source is structured public solicitation text from the World Bank notice API rather than a downloadable PDF.

Changes in this slice:
- Added `world_bank` as a live response-readiness source kind.
- Added `live-world-bank-response-readiness` to the platform proof manifest.
- Reused the World Bank procurement listing parser to find active notices and skip award rows.
- Added World Bank notice API extraction as a non-Docling source-text path, preserving extraction method evidence separately from PDF/document conversion status.
- Kept existing PDF/Docling behavior for UNGM, Kenya PPIP, and AFDB response-readiness proofs.

Verification:
- `npm test -- platform-proof-scenarios.test.ts --run` passed with 6 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-world-bank-source --include-live-safe` passed with run `live_world_bank_source_20260527T172616Z`.
- `npm run platform:proof -- --run live-world-bank-response-readiness --include-live-safe` passed with run `live_world_bank_response_readiness_20260527T172949Z`.
- `npm run platform:proof -- --all --wave 9` passed after the World Bank response-readiness change.
- The passing World Bank response run selected notice `OP00435405`, `Critical Habitat Assessment`, fetched public notice API source text with HTTP 200 and `application/json`, captured 20652 source-text characters, generated six response draft artifacts, captured 3 source requirement signals, 2 win-theme seeds, 85 relevant snippets, 4307 draft words, readiness status `ready_for_review`, 1 warning for no explicit evaluator scoring criteria, and 0 blockers.

Remaining after this slice:
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.
- World Bank response readiness is currently API-text based; add downloadable package traversal only if the source begins exposing direct bid-document links that are reachable without portal login.

### 2026-05-27 - Post-AFDB Wave 9 Revalidation

Status: implemented and verified.

Purpose: revalidate the full non-live Wave 9 discovery-to-submission regression chunk after the AFDB response-readiness and browser-link capture changes.

Changes in this slice:
- Updated stale browser-fallback test expectations so they assert the current browser scrape request contract, including `markdown`, `html`, and `links` output formats.

Verification:
- `npm test -- discovery-opportunity-import.test.ts --run` passed with 23 tests.
- `npm run platform:proof -- --all --wave 9` passed.
- The Wave 9 proof covered 21 test files and 234 tests across discovery parsing/import, opportunity document download, source document intake, RFP parse workflow, requirements workflow, proposal documents, final artifacts, final submission gates, submissions scope, presentation export, and response package readiness.

Remaining after this slice:
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.

### 2026-05-27 - AFDB Live Response Readiness via Search Fallback

Status: implemented and verified.

Purpose: extend live opportunity-to-response coverage beyond UNGM and Kenya PPIP by proving AFDB procurement documents can still feed response generation when the AFDB listing page is protected by a bot challenge.

Changes in this slice:
- Added `afdb` as a live response-readiness source kind.
- Added `live-afdb-response-readiness` to the platform proof manifest.
- Reused the AFDB parser/detail-page path when listing scrape content is available.
- Added an optional CloakBrowser CDP scrape path for challenge-protected AFDB listing traversal when `CLOAKBROWSER_CDP_URL`, `CLOAKBROWSER_WS_ENDPOINT`, or `CLOAKBROWSER_REMOTE_DEBUGGING_URL` is configured.
- Added a SearXNG-backed AFDB-funded document fallback that searches for reachable procurement PDF/DOC results, omits the JSON Accept header for engines that reject it, excludes manuals and currently challenged AFDB-hosted documents, and probes candidate downloads before creating response-ready opportunity candidates.
- Broadened response-ready selection terms for consulting, audit, application, mobile, platform, and solution opportunities.

Verification:
- `npm test -- platform-proof-scenarios.test.ts --run` passed with 6 tests.
- `npm test -- live-response-package.test.ts platform-proof-scenarios.test.ts --run` passed with 21 tests.
- `npm test -- cloakbrowser-scraper-client.test.ts live-response-package.test.ts platform-proof-scenarios.test.ts searxng-client-config.test.ts --run` passed with 30 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-afdb-response-readiness --include-live-safe` passed with run `live_afdb_response_readiness_20260527T171333Z`.
- The passing AFDB live run used SearXNG fallback from `https://search.lindela.io`, found an AfDB-funded mobile data collection REOI, downloaded the borrower-hosted PDF with HTTP 200 and 317058 bytes, extracted 4110 Docling characters, generated six response draft artifacts, captured 4 source requirements, 1 win-theme seed, 5919 draft words, readiness status `ready_for_review`, 1 warning for no explicit evaluator scoring criteria, and 0 blockers.

Remaining after this slice:
- AFDB direct listing scrape currently returns a bot/security verification page through Firecrawl and browser service; the optional CloakBrowser CDP hook is in place but was not live-configured in this run.
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.

### 2026-05-27 - Persisted Proof Database Target Evidence

Status: implemented and verified; DB path still externally blocked.

Purpose: make DB-backed persisted import-response failures record sanitized database target and schema-preflight state, so blocker evidence is clearer without exposing credentials.

Changes in this slice:
- Added sanitized database target metadata to the live persisted import-response proof: configured status, host, port, database name, SSL mode when present, connection timeout, and schema-preflight state.
- Added a bounded PostgreSQL connection timeout for the persisted proof schema preflight.
- Added database host, port, and schema-preflight state to persisted proof evidence rows.

Verification:
- `npm test -- platform-proof-scenarios.test.ts --run` passed with 6 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-kenya-ppip-persisted-import-response --include-live-safe` failed as expected with run `live_kenya_ppip_persisted_import_response_20260527T164138Z`, but the proof now records database host `88.80.188.224`, port `5432`, database `lnd`, timeout 5000ms, and schema preflight `not-run`.

Remaining after this slice:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun `live-persisted-import-response` and `live-kenya-ppip-persisted-import-response`.

### 2026-05-27 - Kenya PPIP Persisted Proof Retry Still DB Blocked

Status: externally blocked.

Purpose: recheck the DB-backed Kenya PPIP persisted import-to-response proof after current live discovery and response-readiness proofs passed.

Attempted:
- `npm run platform:proof -- --run live-kenya-ppip-persisted-import-response --include-live-safe` failed with run `live_kenya_ppip_persisted_import_response_20260527T163854Z`.
- The proof did not reach Kenya PPIP source discovery, source document persistence, RFP parsing, requirement persistence, or response draft persistence because PostgreSQL refused the connection to `88.80.188.224:5432`.
- Cleanup had no persisted rows to remove.

Remaining after this slice:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun `live-persisted-import-response` and `live-kenya-ppip-persisted-import-response`.
- Continue using the live-safe non-DB discovery and response-readiness proofs as validated live behavior while persistence is unreachable.

### 2026-05-27 - Current UNGM Live Response Readiness Revalidation

Status: verified.

Purpose: revalidate the non-DB live path from current UNGM opportunity discovery through source PDF extraction and Datacraft response draft generation.

Verification:
- `npm run platform:proof -- --run live-opportunity-response-readiness --include-live-safe` passed with run `live_response_readiness_20260527T163703Z`.
- The proof found UNGM notice `300700`, `Provision of Penetration Testing Services and Security Consultancy for goAML Software product (Web Applications and APIs).`
- The source PDF `eoi24414.pdf` downloaded with HTTP 200, `application/pdf`, 171406 bytes, and Docling extracted 9002 characters with status `success`.
- Response readiness produced six draft artifacts, 24 source requirement signals, 3 win-theme seeds, 85 relevant Datacraft snippets, 7655 total draft words, readiness status `ready_for_review`, 0 blockers, and full source/draft artifact integrity coverage.

Remaining after this slice:
- The current UNGM EOI did not expose explicit evaluator scoring criteria; Kenya PPIP remains the stronger live evaluator-criteria proof.
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.

### 2026-05-27 - Live Discovery Actionable Evidence Hardening

Status: implemented and verified.

Purpose: make the live discovery-services proof record actionable procurement evidence from scraped pages, not only service health, markdown length, and keyword counts.

Changes in this slice:
- Added source-host, sample opportunity links, sample opportunity snippets, and snippet counts to Firecrawl and browser fallback evidence.
- Requested links from the browser scraper when a caller asks for link output.
- Resolved the UNGM browser target from the software search page to a current live notice before scraping, so browser fallback proof captures an actual opportunity page and source document link.
- Filtered static assets and client-side configuration text out of sample opportunity evidence.

Verification:
- `npm test -- browser-scraper-client.test.ts platform-proof-scenarios.test.ts --run` passed with 8 tests.
- `npm test -- browser-scraper-client.test.ts fetcher-public-url.test.ts document-discovery-agent.test.ts --run` passed with 11 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-discovery-services --include-live-safe` passed with run `live_discovery_20260527T163413Z`.
- The passing live run returned 9 opportunity-relevant SearXNG results from 10 total Bing results for `tenders.go.ke`, Firecrawl scraped 198382 markdown characters from UNDP procurement notices with 5 sample opportunity links, and browser fallback resolved UNGM notice `300700` for penetration testing/security consultancy, scraped 223569 markdown characters, found source PDF `eoi24414.pdf`, and recorded 5 opportunity snippets.

Remaining after this slice:
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.
- Continue moving live-safe proof evidence from service-level availability toward source-specific opportunity, document, and response artifacts.

### 2026-05-28 - Live Discovery Browser Target Resilience

Status: implemented and verified.

Purpose: keep the live discovery-services proof focused on browser fallback capability when a single UNGM detail page intermittently returns 403.

Changes in this slice:
- Updated the live discovery-services proof to try multiple resolved UNGM opportunity targets before declaring browser fallback unavailable.
- Kept the original UNGM search URL as a final browser target so the proof can still validate service rendering when one selected detail page is blocked.
- Preserved source URL, search URL, selected opportunity metadata, procurement indicators, sample links, and sample snippets for the first successful browser target.

Verification:
- Initial `npm run platform:proof -- --run live-discovery-services --include-live-safe` failed with run `live_discovery_20260528T022305Z` because the selected browser target returned HTTP 403, while SearXNG and Firecrawl were healthy.
- `npm run platform:proof -- --run live-discovery-services --include-live-safe` then passed with run `live_discovery_20260528T022506Z`.
- The passing run used SearXNG at `https://search.lindela.io`, returned 9 opportunity-relevant results from 10 Bing results for `tenders.go.ke`, scraped 194607 Firecrawl markdown characters from UNDP procurement notices, and browser-scraped UNGM notice `300700` through `http://84.247.181.100:3003` with 223567 markdown characters, 5 procurement indicators, 3 sample links, and 5 opportunity snippets.
- `npx tsc --noEmit --pretty false` passed.
- `npm test -- platform-proof-scenarios.test.ts --run` passed with 6 tests.

Remaining after this slice:
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.
- Continue treating live-browser target failures as source volatility unless every resolved browser target fails.

### 2026-05-27 - Wave 9 Revalidation After Procurement Discovery Proof

Status: verified.

Purpose: revalidate the non-live discovery-to-submission regression chunk after strengthening the live discovery-services proof to use procurement sources and procurement-language indicators.

Verification:
- `npm run platform:proof -- --all --wave 9` passed.
- Covered discovery-to-response package bridge, response package readiness, presentation export/practice readiness, and discovery-to-submission core proof scenarios.
- The run passed 21 test files and 234 tests across discovery parsing/import, opportunity document download, source document intake, RFP parse workflow, requirements workflow, proposal documents, final artifacts, final submission gates, submissions scope, and presentation export.

Remaining after this slice:
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.
- Keep using live-safe source/readiness proofs to harden non-DB discovery, extraction, and response-generation behavior while the database path is unreachable.

### 2026-05-27 - Procurement-Source Live Discovery Services Proof

Status: implemented and verified.

Purpose: strengthen the live discovery-services proof so SearXNG, Firecrawl, and the browser fallback demonstrate procurement-source discovery capability rather than only generic service availability.

Changes in this slice:
- Replaced the generic Firecrawl/browser scrape target with procurement-source defaults.
- Split live scrape targets so Firecrawl proves `https://procurement-notices.undp.org` while the browser fallback proves `https://www.ungm.org/Public/Notice?title=software`.
- Required procurement indicators from both scraped outputs before the live proof passes.
- Recorded Firecrawl and browser procurement-indicator counts in the live discovery evidence table.
- Aligned the SearXNG health fallback with the responsive Bing-backed `tenders.go.ke` procurement query and increased the health-probe timeout.

Verification:
- `npm test -- platform-proof-scenarios.test.ts searxng-client-config.test.ts --run` passed with 12 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-discovery-services --include-live-safe` passed with run `live_discovery_20260527T162225Z`.
- The passing live run returned 7 opportunity-relevant SearXNG results from 10 total Bing results for `tenders.go.ke`, Firecrawl scraped 198382 markdown characters from UNDP procurement notices with 7 procurement indicators, and the browser fallback scraped 146872 characters from UNGM procurement opportunities with 7 procurement indicators.

Remaining after this slice:
- Keep using source-specific live proofs for parser-level normalization and response-readiness validation.
- Restore PostgreSQL connectivity before rerunning DB-backed persisted import-response proofs.

### 2026-05-27 - Kenya PPIP Persisted Proof Routing

Status: implemented and partially verified; DB path still externally blocked.

Purpose: make the DB-backed persisted import-to-response proof source-aware so it can validate the same Kenya PPIP opportunity path that already proved stronger evaluator-criteria response readiness outside the persistence layer.

Changes in this slice:
- Added `LIVE_PERSISTED_IMPORT_RESPONSE_SOURCE_KIND` support for `ungm` and `kenya_ppip`.
- Added Kenya PPIP fetching, source metadata, invalid-TLS document download handling, and broader response-ready opportunity selection to the persisted proof.
- Registered `live-kenya-ppip-persisted-import-response` as a Wave 9 live-safe scenario with Kenya PPIP source URL, 25-page extraction, and Docling retry settings.
- Preserved source kind and source API URL in persisted-proof evidence rows when available.

Verification:
- `npm test -- platform-proof-scenarios.test.ts --run` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-kenya-ppip-persisted-import-response --include-live-safe` failed with run `live_kenya_ppip_persisted_import_response_20260527T161122Z` at the known PostgreSQL connection refusal before source discovery, but confirmed scenario routing, Kenya source-kind proof initialization, richer evidence output, and `idempotent-noop` cleanup status.

Remaining after this slice:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun both `live-persisted-import-response` and `live-kenya-ppip-persisted-import-response`.

### 2026-05-27 - Live Persisted Proof Extraction and Evidence Hardening

Status: implemented and partially verified; DB path still externally blocked.

Purpose: prepare the DB-backed live persisted import-to-response proof to use the same source-extraction resilience and response-quality evidence as the live response-readiness proof once PostgreSQL connectivity is restored.

Changes in this slice:
- Added configurable persisted-proof Docling page limits and bounded conversion retries.
- Accepted usable Docling `partial_success` output when extracted text is still sufficient.
- Persisted draft evaluator-criteria IDs in response document metadata and verifies them from stored rows.
- Expanded persisted-proof evidence rows with document bytes, Docling status/text length, source requirement count, evaluator criteria count, readiness warnings, missing evaluator-criteria counts, response draft words, and draft criteria counts.
- Changed failed proof cleanup status to `idempotent-noop` when no rows were created, avoiding a misleading cleanup-pending signal for connection-refused failures.

Verification:
- `npm test -- platform-proof-scenarios.test.ts --run` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-persisted-import-response --include-live-safe` failed with run `live_persisted_import_response_20260527T160529Z` at the known PostgreSQL connection refusal before source discovery, but the new evidence row recorded `docling-status:not-run`, `readiness:not-run`, `cleanup-remaining:0`, and cleanup status `idempotent-noop`.

Remaining after this slice:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun `npm run platform:proof -- --run live-persisted-import-response --include-live-safe` to validate the full persisted path.

### 2026-05-27 - Live Persisted Import Response Retry After Wave 9

Status: externally blocked.

Purpose: recheck the DB-backed live persisted import-to-response proof after the live Kenya PPIP response-readiness and Wave 9 verification slices passed.

Attempted:
- `npm run platform:proof -- --run live-persisted-import-response --include-live-safe` failed with run `live_persisted_import_response_20260527T155946Z`.
- The proof did not reach source discovery, source document persistence, RFP parsing, requirement persistence, or response draft persistence because PostgreSQL refused the connection to `88.80.188.224:5432`.
- Cleanup had no persisted rows to remove.

Remaining after this slice:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Keep non-DB live source/readiness proofs as the current validated live path while the persistence layer is unreachable.

### 2026-05-27 - Full Non-Live Wave 9 Proof After Evaluator Coverage

Status: verified.

Purpose: revalidate the non-DB discovery-to-submission path after tightening live response evaluator-criteria extraction, win-theme coverage, and Docling retry behavior.

Verification:
- `npm run platform:proof -- --all --wave 9` passed.
- Covered discovery-to-response package bridge, response package readiness, presentation export/practice readiness, and discovery-to-submission core proof scenarios.
- The run passed 21 test files and 234 tests across live response package readiness, discovery parsing/import, opportunity document download, source document intake, RFP parse workflow, requirements workflow, proposal documents, final artifacts, final submission gates, submissions scope, and presentation export.

Remaining after this slice:
- Restore PostgreSQL connectivity and rerun the DB-backed live persisted import-response proof.
- Keep Wave 9 as the non-live regression chunk for response-readiness and discovery-to-submission changes.

### 2026-05-27 - Live Kenya PPIP Evaluator Criteria Coverage

Status: implemented and verified.

Purpose: close the remaining live Kenya PPIP response-quality warning by extracting the RFP's technical evaluation section and preserving every evaluator criterion in win themes and draft alignment.

Changes in this slice:
- Increased Kenya PPIP live response-readiness extraction to the first 25 pages so the proof reaches the RFP's mandatory, technical, and financial evaluation sections.
- Allowed unweighted criteria list rows under evaluation sections to become evaluator criteria when they contain technical, methodology, personnel, experience, schedule, quality, or financial scoring topics.
- Raised win-theme generation coverage so live RFPs with more than eight evaluator criteria do not drop scored criteria from win-theme alignment.
- Added bounded Docling conversion retries and accepted usable `partial_success` output when text and procurement-language checks still pass.
- Added richer evidence row fields for Docling status, evaluator criteria, readiness warnings, and missing draft/win-theme criteria counts.

Verification:
- `npm test -- live-response-package.test.ts platform-proof-scenarios.test.ts --run` passed with 21 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-kenya-ppip-response-readiness --include-live-safe` passed with run `live_kenya_ppip_response_readiness_20260527T155355Z`.
- The passing live run extracted 94041 characters from the 3180241-byte KNH source PDF, captured 24 source requirements, 10 evaluator criteria, 10 win-theme seeds, 10323 draft words, 85 relevant snippets, and produced readiness status `ready_for_review` with 0 blockers, 0 warnings, no missing draft criteria, and no missing win-theme criteria.

Remaining after this slice:
- Restore PostgreSQL connectivity and rerun the DB-backed live persisted import-response proof.
- Consider making the persisted import-response proof use the same Docling retry semantics once the database path is reachable.

### 2026-05-27 - Live Kenya PPIP Response Readiness Proof

Status: implemented and verified.

Purpose: broaden live response-package readiness beyond the UNGM software path by proving a Kenya PPIP opportunity can be found, its source PDF can be extracted, and review-ready Datacraft response drafts can be generated.

Changes in this slice:
- Added a Kenya PPIP mode to the live opportunity response-readiness proof and registered `live-kenya-ppip-response-readiness` as a Wave 9 live-safe scenario.
- Added paragraph-heavy procurement text extraction so source PDFs without neat requirement lists still yield actionable response requirements.
- Removed direct requirement assignment caps from draft generation so all extracted source requirements can be represented in the response package.

Verification:
- Initial live attempts exposed two real readiness gaps: too few extracted source requirement signals, then partial draft coverage of extracted requirements.
- `npm test -- live-response-package.test.ts platform-proof-scenarios.test.ts --run` passed.
- `npm test -- live-response-package.test.ts --run` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-kenya-ppip-response-readiness --include-live-safe` passed with run `live_kenya_ppip_response_readiness_20260527T153526Z`.
- The passing live run selected Kenyatta National Hospital RFP `KNH/RFP/004/2025-2026`, `PROVISION OF CONSULTANCY SERVICES FOR CUSTOMER SATISFACTION SURVEY`, from `https://tenders.go.ke/tenders`.
- The source PDF downloaded with HTTP 200, 3180241 bytes, and Docling extracted 43479 characters from the first 10 pages.
- Response readiness produced six draft artifacts, 24 source requirement signals, 1 win-theme seed, 85 relevant snippets, 7222 total draft words, readiness status `ready_for_review`, 0 blockers, and full source/draft artifact integrity coverage.

Remaining after this slice:
- Restore PostgreSQL connectivity and rerun the DB-backed live persisted import-response proof.
- Continue expanding live proof coverage into persisted import and response creation once the database path is reachable.

### 2026-05-27 - Full Non-Live Wave 9 Proof Revalidation

Status: verified.

Purpose: revalidate the non-DB discovery-to-submission path after live source hardening and while the DB-backed live persisted proof remains blocked.

Verification:
- `npm run platform:proof -- --all --wave 9` passed.
- Covered discovery-to-response bridge, response package readiness, presentation export/practice readiness, and discovery-to-submission core proof scenarios.
- The run passed 21 test files and 231 tests across discovery parsing/import, source document intake, RFP parse workflow, requirements workflow, proposal documents, final artifacts, final submission gates, submissions scope, and presentation export.

Remaining after this slice:
- Restore PostgreSQL connectivity and rerun the DB-backed live persisted import-response proof.
- Continue using Wave 9 as the non-live regression chunk for discovery-to-submission hardening.

### 2026-05-27 - Live Persisted Import Response Retry Still Blocked

Status: externally blocked.

Purpose: recheck the DB-backed live path after confirming live discovery, extraction, and response-package generation outside the persistence layer.

Attempted:
- `npm run platform:proof -- --run live-persisted-import-response --include-live-safe` failed with run `live_persisted_import_response_20260527T151750Z`.
- The proof did not reach source discovery or persistence because PostgreSQL refused the connection to `88.80.188.224:5432`.
- Cleanup had no persisted rows to remove.

Remaining after this slice:
- Restore PostgreSQL connectivity for the live application database, then rerun `live-persisted-import-response`.
- Keep using non-DB live proofs for discovery, document extraction, and response-package readiness until the database path is reachable again.

### 2026-05-27 - Live Source Discovery Matrix and AFDB Retry Hardening

Status: implemented and verified.

Purpose: broaden live opportunity-discovery proof across configured sources and harden AFDB source verification against transient empty/challenge responses.

Changes in this slice:
- Added bounded Firecrawl retries to the dedicated AFDB live proof.
- Aligned the AFDB proof source scrape formats with the generic source proof path by requesting markdown, HTML, and links.
- Kept the browser fallback path available for AFDB source pages and recorded the final scrape method in evidence rows.

Verification:
- Source matrix run covered UNDP, World Bank, AFDB, COMESA, UNICEF, DGMarket, Kenya PPIP, and UNGM with `npm run platform:proof -- --run live-undp-source --run live-world-bank-source --run live-afdb-source --run live-comesa-source --run live-unicef-source --run live-dgmarket-source --run live-kenya-ppip-source --run live-ungm-source --include-live-safe --continue-on-failure`.
- The initial matrix found live opportunities for 7 of 8 sources and captured AFDB as a transient failure when the parser received unusable source content.
- A generic AFDB source check then passed with run `live_afdb_generic_check_20260527T151250Z`, proving the AFDB parser still matched current live content.
- After hardening, the dedicated AFDB proof passed with run `live_afdb_source_20260527T151528Z`, finding 4 normalized AFDB opportunities and a downloadable PDF at `https://www.afdb.org/sites/default/files/documents/project-related-procurement/reoi_for_meteorology_mobile_application87.pdf`.
- `npm test -- afdb-parser.test.ts platform-proof-scenarios.test.ts --run` passed with 8 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.
- Continue expanding live proof from source discovery into persisted import and response generation once database access is available.

### 2026-05-27 - Live Opportunity Response Readiness Revalidation

Status: verified.

Purpose: verify a live opportunity can be found, source documents can be extracted, and a concrete response package can be generated to review-ready state.

Verification:
- `npm run platform:proof -- --run live-opportunity-response-readiness --include-live-safe` passed with run `live_response_readiness_20260527T150649Z`.
- The proof found 10 opportunity-relevant UNGM software notices and selected `Provision of Penetration Testing Services and Security Consultancy for goAML Software product (Web Applications and APIs).`
- The selected UN Secretariat source PDF downloaded successfully with HTTP 200, 171406 bytes, and Docling extracted 3070 characters of procurement text.
- Response readiness produced six Datacraft draft artifacts: cover letter, executive summary, technical approach, management plan, past performance, and cost proposal.
- The readiness gate reported `ready_for_review`, 0 blockers, 8 source requirements covered, 2 win-theme seeds, 85 relevant snippets, 5527 total draft words, and draft artifact integrity coverage of 1.

Remaining after this slice:
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.
- Broaden source-specific live proof beyond the current UNGM software notice path.

### 2026-05-27 - Live Discovery Services Revalidation

Status: verified.

Purpose: verify the configured live search and scrape services that underpin opportunity discovery.

Verification:
- Updated the local ignored `frontend/.env.local` SearXNG endpoint to `https://search.lindela.io`, matching the platform routing note.
- `npm run platform:proof -- --run live-discovery-services --include-live-safe` passed with run `live_discovery_20260527T150450Z`.
- SearXNG returned 9 opportunity-relevant results for `tenders.go.ke` via `https://search.lindela.io`.
- Firecrawl returned usable markdown for `https://example.com` with length 180.
- Browser fallback service at `http://84.247.181.100:3003` returned usable markdown with length 528.

Remaining after this slice:
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.
- Continue hardening live opportunity discovery beyond service availability into source-specific document intake and response generation.

### 2026-05-27 - Full Non-Live Platform Proof After Win/Loss Hardening

Status: verified.

Purpose: recheck the complete non-live platform proof after competitive insight and win/loss pattern AI-output hardening.

Verification:
- `npm run platform:proof -- --all` passed.
- Covered Wave 0 typecheck/unit/runtime proof, Wave 1 browser/API proof, Wave 2 RFP upload and parse/storage proof, Wave 3 compliance/evidence readiness, Wave 4 planning/collaboration and capture pipeline scope, Wave 5 AI/content governance, Wave 6 final submission and approval/production/browser proof, Wave 7 import/operations governance, Wave 8 strategic capability workflows/browser proof, and Wave 9 discovery/RFP/response/readiness/export/discovery-to-submission proof.

Remaining after this verification:
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.
- Continue non-DB hardening around AI-generated enhancements and live discovery while that external database path remains unavailable.

### 2026-05-27 - Unusable AI Win/Loss Pattern Fallbacks

Status: implemented and verified.

Purpose: prevent AI win/loss pattern analysis from suppressing evidence-based heuristic patterns when the AI response contains only unusable pattern objects.

Changes in this slice:
- Add semantic normalization for AI pattern-analysis responses.
- Require pattern type, name, and description before accepting AI-generated patterns.
- Normalize recommendation text, priority, effort, correlation, confidence, insights, and overall recommendations.
- Reuse heuristic win/loss pattern generation when AI returns no usable patterns.

Verification:
- `npm test -- winloss-auth.test.ts --run` passed with 15 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 157 tests.

Remaining after this slice:
- Continue hardening generated response artifacts and analysis outputs against invalid successful AI results.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable AI Competitive Insight Fallbacks

Status: implemented and verified.

Purpose: prevent competitive win/loss analysis from treating blank or non-string AI insight arrays as successful guidance.

Changes in this slice:
- Tighten competitive string-array normalization so only non-blank strings are accepted.
- Apply normalized AI insight arrays to competitor win/loss analysis.
- Preserve deterministic win/loss insight fallbacks when AI returns no usable insight strings.

Verification:
- `npm test -- competitive.test.ts --run` passed with 81 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 156 tests.

Remaining after this slice:
- Continue hardening generated response artifacts and analysis outputs against invalid successful AI results.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Blank AI Practice Feedback Fallbacks

Status: implemented and verified.

Purpose: prevent oral-presentation practice recordings from storing blank successful AI feedback.

Changes in this slice:
- Treat blank AI practice-feedback responses as unusable.
- Reuse deterministic practice-session feedback when AI returns empty text.
- Add regression coverage proving blank AI feedback still persists a meaningful practice summary.

Verification:
- `npm test -- presentations-scope.test.ts --run` passed with 8 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` passed with 18 tests.

Remaining after this slice:
- Continue hardening generated response artifacts and analysis outputs against invalid successful AI results.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Live Persisted Import Response Retry Still Blocked

Status: attempted; externally blocked.

Purpose: recheck the DB-backed live persisted import-to-response proof after full non-live verification passed.

Attempted:
- Ran `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Proof run `live_persisted_import_response_20260527T144411Z` failed before source persistence because PostgreSQL refused the connection: `connect ECONNREFUSED 88.80.188.224:5432`.
- Cleanup had no persisted rows to remove.

Remaining after this slice:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Continue non-DB hardening while the persisted live proof remains externally blocked.

### 2026-05-27 - Full Non-Live Platform Proof Refresh

Status: verified.

Purpose: recheck the complete non-live platform proof after the latest AI fallback and artifact-integrity hardening slices.

Verification:
- `npm run platform:proof -- --all` passed.
- Covered Wave 0 typecheck/unit/runtime proof, Wave 1 browser/API proof, Wave 2 RFP upload and parse/storage proof, Wave 3 compliance/evidence readiness, Wave 4 planning/collaboration and capture pipeline scope, Wave 5 AI/content governance, Wave 6 final submission and approval/production/browser proof, Wave 7 import/operations governance, Wave 8 strategic capability workflows/browser proof, and Wave 9 discovery/RFP/response/readiness/export/discovery-to-submission proof.

Remaining after this verification:
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.
- Continue non-DB hardening around generated outputs and live discovery while that external database path remains unavailable.

### 2026-05-27 - Blank AI Generated Resume Fallbacks

Status: implemented and verified.

Purpose: prevent generated personnel resumes from being stored as blank successful outputs when AI returns empty text.

Changes in this slice:
- Treat blank AI-generated resume content as unusable.
- Reuse the deterministic resume template when AI generation returns empty text.
- Add scoped regression coverage proving blank AI content still produces and stores a meaningful resume.

Verification:
- `npm test -- personnel-scope.test.ts --run` passed with 6 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave4-planning-collaboration-tasks` passed with 34 tests.

Remaining after this slice:
- Continue hardening generated response artifacts and analysis outputs against invalid successful AI results.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable AI Resume Parse Fallbacks

Status: implemented and verified.

Purpose: prevent resume parsing from reporting success when AI returns syntactically valid JSON that does not contain a usable candidate identity or resume structure.

Changes in this slice:
- Validate AI-parsed resume JSON before returning a successful parsed resume.
- Require non-blank first and last names for AI parse acceptance.
- Normalize optional education, experience, skills, certification, and clearance arrays without preserving empty objects.
- Reuse deterministic resume extraction when AI parse output is unusable.

Verification:
- `npm test -- personnel-auth.test.ts --run` passed with 2 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave4-planning-collaboration-tasks` passed with 34 tests.

Remaining after this slice:
- Continue hardening generated response artifacts and analysis outputs against invalid successful AI results.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable LLM Score Analysis Fallbacks

Status: implemented and verified.

Purpose: prevent LLM-powered opportunity scoring from writing successful score rows when the AI response is syntactically valid JSON but lacks a usable score, factor rationale, or reasoning.

Changes in this slice:
- Add shared validation for LLM score-analysis responses.
- Require finite 0-100 scores, at least one usable score factor, and non-blank reasoning before persisting LLM score rows.
- Apply the same validation to LLM fit score, win probability, and risk score paths.
- Fall back to existing heuristic scoring when LLM score analysis is unusable instead of storing `NaN` scores or empty factor arrays.

Verification:
- `npm test -- opportunity-ai-scope.test.ts --run` passed with 6 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 45 tests.

Remaining after this slice:
- Continue hardening generated response artifacts and analysis outputs against invalid successful AI results.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable AI Document Structure Fallbacks

Status: implemented and verified.

Purpose: keep document structure generation from accepting AI outline nodes that have no meaningful titles and turning them into generic successful sections.

Changes in this slice:
- Validate parsed AI document structure nodes before accepting them.
- Drop top-level and child outline nodes that are not objects or have blank/missing titles.
- Normalize accepted node type, length, order, and id fields without fabricating titles for unusable nodes.
- Reuse the deterministic proposal structure fallback when no usable AI outline nodes remain.

Verification:
- `npm test -- document-generation-auth.test.ts --run` passed with 9 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 44 tests.

Remaining after this slice:
- Continue hardening generated response artifacts against invalid successful outputs.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Invalid AI Process Flow Fallbacks

Status: implemented and verified.

Purpose: keep proposal graphics generation from returning successful visual artifacts when AI emits non-flowchart or otherwise unusable Mermaid diagram code.

Changes in this slice:
- Validate AI process-flow diagram code before accepting it.
- Require generated process flows to start as `flowchart TD` and include Mermaid edges.
- Reuse deterministic process-flow generation when AI returns a different diagram type or edge-less content.
- Add regression coverage for AI returning a non-flowchart Mermaid diagram in JSON.

Verification:
- `npm test -- graphics-scope.test.ts --run` passed with 14 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 284 tests.

Remaining after this slice:
- Continue hardening generated response artifacts against invalid successful outputs.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Live Persisted Import Response Retry Still Blocked

Status: attempted; externally blocked.

Purpose: recheck the DB-backed live proof after the latest discovery, RFP intake, requirements extraction, and response-support hardening.

Attempted:
- Ran `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Proof run `live_persisted_import_response_20260527T141904Z` failed before source discovery or persistence because PostgreSQL refused the connection: `connect ECONNREFUSED 88.80.188.224:5432`.
- Cleanup had no persisted rows to remove.

Remaining after this slice:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Continue non-DB hardening while the persisted live proof remains externally blocked.

### 2026-05-27 - RFP Discovery No-Document Failure

Status: implemented and verified.

Purpose: keep RFP document discovery from reporting success and marking an opportunity as document-discovered when no downloadable RFP documents were found.

Changes in this slice:
- Normalize Firecrawl extracted document rows before accepting them as discovered documents.
- Drop malformed extracted document rows with blank URLs and fall back to link extraction when possible.
- Use filename fallback from the resolved URL when extracted document names are blank.
- Return an explicit no-document failure before inserting rows or marking the opportunity as discovered.

Verification:
- `npm test -- rfp-document-service.test.ts --run` passed with 13 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 139 tests.

Remaining after this slice:
- Continue hardening discovery, intake, and response generation against false-positive success states.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable AI Requirement Extraction Fallbacks

Status: implemented and verified.

Purpose: keep RFP intake from returning blank extracted requirements when AI emits syntactically valid requirement arrays with malformed objects.

Changes in this slice:
- Validate AI-extracted requirement rows for non-empty requirement text before returning them.
- Normalize accepted category, priority, risk level, source text, and document metadata.
- Reuse heuristic requirement extraction when AI output contains no usable requirements.
- Add focused regression coverage for an AI response of `{ "requirements": [{}] }`.
- Add the extraction regression to the Wave 3 compliance/evidence platform proof manifest.

Verification:
- `npm test -- requirements-extraction.test.ts --run` passed with 1 test.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 97 tests.

Remaining after this slice:
- Continue auditing discovery and response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable AI Win Theme Injection Fallbacks

Status: implemented and verified.

Purpose: keep win-theme injection support from storing blank injection points when AI emits non-empty arrays with malformed injection objects.

Changes in this slice:
- Validate AI injection suggestions for non-empty section name, suggested text, and rationale before storing.
- Normalize accepted injection theme IDs, insert position, page number, context text, and impact score.
- Reuse deterministic injection suggestions when AI output contains no usable injection objects.
- Add regression coverage for an AI response of `{ "injections": [{}] }`.

Verification:
- `npm test -- win-themes-auth.test.ts --run` passed with 21 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 155 tests.

Remaining after this slice:
- Continue auditing discovery and response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable AI Cost Suggestion Fallbacks

Status: implemented and verified.

Purpose: keep pricing support from returning successful cost suggestions when AI emits non-empty arrays with blank or malformed suggestion objects.

Changes in this slice:
- Validate AI cost suggestion rows for supported cost element type, non-empty suggested name, and non-empty rationale.
- Normalize accepted cost suggestion fields, positive numeric estimates, optional labor category labels, and confidence.
- Reuse deterministic cost suggestions when AI output contains no usable suggestion objects.
- Add regression coverage for an AI response of `{ "suggestions": [{}] }`.

Verification:
- `npm test -- pricing.test.ts --run` passed with 102 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 283 tests.

Remaining after this slice:
- Continue auditing discovery and response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable AI Graphic Suggestion Fallbacks

Status: implemented and verified.

Purpose: keep proposal graphics support from returning a successful but empty or blank suggestion list when AI emits malformed suggestion objects.

Changes in this slice:
- Validate AI graphic suggestions as arrays of supported graphic types with non-empty titles and rationales.
- Trim accepted graphic suggestion fields and clamp confidence into the supported range.
- Reuse deterministic graphics suggestions when AI output has no usable suggestion text.
- Add regression coverage for AI output containing blank suggestion objects.

Verification:
- `npm test -- graphics-scope.test.ts --run` passed with 13 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 282 tests.

Remaining after this slice:
- Continue auditing discovery and response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - AI Guessed Document URL Guards

Status: implemented and verified.

Purpose: keep the last-resort AI URL guessing strategy from storing blank, non-HTTP, or non-document guessed URLs as discovered tender documents.

Changes in this slice:
- Validate AI guessed URL rows for non-empty URL text before scoring.
- Resolve guessed URLs against the source portal and require HTTP(S) document/download-style URLs.
- Normalize guessed names, document type, reasoning, and numeric confidence before constructing discovered sources.
- Add regression coverage proving blank AI guessed URL rows do not mark the strategy successful or store blank sources.

Verification:
- `npm test -- document-discovery-agent.test.ts --run` passed with 6 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 138 tests.

Remaining after this slice:
- Continue auditing discovery and response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable AI Win Theme Artifact Fallbacks

Status: implemented and verified.

Purpose: keep response strategy support from treating non-empty AI arrays with blank or malformed win-theme artifacts as usable generated content.

Changes in this slice:
- Validate AI win-theme suggestions for non-empty statement text before returning them.
- Validate AI ghost-theme suggestions for non-empty counter-positioning statements, normalize phrasings, and clamp subtlety.
- Validate AI reinforcement options for non-empty text, safe tone, and finite word count.
- Reuse deterministic win-theme, ghost-theme, and reinforcement fallbacks when AI arrays contain no usable artifacts.

Verification:
- `npm test -- win-themes-auth.test.ts --run` passed with 20 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 154 tests.

Remaining after this slice:
- Continue auditing discovery and response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - AI Discovery Query Fallbacks

Status: implemented and verified.

Purpose: keep document discovery from spending SearXNG searches on blank or malformed AI-generated query rows when deterministic tender identifiers are available.

Changes in this slice:
- Validate AI discovery query rows for non-empty query text before sorting and searching.
- Trim accepted AI query strings and file-type query strings before deduplication.
- Fall back to deterministic enhanced tender queries when AI output contains no usable queries.
- Reset per-test service mock implementations in document discovery coverage to prevent cross-case query leakage.

Verification:
- `npm test -- document-discovery-agent.test.ts --run` passed with 5 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 137 tests.

Remaining after this slice:
- Continue auditing discovery and response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable AI Competitive Discriminator Fallbacks

Status: implemented and verified.

Purpose: keep competitive differentiation support from accepting syntactically valid but empty AI discriminator rows that suppress deterministic discriminator suggestions.

Changes in this slice:
- Validate AI discriminator suggestions for non-empty statement and rationale before accepting them.
- Trim accepted AI discriminator fields, normalize `effectiveAgainst`, and clamp confidence.
- Reuse deterministic discriminator suggestions when AI returns only unusable suggestion objects.
- Add regression coverage for an AI discriminator response of `[{}]`.

Verification:
- `npm test -- competitive.test.ts --run` passed with 80 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 151 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Blank AI Win/Loss Insight Fallbacks

Status: implemented and verified.

Purpose: keep win/loss strategy support from returning a successful empty insight list when AI returns only blank strings.

Changes in this slice:
- Treat AI win/loss insight arrays as unusable when trimming leaves zero substantive insights.
- Reuse heuristic win/loss insights when blank AI output is unusable and observed evidence exists.
- Add regression coverage for all-blank AI insight arrays.

Verification:
- `npm test -- winloss-auth.test.ts --run` passed with 14 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 150 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Blank AI Document Analysis Finding Guards

Status: implemented and verified.

Purpose: keep document quality analysis from saving blank AI issues or suggestions as actionable proposal-improvement findings.

Changes in this slice:
- Drop AI analysis issues with blank messages before creating analysis findings.
- Drop AI suggestions with blank text before saving improvement guidance.
- Normalize invalid issue severity, suggestion type, and suggestion impact values to safe defaults.
- Add regression coverage for blank issue/suggestion rows from an available AI provider.

Verification:
- `npm test -- document-analysis-scope.test.ts --run` passed with 5 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 43 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Unusable AI Opportunity Factor Fallbacks

Status: implemented and verified.

Purpose: keep opportunity fit, win-probability, and risk scoring from accepting valid JSON factor arrays that contain no usable scoring factors.

Changes in this slice:
- Validate AI score factors for non-empty factor names, finite weights/scores, and non-empty reasoning.
- Clamp accepted AI weights and scores into supported ranges.
- Reuse heuristic scoring when AI fit, win, or risk factor arrays contain no usable factors.
- Add regression coverage for an AI factor response of `{ "factors": [{}] }`.

Verification:
- `npm test -- opportunity-ai-scope.test.ts --run` passed with 5 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 42 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Presentation Q&A Fallbacks

Status: implemented and verified.

Purpose: keep oral-presentation preparation from returning zero anticipated questions when AI returns an empty or unusable JSON array despite available slide or requirement context.

Changes in this slice:
- Normalize AI-generated anticipated questions to require non-empty question text.
- Clamp probability and default optional classification fields when usable question text exists.
- Fall back to deterministic Q&A generation when contextual presentations receive no usable AI questions.
- Add presentation scope coverage to the Wave 9 presentation proof manifest.

Verification:
- `npm test -- presentations-scope.test.ts --run` passed with 7 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` passed with 17 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Section Content Fallbacks

Status: implemented and verified.

Purpose: keep generated proposal sections from turning valid but empty AI paragraph JSON into successful documents containing raw JSON instead of proposal prose.

Changes in this slice:
- Filter AI-generated section paragraphs to non-empty text before creating document content.
- Treat parsed JSON with no usable paragraphs as unusable and reuse deterministic section prose.
- Preserve raw-text fallback for non-JSON provider responses while avoiding raw empty JSON artifacts.
- Add regression coverage for empty paragraph strings.

Verification:
- `npm test -- document-generation-auth.test.ts --run` passed with 8 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 41 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI PWin Recommendation Fallbacks

Status: implemented and verified.

Purpose: keep AI PWin recommendation generation from suppressing useful heuristic recommendations when the provider returns non-empty but unusable objects.

Changes in this slice:
- Validate AI PWin recommendation rows for non-empty recommendation/factor text, finite expected impact, and supported priority/effort/timeframe values.
- Ignore unusable AI recommendation rows and fall back to heuristic recommendations when none remain.
- Trim accepted AI recommendation text and factor names before mapping factor IDs.
- Add regression coverage for an AI response of `[{}]`.

Verification:
- `npm test -- pwin-opportunity-scope.test.ts --run` passed with 9 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 149 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Win-Theme Fallbacks

Status: implemented and verified.

Purpose: keep response strategy support from returning successful empty win-theme artifacts when AI returns valid JSON with empty lists.

Changes in this slice:
- Treat empty AI theme-suggestion lists as unusable and reuse deterministic theme suggestions.
- Treat empty AI reinforcement options as unusable and reuse deterministic reinforcement text.
- Treat empty AI ghost-theme lists as unusable and reuse deterministic ghost theme suggestions.
- Treat empty AI injection-suggestion lists as unusable and reuse deterministic injection drafts.
- Add regression coverage for all four empty-list cases.

Verification:
- `npm test -- win-themes-auth.test.ts --run` passed with 17 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 148 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Capture Pipeline Fallbacks

Status: implemented and verified.

Purpose: keep capture pipeline decision support from treating syntactically valid but content-free AI output as successful PWin confidence or bid-decision analysis.

Changes in this slice:
- Keep suggested PWin confidence finite when AI returns empty JSON or a non-numeric confidence value.
- Treat bid-decision AI responses with blank executive summary, blank competitive position, or invalid recommendation as unusable.
- Reuse deterministic bid-decision analysis for unusable AI responses and trim accepted AI fields.
- Add regression coverage for empty AI JSON in suggested PWin and bid-decision generation.

Verification:
- `npm test -- pipeline-scope.test.ts --run` passed with 11 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave4-capture-pipeline-scope` passed with 13 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Document Generation Fallbacks

Status: implemented and verified.

Purpose: keep document structure and diagram generation from returning successful empty artifacts when AI returns valid but content-free output.

Changes in this slice:
- Treat AI document-structure responses with an empty array as unusable and reuse the existing deterministic outline fallback.
- Treat blank Mermaid diagram code after code-fence cleanup as unusable and reuse deterministic diagram generation.
- Add regression coverage for empty structure arrays and blank diagram code.

Verification:
- `npm test -- document-generation-auth.test.ts --run` passed with 7 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 40 tests.

Remaining after this slice:
- Continue auditing response-support AI actions for valid-but-empty generated content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Pricing Production Fallbacks

Status: implemented and verified.

Purpose: prevent pricing production support from returning successful but unusable cost realism or WBS artifacts when AI returns valid JSON with missing substantive content.

Changes in this slice:
- Treat parsed AI cost-realism responses as unusable unless they include assessment, numeric score, factors, and non-empty narrative.
- Treat parsed AI WBS responses with zero flattened items as unusable.
- Reuse deterministic cost-realism and WBS fallbacks for these structurally empty AI responses.
- Add regression coverage for empty cost-realism JSON and empty WBS item arrays.

Verification:
- `npm run platform:proof -- --all --continue-on-failure` passed the full non-live proof manifest before this slice.
- `npm test -- pricing.test.ts --run` passed with 101 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 281 tests.

Remaining after this slice:
- Continue auditing response-production paths for structurally valid but unusable AI output.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Empty AI Pricing Fallbacks

Status: implemented and verified.

Purpose: keep pricing support from accepting syntactically valid but empty AI output as successful cost suggestions or staffing estimates.

Changes in this slice:
- Treat parsed AI cost-suggestion responses with no suggestions as unusable and reuse deterministic cost suggestions.
- Treat parsed AI technical-hours responses with no usable hours or staffing as unusable and reuse deterministic hours estimates.
- Apply the same empty-staffing guard to scope-based hours estimation.
- Add pricing engine coverage to the Wave 6 production proof manifest.

Verification:
- `npm test -- pricing.test.ts --run` passed with 99 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 279 tests.

Remaining after this slice:
- Continue auditing pricing and response-production paths for structurally valid but unusable AI output.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Blank AI Past-Performance Narrative Fallbacks

Status: implemented and verified.

Purpose: stop past-performance support narratives from being saved as successful empty artifacts when an AI provider returns blank content.

Changes in this slice:
- Treat blank AI CPAR narrative output as unusable and reuse the deterministic CPAR fallback.
- Treat blank AI brief-description output as unusable and reuse the deterministic brief-description fallback.
- Treat blank AI relevance-narrative output as unusable and reuse the deterministic relevance fallback.
- Add regression coverage for all three blank-AI narrative paths.

Verification:
- `npm test -- past-performance-scope.test.ts --run` passed with 12 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 144 tests.

Remaining after this slice:
- Continue auditing response-support generation paths for blank AI output that can still be reported as successful.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Blank AI Ghost Theme Fallback

Status: implemented and verified.

Purpose: stop competitive ghost-theme generation from returning a successful empty response when an AI provider returns blank content.

Changes in this slice:
- Treat blank AI ghost-theme text as unusable.
- Reuse the existing deterministic ghost-language fallback for the supplied competitor weakness.
- Add regression coverage proving blank AI output still returns a non-empty evaluator-facing ghost theme.

Verification:
- `npm test -- competitive.test.ts --run` passed with 79 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 141 tests.

Remaining after this slice:
- Continue closing successful-empty response-support paths where AI returns syntactically valid but unusable content.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.

### 2026-05-27 - Command Center Readiness Dimension Resilience

Status: implemented and verified.

Purpose: keep the opportunity command center from crashing when a readiness-dimension projection omits optional detail rows.

Changes in this slice:
- Default readiness dimension details to an empty list at render time.
- Preserve existing Response Readiness cards and action links when older or harnessed projections do not include detail arrays.
- Use the broad non-live proof manifest to identify the failure, then rerun the failing Wave 1 browser scenario after the fix.

Verification:
- `npm run platform:proof -- --all --continue-on-failure` ran the full non-live proof manifest; every scenario passed except the pre-fix `wave1-control-plane-browser` command-center crash.
- `npm run platform:proof -- --run wave1-control-plane-browser` passed with 3 browser tests after the fix.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.
- Continue non-DB hardening while live persistence remains blocked by PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-27 - Firecrawl-Enriched SearXNG Discovery Results

Status: implemented and verified.

Purpose: move default opportunity discovery from thin SearXNG result cards toward usable RFP intake material by scraping top search hits through Firecrawl.

Changes in this slice:
- Add bounded Firecrawl enrichment to `DefaultDiscoveryService.discover_opportunities` after SearXNG candidate discovery.
- Capture clean markdown, metadata, scraped links, extraction payload, truncation status, and likely RFP/document links on enriched opportunities.
- Keep enrichment configurable through `enrich` and `enrich_limit` filters plus `DISCOVERY_FIRECRAWL_ENRICH_LIMIT`.
- Add Firecrawl to discovery source listing alongside SearXNG.
- Add regression coverage proving SearXNG results are enriched, cached, and produce absolute RFP document links without live network calls.

Verification:
- `uv run pytest tests/ci/test_discovery_service_contract.py tests/ci/test_search_infrastructure_config.py -q` passed with 7 tests.
- `uv run pytest tests/ci/test_discovery_service_contract.py tests/ci/test_search_infrastructure_config.py tests/ci/test_intelligence_service_contract.py -q` passed with 10 tests.
- `python -m py_compile src/docfusion/services/discovery_service.py tests/ci/test_discovery_service_contract.py` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue connecting enriched discovery output into persisted import/intake flows and live proof once PostgreSQL connectivity is restored.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Speaker Notes on Blank AI

Status: implemented and verified.

Purpose: keep oral-presentation rehearsal notes usable when an AI provider returns blank speaker-note text.

Changes in this slice:
- Treat blank AI speaker-note responses as unusable instead of saving empty slide notes.
- Reuse the existing deterministic speaker-note fallback from slide title, timing, and bullet/text content.
- Add regression coverage proving blank AI output writes reviewable speaker notes back to the scoped slide.

Verification:
- `npm test -- presentations-scope.test.ts` passed with 6 tests.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` passed with 10 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing successful-empty response rehearsal artifacts and broaden proof where platform scenarios include those paths.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Presentation Slides on Empty AI

Status: implemented and verified.

Purpose: keep oral-presentation deck generation usable when an AI provider returns a valid but empty slide array.

Changes in this slice:
- Treat empty AI slide arrays as unusable instead of creating a successful presentation with zero slides.
- Reuse the existing deterministic slide-deck fallback from presentation context and proposal document text.
- Add regression coverage proving empty AI output still inserts a reviewable title/agenda fallback deck and updates the presentation slide count.

Verification:
- `npm test -- presentations-scope.test.ts` passed with 5 tests.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` passed with 10 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing successful-empty response artifacts, especially where providers return syntactically valid but unusable output.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Presentation Q&A Answers on Blank AI

Status: implemented and verified.

Purpose: keep oral-presentation Q&A preparation usable when an AI provider returns blank answer text.

Changes in this slice:
- Treat blank AI answer suggestions as unusable instead of saving empty Q&A answers.
- Reuse the existing deterministic answer fallback from stored question key points.
- Add regression coverage proving blank AI output writes a reviewable answer back to the scoped Q&A item.

Verification:
- `npm test -- presentations-scope.test.ts` passed with 4 tests.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` passed with 10 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing blank or malformed provider paths in response rehearsal and final presentation workflows.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Heuristic SWOT Fallback on Malformed AI

Status: implemented and verified.

Purpose: keep competitive SWOT analysis usable when an AI provider is available but returns malformed analysis output.

Changes in this slice:
- Reuse the existing evidence-based heuristic SWOT generator when AI SWOT parsing fails.
- Preserve AI-generated SWOT output when valid and the heuristic path when AI is unavailable.
- Store malformed-AI fallbacks as `system-heuristic` analyses instead of failing the whole action.
- Add regression coverage proving provider-available malformed AI still persists and returns a heuristic SWOT with evidence-based insights.

Verification:
- `npm test -- competitive.test.ts` passed with 78 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 140 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing malformed-provider strategic analysis paths where heuristic evidence already exists.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic BOE Narrative Fallbacks

Status: implemented and verified.

Purpose: keep cost-volume Basis of Estimate drafting usable when AI narrative generation is unavailable but structured cost element data is already available.

Changes in this slice:
- Add deterministic BOE narrative generation for labor, ODC, subcontract, travel, and generic cost elements.
- Preserve AI-generated BOE narratives when available while falling back on blank or failed AI responses.
- Use existing WBS, labor category, hours, rates, direct costs, vendor, quote, subcontractor, and travel fields to draft auditable review text.
- Add regression coverage proving unavailable AI still writes a BOE narrative back to the scoped cost element.

Verification:
- `npm test -- pricing.test.ts` passed with 97 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing pricing and response-production paths where structured records can produce deterministic draft artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Discriminator Suggestions

Status: implemented and verified.

Purpose: keep competitive positioning actionable when AI discriminator generation is unavailable but linked competitor weaknesses are already recorded.

Changes in this slice:
- Add deterministic discriminator suggestions from assigned opportunity context and visible competitor weaknesses.
- Classify weakness signals into cost, schedule, team, past-performance, innovation, approach, or capability discriminator types.
- Avoid duplicating active discriminator statements while preserving existing relevant discriminator suggestions.
- Add regression coverage proving unavailable AI still returns reviewable discriminator suggestions effective against the linked competitor.

Verification:
- `npm test -- competitive.test.ts` passed with 77 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 139 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing successful-empty strategic planning paths where recorded opportunity or competitor evidence can produce operator actions.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Graphic Action Captions

Status: implemented and verified.

Purpose: keep proposal graphics captioning usable when AI caption generation is unavailable or fails.

Changes in this slice:
- Add deterministic action caption generation from stored graphic title, type, caption, and diagram context.
- Preserve AI-generated captions when available while normalizing them to start with proposal action verbs.
- Fall back to type-aware captions for process flows, org charts, schedules, timelines, infographics, charts, and generic diagrams.
- Add regression coverage proving unavailable AI still writes a reviewable action caption to the graphic record.

Verification:
- `npm test -- graphics-scope.test.ts` passed with 12 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 180 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing AI-only response-support paths where stored proposal artifacts can produce deterministic review content.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Document Diagram Fallbacks

Status: implemented and verified.

Purpose: keep response-authoring visuals available when AI diagram generation is unavailable or fails.

Changes in this slice:
- Add deterministic Mermaid generation for flowchart, sequence, state, gantt, mindmap, class, and ER diagram requests.
- Preserve napkin sketch generation without requiring AI.
- Return deterministic diagrams when the AI provider is unavailable or generation fails, instead of returning an error-only diagram.
- Add regression coverage proving unavailable AI still produces a reviewable flowchart without calling the provider.

Verification:
- `npm test -- document-generation-auth.test.ts` passed with 5 tests.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 38 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing response-authoring gaps where draft artifacts can be generated deterministically from structured inputs.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Document Structure Auto-Fill Creation

Status: implemented and verified.

Purpose: remove the deferred document-generation auto-fill path so generated response outlines can immediately become editable draft documents with generated section content.

Changes in this slice:
- Implement `createDocumentFromStructure(..., { autoFill: true })` by generating content for each structure node during document creation.
- Preserve editable outline creation for `autoFill: false`.
- Add per-section deterministic fallback content if AI section generation fails, so one failed section does not block draft creation.
- Store generated content and word count in the created document and initial version.
- Add document-generation auto-fill coverage to Wave 5 AI/content governance proof.

Verification:
- `npm test -- document-generation-auth.test.ts` passed with 4 tests.
- `npm test -- platform-proof-scenarios.test.ts` passed with 6 tests.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 37 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue closing response-generation paths where authoring features are still unavailable or only partially wired.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Partner Sourcing Actions for Capability Gaps

Status: implemented and verified.

Purpose: keep capture planning actionable when opportunity capability gaps exist but no active partner or teaming-capable competitor currently matches them.

Changes in this slice:
- Add partner-sourcing fallback suggestions for uncovered capability gaps.
- Preserve existing matched partner recommendations and append sourcing actions only for gaps not covered by any recommendation.
- Return bounded, low-confidence sourcing actions without fabricating partner IDs.
- Add regression coverage proving security and cloud gaps produce explicit sourcing actions when no partner records match.

Verification:
- `npm test -- competitive.test.ts` passed with 76 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 138 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing silent successful-empty capture/response support paths where scoped gaps can produce operator actions.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Ghost Theme Fallbacks

Status: implemented and verified.

Purpose: keep competitive ghost-theme generation usable when AI output is malformed but scoped competitor weaknesses and our differentiators are available.

Changes in this slice:
- Add deterministic ghost-theme suggestions from competitor weakness and our differentiator fields.
- Preserve competitor linkage, subtlety level, phrasings, rationale, and pending review status.
- Return deterministic ghost themes after AI parse failure instead of failing the action.
- Add regression coverage proving malformed AI output still produces reviewable ghost-theme suggestions.

Verification:
- `npm test -- win-themes-auth.test.ts` passed with 13 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 137 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing remaining successful-empty response-support paths where scoped evidence can produce deterministic artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Win-Theme Reinforcement Fallbacks

Status: implemented and verified.

Purpose: keep section-level win-theme reinforcement usable when AI reinforcement output is malformed but the active theme and supporting evidence are available.

Changes in this slice:
- Add deterministic reinforcement text options from theme statement, short version, supporting evidence, requested tone, and option count.
- Return placement guidance and bounded word counts with generated reinforcement options.
- Return deterministic reinforcement text after AI parse failure instead of failing the action.
- Add regression coverage proving malformed AI output still produces reviewable reinforcement options.

Verification:
- `npm test -- win-themes-auth.test.ts` passed with 12 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 136 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing AI-only competitive/ghost-theme paths where scoped competitor context can produce deterministic review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Win-Theme Suggestion Fallbacks

Status: implemented and verified.

Purpose: keep strategic win-theme generation usable when AI suggestion output is malformed but competitor weaknesses and operator context already contain theme signals.

Changes in this slice:
- Add deterministic win-theme suggestions from competitor weaknesses, past-performance proof, value/cost language, and differentiation context.
- Avoid duplicating existing theme statements and respect requested theme-type filters.
- Generate bounded confidence, rationale, keywords, and pending review status from explicit context signals.
- Return deterministic theme suggestions after AI parse failure instead of failing the action.
- Add regression coverage proving malformed AI output still produces reviewable win-theme suggestions.

Verification:
- `npm test -- win-themes-auth.test.ts` passed with 11 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 135 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing AI-only win-theme and response-reinforcement paths where scoped context can produce deterministic review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Cost Realism Fallbacks

Status: implemented and verified.

Purpose: keep pricing review usable when AI cost-realism output is malformed but calculated pricing totals, labor mix, and cost elements are already available.

Changes in this slice:
- Add deterministic cost-realism analysis from calculated pricing summary, cost elements, labor hours, labor rate, direct-cost mix, and indirect-rate signals.
- Generate bounded scores, factor assessments, risks, mitigations, and narrative from explicit pricing evidence.
- Return deterministic analysis after AI parse failure instead of failing the action.
- Add regression coverage proving malformed AI output still produces a reviewable cost-realism assessment.

Verification:
- `npm test -- pricing.test.ts` passed with 96 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing AI-only pricing and BOE paths where calculated cost data can support deterministic review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic WBS Generation Fallback

Status: implemented and verified.

Purpose: keep cost-volume work breakdown structure generation usable when AI WBS output is malformed but assigned technical tracking records are already available.

Changes in this slice:
- Add deterministic WBS generation from technical tracking section names.
- Build a level-1 program delivery root with level-2 work packages linked to technical section IDs.
- Return deterministic WBS items after AI parse failure instead of failing the action.
- Add regression coverage proving malformed AI output still returns reviewable WBS items.

Verification:
- `npm test -- pricing.test.ts` passed with 95 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing AI-only pricing/BOE paths where scoped technical records can produce deterministic artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Hours Estimate Fallbacks

Status: implemented and verified.

Purpose: keep BOE staffing work moving when AI hour-estimate output is malformed but technical scope and active labor categories are available.

Changes in this slice:
- Add deterministic hours estimates from scope length, complexity keywords, active labor categories, and explicit complexity multipliers.
- Return fallback hour estimates for both technical-section estimates and freeform scope estimates after AI parse failure.
- Persist implied staffing on technical tracking records when deterministic technical estimates are used.
- Add regression coverage proving malformed AI output still stores implied staffing and returns a reviewable estimate.

Verification:
- `npm test -- pricing.test.ts` passed with 94 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing AI-only BOE and pricing analysis paths where existing cost/technical records can produce deterministic review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Cost Suggestion Fallbacks

Status: implemented and verified.

Purpose: keep cost-technical alignment work moving when AI cost-suggestion output is malformed but the technical section and active labor categories already provide enough pricing signals.

Changes in this slice:
- Add deterministic cost suggestions from section content, active labor categories, rates, and direct-cost keywords.
- Map technical sections to likely labor categories and estimate bounded fallback hours.
- Add ODC, travel, and subcontract suggestions from explicit section signals.
- Return reviewable fallback suggestions after AI parse failure instead of failing the action.
- Add regression coverage proving malformed AI output still produces labor, ODC, and travel suggestions.

Verification:
- `npm test -- pricing.test.ts` passed with 93 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing AI-only pricing and BOE generation failures where existing technical/cost inputs can produce deterministic review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Process Flow Generation Fallback

Status: implemented and verified.

Purpose: keep process-flow graphics generation usable when AI output is malformed but the submitted process description already contains enough ordered steps to create a Mermaid diagram.

Changes in this slice:
- Derive process-flow steps from the provided description using sentence, line, and transition-word boundaries.
- Build deterministic Mermaid `flowchart TD` output with sanitized labels when AI output cannot be parsed or contains no usable diagram.
- Preserve existing raw Mermaid extraction when AI returns a flowchart outside JSON.
- Add regression coverage proving malformed AI output still returns a non-empty process flow without touching persistence when no opportunity is supplied.

Verification:
- `npm test -- graphics-scope.test.ts` passed with 11 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 179 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing AI-only generation failures where user-supplied structured text can produce deterministic review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Graphics Suggestion Fallbacks

Status: implemented and verified.

Purpose: keep proposal sections from receiving a successful empty graphics suggestion set when AI output is malformed but section content contains visualizable evidence.

Changes in this slice:
- Add deterministic graphics suggestions from section keywords for process flow, schedule, team structure, metrics chart, and summary infographic cases.
- Return evidence-based fallback suggestions when AI graphic suggestion JSON parsing fails.
- Preserve suggestion ordering by confidence and cap fallback output to five reviewable items.
- Add regression coverage proving malformed AI output still returns non-empty graphics suggestions for workflow, milestone, team, and metric evidence.

Verification:
- `npm test -- graphics-scope.test.ts` passed with 10 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 178 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing response-production paths where malformed AI output hides deterministic review artifacts behind successful empty results.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Win-Theme Injection Fallbacks

Status: implemented and verified.

Purpose: keep generated responses able to reinforce active win themes when AI injection suggestion output is malformed.

Changes in this slice:
- Add deterministic win-theme injection drafts from active theme statement, target sections, supporting evidence, keywords, and mapped criteria.
- Avoid suggesting a deterministic injection into sections where the same theme already has an occurrence.
- Persist deterministic fallback injections as pending review items with evidence-based rationale and bounded impact score.
- Convert malformed AI injection output into deterministic suggestions instead of a failed generation response.
- Add regression coverage proving malformed AI output still creates a reviewable injection suggestion.

Verification:
- `npm test -- win-themes-auth.test.ts` passed with 10 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 134 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing response-generation paths where malformed AI output blocks deterministic, evidence-backed review artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Actionable PWin Recommendation Fallbacks

Status: implemented and verified.

Purpose: stop PWin improvement fallback generation from returning a successful empty recommendation set when moderate but actionable factor weaknesses are present.

Changes in this slice:
- Generate heuristic recommendations for all actionable sensitivity factors, not only high-priority/high-impact factors.
- Fall back to scored factor gaps when stored sensitivity rows are missing or incomplete.
- Include expected PWin impact and current factor score in deterministic recommendation text.
- Preserve prioritization by factor priority and impact while limiting output to the top three actions.
- Add regression coverage proving moderate sensitivity evidence produces persisted recommendations instead of an empty success.

Verification:
- `npm test -- pwin-opportunity-scope.test.ts` passed with 8 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 133 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing successful empty response-support outputs where the domain has enough evidence to produce actionable guidance.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence-Based Win/Loss Pattern Confidence

Status: implemented and verified.

Purpose: stop heuristic win/loss pattern analysis from assigning fixed confidence and correlation values instead of reflecting observed debrief evidence.

Changes in this slice:
- Derive strength and weakness pattern correlations from win-versus-loss occurrence rates.
- Derive heuristic pattern confidence from sample size, occurrence count, and outcome evidence.
- Derive pricing pattern confidence from sample size, scored-debrief coverage, and cost-score separation.
- Replace the fixed heuristic overall confidence with the average confidence of generated patterns.
- Add regression coverage proving persisted pattern confidence and correlation values come from observed win/loss evidence.

Verification:
- `npm test -- winloss-auth.test.ts` passed with 13 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 132 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing generic confidence values in response-support analysis paths where they are not backed by explicit evidence signals.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence-Based Competitive SWOT Fallbacks

Status: implemented and verified.

Purpose: stop competitive SWOT fallback analysis from storing a generic heuristic insight with fixed confidence instead of showing which competitive evidence supported the recommendation.

Changes in this slice:
- Replace the generic `Analysis generated using heuristic methods` SWOT insight with evidence-specific insight rows for company capabilities, linked competitors, and opportunity metadata.
- Derive heuristic confidence from available signal counts and cap it below AI-backed confidence.
- Stop inventing an `Established track record` strength when company capability evidence is missing; the fallback now records that no capability strength evidence is present.
- Add regression coverage proving heuristic SWOT insights are evidence-specific, bounded, and persisted.
- Add competitive SWOT coverage to the Wave 8 strategic capability proof manifest.

Verification:
- `npm test -- competitive.test.ts` passed with 75 tests.
- `npm test -- competitive.test.ts platform-proof-scenarios.test.ts` passed with 81 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 131 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing generic confidence values in response-support analysis paths where they are not backed by explicit evidence signals.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Metadata-Backed Opportunity Summaries

Status: implemented and verified.

Purpose: stop opportunity summary generation from returning generic unavailable text when AI is unavailable or a provider call fails despite having useful opportunity metadata.

Changes in this slice:
- Generate deterministic opportunity summaries from title, buyer, category, budget, deadline, project summary, and key requirements.
- Load the scoped opportunity before provider availability checks so no-provider runs can still return actionable metadata-backed summaries.
- Use the same metadata-backed summary when prompt execution fails instead of returning "try again later" text.
- Add regression coverage proving unavailable AI returns metadata-backed content without calling the prompt.
- Add opportunity AI scope coverage to the Wave 5 AI/content governance proof manifest.

Verification:
- `npm test -- opportunity-ai-scope.test.ts platform-proof-scenarios.test.ts` passed with 10 tests.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 33 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing generic unavailable copy in user-facing response-support paths with either evidence-backed deterministic output or explicit failed action states.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Honest Win/Loss Insight Fallbacks

Status: implemented and verified.

Purpose: stop malformed AI win/loss insight output from returning a successful generic placeholder as if it were actionable strategy.

Changes in this slice:
- Extract deterministic win/loss heuristic insights for reuse when the AI provider is unavailable or returns malformed output.
- Parse AI insight output defensively and reject non-array or non-string payloads.
- Return heuristic insights when there is real debrief or pattern evidence, and return an explicit unavailable error when there is no evidence to synthesize.
- Add regression coverage proving malformed AI output falls back to measured win/loss evidence instead of the generic unavailable string.
- Add win/loss auth and fallback coverage to the Wave 8 strategic capability proof manifest.

Verification:
- `npm test -- winloss-auth.test.ts` passed with 12 tests.
- `npm test -- winloss-auth.test.ts platform-proof-scenarios.test.ts` passed with 18 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 56 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue auditing response-support analysis paths for success responses that contain placeholders instead of actionable evidence or explicit unavailable states.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence-Based Discovery Source Confidence

Status: implemented and verified.

Purpose: make non-primary document discovery strategies explain their confidence instead of assigning generic scores to SearXNG, alternative portal, archive, and AI-guessed URLs.

Changes in this slice:
- Replace fixed SearXNG document confidence with scoring from source type, document URL evidence, procurement terms, opportunity token matches, notice ID matches, and search engine score.
- Replace fixed alternative portal and archive confidence with evidence scoring capped below primary portal confidence.
- Keep AI-guessed URLs lower-confidence by source cap while still preserving the model's stated confidence as an auditable signal.
- Store confidence-signal descriptions for these discovered documents so operators can audit why a source was trusted.
- Add regression coverage for SearXNG document results and alternative portal results.

Verification:
- `npm test -- document-discovery-agent.test.ts` passed with 4 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 135 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing generic confidence values in downstream response-support analysis paths where they are not backed by explicit evidence signals.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Search Zero-Candidate Discovery Warnings

Status: implemented and verified.

Purpose: make SearXNG-backed discovery runs explicitly report when a query produces no accepted opportunity candidates instead of appearing as a clean zero-result import.

Changes in this slice:
- Add `search_no_candidates` discovery warnings for each query that returns no accepted opportunity-like results.
- Persist the zero-candidate warnings into the import audit config alongside engine degradation and scraper warnings.
- Preserve existing source scraping behavior so configured sources can still recover candidates after weak search results.
- Add regression coverage for a degraded SearXNG search with no accepted results.

Verification:
- `npm test -- discovery-opportunity-import.test.ts opportunity-discovery-route.test.ts` passed with 28 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 133 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue improving source discovery fallback and ranking when web search quality is low.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence-Based Portal Document Link Confidence

Status: implemented and verified.

Purpose: make source-document discovery explain why a portal link is trusted instead of assigning generic confidence to every extracted document URL.

Changes in this slice:
- Replace fixed primary-portal link confidence with scoring from direct document extension, same-host evidence, document type, procurement terms, opportunity token matches, and notice ID matches.
- Carry confidence signals into stored opportunity document descriptions for both Firecrawl link extraction and browser fallback recovery.
- Stop browser fallback from blindly forcing extracted links to a generic confidence; it now boosts the measured link score slightly and preserves the signal explanation.
- Add regression coverage proving stored discovered documents include confidence signals and remain auto-selected only through measured confidence.

Verification:
- `npm test -- document-discovery-agent.test.ts` passed with 2 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 133 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing fixed confidence values in discovery and response-support ranking paths where they are not backed by explicit evidence signals.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Explicit Document Analysis AI Fallbacks

Status: implemented and verified.

Purpose: prevent the older document-analysis workflow from silently assigning neutral scores when AI factor analysis is unavailable or malformed.

Changes in this slice:
- Replace silent `75` scores for unavailable AI analysis with deterministic structural/evidence fallback scoring.
- Add explicit informational issues and suggestions when a factor uses fallback scoring, so approval gates can distinguish measured heuristics from unavailable AI analysis.
- Treat malformed AI responses without a numeric score as fallback-scored instead of defaulting to neutral confidence.
- Replace random analysis issue IDs with monotonic timestamp IDs.
- Add regression coverage proving unavailable AI analysis records fallback findings and non-neutral scores.
- Add document-analysis fallback coverage to the Wave 5 AI/content governance proof manifest.

Verification:
- `npm test -- document-analysis-scope.test.ts document-analysis-auth.test.ts platform-proof-scenarios.test.ts` passed with 11 tests.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 29 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue auditing response-support analysis paths for any remaining generic confidence values.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Quality Assessment Scoring

Status: implemented and verified.

Purpose: prevent document quality assessment from reporting random or placeholder scores while response drafts and review artifacts are being hardened.

Changes in this slice:
- Replace placeholder fact-accuracy and source-credibility descriptions with measurable evidence-signal language.
- Fix the sentence-structure factor key so sentence variety no longer falls through to generic scoring.
- Replace random default factor scoring with deterministic, evidence-based heuristics for flow, key message clarity, citations, hierarchy, transitions, data presentation, tone, jargon, format, visual consistency, compliance, audience alignment, risk mitigation, timeline, budget, and team qualification signals.
- Keep unverified fact claims as explicit review warnings instead of fabricated neutral confidence.
- Add regression coverage proving repeated assessments produce identical scores and no placeholder quality claims appear in measured factor output.
- Add deterministic quality assessment coverage to the Wave 5 AI/content governance proof manifest.

Verification:
- `npm test -- quality-assessment.test.ts quality-assessment-auth.test.ts quality-assessment-scope.test.ts platform-proof-scenarios.test.ts` passed with 16 tests.
- `npm run platform:proof -- --run wave5-ai-content-governance` passed with 24 tests.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 11 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 133 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing any response-support quality paths that still depend on generic confidence or unavailable-state placeholders.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Live Response Readiness Revalidation

Status: passed.

Purpose: revalidate the live opportunity-to-response draft path after citation and final artifact hardening.

Result:
- Ran `npm run platform:proof -- --run live-opportunity-response-readiness --include-live-safe`.
- Proof run `live_response_readiness_20260527T082922Z` found 10 UNGM software opportunities and selected UN Secretariat notice `300700`.
- Downloaded the source PDF successfully (`171406` bytes), extracted `3070` characters with Docling, and generated six Datacraft response draft artifacts.
- Response readiness passed with source requirement coverage `1`, evidence cue coverage `1`, source citation coverage `1`, evidence citation coverage `1`, review gate coverage `1`, and `5527` total draft words.

Remaining after this revalidation:
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Final Artifact Storage Readback Receipts

Status: implemented and verified.

Purpose: prove rendered final artifacts can be read back from object storage before they are stored as submission-ready manifests.

Changes in this slice:
- Read final artifact objects back from Linode E3 immediately after upload.
- Verify readback hash and size against the rendered artifact bytes before workflow state is updated.
- Store readback hash, size, and timestamp receipts in final artifact manifests and proposal document summaries.
- Require readback receipts in final submission checklist artifact gates and submission attachment locking.
- Add regression coverage for corrupt storage readback rejection and missing readback receipt blockers.

Verification:
- `npm test -- final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts submission-workflow.test.ts proposal-documents-scope.test.ts` passed with 51 tests.
- `npm run platform:proof -- --run wave6-final-submission-gate` passed with 23 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 177 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 133 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Live Persisted Import-Response Proof Recheck

Status: blocked by database connectivity.

Purpose: recheck whether the previously blocked live persisted import-to-response proof can now complete after the latest response-readiness hardening.

Result:
- Ran `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Proof run `live_persisted_import_response_20260527T082025Z` failed before persistence with `connect ECONNREFUSED 88.80.188.224:5432`.
- The generated evidence ledger recorded zero persisted opportunity, source document, RFP document, requirement, proposal document, response document, and win-theme rows for this failed run.

Remaining after this recheck:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Keep the full aspiration execution goal active; this is an external connectivity blocker for the live persisted proof, not a completed platform proof.

### 2026-05-27 - Response Citation Coverage Through Final Gates

Status: implemented and verified.

Purpose: keep source and Datacraft evidence citation guarantees intact from generated response sections through final artifact and submission readiness gates.

Changes in this slice:
- Add `Source Citation Map` and `Datacraft Evidence Citation Map` sections to generated requirement-aware response drafts.
- Track source and evidence citation coverage across standard response package readiness metrics.
- Propagate citation coverage into opportunity document summaries and final artifact readiness snapshots.
- Add a final submission checklist gate that blocks submission when response citation coverage is incomplete.
- Extend regression coverage for draft readiness metrics, final artifact snapshots, final submission blockers, and win-theme review fixtures.

Verification:
- `npm test -- proposal-documents-scope.test.ts final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts` passed with 40 tests.
- `npm run platform:proof -- --run wave6-final-submission-gate` passed with 22 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 176 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed with 131 tests.
- `npm test -- ProposalDocumentsWinThemeSeedReview.test.ts` passed with 1 test.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 44 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue strengthening rendered artifact readback checks and live persisted import-response proof once database connectivity is stable.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Projected Workload Rebalancing Metrics

Status: implemented and verified.

Purpose: make proposal workload balancing report defensible projected utilization improvements instead of mutating current workload records and labeling the result simulated.

Changes in this slice:
- Track proposed reassignment impact in a separate projected utilization map.
- Stop proposed moves once the overloaded author is no longer over the target threshold.
- Avoid proposed moves that would push the receiving author above the elevated-workload threshold.
- Calculate after variance, max utilization, and overloaded-member count from projected reassignments.
- Extend the Wave 4 planning/collaboration proof manifest with workload balancing coverage.

Verification:
- `npm test -- task-management-auth.test.ts` from `frontend/` passed, running 12 tests.
- `npm test -- task-management-auth.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 18 tests.
- `npm run platform:proof -- --run wave4-planning-collaboration-tasks` from `frontend/` passed, running 30 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Capture-Stage PWin Ranking

Status: implemented and verified.

Purpose: make PWin opportunity rankings filter by real capture pipeline stage instead of using opportunity category as a stage proxy.

Changes in this slice:
- Add an assigned-opportunity existence predicate for PWin helper queries.
- Query `capture_pipeline.current_stage` when a ranking stage filter is provided.
- Scope pipeline-stage filtering to the actor's organization and assigned opportunities.
- Filter ranked opportunities by matching pipeline opportunity IDs and return the real capture stage in ranking results.
- Extend the Wave 8 strategic capability proof manifest with PWin opportunity scope coverage.

Verification:
- `npm test -- pwin-opportunity-scope.test.ts` from `frontend/` passed, running 7 tests.
- `npm test -- pwin-opportunity-scope.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 13 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 42 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Outcome-Backed Review Effectiveness

Status: implemented and verified.

Purpose: make review effectiveness analytics correlate review recommendations with actual submitted outcomes instead of hard-coded win-rate assumptions.

Changes in this slice:
- Query submission outcomes for completed review opportunities within the reporting timeframe.
- Scope outcome correlation to the actor's organization and assigned opportunities.
- Bucket actual won/lost outcomes by review recommendation and calculate observed win rates.
- Preserve zero-sample buckets for standard recommendation categories so the analytics shape remains stable.
- Extend the Wave 6 approval/production proof manifest with review effectiveness coverage.

Verification:
- `npm test -- reviews.test.ts` from `frontend/` passed, running 111 tests.
- `npm test -- reviews.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 117 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 163 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Outcome-Backed Past Performance Analytics

Status: implemented and verified.

Purpose: make past-performance analytics report actual win correlation from submitted proposal outcomes instead of estimating win rate from high CPAR ratings.

Changes in this slice:
- Join submissions to project relevance records and visible past-performance projects to identify submitted opportunities that cited past performance.
- Scope the outcome query to the actor's assigned opportunities, organization submissions, and visible projects.
- De-duplicate submissions before calculating wins and losses so multiple cited projects do not inflate the sample.
- Return actual past-performance submission count, wins, losses, and rounded win rate.
- Extend the Wave 8 strategic capability proof manifest with past-performance analytics coverage.

Verification:
- `npm test -- past-performance-scope.test.ts` from `frontend/` passed, running 7 tests.
- `npm test -- past-performance-scope.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 13 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 35 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Content-Aware Formatting Compliance

Status: implemented and verified.

Purpose: make final formatting validation inspect document content for explicit font and spacing violations instead of trusting template metadata alone.

Changes in this slice:
- Extract text style runs from Tiptap-style document content, including text-style marks and node attributes.
- Flag body text that uses a font outside the required body font and text below the minimum font size.
- Extract paragraph/heading/list/table spacing attributes and flag line-spacing deviations from the applied template.
- Persist non-compliant fonts and spacing violation sections in the validation payload.
- Extend the Wave 6 approval/production proof manifest with formatting compliance coverage.

Verification:
- `npm test -- formatting-scope.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 11 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 52 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Deterministic Practice Recording Analysis

Status: implemented and verified.

Purpose: make oral presentation practice analysis produce repeatable timing and filler-word evidence instead of random simulated scores.

Changes in this slice:
- Replace random practice recording analysis with deterministic scoring from recording duration, planned slide timing, and transcript-like feedback text.
- Allocate actual slide durations by estimated slide duration share and compute coverage scores from target variance.
- Count filler words from available feedback text and explicitly recommend transcript-backed notes when filler evidence is unavailable.
- Add regression coverage for deterministic pacing, slide coverage, filler counts, and persisted analysis payloads.
- Extend the Wave 9 presentation proof manifest with presentation auth/practice analysis coverage.

Verification:
- `npm test -- presentations-auth.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 11 tests.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` from `frontend/` passed, running 9 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Evaluation Criteria Mapping Suggestions

Status: implemented and verified.

Purpose: make criteria mapping suggestions connect active win themes to accepted evaluator criteria instead of echoing only mappings that already exist.

Changes in this slice:
- Replace the criteria suggestion placeholder with deterministic scoring against accepted evaluation requirements.
- Preserve direct criteria-theme mappings as score-100 results.
- Suggest additional active themes by matching evaluator criteria, response strategy, theme statement, evidence, and keywords.
- Return criterion names, weights, coverage scores, adequacy flags, relevance scores, and mapping notes for operator review.
- Add regression coverage for direct and suggested criteria mappings.

Verification:
- `npm test -- win-themes-auth.test.ts` from `frontend/` passed, running 9 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 28 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Deterministic Win Theme Suggestions

Status: implemented and verified.

Purpose: make win-theme suggestions produce evaluator-aware candidate themes from accepted RFP requirements instead of returning an empty placeholder.

Changes in this slice:
- Reuse the accepted-requirement win-theme seed pipeline for pending theme suggestions.
- Convert reviewable response seeds into `ThemeSuggestion` records with confidence scores, rationale, evidence sources, and suggested keywords.
- Filter suggestions against existing theme statements and already-covered evaluation criteria before returning them.
- Add regression coverage for populated pending suggestions and suppression of already-covered criteria.
- Extend the Wave 8 strategic capability proof manifest with win-theme authorization and suggestion coverage.

Verification:
- `npm test -- win-themes-auth.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 14 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 27 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - CRM Account Live Research

Status: implemented and verified.

Purpose: make account research gather live web intelligence server-side instead of returning empty client-populated placeholders.

Changes in this slice:
- Wire CRM account research to the existing SearXNG client for server-side company, contact, leadership, client, social, news, and general searches.
- Return normalized research items with source domains, snippets, URLs, engine metadata, relevance scores, and query timestamps.
- Keep successful category results when another category search fails, while surfacing the degradation in the research summary.
- Derive suggested account updates for website, LinkedIn URL, email, phone, leadership, description, and notable clients from returned sources without mutating the account.
- Add regression coverage proving SearXNG-backed research replaces empty placeholders and tolerates category-level search failures.
- Extend the Wave 8 strategic capability proof manifest with CRM account research coverage.

Verification:
- `npm test -- crm-account-research-search.test.ts crm-account-research-auth.test.ts` from `frontend/` passed, running 3 tests.
- `npm test -- platform-proof-scenarios.test.ts crm-account-research-search.test.ts crm-account-research-auth.test.ts` from `frontend/` passed, running 9 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 19 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Compliance Cross-Reference Suggestions

Status: implemented and verified.

Purpose: make compliance reviewers receive concrete response-section suggestions for unlinked requirements instead of an empty placeholder list.

Changes in this slice:
- Replace empty cross-reference suggestions with deterministic matching against proposal documents for the requirement's opportunity.
- Split Tiptap response documents into heading-based sections and fall back to stored plain text when structured content is absent.
- Rank suggested sections by requirement-term overlap across requirement number, category, section title, document type, and section body.
- Scope proposal-document reads to the user's organization while preserving legacy null-organization proposal documents.
- Add regression coverage for ranked section suggestions, organization/opportunity scoping, and no-match behavior.
- Extend the Wave 3 compliance/evidence proof manifest with the cross-reference suggestion regression.

Verification:
- `npm test -- compliance-cross-reference-suggestions.test.ts compliance-entry-workflow.test.ts` from `frontend/` passed, running 11 tests.
- `npm test -- compliance-cross-reference-suggestions.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 8 tests.
- `npm test -- platform-proof-scenarios.test.ts compliance-cross-reference-suggestions.test.ts compliance-entry-workflow.test.ts` from `frontend/` passed, running 17 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` from `frontend/` passed, running 79 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Document PDF Render Artifacts

Status: implemented and verified.

Purpose: make document PDF rendering produce actual PDF artifacts for final response packages instead of reporting success while returning LaTeX source.

Changes in this slice:
- Replace the `renderToPDF` LaTeX placeholder path with an actual PDF buffer generated through the existing `jspdf` dependency.
- Preserve document structure for PDF output, including headings, paragraphs, lists, block quotes, code blocks, table rows, rules, brand colors, metadata, headers, footers, and page numbers.
- Preserve PDF export options for table of contents and watermark output.
- Preserve inline text marks and image references so final artifacts do not silently flatten or drop response content.
- Return `application/pdf`, `.pdf` filenames, byte size, and page count for PDF render results.
- Add regression coverage proving direct and unified PDF rendering return a real `%PDF-` artifact and never LaTeX source.
- Add regression coverage for multi-page pagination, table of contents, watermarks, marked text, and image references.
- Extend Wave 6 production/finalization proof and Wave 9 discovery-to-submission proof manifests with the real PDF render regression.

Verification:
- `npm test -- document-render-pdf.test.ts document-render-auth.test.ts document-render-scope.test.ts final-artifact-workflow.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 24 tests.
- `npm test -- platform-proof-scenarios.test.ts` from `frontend/` passed, running 6 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 47 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 130 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Presentation Export Artifacts

Status: implemented and verified.

Purpose: make oral presentation exports produce real downloadable artifacts for response delivery instead of returning inert placeholder export routes.

Changes in this slice:
- Replace the presentation export placeholder URL with generated data-download artifacts.
- Generate self-contained HTML decks with slide content, speaker notes, team members, branding colors, and print styling.
- Generate PDF deck exports from the same slide content using the existing PDF dependency.
- Generate editable PPTX deck exports using the existing PowerPoint dependency and include speaker notes.
- Return artifact filename and MIME type metadata to the exporter UI.
- Add focused regression coverage for HTML, PDF, and PPTX data artifacts and decoded HTML content.
- Add a dedicated Wave 9 platform proof scenario for presentation export artifacts.

Verification:
- `npm test -- presentations-export.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 10 tests.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` from `frontend/` passed, running the new presentation export proof.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - DGMarket Dedicated Live Proof

Status: implemented and verified.

Purpose: make DGMarket live-source verification repeatable through the platform proof manifest instead of relying on ad hoc shell environment variables.

Changes in this slice:
- Add scenario-specific environment support to the platform proof runner and dry-run command formatting.
- Add a dedicated `live-dgmarket-source` live-safe proof scenario that targets `https://www.dgmarket.com`.
- Allow the generic live configured-source proof script to use a scenario-provided run ID prefix.
- Add proof-manifest coverage for the DGMarket scenario and environment-aware command formatting.

Verification:
- `npm test -- platform-proof-scenarios.test.ts` from `frontend/` passed, running 6 tests.
- `npm run platform:proof -- --include-live-safe --run live-dgmarket-source` from `frontend/` passed; the scenario produced run `live_dgmarket_source_20260527T044441Z` with 16 normalized DGMarket opportunities.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - DGMarket Default Discovery Coverage

Status: implemented and verified.

Purpose: expand configured opportunity discovery with DGMarket coverage while keeping parser output normalized enough for response-package intake.

Changes in this slice:
- Add DGMarket to the default configured discovery source list.
- Harden the DGMarket parser for rendered listing HTML from the connectivity-host scrape path.
- Preserve detail links from DGMarket markdown table rows as both `portalUrl` and `documentUrl`.
- Filter DGMarket category/navigation links so they do not become false opportunity records.
- Route the live configured-source proof harness to the DGMarket parser and preserve Firecrawl HTML separately from markdown.
- Add live proof guards for empty titles and country fields polluted with rendered markup or URLs.
- Extend the Wave 9 discovery bridge proof to include DGMarket parser and default-source coverage.

Verification:
- `npm test -- dgmarket-parser.test.ts default-discovery-sources.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 10 focused tests.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 60 Wave 9 discovery bridge tests.
- `LIVE_SOURCE_DISCOVERY_URL=https://www.dgmarket.com npm run platform:proof -- --include-live-safe --run live-source-discovery` from `frontend/` passed; Firecrawl returned 16 normalized DGMarket opportunities with stable titles, notice IDs, countries, and portal URLs.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Documents Page Win Theme Review Surface

Status: implemented and verified.

Purpose: make generated response win-theme seed approval visible on the response package documents surface, not only on the requirements page.

Changes in this slice:
- Move the generated win-theme review panel into a shared `ResponseWinThemeReviewPanel` component.
- Reuse the shared panel on the requirements workflow without changing existing behavior.
- Load response win-theme seed review data on the opportunity documents page alongside proposal documents and response readiness.
- Refresh documents, progress, response readiness, and seed-review state together after generated seeds are persisted.
- Add component coverage proving the response package documents surface renders pending seed review evidence, evaluator criteria, target document types, requirement mappings, and proposal documents together.
- Extend the Wave 8 strategic capability proof manifest to cover both requirements-page and documents-page seed review surfaces.

Verification:
- `npm test -- RequirementsWinThemeSeedReview.test.ts ProposalDocumentsWinThemeSeedReview.test.ts` from `frontend/` passed, running 2 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, now running 17 strategic capability tests including both generated seed review surfaces.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Final Package Authority Denial Visibility

Status: implemented and verified.

Purpose: make final package approval authority failures visible in the operator UI instead of only logging them to the browser console.

Changes in this slice:
- Add document-scoped inline error state to the proposal final package panel.
- Show blocked finalization messages for authority, readiness, stale-artifact, and other expected final package blockers.
- Avoid console-error noise for expected operator blockers while preserving console logging for unexpected failures.
- Add a Playwright browser harness proving a blocked final artifact approval surfaces the authority denial inline and does not mark the document updated.
- Add the browser proof as a dedicated Wave 6 finalization authority scenario.

Verification:
- `npm run test:e2e -- proposal-finalization-authority.spec.ts` from `frontend/` passed, running 1 Playwright test.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-finalization-authority-browser` from `frontend/` passed, running the new Playwright proof through the platform manifest.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Browser Proof For Win Theme Seed Review

Status: implemented and verified.

Purpose: prove generated win-theme seed review works in a real browser interaction, including operator approve/reject decisions and reviewed persistence payloads.

Changes in this slice:
- Add a Playwright browser harness for the response win-theme seed review panel.
- Stub only the server action boundary while exercising the real client component, buttons, reviewer notes, counts, success message, and `onCreated` callback.
- Verify persisted payloads include `reviewRequired: true`, approved reviewer notes, and rejected seed decisions.
- Add the browser proof as a dedicated Wave 8 strategic capability scenario.

Verification:
- `npm run test:e2e -- requirements-win-theme-seed-review.spec.ts` from `frontend/` passed, running 1 Playwright test.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-browser` from `frontend/` passed, running the new Playwright proof through the platform manifest.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Requirements Page Win Theme Review Proof

Status: implemented and verified.

Purpose: keep the operator requirements workflow covered by an automated proof that generated win-theme seeds are visible before final response approval.

Changes in this slice:
- Add a requirements-page operator-surface test that renders the generated response win-theme seed review panel.
- Verify the panel exposes generated seed statements, evaluator criteria IDs, target document types, requirement mappings, approval counts, and disabled persistence before operator decisions.
- Add the new operator-surface proof to the Wave 8 strategic capability manifest so future platform proof runs include it.

Verification:
- `npm test -- RequirementsWinThemeSeedReview.test.ts` from `frontend/` passed, running 1 test.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, now running 16 strategic capability tests including requirements-page seed review coverage.

Remaining after this slice:
- Browser-level seed review interaction is now covered by the Wave 8 strategic capability browser proof.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Requirement Page Win Theme Seed Review

Status: implemented and verified.

Purpose: make generated response win-theme seed approval part of the operator requirements workflow, so accepted requirements can become reviewed strategy themes before final response approval.

Changes in this slice:
- Add `getResponseWinThemeSeedReview`, a server action that derives reviewable win-theme seeds from accepted opportunity requirements.
- Treat weighted or evaluation/scoring-sourced accepted requirements as evaluator criteria for generated seed coverage.
- Filter out seeds whose statements or evaluator criteria are already covered by existing opportunity win themes.
- Load initial seed-review data on the opportunity requirements page.
- Refresh seed-review data with requirements/compliance state and after response-package drafting.
- Keep operators on the requirements page to approve generated win-theme seeds when response-package drafting produces pending strategy seeds.
- Reuse the `ResponseWinThemeSeedReview` component directly in the requirements workflow.
- Add regression coverage proving accepted requirements create reviewable seed data with evaluator criteria and target document mappings.

Verification:
- `npm test -- win-themes-auth.test.ts` from `frontend/` passed, running 6 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 15 strategic capability tests across competitive win themes, resource reuse, and search/RAG health.

Remaining after this slice:
- Add a browser-level operator proof for the requirements-page seed review panel once an authenticated seeded opportunity is available.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Evaluator Criteria Evidence Traceability

Status: implemented and verified.

Purpose: carry evaluator criteria IDs through response readiness, final checklist evidence, and review-comment task projection so comments and submission blockers can point at the same scoring criteria.

Changes in this slice:
- Add evaluator criteria ID sets to live response readiness assessments, including draft-covered, win-theme-covered, and missing criteria IDs.
- Parse those readiness criteria IDs into the final submission checklist workflow.
- Show evaluator, covered, and missing criteria IDs in the evaluator win-theme coverage checklist details when the readiness workflow reports them.
- Carry review-comment evaluator criteria IDs, references, related win-theme IDs, and theme alignment into workflow transition metadata.
- Project review-comment resolution tasks with `evaluationCriteriaIds` and stable criteria/win-theme tags.
- Add regression coverage for live readiness criteria ID evidence, final checklist criteria detail rows, and review-comment task metadata.

Verification:
- `npm test -- live-response-package.test.ts final-submission-checklist-workflow.test.ts review-comment-workflow.test.ts` from `frontend/` passed, running 24 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate --run wave9-response-readiness-package` from `frontend/` passed, running 30 tests across final submission and response-readiness proof targets.

Remaining after this slice:
- Wire the seed review component into the response package review screen when that screen is selected as the primary operator surface.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Win Theme Seed Review Approval

Status: implemented and verified.

Purpose: require human review decisions before generated response-package win-theme seeds are bulk-persisted, while preserving the existing legacy import path for trusted callers.

Changes in this slice:
- Add reviewed seed fields for approve/reject decisions and reviewer notes.
- Gate `createThemesFromResponseSeeds` with `reviewRequired`, so only approved seeds become durable win themes and rejected/pending seeds are counted separately.
- Preserve backward-compatible bulk persistence for callers that do not require review.
- Add a reusable `ResponseWinThemeSeedReview` UI component that shows evaluator criteria, requirements, evidence, reviewer notes, and persists only approved seeds.
- Export the review component and reviewed seed types through the win-theme component barrel.
- Add regression coverage proving rejected and pending-review seeds are not inserted.

Verification:
- `npm test -- win-themes-auth.test.ts` from `frontend/` passed, running 5 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 15 strategic capability tests across competitive win themes, resource reuse, and search/RAG health.

Remaining after this slice:
- Wire the seed review component into the response package review screen when that screen is selected as the primary operator surface.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Command Center Shows Win Theme Readiness

Status: implemented and verified.

Purpose: surface evaluator win-theme coverage before operators reach the submission form, so command-center readiness cards expose the response strategy gap early.

Changes in this slice:
- Include evaluator win-theme criteria coverage and seed count in proposal response package workflow descriptions.
- Carry readiness dimension detail lines into command-center readiness cards.
- Prevent detail text from making a response-readiness workflow match unrelated readiness dimensions.
- Add command-center and projection coverage for blocked response-readiness win-theme gaps.

Verification:
- `npm test -- projections.test.ts work-items-command-center.test.ts` from `frontend/` passed, running 6 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Final Checklist Shows Win Theme Coverage

Status: implemented and verified.

Purpose: make the final submission blocker for evaluator-to-win-theme coverage visible and actionable in the submission UI instead of only appearing as a flat checklist message.

Changes in this slice:
- Add structured checklist detail rows for evaluator criteria win-theme coverage, seed count, and response-readiness workflow ID.
- Preserve those details when converting the enforced final submission gate into pre-submission checklist items.
- Render a dedicated evaluator win-theme coverage panel in the submission form with covered, blocking, or advisory state.
- Keep non-win-theme checklist details renderable as compact evidence badges.

Verification:
- `npm test -- final-submission-checklist-workflow.test.ts submissions-scope.test.ts` from `frontend/` passed, running 22 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate` from `frontend/` passed, running 21 tests across final checklist and submission workflows.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - UN Procurement Live Source Recovery

Status: implemented and verified.

Purpose: add a parser and live proof for the UN Procurement solicitations page that Firecrawl can fetch but cannot currently normalize into opportunities without browser-rendered HTML.

Changes in this slice:
- Add a UN Procurement parser for browser-rendered Drupal solicitation cards.
- Route `www.un.org/procurement/...` configured sources to the UN Procurement parser.
- Extend the live configured-source proof to use browser fallback when Firecrawl fails or returns content that the source parser cannot extract.
- Add the live-proven UN Procurement URL to the default discovery source list.
- Add focused parser and import coverage for UN Procurement browser-rendered source imports.

Verification:
- `npm test -- default-discovery-sources.test.ts un-procurement-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 30 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 55 tests across discovery import, opportunity documents, RFP document service, and proposal document scope.
- `LIVE_SOURCE_DISCOVERY_URL=https://www.un.org/procurement/solicitations-opportunities npm run platform:proof -- --include-live-safe --run live-source-discovery` from `frontend/` passed. It used browser fallback through `http://84.247.181.100:3003`, parsed 22 UN Procurement opportunities, and wrote live evidence run `live_source_discovery_20260527T030921Z`.

Remaining after this slice:
- If UN Procurement publishes detail links per solicitation in a future page variant, enrich `portalUrl`/`rfpLink` to point at those detail pages instead of the listing page.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Configured Source Browser Fallback

Status: implemented and verified.

Purpose: recover configured procurement source imports when Firecrawl cannot fetch the listing page directly, using the platform browser service before declaring the source unavailable.

Changes in this slice:
- Route configured source scrape failures and empty parser passes through the existing Playwright/browser fallback when fallback is enabled.
- Preserve the fallback reason on imported opportunity metadata and audit warnings.
- Record source-candidate scrape method as `browser_fallback` when rendered content produced the opportunity.
- Keep the existing `browserFallback: false` behavior available for callers that want Firecrawl-only source scraping.
- Add regression coverage for a configured source where Firecrawl returns a DNS failure but browser fallback returns a tender listing.

Verification:
- `npm test -- discovery-opportunity-import.test.ts` from `frontend/` passed, running 21 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 54 tests across discovery import, opportunity documents, RFP document service, and proposal document scope.

Remaining after this slice:
- Keep adding source-specific parsers when browser-rendered configured sources expose structured listings that generic markdown parsing cannot read reliably.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Live Discovery Health Refresh

Status: verified.

Purpose: confirm the currently configured live discovery stack still works after the response-generation and governance changes, and keep evidence current for the opportunity-finding side of the platform.

Verification:
- `npm run platform:proof -- --include-live-safe --run live-comesa-source` from `frontend/` passed. It scraped `https://www.comesa.int/category/open-tenders/`, returned 2 normalized COMESA opportunities, and proved tender package document `https://www.comesa.int/wp-content/uploads/2026/05/RFP-Medical-Scheme-2026-Final.docx`.
- `npm run platform:proof -- --include-live-safe --run live-ungm-source` from `frontend/` passed. It called UNGM public notices, saw 1,657 total notices, mapped 10 opportunities, detail-enriched 5 sampled notices, and fetched a UNGM portal page with HTTP 200.
- `npm run platform:proof -- --include-live-safe --run live-discovery-services` from `frontend/` passed. It verified SearXNG health/results, Firecrawl scrape output, and Playwright/browser fallback content from the connectivity host.

Remaining after this slice:
- Investigate blocked or DNS-restricted sources such as `www.un.org/procurement/solicitations-opportunities`; direct fetch returned CloudFront 403 and Firecrawl reported DNS safety verification failure for `www.un.org`.
- Rerun the live persisted import-response proof when PostgreSQL is reachable.

### 2026-05-27 - Final Checklist Enforces Evaluator Win Themes

Status: implemented and verified.

Purpose: prevent final submission from passing when response readiness reports that evaluator criteria are not mapped to win-theme strategy coverage.

Changes in this slice:
- Extend final submission checklist readiness parsing with optional `winThemeCriteriaCoverage` and `winThemeSeedCount` metrics.
- Add an evaluator criteria win-theme coverage checklist item.
- Treat missing evaluator/win-theme coverage metrics as advisory for older response-readiness receipts.
- Block final submission when a current response-readiness receipt reports partial evaluator-to-win-theme coverage.
- Add focused regression coverage for a 50% evaluator criteria win-theme mapping gap.

Verification:
- `npm test -- final-submission-checklist-workflow.test.ts` from `frontend/` passed, running 12 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate` from `frontend/` passed, running 21 tests across final checklist and submission workflows.

Remaining after this slice:
- Add the same evaluator/win-theme coverage summary to opportunity command-center readiness cards so capture managers see the gap before opening the submission form.
- Rerun persisted live database proof when PostgreSQL is reachable.

### 2026-05-27 - Persisted Proof Covers Win Themes

Status: implemented and code-verified; live PostgreSQL proof blocked by database connectivity.

Purpose: extend the live persisted import-to-response proof so it verifies not only opportunity, source document, RFP, requirements, and response draft persistence, but also generated win-theme strategy rows.

Changes in this slice:
- Persist live response package win-theme seeds as `win_themes` rows during the live persisted import-response proof.
- Verify persisted win-theme rows and their evaluator criteria IDs alongside tenant-scoped opportunity, source document, RFP, requirement, proposal document, and response document rows.
- Include win-theme rows in cleanup verification so live proof runs leave no strategy rows behind.
- Add win-theme row and criteria counts to proof evidence artifact IDs.
- Update the live persisted proof scenario contract to include strategic capability target `S-001`.

Verification:
- `npm test -- platform-proof-scenarios.test.ts live-response-package.test.ts win-themes-auth.test.ts` from `frontend/` passed, running 18 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- Attempted `npm run platform:proof -- --include-live-safe --run live-persisted-import-response` from `frontend/`, but the PostgreSQL endpoint refused the connection: `connect ECONNREFUSED 88.80.188.224:5432`. No passing live evidence was recorded for this slice.

Remaining after this slice:
- Rerun the live persisted import-response proof when PostgreSQL is reachable so win-theme row persistence is proven against the live database.
- Add UI review/approval for generated win-theme seeds before bulk persistence.

### 2026-05-27 - Persist Response Win Theme Seeds

Status: implemented and verified.

Purpose: turn generated live response win-theme seeds into durable opportunity win-theme records, closing the path from source document criteria to reusable strategy objects.

Changes in this slice:
- Add response win-theme seed input/result types to the win-theme API surface.
- Add a server action that validates live response package seed records, verifies opportunity assignment scope, skips duplicate theme statements or already-covered evaluator criteria, and inserts new win-theme rows.
- Persist seed evaluator criteria IDs, target response document types, supporting evidence, keywords, and rationale into win-theme fields.
- Add regression coverage proving generated seed data is inserted with criteria mappings and target sections intact.

Verification:
- `npm test -- win-themes-auth.test.ts live-response-package.test.ts` from `frontend/` passed, running 13 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 15 strategic capability tests across competitive win themes, resource reuse, and search/RAG health.

Remaining after this slice:
- Add UI review/approval for generated win-theme seeds before bulk persistence.
- Connect review comments and final checklist evidence to the same evaluator criteria IDs.

### 2026-05-27 - Live Response Win Theme Seeds

Status: implemented and verified.

Purpose: generate initial win-theme strategy seeds directly from live response packages, so source requirements and evaluator criteria immediately become reusable proposal strategy inputs.

Changes in this slice:
- Add `LiveResponseWinThemeSeed` records to live response packages.
- Generate criteria-driven win-theme seeds from evaluator/scoring signals, preserving evaluator criteria IDs, related requirement IDs, target response document types, supporting evidence, keywords, and rationale.
- Generate requirement-driven fallback win-theme seeds when a live source document has no explicit scoring criteria.
- Add readiness metrics and blockers for evaluator criteria that are not represented in win-theme seeds.
- Record win-theme seed count and win-theme criteria coverage in live response readiness proof evidence.
- Add focused coverage for win-theme seed generation and readiness blocking when seed coverage is removed.

Verification:
- `npm test -- live-response-package.test.ts` from `frontend/` passed, running 9 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-opportunity-response-readiness` from `frontend/` passed. It downloaded and parsed live UNGM source PDF `eoi24414.pdf`, generated all six response drafts, produced 3,897 total draft words, generated 2 requirement-derived win-theme seeds for the no-explicit-criteria source, and returned `ready_for_review`.

Remaining after this slice:
- Add a server-side action that persists response-package win-theme seeds into approved or draft win-theme rows for an opportunity.
- Surface generated win-theme seeds in the response package review UI before final rendering.

### 2026-05-27 - Win Theme Criteria Persistence

Status: implemented and verified.

Purpose: let evaluator criteria extracted from live response packages become durable win-theme mappings instead of staying only in generated response-package metadata.

Changes in this slice:
- Add evaluation criteria IDs to the public win-theme API type.
- Allow win-theme create and update inputs to carry `evaluationCriteriaIds`.
- Persist evaluation criteria IDs when creating or updating win themes.
- Return evaluation criteria IDs from database win-theme rows through the action mapper.
- Add regression coverage proving criteria mappings are preserved through theme update patches and response data.

Verification:
- `npm test -- win-themes-auth.test.ts live-response-package.test.ts` from `frontend/` passed, running 10 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` from `frontend/` passed, running 15 strategic capability tests across competitive win themes, resource reuse, and search/RAG health.

Remaining after this slice:
- Add a direct import/generation path that converts live response package evaluator criteria into initial win-theme records for an opportunity.
- Connect review comments and final checklist evidence to the same evaluator criteria IDs.

### 2026-05-27 - Evaluator Criteria Response Alignment

Status: implemented and verified.

Purpose: move generated live response packages from requirement coverage alone toward score-aware response drafting by extracting explicit evaluator/scoring criteria and requiring drafts to map those criteria into win-response plans.

Changes in this slice:
- Add evaluator criteria signals alongside source requirement signals in live response packages.
- Extract scoring/evaluation lines from solicitation sections such as evaluation criteria, including point/percent/mark weights when present.
- Add evaluator criteria IDs to every generated draft document and include an `Evaluator Alignment Plan` section with score-aware response strategy bullets.
- Add readiness metrics and blockers for missing evaluator criteria coverage, while allowing source documents with no published criteria to remain ready with an explicit warning.
- Add focused regression coverage for evaluator extraction, draft inclusion, readiness metrics, and blocked readiness when criteria mappings are removed.

Verification:
- `npm test -- live-response-package.test.ts` from `frontend/` passed, running 7 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-opportunity-response-readiness` from `frontend/` passed. It downloaded and parsed live UNGM source PDF `eoi24414.pdf`, generated all six response drafts, produced 3,897 total draft words, covered 8 source requirement signals, matched 85 Datacraft evidence snippets, and returned `ready_for_review` with a warning that no explicit evaluator scoring criteria were present in that source.

Remaining after this slice:
- Connect extracted evaluator criteria to persisted win-theme and review workflows so downstream scoring, comments, and final submission checks can reference the same IDs.
- Continue improving response-generation quality from aligned plans toward final artifact rendering and reviewer-approved submission packages.

### 2026-05-27 - AFDB Detail Document Enrichment

Status: implemented and verified.

Purpose: make AFDB configured-source opportunities response-ready by resolving AFDB document detail pages to the actual downloadable procurement PDFs instead of seeding only AFDB HTML notice pages.

Changes in this slice:
- Add AFDB detail-page parsing that ranks downloadable procurement documents and ignores social/navigation links.
- Enrich bounded AFDB configured-source imports with primary detail-page document URLs, updating `documentUrl`, `rfpLink`, source-document seeding, and AFDB metadata.
- Replace the generic AFDB live proof wrapper with a source-specific proof that verifies listing extraction plus a live detail-page document.
- Update AFDB parser/import/proof coverage.

Verification:
- `npm test -- afdb-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 27 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-afdb-source` from `frontend/` passed. It scraped `https://www.afdb.org/en/projects-and-operations/procurement`, returned 13 normalized AFDB opportunities, and proved a downloadable detail-page PDF at `https://www.afdb.org/sites/default/files/documents/project-related-procurement/spn_bridep.pdf`.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 53 tests.

Remaining after this slice:
- Continue adding detail/document enrichment for source pages that expose stable procurement package attachments.
- Continue proving document download and parsing for live source documents that are now seeded from configured sources.

### 2026-05-27 - Configured Source Retry Resilience

Status: implemented and verified.

Purpose: prevent transient Firecrawl/source-parser misses from making high-value configured sources appear empty after one bad scrape, which would skip opportunity and source-document intake for that run.

Changes in this slice:
- Add a bounded retry loop around configured-source Firecrawl scrape plus parser extraction.
- Retry both failed source scrapes and successful scrapes that parse to zero opportunities before emitting a source warning.
- Add the same retry behavior to the live UNICEF source proof script, which exposed the transient empty-source behavior during live verification.
- Add regression coverage proving a source import recovers when the first UNICEF scrape parses empty and the second scrape returns opportunities.

Verification:
- `npm test -- discovery-opportunity-import.test.ts` from `frontend/` passed, running 20 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 53 tests.
- `npm run platform:proof -- --include-live-safe --run live-unicef-source` from `frontend/` passed after the proof retry update, returning 9 UNICEF service-contract opportunities and the UNICEF medicines tender calendar PDF link.

Remaining after this slice:
- Continue adding durable live proofs for scheduled discovery runs under service credentials.
- Continue tightening source-specific document extraction for sources that expose detail pages or calendar PDFs.

### 2026-05-27 - Discovery Runtime Defaults Preserve Source Documents

Status: implemented and verified.

Purpose: keep scheduled/API-key discovery and legacy saved presets aligned with the operator default path that seeds and downloads source documents, so discovery does not stop at opportunity metadata when RFP or tender documents are available.

Changes in this slice:
- Centralize default live discovery source URLs, source scrape limit, enrichment, browser fallback, seeded-document download, and download limit.
- Apply those runtime defaults to direct discovery API runs after request validation.
- Apply those runtime defaults to scheduled discovery preset runs and dry-run output, while preserving explicit preset overrides such as empty source URL lists or disabled downloads.
- Update the discovery dialog preset application path so older presets that lack source/document fields inherit the current source-document defaults instead of silently disabling downloads.
- Add focused coverage for legacy preset/runtime default behavior.

Verification:
- `npm test -- default-discovery-sources.test.ts opportunity-discovery-route.test.ts opportunity-discovery-presets-route.test.ts discovery-opportunity-import.test.ts discovery-presets.test.ts` from `frontend/` passed, running 35 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 17 discovery-to-response/submission test files and 174 tests.

Remaining after this slice:
- Continue proving scheduled live discovery runs against production-like service credentials and persisted tenant records.
- Continue closing source document parsing gaps for newly added live sources.

### 2026-05-27 - UNICEF Tender Calendar Source Discovery

Status: implemented and verified.

Purpose: add UNICEF Supply Division as a live configured source so the platform captures early UN procurement demand signals, including ICT service contract calendar rows, without pretending month/quarter issuance windows are exact deadlines.

Changes in this slice:
- Add a UNICEF Supply Division parser for service-contract tender calendar tables and tender-calendar document cards.
- Preserve UNICEF source identity, platform name, UN procurement tags, service duration, issuance window, and contact channel through configured-source imports.
- Preserve parser-emitted source tags through configured-source imports so useful qualifiers such as `ict` and `service-contract` survive persistence.
- Add UNICEF's service contracts tender calendar and downloadable tender-calendar document page to the default live discovery source list.
- Add a `live-unicef-source` platform proof that verifies live Firecrawl scrape extraction, ICT row detection, metadata preservation, and no fabricated deadlines.
- Extend the UNICEF live proof to verify a downloadable UNICEF tender calendar PDF link.
- Add focused parser, configured-source import, proof-manifest, and default-source regression coverage.

Verification:
- `npm test -- unicef-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts default-discovery-sources.test.ts` from `frontend/` passed, running 26 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-unicef-source` from `frontend/` passed. It scraped `https://www.unicef.org/supply/service-contracts-tender-calendar`, returned 9 normalized UNICEF opportunities, and proved the ICT telephony/software row with Q3 issuance metadata and UNICEF contact email.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 51 tests.
- Follow-up tag preservation check: `npm test -- discovery-opportunity-import.test.ts` from `frontend/` passed, running 18 tests.
- Follow-up tag preservation check: `npx tsc --noEmit --pretty false` from `frontend/` passed.
- Default tender-calendar document check: `npm test -- unicef-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts default-discovery-sources.test.ts` from `frontend/` passed, running 27 tests.
- Default tender-calendar document check: `npx tsc --noEmit --pretty false` from `frontend/` passed.
- Default tender-calendar document check: `npm run platform:proof -- --include-live-safe --run live-unicef-source` from `frontend/` passed. It proved the UNICEF service-contract rows plus `https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf` from the tender calendars page.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise and useful source documents.
- Review whether UNICEF calendar PDF sources should be imported as secondary default sources once their rows map cleanly to actionable tender follow-up workflows.

### 2026-05-27 - UNDP Detail Document Enrichment

Status: implemented and verified.

Purpose: move UNDP configured-source imports beyond portal-only links by extracting procurement document links from live notice detail pages, so discovered opportunities can seed source documents for downstream RFP parsing and response work.

Changes in this slice:
- Parse UNDP notice detail markdown for contact email, procurement document links, and the primary negotiation-document link.
- Enrich the first bounded set of UNDP configured-source opportunities with detail-page document URLs during import.
- Update the source document URL and `rfpLink` to the primary UNDP negotiation document link when available.
- Tighten the `live-undp-source` proof so it verifies both normalized UNDP list opportunities and a live detail-page document link.
- Add focused parser/import/proof coverage for UNDP detail enrichment.

Verification:
- `npm test -- undp-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts generic-parser.test.ts` from `frontend/` passed, running 25 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-undp-source` from `frontend/` passed. It scraped `https://procurement-notices.undp.org`, returned 589 normalized UNDP opportunities, and proved a SharePoint `Negotiation Document(s)` link from a live detail page.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 50 tests.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise and source documents.
- Persisted live import and response proof still waits on reachable PostgreSQL.

### 2026-05-27 - UNDP Source-Preserving Live Discovery

Status: implemented and verified.

Purpose: keep the default UNDP live source from degrading into generic source-scrape records by preserving UNDP notice IDs, office/country metadata, process type, and UN procurement tags through configured-source imports.

Changes in this slice:
- Add a UNDP procurement parser for Firecrawl's field-packed notice links.
- Wire `procurement-notices.undp.org` into configured-source parser selection, import platform naming, source preservation, and tags.
- Add a source-specific `live-undp-source` platform proof while keeping the generic live source proof backed by configured parser selection.
- Add parser, import, generic-regression, and proof-manifest coverage.

Verification:
- `npm test -- undp-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts generic-parser.test.ts` from `frontend/` passed, running 24 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-undp-source` from `frontend/` passed. It scraped `https://procurement-notices.undp.org` and returned 589 normalized UNDP opportunities.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 50 tests.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise.
- Persisted live import and response proof still waits on reachable PostgreSQL.

### 2026-05-27 - World Bank Live Source Discovery

Status: implemented and verified.

Purpose: add World Bank procurement notices as a high-volume live source using the site's current notices table instead of the low-recall generic parser.

Changes in this slice:
- Add a World Bank procurement table parser that extracts procurement-detail rows and skips award rows.
- Wire World Bank source URLs into configured-source discovery so imports preserve `source: "world_bank"`, platform metadata, project metadata, and global-procurement tags.
- Add a source-specific `live-world-bank-source` platform proof and include World Bank in the default discovery source list.
- Add parser, import, proof-manifest, and default-source regression coverage.

Verification:
- `npm test -- world-bank-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts default-discovery-sources.test.ts` from `frontend/` passed, running 23 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-world-bank-source` from `frontend/` passed. It scraped `https://projects.worldbank.org/en/projects-operations/procurement` and returned 18 normalized World Bank opportunities.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 49 tests.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise.
- Persisted live import and response proof still waits on reachable PostgreSQL.

### 2026-05-27 - Discovery Defaults Include AFDB And COMESA

Status: implemented and verified.

Purpose: put the newly live-proven AFDB and COMESA sources into the default operator discovery dialog instead of requiring manual URL entry.

Changes in this slice:
- Move default configured-source URLs into a shared discovery source module.
- Add AFDB and COMESA to the default live discovery source list alongside Kenya PPIP, UNGM, and UNDP.
- Expand the source URL textarea to show the full default source set without hiding the newly added sources.
- Add focused coverage for the default source list.

Verification:
- `npm test -- default-discovery-sources.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise.
- Persisted live import and response proof still waits on reachable PostgreSQL.

### 2026-05-27 - AFDB Live Source Discovery

Status: implemented and verified.

Purpose: add a higher-signal regional development-bank source to live opportunity discovery without counting AFDB policy, navigation, procurement-plan, or award links as active opportunities.

Changes in this slice:
- Add an AFDB procurement parser that extracts dated document notices for actionable prefixes such as EOI, SPN, AOI, AMI, GPN, and IFB.
- Wire AFDB source URLs into configured-source discovery so imports preserve `source: "afdb"`, African Development Bank platform metadata, and regional-procurement tags.
- Add a source-specific `live-afdb-source` platform proof and source-specific run IDs for AFDB and COMESA live wrappers.
- Add parser, import, and proof-manifest regression coverage.

Verification:
- `npm test -- afdb-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 21 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-afdb-source` from `frontend/` passed. It scraped `https://www.afdb.org/en/projects-and-operations/procurement` and returned 13 normalized AFDB opportunities.
- `npm run platform:proof -- --include-live-safe --run live-comesa-source` from `frontend/` passed after the wrapper run-ID change, returning 2 normalized COMESA opportunities.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 48 tests.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise.
- Persisted live import and response proof still waits on reachable PostgreSQL.

### 2026-05-27 - COMESA Live Source Discovery

Status: implemented and verified.

Purpose: expand reliable live opportunity discovery beyond UNDP/UNGM/Kenya by adding a COMESA parser for regional open tenders.

Changes in this slice:
- Add a COMESA open-tenders parser that extracts dated tender posts and filters navigation/category links that the generic parser treated as opportunities.
- Wire COMESA source URLs into configured-source discovery so imports preserve `source: "comesa"`, COMESA platform metadata, and regional-procurement tags.
- Add a live-safe `live-comesa-source` platform proof scenario.
- Add parser, import, and proof-manifest regression coverage.

Verification:
- `npm test -- comesa-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 20 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-comesa-source` from `frontend/` passed. It scraped `https://www.comesa.int/category/open-tenders/` and returned 2 normalized COMESA opportunities.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 discovery-to-response bridge test files and 47 tests.

Remaining after this slice:
- Continue adding high-value live sources where Firecrawl or source APIs can produce normalized opportunities with low noise.
- Persisted live import and response proof still waits on reachable PostgreSQL.

### 2026-05-27 - Command Center Response Quality Resolver Links

Status: implemented and verified.

Purpose: make response package readiness blockers in the opportunity command center directly actionable from the operator surface.

Changes in this slice:
- Route `proposal_response_package` workflow blockers to the opportunity documents/final-package surface instead of the generic opportunity overview.
- Update command-center projection coverage so response-quality blockers resolve to `/opportunities/{id}/documents`.
- Extend browser control-plane coverage so the command center visibly shows the response-quality blocker and its documents resolver link.

Verification:
- `npm test -- work-items-command-center.test.ts projections.test.ts` from `frontend/` passed, running 6 tests.
- `npm run test:e2e -- wave1-control-plane.spec.ts` from `frontend/` passed, running 3 Playwright tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave1-control-plane-browser --run wave4-planning-collaboration-tasks` from `frontend/` passed.

Remaining after this slice:
- Continue closing non-DB operator gaps while live persisted proof waits on reachable PostgreSQL.

### 2026-05-27 - Final Submission Artifact Readiness Receipt Gate

Status: implemented and verified.

Purpose: prevent stale final artifacts rendered before response-readiness enforcement from passing final submission gates.

Changes in this slice:
- Require approved final artifact receipts to include a render-time response package readiness snapshot.
- Treat missing response-readiness artifact receipts as final submission blockers that require re-rendering after response readiness passes.
- Add regression coverage for an otherwise approved artifact that lacks response readiness proof.

Verification:
- `npm test -- final-submission-checklist-workflow.test.ts final-artifact-workflow.test.ts submission-workflow.test.ts` from `frontend/` passed, running 32 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate --run wave9-discovery-to-submission-core` from `frontend/` passed, running 2 Wave 6 final-submission files and 13 Wave 9 discovery-to-submission files.

Remaining after this slice:
- Existing artifacts rendered before this receipt requirement must be re-rendered after response readiness passes before they can satisfy final submission gates.
- Live persisted proof remains blocked until PostgreSQL is reachable.

### 2026-05-27 - Final Artifact Response Readiness Evidence

Status: implemented and verified.

Purpose: carry the response-readiness proof enforced at final render into the artifact, approval, signoff, and workflow evidence trail.

Changes in this slice:
- Capture the tenant-scoped response package readiness snapshot before final render/request-render.
- Persist the snapshot into final artifact workflow metadata and rendered artifact manifests.
- Include response readiness status/workflow identifiers in stored object metadata.
- Preserve the readiness snapshot when approving the final artifact and when recording executive/legal signoff.
- Extend final artifact workflow coverage to assert response readiness evidence survives render, approval, signoff, task projection, and runtime transition metadata.

Verification:
- `npm test -- final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts` from `frontend/` passed, running 22 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections --run wave9-discovery-to-submission-core` from `frontend/` passed, running 5 Wave 6 workflow files and 13 Wave 9 discovery-to-submission files.

Remaining after this slice:
- Persisted live end-to-end proof remains blocked until PostgreSQL is reachable.
- Continue using live-safe source and response-readiness proofs while DB-backed tenant persistence is unavailable.

### 2026-05-27 - Live-Safe Proof Failure Accounting

Status: implemented and verified.

Purpose: prevent broad platform proof sweeps from hiding failed live-safe scenarios when `--continue-on-failure` is used.

Changes in this slice:
- Move platform-proof scenario execution into a testable runner.
- Preserve `--continue-on-failure` by running later scenarios after a failure, but return a non-zero final exit code when any scenario fails.
- Print a compact final failure summary so the failed scenario is visible after long mixed sweeps.
- Add regression coverage for both continue-on-failure and fail-fast scenario execution.

Verification:
- `npm run platform:proof -- --include-live-safe --all --continue-on-failure` from `frontend/` ran the full non-live and live-safe sweep. Non-live waves passed; live SearXNG, Firecrawl, browser fallback, Docling-backed response readiness, UNDP source discovery, Kenya PPIP, and UNGM checks passed. The DB-backed `phase1-live-safe-control-plane` scenario failed during disposable user insert, matching the known PostgreSQL connectivity blocker.
- `npm test -- platform-proof-scenarios.test.ts platform-proof-core.test.ts` from `frontend/` passed, running 8 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run phase1-live-safe-control-plane --run live-discovery-services --continue-on-failure` from `frontend/` ran the second scenario after the phase1 failure, then exited 1 with `phase1-live-safe-control-plane exited 1`.

Remaining after this slice:
- Live search/scrape/source/response readiness services are reachable and producing current evidence.
- DB-backed live control-plane and persisted end-to-end proofs remain blocked until PostgreSQL at `88.80.188.224:5432` is reachable.

### 2026-05-27 - Full Non-Live Platform Proof Refresh

Status: verified.

Purpose: re-run the complete non-live proof manifest after response readiness, final-render gating, documents UI, workflow task projection, and command-center readiness changes.

Verification:
- `npm run platform:proof -- --all --continue-on-failure` from `frontend/` passed.
- The proof covered Wave 0 through Wave 9 non-live scenarios, including typecheck, API/action tests, workflow tests, browser E2E control-plane tests, discovery-to-response bridge coverage, response package readiness, and discovery-to-submission core coverage.
- The final scenario, `wave9-discovery-to-submission-core`, passed 13 test files and 115 tests.

Remaining after this slice:
- Live-safe proofs remain separate from this non-live manifest.
- Persisted live end-to-end proof still depends on a reachable PostgreSQL endpoint.

### 2026-05-27 - Command Center Response Quality Blockers

Status: implemented and verified.

Purpose: make blocked response package readiness visible in the opportunity command center so operators see response-quality blockers in the same place as evidence, review, production, and dispatch blockers.

Changes in this slice:
- Project blocked, missing, or unrecognized `proposal_response_package` readiness metadata as command-center workflow blockers.
- Add response-readiness descriptions with requirement coverage, review gate coverage, and win-theme coverage.
- Add a dedicated `Response quality` readiness dimension keyed to response package, win theme, review gate, evidence checklist, and placeholder signals.
- Extend the Wave 4 planning/collaboration proof scenario to include command-center and work-item projection coverage.

Verification:
- `npm test -- work-items-command-center.test.ts` from `frontend/` passed, running 3 tests.
- `npm test -- projections.test.ts` from `frontend/` passed, running 3 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave4-planning-collaboration-tasks` from `frontend/` passed, running 5 test files and 18 tests.
- `npm test -- platform-proof-scenarios.test.ts` from `frontend/` passed.
- `git diff --check -- frontend/lib/actions/work-items.ts frontend/lib/work-items/projections.ts frontend/__tests__/actions/work-items-command-center.test.ts frontend/scripts/platform-proof/scenarios.ts` passed.

Remaining after this slice:
- Continue connecting final approval evidence and live persisted proof once PostgreSQL is reachable.
- Consider adding browser-level command-center visual coverage after the next UI change.

### 2026-05-27 - Response Package Quality Readiness Metrics

Status: implemented and verified.

Purpose: move response package readiness beyond requirement coverage so generated response packages also carry quality evidence needed for winning responses.

Changes in this slice:
- Add draft quality metrics to tenant-backed response package readiness: total draft words, minimum drafted document words, evidence checklist coverage, review gate coverage, win-theme coverage, and unresolved placeholder count.
- Block readiness when generated response drafts are too thin, miss evidence checklists, miss review gates, or retain unresolved placeholders.
- Warn when drafted response documents lack approved win themes so operators can improve evaluator-facing differentiation without blocking legacy opportunities that have not yet configured themes.
- Surface review-gate coverage in the final package UI readiness label.
- Extend proposal document action coverage to prove the quality metrics are persisted and scoped with the response readiness summary.

Verification:
- `npm test -- proposal-documents-scope.test.ts` from `frontend/` passed, running 15 tests.
- `npm test -- final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts` from `frontend/` passed, running 22 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 test files and 46 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 workflow test files and 43 tests.
- `npm run platform:proof -- --run wave6-final-submission-gate` from `frontend/` passed, running 2 workflow test files and 19 tests.
- `git diff --check -- frontend/lib/actions/proposal-documents.ts frontend/lib/types/opportunity.ts frontend/components/proposals/ProposalDocumentList.tsx frontend/__tests__/actions/proposal-documents-scope.test.ts` passed.

Remaining after this slice:
- Continue connecting response quality review outcomes into command-center dimensions and final approval evidence.
- Persisted live end-to-end proof remains blocked until PostgreSQL is reachable.

### 2026-05-27 - Response Readiness Task Projection

Status: implemented and verified.

Purpose: prevent workflow tasks from inviting final package rendering when response package readiness is already blocked.

Changes in this slice:
- Promote blocked response package readiness to critical workflow priority.
- Mark response-package review tasks as blocked with readiness blocker details when draft coverage is incomplete.
- Mark final-package render tasks as blocked until response readiness passes.
- Persist readiness metadata on the final-package render task so operators see the same blocker evidence as the final render and submission gates.

Verification:
- `npm test -- proposal-documents-scope.test.ts` from `frontend/` passed, running 15 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 test files and 46 tests.
- `git diff --check -- frontend/lib/actions/proposal-documents.ts` passed.

Live DB re-check:
- `RUN_DB_INTEGRATION_TESTS=1 npm test -- rfp-tenant-isolation.test.ts` from `frontend/` is still blocked by `ECONNREFUSED 88.80.188.224:5432` during fixture insert and cleanup.

Remaining after this slice:
- Persisted live end-to-end proof remains blocked until PostgreSQL is reachable.
- Continue closing response quality review surfaces and final approval evidence.

### 2026-05-27 - Documents UI Response Readiness Visibility

Status: implemented and verified.

Purpose: show response package readiness in the operator-facing documents/final-package UI so render blockers are visible before a user attempts final artifact production.

Changes in this slice:
- Add a tenant-scoped `getResponsePackageReadiness` server action for the opportunity documents page.
- Thread response readiness through the server page, client refresh flow, and proposal document list.
- Display response readiness coverage or blocker text in each final package panel.
- Disable final render/re-render controls when response readiness is missing, blocked, or unrecognized.
- Add action coverage proving the documents page readiness summary is scoped to the assigned opportunity and organization.

Verification:
- `npm test -- proposal-documents-scope.test.ts` from `frontend/` passed, running 15 tests.
- `npm test -- final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts` from `frontend/` passed, running 22 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 test files and 46 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 workflow test files and 43 tests.
- `npm run platform:proof -- --run wave6-final-submission-gate` from `frontend/` passed, running 2 workflow test files and 19 tests.
- `git diff --check -- docs/aspiration-execution-gap-progress.md frontend/lib/actions/proposal-documents.ts frontend/lib/types/opportunity.ts frontend/app/(app)/opportunities/[id]/documents/page.tsx frontend/app/(app)/opportunities/[id]/documents/ProposalDocumentsClientPage.tsx frontend/components/proposals/ProposalDocumentList.tsx frontend/__tests__/actions/proposal-documents-scope.test.ts` passed.

Remaining after this slice:
- Add persisted live end-to-end proof from discovered opportunity into tenant workflow records when PostgreSQL is reachable.
- Continue closing operator review surfaces for response quality and final package approvals.

### 2026-05-27 - Final Artifact Response Readiness Gate

Status: implemented and verified.

Purpose: stop weak response packages before final artifact rendering instead of waiting until the submission checklist catches them.

Changes in this slice:
- Require `proposal_response_package` workflow readiness before final artifact request-render or render actions tied to an opportunity.
- Block missing, blocked, or unrecognized response readiness before object storage or document rendering is invoked.
- Preserve the existing `allowDraftRender` path for intentional draft/pre-final renders.
- Add regression coverage proving blocked response readiness prevents storage, renderer, upload, and database mutation side effects.

Verification:
- `npm test -- final-artifact-workflow.test.ts` from `frontend/` passed, running 12 tests.
- `npm test -- final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts submission-workflow.test.ts` from `frontend/` passed, running 31 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 workflow test files and 43 tests.
- `git diff --check -- frontend/lib/actions/final-artifact-workflow.ts frontend/__tests__/actions/final-artifact-workflow.test.ts` passed.

Remaining after this slice:
- Continue surfacing response readiness blockers in operator-facing review/final-render UI before users attempt the render action.
- Tenant-persisted live proof still needs a reachable PostgreSQL endpoint.

### 2026-05-27 - Final Submission Response Readiness Gate

Status: implemented and verified.

Purpose: prevent a final submission checklist from passing when the response package workflow has missing or blocked readiness evidence.

Changes in this slice:
- Load the tenant-scoped `proposal_response_package` workflow instance during final submission checklist evaluation.
- Add a required response package readiness checklist item that passes only when workflow metadata reports `ready_for_review`.
- Block final submission when response package readiness is missing, blocked, or has an unrecognized status.
- Surface response package coverage metrics and blocker summaries in final checklist messages and workflow metadata.

Verification:
- `npm test -- final-submission-checklist-workflow.test.ts` from `frontend/` passed, running 10 tests.
- `npm test -- final-submission-checklist-workflow.test.ts submission-workflow.test.ts` from `frontend/` passed, running 19 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate` from `frontend/` passed, running 2 final-submission test files and 19 tests.
- `git diff --check -- frontend/lib/actions/final-submission-checklist-workflow.ts frontend/__tests__/actions/final-submission-checklist-workflow.test.ts` passed.

Remaining after this slice:
- Continue connecting response readiness evidence into operator review/final-render UX so blockers are visible before the final checklist.
- Tenant-persisted live proof still needs a reachable PostgreSQL endpoint.

### 2026-05-27 - Response Package Workflow Readiness Metrics

Status: implemented and verified.

Purpose: carry response readiness evidence into the tenant-backed response package action result and workflow metadata so operators can see whether accepted requirements actually reached drafted response documents.

Changes in this slice:
- Add deterministic readiness metrics to `createAndDraftStandardProposalSet`.
- Measure accepted requirement count, drafted requirement count, requirement coverage, documents drafted, sections drafted, and compliance entries created.
- Return blockers and missing requirement IDs when accepted requirements are not represented in drafted response documents, while preserving warnings for compliance-matrix entry gaps.
- Persist the readiness object into the response-package workflow transition metadata.

Verification:
- `npm test -- proposal-documents-scope.test.ts` from `frontend/` passed, running 14 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 test files and 45 tests.

Live DB re-check:
- `RUN_DB_INTEGRATION_TESTS=1 npm test -- rfp-tenant-isolation.test.ts` from `frontend/` is still blocked by `ECONNREFUSED 88.80.188.224:5432` during fixture insert and cleanup.

Remaining after this slice:
- Tenant-persisted live proof still needs a reachable PostgreSQL endpoint.
- Continue wiring readiness metrics through the review/final-render/submission surfaces so weak response packages cannot silently advance.

### 2026-05-27 - Response Readiness Platform Proof Scenario

Status: implemented and verified.

Purpose: make deterministic source-driven response package readiness part of the durable non-live platform proof manifest instead of only an ad hoc unit command and live-safe proof.

Changes in this slice:
- Add `wave9-response-readiness-package` to the platform-proof scenario manifest.
- Cover the live response package builder's source requirement extraction, Datacraft snippet selection, six-document draft generation, readiness metrics, blocker behavior, and unresolved-placeholder checks.
- Add manifest regression coverage so the scenario remains uniquely addressable under Wave 9 response-generation proof targets.

Verification:
- `npm run platform:proof -- --run wave9-response-readiness-package` from `frontend/` passed, running `live-response-package.test.ts`.
- `npm test -- platform-proof-scenarios.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Continue closing the live path from draft artifacts into tenant-persisted opportunity, document, workflow, final rendering, and submission records once database connectivity is available.

### 2026-05-27 - Live Opportunity Response Readiness Proof

Status: implemented and verified.

Purpose: prove a live procurement opportunity can move beyond discovery into source-document extraction and concrete response-package draft artifacts using the configured UNGM and Docling services.

Changes in this slice:
- Fix the Docling client to call the live Docling Serve `/v1/convert/file` multipart endpoint with the `files` field and Docling Serve response normalization.
- Add `live-opportunity-response-readiness` to the platform-proof live-safe manifest.
- Add a reusable live response package builder that turns extracted source text into six draft markdown response documents with requirement coverage and Datacraft evidence cues.
- Add a deterministic readiness assessment that blocks incomplete packages based on document type coverage, source requirement coverage, mandatory requirement coverage, evidence cue coverage, review gates, unresolved placeholders, and minimum draft depth.
- Add a live-safe proof script that finds a software/security UNGM opportunity, fetches its source PDF, extracts procurement text with Docling, writes response-package draft artifacts, and verifies the resulting package.

Verification:
- `npm test -- live-response-package.test.ts searxng-client-config.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed, running 13 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-opportunity-response-readiness` from `frontend/` passed.
- The live proof selected the UN Secretariat goAML software penetration-testing EOI, fetched a 171,406-byte PDF, extracted 3,070 text characters through Docling with status `success`, found procurement indicators, extracted 8 source requirement signals, and wrote 6 response draft artifacts totaling 3,203 words with 22 section seeds and 85 relevant Datacraft snippets.
- The readiness assessment returned `ready_for_review` with zero blockers, 100% document type coverage, 100% source requirement coverage, 100% mandatory requirement coverage, 100% evidence cue coverage, 100% review gate coverage, and zero unresolved placeholders. It recorded warnings that `management_plan` and `past_performance` had no directly assigned source requirement signals in the short EOI source text.

Remaining after this slice:
- The environment-backed live database persistence proof is still blocked until the configured PostgreSQL endpoint is reachable.
- Continue closing the live path from draft artifacts into tenant-persisted opportunity, document, workflow, final rendering, and submission records once database connectivity is available.

### 2026-05-27 - Live DB Persistence Probe Blocked

Status: blocked by database connectivity.

Purpose: check whether the environment-backed RFP tenant persistence proof can now run against the configured migrated database.

Verification attempted:
- `RUN_DB_INTEGRATION_TESTS=1 npm test -- rfp-tenant-isolation.test.ts` from `frontend/` attempted to run the gated DB-backed tenant-isolation suite.
- The suite could not connect to the configured PostgreSQL host `88.80.188.224:5432`; both fixture insert and cleanup attempts failed with `ECONNREFUSED`.

Outcome:
- No live persistence proof was collected in this environment.
- The remaining live database gap is external connectivity/configuration, not skipped local test coverage.

Next condition to unblock:
- Provide a reachable migrated PostgreSQL endpoint through `DATABASE_URL`, then rerun `RUN_DB_INTEGRATION_TESTS=1 npm test -- rfp-tenant-isolation.test.ts`.

### 2026-05-27 - Discovery-to-Response Bridge Proof Scenario

Status: implemented and verified.

Purpose: make the discovered-opportunity to RFP intake and response-package bridge a focused platform proof instead of relying only on the larger discovery-to-submission manifest.

Changes in this slice:
- Add `wave9-discovery-rfp-response-bridge` to the platform-proof scenario manifest.
- Cover the bridge from discovery import and source document seeding through direct RFP intake, RFP storage/extraction service behavior, and accepted-requirement response package drafting.
- Add manifest coverage so the focused scenario remains uniquely addressable and advertises its expected Vitest artifacts.

Verification:
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` from `frontend/` passed, running 4 test files and 45 tests.
- `npm test -- platform-proof-scenarios.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Add an environment-backed live persistence proof only when a reachable migrated database is available.
- Keep source-specific live proofs as the stronger evidence for real external opportunity feeds.

### 2026-05-27 - Opportunity-Relevant Live Search Proof

Status: implemented and verified.

Purpose: harden the live discovery-services proof so SearXNG must return opportunity-relevant results, not just any generic search result.

Changes in this slice:
- Replace the generic `tender` live proof query with procurement-source query candidates and an explicit Bing engine default, matching the currently responsive SearXNG upstream.
- Filter SearXNG samples to procurement source hosts or tender/RFP/bid-style opportunity language with procurement context.
- Record both total SearXNG results and opportunity-relevant SearXNG results in live evidence artifacts.
- Use the shared Firecrawl/browser scrape timeout default instead of the previous 20-second proof-specific timeout.

Verification:
- `npm run platform:proof -- --include-live-safe --run live-discovery-services` from `frontend/` passed.
- The live proof returned 4 opportunity-relevant SearXNG results out of 10 total results for `tenders.go.ke` through Bing, Firecrawl scraped `https://example.com` into 180 markdown characters, and the browser fallback scraped 528 content characters.

Remaining after this slice:
- SearXNG upstream quality is still uneven: Google, DuckDuckGo, Brave, and Startpage reported access/CAPTCHA limits during probing, so this proof intentionally targets the responsive Bing path.
- Keep the direct PPIP, UNGM, and UNDP source proofs as the stronger evidence for source-specific opportunity discovery.

### 2026-05-27 - Full Non-Live Platform Proof

Status: verified.

Purpose: prove the complete non-live frontend platform proof manifest is green after tenant-scope remediation, live discovery validation, and discovery import persistence coverage.

Verification:
- `npm run platform:proof -- --all --continue-on-failure` from `frontend/` passed every non-live scenario.
- Covered Wave 0 proof harness/typecheck/workflow runtime, Wave 1 browser control-plane and portal flows, Wave 2 RFP upload/parse/storage, Wave 3 compliance/evidence/readiness, Wave 4 planning/collaboration/capture pipeline, Wave 5 AI/content governance, Wave 6 submission/approval/production, Wave 7 import/operations, Wave 8 strategic capability workflows, and Wave 9 discovery-to-submission core.
- Browser e2e scenarios passed for control-plane interactions, role homepage, and portal workflow queue.

Remaining after this slice:
- Live-safe proofs are green for search/scrape/source discovery; still need an environment-backed live database persistence proof when a reachable migrated database is available.
- Keep extending platform-proof scenarios as new user-facing workflows are added.

### 2026-05-27 - Capture Pipeline Platform Proof Scenario

Status: implemented and verified.

Purpose: make capture pipeline tenant-scope and auth coverage part of the durable platform-proof manifest instead of leaving it as an ad hoc test command.

Changes in this slice:
- Add `wave4-capture-pipeline-scope` to the platform-proof scenario manifest.
- Cover `pipeline-scope.test.ts` and `pipeline-auth.test.ts` under the Wave 4 planning/capture proof family.
- Close the earlier pipeline slice's gap that noted there was no dedicated platform-proof scenario for pipeline coverage.

Verification:
- `npm run platform:proof -- --run wave4-capture-pipeline-scope` from `frontend/` passed, running 2 pipeline test files and 11 tests.
- `npm test -- platform-proof-scenarios.test.ts` from `frontend/` passed, running 3 manifest tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Prove a selected discovered opportunity can drive RFP/document intake and response-package generation end to end.
- Add an environment-backed persistence proof only when a reachable test database is available.

### 2026-05-27 - Discovery Import Tenant Persistence Proof

Status: implemented and verified.

Purpose: prove scheduled/API-key discovery imports persist discovered opportunities under the explicit service tenant rather than relying on the ambient interactive session.

Changes in this slice:
- Add regression coverage for `executeOpportunityDiscoveryImport` when the active user context differs from the supplied import actor and organization.
- Assert import record creation, opportunity creation, and import record completion all receive the explicit `{ actorId, organizationId }` override.
- Keep the discovery route proof aligned with the service path used for API-key discovery runs.

Verification:
- `npm test -- discovery-opportunity-import.test.ts opportunity-discovery-route.test.ts` from `frontend/` passed, running 19 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 112 tests.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Prove a selected discovered opportunity can drive RFP/document intake and response-package generation end to end.
- Add an environment-backed persistence proof only when a reachable test database is available.

### 2026-05-27 - Live Discovery Source Proofs

Status: verified against live services.

Purpose: prove the platform can use the configured search/scrape infrastructure and live procurement sources to find opportunity candidates and fetch source material.

Live proofs:
- `live-discovery-services`: SearXNG at `https://search.lindela.io` returned 28 results for `tender`; Firecrawl scraped `https://example.com` into 180 markdown characters; browser fallback at `http://84.247.181.100:3003` scraped 528 markdown characters.
- `live-source-discovery`: Firecrawl scraped `https://procurement-notices.undp.org`, returning 201,672 markdown characters, 592 links, and 376 normalized opportunity candidates.
- `live-kenya-ppip-source`: Kenya PPIP returned 940 total active tenders, mapped 10 sampled opportunities, and fetched a source PDF byte range with HTTP 206 and `application/pdf`.
- `live-ungm-source`: UNGM returned 1,652 total notices, mapped 10 sampled opportunities, enriched 5 sampled details with public links, and fetched a portal page with HTTP 200.

Verification:
- `npm run platform:proof -- --include-live-safe --run live-discovery-services` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-source-discovery` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-kenya-ppip-source` from `frontend/` passed.
- `npm run platform:proof -- --include-live-safe --run live-ungm-source` from `frontend/` passed.

Remaining after this slice:
- Prove the discovered candidates can be persisted through the authenticated import path into tenant-scoped opportunity records.
- Prove a selected live opportunity can drive RFP/document intake and response-package generation end to end.

### 2026-05-27 - Opportunity Assignment Predicate Scan

Status: audited and verified; no code change required.

Purpose: confirm the remediated workflow surfaces no longer leave assignment-only opportunity predicates in frontend server actions.

Findings:
- Scanned `frontend/lib/actions` for every raw `opportunities.assigned_to` predicate.
- No remaining occurrence lacked a nearby `opportunities.organization_id` tenant predicate in the same visibility clause or subquery.
- Previously remediated surfaces now cover work items, calendar, reviews, document render audits, final artifacts, review packages, pricing approvals, claim remediation, resource reuse, workflow domain, submissions, pipeline, task management, pricing, and proposal documents.

Verification:
- `python3` assignment-predicate scan over `frontend/lib/actions` reported no missing nearby organization predicates.
- Full frontend proof is green after the test-health recovery: `npm test -- --run` passed with 1,249 tests and 4 DB integration tests intentionally skipped unless `RUN_DB_INTEGRATION_TESTS=1`.

Remaining after this slice:
- Move from tenant-scope remediation back to end-to-end functional gaps: live discovery/search/scrape validation, opportunity download/import paths, response-package generation, and deployment-readiness proof.

### 2026-05-27 - Full Vitest Suite Test-Health Recovery

Status: implemented and verified.

Purpose: restore the broad frontend Vitest proof after the tenant-scope remediation exposed unrelated test-health blockers.

Changes in this slice:
- Update the opportunity import auth test mock to include `requireUserContext`, matching the current discovery import auth path.
- Gate the DB-backed RFP tenant isolation integration suite behind `RUN_DB_INTEGRATION_TESTS=1` so ordinary full-suite runs do not depend on an external Postgres host.
- Document the opt-in requirement directly in the RFP tenant isolation test header.

Verification:
- `npm test -- import-opportunities-auth.test.ts rfp-tenant-isolation.test.ts` from `frontend/` passed, running 4 import auth tests and intentionally skipping 4 DB integration tests without the opt-in flag.
- `npm test -- --run` from `frontend/` passed, running 1,249 tests with 4 DB integration tests skipped.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Run `RUN_DB_INTEGRATION_TESTS=1 npm test -- rfp-tenant-isolation.test.ts` only in an environment with reachable `DATABASE_URL` and migration `0021_rfp_tenant_isolation.sql` applied.
- Continue scanning for other assignment-only opportunity predicates outside the already remediated workflow surfaces.

### 2026-05-27 - Win Theme Tenant Predicate Audit

Status: audited and verified; no code change required.

Purpose: confirm win-theme and competitive strategy workflows already bind opportunity-derived reads and writes to the caller's organization through the owning opportunity.

Findings:
- `win-themes.ts` already applies opportunity organization predicates, with legacy null-opportunity fallback, to theme, occurrence, injection, and proposal-document scan visibility paths.
- `competitive-win-theme-workflow.ts` already applies opportunity organization predicates to strategy workflow visibility paths.
- Existing tests already assert both `opportunities.organization_id` and `opportunities.assigned_to` for the win-theme paths.

Verification:
- `npm test -- win-themes-auth.test.ts competitive-win-theme-workflow.test.ts` from `frontend/` passed, running 8 tests.

Remaining after this slice:
- Resolve the existing full-suite blockers recorded in the pipeline slice so the full Vitest suite can become a clean proof again.
- Continue scanning for other assignment-only opportunity predicates outside the already remediated workflow surfaces.

### 2026-05-27 - Proposal Documents Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep proposal document creation, section drafting, requirement linking, win-theme reads, bulk document updates, and response-package generation scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to proposal-document assigned-opportunity helpers.
- Thread organization-aware opportunity predicates through opportunity, requirement, win-theme, proposal-document, section, and bulk-update visibility paths.
- Add the opportunity tenant boundary to proposal-document section subqueries that join through the owning proposal document and opportunity.
- Extend proposal document scope tests to assert opportunity organization predicates across create, read, update, section, draft, link, and bulk status paths.

Verification:
- `npm test -- proposal-documents-scope.test.ts proposal-documents-auth.test.ts` from `frontend/` passed, running 16 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as win themes.
- Resolve the existing full-suite blockers recorded in the pipeline slice so the full Vitest suite can become a clean proof again.

### 2026-05-27 - Pricing Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep cost elements, pricing summaries, cost-technical tracking, and pricing creation preflights scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to direct assigned-opportunity pricing preflights.
- Add the same opportunity tenant boundary to shared pricing `exists` predicates used by cost elements, pricing summaries, cost-technical tracking, and WBS-derived reads.
- Preserve pricing row organization predicates while adding the missing opportunity tenant boundary.
- Extend pricing tests to assert opportunity organization predicates on cost element creation, pricing summary reads/updates, and cost-technical tracking reads.

Verification:
- `npm test -- pricing.test.ts` from `frontend/` passed, running 92 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production test files and 42 tests.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as proposal documents and win themes.
- Resolve the existing full-suite blockers recorded in the pipeline slice so the full Vitest suite can become a clean proof again.

### 2026-05-27 - Task Management Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep proposal task generation, reads, updates, deletes, activity reads, time logging, workload metrics, and summary maintenance scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to task-management assigned-opportunity visibility checks.
- Add the same opportunity tenant boundary to task-activity visibility subqueries.
- Preserve proposal task row organization predicates while adding the missing opportunity tenant boundary.
- Extend task-management auth/scope tests to assert opportunity organization predicates across requirements, task reads/writes, summaries, activity, time logging, workload, and author metrics paths.

Verification:
- `npm test -- task-management-auth.test.ts` from `frontend/` passed, running 11 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run wave4-planning-collaboration-tasks` from `frontend/` passed, running 3 planning/collaboration test files and 12 tests.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as pricing, proposal documents, and win themes.
- Resolve the existing full-suite blockers recorded in the pipeline slice so the full Vitest suite can become a clean proof again.

### 2026-05-27 - Pipeline Opportunity Tenant Predicates

Status: implemented and focused verified; broad Vitest suite still has unrelated blockers.

Purpose: keep capture pipeline, activity, gate, milestone, partner, analytics, forecast, and risk reads/writes scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Require pipeline opportunity predicates to use the organization-aware pipeline context.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to assigned-opportunity and assigned-pipeline visibility helpers.
- Preserve capture pipeline, gate review, and milestone row predicates while adding the missing opportunity tenant boundary.
- Extend pipeline scope tests to assert opportunity organization predicates across pipeline, activity, gate, milestone, partner, analytics, forecast, risk, and summary paths.

Verification:
- `npm test -- pipeline-scope.test.ts` from `frontend/` passed, running 9 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --list` from `frontend/` showed no dedicated pipeline/capture platform-proof scenario.
- `npm test -- --run` from `frontend/` was attempted; pipeline coverage passed, but the full suite remained red because `rfp-tenant-isolation.test.ts` could not connect to `88.80.188.224:5432` and `import-opportunities-auth.test.ts` has an existing `requireUserContext` auth-utils mock mismatch.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as task management, pricing, proposal documents, and win themes.
- Add a dedicated pipeline/capture platform-proof scenario so pipeline tenant isolation is covered by the proof harness instead of only the action scope test.

### 2026-05-27 - Submissions Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep final submission creation, attachment selection, status updates, outcome updates, analytics, and recent submission reads scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Require submission opportunity predicates to use the typed organization-aware submission context.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to submission, opportunity, analytics, recent-submission, and attachment proposal-document visibility checks.
- Preserve submission row organization predicates while adding the missing opportunity tenant boundary.
- Extend submissions scope tests to assert opportunity organization predicates across read, write, analytics, recent, and outcome paths.

Verification:
- `npm test -- submissions-scope.test.ts submissions-auth.test.ts` from `frontend/` passed, running 11 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-final-submission-gate` from `frontend/` passed, running 2 final-submission test files and 18 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as task management, pipeline, pricing, proposal documents, and win themes.

### 2026-05-27 - Workflow Domain Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep domain workflow starts and compensation writes scoped to the caller's organization through the owning opportunity before mutating opportunity, proposal task, review, document, approval, submission, claim, pricing, and partner assignment state.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to workflow-domain shared opportunity helpers.
- Bind workflow start opportunity access checks and domain compensation predicates to the tenant context already required by the workflow domain action.
- Add opportunity tenant predicates for proposal document/document approval joins and pipeline/review existence joins used by compensation.
- Extend workflow-domain tests to assert opportunity organization predicates across pricing, task, gate, claim, and final-document compensation paths.

Verification:
- `npm test -- workflow-domain.test.ts` from `frontend/` passed, running 24 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave0-workflow-runtime-core` from `frontend/` passed, running 4 workflow/runtime/auth test files and 27 tests.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as task management, submissions, pipeline, pricing, proposal documents, and win themes.

### 2026-05-27 - Work Items Claim Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep command-center high-risk claim blockers scoped to the caller's organization through the owning opportunity before projecting readiness blockers.

Changes in this slice:
- Thread workflow viewer organization context into command-center claim blocker queries.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to work-item claim visibility checks.
- Extend command-center tests to assert opportunity organization predicates for claim blocker reads.

Verification:
- `npm test -- work-items-command-center.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as task management, workflow domain, submissions, pipeline, pricing, proposal documents, and win themes.

### 2026-05-27 - Calendar Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep calendar deadline and milestone aggregation scoped to the caller's organization through the relevant opportunity before exposing proposal deadlines.

Changes in this slice:
- Use full user context for deadline range and milestone reads instead of user id only.
- Require organization context for opportunity-based calendar reads.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to deadline and milestone source queries.
- Extend calendar auth/scope tests to assert organization-aware opportunity predicates.

Verification:
- `npm test -- calendar-scope.test.ts calendar-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, task management, workflow domain, submissions, pipeline, pricing, proposal documents, and win themes.

### 2026-05-27 - Reviews Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep formal review create, list, reviewer-management, reporting, analytics, and status-transition paths scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to review opportunity and review existence helpers.
- Require organization-aware actor context across review/reviewer/scores/report/export/status paths that use shared review visibility predicates.
- Preserve existing review and comment organization predicates while adding the missing opportunity tenant boundary.
- Extend reviews tests to assert opportunity organization predicates in review scope checks.

Verification:
- `npm test -- reviews.test.ts` from `frontend/` passed, running 110 tests.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, task management, workflow domain, submissions, pipeline, pricing, proposal documents, and win themes.

### 2026-05-27 - Document Render Audit Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep pre-submission audit reads scoped to the caller's organization through the target opportunity before reporting readiness across proposal documents.

Changes in this slice:
- Use full user context for pre-submission audit instead of user id only.
- Require organization context for opportunity-based audit reads.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to audit opportunity and proposal document visibility checks.
- Extend document render auth/scope tests to assert organization-aware opportunity predicates.

Verification:
- `npm test -- document-render-scope.test.ts document-render-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, and win themes.

### 2026-05-27 - Final Artifact Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep final artifact render, approval, signoff, and reopen transitions scoped to the caller's organization through the owning opportunity before document/proposal finalization or runtime task updates.

Changes in this slice:
- Require final artifact opportunity predicates to use the typed organization-aware user context.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to proposal document and document visibility checks.
- Include organization context in final artifact runtime transition and task metadata.
- Extend final artifact tests to assert opportunity organization predicates and runtime organization payloads.

Verification:
- `npm test -- final-artifact-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, and rendering.

### 2026-05-27 - Review Package Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep review package gate transitions scoped to the caller's organization through both the proposal review rows and the owning opportunity before review state, reviewer state, or runtime task updates.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to review package opportunity joins.
- Preserve existing proposal review and review comment organization predicates.
- Include organization context in review package runtime transition and task metadata.
- Extend review package tests to assert opportunity organization predicates and runtime organization payloads.

Verification:
- `npm test -- review-package-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, final artifacts, task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, and rendering.

### 2026-05-27 - Pricing Approval Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep cost-element pricing reviews and pricing-package approval transitions scoped to the caller's organization through the owning opportunity before pricing state or runtime task updates.

Changes in this slice:
- Require typed organization context for pricing approval workflows.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to cost element, pricing summary, cost element collection, and cost-technical tracking visibility checks.
- Include organization context in pricing approval workflow runtime transitions and task metadata.
- Extend pricing approval tests to assert opportunity organization predicates and runtime organization payloads.

Verification:
- `npm test -- pricing-approval-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, review package, final artifacts, task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, and rendering.

### 2026-05-27 - Claim Remediation Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep unsupported-claim remediation transitions scoped to the caller's organization through the owning opportunity before updating claim state or projecting remediation tasks.

Changes in this slice:
- Require organization context for claim remediation transitions.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to claim visibility checks used by read and update paths.
- Include organization context in claim remediation workflow runtime transitions and task metadata.
- Extend claim remediation tests to assert opportunity organization predicates and runtime organization payloads.

Verification:
- `npm test -- claim-remediation.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` from `frontend/` passed, running 6 compliance/evidence readiness test files and 77 tests.

Remaining after this slice:
- Continue closing remaining assignment-only workflow surfaces such as work items, pricing approval, review package, final artifacts, task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, and rendering.

### 2026-05-27 - Resource Reuse Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep personnel reuse and past-performance reuse transitions scoped to the caller's organization through the target opportunity while preserving organization ownership for personnel and project rows.

Changes in this slice:
- Require organization context for resource reuse workflows.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to position and relevance-score visibility checks.
- Include organization context in personnel and past-performance reuse workflow runtime transitions.
- Extend resource reuse tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- resource-reuse-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing larger remaining surfaces such as task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, rendering, and final artifact workflows.

### 2026-05-26 - Personnel Staffing Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep staffing gap analysis, opportunity org charts, staffing matrices, and position listings scoped to the caller's organization through the target opportunity.

Changes in this slice:
- Require organization context for personnel actions that read opportunity position requirements.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to position-requirement opportunity visibility checks.
- Preserve non-opportunity personnel CRUD/auth behavior while tightening staffing views.
- Extend personnel scope tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- personnel-scope.test.ts personnel-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing larger remaining surfaces such as task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, rendering, and final artifact workflows.

### 2026-05-26 - Content Library Outcome Tenant Predicates

Status: implemented and verified.

Purpose: keep snippet/template proposal outcome recording and win-rate recalculation scoped to the caller's organization through the associated opportunity.

Changes in this slice:
- Require organization context for proposal outcome recording in the content library.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to snippet/template usage outcome update and read predicates.
- Extend content-library outcome tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- content-library-outcome-scope.test.ts content-library-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing larger remaining surfaces such as task management, workflow domain, submissions, pipeline, pricing, reviews, proposal documents, win themes, rendering, and final artifact workflows.

### 2026-05-26 - DLP Export Policy Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep DLP export clearance, blocking finding workflows, and security review task projection scoped to the caller's organization through the target opportunity.

Changes in this slice:
- Require organization context for DLP export policy evaluation.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to DLP proposal-document source queries.
- Include organization context in DLP workflow runtime transition records.
- Extend DLP policy action tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- dlp-policy.test.ts` from `frontend/` passed, covering the action workflow and scanner.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue scanning and closing remaining workflow support modules that still use unscoped or assignment-only opportunity checks.

### 2026-05-26 - Clarification Workflow Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep requirement clarification drafting, approval, submission, answer capture, incorporation, and runtime task projection scoped to the caller's organization through the requirement's owning opportunity.

Changes in this slice:
- Require organization context for clarification workflow transitions.
- Add opportunity organization predicates, with legacy null-opportunity fallback, to requirement visibility checks.
- Include organization context in recorded clarification workflow runtime transitions.
- Extend clarification workflow tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- clarification-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue scanning and closing remaining workflow support modules that still use unscoped or assignment-only opportunity checks.

### 2026-05-26 - Proposal Task Workflow Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep proposal task lifecycle transitions, task activity, and runtime task mirroring scoped to the caller's organization through the task's owning opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to proposal task workflow visibility checks.
- Thread full task workflow user context through task read and update predicates.
- Extend proposal task workflow tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- proposal-task-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue scanning and closing remaining workflow support modules that still use unscoped or assignment-only opportunity checks.

### 2026-05-26 - Final Submission Checklist Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep final submission readiness checks for proposal documents, compliance matrices, claim evidence, win-theme consistency, and DLP gate state scoped to the caller's organization through the target opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to final checklist source queries.
- Thread full user context through proposal document, compliance, claim, and win-theme visibility helpers.
- Extend final checklist tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- final-submission-checklist-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue scanning and closing remaining workflow support modules that still use unscoped or assignment-only opportunity checks.

### 2026-05-26 - Submission Correction Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep post-dispatch correction requests, corrected submission receipts, withdrawal compensation, and opportunity decision updates scoped to the caller's organization through the submitted opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to submission correction visibility helpers.
- Scope compensating opportunity decision updates through the same tenant-aware opportunity predicate.
- Extend submission correction workflow tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- submission-correction-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue scanning and closing remaining workflow support modules that still use unscoped or assignment-only opportunity checks.

### 2026-05-26 - Document Authoring Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep template-driven document creation, proposal document links, section edits, linked requirement readiness checks, and document authoring workflow transitions scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Require organization context for document authoring workflows.
- Add tenant predicates, with legacy null-opportunity fallback, to proposal-document, section, requirement, and opportunity visibility helpers.
- Preserve document owner checks while threading full action context through opportunity-mediated source checks.
- Extend document authoring workflow tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- document-authoring-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue scanning and closing any remaining workflow support modules that still use unscoped or assignment-only opportunity checks.

### 2026-05-26 - Review Comment Workflow Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep review comment resolution, projected proposal tasks, runtime workflow state, and review-comment activity scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Add opportunity organization predicates, with legacy null-opportunity fallback, to review-comment workflow opportunity existence checks.
- Ensure visible comment, review, and task predicates all require both the review/comment organization and the owning opportunity tenant.
- Extend review-comment workflow tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- review-comment-workflow.test.ts review-package-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to document authoring and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Partner Assignment Tenant Predicates

Status: implemented and verified.

Purpose: keep partner assignment, opportunity partner lists, active-opportunity counts, partner opportunity history, and partner performance metrics scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Require organization context for partner actions that read or mutate opportunity assignments.
- Add tenant predicates, with legacy null-opportunity fallback, to shared partner-assignment opportunity visibility helpers.
- Keep the global partner directory behavior unchanged because partner rows do not currently carry an organization column.
- Extend partner scope tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- partners-scope.test.ts partners-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to review comments, document authoring, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Presentation Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep oral presentation creation, slide generation, proposal source reads, requirement context, and anticipated Q&A scoped to the caller's organization through assigned opportunities and proposal documents.

Changes in this slice:
- Require source opportunity predicates to include both assignment and the caller's organization, preserving the legacy null-opportunity fallback.
- Thread the full presentation action context through proposal-document, source-document, opportunity, and requirement visibility helpers.
- Extend presentation scope tests to assert organization predicates as well as assignment predicates.

Verification:
- `npm test -- presentations-scope.test.ts presentations-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to partners, review comments, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Graphics Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep proposal graphics, figure numbering, captions, feedback, exports, template-derived graphics, and graphics consistency checks scoped to the caller's organization through assigned opportunities and proposal documents.

Changes in this slice:
- Require organization context for graphics actions.
- Add tenant predicates, with legacy null-opportunity fallback, to shared opportunity, graphic, proposal document, section, and document visibility helpers.
- Scope library-template graphic creation through the target opportunity before inserting generated graphics.
- Extend graphics scope tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- graphics-scope.test.ts graphics-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to presentations, partners, review comments, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - PWin Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep PWin assessment, ranking, portfolio optimization, comparison, metrics, forecast, calibration, and prediction flows scoped to the caller's organization through their assigned opportunities.

Changes in this slice:
- Require organization context for PWin actions.
- Add tenant predicates, with legacy null-opportunity fallback, to shared opportunity visibility and assigned-opportunity list helpers.
- Make PWin organization inserts non-optional once the user context is established.
- Extend PWin scope tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- pwin-opportunity-scope.test.ts pwin-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to graphics, presentations, partners, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Past Performance Tenant Boundaries

Status: implemented and verified.

Purpose: keep past-performance projects, relevance scoring, narratives, exports, analytics, and portfolio gap analysis scoped to the caller's organization as well as the assigned opportunity.

Changes in this slice:
- Require full user organization context for past-performance actions.
- Store `organization_id` on newly created, duplicated, and CPARS-imported past-performance projects.
- Add organization predicates, with legacy null-row fallback, to project owner checks and assigned opportunity subqueries.
- Extend past-performance scope tests to assert opportunity organization predicates and project organization predicates in addition to assignment and creator predicates.

Verification:
- `npm test -- past-performance-scope.test.ts past-performance-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` from `frontend/` passed, running 6 compliance/evidence/readiness test files and 77 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to PWin, graphics, presentations, partners, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Competitive Utility Tenant Boundaries

Status: implemented and verified.

Purpose: close the remaining competitive-intelligence mutation and dashboard paths that could act on raw competitor, link, analysis, or import identifiers without tenant predicates.

Changes in this slice:
- Scope competitor-opportunity creation and updates through assigned opportunity tenant predicates and visible competitor ownership.
- Scope win/loss tracking, win/loss analysis, ghost-theme usage, teaming competitor candidates, and intelligence summary counts to the current organization.
- Import competitive intelligence rows into the current organization and check duplicates only inside that tenant before updating.
- Add regression coverage for scoped link mutations, win/loss reads and writes, summary counts, ghost-theme usage, CI imports, and teaming competitor candidates.

Verification:
- `npm test -- competitive.test.ts competitive-win-theme-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to past performance, PWin, graphics, presentations, partners, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Competitive Analysis Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep competitor opportunity links, SWOT generation, discriminator suggestions, competitive matrices, latest analysis reads, and competitive strategy workflow transitions scoped to the caller's organization through the owning opportunity.

Changes in this slice:
- Require organization context for competitive intelligence actions and strategy workflow transitions.
- Add tenant predicates, with legacy null-opportunity fallback, to assigned opportunity and competitor-opportunity subqueries.
- Thread full user tenant context through competitive analysis, competitor-opportunity, win-theme workflow, theme injection, and theme consistency visibility helpers.
- Extend competitive analysis and strategy workflow tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- competitive.test.ts competitive-win-theme-workflow.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to win/loss tracking, partner/team suggestions, past performance, PWin, graphics, presentations, and remaining workflow support modules that still use unscoped or assignment-only checks.

### 2026-05-26 - Win Theme Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep win themes, theme occurrences, injection points, competitor profiles, theme analysis, and proposal-document scans scoped to the current organization through the owning opportunity.

Changes in this slice:
- Require organization context for win-theme actions.
- Add tenant predicates, with legacy null-opportunity fallback, to assigned opportunity and assigned theme subqueries.
- Thread full user tenant context through theme, occurrence, injection, competitor, proposal document, and analysis visibility helpers.
- Extend win-theme authorization tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- win-themes-auth.test.ts` from `frontend/` passed.
- `npm test -- competitive-win-theme-workflow.test.ts win-themes-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to competitive analysis and remaining workflow support modules that still use assignment-only checks.

### 2026-05-26 - Evidence Claim Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep evidence usage, claim analysis, claim remediation support, matrices, reports, and claims summaries scoped to the caller's organization through their opportunity boundary.

Changes in this slice:
- Add tenant predicates, with legacy null-opportunity fallback, to the shared evidence opportunity subquery.
- Thread full evidence context through document claims, section claims, direct claim lookup/update, evidence suggestions, coverage analysis, matrix lookup, reports, and claims summaries.
- Keep organization-owned evidence library predicates in place while aligning claim/matrix/usage opportunity gates to the same tenant boundary.
- Extend evidence scope tests to assert opportunity organization predicates as well as assignment predicates.

Verification:
- `npm test -- evidence.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` from `frontend/` passed, running 6 compliance/evidence/readiness test files and 77 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to win themes, competitive analysis, and remaining workflow support modules that still use assignment-only checks.

### 2026-05-26 - Requirements Opportunity Tenant Predicates

Status: implemented and verified.

Purpose: keep requirement CRUD, extraction, gap analysis, workflow acceptance, and projected writing-task gates tied to the current organization as well as the assigned opportunity.

Changes in this slice:
- Add tenant predicates, with legacy null-opportunity fallback, to the shared assigned-opportunity helpers used by requirement actions.
- Scope requirement creation, bulk creation, extraction, save-from-extraction, batch acceptance, projected-task lookup/update, and opportunity existence checks by organization.
- Preserve existing `rfp_requirements.organization_id` and `proposal_tasks.organization_id` row predicates while aligning their opportunity subqueries to the same tenant boundary.
- Extend requirements scope/workflow tests to assert opportunity organization predicates and mock auth utilities cleanly in isolated action tests.

Verification:
- `npm test -- requirements-scope.test.ts requirements-workflow.test.ts requirements-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to evidence, win themes, competitive analysis, and remaining workflow support modules that still use assignment-only checks.

### 2026-05-26 - Opportunity AI Score Tenant Predicates

Status: implemented and verified.

Purpose: keep AI fit, win-probability, risk, summary, and score-history flows scoped to the caller's organization instead of relying only on assigned opportunity checks.

Changes in this slice:
- Require full tenant context for opportunity AI actions.
- Add tenant predicates, with legacy null-row fallback, to opportunity reads, score-history/detail reads, score writes, and opportunity score updates.
- Persist `organization_id` on newly generated heuristic and LLM-backed AI score rows.
- Scope client relationship/history lookups by opportunity organization so win-probability factors cannot mix same-named customers across tenants.
- Extend opportunity AI scope and auth tests to assert organization predicates and inserted score ownership.

Verification:
- `npm test -- opportunity-ai-scope.test.ts opportunity-ai-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to requirements, evidence, win themes, competitive analysis, and remaining workflow support modules that still use assignment-only checks.

### 2026-05-26 - RFP Upload Opportunity Tenant Gate

Status: implemented and verified.

Purpose: ensure uploaded RFP documents can only be attached to opportunities in the caller's organization, not merely opportunities assigned to the caller.

Changes in this slice:
- Add the current organization to the RFP upload route's opportunity access check.
- Preserve legacy null-row fallback while deployed opportunity rows are being backfilled.

Verification:
- `npm test -- rfp-upload-route.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to AI scoring, requirements, evidence, and response-support modules.

### 2026-05-26 - Opportunity Document Action Tenant Predicates

Status: implemented and verified.

Purpose: keep source-document discovery, download, selection, deletion, and analysis action gates scoped to the current organization now that opportunity document rows carry tenant context.

Changes in this slice:
- Require organization context for opportunity document actions.
- Add tenant predicates, with legacy null-row fallback, to opportunity and opportunity-document access checks.
- Persist `organization_id` when creating a source opportunity document directly from an opportunity link.
- Scope source-document lookup and opportunity discovery metadata updates by organization.
- Extend opportunity document scope tests to assert organization predicates and inserted source-document ownership.

Verification:
- `npm test -- opportunity-documents-scope.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to RFP upload, AI scoring, requirements, and specialized response-support modules.

### 2026-05-26 - Opportunity Vote Tenant Predicates

Status: implemented and verified.

Purpose: use the new opportunity tenant root to keep go/no-go vote reads, writes, summaries, and auto-decision updates scoped to the current organization.

Changes in this slice:
- Require organization context for opportunity vote actors.
- Persist `organization_id` on newly cast opportunity votes.
- Add tenant predicates, with legacy null-row fallback, to vote lookup, summary, delete, bulk-summary, and automatic opportunity status update paths.
- Extend vote scope tests to assert both assigned-opportunity and organization predicates.

Verification:
- `npm test -- opportunity-votes-scope.test.ts opportunity-votes-auth.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.

Remaining after this slice:
- Continue applying tenant-aware opportunity predicates to other specialized response modules that still use assignment-only checks.

### 2026-05-26 - Opportunity Root Tenant Anchors

Status: implemented and verified.

Purpose: give discovery, opportunity CRUD, import audit records, votes, and source-document intake a tenant root so downstream RFP intake and response workflows no longer inherit tenant identity only from assignment checks.

Changes in this slice:
- Add nullable `organization_id` anchors and indexes for `opportunities`, `opportunity_imports`, `opportunity_votes`, and `opportunity_documents`, plus an organization index for existing AI score rows.
- Replace global opportunity source/fingerprint uniqueness with tenant-aware unique indexes so separate organizations can discover the same public notice independently.
- Backfill opportunity roots from assigned user workspaces, import records from importing user workspaces, and votes/documents from their opportunity tenant.
- Persist and enforce organization context in modern opportunity actions, legacy CRUD actions, import audit records, live discovery import, scheduled/API-key discovery, and source-document seeding.
- Require `DISCOVERY_IMPORT_ORGANIZATION_ID` for service-user/API-key discovery runs so scheduled imports are explicit about tenant ownership.

Verification:
- `npm test -- opportunities.test.ts opportunities-crud-scope.test.ts opportunities-crud-auth.test.ts discovery-opportunity-import.test.ts opportunity-documents-scope.test.ts rfp-document-service.test.ts document-discovery-agent.test.ts` from `frontend/` passed.
- `npm test -- opportunity-discovery-route.test.ts opportunity-discovery-presets-route.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue replacing assignment-only joins in specialized modules with tenant-aware opportunity predicates now that `opportunities.organization_id` exists.
- Remove legacy null-row fallback after deployed opportunity/import/document rows are fully backfilled.

### 2026-05-26 - Proposal Package Artifact Tenant Anchors

Status: implemented and verified.

Purpose: close the proposal-package and final-artifact tenant boundary so generated response package rows, document sections, and final artifact workflow transitions stay bound to the current organization rather than relying only on assigned-opportunity checks.

Changes in this slice:
- Add nullable `organization_id` anchors and indexes for `proposal_documents` and `document_sections`, with migration backfill from existing proposal rows and single-tenant installs.
- Persist organization IDs on new proposal documents, linked existing documents, seeded package sections, and manually created document sections.
- Require current organization context for proposal package and final artifact mutations, with legacy null-row fallback during migration.
- Scope proposal document, document section, bulk package, and final artifact visibility helpers by tenant while retaining assigned-opportunity predicates.
- Thread organization IDs through response package draft and final artifact workflow runtime transitions.

Verification:
- `npm test -- proposal-documents-scope.test.ts proposal-documents-auth.test.ts final-artifact-workflow.test.ts final-submission-checklist-workflow.test.ts submissions-scope.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 discovery-to-submission test files and 110 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing any remaining workflow/runtime row boundaries that can still rely on assignment-only checks or tenant-null migration fallbacks.

### 2026-05-26 - Pricing Row Tenant Anchors

Status: implemented and verified.

Purpose: close the pricing/cost tenant boundary so cost elements, pricing rollups, and cost-technical alignment records cannot move through proposal pricing workflows on assignment-only checks.

Changes in this slice:
- Add nullable `organization_id` anchors and indexes for `cost_elements`, `pricing_summaries`, and `cost_technical_tracking`, with migration backfill from existing cost elements and single-tenant installs.
- Persist organization IDs on new cost elements, duplicated cost elements, and pricing summary creation.
- Require tenant predicates, with legacy null-row fallback, in cost element, pricing summary, WBS, and cost-technical tracking visibility helpers.
- Scope labor-category usage checks and pricing workflow-domain compensation through the same pricing tenant boundary.
- Extend pricing and workflow-domain regression tests to assert tenant predicates are present.

Verification:
- `npm test -- pricing.test.ts workflow-domain.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 approval/production/correction test files and 42 tests.

Remaining after this slice:
- Continue closing any remaining assignment-only row boundaries outside pricing, especially generated artifact/package records that participate in submission readiness.

### 2026-05-26 - Capture Pipeline Gate Tenant Anchors

Status: implemented and verified.

Purpose: close a tenant-isolation gap in the capture execution path so pipeline rows, gate reviews, and gate workflow compensation stay bound to the current organization as responses move through bid/no-bid governance.

Changes in this slice:
- Add `organization_id` columns and indexes for `capture_pipeline` and `gate_reviews`, with a migration backfill for single-tenant installs and gate rows inheriting their pipeline tenant.
- Persist organization IDs when initializing capture pipelines and scheduling gate reviews.
- Thread current organization scope through pipeline, activity, milestone, gate-review, analytics, forecast, at-risk, and summary reads/writes that depend on `capture_pipeline`.
- Scope capture gate workflow runtime transitions and domain compensation by tenant while preserving assigned-opportunity checks.
- Add regression assertions for no-bid gate decisions and gate workflow compensation predicates.

Verification:
- `npm test -- gate-review-workflow.test.ts pipeline-scope.test.ts workflow-domain.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `git diff --check` from the repo root passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` from `frontend/` passed, running 5 test files and 42 approval/production/correction tests.

Remaining after this slice:
- Continue closing generated artifact/package row boundaries that participate in submission readiness.

### 2026-05-26 - UNGM Notice Detail Enrichment

Status: implemented and verified.

Purpose: improve UNGM opportunity quality by enriching listing rows with public notice detail descriptions, contact email, and procurement/document links.

Changes in this slice:
- Parse UNGM popup detail panels for description text, contact email, and `tblLinks` procurement URLs.
- Fetch notice details for a bounded number of UNGM search results and merge detail summaries, submission method labels, and best public procurement link into the canonical opportunity data.
- Rank UNGM links so actual SharePoint negotiation-document URLs beat helper login links.
- Tighten the live UNGM proof so it fails if sampled notice details do not contribute public links.

Verification:
- `npm test -- ungm-parser.test.ts ungm-client.test.ts discovery-opportunity-import.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run live-ungm-source --include-live-safe` from `frontend/` passed, returning 10 mapped opportunities, 5 detail-enriched sampled notices, and SharePoint negotiation-document links for the sampled UNGM notices.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed, running 13 test files and 110 tests across discovery/import through submission gates.

Remaining after this slice:
- Live persisted import-to-parse proof still depends on target database connectivity; current DB connection attempts return connection refused.

### 2026-05-26 - Discovery Defaults Include Live UNGM

Status: implemented and verified.

Purpose: put the newly live-proven UNGM source into the default operator discovery surface so it is used without manual URL entry.

Changes in this slice:
- Add `https://www.ungm.org/Public/Notice` to the live discovery dialog's default configured source URLs.

Verification:
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Continue toward a live import-to-parse proof once the target database is reachable from this environment.

### 2026-05-26 - UNGM Public Notice Source Discovery

Status: implemented and verified.

Purpose: make UNGM a first-class live configured source using its public notice search endpoint instead of depending on rendered-page scraping.

Changes in this slice:
- Add a UNGM public notice client for `https://www.ungm.org/Public/Notice/Search`.
- Parse UNGM row fragments into canonical opportunity data with notice ID, reference, organization, country, notice type, deadline, published date, and portal URL.
- Prefer the UNGM public endpoint before Firecrawl for `ungm.org` configured source URLs, while retaining Firecrawl fallback if the endpoint fails.
- Preserve UNGM source metadata through import so downstream deduplication and audit records use `ungm` identifiers.
- Add a live-safe `live-ungm-source` platform proof scenario and evidence artifact.

Verification:
- `npm test -- ungm-parser.test.ts ungm-client.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npx tsx scripts/prove-live-ungm-source.ts` from `frontend/` passed, returning 10 mapped opportunities from 1,658 active UNGM notices and fetching the first live notice portal page with HTTP 200.
- `npm run platform:proof -- --run live-ungm-source --include-live-safe` from `frontend/` passed with the same live UNGM acquisition and portal-fetch proof.
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed after the UNGM import-path change, running 13 test files and 110 tests across discovery/import through submission gates.

Remaining after this slice:
- Wire this live UNGM acquisition into the next import-to-parse proof once database connectivity to the target environment is available.

### 2026-05-26 - Current Discovery-To-Submission Proof Refresh

Status: verified.

Purpose: re-run the broad non-live platform proof after the live-source and document-intake changes so current evidence covers the discovery-to-response path, not just individual slices.

Verification:
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed.
- The proof ran 13 test files and 109 tests covering discovery route/import, document discovery, source document download, RFP parse workflow, requirements, proposal documents, final artifact routes/workflow, final submission checklist, submission workflow, and submission scope.

Remaining after this slice:
- Add a live-safe proof that runs configured-source discovery with bounded source-document download against current live services and persists auditable import/download evidence.

### 2026-05-26 - Discovery Presets Preserve Document Intake

Status: implemented and verified.

Purpose: keep live configured-source discovery moving into source-document intake when operators save or schedule reusable discovery presets.

Changes in this slice:
- Persist `downloadDiscoveredDocuments` and bounded `downloadLimit` in discovery presets.
- Default the live discovery dialog to download seeded source documents with the existing bounded download limit.

Verification:
- `npm run test -- discovery-presets.test.ts discovery-opportunity-import.test.ts opportunity-discovery-route.test.ts opportunity-discovery-presets-route.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Continue toward live import-to-parse proof.

### 2026-05-26 - Live-Proven Discovery Source Defaults

Status: implemented and verified.

Purpose: make the default live discovery dialog use sources that have current proof, rather than relying only on degraded metasearch engine results.

Changes in this slice:
- Preload the live discovery dialog with `https://tenders.go.ke/tenders` and `https://procurement-notices.undp.org` as configured source URLs.
- Keep operators able to edit or replace the source list before running or saving a preset.

Verification:
- `npm run test -- discovery-presets.test.ts discovery-opportunity-import.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Continue toward a full configured-source import plus document intake proof.

### 2026-05-26 - Kenya PPIP Document Download TLS Handling

Status: implemented and verified.

Purpose: let source-document intake fetch Kenya PPIP PDFs after PPIP opportunities are discovered, without weakening TLS validation for generic external downloads.

Changes in this slice:
- Add an explicit invalid-TLS host allowlist option to the SSRF-safe public URL fetch helper.
- Pass that exception only for `tenders.go.ke` source document downloads.
- Extend the live Kenya PPIP proof to fetch a byte range from a real PPIP PDF document URL.

Verification:
- `npm run test -- public-url.test.ts rfp-document-service.test.ts prove-live-kenya-ppip-source.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run live-kenya-ppip-source --include-live-safe` from `frontend/` passed, returning 928 active tenders and fetching 1,024 bytes from a live PPIP PDF with HTTP 206 and `application/pdf`.

Remaining after this slice:
- Prove the full configured-source import path with bounded document download, parse queueing, and response readiness against a realistic live opportunity.

### 2026-05-26 - Kenya PPIP API Source Discovery

Status: implemented and verified.

Purpose: make Kenya PPIP a live configured source even though its public SPA shell and scraper/browser paths are sparse or unreliable.

Changes in this slice:
- Add a Kenya PPIP public JSON API client for `tenders.go.ke` configured-source discovery.
- Map PPIP API tenders into canonical opportunity data with tender reference, procuring entity, category, deadline, published date, portal URL, and source document URL.
- Prefer the PPIP API path before Firecrawl for `tenders.go.ke` source URLs, while retaining Firecrawl fallback if the API fails.
- Preserve PPIP source metadata through import so downstream deduplication and source-document seeding use `kenya_ppip` identifiers.
- Add a live-safe `live-kenya-ppip-source` platform proof scenario and evidence artifact.

Verification:
- `npm run test -- kenya-ppip-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run live-kenya-ppip-source --include-live-safe` from `frontend/` passed, returning 928 active tenders from `https://tenders.go.ke/api/active-tenders?perpage=10&page=1` and 10 mapped sample opportunities with source document URLs.

Remaining after this slice:
- Continue toward realistic opportunity-to-winning-response proof after live Kenya acquisition is durable.

### 2026-05-26 - Kenya PPIP Parser Readiness

Status: implemented and verified.

Purpose: prepare configured-source discovery for Kenya PPIP table content so that high-value Kenya public procurement listings can use source-specific extraction instead of the generic parser when the portal content is available.

Changes in this slice:
- Add a frontend Kenya PPIP parser for `tenders.go.ke` tender table rows.
- Parse tender number, description, procuring entity, procurement method/category, close date, publish date, and action links from HTML tables.
- Parse equivalent markdown table rows when scraper output is table-like markdown.
- Select source-specific parsers for configured source URLs, currently routing `tenders.go.ke` to `kenya_ppip` and `dgmarket.com` to `dgmarket`.
- Include HTML in configured-source Firecrawl scrape requests so source-specific parsers can inspect table markup.

Verification:
- `npm run test -- kenya-ppip-parser.test.ts discovery-opportunity-import.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Live `https://tenders.go.ke` access still returns sparse or failed content through the current Firecrawl/browser services, so the parser is ready but not yet live-proven. The next step is a portal-specific browser adapter, alternate endpoint, or Cloak-style browser path for Kenya PPIP content acquisition.

### 2026-05-26 - Live Source Discovery Proof Scenario

Status: implemented and verified.

Purpose: make configured-source opportunity discovery part of the durable platform proof manifest instead of relying on ad hoc live smoke commands.

Changes in this slice:
- Add `prove-live-source-discovery.ts`, which scrapes a configured procurement source with Firecrawl and verifies the generic parser returns normalized opportunity candidates.
- Add the `live-source-discovery` live-safe platform proof scenario.
- Record live configured-source evidence in `.omx/state/platform-live-source-discovery-evidence.md`.

Verification:
- `npm run test -- platform-proof-scenarios.test.ts generic-parser.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run platform:proof -- --run live-source-discovery --include-live-safe` from `frontend/` passed, returning 202,015 markdown characters, 593 links, and 375 normalized opportunities from `https://procurement-notices.undp.org`.

Remaining after this slice:
- Extend live source proof coverage to additional high-value sources after Kenya PPIP and UNGM have dedicated parser/browser handling.

### 2026-05-26 - Generic Parser Source Title Normalization

Status: implemented and verified.

Purpose: improve the quality of source-scraped opportunity records from table-heavy procurement pages so they are usable for downstream qualification and response workflows.

Changes in this slice:
- Normalize escaped field-packed tender link text before generic parser extraction.
- Extract `Title`, `Ref No`, `UNDP Office/Country`, `Process`, and `Deadline` fields from inline procurement table rows.
- Store cleaner opportunity titles, notice IDs, organization, country/region, and process summaries for field-packed links.
- Add parser regression coverage for UNDP-style procurement notice links.

Verification:
- `npm run test -- generic-parser.test.ts discovery-opportunity-import.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- Live Firecrawl/parser smoke for `https://procurement-notices.undp.org` returned 375 parsed opportunities, with the first opportunity normalized to title `SAFE ROOM REINFORCEMENT & FIRE ALARM SYSTEM INSTALLATION FOR PLATEAU OFFICE`, notice ID `UNDP-NGA-01432`, organization `UNDP-NGA`, and country `NIGERIA`.

Remaining after this slice:
- Add dedicated parsers for other high-value portals whose rendered output does not fit the generic parser, especially Kenya PPIP and UNGM.

### 2026-05-26 - Configured Source Discovery

Status: implemented and verified.

Purpose: make live discovery less dependent on generic metasearch by allowing configured procurement source URLs to be scraped with Firecrawl and parsed directly into opportunity candidates.

Changes in this slice:
- Add `sourceUrls` and `sourceScrapeLimit` to live discovery input.
- Skip default metasearch queries when a run is source-only, so operators can run direct source discovery without spending SearXNG calls.
- Scrape configured sources with Firecrawl and parse tender-like records with the existing generic tender parser.
- Persist source-scraped opportunities with source-specific metadata, source tags, and normal dedupe/import handling.
- Accept source URLs through the discovery API route, saved discovery presets, and the live discovery dialog.

Verification:
- `npm run test -- discovery-opportunity-import.test.ts discovery-presets.test.ts opportunity-discovery-route.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- Live Firecrawl/parser smoke for `https://procurement-notices.undp.org` returned 202,007 markdown characters, 593 links, and 370 tender-like parsed opportunities.

Remaining after this slice:
- `https://tenders.go.ke` currently returns sparse Firecrawl content and `https://www.ungm.org/Public/Notice` did not produce generic-parser candidates, so source-specific parsers or browser/site adapters are still needed for those portals.
- Source-scraped titles from table-heavy pages can be noisy; improve source-specific normalization before treating every generic-parser result as evaluator-ready opportunity data.

### 2026-05-26 - Discovery Engine Targeting

Status: implemented and verified.

Purpose: let operators route live discovery searches through explicit SearXNG engines when the default engine mix is degraded by CAPTCHA, access-denied, or rate-limit failures.

Changes in this slice:
- Add `engines` to frontend SearXNG search options and discovery import input.
- Pass selected engines from discovery imports into SearXNG requests.
- Accept engine lists through the discovery run API route.
- Persist engine selections in reusable discovery presets.
- Add an Engines control to the live discovery dialog.

Verification:
- `npm run test -- discovery-opportunity-import.test.ts searxng-client-config.test.ts discovery-presets.test.ts opportunity-discovery-route.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- Engine targeting gives operators a mitigation lever, but it does not repair blocked upstream engines or guarantee result quality from any single available engine.

### 2026-05-26 - SearXNG Engine Degradation Telemetry

Status: implemented and verified.

Purpose: make live discovery runs report SearXNG engine degradation such as CAPTCHA, access-denied, and rate-limit responses, even when the search request itself succeeds or returns zero opportunity results.

Changes in this slice:
- Model SearXNG `unresponsive_engines` responses in the frontend search client.
- Convert unresponsive engine details into `searxng_engine_degraded` discovery warnings.
- Persist those warnings into discovery import audit config and return them in the discovery result.
- Add regression coverage proving degraded engines are surfaced without creating opportunity rows.

Verification:
- `npm run test -- discovery-opportunity-import.test.ts searxng-client-config.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.

Remaining after this slice:
- This makes degradation visible but does not fix the underlying SearXNG engine blocks. Engine health and opportunity-query quality still need remediation before live discovery can be considered production-reliable.

### 2026-05-26 - Browser Fallback Compatibility Consolidation

Status: implemented and verified.

Purpose: prevent scraper runtime and LLM fallback paths from breaking against the deployed browser service while preserving cancellation and status metadata for long-running scrape jobs.

Changes in this slice:
- Extend the shared browser scraper client with caller abort-signal support and normalized status-code metadata.
- Move the scraper fetcher stealth fallback through the shared browser scraper client instead of a direct `/v1/scrape` call.
- Move the LLM extractor stealth fallback through the shared browser scraper client.
- Add focused browser scraper client coverage for legacy `/v1/scrape` and deployed `/scrape` response contracts.
- Add scraper fetcher coverage proving stealth fallback uses the shared browser scraper client.

Verification:
- `npm run test -- browser-scraper-client.test.ts fetcher-public-url.test.ts` from `frontend/` passed.
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run test -- discovery-opportunity-import.test.ts document-discovery-agent.test.ts browser-scraper-client.test.ts fetcher-public-url.test.ts` from `frontend/` passed.
- `npm run platform:proof -- --run live-discovery-services --include-live-safe` from `frontend/` passed with SearXNG returning one basic `tender` result, Firecrawl returning 180 markdown characters for `https://example.com`, and browser fallback returning 528 content characters for `https://example.com`.

Remaining after this slice:
- The browser fallback endpoint compatibility issue is now centralized, but SearXNG engine health and opportunity-query quality are still unresolved.

### 2026-05-26 - Live Discovery Services Proof

Status: implemented and verified.

Purpose: prove that the deployed discovery connectivity tier can perform live search, standard scraping, and browser-backed scraping, while keeping application discovery paths compatible with the live browser service.

Changes in this slice:
- Add a shared browser scraper client that supports both the app's existing `/v1/scrape` contract and the deployed browser service's `/scrape` contract.
- Route opportunity discovery imports and primary-portal document discovery through the shared browser scraper client instead of direct `/v1/scrape` calls.
- Add a `live-discovery-services` live-safe platform proof scenario for SearXNG, Firecrawl, and browser fallback connectivity.
- Record live discovery evidence in `.omx/state/platform-live-discovery-evidence.md`.

Verification:
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run test -- discovery-opportunity-import.test.ts document-discovery-agent.test.ts platform-proof-scenarios.test.ts` from `frontend/` passed.
- `npm run platform:proof -- --run live-discovery-services --include-live-safe` from `frontend/` passed with SearXNG returning one basic `tender` result, Firecrawl returning 180 markdown characters for `https://example.com`, and browser fallback returning 528 content characters for `https://example.com`.
- `git diff --check` passed.

Remaining after this slice:
- This proof confirms discovery-service availability and scrape connectivity, not high-quality opportunity retrieval. Useful SearXNG opportunity queries remain degraded because major engines are currently returning CAPTCHA, access-denied, rate-limit, or empty-result responses.
- Continue remediating SearXNG engine health and opportunity-query quality before treating live discovery as reliable enough for production opportunity finding.

### 2026-05-26 - Wave 9 Discovery-To-Submission Proof

Status: verified.

Purpose: prove the current core path from opportunity discovery through submission readiness has executable regression coverage after the latest intake, requirement, response, and build-readiness slices.

Verification:
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` from `frontend/` passed.
- The proof ran 13 test files and 105 tests covering opportunity discovery routes/import, document discovery, document download, RFP document service, RFP parse workflow, requirement workflow, proposal document drafting, final artifact routes/workflow, final submission checklist, submission workflow, and submission scoping.

Remaining after this slice:
- Continue expanding from core regression proof into live-service proof with SearXNG/Firecrawl, deployed scraping, and end-to-end generated response evidence against realistic opportunities.

### 2026-05-26 - Workflow Templates Build Readiness

Status: implemented and verified.

Purpose: keep production builds independent of live workflow-template database connectivity while preserving live workflow-template data at request time.

Changes in this slice:
- Mark `/workflows/templates` as a dynamic route because it reads workflow-template rows from the database.
- Prevent Next.js static prerender from querying `workflow_templates` during `next build`.

Verification:
- `npm run build` from `frontend/` passed.
- Build output marks `/workflows/templates` as dynamic.

Remaining after this slice:
- Continue expanding proof coverage for the full opportunity discovery, RFP intake, response drafting, final package, and submission path.

### 2026-05-26 - Frontend TypeScript Gate Restored

Status: implemented and verified.

Purpose: restore the frontend TypeScript gate so platform reliability work is not hidden behind stale test-fixture and context-type drift.

Changes in this slice:
- Preserve role information in pricing user context instead of narrowing it away after authentication.
- Narrow the RFP parse reject workflow through the authority-aware context path before checking reject authority.
- Update workflow test fixtures to match the current role-aware user-context contract.
- Align final artifact, RFP document service, and submission attachment fixtures with current storage, Buffer, and proposal document type contracts.

Verification:
- `npx tsc --noEmit --pretty false` from `frontend/` passed.
- `npm run test -- __tests__/actions/content-governance-workflow.test.ts __tests__/actions/document-authoring-workflow.test.ts __tests__/actions/final-artifact-workflow.test.ts __tests__/actions/pricing-approval-workflow.test.ts __tests__/actions/rfp-parse-workflow.test.ts __tests__/services/rfp-document-service.test.ts __tests__/submissions/attachment-receipts.test.ts` from `frontend/` passed.
- `git diff --check` passed.

Remaining after this slice:
- Keep the TypeScript gate clean while continuing to harden opportunity discovery, intake, response generation, final packaging, and submission readiness.

### 2026-05-26 - Response Package Follow-Up Tasks

Status: implemented and verified.

Purpose: make response-package drafting produce explicit operational follow-ups for package review and final rendering instead of leaving the next governance steps implicit.

Changes in this slice:
- Create a response-package review workflow task after standard response package drafting records its runtime transition.
- Create a final-package rendering workflow task tied to the drafted proposal document IDs, document IDs, compliance matrix, and latest version number.
- Keep response-package drafting non-blocking when workflow task persistence is unavailable, matching the existing telemetry-failure behavior.
- Extend response-package drafting coverage to prove both follow-up tasks are emitted with package evidence.

Verification:
- `npm run test -- __tests__/actions/proposal-documents-scope.test.ts` from `frontend/` passed.
- `git diff --check` passed.
- `npx tsc --noEmit --pretty false` remains blocked by pre-existing unrelated diagnostics in workflow/pricing/RFP/parser test fixtures and typing. No diagnostics pointed at the response-package task files changed in this slice.

Testing scope note:
- Full TypeScript checking is currently blocked by unrelated repository diagnostics listed above; focused proposal document workflow coverage verifies the added task emission.

Remaining after this slice:
- Continue hardening final package rendering/signoff evidence and submission package readiness checks.

### 2026-05-26 - Parsed Requirement Batch Acceptance

Status: implemented and verified.

Purpose: reduce the manual gap between parser-completed requirements and response-package drafting by giving operators a bounded batch path to accept parsed requirements into the response plan.

Changes in this slice:
- Add `acceptParsedRequirementsForResponsePlan`, which promotes review-state parsed requirements through the existing requirement acceptance workflow in a bounded batch.
- Preserve the existing acceptance gate, writing-task projection, workflow history, and evidence links for every accepted requirement.
- Default batch owner and due date from the visible opportunity, falling back to the reviewer and a 7-day due date when needed.
- Add an "Accept Parsed Requirements" control to the opportunity requirements page before response-package drafting.
- Extend requirements workflow coverage to prove batch acceptance uses the normal gated transition and parser evidence links.

Verification:
- `npm run test -- __tests__/actions/requirements-workflow.test.ts` from `frontend/` passed.
- `git diff --check` passed.
- `npx tsc --noEmit --pretty false` was attempted from `frontend/` and failed on pre-existing unrelated diagnostics in content/document authoring workflow tests, final artifact test config, pricing user-context typing, RFP parser tenant-context typing, RFP document service Buffer typing, and an attachment receipt fixture. No diagnostics pointed at the requirements batch acceptance files changed in this slice.

Testing scope note:
- Battery constraints are no longer active. Full TypeScript checking is currently blocked by unrelated repository diagnostics listed above; focused requirements workflow tests cover the changed server-action behavior.

Remaining after this slice:
- Continue reducing the final handoff from accepted requirements into response-package drafting, governance checks, and submission-ready package evidence.

### 2026-05-26 - Bounded Discovery Source Document Download

Status: implemented and verified.

Purpose: reduce the manual gap between live opportunity discovery and RFP parser intake by allowing discovery runs to download newly seeded source documents under an explicit small limit.

Changes in this slice:
- Add `downloadDiscoveredDocuments` and `downloadLimit` to the live discovery import contract and API route.
- Download only newly seeded source-document rows, bounded by the configured limit, so successful downloads continue into the existing storage and parser queue path.
- Return source-document download attempted/succeeded/failed counts from discovery import results.
- Surface bounded download controls and intake download counts in the live discovery dialog.
- Record download failures as discovery warnings without marking the opportunity import failed.
- Update the opportunity discovery runbook with the bounded download option and operating guidance.

Verification:
- `npm run test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/api/opportunity-discovery-route.test.ts` from `frontend/` passed.
- `git diff --check` passed.
- `npx tsc --noEmit` was attempted from `frontend/` and failed on pre-existing unrelated diagnostics in content/document authoring workflow tests, final artifact test config, pricing user-context typing, RFP parser tenant-context typing, RFP document service Buffer typing, and an attachment receipt fixture. No diagnostics pointed at the discovery files changed in this slice.

Testing scope note:
- Battery constraints are no longer active. Full TypeScript checking is currently blocked by unrelated repository diagnostics listed above; focused discovery action/API tests cover the changed behavior in this slice.

Remaining after this slice:
- Continue connecting successful parser output into requirements acceptance and response-package generation with fewer manual handoffs.

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

### 2026-05-27 - World Bank Detail Enrichment

Status: implemented and verified.

Purpose: make World Bank discovery candidates immediately useful for qualification and response drafting by enriching listing rows with procurement-detail metadata and solicitation text.

Changes in this slice:
- Add World Bank procurement detail parsing for both markdown detail pages and the public `search.worldbank.org/api/procnotices` JSON endpoint.
- Enrich configured World Bank imports with organization, deadline, publication date, procurement method, borrower reference, contact email, project metadata, and solicitation text.
- Update the live World Bank proof so it verifies normalized listing rows plus a detail probe backed by the World Bank API.

Verification:
- `npm test -- world-bank-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts default-discovery-sources.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --include-live-safe --run live-world-bank-source` passed with run `live_world_bank_source_20260527T005255Z`, returning 18 live opportunities and a detail probe for `OP00300362`.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` passed 50 non-live bridge tests.

Testing scope note:
- Battery constraints were lifted for this slice. Verification included focused parser/import/proof-manifest tests, TypeScript checking, and the live-safe World Bank proof.
- Full frontend suite and production build were not rerun for this source-specific backend enrichment slice.

Remaining after this slice:
- Continue adding live sources and detail/document enrichment for sources that reliably expose procurement packages.

### 2026-05-27 - COMESA Detail Package Enrichment

Status: implemented and verified.

Purpose: turn COMESA archive rows into response-ready opportunities by following detail pages to the actual tender package attachments.

Changes in this slice:
- Add COMESA detail-page parsing that ranks document attachments and filters unrelated site PDFs such as privacy policy links.
- Enrich configured COMESA imports with primary tender package URLs, source document links, submission labels, and metadata for discovered package attachments.
- Replace the generic COMESA live proof with a source-specific proof that verifies both archive parsing and a detail-page package document.

Verification:
- `npm test -- comesa-parser.test.ts discovery-opportunity-import.test.ts platform-proof-scenarios.test.ts default-discovery-sources.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --include-live-safe --run live-comesa-source` passed with run `live_comesa_source_20260527T010114Z`, returning 2 live opportunities and `RFP-Medical-Scheme-2026-Final.docx`.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` passed 50 non-live bridge tests.

Testing scope note:
- Verification included focused parser/import/proof-manifest tests, TypeScript checking, the live-safe COMESA proof, and the non-live bridge proof.
- Full frontend suite and production build were not rerun for this source-specific enrichment slice.

Remaining after this slice:
- Continue adding live source detail/document enrichment where source pages expose stable procurement packages.

### 2026-05-27 - Warning-Free Live Response Readiness

Status: implemented and verified.

Purpose: make live response-package drafts fully source-grounded even when an EOI exposes mostly administrative and submission requirements rather than neatly sectioned management or past-performance clauses.

Changes in this slice:
- Adapt mandatory source requirement signals into section-specific response plans for document types that have no direct source clause.
- Remove generic "no source requirement assigned" filler from management-plan and past-performance drafts when the source document still has mandatory response signals.
- Add regression coverage for EOI-style sources that lack explicit management/past-performance requirements.

Verification:
- `npm test -- live-response-package.test.ts platform-proof-scenarios.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --include-live-safe --run live-opportunity-response-readiness` passed with run `live_response_readiness_20260527T011242Z`; readiness was `ready_for_review` with zero warnings and 3,657 draft words.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed.

Testing scope note:
- Verification included focused response-package tests, TypeScript checking, the live-safe UNGM response-readiness proof, and the non-live response-readiness scenario.
- Full frontend suite and production build were not rerun for this deterministic response-package grounding change.

Remaining after this slice:
- Continue replacing narrow proofs with broader source coverage and keep pursuing a persisted DB-backed import-to-response proof when database connectivity is available.

### 2026-05-27 - Discovery-to-Submission Core Proof Sweep

Status: verified.

Purpose: re-check the non-live core path after live source enrichment and response-package grounding changes.

Verification:
- `npm run platform:proof -- --run wave9-discovery-to-submission-core` passed.
- The proof ran 13 focused test files and 120 tests covering opportunity discovery, configured import, document discovery, RFP document intake, parse workflow, requirements workflow, proposal document scope, final artifact workflow, final artifact route, final submission checklist, submission workflow, and submission scoping.

Testing scope note:
- This was a broader non-live proof sweep, not a production build or full frontend suite.
- At the time of this sweep, the live persisted DB import-to-response proof still needed a live schema repair and proof run.

Remaining after this slice:
- Continue closing live/persisted gaps that are not covered by mocked non-live proof scenarios.

### 2026-05-27 - Live Persisted Import-to-Response Proof

Status: implemented and verified.

Purpose: prove the platform can take a live discovered opportunity all the way into persisted response-workspace records, then clean the proof rows back out of PostgreSQL.

Changes in this slice:
- Add a live-safe platform proof scenario for persisted import-to-response coverage.
- Add an idempotent live tenant repair migration for opportunity/proposal persistence tables whose live schema predated the app's tenant-scoped writes.
- Add a schema preflight to the live proof so future drift fails before source fetching or Docling extraction.

Verification:
- Applied `frontend/drizzle/0032_live_response_persistence_tenant_repair.sql` to the live database; it added/backfilled opportunity, opportunity document, proposal document, document section, vote/import, and AI-score tenant columns and rebuilt opportunity uniqueness indexes as tenant-scoped indexes.
- Live schema check confirmed all 2,602 existing opportunities had `organization_id`, and the expected tenant indexes were present.
- `npm test -- platform-proof-scenarios.test.ts live-response-package.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `set -a; source .env.local; set +a; npm run platform:proof -- --include-live-safe --run live-persisted-import-response` passed with run `live_persisted_import_response_20260527T013517Z`.
- The live proof used UNGM notice `300700`, fetched `eoi24414.pdf`, extracted 3,070 characters through Docling, persisted one opportunity row, one source-document row, one RFP document row, eight requirement rows, six proposal-document rows, and six response-document rows.
- Cleanup verification reported zero remaining proof rows across all persisted tables.

Testing scope note:
- This was a live-safe disposable-row proof, not a full production migration audit or full frontend suite.
- The platform proof required explicitly sourcing `frontend/.env.local` because an ambient shell `DATABASE_URL` pointed at an unreachable stale endpoint.

Remaining after this slice:
- Continue broadening live source coverage and add operational migration tracking for manual live schema repairs.

### 2026-05-27 - Live Migration Ledger Recording

Status: implemented and verified.

Purpose: prevent applied live schema repairs from remaining invisible to the Drizzle migration ledger.

Changes in this slice:
- Add `npm run db:record-migration -- <migration.sql>` to record an already-applied SQL migration in `drizzle.__drizzle_migrations`.
- Compute the same SHA-256 hash Drizzle uses for migration files and use the migration journal timestamp when available, falling back to the SQL file mtime for manual repair files.
- Make the recorder idempotent with a `--dry-run` path that reports whether a row would be inserted or is already recorded.

Verification:
- `npx tsc --noEmit --pretty false` passed.
- `set -a; source .env.local; set +a; npm run db:record-migration -- 0032_live_response_persistence_tenant_repair.sql --dry-run` reported `would-insert` before recording.
- `set -a; source .env.local; set +a; npm run db:record-migration -- 0032_live_response_persistence_tenant_repair.sql` inserted the live ledger row.
- `psql` confirmed `drizzle.__drizzle_migrations` now contains hash `28b827ba64784d8af4bdb674c11bcb7073a269eb18bf096200e628028bc4b5f3` for created_at `1779845173133`.
- A follow-up dry run reported `already-recorded`.

Testing scope note:
- This records the already-applied repair in the migration ledger; it does not retrofit the older missing Drizzle journal entries.

Remaining after this slice:
- Reconcile older manual migrations with `frontend/drizzle/meta/_journal.json` before relying on `drizzle-kit migrate` for fresh database rebuilds.

### 2026-05-27 - Drizzle Journal Reconciliation

Status: implemented and verified.

Purpose: make migration metadata match the SQL files in the repo so missing journal entries cannot silently hide schema work.

Changes in this slice:
- Add `0010` through `0032` to `frontend/drizzle/meta/_journal.json`, preserving the live-recorded `0032` created_at value.
- Add a regression test that requires every `frontend/drizzle/*.sql` file to appear in the journal with sequential indexes and increasing timestamps.
- Move `CREATE EXTENSION IF NOT EXISTS pg_trgm` ahead of the trigram indexes in the full-text-search migration so fresh replay has the extension before index creation.

Verification:
- `npm test -- drizzle-migration-journal.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- Drizzle's `readMigrationFiles({ migrationsFolder: 'frontend/drizzle' })` returned 33 migrations and resolved the final `0032` hash to `28b827ba64784d8af4bdb674c11bcb7073a269eb18bf096200e628028bc4b5f3`.
- `set -a; source .env.local; set +a; npm run db:record-migration -- 0032_live_response_persistence_tenant_repair.sql --dry-run` now reports source `journal` and status `already-recorded`.

Testing scope note:
- This validates metadata coverage and Drizzle migration-file parsing; it is not a full empty-database replay.

Remaining after this slice:
- Add a disposable empty-database migration replay once a cheap isolated PostgreSQL target is available.

### 2026-05-26 - Workflow Runtime Tenant Anchor

Status: implemented and verified.

Purpose: prevent cross-tenant workflow transition and read-model bleed by giving durable workflow instances an organization anchor and threading that anchor through domain workflow transitions.

Changes in this slice:
- Add nullable `organization_id` support to `workflow_instances`, with migration backfill for single-tenant deployments and an organization index.
- Persist `organizationId` on workflow runtime transitions when tenant-aware domain workflows start or advance.
- Scope domain workflow instance lookup and reversal by organization context while preserving nullable global/control-plane workflow records.
- Carry organization context into workflow viewer scopes so dashboard and portal reads are bounded to the caller organization plus global workflow records.
- Constrain scraper-run domain compensation with workflow metadata `sourceId` when available, avoiding run-ID-only projection.
- Harden workflow-domain tests by resetting one-shot DB mocks between tests so SQL scoping assertions cannot leak across cases.

Verification:
- `npm test -- workflow-domain.test.ts workflow-runtime.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- `npm run platform:proof -- --run wave0-workflow-runtime-core` passed.
- `npm run platform:proof -- --run wave7-import-operations-governance` passed.

Testing scope note:
- Battery constraints are lifted. This slice ran focused boundary tests, TypeScript checking, diff whitespace checks, and the relevant workflow-runtime plus import/operations platform proof waves.

Remaining after this slice:
- Continue auditing opportunity-linked workflow domain tables that still scope through opportunity assignment because their tables do not yet carry organization IDs.
- Live persisted DB import-to-parse proof remains externally blocked by the refused database connection.

### 2026-05-26 - Submission Tenant Anchor

Status: implemented and verified.

Purpose: keep final submission dispatch, correction, outcome, and analytics records tenant-bound instead of relying only on assigned opportunity checks.

Changes in this slice:
- Add nullable `organization_id` support to `submissions`, with migration backfill for single-tenant deployments and an organization index.
- Persist the caller organization on new submission rows and production submission workflow instances.
- Scope submission reads, lists, status updates, outcome updates, win/loss analytics, recent submissions, correction workflows, and workflow-domain submission compensation by submission organization plus assigned opportunity.
- Carry organization context into final submission checklist workflow runtime records.
- Extend submission scope and workflow tests to assert tenant predicates and tenant persistence.

Verification:
- `npm test -- submissions-scope.test.ts submission-workflow.test.ts submission-correction-workflow.test.ts final-submission-checklist-workflow.test.ts workflow-domain.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed.

Testing scope note:
- Battery constraints are lifted. This slice ran focused submission coverage, TypeScript checking, diff whitespace checks, and both Wave 6 final-submission proof scenarios.

Remaining after this slice:
- Continue auditing proposal reviews, review comments, gate reviews, and cost/pricing records for first-class organization anchors.
- Live persisted DB import-to-parse proof remains externally blocked by the refused database connection.

### 2026-05-26 - Review Workflow Tenant Anchors

Status: implemented and verified.

Purpose: keep proposal review gates and review comment resolution workflows tenant-bound while preserving assigned-opportunity access checks.

Changes in this slice:
- Add nullable `organization_id` support to `proposal_reviews` and `review_comments`, with migration backfill from the single organization or the parent review.
- Scope review package transitions, reviewer/comment reads, review updates, and workflow-domain proposal review/comment compensation by organization plus assigned opportunity.
- Scope review comment workflow reads/updates by review/comment organization and carry organization context into review package/comment workflow runtime instances.
- Extend review package and review comment workflow tests to assert tenant predicates and workflow runtime organization propagation.

Verification:
- `npm test -- review-package-workflow.test.ts review-comment-workflow.test.ts workflow-domain.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- `npm run platform:proof -- --run wave4-planning-collaboration-tasks` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed.

Testing scope note:
- Battery constraints are lifted. This slice ran focused review workflow coverage, TypeScript checking, diff whitespace checks, and the relevant Wave 4/Wave 6 proof scenarios.

Remaining after this slice:
- Continue auditing general review management (`frontend/lib/actions/reviews.ts`), gate reviews, and cost/pricing records for first-class organization anchors.
- Live persisted DB import-to-parse proof remains externally blocked by the refused database connection.

### 2026-05-26 - General Review Management Tenant Scoping

Status: implemented and verified.

Purpose: close the row-level tenant gap in the broader review-management actions after anchoring the workflow-specific review paths.

Changes in this slice:
- Require organization context for direct review/comment creation and mutation paths in `frontend/lib/actions/reviews.ts`.
- Persist `organizationId` on newly created proposal reviews and review comments.
- Scope review creation numbering, review list/delete operations, all-review listing, comment add/update/delete/resolve/verify/list operations, and parent reply count changes by organization plus assigned opportunity.
- Extend the review action test harness with tenant context mocks and assertions for review/comment organization persistence and scoped review listing.

Verification:
- `npm test -- reviews.test.ts` passed.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed.

Testing scope note:
- The full general review action suite passed (110 tests). The proof wave covers adjacent review package, approval, pricing, final artifact, and submission correction workflows.

Remaining after this slice:
- Continue auditing gate reviews/capture pipeline and cost/pricing records for first-class organization anchors.
- Live persisted DB import-to-parse proof remains externally blocked by the refused database connection.

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

### 2026-05-27 - Past Performance Volume Export Artifacts

Status: implemented and verified.

Purpose: make past-performance volume export produce real downloadable evidence artifacts instead of a placeholder document-generation URL.

Changes in this slice:
- Generate PDF past-performance volumes as base64 `data:application/pdf` artifacts with opportunity, project, relevance, CPAR, accomplishment, result, and matched-requirement details.
- Generate DOCX past-performance volumes as base64 OpenXML artifacts using the existing `docx` dependency.
- Preserve the existing `volumeData` response so downstream templates and UI callers can continue reading structured export data.
- Add regression coverage that decodes both exported formats and checks file signatures instead of accepting an inert `/api/documents/generate` route.

Verification:
- `npm test -- past-performance-scope.test.ts` passed with 9 tests.
- `npm test -- past-performance-scope.test.ts platform-proof-scenarios.test.ts` passed with 15 tests.
- `npm run platform:proof -- --run wave8-strategic-capability-workflows` passed with 44 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing placeholder export URLs in adjacent response artifacts, especially compliance and review package exports.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Compliance Report Export Artifacts

Status: implemented and verified.

Purpose: make compliance report export produce real PDF/XLSX artifacts instead of returning a nonexistent document-generation URL.

Changes in this slice:
- Generate PDF compliance reports with matrix summary, coverage status, sectioned requirements, response references, and notes.
- Generate XLSX compliance reports as a minimal OpenXML workbook using the existing `jszip` dependency.
- Preserve the existing `reportData` response for downstream workflow and UI consumers.
- Add regression coverage that decodes both exported formats and verifies file signatures instead of accepting `/api/documents/generate`.

Verification:
- `npm test -- compliance-entry-workflow.test.ts` passed with 11 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 81 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing placeholder export URLs in review package and presentation handout exports where no backing artifact path exists.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Review Package Export Artifacts

Status: implemented and verified.

Purpose: make review package export produce real PDF/XLSX/DOCX artifacts instead of advertising an API export URL.

Changes in this slice:
- Generate PDF review reports with review metadata, score summary, executive summary, reviewers, key findings, and compliance gaps.
- Generate XLSX review reports as a minimal OpenXML workbook using the existing `jszip` dependency.
- Generate DOCX review reports using the existing `docx` dependency.
- Keep export tracking on `proposal_reviews` while replacing the inert `/api/reviews/{id}/export` URL with immediate data URL artifacts.
- Update export tests to decode all three formats and verify file signatures.

Verification:
- `npm test -- reviews.test.ts` passed with 111 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 163 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing remaining placeholder exports such as presentation handout and evidence export paths where no backing artifact exists.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Presentation Handout Export Artifact

Status: implemented and verified.

Purpose: make audience handout generation return a real PDF artifact instead of a placeholder `/api/presentations/handout` URL.

Changes in this slice:
- Generate handout PDFs directly from presentation title, agenda, visible slide summaries, and team details.
- Return a base64 `data:application/pdf` URL with the actual generated page count.
- Add regression coverage that decodes the handout and verifies the `%PDF-` signature.

Verification:
- `npm test -- presentations-export.test.ts` passed with 5 tests.
- `npm run platform:proof -- --run wave9-presentation-export-artifacts` passed with 10 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing remaining placeholder exports such as evidence and graphics export paths where no backing artifact exists.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence Library Export Artifacts

Status: implemented and verified.

Purpose: make evidence library export return real CSV/JSON artifacts instead of a placeholder `/api/evidence/export` URL.

Changes in this slice:
- Generate JSON evidence exports as base64 `data:application/json` artifacts.
- Generate CSV evidence exports as base64 `data:text/csv` artifacts with quoted field handling.
- Preserve the existing action response shape `{ url }` while replacing the inert API route.
- Add regression coverage that decodes both formats and verifies exported evidence content.

Verification:
- `npm test -- evidence.test.ts` passed with 51 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 83 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue replacing remaining placeholder exports such as graphics export paths where no backing artifact exists.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Graphics Export Artifacts

Status: implemented and verified.

Purpose: make proposal graphics export return real ZIP/PDF artifacts instead of a placeholder `/api/exports/graphics` path.

Changes in this slice:
- Generate ZIP graphics exports containing diagram/source files, captions, and `metadata.json`.
- Generate PDF graphics exports with figure titles, types, statuses, captions, and source snippets.
- Preserve export tracking through `graphic_feedback` while replacing the inert download path with data URL artifacts.
- Add graphics export signature coverage and wire the graphics tests into the Wave 6 platform proof manifest.

Verification:
- `npm test -- graphics-scope.test.ts graphics-auth.test.ts` passed with 11 tests.
- `npm test -- graphics-scope.test.ts graphics-auth.test.ts platform-proof-scenarios.test.ts` passed with 17 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 174 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue auditing remaining export/download paths for placeholders versus durable artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Formatted Document Export Artifacts

Status: implemented and verified.

Purpose: make formatted document export return real PDF/DOCX artifacts instead of a placeholder `/api/documents/export` URL.

Changes in this slice:
- Generate PDF formatted document exports from the scoped document title/content and applied format metadata.
- Generate DOCX formatted document exports using the existing `docx` dependency.
- Preserve the existing `{ url, filename }` response shape while replacing the inert route with data URL artifacts.
- Add regression coverage that decodes both formats and verifies file signatures.

Verification:
- `npm test -- formatting-scope.test.ts` passed with 7 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 176 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue auditing remaining export/download paths for placeholders versus durable artifacts.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Durable Certification Reminder Tracking

Status: implemented and verified.

Purpose: make personnel certification reminders create auditable reminder state instead of only counting eligible email addresses.

Changes in this slice:
- Scope certification reminder reads and writes to the caller's organization.
- Record reminder metadata on active certifications with expiration dates, including sent time, actor, recipient, channel, and reminder count.
- Skip personnel without email and certifications that are not active renewal candidates.
- Add focused regression coverage for reminder metadata persistence and organization scoping.
- Wire personnel reminder/auth tests into the Wave 4 planning and collaboration proof manifest.

Verification:
- `npm test -- personnel-reminders.test.ts personnel-auth.test.ts` passed with 3 tests.
- `npm test -- personnel-reminders.test.ts personnel-auth.test.ts platform-proof-scenarios.test.ts` passed with 9 tests.
- `npm run platform:proof -- --run wave4-planning-collaboration-tasks` passed with 33 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue auditing staffing workflows for unscoped reads and non-durable operational actions.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence Suggestion Scoring

Status: implemented and verified.

Purpose: make claim evidence suggestions rank proof by multiple proposal-relevant signals instead of keyword overlap alone.

Changes in this slice:
- Score candidate evidence against claim text using title, content, summary, tags, metrics, capability context, agency context, quantification, source verification, and strength score.
- Return evidence-specific reasons that expose matched claim terms, tags, metrics, verified source state, and quantified proof.
- Keep unrelated evidence out of suggestions even when it has high strength and source verification.
- Add focused regression coverage for ranking and unrelated-evidence rejection.

Verification:
- `npm test -- evidence.test.ts` passed with 53 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 85 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue improving section and criteria-level evidence suggestions so they use the same richer scoring signals.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Criteria-Aware Evidence Suggestions

Status: implemented and verified.

Purpose: make evaluation-criteria evidence suggestions use the actual scoped criterion text instead of returning generic high-strength approved evidence.

Changes in this slice:
- Read the requested evaluation criterion from `rfpRequirements` with organization and assigned-opportunity scoping.
- Build criteria scoring text from requirement number, title, body, source section, category, key terms, suggested approach, and tags.
- Reuse the multi-signal evidence scorer with criteria-specific reason text.
- Return no suggestions when the criterion is not visible and exclude unrelated high-strength evidence.

Verification:
- `npm test -- evidence.test.ts` passed with 55 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 87 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue improving section-level aggregation so duplicate evidence can preserve the strongest per-claim rationale.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Section Evidence Rationale Aggregation

Status: implemented and verified.

Purpose: make section-level evidence suggestions preserve the strongest rationale for duplicate evidence across all claims in the section.

Changes in this slice:
- Aggregate section suggestions by evidence ID with a map instead of first-seen duplicate suppression.
- Replace an existing duplicate suggestion when a later claim produces a higher relevance score.
- Preserve the top-10 relevance sort after duplicate consolidation.
- Add regression coverage where the stronger duplicate rationale arrives after a weaker one.

Verification:
- `npm test -- evidence.test.ts` passed with 56 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 88 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue auditing evidence and readiness workflows for generic placeholder logic that can produce plausible but unsupported recommendations.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Requirement-Aware Evidence Matrices

Status: implemented and verified.

Purpose: make generated evidence matrices reflect the opportunity's actual RFP requirements instead of hardcoded generic rows.

Changes in this slice:
- Build requirements and evaluation-criteria matrix rows from scoped `rfpRequirements` for the opportunity.
- Fall back to generic rows only when no extracted requirements are available.
- Match evidence cells by both evidence type and row-specific requirement text using the deterministic evidence scorer.
- Store cell notes with the top matching rationale and preserve assigned-opportunity scoping for requirement, usage, and matrix reads.

Verification:
- `npm test -- evidence.test.ts` passed with 57 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 89 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue auditing generated readiness artifacts for hardcoded demo defaults that should come from opportunity-specific data.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Context-Aware Claim Quantification

Status: implemented and verified.

Purpose: make claim quantification suggestions deterministic and evaluator-facing instead of emitting unresolved metric placeholder text.

Changes in this slice:
- Use optional context when detecting claim quantification patterns such as uptime, availability, savings, and efficiency.
- Generate quantified uptime and savings wording even when the original claim lacks replaceable adjectives.
- Replace the generic `(add specific metrics here)` fallback with dated performance record, delivery example, and outcome-data language.
- Add regression coverage for context-driven metric selection and placeholder-free fallback output.

Verification:
- `npm test -- evidence.test.ts` passed with 59 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 91 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue auditing generated response-support text for unresolved placeholders or generic evaluator-facing claims.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Compliance Cross-Reference Gap Detection

Status: implemented and verified.

Purpose: make compliance cross-reference diagnostics inspect scoped response document sections instead of returning empty placeholder findings.

Changes in this slice:
- Load response documents through scoped `proposalDocuments` joins before compliance cross-reference analysis.
- Populate missing-reference findings with ranked suggested response sections using the existing requirement-section scorer.
- Detect over-referenced requirements by counting requirement-number mentions across response sections.
- Add regression coverage for suggested missing-reference sections and duplicate reference detection.

Verification:
- `npm test -- compliance-cross-reference-suggestions.test.ts` passed with 4 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 93 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing compliance automation placeholders, especially automatic link creation for high-confidence requirement-section matches.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Deterministic Compliance Auto-Linking

Status: implemented and verified.

Purpose: make automatic requirement linking create scoped compliance references for high-confidence response-section matches instead of returning a zero-result stub.

Changes in this slice:
- Load the scoped response document and active compliance matrix for the document's opportunity.
- Score unlinked compliance entries against response sections with the existing requirement-section matcher.
- Persist high-confidence links to compliance entries and matching RFP requirements with response document, section, confidence, and rationale metadata.
- Return explicit unlinked reasons for already-linked, not-applicable, no-match, and below-threshold requirements.

Verification:
- `npm test -- compliance-cross-reference-suggestions.test.ts` passed with 6 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 95 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue auditing compliance automation for stale matrix statistics after bulk auto-link operations.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Auto-Link Matrix Statistics Refresh

Status: implemented and verified.

Purpose: keep compliance matrix summary counters current after automatic response-section linking.

Changes in this slice:
- Recalculate compliance matrix statistics after successful automatic links.
- Reuse the existing centralized matrix stats helper instead of duplicating counter logic.
- Extend auto-link regression coverage to prove partial counts and mandatory coverage are refreshed after linking.

Verification:
- `npm test -- compliance-cross-reference-suggestions.test.ts` passed with 6 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 95 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue auditing bidirectional compliance validation for orphaned response sections and unresolved cross-reference targets.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Bidirectional Compliance Section Analysis

Status: implemented and verified.

Purpose: make bidirectional compliance validation analyze actual response sections and unknown requirement references instead of only reporting requirements with missing response references.

Changes in this slice:
- Load scoped response documents for the compliance matrix opportunity.
- Populate missing-response requirements with ranked suggested response sections.
- Identify response sections that have no matching requirement in the matrix.
- Detect requirement-number references in response text that do not correspond to a matrix requirement.

Verification:
- `npm test -- compliance-cross-reference-suggestions.test.ts` passed with 7 tests.
- `npm run platform:proof -- --run wave3-compliance-evidence-readiness` passed with 96 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue replacing generic proposal/support narratives with opportunity-specific evidence and source references.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Live Response Source Citation Maps

Status: implemented and verified.

Purpose: make deterministic live response drafts carry explicit source citation maps instead of relying on a review reminder to replace generic claims later.

Changes in this slice:
- Add a `Source Citation Map` section to every generated live response draft.
- List source requirement IDs, source sections, evaluator criterion IDs, evaluation weights, and quoted source text per draft.
- Replace the generic “replace generic claims” review gate with a concrete requirement to verify the source citation map against the compliance matrix and response narrative.
- Add regression coverage proving generated drafts include source citation maps and no longer contain the generic-claim gate text.

Verification:
- `npm test -- live-response-package.test.ts` passed with 9 tests.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 9 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue strengthening generated live response drafts with deeper evidence citation and rendered artifact checks.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Source Citation Readiness Gate

Status: implemented and verified.

Purpose: prevent live response packages from being marked ready when generated drafts lose their source citation maps.

Changes in this slice:
- Add `sourceCitationCoverage` to live response readiness metrics.
- Require every draft to include a `Source Citation Map` containing its assigned source requirement and evaluator criterion IDs.
- Block readiness and emit warnings when any draft has incomplete citation mapping.
- Add regression coverage proving missing citation maps block readiness.

Verification:
- `npm test -- live-response-package.test.ts` passed with 10 tests.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 10 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue strengthening generated live response drafts with richer evidence citations and rendered artifact checks.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Evidence Citation Readiness Gate

Status: implemented and verified.

Purpose: make generated live response drafts carry auditable Datacraft evidence citations and fail readiness if those citations are missing.

Changes in this slice:
- Add a `Datacraft Evidence Citation Map` section to every generated live response draft.
- Tie each assigned snippet shortcut to its evidence name, category, and intended use in the response.
- Add `evidenceCitationCoverage` to response readiness metrics.
- Block readiness and emit warnings when any draft lacks complete evidence citation mapping.

Verification:
- `npm test -- live-response-package.test.ts` passed with 11 tests.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 11 tests.
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

Remaining after this slice:
- Continue strengthening generated live response packages with rendered artifact checks and persistence proof once database connectivity is restored.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Firecrawl Document Link Intake

Status: implemented and verified.

Purpose: keep Firecrawl-enriched opportunity discovery from losing tender attachment links before the RFP intake and response bridge can use them.

Changes in this slice:
- Request Firecrawl `links` for top SearXNG result enrichment.
- Preserve ranked discovered document links in opportunity discovery metadata.
- Seed bounded source-document rows for high-signal discovered tender attachments, while keeping low-signal documents out of selected intake.
- Retain the highest-ranked document link as the opportunity `documentUrl` for existing downstream RFP workflows.

Verification:
- `npm test -- __tests__/actions/discovery-opportunity-import.test.ts --run` passed with 23 tests.
- `npm test -- __tests__/actions/discovery-opportunity-import.test.ts __tests__/api/opportunity-discovery-route.test.ts __tests__/api/opportunity-discovery-presets-route.test.ts __tests__/services/default-discovery-sources.test.ts __tests__/services/rfp-document-service.test.ts --run` passed with 48 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` passed with 61 tests.

Remaining after this slice:
- Continue strengthening source-document intake with live persisted proof once database connectivity is restored.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Response Draft Artifact Integrity

Status: implemented and verified.

Purpose: ensure generated live response packages cannot be marked ready when draft artifact manifests are missing or stale.

Changes in this slice:
- Add deterministic markdown artifact manifests to every generated live response draft.
- Track draft artifact filename, hash, byte size, and generation timestamp alongside each draft.
- Add `draftArtifactIntegrityCoverage` to response package readiness metrics and block readiness when draft content no longer matches its artifact manifest.
- Make the live response-readiness proof write, read back, and hash-check each draft artifact before recording proof evidence.

Verification:
- `npm test -- __tests__/services/live-response-package.test.ts --run` passed with 12 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 12 tests.

Remaining after this slice:
- Continue extending artifact integrity checks into DB-backed persisted import-response proof once PostgreSQL connectivity is restored.
- Live persisted import-response proof still depends on restoring the blocked PostgreSQL connection to `88.80.188.224:5432`.

### 2026-05-27 - Live Persisted Import-Response Recheck

Status: externally blocked.

Purpose: recheck whether the DB-backed live persisted import-to-response proof can now complete after discovery intake and response artifact integrity hardening.

Result:
- Ran `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Proof run `live_persisted_import_response_20260527T114834Z` failed before source discovery or persistence because PostgreSQL refused the connection: `connect ECONNREFUSED 88.80.188.224:5432`.
- No cleanup rows were needed because the proof failed before inserts.

Remaining after this recheck:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun `npm run platform:proof -- --run live-persisted-import-response --include-live-safe`.
- Continue non-DB hardening while the persisted live proof remains externally blocked.

### 2026-05-27 - Persisted Response Draft Integrity Gate

Status: implemented and verified.

Purpose: carry draft artifact integrity from generated live response packages into the tenant-backed response package readiness, final rendering, and final submission gates.

Changes in this slice:
- Add draft artifact manifests to requirement-aware persisted proposal drafts.
- Add `draftArtifactIntegrityCoverage` to tenant response package readiness metrics.
- Block response package readiness when a persisted draft artifact manifest is missing or stale.
- Require current draft artifact integrity receipts before final artifact rendering.
- Add a final submission checklist item for response draft artifact integrity.

Verification:
- `npm test -- __tests__/actions/proposal-documents-scope.test.ts __tests__/actions/final-artifact-workflow.test.ts __tests__/actions/final-submission-checklist-workflow.test.ts --run` passed with 42 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave6-final-submission-gate --run wave9-response-readiness-package` passed with 35 tests.
- `npm run platform:proof -- --run wave6-approval-production-corrections` passed with 180 tests.

Remaining after this slice:
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity is restored.
- Continue non-DB hardening around live discovery, source intake, response quality, and submission gates.

### 2026-05-27 - Draft Integrity Operator Visibility

Status: implemented and verified.

Purpose: make response draft artifact integrity visible in operator surfaces, not only enforced by backend readiness and submission gates.

Changes in this slice:
- Include draft artifact integrity coverage in response package workflow readiness descriptions.
- Route draft artifact integrity language into the command-center response-quality readiness dimension.
- Include draft artifact integrity in the proposal document readiness label shown before final rendering.

Verification:
- `npm test -- __tests__/actions/work-items-command-center.test.ts __tests__/work-items/projections.test.ts __tests__/components/ProposalDocumentsWinThemeSeedReview.test.ts --run` passed with 7 tests.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Continue hardening operator-visible proof and remediation loops while DB-backed live persistence remains blocked by PostgreSQL connectivity.

### 2026-05-27 - World Bank Live Response Recovery and Current Portfolio Triage

Status: implemented and verified.

Purpose: recover the World Bank live response-readiness lane when the JavaScript-rendered procurement listing does not expose usable markdown rows, and prevent stale proof artifacts from outranking current source evidence.

Changes in this slice:
- Added a World Bank public `procnotices` API-list parser and fetch fallback for response-readiness source discovery.
- Tightened response-readiness term matching so `system` no longer matches inside unrelated words such as `ecosystem`.
- Ranked World Bank source opportunities by response-ready term strength before selecting a notice for package generation.
- Made portfolio triage keep the latest completed proof per source feed before opportunity deduplication, preventing corrected-away historical picks from polluting operator rankings.

Verification:
- `npm test -- live-response-portfolio-triage.test.ts world-bank-parser.test.ts platform-proof-scenarios.test.ts --run` passed with 14 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-world-bank-response-readiness --include-live-safe` passed with run `live_world_bank_response_readiness_20260527T182357Z`, selecting World Bank notice `OP00440843` for energy-management systems and capacity building with six draft artifacts and `ready_for_review` readiness.
- `npm run platform:proof -- --run live-opportunity-portfolio-triage --include-live-safe` passed with run `live_opportunity_portfolio_triage_20260527T182552Z`, ranking UNGM as `pursue_now`, World Bank as `review_before_pursuit`, and COMESA as `review_before_pursuit`.
- `npm run platform:proof -- --all --wave 9` passed with 235 tests across discovery, response-readiness package, presentation export, and discovery-to-submission core scenarios.

Remaining after this slice:
- Continue non-DB live-source recovery work for AFDB and Kenya PPIP intermittent failures.
- Rerun the DB-backed live persisted import-response proof after PostgreSQL connectivity to `88.80.188.224:5432` is restored.

### 2026-05-27 - Expanded Live Source Portfolio Recheck

Status: verified.

Purpose: recheck previously intermittent AFDB and Kenya PPIP live-source lanes after World Bank recovery, then refresh the operator portfolio ranking with current evidence.

Result:
- `npm run platform:proof -- --run live-afdb-response-readiness --include-live-safe` passed with run `live_afdb_response_readiness_20260527T182825Z`, selecting an AFDB Ethiopia meteorological and climate mobile application EOI with `strong_fit` pursuit fit and `ready_for_review` readiness.
- An initial concurrent Kenya PPIP response-readiness run `live_kenya_ppip_response_readiness_20260527T182825Z` failed with `fetch failed`, while a direct API probe immediately returned 10 mapped opportunities from `https://tenders.go.ke/api/active-tenders?perpage=10&page=1`.
- Rerunning Kenya PPIP alone passed with run `live_kenya_ppip_response_readiness_20260527T234723Z`, selecting a supplier-registration package with 13 evaluator criteria, 13 win-theme seeds, 11,668 draft words, and `ready_for_review` readiness.
- `npm run platform:proof -- --run live-opportunity-portfolio-triage --include-live-safe` passed with run `live_opportunity_portfolio_triage_20260527T234859Z`, ranking 5 current source-feed candidates: Kenya PPIP, AFDB, and UNGM as `pursue_now`; World Bank and COMESA as `review_before_pursuit`.

Remaining after this recheck:
- Kenya PPIP source access appears live but sensitive to concurrent proof load; keep source proofs sequential when diagnosing that lane.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-27 - Risk-Heavy Pursuit Fit Review Gate

Status: implemented and verified.

Purpose: prevent broad supplier-registration or mixed-domain opportunities from being ranked as pursue-now solely because they contain many generic ICT terms.

Changes in this slice:
- Force live pursuit fit to `review_required` when two or more specialist-domain risk factors are detected, even if the opportunity has a high numeric fit score.
- Added regression coverage for a Kenya PPIP-style supplier registration containing strong ICT signals plus cleaning, construction, furniture, and vehicle risk factors.

Verification:
- `npm test -- live-response-package.test.ts live-response-portfolio-triage.test.ts --run` passed with 21 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-kenya-ppip-response-readiness --include-live-safe` passed with run `live_kenya_ppip_response_readiness_20260527T235350Z`, keeping the package `ready_for_review` but changing pursuit fit to `review_required` and `review_before_pursuit`.
- `npm run platform:proof -- --run live-opportunity-portfolio-triage --include-live-safe` passed with run `live_opportunity_portfolio_triage_20260527T235514Z`, ranking AFDB and UNGM as pursue-now while Kenya PPIP, World Bank, and COMESA require review.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 17 tests.

Remaining after this slice:
- Consider adding source-type semantics for prequalification/supplier-registration opportunities so they can be routed to a dedicated qualification workflow rather than ordinary response pursuit.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Qualification Route Semantics for Live Pursuits

Status: implemented and verified.

Purpose: route supplier-registration and prequalification opportunities as qualification workflows instead of ordinary proposal pursuits, while still preserving response package evidence when a draft can be generated.

Changes in this slice:
- Added `pursuitRoute` to live pursuit-fit assessments with `proposal_response`, `supplier_registration`, and `prequalification` routes.
- Detect supplier-registration and prequalification language from opportunity/source text and force those routes to `review_required`.
- Surface the pursuit route in portfolio ranking reasons and operator briefs.
- Preserve backward compatibility for older live response proof artifacts by defaulting missing `pursuitRoute` values to `proposal_response` during portfolio triage import.

Verification:
- `npm test -- live-response-package.test.ts live-response-portfolio-triage.test.ts platform-proof-scenarios.test.ts --run` passed with 29 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-kenya-ppip-response-readiness --include-live-safe` passed with run `live_kenya_ppip_response_readiness_20260528T001150Z`, producing `pursuitRoute:supplier_registration`, `review_required`, and `review_before_pursuit`.
- `npm run platform:proof -- --run live-opportunity-portfolio-triage --include-live-safe` passed with run `live_opportunity_portfolio_triage_20260528T001315Z`, showing `pursuit-route:supplier_registration`/`top-route:proposal_response` evidence plus the supplier-registration route in ranking reasons, while keeping AFDB/UNGM as pursue-now priorities.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 18 tests.

Remaining after this slice:
- Build a dedicated persisted qualification/registration workflow once DB connectivity is restored or a non-DB proof harness exists for that lane.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Qualification Package Artifacts for Live Registration Routes

Status: implemented and verified.

Purpose: make supplier-registration and prequalification live pursuits produce an auditable qualification package instead of only flagging the route in pursuit-fit metadata.

Changes in this slice:
- Added `buildLiveQualificationPackage()` to generate required artifacts, an operator checklist, owner hints, source-signal links, and a Markdown operator brief for supplier-registration and prequalification routes.
- Extended the live response-readiness proof to write `qualification-package/qualification-package.json` and `qualification-package/qualification-package.md` for non-proposal routes, with readback checks before evidence is recorded.
- Added qualification-package counts and route IDs to live response-readiness evidence rows.
- Declared Kenya PPIP qualification package artifacts in the live-safe proof manifest.

Verification:
- `npm test -- live-response-package.test.ts platform-proof-scenarios.test.ts --run` passed with 26 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 20 tests.
- `npm run platform:proof -- --run live-kenya-ppip-response-readiness --include-live-safe` passed with run `live_kenya_ppip_response_readiness_20260528T002006Z`, producing `qualificationPackage.pursuitRoute:supplier_registration`, 9 required artifacts, 5 checklist items, 4 mandatory checklist items, and verified Markdown/JSON qualification package artifacts.
- `npm run platform:proof -- --run live-opportunity-portfolio-triage --include-live-safe` passed with run `live_opportunity_portfolio_triage_20260528T002137Z`, keeping AFDB/UNGM as `pursue_now` and Kenya PPIP as `review_before_pursuit` with `Pursuit route: supplier_registration`.

Remaining after this slice:
- Build a persisted qualification/registration workflow once DB connectivity is restored or a non-DB proof harness exists for that lane.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Non-DB Qualification Workflow Proof

Status: implemented and verified.

Purpose: turn live qualification package artifacts into an operator-executable workflow proof without waiting on PostgreSQL connectivity.

Changes in this slice:
- Added a deterministic live qualification workflow builder with route review, artifact assembly, capability mapping, compliance review, and submission-control gates.
- Added regression coverage proving supplier-registration packages generate 5 workflow gates and block when mandatory compliance artifacts are missing.
- Added `prove-live-qualification-workflow.ts`, which reads the latest live qualification package artifact, writes workflow JSON/Markdown artifacts, verifies readback integrity, and appends a dedicated evidence row.
- Registered `live-qualification-workflow` as a Wave 9 live-safe proof and expanded the response-readiness package proof to include the qualification workflow unit tests.

Verification:
- `npm test -- live-qualification-workflow.test.ts live-response-package.test.ts platform-proof-scenarios.test.ts --run` passed with 28 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 22 tests.
- `npm run platform:proof -- --run live-qualification-workflow --include-live-safe` passed with run `live_qualification_workflow_20260528T002713Z`, consuming source run `live_kenya_ppip_response_readiness_20260528T002006Z` and producing 5 gates, 5 tasks, 4 mandatory tasks, 22 source signals, and no blocked gates.

Remaining after this slice:
- Persist qualification workflows in the DB-backed runtime once PostgreSQL connectivity is restored.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Source Document Intake Resilience and System Queueing

Status: implemented and verified.

Purpose: keep RFP source-document intake moving even when Docling is unavailable or returns unusably short text, and allow automated discovery downloads by `system` to enqueue parsing under the downloaded document's organization instead of requiring a default user workspace.

Changes in this slice:
- Added a shared extraction path for downloaded opportunity documents that tries Docling first, then falls back to local PDF text extraction, local DOCX raw text extraction, or basic HTML text extraction for supported file types.
- Persisted locally extracted text and page counts through the existing `opportunity_documents` and `rfp_documents` write paths so downloaded RFPs can continue into parsing and response preparation without waiting for Docling recovery.
- Updated automated parse queueing so `userId = "system"` uses `opportunity_documents.organization_id` as the tenant when there is no user workspace, while human users without a default workspace still receive the existing remediation workflow.
- Added service coverage for Docling-unavailable PDF download fallback, later DOCX extraction fallback, and automated `system` queueing under the source document organization.

Verification:
- `npm test -- rfp-document-service.test.ts --run` passed with 16 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live DB-backed intake proof downloaded UNICEF source document `1e7a6f2e-0639-4c37-bbe7-26a65c0182a2` as `system`, uploaded `UNICEF-Education-Tender-Calendar-2026.pdf` to Linode E3 at `s3://mansa/rfp/60a77e47-f425-4a08-babf-9350de39b390/1e7a6f2e-0639-4c37-bbe7-26a65c0182a2/UNICEF-Education-Tender-Calendar-2026.pdf`, and persisted 30,042 extracted characters.
- The live proof created RFP document `8ebb91a4-b844-4b8d-b8fc-2d16c095eaca` and parse job `68ac7325-9aa2-4c00-ba24-8c952d7f421f` under organization `__MIGRATED_LEGACY__`; the parse job completed and extracted 3 requirements.
- Current live DB counts after the proof: 2,723 opportunities, 1,611 RFP opportunities, 164 opportunity source documents, 6 downloaded source documents, 1 RFP document, and 1 completed RFP parse job.

Remaining after this slice:
- Run additional live document downloads across more sources to build volume now that automated queueing no longer depends on user workspace rows.
- Keep Docling health monitored; the local fallback is now covered for PDF/DOCX/HTML, but Docling remains the preferred extraction path when available.

### 2026-05-28 - Batch Source Document Intake Runner

Status: implemented and verified.

Purpose: convert the backlog of discovered source documents into downloaded, parsed RFP records without hand-running one document ID at a time.

Changes in this slice:
- Added `scripts/run-source-document-intake.ts` and `npm run source-docs:intake`.
- The runner forces `frontend/.env.local` for `DATABASE_URL`, selects bounded discovered PDF/DOCX/HTML source documents, downloads them through the existing `downloadDocument` path as `system`, records per-document success/failure, waits for parser jobs to reach terminal status by default, and writes live-safe proof artifacts plus source-document intake evidence.
- Added dry-run, limit, max-attempt, organization filter, parser wait, parser timeout, poll interval, and user override controls via environment variables.
- Fixed the parser progress ordering bug surfaced by the live runner: successful parse jobs now move to `Finalizing` before the completion transaction, so completed jobs remain at `progress = 100` and `current_step = Completed`.
- Added parser workflow regression coverage for completed parse progress.

Verification:
- `SOURCE_DOCUMENT_INTAKE_DRY_RUN=1 SOURCE_DOCUMENT_INTAKE_LIMIT=3 npm run source-docs:intake` passed with run `source_document_intake_20260528T050838Z`, selecting 3 discovered UNICEF PDF source documents and skipping them without mutation.
- `SOURCE_DOCUMENT_INTAKE_LIMIT=2 SOURCE_DOCUMENT_INTAKE_PARSE_TIMEOUT_MS=240000 npm run source-docs:intake` passed with run `source_document_intake_20260528T050904Z`; it downloaded `Medical-Devices-Tender-Calendar-2025-2026.pdf`, Docling timed out, local PDF fallback extracted 15,047 characters, parse job `15373581-b825-45e3-954d-950f4bffdf09` completed, and 8 requirements were extracted. The second selected UNICEF PDF returned HTTP 403 and was recorded as a failed document without aborting the run.
- `SOURCE_DOCUMENT_INTAKE_LIMIT=1 SOURCE_DOCUMENT_INTAKE_PARSE_TIMEOUT_MS=240000 npm run source-docs:intake` passed with run `source_document_intake_20260528T051446Z`, recording a second UNICEF HTTP 403 failure without aborting.
- `npm test -- rfp-parse-workflow.test.ts rfp-document-service.test.ts --run` passed with 29 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live DB repair updated the two already-completed parse jobs from the old `90/Finalizing` terminal display to `100/Completed`.
- Current live DB counts after this slice: 2,723 opportunities, 1,611 RFP opportunities, 164 opportunity source documents, 7 downloaded source documents, 2 failed source documents, 2 RFP documents, 2 completed parse jobs, and 11 persisted RFP requirements.

Remaining after this slice:
- Add a retry/fallback path for source URLs that return HTTP 403 to direct server fetch, using Firecrawl/browser-assisted resolution when source hosts require browser-like access or signed redirects.
- Run the batch intake runner across additional discovered source documents after the 403 fallback is in place.

### 2026-05-28 - Source Document 403 Recovery via Search and Firecrawl

Status: implemented and verified.

Purpose: keep discovered source-document intake moving when a direct PDF/media URL returns HTTP 403 or an HTML challenge page, by recovering a safe canonical source page and parsing that content instead of dropping the document.

Changes in this slice:
- Added guarded source-document recovery to `downloadDocument`: direct fetch remains first, but retryable failures now search for source-page candidates, scrape recovery candidates through Firecrawl, retry recovered same-host document links, and fall back to storing a Firecrawl-scraped HTML source-page surrogate when the binary remains blocked.
- Added deterministic same-host CMS media recovery for URLs shaped like `/media/.../file/<document>.pdf`, including UNICEF-style `/supply/documents/<slug>` pages, before noisy metasearch results are trusted.
- Filtered recovered document links to same-host links or strong title matches, and rejected HTML bodies served from direct document URLs so Cloudflare/challenge/privacy pages are not accepted as PDFs.
- Added provenance fields for recovered downloads: `originalSourceUrl` and `downloadMethod`.
- Cleared stale `lastError` when a source document moves back into downloading/downloaded states.
- Added regression coverage for a blocked UNICEF-style media URL recovered through SearXNG + Firecrawl landing-page content.

Verification:
- `npm test -- rfp-document-service.test.ts --run` passed with 17 tests.
- `npx tsc --noEmit --pretty false` passed.
- Live proof against source document `c469ff5d-5cd1-41b5-ac4c-5674097ab3d5` recovered blocked URL `https://www.unicef.org/supply/media/24786/file/Medicines-Tender-Calendar-2025-2026.pdf` through `https://www.unicef.org/supply/documents/medicines-tender-calendar`, stored HTML at `s3://mansa/rfp/60a77e47-f425-4a08-babf-9350de39b390/c469ff5d-5cd1-41b5-ac4c-5674097ab3d5/Medicines-Tender-Calendar-2025-2026.html`, extracted 3,768 characters, created RFP document `ce5e243a-0608-485a-83c8-5cd3885e67cf`, and completed parse job `62f60c11-c1ea-40a8-a480-b901192a9813` with 1 requirement.
- Live proof against source document `1618acdc-27b1-43d5-ba57-b26bd006aff0` remained failed because SearXNG returned no canonical nutrition bid-plan result and Firecrawl had no recoverable page, which is now correctly recorded as a failed recovery instead of a false success.
- Repaired the earlier bad experimental completed row by marking RFP document `04a25861-193d-4e27-842e-088e0563f0c4` and parse job `72036867-6524-4ffc-a6db-5006c202abdd` as failed/superseded by the corrected recovery run.
- `SOURCE_DOCUMENT_INTAKE_DRY_RUN=1 SOURCE_DOCUMENT_INTAKE_LIMIT=1 npm run source-docs:intake` passed after the recovery changes, selecting a remaining discovered UNICEF PDF without mutation.
- Current live DB counts after this slice: 2,723 opportunities, 1,611 RFP opportunities, 164 source documents, 8 downloaded source documents, 1 failed source document, 4 RFP documents, 3 completed RFP documents, 3 completed parse jobs, and 12 persisted RFP requirements.

Remaining after this slice:
- Add a stronger browser/Cloak path for challenged source documents that have no SearXNG-indexed or deterministic source-page recovery candidate, such as the UNICEF nutrition bid-plan PDF.
- Continue batch intake across remaining discovered documents; failed items should now represent genuinely unrecovered sources rather than direct-fetch-only blind spots.

### 2026-05-28 - Source Intake Browser/Cloak Recovery and Retry Drain

Status: implemented and verified, with live UNICEF hard-blockers still requiring a configured CloakBrowser CDP endpoint or another source-specific acquisition route.

Purpose: keep source-document intake progressing across blocked media URLs, previously failed source documents, and browser-only pages without letting one hard-blocked PDF strand the rest of the RFP collection queue.

Changes in this slice:
- Extended source-document recovery from Firecrawl-only scraping to Firecrawl -> deployed browser scraper -> optional CloakBrowser CDP, recording `browser_*` and `cloakbrowser_*` provenance methods when those paths supply recovered links or HTML source-page surrogates.
- Rejected Cloudflare/challenge/error pages from recovery scrapes before accepting a recovered HTML surrogate, so browser fallbacks do not convert anti-bot pages into fake RFP content.
- Expanded deterministic UNICEF-style media recovery slugs to preserve short procurement tokens such as `bid` and quarter tokens such as `4q`, and to try year/quarter-stripped and `unicef`-stripped variants.
- Included recovered `originalSourceUrl` and `downloadMethod` in persisted RFP metadata, not just the return value.
- Made later text re-extraction respect `text/html` MIME type for recovered HTML source-page surrogates even when the original discovered filename ends in `.pdf`.
- Updated `source-docs:intake` to retry previously failed source documents while `downloadAttempts < SOURCE_DOCUMENT_INTAKE_MAX_ATTEMPTS`; `SOURCE_DOCUMENT_INTAKE_RETRY_FAILED=0` disables this.
- Added `SOURCE_DOCUMENT_INTAKE_PARSE_DRAIN_MS` so live intake waits briefly after terminal parse status before closing the DB pool, avoiding races with parser side-effect workflow writes.

Verification:
- `npm test -- rfp-document-service.test.ts browser-scraper-client.test.ts cloakbrowser-scraper-client.test.ts --run` passed with 23 tests.
- `npx tsc --noEmit --pretty false` passed.
- `SOURCE_DOCUMENT_INTAKE_DRY_RUN=1 SOURCE_DOCUMENT_INTAKE_LIMIT=3 npm run source-docs:intake` passed with run `source_document_intake_20260528T055340Z`, selecting previously failed source document `1618acdc-27b1-43d5-ba57-b26bd006aff0`, proving failed-under-attempt-cap items are no longer stranded.
- `SOURCE_DOCUMENT_INTAKE_LIMIT=2 SOURCE_DOCUMENT_INTAKE_PARSE_TIMEOUT_MS=240000 npm run source-docs:intake` passed with run `source_document_intake_20260528T055402Z`; both selected UNICEF media URLs remained blocked, and logs showed Firecrawl, browser scraper, and optional CloakBrowser recovery attempts before the failures were recorded.
- `SOURCE_DOCUMENT_INTAKE_DRY_RUN=1 SOURCE_DOCUMENT_INTAKE_LIMIT=5 npm run source-docs:intake` passed with run `source_document_intake_20260528T055703Z`, showing the queue can continue past failed UNICEF docs to later discovered UNICEF, COMESA HTML, and COMESA DOCX source documents.
- `SOURCE_DOCUMENT_INTAKE_LIMIT=5 SOURCE_DOCUMENT_INTAKE_MAX_ATTEMPTS=1 SOURCE_DOCUMENT_INTAKE_PARSE_TIMEOUT_MS=240000 npm run source-docs:intake` passed with run `source_document_intake_20260528T055725Z`; it downloaded and parsed 3 of 5 selected source documents: UNICEF education calendar RFP document `6ac25f56-5eb4-4456-adb4-bda40cb6f314` / parse job `72185f3b-be7c-4bba-a7f9-45a6479eab17` with 2 requirements, COMESA RASIP HTML RFP document `c2a81bbc-845a-4dc2-b0b5-b7307ebcbf1d` / parse job `b0fcc87f-d572-4378-b5a3-aeb923f258ed` with 3 requirements, and COMESA medical scheme DOCX RFP document `764e7022-ae5d-4eaf-b8fd-696f5357132a` / parse job `fc9deec7-16f7-44c9-a425-a08c93dddc3d` with 0 requirements but completed parse status.
- Current live DB counts after this slice: 2,723 opportunities, 1,611 RFP opportunities, 164 source documents, 11 downloaded source documents, 4 failed source documents, 7 RFP documents, 6 completed RFP documents, 6 completed parse jobs, and 17 persisted RFP requirements.

Remaining after this slice:
- Configure a real CloakBrowser CDP endpoint or a source-specific UNICEF media acquisition route for PDFs that return 403/time out and have no scrapeable canonical source page through Firecrawl or the deployed browser service.
- Add source-specific recovery for UNICEF tender calendar media URLs if they keep rotating between direct 403, Firecrawl challenge content, and browser-service 403/404.
- Investigate low-confidence/zero-requirement completed parses such as `fc9deec7-16f7-44c9-a425-a08c93dddc3d`; completion is mechanically successful but not yet a winning-response-quality extraction.

### 2026-05-28 - Zero-Requirement Parse Quality Gate

Status: implemented and verified.

Purpose: prevent mechanically completed parses with no actionable requirements from looking healthy, because winning-response generation depends on trustworthy requirement extraction, not just a terminal parser status.

Changes in this slice:
- Added parser quality signals to `parseReview`; any completed parse with `0` extracted requirements now gets `qualitySignals: ["zero_requirements_extracted"]`, a review reason, and `state: "needs_review"` even if the structure parse confidence is otherwise high.
- Updated parse-confidence workflow reason/task metadata so the review queue explains zero-requirement output as an extraction quality problem instead of only a confidence-threshold problem.
- Added `npm run rfp-parse:audit-quality`, an operational audit/backfill script that forces `.env.local` `DATABASE_URL`, finds completed zero-requirement parses missing the quality signal, and repairs their metadata. `RFP_PARSE_QUALITY_AUDIT_DRY_RUN=1` previews the repair set.
- Exposed `parseReview`, `extractionProvenance`, and `parseQualityAudit` on the RFP status API so clients can distinguish healthy completion from completed-but-degraded parser output.

Verification:
- `npm test -- rfp-parse-workflow.test.ts --run` passed with 14 tests, including the new high-confidence/zero-requirements case.
- `npx tsc --noEmit --pretty false` passed.
- `RFP_PARSE_QUALITY_AUDIT_DRY_RUN=1 npm run rfp-parse:audit-quality` first found live RFP document `764e7022-ae5d-4eaf-b8fd-696f5357132a` / parse job `fc9deec7-16f7-44c9-a425-a08c93dddc3d` as a completed zero-requirement parse needing repair.
- `npm run rfp-parse:audit-quality` repaired that live row.
- A live `psql` check confirmed RFP document `764e7022-ae5d-4eaf-b8fd-696f5357132a` now has `parseReview.state = needs_review`, `parseReview.qualitySignals = ["zero_requirements_extracted"]`, and `parseQualityAudit.source = audit-rfp-parse-quality`.
- A follow-up `RFP_PARSE_QUALITY_AUDIT_DRY_RUN=1 npm run rfp-parse:audit-quality` scanned 0 unrepaired completed zero-requirement parses.

Remaining after this slice:
- Add UI treatment for `parseReview.qualitySignals` so operators see completed-but-degraded parses directly in the requirements/review surface.
- Add a fallback extraction pass for documents that are long and parseable but produce zero requirements, rather than only flagging them for review.

### 2026-05-28 - Live Submission Schedule Evidence in Pursuit Handoff

Status: implemented and verified.

Purpose: close the deadline-intelligence gap in the live response path so operators can see source-backed submission timing before acting on generated pursuit artifacts.

Changes in this slice:
- Added deterministic live submission schedule extraction to response packages, including normalized deadline, deadline source, days remaining, urgency, submission method, submission requirements, and source evidence snippets.
- Updated response drafts and qualification briefs to show deadline and submission timing when source evidence is available.
- Extended live response-readiness proofs to record `submissionSchedule` and deadline evidence IDs.
- Carried submission schedule data into portfolio ranking, operator briefs, and ranking reasons.
- Added an expired-deadline guard so stale opportunities cannot remain `pursue_now`.
- Updated pursuit handoff briefs, next actions, and proof summaries to include primary pursuit deadline and urgency.

Verification:
- `npm test -- live-response-package.test.ts live-response-portfolio-triage.test.ts live-pursuit-handoff.test.ts --run` passed with 30 tests.
- `npm test -- platform-proof-scenarios.test.ts --run` passed with 6 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 26 tests.
- `npm run platform:proof -- --run live-kenya-ppip-response-readiness --include-live-safe` passed with run `live_kenya_ppip_response_readiness_20260528T004820Z`, extracting deadline `2026-05-28`, urgency `critical`, submission method `Written (Physical/Hard Copy)`, and 6 submission requirement signals.
- `npm run platform:proof -- --run live-qualification-workflow --include-live-safe` passed with run `live_qualification_workflow_20260528T005157Z`, refreshing the ready supplier-registration workflow for the new Kenya response-readiness run.
- `npm run platform:proof -- --run live-afdb-response-readiness --include-live-safe` passed with run `live_afdb_response_readiness_20260528T005236Z`, extracting deadline `2026-06-11`, urgency `normal`, and source-text evidence from the AFDB EOI.
- `npm run platform:proof -- --run live-opportunity-portfolio-triage --include-live-safe` passed with run `live_opportunity_portfolio_triage_20260528T005350Z`, ranking the refreshed AFDB pursuit first with `Deadline urgency: normal for 2026-06-11 (source_text)` and Kenya PPIP third with `Deadline urgency: critical for 2026-05-28 (opportunity_metadata)`.
- `npm run platform:proof -- --run live-pursuit-handoff --include-live-safe` passed with run `live_pursuit_handoff_20260528T005404Z`, bundling source portfolio `live_opportunity_portfolio_triage_20260528T005350Z`, primary AFDB deadline `2026-06-11`, 3 review-queue candidates, and 32 linked artifacts.

Remaining after this slice:
- Refresh older UNGM, World Bank, and COMESA live response-readiness artifacts so their portfolio rows also carry schedule evidence instead of `deadline unknown`.
- Persist pursuit handoffs, qualification workflows, and submission schedules in the DB-backed runtime once PostgreSQL connectivity is restored.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Live Source Schedule Refresh

Status: implemented and verified, with one live-source outage noted.

Purpose: refresh the older live source artifacts created before submission schedules existed, so portfolio and handoff evidence is schedule-aware across more source kinds.

Changes in this slice:
- Hardened date parsing for Docling/Markdown output where date components are split by emphasis markers, e.g. `**CLOSING DATE: 12** **TH** **JUNE 2026**`.
- Added a regression case proving Markdown-emphasized COMESA closing dates normalize into a source-text deadline.
- Refreshed World Bank and COMESA response-readiness artifacts with submission schedule evidence.
- Regenerated live portfolio triage and pursuit handoff so refreshed source deadlines appear in operator ranking and handoff evidence.

Verification:
- `npm test -- live-response-package.test.ts --run` passed with 21 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-world-bank-response-readiness --include-live-safe` passed with run `live_world_bank_response_readiness_20260528T005653Z`, extracting deadline `2026-06-03`, urgency `urgent`, and source-text evidence.
- `npm run platform:proof -- --run live-comesa-response-readiness --include-live-safe` passed with run `live_comesa_response_readiness_20260528T005830Z`, extracting deadline `2026-06-12`, urgency `normal`, and source-text evidence after the Markdown emphasis parser fix.
- `npm run platform:proof -- --run live-opportunity-portfolio-triage --include-live-safe` passed with run `live_opportunity_portfolio_triage_20260528T005939Z`, showing AFDB `normal` deadline `2026-06-11`, COMESA `normal` deadline `2026-06-12`, World Bank `urgent` deadline `2026-06-03`, and Kenya PPIP `critical` deadline `2026-05-28`.
- `npm run platform:proof -- --run live-pursuit-handoff --include-live-safe` passed with run `live_pursuit_handoff_20260528T005954Z`, bundling source portfolio `live_opportunity_portfolio_triage_20260528T005939Z`, primary AFDB deadline `2026-06-11`, 3 review-queue candidates, and 32 linked artifacts.
- `npm run platform:proof -- --run live-opportunity-response-readiness --include-live-safe` for the default UNGM source failed twice with `UNGM notice search returned HTTP 503`; the older UNGM row therefore remains schedule-unknown until that source recovers or a fallback source path is added.

Remaining after this slice:
- Add a fallback path for UNGM when the public notice search endpoint returns HTTP 503.
- Persist pursuit handoffs, qualification workflows, and submission schedules in the DB-backed runtime once PostgreSQL connectivity is restored.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - UNGM Outage Fallback for Response Readiness

Status: implemented and verified.

Purpose: keep UNGM response readiness operational when the public notice search endpoint is temporarily unavailable, without pretending the search succeeded.

Changes in this slice:
- Added a typed `UngmNoticeSearchError` carrying HTTP status and `Retry-After` so live proof code can distinguish source outages from parser failures.
- Added a bounded UNGM response-readiness fallback for 5xx notice-search failures. The fallback reads the latest completed UNGM response-readiness proof, reuses its verified opportunity metadata and source document URL, records a `fallback:` search URL, and still re-downloads/converts the public source PDF before generating fresh response artifacts.
- Preserved fallback provenance in opportunity metadata so downstream evidence can show which prior proof was used and why.
- Added regression coverage for typed UNGM search outage errors.

Verification:
- `npm test -- ungm-client.test.ts --run` passed with 3 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-opportunity-response-readiness --include-live-safe` passed with run `live_response_readiness_20260528T010842Z` while UNGM search was returning HTTP 503. The proof used fallback source `live_response_readiness_20260527T174956Z`, re-fetched `https://www.un.org/Depts/ptd/sites/www.un.org.Depts.ptd/files/pdf/eoi24414.pdf`, extracted 9,002 characters with Docling, generated 7,973 response-draft words, and produced deadline `2026-05-28` with urgency `critical`.
- `npm run platform:proof -- --run live-opportunity-portfolio-triage --include-live-safe` passed with run `live_opportunity_portfolio_triage_20260528T010913Z`, ranking the refreshed UNGM proof first with `Deadline urgency: critical for 2026-05-28 (opportunity_metadata)`.
- `npm run platform:proof -- --run live-pursuit-handoff --include-live-safe` passed with run `live_pursuit_handoff_20260528T010935Z`, bundling source portfolio `live_opportunity_portfolio_triage_20260528T010913Z`, primary UNGM pursuit `live_response_readiness_20260528T010842Z`, deadline `2026-05-28`, 3 review-queue candidates, and 32 linked artifacts.

Remaining after this slice:
- Replace UNGM fallback with fresh search results automatically when `https://www.ungm.org/Public/Notice/Search` recovers.
- Persist pursuit handoffs, qualification workflows, and submission schedules in the DB-backed runtime once PostgreSQL connectivity is restored.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Deadline-Control Actions in Live Handoff

Status: implemented and verified.

Purpose: turn deadline visibility into operator action so critical and urgent pursuits are not merely labeled, but trigger explicit submission-control work.

Changes in this slice:
- Added deadline-control next actions to live pursuit handoffs for critical primary pursuits, urgent primary pursuits, extracted submission requirements, and deadline-risk review-queue candidates.
- Trimmed terminal punctuation in action titles so generated command text stays readable when opportunity titles end with punctuation.
- Added regression coverage for critical primary pursuits and urgent review candidates.

Verification:
- `npm test -- live-pursuit-handoff.test.ts --run` passed with 4 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-pursuit-handoff --include-live-safe` passed with run `live_pursuit_handoff_20260528T011410Z`, bundling source portfolio `live_opportunity_portfolio_triage_20260528T010913Z`, primary UNGM pursuit `live_response_readiness_20260528T010842Z`, deadline `2026-05-28`, 3 review-queue candidates, 32 linked artifacts, and next actions for same-day submission control plus deadline-risk review candidates.

Remaining after this slice:
- Persist pursuit handoffs, qualification workflows, and submission schedules in the DB-backed runtime once PostgreSQL connectivity is restored.
- Add owner assignment and receipt-capture persistence once the handoff moves from proof artifact to DB-backed runtime.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Structured Execution Checklist in Live Handoff

Status: implemented and verified.

Purpose: make the live pursuit handoff machine-actionable by carrying owner-role hints, priority, due labels, required evidence, and pending status as structured execution tasks instead of relying only on prose next actions.

Changes in this slice:
- Added a deterministic `executionPlan` to live pursuit handoffs with task IDs, owner roles, priority, source run/source kind, due labels, evidence requirements, and `pending_operator_action` status.
- Added execution checklist rendering to the Markdown operator brief, including critical deadline controls, source requirement verification, review-queue triage, and ready qualification workflow execution.
- Added execution task counts and critical task counts to the live pursuit handoff proof and evidence rows.
- Tightened action title rendering so source titles ending in punctuation do not create awkward operator commands.

Verification:
- `npm test -- live-pursuit-handoff.test.ts --run` passed with 4 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-pursuit-handoff --include-live-safe` passed with run `live_pursuit_handoff_20260528T012255Z`, bundling source portfolio `live_opportunity_portfolio_triage_20260528T010913Z`, primary UNGM pursuit `live_response_readiness_20260528T010842Z`, deadline `2026-05-28`, 3 review-queue candidates, 32 linked artifacts, 8 execution tasks, and 5 critical execution tasks.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 27 tests across live response package, live qualification workflow, and live pursuit handoff services.
- The generated handoff brief includes owner-role/evidence tasks for proposal ownership, source deadline confirmation, source requirement verification, same-day submission control, bid/no-bid review, urgent World Bank triage, critical Kenya PPIP triage, and Kenya PPIP qualification workflow execution.

Remaining after this slice:
- Persist the structured handoff execution plan in the DB-backed runtime once PostgreSQL connectivity is restored.
- Add real user assignment and receipt-upload/capture state once the handoff moves from proof artifacts to authenticated runtime records.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Stable Latest Handoff Index

Status: implemented and verified.

Purpose: give operators and follow-on automation a stable entrypoint to the current live pursuit handoff instead of requiring them to inspect timestamped proof directories or evidence rows.

Changes in this slice:
- Added `.omx/state/latest-live-pursuit-handoff.json` as a stable machine-readable index for the latest live handoff run, source portfolio, primary pursuit, handoff artifact paths, and structured execution plan.
- Added `.omx/state/latest-live-pursuit-handoff.md` as a stable operator-readable brief that points to the current run and embeds the latest handoff checklist.
- Added readback validation for both stable latest-handoff artifacts inside `prove-live-pursuit-handoff.ts`.
- Added latest-handoff artifact paths to live pursuit handoff evidence rows.

Verification:
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-pursuit-handoff --include-live-safe` passed with run `live_pursuit_handoff_20260528T012604Z`, writing latest-handoff JSON/Markdown indexes for source portfolio `live_opportunity_portfolio_triage_20260528T010913Z`, primary UNGM pursuit `live_response_readiness_20260528T010842Z`, 32 linked artifacts, 8 execution tasks, and 5 critical execution tasks.

Remaining after this slice:
- Move the latest-handoff index behind authenticated product/API access once DB-backed runtime persistence is reachable.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Authenticated Latest Handoff Surface

Status: implemented and verified.

Purpose: move the current live pursuit handoff from filesystem-only proof state into an authenticated operator surface, so proposal teams can open the current response package checklist from the product without reading proof logs.

Changes in this slice:
- Added a server-side latest live handoff reader that validates `.omx/state/latest-live-pursuit-handoff.json` and `.omx/state/latest-live-pursuit-handoff.md` stay aligned.
- Added authenticated `GET /api/opportunities/live-handoff/latest`, gated by tenant context, returning the latest handoff index, Markdown brief, artifact paths, and proof guidance when no handoff has been generated.
- Added `/opportunities/live-handoff` to render the primary pursuit, artifact count, review queue count, deadline urgency, source links, execution task priorities, owner-role hints, due labels, and required evidence.
- Added a Handoff button to the main Opportunities header.
- Expanded the Wave 9 response-readiness package proof scenario to include the latest-handoff reader and authenticated route tests.

Verification:
- `npm test -- latest-live-pursuit-handoff.test.ts live-handoff-latest-route.test.ts --run` passed with 6 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 33 tests across live response package, qualification workflow, pursuit handoff, latest-handoff reader, and latest-handoff route coverage.
- `npm run build` passed; Next.js build output includes dynamic API route `/api/opportunities/live-handoff/latest` and page `/opportunities/live-handoff`.

Remaining after this slice:
- Add real execution state transitions, user assignment, and receipt capture once DB-backed runtime persistence is reachable.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Proof-Backed Handoff Task State

Status: implemented and verified.

Purpose: let operators act on the live handoff checklist by recording task status, assignee names, evidence notes, and receipt URLs while the DB-backed runtime remains unavailable.

Changes in this slice:
- Added a proof-backed handoff task action-state store at `.omx/state/latest-live-pursuit-handoff-action-state.json`, keyed to the current latest handoff run and ignored when stale.
- Added validation so task action state can only be written for task IDs present in the latest verified handoff.
- Added authenticated `POST /api/opportunities/live-handoff/latest/tasks/[taskId]` to update task status, assignee, evidence note, and receipt URL using the session user as updater.
- Updated `GET /api/opportunities/live-handoff/latest` to merge current task action states into the handoff payload.
- Updated `/opportunities/live-handoff` with Start, Block, and Complete controls plus assignee, evidence-note, and receipt-URL fields for each execution task.
- Expanded the Wave 9 response-readiness package proof scenario to cover handoff task action-state tests.

Verification:
- `npm test -- latest-live-pursuit-handoff.test.ts live-pursuit-handoff-action-state.test.ts live-handoff-latest-route.test.ts --run` passed with 11 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 38 tests across live response package, qualification workflow, pursuit handoff, latest-handoff reader, task action-state store, and latest-handoff routes.
- `npm run build` passed; Next.js build output includes `/api/opportunities/live-handoff/latest`, `/api/opportunities/live-handoff/latest/tasks/[taskId]`, and `/opportunities/live-handoff`.

Remaining after this slice:
- Replace the proof-backed task state file with DB-backed runtime persistence once PostgreSQL connectivity is restored.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Handoff Task Action Audit Events

Status: implemented and verified.

Purpose: make operator task updates auditable, so ownership, evidence-note, status, and receipt changes are not only mutable current state but also append-only evidence.

Changes in this slice:
- Added `.omx/state/latest-live-pursuit-handoff-action-events.md` as an append-only Markdown audit ledger for latest handoff task updates.
- Appended an audit event every time a live handoff task action state is updated, including run ID, task ID, task title, status, assignee, evidence note, receipt URL, updating user, timestamp, and generated event ID.
- Returned audit event metadata from `POST /api/opportunities/live-handoff/latest/tasks/[taskId]` alongside the updated task state.
- Extended action-state regression coverage to verify ledger creation and event content.

Verification:
- `npm test -- live-pursuit-handoff-action-state.test.ts live-handoff-latest-route.test.ts --run` passed with 8 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 38 tests across response package, qualification workflow, pursuit handoff, latest-handoff reader, action-state store, audit event behavior, and latest-handoff routes.
- `npm run build` passed; Next.js build output includes `/api/opportunities/live-handoff/latest`, `/api/opportunities/live-handoff/latest/tasks/[taskId]`, and `/opportunities/live-handoff`.

Remaining after this slice:
- Move the action-state and audit-event ledger into DB-backed runtime tables once PostgreSQL connectivity is restored.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Handoff Activity Timeline

Status: implemented and verified.

Purpose: make the append-only handoff task audit ledger visible to operators inside the live handoff surface instead of leaving the history only in proof files.

Changes in this slice:
- Added structured parsing for `.omx/state/latest-live-pursuit-handoff-action-events.md`, including run filtering, newest-first ordering, optional limits, and escaped Markdown cell handling.
- Returned the latest 25 task audit events from `GET /api/opportunities/live-handoff/latest` alongside current task action state.
- Included assignee, evidence note, receipt URL, and audit path metadata in task-update audit event responses.
- Added a Recent Activity section to `/opportunities/live-handoff` so operators can see status transitions, evidence notes, assignees, receipts, actor IDs, and timestamps after updates.
- Extended route and service tests to verify structured audit-event readback and latest-handoff API projection.

Verification:
- `npm test -- live-pursuit-handoff-action-state.test.ts live-handoff-latest-route.test.ts --run` passed with 8 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 38 tests across response package, qualification workflow, pursuit handoff, latest-handoff reader, action-state store, audit event projection, and latest-handoff routes.
- `npm run build` passed; Next.js build output includes `/api/opportunities/live-handoff/latest`, `/api/opportunities/live-handoff/latest/tasks/[taskId]`, and `/opportunities/live-handoff`.

Remaining after this slice:
- Move the action-state and audit-event ledger into DB-backed runtime tables once PostgreSQL connectivity is restored.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Evidence-Required Handoff Completion

Status: implemented and verified.

Purpose: prevent live handoff tasks from being marked complete without any proof that the operator captured the required evidence.

Changes in this slice:
- Added service-level validation so `completed` handoff task updates require either an evidence note or receipt URL.
- Returned validation failures from `POST /api/opportunities/live-handoff/latest/tasks/[taskId]` as HTTP 400 errors.
- Disabled the Complete control on `/opportunities/live-handoff` until the operator enters an evidence note or receipt URL.
- Extended handoff action-state and route tests to cover the completion-evidence guard.

Verification:
- `npm test -- live-pursuit-handoff-action-state.test.ts live-handoff-latest-route.test.ts --run` passed with 10 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 40 tests across response package, qualification workflow, pursuit handoff, latest-handoff reader, action-state store, audit event projection, and latest-handoff routes.
- `npm run build` passed; Next.js build output includes `/api/opportunities/live-handoff/latest`, `/api/opportunities/live-handoff/latest/tasks/[taskId]`, and `/opportunities/live-handoff`.

Remaining after this slice:
- Move the action-state and audit-event ledger into DB-backed runtime tables once PostgreSQL connectivity is restored.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Handoff Submission Gate

Status: implemented and verified.

Purpose: give operators and automation a single machine-readable verdict for whether the current live response handoff is ready to submit, blocked, or still in progress.

Changes in this slice:
- Added a submission-readiness summary derived from latest handoff tasks and task action states.
- The readiness summary tracks status, completed task count, blocked task IDs, pending task IDs, incomplete critical task IDs, completed tasks missing evidence, reasons, and latest task update timestamp.
- `GET /api/opportunities/live-handoff/latest` now returns the readiness summary alongside action states and action events.
- Task update responses now return the refreshed readiness summary after each status/evidence change.
- `/opportunities/live-handoff` now renders a Submission Gate panel with status, completion ratio, blocker count, critical-open count, reasons, and last update time.

Verification:
- `npm test -- latest-live-pursuit-handoff.test.ts live-pursuit-handoff-action-state.test.ts live-handoff-latest-route.test.ts --run` passed with 14 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 41 tests across response package, qualification workflow, pursuit handoff, latest-handoff reader, action-state store, readiness summary, audit event projection, and latest-handoff routes.
- `npm run build` passed; Next.js build output includes `/api/opportunities/live-handoff/latest`, `/api/opportunities/live-handoff/latest/tasks/[taskId]`, and `/opportunities/live-handoff`.

Remaining after this slice:
- Move the action-state, audit-event ledger, and submission-readiness verdict into DB-backed runtime tables once PostgreSQL connectivity is restored.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Handoff Response Artifact Links

Status: implemented and verified.

Purpose: let operators open the generated response package and qualification artifacts directly from the live handoff surface instead of hunting through proof directories.

Changes in this slice:
- Expanded the latest handoff reader to load the full handoff JSON referenced by the stable index when available.
- Added typed artifact links for handoff proof artifacts, primary response drafts, review-queue response drafts, qualification package artifacts, and qualification workflow artifacts.
- Preserved source run ID, source kind, opportunity title, path, kind, and human-readable labels on each artifact link.
- Updated `/opportunities/live-handoff` to group and display the response package artifacts by purpose.

Verification:
- `npm test -- latest-live-pursuit-handoff.test.ts live-handoff-latest-route.test.ts --run` passed with 9 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 41 tests across response package, qualification workflow, pursuit handoff, latest-handoff reader, action-state store, readiness summary, audit event projection, and latest-handoff routes.
- `npm run build` passed; Next.js build output includes `/api/opportunities/live-handoff/latest`, `/api/opportunities/live-handoff/latest/tasks/[taskId]`, and `/opportunities/live-handoff`.

Remaining after this slice:
- Replace filesystem proof artifact paths with authenticated download/review URLs once the response package is persisted in DB/object storage.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Authenticated Handoff Artifact Reader

Status: implemented and verified.

Purpose: make live handoff response artifacts openable from the product while preventing arbitrary filesystem reads.

Changes in this slice:
- Added server-side artifact content lookup that only reads paths already exposed by the latest live handoff artifact list.
- Added authenticated `GET /api/opportunities/live-handoff/latest/artifacts?path=...` to serve allowlisted Markdown/JSON handoff artifacts inline.
- The artifact route rejects missing paths, unauthenticated requests, and paths not present in the latest handoff artifact list.
- Updated `/opportunities/live-handoff` artifact entries to open through the authenticated artifact route instead of showing inert filesystem paths only.

Verification:
- `npm test -- latest-live-pursuit-handoff.test.ts live-handoff-latest-route.test.ts --run` passed with 12 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 44 tests across response package, qualification workflow, pursuit handoff, latest-handoff reader, authenticated artifact reads, action-state store, readiness summary, audit event projection, and latest-handoff routes.
- `npm run build` passed; Next.js build output includes `/api/opportunities/live-handoff/latest/artifacts` plus the latest handoff routes and `/opportunities/live-handoff`.

Remaining after this slice:
- Replace proof-file reads with DB/object-storage backed artifact downloads once PostgreSQL and durable object storage persistence are available.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Broader RFP Collection Defaults

Status: implemented and verified.

Purpose: make unattended RFP sourcing broader and more reliable by default, because source collection is the most important capability.

Changes in this slice:
- Added a broad default SearXNG query profile for submission-deadline RFPs, consultancy RFPs, ICT tender notices, software development tenders, grant-management systems, health information systems, and consulting EOIs.
- Expanded the configured source catalog from 10 to 19 procurement portals, adding World Bank tender notices, ADB, AIIB, IsDB, EBRD, USAID, SAM.gov, EU Funding & Tenders, and GIZ alongside the existing Kenya PPIP, UNGM, UNDP, World Bank projects, AFDB, dgMarket, COMESA, UN, and UNICEF sources.
- Increased bounded default source scrape, top-result scrape, and source document download limits from 10/3/3 to 15/5/5.
- Defaulted SearXNG engines to `duckduckgo,bing` after live probes showed DuckDuckGo returning RFP hits while Google was access-denied and Brave was rate-limited.
- Preserved explicit source-only runs: callers can still pass `sourceUrls` without query fields to scrape only configured sources.
- Returned scheduled preset warnings so SearXNG engine degradation, source scrape failures, empty sources, browser fallback use, and source document download failures are visible to operators.
- Updated the opportunity discovery runbook with the broad default profile and warning review guidance.

Verification:
- `npm test -- default-discovery-sources.test.ts opportunity-discovery-route.test.ts opportunity-discovery-presets-route.test.ts --run` passed with 14 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-discovery-rfp-response-bridge` passed with 62 tests across default sources, dgMarket parsing, discovery import, opportunity document intake, RFP document service, and proposal document scope.
- Live SearXNG probe against `https://search.lindela.io` for `"request for proposals" Africa submission deadline` with `duckduckgo,bing` returned actionable DuckDuckGo RFP results.

Current count check:
- Confirmed-current persisted count against `db.lindela.io:5432/docfusion`: 2,602 total opportunities, including 1,596 `rfp` opportunities.
- `rfp_documents` currently has 0 rows after proof cleanup; source RFP document persistence is verified by live proof but no long-lived RFP document rows remain in the app database yet.

Remaining after this slice:
- Run the broad default collection profile through the authenticated API against `db.lindela.io`, then measure imported/updated/skipped/failed rows and source warning rates.
- Add source-health rollups so chronically empty or degraded sources are visible before they cause missed RFPs.

### 2026-05-28 - db.lindela.io Database Verified

Status: implemented and verified.

Purpose: create or verify the production app database on `db.lindela.io` so live persisted opportunity sourcing and response proofs are no longer blocked by PostgreSQL connectivity.

Result:
- Verified `docfusion` already exists on `db.lindela.io:5432` for user `docfusion`.
- Verified the app database opens and contains the expected `opportunities` and `rfp_documents` tables.
- Counted 2,602 persisted opportunities, including 1,596 `rfp` opportunities.
- Counted 0 persisted `rfp_documents` rows after live proof cleanup.
- Reran `live-persisted-import-response` with `frontend/.env.local` explicitly exported; it passed against `db.lindela.io:5432/docfusion` with schema preflight `passed`.
- The passing proof persisted and verified one UNGM opportunity, one source document, one RFP document, 24 RFP requirements, six proposal documents, six response documents, and three win themes, then restored all proof rows to zero remaining cleanup rows.

Verification:
- `psql` against the maintenance database confirmed `docfusion` exists.
- `psql` against `docfusion` confirmed `current_database = docfusion`, `current_user = docfusion`, `to_regclass('public.opportunities') = opportunities`, and `to_regclass('public.rfp_documents') = rfp_documents`.
- `npm run platform:proof -- --run live-persisted-import-response --include-live-safe` passed when run with `frontend/.env.local` sourced.

Revalidation:
- `psql` against `frontend/.env.local` confirmed the app URL targets `db.lindela.io:5432/docfusion` as user `docfusion`; PostgreSQL reports server address `62.84.181.55:5432`.
- `psql` against the maintenance database confirmed `docfusion` exists with UTF8 encoding.
- `psql` against `docfusion` counted 158 public tables and confirmed app-user `connect`, public-schema `usage`, and `select,insert,update,delete` privileges on `opportunities`.
- Current persisted counts remain 2,602 total opportunities, including 1,596 `rfp` opportunities, and 0 long-lived `rfp_documents` rows after proof cleanup.

Follow-up:
- The first unsourced proof attempt still used a stale ambient `DATABASE_URL` for `88.80.188.224/lnd`; keep live proof commands explicitly sourced from `frontend/.env.local` or clean the ambient shell environment.
- `live-kenya-ppip-persisted-import-response` now reaches `db.lindela.io:5432/docfusion`; subsequent work made its source extraction resilient when Docling is unavailable or returns empty text.

### 2026-05-28 - Kenya PPIP Persisted Proof Extraction Fallback

Status: implemented and verified.

Purpose: keep the Kenya PPIP persisted import-to-response path working when the first selected tender document is scanned, empty under non-OCR Docling extraction, or Docling itself is temporarily unavailable.

Changes in this slice:
- Ranked all direct-document response-ready source candidates instead of aborting after the first matching Kenya PPIP opportunity.
- Continued to the next candidate when document extraction or response package readiness fails.
- Escalated Docling retries from fast non-OCR extraction to OCR/table extraction.
- Added a local `pdf-parse` fallback for PDF source documents when Docling health or conversion fails.
- Validated extracted source text for minimum length and procurement-response indicators before building the response package.

Verification:
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-kenya-ppip-persisted-import-response --include-live-safe` passed with `frontend/.env.local` sourced.
- Passing proof run `live_kenya_ppip_persisted_import_response_20260528T034945Z` used source `https://tenders.go.ke/tenders`, saw 834 total Kenya PPIP opportunities, selected `PROVISION OF COMPANY SECRETARIAL SERVICES`, extracted 78,876 characters from the PDF with `doclingStatus: local_pdf_parse`, built a ready-for-review response package, persisted one opportunity, one source document, one RFP document, 24 requirements, six proposal documents, six response documents, and 14 win themes, then restored all proof rows to zero remaining cleanup rows.

Remaining after this slice:
- Recheck Docling service health on `84.247.181.100:3600`; the proof is now resilient to that outage, but Docling should still be restored for richer extraction/OCR coverage.
- Promote the same local PDF fallback into the user-facing RFP document ingestion path if live operators hit the same Docling outage outside proof runs.

### 2026-05-28 - Broad Live RFP Collection Source Health

Status: implemented and verified.

Purpose: make broad RFP collection auditable source-by-source and run the default live collection profile against `db.lindela.io` so weak sources, parser gaps, and schema problems are visible instead of hidden in row-level warnings.

Changes in this slice:
- Added `sourceHealth` rollups to discovery import results and persisted import audit config, including per-source status, candidate/import/update/skip/fail counts, warning counts, and warning-type totals.
- Returned source-health rollups from scheduled discovery preset runs.
- Added `scripts/run-live-discovery-import.ts` to execute the broad default discovery profile against the configured live DB, write JSON proof artifacts, and append live evidence.
- Made explicit service discovery imports work outside a request-scoped NextAuth context, so API-key/scripted collection can use the configured service actor and organization.
- Normalized live source IDs to the deployed `opportunities.source_id` 50-character limit with a stable hash suffix; this fixed AFDB, COMESA, and UNICEF source rows that previously failed insert because portal slugs were too long.
- The live runner now forces `frontend/.env.local` for `DATABASE_URL` before loading the DB module, preventing stale ambient shell DB URLs from sending collection runs to `88.80.188.224/lnd`.

Verification:
- `npm test -- discovery-opportunity-import.test.ts opportunity-discovery-route.test.ts opportunity-discovery-presets-route.test.ts --run` passed with 36 tests.
- `npx tsc --noEmit --pretty false` passed.
- Full broad live run `live_discovery_import_20260528T041642Z` reached `db.lindela.io`, processed 121 candidates, imported 112 opportunities, created 134 source-document rows, downloaded 5 bounded source documents, and persisted 19 source-health rollups. Its source-health result showed 5 healthy sources, 6 degraded sources, 8 empty sources, and 0 source-scrape failures.
- The full broad run surfaced 9 row failures from overlong source IDs. After source-ID normalization, targeted live run `live_discovery_import_20260528T042913Z` against the failed AFDB, COMESA, and UNICEF source groups processed 17 candidates with 9 imports, 8 updates, 0 failures, 14 new source-document rows, and 4 healthy source-health rollups persisted in import `f584f07a-8366-4ba2-a737-be94af08f8f8`.
- Current `db.lindela.io:5432/docfusion` counts after the live collection runs: 2,723 total opportunities, 1,611 `rfp` opportunities, and 164 `opportunity_documents` rows.

Remaining after this slice:
- Restore Docling on `84.247.181.100:3600`; broad collection can seed/download source documents, but Docling refused live parse requests during the run.
- Apply or repair the deployed workflow runtime migration for `workflow_instances.organization_id`; document downloads succeeded, but parse-queue workflow recording warned that the live table is missing that column.
- Improve parsers or source-specific clients for the sources now marked empty: `tenders.worldbank.org`, ADB, EBRD, DGMarket, USAID, SAM.gov, EU Funding & Tenders, and GIZ.

### 2026-05-28 - Live Workflow Tenant Migration Repair

Status: implemented and verified.

Purpose: remove the live parse-queue workflow warning surfaced by broad RFP collection after source documents downloaded successfully but workflow recording failed because `workflow_instances.organization_id` was missing on `db.lindela.io`.

Changes in this slice:
- Applied `frontend/drizzle/0025_workflow_instances_tenant.sql` to `db.lindela.io:5432/docfusion`; it added `workflow_instances.organization_id`, backfilled the existing workflow row, and created `workflow_instances_organization_idx`.
- Added `0025_workflow_instances_tenant.sql` to `scripts/apply-workflow-runtime-migrations.ts`, so future workflow migration runs include the tenant repair instead of stopping at `0017`.
- Added `workflow_instances.organization_id` to `scripts/validate-workflow-runtime-migration.ts` required columns.
- Added a shared `scripts/env-utils.ts` helper and used it from workflow migration/validation plus the live discovery import runner so `.env.local` overrides stale ambient `DATABASE_URL` for live operational scripts.

Verification:
- `psql` against `frontend/.env.local` confirmed `workflow_instances.organization_id` exists, the existing workflow row is backfilled (`1/1` non-null), and `workflow_instances_organization_idx` exists.
- `npm run workflow:validate-db` passed against `db.lindela.io` and now requires `workflow_instances.organization_id`.
- `npm run workflow:migrate-db` passed idempotently and applied `0016_workflow_runtime.sql`, `0017_workflow_template_governance.sql`, and `0025_workflow_instances_tenant.sql`.
- `npx tsc --noEmit --pretty false` passed.

Remaining after this slice:
- Restore Docling on `84.247.181.100:3600` or promote local PDF parsing into user-facing source-document parse intake so downloaded RFP documents continue into structured response generation during Docling outages.
- Run another bounded live discovery download after Docling/workspace defaults are repaired to prove downloaded source documents enqueue and parse without warnings.

### 2026-05-28 - Persisted Proof Recheck Still DB Blocked

Status: superseded by later `db.lindela.io` verification and Kenya PPIP extraction fallback.

Purpose: recheck the DB-backed persisted import-to-response path after the latest live handoff and operator-index work, now that broader verification is allowed again.

Attempted:
- `npm run platform:proof -- --run live-persisted-import-response --include-live-safe` failed with run `live_persisted_import_response_20260528T012823Z`.
- `npm run platform:proof -- --run live-kenya-ppip-persisted-import-response --include-live-safe` failed with run `live_kenya_ppip_persisted_import_response_20260528T012841Z`.

Result:
- Both proofs failed before source discovery, source document persistence, RFP parsing, requirement persistence, response draft persistence, or cleanup rows because PostgreSQL refused the connection to `88.80.188.224:5432`.
- Both evidence rows record database host `88.80.188.224`, port `5432`, database `lnd`, schema preflight `not-run`, 0 persisted rows, and `idempotent-noop` cleanup.

Remaining after this slice:
- Restore PostgreSQL connectivity to `88.80.188.224:5432`, then rerun `live-persisted-import-response` and `live-kenya-ppip-persisted-import-response`.
- Continue using the live-safe non-DB source/readiness/portfolio/handoff path as the currently verified live execution path.

### 2026-05-28 - Live Pursuit Handoff Bundle

Status: implemented and verified.

Purpose: bundle the latest live portfolio ranking, response drafts, and qualification workflow artifacts into a single operator-ready handoff so generated work is actionable without searching proof logs.

Changes in this slice:
- Added a deterministic live pursuit handoff builder with a primary pursue-now opportunity, review queue, artifact links, next actions, and Markdown operator brief.
- Added validation so pursue-now handoffs require a full six-document response artifact set and non-proposal routes require a ready qualification workflow.
- Added `prove-live-pursuit-handoff.ts`, which reads the latest live portfolio proof, joins response-readiness artifact paths, writes handoff JSON/Markdown artifacts, verifies readback integrity, and appends dedicated evidence.
- Registered `live-pursuit-handoff` as a Wave 9 live-safe proof and expanded the response-readiness package proof to include handoff unit coverage.

Verification:
- `npm test -- live-pursuit-handoff.test.ts platform-proof-scenarios.test.ts --run` passed with 9 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run wave9-response-readiness-package` passed with 25 tests.
- `npm run platform:proof -- --run live-pursuit-handoff --include-live-safe` passed with run `live_pursuit_handoff_20260528T003748Z`, bundling source portfolio run `live_opportunity_portfolio_triage_20260528T003203Z`, primary AFDB pursuit `live_afdb_response_readiness_20260527T182825Z`, 3 review-queue candidates, and 32 linked artifacts.

Remaining after this slice:
- Persist pursuit handoffs and qualification workflows in the DB-backed runtime once PostgreSQL connectivity is restored.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.

### 2026-05-28 - Qualification Workflow Visibility in Portfolio Triage

Status: implemented and verified.

Purpose: make review-before-pursuit registration opportunities show whether an executable qualification workflow already exists in the operator portfolio ranking.

Changes in this slice:
- Added optional qualification workflow readiness metadata to live response portfolio candidates.
- Updated portfolio ranking reasons and operator briefs to show qualification workflow status, gate count, and blocked-gate count when available.
- Extended the live portfolio proof to read completed `live-qualification-workflow-proof.json` artifacts and attach the latest workflow readiness to its source response-readiness run.
- Added portfolio regression coverage for supplier-registration candidates with ready qualification workflows.

Verification:
- `npm test -- live-response-portfolio-triage.test.ts platform-proof-scenarios.test.ts --run` passed with 11 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run platform:proof -- --run live-opportunity-portfolio-triage --include-live-safe` passed with run `live_opportunity_portfolio_triage_20260528T003203Z`, consuming 1 qualification workflow artifact and surfacing `Qualification workflow: ready_for_operator_execution (5 gates, 0 blocked)` on the Kenya PPIP supplier-registration candidate.

Remaining after this slice:
- Persist qualification workflows in the DB-backed runtime once PostgreSQL connectivity is restored.
- DB-backed persisted import-response proof still depends on restoring PostgreSQL connectivity to `88.80.188.224:5432`.
