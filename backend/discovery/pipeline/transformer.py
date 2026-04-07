"""
Opportunity Transformer
=======================

Transforms raw scraped data into normalized ScrapedOpportunity objects.

Responsibilities:
	- Date normalization to ISO format
	- Budget parsing and currency conversion
	- HTML stripping from descriptions
	- Field validation and cleaning
	- Country name standardization
	- Organization name normalization

Author: TenderSourceMax
"""

from __future__ import annotations

import re
import html
import logging
from datetime import date, datetime
from typing import Any
from dataclasses import dataclass, field

from backend.discovery.models.opportunity import ScrapedOpportunity, OpportunityType

logger = logging.getLogger(__name__)


# ============================================================================
# Country Normalization
# ============================================================================

# Map common country name variants to standardized names
COUNTRY_ALIASES: dict[str, str] = {
	# Africa - Common Variants
	"cote d'ivoire": "Ivory Coast",
	"côte d'ivoire": "Ivory Coast",
	"ivory coast": "Ivory Coast",
	"drc": "Democratic Republic of the Congo",
	"democratic republic of congo": "Democratic Republic of the Congo",
	"dr congo": "Democratic Republic of the Congo",
	"congo-kinshasa": "Democratic Republic of the Congo",
	"congo kinshasa": "Democratic Republic of the Congo",
	"congo-brazzaville": "Republic of the Congo",
	"congo brazzaville": "Republic of the Congo",
	"republic of congo": "Republic of the Congo",
	"eswatini": "Eswatini",
	"swaziland": "Eswatini",
	"cabo verde": "Cape Verde",
	"tanzania": "Tanzania",
	"united republic of tanzania": "Tanzania",
	"south africa": "South Africa",
	"rsa": "South Africa",
	"za": "South Africa",

	# Regional/Multi-country
	"pan-african": "Pan-African",
	"africa-wide": "Pan-African",
	"regional": "Regional",
	"multi-country": "Multi-Country",
	"global": "Global",
	"worldwide": "Global",

	# Common abbreviations
	"uk": "United Kingdom",
	"usa": "United States",
	"us": "United States",
	"uae": "United Arab Emirates",
}

# ISO 3166-1 alpha-3 to country name mapping
ISO3_TO_COUNTRY: dict[str, str] = {
	"DZA": "Algeria", "AGO": "Angola", "BEN": "Benin", "BWA": "Botswana",
	"BFA": "Burkina Faso", "BDI": "Burundi", "CMR": "Cameroon", "CPV": "Cape Verde",
	"CAF": "Central African Republic", "TCD": "Chad", "COM": "Comoros",
	"COG": "Republic of the Congo", "COD": "Democratic Republic of the Congo",
	"DJI": "Djibouti", "EGY": "Egypt", "GNQ": "Equatorial Guinea", "ERI": "Eritrea",
	"SWZ": "Eswatini", "ETH": "Ethiopia", "GAB": "Gabon", "GMB": "Gambia",
	"GHA": "Ghana", "GIN": "Guinea", "GNB": "Guinea-Bissau", "CIV": "Ivory Coast",
	"KEN": "Kenya", "LSO": "Lesotho", "LBR": "Liberia", "LBY": "Libya",
	"MDG": "Madagascar", "MWI": "Malawi", "MLI": "Mali", "MRT": "Mauritania",
	"MUS": "Mauritius", "MAR": "Morocco", "MOZ": "Mozambique", "NAM": "Namibia",
	"NER": "Niger", "NGA": "Nigeria", "RWA": "Rwanda", "STP": "Sao Tome and Principe",
	"SEN": "Senegal", "SYC": "Seychelles", "SLE": "Sierra Leone", "SOM": "Somalia",
	"ZAF": "South Africa", "SSD": "South Sudan", "SDN": "Sudan", "TZA": "Tanzania",
	"TGO": "Togo", "TUN": "Tunisia", "UGA": "Uganda", "ZMB": "Zambia", "ZWE": "Zimbabwe",
}


# ============================================================================
# Budget Parsing
# ============================================================================

# Currency symbols and codes
CURRENCY_SYMBOLS: dict[str, str] = {
	"$": "USD",
	"€": "EUR",
	"£": "GBP",
	"¥": "JPY",
	"R": "ZAR",  # South African Rand
	"KSh": "KES",  # Kenyan Shilling
	"₦": "NGN",  # Nigerian Naira
	"₵": "GHS",  # Ghanaian Cedi
	"RWF": "RWF",  # Rwandan Franc
	"TZS": "TZS",  # Tanzanian Shilling
	"UGX": "UGX",  # Ugandan Shilling
	"XOF": "XOF",  # West African CFA franc
	"XAF": "XAF",  # Central African CFA franc
}

# Multiplier suffixes
MULTIPLIERS: dict[str, float] = {
	"k": 1_000,
	"K": 1_000,
	"thousand": 1_000,
	"m": 1_000_000,
	"M": 1_000_000,
	"million": 1_000_000,
	"mn": 1_000_000,
	"b": 1_000_000_000,
	"B": 1_000_000_000,
	"billion": 1_000_000_000,
	"bn": 1_000_000_000,
}


@dataclass
class ParsedBudget:
	"""Parsed budget information."""
	value: str  # Original string
	numeric: float | None  # Parsed numeric value
	currency: str | None  # Detected currency code
	is_range: bool = False
	min_value: float | None = None
	max_value: float | None = None


# ============================================================================
# Opportunity Transformer
# ============================================================================

@dataclass
class TransformResult:
	"""Result of transformation operation."""
	opportunity: ScrapedOpportunity | None
	success: bool
	errors: list[str] = field(default_factory=list)
	warnings: list[str] = field(default_factory=list)


class OpportunityTransformer:
	"""
	Transforms raw scraped data into normalized ScrapedOpportunity objects.

	Features:
		- Date parsing with multiple format support
		- Budget parsing with currency detection
		- HTML stripping and text cleaning
		- Country name standardization
		- Field validation

	Usage:
		transformer = OpportunityTransformer()
		result = transformer.transform(raw_data, source="ungm")
		if result.success:
			opportunity = result.opportunity
	"""

	# Common date formats encountered in tender portals
	DATE_FORMATS: list[str] = [
		"%Y-%m-%d",           # ISO format
		"%d-%m-%Y",           # European
		"%m-%d-%Y",           # American
		"%d/%m/%Y",           # European with slashes
		"%m/%d/%Y",           # American with slashes
		"%Y/%m/%d",           # ISO with slashes
		"%d %b %Y",           # 15 Jan 2024
		"%d %B %Y",           # 15 January 2024
		"%B %d, %Y",          # January 15, 2024
		"%b %d, %Y",          # Jan 15, 2024
		"%d-%b-%Y",           # 15-Jan-2024
		"%d %b, %Y",          # 15 Jan, 2024
		"%Y%m%d",             # Compact ISO
		"%d.%m.%Y",           # German format
		"%d %m %Y",           # Space-separated
	]

	def __init__(
		self,
		strict_validation: bool = False,
		default_currency: str = "USD",
	) -> None:
		"""
		Initialize transformer.

		Args:
			strict_validation: If True, reject opportunities with missing required fields
			default_currency: Default currency when not detected
		"""
		self.strict_validation = strict_validation
		self.default_currency = default_currency
		self._stats = {
			"transformed": 0,
			"failed": 0,
			"warnings": 0,
		}

	@property
	def stats(self) -> dict[str, int]:
		"""Get transformation statistics."""
		return self._stats.copy()

	def reset_stats(self) -> None:
		"""Reset statistics counters."""
		self._stats = {"transformed": 0, "failed": 0, "warnings": 0}

	def transform(
		self,
		raw: dict[str, Any],
		source: str,
	) -> TransformResult:
		"""
		Transform raw scraped data to ScrapedOpportunity.

		Args:
			raw: Raw scraped data dictionary
			source: Source identifier (e.g., "ungm", "afdb")

		Returns:
			TransformResult with opportunity or errors
		"""
		errors: list[str] = []
		warnings: list[str] = []

		# Required fields
		title = self._clean_text(raw.get("title", ""))
		if not title:
			errors.append("Missing required field: title")
			self._stats["failed"] += 1
			return TransformResult(None, False, errors, warnings)

		source_id = raw.get("source_id") or raw.get("id") or raw.get("notice_id")
		if not source_id:
			# Generate from title hash
			import hashlib
			source_id = hashlib.md5(title.encode()).hexdigest()[:12]
			warnings.append("Generated source_id from title hash")

		# Parse dates
		deadline = self._parse_date(raw.get("deadline") or raw.get("closing_date"))
		published_date = self._parse_date(
			raw.get("published_date") or raw.get("publication_date") or raw.get("posted_date")
		)

		if self.strict_validation and not deadline:
			errors.append("Missing required field: deadline")

		# Parse budget
		budget_raw = raw.get("budget") or raw.get("value") or raw.get("budget_value")
		budget = self._parse_budget(budget_raw) if budget_raw else None

		# Normalize country
		country = self._normalize_country(
			raw.get("country") or raw.get("location") or raw.get("region")
		)

		# Clean text fields
		description = self._clean_html(raw.get("description") or raw.get("summary") or "")
		organization = self._clean_text(raw.get("organization") or raw.get("entity") or raw.get("agency") or "")

		# Determine opportunity type
		opp_type = self._detect_opportunity_type(
			raw.get("type") or raw.get("notice_type") or raw.get("tender_type"),
			title,
		)

		if errors and self.strict_validation:
			self._stats["failed"] += 1
			return TransformResult(None, False, errors, warnings)

		# Create opportunity
		try:
			opportunity = ScrapedOpportunity(
				source_id=str(source_id),
				source=source,
				title=title,
				category=raw.get("category"),
				sector=raw.get("sector"),
				country=country,
				organization=organization,
				deadline=deadline,
				published_date=published_date,
				budget_value=budget.value if budget else None,
				budget_numeric=budget.numeric if budget else None,
				budget_currency=budget.currency if budget else self.default_currency,
				description=description,
				requirements=self._clean_html(raw.get("requirements") or ""),
				submission_method=raw.get("submission_method"),
				document_url=raw.get("document_url") or raw.get("documents_url"),
				portal_url=raw.get("url") or raw.get("portal_url") or raw.get("link"),
				reference=raw.get("reference") or raw.get("ref") or raw.get("tender_no"),
				notice_id=raw.get("notice_id"),
				opportunity_type=opp_type,
				funder=raw.get("funder") or raw.get("funding_agency"),
				raw_data=raw,
			)

			self._stats["transformed"] += 1
			if warnings:
				self._stats["warnings"] += len(warnings)

			return TransformResult(opportunity, True, errors, warnings)

		except Exception as e:
			errors.append(f"Failed to create opportunity: {e}")
			self._stats["failed"] += 1
			return TransformResult(None, False, errors, warnings)

	def transform_batch(
		self,
		raw_items: list[dict[str, Any]],
		source: str,
	) -> list[ScrapedOpportunity]:
		"""
		Transform a batch of raw items.

		Args:
			raw_items: List of raw scraped data dictionaries
			source: Source identifier

		Returns:
			List of successfully transformed opportunities
		"""
		opportunities: list[ScrapedOpportunity] = []

		for raw in raw_items:
			result = self.transform(raw, source)
			if result.success and result.opportunity:
				opportunities.append(result.opportunity)
			elif result.errors:
				logger.warning(f"Transform failed for {source}: {result.errors}")

		return opportunities

	def _clean_text(self, text: Any) -> str:
		"""Clean and normalize text."""
		if text is None:
			return ""

		text = str(text)

		# Decode HTML entities
		text = html.unescape(text)

		# Normalize whitespace
		text = re.sub(r"\s+", " ", text)

		# Strip leading/trailing whitespace
		text = text.strip()

		return text

	def _clean_html(self, text: Any) -> str:
		"""Strip HTML tags and clean text."""
		if text is None:
			return ""

		text = str(text)

		# Remove HTML tags
		text = re.sub(r"<[^>]+>", " ", text)

		# Clean remaining text
		return self._clean_text(text)

	def _parse_date(self, date_input: Any) -> date | None:
		"""
		Parse date from various formats.

		Args:
			date_input: Date as string, datetime, or date object

		Returns:
			Parsed date or None
		"""
		if date_input is None:
			return None

		# Already a date
		if isinstance(date_input, date) and not isinstance(date_input, datetime):
			return date_input

		# Datetime to date
		if isinstance(date_input, datetime):
			return date_input.date()

		# Parse string
		if isinstance(date_input, str):
			date_str = date_input.strip()
			if not date_str:
				return None

			# Try each format
			for fmt in self.DATE_FORMATS:
				try:
					return datetime.strptime(date_str, fmt).date()
				except ValueError:
					continue

			# Try dateutil as fallback
			try:
				from dateutil import parser
				return parser.parse(date_str, dayfirst=True).date()
			except Exception:
				pass

			logger.debug(f"Could not parse date: {date_str}")

		return None

	def _parse_budget(self, budget_str: Any) -> ParsedBudget | None:
		"""
		Parse budget string into structured data.

		Handles formats like:
			- "$100,000"
			- "USD 1.5M"
			- "€500K - €1M"
			- "Between $100K and $500K"
			- "R 2,500,000" (South African Rand)

		Args:
			budget_str: Budget string to parse

		Returns:
			ParsedBudget object or None
		"""
		if budget_str is None:
			return None

		budget_str = str(budget_str).strip()
		if not budget_str:
			return None

		result = ParsedBudget(value=budget_str, numeric=None, currency=None)

		# Detect currency
		for symbol, code in CURRENCY_SYMBOLS.items():
			if symbol in budget_str:
				result.currency = code
				break

		# Check for currency codes (e.g., "USD", "EUR")
		if not result.currency:
			currency_match = re.search(r"\b([A-Z]{3})\b", budget_str)
			if currency_match:
				result.currency = currency_match.group(1)

		# Check for range patterns
		range_patterns = [
			r"(\d[\d,\.]*)\s*[-–—to]\s*(\d[\d,\.]*)",  # 100-500, 100 to 500
			r"between\s+(\d[\d,\.]*)\s+and\s+(\d[\d,\.]*)",  # between 100 and 500
			r"from\s+(\d[\d,\.]*)\s+to\s+(\d[\d,\.]*)",  # from 100 to 500
		]

		for pattern in range_patterns:
			match = re.search(pattern, budget_str, re.IGNORECASE)
			if match:
				result.is_range = True
				min_str = match.group(1).replace(",", "")
				max_str = match.group(2).replace(",", "")

				try:
					result.min_value = float(min_str)
					result.max_value = float(max_str)

					# Apply multiplier from nearby text
					multiplier = self._detect_multiplier(budget_str)
					if multiplier:
						result.min_value *= multiplier
						result.max_value *= multiplier

					# Use midpoint as numeric value
					result.numeric = (result.min_value + result.max_value) / 2
				except ValueError:
					pass

				return result

		# Parse single value
		number_match = re.search(r"([\d,\.]+)\s*([KMBkmb]|thousand|million|billion|mn|bn)?", budget_str)
		if number_match:
			try:
				value_str = number_match.group(1).replace(",", "")
				value = float(value_str)

				# Apply multiplier suffix
				suffix = number_match.group(2)
				if suffix and suffix in MULTIPLIERS:
					value *= MULTIPLIERS[suffix]
				else:
					# Check for multiplier elsewhere in string
					multiplier = self._detect_multiplier(budget_str)
					if multiplier:
						value *= multiplier

				result.numeric = value
			except ValueError:
				pass

		return result

	def _detect_multiplier(self, text: str) -> float | None:
		"""Detect multiplier word in text."""
		text_lower = text.lower()

		for word, mult in MULTIPLIERS.items():
			if word.lower() in text_lower:
				return mult

		return None

	def _normalize_country(self, country: Any) -> str | None:
		"""
		Normalize country name.

		Args:
			country: Country name or code

		Returns:
			Normalized country name
		"""
		if country is None:
			return None

		country_str = str(country).strip()
		if not country_str:
			return None

		# Check ISO-3 code
		if country_str.upper() in ISO3_TO_COUNTRY:
			return ISO3_TO_COUNTRY[country_str.upper()]

		# Check aliases
		country_lower = country_str.lower()
		if country_lower in COUNTRY_ALIASES:
			return COUNTRY_ALIASES[country_lower]

		# Title case the original
		return country_str.title()

	def _detect_opportunity_type(
		self,
		type_str: str | None,
		title: str,
	) -> OpportunityType:
		"""
		Detect opportunity type from type string or title.

		Args:
			type_str: Explicit type string if available
			title: Opportunity title for keyword detection

		Returns:
			OpportunityType enum value
		"""
		# Type string mapping
		type_map: dict[str, OpportunityType] = {
			"rfp": OpportunityType.RFP,
			"request for proposal": OpportunityType.RFP,
			"request for proposals": OpportunityType.RFP,
			"rfq": OpportunityType.RFQ,
			"request for quotation": OpportunityType.RFQ,
			"request for quotations": OpportunityType.RFQ,
			"rfi": OpportunityType.RFI,
			"request for information": OpportunityType.RFI,
			"eoi": OpportunityType.EOI,
			"expression of interest": OpportunityType.EOI,
			"expressions of interest": OpportunityType.EOI,
			"reoi": OpportunityType.EOI,
			"itb": OpportunityType.TENDER,
			"invitation to bid": OpportunityType.TENDER,
			"tender": OpportunityType.TENDER,
			"open tender": OpportunityType.TENDER,
			"lta": OpportunityType.LTA,
			"long term agreement": OpportunityType.LTA,
			"long-term agreement": OpportunityType.LTA,
			"framework": OpportunityType.FRAMEWORK,
			"framework agreement": OpportunityType.FRAMEWORK,
			"gpn": OpportunityType.GPN,
			"general procurement notice": OpportunityType.GPN,
			"spn": OpportunityType.SPN,
			"specific procurement notice": OpportunityType.SPN,
			"ifb": OpportunityType.IFB,
			"invitation for bids": OpportunityType.IFB,
			"grant": OpportunityType.GRANT,
		}

		# Check type string
		if type_str:
			type_lower = type_str.lower().strip()
			if type_lower in type_map:
				return type_map[type_lower]

		# Check title for keywords
		title_lower = title.lower()
		for keyword, opp_type in type_map.items():
			if keyword in title_lower:
				return opp_type

		# Default to tender
		return OpportunityType.TENDER


# ============================================================================
# Standalone execution
# ============================================================================

if __name__ == "__main__":
	# Test transformer
	transformer = OpportunityTransformer()

	test_data = {
		"title": "Supply of IT Equipment for Ministry of Education",
		"organization": "Ministry of Education, Kenya",
		"deadline": "15 Feb 2024",
		"budget": "USD 500K - 1M",
		"country": "KEN",
		"description": "<p>Supply and installation of computers</p>",
		"type": "Open Tender",
	}

	result = transformer.transform(test_data, "test")

	if result.success:
		print(f"Title: {result.opportunity.title}")
		print(f"Country: {result.opportunity.country}")
		print(f"Budget: {result.opportunity.budget_numeric} {result.opportunity.budget_currency}")
		print(f"Deadline: {result.opportunity.deadline}")
		print(f"Type: {result.opportunity.opportunity_type}")
	else:
		print(f"Errors: {result.errors}")
