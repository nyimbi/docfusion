"""
Tier A enrichment: fetch a human-readable synopsis for top-ranked items
whose crawl record has no description.

Currently supports grants.gov (detail API verified: POST
https://apply07.grants.gov/grantsws/rest/opportunity/details with form body
oppId=<id>, synopsis at synopsis.synopsisDesc). Other sources are skipped.

Bounded (ENRICH_LIMIT, default 15), sequential with 1s spacing, failures are
non-fatal. Fetched synopses are persisted into the score cache so re-runs
never re-fetch.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re

_log = logging.getLogger(__name__)

_GRANTS_DETAIL_URL = "https://apply07.grants.gov/grantsws/rest/opportunity/details"
_GRANTS_ID_RE = re.compile(r"search-results-detail/(\d+)")
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _strip_html(html: str) -> str:
	return _WS_RE.sub(" ", _TAG_RE.sub(" ", html)).strip()


async def enrich_tier_a(
	tier_a: list[tuple[dict, object]], cache, limit: int | None = None
) -> int:
	"""Fill empty descriptions on Tier A items in place. Returns enriched count."""
	import httpx

	limit = limit or int(os.environ.get("ENRICH_LIMIT", "15"))
	candidates = [
		(opp, score)
		for opp, score in tier_a
		if not (opp.get("description") or getattr(score, "synopsis", ""))
	][:limit]
	if not candidates:
		return 0

	enriched = 0
	async with httpx.AsyncClient(timeout=10) as client:
		for opp, score in candidates:
			url = str(opp.get("source_url") or opp.get("url") or "")
			m = _GRANTS_ID_RE.search(url)
			if not m:
				continue
			try:
				r = await client.post(
					_GRANTS_DETAIL_URL,
					data={"oppId": m.group(1)},
					headers={"Content-Type": "application/x-www-form-urlencoded"},
				)
				if r.status_code != 200:
					continue
				synopsis_html = (
					(r.json().get("synopsis") or {}).get("synopsisDesc")
				) or ""
				synopsis = _strip_html(synopsis_html)[:400]
				if synopsis:
					score.synopsis = synopsis
					cache.update_synopsis(score.url_hash, synopsis)
					enriched += 1
			except (KeyboardInterrupt, SystemExit):
				raise
			except Exception as exc:
				_log.debug("Enrichment failed for %s: %s", url[:80], exc)
			await asyncio.sleep(1)

	if enriched:
		cache.flush()
	return enriched
