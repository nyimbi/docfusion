"""
TED Europa (Tenders Electronic Daily) Scraper
==============================================

Scrapes tender opportunities from the EU's official procurement portal.
TED publishes all contracts above EU thresholds from EU member states.

URL: https://ted.europa.eu

Features:
    - XML/RSS feeds available
    - CPV code filtering
    - Multi-language support

Author: TenderSourceMax
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any

from backend.discovery.models.opportunity import (
    ScrapedOpportunity,
    OpportunityType,
    SourceType,
)
from backend.discovery.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class TEDScraper(BaseScraper):
    """Scraper for TED Europa."""

    source_id = "ted"
    source_name = "TED Europa"
    base_url = "https://ted.europa.eu"
    source_type = SourceType.AGGREGATOR

    rate_limit = 0.5  # Be respectful
    timeout = 30

    # TED provides RSS feeds
    rss_url = "/TED/rss/feed"

    async def scrape(self) -> list[ScrapedOpportunity]:
        """Scrape TED Europa for tender opportunities."""
        opportunities: list[ScrapedOpportunity] = []

        try:
            # TED provides RSS/XML feeds
            self._log_info("Fetching TED Europa RSS feed")
            html = await self.fetch_page(self.rss_url)
            
            soup = self.parse_html(html)
            
            # Parse RSS entries
            items = soup.select("item")
            
            self._log_info(f"Found {len(items)} RSS entries")

            for item in items:
                try:
                    opp = self._parse_rss_item(item)
                    if opp:
                        opportunities.append(opp)
                except Exception as e:
                    logger.debug(f"Failed to parse RSS item: {e}")
                    continue

            self._metrics.pages_scraped = 1

        except Exception as e:
            self._log_error(f"Scrape failed: {e}")
            raise

        self._log_info(f"Total opportunities extracted: {len(opportunities)}")
        return opportunities

    def _parse_rss_item(self, item: Any) -> ScrapedOpportunity | None:
        """Parse a RSS feed item."""
        title_elem = item.select_one("title")
        if not title_elem:
            return None

        title = self.clean_text(title_elem.get_text())

        link_elem = item.select_one("link")
        href = link_elem.get_text() if link_elem else ""
        
        desc_elem = item.select_one("description")
        description = self.clean_text(desc_elem.get_text()) if desc_elem else ""

        # Try to extract country from description or title
        country = ""
        if "Africa" in title or "Africa" in description:
            country = "Africa"

        fingerprint = hashlib.sha256(f"{title}|TED".encode()).hexdigest()[:64]
        source_id = hashlib.md5(title.encode()).hexdigest()[:16]

        return self.create_opportunity(
            source_id=source_id,
            title=title[:500],
            description=description[:2000] if description else None,
            organization="European Union",
            country=country,
            deadline=None,
            published_date=None,
            document_url=None,
            portal_url=href,
            reference=None,
            notice_id=source_id,
            opportunity_type=OpportunityType.TENDER,
            category=self.detect_category(f"{title} {description}"),
        )
