#!/usr/bin/env python3
"""
Extension Modules for Tender Database Builder
===============================================
Additional functionality for extending and validating the database.

Modules:
- ConfigLoader: Load country configurations from JSON/CSV files
- URLValidator: Validate URLs and check if they are accessible
- WebDiscovery: Discover procurement portals through web scraping
- DataEnricher: Enrich entries with additional metadata
- ReportGenerator: Generate analysis reports

Dependencies:
- requests (optional, for URL validation)
- beautifulsoup4 (optional, for web discovery)
"""

import json
import csv
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable, Tuple
from urllib.parse import urlparse, urljoin
import re
import time

logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION LOADER
# =============================================================================

class ConfigLoader:
    """
    Load country and entity configurations from external files.

    Supports JSON and CSV formats for easy editing and collaboration.
    """

    @staticmethod
    def load_json(filepath: str) -> Dict[str, Any]:
        """Load configuration from JSON file."""
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    @staticmethod
    def load_csv_countries(filepath: str) -> List[Dict[str, Any]]:
        """
        Load country list from CSV file.

        Expected columns: code, name, region, language, portal_url, portal_name
        """
        countries = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                countries.append({
                    'code': row.get('code', '').strip().upper(),
                    'name': row.get('name', '').strip(),
                    'region': row.get('region', '').strip(),
                    'primary_language': row.get('language', 'English').strip(),
                    'national_portal_url': row.get('portal_url', '').strip(),
                    'national_portal_name': row.get('portal_name', '').strip(),
                })
        return countries

    @staticmethod
    def load_csv_entities(filepath: str) -> List[Dict[str, Any]]:
        """
        Load entity list from CSV file.

        Expected columns: name, url, country_code, entity_type, sectors, language
        """
        entities = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                sectors = [s.strip() for s in row.get('sectors', '').split(',') if s.strip()]
                entities.append({
                    'source_name': row.get('name', '').strip(),
                    'url': row.get('url', '').strip(),
                    'country_code': row.get('country_code', '').strip().upper(),
                    'entity_type': row.get('entity_type', 'Government').strip(),
                    'sectors': sectors or ['General'],
                    'language': row.get('language', 'English').strip(),
                })
        return entities

    @staticmethod
    def save_template_csv(filepath: str, template_type: str = 'countries') -> None:
        """Generate a template CSV file for data entry."""
        if template_type == 'countries':
            headers = ['code', 'name', 'region', 'language', 'portal_url', 'portal_name']
            sample = ['ABC', 'Sample Country', 'Africa', 'English',
                     'https://procurement.sample.gov', 'Sample E-Procurement Portal']
        else:
            headers = ['name', 'url', 'country_code', 'entity_type', 'sectors', 'language']
            sample = ['Sample Ministry', 'https://ministry.gov/tenders', 'ABC',
                     'National Government', 'General,Infrastructure', 'English']

        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerow(sample)

        print(f"Template saved to {filepath}")


# =============================================================================
# URL VALIDATOR
# =============================================================================

class URLValidator:
    """
    Validate URLs and check accessibility.

    Note: Requires 'requests' library for HTTP checks.
    """

    # Known aggregator domains to exclude
    AGGREGATOR_DOMAINS = {
        'tenderinfo.com', 'tendersinfo.com', 'globaltenders.com',
        'bidprime.com', 'tenderspage.com', 'tendersboard.com',
        'dgmarket.com', 'tendersontime.com', 'tendersmarket.com',
        'bizcommunity.com', 'tenderlink.com', 'tendersgo.com',
        'allafricatenders.com', 'tendertigers.com',
    }

    @classmethod
    def is_valid_url_format(cls, url: str) -> bool:
        """Check if URL has valid format."""
        try:
            result = urlparse(url)
            return all([result.scheme in ('http', 'https'), result.netloc])
        except Exception:
            return False

    @classmethod
    def is_primary_source(cls, url: str) -> Tuple[bool, str]:
        """
        Check if URL is a primary source (not an aggregator).

        Returns: (is_primary, reason)
        """
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()

            # Remove www prefix
            if domain.startswith('www.'):
                domain = domain[4:]

            # Check against known aggregators
            for aggregator in cls.AGGREGATOR_DOMAINS:
                if aggregator in domain:
                    return False, f"Matches known aggregator: {aggregator}"

            # Heuristic checks for primary government sources
            gov_indicators = ['.gov.', '.go.', '.gob.', '.gouv.', '.govt.']
            if any(ind in domain for ind in gov_indicators):
                return True, "Government domain detected"

            # Check for common SOE/utility patterns
            utility_indicators = ['power', 'electricity', 'water', 'telecom', 'rail',
                                 'port', 'airport', 'bank', 'university']
            if any(ind in domain for ind in utility_indicators):
                return True, "Utility/SOE domain detected"

            return True, "No aggregator patterns detected"

        except Exception as e:
            return False, f"URL parsing error: {str(e)}"

    @classmethod
    def check_url_accessible(cls, url: str, timeout: int = 10) -> Tuple[bool, int, str]:
        """
        Check if URL is accessible via HTTP.

        Returns: (is_accessible, status_code, message)
        """
        try:
            import requests
        except ImportError:
            return True, 0, "requests library not installed - skipping HTTP check"

        try:
            response = requests.head(url, timeout=timeout, allow_redirects=True)
            return response.status_code < 400, response.status_code, response.reason
        except requests.exceptions.Timeout:
            return False, 0, "Request timed out"
        except requests.exceptions.ConnectionError:
            return False, 0, "Connection error"
        except Exception as e:
            return False, 0, str(e)

    @classmethod
    def validate_batch(
        cls,
        urls: List[str],
        check_http: bool = False,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Validate multiple URLs.

        Returns dict mapping URL to validation results.
        """
        results = {}
        total = len(urls)

        for i, url in enumerate(urls):
            result = {
                'valid_format': cls.is_valid_url_format(url),
                'is_primary': True,
                'primary_reason': '',
                'accessible': None,
                'status_code': None,
            }

            if result['valid_format']:
                is_primary, reason = cls.is_primary_source(url)
                result['is_primary'] = is_primary
                result['primary_reason'] = reason

                if check_http:
                    accessible, code, msg = cls.check_url_accessible(url)
                    result['accessible'] = accessible
                    result['status_code'] = code
                    result['http_message'] = msg

            results[url] = result

            if progress_callback:
                progress_callback(i + 1, total)

        return results


# =============================================================================
# WEB DISCOVERY (Optional)
# =============================================================================

class WebDiscovery:
    """
    Discover procurement portals through web scraping.

    This class provides methods to find procurement URLs by:
    1. Searching for common procurement paths on government domains
    2. Parsing search engine results
    3. Following links on known portals

    Note: Requires 'requests' and 'beautifulsoup4' libraries.
    """

    # Common procurement-related URL paths
    PROCUREMENT_PATHS = [
        '/procurement', '/tenders', '/tender', '/bids', '/rfp',
        '/contratos', '/licitaciones', '/contrataciones',
        '/marches', '/marches-publics', '/appels-offres',
        '/acquisicoes', '/compras', '/concursos',
        '/supply', '/purchasing', '/vendor',
        '/eprocurement', '/e-procurement', '/eproc',
    ]

    # Keywords that suggest procurement pages
    PROCUREMENT_KEYWORDS = [
        'tender', 'procurement', 'bid', 'rfp', 'rfq', 'eoi',
        'licitacion', 'contrato', 'marche', 'appel',
        '供应商', 'مناقصة', '入札',
    ]

    @classmethod
    def probe_procurement_urls(
        cls,
        base_domain: str,
        timeout: int = 10
    ) -> List[Tuple[str, bool]]:
        """
        Probe common procurement paths on a domain.

        Returns list of (url, accessible) tuples.
        """
        try:
            import requests
        except ImportError:
            logger.warning("requests library not installed")
            return []

        results = []
        base_url = f"https://{base_domain}" if not base_domain.startswith('http') else base_domain

        for path in cls.PROCUREMENT_PATHS:
            url = urljoin(base_url, path)
            try:
                response = requests.head(url, timeout=timeout, allow_redirects=True)
                accessible = response.status_code < 400
                results.append((url, accessible))
            except Exception:
                results.append((url, False))

        return results

    @classmethod
    def extract_tender_links(cls, html: str, base_url: str) -> List[str]:
        """
        Extract potential tender/procurement links from HTML content.
        """
        try:
            from bs4 import BeautifulSoup
        except ImportError:
            logger.warning("beautifulsoup4 not installed")
            return []

        soup = BeautifulSoup(html, 'html.parser')
        links = []

        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            text = a_tag.get_text().lower()

            # Check if link text or href contains procurement keywords
            is_procurement = any(kw in text or kw in href.lower()
                               for kw in cls.PROCUREMENT_KEYWORDS)

            if is_procurement:
                # Make absolute URL
                absolute_url = urljoin(base_url, href)
                if absolute_url not in links:
                    links.append(absolute_url)

        return links


# =============================================================================
# DATA ENRICHER
# =============================================================================

class DataEnricher:
    """
    Enrich tender entries with additional metadata.
    """

    # ISO 3166-1 alpha-3 to country name mapping
    COUNTRY_NAMES = {
        'KEN': 'Kenya', 'TZA': 'Tanzania', 'UGA': 'Uganda', 'ETH': 'Ethiopia',
        'RWA': 'Rwanda', 'BDI': 'Burundi', 'SSD': 'South Sudan', 'SOM': 'Somalia',
        'NGA': 'Nigeria', 'GHA': 'Ghana', 'SEN': 'Senegal', 'CIV': "Côte d'Ivoire",
        'MLI': 'Mali', 'BFA': 'Burkina Faso', 'NER': 'Niger', 'BEN': 'Benin',
        'TGO': 'Togo', 'GIN': 'Guinea', 'SLE': 'Sierra Leone', 'LBR': 'Liberia',
        'GMB': 'Gambia', 'GNB': 'Guinea-Bissau', 'CPV': 'Cabo Verde',
        'ZAF': 'South Africa', 'ZMB': 'Zambia', 'ZWE': 'Zimbabwe', 'BWA': 'Botswana',
        'NAM': 'Namibia', 'MOZ': 'Mozambique', 'MWI': 'Malawi', 'AGO': 'Angola',
        'LSO': 'Lesotho', 'SWZ': 'Eswatini', 'MUS': 'Mauritius', 'MDG': 'Madagascar',
        'EGY': 'Egypt', 'MAR': 'Morocco', 'TUN': 'Tunisia', 'DZA': 'Algeria',
        'LBY': 'Libya', 'SDN': 'Sudan',
        'BRA': 'Brazil', 'MEX': 'Mexico', 'ARG': 'Argentina', 'COL': 'Colombia',
        'PER': 'Peru', 'CHL': 'Chile', 'ECU': 'Ecuador', 'BOL': 'Bolivia',
        'PRY': 'Paraguay', 'URY': 'Uruguay', 'VEN': 'Venezuela',
        'IND': 'India', 'PAK': 'Pakistan', 'BGD': 'Bangladesh', 'LKA': 'Sri Lanka',
        'NPL': 'Nepal', 'AFG': 'Afghanistan', 'BTN': 'Bhutan', 'MDV': 'Maldives',
        'IDN': 'Indonesia', 'PHL': 'Philippines', 'VNM': 'Vietnam', 'THA': 'Thailand',
        'MYS': 'Malaysia', 'SGP': 'Singapore', 'MMR': 'Myanmar', 'KHM': 'Cambodia',
        'LAO': 'Laos', 'PNG': 'Papua New Guinea', 'FJI': 'Fiji',
        'IRQ': 'Iraq', 'JOR': 'Jordan', 'LBN': 'Lebanon', 'PSE': 'Palestine',
        'YEM': 'Yemen', 'IRN': 'Iran',
        'INT': 'International', 'UN': 'United Nations', 'Regional': 'Regional',
    }

    # Language detection by country
    COUNTRY_LANGUAGES = {
        # English-speaking
        'KEN': 'English', 'TZA': 'Swahili', 'UGA': 'English', 'GHA': 'English',
        'NGA': 'English', 'ZAF': 'English', 'ZMB': 'English', 'ZWE': 'English',
        'BWA': 'English', 'NAM': 'English', 'MWI': 'English', 'IND': 'English',
        'PAK': 'English', 'BGD': 'Bengali', 'LKA': 'English', 'PHL': 'English',
        'MYS': 'English', 'SGP': 'English', 'PNG': 'English', 'FJI': 'English',
        # French-speaking
        'SEN': 'French', 'CIV': 'French', 'MLI': 'French', 'BFA': 'French',
        'NER': 'French', 'BEN': 'French', 'TGO': 'French', 'GIN': 'French',
        'TUN': 'French', 'MAR': 'French', 'DZA': 'French', 'CMR': 'French',
        'COD': 'French', 'COG': 'French', 'GAB': 'French', 'CAF': 'French',
        # Portuguese-speaking
        'BRA': 'Portuguese', 'MOZ': 'Portuguese', 'AGO': 'Portuguese',
        'CPV': 'Portuguese', 'GNB': 'Portuguese',
        # Spanish-speaking
        'MEX': 'Spanish', 'ARG': 'Spanish', 'COL': 'Spanish', 'PER': 'Spanish',
        'CHL': 'Spanish', 'ECU': 'Spanish', 'BOL': 'Spanish', 'PRY': 'Spanish',
        'URY': 'Spanish', 'VEN': 'Spanish', 'GTM': 'Spanish', 'HND': 'Spanish',
        'SLV': 'Spanish', 'NIC': 'Spanish', 'CRI': 'Spanish', 'PAN': 'Spanish',
        # Arabic-speaking
        'EGY': 'Arabic', 'SDN': 'Arabic', 'LBY': 'Arabic', 'IRQ': 'Arabic',
        'JOR': 'Arabic', 'LBN': 'Arabic', 'PSE': 'Arabic', 'YEM': 'Arabic',
        # Other
        'IDN': 'Indonesian', 'VNM': 'Vietnamese', 'THA': 'Thai',
        'KHM': 'Khmer', 'LAO': 'Lao', 'MMR': 'Burmese', 'ETH': 'Amharic',
        'IRN': 'Farsi', 'AFG': 'Dari',
    }

    @classmethod
    def get_country_name(cls, code: str) -> str:
        """Get full country name from ISO alpha-3 code."""
        return cls.COUNTRY_NAMES.get(code.upper(), code)

    @classmethod
    def get_language(cls, country_code: str) -> str:
        """Infer primary language from country code."""
        return cls.COUNTRY_LANGUAGES.get(country_code.upper(), 'English')

    @classmethod
    def infer_entity_type(cls, source_name: str, url: str) -> Tuple[str, str]:
        """
        Infer entity type and subtype from source name and URL.

        Returns: (entity_type, entity_subtype)
        """
        name_lower = source_name.lower()
        url_lower = url.lower()

        # Check patterns
        patterns = [
            (r'university|universi|college|polytechnic', 'University', 'Higher Education'),
            (r'hospital|medical center|health', 'Hospital', 'Health Institution'),
            (r'port authority|ports', 'Port Authority', 'Maritime'),
            (r'airport|aviation|civil aviation', 'Airport Authority', 'Aviation'),
            (r'railway|rail|train', 'Railway Corporation', 'Transport'),
            (r'electricity|power|electric', 'Utility', 'Electricity'),
            (r'water|sewerage|sanitation', 'Utility', 'Water'),
            (r'telecom|telecommunications', 'Utility', 'Telecommunications'),
            (r'bank|central bank|reserve bank', 'Central Bank', 'Monetary Authority'),
            (r'petroleum|oil|petrol|nnpc|gnpc', 'State-Owned Enterprise', 'National Oil Company'),
            (r'ministry|department|secretariat', 'National Government', 'Ministry'),
            (r'county|state|province|region|prefecture', 'Sub-national Government', 'Regional'),
            (r'city|municipal|metro|council', 'Sub-national Government', 'Municipal'),
            (r'world bank|ifc|miga', 'Multilateral Development Bank', 'World Bank Group'),
            (r'african development|afdb', 'Multilateral Development Bank', 'AfDB'),
            (r'asian development|adb', 'Multilateral Development Bank', 'ADB'),
            (r'undp|unicef|unfpa|who|wfp|fao|unhcr', 'UN Agency', 'UN System'),
            (r'usaid|dfid|giz|jica|afd|sida', 'Bilateral Agency', 'Development Agency'),
        ]

        combined = name_lower + ' ' + url_lower
        for pattern, entity_type, subtype in patterns:
            if re.search(pattern, combined):
                return entity_type, subtype

        return 'Government', 'General'

    @classmethod
    def infer_sectors(cls, source_name: str, entity_type: str) -> List[str]:
        """Infer sectors based on source name and entity type."""
        name_lower = source_name.lower()

        sector_patterns = {
            'health|medical|hospital|pharmaceutical': ['Health', 'Medical Equipment'],
            'education|university|school|college': ['Education', 'Research'],
            'water|sanitation|sewerage': ['Water', 'Sanitation'],
            'electricity|power|energy': ['Energy', 'Electricity'],
            'oil|petroleum|gas': ['Oil & Gas', 'Energy'],
            'transport|road|highway': ['Transport', 'Infrastructure'],
            'railway|rail': ['Transport', 'Railways'],
            'port|maritime|shipping': ['Ports', 'Maritime'],
            'airport|aviation': ['Aviation', 'Airports'],
            'telecom|ict|technology': ['ICT', 'Telecommunications'],
            'agriculture|farming|rural': ['Agriculture'],
            'mining|mineral': ['Mining'],
            'defense|military|security': ['Defense', 'Security'],
            'environment|conservation|climate': ['Environment'],
        }

        for pattern, sectors in sector_patterns.items():
            if re.search(pattern, name_lower):
                return sectors

        # Default sectors based on entity type
        type_defaults = {
            'University': ['Education', 'Research', 'ICT'],
            'Hospital': ['Health', 'Medical Equipment', 'Pharmaceuticals'],
            'Utility': ['Infrastructure', 'Construction'],
            'Port Authority': ['Ports', 'Maritime', 'Logistics'],
            'Airport Authority': ['Aviation', 'Infrastructure'],
            'Railway Corporation': ['Transport', 'Railways'],
            'Central Bank': ['Finance', 'ICT', 'Security'],
        }

        return type_defaults.get(entity_type, ['General', 'Infrastructure'])


# =============================================================================
# REPORT GENERATOR
# =============================================================================

class ReportGenerator:
    """
    Generate analysis reports from the tender database.
    """

    @staticmethod
    def generate_summary_report(entries: List[Dict[str, Any]]) -> str:
        """Generate a text summary report."""
        lines = []
        lines.append("=" * 60)
        lines.append("TENDER INTELLIGENCE DATABASE SUMMARY REPORT")
        lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append("=" * 60)

        lines.append(f"\nTotal Sources: {len(entries)}")

        # Count by entity type
        entity_counts = {}
        for entry in entries:
            entity = entry.get('entity_type', 'Unknown')
            entity_counts[entity] = entity_counts.get(entity, 0) + 1

        lines.append("\n--- Sources by Entity Type ---")
        for entity, count in sorted(entity_counts.items(), key=lambda x: -x[1]):
            pct = count / len(entries) * 100
            lines.append(f"  {entity}: {count} ({pct:.1f}%)")

        # Count by country
        country_counts = {}
        for entry in entries:
            country = entry.get('country_name', 'Unknown')
            country_counts[country] = country_counts.get(country, 0) + 1

        lines.append("\n--- Top 20 Countries ---")
        for country, count in sorted(country_counts.items(), key=lambda x: -x[1])[:20]:
            pct = count / len(entries) * 100
            lines.append(f"  {country}: {count} ({pct:.1f}%)")

        # Count by language
        lang_counts = {}
        for entry in entries:
            lang = entry.get('language', 'Unknown')
            lang_counts[lang] = lang_counts.get(lang, 0) + 1

        lines.append("\n--- Sources by Language ---")
        for lang, count in sorted(lang_counts.items(), key=lambda x: -x[1]):
            pct = count / len(entries) * 100
            lines.append(f"  {lang}: {count} ({pct:.1f}%)")

        lines.append("\n" + "=" * 60)
        return "\n".join(lines)

    @staticmethod
    def generate_validation_report(
        validation_results: Dict[str, Dict[str, Any]]
    ) -> str:
        """Generate a validation report."""
        lines = []
        lines.append("=" * 60)
        lines.append("URL VALIDATION REPORT")
        lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append("=" * 60)

        total = len(validation_results)
        valid_format = sum(1 for r in validation_results.values() if r['valid_format'])
        is_primary = sum(1 for r in validation_results.values() if r['is_primary'])
        accessible = sum(1 for r in validation_results.values()
                        if r.get('accessible') is True)

        lines.append(f"\nTotal URLs checked: {total}")
        lines.append(f"Valid format: {valid_format} ({valid_format/total*100:.1f}%)")
        lines.append(f"Primary sources: {is_primary} ({is_primary/total*100:.1f}%)")

        if any(r.get('accessible') is not None for r in validation_results.values()):
            lines.append(f"Accessible: {accessible} ({accessible/total*100:.1f}%)")

        # List problematic URLs
        problems = []
        for url, result in validation_results.items():
            if not result['valid_format']:
                problems.append((url, "Invalid URL format"))
            elif not result['is_primary']:
                problems.append((url, f"Aggregator: {result['primary_reason']}"))
            elif result.get('accessible') is False:
                problems.append((url, f"Not accessible: {result.get('http_message', '')}"))

        if problems:
            lines.append(f"\n--- Problematic URLs ({len(problems)}) ---")
            for url, issue in problems[:50]:  # Limit to first 50
                lines.append(f"  {url[:60]}...")
                lines.append(f"    Issue: {issue}")

        lines.append("\n" + "=" * 60)
        return "\n".join(lines)


# =============================================================================
# COMMAND LINE INTERFACE
# =============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Tender Database Extension Tools")
    parser.add_argument("command", choices=['template', 'validate', 'report'],
                       help="Command to execute")
    parser.add_argument("--input", "-i", help="Input file path")
    parser.add_argument("--output", "-o", help="Output file path")
    parser.add_argument("--type", "-t", choices=['countries', 'entities'],
                       default='countries', help="Template type")

    args = parser.parse_args()

    if args.command == 'template':
        output = args.output or f"template_{args.type}.csv"
        ConfigLoader.save_template_csv(output, args.type)

    elif args.command == 'validate':
        if not args.input:
            print("Error: --input required for validate command")
            exit(1)

        with open(args.input, 'r') as f:
            data = json.load(f)

        urls = [entry.get('url', '') for entry in data if entry.get('url')]
        results = URLValidator.validate_batch(urls)
        report = ReportGenerator.generate_validation_report(results)
        print(report)

        if args.output:
            with open(args.output, 'w') as f:
                f.write(report)

    elif args.command == 'report':
        if not args.input:
            print("Error: --input required for report command")
            exit(1)

        with open(args.input, 'r') as f:
            data = json.load(f)

        report = ReportGenerator.generate_summary_report(data)
        print(report)

        if args.output:
            with open(args.output, 'w') as f:
                f.write(report)
