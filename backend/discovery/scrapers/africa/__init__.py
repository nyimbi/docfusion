"""
African Government Portal Scrapers
==================================

Scrapers for national e-procurement portals across Africa.

Tier 1 - High Priority (Active e-procurement portals):
	- Kenya (PPIP/tenders.go.ke)
	- South Africa (eTenders)
	- Nigeria (BPP)
	- Ethiopia (e-GP)
	- DR Congo (SIGMAP)
	- Cameroon (ARMP/COLEPS)
	- Angola (SNCP)
	- Côte d'Ivoire (SIGOMAP)
	- Benin (SIGMaP)
	- Egypt (e-Tenders)
	- Morocco (Marchés Publics)
	- Tunisia (TUNEPS)
	- Algeria (Baosem)

Tier 2 - Medium Priority (Active portals with limitations):
	- Rwanda (Umucyo)
	- Ghana (GHANEPS)
	- Tanzania (TANePS)
	- Uganda (GPP)
	- Zimbabwe (PRAZ)
	- Zambia (ZPPA)
	- Mozambique (E-GP/GEPRES)
	- Namibia (Portal Ariel)
	- Malawi (PPDA)
	- South Sudan (PPDAA)

Tier 3 - Lower Priority (Limited coverage or aggregator-based):
	- Botswana (eTender)
	- Mauritius (GPO)
	- Congo Brazzaville (ARMP)
	- Gabon (DGMP)
	- Seychelles (NTB)
	- Djibouti (Marchés Publics)
	- Eswatini (ESPPRA)
	- Somaliland (NTB)
	- Sudan (SudanTenders aggregator)
	- Burundi (BurundiTenders aggregator)
	- Lesotho (TenderWatch)
	- Chad (ChadTenders aggregator)
	- Comoros (BidDetail aggregator)

Each scraper follows the BaseScraper interface and produces
standardized ScrapedOpportunity objects.
"""

from backend.discovery.scrapers.africa.nigeria import NigeriaBPPScraper
from backend.discovery.scrapers.africa.kenya import KenyaPPIPScraper
from backend.discovery.scrapers.africa.south_africa import SAeTendersScraper
from backend.discovery.scrapers.africa.ethiopia import EthiopiaScraper
from backend.discovery.scrapers.africa.rwanda import RwandaScraper
from backend.discovery.scrapers.africa.ghana import GhanaScraper
from backend.discovery.scrapers.africa.tanzania import TanzaniaScraper
from backend.discovery.scrapers.africa.uganda import UgandaScraper
from backend.discovery.scrapers.africa.zimbabwe import ZimbabweScraper
from backend.discovery.scrapers.africa.zambia import ZambiaScraper
from backend.discovery.scrapers.africa.botswana import BotswanaScraper
from backend.discovery.scrapers.africa.mauritius import MauritiusScraper
from backend.discovery.scrapers.africa.dr_congo import DRCongoScraper
from backend.discovery.scrapers.africa.cameroon import CameroonScraper
from backend.discovery.scrapers.africa.angola import AngolaScraper
from backend.discovery.scrapers.africa.mozambique import MozambiqueScraper
from backend.discovery.scrapers.africa.namibia import NamibiaScraper
from backend.discovery.scrapers.africa.malawi import MalawiScraper
from backend.discovery.scrapers.africa.south_sudan import SouthSudanScraper
from backend.discovery.scrapers.africa.congo_brazzaville import CongoBrazzavilleScraper
from backend.discovery.scrapers.africa.gabon import GabonScraper
from backend.discovery.scrapers.africa.seychelles import SeychellesScraper
from backend.discovery.scrapers.africa.djibouti import DjiboutiScraper
from backend.discovery.scrapers.africa.eswatini import EswatiniScraper
from backend.discovery.scrapers.africa.somaliland import SomalilandScraper
from backend.discovery.scrapers.africa.sudan import SudanScraper
from backend.discovery.scrapers.africa.burundi import BurundiScraper
from backend.discovery.scrapers.africa.lesotho import LesothoScraper
from backend.discovery.scrapers.africa.chad import ChadScraper
from backend.discovery.scrapers.africa.comoros import ComorosScraper
# New African country scrapers
from backend.discovery.scrapers.africa.ivory_coast import IvoryCoastScraper
from backend.discovery.scrapers.africa.benin import BeninScraper
from backend.discovery.scrapers.africa.egypt import EgyptScraper
from backend.discovery.scrapers.africa.morocco import MoroccoScraper
from backend.discovery.scrapers.africa.tunisia import TunisiaScraper
from backend.discovery.scrapers.africa.algeria import AlgeriaScraper

__all__ = [
	# Tier 1 - High Priority
	"NigeriaBPPScraper",
	"KenyaPPIPScraper",
	"SAeTendersScraper",
	"EthiopiaScraper",
	"DRCongoScraper",
	"CameroonScraper",
	"AngolaScraper",
	"IvoryCoastScraper",
	"BeninScraper",
	"EgyptScraper",
	"MoroccoScraper",
	"TunisiaScraper",
	"AlgeriaScraper",
	# Tier 2 - Medium Priority
	"RwandaScraper",
	"GhanaScraper",
	"TanzaniaScraper",
	"UgandaScraper",
	"ZimbabweScraper",
	"ZambiaScraper",
	"MozambiqueScraper",
	"NamibiaScraper",
	"MalawiScraper",
	"SouthSudanScraper",
	# Tier 3 - Lower Priority
	"BotswanaScraper",
	"MauritiusScraper",
	"CongoBrazzavilleScraper",
	"GabonScraper",
	"SeychellesScraper",
	"DjiboutiScraper",
	"EswatiniScraper",
	"SomalilandScraper",
	"SudanScraper",
	"BurundiScraper",
	"LesothoScraper",
	"ChadScraper",
	"ComorosScraper",
]

# Scraper registry for easy lookup
SCRAPER_REGISTRY = {
	# Tier 1 - High Priority
	"nigeria_bpp": NigeriaBPPScraper,
	"kenya_ppip": KenyaPPIPScraper,
	"sa_etenders": SAeTendersScraper,
	"ethiopia_egp": EthiopiaScraper,
	"dr_congo_sigmap": DRCongoScraper,
	"cameroon_armp": CameroonScraper,
	"angola_sncp": AngolaScraper,
	"ivory_coast_sigomap": IvoryCoastScraper,
	"benin_sigmap": BeninScraper,
	"egypt_etenders": EgyptScraper,
	"morocco_marches": MoroccoScraper,
	"tunisia_tuneps": TunisiaScraper,
	"algeria_baosem": AlgeriaScraper,
	# Tier 2 - Medium Priority
	"rwanda_umucyo": RwandaScraper,
	"ghana_ghaneps": GhanaScraper,
	"tanzania_taneps": TanzaniaScraper,
	"uganda_gpp": UgandaScraper,
	"zimbabwe_praz": ZimbabweScraper,
	"zambia_zppa": ZambiaScraper,
	"mozambique_egp": MozambiqueScraper,
	"namibia_cpbn": NamibiaScraper,
	"malawi_ppda": MalawiScraper,
	"south_sudan_ppdaa": SouthSudanScraper,
	# Tier 3 - Lower Priority
	"botswana_etender": BotswanaScraper,
	"mauritius_eprocurement": MauritiusScraper,
	"congo_armp": CongoBrazzavilleScraper,
	"gabon_dgmp": GabonScraper,
	"seychelles_ntb": SeychellesScraper,
	"djibouti_marches": DjiboutiScraper,
	"eswatini_esppra": EswatiniScraper,
	"somaliland_ntb": SomalilandScraper,
	"sudan_tenders": SudanScraper,
	"burundi_tenders": BurundiScraper,
	"lesotho_tenders": LesothoScraper,
	"chad_tenders": ChadScraper,
	"comoros_tenders": ComorosScraper,
}