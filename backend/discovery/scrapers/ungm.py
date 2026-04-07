"""
UNGM (UN Global Marketplace) Scraper
=====================================

Scrapes tender opportunities from the UN Global Marketplace (www.ungm.org),
the central procurement portal for all UN agencies.

Uses Playwright for JavaScript rendering as UNGM requires dynamic content loading.

Covered Organizations:
	- UNOPS (UN Office for Project Services)
	- UNDP (UN Development Programme)
	- UNICEF (UN Children's Fund)
	- WHO (World Health Organization)
	- WFP (World Food Programme)
	- FAO (Food and Agriculture Organization)
	- UNESCO (UN Educational, Scientific and Cultural Organization)
	- UNHCR (UN Refugee Agency)
	- ILO (International Labour Organization)
	- UNIDO (UN Industrial Development Organization)
	- UNFPA (UN Population Fund)
	- UN Women
	- And many more...

Data Source:
	- Search page: https://www.ungm.org/Public/Notice
	- API endpoint: https://www.ungm.org/Public/Notice/Search

Author: DocuFusion Team
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
from backend.discovery.scrapers.playwright_scraper import PlaywrightScraper

logger = logging.getLogger(__name__)


# ============================================================================
# Constants
# ============================================================================

# Map UNGM notice types to OpportunityType
NOTICE_TYPE_MAP = {
	"EOI": OpportunityType.EOI,
	"Expression of Interest": OpportunityType.EOI,
	"RFP": OpportunityType.RFP,
	"Request for Proposal": OpportunityType.RFP,
	"RFQ": OpportunityType.RFQ,
	"Request for Quotation": OpportunityType.RFQ,
	"ITB": OpportunityType.TENDER,
	"Invitation to Bid": OpportunityType.TENDER,
	"IFB": OpportunityType.IFB,
	"Invitation for Bids": OpportunityType.IFB,
	"RFI": OpportunityType.RFI,
	"Request for Information": OpportunityType.RFI,
}


# ============================================================================
# UNGM Scraper
# ============================================================================

class UNGMScraper(PlaywrightScraper):
	"""
	Scraper for UN Global Marketplace (UNGM).

	Uses Playwright for JavaScript rendering since UNGM loads content dynamically.

	Usage:
		scraper = UNGMScraper()
		result = await scraper.run()
		for opp in result.opportunities:
			print(f"{opp.title} - {opp.deadline}")
	"""

	source_id = "ungm"
	source_name = "UN Global Marketplace"
	base_url = "https://www.ungm.org"
	source_type = SourceType.UN_AGENCY

	# Scraping configuration
	rate_limit = 1.0  # 1 request per second
	timeout = 60
	max_pages = 10  # Limit pages to avoid excessive scraping

	# Playwright settings
	requires_javascript = True
	default_wait_for = ".notice-item, table tbody tr, .searchResults"

	async def scrape(self) -> list[ScrapedOpportunity]:
		"""
		Scrape UNGM for IT/software opportunities using Playwright.

		Process:
		1. Load search page with JavaScript rendering
		2. Wait for content to load
		3. Parse results and extract opportunities
		4. Paginate through results

		Returns:
			List of ScrapedOpportunity objects
		"""
		opportunities: list[ScrapedOpportunity] = []

		try:
			# Fetch initial search page with JavaScript rendering
			self._log_info("Fetching UNGM search page with Playwright")
			html = await self.fetch_page_js(
				self.search_url,
				wait_for=self.default_wait_for,
				timeout=30000,
			)

			# Parse the initial page
			soup = self.parse_html(html)

			# Extract notices from search results
			notices = self._extract_notices_from_page(soup)
			self._log_info(f"Found {len(notices)} notices on initial page")

			# Add to opportunities list
			for notice in notices:
				opp = self._notice_to_opportunity(notice)
				if opp:
					opportunities.append(opp)

			# Paginate through additional pages
			total_pages = self._extract_total_pages(soup)
			self._log_info(f"Total pages: {total_pages}")

			for page in range(2, min(total_pages + 1, self.max_pages + 1)):
				try:
					self._log_info(f"Fetching page {page}/{total_pages}")

					# Fetch paginated results with JavaScript
					page_url = f"{self.search_url}?PageIndex={page}"
					page_html = await self.fetch_page_js(
						page_url,
						wait_for=self.default_wait_for,
						timeout=30000,
					)
					page_soup = self.parse_html(page_html)

					page_notices = self._extract_notices_from_page(page_soup)
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

	@property
	def search_url(self) -> str:
		"""UNGM search page URL."""
		return "/Public/Notice"

	def _extract_notices_from_page(self, soup: Any) -> list[dict[str, Any]]:
		"""
		Extract notice data from search results page.

		Args:
			soup: BeautifulSoup object of the page

		Returns:
			List of notice dictionaries
		"""
		notices: list[dict[str, Any]] = []

		# UNGM notice items are in table rows or div containers
		# Try multiple selectors based on UNGM's structure
		notice_rows = soup.select("table tbody tr, .notice-item, .noticeList .item, .searchResults tr")

		if not notice_rows:
			# Try alternative selectors for JS-rendered content
			notice_rows = soup.select("[data-notice-id], .tender-item, .opportunity-row")

		for row in notice_rows:
			try:
				notice = self._parse_notice_row(row)
				if notice:
					notices.append(notice)
			except Exception as e:
				logger.debug(f"Failed to parse notice row: {e}")
				continue

		return notices

	def _parse_notice_row(self, row: Any) -> dict[str, Any] | None:
		"""
		Parse a single notice row/item.

		Args:
			row: BeautifulSoup element for the notice row

		Returns:
			Notice data dictionary or None if parsing fails
		"""
		notice: dict[str, Any] = {}

		# Extract title and link
		title_elem = row.select_one("a[href*='Notice'], .title a, td:first-child a, a[href*='/Public/Notice/']")
		if title_elem:
			notice["title"] = self.clean_text(title_elem.get_text())
			href = title_elem.get("href", "")
			if href:
				notice["url"] = urljoin(self.base_url, href)
				# Extract notice ID from URL
				match = re.search(r"/(\d+)(?:$|/)", href)
				if match:
					notice["notice_id"] = match.group(1)

		if not notice.get("title"):
			return None

		# Extract UN agency/organization
		org_elem = row.select_one(".organization, .agency, td:nth-child(2), .org")
		if org_elem:
			notice["organization"] = self.clean_text(org_elem.get_text())

		# Extract deadline
		deadline_elem = row.select_one(".deadline, .closingDate, td:nth-child(4), .date")
		if deadline_elem:
			deadline_text = self.clean_text(deadline_elem.get_text())
			notice["deadline"] = self.parse_date(deadline_text)

		# Extract publication date
		pub_elem = row.select_one(".publicationDate, td:nth-child(3), .published")
		if pub_elem:
			pub_text = self.clean_text(pub_elem.get_text())
			notice["published_date"] = self.parse_date(pub_text)

		# Extract notice type
		type_elem = row.select_one(".noticeType, .type, td:nth-child(5), .category")
		if type_elem:
			notice["notice_type"] = self.clean_text(type_elem.get_text())

		# Extract country
		country_elem = row.select_one(".country, .location, td:nth-child(3)")
		if country_elem:
			notice["country"] = self.clean_text(country_elem.get_text())

		# Extract reference number
		ref_elem = row.select_one(".reference, .refNo, td:nth-child(2)")
		if ref_elem:
			notice["reference"] = self.clean_text(ref_elem.get_text())

		# Extract description/summary if available
		desc_elem = row.select_one(".description, .summary, td:nth-child(6)")
		if desc_elem:
			notice["description"] = self.clean_text(desc_elem.get_text())

		return notice

	def _extract_total_pages(self, soup: Any) -> int:
		"""
		Extract total number of pages from pagination.

		Args:
			soup: BeautifulSoup object

		Returns:
			Total number of pages
		"""
		# Look for pagination elements
		pagination = soup.select_one(".pagination, .pager, [class*='pagination']")
		if not pagination:
			return 1

		# Try to find last page number
		page_links = pagination.select("a[href*='PageIndex'], .page-link, li a")
		if page_links:
			max_page = 1
			for link in page_links:
				text = self.clean_text(link.get_text())
				if text.isdigit():
					max_page = max(max_page, int(text))
			return max_page

		# Try to find total results count
		total_elem = soup.select_one(".total-results, .resultsCount, [class*='total']")
		if total_elem:
			text = self.clean_text(total_elem.get_text())
			match = re.search(r"(\d+)", text.replace(",", ""))
			if match:
				total = int(match.group(1))
				return (total + 14) // 15  # 15 items per page

		return 1

	def _notice_to_opportunity(self, notice: dict[str, Any]) -> ScrapedOpportunity | None:
		"""
		Convert a parsed notice dict to ScrapedOpportunity.

		Args:
			notice: Notice data dictionary

		Returns:
			ScrapedOpportunity or None if required fields are missing
		"""
		# Validate required fields
		title = notice.get("title")
		if not title:
			return None

		# Generate source_id
		notice_id = notice.get("notice_id", "")
		if not notice_id:
			# Generate from title hash if no ID
			import hashlib
			notice_id = hashlib.md5(title.encode()).hexdigest()[:10]

		# Determine opportunity type
		notice_type_str = notice.get("notice_type", "")
		opportunity_type = NOTICE_TYPE_MAP.get(notice_type_str, OpportunityType.RFP)

		# Build combined text for category detection
		combined_text = f"{title} {notice.get('description', '')}"

		# Create opportunity
		return self.create_opportunity(
			source_id=notice_id,
			title=title,
			description=notice.get("description"),
			organization=notice.get("organization"),
			country=notice.get("country"),
			deadline=notice.get("deadline"),
			published_date=notice.get("published_date"),
			document_url=notice.get("url"),
			portal_url=notice.get("url"),
			reference=notice.get("reference"),
			notice_id=notice_id,
			opportunity_type=opportunity_type,
			category=self.detect_category(combined_text),
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

	scraper = UNGMScraper()
	result = await scraper.run()

	print(f"\n{'='*60}")
	print(f"UNGM Scraping Results")
	print(f"{'='*60}")
	print(f"Status: {result.metrics.status.value}")
	print(f"Opportunities found: {result.count}")
	print(f"Duration: {result.metrics.duration_seconds:.2f}s")
	print(f"Requests made: {result.metrics.requests_made}")

	if result.opportunities:
		print(f"\nSample opportunities:")
		for opp in result.opportunities[:5]:
			print(f"  - {opp.title[:60]}...")
			print(f"    Org: {opp.organization}")
			print(f"    Deadline: {opp.deadline}")
			print(f"    Category: {opp.category}")
			print()


if __name__ == "__main__":
	import asyncio
	asyncio.run(main())