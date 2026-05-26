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
    "scrapeLimit": 3,
    "browserFallback": true
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
- Start with `limitPerQuery` between 5 and 10 and `scrapeLimit` between 0 and 3.
- Enable `browserFallback` only for presets that target sources with frequent Firecrawl failures.
- Use `dryRun` after changing `DISCOVERY_IMPORT_USER_ID` to confirm the scheduler can see the expected presets.
- Treat a response with `success: false` and `failedPresets > 0` as a partial failure; later presets may still have run and imported opportunities.
