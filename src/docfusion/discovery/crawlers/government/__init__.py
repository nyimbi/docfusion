"""
Government RFP Scrapers

Specialized scrapers for US government opportunity portals and databases.
Handles authentication, rate limiting, and API integration where available.
"""

# Primary government sources
# from .sam_gov_scraper import SAMGovScraper         # SAM.gov - primary federal contracting
# from .grants_gov_scraper import GrantsGovScraper   # Grants.gov - federal grants
# from .fbo_scraper import FBOScraper                 # Legacy FedBizOpps integration

# Department-specific scrapers
# from .dod_scraper import DODScraper                 # Department of Defense opportunities
# from .nasa_scraper import NASAScraper               # NASA NSPIRES and procurement
# from .nih_scraper import NIHScraper                 # NIH grants and contracts
# from .nsf_scraper import NSFScraper                 # National Science Foundation
# from .doe_scraper import DOEScraper                 # Department of Energy

# State and local government
# from .state_portal_scraper import StatePortalScraper
# from .municipal_scraper import MunicipalScraper

__all__ = [
    "SAMGovScraper", "GrantsGovScraper", "FBOScraper",
    "DODScraper", "NASAScraper", "NIHScraper", "NSFScraper", "DOEScraper",
    "StatePortalScraper", "MunicipalScraper"
]