#!/usr/bin/env python3
"""
Tender Database Builder - Runner Script
=========================================
Demonstrates the complete workflow for building a tender database.

Usage:
    python run_builder.py                    # Build with defaults
    python run_builder.py --full             # Build comprehensive database
    python run_builder.py --validate         # Build and validate URLs
    python run_builder.py --report           # Generate summary report

Author: Tender Intelligence System
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from tender_database_builder import (
    TenderEntry, DatabaseCompiler, AfricaBuilder, InternationalBuilder,
    EntityTemplates, EntityType, SECTORS
)
from country_configs import EAST_AFRICA, WEST_AFRICA, SOUTHERN_AFRICA, CountryData
from extensions import URLValidator, ReportGenerator, DataEnricher


def build_basic_database(output_path: str = "tender_database.xlsx") -> int:
    """Build a basic database with Africa and international organizations."""
    print("=" * 60)
    print("TENDER DATABASE BUILDER - BASIC BUILD")
    print("=" * 60)

    compiler = DatabaseCompiler()

    # Add regional builders
    compiler.add_builder(AfricaBuilder())
    compiler.add_builder(InternationalBuilder())

    # Build all entries
    compiler.build_all()

    # Save output
    if output_path.endswith('.json'):
        compiler.save_json(output_path)
    else:
        compiler.save_excel(output_path)

    print(f"\nDatabase built successfully!")
    print(f"Total entries: {len(compiler.entries)}")
    print(f"Output file: {output_path}")

    return len(compiler.entries)


def build_comprehensive_database(output_path: str = "comprehensive_tender_database.xlsx") -> int:
    """
    Build a comprehensive database demonstrating all features.

    This shows how to:
    1. Use built-in builders for standard regions
    2. Add custom entries for specific entities
    3. Use templates for consistent entry creation
    4. Handle multiple data sources
    """
    print("=" * 60)
    print("TENDER DATABASE BUILDER - COMPREHENSIVE BUILD")
    print("=" * 60)

    compiler = DatabaseCompiler()

    # 1. Use built-in builders
    print("\n[1/4] Building Africa region...")
    compiler.add_builder(AfricaBuilder())

    print("[2/4] Building international organizations...")
    compiler.add_builder(InternationalBuilder())

    # Build standard entries
    compiler.build_all()
    print(f"      Standard entries: {len(compiler.entries)}")

    # 2. Add custom entries using templates
    print("\n[3/4] Adding custom entries...")

    # Example: Add a specific MDB project
    custom_mdb = EntityTemplates.mdb(
        name="Green Climate Fund",
        url="https://www.greenclimate.fund/procurement",
        coverage="Global (Climate Focus)",
        focus_sectors=["Environment", "Climate", "Energy", "Consulting"]
    )
    compiler.entries.append(custom_mdb)

    # Example: Add a humanitarian organization
    humanitarian_org = TenderEntry(
        source_name="ICRC - International Committee of the Red Cross",
        url="https://www.icrc.org/en/procurement",
        country_code="INT",
        country_name="International",
        entity_type="NGO",
        entity_subtype="Humanitarian Organization",
        sectors=["Humanitarian", "Health", "Logistics", "WASH"],
        language="English",
        update_frequency="Weekly",
        registration_required=True,
        estimated_annual_tenders="200-500",
        technical_notes="Major humanitarian organization procurement"
    )
    compiler.entries.append(humanitarian_org)

    # 3. Add entries from country configurations directly
    for code, config in EAST_AFRICA.items():
        # Add any teaching hospitals not covered by builder
        for name, url in config.teaching_hospitals:
            hospital = TenderEntry(
                source_name=name,
                url=url,
                country_code=code,
                country_name=config.name,
                entity_type="Hospital",
                entity_subtype="Teaching Hospital",
                sectors=["Health", "Medical Equipment", "Pharmaceuticals"],
                language=config.primary_language,
                update_frequency="Weekly",
                registration_required=True,
                estimated_annual_tenders="50-200",
                technical_notes=f"Teaching hospital procurement - {config.name}"
            )
            compiler.entries.append(hospital)

    print(f"      Custom entries added: {len(compiler.entries)}")

    # 4. Save output
    print("\n[4/4] Saving database...")
    if output_path.endswith('.json'):
        compiler.save_json(output_path)
    else:
        compiler.save_excel(output_path)

    print(f"\nDatabase built successfully!")
    print(f"Total entries: {len(compiler.entries)}")
    print(f"Output file: {output_path}")

    return len(compiler.entries)


def validate_database(input_path: str) -> None:
    """Validate URLs in an existing database."""
    print("=" * 60)
    print("URL VALIDATION")
    print("=" * 60)

    # Load database
    with open(input_path, 'r') as f:
        entries = json.load(f)

    urls = [entry.get('url', '') for entry in entries if entry.get('url')]
    print(f"\nValidating {len(urls)} URLs...")

    # Progress callback
    def progress(current, total):
        pct = current / total * 100
        print(f"\r  Progress: {current}/{total} ({pct:.1f}%)", end='', flush=True)

    # Validate
    results = URLValidator.validate_batch(urls, check_http=False, progress_callback=progress)
    print()

    # Generate report
    report = ReportGenerator.generate_validation_report(results)
    print(report)

    # Save report
    report_path = input_path.replace('.json', '_validation_report.txt')
    with open(report_path, 'w') as f:
        f.write(report)
    print(f"\nReport saved to: {report_path}")


def generate_summary_report(input_path: str) -> None:
    """Generate a summary report from an existing database."""
    print("=" * 60)
    print("DATABASE SUMMARY REPORT")
    print("=" * 60)

    # Load database
    if input_path.endswith('.json'):
        with open(input_path, 'r') as f:
            entries = json.load(f)
    else:
        # For Excel, we'd need to read it differently
        print("Note: For Excel files, please convert to JSON first")
        return

    # Generate report
    report = ReportGenerator.generate_summary_report(entries)
    print(report)

    # Save report
    report_path = input_path.replace('.json', '_summary_report.txt')
    with open(report_path, 'w') as f:
        f.write(report)
    print(f"\nReport saved to: {report_path}")


def demo_entry_creation():
    """Demonstrate various ways to create entries."""
    print("=" * 60)
    print("ENTRY CREATION DEMONSTRATION")
    print("=" * 60)

    # Method 1: Direct TenderEntry creation
    print("\n1. Direct TenderEntry creation:")
    entry1 = TenderEntry(
        source_name="Sample Ministry of Finance",
        url="https://mof.example.gov/procurement",
        country_code="XYZ",
        country_name="Sample Country",
        entity_type="National Government",
        entity_subtype="Ministry",
        sectors=["General", "Finance", "ICT"],
        language="English"
    )
    print(f"   Created: {entry1.source_name}")

    # Method 2: Using EntityTemplates
    print("\n2. Using EntityTemplates:")

    # Create a mock country config
    sample_country = CountryData(
        code="XYZ",
        name="Sample Country",
        primary_language="English",
        national_portal_url="https://procurement.xyz.gov"
    )

    entry2 = EntityTemplates.national_eproc_portal(sample_country)
    print(f"   Created: {entry2.source_name}")

    entry3 = EntityTemplates.utility_company(
        sample_country,
        "Sample Power Company",
        "electricity",
        "https://power.xyz.gov/tenders"
    )
    print(f"   Created: {entry3.source_name}")

    # Method 3: Using DataEnricher for inference
    print("\n3. Using DataEnricher for metadata inference:")

    # Infer entity type from name
    entity_type, subtype = DataEnricher.infer_entity_type(
        "Kenya Power & Lighting Company",
        "https://www.kplc.co.ke/tenders"
    )
    print(f"   Inferred type: {entity_type} / {subtype}")

    # Infer sectors
    sectors = DataEnricher.infer_sectors("Kenya Power & Lighting Company", entity_type)
    print(f"   Inferred sectors: {sectors}")

    # Get country info
    country_name = DataEnricher.get_country_name("KEN")
    language = DataEnricher.get_language("KEN")
    print(f"   Country: {country_name}, Language: {language}")

    print("\n" + "=" * 60)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Tender Database Builder - Automated procurement source database generation"
    )
    parser.add_argument(
        "--full", action="store_true",
        help="Build comprehensive database with all features"
    )
    parser.add_argument(
        "--validate", type=str, metavar="JSON_FILE",
        help="Validate URLs in existing JSON database"
    )
    parser.add_argument(
        "--report", type=str, metavar="JSON_FILE",
        help="Generate summary report from JSON database"
    )
    parser.add_argument(
        "--demo", action="store_true",
        help="Demonstrate entry creation methods"
    )
    parser.add_argument(
        "--output", "-o", type=str, default="tender_database.xlsx",
        help="Output file path (default: tender_database.xlsx)"
    )

    args = parser.parse_args()

    if args.demo:
        demo_entry_creation()
    elif args.validate:
        validate_database(args.validate)
    elif args.report:
        generate_summary_report(args.report)
    elif args.full:
        build_comprehensive_database(args.output)
    else:
        build_basic_database(args.output)


if __name__ == "__main__":
    main()
