"""
GIZ (Deutsche Gesellschaft für Internationale Zusammenarbeit) Scraper
=====================================================================

Scrapes procurement opportunities from GIZ (German Development Agency).

URL: https://www.giz.de/en/worldwide/operations.html

Notes:
- GIZ is Germany's main development agency
- Procurement for consulting services, goods, and works
- Operates in partner countries worldwide
- Part of German development cooperation

Author: TenderSourceMax
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any
from urllib.parse import urljoin

from backend.discovery.models.opportunity import (
	ScrapedOpportunity,
	OpportunityType,
	SourceType,
)
from backend.discovery.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class GIZScraper(BaseScraper):
	"""Scraper for GIZ procurement opportunities."""

	source_id = "giz"
	source_name = "Deutsche Gesellschaft für Internationale Zusammenarbeit"
	base_url = "https://www.giz.de"
	source_type = SourceType.BILATERAL

	rate_limit = 1.0
	timeout = 30

	async def scrape(self) -> list[ScrapedOpportunity]:
		"""Scrape GIZ procurement opportunities."""
		opportunities: list[ScrapedOpportunity] = []
		seen_ids: set[str] = set()

		search_paths = [
			"/en/worldwide/operations.html",
			"/en/worldwide/vacancies.html",
			"/procurement",
		]

		for path in search_paths:
			try:
				self._log_info(f"Fetching GIZ from {path}")
				html = await self.fetch_page(path)
				soup = self.parse_html(html)

				items = soup.select(".operation-item, .vacancy-item, tbody tr, .procurement-item")

				self._log_info(f"Found {len(items)} entries on {path}")

				for item in items:
					try:
						opp = self._parse_item(item)
						if opp and opp.source_id not in seen_ids:
							opportunities.append(opp)
							seen_ids.add(opp.source_id)
					except Exception as e:
						logger.debug(f"Failed to parse item: {e}")
						continue

				self._metrics.pages_scraped += 1

				if opportunities:
					break

			except Exception as e:
				self._log_warning(f"Failed to scrape {path}: {e}")
				continue

		self._log_info(f"Total opportunities extracted: {len(opportunities)}")
		return opportunities

	def _parse_item(self, item: Any) -> ScrapedOpportunity | None:
		"""Parse a single procurement item from GIZ."""
		title_elem = item.select_one("td:first-child a, .title a, a, td a, h3 a")
		if not title_elem:
			return None

		title = self.clean_text(title_elem.get_text())
		if not title or len(title) < 5:
			return None

		href = title_elem.get("href", "")
		if href and not href.startswith("http"):
			href = urljoin(self.base_url, href)

		country_elem = item.select_one("td:nth-child(2), .country, .location")
		country = self.clean_text(country_elem.get_text()) if country_elem else None

		deadline_elem = item.select_one("td:nth-child(4), td:nth-child(5), .deadline, .date")
		deadline = None
		if deadline_elem:
			deadline_text = self.clean_text(deadline_elem.get_text())
			deadline = self.parse_date(deadline_text)

		ref_elem = item.select_one("td:nth-child(2), .reference, .ref-no")
		reference = self.clean_text(ref_elem.get_text()) if ref_elem else None

		source_id = hashlib.md5(f"{title}{country}".encode()).hexdigest()[:16]

		return self.create_opportunity(
			source_id=source_id,
			title=title,
			description=None,
			organization="GIZ",
			country=country if country else "International",
			deadline=deadline,
			published_date=None,
			document_url=href if href else None,
			portal_url=href if href else None,
			reference=reference,
			notice_id=source_id,
			opportunity_type=OpportunityType.TENDER,
			category=self.detect_category(title),
		)