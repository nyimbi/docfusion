# Tender Intelligence Database Builder

A comprehensive automation framework for building tender/procurement source databases focused on the Global South. This system generates databases of **primary sources** (actual government e-procurement portals, MDB platforms, UN agencies) and explicitly excludes commercial aggregators.

## Overview

The framework consists of:

1. **`tender_database_builder.py`** - Core engine with data classes, templates, and builders
2. **`country_configs.py`** - Extensible country configuration data
3. **`extensions.py`** - Additional tools for validation, enrichment, and reporting

## Quick Start

```bash
# Install dependencies
pip install openpyxl

# Generate database with default regions (Africa + International)
python tender_database_builder.py --output tender_database.xlsx

# Generate with specific regions
python tender_database_builder.py --regions africa international --output global_tenders.xlsx

# Export to JSON instead of Excel
python tender_database_builder.py --output tender_database.json
```

## Architecture

### Core Components

#### TenderEntry (Data Class)
The fundamental unit representing a single procurement source:

```python
TenderEntry(
    source_name="Kenya Power & Lighting Company",
    url="https://www.kplc.co.ke/tenders",
    country_code="KEN",
    country_name="Kenya",
    entity_type="Utility",
    entity_subtype="Electricity Utility",
    sectors=["Energy", "Electricity"],
    language="English",
    update_frequency="Weekly",
    registration_required=True,
    estimated_annual_tenders="100-500",
    technical_notes="National electricity utility procurement"
)
```

#### CountryConfig (Configuration)
Comprehensive country definition for automatic entry generation:

```python
CountryConfig(
    code="KEN",
    name="Kenya",
    primary_language="English",
    national_portal_url="https://supplier.treasury.go.ke",
    admin_divisions=["Nairobi", "Mombasa", ...],  # 47 counties
    national_electricity=("KPLC", "https://www.kplc.co.ke/tenders"),
    national_water=("Nairobi Water", "https://www.nairobiwater.co.ke/tenders"),
    ...
)
```

#### EntityTemplates (Factory Methods)
Standardized templates for common entity types:

- `national_eproc_portal()` - National e-procurement systems
- `subnational_government()` - States, provinces, counties
- `utility_company()` - Electricity, water, telecom
- `national_oil_company()` - NOCs
- `port_authority()` - Maritime infrastructure
- `university()` - Higher education
- `mdb()` - Multilateral Development Banks
- `un_agency()` - UN system agencies

#### RegionBuilder (Abstract Base Class)
Generates entries for geographic regions. Implemented builders:

- `AfricaBuilder` - All 54 African countries + sub-national
- `InternationalBuilder` - MDBs, UN, bilateral agencies

### Extension Modules

#### ConfigLoader
Load configurations from external files:

```python
# Load from CSV
countries = ConfigLoader.load_csv_countries("my_countries.csv")
entities = ConfigLoader.load_csv_entities("my_entities.csv")

# Generate template files
ConfigLoader.save_template_csv("template.csv", "countries")
```

#### URLValidator
Validate URLs and detect aggregators:

```python
# Check single URL
is_valid = URLValidator.is_valid_url_format(url)
is_primary, reason = URLValidator.is_primary_source(url)
accessible, code, msg = URLValidator.check_url_accessible(url)

# Batch validation
results = URLValidator.validate_batch(url_list, check_http=True)
```

#### DataEnricher
Enrich entries with inferred metadata:

```python
country_name = DataEnricher.get_country_name("KEN")  # "Kenya"
language = DataEnricher.get_language("KEN")  # "English"
entity_type, subtype = DataEnricher.infer_entity_type(name, url)
sectors = DataEnricher.infer_sectors(name, entity_type)
```

## Adding New Countries

### Method 1: Add to country_configs.py

```python
# In country_configs.py, add to appropriate regional dictionary:

EAST_AFRICA["DJI"] = CountryData(
    code="DJI",
    name="Djibouti",
    primary_language="French",
    secondary_languages=["Arabic"],
    national_portal_url="https://procurement.gouv.dj",
    admin_divisions=["Djibouti City", "Ali Sabieh", "Dikhil"],
    # ... add SOEs, utilities, etc.
)
```

### Method 2: Load from CSV

Create a CSV file:
```csv
code,name,region,language,portal_url,portal_name
DJI,Djibouti,East Africa,French,https://procurement.gouv.dj,Djibouti E-Procurement
```

Load and process:
```python
from extensions import ConfigLoader
countries = ConfigLoader.load_csv_countries("new_countries.csv")
```

### Method 3: Direct Entry Creation

```python
from tender_database_builder import TenderEntry, DatabaseCompiler

entry = TenderEntry(
    source_name="Djibouti E-Procurement Portal",
    url="https://procurement.gouv.dj",
    country_code="DJI",
    country_name="Djibouti",
    entity_type="National Government",
    entity_subtype="Central E-Procurement",
    sectors=["General", "Infrastructure"],
    language="French"
)

compiler = DatabaseCompiler()
compiler.entries.append(entry)
compiler.save_excel("output.xlsx")
```

## Creating Custom Builders

```python
from tender_database_builder import RegionBuilder, TenderEntry, EntityTemplates

class LatinAmericaBuilder(RegionBuilder):
    """Builder for Latin American countries."""

    COUNTRIES = {
        "BRA": {...},
        "MEX": {...},
        # ...
    }

    def build(self):
        for code, config in self.COUNTRIES.items():
            # Add national portal
            self.add_entry(EntityTemplates.national_eproc_portal(config))

            # Add sub-national governments
            for state in config.admin_divisions:
                self.add_entry(EntityTemplates.subnational_government(config, state))

            # Add SOEs
            if config.national_oil_company:
                name, url = config.national_oil_company
                self.add_entry(EntityTemplates.national_oil_company(config, name, url))

        return self.entries
```

## Entity Types Covered

| Entity Type | Examples |
|------------|----------|
| National Government | E-procurement portals, ministries |
| Sub-national Government | States, provinces, counties, municipalities |
| State-Owned Enterprise | Oil companies, airlines, postal services |
| Utility | Electricity, water, gas, telecom |
| Multilateral Development Bank | World Bank, AfDB, ADB, IDB |
| UN Agency | UNDP, UNICEF, WFP, WHO |
| Bilateral Agency | USAID, GIZ, JICA, AFD |
| Port Authority | National port authorities |
| Airport Authority | Civil aviation authorities |
| Railway Corporation | National railways |
| Central Bank | Reserve banks |
| University | Major public universities |
| Hospital | Teaching hospitals |

## Validation & Quality Control

### Aggregator Detection
The system automatically flags known aggregator domains:
- tenderinfo.com, tendersinfo.com
- globaltenders.com, bidprime.com
- dgmarket.com, etc.

### URL Validation
```python
from extensions import URLValidator, ReportGenerator

# Validate all URLs in database
results = URLValidator.validate_batch(
    [entry['url'] for entry in entries],
    check_http=True
)

# Generate validation report
report = ReportGenerator.generate_validation_report(results)
print(report)
```

### Data Quality Checks
- Valid URL format
- ISO 3166-1 alpha-3 country codes
- Non-empty source names
- Primary source verification

## Output Formats

### Excel (.xlsx)
- **Tender Sources** sheet - All entries with full metadata
- **Summary** sheet - Statistics by entity type, country, region

### JSON
- Array of entry objects
- UTF-8 encoded
- Human-readable indentation

## File Structure

```
tender_db_automation/
├── tender_database_builder.py   # Core engine
├── country_configs.py           # Country configurations
├── extensions.py                # Validation, enrichment, reporting
├── README.md                    # This file
└── templates/
    ├── countries_template.csv   # Template for adding countries
    └── entities_template.csv    # Template for adding entities
```

## Dependencies

**Required:**
- Python 3.8+
- openpyxl (Excel output)

**Optional:**
- requests (URL validation)
- beautifulsoup4 (Web discovery)

## License

MIT License - Free for commercial and non-commercial use.

## Contributing

To add new countries or regions:
1. Fork the repository
2. Add configurations to `country_configs.py`
3. Create new builders in `tender_database_builder.py`
4. Submit pull request with test data

## Support

For questions or issues, please open a GitHub issue or contact the maintainers.
