"""
World Bank Procurement API Scraper
===================================

Scrapes procurement notices from the World Bank API.
This is the most reliable source with structured JSON data.

API Endpoint: https://search.worldbank.org/api/v2/procnotices

Coverage:
    - Global procurement opportunities
    - All World Bank financed projects
    - Contract awards and expressions of interest

Rate Limiting:
    - No strict limits, but be respectful
    - Recommended: 1 request per second

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


class WorldBankScraper(BaseScraper):
    """
    World Bank Procurement API Scraper.

    Uses the World Bank search API to retrieve procurement notices.
    This is more reliable than HTML scraping.

    Usage:
        scraper = WorldBankScraper()
        result = await scraper.run()
        for opp in result.opportunities:
            print(f"{opp.title} - {opp.country_region}")
    """

    source_id = "worldbank"
    source_name = "World Bank"
    base_url = "https://search.worldbank.org"
    source_type = SourceType.MDB

    # API configuration
    api_url = "/api/v2/procnotices"
    rate_limit = 1.0
    timeout = 60
    max_records = 500  # Max records per run

    async def scrape(self) -> list[ScrapedOpportunity]:
        """
        Scrape World Bank procurement notices via API.

        Process:
        1. Query the World Bank API for procurement notices
        2. Parse JSON response
        3. Convert to ScrapedOpportunity objects

        Returns:
            List of ScrapedOpportunity objects
        """
        opportunities: list[ScrapedOpportunity] = []

        try:
            # Fetch notices from API
            offset = 0
            page_size = 100

            while offset < self.max_records:
                self._log_info(f"Fetching notices {offset}-{offset + page_size}")

                params = {
                    "format": "json",
                    "rows": str(page_size),
                    "os": str(offset),
                }

                data = await self.fetch_json(self.api_url, params=params)

                if not data:
                    self._log_warning("No data returned from API")
                    break

                notices = data.get("procnotices", [])
                if not notices:
                    self._log_info("No more notices available")
                    break

                total = data.get("total", 0)
                self._log_info(f"Found {len(notices)} notices (total: {total})")

                for notice in notices:
                    opp = self._notice_to_opportunity(notice)
                    if opp:
                        opportunities.append(opp)

                self._metrics.pages_scraped += 1

                # Check if we've fetched all available
                if len(notices) < page_size:
                    break

                offset += page_size
                await self._wait_for_rate_limit()

            self._log_info(f"Total opportunities extracted: {len(opportunities)}")

        except Exception as e:
            self._log_error(f"Scrape failed: {e}")
            raise

        return opportunities

    def _parse_json(self, response: str) -> dict[str, Any] | None:
        """Parse JSON response."""
        import json
        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            self._log_error(f"Failed to parse JSON: {e}")
            return None

    def _notice_to_opportunity(self, notice: dict[str, Any]) -> ScrapedOpportunity | None:
        """
        Convert API notice to ScrapedOpportunity.

        Args:
            notice: Notice data from API

        Returns:
            ScrapedOpportunity or None if required fields missing
        """
        # Extract fields
        title = notice.get("bid_description") or notice.get("project_name")
        if not title:
            return None

        # Generate ID
        ref_no = notice.get("bid_reference_no") or notice.get("id", "")
        source_id = ref_no or hashlib.md5(title.encode()).hexdigest()[:16]

        # Determine opportunity type
        proc_method = notice.get("procurement_method_name", "")
        notice_type = notice.get("notice_type", "")

        opp_type = OpportunityType.TENDER
        if "RFP" in proc_method or "RFP" in notice_type:
            opp_type = OpportunityType.RFP
        elif "RFQ" in proc_method:
            opp_type = OpportunityType.RFQ
        elif "EOI" in proc_method or "Expression" in notice_type:
            opp_type = OpportunityType.EOI
        elif "IFB" in proc_method:
            opp_type = OpportunityType.IFB


        # Parse dates
        submission_date = None
        if notice.get("submission_date"):
            try:
                submission_date = datetime.fromisoformat(
                    notice["submission_date"].replace("Z", "+00:00")
                )
            except (ValueError, TypeError):
                pass

        notice_date = None
        if notice.get("noticedate"):
            try:
                notice_date = datetime.strptime(notice["noticedate"], "%d-%b-%Y")
                notice_date = notice_date.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                pass

        # Create opportunity
        return self.create_opportunity(
            source_id=source_id,
            title=title[:500],
            description=notice.get("notice_text", "")[:2000] if notice.get("notice_text") else None,
            organization=notice.get("project_name", "World Bank"),
            country=notice.get("project_ctry_name", ""),
            deadline=submission_date,
            published_date=notice_date,
            document_url=None,
            portal_url=f"https://projects.worldbank.org/en/projects-operations/procurement?id={notice.get('id', '')}",
            reference=ref_no,
            notice_id=ref_no,
            opportunity_type=opp_type,
            category=self.detect_category(title),
        )