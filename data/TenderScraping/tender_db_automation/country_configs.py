#!/usr/bin/env python3
"""
Country Configuration Data
===========================
Extensible configuration for all countries in the Global South.

This module contains detailed configurations that can be used by the
TenderDatabaseBuilder to automatically generate procurement source entries.

To add a new country:
1. Add entry to the appropriate regional dictionary
2. Follow the CountryConfig structure
3. Run the builder with that region enabled

Structure:
- AFRICA_EAST, AFRICA_WEST, AFRICA_SOUTHERN, AFRICA_CENTRAL, AFRICA_NORTH
- LATIN_AMERICA, CARIBBEAN
- SOUTH_ASIA, SOUTHEAST_ASIA, PACIFIC
- MIDDLE_EAST, CENTRAL_ASIA
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Any


@dataclass
class CountryData:
    """
    Comprehensive country configuration for tender database generation.

    This dataclass contains all the information needed to automatically
    generate tender source entries for a country.
    """
    code: str                          # ISO 3166-1 alpha-3
    name: str                          # Full country name
    primary_language: str = "English"
    secondary_languages: List[str] = field(default_factory=list)
    currency_code: str = "USD"
    tld: str = "gov"                   # Top-level domain pattern

    # National E-Procurement
    national_portal_name: Optional[str] = None
    national_portal_url: Optional[str] = None

    # Administrative Divisions
    admin_division_type: str = "State"  # State, Province, Region, County, etc.
    admin_divisions: List[str] = field(default_factory=list)

    # Major Cities (separate from admin divisions)
    major_cities: List[str] = field(default_factory=list)

    # State-Owned Enterprises (name, url)
    national_oil_company: Optional[Tuple[str, str]] = None
    national_electricity: Optional[Tuple[str, str]] = None
    national_water: Optional[Tuple[str, str]] = None
    national_telecom: Optional[Tuple[str, str]] = None
    national_gas: Optional[Tuple[str, str]] = None
    national_railway: Optional[Tuple[str, str]] = None
    national_airline: Optional[Tuple[str, str]] = None
    national_postal: Optional[Tuple[str, str]] = None

    # Infrastructure Authorities
    ports: List[Tuple[str, str]] = field(default_factory=list)
    airports: List[Tuple[str, str]] = field(default_factory=list)
    highways: Optional[Tuple[str, str]] = None

    # Financial Institutions
    central_bank: Optional[Tuple[str, str]] = None
    development_bank: Optional[Tuple[str, str]] = None
    export_import_bank: Optional[Tuple[str, str]] = None

    # Academic and Health
    universities: List[Tuple[str, str]] = field(default_factory=list)
    teaching_hospitals: List[Tuple[str, str]] = field(default_factory=list)

    # Regulatory Agencies
    telecom_regulator: Optional[Tuple[str, str]] = None
    energy_regulator: Optional[Tuple[str, str]] = None
    statistics_office: Optional[Tuple[str, str]] = None

    # URL Patterns for automatic generation
    subnational_url_pattern: Optional[str] = None
    # e.g., "https://{division}.go.ke/tenders"

    # Metadata
    estimated_national_tenders: str = "1000-5000"
    has_api: bool = False
    notes: Optional[str] = None


# =============================================================================
# EAST AFRICA
# =============================================================================

EAST_AFRICA: Dict[str, CountryData] = {
    "KEN": CountryData(
        code="KEN",
        name="Kenya",
        primary_language="English",
        secondary_languages=["Swahili"],
        currency_code="KES",
        tld="ke",
        national_portal_name="IFMIS Supplier Portal",
        national_portal_url="https://supplier.treasury.go.ke",
        admin_division_type="County",
        admin_divisions=[
            "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Uasin Gishu", "Kiambu",
            "Machakos", "Kajiado", "Nyeri", "Meru", "Kilifi", "Kwale",
            "Kakamega", "Bungoma", "Trans Nzoia", "Kericho", "Bomet",
            "Nandi", "Baringo", "Laikipia", "Turkana", "West Pokot",
            "Samburu", "Elgeyo Marakwet", "Kitui", "Makueni", "Tharaka Nithi",
            "Embu", "Kirinyaga", "Murang'a", "Nyandarua", "Lamu", "Tana River",
            "Garissa", "Wajir", "Mandera", "Marsabit", "Isiolo", "Siaya",
            "Kisii", "Nyamira", "Migori", "Homa Bay", "Busia", "Vihiga",
            "Narok", "Taita Taveta"
        ],
        national_electricity=("Kenya Power & Lighting Company", "https://www.kplc.co.ke/tenders"),
        national_water=("Nairobi Water & Sewerage Company", "https://www.nairobiwater.co.ke/tenders"),
        national_railway=("Kenya Railways Corporation", "https://www.krc.co.ke/tenders"),
        national_airline=("Kenya Airways", "https://www.kenya-airways.com/tenders"),
        national_telecom=("Telkom Kenya", "https://www.telkom.co.ke/tenders"),
        ports=[
            ("Kenya Ports Authority", "https://www.kpa.co.ke/tenders"),
        ],
        airports=[
            ("Kenya Airports Authority", "https://www.kaa.go.ke/tenders"),
        ],
        highways=("KENHA - Kenya National Highways Authority", "https://www.kenha.co.ke/tenders"),
        central_bank=("Central Bank of Kenya", "https://www.centralbank.go.ke/tenders"),
        universities=[
            ("University of Nairobi", "https://www.uonbi.ac.ke/tenders"),
            ("Kenyatta University", "https://www.ku.ac.ke/tenders"),
            ("Jomo Kenyatta University of Agriculture", "https://www.jkuat.ac.ke/tenders"),
            ("Moi University", "https://www.mu.ac.ke/tenders"),
            ("Egerton University", "https://www.egerton.ac.ke/tenders"),
        ],
        teaching_hospitals=[
            ("Kenyatta National Hospital", "https://www.knh.or.ke/tenders"),
            ("Moi Teaching and Referral Hospital", "https://www.mtrh.go.ke/tenders"),
        ],
        telecom_regulator=("Communications Authority of Kenya", "https://ca.go.ke/tenders"),
        statistics_office=("Kenya National Bureau of Statistics", "https://www.knbs.or.ke/tenders"),
        subnational_url_pattern="https://www.{division}.go.ke/tenders",
        estimated_national_tenders="5000-15000",
        has_api=True,
        notes="Mature e-procurement system with IFMIS integration"
    ),

    "TZA": CountryData(
        code="TZA",
        name="Tanzania",
        primary_language="Swahili",
        secondary_languages=["English"],
        currency_code="TZS",
        tld="tz",
        national_portal_name="Tanzania PPRA",
        national_portal_url="https://ppra.go.tz",
        admin_division_type="Region",
        admin_divisions=[
            "Dar es Salaam", "Arusha", "Mwanza", "Dodoma", "Mbeya",
            "Morogoro", "Tanga", "Kagera", "Kilimanjaro", "Zanzibar",
            "Mara", "Iringa", "Shinyanga", "Tabora", "Kigoma",
            "Rukwa", "Ruvuma", "Singida", "Lindi", "Mtwara",
            "Pwani", "Geita", "Katavi", "Njombe", "Simiyu", "Songwe"
        ],
        national_electricity=("TANESCO", "https://www.tanesco.co.tz/tenders"),
        national_water=("DAWASCO", "https://www.dawasco.or.tz/tenders"),
        national_railway=("Tanzania Railways Corporation", "https://www.trc.co.tz/tenders"),
        ports=[
            ("Tanzania Ports Authority", "https://www.ports.go.tz/tenders"),
        ],
        airports=[
            ("Tanzania Airports Authority", "https://www.taa.go.tz/tenders"),
        ],
        central_bank=("Bank of Tanzania", "https://www.bot.go.tz/tenders"),
        universities=[
            ("University of Dar es Salaam", "https://www.udsm.ac.tz/tenders"),
            ("Muhimbili University", "https://www.muhas.ac.tz/tenders"),
        ],
        teaching_hospitals=[
            ("Muhimbili National Hospital", "https://www.mnh.or.tz/tenders"),
        ],
        telecom_regulator=("TCRA", "https://www.tcra.go.tz/tenders"),
        estimated_national_tenders="3000-8000",
        has_api=True,
    ),

    "UGA": CountryData(
        code="UGA",
        name="Uganda",
        primary_language="English",
        secondary_languages=["Swahili"],
        currency_code="UGX",
        tld="ug",
        national_portal_name="Uganda GPP",
        national_portal_url="https://gpp.ppda.go.ug",
        admin_division_type="District",
        admin_divisions=[
            "Kampala", "Wakiso", "Mukono", "Jinja", "Gulu", "Mbarara",
            "Lira", "Mbale", "Masaka", "Entebbe", "Arua", "Fort Portal",
            "Soroti", "Kabale", "Tororo", "Hoima", "Kasese", "Mityana"
        ],
        national_electricity=("UMEME", "https://www.umeme.co.ug/tenders"),
        national_water=("NWSC Uganda", "https://www.nwsc.co.ug/tenders"),
        national_airline=("Uganda Airlines", "https://www.ugandairlines.com/tenders"),
        airports=[
            ("Uganda Civil Aviation Authority", "https://www.ucaa.go.ug/tenders"),
        ],
        central_bank=("Bank of Uganda", "https://www.bou.or.ug/tenders"),
        universities=[
            ("Makerere University", "https://www.mak.ac.ug/tenders"),
            ("Kyambogo University", "https://www.kyu.ac.ug/tenders"),
        ],
        teaching_hospitals=[
            ("Mulago National Referral Hospital", "https://www.mulago.or.ug/tenders"),
        ],
        telecom_regulator=("UCC", "https://www.ucc.co.ug/tenders"),
        estimated_national_tenders="2000-6000",
        has_api=True,
    ),

    "ETH": CountryData(
        code="ETH",
        name="Ethiopia",
        primary_language="Amharic",
        secondary_languages=["English"],
        currency_code="ETB",
        tld="et",
        national_portal_name="Ethiopia PPA",
        national_portal_url="https://ppa.gov.et",
        admin_division_type="Regional State",
        admin_divisions=[
            "Addis Ababa", "Oromia", "Amhara", "Southern Nations", "Tigray",
            "Somali", "Afar", "Benishangul-Gumuz", "Gambela", "Harari",
            "Dire Dawa", "Sidama"
        ],
        national_electricity=("Ethiopian Electric Power", "https://www.eep.gov.et/tenders"),
        national_telecom=("Ethio Telecom", "https://www.ethiotelecom.et/tenders"),
        national_railway=("Ethiopian Railways Corporation", "https://www.erc.gov.et/tenders"),
        national_airline=("Ethiopian Airlines", "https://www.ethiopianairlines.com/tenders"),
        ports=[
            ("Ethiopian Shipping & Logistics", "https://www.eslse.gov.et/tenders"),
        ],
        airports=[
            ("Ethiopian Airports Enterprise", "https://www.ethiopianairports.com/tenders"),
        ],
        central_bank=("National Bank of Ethiopia", "https://www.nbe.gov.et/tenders"),
        universities=[
            ("Addis Ababa University", "https://www.aau.edu.et/tenders"),
        ],
        estimated_national_tenders="3000-10000",
    ),

    "RWA": CountryData(
        code="RWA",
        name="Rwanda",
        primary_language="English",
        secondary_languages=["French", "Kinyarwanda"],
        currency_code="RWF",
        tld="rw",
        national_portal_name="Rwanda RPPA",
        national_portal_url="https://umucyo.gov.rw",
        admin_division_type="Province",
        admin_divisions=["Kigali", "Eastern", "Northern", "Southern", "Western"],
        national_electricity=("REG - Rwanda Energy Group", "https://www.reg.rw/tenders"),
        national_water=("WASAC", "https://www.wasac.rw/tenders"),
        national_airline=("RwandAir", "https://www.rwandair.com/tenders"),
        airports=[
            ("Rwanda Civil Aviation Authority", "https://www.caa.gov.rw/tenders"),
        ],
        central_bank=("National Bank of Rwanda", "https://www.bnr.rw/tenders"),
        universities=[
            ("University of Rwanda", "https://www.ur.ac.rw/tenders"),
        ],
        estimated_national_tenders="1500-4000",
        has_api=True,
        notes="Highly digitized procurement system"
    ),
}


# =============================================================================
# WEST AFRICA
# =============================================================================

WEST_AFRICA: Dict[str, CountryData] = {
    "NGA": CountryData(
        code="NGA",
        name="Nigeria",
        primary_language="English",
        currency_code="NGN",
        tld="ng",
        national_portal_name="NOCOPO",
        national_portal_url="https://nocopo.bpp.gov.ng",
        admin_division_type="State",
        admin_divisions=[
            "Lagos", "Kano", "Rivers", "Oyo", "Kaduna", "Delta", "Ogun",
            "Edo", "Enugu", "Anambra", "Imo", "Abia", "Akwa Ibom",
            "Cross River", "Bayelsa", "Benue", "Plateau", "Kogi", "Kwara",
            "Niger", "FCT Abuja", "Sokoto", "Kebbi", "Zamfara", "Katsina",
            "Jigawa", "Bauchi", "Gombe", "Adamawa", "Taraba", "Borno",
            "Yobe", "Nasarawa", "Ekiti", "Ondo", "Osun"
        ],
        national_oil_company=("NNPC", "https://nnpcgroup.com/tenders"),
        national_electricity=("EKEDC", "https://www.eaborpower.com/tenders"),
        national_railway=("Nigerian Railway Corporation", "https://www.nrc.gov.ng/tenders"),
        national_postal=("NIPOST", "https://www.nipost.gov.ng/tenders"),
        ports=[
            ("Nigerian Ports Authority", "https://www.nigerianports.gov.ng/tenders"),
        ],
        airports=[
            ("FAAN", "https://www.faan.gov.ng/tenders"),
        ],
        central_bank=("Central Bank of Nigeria", "https://www.cbn.gov.ng/procurement"),
        universities=[
            ("University of Lagos", "https://www.unilag.edu.ng/tenders"),
            ("University of Ibadan", "https://www.ui.edu.ng/tenders"),
            ("Ahmadu Bello University", "https://www.abu.edu.ng/tenders"),
            ("University of Nigeria Nsukka", "https://www.unn.edu.ng/tenders"),
            ("Obafemi Awolowo University", "https://www.oauife.edu.ng/tenders"),
        ],
        telecom_regulator=("NCC", "https://ncc.gov.ng/tenders"),
        statistics_office=("NBS Nigeria", "https://nigerianstat.gov.ng/tenders"),
        estimated_national_tenders="10000-30000",
        notes="Largest economy in Africa, highly decentralized procurement"
    ),

    "GHA": CountryData(
        code="GHA",
        name="Ghana",
        primary_language="English",
        currency_code="GHS",
        tld="gh",
        national_portal_name="Ghana PPA",
        national_portal_url="https://www.ppaghana.org",
        admin_division_type="Region",
        admin_divisions=[
            "Greater Accra", "Ashanti", "Western", "Eastern", "Central",
            "Northern", "Volta", "Upper East", "Upper West", "Brong Ahafo",
            "North East", "Savannah", "Bono East", "Ahafo", "Western North", "Oti"
        ],
        national_oil_company=("GNPC", "https://www.gnpcghana.com/tenders"),
        national_electricity=("ECG Ghana", "https://www.ecggh.com/tenders"),
        national_water=("GWCL", "https://www.gwcl.com.gh/tenders"),
        national_railway=("Ghana Railway Company", "https://www.grda.gov.gh/tenders"),
        ports=[
            ("Ghana Ports and Harbours Authority", "https://www.ghanaports.gov.gh/tenders"),
        ],
        airports=[
            ("Ghana Civil Aviation Authority", "https://www.gcaa.com.gh/tenders"),
        ],
        central_bank=("Bank of Ghana", "https://www.bog.gov.gh/tenders"),
        universities=[
            ("University of Ghana", "https://www.ug.edu.gh/tenders"),
            ("KNUST", "https://www.knust.edu.gh/tenders"),
            ("University of Cape Coast", "https://www.ucc.edu.gh/tenders"),
        ],
        teaching_hospitals=[
            ("Korle Bu Teaching Hospital", "https://www.kbth.gov.gh/tenders"),
        ],
        telecom_regulator=("NCA Ghana", "https://www.nca.org.gh/tenders"),
        statistics_office=("Ghana Statistical Service", "https://www.statsghana.gov.gh/tenders"),
        estimated_national_tenders="3000-8000",
        has_api=True,
    ),

    "SEN": CountryData(
        code="SEN",
        name="Senegal",
        primary_language="French",
        currency_code="XOF",
        tld="sn",
        national_portal_name="Marchés Publics du Sénégal",
        national_portal_url="https://www.marchespublics.sn",
        admin_division_type="Region",
        admin_divisions=[
            "Dakar", "Thiès", "Saint-Louis", "Diourbel", "Kaolack",
            "Fatick", "Louga", "Matam", "Tambacounda", "Kédougou",
            "Kolda", "Ziguinchor", "Sédhiou", "Kaffrine"
        ],
        national_electricity=("SENELEC", "https://www.senelec.sn/tenders"),
        national_water=("SDE", "https://www.sde.sn/tenders"),
        ports=[
            ("Port Autonome de Dakar", "https://www.portdakar.sn/tenders"),
        ],
        central_bank=("BCEAO Senegal", "https://www.bceao.int/tenders"),
        universities=[
            ("Université Cheikh Anta Diop", "https://www.ucad.sn/tenders"),
        ],
        estimated_national_tenders="1500-4000",
    ),

    "CIV": CountryData(
        code="CIV",
        name="Côte d'Ivoire",
        primary_language="French",
        currency_code="XOF",
        tld="ci",
        national_portal_name="Marchés Publics de Côte d'Ivoire",
        national_portal_url="https://www.marchespublics-uemoa.net/ci",
        admin_division_type="Region",
        admin_divisions=[
            "Abidjan", "Yamoussoukro", "Bouaké", "San Pedro", "Korhogo",
            "Daloa", "Man", "Gagnoa", "Divo", "Séguéla"
        ],
        national_oil_company=("PETROCI", "https://www.petroci.ci/tenders"),
        national_electricity=("CIE", "https://www.cie.ci/tenders"),
        ports=[
            ("Port Autonome d'Abidjan", "https://www.portabidjan.ci/tenders"),
        ],
        universities=[
            ("Université Félix Houphouët-Boigny", "https://www.univ-fhb.ci/tenders"),
        ],
        estimated_national_tenders="2000-5000",
    ),
}


# =============================================================================
# SOUTHERN AFRICA
# =============================================================================

SOUTHERN_AFRICA: Dict[str, CountryData] = {
    "ZAF": CountryData(
        code="ZAF",
        name="South Africa",
        primary_language="English",
        secondary_languages=["Afrikaans", "Zulu", "Xhosa"],
        currency_code="ZAR",
        tld="za",
        national_portal_name="eTenders South Africa",
        national_portal_url="https://etenders.gov.za",
        admin_division_type="Province",
        admin_divisions=[
            "Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape",
            "Free State", "Mpumalanga", "Limpopo", "North West", "Northern Cape"
        ],
        major_cities=[
            "Johannesburg", "Cape Town", "Durban", "Pretoria",
            "Port Elizabeth", "Bloemfontein", "East London", "Polokwane"
        ],
        national_electricity=("Eskom", "https://www.eskom.co.za/tenders"),
        national_water=("Rand Water", "https://www.randwater.co.za/tenders"),
        national_railway=("PRASA", "https://www.prasa.com/tenders"),
        national_airline=("SAA", "https://www.flysaa.com/tenders"),
        national_postal=("South African Post Office", "https://www.postoffice.co.za/tenders"),
        ports=[
            ("Transnet National Ports Authority", "https://www.transnetnationalportsauthority.net/tenders"),
        ],
        airports=[
            ("ACSA", "https://www.airports.co.za/tenders"),
        ],
        central_bank=("South African Reserve Bank", "https://www.resbank.co.za/tenders"),
        universities=[
            ("University of Cape Town", "https://www.uct.ac.za/tenders"),
            ("University of Witwatersrand", "https://www.wits.ac.za/tenders"),
            ("Stellenbosch University", "https://www.sun.ac.za/tenders"),
            ("University of Pretoria", "https://www.up.ac.za/tenders"),
            ("University of KwaZulu-Natal", "https://www.ukzn.ac.za/tenders"),
            ("University of Johannesburg", "https://www.uj.ac.za/tenders"),
        ],
        teaching_hospitals=[
            ("Chris Hani Baragwanath Hospital", "https://www.chbah.gauteng.gov.za/tenders"),
            ("Groote Schuur Hospital", "https://www.gsh.westerncape.gov.za/tenders"),
        ],
        telecom_regulator=("ICASA", "https://www.icasa.org.za/tenders"),
        statistics_office=("Statistics South Africa", "https://www.statssa.gov.za/tenders"),
        estimated_national_tenders="15000-40000",
        has_api=True,
        notes="Most developed procurement system in Africa"
    ),

    "ZMB": CountryData(
        code="ZMB",
        name="Zambia",
        primary_language="English",
        currency_code="ZMW",
        tld="zm",
        national_portal_name="Zambia ZPPA",
        national_portal_url="https://www.zppa.org.zm",
        admin_division_type="Province",
        admin_divisions=[
            "Lusaka", "Copperbelt", "Southern", "Eastern", "Northern",
            "Central", "Western", "North-Western", "Luapula", "Muchinga"
        ],
        national_electricity=("ZESCO", "https://www.zesco.co.zm/tenders"),
        national_water=("LWSC", "https://www.lwsc.com.zm/tenders"),
        national_railway=("Zambia Railways", "https://www.zrl.com.zm/tenders"),
        central_bank=("Bank of Zambia", "https://www.boz.zm/tenders"),
        universities=[
            ("University of Zambia", "https://www.unza.zm/tenders"),
            ("Copperbelt University", "https://www.cbu.ac.zm/tenders"),
        ],
        telecom_regulator=("ZICTA", "https://www.zicta.zm/tenders"),
        estimated_national_tenders="2000-5000",
    ),
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_all_countries() -> Dict[str, CountryData]:
    """Return all country configurations merged into a single dictionary."""
    all_countries = {}
    all_countries.update(EAST_AFRICA)
    all_countries.update(WEST_AFRICA)
    all_countries.update(SOUTHERN_AFRICA)
    # Add other regions as they are defined
    return all_countries


def get_countries_by_region(region: str) -> Dict[str, CountryData]:
    """Get countries for a specific region."""
    region_map = {
        "east_africa": EAST_AFRICA,
        "west_africa": WEST_AFRICA,
        "southern_africa": SOUTHERN_AFRICA,
    }
    return region_map.get(region.lower(), {})


def export_to_json(output_path: str) -> None:
    """Export all country configurations to JSON for external editing."""
    import json
    from dataclasses import asdict

    all_countries = get_all_countries()
    data = {code: asdict(country) for code, country in all_countries.items()}

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Exported {len(data)} country configurations to {output_path}")


if __name__ == "__main__":
    # Print summary of available configurations
    all_countries = get_all_countries()
    print(f"Total country configurations available: {len(all_countries)}")

    for region_name, region_dict in [
        ("East Africa", EAST_AFRICA),
        ("West Africa", WEST_AFRICA),
        ("Southern Africa", SOUTHERN_AFRICA),
    ]:
        print(f"\n{region_name}:")
        for code, country in region_dict.items():
            divisions = len(country.admin_divisions)
            print(f"  {code}: {country.name} ({divisions} {country.admin_division_type}s)")
