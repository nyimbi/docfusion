#!/usr/bin/env python3
"""
Tender Intelligence Database Builder
=====================================
An automated framework for building comprehensive tender/procurement source databases
focusing on primary sources (government portals, MDBs, UN agencies) and excluding
commercial aggregators.

Architecture:
- TenderEntry: Data class representing a single tender source
- CountryConfig: Configuration for a country's procurement landscape
- RegionBuilder: Generates entries for a geographic region
- EntityTemplates: URL patterns and metadata templates for common entity types
- DatabaseCompiler: Combines all sources into final Excel output

Usage:
    python tender_database_builder.py --output tender_database.xlsx

Author: Automated Tender Intelligence System
License: MIT
"""

import json
import os
import re
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Callable, Any, Tuple
from urllib.parse import urlparse
import argparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =============================================================================
# ENUMERATIONS AND CONSTANTS
# =============================================================================

class EntityType(Enum):
    """Classification of procurement entity types."""
    NATIONAL_GOVERNMENT = "National Government"
    SUB_NATIONAL_GOVERNMENT = "Sub-national Government"
    STATE_OWNED_ENTERPRISE = "State-Owned Enterprise"
    UTILITY = "Utility"
    MULTILATERAL_DEVELOPMENT_BANK = "Multilateral Development Bank"
    UN_AGENCY = "UN Agency"
    BILATERAL_AGENCY = "Bilateral Development Agency"
    REGIONAL_ECONOMIC_COMMUNITY = "Regional Economic Community"
    UNIVERSITY = "University"
    HOSPITAL = "Hospital"
    PORT_AUTHORITY = "Port Authority"
    AIRPORT_AUTHORITY = "Airport Authority"
    RAILWAY_CORPORATION = "Railway Corporation"
    CENTRAL_BANK = "Central Bank"
    REGULATORY_AGENCY = "Regulatory Agency"
    SOVEREIGN_WEALTH_FUND = "Sovereign Wealth Fund"
    DEVELOPMENT_CORRIDOR = "Development Authority"
    NGO = "NGO"
    INDEPENDENT_COMMISSION = "Independent Commission"


class UpdateFrequency(Enum):
    """How often tender listings are typically updated."""
    REAL_TIME = "Real-time"
    DAILY = "Daily"
    WEEKLY = "Weekly"
    BIWEEKLY = "Bi-weekly"
    MONTHLY = "Monthly"
    PERIODIC = "Periodic"


class Region(Enum):
    """Geographic regions for organization."""
    AFRICA_WEST = "West Africa"
    AFRICA_EAST = "East Africa"
    AFRICA_SOUTHERN = "Southern Africa"
    AFRICA_CENTRAL = "Central Africa"
    AFRICA_NORTH = "North Africa"
    LATIN_AMERICA = "Latin America"
    CARIBBEAN = "Caribbean"
    SOUTH_ASIA = "South Asia"
    SOUTHEAST_ASIA = "Southeast Asia"
    EAST_ASIA = "East Asia"
    PACIFIC = "Pacific Islands"
    MIDDLE_EAST = "Middle East"
    CENTRAL_ASIA = "Central Asia"
    INTERNATIONAL = "International"


# Sector categories
SECTORS = {
    "general": ["General"],
    "infrastructure": ["Infrastructure", "Construction", "Public Works"],
    "health": ["Health", "Medical Equipment", "Pharmaceuticals"],
    "education": ["Education", "Research"],
    "ict": ["ICT", "Technology", "Telecommunications"],
    "energy": ["Energy", "Electricity", "Power"],
    "oil_gas": ["Oil & Gas", "Petroleum", "Petrochemicals"],
    "water": ["Water", "Sanitation", "WASH"],
    "transport": ["Transport", "Roads", "Highways"],
    "railways": ["Transport", "Railways", "Rail"],
    "aviation": ["Aviation", "Airports"],
    "maritime": ["Ports", "Maritime", "Shipping"],
    "agriculture": ["Agriculture", "Farming", "Agribusiness"],
    "mining": ["Mining", "Minerals", "Extractives"],
    "defense": ["Defense", "Security", "Military"],
    "finance": ["Banking", "Finance", "Insurance"],
    "environment": ["Environment", "Conservation", "Climate"],
    "housing": ["Housing", "Urban Development", "Real Estate"],
    "tourism": ["Tourism", "Hospitality"],
    "manufacturing": ["Manufacturing", "Industrial"],
    "consulting": ["Consulting", "Professional Services", "Technical Assistance"],
    "humanitarian": ["Humanitarian", "Emergency", "Relief"],
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class TenderEntry:
    """
    Represents a single tender/procurement source in the database.

    This is the fundamental unit of the database, containing all metadata
    about a procurement portal or tender publication source.
    """
    source_name: str
    url: str
    country_code: str
    country_name: str
    region: Optional[str] = None
    entity_type: str = "Government"
    entity_subtype: Optional[str] = None
    sectors: List[str] = field(default_factory=lambda: ["General"])
    language: str = "English"
    update_frequency: str = "Daily"
    registration_required: Optional[bool] = None
    registration_type: Optional[str] = None
    api_available: bool = False
    rss_feed: bool = False
    email_alerts: bool = False
    estimated_annual_tenders: Optional[str] = None
    tender_value_range: Optional[str] = None
    primary_contact: Optional[str] = None
    technical_notes: Optional[str] = None
    last_verified: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    data_quality_score: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    def validate(self) -> List[str]:
        """Validate entry and return list of issues."""
        issues = []
        if not self.source_name:
            issues.append("Missing source_name")
        if not self.url:
            issues.append("Missing URL")
        elif not self._is_valid_url(self.url):
            issues.append(f"Invalid URL format: {self.url}")
        if not self.country_code or len(self.country_code) != 3:
            issues.append(f"Invalid country_code: {self.country_code}")
        return issues

    @staticmethod
    def _is_valid_url(url: str) -> bool:
        """Check if URL is properly formatted."""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except Exception:
            return False


@dataclass
class CountryConfig:
    """
    Configuration for a country's procurement landscape.

    Defines the country's metadata and available procurement sources
    that can be automatically generated.
    """
    code: str  # ISO 3166-1 alpha-3
    name: str
    region: Region
    primary_language: str = "English"
    secondary_languages: List[str] = field(default_factory=list)
    currency: str = "USD"

    # E-procurement portal configuration
    has_national_portal: bool = True
    national_portal_url: Optional[str] = None
    national_portal_name: Optional[str] = None

    # Sub-national structure
    admin_divisions: List[str] = field(default_factory=list)  # States/provinces/regions
    major_cities: List[str] = field(default_factory=list)

    # SOE landscape
    national_oil_company: Optional[Tuple[str, str]] = None  # (name, url)
    national_electricity: Optional[Tuple[str, str]] = None
    national_water: Optional[Tuple[str, str]] = None
    national_telecom: Optional[Tuple[str, str]] = None
    national_railway: Optional[Tuple[str, str]] = None
    national_airline: Optional[Tuple[str, str]] = None
    major_ports: List[Tuple[str, str]] = field(default_factory=list)
    major_airports: List[Tuple[str, str]] = field(default_factory=list)

    # Institutions
    central_bank: Optional[Tuple[str, str]] = None
    major_universities: List[Tuple[str, str]] = field(default_factory=list)
    major_hospitals: List[Tuple[str, str]] = field(default_factory=list)

    # URL patterns (for automatic generation)
    subnational_url_pattern: Optional[str] = None  # e.g., "https://{state}.gov.{tld}/procurement"
    tld: str = "gov"  # Top-level domain pattern


# =============================================================================
# URL PATTERN TEMPLATES
# =============================================================================

class URLPatternGenerator:
    """
    Generates URLs based on common e-procurement portal patterns.

    Many countries follow predictable URL structures for their procurement
    portals. This class encapsulates those patterns.
    """

    # Common URL patterns by region/language
    PATTERNS = {
        "english_africa": [
            "https://www.{entity}.go.{tld}/tenders",
            "https://www.{entity}.gov.{tld}/procurement",
            "https://tenders.{entity}.go.{tld}",
            "https://procurement.{entity}.go.{tld}",
        ],
        "french_africa": [
            "https://www.{entity}.gouv.{tld}/marches",
            "https://marchespublics.{entity}.gouv.{tld}",
            "https://www.{entity}.gov.{tld}/appels-offres",
        ],
        "portuguese_africa": [
            "https://www.{entity}.gov.{tld}/concursos",
            "https://www.{entity}.gov.{tld}/aquisicoes",
        ],
        "latin_america": [
            "https://www.{entity}.gob.{tld}/licitaciones",
            "https://compras.{entity}.gob.{tld}",
            "https://www.{entity}.gov.{tld}/contrataciones",
        ],
        "south_asia": [
            "https://www.{entity}.gov.{tld}/tenders",
            "https://eprocure.{entity}.gov.{tld}",
            "https://tenders.{entity}.gov.{tld}",
        ],
        "southeast_asia": [
            "https://www.{entity}.gov.{tld}/procurement",
            "https://eproc.{entity}.go.{tld}",
            "https://lpse.{entity}.go.{tld}",  # Indonesia specific
        ],
    }

    @classmethod
    def generate_url(cls, pattern_type: str, entity: str, tld: str) -> str:
        """Generate a URL using a pattern template."""
        patterns = cls.PATTERNS.get(pattern_type, cls.PATTERNS["english_africa"])
        # Use first pattern as default
        pattern = patterns[0]
        return pattern.format(entity=entity.lower().replace(" ", ""), tld=tld)

    @classmethod
    def generate_variations(cls, pattern_type: str, entity: str, tld: str) -> List[str]:
        """Generate all URL variations for an entity."""
        patterns = cls.PATTERNS.get(pattern_type, [])
        return [p.format(entity=entity.lower().replace(" ", ""), tld=tld) for p in patterns]


# =============================================================================
# ENTITY TEMPLATES
# =============================================================================

class EntityTemplates:
    """
    Templates for generating entries for common entity types.

    These templates encode domain knowledge about typical procurement
    characteristics of different entity types.
    """

    @staticmethod
    def national_eproc_portal(
        country: CountryConfig,
        portal_name: Optional[str] = None,
        portal_url: Optional[str] = None
    ) -> TenderEntry:
        """Generate entry for a national e-procurement portal."""
        name = portal_name or f"{country.name} National E-Procurement Portal"
        url = portal_url or country.national_portal_url or f"https://procurement.gov.{country.code.lower()}"

        return TenderEntry(
            source_name=name,
            url=url,
            country_code=country.code,
            country_name=country.name,
            entity_type=EntityType.NATIONAL_GOVERNMENT.value,
            entity_subtype="Central E-Procurement System",
            sectors=SECTORS["general"] + SECTORS["infrastructure"],
            language=country.primary_language,
            update_frequency=UpdateFrequency.DAILY.value,
            registration_required=True,
            api_available=True,  # Most modern systems have APIs
            estimated_annual_tenders="1000-10000",
            technical_notes=f"Primary national procurement portal for {country.name}"
        )

    @staticmethod
    def subnational_government(
        country: CountryConfig,
        division_name: str,
        division_type: str = "State",
        url: Optional[str] = None
    ) -> TenderEntry:
        """Generate entry for a sub-national government."""
        slug = division_name.lower().replace(" ", "").replace("-", "")
        default_url = f"https://{slug}.gov.{country.code.lower()}/procurement"

        return TenderEntry(
            source_name=f"{division_name} {division_type} Government - Procurement",
            url=url or default_url,
            country_code=country.code,
            country_name=country.name,
            region=division_name,
            entity_type=EntityType.SUB_NATIONAL_GOVERNMENT.value,
            entity_subtype=f"{division_type} Government",
            sectors=SECTORS["general"] + SECTORS["infrastructure"],
            language=country.primary_language,
            update_frequency=UpdateFrequency.WEEKLY.value,
            registration_required=True,
            estimated_annual_tenders="100-500",
            technical_notes=f"{division_type}-level procurement for {division_name}, {country.name}"
        )

    @staticmethod
    def utility_company(
        country: CountryConfig,
        company_name: str,
        utility_type: str,  # "electricity", "water", "telecom", etc.
        url: str,
        regional_coverage: str = "National"
    ) -> TenderEntry:
        """Generate entry for a utility company."""
        sector_map = {
            "electricity": SECTORS["energy"],
            "water": SECTORS["water"],
            "telecom": SECTORS["ict"],
            "gas": SECTORS["energy"] + SECTORS["oil_gas"],
        }

        return TenderEntry(
            source_name=company_name,
            url=url,
            country_code=country.code,
            country_name=country.name,
            region=regional_coverage,
            entity_type=EntityType.UTILITY.value,
            entity_subtype=f"{utility_type.title()} Utility",
            sectors=sector_map.get(utility_type, SECTORS["infrastructure"]),
            language=country.primary_language,
            update_frequency=UpdateFrequency.WEEKLY.value,
            registration_required=True,
            estimated_annual_tenders="50-300",
            technical_notes=f"{utility_type.title()} utility procurement - {country.name}"
        )

    @staticmethod
    def national_oil_company(
        country: CountryConfig,
        company_name: str,
        url: str
    ) -> TenderEntry:
        """Generate entry for a national oil company."""
        return TenderEntry(
            source_name=company_name,
            url=url,
            country_code=country.code,
            country_name=country.name,
            entity_type=EntityType.STATE_OWNED_ENTERPRISE.value,
            entity_subtype="National Oil Company",
            sectors=SECTORS["oil_gas"] + SECTORS["energy"],
            language=country.primary_language,
            update_frequency=UpdateFrequency.WEEKLY.value,
            registration_required=True,
            estimated_annual_tenders="100-1000",
            technical_notes=f"National oil company procurement - {country.name}"
        )

    @staticmethod
    def port_authority(
        country: CountryConfig,
        port_name: str,
        url: str,
        city: Optional[str] = None
    ) -> TenderEntry:
        """Generate entry for a port authority."""
        return TenderEntry(
            source_name=port_name,
            url=url,
            country_code=country.code,
            country_name=country.name,
            region=city or port_name,
            entity_type=EntityType.PORT_AUTHORITY.value,
            entity_subtype="Maritime Infrastructure",
            sectors=SECTORS["maritime"] + SECTORS["infrastructure"],
            language=country.primary_language,
            update_frequency=UpdateFrequency.WEEKLY.value,
            registration_required=True,
            estimated_annual_tenders="50-300",
            technical_notes=f"Port authority procurement - {port_name}"
        )

    @staticmethod
    def university(
        country: CountryConfig,
        university_name: str,
        url: str
    ) -> TenderEntry:
        """Generate entry for a university."""
        return TenderEntry(
            source_name=university_name,
            url=url,
            country_code=country.code,
            country_name=country.name,
            entity_type=EntityType.UNIVERSITY.value,
            entity_subtype="Higher Education Institution",
            sectors=SECTORS["education"] + SECTORS["ict"] + SECTORS["infrastructure"],
            language=country.primary_language,
            update_frequency=UpdateFrequency.MONTHLY.value,
            registration_required=True,
            estimated_annual_tenders="30-150",
            technical_notes=f"University procurement - {country.name}"
        )

    @staticmethod
    def mdb(
        name: str,
        url: str,
        coverage: str,
        focus_sectors: List[str]
    ) -> TenderEntry:
        """Generate entry for a Multilateral Development Bank."""
        return TenderEntry(
            source_name=name,
            url=url,
            country_code="INT",
            country_name="International",
            region=coverage,
            entity_type=EntityType.MULTILATERAL_DEVELOPMENT_BANK.value,
            entity_subtype="Development Finance Institution",
            sectors=focus_sectors,
            language="English",
            update_frequency=UpdateFrequency.DAILY.value,
            registration_required=True,
            api_available=True,
            estimated_annual_tenders="500-5000",
            technical_notes=f"MDB procurement - {coverage} coverage"
        )

    @staticmethod
    def un_agency(
        name: str,
        url: str,
        mandate: str,
        focus_sectors: List[str]
    ) -> TenderEntry:
        """Generate entry for a UN agency."""
        return TenderEntry(
            source_name=name,
            url=url,
            country_code="UN",
            country_name="United Nations",
            entity_type=EntityType.UN_AGENCY.value,
            entity_subtype=mandate,
            sectors=focus_sectors,
            language="English",
            update_frequency=UpdateFrequency.DAILY.value,
            registration_required=True,
            api_available=True,
            estimated_annual_tenders="200-2000",
            technical_notes=f"UN agency procurement - {mandate}"
        )


# =============================================================================
# REGION BUILDERS
# =============================================================================

class RegionBuilder(ABC):
    """
    Abstract base class for building entries for a geographic region.

    Each region has specific characteristics and patterns that require
    specialized handling.
    """

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.entries: List[TenderEntry] = []

    @abstractmethod
    def build(self) -> List[TenderEntry]:
        """Build all entries for this region."""
        pass

    def add_entry(self, entry: TenderEntry) -> None:
        """Add an entry after validation."""
        issues = entry.validate()
        if issues:
            logger.warning(f"Entry validation issues for {entry.source_name}: {issues}")
        self.entries.append(entry)

    def get_entries(self) -> List[TenderEntry]:
        """Return all built entries."""
        return self.entries


class AfricaBuilder(RegionBuilder):
    """Builder for African countries."""

    # Country configurations for Africa
    COUNTRIES = {
        # East Africa
        "KEN": CountryConfig(
            code="KEN", name="Kenya", region=Region.AFRICA_EAST,
            primary_language="English",
            national_portal_url="https://supplier.treasury.go.ke",
            national_portal_name="IFMIS Supplier Portal",
            admin_divisions=["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Machakos", "Nyeri", "Kakamega", "Kiambu", "Uasin Gishu"],
            national_electricity=("Kenya Power & Lighting Company", "https://www.kplc.co.ke/tenders"),
            national_water=("Nairobi Water & Sewerage Company", "https://www.nairobiwater.co.ke/tenders"),
            national_railway=("Kenya Railways Corporation", "https://www.krc.co.ke/tenders"),
            major_ports=[("Kenya Ports Authority", "https://www.kpa.co.ke/tenders")],
            major_airports=[("Kenya Airports Authority", "https://www.kaa.go.ke/tenders")],
            central_bank=("Central Bank of Kenya", "https://www.centralbank.go.ke/tenders"),
            major_universities=[
                ("University of Nairobi", "https://www.uonbi.ac.ke/tenders"),
                ("Kenyatta University", "https://www.ku.ac.ke/tenders"),
            ],
            subnational_url_pattern="https://www.{division}.go.ke/tenders",
        ),
        "TZA": CountryConfig(
            code="TZA", name="Tanzania", region=Region.AFRICA_EAST,
            primary_language="Swahili", secondary_languages=["English"],
            national_portal_url="https://ppra.go.tz",
            national_portal_name="Tanzania PPRA",
            admin_divisions=["Dar es Salaam", "Arusha", "Mwanza", "Dodoma", "Mbeya", "Morogoro", "Tanga", "Zanzibar"],
            national_electricity=("TANESCO", "https://www.tanesco.co.tz/tenders"),
            national_water=("DAWASCO", "https://www.dawasco.or.tz/tenders"),
            national_railway=("Tanzania Railways Corporation", "https://www.trc.co.tz/tenders"),
            major_ports=[("Tanzania Ports Authority", "https://www.ports.go.tz/tenders")],
        ),
        "UGA": CountryConfig(
            code="UGA", name="Uganda", region=Region.AFRICA_EAST,
            primary_language="English",
            national_portal_url="https://gpp.ppda.go.ug",
            national_portal_name="Uganda GPP",
            admin_divisions=["Kampala", "Wakiso", "Mukono", "Jinja", "Gulu", "Mbarara"],
            national_electricity=("UMEME", "https://www.umeme.co.ug/tenders"),
            national_water=("NWSC Uganda", "https://www.nwsc.co.ug/tenders"),
        ),
        # West Africa
        "NGA": CountryConfig(
            code="NGA", name="Nigeria", region=Region.AFRICA_WEST,
            primary_language="English",
            national_portal_url="https://nocopo.bpp.gov.ng",
            national_portal_name="NOCOPO",
            admin_divisions=["Lagos", "Kano", "Rivers", "Oyo", "Kaduna", "Delta", "Ogun", "Edo", "Enugu", "Anambra",
                           "Imo", "Abia", "Akwa Ibom", "Cross River", "Bayelsa", "Benue", "Plateau", "Kogi",
                           "Kwara", "Niger", "FCT Abuja", "Sokoto", "Kebbi", "Zamfara", "Katsina", "Jigawa",
                           "Bauchi", "Gombe", "Adamawa", "Taraba", "Borno", "Yobe", "Nasarawa", "Ekiti", "Ondo", "Osun"],
            national_oil_company=("NNPC", "https://nnpcgroup.com/tenders"),
            national_electricity=("EKEDC", "https://www.eaborpower.com/tenders"),
            major_ports=[("Nigerian Ports Authority", "https://www.nigerianports.gov.ng/tenders")],
            central_bank=("Central Bank of Nigeria", "https://www.cbn.gov.ng/procurement"),
        ),
        "GHA": CountryConfig(
            code="GHA", name="Ghana", region=Region.AFRICA_WEST,
            primary_language="English",
            national_portal_url="https://www.ppaghana.org",
            national_portal_name="Ghana PPA",
            admin_divisions=["Greater Accra", "Ashanti", "Western", "Eastern", "Central", "Northern", "Volta"],
            national_oil_company=("GNPC", "https://www.gnpcghana.com/tenders"),
            national_electricity=("ECG Ghana", "https://www.ecggh.com/tenders"),
            national_water=("GWCL", "https://www.gwcl.com.gh/tenders"),
            major_ports=[("Ghana Ports and Harbours", "https://www.ghanaports.gov.gh/tenders")],
        ),
        "SEN": CountryConfig(
            code="SEN", name="Senegal", region=Region.AFRICA_WEST,
            primary_language="French",
            national_portal_url="https://www.marchespublics.sn",
            national_portal_name="Marchés Publics du Sénégal",
            admin_divisions=["Dakar", "Thiès", "Saint-Louis", "Diourbel", "Kaolack"],
            national_electricity=("SENELEC", "https://www.senelec.sn/tenders"),
            major_ports=[("Port Autonome de Dakar", "https://www.portdakar.sn/tenders")],
        ),
        # Southern Africa
        "ZAF": CountryConfig(
            code="ZAF", name="South Africa", region=Region.AFRICA_SOUTHERN,
            primary_language="English",
            national_portal_url="https://etenders.gov.za",
            national_portal_name="eTenders South Africa",
            admin_divisions=["Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", "Free State",
                           "Mpumalanga", "Limpopo", "North West", "Northern Cape"],
            major_cities=["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein"],
            national_electricity=("Eskom", "https://www.eskom.co.za/tenders"),
            national_railway=("PRASA", "https://www.prasa.com/tenders"),
            major_ports=[("Transnet National Ports Authority", "https://www.transnetnationalportsauthority.net/tenders")],
            major_airports=[("ACSA", "https://www.airports.co.za/tenders")],
            central_bank=("South African Reserve Bank", "https://www.resbank.co.za/tenders"),
            major_universities=[
                ("University of Cape Town", "https://www.uct.ac.za/tenders"),
                ("University of Witwatersrand", "https://www.wits.ac.za/tenders"),
                ("Stellenbosch University", "https://www.sun.ac.za/tenders"),
            ],
        ),
        "ZMB": CountryConfig(
            code="ZMB", name="Zambia", region=Region.AFRICA_SOUTHERN,
            primary_language="English",
            national_portal_url="https://www.zppa.org.zm",
            national_portal_name="Zambia ZPPA",
            admin_divisions=["Lusaka", "Copperbelt", "Southern", "Eastern", "Northern"],
            national_electricity=("ZESCO", "https://www.zesco.co.zm/tenders"),
            national_water=("LWSC", "https://www.lwsc.com.zm/tenders"),
        ),
        # North Africa
        "EGY": CountryConfig(
            code="EGY", name="Egypt", region=Region.AFRICA_NORTH,
            primary_language="Arabic", secondary_languages=["English"],
            national_portal_url="https://etenders.gov.eg",
            national_portal_name="Egypt e-Tenders",
            admin_divisions=["Cairo", "Alexandria", "Giza", "Luxor", "Aswan", "Port Said", "Suez"],
            national_oil_company=("EGPC", "https://www.egpc.com.eg/tenders"),
            national_railway=("Egyptian National Railways", "https://www.enr.gov.eg/tenders"),
        ),
        "MAR": CountryConfig(
            code="MAR", name="Morocco", region=Region.AFRICA_NORTH,
            primary_language="French", secondary_languages=["Arabic"],
            national_portal_url="https://www.marchespublics.gov.ma",
            national_portal_name="Portail Marocain des Marchés Publics",
            admin_divisions=["Casablanca-Settat", "Rabat-Salé-Kénitra", "Marrakech-Safi", "Fès-Meknès", "Tanger-Tétouan"],
            national_railway=("ONCF", "https://www.oncf.ma/tenders"),
            major_airports=[("ONDA", "https://www.onda.ma/tenders")],
        ),
    }

    def build(self) -> List[TenderEntry]:
        """Build entries for all configured African countries."""
        logger.info("Building African region entries...")

        for code, country in self.COUNTRIES.items():
            self._build_country(country)

        logger.info(f"Built {len(self.entries)} entries for Africa")
        return self.entries

    def _build_country(self, country: CountryConfig) -> None:
        """Build all entries for a single country."""
        # National e-procurement portal
        if country.has_national_portal:
            entry = EntityTemplates.national_eproc_portal(
                country,
                portal_name=country.national_portal_name,
                portal_url=country.national_portal_url
            )
            self.add_entry(entry)

        # Sub-national governments
        for division in country.admin_divisions:
            entry = EntityTemplates.subnational_government(
                country, division,
                division_type="State" if country.code == "NGA" else "County" if country.code == "KEN" else "Province"
            )
            self.add_entry(entry)

        # Utilities
        if country.national_electricity:
            name, url = country.national_electricity
            entry = EntityTemplates.utility_company(country, name, "electricity", url)
            self.add_entry(entry)

        if country.national_water:
            name, url = country.national_water
            entry = EntityTemplates.utility_company(country, name, "water", url)
            self.add_entry(entry)

        # National Oil Company
        if country.national_oil_company:
            name, url = country.national_oil_company
            entry = EntityTemplates.national_oil_company(country, name, url)
            self.add_entry(entry)

        # Ports
        for name, url in country.major_ports:
            entry = EntityTemplates.port_authority(country, name, url)
            self.add_entry(entry)

        # Airports
        for name, url in country.major_airports:
            entry = TenderEntry(
                source_name=name,
                url=url,
                country_code=country.code,
                country_name=country.name,
                entity_type=EntityType.AIRPORT_AUTHORITY.value,
                entity_subtype="Aviation Infrastructure",
                sectors=SECTORS["aviation"],
                language=country.primary_language,
                update_frequency=UpdateFrequency.WEEKLY.value,
                registration_required=True,
                estimated_annual_tenders="50-300",
                technical_notes=f"Airport authority procurement - {country.name}"
            )
            self.add_entry(entry)

        # Railways
        if country.national_railway:
            name, url = country.national_railway
            entry = TenderEntry(
                source_name=name,
                url=url,
                country_code=country.code,
                country_name=country.name,
                entity_type=EntityType.RAILWAY_CORPORATION.value,
                entity_subtype="Railway Corporation",
                sectors=SECTORS["railways"],
                language=country.primary_language,
                update_frequency=UpdateFrequency.WEEKLY.value,
                registration_required=True,
                estimated_annual_tenders="50-400",
                technical_notes=f"Railway corporation procurement - {country.name}"
            )
            self.add_entry(entry)

        # Central Bank
        if country.central_bank:
            name, url = country.central_bank
            entry = TenderEntry(
                source_name=name,
                url=url,
                country_code=country.code,
                country_name=country.name,
                entity_type=EntityType.CENTRAL_BANK.value,
                entity_subtype="Monetary Authority",
                sectors=SECTORS["finance"] + SECTORS["ict"],
                language=country.primary_language,
                update_frequency=UpdateFrequency.WEEKLY.value,
                registration_required=True,
                estimated_annual_tenders="50-200",
                technical_notes=f"Central bank procurement - {country.name}"
            )
            self.add_entry(entry)

        # Universities
        for name, url in country.major_universities:
            entry = EntityTemplates.university(country, name, url)
            self.add_entry(entry)


class InternationalBuilder(RegionBuilder):
    """Builder for international organizations (MDBs, UN, bilateral)."""

    # Multilateral Development Banks
    MDBS = [
        ("World Bank", "https://www.worldbank.org/en/projects-operations/products-and-services/procurement", "Global", SECTORS["infrastructure"] + SECTORS["consulting"]),
        ("African Development Bank", "https://www.afdb.org/en/projects-and-operations/procurement", "Africa", SECTORS["infrastructure"] + SECTORS["energy"]),
        ("Asian Development Bank", "https://www.adb.org/site/business-opportunities/operational-procurement", "Asia-Pacific", SECTORS["infrastructure"] + SECTORS["transport"]),
        ("Inter-American Development Bank", "https://www.iadb.org/en/procurement", "Latin America & Caribbean", SECTORS["infrastructure"] + SECTORS["water"]),
        ("Islamic Development Bank", "https://www.isdb.org/procurement", "OIC Member Countries", SECTORS["infrastructure"] + SECTORS["education"]),
        ("European Bank for Reconstruction and Development", "https://www.ebrd.com/work-with-us/procurement.html", "Europe & Central Asia", SECTORS["infrastructure"] + SECTORS["energy"]),
        ("Asian Infrastructure Investment Bank", "https://www.aiib.org/en/opportunities/business/procurement-overview.html", "Asia", SECTORS["infrastructure"]),
        ("New Development Bank (BRICS)", "https://www.ndb.int/procurement/", "BRICS Countries", SECTORS["infrastructure"] + SECTORS["energy"]),
        ("European Investment Bank", "https://www.eib.org/en/about/procurement/index.htm", "Global", SECTORS["infrastructure"] + SECTORS["environment"]),
    ]

    # UN Agencies
    UN_AGENCIES = [
        ("UNGM - UN Global Marketplace", "https://www.ungm.org", "UN Procurement", SECTORS["general"]),
        ("UNDP - UN Development Programme", "https://procurement-notices.undp.org", "Development", SECTORS["consulting"] + SECTORS["ict"]),
        ("UNICEF Supply Division", "https://www.unicef.org/supply/", "Children", SECTORS["health"] + SECTORS["education"]),
        ("WHO - World Health Organization", "https://www.who.int/about/procurement", "Health", SECTORS["health"]),
        ("WFP - World Food Programme", "https://www.wfp.org/procurement", "Food Security", SECTORS["agriculture"] + SECTORS["humanitarian"]),
        ("FAO - Food and Agriculture Organization", "https://www.fao.org/unfao/procurement/", "Agriculture", SECTORS["agriculture"]),
        ("UNHCR - UN Refugee Agency", "https://www.unhcr.org/what-we-do/how-we-work/procurement", "Refugees", SECTORS["humanitarian"]),
        ("UNOPS", "https://www.unops.org/business-opportunities", "Operations", SECTORS["infrastructure"] + SECTORS["consulting"]),
        ("IOM - International Organization for Migration", "https://www.iom.int/procurement-opportunities", "Migration", SECTORS["humanitarian"]),
        ("UNESCO", "https://en.unesco.org/procurement", "Education & Culture", SECTORS["education"]),
        ("IAEA - International Atomic Energy Agency", "https://www.iaea.org/about/procurement", "Nuclear", SECTORS["energy"]),
        ("ILO - International Labour Organization", "https://www.ilo.org/procurement/", "Labour", SECTORS["consulting"]),
    ]

    # Bilateral Development Agencies
    BILATERAL = [
        ("USAID", "https://www.usaid.gov/work-usaid/how-to-work-with-usaid/procurement", "USA", SECTORS["consulting"] + SECTORS["health"]),
        ("GIZ", "https://www.giz.de/en/workingwithgiz/tenders.html", "Germany", SECTORS["consulting"] + SECTORS["environment"]),
        ("AFD - Agence Française de Développement", "https://www.afd.fr/en/procurement", "France", SECTORS["infrastructure"] + SECTORS["environment"]),
        ("JICA", "https://www.jica.go.jp/english/our_work/types_of_assistance/oda_loans/procurement/", "Japan", SECTORS["infrastructure"]),
        ("FCDO (formerly DFID)", "https://supplierportal.cabinetoffice.gov.uk", "United Kingdom", SECTORS["consulting"] + SECTORS["humanitarian"]),
        ("SIDA", "https://www.sida.se/en/for-partners/procurement", "Sweden", SECTORS["consulting"] + SECTORS["environment"]),
        ("KfW", "https://www.kfw-entwicklungsbank.de/International-financing/KfW-Development-Bank/Our-topics/Procurement/", "Germany", SECTORS["infrastructure"] + SECTORS["energy"]),
        ("CIDA/GAC", "https://www.international.gc.ca/world-monde/funding-financement/procurement-marches/index.aspx", "Canada", SECTORS["consulting"]),
        ("KOICA", "https://www.koica.go.kr/koica_en/3445/subview.do", "South Korea", SECTORS["ict"] + SECTORS["infrastructure"]),
        ("NORAD", "https://norad.no/en/front/procurement/", "Norway", SECTORS["energy"] + SECTORS["environment"]),
        ("AusAID/DFAT", "https://www.dfat.gov.au/aid/who-we-work-with/contractors/tenders", "Australia", SECTORS["consulting"] + SECTORS["infrastructure"]),
    ]

    # Regional Economic Communities
    RECS = [
        ("African Union", "https://au.int/en/bids", "Africa", SECTORS["general"]),
        ("ECOWAS", "https://ecowas.int/procurement/", "West Africa", SECTORS["general"]),
        ("SADC", "https://www.sadc.int/tenders", "Southern Africa", SECTORS["general"]),
        ("EAC - East African Community", "https://www.eac.int/procurement", "East Africa", SECTORS["general"]),
        ("COMESA", "https://www.comesa.int/tenders/", "Eastern & Southern Africa", SECTORS["general"]),
        ("ASEAN Secretariat", "https://asean.org/procurement/", "Southeast Asia", SECTORS["general"]),
        ("Pacific Islands Forum", "https://www.forumsec.org/tenders/", "Pacific", SECTORS["general"]),
        ("CARICOM", "https://caricom.org/tenders/", "Caribbean", SECTORS["general"]),
    ]

    def build(self) -> List[TenderEntry]:
        """Build entries for all international organizations."""
        logger.info("Building international organization entries...")

        # MDBs
        for name, url, coverage, sectors in self.MDBS:
            entry = EntityTemplates.mdb(name, url, coverage, sectors)
            self.add_entry(entry)

        # UN Agencies
        for name, url, mandate, sectors in self.UN_AGENCIES:
            entry = EntityTemplates.un_agency(name, url, mandate, sectors)
            self.add_entry(entry)

        # Bilateral Agencies
        for name, url, country, sectors in self.BILATERAL:
            entry = TenderEntry(
                source_name=name,
                url=url,
                country_code="INT",
                country_name=country,
                entity_type=EntityType.BILATERAL_AGENCY.value,
                entity_subtype="Official Development Assistance",
                sectors=sectors,
                language="English",
                update_frequency=UpdateFrequency.WEEKLY.value,
                registration_required=True,
                estimated_annual_tenders="200-1000",
                technical_notes=f"Bilateral development agency - {country}"
            )
            self.add_entry(entry)

        # RECs
        for name, url, coverage, sectors in self.RECS:
            entry = TenderEntry(
                source_name=name,
                url=url,
                country_code="Regional",
                country_name=coverage,
                entity_type=EntityType.REGIONAL_ECONOMIC_COMMUNITY.value,
                entity_subtype="Regional Organization",
                sectors=sectors,
                language="English",
                update_frequency=UpdateFrequency.WEEKLY.value,
                registration_required=True,
                estimated_annual_tenders="50-300",
                technical_notes=f"Regional economic community - {coverage}"
            )
            self.add_entry(entry)

        logger.info(f"Built {len(self.entries)} entries for international organizations")
        return self.entries


# =============================================================================
# DATABASE COMPILER
# =============================================================================

class DatabaseCompiler:
    """
    Compiles all entries into final output formats.

    Supports Excel and JSON output with comprehensive formatting
    and summary statistics.
    """

    def __init__(self):
        self.entries: List[TenderEntry] = []
        self.builders: List[RegionBuilder] = []

    def add_builder(self, builder: RegionBuilder) -> None:
        """Add a region builder."""
        self.builders.append(builder)

    def build_all(self) -> None:
        """Execute all builders and collect entries."""
        for builder in self.builders:
            entries = builder.build()
            self.entries.extend(entries)

        logger.info(f"Total entries compiled: {len(self.entries)}")

    def save_json(self, output_path: str) -> None:
        """Save entries to JSON file."""
        data = [entry.to_dict() for entry in self.entries]

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Saved {len(self.entries)} entries to {output_path}")

    def save_excel(self, output_path: str) -> None:
        """Save entries to formatted Excel workbook."""
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
            from openpyxl.utils import get_column_letter
        except ImportError:
            logger.error("openpyxl not installed. Run: pip install openpyxl")
            return

        wb = Workbook()
        ws = wb.active
        ws.title = "Tender Sources"

        # Define headers
        headers = [
            "Source Name", "URL", "Country Code", "Country Name", "Region",
            "Entity Type", "Entity Subtype", "Sectors", "Language",
            "Update Frequency", "Registration Required", "API Available",
            "Est. Annual Tenders", "Technical Notes", "Last Verified"
        ]

        # Styles
        header_font = Font(bold=True, color="FFFFFF", name="Arial", size=10)
        header_fill = PatternFill("solid", fgColor="2E7D32")
        header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        thin_border = Border(
            left=Side(style='thin'), right=Side(style='thin'),
            top=Side(style='thin'), bottom=Side(style='thin')
        )

        # Write headers
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border

        # Write data
        for row_idx, entry in enumerate(self.entries, 2):
            data = entry.to_dict()
            values = [
                data.get("source_name", ""),
                data.get("url", ""),
                data.get("country_code", ""),
                data.get("country_name", ""),
                data.get("region", ""),
                data.get("entity_type", ""),
                data.get("entity_subtype", ""),
                ", ".join(data.get("sectors", [])),
                data.get("language", ""),
                data.get("update_frequency", ""),
                "Yes" if data.get("registration_required") else "No",
                "Yes" if data.get("api_available") else "No",
                data.get("estimated_annual_tenders", ""),
                data.get("technical_notes", ""),
                data.get("last_verified", ""),
            ]

            for col_idx, value in enumerate(values, 1):
                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                cell.border = thin_border
                if col_idx == 2:  # URL column
                    cell.font = Font(color="0000FF", underline="single")

        # Set column widths
        widths = [45, 55, 12, 20, 25, 22, 25, 40, 12, 15, 12, 12, 18, 45, 14]
        for col_idx, width in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(col_idx)].width = width

        # Freeze header row and add filter
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions

        # Create summary sheet
        self._create_summary_sheet(wb)

        # Save
        wb.save(output_path)
        logger.info(f"Saved Excel workbook to {output_path}")

    def _create_summary_sheet(self, wb) -> None:
        """Create summary statistics sheet."""
        from openpyxl.styles import Font, PatternFill, Border, Side

        ws = wb.create_sheet("Summary")

        ws['A1'] = "Tender Intelligence Database - Summary"
        ws['A1'].font = Font(bold=True, size=16)
        ws['A2'] = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        ws['A3'] = f"Total Sources: {len(self.entries)}"
        ws['A3'].font = Font(bold=True, size=12)

        # Count by entity type
        entity_counts = {}
        for entry in self.entries:
            entity = entry.entity_type
            entity_counts[entity] = entity_counts.get(entity, 0) + 1

        row = 5
        ws.cell(row=row, column=1, value="Sources by Entity Type").font = Font(bold=True)
        row += 1
        for entity, count in sorted(entity_counts.items(), key=lambda x: -x[1]):
            ws.cell(row=row, column=1, value=entity)
            ws.cell(row=row, column=2, value=count)
            row += 1

        # Count by country
        country_counts = {}
        for entry in self.entries:
            country = entry.country_name
            country_counts[country] = country_counts.get(country, 0) + 1

        row += 2
        ws.cell(row=row, column=1, value="Top 20 Countries").font = Font(bold=True)
        row += 1
        for country, count in sorted(country_counts.items(), key=lambda x: -x[1])[:20]:
            ws.cell(row=row, column=1, value=country)
            ws.cell(row=row, column=2, value=count)
            row += 1

        ws.column_dimensions['A'].width = 40
        ws.column_dimensions['B'].width = 12


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def main():
    """Main entry point for the database builder."""
    parser = argparse.ArgumentParser(
        description="Build a comprehensive tender intelligence database"
    )
    parser.add_argument(
        "--output", "-o",
        default="tender_database.xlsx",
        help="Output file path (supports .xlsx and .json)"
    )
    parser.add_argument(
        "--regions",
        nargs="+",
        default=["africa", "international"],
        help="Regions to include (africa, international, etc.)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Initialize compiler
    compiler = DatabaseCompiler()

    # Add builders based on selected regions
    if "africa" in args.regions:
        compiler.add_builder(AfricaBuilder())

    if "international" in args.regions:
        compiler.add_builder(InternationalBuilder())

    # Build database
    compiler.build_all()

    # Save output
    output_path = args.output
    if output_path.endswith(".json"):
        compiler.save_json(output_path)
    else:
        compiler.save_excel(output_path)

    print(f"\n{'='*60}")
    print(f"DATABASE BUILD COMPLETE")
    print(f"{'='*60}")
    print(f"Total entries: {len(compiler.entries)}")
    print(f"Output file: {output_path}")


if __name__ == "__main__":
    main()
