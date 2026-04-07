"""
TenderSourceMax Opportunity Model
=================================

Standardized data model for scraped tender/RFP opportunities.
Maps directly to the DocFusion opportunities PostgreSQL schema.

This model serves as the canonical format for all scraped data,
ensuring consistent field names, types, and validation across
all source scrapers.

Field Mapping to DocFusion Schema:
	ScrapedOpportunity.source_id     -> opportunities.source_id
	ScrapedOpportunity.title         -> opportunities.title
	ScrapedOpportunity.category      -> opportunities.category
	ScrapedOpportunity.country       -> opportunities.country_region
	ScrapedOpportunity.organization  -> opportunities.organization
	ScrapedOpportunity.deadline      -> opportunities.deadline
	ScrapedOpportunity.budget_value  -> opportunities.budget_value
	ScrapedOpportunity.budget_numeric -> opportunities.budget_numeric
	ScrapedOpportunity.description   -> opportunities.project_summary
	ScrapedOpportunity.document_url  -> opportunities.rfp_link
	ScrapedOpportunity.portal_url    -> opportunities.source_platform
	etc.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field, asdict
from datetime import date, datetime
from enum import Enum
from typing import Any


class OpportunityType(str, Enum):
	"""Type of tender/procurement opportunity."""
	RFP = "rfp"           # Request for Proposal
	EOI = "eoi"           # Expression of Interest
	TENDER = "tender"     # Standard tender
	GRANT = "grant"       # Grant opportunity
	RFQ = "rfq"           # Request for Quotation
	RFI = "rfi"           # Request for Information
	IFB = "ifb"           # Invitation for Bid
	GPN = "gpn"           # General Procurement Notice
	SPN = "spn"           # Specific Procurement Notice
	LTA = "lta"           # Long-Term Agreement
	FRAMEWORK = "framework"  # Framework agreement
	OTHER = "other"


class SourceType(str, Enum):
	"""Classification of tender source type."""
	GAZETTE = "gazette"          # Government gazette (most authoritative)
	MDB = "mdb"                  # Multilateral Development Bank (World Bank, AfDB)
	UN_AGENCY = "un_agency"     # UN Agencies (UNDP, UNICEF, UNOPS)
	AGGREGATOR = "aggregator"   # Aggregators (UNGM, dgMarket)
	GOVERNMENT = "government"   # Government portal
	REGIONAL = "regional"       # Regional organization (EAC, SADC, AU)
	BILATERAL = "bilateral"     # Bilateral donors (USAID, EU, DFID)
	NGO = "ngo"                 # NGO/Foundation
	COMMERCIAL = "commercial"   # Commercial/private sector
	OTHER = "other"              # Other/unknown sources


class ScraperStatus(str, Enum):
	"""Status of a scraping operation."""
	SUCCESS = "success"
	PARTIAL = "partial"      # Some pages/items failed
	FAILED = "failed"
	RATE_LIMITED = "rate_limited"
	BLOCKED = "blocked"      # Anti-bot blocking
	TIMEOUT = "timeout"
	NO_DATA = "no_data"      # Successful but no opportunities found


@dataclass
class ScrapedOpportunity:
	"""
	Standardized opportunity model for all scraped data.

	This is the canonical format that all scrapers must produce.
	Fields map directly to the DocFusion opportunities database schema.

	Required fields:
		- source_id: Unique identifier from the source system
		- source: Source system identifier (e.g., "ungm", "afdb")
		- title: Opportunity title

	All other fields are optional but should be populated when available.
	"""

	# =========================================================================
	# Identity (Required)
	# =========================================================================
	source_id: str                              # e.g., "UNGM-250546"
	source: str                                 # e.g., "ungm"
	title: str                                  # Opportunity title

	# =========================================================================
	# Classification
	# =========================================================================
	category: str | None = None                 # AI/keyword detected category
	it_category: str | None = None              # More specific IT category
	sector: str | None = None                   # Government, NGO, Commercial
	country: str | None = None                  # Country or region name
	organization: str | None = None             # Issuing organization
	funder: str | None = None                   # Funding organization (if different)

	# =========================================================================
	# Timeline
	# =========================================================================
	deadline: date | None = None                # Submission deadline
	published_date: date | None = None          # When opportunity was published
	clarification_deadline: date | None = None  # Deadline for questions

	# =========================================================================
	# Financial
	# =========================================================================
	budget_value: str | None = None             # Budget as string (varied formats)
	budget_numeric: float | None = None         # Parsed numeric budget
	budget_currency: str | None = None          # Currency code (USD, EUR, etc.)
	budget_min: float | None = None             # Minimum budget (for ranges)
	budget_max: float | None = None             # Maximum budget (for ranges)

	# =========================================================================
	# Content
	# =========================================================================
	description: str | None = None              # Short description/summary
	scope: str | None = None                    # Full project scope
	requirements: str | None = None             # Key requirements text
	technical_requirements: str | None = None   # Technical stack/requirements
	eligibility: str | None = None              # Eligibility criteria
	evaluation_criteria: str | None = None      # How proposals are evaluated
	submission_method: str | None = None        # How to submit

	# =========================================================================
	# Links & References
	# =========================================================================
	document_url: str | None = None             # Link to RFP/tender document
	portal_url: str | None = None               # Link to source portal
	reference: str | None = None                # Reference number
	notice_id: str | None = None                # Notice/procurement ID
	project_id: str | None = None               # Related project ID
	contact_email: str | None = None            # Contact email for questions
	contact_name: str | None = None             # Contact person name

	# =========================================================================
	# Metadata
	# =========================================================================
	opportunity_type: OpportunityType = OpportunityType.RFP
	source_type: SourceType | None = None       # Type of source
	language: str | None = None                 # Primary language
	cpv_codes: list[str] = field(default_factory=list)  # EU CPV codes
	naics_codes: list[str] = field(default_factory=list)  # US NAICS codes
	unspsc_codes: list[str] = field(default_factory=list)  # UNSPSC codes
	tags: list[str] = field(default_factory=list)         # Additional tags

	# =========================================================================
	# Scraping Metadata
	# =========================================================================
	scraped_at: datetime = field(default_factory=datetime.utcnow)
	raw_data: dict[str, Any] = field(default_factory=dict)  # Original scraped data
	scraper_version: str | None = None          # Version of scraper used
	confidence_score: float | None = None       # Confidence in data quality

	def __post_init__(self) -> None:
		"""Validate and normalize fields after initialization."""
		# Normalize source ID to ensure it has source prefix
		if not self.source_id.startswith(f"{self.source.upper()}-"):
			self.source_id = f"{self.source.upper()}-{self.source_id}"

		# Normalize country names
		if self.country:
			self.country = self._normalize_country(self.country)

		# Parse budget if not already parsed
		if self.budget_value and self.budget_numeric is None:
			self._parse_budget()

	def _normalize_country(self, country: str) -> str:
		"""Normalize country name to standard format."""
		country_map = {
			"rsa": "South Africa",
			"sa": "South Africa",
			"za": "South Africa",
			"ke": "Kenya",
			"ng": "Nigeria",
			"gh": "Ghana",
			"tz": "Tanzania",
			"ug": "Uganda",
			"rw": "Rwanda",
			"et": "Ethiopia",
			"bw": "Botswana",
			"zm": "Zambia",
			"zw": "Zimbabwe",
			"mz": "Mozambique",
			"mw": "Malawi",
			"mu": "Mauritius",
			"sn": "Senegal",
			"ci": "Ivory Coast",
			"cote d'ivoire": "Ivory Coast",
		}
		normalized = country_map.get(country.lower().strip(), country)
		return normalized.title() if normalized.islower() else normalized

	def _parse_budget(self) -> None:
		"""Parse budget string to extract numeric value and currency."""
		if not self.budget_value:
			return

		text = self.budget_value.upper()

		# Extract currency
		currency_patterns = [
			(r"\$", "USD"),
			(r"USD", "USD"),
			(r"EUR|€", "EUR"),
			(r"GBP|£", "GBP"),
			(r"ZAR|R\s", "ZAR"),
			(r"KES|KSH", "KES"),
			(r"NGN|₦", "NGN"),
			(r"XOF|CFA", "XOF"),
		]

		for pattern, currency in currency_patterns:
			if re.search(pattern, text, re.IGNORECASE):
				self.budget_currency = currency
				break

		# Extract numeric values
		# Match patterns like: $100K, $1M, $50,000, $100K - $500K
		number_pattern = r"[\d,]+(?:\.\d+)?(?:\s*[KMB])?(?:\s*(?:MILLION|THOUSAND|BILLION))?"
		matches = re.findall(number_pattern, text)

		if matches:
			values = []
			for match in matches:
				value = self._parse_number(match)
				if value:
					values.append(value)

			if len(values) == 1:
				self.budget_numeric = values[0]
			elif len(values) >= 2:
				self.budget_min = min(values)
				self.budget_max = max(values)
				self.budget_numeric = sum(values) / len(values)  # Average

	def _parse_number(self, text: str) -> float | None:
		"""Parse number string with K/M/B suffixes."""
		text = text.upper().replace(",", "").strip()

		multipliers = {
			"K": 1_000,
			"M": 1_000_000,
			"B": 1_000_000_000,
			"THOUSAND": 1_000,
			"MILLION": 1_000_000,
			"BILLION": 1_000_000_000,
		}

		multiplier = 1
		for suffix, mult in multipliers.items():
			if suffix in text:
				multiplier = mult
				text = text.replace(suffix, "").strip()
				break

		try:
			return float(text) * multiplier
		except ValueError:
			return None

	@property
	def fingerprint(self) -> str:
		"""
		Generate a unique fingerprint for deduplication.

		The fingerprint is based on:
		1. Normalized title (lowercase, stripped)
		2. Organization (lowercase)
		3. Deadline (ISO format)

		This allows detecting duplicates from different sources.
		"""
		components = [
			self.title.lower().strip() if self.title else "",
			(self.organization or "").lower().strip(),
			self.deadline.isoformat() if self.deadline else "",
		]
		combined = "|".join(components)
		return hashlib.sha256(combined.encode()).hexdigest()[:32]

	@property
	def days_until_deadline(self) -> int | None:
		"""Calculate days until deadline from today."""
		if not self.deadline:
			return None
		today = date.today()
		delta = self.deadline - today
		return delta.days

	@property
	def is_expired(self) -> bool:
		"""Check if opportunity has expired."""
		if not self.deadline:
			return False
		return self.deadline < date.today()

	@property
	def is_urgent(self) -> bool:
		"""Check if opportunity is urgent (< 14 days)."""
		days = self.days_until_deadline
		if days is None:
			return False
		return 0 <= days <= 14

	def to_dict(self) -> dict[str, Any]:
		"""Convert to dictionary for JSON serialization."""
		data = asdict(self)
		# Convert enums to strings
		data["opportunity_type"] = self.opportunity_type.value
		if self.source_type:
			data["source_type"] = self.source_type.value
		# Convert dates to ISO format strings
		if self.deadline:
			data["deadline"] = self.deadline.isoformat()
		if self.published_date:
			data["published_date"] = self.published_date.isoformat()
		if self.clarification_deadline:
			data["clarification_deadline"] = self.clarification_deadline.isoformat()
		if self.scraped_at:
			data["scraped_at"] = self.scraped_at.isoformat()
		return data

	def to_docfusion_format(self) -> dict[str, Any]:
		"""
		Convert to DocFusion opportunity format for database insertion.

		Maps ScrapedOpportunity fields to the opportunities table schema.
		"""
		return {
			"sourceId": self.source_id,
			"title": self.title,
			"category": self.category,
			"itCategory": self.it_category,
			"sector": self.sector,
			"countryRegion": self.country,
			"organization": self.organization,
			"funder": self.funder,
			"deadline": self.deadline.isoformat() if self.deadline else None,
			"daysLeft": self.days_until_deadline,
			"isExpired": self.is_expired,
			"budgetValue": self.budget_value,
			"budgetNumeric": self.budget_numeric,
			"budgetCurrency": self.budget_currency,
			"projectSummary": self.description,
			"projectScope": self.scope,
			"keyRequirements": self.requirements,
			"technicalRequirements": self.technical_requirements,
			"submissionMethod": self.submission_method,
			"rfpLink": self.document_url,
			"sourcePlatform": f"{self.source}:{self.portal_url}" if self.portal_url else self.source,
			"sourceFile": f"scraper:{self.source}",
			"opportunityType": self.opportunity_type.value,
			"tags": self.tags,
			"metadata": {
				"scraped_at": self.scraped_at.isoformat() if self.scraped_at else None,
				"fingerprint": self.fingerprint,
				"reference": self.reference,
				"notice_id": self.notice_id,
				"source_type": self.source_type.value if self.source_type else None,
				"cpv_codes": self.cpv_codes,
				"raw_data": self.raw_data,
			},
		}


@dataclass
class SourceConfig:
	"""
	Configuration for a tender source.

	Defines all metadata and settings for scraping a specific source.
	"""
	id: str                                     # Unique source identifier
	name: str                                   # Human-readable name
	url: str                                    # Base URL
	source_type: SourceType                     # Type classification
	coverage: list[str]                         # Countries/regions covered
	rate_limit: float = 1.0                     # Requests per second
	timeout: int = 30                           # Request timeout in seconds
	requires_javascript: bool = False           # Needs Playwright
	requires_auth: bool = False                 # Needs authentication
	priority: int = 2                           # 1=highest, 3=lowest priority
	enabled: bool = True                        # Whether to scrape this source
	scraper_class: str | None = None            # Path to scraper class
	schedule_tier: int = 2                      # 1=6hr, 2=12hr, 3=daily
	notes: str | None = None                    # Additional notes

	@classmethod
	def from_dict(cls, data: dict[str, Any]) -> SourceConfig:
		"""Create SourceConfig from dictionary."""
		return cls(
			id=data["id"],
			name=data["name"],
			url=data["url"],
			source_type=SourceType(data.get("type", "aggregator")),
			coverage=data.get("coverage", []),
			rate_limit=data.get("rate_limit", 1.0),
			timeout=data.get("timeout", 30),
			requires_javascript=data.get("javascript", False),
			requires_auth=data.get("auth", False),
			priority=data.get("priority", 2),
			enabled=data.get("enabled", True),
			scraper_class=data.get("scraper_class"),
			schedule_tier=data.get("schedule_tier", 2),
			notes=data.get("notes"),
		)


@dataclass
class ScrapeMetrics:
	"""Metrics for a single scraping run."""
	source: str
	started_at: datetime
	completed_at: datetime | None = None
	status: ScraperStatus = ScraperStatus.SUCCESS
	opportunities_found: int = 0
	opportunities_new: int = 0
	opportunities_updated: int = 0
	opportunities_skipped: int = 0
	pages_scraped: int = 0
	requests_made: int = 0
	errors: list[str] = field(default_factory=list)
	rate_limit_hits: int = 0
	bytes_downloaded: int = 0

	@property
	def duration_seconds(self) -> float | None:
		"""Calculate scraping duration."""
		if not self.completed_at:
			return None
		return (self.completed_at - self.started_at).total_seconds()

	@property
	def success_rate(self) -> float:
		"""Calculate success rate (0-1)."""
		total = self.opportunities_new + self.opportunities_updated + self.opportunities_skipped
		if total == 0:
			return 0.0
		return (self.opportunities_new + self.opportunities_updated) / total


@dataclass
class ScraperResult:
	"""Result of a scraping operation."""
	source: str
	opportunities: list[ScrapedOpportunity]
	metrics: ScrapeMetrics
	errors: list[str] = field(default_factory=list)
	warnings: list[str] = field(default_factory=list)

	@property
	def success(self) -> bool:
		"""Check if scraping was successful."""
		return self.metrics.status in (ScraperStatus.SUCCESS, ScraperStatus.PARTIAL)

	@property
	def count(self) -> int:
		"""Number of opportunities found."""
		return len(self.opportunities)
