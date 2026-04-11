"""
Generic Crawling Infrastructure

Reusable crawling components and monitoring systems that can be configured
for any opportunity source. Provides the foundation for source-specific scrapers.
"""

# Core crawling infrastructure
from .base_scraper import (
	BaseScraper,
	ScrapingConfiguration,
	ScrapingResult,
	ScrapingStatus,
	ProxyStatus,
	ProxyManager,
	RateLimiter,
	SessionManager,
)

__all__ = [
	"BaseScraper",
	"ScrapingConfiguration",
	"ScrapingResult",
	"ScrapingStatus",
	"ProxyStatus",
	"ProxyManager",
	"RateLimiter",
	"SessionManager",
]