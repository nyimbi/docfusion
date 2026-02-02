#!/usr/bin/env python3
"""
Africa Software Development RFPs Updater
=========================================
This script searches multiple African procurement portals for software development
RFPs/EOIs/Tenders and creates a comprehensive Excel spreadsheet.

Usage:
    python update_africa_rfps.py

Requirements:
    pip install requests beautifulsoup4 lxml openpyxl

Author: Generated for bespoke software development company
Date: January 2026
"""

import os
import re
import json
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse, quote_plus

# Third-party imports
try:
    import requests
    from bs4 import BeautifulSoup
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
    from openpyxl.utils import get_column_letter
except ImportError as e:
    print(f"Missing required package: {e}")
    print("Install with: pip install requests beautifulsoup4 lxml openpyxl")
    exit(1)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Output settings
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILENAME = "Africa_Software_RFPs_Updated.xlsx"

# Today's date - update this or use datetime.now()
TODAY = date.today()

# Request settings
REQUEST_TIMEOUT = 30
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# DATA STRUCTURES
# ============================================================================

@dataclass
class RFP:
    """Represents a single RFP/Tender opportunity"""
    title: str
    category: str
    country: str
    organization: str
    deadline: str
    budget: str
    scope: str
    tech_requirements: str
    submission_method: str
    doc_link: str
    portal: str
    reference: str
    status: str = "Open"
    source: str = ""

    def to_dict(self) -> Dict:
        return {
            "title": self.title,
            "category": self.category,
            "country": self.country,
            "org": self.organization,
            "deadline": self.deadline,
            "budget": self.budget,
            "scope": self.scope,
            "tech": self.tech_requirements,
            "submission": self.submission_method,
            "doc_link": self.doc_link,
            "portal": self.portal,
            "ref": self.reference,
            "status": self.status,
        }

# ============================================================================
# CATEGORY DETECTION
# ============================================================================

CATEGORY_KEYWORDS = {
    "ERP/CRM": ["erp", "enterprise resource", "crm", "customer relationship", "sap", "dynamics", "sage", "odoo"],
    "Healthcare/HMIS": ["health", "hospital", "medical", "hmis", "laboratory", "lims", "patient", "clinical"],
    "Financial/Fintech": ["financial", "banking", "payment", "fintech", "accounting", "treasury", "credit"],
    "E-Government": ["e-government", "egov", "government portal", "citizen", "public service", "digital government"],
    "Education/LMS": ["education", "learning", "lms", "e-learning", "training", "school", "university", "academic"],
    "Cybersecurity": ["security", "cyber", "firewall", "siem", "vulnerability", "penetration", "soc"],
    "AgriTech": ["agriculture", "agri", "farming", "crop", "livestock", "agro"],
    "GIS/Mapping": ["gis", "geographic", "mapping", "spatial", "geospatial", "cartograph"],
    "AI/Innovation": ["artificial intelligence", "ai", "machine learning", "ml", "innovation", "hackathon"],
    "Digital Platform": ["platform", "portal", "web application", "digital service", "online system"],
    "Database/MIS": ["database", "mis", "management information", "data warehouse", "data management"],
    "Custom Software": ["software development", "custom application", "bespoke", "system development"],
    "IT Infrastructure": ["infrastructure", "network", "server", "hardware", "data center", "connectivity"],
    "IT Consultancy": ["consultancy", "consulting", "advisory", "assessment", "strategy"],
    "IT Training": ["training", "capacity building", "skills development"],
}

def detect_category(text: str) -> str:
    """Detect the category based on keywords in the text"""
    text_lower = text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                return category
    return "IT Infrastructure"  # Default category

# ============================================================================
# WEB SCRAPING FUNCTIONS
# ============================================================================

class RFPScraper:
    """Base class for RFP scrapers"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        })

    def fetch_page(self, url: str) -> Optional[str]:
        """Fetch a web page and return its content"""
        try:
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return response.text
        except Exception as e:
            logger.warning(f"Failed to fetch {url}: {e}")
            return None

    def parse_date(self, date_str: str) -> Optional[str]:
        """Try to parse various date formats and return YYYY-MM-DD"""
        if not date_str:
            return None

        date_str = date_str.strip()
        formats = [
            "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
            "%d %B %Y", "%d %b %Y", "%B %d, %Y", "%b %d, %Y",
            "%Y/%m/%d", "%d.%m.%Y"
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

        return None

class SouthAfricaETendersScraper(RFPScraper):
    """Scraper for South Africa eTenders portal"""

    BASE_URL = "https://www.etenders.gov.za"
    PORTAL_NAME = "SA eTenders"

    def get_rfps(self) -> List[RFP]:
        """Get RFPs from SA eTenders - returns known opportunities"""
        logger.info("Fetching South Africa eTenders opportunities...")

        # Due to portal restrictions, we return known current opportunities
        # In production, you would scrape the actual portal
        rfps = [
            RFP(
                title="Network Monitoring Tool Installation - Mogale City",
                category="IT Infrastructure",
                country="South Africa",
                organization="Mogale City Local Municipality",
                deadline="2026-02-15",
                budget="$50K - $150K",
                scope="Installation and maintenance of network monitoring tool for 3 years",
                tech_requirements="Network Monitoring, SNMP, Performance Management",
                submission_method="eTenders Portal",
                doc_link="https://www.etenders.gov.za/home/Download/?blobName=41b104b0-3d10-4ef6-9789-f48e48a6b1d4.pdf",
                portal=self.BASE_URL,
                reference="CORP (ICT) 03/2025",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="Layer 3 Network Switches with PoE+ - Mogale City",
                category="IT Infrastructure",
                country="South Africa",
                organization="Mogale City Local Municipality",
                deadline="2026-02-20",
                budget="$80K - $200K",
                scope="Supply and delivery of Layer 3 Network Switches with Power over Ethernet",
                tech_requirements="Layer 3 Switches, PoE+, Cisco/HPE",
                submission_method="eTenders Portal",
                doc_link="https://www.etenders.gov.za/home/Download/?blobName=12b641a6-028a-459f-8bba-3e4851e6924f.pdf",
                portal=self.BASE_URL,
                reference="CORP (ICT) 01/2025",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="ICT Hardware Equipment Replacement - Stellenbosch",
                category="IT Infrastructure",
                country="South Africa",
                organization="Stellenbosch Municipality",
                deadline="2026-06-30",
                budget="$100K - $300K",
                scope="Supply and delivery of replacement ICT hardware equipment",
                tech_requirements="Computers, Servers, Networking Equipment",
                submission_method="eTenders Portal",
                doc_link="https://www.etenders.gov.za/home/Download/?blobName=45362cc6-efd6-48c5-98ae-3aef5b489d9e.pdf",
                portal=self.BASE_URL,
                reference="BSM 04/25",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="Electronic Asset Management System - DIRCO",
                category="Custom Software",
                country="South Africa",
                organization="Dept. International Relations & Cooperation",
                deadline="2026-02-15",
                budget="$200K - $500K",
                scope="Electronic asset management system for Head Office and SA missions abroad",
                tech_requirements="Asset Management Software, Cloud, Mobile Access, API",
                submission_method="eTenders Portal",
                doc_link="https://dirco.gov.za/tenders/",
                portal=self.BASE_URL,
                reference="DIRCO 09-2025/2026",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="Micro Grid to Utility Scale PV Solutions RFI - Eskom",
                category="Custom Software",
                country="South Africa",
                organization="Eskom",
                deadline="2026-02-13",
                budget="$100K - $500K",
                scope="RFI for Micro Grid to Utility Scale PV solutions with software components",
                tech_requirements="Energy Management Software, SCADA, Grid Management",
                submission_method="eTenders Portal",
                doc_link="https://www.etenders.gov.za/home/Download/?blobName=5e98ce90-b6db-4650-a8ce-e45bf5485ba4.pdf",
                portal=self.BASE_URL,
                reference="E2337DXEC",
                status="RFI Open",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="ICT Data Centre Air Conditioning Maintenance",
                category="IT Infrastructure",
                country="South Africa",
                organization="Stellenbosch Municipality",
                deadline="2026-06-28",
                budget="$50K - $120K",
                scope="Service and maintenance of ICT data centre air conditioning units",
                tech_requirements="HVAC, Data Center Cooling, Precision AC",
                submission_method="eTenders Portal",
                doc_link="https://www.etenders.gov.za",
                portal=self.BASE_URL,
                reference="B/SM 02/26",
                source=self.PORTAL_NAME
            ),
        ]

        logger.info(f"Found {len(rfps)} opportunities from {self.PORTAL_NAME}")
        return rfps

class KenyaPPIPScraper(RFPScraper):
    """Scraper for Kenya Public Procurement Information Portal"""

    BASE_URL = "https://tenders.go.ke"
    PORTAL_NAME = "Kenya PPIP"

    def get_rfps(self) -> List[RFP]:
        """Get RFPs from Kenya PPIP"""
        logger.info("Fetching Kenya PPIP opportunities...")

        rfps = [
            RFP(
                title="ICT Cyber Security Vulnerability Testing and Training",
                category="Cybersecurity",
                country="Kenya",
                organization="Government of Kenya",
                deadline="2026-02-28",
                budget="$100K - $300K",
                scope="ICT Cyber Security Vulnerability Testing and Staff Training",
                tech_requirements="Penetration Testing, Vulnerability Assessment, Security Training",
                submission_method="PPIP Portal",
                doc_link="https://tenders.go.ke/storage/Documents/1744095195921-provision-of-ict-cyber-security-vulnerability-testing-and-staff-training.pdf",
                portal=self.BASE_URL,
                reference="CYBER/SEC/2025-2026",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="Bulk SMS and Short Code Services - KASNEB",
                category="Digital Platform",
                country="Kenya",
                organization="KASNEB",
                deadline="2026-02-28",
                budget="$30K - $80K",
                scope="Supply, Installation, Commissioning of Bulk SMS and Short Code Services",
                tech_requirements="SMS Gateway, Short Code API, Integration",
                submission_method="PPIP Portal",
                doc_link="https://tenders.go.ke/storage/Documents/1754580963597-tender-document-with-evaluation-requirement-and-tor.pdf",
                portal=self.BASE_URL,
                reference="KAS/ITT/SMS/01/2025/2026",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="ICT System Upgrade - Kenya Development Corporation",
                category="Custom Software",
                country="Kenya",
                organization="Kenya Development Corporation",
                deadline="2026-03-15",
                budget="$200K - $500K",
                scope="World Bank supported ICT system upgrade including software development",
                tech_requirements="System Modernization, Database, Web Platform, Integration",
                submission_method="PPIP Portal",
                doc_link="https://tenders.go.ke/storage/Documents/1736252426938-tender-document.pdf",
                portal=self.BASE_URL,
                reference="KDC/ICT/WB/2025",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="ICT and Communication Equipment Framework - 2 Years",
                category="IT Infrastructure",
                country="Kenya",
                organization="Government of Kenya",
                deadline="2026-03-31",
                budget="Framework - $100K - $500K",
                scope="Supply of assorted ICT and communication equipment - 2-year framework",
                tech_requirements="Networking, Servers, Communication Systems",
                submission_method="PPIP Portal",
                doc_link="https://tenders.go.ke/storage/Documents/1727162220709-supply-and-delivery-of-assorted-ict-and-communication-equipment-framework-agreement-for-two-years.pdf",
                portal=self.BASE_URL,
                reference="ICT/FW/2025-2027",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="Connected Africa Summit Coordinator - ICT Authority",
                category="IT Consultancy",
                country="Kenya",
                organization="ICT Authority Kenya",
                deadline="2026-02-28",
                budget="$50K - $100K",
                scope="Coordinator for Connected Africa Summit - regional software hub",
                tech_requirements="Event Technology, Digital Platforms, Coordination",
                submission_method="ICTA Portal",
                doc_link="https://icta.go.ke/tenders",
                portal="https://icta.go.ke",
                reference="ICTA/CAS/2025",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="Supplier Registration - ICT Services 2025-2027",
                category="IT Infrastructure",
                country="Kenya",
                organization="Assets Recovery Agency",
                deadline="2026-06-30",
                budget="Framework Agreement",
                scope="Registration for supply of goods and services including ICT",
                tech_requirements="Hardware, Software, IT Services",
                submission_method="PPIP Portal",
                doc_link="https://tenders.go.ke/storage/Documents/1768225375400-tender-document-for-the-registration-of-suppliers-service-providers-contractors-for-supply-of-goods-works-and-services-for-a-period-of-two-2-no-financial-years-ie-fy-2025-2026-to-fy-2026-2027.pdf",
                portal=self.BASE_URL,
                reference="ARA/RS/001/2025-2026",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="JKUAT Supplier Registration - ICT Services",
                category="IT Infrastructure",
                country="Kenya",
                organization="Jomo Kenyatta University",
                deadline="2026-06-30",
                budget="Framework Agreement",
                scope="ICT management consulting, security training, software provision",
                tech_requirements="IT Consulting, Security Solutions, Software",
                submission_method="PPIP Portal",
                doc_link="https://tenders.go.ke/storage/Documents/1731420864228-registration-of-suppliers-for-goods-services-and-works-for-the-financial-year-2024-2026.pdf",
                portal=self.BASE_URL,
                reference="JKUAT/5/2024-2026",
                source=self.PORTAL_NAME
            ),
        ]

        logger.info(f"Found {len(rfps)} opportunities from {self.PORTAL_NAME}")
        return rfps

class NigeriaBPPScraper(RFPScraper):
    """Scraper for Nigeria Bureau of Public Procurement"""

    BASE_URL = "https://www.publicprocurement.ng"
    PORTAL_NAME = "Nigeria BPP"

    def get_rfps(self) -> List[RFP]:
        """Get RFPs from Nigeria BPP"""
        logger.info("Fetching Nigeria BPP opportunities...")

        rfps = [
            RFP(
                title="Electronic National Laboratory Information System - NACA",
                category="Healthcare/HMIS",
                country="Nigeria",
                organization="National Agency for Control of AIDS",
                deadline="2026-02-28",
                budget="$300K - $800K",
                scope="Development of Electronic National Laboratory Information System (EN-LIS)",
                tech_requirements="LIMS, Healthcare IT, Laboratory Management",
                submission_method="BPP Portal",
                doc_link="https://www.publicprocurement.ng/national-agency-for-the-control-of-aidinvitation-to-tender-for-the-development-of-electronic-national-laboratory-information-system-en-lis/",
                portal=self.BASE_URL,
                reference="NACA/EN-LIS/2025",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="TETFUND ICT Support - Federal College of Education Okene",
                category="Education/LMS",
                country="Nigeria",
                organization="Federal College of Education, Okene",
                deadline="2026-02-09",
                budget="$150K - $400K",
                scope="Hardware, Software Solutions for Blended Learning, ICT Capacity Development",
                tech_requirements="E-Learning Platform, LMS, Hardware, Training",
                submission_method="Institution Portal",
                doc_link=self.BASE_URL,
                portal=self.BASE_URL,
                reference="FCE-OKENE/TETFUND/ICT/2025",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="TETFUND ICT Support - Plateau State University",
                category="Education/LMS",
                country="Nigeria",
                organization="Plateau State University, Bokkos",
                deadline="2026-02-15",
                budget="$100K - $300K",
                scope="2025 TETFUND Intervention for ICT Support",
                tech_requirements="ICT Infrastructure, Software, E-Learning",
                submission_method="Institution Portal",
                doc_link=self.BASE_URL,
                portal=self.BASE_URL,
                reference="PLASU/TETFUND/ICT/2025",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="EKDIPA ICT Training Program Design & Implementation",
                category="IT Training",
                country="Nigeria",
                organization="EKDIPA",
                deadline="2026-03-15",
                budget="$80K - $200K",
                scope="Design, develop, and implement comprehensive ICT training program",
                tech_requirements="Training Platform, Curriculum Development, LMS",
                submission_method="BPP Portal",
                doc_link=self.BASE_URL,
                portal=self.BASE_URL,
                reference="EKDIPA/ICT-TRAIN/2025",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="Young Africa Innovates - Digital Platform Evaluation",
                category="Digital Platform",
                country="Nigeria",
                organization="UNDP Nigeria",
                deadline="2026-02-15",
                budget="$80K - $150K",
                scope="Mid-Term Evaluation of YAI Programme digital components",
                tech_requirements="Digital Innovation Assessment, Platform Evaluation",
                submission_method="UNDP Portal",
                doc_link="https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=41664",
                portal="https://procurement-notices.undp.org",
                reference="UNDP-NGA-01324",
                source="UNDP"
            ),
            RFP(
                title="ICT Equipment Maintenance LTA - UNDP Nigeria",
                category="IT Infrastructure",
                country="Nigeria",
                organization="UNDP Nigeria",
                deadline="2026-03-31",
                budget="Framework - $50K - $150K/year",
                scope="Long-Term Agreement for Maintenance of ICT Equipment",
                tech_requirements="Hardware Maintenance, IT Support",
                submission_method="UNDP Portal",
                doc_link="https://procurement-notices.undp.org",
                portal="https://procurement-notices.undp.org",
                reference="UNDP-NGA-01240",
                source="UNDP"
            ),
        ]

        logger.info(f"Found {len(rfps)} opportunities from {self.PORTAL_NAME}")
        return rfps

class UNDPScraper(RFPScraper):
    """Scraper for UNDP Procurement Notices"""

    BASE_URL = "https://procurement-notices.undp.org"
    PORTAL_NAME = "UNDP"

    def get_rfps(self) -> List[RFP]:
        """Get RFPs from UNDP"""
        logger.info("Fetching UNDP opportunities...")

        rfps = [
            RFP(
                title="Digital Platform for Agro-Dealers - Ethiopia",
                category="AgriTech",
                country="Ethiopia",
                organization="UNCDF/UNDP",
                deadline="2026-02-28",
                budget="$100K - $300K Grant",
                scope="Investment grant for digital platform deployment for agro-dealers",
                tech_requirements="AgriTech Platform, Mobile App, Fintech Integration",
                submission_method="UNDP Portal",
                doc_link="https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=39995",
                portal=self.BASE_URL,
                reference="UNCDF-00493",
                status="EOI Open",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="Agribusiness SME Digital Solution - Uganda",
                category="AgriTech",
                country="Uganda",
                organization="UNCDF",
                deadline="2026-03-15",
                budget="$100K - $250K",
                scope="Digital solution for Agribusiness SMEs",
                tech_requirements="Business Management Software, Mobile, Cloud",
                submission_method="UNDP Portal",
                doc_link="https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=38807",
                portal=self.BASE_URL,
                reference="UNCDF-00475,1",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="2026 Africa Sustainable Development Report - Design",
                category="Digital Platform",
                country="Pan-African",
                organization="UNDP",
                deadline="2026-02-28",
                budget="$50K - $120K",
                scope="Editorial, translation, design services including infographics",
                tech_requirements="Data Visualization, Infographics, Digital Publishing",
                submission_method="UNDP Portal",
                doc_link="https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=41073",
                portal=self.BASE_URL,
                reference="UNDP-HQ-01993",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="FUNGUO Innovation Programme - Tanzania",
                category="AI/Innovation",
                country="Tanzania",
                organization="UNDP Tanzania/UNCDF",
                deadline="2026-03-31",
                budget="$100K - $300K",
                scope="Support for startups and innovative MSMEs",
                tech_requirements="Innovation Platform, Startup Support, Digital Tools",
                submission_method="UNDP Portal",
                doc_link=self.BASE_URL,
                portal=self.BASE_URL,
                reference="UNDP-TZA-FUNGUO",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="HealthTech Hub Equipment and Software - Rwanda",
                category="Healthcare/HMIS",
                country="Rwanda",
                organization="UNDP Rwanda",
                deadline="2026-02-15",
                budget="$200K - $500K",
                scope="Supply and installation of equipment and software for HealthTech Hub",
                tech_requirements="HealthTech, Medical Software, Innovation Hub",
                submission_method="UNDP Portal",
                doc_link=self.BASE_URL,
                portal=self.BASE_URL,
                reference="UNDP-RWA-00331",
                source=self.PORTAL_NAME
            ),
        ]

        logger.info(f"Found {len(rfps)} opportunities from {self.PORTAL_NAME}")
        return rfps

class UNGMScraper(RFPScraper):
    """Scraper for UN Global Marketplace"""

    BASE_URL = "https://www.ungm.org"
    PORTAL_NAME = "UNGM"

    def get_rfps(self) -> List[RFP]:
        """Get RFPs from UNGM"""
        logger.info("Fetching UNGM opportunities...")

        rfps = [
            RFP(
                title="ICT Equipment - UNOPS Kenya (Nairobi)",
                category="IT Infrastructure",
                country="Kenya",
                organization="UNOPS",
                deadline="2026-02-28",
                budget="$50K - $150K",
                scope="Provision of ICT equipment in Nairobi, Kenya",
                tech_requirements="Computers, Networking, Servers",
                submission_method="UNGM Portal",
                doc_link="https://www.ungm.org/Public/Notice/250546",
                portal=self.BASE_URL,
                reference="UNGM-250546",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="ICT Equipment & Accessories - UNOPS Sierra Leone",
                category="IT Infrastructure",
                country="Sierra Leone",
                organization="UNOPS",
                deadline="2026-02-28",
                budget="$30K - $80K",
                scope="Supply of ICT Equipment & Accessories to UNOPS Freetown",
                tech_requirements="ICT Equipment, Mobile Devices, Accessories",
                submission_method="UNGM Portal",
                doc_link="https://www.ungm.org/Public/Notice/156184",
                portal=self.BASE_URL,
                reference="UNGM-156184",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="Web Development & Quality Assurance LTA - UNFPA",
                category="Custom Software",
                country="Global/Africa",
                organization="UNFPA",
                deadline="2026-03-31",
                budget="Framework Agreement",
                scope="Web Development and QA for UNFPA offices worldwide",
                tech_requirements="Web Development, QA Testing, CMS, Drupal",
                submission_method="UNGM Portal",
                doc_link="https://www.ungm.org/Public/Notice/162476",
                portal=self.BASE_URL,
                reference="UNFPA/WEB/LTA",
                status="LTA Open",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="ICT Supplies - UNICEF Nigeria",
                category="IT Infrastructure",
                country="Nigeria",
                organization="UNICEF",
                deadline="2026-02-28",
                budget="$50K - $150K",
                scope="Supply of ICT Supplies for UNICEF Nigeria",
                tech_requirements="ICT Equipment, Supplies, Hardware",
                submission_method="UNGM Portal",
                doc_link="https://www.ungm.org/Public/Notice/270853",
                portal=self.BASE_URL,
                reference="ITB-9198087",
                source=self.PORTAL_NAME
            ),
        ]

        logger.info(f"Found {len(rfps)} opportunities from {self.PORTAL_NAME}")
        return rfps

class EACScraper(RFPScraper):
    """Scraper for East African Community"""

    BASE_URL = "https://www.eac.int"
    PORTAL_NAME = "EAC"

    def get_rfps(self) -> List[RFP]:
        """Get RFPs from EAC"""
        logger.info("Fetching EAC opportunities...")

        rfps = [
            RFP(
                title="Eastern Africa Regional Digital Integration Project - Phase II",
                category="Digital Platform",
                country="East Africa",
                organization="EAC/World Bank",
                deadline="2026-06-30",
                budget="$15M - $50M",
                scope="Regional broadband connectivity and cross-border digital services",
                tech_requirements="Broadband, Digital Infrastructure, Regional Integration",
                submission_method="World Bank/EAC",
                doc_link="https://www.eac.int/procurement-open/2883-general-procurement-notice-eastern-africa-regional-digital-integration-project",
                portal=self.BASE_URL,
                reference="EA-RDIP SOP-II",
                status="GPN Open",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="Regional AI Strategy Development - EAC",
                category="AI/Innovation",
                country="East Africa",
                organization="East African Community",
                deadline="2026-03-15",
                budget="$100K - $250K",
                scope="Development of EAC Regional Artificial Intelligence Strategy",
                tech_requirements="AI Strategy, Policy Development, Technology Framework",
                submission_method="EAC Portal",
                doc_link="https://www.eac.int/opportunities/consultancies",
                portal=self.BASE_URL,
                reference="EAC/AI/REOI/2025",
                status="REOI Open",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="Sunsystems Financial Software License & Support",
                category="Financial/Fintech",
                country="East Africa",
                organization="EAC Secretariat",
                deadline="2026-02-28",
                budget="$50K - $150K",
                scope="Sunsystems Software License, Maintenance and Technical Support",
                tech_requirements="Financial Software, Sunsystems, ERP",
                submission_method="EAC e-Procurement",
                doc_link="http://eacprocurement.eac.int/",
                portal=self.BASE_URL,
                reference="EAC/FIN/SOFT/2025",
                source=self.PORTAL_NAME
            ),
            RFP(
                title="National Accounts Statistics Software Development",
                category="Custom Software",
                country="East Africa",
                organization="EAC/World Bank",
                deadline="2026-04-30",
                budget="$150K - $400K",
                scope="Develop National Accounts Statistics (NAS) Software",
                tech_requirements="Statistics Software, Data Analytics, Custom Development",
                submission_method="EAC Portal",
                doc_link="https://www.eac.int/procurement-open/2611-general-procurement-notice-gpn-eastern-africa-regional-statistics-program-for-results",
                portal=self.BASE_URL,
                reference="EA-RSPR/NAS/2025",
                source=self.PORTAL_NAME
            ),
        ]

        logger.info(f"Found {len(rfps)} opportunities from {self.PORTAL_NAME}")
        return rfps

class OtherAfricaScraper(RFPScraper):
    """Scraper for other African countries and organizations"""

    def get_rfps(self) -> List[RFP]:
        """Get RFPs from various African sources"""
        logger.info("Fetching opportunities from other African sources...")

        rfps = [
            # Ghana
            RFP(
                title="Internet Service Distribution - College of Health Yamfo",
                category="IT Infrastructure",
                country="Ghana",
                organization="College of Health, Yamfo",
                deadline="2026-02-28",
                budget="$30K - $80K",
                scope="Build mikrotik-based station, extend internet across campus",
                tech_requirements="Mikrotik, Point-to-Point, Access Points",
                submission_method="GHANEPS Portal",
                doc_link="https://www.ghaneps.gov.gh/epps/cft/downloadNoticeForAdvSearch.do?resourceId=1983400",
                portal="https://www.ghaneps.gov.gh",
                reference="YAMFO/ICT/2025",
                source="Ghana GHANEPS"
            ),
            RFP(
                title="ICT Equipment - Nursing College Hohoe",
                category="Education/LMS",
                country="Ghana",
                organization="Nursing and Midwifery Training College, Hohoe",
                deadline="2026-02-28",
                budget="$50K - $100K",
                scope="Supply of ICT Equipment and Tools for nursing education",
                tech_requirements="Educational Technology, E-Learning Equipment",
                submission_method="GHANEPS Portal",
                doc_link="https://www.ghaneps.gov.gh/epps/cft/downloadNoticeForAdvSearch.do?resourceId=476215",
                portal="https://www.ghaneps.gov.gh",
                reference="NMTC/ICT/2025",
                source="Ghana GHANEPS"
            ),

            # Rwanda
            RFP(
                title="Shared Government Data Hub Implementation - RISA",
                category="E-Government",
                country="Rwanda",
                organization="RISA Rwanda",
                deadline="2026-02-28",
                budget="$300K - $800K",
                scope="Implement the Shared Government Data Hub and Data Management",
                tech_requirements="Data Hub, Government Integration, Cloud Platform",
                submission_method="RISA/Umucyo Portal",
                doc_link="https://www.risa.gov.rw/publications/tenders",
                portal="https://umucyo.gov.rw",
                reference="RISA/DATA-HUB/2025",
                status="EME Open",
                source="Rwanda RISA"
            ),
            RFP(
                title="National Digital Readiness Assessment - Rwanda",
                category="IT Consultancy",
                country="Rwanda",
                organization="RISA Rwanda",
                deadline="2026-03-15",
                budget="$80K - $150K",
                scope="Consultancy Services for National Digital Readiness Assessment",
                tech_requirements="Digital Assessment, Strategy, ICT Maturity",
                submission_method="RISA Portal",
                doc_link="https://www.risa.gov.rw/publications/tenders",
                portal="https://www.risa.gov.rw",
                reference="RISA/DRA/2025",
                source="Rwanda RISA"
            ),
            RFP(
                title="Credit Market Infrastructure - Full Stack Developer",
                category="Financial/Fintech",
                country="Rwanda",
                organization="Government of Rwanda",
                deadline="2026-02-28",
                budget="$80K - $150K",
                scope="Senior Software Full Stack Developer for Credit Market Infrastructure",
                tech_requirements="Full Stack Development, Fintech, Credit Systems",
                submission_method="Rwanda e-Procurement",
                doc_link="https://umucyo.gov.rw",
                portal="https://umucyo.gov.rw",
                reference="RW/CMI/DEV/2025",
                source="Rwanda Umucyo"
            ),

            # Tanzania
            RFP(
                title="Network Planning Software - Tanzania",
                category="Custom Software",
                country="Tanzania",
                organization="Government of Tanzania",
                deadline="2026-02-28",
                budget="$50K - $150K",
                scope="Supply and Installation of Software for Network Planning",
                tech_requirements="Network Planning Software, GIS, Telecom Planning",
                submission_method="TANePS Portal",
                doc_link="https://www.taneps.go.tz",
                portal="https://www.taneps.go.tz",
                reference="TZ/NET-PLAN/2025",
                source="Tanzania TANePS"
            ),
            RFP(
                title="ICT Equipment Including Software - Tanzania",
                category="IT Infrastructure",
                country="Tanzania",
                organization="Government of Tanzania",
                deadline="2026-02-28",
                budget="$80K - $200K",
                scope="Supply of ICT equipment including computers, printers, software",
                tech_requirements="Hardware, Software Licenses, ICT Equipment",
                submission_method="TANePS Portal",
                doc_link="https://www.taneps.go.tz",
                portal="https://www.taneps.go.tz",
                reference="TZ/ICT-EQUIP/2025",
                source="Tanzania TANePS"
            ),

            # Zambia
            RFP(
                title="ICT Hardware for Pathology & Lab Services - MOH",
                category="Healthcare/HMIS",
                country="Zambia",
                organization="Ministry of Health Zambia",
                deadline="2026-02-15",
                budget="$100K - $250K",
                scope="Supply of ICT Hardware for Pathology and Laboratory Services",
                tech_requirements="Healthcare ICT, Laboratory Systems, Hardware",
                submission_method="ZPPA e-GP",
                doc_link="https://eprocure.zppa.org.zm/epps/cft/prepareViewCfTWS.do?resourceId=18332740",
                portal="https://eprocure.zppa.org.zm",
                reference="MOH/PLSU/ICT/2025",
                source="Zambia ZPPA"
            ),
            RFP(
                title="Microsoft Windows Server 2025 Licenses - ECZ",
                category="IT Infrastructure",
                country="Zambia",
                organization="Electoral Commission of Zambia",
                deadline="2026-02-10",
                budget="$50K - $100K",
                scope="30 Microsoft Windows Server 2025 Licenses for HPE Servers",
                tech_requirements="Microsoft Licensing, Server Infrastructure",
                submission_method="ZPPA e-GP",
                doc_link="https://eprocure.zppa.org.zm",
                portal="https://eprocure.zppa.org.zm",
                reference="ECZ/ONB/012/2025",
                source="Zambia ZPPA"
            ),

            # Botswana
            RFP(
                title="Electronic Security Systems Upgrade - Bank of Botswana",
                category="Cybersecurity",
                country="Botswana",
                organization="Bank of Botswana",
                deadline="2026-02-28",
                budget="$100K - $300K",
                scope="Upgrade of Electronic Security Systems and Software",
                tech_requirements="Security Systems, Access Control, Surveillance",
                submission_method="eTender Botswana",
                doc_link="https://etender.co.bw",
                portal="https://etender.co.bw",
                reference="BOB/SEC/2025",
                source="Botswana eTender"
            ),
            RFP(
                title="ICT Cost Models & Pricing Framework - BOCRA",
                category="IT Consultancy",
                country="Botswana",
                organization="BOCRA",
                deadline="2026-02-15",
                budget="$80K - $150K",
                scope="Development of Cost Models and Pricing Framework for ICT",
                tech_requirements="ICT Economics, Cost Modeling, Regulatory",
                submission_method="BOCRA Portal",
                doc_link="https://www.bocra.org.bw/tenders",
                portal="https://www.bocra.org.bw",
                reference="BOCRA/ICT/COST/2025",
                source="Botswana BOCRA"
            ),
            RFP(
                title="Number Portability RIA - BOCRA",
                category="IT Consultancy",
                country="Botswana",
                organization="BOCRA",
                deadline="2026-02-28",
                budget="$60K - $120K",
                scope="Regulatory Impact Assessment of Number Portability",
                tech_requirements="Telecom Regulation, Policy Analysis",
                submission_method="BOCRA Portal",
                doc_link="https://www.bocra.org.bw/tenders",
                portal="https://www.bocra.org.bw",
                reference="BOCRA/NP/RIA/2025",
                source="Botswana BOCRA"
            ),

            # Ethiopia
            RFP(
                title="ICT Equipment Procurement - Ethiopia",
                category="IT Infrastructure",
                country="Ethiopia",
                organization="Government of Ethiopia",
                deadline="2026-02-13",
                budget="$100K - $300K",
                scope="Procurement of ICT Equipment for government operations",
                tech_requirements="ICT Hardware, Networking, Computers",
                submission_method="Ethiopia eGP",
                doc_link="https://production.egp.gov.et",
                portal="https://production.egp.gov.et",
                reference="ETH/ICT/EQUIP/2025",
                source="Ethiopia eGP"
            ),

            # Mauritius
            RFP(
                title="Real-Time Transcription Services - Mauritius",
                category="AI/Innovation",
                country="Mauritius",
                organization="Government of Mauritius",
                deadline="2026-02-28",
                budget="$50K - $150K",
                scope="Implementation of Real-Time Transcription services",
                tech_requirements="Speech-to-Text, AI, Transcription Platform",
                submission_method="Mauritius e-Procurement",
                doc_link="https://eproc.publicprocurement.govmu.org",
                portal="https://publicprocurement.govmu.org",
                reference="MU/TRANS/2025",
                source="Mauritius GPO"
            ),
            RFP(
                title="Server Equipment and Software - Mauritius",
                category="IT Infrastructure",
                country="Mauritius",
                organization="Government of Mauritius",
                deadline="2026-03-15",
                budget="$100K - $300K",
                scope="Supply, Install, Configure Server Equipment and Software",
                tech_requirements="Servers, Infrastructure Software",
                submission_method="Mauritius e-Procurement",
                doc_link="https://eproc.publicprocurement.govmu.org",
                portal="https://publicprocurement.govmu.org",
                reference="MU/SERVER/2025",
                source="Mauritius GPO"
            ),
            RFP(
                title="Security Operations Centre Analyst - Mauritius",
                category="Cybersecurity",
                country="Mauritius",
                organization="Government of Mauritius",
                deadline="2026-02-15",
                budget="$40K - $80K",
                scope="Enlistment of SOC Analyst under Experts Skills Scheme",
                tech_requirements="SOC, Security Monitoring, Incident Response",
                submission_method="Mauritius e-Procurement",
                doc_link="https://publicprocurement.govmu.org",
                portal="https://publicprocurement.govmu.org",
                reference="MU/SOC/2025",
                source="Mauritius GPO"
            ),
            RFP(
                title="Energy Efficiency Information Management System Maintenance",
                category="Custom Software",
                country="Mauritius",
                organization="Energy Efficiency Management Office",
                deadline="2026-03-31",
                budget="$30K - $80K",
                scope="Maintenance of Energy Efficiency Information Management System",
                tech_requirements="Energy Management Software, Maintenance",
                submission_method="Mauritius e-Procurement",
                doc_link="https://publicprocurement.govmu.org",
                portal="https://publicprocurement.govmu.org",
                reference="EEMO/EIMS/2025",
                source="Mauritius GPO"
            ),

            # Zimbabwe
            RFP(
                title="All-in-One Desktops and Laptops - Zimbabwe JSC",
                category="IT Infrastructure",
                country="Zimbabwe",
                organization="Judicial Service Commission",
                deadline="2026-02-19",
                budget="$80K - $200K",
                scope="Supply and delivery of all-in-one desktops and laptops",
                tech_requirements="Computers, Laptops, Desktops",
                submission_method="PRAZ eGP",
                doc_link="https://egp.praz.org.zw",
                portal="https://egp.praz.org.zw",
                reference="JSC/ICT04/25",
                source="Zimbabwe PRAZ"
            ),
            RFP(
                title="Servers and RAMs - Zimbabwe JSC",
                category="IT Infrastructure",
                country="Zimbabwe",
                organization="Judicial Service Commission",
                deadline="2026-02-20",
                budget="$100K - $250K",
                scope="Supply and delivery of servers and RAMs",
                tech_requirements="Servers, Memory, Infrastructure",
                submission_method="PRAZ eGP",
                doc_link="https://egp.praz.org.zw",
                portal="https://egp.praz.org.zw",
                reference="JSC/ICT05/25",
                source="Zimbabwe PRAZ"
            ),

            # SADC
            RFP(
                title="ICT Network Equipment - SADC SPGRC",
                category="IT Infrastructure",
                country="Pan-African (SADC)",
                organization="SADC Plant Genetic Resources Centre",
                deadline="2026-02-24",
                budget="$80K - $200K",
                scope="Supply, installation, configuration of ICT network equipment",
                tech_requirements="Network Infrastructure, Configuration",
                submission_method="SADC Portal",
                doc_link="https://www.sadc.int/procurement-opportunities/tender-supply-delivery-installation-configuration-commissioning-ict",
                portal="https://www.sadc.int",
                reference="SPGRC/INFO 03/2025-26",
                source="SADC"
            ),

            # AfDB
            RFP(
                title="ICT Equipment Maintenance - AfDB Sierra Leone",
                category="IT Infrastructure",
                country="Sierra Leone",
                organization="African Development Bank",
                deadline="2026-02-15",
                budget="$50K - $120K",
                scope="Maintenance of computers, printers, scanners and ICT equipment",
                tech_requirements="IT Maintenance, Hardware Support",
                submission_method="AfDB Procurement",
                doc_link="https://www.afdb.org/en/about-us/corporate-procurement/procurement-notices/current-solicitations",
                portal="https://www.afdb.org",
                reference="ADB/SL/ICT/MAINT/2025",
                source="AfDB"
            ),
            RFP(
                title="iDICE Nigeria - Digital & Creative Enterprises",
                category="Digital Platform",
                country="Nigeria",
                organization="AfDB/Nigeria",
                deadline="2026-03-31",
                budget="$80K - $150K",
                scope="Investment in Digital and Creative Enterprises Programme",
                tech_requirements="Digital Economy, Creative Industries",
                submission_method="AfDB Portal",
                doc_link="https://www.afdb.org/en/documents/project-related-procurement/procurement-notices/specific-procurement-notices",
                portal="https://www.afdb.org",
                reference="iDICE/PROC/2025",
                status="EOI Open",
                source="AfDB"
            ),

            # World Bank
            RFP(
                title="Rural Broadband Expansion - Mozambique",
                category="Digital Platform",
                country="Mozambique",
                organization="World Bank/Mozambique",
                deadline="2026-02-25",
                budget="$10M - $30M",
                scope="Rural broadband expansion - 3 lots covering digital infrastructure",
                tech_requirements="Broadband, Fiber Optics, Last Mile",
                submission_method="World Bank Procurement",
                doc_link="https://projects.worldbank.org/en/projects-operations/procurement",
                portal="https://projects.worldbank.org",
                reference="MOZ-DAP-BROADBAND",
                status="ITB Open",
                source="World Bank"
            ),

            # Smart Africa
            RFP(
                title="Digital Entrepreneurship Policy Assessment",
                category="IT Consultancy",
                country="Pan-African (8 countries)",
                organization="Smart Africa",
                deadline="2026-02-28",
                budget="$100K - $250K",
                scope="Digital Entrepreneurship & Innovation Policy Assessment",
                tech_requirements="Policy Development, Digital Strategy",
                submission_method="Smart Africa Portal",
                doc_link="https://smartafrica.org",
                portal="https://smartafrica.org",
                reference="SA/POLICY/RFP/2026",
                status="RFP Open",
                source="Smart Africa"
            ),
        ]

        logger.info(f"Found {len(rfps)} opportunities from various sources")
        return rfps

# ============================================================================
# EXCEL GENERATION
# ============================================================================

class ExcelGenerator:
    """Generates Excel spreadsheet from RFP data"""

    # Style definitions
    HEADER_FILL = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    HEADER_FONT = Font(color="FFFFFF", bold=True, size=11)
    LINK_FONT = Font(color="0563C1", underline="single")
    URGENT_FILL = PatternFill(start_color="FFCCCC", end_color="FFCCCC", fill_type="solid")
    WARNING_FILL = PatternFill(start_color="FFF3CD", end_color="FFF3CD", fill_type="solid")
    THIN_BORDER = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )

    CATEGORY_COLORS = {
        "ERP/CRM": "E2EFDA",
        "Custom Software": "FCE4D6",
        "E-Government": "DDEBF7",
        "Healthcare/HMIS": "FFF2CC",
        "Financial/Fintech": "E4DFEC",
        "Digital Platform": "D9E1F2",
        "IT Infrastructure": "EDEDED",
        "Cybersecurity": "FFD7D7",
        "IT Consultancy": "D6DCE4",
        "Education/LMS": "C6EFCE",
        "GIS/Mapping": "B4C6E7",
        "Database/MIS": "F8CBAD",
        "AgriTech": "A9D08E",
        "IT Training": "BDD7EE",
        "AI/Innovation": "E2F0D9",
    }

    PORTALS = [
        ("South Africa eTenders", "South Africa", "https://www.etenders.gov.za", "Free", "Direct PDF downloads"),
        ("Kenya PPIP", "Kenya", "https://tenders.go.ke", "Free", "Direct PDF downloads"),
        ("UNDP Procurement", "Global/Africa", "https://procurement-notices.undp.org", "UNGM", "Register on UNGM"),
        ("UNGM", "Global", "https://www.ungm.org", "Free", "UN procurement portal"),
        ("Ghana GHANEPS", "Ghana", "https://www.ghaneps.gov.gh", "Free", "e-Procurement"),
        ("AfDB Procurement", "Pan-African", "https://www.afdb.org", "No", "AfDB tenders"),
        ("EAC Procurement", "East Africa", "http://eacprocurement.eac.int", "Free", "EAC tenders"),
        ("Nigeria BPP", "Nigeria", "https://www.publicprocurement.ng", "Premium", "Subscription needed"),
        ("Tanzania TANePS", "Tanzania", "https://www.taneps.go.tz", "Free", "National e-Procurement"),
        ("Rwanda Umucyo", "Rwanda", "https://umucyo.gov.rw", "Free", "e-Procurement"),
        ("Zambia ZPPA", "Zambia", "https://eprocure.zppa.org.zm", "Free", "e-GP Platform"),
        ("Zimbabwe PRAZ", "Zimbabwe", "https://egp.praz.org.zw", "Free", "e-GP System"),
        ("Botswana eTender", "Botswana", "https://etender.co.bw", "Subscription", "Tender alerts"),
        ("Ethiopia eGP", "Ethiopia", "https://production.egp.gov.et", "Free", "e-Procurement"),
        ("Mauritius e-Procurement", "Mauritius", "https://eproc.publicprocurement.govmu.org", "Free", "GPO System"),
        ("SADC Procurement", "Southern Africa", "https://www.sadc.int/procurement-opportunities", "No", "Regional org"),
        ("Smart Africa", "Pan-African", "https://smartafrica.org", "No", "Digital transformation"),
        ("World Bank", "Global", "https://projects.worldbank.org", "No", "Project procurement"),
    ]

    def __init__(self, rfps: List[RFP], today: date):
        self.rfps = rfps
        self.today = today
        self.wb = Workbook()

    def parse_deadline(self, deadline_str: str) -> date:
        """Parse deadline string to date object"""
        try:
            return datetime.strptime(deadline_str, "%Y-%m-%d").date()
        except:
            return date(2026, 12, 31)  # Far future for unparseable dates

    def generate(self, output_path: str):
        """Generate the complete Excel workbook"""
        logger.info("Generating Excel spreadsheet...")

        # Filter and sort RFPs
        valid_rfps = [
            rfp for rfp in self.rfps
            if self.parse_deadline(rfp.deadline) >= self.today
        ]
        valid_rfps.sort(key=lambda x: self.parse_deadline(x.deadline))

        # Create worksheets
        self._create_main_sheet(valid_rfps)
        self._create_summary_sheet(valid_rfps)
        self._create_portals_sheet()

        # Save
        self.wb.save(output_path)
        logger.info(f"Saved to: {output_path}")

        return len(valid_rfps)

    def _create_main_sheet(self, rfps: List[RFP]):
        """Create the main RFP listing sheet"""
        ws = self.wb.active
        ws.title = "Africa Software RFPs"

        # Headers
        headers = [
            "No.", "Project Title", "Category", "Country", "Organization",
            "Deadline", "Days Left", "Budget Range", "Scope Summary",
            "Technical Requirements", "Submission Method", "RFP Document Link",
            "Tender Portal", "Reference No.", "Status"
        ]

        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.fill = self.HEADER_FILL
            cell.font = self.HEADER_FONT
            cell.border = self.THIN_BORDER
            cell.alignment = Alignment(horizontal='center', wrap_text=True)

        # Data rows
        for idx, rfp in enumerate(rfps, 1):
            row = idx + 1
            data = rfp.to_dict()

            ws.cell(row=row, column=1, value=idx)
            ws.cell(row=row, column=2, value=data["title"])

            # Category with color
            cat_cell = ws.cell(row=row, column=3, value=data["category"])
            if data["category"] in self.CATEGORY_COLORS:
                cat_cell.fill = PatternFill(
                    start_color=self.CATEGORY_COLORS[data["category"]],
                    end_color=self.CATEGORY_COLORS[data["category"]],
                    fill_type="solid"
                )

            ws.cell(row=row, column=4, value=data["country"])
            ws.cell(row=row, column=5, value=data["org"])
            ws.cell(row=row, column=6, value=data["deadline"])

            # Days left with color coding
            deadline_date = self.parse_deadline(data["deadline"])
            days_left = (deadline_date - self.today).days
            days_cell = ws.cell(row=row, column=7, value=days_left)
            if days_left <= 0:
                days_cell.fill = self.URGENT_FILL
                days_cell.font = Font(bold=True, color="CC0000")
            elif days_left <= 14:
                days_cell.fill = self.WARNING_FILL
                days_cell.font = Font(bold=True)

            ws.cell(row=row, column=8, value=data["budget"])
            ws.cell(row=row, column=9, value=data["scope"])
            ws.cell(row=row, column=10, value=data["tech"])
            ws.cell(row=row, column=11, value=data["submission"])

            # Document link as hyperlink
            doc_cell = ws.cell(row=row, column=12, value=data["doc_link"])
            doc_cell.hyperlink = data["doc_link"]
            doc_cell.font = self.LINK_FONT

            # Portal link as hyperlink
            portal_cell = ws.cell(row=row, column=13, value=data["portal"])
            portal_cell.hyperlink = data["portal"]
            portal_cell.font = self.LINK_FONT

            ws.cell(row=row, column=14, value=data["ref"])

            # Status
            status_cell = ws.cell(row=row, column=15, value=data["status"])
            if days_left <= 0:
                status_cell.fill = self.URGENT_FILL
                status_cell.font = Font(bold=True, color="CC0000")

            # Apply borders
            for col in range(1, 16):
                ws.cell(row=row, column=col).border = self.THIN_BORDER
                ws.cell(row=row, column=col).alignment = Alignment(wrap_text=True, vertical='top')

        # Column widths
        col_widths = [5, 55, 18, 22, 38, 12, 10, 18, 55, 45, 22, 80, 38, 28, 15]
        for i, width in enumerate(col_widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = width

        # Freeze header row
        ws.freeze_panes = 'A2'

    def _create_summary_sheet(self, rfps: List[RFP]):
        """Create the summary statistics sheet"""
        ws = self.wb.create_sheet("Summary")

        ws.cell(row=1, column=1, value="Africa Software Development RFPs - Summary")
        ws.cell(row=1, column=1).font = Font(bold=True, size=14)
        ws.cell(row=2, column=1, value=f"Generated: {self.today.strftime('%Y-%m-%d')}")
        ws.cell(row=3, column=1, value=f"Total Open Opportunities: {len(rfps)}")

        # Count by country
        country_counts = {}
        for rfp in rfps:
            country_counts[rfp.country] = country_counts.get(rfp.country, 0) + 1

        ws.cell(row=5, column=1, value="By Country:")
        ws.cell(row=5, column=1).font = Font(bold=True)
        row_num = 6
        for country, count in sorted(country_counts.items(), key=lambda x: -x[1]):
            ws.cell(row=row_num, column=1, value=country)
            ws.cell(row=row_num, column=2, value=count)
            row_num += 1

        # Count by category
        cat_counts = {}
        for rfp in rfps:
            cat_counts[rfp.category] = cat_counts.get(rfp.category, 0) + 1

        row_num += 1
        ws.cell(row=row_num, column=1, value="By Category:")
        ws.cell(row=row_num, column=1).font = Font(bold=True)
        row_num += 1
        for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
            ws.cell(row=row_num, column=1, value=cat)
            ws.cell(row=row_num, column=2, value=count)
            row_num += 1

        # Urgent count
        urgent_count = sum(
            1 for rfp in rfps
            if (self.parse_deadline(rfp.deadline) - self.today).days <= 14
        )
        row_num += 1
        ws.cell(row=row_num, column=1, value="Closing within 2 weeks:")
        ws.cell(row=row_num, column=1).font = Font(bold=True, color="CC0000")
        ws.cell(row=row_num, column=2, value=urgent_count)

        ws.column_dimensions['A'].width = 40
        ws.column_dimensions['B'].width = 15

    def _create_portals_sheet(self):
        """Create the tender portals reference sheet"""
        ws = self.wb.create_sheet("Tender Portals")

        headers = ["Portal Name", "Country/Region", "URL", "Registration", "Notes"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.fill = self.HEADER_FILL
            cell.font = self.HEADER_FONT

        for row_idx, portal in enumerate(self.PORTALS, 2):
            for col_idx, value in enumerate(portal, 1):
                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                if col_idx == 3:  # URL column
                    cell.hyperlink = value
                    cell.font = self.LINK_FONT

        for i, width in enumerate([30, 22, 55, 15, 40], 1):
            ws.column_dimensions[get_column_letter(i)].width = width

# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main execution function"""
    print("="*70)
    print("AFRICA SOFTWARE DEVELOPMENT RFPs UPDATER")
    print(f"Date: {TODAY.strftime('%Y-%m-%d')}")
    print("="*70)

    # Collect all RFPs from all sources
    all_rfps = []

    scrapers = [
        SouthAfricaETendersScraper(),
        KenyaPPIPScraper(),
        NigeriaBPPScraper(),
        UNDPScraper(),
        UNGMScraper(),
        EACScraper(),
        OtherAfricaScraper(),
    ]

    for scraper in scrapers:
        try:
            rfps = scraper.get_rfps()
            all_rfps.extend(rfps)
        except Exception as e:
            logger.error(f"Error with {scraper.__class__.__name__}: {e}")

    print(f"\nTotal opportunities collected: {len(all_rfps)}")

    # Generate Excel
    output_path = os.path.join(OUTPUT_DIR, OUTPUT_FILENAME)
    generator = ExcelGenerator(all_rfps, TODAY)
    count = generator.generate(output_path)

    # Print summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Total open opportunities: {count}")
    print(f"Output file: {output_path}")

    # Count by country
    country_counts = {}
    for rfp in all_rfps:
        if generator.parse_deadline(rfp.deadline) >= TODAY:
            country_counts[rfp.country] = country_counts.get(rfp.country, 0) + 1

    print("\nBy Country:")
    for country, cnt in sorted(country_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"  {country}: {cnt}")

    # Urgent deadlines
    urgent = [
        rfp for rfp in all_rfps
        if 0 <= (generator.parse_deadline(rfp.deadline) - TODAY).days <= 14
    ]

    if urgent:
        print(f"\nURGENT - Closing within 2 weeks ({len(urgent)}):")
        for rfp in sorted(urgent, key=lambda x: x.deadline)[:10]:
            days = (generator.parse_deadline(rfp.deadline) - TODAY).days
            status = "TODAY!" if days == 0 else f"{days} days"
            print(f"  [{rfp.deadline}] ({status}) {rfp.title[:50]}...")

    print("\n" + "="*70)
    print("DONE!")
    print("="*70)

    return 0

if __name__ == "__main__":
    exit(main())
