"""
African Regional Economic Communities (RECs) and Multilateral Organizations

Covers all 8 AU-recognized RECs plus additional African multilateral
institutions: development banks, standby forces, basin commissions,
peace & security bodies, and specialized agencies.
"""

from typing import Any


def get_african_rec_sources() -> list[dict[str, Any]]:
	"""Return AU-recognized RECs and their specialized agencies."""
	return [
		# ── Already covered (referenced for completeness) ─────────────────────
		# ECOWAS, SADC, EAC, COMESA, IGAD, CEMAC — in african_sources.py

		# ── Remaining 2 AU-recognized RECs ────────────────────────────────────
		{
			"name": "ECCAS/CEEAC (Economic Community of Central African States)",
			"url": "https://www.ceeac-eccas.org/index.php/en/procurement",
			"country": "GA", "region": "Central Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["rec", "central-africa", "au"],
		},
		{
			"name": "AMU/UMA (Arab Maghreb Union) Tenders",
			"url": "https://www.maghrebarabe.org/",
			"country": "MA", "region": "North Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "ar",
			"recommended_scraper": "universal",
			"tags": ["rec", "north-africa", "au"],
		},
		{
			"name": "CEN-SAD (Community of Sahel-Saharan States)",
			"url": "https://www.censad.org/",
			"country": "LY", "region": "Sahel",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 1, "language": "ar",
			"recommended_scraper": "universal",
			"tags": ["rec", "sahel", "au"],
		},

		# ── African Union Bodies ───────────────────────────────────────────────
		{
			"name": "African Union Commission (AUC) Procurement",
			"url": "https://www.au.int/en/procurement",
			"country": "ET", "region": "Pan-African",
			"source_type": "government_international", "geographic_scope": "continental",
			"typical_opportunities_per_day": 5, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["au", "pan-african"],
		},
		{
			"name": "AUDA-NEPAD (African Union Development Agency) Tenders",
			"url": "https://www.auda-nepad.org/procurement",
			"country": "ZA", "region": "Pan-African",
			"source_type": "government_international", "geographic_scope": "continental",
			"typical_opportunities_per_day": 3, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["au", "nepad", "development"],
		},
		{
			"name": "AfCFTA Secretariat Procurement",
			"url": "https://au-afcfta.org/",
			"country": "GH", "region": "Pan-African",
			"source_type": "government_international", "geographic_scope": "continental",
			"typical_opportunities_per_day": 2, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["au", "trade", "pan-african"],
		},
		{
			"name": "African Peer Review Mechanism (APRM) Tenders",
			"url": "https://aprm-au.org/",
			"country": "ZA", "region": "Pan-African",
			"source_type": "government_international", "geographic_scope": "continental",
			"typical_opportunities_per_day": 1, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["au", "governance"],
		},

		# ── Peace & Security Architecture ──────────────────────────────────────
		{
			"name": "EASF (Eastern Africa Standby Force) Procurement",
			"url": "https://www.easfcom.org/",
			"country": "ET", "region": "East Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["peace-security", "standby-force", "east-africa"],
		},
		{
			"name": "ICGLR (International Conference on the Great Lakes Region)",
			"url": "https://www.icglr.org/",
			"country": "BI", "region": "Great Lakes",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["peace-security", "great-lakes"],
		},
		{
			"name": "G5 Sahel Secretariat Procurement",
			"url": "https://www.g5sahel.org/",
			"country": "MR", "region": "Sahel",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["peace-security", "sahel"],
		},
		{
			"name": "MNJTF (Multinational Joint Task Force) — Lake Chad Basin",
			"url": "https://www.cblt.org/",
			"country": "NG", "region": "Central Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 1, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["peace-security", "lake-chad"],
		},

		# ── Development Finance Institutions ───────────────────────────────────
		{
			"name": "AFREXIMBANK (African Export-Import Bank) Procurement",
			"url": "https://www.afreximbank.com/procurement/",
			"country": "EG", "region": "Pan-African",
			"source_type": "government_international", "geographic_scope": "continental",
			"typical_opportunities_per_day": 3, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["development-finance", "trade"],
		},
		{
			"name": "TDB (Trade and Development Bank / PTA Bank)",
			"url": "https://www.tdbgroup.org/procurement",
			"country": "KE", "region": "Eastern/Southern Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 3, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["development-finance", "pta-bank"],
		},
		{
			"name": "DBSA (Development Bank of Southern Africa) Procurement",
			"url": "https://www.dbsa.org/procurement",
			"country": "ZA", "region": "Southern Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 5, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["development-finance", "southern-africa"],
		},
		{
			"name": "EADB (East African Development Bank) Procurement",
			"url": "https://www.eadb.org/procurement/",
			"country": "UG", "region": "East Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["development-finance", "east-africa"],
		},
		{
			"name": "BOAD (West African Development Bank) Tenders",
			"url": "https://www.boad.org/appels-doffres/",
			"country": "TG", "region": "West Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 3, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["development-finance", "west-africa"],
		},
		{
			"name": "BDEAC (Development Bank of Central African States) Tenders",
			"url": "https://www.bdeac.org/",
			"country": "CG", "region": "Central Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["development-finance", "central-africa"],
		},
		{
			"name": "African Reinsurance Corporation (Africa Re) Tenders",
			"url": "https://www.africa-re.com/",
			"country": "NG", "region": "Pan-African",
			"source_type": "government_international", "geographic_scope": "continental",
			"typical_opportunities_per_day": 1, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["insurance", "pan-african"],
		},
		{
			"name": "Shelter Afrique Procurement",
			"url": "https://www.shelterafrique.org/",
			"country": "KE", "region": "Pan-African",
			"source_type": "government_international", "geographic_scope": "continental",
			"typical_opportunities_per_day": 2, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["housing", "development-finance"],
		},

		# ── River Basin and Natural Resource Organizations ─────────────────────
		{
			"name": "Nile Basin Initiative (NBI) Procurement",
			"url": "https://www.nilebasin.org/procurement",
			"country": "UG", "region": "East Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["water", "basin-organization"],
		},
		{
			"name": "Lake Chad Basin Commission (LCBC/CBLT) Tenders",
			"url": "https://www.cblt.org/",
			"country": "TD", "region": "Central Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["water", "basin-organization"],
		},
		{
			"name": "Niger Basin Authority (NBA/ABN) Procurement",
			"url": "https://www.abn.ne/",
			"country": "NE", "region": "West Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["water", "basin-organization"],
		},
		{
			"name": "Orange-Senqu River Commission (ORASECOM)",
			"url": "https://www.orasecom.org/",
			"country": "ZA", "region": "Southern Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 1, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["water", "basin-organization"],
		},
		{
			"name": "Mano River Union Secretariat Tenders",
			"url": "http://www.manoriverunion.int/",
			"country": "SL", "region": "West Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 1, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["regional-body", "west-africa"],
		},

		# ── Health and Specialized Agencies ────────────────────────────────────
		{
			"name": "WAHO (West African Health Organisation) Tenders",
			"url": "https://www.wahooas.org/web2017/procurement/",
			"country": "BF", "region": "West Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["health", "west-africa"],
		},
		{
			"name": "EALB (East African Legislative Assembly) Tenders",
			"url": "https://www.eala.org/",
			"country": "TZ", "region": "East Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 1, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["eac", "east-africa"],
		},
		{
			"name": "African Tax Administration Forum (ATAF) Tenders",
			"url": "https://www.ataftax.org/",
			"country": "ZA", "region": "Pan-African",
			"source_type": "government_international", "geographic_scope": "continental",
			"typical_opportunities_per_day": 1, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["tax", "governance"],
		},
		{
			"name": "GIABA (Inter-Governmental Action Group against Money Laundering in West Africa)",
			"url": "https://www.giaba.org/",
			"country": "SN", "region": "West Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 1, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["financial-crime", "west-africa"],
		},
	]


def get_african_sub_regional_sources() -> list[dict[str, Any]]:
	"""Sub-regional customs/monetary unions, river basin authorities, and specialist bodies
	from the Abuja Treaty framework not covered in get_african_rec_sources()."""
	return [
		# ── Sub-Regional Customs & Monetary Unions ────────────────────────────
		{
			"name": "SACU (Southern African Customs Union) Procurement",
			"url": "https://www.sacu.int/",
			"country": "ZA", "region": "Southern Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["sacu", "customs-union", "southern-africa"],
		},
		{
			"name": "UEMOA/WAEMU (West African Economic and Monetary Union) Tenders",
			"url": "https://www.uemoa.int/fr/appels-offres",
			"country": "BF", "region": "West Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 3, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["uemoa", "monetary-union", "west-africa"],
		},
		{
			"name": "WAMZ (West African Monetary Zone) — WAMI Tenders",
			"url": "https://www.wami-imao.org/",
			"country": "GM", "region": "West Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 1, "language": "en",
			"recommended_scraper": "universal",
			"tags": ["wamz", "monetary-zone", "west-africa"],
		},
		{
			"name": "CEPGL (Economic Community of the Great Lakes Countries)",
			"url": "https://www.cepgl.org/",
			"country": "CD", "region": "Great Lakes",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 1, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["cepgl", "great-lakes", "central-africa"],
		},
		{
			"name": "IOC/COI (Indian Ocean Commission) Procurement",
			"url": "https://www.commissionoceanindien.org/",
			"country": "MU", "region": "Indian Ocean",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["ioc", "indian-ocean", "island-nations"],
		},
		# ── River Basin & Water Authorities ────────────────────────────────────
		{
			"name": "OMVS (Senegal River Basin Development Authority) Tenders",
			"url": "https://www.omvs.org/",
			"country": "SN", "region": "West Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["basin-organization", "water", "senegal-river"],
		},
		{
			"name": "VBA/ABV (Volta Basin Authority) Procurement",
			"url": "https://abv-volta.org/",
			"country": "BF", "region": "West Africa",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 1, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["basin-organization", "water", "volta-basin"],
		},
		# ── Drought Control & Sahel Specialist Bodies ──────────────────────────
		{
			"name": "CILSS (Permanent Interstate Committee for Drought Control in the Sahel)",
			"url": "https://www.cilss.int/",
			"country": "BF", "region": "Sahel",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 2, "language": "fr",
			"recommended_scraper": "universal",
			"tags": ["drought", "food-security", "sahel"],
		},
		# ── African Economic Community (AEC) umbrella ─────────────────────────
		{
			"name": "AEC (African Economic Community) — via AU Procurement",
			"url": "https://www.au.int/en/treaties/treaty-establishing-african-economic-community",
			"country": "ET", "region": "Pan-African",
			"source_type": "government_international", "geographic_scope": "continental",
			"typical_opportunities_per_day": 1, "language": "en",
			"recommended_scraper": "universal",
			"notes": "AEC is implemented through the AU Commission; tenders via au.int",
			"tags": ["aec", "au", "pan-african"],
		},
	]
