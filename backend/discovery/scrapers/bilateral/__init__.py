"""
Bilateral Donor Scrapers
========================

Scrapers for bilateral development agency procurement portals.

These agencies fund development projects and publish procurement opportunities
for consulting services, goods, and works in recipient countries.

Bilateral donors covered:
- USAID (United States Agency for International Development)
- FCDO (Foreign, Commonwealth & Development Office - UK)
- GIZ (Deutsche Gesellschaft für Internationale Zusammenarbeit - Germany)
- JICA (Japan International Cooperation Agency)
- AFD (Agence Française de Développement - France)
- KfW (Kreditanstalt für Wiederaufbau - Germany)
- EU (European Union DEVCO/INTPA)
- SIDA (Swedish International Development Cooperation Agency)
- NORAD (Norwegian Agency for Development Cooperation)
- DANIDA (Danish International Development Agency)

Author: TenderSourceMax
"""

from backend.discovery.scrapers.bilateral.usaid import USAIDScraper
from backend.discovery.scrapers.bilateral.fcdo import FCDOUKScraper
from backend.discovery.scrapers.bilateral.giz import GIZScraper
from backend.discovery.scrapers.bilateral.jica import JICAScraper
from backend.discovery.scrapers.bilateral.afd import AFDScraper
from backend.discovery.scrapers.bilateral.kfw import KfWScraper
from backend.discovery.scrapers.bilateral.eu import EUScraper
from backend.discovery.scrapers.bilateral.sida import SIDAScraper
from backend.discovery.scrapers.bilateral.norad import NORADScraper
from backend.discovery.scrapers.bilateral.danida import DANIDAScraper

SCRAPER_REGISTRY = {
	"usaid": USAIDScraper,
	"fcdo_uk": FCDOUKScraper,
	"giz": GIZScraper,
	"jica": JICAScraper,
	"afd": AFDScraper,
	"kfw": KfWScraper,
	"eu_devco": EUScraper,
	"sida": SIDAScraper,
	"norad": NORADScraper,
	"danida": DANIDAScraper,
}

__all__ = [
	"USAIDScraper",
	"FCDOUKScraper",
	"GIZScraper",
	"JICAScraper",
	"AFDScraper",
	"KfWScraper",
	"EUScraper",
	"SIDAScraper",
	"NORADScraper",
	"DANIDAScraper",
	"SCRAPER_REGISTRY",
]