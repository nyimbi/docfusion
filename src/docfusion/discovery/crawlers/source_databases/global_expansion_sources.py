"""
Global Expansion Sources

English-speaking world (excl. US/UK/AU), South/Southeast Asia,
Latin America, Middle East, and additional European procurement portals
to bring total source count to the doubling target (~430).
"""

from typing import Any


def get_english_speaking_world() -> list[dict[str, Any]]:
	"""Procurement portals for English-speaking countries not already covered."""
	return [
		# ── New Zealand ────────────────────────────────────────────────────────
		{
			"name": "New Zealand GETS (Government Electronic Tenders)",
			"url": "https://www.gets.govt.nz/",
			"country": "NZ", "region": "Oceania",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 25, "language": "en",
			"recommended_scraper": "universal",
		},
		# ── India ──────────────────────────────────────────────────────────────
		{
			"name": "India GeM (Government e-Marketplace)",
			"url": "https://gem.gov.in/",
			"country": "IN", "region": "South Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 500, "language": "en",
			"recommended_scraper": "universal",
		},
		{
			"name": "India eProcure (CPPP — Central Public Procurement Portal)",
			"url": "https://eprocure.gov.in/cppp/",
			"country": "IN", "region": "South Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 200, "language": "en",
			"recommended_scraper": "universal",
		},
		# ── Ireland ────────────────────────────────────────────────────────────
		{
			"name": "Ireland eTenders",
			"url": "https://www.etenders.gov.ie/",
			"country": "IE", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 30, "language": "en",
			"recommended_scraper": "universal",
		},
		# ── Malta & Cyprus ─────────────────────────────────────────────────────
		{
			"name": "Malta Department of Contracts",
			"url": "https://www.contracts.gov.mt/",
			"country": "MT", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 5, "language": "en",
			"recommended_scraper": "universal",
		},
		{
			"name": "Cyprus eProcurement",
			"url": "https://www.eprocurement.gov.cy/",
			"country": "CY", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 8, "language": "el",
			"recommended_scraper": "universal",
		},
		# ── Israel ─────────────────────────────────────────────────────────────
		{
			"name": "Israel Government Procurement Authority",
			"url": "https://www.mr.gov.il/",
			"country": "IL", "region": "Middle East",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 20, "language": "he",
			"recommended_scraper": "universal",
		},
		# ── Hong Kong / Macau ──────────────────────────────────────────────────
		{
			"name": "Hong Kong eTendering System",
			"url": "https://pcms2.gld.gov.hk/iprod/",
			"country": "HK", "region": "East Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 15, "language": "en",
			"recommended_scraper": "universal",
		},
		# ── Pakistan & Bangladesh ──────────────────────────────────────────────
		{
			"name": "Pakistan Public Procurement Regulatory Authority (PPRA)",
			"url": "https://ppra.org.pk/",
			"country": "PK", "region": "South Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 30, "language": "en",
			"recommended_scraper": "universal",
		},
		{
			"name": "Bangladesh CPTU e-GP Portal",
			"url": "https://www.eprocure.gov.bd/",
			"country": "BD", "region": "South Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 40, "language": "bn",
			"recommended_scraper": "universal",
		},
		# ── Sri Lanka ──────────────────────────────────────────────────────────
		{
			"name": "Sri Lanka National Procurement Commission",
			"url": "https://www.npc.gov.lk/",
			"country": "LK", "region": "South Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 10, "language": "en",
			"recommended_scraper": "universal",
		},
		# ── Malaysia ───────────────────────────────────────────────────────────
		{
			"name": "Malaysia ePerolehan (Government Procurement Portal)",
			"url": "https://www.eperolehan.com.my/",
			"country": "MY", "region": "Southeast Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 50, "language": "ms",
			"recommended_scraper": "universal",
		},
		# ── Philippines ────────────────────────────────────────────────────────
		{
			"name": "Philippines PhilGEPS (Government Electronic Procurement)",
			"url": "https://www.philgeps.gov.ph/",
			"country": "PH", "region": "Southeast Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 60, "language": "en",
			"recommended_scraper": "universal",
		},
		# ── Myanmar ────────────────────────────────────────────────────────────
		{
			"name": "Myanmar Government Procurement Portal",
			"url": "https://www.mopf.gov.mm/",
			"country": "MM", "region": "Southeast Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 5, "language": "my",
			"recommended_scraper": "universal",
			"notes": "Ministry of Planning and Finance — tenders via main portal",
		},
		# ── Nepal & Bhutan ─────────────────────────────────────────────────────
		{
			"name": "Nepal Public Procurement Monitoring Office (PPMO)",
			"url": "https://ppmo.gov.np/",
			"country": "NP", "region": "South Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 15, "language": "ne",
			"recommended_scraper": "universal",
		},
	]


def get_latin_america_sources() -> list[dict[str, Any]]:
	"""Government procurement portals for Latin American countries."""
	return [
		{
			"name": "Brazil ComprasNet / PNCP (National Procurement Portal)",
			"url": "https://www.gov.br/compras/pt-br",
			"country": "BR", "region": "South America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 200, "language": "pt",
			"recommended_scraper": "universal",
		},
		{
			"name": "Argentina COMPR.AR (Public Procurement)",
			"url": "https://comprar.gob.ar/",
			"country": "AR", "region": "South America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 80, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Colombia SECOP (State Contracting Portal)",
			"url": "https://www.colombiacompra.gov.co/",
			"country": "CO", "region": "South America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 100, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Chile ChileCompra (Public Procurement)",
			"url": "https://www.chilecompra.cl/",
			"country": "CL", "region": "South America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 80, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Peru SEACE (Electronic Contracting System)",
			"url": "https://www.seace.gob.pe/",
			"country": "PE", "region": "South America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 60, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Mexico CompraNet (Government Procurement)",
			"url": "https://compranet.hacienda.gob.mx/",
			"country": "MX", "region": "North America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 100, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Ecuador SERCOP (Public Contracting)",
			"url": "https://www.sercop.gob.ec/",
			"country": "EC", "region": "South America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 40, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Bolivia SICOES (State Contracting System)",
			"url": "https://www.sicoes.gob.bo/",
			"country": "BO", "region": "South America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 25, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Uruguay ARCE (Procurement Portal)",
			"url": "https://www.gub.uy/agencia-reguladora-compras-estatales/",
			"country": "UY", "region": "South America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 20, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Paraguay DNCP (National Procurement Directorate)",
			"url": "https://www.contrataciones.gov.py/",
			"country": "PY", "region": "South America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 15, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Costa Rica SICOP (Integrated Procurement System)",
			"url": "https://www.sicop.go.cr/",
			"country": "CR", "region": "Central America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 20, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Panama PanamaCompra",
			"url": "https://www.panamacompra.gob.pa/",
			"country": "PA", "region": "Central America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 20, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Guatemala GUATECOMPRAS",
			"url": "https://www.guatecompras.gt/",
			"country": "GT", "region": "Central America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 15, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Honduras HonduCompras",
			"url": "https://www.honducompras.gob.hn/",
			"country": "HN", "region": "Central America",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 10, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "IDB (Inter-American Development Bank) Procurement",
			"url": "https://www.iadb.org/en/procurement",
			"country": "US", "region": "Pan-Americas",
			"source_type": "government_international", "geographic_scope": "regional",
			"typical_opportunities_per_day": 10, "language": "en",
			"recommended_scraper": "universal",
		},
	]


def get_middle_east_sources() -> list[dict[str, Any]]:
	"""Government procurement portals for the Middle East and North Africa."""
	return [
		{
			"name": "UAE Government Procurement (Abu Dhabi)",
			"url": "https://www.tamm.abudhabi/en/government-services/procurement",
			"country": "AE", "region": "Middle East",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 20, "language": "ar",
			"recommended_scraper": "universal",
		},
		{
			"name": "UAE Federal Tenders and Auctions Authority (ETAA)",
			"url": "https://www.etaa.gov.ae/",
			"country": "AE", "region": "Middle East",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 20, "language": "ar",
			"recommended_scraper": "universal",
		},
		{
			"name": "Saudi Arabia ETIMAD (Government Procurement)",
			"url": "https://etimad.sa/",
			"country": "SA", "region": "Middle East",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 50, "language": "ar",
			"recommended_scraper": "universal",
		},
		{
			"name": "Qatar Government Tenders Portal",
			"url": "https://www.mot.gov.qa/en/Tenders",
			"country": "QA", "region": "Middle East",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 15, "language": "ar",
			"recommended_scraper": "universal",
		},
		{
			"name": "Kuwait Central Agency for IT (CAIT) Tenders",
			"url": "https://etenders.cait.gov.kw/",
			"country": "KW", "region": "Middle East",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 10, "language": "ar",
			"recommended_scraper": "universal",
		},
		{
			"name": "Turkey Public Procurement Authority (KİK) — EKAP",
			"url": "https://www.ekap.kik.gov.tr/",
			"country": "TR", "region": "Middle East",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 80, "language": "tr",
			"recommended_scraper": "universal",
		},
		{
			"name": "Jordan Government Procurement Portal",
			"url": "https://www.istidama.gov.jo/",
			"country": "JO", "region": "Middle East",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 10, "language": "ar",
			"recommended_scraper": "universal",
		},
		{
			"name": "Oman Public Procurement Portal (iTender)",
			"url": "https://tenders.omantendering.com/",
			"country": "OM", "region": "Middle East",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 15, "language": "ar",
			"recommended_scraper": "universal",
		},
	]


def get_additional_european_sources() -> list[dict[str, Any]]:
	"""Additional EU and European country procurement portals."""
	return [
		{
			"name": "Italy ANAC National Procurement Database",
			"url": "https://www.acquistinretepa.it/",
			"country": "IT", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 50, "language": "it",
			"recommended_scraper": "universal",
		},
		{
			"name": "Spain Contratación del Estado",
			"url": "https://contrataciondelestado.es/",
			"country": "ES", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 60, "language": "es",
			"recommended_scraper": "universal",
		},
		{
			"name": "Portugal BASE (Public Contracts Portal)",
			"url": "https://www.base.gov.pt/",
			"country": "PT", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 30, "language": "pt",
			"recommended_scraper": "universal",
		},
		{
			"name": "Netherlands TenderNed",
			"url": "https://www.tenderned.nl/",
			"country": "NL", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 40, "language": "nl",
			"recommended_scraper": "universal",
		},
		{
			"name": "Belgium e-Procurement",
			"url": "https://www.publicprocurement.be/",
			"country": "BE", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 30, "language": "nl",
			"recommended_scraper": "universal",
		},
		{
			"name": "Switzerland SIMAP (Public Procurement Information System)",
			"url": "https://www.simap.ch/",
			"country": "CH", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 20, "language": "de",
			"recommended_scraper": "universal",
		},
		{
			"name": "Austria Bundesbeschaffung (BBG) Tenders",
			"url": "https://www.bbg.gv.at/",
			"country": "AT", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 20, "language": "de",
			"recommended_scraper": "universal",
		},
		{
			"name": "Poland Biuletyn Zamówień Publicznych (BZP)",
			"url": "https://bzp.uzp.gov.pl/",
			"country": "PL", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 60, "language": "pl",
			"recommended_scraper": "universal",
		},
		{
			"name": "Czech Republic NEN (National Electronic Tool)",
			"url": "https://nen.nipez.cz/",
			"country": "CZ", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 30, "language": "cs",
			"recommended_scraper": "universal",
		},
		{
			"name": "Romania SEAP (Electronic Public Procurement System)",
			"url": "https://www.e-licitatie.ro/",
			"country": "RO", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 40, "language": "ro",
			"recommended_scraper": "universal",
		},
		{
			"name": "Greece ESHDHS (National Procurement System)",
			"url": "https://www.promitheus.gov.gr/",
			"country": "GR", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 30, "language": "el",
			"recommended_scraper": "universal",
		},
		{
			"name": "Hungary EKR (Electronic Procurement System)",
			"url": "https://ekr.gov.hu/",
			"country": "HU", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 25, "language": "hu",
			"recommended_scraper": "universal",
		},
		{
			"name": "Finland HILMA (Public Procurement Notices)",
			"url": "https://www.hankintailmoitukset.fi/en/",
			"country": "FI", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 20, "language": "fi",
			"recommended_scraper": "universal",
		},
		{
			"name": "Denmark Udbud (Public Procurement)",
			"url": "https://www.udbud.dk/",
			"country": "DK", "region": "Europe",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 20, "language": "da",
			"recommended_scraper": "universal",
		},
	]


def get_additional_asia_sources() -> list[dict[str, Any]]:
	"""Additional Asian procurement portals."""
	return [
		{
			"name": "Thailand Government Procurement (GPP)",
			"url": "https://process3.gprocurement.go.th/",
			"country": "TH", "region": "Southeast Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 50, "language": "th",
			"recommended_scraper": "universal",
		},
		{
			"name": "Vietnam Government Procurement Portal (VNPT)",
			"url": "https://muasamcong.mpi.gov.vn/",
			"country": "VN", "region": "Southeast Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 40, "language": "vi",
			"recommended_scraper": "universal",
		},
		{
			"name": "Indonesia LPSE (National Procurement Portal)",
			"url": "https://lpse.lkpp.go.id/",
			"country": "ID", "region": "Southeast Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 100, "language": "id",
			"recommended_scraper": "universal",
		},
		{
			"name": "Cambodia Government Procurement (DGTSP)",
			"url": "https://www.mef.gov.kh/",
			"country": "KH", "region": "Southeast Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 5, "language": "km",
			"recommended_scraper": "universal",
		},
		{
			"name": "Kazakhstan E-Procurement Portal",
			"url": "https://goszakup.gov.kz/",
			"country": "KZ", "region": "Central Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 50, "language": "ru",
			"recommended_scraper": "universal",
		},
		{
			"name": "Uzbekistan E-Procurement (xarid.uz)",
			"url": "https://xarid.uzex.uz/",
			"country": "UZ", "region": "Central Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 30, "language": "uz",
			"recommended_scraper": "universal",
		},
		{
			"name": "China CCGP (Central Government Procurement)",
			"url": "http://www.ccgp.gov.cn/",
			"country": "CN", "region": "East Asia",
			"source_type": "government_federal", "geographic_scope": "national",
			"typical_opportunities_per_day": 200, "language": "zh",
			"recommended_scraper": "universal",
		},
	]
