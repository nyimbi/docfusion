"""
Nigeria Bureau of Public Procurement (BPP) Scraper
====================================================

Scrapes tender opportunities from Nigeria's public procurement portal.

URL: https://www.publicprocurement.ng (may vary)

Author: TenderSourceMax
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any

from backend.discovery.models.opportunity import (
	ScrapedOpportunity,
	OpportunityType,
	SourceType,
)
from backend.discovery.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class NigeriaBPPScraper(BaseScraper):
	"""Scraper for Nigeria BPP."""

	source_id = "nigeria_bpp"
	source_name = "Nigeria BPP"
	base_url = "https://www.publicprocurement.ng"
	source_type = SourceType.GOVERNMENT

	rate_limit = 1.0
	timeout = 30

	async def scrape(self) -> list[ScrapedOpportunity]:
		"""Scrape Nigeria BPP for opportunities."""
		opportunities: list[ScrapedOpportunity] = []

		try:
			self._log_info("Fetching Nigeria BPP tenders")
			html = await self.fetch_page("/tenders")

			soup = self.parse_html(html)
			tender_items = soup.select(".tender-list .tender-item, tbody tr")

			self._log_info(f"Found {len(tender_items)} tender entries")

			for item in tender_items:
				try:
					opp = self._parse_tender_item(item)
					if opp:
						opportunities.append(opp)
				except Exception as e:
					logger.debug(f"Failed to parse tender: {e}")
					continue

			self._metrics.pages_scraped = 1

		except Exception as e:
			self._log_error(f"Scrape failed: {e}")
			raise

		self._log_info(f"Total opportunities extracted: {len(opportunities)}")
		return opportunities

	def _parse_tender_item(self, item: Any) -> ScrapedOpportunity | None:
		"""Parse a tender item."""
		title_elem = item.select_one(".tender-title a, td:first-child a, .title a")
		if not title_elem:
			return None

		title = self.clean_text(title_elem.get_text())
		href = title_elem.get("href", "")
		if href and not href.startswith("http"):
			href = f"{self.base_url}{href}"

		org_elem = item.select_one(".procuring-entity, td:nth-child(2), .organization")
		org = self.clean_text(org_elem.get_text()) if org_elem else ""

		deadline_elem = item.select_one(".deadline, td:nth-child(4), .closing-date")
		deadline = self.parse_date(self.clean_text(deadline_elem.get_text())) if deadline_elem else None

		fingerprint = hashlib.sha256(f"{title}|{org}".encode()).hexdigest()[:64]
		source_id = hashlib.md5(f"{title}{org}".encode()).hexdigest()[:16]

		return self.create_opportunity(
			source_id=source_id,
			title=title,
			description=None,
			organization=org,
			country="Nigeria",
			deadline=deadline,
			published_date=None,
			document_url=None,
			portal_url=href,
			reference=None,
			notice_id=source_id,
			opportunity_type=OpportunityType.TENDER,
			category=self.detect_category(title),
		)