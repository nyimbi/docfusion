"""
Generic Crawling Infrastructure

Reusable crawling components and monitoring systems that can be configured
for any opportunity source. Provides the foundation for source-specific scrapers.
"""

# Core crawling infrastructure
# from .base_scraper import BaseScraper                    # Abstract base scraper class
# from .web_crawler import WebCrawler                      # Generic web crawling engine
# from .api_crawler import APICrawler                      # REST/GraphQL API crawler
# from .rss_monitor import RSSMonitor                      # RSS/Atom feed monitoring

# Monitoring and scheduling
# from .source_monitor import SourceMonitor                # Source health monitoring
# from .change_detector import ChangeDetector              # Content change detection
# from .scraper_scheduler import ScraperScheduler          # Automated scraping scheduling
# from .rate_limiter import RateLimiter                    # Respectful crawling rate limits

# Content processing
# from .content_extractor import ContentExtractor          # HTML/XML content extraction
# from .document_downloader import DocumentDownloader      # PDF/DOC file downloading
# from .link_extractor import LinkExtractor                # Link discovery and following
# from .form_submitter import FormSubmitter                # Automated form submission

# Configuration and management
# from .source_config import SourceConfig                  # Source configuration management
# from .proxy_manager import ProxyManager                  # Proxy rotation and management
# from .session_manager import SessionManager              # Authentication session handling
# from .error_handler import ErrorHandler                  # Crawling error handling and recovery

__all__ = [
    "BaseScraper", "WebCrawler", "APICrawler", "RSSMonitor",
    "SourceMonitor", "ChangeDetector", "ScraperScheduler", "RateLimiter", 
    "ContentExtractor", "DocumentDownloader", "LinkExtractor", "FormSubmitter",
    "SourceConfig", "ProxyManager", "SessionManager", "ErrorHandler"
]