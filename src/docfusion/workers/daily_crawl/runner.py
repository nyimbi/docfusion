"""
Daily Opportunity Crawl Runner — Bulletproof Edition

Five independent discovery paths. If any subset works, the crawl succeeds.
Every HTTP call retries with exponential backoff. Failed paths are logged
and skipped; they never kill sibling paths. Results are validated, deduped,
and written atomically. A heartbeat file marks each successful run.

Discovery paths (independent — any can be down without total failure):
    1. SearXNG metasearch (11 engines, lindela.io)
    2. grants.gov JSON API (US federal grants, no auth required)
    3. World Bank Projects API (Africa-region active projects)
    4. SAM.gov Opportunities API (US federal contracts)
    5. UN/OCHA ReliefWeb + UNDP RSS/XML feeds
    6. Direct portal scraping via Firecrawl (high-value confirmed portals)

Guarantees:
    - Retries: 3 attempts × exponential backoff (1s / 2s / 4s) per call
    - Timeout: configurable per path (default 20s)
    - Minimum: warns if total < MIN_RESULTS_THRESHOLD
    - Atomic write: temp file → os.replace() (crash-safe)
    - Heartbeat: storage/opportunities/.heartbeat written on each run
    - Deduplication: SHA-256(url) rolling 30-day window

Usage:
    python -m docfusion.workers.daily_crawl
    python -m docfusion.workers.daily_crawl --date 2026-06-01  # backfill

Environment:
    OPPORTUNITY_STORAGE_DIR  (default: ./storage/opportunities)
    CRAWL_LOOKBACK_DAYS      (default: 30)
    CRAWL_LIMIT              (default: 300)
    MIN_RESULTS_THRESHOLD    (default: 5)
    CRAWL_TIMEOUT            (default: 20)
    FIRECRAWL_URL            (default: http://62.169.25.77:3002)
    SEARXNG_URL              (default: https://search.lindela.io)
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

_log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


def _env_int(name: str, default: int, minimum: int = 1, maximum: int = 100_000) -> int:
	raw = os.environ.get(name, "")
	try:
		val = int(raw)
	except (ValueError, TypeError):
		if raw:
			_log.warning(
				"Invalid integer for %s=%r, using default %d", name, raw, default
			)
		return default
	if not (minimum <= val <= maximum):
		_log.warning(
			"%s=%d is out of range [%d, %d], using default %d",
			name,
			val,
			minimum,
			maximum,
			default,
		)
		return default
	return val


STORAGE_DIR = Path(os.environ.get("OPPORTUNITY_STORAGE_DIR", "./storage/opportunities"))
LOOKBACK_DAYS = _env_int("CRAWL_LOOKBACK_DAYS", 30, 1, 365)
CRAWL_LIMIT = _env_int("CRAWL_LIMIT", 600, 1, 10_000)
MIN_RESULTS_THRESHOLD = _env_int("MIN_RESULTS_THRESHOLD", 5, 0, 1_000)
CALL_TIMEOUT = _env_int("CRAWL_TIMEOUT", 20, 5, 300)
FIRECRAWL_URL = os.environ.get("FIRECRAWL_URL", "http://62.169.25.77:3002")
SEARXNG_URL = os.environ.get("SEARXNG_URL", "https://search.lindela.io")

_HEADERS = {
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/121.0 Safari/537.36",
	"Accept": "application/json,text/html,*/*;q=0.8",
}

# ---------------------------------------------------------------------------
# Result model
# ---------------------------------------------------------------------------


@dataclass
class Opportunity:
	title: str
	source_url: str
	source: str
	organization: str = ""
	deadline: str = ""
	reference: str = ""
	description: str = ""
	tags: list[str] = field(default_factory=list)
	quality_score: int = 0

	def key(self) -> str:
		return hashlib.sha256(self.source_url.encode()).hexdigest()[:16]

	def is_valid(self) -> bool:
		return bool(self.title.strip()) and bool(self.source_url.strip())

	def to_dict(self) -> dict[str, Any]:
		return {
			"title": self.title,
			"source_url": self.source_url,
			"source": self.source,
			"organization": self.organization,
			"deadline": self.deadline,
			"reference": self.reference,
			"description": self.description,
			"tags": self.tags,
			"quality_score": self.quality_score,
		}


# ---------------------------------------------------------------------------
# Retry / backoff helper
# ---------------------------------------------------------------------------


async def _retry(
	coro_fn, *, attempts: int = 3, base_delay: float = 1.0, label: str = ""
) -> Any:
	"""Run coro_fn() with exponential backoff. Raises on final failure."""
	last_exc: Exception | None = None
	for attempt in range(1, attempts + 1):
		try:
			return await coro_fn()
		except Exception as exc:
			last_exc = exc
			if attempt < attempts:
				delay = base_delay * (2 ** (attempt - 1))
				_log.warning(
					"[%s] attempt %d/%d failed (%s) — retrying in %.1fs",
					label,
					attempt,
					attempts,
					type(exc).__name__,
					delay,
				)
				await asyncio.sleep(delay)
			else:
				_log.error("[%s] all %d attempts failed: %s", label, attempts, exc)
	raise last_exc  # type: ignore[misc]


def _text(value: Any) -> str:
	"""Best-effort text normalisation for source APIs with inconsistent shapes."""
	if value is None:
		return ""
	if isinstance(value, list):
		return " ".join(
			part for part in (_text(item) for item in value) if part
		).strip()
	if isinstance(value, dict):
		for key in ("value", "text", "label", "name", "en"):
			if key in value:
				text = _text(value.get(key))
				if text:
					return text
		return " ".join(
			part for part in (_text(item) for item in value.values()) if part
		).strip()
	return str(value).strip()


# ---------------------------------------------------------------------------
# Discovery path 1 — SearXNG metasearch
# ---------------------------------------------------------------------------

# Site-scoped queries only. Generic marketing queries ("RFP health Africa 2026")
# are removed — they return dictionaries, Wikipedia, and consulting firm homepages.
# Every query below either:
#   (a) is a `site:` search restricted to a known tender/grant portal, or
#   (b) contains a full multi-word procurement phrase like "request for proposal"
# The structured API paths (grants.gov, worldbank, sam.gov, UNGM, TED, USAID,
# AfDB, ADB) remain the primary source; SearXNG is a backfill for portals
# that lack a clean API.
SEARXNG_QUERIES = [
	# Site-scoped: real tender portals
	'site:reliefweb.int "request for proposals"',
	'site:reliefweb.int "expression of interest"',
	'site:devex.com "request for proposal"',
	'site:devex.com "invitation to tender"',
	'site:ungm.org "notice"',
	'site:ted.europa.eu "contract notice"',
	'site:sam.gov "opportunity"',
	'site:grants.gov "opportunity"',
	'site:afdb.org "procurement notice"',
	'site:iadb.org "procurement notice"',
	'site:worldbank.org "procurement notice"',
	'site:adb.org "procurement notice"',
	'site:ifc.org "expression of interest"',
	'site:undp.org "call for proposals"',
	'site:unicef.org "invitation to bid"',
	'site:wfp.org "request for proposals"',
	'site:fao.org "call for proposals"',
	'site:who.int "call for proposals"',
	'site:mcc.gov "solicitation"',
	# African national procurement portals
	"site:tenders.go.ke",
	"site:etenders.gov.za",
	"site:ppda.go.ug",
	"site:ppra.go.tz",
	"site:bpp.gov.ng",
	"site:ppa.gov.gh",
	"site:rppa.gov.rw",
	# Portals that block direct scraping (403) — search engines index them for us
	'site:afdb.org "expression of interest"',
	'site:afdb.org "procurement notice"',
	'site:adb.org "invitation for bids"',
	'site:adb.org "consulting services"',
	'site:iadb.org "procurement notice"',
	'site:ebrd.com "procurement notice"',
	"site:globalfund.org tender",
	'site:eib.org "procurement notice"',
	"site:aiib.org procurement",
	"site:greenclimate.fund procurement",
	'site:unops.org "request for"',
	'site:gatesfoundation.org "request for proposals"',
	"site:developmentaid.org tenders",
	# Development banks — global + regional (AfDB/ADB/IADB/EBRD/EIB/AIIB above)
	"site:isdb.org procurement",  # Islamic Development Bank
	"site:ndb.int procurement",  # New Development Bank (BRICS)
	"site:opecfund.org procurement",
	"site:badea.org tender",  # Arab Bank for Economic Dev. in Africa
	"site:tdbgroup.org procurement",  # Trade & Development Bank (East Africa)
	"site:afreximbank.com tender",
	"site:bidc-ebid.org procurement",  # ECOWAS Bank (EBID)
	"site:eadb.org procurement",  # East African Development Bank
	"site:boad.org marches",  # West African Development Bank (BOAD)
	"site:dbsa.org tender",  # Development Bank of Southern Africa
	"site:caribank.org procurement",  # Caribbean Development Bank
	"site:caf.com procurement",  # CAF — Latin America
	# Bilateral donors
	"site:giz.de tender international",
	"site:enabel.be tender",
	"site:sida.se procurement",
	# Phrase-scoped (must appear verbatim in title/snippet — cuts most noise)
	'"request for proposals" 2026 africa',
	'"invitation to tender" 2026 africa',
	'"expression of interest" 2026 africa',
	'"call for proposals" 2026 africa',
	'"procurement notice" 2026 africa',
	'"invitation for bids" 2026 africa',
	'"terms of reference" consultancy 2026 africa',
	'"request for quotations" 2026 africa',
	# Francophone Africa
	'"appel d\'offres" 2026 afrique',
	'"avis de marché" 2026',
	'"manifestation d\'intérêt" 2026 afrique',
]

# Domains that never contain actual procurement opportunities
_JUNK_DOMAINS: frozenset[str] = frozenset(
	{
		"wikipedia.org",
		"wiktionary.org",
		"wikimedia.org",
		"wikivoyage.org",
		"wordreference.com",
		"merriam-webster.com",
		"dictionary.com",
		"thefreedictionary.com",
		"collinsdictionary.com",
		"larousse.fr",
		"answers.com",
		"quora.com",
		"reddit.com",
		"youtube.com",
		"youtu.be",
		"facebook.com",
		"twitter.com",
		"x.com",
		"linkedin.com",
		"instagram.com",
		"pinterest.com",
		"tiktok.com",
	}
)

# Token substrings that, if found in the title (lowercase), mark the result as non-procurement.
# Includes accented / French unicode variants — "wikipédia" (é) does NOT match "wikipedia" (e).
_JUNK_TITLE_TOKENS: frozenset[str] = frozenset(
	{
		"wikipedia",
		"wikipédia",
		"wiktionary",
		"wiktionnaire",
		"encyclop",
		"wikimedia",
		"wikivoyage",
		"wikibooks",
		"wikisource",
		"dictionary",
		"dictionnaire",
		"definition",
		"définition",
		"traduction",
		"translation",
		"reverso",
		"linguee",
		"wordreference",
		# Common non-opportunity content
		"blog post",
		"news article",
		"case study",
		"white paper",
		"webinar",
		"podcast",
		"how to",
		"guide to",
		"top 10",
		"top ten",
		"list of",
		"opinion",
		"op-ed",
		"hiring",
		"vacancy",
	}
)

# Domains known to host real procurement content — URL from these earns a quality bonus
BONUS_DOMAINS: frozenset[str] = frozenset(
	{
		"ungm.org",
		"ted.europa.eu",
		"usaid.gov",
		"afdb.org",
		"adb.org",
		"iadb.org",
		"giz.de",
		"devex.com",
		"reliefweb.int",
		"phap.org",
		"mcc.gov",
		"ifc.org",
		"worldbank.org",
		"projects.worldbank.org",
		"undp.org",
		"unicef.org",
		"wfp.org",
		"fao.org",
		"who.int",
		"globalfund.org",
		"tenders.go.ke",
		"etenders.gov.za",
		"ppda.go.ug",
		"ppra.go.tz",
		"bpp.gov.ng",
		"ppa.gov.gh",
		"rppa.gov.rw",
		"unops.org",
		"grants.gov",
		"sam.gov",
		"reporter.nih.gov",
		"gatesfoundation.org",
		"rockefellerfoundation.org",
		"aiib.org",
	# Development banks (added 2026-08-22)
	"isdb.org",
	"ndb.int",
	"opecfund.org",
	"badea.org",
	"tdbgroup.org",
	"afreximbank.com",
	"bidc-ebid.org",
	"eadb.org",
	"boad.org",
	"dbsa.org",
	"caribank.org",
	"caf.com",
	"greenclimate.fund",
	"developmentaid.org",
	"enabel.be",
	}
)
_PROCUREMENT_DOMAINS = BONUS_DOMAINS


async def _path_searxng(client: httpx.AsyncClient, limit: int) -> list[Opportunity]:
	results: list[Opportunity] = []
	per_query = max(10, limit // len(SEARXNG_QUERIES))

	for query in SEARXNG_QUERIES:
		try:

			async def fetch(q=query):
				r = await client.get(
					f"{SEARXNG_URL.rstrip('/')}/search",
					params={"q": q, "format": "json", "safesearch": 1},
					timeout=CALL_TIMEOUT,
				)
				r.raise_for_status()
				return r.json()

			data = await _retry(fetch, label=f"searxng:{query[:30]}")
			for item in (data.get("results") or [])[:per_query]:
				url = item.get("url") or ""
				title = item.get("title") or ""
				if not url or not title:
					continue
				results.append(
					Opportunity(
						title=title,
						source_url=url,
						source=f"searxng:{item.get('engine', 'unknown')}",
						description=(item.get("content") or "")[:300],
						tags=["searxng"],
					)
				)
		except Exception as exc:
			_log.warning("[searxng] query '%s' failed: %s", query[:40], exc)

	_log.info("[searxng] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Discovery path 2 — grants.gov REST API
# ---------------------------------------------------------------------------

# The broad empty-keyword pull stays for recall — LLM triage in the digest
# demotes irrelevant items rather than us guessing at the source.
GRANTS_GOV_QUERIES = [
	{"keyword": "", "oppStatuses": "posted", "rows": 50, "startRecordNum": 0},
	{"keyword": "Africa", "oppStatuses": "posted", "rows": 25, "startRecordNum": 0},
	{
		"keyword": "international development",
		"oppStatuses": "posted",
		"rows": 25,
		"startRecordNum": 0,
	},
	{
		"keyword": "digital health",
		"oppStatuses": "posted",
		"rows": 25,
		"startRecordNum": 0,
	},
	{
		"keyword": "health systems",
		"oppStatuses": "posted",
		"rows": 25,
		"startRecordNum": 0,
	},
	{
		"keyword": "monitoring and evaluation",
		"oppStatuses": "posted",
		"rows": 25,
		"startRecordNum": 0,
	},
	{
		"keyword": "food security",
		"oppStatuses": "posted",
		"rows": 25,
		"startRecordNum": 0,
	},
	{
		"keyword": "water sanitation",
		"oppStatuses": "posted",
		"rows": 25,
		"startRecordNum": 0,
	},
	{
		"keyword": "education technology",
		"oppStatuses": "posted",
		"rows": 25,
		"startRecordNum": 0,
	},
	{
		"keyword": "climate resilience",
		"oppStatuses": "posted",
		"rows": 25,
		"startRecordNum": 0,
	},
	{
		"keyword": "capacity building",
		"oppStatuses": "posted",
		"rows": 25,
		"startRecordNum": 0,
	},
]


async def _path_grants_gov(client: httpx.AsyncClient) -> list[Opportunity]:
	results: list[Opportunity] = []
	for body in GRANTS_GOV_QUERIES:
		try:

			async def fetch(b=body):
				r = await client.post(
					"https://apply07.grants.gov/grantsws/rest/opportunities/search/",
					json=b,
					headers=_HEADERS,
					timeout=CALL_TIMEOUT,
				)
				r.raise_for_status()
				return r.json()

			data = await _retry(fetch, label="grants.gov")
			for item in data.get("oppHits") or []:
				opp_id = str(item.get("id", ""))
				title = str(item.get("title") or "").strip()
				if not title:
					continue
				results.append(
					Opportunity(
						title=title,
						source_url=f"https://www.grants.gov/search-results-detail/{opp_id}",
						source="grants.gov",
						organization=str(item.get("agency") or ""),
						deadline=str(item.get("closeDate") or ""),
						reference=str(item.get("number") or ""),
						tags=["grant", "us-federal"],
					)
				)
		except Exception as exc:
			_log.warning("[grants.gov] query failed: %s", exc)

	_log.info("[grants.gov] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Discovery path 3 — World Bank Projects API
# ---------------------------------------------------------------------------


def _parse_procnotices(data: dict) -> list[Opportunity]:
	"""Parse the World Bank v2 procnotices payload (schema curl-verified 2026-08)."""
	results: list[Opportunity] = []
	notices = data.get("procnotices") or []
	if isinstance(notices, dict):
		notices = list(notices.values())
	for item in notices:
		notice_id = str(item.get("id") or "")
		title = str(item.get("bid_description") or "").strip()
		if not title or not notice_id:
			continue
		notice_type = str(item.get("notice_type") or "")
		method = str(item.get("procurement_method_name") or "")
		desc_bits = [
			b for b in (notice_type, method, str(item.get("project_name") or "")) if b
		]
		results.append(
			Opportunity(
				title=title,
				source_url=f"https://projects.worldbank.org/en/projects-operations/procurement-detail/{notice_id}",
				source="worldbank-procurement",
				organization=str(item.get("project_ctry_name") or ""),
				deadline=str(item.get("submission_deadline_date") or ""),
				reference=str(
					item.get("bid_reference_no") or item.get("project_id") or ""
				),
				description=" · ".join(desc_bits)[:300],
				tags=["world-bank", "procurement-notice"],
			)
		)
	return results


async def _path_worldbank(client: httpx.AsyncClient) -> list[Opportunity]:
	"""World Bank procurement notices (actual tenders) + a small project-pipeline feed."""
	results: list[Opportunity] = []

	# Primary: procurement notices — actual open solicitations.
	try:

		async def fetch_notices():
			r = await client.get(
				"https://search.worldbank.org/api/v2/procnotices",
				params={
					"format": "json",
					"rows": 100,
					"srt": "noticedate",
					"order": "desc",
				},
				headers=_HEADERS,
				timeout=CALL_TIMEOUT,
			)
			r.raise_for_status()
			return r.json()

		data = await _retry(fetch_notices, label="worldbank-procurement")
		results.extend(_parse_procnotices(data))
	except Exception as exc:
		_log.warning("[worldbank-procurement] query failed: %s", exc)

	# Secondary: Africa project pipeline for context (Tier-C material).
	try:
		params = {
			"fl": "id,project_name,boardapprovaldate,countryname,sector_exact,status",
			"format": "json",
			"fq": 'regionname_exact:("Africa") AND status:("Active")',
			"rows": 25,
		}

		async def fetch_projects(p=params):
			r = await client.get(
				"https://search.worldbank.org/api/v2/projects",
				params=p,
				headers=_HEADERS,
				timeout=CALL_TIMEOUT,
			)
			r.raise_for_status()
			return r.json()

		data = await _retry(fetch_projects, label="worldbank-projects")
		projects = data.get("projects") or {}
		if isinstance(projects, dict):
			projects = list(projects.values())
		for item in projects:
			proj_id = str(item.get("id") or "")
			title = str(item.get("project_name") or "").strip()
			if not title or not proj_id:
				continue
			results.append(
				Opportunity(
					title=title,
					source_url=f"https://projects.worldbank.org/en/projects-operations/project-detail/{proj_id}",
					source="worldbank",
					organization=str(item.get("countryname") or ""),
					deadline="",
					reference=proj_id,
					tags=["world-bank", "project-pipeline"],
				)
			)
	except Exception as exc:
		_log.warning("[worldbank-projects] query failed: %s", exc)

	_log.info("[worldbank] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Discovery path 4 — SAM.gov + additional US federal sources
# ---------------------------------------------------------------------------


async def _path_us_federal(client: httpx.AsyncClient) -> list[Opportunity]:
	results: list[Opportunity] = []

	# SAM.gov opportunity search. DEMO_KEY is limited to ~30 req/day/IP and
	# degraded results; set SAM_API_KEY (free registration at sam.gov) for
	# full coverage.
	try:
		sam_key = os.environ.get("SAM_API_KEY", "").strip() or "DEMO_KEY"
		posted_from = (datetime.now(timezone.utc) - timedelta(days=14)).strftime(
			"%m/%d/%Y"
		)

		async def fetch_sam():
			r = await client.get(
				"https://api.sam.gov/opportunities/v2/search",
				params={
					"limit": "100" if sam_key != "DEMO_KEY" else "25",
					"postedFrom": posted_from,
					"postedTo": datetime.now(timezone.utc).strftime("%m/%d/%Y"),
					"api_key": sam_key,
					"ptype": "o,k,u,r,s,g",
				},
				headers={**_HEADERS, "Accept": "application/json"},
				timeout=CALL_TIMEOUT,
			)
			if r.status_code == 429 and sam_key == "DEMO_KEY":
				_log.warning(
					"[sam.gov] DEMO_KEY rate-limited (429) — set SAM_API_KEY for full coverage"
				)
			r.raise_for_status()
			return r.json()

		data = await _retry(fetch_sam, label="sam.gov")
		# SAM.gov public search returns hits under "_embedded.results" or "hits.hits"
		hits = (
			data.get("_embedded", {}).get("results")
			or data.get("hits", {}).get("hits")
			or data.get("opportunitiesData")
			or []
		)
		for item in hits:
			src = item.get("_source", item)
			title = str(src.get("title") or src.get("opportunityTitle") or "").strip()
			notice_id = str(src.get("noticeId") or src.get("opportunityId") or "")
			if not title:
				continue
			results.append(
				Opportunity(
					title=title,
					source_url=f"https://sam.gov/opp/{notice_id}/view"
					if notice_id
					else "https://sam.gov/",
					source="sam.gov",
					organization=str(
						src.get("organizationName") or src.get("department") or ""
					),
					deadline=str(
						src.get("responseDeadLine") or src.get("archiveDate") or ""
					),
					reference=notice_id,
					tags=["contract", "us-federal", "sam.gov"],
				)
			)
	except Exception as exc:
		_log.warning("[sam.gov] failed: %s", exc)

	# NIH grants (confirmed API)
	try:

		async def fetch_nih():
			r = await client.post(
				"https://api.reporter.nih.gov/v2/projects/search",
				json={
					"criteria": {"fiscal_years": [2026], "project_nums": []},
					"offset": 0,
					"limit": 25,
				},
				headers={**_HEADERS, "Content-Type": "application/json"},
				timeout=CALL_TIMEOUT,
			)
			r.raise_for_status()
			return r.json()

		data = await _retry(fetch_nih, label="nih.reporter")
		for item in data.get("results") or []:
			title = str(item.get("project_title") or "").strip()
			appl_id = str(item.get("appl_id") or "")
			if not title:
				continue
			results.append(
				Opportunity(
					title=title,
					source_url=f"https://reporter.nih.gov/project-details/{appl_id}",
					source="nih.reporter",
					organization=str(
						item.get("organization", {}).get("org_name") or ""
					),
					deadline="",
					reference=str(item.get("project_num") or ""),
					tags=["grant", "nih", "research-project"],
				)
			)
	except Exception as exc:
		_log.warning("[nih.reporter] failed: %s", exc)

	_log.info("[us-federal] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Discovery paths 5-8 — additional structured procurement sources
# ---------------------------------------------------------------------------


# UNGM search returns HTML table rows (no JSON API); anonymous POST works.
# Row anatomy curl-verified 2026-08: data-noticeid carries the id, cells hold
# title / deadline / published / agency / type / reference / country in order.
_UNGM_ROW_RE = re.compile(r'data-noticeid="(\d+)"', re.DOTALL)
_UNGM_TITLE_RE = re.compile(
	r'class="ungm-title ungm-title--small">\s*(.*?)\s*</span>', re.DOTALL
)
_UNGM_DEADLINE_RE = re.compile(
	r'data-description="Deadline">\s*<span>\s*(.*?)\s*</span>', re.DOTALL
)
_UNGM_AGENCY_RE = re.compile(
	r'class="tableCell resultAgency">\s*<span>(.*?)</span>', re.DOTALL
)
_UNGM_REFERENCE_RE = re.compile(
	r'data-description="Reference">\s*<span>(.*?)</span>', re.DOTALL
)
_UNGM_TYPE_RE = re.compile(r"<label for='[^']*'>(.*?)</label>", re.DOTALL)


def _parse_ungm_rows(html: str) -> list[Opportunity]:
	results: list[Opportunity] = []
	# Split on row starts; first chunk is preamble.
	chunks = _UNGM_ROW_RE.split(html)
	for i in range(1, len(chunks) - 1, 2):
		notice_id = chunks[i]
		row_html = chunks[i + 1]
		title_m = _UNGM_TITLE_RE.search(row_html)
		if not title_m:
			continue
		title = re.sub(r"\s+", " ", title_m.group(1)).strip()
		if not title:
			continue
		deadline_m = _UNGM_DEADLINE_RE.search(row_html)
		deadline = ""
		if deadline_m:
			# e.g. "07-Sep-2026 15:00 (GMT 13.00)" — keep the date part.
			date_m = re.search(r"(\d{2}-\w{3}-\d{4})", deadline_m.group(1))
			deadline = date_m.group(1) if date_m else ""
		agency_m = _UNGM_AGENCY_RE.search(row_html)
		ref_m = _UNGM_REFERENCE_RE.search(row_html)
		type_m = _UNGM_TYPE_RE.search(row_html)
		results.append(
			Opportunity(
				title=title,
				source_url=f"https://www.ungm.org/Public/Notice/{notice_id}",
				source="ungm",
				organization=agency_m.group(1).strip() if agency_m else "",
				deadline=deadline,
				reference=ref_m.group(1).strip() if ref_m else notice_id,
				description=type_m.group(1).strip() if type_m else "",
				tags=["ungm", "un", "procurement"],
			)
		)
	return results


async def _path_ungm(client: httpx.AsyncClient) -> list[Opportunity]:
	results: list[Opportunity] = []
	try:

		async def fetch():
			r = await client.post(
				"https://www.ungm.org/Public/Notice/Search",
				json={
					"PageIndex": 0,
					"PageSize": 100,
					"NoticeTypeIds": [],
					"SortField": "DatePublished",
					"SortAscending": False,
				},
				headers={**_HEADERS, "Content-Type": "application/json"},
				timeout=CALL_TIMEOUT,
			)
			r.raise_for_status()
			return r.text

		html = await _retry(fetch, label="ungm")
		results = _parse_ungm_rows(html)
	except Exception as exc:
		_log.warning("[ungm] failed: %s", exc)

	_log.info("[ungm] collected %d results", len(results))
	return results


def _ted_lang_text(value: object, prefer: str = "eng") -> str:
	"""TED v3 returns multilingual dicts: {lang: str | [str]}. Prefer English."""
	if isinstance(value, str):
		return value.strip()
	if isinstance(value, dict) and value:
		chosen = value.get(prefer) or next(iter(value.values()))
		if isinstance(chosen, list):
			chosen = chosen[0] if chosen else ""
		return str(chosen).strip()
	return ""


def _parse_ted_notices(data: dict) -> list[Opportunity]:
	"""Parse the TED v3 search payload (schema curl-verified 2026-08)."""
	results: list[Opportunity] = []
	for item in data.get("notices") or []:
		pub_no = str(item.get("publication-number") or "")
		title = _ted_lang_text(item.get("notice-title"))
		if not pub_no or not title:
			continue
		deadlines = item.get("deadline-receipt-tender-date-lot") or []
		deadline = str(deadlines[0]).split("+")[0] if deadlines else ""
		places = item.get("place-of-performance") or []
		place = places[0] if places else ""
		results.append(
			Opportunity(
				title=title,
				source_url=f"https://ted.europa.eu/en/notice/{pub_no}",
				source="ted.europa.eu",
				organization=_ted_lang_text(item.get("buyer-name")),
				deadline=deadline,
				reference=pub_no,
				description=f"Place of performance: {place}" if place else "",
				tags=["ted", "eu", "procurement"],
			)
		)
	return results


async def _path_ted_eu(client: httpx.AsyncClient) -> list[Opportunity]:
	"""TED v3 API (POST + expert query — the old v3.0 GET endpoint returns 405).

	CPV classes: 72 IT, 73 research, 79 business services, 80 education,
	85 health, 90 environment — the consultancy-relevant slice of TED.
	"""
	results: list[Opportunity] = []
	try:

		async def fetch():
			r = await client.post(
				"https://api.ted.europa.eu/v3/notices/search",
				json={
					"query": (
						"classification-cpv IN (72000000 73000000 79000000 "
						"80000000 85000000 90000000) SORT BY publication-date DESC"
					),
					"fields": [
						"publication-number",
						"notice-title",
						"buyer-name",
						"deadline-receipt-tender-date-lot",
						"place-of-performance",
						"publication-date",
					],
					"limit": 100,
				},
				headers={**_HEADERS, "Content-Type": "application/json"},
				timeout=CALL_TIMEOUT,
			)
			r.raise_for_status()
			return r.json()

		data = await _retry(fetch, label="ted.europa.eu")
		results = _parse_ted_notices(data)
	except Exception as exc:
		_log.warning("[ted.europa.eu] failed: %s", exc)

	_log.info("[ted.europa.eu] collected %d results", len(results))
	return results


async def _firecrawl_markdown(client: httpx.AsyncClient, url: str, label: str) -> str:
	async def scrape():
		r = await client.post(
			f"{FIRECRAWL_URL.rstrip('/')}/v1/scrape",
			json={
				"url": url,
				"formats": ["markdown"],
				"waitFor": 2000,
				"timeout": 60000,
			},
			timeout=90,
		)
		r.raise_for_status()
		data = r.json()
		if not data.get("success"):
			raise RuntimeError(f"Firecrawl returned success=false for {url}")
		return (data.get("data") or {}).get("markdown", "")

	return await _retry(scrape, attempts=2, base_delay=3.0, label=f"firecrawl:{label}")


async def _path_usaid(client: httpx.AsyncClient) -> list[Opportunity]:
	results: list[Opportunity] = []
	try:

		async def fetch():
			r = await client.get(
				"https://www.usaid.gov/api/procurement-notices.json",
				headers=_HEADERS,
				timeout=CALL_TIMEOUT,
			)
			r.raise_for_status()
			return r.json()

		data = await _retry(fetch, label="usaid")
		items = (
			data
			if isinstance(data, list)
			else (
				data.get("items")
				or data.get("data")
				or data.get("results")
				or data.get("notices")
				or []
			)
		)
		for item in items[:50] if isinstance(items, list) else []:
			title = _text(item.get("title"))
			url = _text(item.get("url"))
			if not title or not url:
				continue
			results.append(
				Opportunity(
					title=title,
					source_url=urljoin("https://www.usaid.gov/", url),
					source="usaid",
					deadline=_text(item.get("close_date")),
					reference=_text(
						item.get("id") or item.get("nid") or item.get("number")
					),
					description=f"Posted: {_text(item.get('posted_date'))}"
					if item.get("posted_date")
					else "",
					tags=["usaid", "procurement"],
				)
			)
	except Exception as exc:
		_log.warning("[usaid] API failed: %s — falling back to Firecrawl", exc)
		try:
			import re

			url = "https://www.usaid.gov/work-usaid/partner-with-us/business-forecast"
			markdown = await _firecrawl_markdown(client, url, "usaid-business-forecast")
			seen: set[str] = set()
			for match in re.finditer(r"\[([^\]]{10,220})\]\(([^)]+)\)", markdown):
				title = re.sub(r"\s+", " ", match.group(1)).strip()
				href = urljoin(url, match.group(2).strip())
				title_lc = title.lower()
				if href in seen or not any(
					k in title_lc
					for k in (
						"forecast",
						"rfp",
						"rfq",
						"solicitation",
						"procurement",
						"tender",
						"grant",
						"contract",
						"call",
					)
				):
					continue
				seen.add(href)
				window = markdown[max(0, match.start() - 300) : match.end() + 300]
				deadline_match = re.search(
					r"(?i)(?:close(?: date)?|deadline|response due)[:\s|,-]+([A-Za-z0-9, /:-]{6,40})",
					window,
				)
				results.append(
					Opportunity(
						title=title,
						source_url=href,
						source="usaid",
						deadline=deadline_match.group(1).strip(" .|-")
						if deadline_match
						else "",
						tags=["usaid", "firecrawl", "business-forecast"],
					)
				)
				if len(results) >= 50:
					break
		except Exception as fallback_exc:
			_log.warning("[usaid] Firecrawl fallback failed: %s", fallback_exc)

	_log.info("[usaid] collected %d results", len(results))
	return results


async def _path_afdb(client: httpx.AsyncClient) -> list[Opportunity]:
	import re

	results: list[Opportunity] = []
	url = "https://www.afdb.org/en/projects-and-operations/procurement/procurement-notices?tid=All&field_notice_type_value=All&page=0"
	try:
		markdown = await _firecrawl_markdown(client, url, "afdb-procurement-notices")
		seen: set[str] = set()
		for match in re.finditer(r"\[([^\]]{10,240})\]\(([^)]+)\)", markdown):
			title = re.sub(r"\s+", " ", match.group(1)).strip()
			title_lc = title.lower()
			if title_lc in {"procurement notices", "list of tenders"}:
				continue
			if not any(
				k in title_lc
				for k in (
					"tender",
					"procurement",
					"expression of interest",
					"eoi",
					"request for proposal",
					"rfp",
					"bid",
					"consultancy",
					"consultant",
					"goods",
					"works",
					"services",
				)
			):
				continue
			item_url = urljoin(url, match.group(2).strip())
			if item_url in seen:
				continue
			seen.add(item_url)
			window = markdown[max(0, match.start() - 400) : match.end() + 500]
			ref_match = re.search(
				r"(?i)(?:reference(?: number)?|ref(?:erence)?\.?|project id|loan no\.?)[:\s#-]+([A-Z0-9][A-Z0-9/()._-]{3,40})",
				window,
			)
			deadline_match = re.search(
				r"(?i)(?:closing date|deadline|submission deadline|closing)[:\s|,-]+([A-Za-z0-9, /:-]{6,40})",
				window,
			)
			results.append(
				Opportunity(
					title=title,
					source_url=item_url,
					source="afdb",
					deadline=deadline_match.group(1).strip(" .|-")
					if deadline_match
					else "",
					reference=ref_match.group(1).strip(" .|-") if ref_match else "",
					tags=["afdb", "firecrawl", "procurement"],
				)
			)
			if len(results) >= 50:
				break
	except Exception as exc:
		_log.warning("[afdb] failed: %s", exc)

	_log.info("[afdb] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Discovery path 9 — XML/RSS feeds
# ---------------------------------------------------------------------------

# Probed 2026-08-22: devex procurement.rss, ungm.org/rss/notices → 404;
# phap.org DNS gone. ReliefWeb is the one reliable RSS publisher left —
# the other portals are covered via SearXNG site-scoped queries.
RSS_FEEDS: list[tuple[str, str]] = [
	(
		"reliefweb-funding",
		"https://reliefweb.int/updates/rss.xml?tag=Funding+opportunity",
	),
]


async def _path_rss_feeds(client: httpx.AsyncClient) -> list[Opportunity]:
	results: list[Opportunity] = []

	import re

	for feed_source, url in RSS_FEEDS:
		try:

			async def fetch(u=url):
				r = await client.get(
					u, headers=_HEADERS, timeout=CALL_TIMEOUT, follow_redirects=True
				)
				r.raise_for_status()
				return r

			resp = await _retry(fetch, label=f"rss:{feed_source}")
			content_type = resp.headers.get("content-type", "")

			if "json" in content_type or url.endswith(".json") or "api." in url:
				# JSON API (e.g. ReliefWeb)
				data = resp.json()
				items_raw = (
					data.get("data") or data.get("results") or data.get("items") or []
				)
				for item in items_raw[:20]:
					fields = item.get("fields", item)
					title = str(fields.get("title") or "").strip()
					item_url = str(
						fields.get("url") or fields.get("link") or ""
					).strip()
					if not title or not item_url:
						continue
					results.append(
						Opportunity(
							title=title,
							source_url=item_url,
							source=feed_source,
							tags=["api-feed", feed_source],
						)
					)
			else:
				# XML/RSS
				xml = resp.text
				items_xml = re.findall(r"<item[^>]*>(.*?)</item>", xml, re.DOTALL)
				for item_xml in items_xml[:20]:

					def _tag(name: str, ix=item_xml) -> str:
						m = re.search(
							rf"<{name}[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{name}>",
							ix,
							re.DOTALL,
						)
						return (m.group(1) or "").strip() if m else ""

					title = _tag("title")
					link = _tag("link") or _tag("guid")
					if not title or not link:
						continue
					results.append(
						Opportunity(
							title=title,
							source_url=link.strip(),
							source=feed_source,
							description=_tag("description")[:300],
							tags=["rss", feed_source],
						)
					)
		except Exception as exc:
			_log.warning("[rss:%s] failed: %s", feed_source, exc)

	_log.info("[rss-feeds] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Discovery path 10 — Firecrawl high-value portals
# ---------------------------------------------------------------------------

FIRECRAWL_TARGETS = [
	# UN multilaterals — high tender volume
	("UNGM procurement", "https://www.ungm.org/Public/Notice"),
	("UNDP procurement", "https://procurement-notices.undp.org/"),
	("WFP procurement", "https://www.wfp.org/procurement"),
	("UNOPS tenders", "https://www.unops.org/business/procurement"),
	("UNICEF tenders", "https://www.unicef.org/supply/procurement-services"),
	# Development banks
	(
		"AfDB tenders",
		"https://www.afdb.org/en/projects-and-operations/procurement/list-of-tenders",
	),
	("ADB procurement", "https://www.adb.org/business/opportunities/consulting"),
	# African government portals with confirmed content
	("SA eTenders", "https://www.etenders.gov.za/content/advertised-tenders"),
	("Kenya tenders", "https://www.tenders.go.ke/"),
	("Rwanda RPPA", "https://www.rppa.gov.rw/"),
	# Foundation grant portals
	(
		"Gates Foundation grants",
		"https://www.gatesfoundation.org/about/how-we-work/grants-and-investments",
	),
	("Rockefeller grants", "https://www.rockefellerfoundation.org/grants/"),
]


async def _path_firecrawl(client: httpx.AsyncClient) -> list[Opportunity]:
	"""Scrape high-value portals via Firecrawl with waitFor for JS-heavy pages."""
	import re

	results: list[Opportunity] = []
	litellm_url = os.environ.get("LITELLM_URL", "http://62.169.25.77:4000/v1").rstrip(
		"/"
	)
	litellm_api_key = (
		os.environ.get("LITELLM_API_KEY")
		or os.environ.get("LITELLM_KEY")
		or "sk-pjs-litellm-master-key"
	)
	litellm_model = os.environ.get("LLM_MODEL", "gpt-4o")

	for name, url in FIRECRAWL_TARGETS:
		try:

			async def scrape(u=url):
				r = await client.post(
					f"{FIRECRAWL_URL}/v1/scrape",
					json={
						"url": u,
						"formats": ["markdown"],
						"waitFor": 2000,
						"timeout": 60000,
					},
					timeout=90,
				)
				r.raise_for_status()
				d = r.json()
				if not d.get("success"):
					raise RuntimeError(f"Firecrawl returned success=false for {u}")
				return (d.get("data") or {}).get("markdown", "")

			markdown = await _retry(
				scrape, attempts=2, base_delay=3.0, label=f"firecrawl:{name}"
			)
			if len(markdown) < 300:
				continue

			# Extract through the LiteLLM gateway.
			async def extract(md=markdown, n=name):
				r = await client.post(
					f"{litellm_url}/chat/completions",
					headers={"Authorization": f"Bearer {litellm_api_key}"},
					json={
						"model": litellm_model,
						"messages": [
							{
								"role": "user",
								"content": (
									f"Extract tenders/grants from this procurement page ({n}). "
									"Return ONLY JSON array: "
									'[{"title":str,"reference":str,"deadline":str,"url":str}] '
									f"up to 10 items, or [] if none found.\n\n{md[:4000]}"
								),
							}
						],
						"temperature": 0.0,
						"max_tokens": 800,
					},
					timeout=25,
				)
				r.raise_for_status()
				raw = re.sub(
					r"```(?:json)?", "", r.json()["choices"][0]["message"]["content"]
				).strip()
				return json.loads(raw)

			items = await _retry(
				extract, attempts=2, base_delay=1.0, label=f"litellm:{name}"
			)
			for item in items if isinstance(items, list) else []:
				title = str(item.get("title") or "").strip()
				item_url = str(item.get("url") or url).strip()
				if not title:
					continue
				results.append(
					Opportunity(
						title=title,
						source_url=item_url,
						source=f"firecrawl:{name}",
						deadline=str(item.get("deadline") or ""),
						reference=str(item.get("reference") or ""),
						tags=["firecrawl", "direct-scrape"],
					)
				)
		except Exception as exc:
			_log.warning("[firecrawl:%s] failed: %s", name, exc)

	_log.info("[firecrawl] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Validation and deduplication
# ---------------------------------------------------------------------------


def _domain(url: str) -> str:
	"""Return the bare domain (no www.) from a URL, or '' on failure."""
	try:
		return urlparse(url).netloc.lower().removeprefix("www.")
	except Exception:
		return ""


def _score_opportunity(opp: Opportunity) -> int:
	"""
	Estimate procurement relevance on a 0–7 scale.
	Structured API sources (grants.gov, worldbank, etc.) naturally score high
	because they populate deadline + organization + reference. SearXNG results
	score lower by default and need at least one populated field to survive the
	digest quality filter.
	"""
	score = 0
	if opp.deadline:
		score += 2
	if opp.organization:
		score += 1
	if opp.reference:
		score += 1
	d = _domain(opp.source_url)
	if d and any(d == p or d.endswith("." + p) for p in _PROCUREMENT_DOMAINS):
		score += 3
	# Slight penalty for unstructured metasearch — these are the noisiest path
	if opp.source.startswith("searxng:"):
		score -= 1
	return score


def _validate(opp: Opportunity) -> bool:
	"""Reject junk: too-short titles, missing URL, encyclopedic content, junk domains."""
	if not opp.is_valid():
		return False
	title_lc = opp.title.lower()
	# Error pages
	if any(
		t in title_lc
		for t in (
			"404",
			"page not found",
			"access denied",
			"login required",
			"javascript required",
		)
	):
		return False
	if len(opp.title) < 10:
		return False
	# Encyclopedic / dictionary content — never a procurement opportunity
	if any(tok in title_lc for tok in _JUNK_TITLE_TOKENS):
		return False
	# Known non-procurement domains
	d = _domain(opp.source_url)
	if d and any(d == j or d.endswith("." + j) for j in _JUNK_DOMAINS):
		return False
	return True


def _load_seen_keys(storage_dir: Path, lookback_days: int) -> set[str]:
	seen: set[str] = set()
	cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
	for path in sorted(storage_dir.glob("[0-9][0-9][0-9][0-9]-*.json")):
		try:
			date_str = path.stem
			file_date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
			if file_date < cutoff:
				continue
			with path.open() as f:
				for opp in json.load(f):
					url = opp.get("source_url") or opp.get("url") or ""
					if url:
						seen.add(hashlib.sha256(url.encode()).hexdigest()[:16])
		except Exception:
			_log.warning(
				"Failed to read seen-keys from %s — duplicates may appear for that date",
				path,
				exc_info=True,
			)
	return seen


# ---------------------------------------------------------------------------
# Atomic write helpers
# ---------------------------------------------------------------------------


def _atomic_write(path: Path, data: list[dict]) -> None:
	"""Write data to path atomically (crash-safe, disk-full aware)."""
	path.parent.mkdir(parents=True, exist_ok=True)
	tmp = path.with_suffix(".json.tmp")
	try:
		with tmp.open("w") as f:
			json.dump(data, f, indent=2, default=str)
		os.replace(tmp, path)
	except OSError as exc:
		# errno 28 = ENOSPC (No space left on device)
		import errno as _errno

		if exc.errno == _errno.ENOSPC:
			_log.critical(
				"DISK FULL — could not write %s. Free disk space immediately.", path
			)
		tmp.unlink(missing_ok=True)
		raise


def _write_heartbeat(storage_dir: Path) -> None:
	heartbeat = {
		"last_run": datetime.now(timezone.utc).isoformat(),
		"status": "ok",
	}
	_atomic_write(storage_dir / ".heartbeat.json", [heartbeat])


# ---------------------------------------------------------------------------
# Main crawl orchestrator
# ---------------------------------------------------------------------------


async def run_crawl(date_str: str | None = None) -> int:
	"""Run all discovery paths in parallel, aggregate, deduplicate, persist."""
	t0 = time.monotonic()
	today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
	STORAGE_DIR.mkdir(parents=True, exist_ok=True)

	_log.info("=== Daily crawl start: %s ===", today)

	seen_prior = _load_seen_keys(STORAGE_DIR, LOOKBACK_DAYS)
	_log.info("Loaded %d seen keys from prior %d days", len(seen_prior), LOOKBACK_DAYS)

	# Run all paths concurrently — failures in one don't affect others
	async with httpx.AsyncClient(
		timeout=CALL_TIMEOUT, verify=False, follow_redirects=True
	) as client:
		# usaid path retired 2026-08-22: its JSON API is a permanent 404 (agency
		# reorg); USAID-descended solicitations flow through sam.gov/grants.gov.
		path_results = await asyncio.gather(
			_path_searxng(client, CRAWL_LIMIT),
			_path_grants_gov(client),
			_path_worldbank(client),
			_path_us_federal(client),
			_path_ungm(client),
			_path_ted_eu(client),
			_path_afdb(client),
			_path_rss_feeds(client),
			_path_firecrawl(client),
			return_exceptions=True,
		)

	path_names = [
		"searxng",
		"grants.gov",
		"worldbank",
		"us-federal",
		"ungm",
		"ted.europa.eu",
		"afdb",
		"rss",
		"firecrawl",
	]
	all_opps: list[Opportunity] = []
	path_counts: dict[str, int] = {}

	for name, result in zip(path_names, path_results):
		if isinstance(result, Exception):
			_log.error("[%s] path raised unhandled exception: %s", name, result)
			path_counts[name] = 0
		elif isinstance(result, list):
			valid = [o for o in result if isinstance(o, Opportunity) and _validate(o)]
			for o in valid:
				o.quality_score = _score_opportunity(o)
			path_counts[name] = len(valid)
			all_opps.extend(valid)
		else:
			path_counts[name] = 0

	_log.info(
		"Raw collection by path: %s — total %d",
		{k: v for k, v in path_counts.items() if v > 0},
		len(all_opps),
	)

	# Deduplicate within this run (by URL)
	seen_this_run: set[str] = set()
	deduped: list[Opportunity] = []
	for opp in all_opps:
		k = opp.key()
		if k not in seen_this_run:
			seen_this_run.add(k)
			deduped.append(opp)

	# Deduplicate against prior days
	new_opps = [o for o in deduped if o.key() not in seen_prior]
	_log.info(
		"After dedup: %d unique this run → %d new (not seen in %d days)",
		len(deduped),
		len(new_opps),
		LOOKBACK_DAYS,
	)

	# Sort best opportunities first so the digest sees them at the top
	new_opps.sort(key=lambda o: o.quality_score, reverse=True)

	# Minimum result check
	if len(new_opps) < MIN_RESULTS_THRESHOLD:
		_log.warning(
			"WARNING: only %d new opportunities found (threshold=%d). "
			"Check SearXNG engines, Firecrawl, and API connectivity.",
			len(new_opps),
			MIN_RESULTS_THRESHOLD,
		)

	# Persist (atomic write)
	out_path = STORAGE_DIR / f"{today}.json"
	_atomic_write(out_path, [o.to_dict() for o in new_opps[:CRAWL_LIMIT]])
	_write_heartbeat(STORAGE_DIR)

	elapsed = time.monotonic() - t0
	_log.info(
		"=== Crawl complete: %d new opportunities → %s (%.1fs) ===",
		len(new_opps),
		out_path.name,
		elapsed,
	)
	return len(new_opps)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> int:
	logging.basicConfig(
		level=logging.INFO,
		format="%(asctime)s %(levelname)s %(name)s: %(message)s",
	)
	parser = argparse.ArgumentParser(description="DocuFusion daily opportunity crawl")
	parser.add_argument("--date", help="Target date YYYY-MM-DD (default: today)")
	args = parser.parse_args()

	try:
		count = asyncio.run(run_crawl(args.date))
		print(f"Crawl complete: {count} new opportunities stored")
		return 0 if count >= 0 else 1
	except Exception as exc:
		_log.exception("Crawl failed with unhandled exception: %s", exc)
		return 1


if __name__ == "__main__":
	sys.exit(main())
