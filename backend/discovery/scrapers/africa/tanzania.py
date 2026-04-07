"""
Tanzania TANePS e-Procurement System Scraper
============================================

Scrapes tender opportunities from Tanzania's National e-Procurement System.

URL: https://www.taneps.go.tz

Notes:
- TANePS uses JavaScript for content rendering
- Requires authentication for full access
- Public tender listings available without login

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
from backend.discovery.scrapers.playwright_scraper import PlaywrightScraper

logger = logging.getLogger(__name__)


class TanzaniaScraper(PlaywrightScraper):
	"""Scraper for Tanzania TANePS e-Procurement Portal.

	TANePS requires JavaScript rendering for tender listings.
	"""

	source_id = "tanzania_taneps"
	source_name = "Tanzania TANePS"
	base_url = "https://www.taneps.go.tz"
	source_type = SourceType.GOVERNMENT

	rate_limit = 2.0
	timeout = 60

	# Playwright settings
	requires_javascript = True
	default_wait_for = "table tbody tr, .tender-item, .opportunity-item, .dataTables_wrapper"

	async def scrape(self) -> list[ScrapedOpportunity]:
		"""Scrape Tanzania TANePS for tender opportunities."""
		opportunities: list[ScrapedOpportunity] = []
		seen_ids: set[str] = set()

		# TANePS tender listing pages
		search_paths = [
			"/",
			"/epps/common/viewOpenedTenders.do",
			"/public/tenders",
		]

		for path in search_paths:
			try:
				self._log_info(f"Fetching Tanzania TANePS from {path}")
				html = await self.fetch_page_js(
					path,
					wait_for=self.default_wait_for,
					timeout=45000,
				)

				soup = self.parse_html(html)
				tender_items = self._extract_tender_items(soup)

				self._log_info(f"Found {len(tender_items)} entries on {path}")

				for item in tender_items:
					try:
						opp = self._parse_tender_item(item)
						if opp and opp.source_id not in seen_ids:
							opportunities.append(opp)
							seen_ids.add(opp.source_id)
					except Exception as e:
						logger.debug(f"Failed to parse item: {e}")
						continue

				self._metrics.pages_scraped += 1

			except Exception as e:
				self._log_warning(f"Failed to scrape {path}: {e}")
				continue

		self._log_info(f"Total opportunities extracted: {len(opportunities)}")
		return opportunities

	def _extract_tender_items(self, soup: Any) -> list[Any]:
		"""Extract tender items from parsed HTML."""
		selectors = [
			"table tbody tr",
			".tender-item",
			".opportunity-item",
			"[class*='tender']",
			".dataTable tbody tr",
			".display tbody tr",
		]

		items = []
		for selector in selectors:
			found = soup.select(selector)
			if found:
				items.extend(found)

		return items

	def _parse_tender_item(self, item: Any) -> ScrapedOpportunity | None:
		"""Parse a single tender item from TANePS."""
		# Extract title
		title_elem = item.select_one(
			"td:first-child a, .title a, a[href*='tender'], td a"
		)
		if not title_elem:
			return None

		title = self.clean_text(title_elem.get_text())
		if not title or len(title) < 5:
			return None

		# Extract link
		href = title_elem.get("href", "")
		if href and not href.startswith("http"):
			href = urljoin(self.base_url, href)

		# Extract organization/procuring entity
		org_elem = item.select_one(
			"td:nth-child(2), .organization, .entity, .procuring-entity"
		)
		org = self.clean_text(org_elem.get_text()) if org_elem else ""

		# Extract deadline
		deadline_elem = item.select_one(
			"td:nth-child(4), td:nth-child(5), .deadline, .closing-date"
		)
		deadline = None
		if deadline_elem:
			deadline_text = self.clean_text(deadline_elem.get_text())
			deadline = self.parse_date(deadline_text)

		# Extract reference
		ref_elem = item.select_one("td:nth-child(2), .reference, .ref-no")
		reference = self.clean_text(ref_elem.get_text()) if ref_elem else None

		# Generate unique source ID
		source_id = hashlib.md5(f"{title}{org}".encode()).hexdigest()[:16]

		return self.create_opportunity(
			source_id=source_id,
			title=title,
			description=None,
			organization=org if org else None,
			country="Tanzania",
			deadline=deadline,
			published_date=None,
			document_url=href if href else None,
			portal_url=href if href else None,
			reference=reference,
			notice_id=source_id,
			opportunity_type=OpportunityType.TENDER,
			category=self.detect_category(title),
		)