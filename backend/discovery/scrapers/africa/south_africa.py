"""
South Africa eTenders Scraper
==============================

Scrapes tender opportunities from South Africa's eTenders portal.

URL: https://www.etenders.gov.za

Page Structure Analysis:
- /Home/opportunities?id=1 shows currently advertised tenders
- Table structure with columns:
  - Category
  - Tender Description
  - eSubmission
  - Advertised
  - Closing
- Pagination available
- Total tenders: 145,000+

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


class SAeTendersScraper(PlaywrightScraper):
	"""Scraper for South Africa eTenders (etenders.gov.za).

	South Africa's portal uses JavaScript for dynamic content loading.
	"""

	source_id = "sa_etenders"
	source_name = "South Africa eTenders"
	base_url = "https://www.etenders.gov.za"
	source_type = SourceType.GOVERNMENT

	rate_limit = 1.0
	timeout = 60

	# Playwright settings
	requires_javascript = True
	default_wait_for = "table tbody tr"

	async def scrape(self) -> list[ScrapedOpportunity]:
		"""Scrape South Africa eTenders for opportunities."""
		opportunities: list[ScrapedOpportunity] = []
		seen_ids: set[str] = set()

		# South Africa eTenders uses query parameters
		# id=1: Currently Advertised, id=2: Awarded, id=3: Cancelled, id=4: Closed
		search_paths = [
			"/Home/opportunities?id=1",  # Currently Advertised
		]

		for path in search_paths:
			try:
				self._log_info(f"Fetching SA eTenders from {path}")
				html = await self.fetch_page_js(
					path,
					wait_for=self.default_wait_for,
					timeout=45000,
				)

				soup = self.parse_html(html)
				tender_items = self._extract_tender_items(soup)

				self._log_info(f"Found {len(tender_items)} tender entries on {path}")

				for item in tender_items:
					try:
						opp = self._parse_tender_item(item)
						if opp and opp.source_id not in seen_ids:
							opportunities.append(opp)
							seen_ids.add(opp.source_id)
					except Exception as e:
						logger.debug(f"Failed to parse tender: {e}")
						continue

				self._metrics.pages_scraped += 1

			except Exception as e:
				self._log_warning(f"Failed to scrape {path}: {e}")
				continue

		self._log_info(f"Total opportunities extracted: {len(opportunities)}")
		return opportunities

	def _extract_tender_items(self, soup: Any) -> list[Any]:
		"""Extract tender items from parsed HTML.

		South Africa eTenders uses a table for tender listings.
		"""
		items = []

		# Find all tables with tender data
		tables = soup.select("table")
		for table in tables:
			rows = table.select("tbody tr")
			if len(rows) > 0:
				items.extend(rows)

		return items

	def _parse_tender_item(self, row: Any) -> ScrapedOpportunity | None:
		"""Parse a single tender row from SA eTenders table.

		Table columns:
		- Category (e.g., "Services: Professional")
		- Tender Description
		- eSubmission
		- Advertised
		- Closing
		"""
		cells = row.select("td")
		if len(cells) < 3:
			return None

		# Column indices (0-based)
		# 0: (expand icon)
		# 1: Category
		# 2: Tender Description (with link)
		# 3: eSubmission
		# 4: Advertised
		# 5: Closing

		# Extract category
		category = self.clean_text(cells[1].get_text()) if len(cells) > 1 else ""

		# Extract title and link
		title_elem = cells[2].select_one("a") if len(cells) > 2 else None
		if title_elem:
			title = self.clean_text(title_elem.get_text())
			href = title_elem.get("href", "")
			if href and not href.startswith("http"):
				href = urljoin(self.base_url, href)
		else:
			title = self.clean_text(cells[2].get_text()) if len(cells) > 2 else ""
			href = None

		if not title or len(title) < 5:
			return None

		# Extract advertised date
		advertised_text = self.clean_text(cells[4].get_text()) if len(cells) > 4 else ""
		published_date = self.parse_date(advertised_text) if advertised_text else None

		# Extract closing date
		closing_text = self.clean_text(cells[5].get_text()) if len(cells) > 5 else ""
		# Closing text may include "in X days"
		if "in" in closing_text.lower():
			# Extract just the date part
			parts = closing_text.split()
			for i, part in enumerate(parts):
				if "/" in part or "-" in part:
					closing_text = part
					break
		deadline = self.parse_date(closing_text) if closing_text else None

		# Extract tender number from title (usually starts with "Tender XXX")
		reference = None
		if title.startswith("Tender "):
			parts = title.split(":")
			if len(parts) > 1:
				reference = parts[0].strip()
				title = parts[1].strip()

		# Generate unique source ID
		source_id = hashlib.md5(f"{title}{category}".encode()).hexdigest()[:16]

		return self.create_opportunity(
			source_id=source_id,
			title=title,
			description=None,
			organization=None,
			country="South Africa",
			deadline=deadline,
			published_date=published_date,
			document_url=href,
			portal_url=href,
			reference=reference,
			notice_id=source_id,
			opportunity_type=OpportunityType.TENDER,
			category=category if category else self.detect_category(title),
		)