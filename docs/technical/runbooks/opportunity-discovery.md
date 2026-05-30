# Opportunity Discovery Operations

This runbook covers live opportunity discovery through SearXNG, Firecrawl, and the stealth browser fallback.

## Services

| Service | Default |
| --- | --- |
| SearXNG | `https://search.lindela.io` |
| Firecrawl | `http://84.247.181.100:3002` |
| Browser fallback | `http://84.247.181.100:3003` |

## Required Environment

Set these on the app server before enabling unattended discovery:

```bash
SCRAPER_API_KEY="long-random-secret"
DISCOVERY_IMPORT_USER_ID="app-user-id-that-owns-discovery-presets"
SEARXNG_URL="https://search.lindela.io"
FIRECRAWL_URL="http://84.247.181.100:3002"
STEALTH_SCRAPER_URL="http://84.247.181.100:3003"
```

`DISCOVERY_IMPORT_USER_ID` is the assignee for API-key and scheduled discovery runs. Scheduled preset runs only load presets owned by this user, so create or save live discovery presets while signed in as that account, or set the variable to the operator account that owns the presets.

When `SEARXNG_URL` is unavailable or reports engine degradation, the frontend importer and Python discovery service can fall back to other SearXNG instances. This includes partial degradation: if the primary host returns some results while any engine is unresponsive, including a default-engine search with no explicit `engines` list, the clients still fan out to fallback instances and merge the primary plus fallback result sets. Set `SEARXNG_FALLBACK_URLS` to a comma-separated trusted pool when available. If that is empty, public fallback discovery uses `https://searx.space/data/instances.json`, filters out failed/non-normal/zero-search-success instances, prefers instances whose `searx.space` engine metadata is healthy for the requested engine, and fans out across up to `SEARXNG_PUBLIC_FALLBACK_LIMIT` instances, defaulting to 8. Public instances often reject JSON API traffic with 403/429; the frontend client can parse standard SearXNG HTML result pages when JSON is unavailable, but operators should treat public fallback as best-effort coverage rather than a replacement for the Lindela SearXNG host. If public SearXNG fanout produces no usable results and DuckDuckGo was requested, the frontend client falls through to DuckDuckGo's lightweight HTML endpoint and merges those results into the degraded primary result set. Set `SEARXNG_PUBLIC_FALLBACKS=0` to disable public SearXNG fallbacks and `DUCKDUCKGO_DIRECT_FALLBACKS=0` to disable direct DuckDuckGo fallback for privacy-sensitive deployments.

Configured source scraping follows pagination links before applying each source's candidate cap. `CONFIGURED_SOURCE_MAX_PAGES` controls the maximum pages per source and defaults to 3, capped at 5. Keep it low for scheduled runs because every extra source page can add Firecrawl/browser work before source-document intake begins.

Source-document recovery uses progressively heavier acquisition paths when a direct public document URL fails: SearXNG candidate discovery, Firecrawl, the browser scraper, CloakBrowser when configured, and finally a public reader fallback for public landing pages that block server-side fetches. The reader fallback is controlled by `SOURCE_DOCUMENT_READER_FALLBACK_PREFIX`, defaulting to the current `r.jina.ai` reader prefix, and can be disabled with `SOURCE_DOCUMENT_READER_FALLBACKS=0`. Reader-recovered pages are stored as HTML source surrogates with `reader_landing_page_html` provenance so operators can distinguish them from direct PDF downloads. Direct source downloads keep public-host and DNS pinning checks even when a known procurement host has an incomplete TLS chain; `tenders.go.ke` and `nrf.ac.za` are allowed narrowly by default, and additional hosts can be added with comma-separated `SOURCE_DOCUMENT_INVALID_TLS_HOSTS` values only after live failure evidence.

## Manual Live Discovery

Operators can run live discovery from the Opportunities page with the `Discover` control. Use one query per line, save frequently used query sets as presets, and keep enrichment limits low unless inspecting high-value sources.

If the request body omits both `query`/`queries` and `sourceUrls`, the API runs the broad default collection profile. That profile combines curated procurement portals with procurement-intent SearXNG RFP queries, including submission-deadline RFPs, consultancy RFPs, ICT tender notices, software development tenders, grant-management systems, health information systems, monitoring and evaluation work, data platforms, ERP, cybersecurity, digital health, and regional consulting EOIs. Default search fans out through SearXNG across `google`, `duckduckgo`, `bing`, and `brave`; engine-specific denial or throttling is recorded as a warning while reachable engines continue importing candidates. To run source scraping only, pass an explicit `sourceUrls` array with no query fields.

## Source Document Intake Backpressure

`npm run source-docs:intake` is the bounded bridge from selected source-document rows into downloaded RFP documents and parser jobs. It prefers direct document URLs, then lower-attempt rows, then newer rows. The first selection pass keeps host diversity with `SOURCE_DOCUMENT_INTAKE_MAX_PER_HOST` defaulting to 2; the fill pass can relax that to `SOURCE_DOCUMENT_INTAKE_FILL_MAX_PER_HOST`, defaulting to three times the host cap. This keeps high-yield hosts from underfilling a batch without allowing one problematic host to consume the whole run.

Set `SOURCE_DOCUMENT_INTAKE_DIRECT_DOCUMENTS_ONLY=1` for a high-throughput drain of direct PDF/DOC/DOCX/XLS/ZIP rows and trusted national endpoints. This is useful after broad discovery when generic HTML detail pages from the same source platform would otherwise outrank direct documents and consume the batch.

Retry mode is still enabled by default for rows under `SOURCE_DOCUMENT_INTAKE_MAX_ATTEMPTS`, but known protected hosts that already returned 403 are suppressed from normal retries. Set `SOURCE_DOCUMENT_INTAKE_RETRY_PROTECTED_HOSTS=1` only for a targeted protected-portal recovery run; routine intake should leave it unset so recoverable AFDB/EBRD/archive failures can be retried without DGMarket crowding out the batch.

For API-key manual execution:

```bash
curl -s -X POST "$APP_URL/api/opportunities/discovery/run" \
  -H "Authorization: Bearer $SCRAPER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "queries": ["ICT tender Kenya", "digital transformation RFP Uganda"],
    "countryRegion": "East Africa",
    "category": "External discovery",
    "limitPerQuery": 10,
    "scrapeTopResults": true,
    "scrapeLimit": 5,
    "browserFallback": true,
    "downloadDiscoveredDocuments": true,
    "downloadLimit": 20
  }'
```

## Scheduled Preset Discovery

Dry-run the saved presets before enabling cron:

```bash
curl -s -X POST "$APP_URL/api/opportunities/discovery/presets/run" \
  -H "Authorization: Bearer $SCRAPER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true, "limit": 10}'
```

Run all saved presets owned by `DISCOVERY_IMPORT_USER_ID`, capped by the route default of 25:

```bash
curl -s -X POST "$APP_URL/api/opportunities/discovery/presets/run" \
  -H "Authorization: Bearer $SCRAPER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Run specific presets:

```bash
curl -s -X POST "$APP_URL/api/opportunities/discovery/presets/run" \
  -H "Authorization: Bearer $SCRAPER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"presetIds": ["preset-id-1", "preset-id-2"]}'
```

Example cron entry:

```cron
15 */6 * * * curl -s -X POST "$APP_URL/api/opportunities/discovery/presets/run" -H "Authorization: Bearer $SCRAPER_API_KEY" -H "Content-Type: application/json" -d '{"limit": 10}' >> /var/log/docfusion-discovery.log 2>&1
```

## Operating Guidance

- Keep scheduled runs sequential and bounded; the route intentionally runs presets one at a time.
- Use empty-body scheduled runs only when you want the broad default collection profile. For narrower monitoring, save presets with explicit queries and source lists.
- Start with `limitPerQuery` between 5 and 10 and `scrapeLimit` between 0 and 5.
- Enable `browserFallback` only for presets that target sources with frequent Firecrawl failures.
- Enable `downloadDiscoveredDocuments` for high-confidence presets; keep `downloadLimit` bounded so discovery can seed parser intake without turning broad search into an unbounded file-download run. The broad default profile currently uses 20, and the service hard-caps a single discovery run at 25 downloads.
- Use `dryRun` after changing `DISCOVERY_IMPORT_USER_ID` to confirm the scheduler can see the expected presets.
- Treat a response with `success: false` and `failedPresets > 0` as a partial failure; later presets may still have run and imported opportunities.
- Review returned preset `warnings` after every scheduled run. SearXNG engine degradation, primary-to-fallback search recovery, source scrape empties, Firecrawl failures, browser fallback use, and source document download failures are surfaced per preset so source coverage gaps are visible before they become missed RFPs.
