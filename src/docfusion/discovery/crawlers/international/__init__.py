"""
International Opportunity Scrapers

Scrapers for international government and institutional procurement portals.
Handles multi-language content and regional procurement regulations.
"""

# European Union
# from .ted_europa_scraper import TEDEuropaScraper               # Tenders Electronic Daily (EU)
# from .eu_funding_scraper import EUFundingScraper               # EU funding programs

# Major international markets
# from .canada_buyandsell_scraper import CanadaBuyAndSellScraper # Canada procurement
# from .austender_scraper import AustenderScraper               # Australia government tenders
# from .uk_contracts_finder_scraper import UKContractsFinderScraper

# Multilateral organizations
# from .world_bank_scraper import WorldBankScraper              # World Bank procurement
# from .un_procurement_scraper import UNProcurementScraper      # UN Global Marketplace
# from .adb_scraper import ADBScraper                           # Asian Development Bank
# from .iadb_scraper import IADBScraper                         # Inter-American Development Bank

# Regional and country-specific
# from .japan_procurement_scraper import JapanProcurementScraper
# from .singapore_gebiz_scraper import SingaporeGebizScraper
# from .south_africa_etenders_scraper import SouthAfricaEtendersScraper
# from .india_eprocurement_scraper import IndiaEprocurementScraper

__all__ = [
    "TEDEuropaScraper", "EUFundingScraper",
    "CanadaBuyAndSellScraper", "AustenderScraper", "UKContractsFinderScraper",
    "WorldBankScraper", "UNProcurementScraper", "ADBScraper", "IADBScraper",
    "JapanProcurementScraper", "SingaporeGebizScraper", "SouthAfricaEtendersScraper", "IndiaEprocurementScraper"
]