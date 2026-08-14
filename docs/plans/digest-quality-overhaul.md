# High-Recall Tiered Opportunity Digest — Quality Overhaul

## Context

The daily digest email quality was "exceedingly poor and fully unusable." A first pass killed obvious junk (Wikipedia, dictionaries — 95% of SearXNG noise), but the surviving set is dominated by irrelevant-but-real items: ~50 NIH clinical-trial research grants per day from grants.gov's empty-keyword query, plus World Bank *projects* (wrong endpoint — should be procurement notices). There is no relevance scoring against what Datacraft actually does (Africa-focused development consultancy: health systems, ICT/digital, education, WASH, agriculture, governance/M&E, climate).

**Hard constraint from user: never miss an opportunity.** Scores only determine *tier and position* in the email — never inclusion. The current threshold gate (`_filter_quality`) is demoted to a fallback tier mapper. Every crawled item appears in the email unless it is provably definitive junk (wiki/dictionary/social).

User decisions: Africa-first ranking with strong global matches still surfacing in top tiers; keep SAM.gov DEMO_KEY for now (`SAM_API_KEY` env supported for later).

**Step 0 of implementation: save this plan to `docs/plans/digest-quality-overhaul.md`** (user request).

## Architecture

```
crawl (08:00) ──▶ storage/opportunities/YYYY-MM-DD.json   (CRAWL_LIMIT 300→600)
digest (10:00) ─▶ _split_junk ─▶ LLM triage (batch 25, cached) ─▶ tiered email
                                   │ LiteLLM down → heuristic tiers (email always sends)
                                   └ scores cached: storage/opportunities/scores/YYYY-MM.json
```

## Phase 1 — Business profile config

**New: `config/opportunity_profile.yaml`** (versioned, human-editable): `positioning`, `sectors` (7 canonical names + hint keywords), `geographies.primary` (Kenya, Uganda, Tanzania, Rwanda, Ethiopia, Nigeria, Ghana, South Africa, Sub-Saharan/East/West Africa) / `.secondary` (multi-country, global, MENA, South Asia), `client_types` (WB, AfDB, UN agencies, USAID, FCDO, GIZ, EU, Global Fund, foundations, African governments), `delivery_models` (consultancy, TA, M&E, software/data platforms, capacity building), `exclusions` (clinical trials, US-domestic-only, civil works, goods-only — demote to Tier C, never drop), `keyword_boost` / `keyword_demote` (R01, R21, SBIR, "clinical trial"...).

Loader returns `(dict, profile_hash=sha256(bytes)[:12])` — hash keys the score cache so profile edits trigger re-scoring. Missing/invalid file → minimal hardcoded default, log warning, never crash. Env: `OPPORTUNITY_PROFILE_PATH` (absolute in systemd env file).

## Phase 2 — LLM triage module

**New: `src/docfusion/workers/digest/triage.py`** (tabs, dataclasses, async):

- `TriageScore`: `url_hash` (reuses crawl's `sha256(url)[:16]`), `relevance` 0-100, `tier` A/B/C **derived server-side** (≥70 A, ≥40 B, else C — model's own tier letter ignored), `why` (one line), `sector` (canonical), `geography`, `deadline_iso`, `scored_by` ("llm"|"heuristic"), `profile_hash`, `model`, `scored_at`, optional `synopsis`.
- `ScoreCache`: monthly shards `storage/opportunities/scores/YYYY-MM.json`, atomic write (same tmp+`os.replace` pattern as crawl `_atomic_write`). `get()` misses when `profile_hash` differs OR when entry is heuristic and LLM is available (so heuristic scores upgrade next run).
- `triage(opps, profile, profile_hash, cache)`: cache-hit skip → batches of `TRIAGE_BATCH_SIZE=25`, `asyncio.Semaphore(3)`, 60s/call, 2 attempts. Plain-httpx to LiteLLM (same pattern as `_summarise`; env `LITELLM_URL`/`LITELLM_KEY`, `TRIAGE_MODEL` falls back to `LLM_MODEL`), `temperature: 0`, `response_format: {"type":"json_object"}`, `max_tokens: 2500`.
- Parse: strip fences → `json.loads`; on fail one retry with "Return ONLY valid JSON."; still failing → `heuristic_fallback` for that batch only.
- **Recall invariant enforced in code**: after triage, every input hash must be in the result — items the LLM omitted get `heuristic_fallback`. Tested.
- `heuristic_fallback`: maps existing `_quality_score` (≥7→A, 3-6→B, else C), sector via `classify_sector`, deadline via extracted `_parse_deadline` helper.

**Prompt**: system message demands JSON `{"items":[{id, relevance, why, sector, geography, deadline}]}`, "Score every input item. Never omit an item." User message embeds profile (positioning, sectors, geographies, clients, delivery models, exclusions with "score ≤30"), scoring bands, and one line: items from `nih.reporter` are funded research projects not open solicitations — score ≤35 unless clearly an open call. Per-item line: `{n}. [{source}] {title[:160]} | org | deadline | tags | desc[:200]` (~3.5k tokens in / 1.5k out per batch; ~12-24 batches/day ≈ pennies).

## Phase 3 — Digest runner rework

**Modify: `src/docfusion/workers/digest/runner.py`**

1. `_filter_quality` → `_split_junk(raw) -> (kept, junk)`: hard-reject ONLY no-URL, wiki/dictionary/social URLs, and reference-content title tokens (wikipedia/wikipédia/dictionnaire/...). Remove news domains (lemonde, nytimes, bbc, medium, substack) from hard-reject — they become demote hints. "Webinar"/"vacancy"/short titles are KEPT (flow to Tier C).
2. Wire `triage()` behind `TRIAGE_ENABLED=1` env kill-switch. Any exception → heuristic tiers; email always sends. (Justified availability fallback: a daily production email must not depend on the LLM gateway being up.)
3. **Closing-soon section**: scan prior 14 days' JSON (`CLOSING_SOON_DAYS`), look up cached scores, keep Tier A/B with deadline within 14 days, dedupe against today, sort by deadline, cap 15 (fine — they appeared in full on their day).
4. **New: `src/docfusion/workers/digest/enrich.py`** — `enrich_tier_a(...)`: for Tier A items with empty description (≤`ENRICH_LIMIT=15`, relevance desc), grants.gov detail API (`POST .../opportunity/details`, form `oppId=` parsed from URL) → synopsis, HTML-stripped, 400 chars, 1s spacing, 10s timeout, failures non-fatal, persisted into score cache so never re-fetched.
5. **Email rebuild** — `_html_tiered_digest` (720px table, inline styles, no `<details>` — Gmail-unsupported):
   - Header with counts: `A: n pursue · B: n review · C: n long tail · n junk removed of n crawled`
   - AI summary box (now fed Tier A items + their `why` lines)
   - **Closing soon** (amber): title, org, deadline (Nd left), tier badge
   - **Tier A — Pursue**: full cards grouped by sector: bold title link, `A {relevance}` badge, italic why, meta (org · deadline · ref · geography), synopsis, budget if matched
   - **Tier B — Review**: compact rows: title | sector | org | deadline
   - **Tier C — Long tail**: one-liners grouped by source with counts (`nih.reporter (25)`) — **everything renders, no `[:40]` cap**
   - Footer: source breakdown, `triage: llm|heuristic`, subject `[DocuFusion] {a} to pursue · {total} total — {date}`
6. Remove the "all items failed filter — skip digest" branch (skip only when `kept == 0`).

## Phase 4 — Crawl source fixes

**Modify: `src/docfusion/workers/daily_crawl/runner.py`**

1. **World Bank: replace projects endpoint with procurement notices** — `GET https://search.worldbank.org/api/v3/procnotices` (rows 100, sorted noticedate desc). Map bid_description→title, submission_date→deadline, project_ctry_name→organization, notice_text[:300]→description, source `worldbank-procurement`. **curl-verify field names first** (schema informally documented). Keep one small projects query (rows 25, Africa) tagged `project-pipeline` for Tier-C context.
2. **grants.gov**: KEEP broad `{"keyword":"", rows:50}` pull (recall; LLM demotes noise) + add keyword queries (rows 25): digital health, health systems, monitoring and evaluation, food security, water sanitation, education technology, climate resilience, capacity building.
3. **NIH Reporter**: keep fetching (recall), tag `research-project`; triage prompt demotes to Tier C.
4. **SAM.gov**: read `SAM_API_KEY` env (fallback DEMO_KEY); fix latent staleness bug — `postedFrom` hardcoded `01/01/2026` → rolling 14 days; log distinct warning on DEMO_KEY 429.
5. **New `_path_reliefweb`**: `POST https://api.reliefweb.int/v1/reports?appname=docfusion` querying RFP/ITB/EOI/tender phrases, 50 rows (documented API at apidoc.reliefweb.int — curl-verify field paths).
6. **New `_path_undp`**: `GET https://procurement-notices.undp.org/export_notices_xml.cfm` (bulk XML, regex-parse like `_path_rss_feeds`); existing Firecrawl target stays as overlap (dedup handles it).
7. **UNGM fix**: current GET route serves HTML (why it yields 0) → `POST https://www.ungm.org/Public/Notice/Search` JSON body; curl-verify; if XSRF-blocked keep RSS+Firecrawl fallbacks and log clearly.
8. Factor parsing out of fetch closures into pure `_parse_*(data) -> list[Opportunity]` helpers (testability).
9. `CRAWL_LIMIT` default 300 → 600 (more sources; cap truncates after sort so junk drops first, but headroom matters for recall).

## Phase 5 — Env & systemd

New env (document in runner docstrings): `OPPORTUNITY_PROFILE_PATH` (absolute in unit env), `TRIAGE_ENABLED=1`, `TRIAGE_BATCH_SIZE=25`, `TRIAGE_MODEL` (→`LLM_MODEL`), `CLOSING_SOON_DAYS=14`, `ENRICH_LIMIT=15`, `SAM_API_KEY` (unset), `CRAWL_LIMIT=600`. Add these to `deployment/scripts/fill-env.sh`. Timers unchanged (crawl 08:00 → digest 10:00; new digest runtime 2-5 min). Add `TimeoutStartSec=900` to `docfusion-digest.service`.

## Phase 6 — Tests (`tests/ci/`, real fixture, mock only LLM)

Copy `storage/opportunities/2026-06-07.json` (real 200-item sample incl. genuine junk) → `tests/fixtures/opportunities-200.json`.

1. `test_digest_profile.py` — YAML loads, required keys, hash changes on edit, missing file → default (no raise).
2. `test_digest_junk_split.py` — on fixture: rejects wiki/dictionary/social and NOTHING else; webinar/vacancy/short-title items KEPT (recall guard).
3. `test_digest_triage.py` — mocked LLM transport: batching math; **every input hash in output** (invariant); tier derived from relevance (model tier ignored); dirty-JSON parse; malformed batch → heuristic for that batch only; cache round-trip; profile-hash mismatch → re-score; heuristic entries re-scored when LLM back.
4. `test_digest_fallback.py` — connection refused → all heuristic, HTML produced.
5. `test_digest_email_tiers.py` — every non-junk title appears exactly once; A→B→C order; closing-soon from synthetic prior-day; `<a href` count ≥ kept count (no-truncation proof).
6. `test_crawl_worldbank_procnotices.py` / `test_crawl_reliefweb.py` — pure-parser tests on inline sample payloads.

## Phase 7 — Rollout & verification (spare-2)

1. Local: `uv run pytest tests/ci/test_digest_* tests/ci/test_crawl_*` green.
2. Local dry run: `uv run python -m docfusion.workers.digest --date 2026-06-07` (no recipient) → eyeball `-digest.html` tiers; confirm scores shard created; re-run → 0 LLM calls (cache hit in logs).
3. Deploy via `deployment/scripts/deploy.sh spare-2 deploy`; set new env vars via fill-env.sh regeneration + scp.
4. Manual crawl run; journalctl: verify `worldbank-procurement > 0`, `reliefweb > 0`, `ungm` no longer 0.
5. Manual digest to nyimbi@gmail.com; verify subject counts, every stored item present, NIH in Tier C.
6. Day+2: closing-soon populated.
7. Rollback: `TRIAGE_ENABLED=0` (heuristic tiers, still no truncation); full = git revert.
8. Commit + push per unit of work (standing authorization).

## Risks

- LLM omitting items → enforced invariant + heuristic backfill (tested).
- Unverified endpoint schemas (WB procnotices, UNGM POST, UNDP XML) → explicit curl-verify steps, each has fallback; failures degrade to existing sources, never break the digest.
- grants.gov detail rate limits → ≤15 sequential calls, 1s spacing, non-fatal.
- Score-cache growth → monthly shards ~3.6 MB/month; pruning noted as future work.
- LLM cost: pennies/day (~12-24 gpt-4o batches).
