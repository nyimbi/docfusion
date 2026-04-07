"""
Botswana eTender Portal Scraper
================================

Scrapes tender opportunities from Botswana's eTender portal.

URL: https://etender.co.bw

Notes:
- Private tender notification service (not government-run)
- Covers government, parastatal, and private sector tenders
- Daily updates across multiple categories
- ICT, Construction, Medical, Security, etc.

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


class BotswanaScraper(PlaywrightScraper):
	"""Scraper for Botswana eTender Portal.

	Botswana's eTender requires JavaScript rendering.
	"""

	source_id = "botswana_etender"
	source_name = "Botswana eTender"
	base_url = "https://etender.co.bw"
	source_type = SourceType.GOVERNMENT

	rate_limit = 2.0
	timeout = 60

	# Playwright settings
	requires_javascript = True
	default_wait_for = ".tender-item, table tbody tr, .opportunity-item, .tender-card"

	async def scrape(self) -> list[ScrapedOpportunity]:
		"""Scrape Botswana eTender for tender opportunities."""
		opportunities: list[ScrapedOpportunity] = []
		seen_ids: set[str] = set()

		# Botswana eTender pages
		search_paths = [
			"/tenders",
			"/tenders?tender_category=ict",
			"/tenders?tender_category=building-construction",
			"/botswana-tenders/",
		]

		for path in search_paths:
			try:
				self._log_info(f"Fetching Botswana eTender from {path}")
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
			".tender-item",
			".tender-card",
			"table tbody tr",
			".opportunity-item",
			"[class*='tender']",
			".tender-listing",
		]

		items = []
		for selector in selectors:
			found = soup.select(selector)
			if found:
				items.extend(found)

		return items

	def _parse_tender_item(self, item: Any) -> ScrapedOpportunity | None:
		"""Parse a single tender item from Botswana eTender."""
		# Extract title
		title_elem = item.select_one(
			".tender-title a, .title a, td:first-child a, a[href*='tender'], h3 a, h4 a"
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
			".organization, .entity, .procuring-entity, td:nth-child(2), .company"
		)
		org = self.clean_text(org_elem.get_text()) if org_elem else ""

		# Extract deadline/closing date
		deadline_elem = item.select_one(
			".deadline, .closing-date, td:nth-child(4), .closing"
		)
		deadline = None
		if deadline_elem:
			deadline_text = self.clean_text(deadline_elem.get_text())
			deadline = self.parse_date(deadline_text)

		# Extract reference number
		ref_elem = item.select_one(".reference, .ref-no, td:nth-child(2)")
		reference = self.clean_text(ref_elem.get_text()) if ref_elem else None

		# Extract category
		category_elem = item.select_one(".category, .sector, td:nth-child(3)")
		category_text = self.clean_text(category_elem.get_text()) if category_elem else None

		# Generate unique source ID
		source_id = hashlib.md5(f"{title}{org}".encode()).hexdigest()[:16]

		# Determine category
		category = self.detect_category(title)
		if category_text and category_text.strip():
			category = category_text.strip()

		return self.create_opportunity(
			source_id=source_id,
			title=title,
			description=None,
			organization=org if org else None,
			country="Botswana",
			deadline=deadline,
			published_date=None,
			document_url=href if href else None,
			portal_url=href if href else None,
			reference=reference,
			notice_id=source_id,
			opportunity_type=OpportunityType.TENDER,
			category=category,
		)