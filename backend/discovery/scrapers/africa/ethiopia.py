"""
Ethiopia e-GP (Electronic Government Procurement) Scraper
=========================================================

Scrapes tender opportunities from Ethiopia's e-GP system.

URL: https://production.egp.gov.et

Page Structure Analysis:
- Home page shows statistics: 618 Active Tenders
- Tenders page: /egp/bids/all
- Table columns:
  - Procurement Ref. No.
  - Lot No.
  - Procurement Title
  - Procuring Entity
  - Procurement Category
  - Market Approach
  - Source
  - Submission Deadline

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


class EthiopiaScraper(PlaywrightScraper):
	"""Scraper for Ethiopia e-GP Portal.

	Ethiopia's e-GP uses JavaScript for content rendering.
	"""

	source_id = "ethiopia_egp"
	source_name = "Ethiopia e-GP"
	base_url = "https://production.egp.gov.et"
	source_type = SourceType.GOVERNMENT

	rate_limit = 2.0
	timeout = 60

	# Playwright settings
	requires_javascript = True
	default_wait_for = "table tbody tr"

	async def scrape(self) -> list[ScrapedOpportunity]:
		"""Scrape Ethiopia e-GP for tender opportunities."""
		opportunities: list[ScrapedOpportunity] = []
		seen_ids: set[str] = set()

		# Ethiopia e-GP tender listing pages
		search_paths = [
			"/egp/bids/all",  # All tenders
		]

		for path in search_paths:
			try:
				self._log_info(f"Fetching Ethiopia e-GP from {path}")
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
		items = []

		# Find the data table
		tables = soup.select("table")
		for table in tables:
			rows = table.select("tbody tr")
			if len(rows) > 0:
				items.extend(rows)

		return items

	def _parse_tender_item(self, row: Any) -> ScrapedOpportunity | None:
		"""Parse a single tender row from Ethiopia e-GP table.

		Table columns:
		- Procurement Ref. No.
		- Lot No.
		- Procurement Title
		- Procuring Entity
		- Procurement Category
		- Market Approach
		- Source
		- Submission Deadline
		"""
		cells = row.select("td")
		if len(cells) < 3:
			return None

		# Column indices (0-based)
		# 0: Procurement Ref. No.
		# 1: Lot No.
		# 2: Procurement Title
		# 3: Procuring Entity
		# 4: Procurement Category
		# 5: Market Approach
		# 6: Source
		# 7: Submission Deadline

		# Extract reference number
		reference = self.clean_text(cells[0].get_text()) if len(cells) > 0 else ""
		if not reference or len(reference) < 3:
			return None

		# Extract title
		title = self.clean_text(cells[2].get_text()) if len(cells) > 2 else ""
		if not title or len(title) < 3:
			title = reference

		# Extract organization
		org = self.clean_text(cells[3].get_text()) if len(cells) > 3 else ""

		# Extract category
		category = self.clean_text(cells[4].get_text()) if len(cells) > 4 else ""

		# Extract market approach
		market_approach = self.clean_text(cells[5].get_text()) if len(cells) > 5 else ""

		# Extract submission deadline
		deadline_text = self.clean_text(cells[7].get_text()) if len(cells) > 7 else ""
		deadline = self.parse_date(deadline_text) if deadline_text else None

		# Generate unique source ID
		source_id = hashlib.md5(f"{reference}{org}".encode()).hexdigest()[:16]

		# Determine opportunity type from category
		opp_type = OpportunityType.TENDER
		if category:
			cat_lower = category.lower()
			if "consultancy" in cat_lower or "nonconsultancy" in cat_lower:
				opp_type = OpportunityType.RFP
			elif "goods" in cat_lower:
				opp_type = OpportunityType.TENDER

		return self.create_opportunity(
			source_id=source_id,
			title=title,
			description=None,
			organization=org if org else None,
			country="Ethiopia",
			deadline=deadline,
			published_date=None,
			document_url=None,
			portal_url=f"{self.base_url}/egp/bids/all",
			reference=reference,
			notice_id=reference,
			opportunity_type=opp_type,
			category=category if category else self.detect_category(title),
		)