"""
African Development Bank (AfDB) Scraper
=======================================

Scrapes procurement opportunities from the African Development Bank,
a major funder of infrastructure and development projects across Africa.

Uses Playwright for JavaScript rendering to bypass anti-bot measures.

Data Sources:
	- Business Opportunities: https://www.afdb.org/en/business/opportunities
	- Procurement Notices: https://www.afdb.org/en/about-us/corporate-procurement
	- Project Procurement: https://www.afdb.org/en/projects-and-operations

Coverage:
	- 54 African countries
	- Regional projects
	- Pan-African initiatives

Author: DocuFusion Team
"""

from __future__ import annotations

import re
import logging
from datetime import date, datetime
from typing import Any
from urllib.parse import urljoin

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

# AfDB procurement URLs
AFDB_OPPORTUNITIES_URL = "/en/business/opportunities"
AFDB_PROCUREMENT_URL = "/en/about-us/corporate-procurement/procurement-notices"
AFDB_CURRENT_SOLICITATIONS = "/en/about-us/corporate-procurement/procurement-notices/current-solicitations"

# Map AfDB notice types to OpportunityType
AFDB_TYPE_MAP = {
	"GPN": OpportunityType.GPN,
	"General Procurement Notice": OpportunityType.GPN,
	"SPN": OpportunityType.SPN,
	"Specific Procurement Notice": OpportunityType.SPN,
	"EOI": OpportunityType.EOI,
	"Expression of Interest": OpportunityType.EOI,
	"REOI": OpportunityType.EOI,
	"RFP": OpportunityType.RFP,
	"Request for Proposal": OpportunityType.RFP,
	"IFB": OpportunityType.IFB,
	"Invitation for Bids": OpportunityType.IFB,
	"ITB": OpportunityType.TENDER,
	"Invitation to Bid": OpportunityType.TENDER,
}

# African countries for coverage mapping
AFRICAN_COUNTRIES = {
	"algeria", "angola", "benin", "botswana", "burkina faso", "burundi",
	"cameroon", "cape verde", "central african republic", "chad", "comoros",
	"congo", "drc", "democratic republic of congo", "djibouti", "egypt",
	"equatorial guinea", "eritrea", "eswatini", "swaziland", "ethiopia",
	"gabon", "gambia", "ghana", "guinea", "guinea-bissau", "ivory coast",
	"cote d'ivoire", "kenya", "lesotho", "liberia", "libya", "madagascar",
	"malawi", "mali", "mauritania", "mauritius", "morocco", "mozambique",
	"namibia", "niger", "nigeria", "rwanda", "sao tome and principe",
	"senegal", "seychelles", "sierra leone", "somalia", "south africa",
	"south sudan", "sudan", "tanzania", "togo", "tunisia", "uganda",
	"zambia", "zimbabwe",
}


# ============================================================================
# AfDB Scraper
# ============================================================================

class AfDBScraper(PlaywrightScraper):
	"""
	Scraper for African Development Bank procurement notices.

	Uses Playwright for JavaScript rendering to bypass anti-bot measures.
	AfDB uses Cloudflare protection, so a real browser is required.

	Usage:
		scraper = AfDBScraper()
		result = await scraper.run()
		for opp in result.opportunities:
			print(f"{opp.title} - {opp.country}")
	"""

	source_id = "afdb"
	source_name = "African Development Bank"
	base_url = "https://www.afdb.org"
	source_type = SourceType.MDB

	# Scraping configuration
	rate_limit = 2.0  # 2 requests per second
	timeout = 60
	max_pages = 5

	# Playwright settings - AfDB requires JS rendering
	requires_javascript = True
	default_wait_for = ".opportunity-item, table tbody tr, .procurement-item"

	async def scrape(self) -> list[ScrapedOpportunity]:
		"""
		Scrape AfDB for procurement opportunities using Playwright.

		Process:
		1. Render opportunities page with JavaScript
		2. Render solicitations page with JavaScript
		3. Parse both pages for notices
		4. Deduplicate and return

		Returns:
			List of ScrapedOpportunity objects
		"""
		opportunities: list[ScrapedOpportunity] = []
		seen_ids: set[str] = set()

		# Scrape main opportunities page with Playwright
		self._log_info("Fetching AfDB business opportunities page")
		try:
			opps = await self._scrape_opportunities_page()
			for opp in opps:
				if opp.source_id not in seen_ids:
					opportunities.append(opp)
					seen_ids.add(opp.source_id)
		except Exception as e:
			self._log_warning(f"Failed to scrape opportunities page: {e}")

		# Scrape current solicitations with Playwright
		self._log_info("Fetching AfDB current solicitations")
		try:
			sols = await self._scrape_solicitations_page()
			for opp in sols:
				if opp.source_id not in seen_ids:
					opportunities.append(opp)
					seen_ids.add(opp.source_id)
		except Exception as e:
			self._log_warning(f"Failed to scrape solicitations page: {e}")

		self._log_info(f"Total opportunities extracted: {len(opportunities)}")
		return opportunities

	async def _scrape_opportunities_page(self) -> list[ScrapedOpportunity]:
		"""Scrape the main business opportunities page with JavaScript rendering."""
		opportunities: list[ScrapedOpportunity] = []

		try:
			# Use Playwright to render JavaScript-heavy page
			html = await self.fetch_page_js(
				AFDB_OPPORTUNITIES_URL,
				wait_for=self.default_wait_for,
				timeout=45000,
			)
			soup = self.parse_html(html)

			# Find opportunity listings
			listings = soup.select(
				".opportunity-item, "
				".procurement-notice, "
				".tender-item, "
				"table tbody tr, "
				".views-row, "
				"[class*='notice'], "
				"[class*='opportunity']"
			)

			for item in listings:
				opp = self._parse_opportunity_item(item)
				if opp:
					opportunities.append(opp)

			self._metrics.pages_scraped += 1
			self._log_info(f"Found {len(opportunities)} opportunities on main page")

		except Exception as e:
			self._log_error(f"Error scraping opportunities page: {e}")

		return opportunities

	async def _scrape_solicitations_page(self) -> list[ScrapedOpportunity]:
		"""Scrape the current solicitations page with JavaScript rendering."""
		opportunities: list[ScrapedOpportunity] = []

		try:
			# Use Playwright for JS rendering
			html = await self.fetch_page_js(
				AFDB_CURRENT_SOLICITATIONS,
				wait_for=self.default_wait_for,
				timeout=45000,
			)
			soup = self.parse_html(html)

			# Find solicitation items
			items = soup.select(
				".solicitation-item, "
				".procurement-item, "
				"table tbody tr, "
				".content-list li, "
				"[class*='solicitation'], "
				"[class*='notice']"
			)

			for item in items:
				opp = self._parse_solicitation_item(item)
				if opp:
					opportunities.append(opp)

			self._metrics.pages_scraped += 1
			self._log_info(f"Found {len(opportunities)} solicitations")

		except Exception as e:
			self._log_error(f"Error scraping solicitations page: {e}")

		return opportunities

	def _parse_opportunity_item(self, item: Any) -> ScrapedOpportunity | None:
		"""Parse an opportunity item from the business opportunities page."""
		# Extract title
		title_elem = item.select_one("a, .title, h3, h4, td:first-child")
		if not title_elem:
			return None

		title = self.clean_text(title_elem.get_text())
		if not title or len(title) < 10:
			return None

		# Extract link
		link = ""
		link_elem = item.select_one("a[href]")
		if link_elem:
			link = link_elem.get("href", "")
			if link and not link.startswith("http"):
				link = urljoin(self.base_url, link)

		# Generate source ID from link or title
		source_id = self._extract_id_from_url(link) or self._generate_id(title)

		# Extract country
		country = self._extract_country(item, title)

		# Extract sector/category
		sector_elem = item.select_one(".sector, .category, td:nth-child(3)")
		sector = self.clean_text(sector_elem.get_text()) if sector_elem else None

		# Extract deadline
		deadline_elem = item.select_one(".deadline, .date, .closing-date, td:last-child")
		deadline = None
		if deadline_elem:
			deadline = self.parse_date(self.clean_text(deadline_elem.get_text()))

		# Extract description
		desc_elem = item.select_one(".description, .summary, p, td:nth-child(4)")
		description = self.clean_text(desc_elem.get_text()) if desc_elem else None

		# Extract notice type
		type_elem = item.select_one(".type, .notice-type, td:nth-child(2)")
		notice_type = self.clean_text(type_elem.get_text()) if type_elem else None

		# Determine opportunity type
		opp_type = AFDB_TYPE_MAP.get(notice_type, OpportunityType.TENDER)

		# Detect category from content
		category_text = f"{title} {description or ''} {sector or ''}"
		category = self.detect_category(category_text)

		return self.create_opportunity(
			source_id=source_id,
			title=title,
			description=description,
			country=country,
			deadline=deadline,
			document_url=link,
			portal_url=link,
			opportunity_type=opp_type,
			category=category,
			sector=sector,
			funder="African Development Bank",
		)

	def _parse_solicitation_item(self, item: Any) -> ScrapedOpportunity | None:
		"""Parse a solicitation item from the procurement notices page."""
		# Extract title
		title_elem = item.select_one("a, .title, td:first-child")
		if not title_elem:
			return None

		title = self.clean_text(title_elem.get_text())
		if not title or len(title) < 10:
			return None

		# Extract link
		link = ""
		link_elem = item.select_one("a[href]")
		if link_elem:
			link = link_elem.get("href", "")
			if link and not link.startswith("http"):
				link = urljoin(self.base_url, link)

		# Generate source ID
		source_id = self._extract_id_from_url(link) or self._generate_id(title)

		# Extract reference number
		ref_elem = item.select_one(".reference, .ref-no, td:nth-child(2)")
		reference = self.clean_text(ref_elem.get_text()) if ref_elem else None

		# Extract deadline
		deadline_elem = item.select_one(".deadline, .closing, td:last-child")
		deadline = None
		if deadline_elem:
			deadline = self.parse_date(self.clean_text(deadline_elem.get_text()))

		# Extract country from title or separate field
		country = self._extract_country(item, title)

		# Detect category
		category = self.detect_category(title)

		return self.create_opportunity(
			source_id=source_id,
			title=title,
			country=country,
			deadline=deadline,
			document_url=link,
			portal_url=link,
			reference=reference,
			category=category,
			funder="African Development Bank",
		)

	def _extract_country(self, item: Any, title: str) -> str | None:
		"""Extract country from item or title text."""
		# Try explicit country field
		country_elem = item.select_one(".country, .location")
		if country_elem:
			country = self.clean_text(country_elem.get_text())
			if country:
				return country

		# Try to find country in title
		title_lower = title.lower()
		for country in AFRICAN_COUNTRIES:
			if country in title_lower:
				return country.title()

		# Check for regional indicators
		if any(x in title_lower for x in ["regional", "multi-country", "africa-wide"]):
			return "Pan-African"

		return None

	def _extract_id_from_url(self, url: str) -> str | None:
		"""Extract notice ID from URL."""
		if not url:
			return None

		# Try common URL patterns
		patterns = [
			r"/(\d+)(?:$|/)",  # Numeric ID at end
			r"id[=_](\d+)",  # id parameter
			r"notice[_-]?(\d+)",  # notice ID
			r"project[_-]?([A-Z0-9-]+)",  # project code
		]

		for pattern in patterns:
			match = re.search(pattern, url, re.IGNORECASE)
			if match:
				return match.group(1)

		return None

	def _generate_id(self, title: str) -> str:
		"""Generate ID from title hash."""
		import hashlib
		return hashlib.md5(title.encode()).hexdigest()[:12]


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

	scraper = AfDBScraper()
	result = await scraper.run()

	print(f"\n{'='*60}")
	print(f"AfDB Scraping Results")
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
			print(f"    Category: {opp.category}")
			print()


if __name__ == "__main__":
	import asyncio
	asyncio.run(main())