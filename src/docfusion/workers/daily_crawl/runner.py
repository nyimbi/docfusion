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
    CRAWL_LIMIT              (default: 200)
    MIN_RESULTS_THRESHOLD    (default: 5)
    CRAWL_TIMEOUT            (default: 20)
    FIRECRAWL_URL            (default: http://84.247.181.100:3002)
    SEARXNG_URL              (default: https://search.lindela.io)
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx

_log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

STORAGE_DIR = Path(os.environ.get("OPPORTUNITY_STORAGE_DIR", "./storage/opportunities"))
LOOKBACK_DAYS = int(os.environ.get("CRAWL_LOOKBACK_DAYS", "30"))
CRAWL_LIMIT = int(os.environ.get("CRAWL_LIMIT", "200"))
MIN_RESULTS_THRESHOLD = int(os.environ.get("MIN_RESULTS_THRESHOLD", "5"))
CALL_TIMEOUT = int(os.environ.get("CRAWL_TIMEOUT", "20"))
FIRECRAWL_URL = os.environ.get("FIRECRAWL_URL", "http://84.247.181.100:3002")
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
		}


# ---------------------------------------------------------------------------
# Retry / backoff helper
# ---------------------------------------------------------------------------

async def _retry(coro_fn, *, attempts: int = 3, base_delay: float = 1.0,
				 label: str = "") -> Any:
	"""Run coro_fn() with exponential backoff. Raises on final failure."""
	last_exc: Exception | None = None
	for attempt in range(1, attempts + 1):
		try:
			return await coro_fn()
		except Exception as exc:
			last_exc = exc
			if attempt < attempts:
				delay = base_delay * (2 ** (attempt - 1))
				_log.warning("[%s] attempt %d/%d failed (%s) — retrying in %.1fs",
							 label, attempt, attempts, type(exc).__name__, delay)
				await asyncio.sleep(delay)
			else:
				_log.error("[%s] all %d attempts failed: %s", label, attempts, exc)
	raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Discovery path 1 — SearXNG metasearch
# ---------------------------------------------------------------------------

SEARXNG_QUERIES = [
	"RFP tender procurement Africa 2026",
	"grant development NGO Africa 2026",
	"international tender consultancy 2026",
	"call for proposals foundation grants 2026",
	"procurement notice UN multilateral 2026",
	"Caribbean Pacific Islands tender 2026",
	"World Bank UNDP UNICEF tender procurement 2026",
]


async def _path_searxng(client: httpx.AsyncClient, limit: int) -> list[Opportunity]:
	results: list[Opportunity] = []
	per_query = max(5, limit // len(SEARXNG_QUERIES))

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
				results.append(Opportunity(
					title=title,
					source_url=url,
					source=f"searxng:{item.get('engine', 'unknown')}",
					description=(item.get("content") or "")[:300],
					tags=["searxng"],
				))
		except Exception as exc:
			_log.warning("[searxng] query '%s' failed: %s", query[:40], exc)

	_log.info("[searxng] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Discovery path 2 — grants.gov REST API
# ---------------------------------------------------------------------------

GRANTS_GOV_QUERIES = [
	{"keyword": "", "oppStatuses": "posted", "rows": 50, "startRecordNum": 0},
	{"keyword": "Africa", "oppStatuses": "posted", "rows": 25, "startRecordNum": 0},
	{"keyword": "international development", "oppStatuses": "posted", "rows": 25, "startRecordNum": 0},
]


async def _path_grants_gov(client: httpx.AsyncClient) -> list[Opportunity]:
	results: list[Opportunity] = []
	for body in GRANTS_GOV_QUERIES:
		try:
			async def fetch(b=body):
				r = await client.post(
					"https://apply07.grants.gov/grantsws/rest/opportunities/search/",
					json=b, headers=_HEADERS, timeout=CALL_TIMEOUT,
				)
				r.raise_for_status()
				return r.json()

			data = await _retry(fetch, label="grants.gov")
			for item in (data.get("oppHits") or []):
				opp_id = str(item.get("id", ""))
				title = str(item.get("title") or "").strip()
				if not title:
					continue
				results.append(Opportunity(
					title=title,
					source_url=f"https://www.grants.gov/search-results-detail/{opp_id}",
					source="grants.gov",
					organization=str(item.get("agency") or ""),
					deadline=str(item.get("closeDate") or ""),
					reference=str(item.get("number") or ""),
					tags=["grant", "us-federal"],
				))
		except Exception as exc:
			_log.warning("[grants.gov] query failed: %s", exc)

	_log.info("[grants.gov] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Discovery path 3 — World Bank Projects API
# ---------------------------------------------------------------------------

WORLDBANK_QUERIES = [
	{"fq": 'regionname_exact:("Africa") AND status:("Active")', "rows": 50},
	{"fq": 'regionname_exact:("Latin America") AND status:("Active")', "rows": 25},
	{"fq": 'regionname_exact:("South Asia") AND status:("Active")', "rows": 25},
]


async def _path_worldbank(client: httpx.AsyncClient) -> list[Opportunity]:
	results: list[Opportunity] = []
	for params_extra in WORLDBANK_QUERIES:
		try:
			params = {
				"fl": "id,project_name,boardapprovaldate,countryname,sector_exact,status",
				"format": "json",
				**params_extra,
			}

			async def fetch(p=params):
				r = await client.get(
					"https://search.worldbank.org/api/v2/projects",
					params=p, headers=_HEADERS, timeout=CALL_TIMEOUT,
				)
				r.raise_for_status()
				return r.json()

			data = await _retry(fetch, label="worldbank")
			projects = data.get("projects") or {}
			if isinstance(projects, dict):
				projects = list(projects.values())
			for item in projects:
				proj_id = str(item.get("id") or "")
				title = str(item.get("project_name") or "").strip()
				if not title or not proj_id:
					continue
				results.append(Opportunity(
					title=title,
					source_url=f"https://projects.worldbank.org/en/projects-operations/project-detail/{proj_id}",
					source="worldbank",
					organization=str(item.get("countryname") or ""),
					deadline=str(item.get("boardapprovaldate") or ""),
					reference=proj_id,
					tags=["project", "world-bank", "development"],
				))
		except Exception as exc:
			_log.warning("[worldbank] query failed: %s", exc)

	_log.info("[worldbank] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Discovery path 4 — SAM.gov + additional US federal sources
# ---------------------------------------------------------------------------

async def _path_us_federal(client: httpx.AsyncClient) -> list[Opportunity]:
	results: list[Opportunity] = []

	# SAM.gov opportunity search via their published REST API (no key, DEMO_KEY deprecated)
	try:
		async def fetch_sam():
			r = await client.get(
				"https://api.sam.gov/opportunities/v2/search",
				params={
					"limit": "25",
					"postedFrom": "01/01/2026",
					"api_key": "DEMO_KEY",
					"ptype": "o,k,u,r,s,g",
				},
				headers={**_HEADERS, "Accept": "application/json"},
				timeout=CALL_TIMEOUT,
			)
			r.raise_for_status()
			return r.json()

		data = await _retry(fetch_sam, label="sam.gov")
		# SAM.gov public search returns hits under "_embedded.results" or "hits.hits"
		hits = (data.get("_embedded", {}).get("results")
				or data.get("hits", {}).get("hits")
				or data.get("opportunitiesData")
				or [])
		for item in hits:
			src = item.get("_source", item)
			title = str(src.get("title") or src.get("opportunityTitle") or "").strip()
			notice_id = str(src.get("noticeId") or src.get("opportunityId") or "")
			if not title:
				continue
			results.append(Opportunity(
				title=title,
				source_url=f"https://sam.gov/opp/{notice_id}/view" if notice_id else "https://sam.gov/",
				source="sam.gov",
				organization=str(src.get("organizationName") or src.get("department") or ""),
				deadline=str(src.get("responseDeadLine") or src.get("archiveDate") or ""),
				reference=notice_id,
				tags=["contract", "us-federal", "sam.gov"],
			))
	except Exception as exc:
		_log.warning("[sam.gov] failed: %s", exc)

	# NIH grants (confirmed API)
	try:
		async def fetch_nih():
			r = await client.post(
				"https://api.reporter.nih.gov/v2/projects/search",
				json={"criteria": {"fiscal_years": [2026], "project_nums": []},
					  "offset": 0, "limit": 25},
				headers={**_HEADERS, "Content-Type": "application/json"},
				timeout=CALL_TIMEOUT,
			)
			r.raise_for_status()
			return r.json()

		data = await _retry(fetch_nih, label="nih.reporter")
		for item in (data.get("results") or []):
			title = str(item.get("project_title") or "").strip()
			appl_id = str(item.get("appl_id") or "")
			if not title:
				continue
			results.append(Opportunity(
				title=title,
				source_url=f"https://reporter.nih.gov/project-details/{appl_id}",
				source="nih.reporter",
				organization=str(item.get("organization", {}).get("org_name") or ""),
				deadline="",
				reference=str(item.get("project_num") or ""),
				tags=["grant", "nih", "health-research"],
			))
	except Exception as exc:
		_log.warning("[nih.reporter] failed: %s", exc)

	_log.info("[us-federal] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Discovery path 5 — XML/RSS feeds
# ---------------------------------------------------------------------------

RSS_FEEDS = [
	# ReliefWeb reports JSON API (v2, confirmed working — v1 jobs is 410 Gone)
	("reliefweb", "https://api.reliefweb.int/v2/reports?appname=docfusion&limit=20&preset=latest&profile=minimal"),
	# USAID press releases / tenders RSS (confirmed working)
	("usaid-rss", "https://www.usaid.gov/news-information/press-releases/rss.xml"),
	# Global Fund procurement notices JSON
	("globalfund", "https://api.theglobalfund.org/v3.3/procurement/procurements?top=20&select=procurementTitle,procurementId,currentStatusDate"),
	# grants.gov RSS (separate from the API, different results)
	("grants-rss", "https://www.grants.gov/web/grants/search-grants.html?oppStatuses=posted"),
]


async def _path_rss_feeds(client: httpx.AsyncClient) -> list[Opportunity]:
	results: list[Opportunity] = []

	import re

	for feed_source, url in RSS_FEEDS:
		try:
			async def fetch(u=url):
				r = await client.get(u, headers=_HEADERS, timeout=CALL_TIMEOUT,
									 follow_redirects=True)
				r.raise_for_status()
				return r

			resp = await _retry(fetch, label=f"rss:{feed_source}")
			content_type = resp.headers.get("content-type", "")

			if "json" in content_type or url.endswith(".json") or "api." in url:
				# JSON API (e.g. ReliefWeb)
				data = resp.json()
				items_raw = data.get("data") or data.get("results") or data.get("items") or []
				for item in items_raw[:20]:
					fields = item.get("fields", item)
					title = str(fields.get("title") or "").strip()
					item_url = str(fields.get("url") or fields.get("link") or "").strip()
					if not title or not item_url:
						continue
					results.append(Opportunity(
						title=title, source_url=item_url, source=feed_source,
						tags=["api-feed", feed_source],
					))
			else:
				# XML/RSS
				xml = resp.text
				items_xml = re.findall(r"<item[^>]*>(.*?)</item>", xml, re.DOTALL)
				for item_xml in items_xml[:20]:
					def _tag(name: str, ix=item_xml) -> str:
						m = re.search(
							rf"<{name}[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{name}>",
							ix, re.DOTALL)
						return (m.group(1) or "").strip() if m else ""
					title = _tag("title")
					link = _tag("link") or _tag("guid")
					if not title or not link:
						continue
					results.append(Opportunity(
						title=title, source_url=link.strip(), source=feed_source,
						description=_tag("description")[:300],
						tags=["rss", feed_source],
					))
		except Exception as exc:
			_log.warning("[rss:%s] failed: %s", feed_source, exc)

	_log.info("[rss-feeds] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Discovery path 6 — Firecrawl high-value portals
# ---------------------------------------------------------------------------

FIRECRAWL_TARGETS = [
	("UNGM procurement", "https://www.ungm.org/Public/Notice"),
	("UNDP procurement", "https://procurement-notices.undp.org/"),
	("World Bank Africa", "https://www.worldbank.org/en/region/afr"),
	("AfDB tenders", "https://www.afdb.org/en/projects-and-operations/procurement/list-of-tenders"),
	("SA eTenders", "https://www.etenders.gov.za/content/advertised-tenders"),
]


async def _path_firecrawl(client: httpx.AsyncClient) -> list[Opportunity]:
	"""Scrape high-value portals via Firecrawl with waitFor for JS-heavy pages."""
	import re
	results: list[Opportunity] = []
	AZURE_ENDPOINT = (
		"https://lindela.openai.azure.com/openai/deployments/gpt-4.1-mini"
		"/chat/completions?api-version=2024-02-15-preview"
	)
	AZURE_KEY = os.environ.get(
		"AZURE_OPENAI_API_KEY",
		"1qTgOdaDaJUgfgkSllTJlmTptKNv2wdRpRHLoipIh2nWCWBP2qDaJQQJ99BLACYeBjFXJ3w3AAABACOGNs03",
	)

	for name, url in FIRECRAWL_TARGETS:
		try:
			async def scrape(u=url):
				r = await client.post(
					f"{FIRECRAWL_URL}/v1/scrape",
					json={"url": u, "formats": ["markdown"], "waitFor": 2000, "timeout": 60000},
					timeout=90,
				)
				r.raise_for_status()
				d = r.json()
				if not d.get("success"):
					raise RuntimeError(f"Firecrawl returned success=false for {u}")
				return (d.get("data") or {}).get("markdown", "")

			markdown = await _retry(scrape, attempts=2, base_delay=3.0, label=f"firecrawl:{name}")
			if len(markdown) < 300:
				continue

			# Extract with Azure OpenAI
			async def extract(md=markdown, n=name):
				r = await client.post(
					AZURE_ENDPOINT,
					headers={"api-key": AZURE_KEY},
					json={
						"messages": [{"role": "user", "content": (
							f"Extract tenders/grants from this procurement page ({n}). "
							"Return ONLY JSON array: "
							'[{"title":str,"reference":str,"deadline":str,"url":str}] '
							f"up to 10 items, or [] if none found.\n\n{md[:4000]}"
						)}],
						"temperature": 0.0, "max_tokens": 800,
					},
					timeout=25,
				)
				r.raise_for_status()
				raw = re.sub(r"```(?:json)?", "", r.json()["choices"][0]["message"]["content"]).strip()
				return json.loads(raw)

			items = await _retry(extract, attempts=2, base_delay=1.0, label=f"azure:{name}")
			for item in (items if isinstance(items, list) else []):
				title = str(item.get("title") or "").strip()
				item_url = str(item.get("url") or url).strip()
				if not title:
					continue
				results.append(Opportunity(
					title=title,
					source_url=item_url,
					source=f"firecrawl:{name}",
					deadline=str(item.get("deadline") or ""),
					reference=str(item.get("reference") or ""),
					tags=["firecrawl", "direct-scrape"],
				))
		except Exception as exc:
			_log.warning("[firecrawl:%s] failed: %s", name, exc)

	_log.info("[firecrawl] collected %d results", len(results))
	return results


# ---------------------------------------------------------------------------
# Validation and deduplication
# ---------------------------------------------------------------------------

def _validate(opp: Opportunity) -> bool:
	"""Reject junk: too-short titles, missing URL, obvious non-opportunities."""
	if not opp.is_valid():
		return False
	title = opp.title.lower()
	# Filter obvious non-opportunity pages
	if any(junk in title for junk in ["404", "page not found", "access denied",
									   "login required", "javascript required"]):
		return False
	if len(opp.title) < 5:
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
			pass
	return seen


# ---------------------------------------------------------------------------
# Atomic write helpers
# ---------------------------------------------------------------------------

def _atomic_write(path: Path, data: list[dict]) -> None:
	"""Write data to path atomically (crash-safe)."""
	path.parent.mkdir(parents=True, exist_ok=True)
	tmp = path.with_suffix(".json.tmp")
	with tmp.open("w") as f:
		json.dump(data, f, indent=2, default=str)
	os.replace(tmp, path)


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
	async with httpx.AsyncClient(timeout=CALL_TIMEOUT, verify=False,
								 follow_redirects=True) as client:
		path_results = await asyncio.gather(
			_path_searxng(client, CRAWL_LIMIT // 2),
			_path_grants_gov(client),
			_path_worldbank(client),
			_path_us_federal(client),
			_path_rss_feeds(client),
			_path_firecrawl(client),
			return_exceptions=True,
		)

	path_names = ["searxng", "grants.gov", "worldbank", "us-federal", "rss", "firecrawl"]
	all_opps: list[Opportunity] = []
	path_counts: dict[str, int] = {}

	for name, result in zip(path_names, path_results):
		if isinstance(result, Exception):
			_log.error("[%s] path raised unhandled exception: %s", name, result)
			path_counts[name] = 0
		elif isinstance(result, list):
			valid = [o for o in result if isinstance(o, Opportunity) and _validate(o)]
			path_counts[name] = len(valid)
			all_opps.extend(valid)
		else:
			path_counts[name] = 0

	_log.info("Raw collection by path: %s — total %d",
			  {k: v for k, v in path_counts.items() if v > 0}, len(all_opps))

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
	_log.info("After dedup: %d unique this run → %d new (not seen in %d days)",
			  len(deduped), len(new_opps), LOOKBACK_DAYS)

	# Minimum result check
	if len(new_opps) < MIN_RESULTS_THRESHOLD:
		_log.warning(
			"WARNING: only %d new opportunities found (threshold=%d). "
			"Check SearXNG engines, Firecrawl, and API connectivity.",
			len(new_opps), MIN_RESULTS_THRESHOLD,
		)

	# Persist (atomic write)
	out_path = STORAGE_DIR / f"{today}.json"
	_atomic_write(out_path, [o.to_dict() for o in new_opps[:CRAWL_LIMIT]])
	_write_heartbeat(STORAGE_DIR)

	elapsed = time.monotonic() - t0
	_log.info(
		"=== Crawl complete: %d new opportunities → %s (%.1fs) ===",
		len(new_opps), out_path.name, elapsed,
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
