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

## Manual Live Discovery

Operators can run live discovery from the Opportunities page with the `Discover` control. Use one query per line, save frequently used query sets as presets, and keep enrichment limits low unless inspecting high-value sources.

If the request body omits both `query`/`queries` and `sourceUrls`, the API runs the broad default collection profile. That profile combines curated procurement portals with procurement-intent SearXNG RFP queries, including submission-deadline RFPs, consultancy RFPs, ICT tender notices, software development tenders, grant-management systems, health information systems, and regional consulting EOIs. Default search is limited to `duckduckgo,bing` because live checks showed those engines are reachable while other engines may deny or rate-limit. To run source scraping only, pass an explicit `sourceUrls` array with no query fields.

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
    "downloadLimit": 5
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
- Enable `downloadDiscoveredDocuments` only for high-confidence presets; keep `downloadLimit` between 1 and 5 so discovery can seed parser intake without turning broad search into an unbounded file-download run.
- Use `dryRun` after changing `DISCOVERY_IMPORT_USER_ID` to confirm the scheduler can see the expected presets.
- Treat a response with `success: false` and `failedPresets > 0` as a partial failure; later presets may still have run and imported opportunities.
- Review returned preset `warnings` after every scheduled run. SearXNG engine degradation, source scrape empties, Firecrawl failures, browser fallback use, and source document download failures are surfaced per preset so source coverage gaps are visible before they become missed RFPs.
