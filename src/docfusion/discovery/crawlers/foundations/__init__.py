"""
Foundation and Grant Scrapers

Scrapers for private foundations, non-profit grant databases, and philanthropic opportunities.
Handles foundation-specific application processes and requirements.
"""

# Major foundation databases
# from .foundation_center_scraper import FoundationCenterScraper  # Foundation Directory Online
# from .candid_scraper import CandidScraper                       # Candid (formerly Foundation Center)
# from .grants_dot_com_scraper import GrantsDotComScraper         # Grants.com database

# Private foundation scrapers
# from .gates_foundation_scraper import GatesFoundationScraper
# from .ford_foundation_scraper import FordFoundationScraper
# from .rockefeller_scraper import RockefellerScraper
# from .kellogg_foundation_scraper import KelloggFoundationScraper

# Corporate foundation scrapers
# from .corporate_foundation_scraper import CorporateFoundationScraper
# from .community_foundation_scraper import CommunityFoundationScraper

# Specialized grant types
# from .research_grant_scraper import ResearchGrantScraper
# from .education_grant_scraper import EducationGrantScraper
# from .healthcare_grant_scraper import HealthcareGrantScraper
# from .environmental_grant_scraper import EnvironmentalGrantScraper

__all__ = [
    "FoundationCenterScraper", "CandidScraper", "GrantsDotComScraper",
    "GatesFoundationScraper", "FordFoundationScraper", "RockefellerScraper", "KelloggFoundationScraper",
    "CorporateFoundationScraper", "CommunityFoundationScraper",
    "ResearchGrantScraper", "EducationGrantScraper", "HealthcareGrantScraper", "EnvironmentalGrantScraper"
]