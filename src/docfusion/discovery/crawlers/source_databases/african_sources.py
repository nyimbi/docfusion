"""
African Procurement Sources Registry

Comprehensive registry of procurement sources across all 58 African
ISO-2 territories. Includes multilateral regional portals, national
tender portals, and fallback entries for every country/sub-region.
"""

from typing import List, Dict, Any

AFRICAN_COUNTRY_CODES: list[tuple[str, str]] = [
	("DZ", "Algeria"), ("AO", "Angola"), ("BJ", "Benin"), ("BW", "Botswana"),
	("BF", "Burkina Faso"), ("BI", "Burundi"), ("CV", "Cabo Verde"), ("CM", "Cameroon"),
	("CF", "Central African Republic"), ("TD", "Chad"), ("KM", "Comoros"), ("CG", "Congo"),
	("CD", "Democratic Republic of the Congo"), ("CI", "Cote d'Ivoire"), ("DJ", "Djibouti"),
	("EG", "Egypt"), ("GQ", "Equatorial Guinea"), ("ER", "Eritrea"), ("SZ", "Eswatini"),
	("ET", "Ethiopia"), ("GA", "Gabon"), ("GM", "Gambia"), ("GH", "Ghana"),
	("GN", "Guinea"), ("GW", "Guinea-Bissau"), ("KE", "Kenya"), ("LS", "Lesotho"),
	("LR", "Liberia"), ("LY", "Libya"), ("MG", "Madagascar"), ("MW", "Malawi"),
	("ML", "Mali"), ("MR", "Mauritania"), ("MU", "Mauritius"), ("MA", "Morocco"),
	("MZ", "Mozambique"), ("NA", "Namibia"), ("NE", "Niger"), ("NG", "Nigeria"),
	("RW", "Rwanda"), ("ST", "Sao Tome and Principe"), ("SN", "Senegal"), ("SC", "Seychelles"),
	("SL", "Sierra Leone"), ("SO", "Somalia"), ("ZA", "South Africa"), ("SS", "South Sudan"),
	("SD", "Sudan"), ("TZ", "Tanzania"), ("TG", "Togo"), ("TN", "Tunisia"),
	("UG", "Uganda"), ("ZM", "Zambia"), ("ZW", "Zimbabwe"),
	("EH", "Western Sahara"), ("RE", "Reunion"), ("YT", "Mayotte"), ("SH", "Saint Helena"),
]


def get_regional_sources() -> List[Dict[str, Any]]:
	"""Return multilateral/regional procurement portals serving Africa."""
	return [
		{
			"name": "African Development Bank (AfDB) Procurement",
			"url": "https://www.afdb.org/en/projects-and-operations/procurement",
			"country": "ML",
			"region": "Pan-African",
			"source_type": "government_international",
			"geographic_scope": "continental",
			"typical_opportunities_per_day": 5,
			"opportunity_types": ["International Tenders", "Consultancies", "Grants"],
			"value_ranges": ["$100K+", "$1M+", "$10M+"],
			"recommended_scraper": "universal",
			"language": "en",
		},
		{
			"name": "ECOWAS Procurement Notice Board",
			"url": "https://ecowap.ecowas.int/",
			"country": "NG",
			"region": "West Africa",
			"source_type": "government_international",
			"geographic_scope": "regional",
			"typical_opportunities_per_day": 2,
			"opportunity_types": ["Regional Tenders", "Consultancies"],
			"recommended_scraper": "universal",
			"language": "en",
		},
		{
			"name": "SADC Procurement Portal",
			"url": "https://www.sadc.int/",
			"country": "ZA",
			"region": "Southern Africa",
			"source_type": "government_international",
			"geographic_scope": "regional",
			"typical_opportunities_per_day": 2,
			"opportunity_types": ["Regional Tenders"],
			"recommended_scraper": "universal",
			"language": "en",
		},
		{
			"name": "East African Community (EAC) Procurement",
			"url": "https://www.eac.int/",
			"country": "TZ",
			"region": "East Africa",
			"source_type": "government_international",
			"geographic_scope": "regional",
			"typical_opportunities_per_day": 2,
			"opportunity_types": ["Regional Tenders"],
			"recommended_scraper": "universal",
			"language": "en",
		},
		{
			"name": "COMESA Business Council Tenders",
			"url": "https://www.comesa.int/",
			"country": "ZM",
			"region": "Eastern/Southern Africa",
			"source_type": "government_international",
			"geographic_scope": "regional",
			"typical_opportunities_per_day": 2,
			"opportunity_types": ["Regional Tenders"],
			"recommended_scraper": "universal",
			"language": "en",
		},
		{
			"name": "UNDP Africa Procurement",
			"url": "https://procurement-notices.undp.org/",
			"country": "ZA",
			"region": "Pan-African",
			"source_type": "ngo_international",
			"geographic_scope": "continental",
			"typical_opportunities_per_day": 10,
			"opportunity_types": ["UN Tenders", "Consultancies", "Grants"],
			"value_ranges": ["$50K+", "$500K+"],
			"recommended_scraper": "universal",
			"language": "en",
		},
		{
			"name": "World Bank Africa Tenders",
			"url": "https://www.worldbank.org/en/projects-operations/procurement",
			"country": "ZA",
			"region": "Pan-African",
			"source_type": "government_international",
			"geographic_scope": "continental",
			"typical_opportunities_per_day": 8,
			"opportunity_types": ["International Tenders", "Consultancies"],
			"value_ranges": ["$100K+", "$1M+"],
			"recommended_scraper": "universal",
			"language": "en",
		},
	]


def get_national_sources() -> List[Dict[str, Any]]:
	"""Return known national procurement portals for African countries."""
	return [
		{"name": "Algeria Public Procurement", "url": "https://www.marchespublics.gov.dz/", "country": "DZ", "region": "North Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 30, "language": "ar"},
		{"name": "Angola Public Procurement Portal", "url": "https://www.portaldecompras.org/", "country": "AO", "region": "Southern Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 15, "language": "pt"},
		{"name": "Benin Public Procurement (ARMP)", "url": "https://www.armp.bj/", "country": "BJ", "region": "West Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 10, "language": "fr"},
		{"name": "Botswana Public Procurement (PEEPA)", "url": "https://www.ppadb.co.bw/", "country": "BW", "region": "Southern Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 8, "language": "en"},
		{"name": "Burkina Faso ARMP", "url": "https://www.dgmp.gov.bf/", "country": "BF", "region": "West Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 10, "language": "fr"},
		{"name": "Burundi Public Procurement (ARMP)", "url": "https://www.armp.bi/", "country": "BI", "region": "East Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 5, "language": "fr"},
		{"name": "Cameroon Public Procurement (ARMP)", "url": "https://www.marchespublics.cm/", "country": "CM", "region": "Central Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 15, "language": "fr"},
		{"name": "Chad Public Procurement", "url": "https://www.dgmp.td/", "country": "TD", "region": "Central Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 5, "language": "fr"},
		{"name": "Egypt Government Tenders Portal", "url": "https://www.tenders.gov.eg/", "country": "EG", "region": "North Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 50, "language": "ar"},
		{"name": "Ethiopia Public Procurement Agency", "url": "https://www.ppa.gov.et/", "country": "ET", "region": "East Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 20, "language": "en"},
		{"name": "Ghana Public Procurement Authority", "url": "https://www.ppaghana.org/", "country": "GH", "region": "West Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 25, "language": "en"},
		{"name": "Kenya Public Procurement (PPRA)", "url": "https://www.ppra.go.ke/", "country": "KE", "region": "East Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 30, "language": "en"},
		{"name": "Libya Public Procurement", "url": "https://www.tenders.gov.ly/", "country": "LY", "region": "North Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 10, "language": "ar"},
		{"name": "Malawi Public Procurement (PPDA)", "url": "https://www.ppda.mw/", "country": "MW", "region": "Southern Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 8, "language": "en"},
		{"name": "Mauritius Public Procurement", "url": "https://www.publicprocurement.govmu.org/", "country": "MU", "region": "East Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 5, "language": "en"},
		{"name": "Morocco Public Procurement", "url": "https://www.marchespublics.gov.ma/", "country": "MA", "region": "North Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 40, "language": "ar"},
		{"name": "Mozambique Public Procurement", "url": "https://www.cnpmap.gov.mz/", "country": "MZ", "region": "Southern Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 12, "language": "pt"},
		{"name": "Namibia Public Procurement (CCB)", "url": "https://www.ccb.com.na/", "country": "NA", "region": "Southern Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 8, "language": "en"},
		{"name": "Nigeria Public Procurement (BPP)", "url": "https://www.bpp.gov.ng/", "country": "NG", "region": "West Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 40, "language": "en"},
		{"name": "Rwanda Public Procurement (RPPA)", "url": "https://www.rppa.gov.rw/", "country": "RW", "region": "East Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 10, "language": "en"},
		{"name": "Senegal Public Procurement (DGMP)", "url": "https://www.marchespublics.sn/", "country": "SN", "region": "West Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 15, "language": "fr"},
		{"name": "South Africa eTender Portal", "url": "https://www.etenders.gov.za/", "country": "ZA", "region": "Southern Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 80, "language": "en"},
		{"name": "Sudan Public Procurement", "url": "https://www.npc.gov.sd/", "country": "SD", "region": "North Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 10, "language": "ar"},
		{"name": "Tanzania Public Procurement (PPRA)", "url": "https://www.ppra.go.tz/", "country": "TZ", "region": "East Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 20, "language": "en"},
		{"name": "Tunisia Public Procurement", "url": "https://www.marchespublics.gov.tn/", "country": "TN", "region": "North Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 30, "language": "ar"},
		{"name": "Uganda Public Procurement (PPDA)", "url": "https://www.ppda.go.ug/", "country": "UG", "region": "East Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 20, "language": "en"},
		{"name": "Zambia Public Procurement (ZPPA)", "url": "https://www.zppa.org.zm/", "country": "ZM", "region": "Southern Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 12, "language": "en"},
		{"name": "Zimbabwe Public Procurement (ZPPA)", "url": "https://www.zppa.co.zw/", "country": "ZW", "region": "Southern Africa", "source_type": "government_federal", "geographic_scope": "national", "typical_opportunities_per_day": 10, "language": "en"},
	]


def get_country_fallbacks() -> List[Dict[str, Any]]:
	"""Return minimal fallback entries for African countries without known portals."""
	known = {s["country"] for s in get_national_sources()}
	region_map = {
		"DZ": "North Africa", "AO": "Southern Africa", "BJ": "West Africa", "BW": "Southern Africa",
		"BF": "West Africa", "BI": "East Africa", "CV": "West Africa", "CM": "Central Africa",
		"CF": "Central Africa", "TD": "Central Africa", "KM": "East Africa", "CG": "Central Africa",
		"CD": "Central Africa", "CI": "West Africa", "DJ": "East Africa", "EG": "North Africa",
		"GQ": "Central Africa", "ER": "East Africa", "SZ": "Southern Africa", "ET": "East Africa",
		"GA": "Central Africa", "GM": "West Africa", "GN": "West Africa", "GW": "West Africa",
		"KE": "East Africa", "LS": "Southern Africa", "LR": "West Africa", "LY": "North Africa",
		"MG": "East Africa", "MW": "Southern Africa", "ML": "West Africa", "MR": "West Africa",
		"MU": "East Africa", "MA": "North Africa", "MZ": "Southern Africa", "NA": "Southern Africa",
		"NE": "West Africa", "NG": "West Africa", "RW": "East Africa", "ST": "Central Africa",
		"SN": "West Africa", "SC": "East Africa", "SL": "West Africa", "SO": "East Africa",
		"ZA": "Southern Africa", "SS": "East Africa", "SD": "North Africa", "TZ": "East Africa",
		"TG": "West Africa", "TN": "North Africa", "UG": "East Africa", "ZM": "Southern Africa",
		"ZW": "Southern Africa", "EH": "North Africa", "RE": "East Africa", "YT": "East Africa",
		"SH": "West Africa",
	}
	fallbacks = []
	for code, name in AFRICAN_COUNTRY_CODES:
		if code in known:
			continue
		fallbacks.append({
			"name": f"{name} Procurement (Placeholder)",
			"url": "https://example.com/placeholder",
			"country": code,
			"region": region_map.get(code, "Africa"),
			"source_type": "government_federal",
			"geographic_scope": "national",
			"typical_opportunities_per_day": 0,
			"status": "placeholder",
			"notes": f"Dedicated portal for {name} not yet catalogued",
		})
	return fallbacks
