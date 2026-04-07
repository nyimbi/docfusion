"""Regional Organization Scrapers."""
from backend.discovery.scrapers.regional.eac import EACScraper
from backend.discovery.scrapers.regional.sadc import SADCScraper
from backend.discovery.scrapers.regional.ecowas import ECOWASScraper
from backend.discovery.scrapers.regional.au import AUScraper
from backend.discovery.scrapers.regional.smart_africa import SmartAfricaScraper
from backend.discovery.scrapers.regional.comesa import COMESAScraper

__all__ = ["EACScraper", "SADCScraper", "ECOWASScraper", "AUScraper", "SmartAfricaScraper", "COMESAScraper"]