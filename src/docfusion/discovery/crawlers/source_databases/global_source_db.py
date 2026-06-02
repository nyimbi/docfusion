#!/usr/bin/env python3
"""
Global Procurement Source Database

Comprehensive database of 1000+ procurement sources worldwide including:
- Government procurement portals
- Corporate procurement platforms
- International organization tenders
- Foundation grants
- Educational institution procurement
- Healthcare procurement systems
- Defense and military contracts
- Municipal and local government tenders

This database includes source metadata, categorization, access patterns,
and health monitoring for optimal scraping performance.
"""

import asyncio
import json
import logging
import sqlite3
import aiofiles
from typing import ClassVar, Dict, List, Optional, Any, Set
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from enum import Enum
import csv

from pydantic import BaseModel, Field, HttpUrl
from ....core.utils import uuid7str

class SourceType(str, Enum):
	"""Types of procurement sources"""
	GOVERNMENT_FEDERAL = "government_federal"
	GOVERNMENT_STATE = "government_state"
	GOVERNMENT_LOCAL = "government_local"
	GOVERNMENT_INTERNATIONAL = "government_international"
	CORPORATE = "corporate"
	HEALTHCARE = "healthcare"
	EDUCATION = "education"
	DEFENSE = "defense"
	UTILITIES = "utilities"
	TRANSPORTATION = "transportation"
	FOUNDATION = "foundation"
	NONPROFIT = "nonprofit"
	MARKETPLACE = "marketplace"
	AGGREGATOR = "aggregator"

class SourceStatus(str, Enum):
	"""Health status of procurement sources"""
	ACTIVE = "active"
	SLOW = "slow"
	INTERMITTENT = "intermittent"
	DOWN = "down"
	BLOCKED = "blocked"
	REQUIRES_LOGIN = "requires_login"
	REQUIRES_SUBSCRIPTION = "requires_subscription"
	DEPRECATED = "deprecated"

class AccessMethod(str, Enum):
	"""How to access the procurement source"""
	HTTP_GET = "http_get"
	HTTP_POST = "http_post"
	API_REST = "api_rest"
	API_GRAPHQL = "api_graphql"
	RSS_FEED = "rss_feed"
	XML_FEED = "xml_feed"
	FTP = "ftp"
	EMAIL_SUBSCRIPTION = "email_subscription"
	MANUAL_DOWNLOAD = "manual_download"

class GeographicScope(str, Enum):
	"""Geographic scope of procurement source"""
	GLOBAL = "global"
	CONTINENTAL = "continental"
	NATIONAL = "national"
	REGIONAL = "regional"
	STATE_PROVINCIAL = "state_provincial"
	MUNICIPAL = "municipal"
	LOCAL = "local"

class ProcurementSource(BaseModel):
	"""Represents a procurement source in the database"""
	source_id: str = Field(default_factory=uuid7str)
	name: str
	url: HttpUrl
	base_domain: str
	
	# Classification
	source_type: SourceType
	geographic_scope: GeographicScope
	country: str
	region: Optional[str] = None
	language: str = "en"
	
	# Technical details
	access_method: AccessMethod = AccessMethod.HTTP_GET
	requires_login: bool = False
	requires_subscription: bool = False
	has_api: bool = False
	api_endpoint: Optional[HttpUrl] = None
	api_key_required: bool = False
	
	# Content characteristics
	typical_opportunities_per_day: int = 0
	opportunity_types: List[str] = Field(default_factory=list)
	value_ranges: List[str] = Field(default_factory=list)  # e.g., ["$10K-$50K", "$50K-$500K"]
	
	# Scraping configuration
	recommended_scraper: str = "universal"  # universal, vision, cloudscraper, etc.
	scraping_frequency: str = "daily"  # hourly, daily, weekly
	rate_limit_rps: float = 1.0  # requests per second
	requires_proxy: bool = False
	requires_javascript: bool = False
	
	# Navigation patterns
	opportunity_list_url: Optional[str] = None
	search_url: Optional[str] = None
	pagination_pattern: Optional[str] = None
	
	# Content selectors (learned patterns)
	title_selector: Optional[str] = None
	description_selector: Optional[str] = None
	deadline_selector: Optional[str] = None
	value_selector: Optional[str] = None
	reference_selector: Optional[str] = None
	
	# Health monitoring
	status: SourceStatus = SourceStatus.ACTIVE
	last_successful_scrape: Optional[datetime] = None
	last_check: Optional[datetime] = None
	consecutive_failures: int = 0
	average_response_time: Optional[float] = None
	
	# Performance metrics
	success_rate_30d: float = 0.0
	opportunities_found_30d: int = 0
	avg_processing_time: float = 0.0
	
	# Metadata
	added_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	updated_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	verified_date: Optional[datetime] = None
	notes: Optional[str] = None
	tags: List[str] = Field(default_factory=list)

class GlobalSourceDB:
	"""
	Global database of procurement sources with management and monitoring capabilities
	"""
	

	# Allowlist of valid column names for procurement_sources table (SQL injection prevention)
	_VALID_SOURCE_COLUMNS: ClassVar[frozenset] = frozenset({
		'source_id', 'name', 'url', 'base_domain', 'source_type',
		'geographic_scope', 'country', 'region', 'language',
		'access_method', 'requires_login', 'requires_subscription',
		'has_api', 'api_endpoint', 'api_key_required',
		'typical_opportunities_per_day', 'opportunity_types',
		'value_ranges', 'recommended_scraper', 'scraping_frequency',
		'rate_limit_rps', 'requires_proxy', 'requires_javascript',
		'opportunity_list_url', 'search_url', 'pagination_pattern',
		'title_selector', 'description_selector', 'deadline_selector',
		'value_selector', 'reference_selector', 'status',
		'last_successful_scrape', 'last_check', 'consecutive_failures',
		'average_response_time', 'success_rate_30d',
		'opportunities_found_30d', 'avg_processing_time',
		'added_date', 'updated_date', 'verified_date', 'notes', 'tags'
	})

	def __init__(self, db_path: Optional[Path] = None):
		self.logger = logging.getLogger(__name__)
		self.db_path = db_path or Path("procurement_sources.db")
		
		# In-memory cache for performance
		self.sources_cache: Dict[str, ProcurementSource] = {}
		self.cache_last_updated: Optional[datetime] = None
		self.cache_ttl = timedelta(hours=1)
		
		# Source categories for easy access
		self.sources_by_type: Dict[SourceType, List[str]] = {}
		self.sources_by_country: Dict[str, List[str]] = {}
		self.active_sources: Set[str] = set()
		
		# Initialize database
		asyncio.create_task(self._initialize_database())
		asyncio.create_task(self._load_initial_sources())
	
	async def _initialize_database(self):
		"""Initialize SQLite database with proper schema"""
		try:
			# Create database and tables
			conn = sqlite3.connect(self.db_path)
			cursor = conn.cursor()
			
			# Main sources table
			cursor.execute('''
				CREATE TABLE IF NOT EXISTS procurement_sources (
					source_id TEXT PRIMARY KEY,
					name TEXT NOT NULL,
					url TEXT NOT NULL,
					base_domain TEXT NOT NULL,
					source_type TEXT NOT NULL,
					geographic_scope TEXT NOT NULL,
					country TEXT NOT NULL,
					region TEXT,
					language TEXT DEFAULT 'en',
					access_method TEXT DEFAULT 'http_get',
					requires_login BOOLEAN DEFAULT FALSE,
					requires_subscription BOOLEAN DEFAULT FALSE,
					has_api BOOLEAN DEFAULT FALSE,
					api_endpoint TEXT,
					api_key_required BOOLEAN DEFAULT FALSE,
					typical_opportunities_per_day INTEGER DEFAULT 0,
					opportunity_types TEXT,  -- JSON array
					value_ranges TEXT,       -- JSON array
					recommended_scraper TEXT DEFAULT 'universal',
					scraping_frequency TEXT DEFAULT 'daily',
					rate_limit_rps REAL DEFAULT 1.0,
					requires_proxy BOOLEAN DEFAULT FALSE,
					requires_javascript BOOLEAN DEFAULT FALSE,
					opportunity_list_url TEXT,
					search_url TEXT,
					pagination_pattern TEXT,
					title_selector TEXT,
					description_selector TEXT,
					deadline_selector TEXT,
					value_selector TEXT,
					reference_selector TEXT,
					status TEXT DEFAULT 'active',
					last_successful_scrape TIMESTAMP,
					last_check TIMESTAMP,
					consecutive_failures INTEGER DEFAULT 0,
					average_response_time REAL,
					success_rate_30d REAL DEFAULT 0.0,
					opportunities_found_30d INTEGER DEFAULT 0,
					avg_processing_time REAL DEFAULT 0.0,
					added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					verified_date TIMESTAMP,
					notes TEXT,
					tags TEXT  -- JSON array
				)
			''')
			
			# Health monitoring table
			cursor.execute('''
				CREATE TABLE IF NOT EXISTS source_health_log (
					log_id TEXT PRIMARY KEY,
					source_id TEXT NOT NULL,
					check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					status TEXT NOT NULL,
					response_time REAL,
					opportunities_found INTEGER,
					error_message TEXT,
					FOREIGN KEY (source_id) REFERENCES procurement_sources (source_id)
				)
			''')
			
			# Create indexes for performance
			cursor.execute('CREATE INDEX IF NOT EXISTS idx_source_type ON procurement_sources (source_type)')
			cursor.execute('CREATE INDEX IF NOT EXISTS idx_country ON procurement_sources (country)')
			cursor.execute('CREATE INDEX IF NOT EXISTS idx_status ON procurement_sources (status)')
			cursor.execute('CREATE INDEX IF NOT EXISTS idx_domain ON procurement_sources (base_domain)')
			cursor.execute('CREATE INDEX IF NOT EXISTS idx_health_source ON source_health_log (source_id)')
			cursor.execute('CREATE INDEX IF NOT EXISTS idx_health_time ON source_health_log (check_time)')
			
			conn.commit()
			conn.close()
			
			self.logger.info("Database initialized successfully")
			
		except Exception as e:
			self.logger.error(f"Failed to initialize database: {e}")
			raise
	
	async def _load_initial_sources(self):
		"""Load comprehensive list of procurement sources"""
		try:
			# Check if we already have sources
			if await self.get_total_sources() > 100:
				self.logger.info(f"Database already contains {await self.get_total_sources()} sources")
				return
			
			self.logger.info("Loading initial procurement sources...")
			
			# Load sources from different categories
			await self._load_government_sources()
			await self._load_african_sources()
			await self._load_corporate_sources()
			await self._load_international_sources()
			await self._load_foundation_sources()
			await self._load_ngo_sources()
			await self._load_marketplace_sources()
			await self._load_pacific_caribbean_sources()
			await self._load_african_multilateral_sources()
			await self._load_grant_organization_sources()
			await self._load_global_expansion_sources()
			
			total = await self.get_total_sources()
			self.logger.info(f"Loaded {total} procurement sources")
			
		except Exception as e:
			self.logger.error(f"Failed to load initial sources: {e}")
	
	async def _load_government_sources(self):
		"""Load government procurement sources worldwide"""
		government_sources = [
			# United States Federal
			{
				"name": "SAM.gov (System for Award Management)",
				"url": "https://sam.gov/content/opportunities",
				"country": "US",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 200,
				"opportunity_types": ["Federal Contracts", "Grants", "RFPs"],
				"value_ranges": ["$25K+", "$100K+", "$1M+"],
				"recommended_scraper": "crawl4ai_llm",
				"requires_javascript": True,
				"notes": "Primary US federal procurement portal"
			},
			{
				"name": "FedBizOpps Archive",
				"url": "https://www.fbo.gov/",
				"country": "US",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 50,
				"status": SourceStatus.DEPRECATED,
				"notes": "Historical - redirects to SAM.gov"
			},
			{
				"name": "GSA eBuy",
				"url": "https://www.ebuy.gsa.gov/",
				"country": "US",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 30,
				"opportunity_types": ["GSA Schedule Orders", "Blanket Purchase Agreements"],
				"recommended_scraper": "playwright_stealth"
			},
			
			# United Kingdom
			{
				"name": "Contracts Finder",
				"url": "https://www.contractsfinder.service.gov.uk/",
				"country": "GB",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 100,
				"opportunity_types": ["Public Sector Contracts", "Tenders"],
				"value_ranges": ["£10K+", "£100K+"],
				"recommended_scraper": "universal"
			},
			{
				"name": "Find a Tender Service (FTS)",
				"url": "https://www.find-tender.service.gov.uk/",
				"country": "GB",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 50,
				"opportunity_types": ["Above Threshold Tenders"],
				"recommended_scraper": "crawl4ai_llm"
			},
			
			# European Union
			{
				"name": "Tenders Electronic Daily (TED)",
				"url": "https://ted.europa.eu/",
				"country": "EU",
				"source_type": SourceType.GOVERNMENT_INTERNATIONAL,
				"geographic_scope": GeographicScope.CONTINENTAL,
				"typical_opportunities_per_day": 500,
				"opportunity_types": ["Public Procurement", "EU Tenders"],
				"value_ranges": ["€134K+", "€5.35M+"],
				"has_api": True,
				"api_endpoint": "https://ted.europa.eu/api/",
				"recommended_scraper": "universal",
				"language": "multi"
			},
			
			# Canada
			{
				"name": "Buy and Sell (Government of Canada)",
				"url": "https://buyandsell.gc.ca/",
				"country": "CA",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 80,
				"opportunity_types": ["Government Contracts", "Standing Offers"],
				"recommended_scraper": "universal",
				"language": "en,fr"
			},
			{
				"name": "MERX Canadian Public Tenders",
				"url": "https://www.merx.com/",
				"country": "CA",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 150,
				"requires_subscription": True,
				"opportunity_types": ["Public Tenders", "Private Bids"],
				"recommended_scraper": "cloudscraper"
			},
			
			# Australia
			{
				"name": "AusTender",
				"url": "https://www.tenders.gov.au/",
				"country": "AU",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 60,
				"opportunity_types": ["Commonwealth Procurement"],
				"recommended_scraper": "universal"
			},
			
			# Germany
			{
				"name": "Bund.de Ausschreibungen",
				"url": "https://www.bund.de/SiteGlobals/Forms/Suche/Ausschreibungssuche_Formular.html",
				"country": "DE",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 80,
				"language": "de",
				"recommended_scraper": "playwright_stealth"
			},
			{
				"name": "Vergabe24",
				"url": "https://www.vergabe24.de/",
				"country": "DE",
				"source_type": SourceType.MARKETPLACE,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 100,
				"language": "de",
				"recommended_scraper": "universal"
			},
			
			# France
			{
				"name": "BOAMP (Bulletin Officiel des Annonces de Marchés Publics)",
				"url": "https://www.boamp.fr/",
				"country": "FR",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 120,
				"language": "fr",
				"recommended_scraper": "crawl4ai_llm"
			},
			
			# Netherlands
			{
				"name": "TenderNed",
				"url": "https://www.tenderned.nl/",
				"country": "NL",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 70,
				"language": "nl",
				"recommended_scraper": "universal"
			},
			
			# Spain
			{
				"name": "Plataforma de Contratación del Estado",
				"url": "https://contrataciondelestado.es/",
				"country": "ES",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 90,
				"language": "es",
				"recommended_scraper": "universal"
			},
			
			# Italy
			{
				"name": "CONSIP - Acquisti in Rete",
				"url": "https://www.acquistinretepa.it/",
				"country": "IT",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 60,
				"language": "it",
				"recommended_scraper": "universal"
			},
			
			# Nordic Countries
			{
				"name": "DOFFIN (Norway)",
				"url": "https://doffin.no/",
				"country": "NO",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 40,
				"language": "no",
				"recommended_scraper": "universal"
			},
			{
				"name": "Upphandling24 (Sweden)",
				"url": "https://www.upphandling24.se/",
				"country": "SE",
				"source_type": SourceType.MARKETPLACE,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 50,
				"language": "sv",
				"recommended_scraper": "universal"
			},
			
			# Asia-Pacific
			{
				"name": "Government Electronic Trading Services (GeTS) - Singapore",
				"url": "https://www.gebiz.gov.sg/",
				"country": "SG",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 30,
				"recommended_scraper": "playwright_stealth"
			},
			{
				"name": "JETRO (Japan External Trade Organization)",
				"url": "https://www.jetro.go.jp/en/database/procurement/",
				"country": "JP",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 20,
				"language": "ja,en",
				"recommended_scraper": "universal"
			},
			{
				"name": "Korea ON-line E-Procurement System (KONEPS)",
				"url": "https://www.g2b.go.kr/",
				"country": "KR",
				"source_type": SourceType.GOVERNMENT_FEDERAL,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 100,
				"language": "ko",
				"recommended_scraper": "playwright_stealth"
			},
			
			# State/Regional Examples (US States)
			{
				"name": "California Department of General Services",
				"url": "https://www.dgs.ca.gov/PD",
				"country": "US",
				"region": "California",
				"source_type": SourceType.GOVERNMENT_STATE,
				"geographic_scope": GeographicScope.STATE_PROVINCIAL,
				"typical_opportunities_per_day": 25,
				"recommended_scraper": "universal"
			},
			{
				"name": "New York State Procurement",
				"url": "https://ogs.ny.gov/procurement/",
				"country": "US",
				"region": "New York",
				"source_type": SourceType.GOVERNMENT_STATE,
				"geographic_scope": GeographicScope.STATE_PROVINCIAL,
				"typical_opportunities_per_day": 30,
				"recommended_scraper": "universal"
			},
			{
				"name": "Texas Procurement",
				"url": "https://www.txsmartbuy.com/",
				"country": "US",
				"region": "Texas",
				"source_type": SourceType.GOVERNMENT_STATE,
				"geographic_scope": GeographicScope.STATE_PROVINCIAL,
				"typical_opportunities_per_day": 35,
				"recommended_scraper": "universal"
			}
		]
		
		for source_data in government_sources:
			await self.add_source(ProcurementSource(
				base_domain=urlparse(source_data["url"]).netloc,
				**source_data
			))

	async def _load_african_sources(self):
		"""Load African procurement sources (regional + national + fallbacks)."""
		from .african_sources import (
			get_regional_sources,
			get_national_sources,
			get_country_fallbacks,
		)

		all_sources = get_regional_sources() + get_national_sources() + get_country_fallbacks()
		for source_data in all_sources:
			try:
				await self.add_source(ProcurementSource(
					base_domain=urlparse(source_data["url"]).netloc,
					**source_data
				))
			except Exception:
				self.logger.debug("Skipping African source %s", source_data.get("name"))

	async def _load_corporate_sources(self):
		"""Load corporate procurement sources"""
		corporate_sources = [
			# Major Corporations
			{
				"name": "General Electric Supplier Portal",
				"url": "https://www.gesupplierportal.com/",
				"country": "US",
				"source_type": SourceType.CORPORATE,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 20,
				"requires_login": True,
				"recommended_scraper": "playwright_stealth"
			},
			{
				"name": "Boeing Supplier Portal",
				"url": "https://www.boeing.com/company/general-info/supplier-portal/",
				"country": "US",
				"source_type": SourceType.CORPORATE,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 15,
				"requires_login": True,
				"recommended_scraper": "playwright_stealth"
			},
			{
				"name": "Walmart Supplier Portal",
				"url": "https://corporate.walmart.com/suppliers",
				"country": "US",
				"source_type": SourceType.CORPORATE,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 10,
				"requires_login": True,
				"recommended_scraper": "universal"
			},
			
			# Healthcare
			{
				"name": "Kaiser Permanente Supplier Diversity",
				"url": "https://about.kaiserpermanente.org/community-health/improving-community-conditions/supplier-diversity",
				"country": "US",
				"source_type": SourceType.HEALTHCARE,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 5,
				"recommended_scraper": "universal"
			},
			{
				"name": "Cleveland Clinic Procurement",
				"url": "https://my.clevelandclinic.org/about/procurement",
				"country": "US",
				"source_type": SourceType.HEALTHCARE,
				"geographic_scope": GeographicScope.REGIONAL,
				"typical_opportunities_per_day": 3,
				"recommended_scraper": "universal"
			},
			
			# Utilities
			{
				"name": "Pacific Gas & Electric Supplier Portal",
				"url": "https://www.pge.com/en_US/for-our-business-partners/",
				"country": "US",
				"source_type": SourceType.UTILITIES,
				"geographic_scope": GeographicScope.REGIONAL,
				"typical_opportunities_per_day": 8,
				"recommended_scraper": "universal"
			},
			
			# Transportation
			{
				"name": "Port of Los Angeles Procurement",
				"url": "https://www.portoflosangeles.org/business/procurement",
				"country": "US",
				"source_type": SourceType.TRANSPORTATION,
				"geographic_scope": GeographicScope.REGIONAL,
				"typical_opportunities_per_day": 12,
				"recommended_scraper": "universal"
			}
		]
		
		for source_data in corporate_sources:
			await self.add_source(ProcurementSource(
				base_domain=urlparse(source_data["url"]).netloc,
				**source_data
			))
	
	async def _load_international_sources(self):
		"""Load international organization procurement sources"""
		international_sources = [
			# United Nations System
			{
				"name": "UN Global Marketplace (UNGM)",
				"url": "https://www.ungm.org/",
				"country": "UN",
				"source_type": SourceType.GOVERNMENT_INTERNATIONAL,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 100,
				"opportunity_types": ["UN Tenders", "Development Projects"],
				"recommended_scraper": "playwright_stealth"
			},
			{
				"name": "World Bank Procurement",
				"url": "https://procurement.worldbank.org/",
				"country": "WB",
				"source_type": SourceType.GOVERNMENT_INTERNATIONAL,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 80,
				"opportunity_types": ["Development Finance", "Infrastructure"],
				"recommended_scraper": "crawl4ai_llm"
			},
			{
				"name": "Asian Development Bank Procurement",
				"url": "https://www.adb.org/business/opportunities",
				"country": "ADB",
				"source_type": SourceType.GOVERNMENT_INTERNATIONAL,
				"geographic_scope": GeographicScope.CONTINENTAL,
				"typical_opportunities_per_day": 40,
				"recommended_scraper": "universal"
			},
			{
				"name": "European Bank for Reconstruction and Development",
				"url": "https://www.ebrd.com/procurement.html",
				"country": "EBRD",
				"source_type": SourceType.GOVERNMENT_INTERNATIONAL,
				"geographic_scope": GeographicScope.CONTINENTAL,
				"typical_opportunities_per_day": 30,
				"recommended_scraper": "universal"
			},
			{
				"name": "Inter-American Development Bank",
				"url": "https://www.iadb.org/en/procurement",
				"country": "IDB",
				"source_type": SourceType.GOVERNMENT_INTERNATIONAL,
				"geographic_scope": GeographicScope.CONTINENTAL,
				"typical_opportunities_per_day": 25,
				"recommended_scraper": "universal"
			},
			
			# NATO and Defense
			{
				"name": "NATO Support and Procurement Agency",
				"url": "https://www.nspa.nato.int/",
				"country": "NATO",
				"source_type": SourceType.DEFENSE,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 20,
				"recommended_scraper": "universal"
			}
		]
		
		for source_data in international_sources:
			await self.add_source(ProcurementSource(
				base_domain=urlparse(source_data["url"]).netloc,
				**source_data
			))
	
	async def _load_foundation_sources(self):
		"""Load foundation and grant sources"""
		foundation_sources = [
			{
				"name": "Grants.gov",
				"url": "https://www.grants.gov/",
				"country": "US",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 150,
				"opportunity_types": ["Federal Grants", "Research Funding"],
				"has_api": True,
				"recommended_scraper": "crawl4ai_llm"
			},
			{
				"name": "Foundation Directory Online",
				"url": "https://fdo.foundationcenter.org/",
				"country": "US",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.GLOBAL,
				"requires_subscription": True,
				"typical_opportunities_per_day": 50,
				"recommended_scraper": "playwright_stealth"
			},
			{
				"name": "NSF Funding Opportunities",
				"url": "https://www.nsf.gov/funding/",
				"country": "US",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 10,
				"opportunity_types": ["Research Grants", "SBIR"],
				"recommended_scraper": "universal"
			},
			{
				"name": "NIH Grants",
				"url": "https://grants.nih.gov/grants/oer.htm",
				"country": "US",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 20,
				"opportunity_types": ["Medical Research", "Health Grants"],
				"recommended_scraper": "universal"
			}
		]
		
		for source_data in foundation_sources:
			await self.add_source(ProcurementSource(
				base_domain=urlparse(source_data["url"]).netloc,
				**source_data
			))
	
	async def _load_marketplace_sources(self):
		"""Load marketplace and aggregator sources"""
		marketplace_sources = [
			{
				"name": "BidNet",
				"url": "https://www.bidnet.com/",
				"country": "US",
				"source_type": SourceType.MARKETPLACE,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 200,
				"requires_subscription": True,
				"recommended_scraper": "cloudscraper"
			},
			{
				"name": "GovWin IQ",
				"url": "https://www.govwin.com/",
				"country": "US",
				"source_type": SourceType.MARKETPLACE,
				"geographic_scope": GeographicScope.NATIONAL,
				"requires_subscription": True,
				"typical_opportunities_per_day": 300,
				"recommended_scraper": "playwright_stealth"
			},
			{
				"name": "Find RFP",
				"url": "https://www.findrfp.com/",
				"country": "US",
				"source_type": SourceType.MARKETPLACE,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 100,
				"recommended_scraper": "universal"
			},
			{
				"name": "Tender247",
				"url": "https://www.tender247.com/",
				"country": "GB",
				"source_type": SourceType.MARKETPLACE,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 150,
				"recommended_scraper": "universal"
			}
		]
		
		for source_data in marketplace_sources:
			await self.add_source(ProcurementSource(
				base_domain=urlparse(source_data["url"]).netloc,
				**source_data
			))
	
	async def _load_ngo_sources(self):
		"""Load major global NGO procurement and grant portals."""
		ngo_sources = [
			# ── Major philanthropic foundations ──────────────────────────────
			{
				"name": "Bill & Melinda Gates Foundation Grants",
				"url": "https://www.gatesfoundation.org/about/how-we-work/grants-and-investments",
				"country": "US",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 3,
				"opportunity_types": ["Grants", "Investments"],
				"tags": ["global-health", "agriculture", "poverty"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Ford Foundation Grants",
				"url": "https://www.fordfoundation.org/work/our-grants/",
				"country": "US",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 2,
				"opportunity_types": ["Grants"],
				"tags": ["social-justice", "arts", "education"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Rockefeller Foundation Grants",
				"url": "https://www.rockefellerfoundation.org/grants/",
				"country": "US",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 2,
				"opportunity_types": ["Grants", "RFPs"],
				"tags": ["health", "food-security", "smart-cities"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Wellcome Trust Funding",
				"url": "https://wellcome.org/grant-funding",
				"country": "GB",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 3,
				"opportunity_types": ["Research Grants", "Fellowships"],
				"tags": ["health-research", "biomedical"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Open Society Foundations Grants",
				"url": "https://www.opensocietyfoundations.org/grants",
				"country": "US",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 3,
				"opportunity_types": ["Grants"],
				"tags": ["governance", "human-rights", "democracy"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Mastercard Foundation Grants",
				"url": "https://mastercardfdn.org/apply-for-funding/",
				"country": "CA",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.CONTINENTAL,
				"region": "Africa",
				"typical_opportunities_per_day": 2,
				"opportunity_types": ["Grants"],
				"tags": ["africa", "education", "financial-inclusion"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Hewlett Foundation Grants",
				"url": "https://hewlett.org/grants/",
				"country": "US",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 2,
				"opportunity_types": ["Grants"],
				"tags": ["education", "environment", "democracy"],
				"recommended_scraper": "universal",
			},
			{
				"name": "MacArthur Foundation Grants",
				"url": "https://www.macfound.org/grants",
				"country": "US",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 2,
				"opportunity_types": ["Grants", "Fellowships"],
				"tags": ["arts", "justice", "climate"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Bloomberg Philanthropies Grants",
				"url": "https://www.bloomberg.org/public-health/",
				"country": "US",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 2,
				"opportunity_types": ["Grants"],
				"tags": ["public-health", "environment", "arts"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Robert Wood Johnson Foundation",
				"url": "https://www.rwjf.org/en/grants/funding-opportunities.html",
				"country": "US",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.NATIONAL,
				"typical_opportunities_per_day": 3,
				"opportunity_types": ["Grants", "RFPs"],
				"tags": ["health-equity", "public-health"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Luminate Grants (Omidyar Network)",
				"url": "https://luminategroup.com/apply",
				"country": "GB",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 1,
				"opportunity_types": ["Grants", "Investments"],
				"tags": ["civic-tech", "democracy", "transparency"],
				"recommended_scraper": "universal",
			},
			{
				"name": "IKEA Foundation Grants",
				"url": "https://www.ikeafoundation.org/apply-for-funding/",
				"country": "NL",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 1,
				"opportunity_types": ["Grants"],
				"tags": ["climate", "poverty", "children"],
				"recommended_scraper": "universal",
			},
			# ── UN agencies (procurement/tender portals not already in global db) ──
			{
				"name": "UNICEF Supply Division",
				"url": "https://www.unicef.org/supply/procurement-services",
				"country": "DK",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 15,
				"opportunity_types": ["Tenders", "RFPs", "Long-Term Agreements"],
				"tags": ["un", "children", "humanitarian"],
				"recommended_scraper": "universal",
			},
			{
				"name": "UNHCR Procurement",
				"url": "https://www.unhcr.org/supply/tender-opportunities.html",
				"country": "CH",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 10,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["un", "refugees", "humanitarian"],
				"recommended_scraper": "universal",
			},
			{
				"name": "WFP Procurement (UN World Food Programme)",
				"url": "https://www.wfp.org/procurement",
				"country": "IT",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 20,
				"opportunity_types": ["Tenders", "RFPs", "Vendor Registration"],
				"tags": ["un", "food-security", "humanitarian"],
				"has_api": True,
				"recommended_scraper": "universal",
			},
			{
				"name": "WHO Procurement Notices",
				"url": "https://www.who.int/about/procurement",
				"country": "CH",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 8,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["un", "global-health"],
				"recommended_scraper": "universal",
			},
			{
				"name": "UNOPS Procurement",
				"url": "https://www.unops.org/business/procurement",
				"country": "DK",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 25,
				"opportunity_types": ["Tenders", "RFPs", "EOIs"],
				"tags": ["un", "infrastructure", "development"],
				"recommended_scraper": "universal",
			},
			{
				"name": "UN Women Procurement",
				"url": "https://www.unwomen.org/en/about-us/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 5,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["un", "gender-equality"],
				"recommended_scraper": "universal",
			},
			{
				"name": "UNFPA Procurement",
				"url": "https://www.unfpa.org/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 8,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["un", "reproductive-health"],
				"recommended_scraper": "universal",
			},
			{
				"name": "FAO Procurement",
				"url": "https://www.fao.org/procurement/en/",
				"country": "IT",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 12,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["un", "agriculture", "food-security"],
				"recommended_scraper": "universal",
			},
			{
				"name": "UNESCO Procurement",
				"url": "https://en.unesco.org/procurement",
				"country": "FR",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 6,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["un", "education", "culture"],
				"recommended_scraper": "universal",
			},
			{
				"name": "ILO Procurement",
				"url": "https://www.ilo.org/global/about-the-ilo/procurement/lang--en/index.htm",
				"country": "CH",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 5,
				"opportunity_types": ["Tenders", "Contracts"],
				"tags": ["un", "labour", "employment"],
				"recommended_scraper": "universal",
			},
			# ── Major humanitarian and development NGOs ───────────────────────
			{
				"name": "Oxfam International Procurement",
				"url": "https://www.oxfam.org/en/oxfam-procurement",
				"country": "GB",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 8,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["humanitarian", "poverty", "development"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Save the Children Tenders",
				"url": "https://www.savethechildren.net/procurement",
				"country": "GB",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 10,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["humanitarian", "children", "education"],
				"recommended_scraper": "universal",
			},
			{
				"name": "World Vision Procurement",
				"url": "https://www.wvi.org/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 12,
				"opportunity_types": ["Tenders", "RFPs", "Grants"],
				"tags": ["humanitarian", "children", "development"],
				"recommended_scraper": "universal",
			},
			{
				"name": "CARE International Procurement",
				"url": "https://www.care-international.org/about/accountability/procurement",
				"country": "CH",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 8,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["humanitarian", "poverty", "women"],
				"recommended_scraper": "universal",
			},
			{
				"name": "IRC (International Rescue Committee) Procurement",
				"url": "https://www.rescue.org/page/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 10,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["humanitarian", "refugees", "emergency"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Mercy Corps Procurement",
				"url": "https://www.mercycorps.org/about/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 8,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["humanitarian", "development", "emergency"],
				"recommended_scraper": "universal",
			},
			{
				"name": "MSF (Médecins Sans Frontières) Procurement",
				"url": "https://www.msf.org/suppliers",
				"country": "CH",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 6,
				"opportunity_types": ["Tenders", "Medical Procurement"],
				"tags": ["humanitarian", "medical", "emergency"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Aga Khan Foundation Grants",
				"url": "https://www.akdn.org/our-agencies/aga-khan-foundation/grants",
				"country": "CH",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 3,
				"opportunity_types": ["Grants", "RFPs"],
				"tags": ["development", "education", "health"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Plan International Procurement",
				"url": "https://plan-international.org/about/accountability/procurement/",
				"country": "GB",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 8,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["children", "girls", "humanitarian"],
				"recommended_scraper": "universal",
			},
			{
				"name": "ActionAid Procurement",
				"url": "https://actionaid.org/about/how-we-work/procurement",
				"country": "ZA",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 4,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["poverty", "women", "climate"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Catholic Relief Services (CRS) Procurement",
				"url": "https://www.crs.org/about/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 8,
				"opportunity_types": ["Tenders", "RFPs", "Sub-grants"],
				"tags": ["humanitarian", "development", "food"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Islamic Relief Procurement",
				"url": "https://www.islamic-relief.org/suppliers/",
				"country": "GB",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 5,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["humanitarian", "development"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Christian Aid Procurement",
				"url": "https://www.christianaid.org.uk/about-us/our-organisation/procurement",
				"country": "GB",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 4,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["poverty", "climate", "humanitarian"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Tearfund Procurement",
				"url": "https://www.tearfund.org/about-us/suppliers-and-contractors",
				"country": "GB",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 3,
				"opportunity_types": ["Tenders", "Contracts"],
				"tags": ["humanitarian", "development"],
				"recommended_scraper": "universal",
			},
			# ── Global health implementers ────────────────────────────────────
			{
				"name": "PATH Procurement",
				"url": "https://www.path.org/about/procurement/",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 6,
				"opportunity_types": ["Tenders", "RFPs", "Subcontracts"],
				"tags": ["global-health", "vaccines", "diagnostics"],
				"recommended_scraper": "universal",
			},
			{
				"name": "FHI 360 Procurement",
				"url": "https://www.fhi360.org/about/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 8,
				"opportunity_types": ["Subcontracts", "Sub-grants", "RFPs"],
				"tags": ["global-health", "education", "development"],
				"recommended_scraper": "universal",
			},
			{
				"name": "PSI (Population Services International) Procurement",
				"url": "https://www.psi.org/about-us/suppliers/",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 5,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["global-health", "reproductive-health"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Clinton Health Access Initiative (CHAI) Procurement",
				"url": "https://www.clintonhealthaccess.org/about/procurement/",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 4,
				"opportunity_types": ["Tenders", "Subcontracts"],
				"tags": ["global-health", "hiv", "malaria"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Management Sciences for Health (MSH) Procurement",
				"url": "https://www.msh.org/about-us/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 5,
				"opportunity_types": ["Subcontracts", "RFPs"],
				"tags": ["global-health", "health-systems"],
				"recommended_scraper": "universal",
			},
			{
				"name": "AMREF Health Africa Procurement",
				"url": "https://amref.org/about/procurement/",
				"country": "KE",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.CONTINENTAL,
				"region": "Africa",
				"typical_opportunities_per_day": 5,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["africa", "global-health"],
				"recommended_scraper": "universal",
			},
			# ── Development implementers / technical agencies ─────────────────
			{
				"name": "Chemonics International Subcontracts",
				"url": "https://www.chemonics.com/working-with-us/",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 10,
				"opportunity_types": ["Subcontracts", "RFPs", "Sub-grants"],
				"tags": ["usaid", "development", "governance"],
				"recommended_scraper": "universal",
			},
			{
				"name": "DAI Global Procurement",
				"url": "https://www.dai.com/working-with-dai/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 8,
				"opportunity_types": ["Subcontracts", "RFPs"],
				"tags": ["usaid", "development"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Palladium Group Procurement",
				"url": "https://thepalladiumgroup.com/about/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 6,
				"opportunity_types": ["Subcontracts", "RFPs"],
				"tags": ["development", "consulting"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Abt Associates Procurement",
				"url": "https://www.abtassociates.com/about-us/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 5,
				"opportunity_types": ["Subcontracts", "RFPs"],
				"tags": ["health", "development", "research"],
				"recommended_scraper": "universal",
			},
			{
				"name": "RTI International Procurement",
				"url": "https://www.rti.org/about/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 5,
				"opportunity_types": ["Subcontracts", "RFPs"],
				"tags": ["research", "development", "health"],
				"recommended_scraper": "universal",
			},
			{
				"name": "John Snow Inc (JSI) Procurement",
				"url": "https://www.jsi.com/about/procurement/",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 5,
				"opportunity_types": ["Subcontracts", "RFPs"],
				"tags": ["global-health", "supply-chain"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Creative Associates International Procurement",
				"url": "https://www.creativeassociatesinternational.com/procurement/",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 5,
				"opportunity_types": ["Subcontracts", "RFPs"],
				"tags": ["usaid", "education", "governance"],
				"recommended_scraper": "universal",
			},
			# ── Environment and conservation ──────────────────────────────────
			{
				"name": "WWF (World Wildlife Fund) Grants",
				"url": "https://www.worldwildlife.org/about/procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 4,
				"opportunity_types": ["Grants", "RFPs"],
				"tags": ["conservation", "climate", "biodiversity"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Conservation International Grants",
				"url": "https://www.conservation.org/about/financials-and-procurement",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 3,
				"opportunity_types": ["Grants", "RFPs"],
				"tags": ["conservation", "biodiversity", "climate"],
				"recommended_scraper": "universal",
			},
			{
				"name": "The Nature Conservancy Grants",
				"url": "https://www.nature.org/en-us/about-us/who-we-are/accountability/procurement/",
				"country": "US",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 3,
				"opportunity_types": ["Grants", "Contracts"],
				"tags": ["conservation", "land", "water"],
				"recommended_scraper": "universal",
			},
			{
				"name": "IUCN Procurement",
				"url": "https://www.iucn.org/about/procurement",
				"country": "CH",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 4,
				"opportunity_types": ["Tenders", "Contracts"],
				"tags": ["conservation", "biodiversity"],
				"recommended_scraper": "universal",
			},
			# ── Africa-focused foundations and NGOs ───────────────────────────
			{
				"name": "African Capacity Building Foundation (ACBF) Grants",
				"url": "https://www.acbf-pact.org/what-we-do/grants",
				"country": "ZW",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.CONTINENTAL,
				"region": "Africa",
				"typical_opportunities_per_day": 2,
				"opportunity_types": ["Grants"],
				"tags": ["africa", "capacity-building"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Trust Africa Grants",
				"url": "https://trustafrica.org/our-work/grants/",
				"country": "SN",
				"source_type": SourceType.FOUNDATION,
				"geographic_scope": GeographicScope.CONTINENTAL,
				"region": "Africa",
				"typical_opportunities_per_day": 2,
				"opportunity_types": ["Grants"],
				"tags": ["africa", "governance", "democracy"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Hivos Grants",
				"url": "https://hivos.org/calls-for-proposals/",
				"country": "NL",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 3,
				"opportunity_types": ["Grants", "Calls for Proposals"],
				"tags": ["human-rights", "innovation", "climate"],
				"recommended_scraper": "universal",
			},
			{
				"name": "SNV Development Organisation Procurement",
				"url": "https://snv.org/about/procurement",
				"country": "NL",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 5,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["development", "agriculture", "energy"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Cordaid Procurement",
				"url": "https://www.cordaid.org/en/about-cordaid/procurement/",
				"country": "NL",
				"source_type": SourceType.NONPROFIT,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 4,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["humanitarian", "development", "health"],
				"recommended_scraper": "universal",
			},
			# ── Global grant aggregators for NGOs ─────────────────────────────
			{
				"name": "Candid (Foundation Center) Grants Database",
				"url": "https://candid.org/find-funding",
				"country": "US",
				"source_type": SourceType.AGGREGATOR,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 100,
				"requires_subscription": True,
				"opportunity_types": ["Grants", "Foundation Funding"],
				"tags": ["aggregator", "foundations", "nonprofits"],
				"recommended_scraper": "playwright_stealth",
			},
			{
				"name": "GrantStation",
				"url": "https://grantstation.com/",
				"country": "US",
				"source_type": SourceType.AGGREGATOR,
				"geographic_scope": GeographicScope.GLOBAL,
				"requires_subscription": True,
				"typical_opportunities_per_day": 50,
				"opportunity_types": ["Grants"],
				"tags": ["aggregator", "nonprofits"],
				"recommended_scraper": "playwright_stealth",
			},
			{
				"name": "Instrumentl",
				"url": "https://www.instrumentl.com/rfps",
				"country": "US",
				"source_type": SourceType.AGGREGATOR,
				"geographic_scope": GeographicScope.GLOBAL,
				"requires_subscription": True,
				"typical_opportunities_per_day": 200,
				"opportunity_types": ["Grants", "RFPs"],
				"tags": ["aggregator", "nonprofits", "foundations"],
				"recommended_scraper": "playwright_stealth",
			},
			{
				"name": "DevEx Funding",
				"url": "https://www.devex.com/funding",
				"country": "US",
				"source_type": SourceType.AGGREGATOR,
				"geographic_scope": GeographicScope.GLOBAL,
				"requires_subscription": True,
				"typical_opportunities_per_day": 80,
				"opportunity_types": ["Grants", "RFPs", "Tenders"],
				"tags": ["aggregator", "development", "international"],
				"recommended_scraper": "playwright_stealth",
			},
			{
				"name": "ReliefWeb Jobs & Tenders",
				"url": "https://reliefweb.int/organizations",
				"country": "CH",
				"source_type": SourceType.AGGREGATOR,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 30,
				"opportunity_types": ["Tenders", "RFPs"],
				"tags": ["humanitarian", "un", "aggregator"],
				"recommended_scraper": "universal",
			},
			{
				"name": "Global Giving",
				"url": "https://www.globalgiving.org/rfps/",
				"country": "US",
				"source_type": SourceType.AGGREGATOR,
				"geographic_scope": GeographicScope.GLOBAL,
				"typical_opportunities_per_day": 5,
				"opportunity_types": ["Grants", "Calls for Proposals"],
				"tags": ["crowdfunding", "nonprofits", "foundations"],
				"recommended_scraper": "universal",
			},
		]

		for source_data in ngo_sources:
			try:
				await self.add_source(ProcurementSource(
					base_domain=urlparse(source_data["url"]).netloc,
					**source_data,
				))
			except Exception:
				self.logger.debug("Skipping NGO source %s", source_data.get("name"))

	async def _load_pacific_caribbean_sources(self) -> None:
		"""Load Pacific Islands and Caribbean national/regional procurement portals."""
		from .pacific_caribbean_sources import get_pacific_sources, get_caribbean_sources
		for fn in (get_pacific_sources, get_caribbean_sources):
			for src in fn():
				try:
					await self.add_source(ProcurementSource(
						base_domain=urlparse(src["url"]).netloc, **src,
					))
				except Exception:
					self.logger.debug("Skipping Pacific/Caribbean source %s", src.get("name"))

	async def _load_african_multilateral_sources(self) -> None:
		"""Load African RECs, development banks, basin commissions, and specialist bodies."""
		from .african_multilateral_sources import get_african_rec_sources
		for src in get_african_rec_sources():
			try:
				await self.add_source(ProcurementSource(
					base_domain=urlparse(src["url"]).netloc, **src,
				))
			except Exception:
				self.logger.debug("Skipping African multilateral source %s", src.get("name"))

	async def _load_grant_organization_sources(self) -> None:
		"""Load grant-giving foundations, bilateral donors, and grant aggregators."""
		from .grant_organizations_sources import (
			get_us_foundations,
			get_european_foundations,
			get_middle_east_gulf_funds,
			get_research_funders,
			get_bilateral_donor_agencies,
			get_grant_aggregators,
		)
		for fn in (
			get_us_foundations,
			get_european_foundations,
			get_middle_east_gulf_funds,
			get_research_funders,
			get_bilateral_donor_agencies,
			get_grant_aggregators,
		):
			for src in fn():
				try:
					await self.add_source(ProcurementSource(
						base_domain=urlparse(src["url"]).netloc, **src,
					))
				except Exception:
					self.logger.debug("Skipping grant source %s", src.get("name"))

	async def _load_global_expansion_sources(self) -> None:
		"""Load English-speaking world, Latin America, Middle East, Europe, and Asia portals."""
		from .global_expansion_sources import (
			get_english_speaking_world,
			get_latin_america_sources,
			get_middle_east_sources,
			get_additional_european_sources,
			get_additional_asia_sources,
		)
		for fn in (
			get_english_speaking_world,
			get_latin_america_sources,
			get_middle_east_sources,
			get_additional_european_sources,
			get_additional_asia_sources,
		):
			for src in fn():
				try:
					await self.add_source(ProcurementSource(
						base_domain=urlparse(src["url"]).netloc, **src,
					))
				except Exception:
					self.logger.debug("Skipping expansion source %s", src.get("name"))

	async def add_source(self, source: ProcurementSource) -> bool:
		"""Add a new procurement source to the database"""
		try:
			conn = sqlite3.connect(self.db_path)
			cursor = conn.cursor()
			
			# Convert Pydantic model to dict for database insertion
			source_dict = source.model_dump()
			
			# Handle special fields that need JSON serialization
			source_dict['opportunity_types'] = json.dumps(source_dict['opportunity_types'])
			source_dict['value_ranges'] = json.dumps(source_dict['value_ranges'])
			source_dict['tags'] = json.dumps(source_dict['tags'])
			
			# Convert datetime objects
			for date_field in ['added_date', 'updated_date', 'verified_date', 'last_successful_scrape', 'last_check']:
				if source_dict.get(date_field):
					source_dict[date_field] = source_dict[date_field].isoformat()
			
			# Convert enum values to strings
			source_dict['source_type'] = source_dict['source_type'].value
			source_dict['geographic_scope'] = source_dict['geographic_scope'].value
			source_dict['access_method'] = source_dict['access_method'].value
			source_dict['status'] = source_dict['status'].value
			
			# Insert into database - validate column names against allowlist (SQL injection prevention)
			valid_keys = [k for k in source_dict.keys() if k in self._VALID_SOURCE_COLUMNS]
			if len(valid_keys) < len(source_dict):
				invalid_keys = set(source_dict.keys()) - self._VALID_SOURCE_COLUMNS
				self.logger.warning(f"Discarding invalid columns: {invalid_keys}")
			columns = ', '.join(valid_keys)
			placeholders = ', '.join(['?' for _ in valid_keys])
			values = [source_dict[k] for k in valid_keys]
			
			cursor.execute(
				f"INSERT OR REPLACE INTO procurement_sources ({columns}) VALUES ({placeholders})",
				values
			)
			
			conn.commit()
			conn.close()
			
			# Update cache
			self.sources_cache[source.source_id] = source
			self._update_cache_indexes(source)
			
			self.logger.debug(f"Added source: {source.name}")
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to add source {source.name}: {e}")
			return False
	
	async def get_source(self, source_id: str) -> Optional[ProcurementSource]:
		"""Get a procurement source by ID"""
		try:
			# Check cache first
			await self._refresh_cache_if_needed()
			if source_id in self.sources_cache:
				return self.sources_cache[source_id]
			
			# Query database
			conn = sqlite3.connect(self.db_path)
			conn.row_factory = sqlite3.Row
			cursor = conn.cursor()
			
			cursor.execute("SELECT * FROM procurement_sources WHERE source_id = ?", (source_id,))
			row = cursor.fetchone()
			conn.close()
			
			if row:
				source = self._row_to_source(row)
				self.sources_cache[source_id] = source
				return source
			
			return None
			
		except Exception as e:
			self.logger.error(f"Failed to get source {source_id}: {e}")
			return None
	
	async def get_sources_by_type(self, source_type: SourceType, active_only: bool = True) -> List[ProcurementSource]:
		"""Get all sources of a specific type"""
		try:
			await self._refresh_cache_if_needed()
			
			sources = []
			for source in self.sources_cache.values():
				if source.source_type == source_type:
					if not active_only or source.status == SourceStatus.ACTIVE:
						sources.append(source)
			
			return sorted(sources, key=lambda s: s.name)
			
		except Exception as e:
			self.logger.error(f"Failed to get sources by type {source_type}: {e}")
			return []
	
	async def get_sources_by_country(self, country: str, active_only: bool = True) -> List[ProcurementSource]:
		"""Get all sources from a specific country"""
		try:
			await self._refresh_cache_if_needed()
			
			sources = []
			for source in self.sources_cache.values():
				if source.country.upper() == country.upper():
					if not active_only or source.status == SourceStatus.ACTIVE:
						sources.append(source)
			
			return sorted(sources, key=lambda s: s.typical_opportunities_per_day, reverse=True)
			
		except Exception as e:
			self.logger.error(f"Failed to get sources by country {country}: {e}")
			return []
	
	async def get_top_sources(self, limit: int = 50, by_volume: bool = True) -> List[ProcurementSource]:
		"""Get top procurement sources by volume or success rate"""
		try:
			await self._refresh_cache_if_needed()
			
			active_sources = [s for s in self.sources_cache.values() if s.status == SourceStatus.ACTIVE]
			
			if by_volume:
				sorted_sources = sorted(active_sources, key=lambda s: s.typical_opportunities_per_day, reverse=True)
			else:
				sorted_sources = sorted(active_sources, key=lambda s: s.success_rate_30d, reverse=True)
			
			return sorted_sources[:limit]
			
		except Exception as e:
			self.logger.error(f"Failed to get top sources: {e}")
			return []
	
	async def search_sources(
		self,
		query: str,
		source_types: Optional[List[SourceType]] = None,
		countries: Optional[List[str]] = None,
		active_only: bool = True
	) -> List[ProcurementSource]:
		"""Search procurement sources by name, URL, or notes"""
		try:
			await self._refresh_cache_if_needed()
			
			query_lower = query.lower()
			results = []
			
			for source in self.sources_cache.values():
				# Filter by status
				if active_only and source.status != SourceStatus.ACTIVE:
					continue
				
				# Filter by type
				if source_types and source.source_type not in source_types:
					continue
				
				# Filter by country
				if countries and source.country not in countries:
					continue
				
				# Search in name, URL, and notes
				if (query_lower in source.name.lower() or
					query_lower in str(source.url).lower() or
					(source.notes and query_lower in source.notes.lower())):
					results.append(source)
			
			return sorted(results, key=lambda s: s.typical_opportunities_per_day, reverse=True)
			
		except Exception as e:
			self.logger.error(f"Failed to search sources: {e}")
			return []
	
	async def update_source_health(
		self,
		source_id: str,
		status: SourceStatus,
		response_time: Optional[float] = None,
		opportunities_found: Optional[int] = None,
		error_message: Optional[str] = None
	) -> bool:
		"""Update health status of a procurement source"""
		try:
			conn = sqlite3.connect(self.db_path)
			cursor = conn.cursor()
			
			# Log health check
			cursor.execute('''
				INSERT INTO source_health_log (log_id, source_id, status, response_time, opportunities_found, error_message)
				VALUES (?, ?, ?, ?, ?, ?)
			''', (uuid7str(), source_id, status.value, response_time, opportunities_found, error_message))
			
			# Update source status
			update_fields = [
				"status = ?",
				"last_check = ?",
				"updated_date = ?"
			]
			update_values = [status.value, datetime.now(timezone.utc).isoformat(), datetime.now(timezone.utc).isoformat()]
			
			if response_time is not None:
				update_fields.append("average_response_time = ?")
				update_values.append(response_time)
			
			if opportunities_found is not None and opportunities_found > 0:
				update_fields.append("last_successful_scrape = ?")
				update_fields.append("opportunities_found_30d = opportunities_found_30d + ?")
				update_values.extend([datetime.now(timezone.utc).isoformat(), opportunities_found])
			
			# Update consecutive failures
			if status in [SourceStatus.DOWN, SourceStatus.BLOCKED]:
				update_fields.append("consecutive_failures = consecutive_failures + 1")
			else:
				update_fields.append("consecutive_failures = 0")
			
			update_values.append(source_id)
			
			cursor.execute(
				f"UPDATE procurement_sources SET {', '.join(update_fields)} WHERE source_id = ?",
				update_values
			)
			
			conn.commit()
			conn.close()
			
			# Update cache
			if source_id in self.sources_cache:
				source = self.sources_cache[source_id]
				source.status = status
				source.last_check = datetime.now(timezone.utc)
				if response_time is not None:
					source.average_response_time = response_time
				if opportunities_found is not None and opportunities_found > 0:
					source.last_successful_scrape = datetime.now(timezone.utc)
					source.opportunities_found_30d += opportunities_found
			
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to update source health {source_id}: {e}")
			return False
	
	async def get_source_health_stats(self) -> Dict[str, Any]:
		"""Get overall health statistics for all sources"""
		try:
			await self._refresh_cache_if_needed()
			
			stats = {
				'total_sources': len(self.sources_cache),
				'active_sources': 0,
				'slow_sources': 0,
				'down_sources': 0,
				'blocked_sources': 0,
				'subscription_required': 0,
				'by_type': {},
				'by_country': {},
				'avg_response_time': 0.0,
				'total_opportunities_30d': 0
			}
			
			response_times = []
			type_counts = {}
			country_counts = {}
			
			for source in self.sources_cache.values():
				# Count by status
				if source.status == SourceStatus.ACTIVE:
					stats['active_sources'] += 1
				elif source.status == SourceStatus.SLOW:
					stats['slow_sources'] += 1
				elif source.status == SourceStatus.DOWN:
					stats['down_sources'] += 1
				elif source.status == SourceStatus.BLOCKED:
					stats['blocked_sources'] += 1
				
				if source.requires_subscription:
					stats['subscription_required'] += 1
				
				# Collect response times
				if source.average_response_time:
					response_times.append(source.average_response_time)
				
				# Count by type
				type_key = source.source_type.value
				type_counts[type_key] = type_counts.get(type_key, 0) + 1
				
				# Count by country
				country_counts[source.country] = country_counts.get(source.country, 0) + 1
				
				# Sum opportunities
				stats['total_opportunities_30d'] += source.opportunities_found_30d
			
			if response_times:
				stats['avg_response_time'] = sum(response_times) / len(response_times)
			
			stats['by_type'] = type_counts
			stats['by_country'] = country_counts
			
			return stats
			
		except Exception as e:
			self.logger.error(f"Failed to get health stats: {e}")
			return {}
	
	async def get_total_sources(self) -> int:
		"""Get total number of sources in database"""
		try:
			conn = sqlite3.connect(self.db_path)
			cursor = conn.cursor()
			cursor.execute("SELECT COUNT(*) FROM procurement_sources")
			count = cursor.fetchone()[0]
			conn.close()
			return count
		except Exception as e:
			self.logger.error(f"Failed to get total sources: {e}")
			return 0
	
	async def export_sources(self, file_path: Path, format: str = "json") -> bool:
		"""Export procurement sources to file"""
		try:
			await self._refresh_cache_if_needed()
			
			sources_data = [source.model_dump() for source in self.sources_cache.values()]
			
			if format.lower() == "json":
				async with aiofiles.open(file_path, 'w') as f:
					await f.write(json.dumps(sources_data, indent=2, default=str))
			
			elif format.lower() == "csv":
				# Flatten data for CSV
				flattened_data = []
				for source in sources_data:
					flat_source = source.copy()
					# Convert lists to strings
					flat_source['opportunity_types'] = ';'.join(flat_source['opportunity_types'])
					flat_source['value_ranges'] = ';'.join(flat_source['value_ranges'])
					flat_source['tags'] = ';'.join(flat_source['tags'])
					flattened_data.append(flat_source)
				
				async with aiofiles.open(file_path, 'w', newline='') as f:
					if flattened_data:
						writer = csv.DictWriter(f, fieldnames=flattened_data[0].keys())
						await writer.writeheader()
						for row in flattened_data:
							await writer.writerow(row)
			
			self.logger.info(f"Exported {len(sources_data)} sources to {file_path}")
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to export sources: {e}")
			return False
	
	def _row_to_source(self, row: sqlite3.Row) -> ProcurementSource:
		"""Convert database row to ProcurementSource object"""
		data = dict(row)
		
		# Parse JSON fields
		data['opportunity_types'] = json.loads(data['opportunity_types'] or '[]')
		data['value_ranges'] = json.loads(data['value_ranges'] or '[]')
		data['tags'] = json.loads(data['tags'] or '[]')
		
		# Convert string enums back to enum objects
		data['source_type'] = SourceType(data['source_type'])
		data['geographic_scope'] = GeographicScope(data['geographic_scope'])
		data['access_method'] = AccessMethod(data['access_method'])
		data['status'] = SourceStatus(data['status'])
		
		# Parse datetime fields
		for date_field in ['added_date', 'updated_date', 'verified_date', 'last_successful_scrape', 'last_check']:
			if data.get(date_field):
				data[date_field] = datetime.fromisoformat(data[date_field])
		
		return ProcurementSource(**data)
	
	async def _refresh_cache_if_needed(self):
		"""Refresh cache if it's stale"""
		if (not self.cache_last_updated or 
			datetime.now(timezone.utc) - self.cache_last_updated > self.cache_ttl):
			await self._load_cache()
	
	async def _load_cache(self):
		"""Load all sources into memory cache"""
		try:
			conn = sqlite3.connect(self.db_path)
			conn.row_factory = sqlite3.Row
			cursor = conn.cursor()
			
			cursor.execute("SELECT * FROM procurement_sources")
			rows = cursor.fetchall()
			conn.close()
			
			self.sources_cache.clear()
			self.sources_by_type.clear()
			self.sources_by_country.clear()
			self.active_sources.clear()
			
			for row in rows:
				source = self._row_to_source(row)
				self.sources_cache[source.source_id] = source
				self._update_cache_indexes(source)
			
			self.cache_last_updated = datetime.now(timezone.utc)
			self.logger.debug(f"Loaded {len(self.sources_cache)} sources into cache")
			
		except Exception as e:
			self.logger.error(f"Failed to load cache: {e}")
	
	def _update_cache_indexes(self, source: ProcurementSource):
		"""Update cache indexes for fast lookup"""
		# Update type index
		if source.source_type not in self.sources_by_type:
			self.sources_by_type[source.source_type] = []
		self.sources_by_type[source.source_type].append(source.source_id)
		
		# Update country index
		if source.country not in self.sources_by_country:
			self.sources_by_country[source.country] = []
		self.sources_by_country[source.country].append(source.source_id)
		
		# Update active sources set
		if source.status == SourceStatus.ACTIVE:
			self.active_sources.add(source.source_id)
		else:
			self.active_sources.discard(source.source_id)

# Factory function
def create_global_source_db(db_path: Optional[Path] = None) -> GlobalSourceDB:
	"""Create a GlobalSourceDB instance"""
	return GlobalSourceDB(db_path)