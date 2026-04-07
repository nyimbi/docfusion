"""
TenderSourceMax Data Models
===========================

Standardized data models for scraped tender/RFP opportunities.
These models map to the DocFusion opportunities schema.
"""

from backend.discovery.models.opportunity import (
	ScrapedOpportunity,
	SourceConfig,
	ScraperResult,
	ScrapeMetrics,
)

__all__ = [
	"ScrapedOpportunity",
	"SourceConfig",
	"ScraperResult",
	"ScrapeMetrics",
]
