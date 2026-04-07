"""
TenderSourceMax Scrapers
========================

Individual scrapers for tender/RFP sources.

Scrapers are organized by type:
    - Root level: Major aggregators and MDBs (UNGM, AfDB, World Bank)
    - africa/: African government e-procurement portals
    - regional/: Regional organizations (EAC, SADC, ECOWAS, AU)

Each scraper inherits from BaseScraper and implements the `scrape()` method
to return a list of ScrapedOpportunity objects.

Usage:
    from backend.discovery.scrapers import UNGMScraper

    scraper = UNGMScraper()
    result = await scraper.run()
    print(f"Found {result.count} opportunities")
"""

from backend.discovery.scrapers.base import BaseScraper
from backend.discovery.scrapers.ungm import UNGMScraper
from backend.discovery.scrapers.afdb import AfDBScraper
from backend.discovery.scrapers.undp import UNDPScraper
from backend.discovery.scrapers.worldbank import WorldBankScraper
from backend.discovery.scrapers.ted import TEDScraper
from backend.discovery.scrapers.dgmarket import DgMarketScraper

# Africa scrapers
from backend.discovery.scrapers.africa.kenya import KenyaPPIPScraper
from backend.discovery.scrapers.africa.south_africa import SAeTendersScraper
from backend.discovery.scrapers.africa.nigeria import NigeriaBPPScraper
from backend.discovery.scrapers.africa.rwanda import RwandaScraper
from backend.discovery.scrapers.africa.ghana import GhanaScraper
from backend.discovery.scrapers.africa.tanzania import TanzaniaScraper
from backend.discovery.scrapers.africa.uganda import UgandaScraper
from backend.discovery.scrapers.africa.ethiopia import EthiopiaScraper
from backend.discovery.scrapers.africa.zambia import ZambiaScraper
from backend.discovery.scrapers.africa.zimbabwe import ZimbabweScraper
from backend.discovery.scrapers.africa.botswana import BotswanaScraper
from backend.discovery.scrapers.africa.mauritius import MauritiusScraper

# Regional scrapers
from backend.discovery.scrapers.regional.eac import EACScraper
from backend.discovery.scrapers.regional.sadc import SADCScraper
from backend.discovery.scrapers.regional.ecowas import ECOWASScraper
from backend.discovery.scrapers.regional.au import AUScraper
from backend.discovery.scrapers.regional.smart_africa import SmartAfricaScraper

__all__ = [
    "BaseScraper",
    "UNGMScraper",
    "AfDBScraper",
    "UNDPScraper",
    "WorldBankScraper",
    "TEDScraper",
    "DgMarketScraper",
    "KenyaPPIPScraper",
    "SAeTendersScraper",
    "NigeriaBPPScraper",
    "RwandaScraper",
    "GhanaScraper",
    "TanzaniaScraper",
    "UgandaScraper",
    "EthiopiaScraper",
    "ZambiaScraper",
    "ZimbabweScraper",
    "BotswanaScraper",
    "MauritiusScraper",
    "EACScraper",
    "SADCScraper",
    "ECOWASScraper",
    "AUScraper",
    "SmartAfricaScraper",
]
