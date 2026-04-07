"""
UNDP (UN Development Programme) Procurement Scraper
===================================================

Scrapes procurement notices from the UNDP Procurement Notices portal.

Data Source:
	https://procurement-notices.undp.org

This portal provides direct access to UNDP procurement notices
worldwide, with strong coverage of Africa and the Global South.

Notice Types:
	- Request for Proposal (RFP)
	- Invitation to Bid (ITB)
	- Request for Quotation (RFQ)
	- Expression of Interest (EOI)
	- Contract Award
	- Long-Term Agreement (LTA)

Filters Available:
	- Country
	- Category (UNSPSC codes)
	- Notice type
	- Date range
	- Search keywords

Author: TenderSourceMax
"""

from __future__ import annotations

import re
import logging
from datetime import date, datetime
from typing import Any
from urllib.parse import urljoin, urlencode

from backend.discovery.models.opportunity import (
	ScrapedOpportunity,
	OpportunityType,
	SourceType,
)
from backend.discovery.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


# ============================================================================
# Constants
# ============================================================================

# UNDP procurement URLs
UNDP_BASE_URL = "https://procurement-notices.undp.org"
UNDP_SEARCH_URL = "/view_notices.cfm"

# Map UNDP notice types to OpportunityType
UNDP_TYPE_MAP = {
	"RFP": OpportunityType.RFP,
	"Request for Proposal": OpportunityType.RFP,
	"ITB": OpportunityType.TENDER,
	"Invitation to Bid": OpportunityType.TENDER,
	"RFQ": OpportunityType.RFQ,
	"Request for Quotation": OpportunityType.RFQ,
	"EOI": OpportunityType.EOI,
	"Expression of Interest": OpportunityType.EOI,
	"LTA": OpportunityType.LTA,
	"Long Term Agreement": OpportunityType.LTA,
	"Long-Term Agreement": OpportunityType.LTA,
	"IC": OpportunityType.RFP,  # Individual Consultant
	"Individual Consultant": OpportunityType.RFP,
}

# African country codes used by UNDP
AFRICAN_COUNTRY_CODES = [
	"DZA", "AGO", "BEN", "BWA", "BFA", "BDI", "CMR", "CPV", "CAF", "TCD",
	"COM", "COG", "COD", "DJI", "EGY", "GNQ", "ERI", "SWZ", "ETH", "GAB",
	"GMB", "GHA", "GIN", "GNB", "CIV", "KEN", "LSO", "LBR", "LBY", "MDG",
	"MWI", "MLI", "MRT", "MUS", "MAR", "MOZ", "NAM", "NER", "NGA", "RWA",
	"STP", "SEN", "SYC", "SLE", "SOM", "ZAF", "SSD", "SDN", "TZA", "TGO",
	"TUN", "UGA", "ZMB", "ZWE",
]


# ============================================================================
# UNDP Scraper
# ============================================================================

class UNDPScraper(BaseScraper):
	"""
	Scraper for UNDP Procurement Notices portal.

	Scrapes procurement opportunities from UNDP's dedicated
	procurement notices website.

	Usage:
		scraper = UNDPScraper()
		result = await scraper.run()
		for opp in result.opportunities:
			print(f"{opp.title} - {opp.country}")
	"""

	source_id = "undp"
	source_name = "UNDP Procurement"
	base_url = UNDP_BASE_URL
	source_type = SourceType.UN_AGENCY

	# Scraping configuration
	rate_limit = 1.0  # 1 request per second
	timeout = 30
	max_retries = 3
	max_pages = 10

	async def scrape(self) -> list[ScrapedOpportunity]:
		"""
		Scrape UNDP procurement notices.

		Process:
		1. Fetch the main notices page
		2. Parse notice listings
		3. Paginate through results
		4. Filter for IT/software related opportunities

		Returns:
			List of ScrapedOpportunity objects
		"""
		opportunities: list[ScrapedOpportunity] = []

		try:
			# Fetch main notices page
			self._log_info("Fetching UNDP procurement notices")
			html = await self.fetch_page(UNDP_SEARCH_URL)
			soup = self.parse_html(html)

			# Extract notices from first page
			notices = self._extract_notices(soup)
			self._log_info(f"Found {len(notices)} notices on page 1")

			for notice in notices:
				opp = self._notice_to_opportunity(notice)
				if opp:
					opportunities.append(opp)

			# Paginate
			total_pages = self._get_total_pages(soup)
			self._log_info(f"Total pages: {total_pages}")

			for page in range(2, min(total_pages + 1, self.max_pages + 1)):
				try:
					self._log_info(f"Fetching page {page}/{total_pages}")
					page_html = await self._fetch_page(page)
					page_soup = self.parse_html(page_html)

					page_notices = self._extract_notices(page_soup)
					self._log_info(f"Found {len(page_notices)} notices on page {page}")

					for notice in page_notices:
						opp = self._notice_to_opportunity(notice)
						if opp:
							opportunities.append(opp)

					self._metrics.pages_scraped += 1

				except Exception as e:
					self._log_warning(f"Failed to fetch page {page}: {e}")
					continue

			self._log_info(f"Total opportunities extracted: {len(opportunities)}")

		except Exception as e:
			self._log_error(f"Scrape failed: {e}")
			raise

		return opportunities

	async def _fetch_page(self, page: int) -> str:
		"""Fetch a specific page of results."""
		params = {
			"Page": page,
			"sortby": "deadline",
			"sortdir": "asc",  # Earliest deadline first
		}
		url = f"{UNDP_SEARCH_URL}?{urlencode(params)}"
		return await self.fetch_page(url)

	def _extract_notices(self, soup: Any) -> list[dict[str, Any]]:
		"""Extract notice data from page."""
		notices: list[dict[str, Any]] = []

		# UNDP uses table-based layout for notices
		table = soup.select_one("table.noticesList, table#notices, .procurement-table")

		if table:
			rows = table.select("tbody tr, tr.notice-row")
			for row in rows:
				notice = self._parse_table_row(row)
				if notice:
					notices.append(notice)
		else:
			# Try alternative layout
			items = soup.select(".notice-item, .procurement-notice, .views-row")
			for item in items:
				notice = self._parse_notice_item(item)
				if notice:
					notices.append(notice)

		return notices

	def _parse_table_row(self, row: Any) -> dict[str, Any] | None:
		"""Parse a notice from table row."""
		cells = row.select("td")
		if len(cells) < 3:
			return None

		notice: dict[str, Any] = {}

		# Extract title and link (usually first cell)
		title_cell = cells[0]
		title_link = title_cell.select_one("a")
		if title_link:
			notice["title"] = self.clean_text(title_link.get_text())
			href = title_link.get("href", "")
			if href:
				notice["url"] = urljoin(self.base_url, href)
				# Extract negotiation ID from URL
				match = re.search(r"nego_id[=_](\d+)", href, re.IGNORECASE)
				if match:
					notice["notice_id"] = match.group(1)
		else:
			notice["title"] = self.clean_text(title_cell.get_text())

		if not notice.get("title"):
			return None

		# Extract other fields based on column position
		# Typical order: Title, Country, Deadline, Notice Type

		if len(cells) >= 2:
			notice["country"] = self.clean_text(cells[1].get_text())

		if len(cells) >= 3:
			deadline_text = self.clean_text(cells[2].get_text())
			notice["deadline"] = self.parse_date(deadline_text)

		if len(cells) >= 4:
			notice["notice_type"] = self.clean_text(cells[3].get_text())

		if len(cells) >= 5:
			notice["reference"] = self.clean_text(cells[4].get_text())

		return notice

	def _parse_notice_item(self, item: Any) -> dict[str, Any] | None:
		"""Parse notice from non-table layout."""
		notice: dict[str, Any] = {}

		# Extract title
		title_elem = item.select_one("a, .title, h3, h4")
		if title_elem:
			notice["title"] = self.clean_text(title_elem.get_text())
			if title_elem.name == "a":
				notice["url"] = urljoin(self.base_url, title_elem.get("href", ""))

		if not notice.get("title"):
			return None

		# Extract country
		country_elem = item.select_one(".country, .location")
		if country_elem:
			notice["country"] = self.clean_text(country_elem.get_text())

		# Extract deadline
		deadline_elem = item.select_one(".deadline, .date")
		if deadline_elem:
			notice["deadline"] = self.parse_date(self.clean_text(deadline_elem.get_text()))

		# Extract type
		type_elem = item.select_one(".type, .notice-type")
		if type_elem:
			notice["notice_type"] = self.clean_text(type_elem.get_text())

		# Extract description
		desc_elem = item.select_one(".description, .summary, p")
		if desc_elem:
			notice["description"] = self.clean_text(desc_elem.get_text())

		return notice

	def _get_total_pages(self, soup: Any) -> int:
		"""Get total number of pages from pagination."""
		# Look for pagination
		pagination = soup.select_one(".pagination, .pager")
		if pagination:
			page_links = pagination.select("a")
			max_page = 1
			for link in page_links:
				text = self.clean_text(link.get_text())
				if text.isdigit():
					max_page = max(max_page, int(text))
			return max_page

		# Try total results count
		total_elem = soup.select_one(".total, .results-count")
		if total_elem:
			text = self.clean_text(total_elem.get_text())
			match = re.search(r"(\d+)", text.replace(",", ""))
			if match:
				total = int(match.group(1))
				return (total + 19) // 20  # Assume 20 per page

		return 1

	def _notice_to_opportunity(self, notice: dict[str, Any]) -> ScrapedOpportunity | None:
		"""Convert notice dict to ScrapedOpportunity."""
		title = notice.get("title")
		if not title:
			return None

		# Generate ID
		notice_id = notice.get("notice_id")
		if not notice_id:
			import hashlib
			notice_id = hashlib.md5(title.encode()).hexdigest()[:10]

		# Determine opportunity type
		notice_type = notice.get("notice_type", "")
		opp_type = UNDP_TYPE_MAP.get(notice_type, OpportunityType.RFP)

		# Detect category
		text = f"{title} {notice.get('description', '')}"
		category = self.detect_category(text)

		return self.create_opportunity(
			source_id=notice_id,
			title=title,
			description=notice.get("description"),
			country=notice.get("country"),
			deadline=notice.get("deadline"),
			document_url=notice.get("url"),
			portal_url=notice.get("url"),
			reference=notice.get("reference"),
			notice_id=notice_id,
			opportunity_type=opp_type,
			category=category,
			organization="UNDP",
			funder="UNDP",
		)


# ============================================================================
# Standalone execution for testing
# ============================================================================

async def main() -> None:
	"""Run scraper standalone for testing."""
	import asyncio

	logging.basicConfig(
		level=logging.INFO,
		format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
	)

	scraper = UNDPScraper()
	result = await scraper.run()

	print(f"\n{'='*60}")
	print(f"UNDP Scraping Results")
	print(f"{'='*60}")
	print(f"Status: {result.metrics.status.value}")
	print(f"Opportunities found: {result.count}")
	print(f"Duration: {result.metrics.duration_seconds:.2f}s")

	if result.opportunities:
		print(f"\nSample opportunities:")
		for opp in result.opportunities[:5]:
			print(f"  - {opp.title[:60]}...")
			print(f"    Country: {opp.country}")
			print(f"    Deadline: {opp.deadline}")
			print()


if __name__ == "__main__":
	import asyncio
	asyncio.run(main())
