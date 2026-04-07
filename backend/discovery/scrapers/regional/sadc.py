"""SADC Scraper."""
from __future__ import annotations
import hashlib, logging
from typing import Any
from backend.discovery.models.opportunity import ScrapedOpportunity, OpportunityType, SourceType
from backend.discovery.scrapers.base import BaseScraper
logger = logging.getLogger(__name__)

class SADCScraper(BaseScraper):
    source_id = "sadc"
    source_name = "SADC"
    base_url = "https://www.sadc.int"
    source_type = SourceType.REGIONAL
    rate_limit = 2.0

    async def scrape(self) -> list[ScrapedOpportunity]:
        opportunities = []
        try:
            html = await self.fetch_page("/procurement")
            soup = self.parse_html(html)
            for item in soup.select(".tender-item, tbody tr, .procurement-item"):
                opp = self._parse_item(item)
                if opp: opportunities.append(opp)
        except Exception as e: self._log_error(str(e))
        return opportunities

    def _parse_item(self, item: Any) -> ScrapedOpportunity | None:
        title_elem = item.select_one("td:first-child a, .title a, a")
        if not title_elem: return None
        title = self.clean_text(title_elem.get_text())
        org_elem = item.select_one("td:nth-child(2), .org")
        org = self.clean_text(org_elem.get_text()) if org_elem else ""
        return self.create_opportunity(
            source_id=hashlib.md5(title.encode()).hexdigest()[:16],
            title=title, organization=org, country="Southern Africa",
            opportunity_type=OpportunityType.TENDER,
            category=self.detect_category(title)
        )
