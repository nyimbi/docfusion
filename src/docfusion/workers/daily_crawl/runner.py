"""
Daily Opportunity Crawl Runner

Entry point for the systemd daily crawl job (06:00 UTC).
Discovers opportunities from all configured sources, deduplicates
against the prior 30-day window, and writes a dated JSON file under
storage/opportunities/YYYY-MM-DD.json.

Usage:
    python -m docfusion.workers.daily_crawl

Exit codes:
    0  — success (even if 0 new opportunities found)
    1  — unrecoverable error
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

_log = logging.getLogger(__name__)

STORAGE_DIR = Path(os.environ.get("OPPORTUNITY_STORAGE_DIR", "./storage/opportunities"))
LOOKBACK_DAYS = int(os.environ.get("CRAWL_LOOKBACK_DAYS", "30"))
CRAWL_LIMIT = int(os.environ.get("CRAWL_LIMIT", "100"))


# ---------------------------------------------------------------------------
# Deduplication helpers
# ---------------------------------------------------------------------------

def _opportunity_key(opp: dict) -> str:
	"""Stable content fingerprint for deduplication."""
	return hashlib.sha256(
		(opp.get("source_url") or opp.get("url") or opp.get("title") or "").encode()
	).hexdigest()[:16]


def _load_seen_keys(storage_dir: Path, lookback_days: int) -> set[str]:
	"""Return fingerprints of opportunities already stored in the past N days."""
	seen: set[str] = set()
	cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
	for path in sorted(storage_dir.glob("*.json")):
		try:
			date_str = path.stem  # YYYY-MM-DD
			file_date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
			if file_date < cutoff:
				continue
			with path.open() as f:
				for opp in json.load(f):
					seen.add(_opportunity_key(opp))
		except Exception:
			pass
	return seen


# ---------------------------------------------------------------------------
# Main crawl logic
# ---------------------------------------------------------------------------

async def run_crawl() -> int:
	"""Discover, deduplicate, and persist today's opportunities. Returns count saved."""
	from docfusion.services.discovery_service import DefaultDiscoveryService

	svc = DefaultDiscoveryService()
	_log.info("Starting daily opportunity crawl (limit=%d)", CRAWL_LIMIT)

	# Run targeted queries for each major procurement theme
	queries = [
		{"query": "RFP tender procurement Africa 2026", "limit": 20},
		{"query": "grant development NGO Africa 2026", "limit": 20},
		{"query": "international tender consultancy 2026", "limit": 20},
		{"query": "procurement notice UN multilateral 2026", "limit": 20},
		{"query": "call for proposals foundation grants 2026", "limit": 20},
	]

	all_opps: list[dict] = []
	for q in queries:
		try:
			results = await svc.discover_opportunities(filters=q)
			all_opps.extend(results)
		except Exception as exc:
			_log.warning("Query failed (%s): %s", q["query"], exc)

	_log.info("Discovered %d raw opportunities across %d queries", len(all_opps), len(queries))

	# Deduplicate within this run
	seen_this_run: set[str] = set()
	deduped: list[dict] = []
	for opp in all_opps:
		key = _opportunity_key(opp)
		if key not in seen_this_run:
			seen_this_run.add(key)
			deduped.append(opp)

	# Deduplicate against prior days
	STORAGE_DIR.mkdir(parents=True, exist_ok=True)
	seen_prior = _load_seen_keys(STORAGE_DIR, LOOKBACK_DAYS)
	new_opps = [opp for opp in deduped if _opportunity_key(opp) not in seen_prior]

	_log.info(
		"After dedup: %d unique this run, %d new (not seen in past %d days)",
		len(deduped), len(new_opps), LOOKBACK_DAYS,
	)

	if not new_opps:
		_log.info("No new opportunities — nothing written")
		return 0

	# Persist
	today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
	out_path = STORAGE_DIR / f"{today}.json"
	with out_path.open("w") as f:
		json.dump(new_opps, f, indent=2, default=str)

	_log.info("Wrote %d new opportunities → %s", len(new_opps), out_path)
	return len(new_opps)


def main() -> int:
	logging.basicConfig(
		level=logging.INFO,
		format="%(asctime)s %(levelname)s %(name)s: %(message)s",
	)
	try:
		count = asyncio.run(run_crawl())
		print(f"Daily crawl complete: {count} new opportunities stored")
		return 0
	except Exception as exc:
		_log.exception("Daily crawl failed: %s", exc)
		return 1


if __name__ == "__main__":
	sys.exit(main())
