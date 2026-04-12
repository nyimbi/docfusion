#!/usr/bin/env python3
"""
Source Discovery Engine

Automatically discovers new procurement sources through:
- Web crawling and link analysis
- API endpoint discovery
- Pattern matching on known platforms
- Social media and news monitoring
- Government registry analysis
- Competitive intelligence gathering

This component expands the procurement source database by finding
new opportunities and sources that match procurement patterns.
"""

import asyncio
import json
import logging
import re
import aiohttp
import sqlite3
from typing import Dict, List, Optional, Any, Set, Tuple
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs
from dataclasses import dataclass
import tempfile
from collections import defaultdict, Counter

from pydantic import BaseModel, Field, field_validator
from ....core.utils import uuid7str

from ..ai_driven.universal_scraper import UniversalScraper, ScrapingConfiguration
from .global_source_db import GlobalSourceDB, ProcurementSource, SourceType, SourceStatus, AccessMethod, GeographicScope
import time


@dataclass
class DiscoveryResult:
	"""Result of source discovery operation"""
	discovered_sources: List[ProcurementSource]
	discovery_method: str
	confidence_score: float
	discovery_time: float
	metadata: Dict[str, Any]


class SourcePattern(BaseModel):
	"""Pattern for identifying procurement sources"""
	pattern_id: str = Field(default_factory=uuid7str)
	name: str
	url_patterns: List[str] = Field(default_factory=list)  # Regex patterns for URLs
	content_patterns: List[str] = Field(default_factory=list)  # Text patterns that indicate procurement
	required_elements: List[str] = Field(default_factory=list)  # HTML elements that must be present
	exclusion_patterns: List[str] = Field(default_factory=list)  # Patterns that exclude a source
	
	# Classification hints
	likely_source_type: SourceType = SourceType.GOVERNMENT_FEDERAL
	likely_access_method: AccessMethod = AccessMethod.HTTP_GET
	confidence_threshold: float = 0.7
	
	# Discovery metadata
	created_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	last_used: Optional[datetime] = None
	success_count: int = 0
	total_attempts: int = 0


class CrawlTarget(BaseModel):
	"""Target for discovery crawling"""
	target_id: str = Field(default_factory=uuid7str)
	url: str
	target_type: str  # 'government_portal', 'aggregator', 'news_site', etc.
	crawl_depth: int = 3
	focus_keywords: List[str] = Field(default_factory=list)
	
	# Constraints
	max_pages: int = 100
	respect_robots_txt: bool = True
	follow_external_links: bool = False
	
	# Status
	last_crawled: Optional[datetime] = None
	pages_discovered: int = 0
	sources_found: int = 0


class SourceDiscoverer:
	"""
	Automatically discovers new procurement sources through various methods
	"""
	
	def __init__(
		self,
		global_source_db: Optional[GlobalSourceDB] = None,
		universal_scraper: Optional[UniversalScraper] = None,
		discovery_cache_dir: Optional[Path] = None
	):
		self.logger = logging.getLogger(__name__)
		
		# Dependencies
		self.global_db = global_source_db or GlobalSourceDB()
		self.scraper = universal_scraper or UniversalScraper(
			ScrapingConfiguration(
				max_concurrent=3,  # Conservative for discovery
				request_delay_range=(2.0, 5.0),
				respect_robots_txt=True
			)
		)
		
		# Storage
		self.cache_dir = discovery_cache_dir or Path(tempfile.gettempdir()) / "source_discovery"
		self.cache_dir.mkdir(exist_ok=True)
		
		# Discovery patterns and targets
		self.discovery_patterns: List[SourcePattern] = []
		self.crawl_targets: List[CrawlTarget] = []
		self.discovered_sources_cache: Dict[str, ProcurementSource] = {}
		
		# Statistics
		self.discovery_stats = {
			'total_discovery_runs': 0,
			'sources_discovered': 0,
			'patterns_matched': 0,
			'crawl_targets_processed': 0,
			'api_endpoints_found': 0,
			'false_positives_filtered': 0
		}
		
		# Initialize patterns and targets
		asyncio.create_task(self._initialize_discovery_data())
	
	async def _initialize_discovery_data(self):
		"""Initialize discovery patterns and crawl targets"""
		try:
			await self._load_discovery_patterns()
			await self._load_crawl_targets()
			self.logger.info(f"Initialized with {len(self.discovery_patterns)} patterns and {len(self.crawl_targets)} targets")
		except Exception as e:
			self.logger.error(f"Failed to initialize discovery data: {e}")
	
	async def _load_discovery_patterns(self):
		"""Load procurement source identification patterns"""
		
		# Government procurement patterns
		gov_patterns = [
			SourcePattern(
				name="US Federal Procurement",
				url_patterns=[
					r".*\.gov.*/(procurement|contracting|solicitation|opportunity)",
					r".*sam\.gov.*",
					r".*fbo\.gov.*",
					r".*beta\.sam\.gov.*"
				],
				content_patterns=[
					r"solicitation\s+number",
					r"federal\s+business\s+opportunities",
					r"contract\s+opportunities",
					r"rfp|request\s+for\s+proposal"
				],
				required_elements=["form", "table", "div.opportunity"],
				likely_source_type=SourceType.GOVERNMENT,
				likely_access_method=AccessMethod.WEB_SCRAPING
			),
			
			SourcePattern(
				name="State/Local Government",
				url_patterns=[
					r".*\.(gov|us).*/(bid|tender|procurement)",
					r".*(city|county|state).*/(purchasing|procurement)",
					r".*municipal.*procurement.*"
				],
				content_patterns=[
					r"invitation\s+to\s+bid",
					r"public\s+procurement",
					r"municipal\s+contracts",
					r"government\s+purchasing"
				],
				required_elements=["table", "div.bid"],
				likely_source_type=SourceType.GOVERNMENT
			),
			
			SourcePattern(
				name="International Government",
				url_patterns=[
					r".*tenders\.gov\..*",
					r".*procurement\.gov\..*",
					r".*contracts\.gov\..*",
					r".*ted\.europa\.eu.*"
				],
				content_patterns=[
					r"public\s+tender",
					r"government\s+contract",
					r"procurement\s+notice"
				],
				required_elements=["div.tender", "table.procurement"],
				likely_source_type=SourceType.GOVERNMENT
			)
		]
		
		# Corporate procurement patterns
		corp_patterns = [
			SourcePattern(
				name="Corporate Procurement Portals",
				url_patterns=[
					r".*supplier.*portal.*",
					r".*vendor.*registration.*",
					r".*procurement\..*\.(com|org)"
				],
				content_patterns=[
					r"supplier\s+registration",
					r"vendor\s+portal",
					r"business\s+opportunities",
					r"sourcing\s+events"
				],
				required_elements=["form.registration", "div.opportunity"],
				likely_source_type=SourceType.CORPORATE
			),
			
			SourcePattern(
				name="Healthcare Procurement",
				url_patterns=[
					r".*(hospital|health|medical).*procurement.*",
					r".*gpo\..*",
					r".*healthtrust.*",
					r".*vizient.*"
				],
				content_patterns=[
					r"healthcare\s+procurement",
					r"medical\s+supplies",
					r"gpo\s+contracts",
					r"group\s+purchasing"
				],
				required_elements=["div.contract", "table.sourcing"],
				likely_source_type=SourceType.HEALTHCARE
			)
		]
		
		# Marketplace and aggregator patterns
		market_patterns = [
			SourcePattern(
				name="Procurement Marketplaces",
				url_patterns=[
					r".*govwin.*",
					r".*bidnet.*",
					r".*govtribe.*",
					r".*bidsync.*"
				],
				content_patterns=[
					r"government\s+contracts",
					r"bid\s+opportunities",
					r"procurement\s+intelligence"
				],
				required_elements=["div.opportunity-list", "table.bids"],
				likely_source_type=SourceType.MARKETPLACE_AGGREGATOR
			)
		]
		
		self.discovery_patterns.extend(gov_patterns + corp_patterns + market_patterns)
	
	async def _load_crawl_targets(self):
		"""Load targets for discovery crawling"""
		
		# Government portals for discovery
		gov_targets = [
			CrawlTarget(
				url="https://www.acquisition.gov/",
				target_type="government_portal",
				focus_keywords=["procurement", "contracting", "opportunities", "solicitation"],
				max_pages=50
			),
			CrawlTarget(
				url="https://www.gsa.gov/",
				target_type="government_portal", 
				focus_keywords=["contracts", "schedules", "opportunities"],
				max_pages=30
			),
			CrawlTarget(
				url="https://www.sba.gov/",
				target_type="government_portal",
				focus_keywords=["contracting", "opportunities", "small business"],
				max_pages=25
			)
		]
		
		# Industry association sites
		industry_targets = [
			CrawlTarget(
				url="https://www.nigp.org/",
				target_type="industry_association",
				focus_keywords=["public procurement", "government purchasing"],
				max_pages=20
			),
			CrawlTarget(
				url="https://www.ism.ws/",
				target_type="industry_association", 
				focus_keywords=["supply management", "procurement"],
				max_pages=20
			)
		]
		
		# News and industry sites
		news_targets = [
			CrawlTarget(
				url="https://www.govconwire.com/",
				target_type="news_site",
				focus_keywords=["contract award", "procurement", "solicitation"],
				max_pages=15
			),
			CrawlTarget(
				url="https://www.federaltimes.com/",
				target_type="news_site",
				focus_keywords=["federal contracts", "government procurement"],
				max_pages=15
			)
		]
		
		self.crawl_targets.extend(gov_targets + industry_targets + news_targets)
	
	async def discover_sources(
		self,
		discovery_methods: Optional[List[str]] = None,
		max_sources_per_method: int = 50
	) -> List[DiscoveryResult]:
		"""
		Run source discovery using specified methods
		
		Args:
			discovery_methods: List of methods to use. Options:
				- 'crawl_targets': Crawl predefined targets
				- 'pattern_matching': Use pattern matching on search results
				- 'api_discovery': Discover API endpoints
				- 'link_analysis': Analyze links from known sources
				- 'news_monitoring': Monitor news sources for new opportunities
			max_sources_per_method: Maximum sources to discover per method
		"""
		if discovery_methods is None:
			discovery_methods = ['crawl_targets', 'pattern_matching', 'link_analysis']
		
		results = []
		
		try:
			self.discovery_stats['total_discovery_runs'] += 1
			
			for method in discovery_methods:
				self.logger.info(f"Running discovery method: {method}")
				
				if method == 'crawl_targets':
					result = await self._discover_via_crawling(max_sources_per_method)
				elif method == 'pattern_matching':
					result = await self._discover_via_patterns(max_sources_per_method)
				elif method == 'api_discovery':
					result = await self._discover_apis(max_sources_per_method)
				elif method == 'link_analysis':
					result = await self._discover_via_links(max_sources_per_method)
				elif method == 'news_monitoring':
					result = await self._discover_via_news(max_sources_per_method)
				else:
					self.logger.warning(f"Unknown discovery method: {method}")
					continue
				
				if result:
					results.append(result)
					self.discovery_stats['sources_discovered'] += len(result.discovered_sources)
			
			# Deduplicate and validate discovered sources
			await self._post_process_discoveries(results)
			
			return results
			
		except Exception as e:
			self.logger.error(f"Source discovery failed: {e}")
			return results
	
	async def _discover_via_crawling(self, max_sources: int) -> Optional[DiscoveryResult]:
		"""Discover sources by crawling predefined targets"""
		discovered_sources = []
		start_time = time.monotonic()
		
		try:
			for target in self.crawl_targets[:5]:  # Limit concurrent targets
				sources = await self._crawl_target_for_sources(target, max_sources // 5)
				discovered_sources.extend(sources)
				
				if len(discovered_sources) >= max_sources:
					break
			
			discovery_time = time.monotonic() - start_time
			
			return DiscoveryResult(
				discovered_sources=discovered_sources[:max_sources],
				discovery_method="crawl_targets",
				confidence_score=0.8,  # High confidence for crawl-discovered sources
				discovery_time=discovery_time,
				metadata={
					'targets_crawled': len(self.crawl_targets),
					'pages_processed': sum(t.pages_discovered for t in self.crawl_targets)
				}
			)
			
		except Exception as e:
			self.logger.error(f"Crawling discovery failed: {e}")
			return None
	
	async def _crawl_target_for_sources(self, target: CrawlTarget, max_sources: int) -> List[ProcurementSource]:
		"""Crawl a specific target for procurement sources"""
		discovered = []
		
		try:
			# Use the UniversalScraper to get the page content
			scraping_result, extraction_result = await self.scraper.scrape_with_intelligence(target.url)
			
			if not scraping_result.success:
				return discovered
			
			# Analyze content for procurement-related links
			links = await self._extract_procurement_links(
				scraping_result.content, 
				target.url,
				target.focus_keywords
			)
			
			# Process each potential procurement link
			for link_url, confidence in links[:max_sources]:
				if confidence >= 0.6:  # Confidence threshold
					source = await self._validate_procurement_source(link_url, target.target_type)
					if source:
						discovered.append(source)
			
			# Update target statistics
			target.last_crawled = datetime.now(timezone.utc)
			target.pages_discovered += 1
			target.sources_found += len(discovered)
			
		except Exception as e:
			self.logger.warning(f"Failed to crawl target {target.url}: {e}")
		
		return discovered
	
	async def _extract_procurement_links(
		self, 
		content: str, 
		base_url: str, 
		focus_keywords: List[str]
	) -> List[Tuple[str, float]]:
		"""Extract links that likely lead to procurement opportunities"""
		
		links_with_scores = []
		
		try:
			from bs4 import BeautifulSoup
			soup = BeautifulSoup(content, 'html.parser')
			
			# Find all links
			for link in soup.find_all('a', href=True):
				href = link.get('href')
				link_text = link.get_text().strip().lower()
				
				# Convert relative URLs to absolute
				full_url = urljoin(base_url, href)
				
				# Skip non-HTTP URLs
				if not full_url.startswith(('http://', 'https://')):
					continue
				
				# Calculate relevance score
				score = self._score_procurement_link(full_url, link_text, focus_keywords)
				
				if score >= 0.3:  # Minimum relevance threshold
					links_with_scores.append((full_url, score))
			
			# Sort by score descending
			links_with_scores.sort(key=lambda x: x[1], reverse=True)
			
		except Exception as e:
			self.logger.warning(f"Link extraction failed: {e}")
		
		return links_with_scores
	
	def _score_procurement_link(self, url: str, link_text: str, focus_keywords: List[str]) -> float:
		"""Score a link's relevance to procurement"""
		score = 0.0
		
		# URL-based scoring
		url_lower = url.lower()
		procurement_terms = [
			'procurement', 'contracting', 'bid', 'tender', 'rfp', 'rfq',
			'solicitation', 'opportunity', 'contract', 'vendor', 'supplier'
		]
		
		for term in procurement_terms:
			if term in url_lower:
				score += 0.3
		
		# Link text scoring
		text_lower = link_text.lower()
		for term in procurement_terms:
			if term in text_lower:
				score += 0.2
		
		# Focus keyword bonus
		for keyword in focus_keywords:
			if keyword.lower() in url_lower or keyword.lower() in text_lower:
				score += 0.1
		
		# Government domain bonus
		if any(gov_tld in url_lower for gov_tld in ['.gov', '.mil', '.edu']):
			score += 0.2
		
		return min(score, 1.0)
	
	async def _discover_via_patterns(self, max_sources: int) -> Optional[DiscoveryResult]:
		"""Discover sources using pattern matching"""
		discovered_sources = []
		start_time = time.monotonic()
		
		try:
			# Use search engines to find pages matching our patterns
			search_queries = [
				"procurement opportunities site:gov",
				"federal contract solicitations",
				"government bid opportunities",
				"state procurement portal",
				"municipal contracting opportunities"
			]
			
			for query in search_queries[:3]:  # Limit search queries
				sources = await self._search_and_validate_sources(query, max_sources // 3)
				discovered_sources.extend(sources)
				
				if len(discovered_sources) >= max_sources:
					break
			
			discovery_time = time.monotonic() - start_time
			
			return DiscoveryResult(
				discovered_sources=discovered_sources[:max_sources],
				discovery_method="pattern_matching",
				confidence_score=0.7,
				discovery_time=discovery_time,
				metadata={
					'patterns_used': len(self.discovery_patterns),
					'search_queries': len(search_queries)
				}
			)
			
		except Exception as e:
			self.logger.error(f"Pattern-based discovery failed: {e}")
			return None
	
	async def _search_and_validate_sources(self, query: str, max_results: int) -> List[ProcurementSource]:
		"""Search for sources and validate them against patterns"""
		validated_sources = []
		
		try:
			# Mock search results - in reality, this would use a search API
			# For now, we'll generate some example results based on known patterns
			mock_results = await self._generate_mock_search_results(query, max_results * 2)
			
			for url in mock_results:
				# Test against our patterns
				for pattern in self.discovery_patterns:
					if await self._matches_pattern(url, pattern):
						source = await self._validate_procurement_source(url, "search_result")
						if source:
							validated_sources.append(source)
							self.discovery_stats['patterns_matched'] += 1
							break
				
				if len(validated_sources) >= max_results:
					break
					
		except Exception as e:
			self.logger.warning(f"Search validation failed: {e}")
		
		return validated_sources
	
	async def _generate_mock_search_results(self, query: str, max_results: int) -> List[str]:
		"""Generate mock search results (replace with real search API)"""
		
		# This would be replaced with actual search API calls
		mock_results = []
		
		if "procurement opportunities site:gov" in query:
			mock_results = [
				"https://www.fbo.gov/opportunities",
				"https://sam.gov/opportunities",
				"https://www.state.gov/procurement",
				"https://www.treasury.gov/procurement",
				"https://www.dod.mil/contracts"
			]
		elif "federal contract solicitations" in query:
			mock_results = [
				"https://www.gsa.gov/contracting",
				"https://www.nasa.gov/procurement",
				"https://www.va.gov/contracting",
				"https://www.hhs.gov/grants-contracts"
			]
		elif "government bid opportunities" in query:
			mock_results = [
				"https://www.california.gov/procurement",
				"https://www.texas.gov/purchasing",
				"https://www.ny.gov/contracts",
				"https://www.florida.gov/procurement"
			]
		
		return mock_results[:max_results]
	
	async def _matches_pattern(self, url: str, pattern: SourcePattern) -> bool:
		"""Check if URL matches a discovery pattern"""
		
		# URL pattern matching
		for url_pattern in pattern.url_patterns:
			if re.search(url_pattern, url, re.IGNORECASE):
				return True
		
		return False
	
	async def _discover_via_links(self, max_sources: int) -> Optional[DiscoveryResult]:
		"""Discover sources by analyzing links from known sources"""
		discovered_sources = []
		start_time = time.monotonic()
		
		try:
			# Get existing sources from our database
			existing_sources = await self.global_db.get_all_sources()
			
			# Analyze links from high-quality existing sources
			high_quality_sources = [
				source for source in existing_sources 
				if source.health_score > 0.8 and source.status == SourceStatus.ACTIVE
			][:10]  # Limit to top 10
			
			for source in high_quality_sources:
				links = await self._analyze_source_links(source, max_sources // len(high_quality_sources))
				discovered_sources.extend(links)
				
				if len(discovered_sources) >= max_sources:
					break
			
			discovery_time = time.monotonic() - start_time
			
			return DiscoveryResult(
				discovered_sources=discovered_sources[:max_sources],
				discovery_method="link_analysis",
				confidence_score=0.85,  # High confidence from known good sources
				discovery_time=discovery_time,
				metadata={
					'analyzed_sources': len(high_quality_sources),
					'total_links_found': len(discovered_sources)
				}
			)
			
		except Exception as e:
			self.logger.error(f"Link analysis discovery failed: {e}")
			return None
	
	async def _analyze_source_links(self, source: ProcurementSource, max_links: int) -> List[ProcurementSource]:
		"""Analyze outbound links from a known procurement source"""
		discovered = []
		
		try:
			# Scrape the source page
			scraping_result, _ = await self.scraper.scrape_with_intelligence(source.base_url)
			
			if scraping_result.success:
				# Extract relevant external links
				links = await self._extract_procurement_links(
					scraping_result.content,
					source.base_url,
					['procurement', 'contracting', 'opportunities']
				)
				
				# Validate discovered links
				for link_url, confidence in links[:max_links]:
					if confidence >= 0.7 and link_url != source.base_url:
						new_source = await self._validate_procurement_source(link_url, "link_discovery")
						if new_source and not await self._is_duplicate_source(new_source):
							discovered.append(new_source)
		
		except Exception as e:
			self.logger.warning(f"Failed to analyze links from {source.base_url}: {e}")
		
		return discovered
	
	async def _discover_apis(self, max_sources: int) -> Optional[DiscoveryResult]:
		"""Discover API endpoints for procurement data"""
		api_sources = []
		start_time = time.monotonic()
		
		try:
			# Known API patterns to look for
			api_patterns = [
				"/api/procurement",
				"/api/contracts", 
				"/api/opportunities",
				"/api/bids",
				"/api/tenders"
			]
			
			# Check existing sources for API endpoints
			existing_sources = await self.global_db.get_all_sources()
			
			for source in existing_sources[:20]:  # Limit checks
				for pattern in api_patterns:
					api_url = source.base_url.rstrip('/') + pattern
					
					if await self._validate_api_endpoint(api_url):
						api_source = ProcurementSource(
							name=f"{source.name} API",
							base_url=api_url,
							source_type=source.source_type,
							access_method=AccessMethod.API,
							geographic_scope=source.geographic_scope,
							description=f"API endpoint for {source.name}",
							discovery_method="api_discovery",
							health_score=0.9  # APIs typically more reliable
						)
						api_sources.append(api_source)
						self.discovery_stats['api_endpoints_found'] += 1
						
						if len(api_sources) >= max_sources:
							break
				
				if len(api_sources) >= max_sources:
					break
			
			discovery_time = time.monotonic() - start_time
			
			return DiscoveryResult(
				discovered_sources=api_sources,
				discovery_method="api_discovery",
				confidence_score=0.95,  # Very high confidence for working APIs
				discovery_time=discovery_time,
				metadata={
					'api_patterns_tested': len(api_patterns),
					'sources_checked': len(existing_sources)
				}
			) if api_sources else None
			
		except Exception as e:
			self.logger.error(f"API discovery failed: {e}")
			return None
	
	async def _validate_api_endpoint(self, api_url: str) -> bool:
		"""Validate that an API endpoint exists and returns procurement data"""
		try:
			async with aiohttp.ClientSession() as session:
				async with session.get(api_url, timeout=10) as response:
					if response.status == 200:
						content = await response.text()
						# Check if response contains procurement-related data
						procurement_indicators = [
							'procurement', 'contract', 'opportunity', 'bid', 'tender',
							'solicitation', 'award', 'rfp', 'rfq'
						]
						content_lower = content.lower()
						return any(indicator in content_lower for indicator in procurement_indicators)
		except (IOError, ConnectionError, asyncio.TimeoutError) as e:
			self.logger.warning(f"API endpoint validation failed for {api_url}: {e}")

		return False
	
	async def _discover_via_news(self, max_sources: int) -> Optional[DiscoveryResult]:
		"""Discover sources through news and announcement monitoring"""
		# This would monitor news sources for announcements of new procurement portals
		# For now, return None as this requires real-time news monitoring
		return None
	
	async def _validate_procurement_source(self, url: str, discovery_method: str) -> Optional[ProcurementSource]:
		"""Validate that a discovered URL is actually a procurement source"""
		
		try:
			# Try to scrape the page
			scraping_result, extraction_result = await self.scraper.scrape_with_intelligence(url)
			
			if not scraping_result.success:
				return None
			
			# Analyze content for procurement indicators
			content = scraping_result.content.lower()
			procurement_score = 0
			
			# Content-based validation
			procurement_terms = [
				('solicitation', 0.3), ('procurement', 0.25), ('contracting', 0.2),
				('bid opportunity', 0.3), ('rfp', 0.25), ('rfq', 0.2),
				('contract award', 0.2), ('tender', 0.2), ('vendor', 0.1)
			]
			
			for term, weight in procurement_terms:
				if term in content:
					procurement_score += weight
			
			# Structure-based validation
			if '<table' in content and ('opportunity' in content or 'contract' in content):
				procurement_score += 0.2
			
			if '<form' in content and 'search' in content:
				procurement_score += 0.15
			
			# URL-based validation
			url_lower = url.lower()
			if any(term in url_lower for term in ['procurement', 'contracting', 'bid', 'tender']):
				procurement_score += 0.2
			
			if '.gov' in url_lower:
				procurement_score += 0.1
			
			# Require minimum score to consider valid
			if procurement_score < 0.5:
				return None
			
			# Create procurement source
			parsed_url = urlparse(url)
			domain = parsed_url.netloc
			
			# Determine source type from domain and content
			source_type = self._classify_source_type(domain, content)
			access_method = AccessMethod.API if '/api/' in url else AccessMethod.WEB_SCRAPING
			geographic_scope = self._determine_geographic_scope(domain, content)
			
			source = ProcurementSource(
				name=self._generate_source_name(domain, source_type),
				base_url=url,
				source_type=source_type,
				access_method=access_method,
				geographic_scope=geographic_scope,
				description=f"Discovered procurement source via {discovery_method}",
				discovery_method=discovery_method,
				health_score=min(procurement_score, 1.0),
				tags=[discovery_method, source_type.value.lower()]
			)
			
			return source
			
		except Exception as e:
			self.logger.warning(f"Source validation failed for {url}: {e}")
			return None
	
	def _classify_source_type(self, domain: str, content: str) -> SourceType:
		"""Classify the type of procurement source"""
		domain_lower = domain.lower()
		content_lower = content.lower()
		
		if '.gov' in domain_lower or 'government' in content_lower:
			return SourceType.GOVERNMENT
		elif any(term in domain_lower for term in ['hospital', 'health', 'medical']):
			return SourceType.HEALTHCARE
		elif '.edu' in domain_lower or 'university' in content_lower:
			return SourceType.EDUCATION
		elif 'foundation' in domain_lower or 'nonprofit' in content_lower:
			return SourceType.FOUNDATION
		elif any(term in domain_lower for term in ['bid', 'tender', 'procurement']):
			return SourceType.MARKETPLACE_AGGREGATOR
		else:
			return SourceType.CORPORATE
	
	def _determine_geographic_scope(self, domain: str, content: str) -> GeographicScope:
		"""Determine the geographic scope of the source"""
		domain_lower = domain.lower()
		content_lower = content.lower()
		
		# Country-specific domains
		if '.gov' in domain_lower and '.us' not in domain_lower:
			return GeographicScope.NATIONAL
		elif any(tld in domain_lower for tld in ['.uk', '.ca', '.au', '.de', '.fr']):
			return GeographicScope.INTERNATIONAL
		elif 'europa.eu' in domain_lower:
			return GeographicScope.INTERNATIONAL
		
		# Content-based classification
		if any(term in content_lower for term in ['federal', 'national']):
			return GeographicScope.NATIONAL
		elif any(term in content_lower for term in ['state', 'provincial']):
			return GeographicScope.REGIONAL
		elif any(term in content_lower for term in ['city', 'county', 'municipal']):
			return GeographicScope.LOCAL
		elif any(term in content_lower for term in ['international', 'global', 'worldwide']):
			return GeographicScope.INTERNATIONAL
		
		return GeographicScope.REGIONAL  # Default
	
	def _generate_source_name(self, domain: str, source_type: SourceType) -> str:
		"""Generate a descriptive name for the source"""
		# Extract meaningful part of domain
		domain_parts = domain.replace('www.', '').split('.')
		main_part = domain_parts[0] if domain_parts else domain
		
		# Capitalize and format
		base_name = main_part.replace('-', ' ').replace('_', ' ').title()
		
		# Add type suffix
		type_suffix = {
			SourceType.GOVERNMENT: "Government Procurement",
			SourceType.CORPORATE: "Corporate Sourcing",
			SourceType.HEALTHCARE: "Healthcare Procurement", 
			SourceType.EDUCATION: "Education Procurement",
			SourceType.FOUNDATION: "Foundation Grants",
			SourceType.MARKETPLACE_AGGREGATOR: "Procurement Platform"
		}
		
		return f"{base_name} - {type_suffix.get(source_type, 'Procurement Portal')}"
	
	async def _is_duplicate_source(self, source: ProcurementSource) -> bool:
		"""Check if this source is a duplicate of an existing one"""
		try:
			# Check against existing sources in database
			existing = await self.global_db.get_source_by_url(source.base_url)
			if existing:
				return True
			
			# Check against our discovery cache
			if source.base_url in self.discovered_sources_cache:
				return True
			
			# Domain-level deduplication
			parsed_url = urlparse(source.base_url)
			domain = parsed_url.netloc
			
			existing_sources = await self.global_db.get_sources_by_domain(domain)
			if existing_sources:
				return True
			
			return False
			
		except Exception as e:
			self.logger.warning(f"Duplicate check failed: {e}")
			return False
	
	async def _post_process_discoveries(self, results: List[DiscoveryResult]):
		"""Post-process discovered sources to remove duplicates and low-quality sources"""
		
		all_discovered = []
		for result in results:
			all_discovered.extend(result.discovered_sources)
		
		# Deduplicate by URL
		unique_sources = {}
		for source in all_discovered:
			if source.base_url not in unique_sources:
				unique_sources[source.base_url] = source
			else:
				# Keep the one with higher health score
				if source.health_score > unique_sources[source.base_url].health_score:
					unique_sources[source.base_url] = source
		
		# Filter out low-quality sources
		quality_threshold = 0.6
		high_quality_sources = [
			source for source in unique_sources.values()
			if source.health_score >= quality_threshold
		]
		
		# Update result objects
		for result in results:
			result.discovered_sources = [
				source for source in result.discovered_sources
				if source.base_url in unique_sources and source.health_score >= quality_threshold
			]
		
		# Cache high-quality discoveries
		for source in high_quality_sources:
			self.discovered_sources_cache[source.base_url] = source
		
		self.logger.info(f"Post-processing: {len(all_discovered)} -> {len(high_quality_sources)} sources")
	
	async def add_to_database(self, discovery_results: List[DiscoveryResult]) -> int:
		"""Add discovered sources to the global database"""
		added_count = 0
		
		try:
			for result in discovery_results:
				for source in result.discovered_sources:
					try:
						success = await self.global_db.add_source(source)
						if success:
							added_count += 1
							self.logger.debug(f"Added source: {source.name}")
					except Exception as e:
						self.logger.warning(f"Failed to add source {source.name}: {e}")
			
			self.logger.info(f"Added {added_count} new sources to database")
			return added_count
			
		except Exception as e:
			self.logger.error(f"Database addition failed: {e}")
			return added_count
	
	def get_discovery_stats(self) -> Dict[str, Any]:
		"""Get discovery statistics"""
		stats = self.discovery_stats.copy()
		
		# Add current state info
		stats.update({
			'discovery_patterns_loaded': len(self.discovery_patterns),
			'crawl_targets_configured': len(self.crawl_targets),
			'cached_discoveries': len(self.discovered_sources_cache)
		})
		
		return stats
	
	async def cleanup(self):
		"""Clean up resources"""
		try:
			await self.scraper.cleanup()
			self.logger.info("SourceDiscoverer cleanup completed")
		except Exception as e:
			self.logger.error(f"Cleanup failed: {e}")


# Factory function
def create_source_discoverer(
	global_db: Optional[GlobalSourceDB] = None,
	scraper: Optional[UniversalScraper] = None
) -> SourceDiscoverer:
	"""Create a SourceDiscoverer instance"""
	return SourceDiscoverer(global_db, scraper)