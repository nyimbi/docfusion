---
id: task-043
title: "Phase 7: Universal Discovery Expansion"
status: To Do
phase: 7
priority: High
---

# task-043 - Phase 7: Universal Discovery Expansion

## Description (the why)

Today's discovery stack covers ~8 sources (AFDB, UNGM, UNDP, WorldBank, DGMarket, Firecrawl-backed generic, site-specific parsers). That misses SAM.gov, TED (EU), UK Contracts Finder, state portals, private aggregators, RSS feeds, and email-forwarded RFPs. Reliability is also fragile: one broken HTML change can kill a whole run, there is no coverage proof, no dedup across sources, and no way to know an RFP was missed.

Goal: move from opportunistic scraping to **provable coverage** — every RFP from every known source, deduplicated, fingerprinted, ingested, and searchable.

## Acceptance Criteria (the what)

- [ ] Source catalog in `backend/discovery/sources/registry.yaml` lists ≥100 sources across five classes: government (federal/state/local), multilateral (UN/WB/ADB/EIB), private aggregators, RSS/Atom feeds, email inbox.
- [ ] `SourceConnector` protocol exists; every source implements one of: `HttpApiConnector`, `ScraperConnector`, `RssConnector`, `ImapConnector`, `SitemapConnector`.
- [ ] Per-source health scores tracked in `discovery_source_health` table (success rate, last-success, error class).
- [ ] Dead-letter queue (`discovery_fetch_failures`) captures every failed fetch with payload for replay.
- [ ] Fingerprint-based cross-source dedup (SHA256 of normalized title + buyer + deadline) prevents the same RFP appearing twice.
- [ ] Change-detection via `ETag` / `Last-Modified` / content-hash — unchanged pages skip re-parse.
- [ ] Multi-parser consensus: Docling + pypdf + Tika; OCR fallback via Tesseract for scanned PDFs.
- [ ] pgvector embedding index over parsed RFP text; `/api/v1/discovery/similar/{id}` returns near-duplicates.
- [ ] Baseline coverage test: `tests/ci/test_discovery_baseline.py` asserts a fixed set of 20 known RFP IDs is discovered on every run; missing any is a CI failure.
- [ ] Weekly coverage report generated to `backlog/docs/discovery-coverage-YYYY-WW.md`.
- [ ] Observability: per-source panels in the Grafana dashboard from task-042.

## Implementation Plan (the how)

**Break this umbrella task into subtasks** (each runs as a separate Backlog item via `backlog task create -p 043`):

**Sub-043-01 — Source registry and connector protocol**
- Create `backend/discovery/sources/registry.yaml` with the full source catalog (start with 20, grow to 100 over the phase).
- Define `SourceConnector` Protocol in `backend/discovery/connectors/base.py` with `fetch_list()`, `fetch_detail(id)`, `fetch_document(url)`, `health_check()`.
- Implement `HttpApiConnector`, `ScraperConnector`, `RssConnector`, `ImapConnector`, `SitemapConnector` base classes.
- Tests: instantiate each class, call `health_check()` against a fixture server.

**Sub-043-02 — Add high-value government + multilateral sources**
- SAM.gov (HTTP API, opportunities endpoint, API key in SecretsManager).
- TED EU (daily XML dump download + parse).
- UK Contracts Finder (HTTP API).
- ADB, EIB, IADB, AFD (per-site parsers).
- Tests: fetch first page of each, assert ≥1 row returned.

**Sub-043-03 — Private aggregators + RSS/Atom**
- BidNet, GovWin (if licensed — config-gate behind API key presence).
- 10+ RSS feeds for departmental procurement pages.
- Tests: RSS parser handles both Atom and RSS 2.0; missing feed degrades gracefully.

**Sub-043-04 — Email ingestion**
- `ImapConnector`: poll a dedicated inbox (e.g., `rfp-feeds@docfusion.example`), parse attachments, inject as `opportunity_documents`.
- Strip signatures, quoted replies. Detect forwarded headers.
- Tests: process fixture mbox with 3 messages, assert 3 opportunities created.

**Sub-043-05 — Reliability: dead-letter queue, retry, health scoring**
- Alembic migration: `discovery_source_health`, `discovery_fetch_failures` tables.
- Wrap every connector call in `with_retry()` (exponential backoff, max 3 attempts).
- On terminal failure, write to DLQ; expose `/api/v1/discovery/dlq` endpoint with replay button.
- Health score = 7-day rolling success rate; drives alert when <80%.
- Tests: connector that always fails lands 3 rows in DLQ; health score decays correctly.

**Sub-043-06 — Change detection**
- `discovery_fetch_cache` table keyed on URL: stores `etag`, `last_modified`, `content_hash`, `fetched_at`.
- Before re-fetch, send `If-None-Match` / `If-Modified-Since`; on 304, skip.
- For sources without caching headers, compare SHA256 of body and short-circuit if unchanged.
- Tests: second fetch of unchanged URL does NOT trigger parse.

**Sub-043-07 — Fingerprint dedup across sources**
- Normalize fields (lowercase, strip whitespace, canonicalize currency symbols, parse deadlines to UTC).
- `fingerprint = sha256(f"{normalized_title}|{buyer}|{deadline_iso}|{value_bucket}")`.
- Unique index on `opportunities.fingerprint`; on conflict, UPDATE with best-quality source (higher health score wins).
- Tests: same RFP from 3 sources produces 1 row; later update from highest-health-score source wins.

**Sub-043-08 — Multi-parser consensus + OCR**
- `backend/discovery/parsers/consensus.py`: run Docling + pypdf + Tika in parallel; pick the longest coherent extraction (tie-break: Docling wins).
- Scanned-PDF detection: if text layer <50 chars and pages >0, run Tesseract OCR.
- Tests: native PDF → all three agree; scanned PDF → OCR fallback engages; corrupt PDF → all three fail → DLQ.

**Sub-043-09 — Semantic / pgvector index**
- Alembic migration: `rfp_embeddings(rfp_id, model, chunk_index, embedding vector(1536))`.
- On parse, embed each 500-char chunk via LiteLLM `text-embedding-3-small`.
- `/api/v1/discovery/similar/{id}` returns top-K nearest by cosine.
- Tests: two near-duplicate RFPs have similarity >0.85; unrelated RFPs <0.5.

**Sub-043-10 — Coverage baseline + weekly report**
- `tests/ci/fixtures/discovery-baseline.yaml`: 20 RFP identifiers that must appear every run (pick stable, long-deadline ones).
- `tests/ci/test_discovery_baseline.py`: runs all connectors in dry mode, asserts every baseline ID appears.
- Weekly job (systemd timer) generates `backlog/docs/discovery-coverage-YYYY-WW.md`: new RFPs found, per-source success rate, DLQ summary, embedding index health.
- Tests: missing a baseline ID fails the CI job with a clear message naming the missing source.

**Sub-043-12 — Pan-African government coverage (ALL 54 AU states + EH/RE/YT/SH, full stack)**

Goal: every national, ministerial, state/provincial, and municipal procurement portal across **every African country without exception** — all 54 African Union member states plus Western Sahara (EH) and African dependencies (Réunion, Mayotte, St Helena). Every working language (EN / FR / PT / AR / SW + local).

**Hard rule**: coverage gaps are bugs. A country missing from the registry fails CI. A country with zero discovered sources after initial sweep triggers an incident ticket, not silent omission. No exceptions for "hard" jurisdictions — offline-only countries (Eritrea, Somalia, South Sudan, CAR, Chad) route through 12j's manual-operator queue, but the country MUST appear in the registry and health dashboard.

**12a — Country catalog seed (GeoNames-backed).** `backend/discovery/sources/africa/registry.yaml`: 54 country entries, each with `iso_a3`, `languages`, `national_portal`, `ministries[]`, `gazette_url`, `central_bank_url`. Seed from: AfDB country profiles, UNPAN, Open Contracting Partnership country pages, Wikipedia procurement sections.

**Subdivisions + municipalities come from GeoNames** — not hand-curated. Import the GeoNames free dataset (`allCountries.zip` or per-country dumps like `NG.zip`, `KE.zip`, ...) into a local `geonames_places` table:

```sql
CREATE TABLE geonames_places (
    geonameid INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    asciiname TEXT,
    alternatenames TEXT,
    latitude FLOAT, longitude FLOAT,
    feature_class CHAR(1),  -- 'A' admin, 'P' populated place
    feature_code TEXT,      -- ADM1/ADM2/ADM3/PPL/PPLA/PPLC
    country_code CHAR(2),
    admin1_code TEXT, admin2_code TEXT, admin3_code TEXT,
    population BIGINT,
    timezone TEXT
);
CREATE INDEX ON geonames_places (country_code, feature_code);
CREATE INDEX ON geonames_places USING gin (to_tsvector('simple', name));
```

Loader script `backend/discovery/geonames_loader.py`:

```python
async def load_africa() -> None:
    # All 54 AU member states + Western Sahara (EH) + dependencies
    # (Réunion/RE, Mayotte/YT, St Helena/SH). 58 entries. Zero omissions.
    AFRICA_ISO2 = [
        "DZ","AO","BJ","BW","BF","BI","CM","CV","CF","TD","KM","CG","CD",
        "CI","DJ","EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE",
        "LS","LR","LY","MG","MW","ML","MR","MU","MA","MZ","NA","NE","NG",
        "RW","ST","SN","SC","SL","SO","ZA","SS","SD","TZ","TG","TN","UG",
        "ZM","ZW",
        "EH","RE","YT","SH",
    ]
    assert len(AFRICA_ISO2) == 58, "coverage regression: African country list shrank"
    for iso2 in AFRICA_ISO2:
        await _download_and_import(f"https://download.geonames.org/export/dump/{iso2}.zip")
```

Then populate registry via query:

```sql
-- ADM1 (states/provinces/regions):
SELECT name FROM geonames_places
WHERE country_code = 'NG' AND feature_code = 'ADM1'
ORDER BY name;

-- Municipalities (top populated places per ADM1, threshold configurable):
SELECT name, admin1_code, population FROM geonames_places
WHERE country_code = 'NG'
  AND feature_class = 'P'
  AND feature_code IN ('PPLA','PPLA2','PPLA3','PPLC','PPL')
  AND population > 10000
ORDER BY admin1_code, population DESC;
```

Target enumeration per country:
- **All ADM1** (typically 5-50 per country) — every state/province/region.
- **Top N ADM2** by population — district/county level, N = 50 default.
- **All ADM3 + populated places with population >50,000** — captures every real municipality.

For Nigeria alone that yields 36 states + 774 LGAs + all major cities. Pan-Africa total: ~500 ADM1 + ~5,000 ADM2 + ~15,000 municipalities above the population threshold. Every one is a candidate procurement source. Exhaustive coverage.

Use alternate-name language filtering to discover portals by local-language endonyms (Lagos vs. Èkó, Addis Ababa vs. አዲስ አበባ) — widens crawl hit rate.

**12a-tests**: `tests/ci/test_geonames_coverage.py` asserts every African ISO-2 has ≥1 ADM1 row, ≥5 municipalities, and that top-10 populated places are present (spot-check Lagos/NG, Nairobi/KE, Cairo/EG, Johannesburg/ZA, Kinshasa/CD).

**12b — National portal connectors.** One `ScraperConnector` per country's central e-procurement system. Priority order: Kenya (tenders.go.ke, PPIP), Nigeria (BPP nocopo.bpp.gov.ng), South Africa (etenders.gov.za, CSD), Egypt (etenders.gov.eg), Morocco (marchespublics.gov.ma), Ghana (ppa.gov.gh), Ethiopia (ppa.gov.et), Rwanda (umucyo.gov.rw), Senegal (marchespublics.sn), Tanzania (nest.go.tz), Uganda (egpuganda.go.ug), Algeria, Tunisia, Côte d'Ivoire, Cameroon, Angola, Mozambique, Zambia, Zimbabwe, Botswana, Namibia. Then fill remaining 33. One connector per country, one per architectural pattern (most reuse 3-4 patterns: PPIP-like, Develoop, custom PHP, WordPress/Elementor).

**12c — Ministerial + subdivision crawlers.** `SitemapConnector` variant that crawls a ministry/state domain looking for `tender|procurement|bid|rfp|appel d'offres|concours|licitação|مناقصة` in URL path or page title. Use LLM-extractor fallback (Firecrawl + `gpt-4o-mini`) on pages that don't match structured patterns. Rate-limit per-domain (1 req/sec default, configurable per source).

**12d — Municipal + local government sweep (GeoNames-driven).** Drive the crawl from the `geonames_places` table populated in 12a. For each row, build candidate URLs and probe:

```python
def candidate_urls(place_name: str, iso2: str) -> list[str]:
    tld = COUNTRY_TLD[iso2]  # e.g. "gov.ng", "go.ke", "gov.za"
    slug = slugify(place_name)       # "lagos"
    ascii_slug = slugify(asciiname)  # for non-Latin names
    alts = slugify_each(alternate_names)  # endonyms + exonyms
    paths = ["tenders","procurement","bids","rfp",
             "appels-d-offres","appels_doffres","marches-publics",
             "licitacoes","concursos","مناقصات"]
    hosts = [f"{s}.{tld}" for s in [slug, ascii_slug, *alts]]
    hosts += [f"www.{h}" for h in hosts]
    return [f"https://{h}/{p}" for h in hosts for p in paths]
```

Probe with HEAD (fall back to GET on 405); 2xx or HTML containing tender keywords → register as `discovered` source. 404/ConnectionError → mark `attempted, failed` in `discovery_source_health`. Record success rate per country.

Concurrency: 50 parallel probes, 1 req/sec per host, `aiohttp` with short timeout (5s). Expected volume: ~300k probe attempts across Africa, ~2-5% hit rate → ~10,000-15,000 live municipal procurement pages discovered automatically.

Re-run monthly (municipal sites come online constantly).

**12d-tests**: given a fixture HTTP server with 3 "municipality" endpoints, the sweep discovers 3 of 3 with zero false positives.

**12e — Gazette + PDF-only sources.** Many African governments publish RFPs only in the official gazette (weekly/monthly PDF). `GazetteConnector`: downloads gazette PDF, OCR + LLM-classify each page, extract RFP-shaped sections. Languages: EN/FR/PT/AR with per-language OCR models.

**12f — Multilingual extraction.** Extend `RequirementExtractor` prompt library with French, Portuguese, Arabic, Swahili, Amharic templates. Detect language from document metadata + first 500 chars; route to correct prompt. LiteLLM model selection: `gpt-4o` for Arabic/Amharic (right-to-left and complex scripts), `gpt-4o-mini` elsewhere.

**12g — Regional aggregators as cross-check.** Ingest AfDB, AFREXIMBANK, EBID, BOAD, EADB, AUDA-NEPAD, COMESA, ECOWAS, SADC, EAC tender portals. These publish the same RFPs seen on national portals — use as **coverage validator**: if a tender appears on AfDB but not on the originating country portal, raise an alert (source missed).

**12h — Political context + access constraints.** Per-country notes in registry: sanctions restrictions (currently Libya/Sudan/South Sudan sensitive), connectivity reliability (retry strategy tuned), TLS cert issues (many portals use self-signed or expired certs — explicit allowlist per source, NOT global `verify=False`), Cloudflare challenge pages (route via stealth-scraper with residential proxy).

**12i — Coverage verification per country (zero-omission gate).** Extend `tests/ci/fixtures/discovery-baseline.yaml`: ≥2 stable known RFPs per country (operator-sourced where portals are offline). Weekly coverage report breaks out by country and highlights gaps. Goal: discover ≥95% of RFPs listed in cross-reference sources (AfDB + OCP + country gazettes).

**Mandatory CI gate**: `tests/ci/test_africa_completeness.py` asserts:
1. Every one of the 58 ISO-2 codes in `AFRICA_ISO2` appears in the registry.
2. Every country has a non-empty `national_portal` OR an active entry in the manual-operator queue.
3. Every country has ≥1 ADM1 row in `geonames_places`.
4. Every country has a baseline RFP fixture (or an explicit `manual_queue_only: true` flag with a linked operator ticket).

A PR that removes any country from coverage fails this test. No "temporary" removals.

**12j — Known-hard countries — manual operator queue.** For countries where portals are offline, paywalled, or phone-only (Eritrea, Somalia, parts of CAR, DRC, Chad): provide a manual-submission web form / email inbox per country. Operators in-country submit PDFs or links; system ingests same as other sources. Tracked in `discovery_manual_queue`.

**Sub-043-13 — Language and script hardening**
- UTF-8 / BiDi-safe rendering in frontend for Arabic RFPs.
- Search index tokenizer configured per-language (PostgreSQL FTS dictionaries: english, french, portuguese, arabic, swahili).
- Currency normalization: XOF, XAF, NGN, EGP, ZAR, KES, GHS, MAD, TND, DZD, ETB, + 40 others → USD bucket for comparison, original preserved.
- Date parsing: Gregorian, Islamic Hijri, Ethiopian (Ge'ez) calendars → canonical UTC.

**Sub-043-11 — Observability panels**
- Extend the Grafana dashboard from task-042:
  - Per-source success rate (time series)
  - DLQ depth (gauge + 7-day trend)
  - Parser consensus agreement rate
  - Embedding index size + nearest-neighbor latency
  - Coverage baseline status (green/red per source)
  - **Africa map view**: country-by-country heatmap of discovery health (green: portal reachable + ≥1 RFP/week; amber: reachable but no RFPs; red: unreachable)
  - Per-language extraction success rate
  - Manual-queue backlog (sub-043-12j)
- Alert rules: source health <80% for 1h; DLQ depth >100; baseline failing.

## Sequencing

Work sub-043-01 and sub-043-05 first — they are the foundation. Then parallelize sub-043-02, sub-043-03, sub-043-04 across engineers. sub-043-06 through sub-043-11 land next. **sub-043-12 (pan-African sweep) runs in parallel starting week 2** — it is the largest single body of work and depends only on sub-043-01 + sub-043-05 + sub-043-08 (multi-parser consensus, needed for gazettes). sub-043-13 (language hardening) runs alongside 043-12.

Target: 10 calendar weeks, 12 engineer-weeks (was 4 — pan-African expansion triples the effort).

**Staffing note**: pan-African coverage benefits from in-region operators. Consider engaging a contractor per AU sub-region (North, West, East, Central, Southern) who can validate portals, handle captcha/2FA access, and populate the manual queue for offline jurisdictions.

## Notes for less-capable agents

- Do NOT commit vendor API keys. Every credential flows through SecretsManager.
- When adding a source, always add its baseline RFP IDs to the coverage fixture — otherwise regressions go undetected.
- The fingerprint must be stable across minor title changes (whitespace, punctuation). Test with adversarial inputs.
- OCR is expensive. Only trigger it when the text layer is genuinely empty, not as a first-pass.
- Respect robots.txt, rate limits, and terms of service per source. If a site forbids scraping, route via a licensed aggregator or drop the source with an ADR.
- Many African procurement portals have certificate or encoding issues. Do NOT disable TLS verification globally. Add per-source exceptions in the registry with a dated justification, and open a ticket to notify the operator.
- Language detection is not optional. Running the English prompt on a French RFP silently wrecks extraction quality. The routing step is load-bearing — add a test that asserts a French fixture routes to the French prompt.
- When in doubt on a municipal-level source, prefer missing the source to ingesting malformed data. A false-positive RFP row costs more than a miss.
