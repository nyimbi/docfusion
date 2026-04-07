"""
Kenya Public Procurement Information Portal (PPIP) Scraper
============================================================

Scrapes tender opportunities from Kenya's national e-procurement portal.

URL: https://tenders.go.ke

Page Structure Analysis:
- Home page shows statistics (262,248+ tenders)
- /tenders page has a data table with columns:
  - Tender. No
  - Description
  - Procuring_Entity
  - Proc. Method
  - Proc. Category
  - Close Date
  - Time to Close
  - Publish Date
  - Addendum
  - Actions
- Pagination available (86+ pages)

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


class KenyaPPIPScraper(PlaywrightScraper):
	"""Scraper for Kenya PPIP (tenders.go.ke).

	Kenya's portal uses JavaScript for dynamic content loading.
	"""

	source_id = "kenya_ppip"
	source_name = "Kenya PPIP"
	base_url = "https://tenders.go.ke"
	source_type = SourceType.GOVERNMENT

	rate_limit = 1.0
	timeout = 60

	# Playwright settings
	requires_javascript = True
	# Kenya PPIP uses a data table with standard HTML structure
	default_wait_for = "table tbody tr"

	async def scrape(self) -> list[ScrapedOpportunity]:
		"""Scrape Kenya PPIP for tender opportunities."""
		opportunities: list[ScrapedOpportunity] = []
		seen_ids: set[str] = set()

		# Kenya PPIP tenders page
		search_paths = [
			"/tenders",
		]

		for path in search_paths:
			try:
				self._log_info(f"Fetching Kenya PPIP from {path}")
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
						logger.debug(f"Failed to parse tender item: {e}")
						continue

				self._metrics.pages_scraped += 1

				# If we found opportunities, no need to try other paths
				if opportunities:
					break

			except Exception as e:
				self._log_warning(f"Failed to scrape {path}: {e}")
				continue

		self._log_info(f"Total opportunities extracted: {len(opportunities)}")
		return opportunities

	def _extract_tender_items(self, soup: Any) -> list[Any]:
		"""Extract tender items from parsed HTML.

		Kenya PPIP uses a standard HTML table for tender listings.
		"""
		# Find the data table with tender listings
		# The table has columns: Tender. No, Description, Procuring_Entity, etc.
		items = []

		# Find all table rows
		tables = soup.select("table")
		for table in tables:
			rows = table.select("tbody tr")
			if len(rows) > 1:  # Has data rows beyond header
				items.extend(rows)

		return items

	def _parse_tender_item(self, row: Any) -> ScrapedOpportunity | None:
		"""Parse a single tender row from Kenya PPIP table.

		Table columns:
		- Tender. No
		- Description
		- Procuring_Entity
		- Proc. Method
		- Proc. Category
		- Close Date
		- Time to Close
		- Publish Date
		- Addendum
		- Actions
		"""
		cells = row.select("td")
		if len(cells) < 3:
			return None

		# Column indices (0-based)
		# 0: Tender. No (with link)
		# 1: Description
		# 2: Procuring_Entity
		# 3: Proc. Method
		# 4: Proc. Category
		# 5: Close Date
		# 6: Time to Close
		# 7: Publish Date

		# Extract tender number and link
		tender_no_elem = cells[0].select_one("a") if len(cells) > 0 else None
		if tender_no_elem:
			tender_no = self.clean_text(tender_no_elem.get_text())
			href = tender_no_elem.get("href", "")
			if href and not href.startswith("http"):
				href = urljoin(self.base_url, href)
		else:
			tender_no = self.clean_text(cells[0].get_text()) if len(cells) > 0 else ""
			href = None

		if not tender_no or len(tender_no) < 3:
			return None

		# Extract description
		description = self.clean_text(cells[1].get_text()) if len(cells) > 1 else ""

		# Extract procuring entity
		org = self.clean_text(cells[2].get_text()) if len(cells) > 2 else ""

		# Extract procurement method
		proc_method = self.clean_text(cells[3].get_text()) if len(cells) > 3 else ""

		# Extract category
		category = self.clean_text(cells[4].get_text()) if len(cells) > 4 else ""

		# Extract close date
		deadline_text = self.clean_text(cells[5].get_text()) if len(cells) > 5 else ""
		deadline = self.parse_date(deadline_text) if deadline_text else None

		# Extract publish date
		published_text = self.clean_text(cells[7].get_text()) if len(cells) > 7 else ""
		published_date = self.parse_date(published_text) if published_text else None

		# Generate unique source ID
		source_id = hashlib.md5(f"{tender_no}{org}".encode()).hexdigest()[:16]

		# Determine opportunity type from procurement method
		opp_type = OpportunityType.TENDER
		if proc_method:
			proc_lower = proc_method.lower()
			if "eoi" in proc_lower or "expression" in proc_lower:
				opp_type = OpportunityType.EOI
			elif "rfp" in proc_lower or "proposal" in proc_lower:
				opp_type = OpportunityType.RFP
			elif "rfq" in proc_lower or "quotation" in proc_lower:
				opp_type = OpportunityType.RFQ
			elif "prequalification" in proc_lower:
				opp_type = OpportunityType.EOI  # Prequalification is similar to EOI

		return self.create_opportunity(
			source_id=source_id,
			title=description if description else tender_no,
			description=description,
			organization=org if org else None,
			country="Kenya",
			deadline=deadline,
			published_date=published_date,
			document_url=href,
			portal_url=href,
			reference=tender_no,
			notice_id=tender_no,
			opportunity_type=opp_type,
			category=category if category else self.detect_category(description),
		)