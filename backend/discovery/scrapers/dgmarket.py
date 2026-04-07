"""
dgMarket Scraper
================

Scrapes development aid tenders from dgMarket.

URL: https://www.dgmarket.com

Author: TenderSourceMax
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any

from backend.discovery.models.opportunity import (
    ScrapedOpportunity,
    OpportunityType,
    SourceType,
)
from backend.discovery.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class DgMarketScraper(BaseScraper):
    """Scraper for dgMarket."""

    source_id = "dgmarket"
    source_name = "dgMarket"
    base_url = "https://www.dgmarket.com"
    source_type = SourceType.AGGREGATOR

    rate_limit = 1.0
    timeout = 30

    async def scrape(self) -> list[ScrapedOpportunity]:
        """Scrape dgMarket for development tenders."""
        opportunities: list[ScrapedOpportunity] = []

        try:
            self._log_info("Fetching dgMarket tenders")
            html = await self.fetch_page("/tenders")

            soup = self.parse_html(html)
            
            # Parse tender listings
            items = soup.select(".tender-item, tbody tr, .listing-item")

            self._log_info(f"Found {len(items)} tender entries")

            for item in items:
                try:
                    opp = self._parse_item(item)
                    if opp:
                        opportunities.append(opp)
                except Exception as e:
                    logger.debug(f"Failed to parse item: {e}")
                    continue

            self._metrics.pages_scraped = 1

        except Exception as e:
            self._log_error(f"Scrape failed: {e}")
            raise

        self._log_info(f"Total opportunities extracted: {len(opportunities)}")
        return opportunities

    def _parse_item(self, item: Any) -> ScrapedOpportunity | None:
        """Parse a tender item."""
        title_elem = item.select_one("td:first-child a, .title a, .tender-title a")
        if not title_elem:
            return None

        title = self.clean_text(title_elem.get_text())
        href = title_elem.get("href", "")
        if href and not href.startswith("http"):
            href = f"{self.base_url}{href}"

        org_elem = item.select_one("td:nth-child(2), .organization, .buyer")
        org = self.clean_text(org_elem.get_text()) if org_elem else ""

        country_elem = item.select_one("td:nth-child(3), .country")
        country = self.clean_text(country_elem.get_text()) if country_elem else ""

        fingerprint = hashlib.sha256(f"{title}|{org}".encode()).hexdigest()[:64]
        source_id = hashlib.md5(f"{title}{org}".encode()).hexdigest()[:16]

        return self.create_opportunity(
            source_id=source_id,
            title=title,
            description=None,
            organization=org,
            country=country,
            deadline=None,
            published_date=None,
            document_url=None,
            portal_url=href,
            reference=None,
            notice_id=source_id,
            opportunity_type=OpportunityType.TENDER,
            category=self.detect_category(title),
        )
