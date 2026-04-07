"""
Malawi PPDA E-Government Procurement Scraper
=============================================

Scrapes tender opportunities from Malawi's Public Procurement and
Disposal of Assets Authority (PPDA) e-GP portal.

URL: https://www.ppda.mw
URL: https://ppda.mw/e-Services

Notes:
- Official portal managed by PPDA
- Governed by PPDA Act of 2025
- Features e-GP system for tender publication and bid submission
- Over 1,700 suppliers registered

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


class MalawiScraper(PlaywrightScraper):
	"""Scraper for Malawi PPDA Portal.

	Malawi's portal uses JavaScript for dynamic content loading.
	"""

	source_id = "malawi_ppda"
	source_name = "Malawi PPDA"
	base_url = "https://www.ppda.mw"
	source_type = SourceType.GOVERNMENT

	rate_limit = 2.0
	timeout = 60

	# Playwright settings
	requires_javascript = True
	default_wait_for = "table tbody tr, .tender-item, .opportunity-item"

	async def scrape(self) -> list[ScrapedOpportunity]:
		"""Scrape Malawi PPDA for tender opportunities."""
		opportunities: list[ScrapedOpportunity] = []
		seen_ids: set[str] = set()

		# Malawi PPDA pages
		search_paths = [
			"/tenders",  # Tender notices
		]

		for path in search_paths:
			try:
				self._log_info(f"Fetching Malawi PPDA from {path}")
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

				# If we found opportunities, no need to try other paths
				if opportunities:
					break

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
			".notice-item",
		]

		items = []
		for selector in selectors:
			found = soup.select(selector)
			if found:
				items.extend(found)

		return items

	def _parse_tender_item(self, item: Any) -> ScrapedOpportunity | None:
		"""Parse a single tender item from Malawi PPDA."""
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

		# Extract organization (procuring entity)
		org_elem = item.select_one(
			"td:nth-child(2), .organization, .entity"
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
			country="Malawi",
			deadline=deadline,
			published_date=None,
			document_url=href if href else None,
			portal_url=href if href else None,
			reference=reference,
			notice_id=source_id,
			opportunity_type=OpportunityType.TENDER,
			category=self.detect_category(title),
		)