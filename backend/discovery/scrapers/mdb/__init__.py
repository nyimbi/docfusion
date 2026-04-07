"""
Multilateral Development Bank Scrapers
======================================

Scrapers for MDB procurement portals including:
- World Bank (IFC, MIGA, IDA)
- African Development Bank (AfDB)
- Asian Development Bank (ADB)
- Islamic Development Bank (IsDB)
- Inter-American Development Bank (IDB)
- European Bank for Reconstruction and Development (EBRD)
- Asian Infrastructure Investment Bank (AIIB)

Each scraper follows the BaseScraper interface and produces
standardized ScrapedOpportunity objects.
"""

from backend.discovery.scrapers.mdb.ifc import IFCScraper
from backend.discovery.scrapers.mdb.isdb import IsDBScraper
from backend.discovery.scrapers.mdb.adb import ADBScraper
from backend.discovery.scrapers.mdb.idb import IDBScraper
from backend.discovery.scrapers.mdb.ebrd import EBRDScraper
from backend.discovery.scrapers.mdb.aiib import AIIBScraper

__all__ = [
	"IFCScraper",
	"IsDBScraper",
	"ADBScraper",
	"IDBScraper",
	"EBRDScraper",
	"AIIBScraper",
]

SCRAPER_REGISTRY = {
	"ifc": IFCScraper,
	"isdb": IsDBScraper,
	"adb": ADBScraper,
	"idb": IDBScraper,
	"ebrd": EBRDScraper,
	"aiib": AIIBScraper,
}