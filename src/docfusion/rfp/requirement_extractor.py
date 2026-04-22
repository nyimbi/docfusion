#!/usr/bin/env python3
"""
RFP Requirement Extractor

Specialized requirement extraction for RFP (Request for Proposal) documents.
Extracts, classifies, and analyzes requirements from PDF and DOCX documents
with support for cross-reference detection, traceability, and confidence scoring.
"""

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import httpx
from pydantic import BaseModel, Field, ConfigDict
from ..core.utils import uuid7str
from ..config.secrets import SecretsManager
import time

class RequirementCategory(str, Enum):
	"""Classification categories for RFP requirements"""

	MANDATORY = "mandatory"  # Must be met - "shall", "must", "required"
	OPTIONAL = "optional"  # Nice to have - "may", "should", "preferred"
	CONDITIONAL = "conditional"  # Depends on conditions - "if", "when", "where applicable"

class RequirementType(str, Enum):
	"""Types of requirements in RFP documents"""

	FUNCTIONAL = "functional"
	TECHNICAL = "technical"
	PERFORMANCE = "performance"
	SECURITY = "security"
	COMPLIANCE = "compliance"
	DELIVERABLE = "deliverable"
	EVALUATION = "evaluation"
	CONTRACT = "contract"
	ADMINISTRATIVE = "administrative"
	UNKNOWN = "unknown"

class Requirement(BaseModel):
	"""
	Extracted RFP requirement with full traceability metadata.

	Attributes:
		id: Unique identifier for the requirement
		text: The requirement text as extracted from the document
		category: Classification as mandatory, optional, or conditional
		requirement_type: Type classification (functional, technical, etc.)
		section: Document section where the requirement was found
		page_number: Page number for traceability (PDF documents)
		confidence: Extraction confidence score (0.0-1.0)
		cross_references: IDs of related/dependent requirements
		source_location: Detailed location info (line, paragraph)
		metadata: Additional extraction metadata
	"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	id: str = Field(default_factory=uuid7str)
	text: str = Field(..., description="Requirement text")
	category: RequirementCategory = Field(
		default=RequirementCategory.MANDATORY, description="Requirement classification"
	)
	requirement_type: RequirementType = Field(
		default=RequirementType.UNKNOWN, description="Requirement type"
	)
	section: str = Field(default="", description="Document section")
	page_number: int | None = Field(default=None, description="Page number for traceability")
	confidence: float = Field(
		default=0.0, ge=0.0, le=1.0, description="Extraction confidence score"
	)
	cross_references: list[str] = Field(
		default_factory=list, description="IDs of related requirements"
	)
	source_location: dict[str, Any] = Field(
		default_factory=dict, description="Detailed source location"
	)
	metadata: dict[str, Any] = Field(
		default_factory=dict, description="Additional extraction metadata"
	)
	extracted_at: datetime = Field(default_factory=datetime.now)

	def add_cross_reference(self, requirement_id: str) -> None:
		"""Add a cross-reference to another requirement"""
		if requirement_id not in self.cross_references:
			self.cross_references.append(requirement_id)

class RequirementExtractionResult(BaseModel):
	"""Result of extracting requirements from a document"""

	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)

	success: bool = Field(default=False)
	requirements: list[Requirement] = Field(default_factory=list)
	document_metadata: dict[str, Any] = Field(default_factory=dict)
	cross_reference_map: dict[str, list[str]] = Field(
		default_factory=dict, description="Mapping of requirement IDs to their references"
	)
	statistics: dict[str, Any] = Field(default_factory=dict)
	errors: list[str] = Field(default_factory=list)
	warnings: list[str] = Field(default_factory=list)
	processing_time: float = Field(default=0.0)
	methods_used: list[str] = Field(default_factory=list)

class RequirementExtractor:
	"""
	RFP Requirement Extractor with PDF/DOCX support.

	Extracts requirements from RFP documents using multiple detection methods:
	- Pattern-based detection (shall, must, may, should)
	- Section-based extraction
	- AI-enhanced analysis
	- Cross-reference detection

	Features:
	- Classification into mandatory/optional/conditional
	- Section and page location extraction
	- Cross-reference detection between requirements
	- Confidence scoring for each extraction
	"""

	def __init__(self, config: dict[str, Any] | None = None):
		"""
		Initialize the requirement extractor.

		Args:
			config: Optional configuration dictionary to override defaults
		"""
		self.config = self._get_default_config()
		# Merge custom config with defaults
		if config:
			self.config.update(config)
		self.logger = logging.getLogger(__name__)

		# HTTP client for DoclingService integration
		self._http_client: httpx.AsyncClient | None = None

		# Compile detection patterns
		self._compile_patterns()

		# Load classification vocabularies
		self._load_vocabularies()

		self._log_extractor_initialized()

	def _get_default_config(self) -> dict[str, Any]:
		"""Get default configuration"""
		return {
			# DoclingService endpoint for document parsing
			"docling_service_url": SecretsManager.get_docling_url(),
			"docling_timeout": SecretsManager.get_docling_timeout(),
			# Classification patterns
			"mandatory_indicators": [
				"shall",
				"must",
				"required",
				"mandatory",
				"will",
				"is required to",
				"obligated to",
				"necessary",
			],
			"optional_indicators": [
				"may",
				"should",
				"could",
				"preferred",
				"desirable",
				"optional",
				"nice to have",
				"if possible",
			],
			"conditional_indicators": [
				"if",
				"when",
				"where applicable",
				"where appropriate",
				"as needed",
				"subject to",
				"depending on",
				"provided that",
				"in cases where",
			],
			# Cross-reference patterns
			"cross_ref_patterns": [
				r"see\s+(?:section|paragraph|requirement)\s+[\d\.]+",
				r"reference[s]?\s+[\d\.]+",
				r"as\s+(?:specified|defined|described)\s+in\s+[\d\.]+",
				r"per\s+(?:section|paragraph|requirement)\s+[\d\.]+",
				r"refer\s+to\s+[\d\.]+",
			],
			# Extraction settings
			"min_confidence_threshold": 0.3,
			"extract_measurement_criteria": True,
			"detect_cross_references": True,
			"group_by_section": True,
			"ai_enhancement": False,  # Disable by default for simpler integration
			# Measurement patterns
			"measurement_patterns": [
				r"minimum\s+(?:of\s+)?[\d,]+",
				r"maximum\s+(?:of\s+)?[\d,]+",
				r"at\s+least\s+[\d,]+",
				r"no\s+more\s+than\s+[\d,]+",
				r"within\s+[\d,]+\s+(?:business\s+)?days?",
				r"(?:not\s+)?exceed[s]?[\d,]+",
				r"response\s+time[s]?\s+(?:of\s+|less\s+than\s+)?[\d,]+",
			],
		}

	def _compile_patterns(self) -> None:
		"""Compile regex patterns for requirement detection"""
		# Mandatory patterns
		mandatory_words = "|".join(
			re.escape(word) for word in self.config["mandatory_indicators"]
		)
		self._mandatory_pattern = re.compile(
			rf"(?:(?:the\s+(?:contractor|vendor|offeror|bidder|proposer)\s+)?(?:{mandatory_words}))\b",
			re.IGNORECASE,
		)

		# Optional patterns
		optional_words = "|".join(re.escape(word) for word in self.config["optional_indicators"])
		self._optional_pattern = re.compile(
			rf"\b(?:{optional_words})\b", re.IGNORECASE
		)

		# Conditional patterns
		conditional_words = "|".join(
			re.escape(word) for word in self.config["conditional_indicators"]
		)
		self._conditional_pattern = re.compile(
			rf"\b(?:{conditional_words})\b", re.IGNORECASE
		)

		# Cross-reference patterns
		self._cross_ref_pattern = re.compile(
			"|".join(self.config["cross_ref_patterns"]), re.IGNORECASE
		)

		# Section reference pattern (e.g., "Section 3.2", "Paragraph 4.1.2")
		self._section_ref_pattern = re.compile(
			r"(?:section|paragraph|subsection|clause|requirement)\s+[\d\.]+",
			re.IGNORECASE,
		)

		# Numbered requirement pattern
		self._numbered_req_pattern = re.compile(
			r"^\s*(\d+(?:\.\d+)*)\s*[\.\)]\s+(.+?)(?=\n\s*\d+|\n\s*[A-Z][a-z]|\Z)",
			re.MULTILINE | re.DOTALL,
		)

		# Measurement criteria pattern
		measurement_patterns = "|".join(self.config["measurement_patterns"])
		self._measurement_pattern = re.compile(
			rf"(?:{measurement_patterns})", re.IGNORECASE
		)

	def _load_vocabularies(self) -> None:
		"""Load domain-specific vocabularies for requirement classification"""
		self.technical_keywords = {
			"software",
			"hardware",
			"system",
			"platform",
			"database",
			"api",
			"interface",
			"integration",
			"architecture",
			"security",
			"authentication",
			"encryption",
			"network",
			"server",
			"cloud",
			"hosting",
		}

		self.performance_keywords = {
			"performance",
			"response time",
			"latency",
			"throughput",
			"availability",
			"uptime",
			"scalability",
			"concurrent",
			"bandwidth",
			"capacity",
		}

		self.security_keywords = {
			"security",
			"encryption",
			"authentication",
			"authorization",
			"access control",
			"audit",
			"compliance",
			"vulnerability",
			"penetration",
			"firewall",
		}

		self.compliance_keywords = {
			"gdpr",
			"hipaa",
			"sox",
			"pci",
			"iso",
			"nist",
			"cmmi",
			"fedramp",
			"fisma",
			"regulation",
			"standard",
		}

	def _log_extractor_initialized(self) -> None:
		"""Log extractor initialization"""
		self.logger.info("RFP RequirementExtractor initialized")

	def _log_extraction_start(self, document_type: str) -> None:
		"""Log extraction start"""
		self.logger.info(f"Starting requirement extraction for {document_type} document")

	def _log_extraction_complete(self, count: int, time: float) -> None:
		"""Log extraction completion"""
		self.logger.info(f"Extracted {count} requirements in {time:.2f}s")

	def _log_pattern_match(self, pattern: str, count: int) -> None:
		"""Log pattern match results"""
		self.logger.debug(f"Pattern '{pattern}' matched {count} requirements")

	async def _get_http_client(self) -> httpx.AsyncClient:
		"""Get or create HTTP client for DoclingService"""
		if self._http_client is None or self._http_client.is_closed:
			self._http_client = httpx.AsyncClient(
				base_url=self.config["docling_service_url"],
				timeout=self.config["docling_timeout"],
			)
		return self._http_client

	async def close(self) -> None:
		"""Close the HTTP client"""
		if self._http_client and not self._http_client.is_closed:
			await self._http_client.aclose()

	async def extract_from_pdf(
		self,
		content: bytes,
		document_metadata: dict[str, Any] | None = None,
	) -> RequirementExtractionResult:
		"""
		Extract requirements from PDF content.

		Args:
			content: PDF document bytes
			document_metadata: Optional metadata about the document

		Returns:
			RequirementExtractionResult with extracted requirements
		"""
		start_time = time.monotonic()
		result = RequirementExtractionResult()

		try:
			self._log_extraction_start("PDF")

			# Use DoclingService for PDF parsing
			parsed_content = await self._parse_with_docling(content, "application/pdf")

			if parsed_content.get("success"):
				# Extract requirements from parsed content
				text_content = parsed_content.get("text", "")
				pages = parsed_content.get("pages", [])

				# Extract requirements with page tracking
				requirements = await self._extract_requirements_from_text(
					text_content,
					document_metadata=document_metadata,
					pages=pages,
				)

				result.requirements = requirements
				result.document_metadata = {
					**parsed_content.get("metadata", {}),
					**(document_metadata or {}),
					"page_count": len(pages),
				}
				result.success = True
				result.methods_used = ["docling_parser", "pattern_matching", "section_analysis"]
			else:
				result.errors.append("Failed to parse PDF document")
				result.errors.extend(parsed_content.get("errors", []))

		except Exception as e:
			result.errors.append(f"PDF extraction failed: {str(e)}")
			self.logger.error(f"PDF extraction error: {e}")

		result.processing_time = time.monotonic() - start_time
		result.statistics = self._calculate_statistics(result.requirements)
		self._log_extraction_complete(len(result.requirements), result.processing_time)

		return result

	async def extract_from_docx(
		self,
		content: bytes,
		document_metadata: dict[str, Any] | None = None,
	) -> RequirementExtractionResult:
		"""
		Extract requirements from DOCX content.

		Args:
			content: DOCX document bytes
			document_metadata: Optional metadata about the document

		Returns:
			RequirementExtractionResult with extracted requirements
		"""
		start_time = time.monotonic()
		result = RequirementExtractionResult()

		try:
			self._log_extraction_start("DOCX")

			# Use DoclingService for DOCX parsing
			parsed_content = await self._parse_with_docling(
				content,
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			)

			if parsed_content.get("success"):
				text_content = parsed_content.get("text", "")
				sections = parsed_content.get("sections", [])

				# Extract requirements from parsed content
				requirements = await self._extract_requirements_from_text(
					text_content,
					document_metadata=document_metadata,
					sections=sections,
				)

				result.requirements = requirements
				result.document_metadata = {
					**parsed_content.get("metadata", {}),
					**(document_metadata or {}),
					"section_count": len(sections),
				}
				result.success = True
				result.methods_used = ["docling_parser", "pattern_matching", "section_analysis"]
			else:
				result.errors.append("Failed to parse DOCX document")
				result.errors.extend(parsed_content.get("errors", []))

		except Exception as e:
			result.errors.append(f"DOCX extraction failed: {str(e)}")
			self.logger.error(f"DOCX extraction error: {e}")

		result.processing_time = time.monotonic() - start_time
		result.statistics = self._calculate_statistics(result.requirements)
		self._log_extraction_complete(len(result.requirements), result.processing_time)

		return result

	async def extract_from_text(
		self,
		text: str,
		document_metadata: dict[str, Any] | None = None,
	) -> RequirementExtractionResult:
		"""
		Extract requirements from plain text content.

		Args:
			text: Plain text content
			document_metadata: Optional metadata about the document

		Returns:
			RequirementExtractionResult with extracted requirements
		"""
		start_time = time.monotonic()
		result = RequirementExtractionResult()

		try:
			self._log_extraction_start("text")

			requirements = await self._extract_requirements_from_text(
				text,
				document_metadata=document_metadata,
			)

			result.requirements = requirements
			result.document_metadata = document_metadata or {}
			result.success = True
			result.methods_used = ["pattern_matching", "section_analysis"]

		except Exception as e:
			result.errors.append(f"Text extraction failed: {str(e)}")
			self.logger.error(f"Text extraction error: {e}")

		result.processing_time = time.monotonic() - start_time
		result.statistics = self._calculate_statistics(result.requirements)
		self._log_extraction_complete(len(result.requirements), result.processing_time)

		return result

	async def _parse_with_docling(
		self,
		content: bytes,
		content_type: str,
	) -> dict[str, Any]:
		"""
		Parse document using DoclingService.

		Args:
			content: Document bytes
			content_type: MIME type of the document

		Returns:
			Dictionary with parsed content and metadata
		"""
		try:
			client = await self._get_http_client()

			# Call DoclingService to parse the document
			response = await client.post(
				"/v1/parse",
				content=content,
				headers={"Content-Type": content_type},
			)

			if response.status_code == 200:
				data = response.json()
				return {
					"success": True,
					"text": data.get("text", ""),
					"pages": data.get("pages", []),
					"sections": data.get("sections", []),
					"metadata": data.get("metadata", {}),
				}
			else:
				return {
					"success": False,
					"errors": [f"DoclingService error: {response.status_code}"],
				}

		except httpx.TimeoutException:
			return {"success": False, "errors": ["DoclingService timeout"]}
		except httpx.RequestError as e:
			return {"success": False, "errors": [f"DoclingService request error: {str(e)}"]}
		except Exception as e:
			return {"success": False, "errors": [f"DoclingService error: {str(e)}"]}

	async def _extract_requirements_from_text(
		self,
		text: str,
		document_metadata: dict[str, Any] | None = None,
		pages: list[dict[str, Any]] | None = None,
		sections: list[dict[str, Any]] | None = None,
	) -> list[Requirement]:
		"""
		Extract requirements from parsed text content.

		Args:
			text: Text content
			document_metadata: Optional document metadata
			pages: Optional page information from PDF
			sections: Optional section information from DOCX

		Returns:
			List of extracted requirements
		"""
		requirements: list[Requirement] = []
		seen_texts: set[str] = set()  # For deduplication

		# Method 1: Pattern-based extraction
		pattern_reqs = await self._extract_with_patterns(text, pages)
		for req in pattern_reqs:
			if req.text not in seen_texts:
				requirements.append(req)
				seen_texts.add(req.text)

		self._log_pattern_match("mandatory/optional/conditional", len(pattern_reqs))

		# Method 2: Section-based extraction
		if sections:
			section_reqs = await self._extract_from_sections(text, sections)
			for req in section_reqs:
				if req.text not in seen_texts:
					requirements.append(req)
					seen_texts.add(req.text)
		else:
			# Try to detect sections from text
			detected_sections = self._detect_sections(text)
			if detected_sections:
				section_reqs = await self._extract_from_sections(text, detected_sections)
				for req in section_reqs:
					if req.text not in seen_texts:
						requirements.append(req)
						seen_texts.add(req.text)

		# Method 3: Numbered requirement extraction
		numbered_reqs = await self._extract_numbered_requirements(text, pages)
		for req in numbered_reqs:
			if req.text not in seen_texts:
				requirements.append(req)
				seen_texts.add(req.text)

		# Detect cross-references between requirements
		if self.config["detect_cross_references"]:
			await self._detect_cross_references(requirements, text)

		# Sort by confidence and location
		requirements.sort(key=lambda r: (-r.confidence, r.page_number or 0, r.section))

		return requirements

	async def _extract_with_patterns(
		self,
		text: str,
		pages: list[dict[str, Any]] | None = None,
	) -> list[Requirement]:
		"""Extract requirements using pattern matching"""
		requirements: list[Requirement] = []

		# Split text into paragraphs/sentences for analysis
		paragraphs = re.split(r"\n\s*\n|\n(?=[A-Z])", text)

		for para in paragraphs:
			para = para.strip()
			if len(para) < 15:  # Skip very short paragraphs
				continue

			# Determine category based on indicator patterns
			category = self._classify_requirement(para)
			if category is None:
				continue  # Not a requirement

			# Determine requirement type
			req_type = self._determine_requirement_type(para)

			# Calculate confidence based on patterns found
			confidence = self._calculate_confidence(para, category)

			# Find page number if available
			page_num = self._find_page_number(para, pages)

			# Extract measurement criteria if present
			measurement = self._extract_measurement_criteria(para)

			# Build requirement
			req = Requirement(
				text=para,
				category=category,
				requirement_type=req_type,
				page_number=page_num,
				confidence=confidence,
				source_location={"paragraph_start": text.find(para)},
				metadata={"measurement_criteria": measurement} if measurement else {},
			)

			requirements.append(req)

		return requirements

	async def _extract_from_sections(
		self,
		text: str,
		sections: list[dict[str, Any]],
	) -> list[Requirement]:
		"""Extract requirements from detected sections"""
		requirements: list[Requirement] = []

		for section in sections:
			section_name = section.get("name", "")
			section_text = section.get("text", "")
			section_start = section.get("start", 0)

			# Check if this is a requirements-related section
			if not self._is_requirement_section(section_name):
				continue

			# Split section into potential requirements
			potential_reqs = re.split(r"\n(?=\s*(?:\d+\.|[•\-\*]|[a-z]\)|\([a-z]\)))", section_text)

			for req_text in potential_reqs:
				req_text = req_text.strip()
				if len(req_text) < 15:
					continue

				# Classify and analyze
				category = self._classify_requirement(req_text)
				if category is None:
					category = RequirementCategory.MANDATORY  # Default for requirements section

				req_type = self._determine_requirement_type(req_text)
				confidence = self._calculate_confidence(req_text, category)

				measurement = self._extract_measurement_criteria(req_text)

				req = Requirement(
					text=req_text,
					category=category,
					requirement_type=req_type,
					section=section_name,
					confidence=min(confidence + 0.1, 1.0),  # Boost confidence for section-based, cap at 1.0
					source_location={
						"section": section_name,
						"char_start": section_start + section_text.find(req_text),
					},
					metadata={"measurement_criteria": measurement} if measurement else {},
				)

				requirements.append(req)

		return requirements

	async def _extract_numbered_requirements(
		self,
		text: str,
		pages: list[dict[str, Any]] | None = None,
	) -> list[Requirement]:
		"""Extract numbered/bulleted requirements"""
		requirements: list[Requirement] = []

		# Find all numbered requirements
		for match in self._numbered_req_pattern.finditer(text):
			req_number = match.group(1)
			req_text = match.group(2).strip()

			if len(req_text) < 10:
				continue

			# Classify
			category = self._classify_requirement(req_text)
			if category is None:
				category = RequirementCategory.MANDATORY

			req_type = self._determine_requirement_type(req_text)
			confidence = self._calculate_confidence(req_text, category) + 0.15

			measurement = self._extract_measurement_criteria(req_text)
			page_num = self._find_page_number(req_text, pages)

			# Ensure confidence is capped at 1.0
			final_confidence = min(confidence, 1.0)

			req = Requirement(
				text=req_text,
				category=category,
				requirement_type=req_type,
				section=f"Requirement {req_number}",
				page_number=page_num,
				confidence=final_confidence,
				source_location={
					"requirement_number": req_number,
					"char_start": match.start(),
					"char_end": match.end(),
				},
				metadata={
					"requirement_number": req_number,
					"measurement_criteria": measurement,
				},
			)

			requirements.append(req)

		return requirements

	def _classify_requirement(self, text: str) -> RequirementCategory | None:
		"""
		Classify a requirement as mandatory, optional, or conditional.

		Args:
			text: Requirement text

		Returns:
			RequirementCategory or None if not a requirement
		"""
		text_lower = text.lower()

		# Check for conditional indicators first (as they often override mandatory)
		if self._conditional_pattern.search(text):
			return RequirementCategory.CONDITIONAL

		# Check for mandatory indicators
		if self._mandatory_pattern.search(text):
			return RequirementCategory.MANDATORY

		# Check for optional indicators
		if self._optional_pattern.search(text):
			return RequirementCategory.OPTIONAL

		# Check for strong mandatory language
		strong_mandatory = ["required", "must", "shall", "will", "necessary"]
		if any(word in text_lower for word in strong_mandatory):
			return RequirementCategory.MANDATORY

		# If none matched but looks like a requirement, default to mandatory
		# This handles cases like numbered requirements in requirements sections
		if self._looks_like_requirement(text):
			return RequirementCategory.MANDATORY

		return None

	def _looks_like_requirement(self, text: str) -> bool:
		"""Check if text looks like a requirement even without clear indicators"""
		# Check for common requirement patterns
		patterns = [
			r"^(?:the\s+)?(?:contractor|vendor|offeror|bidder|proposer)\s+",
			r"^(?:all|each|every)\s+(?:\w+\s+)?(?:shall|must|will)\s+",
			r"^(?:proposals?|responses?|solutions?)\s+(?:shall|must|will)\s+",
			r"^(?:the\s+)?(?:system|solution|platform)\s+(?:shall|must|will)\s+",
		]

		for pattern in patterns:
			if re.search(pattern, text, re.IGNORECASE):
				return True

		return False

	def _determine_requirement_type(self, text: str) -> RequirementType:
		"""Determine the type of requirement"""
		text_lower = text.lower()

		# Check for security-related
		security_count = sum(1 for kw in self.security_keywords if kw in text_lower)
		if security_count >= 2:
			return RequirementType.SECURITY

		# Check for performance-related
		performance_count = sum(1 for kw in self.performance_keywords if kw in text_lower)
		if performance_count >= 2:
			return RequirementType.PERFORMANCE

		# Check for compliance-related
		compliance_count = sum(1 for kw in self.compliance_keywords if kw in text_lower)
		if compliance_count >= 1:
			return RequirementType.COMPLIANCE

		# Check for technical-related
		technical_count = sum(1 for kw in self.technical_keywords if kw in text_lower)
		if technical_count >= 2:
			return RequirementType.TECHNICAL

		# Check for deliverable-related
		deliverable_indicators = ["deliver", "submit", "provide", "produce", "report"]
		if any(ind in text_lower for ind in deliverable_indicators):
			return RequirementType.DELIVERABLE

		# Check for evaluation-related
		evaluation_indicators = ["evaluat", "score", "criteria", "point", "assess"]
		if any(ind in text_lower for ind in evaluation_indicators):
			return RequirementType.EVALUATION

		# Check for contract-related
		contract_indicators = ["contract", "agreement", "term", "condition", "clause"]
		if any(ind in text_lower for ind in contract_indicators):
			return RequirementType.CONTRACT

		# Default to functional
		return RequirementType.FUNCTIONAL

	def _calculate_confidence(self, text: str, category: RequirementCategory) -> float:
		"""Calculate confidence score for an extraction"""
		confidence = 0.5  # Base confidence

		# Boost for clear indicator words
		if category == RequirementCategory.MANDATORY:
			indicator_match = self._mandatory_pattern.search(text)
			if indicator_match:
				confidence += 0.3
		elif category == RequirementCategory.OPTIONAL:
			indicator_match = self._optional_pattern.search(text)
			if indicator_match:
				confidence += 0.2
		elif category == RequirementCategory.CONDITIONAL:
			indicator_match = self._conditional_pattern.search(text)
			if indicator_match:
				confidence += 0.25

		# Boost for measurement criteria
		if self._measurement_pattern.search(text):
			confidence += 0.1

		# Boost for specific length (not too short, not too long)
		if 30 <= len(text) <= 500:
			confidence += 0.1

		# Reduce confidence for very long text (might be multiple requirements)
		if len(text) > 1000:
			confidence -= 0.2

		return min(max(confidence, 0.0), 1.0)

	def _extract_measurement_criteria(self, text: str) -> str | None:
		"""Extract measurement criteria from requirement text"""
		match = self._measurement_pattern.search(text)
		if match:
			return match.group(0)
		return None

	def _find_page_number(
		self,
		text: str,
		pages: list[dict[str, Any]] | None,
	) -> int | None:
		"""Find page number for a text segment"""
		if not pages:
			return None

		for page_info in pages:
			page_text = page_info.get("text", "")
			if text in page_text or page_text in text:
				return page_info.get("page_number")

		return None

	def _detect_sections(self, text: str) -> list[dict[str, Any]]:
		"""Detect document sections from text"""
		sections = []

		# Common section patterns in RFPs
		section_pattern = re.compile(
			r"^(?:section|part|chapter|appendix|[a-z]\.)\s*[\d\.]*\s*:?\s*(.+?)$",
			re.IGNORECASE | re.MULTILINE,
		)

		matches = list(section_pattern.finditer(text))

		for i, match in enumerate(matches):
			section_name = match.group(0).strip()
			start = match.start()
			end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
			section_text = text[start:end]

			sections.append(
				{
					"name": section_name,
					"text": section_text,
					"start": start,
					"end": end,
				}
			)

		return sections

	def _is_requirement_section(self, section_name: str) -> bool:
		"""Check if a section name indicates requirements"""
		requirement_sections = [
			"requirements",
			"specifications",
			"scope",
			"scope of work",
			"statement of work",
			"deliverables",
			"technical requirements",
			"functional requirements",
			"performance requirements",
			"security requirements",
		]

		section_lower = section_name.lower()
		return any(req in section_lower for req in requirement_sections)

	async def _detect_cross_references(
		self,
		requirements: list[Requirement],
		full_text: str,
	) -> None:
		"""Detect cross-references between requirements"""
		# Build a map of requirement numbers to IDs
		req_number_map: dict[str, str] = {}
		for req in requirements:
			req_number = req.metadata.get("requirement_number")
			if req_number:
				req_number_map[req_number] = req.id

		# Find cross-references in each requirement
		for req in requirements:
			refs = []

			# Find all cross-reference patterns
			for match in self._cross_ref_pattern.finditer(req.text):
				ref_text = match.group(0)

				# Extract requirement number
				number_match = re.search(r"[\d\.]+", ref_text)
				if number_match:
					ref_number = number_match.group(0)

					# Try to match with existing requirements
					if ref_number in req_number_map:
						refs.append(req_number_map[ref_number])
					else:
						# Partial match (e.g., "3.2" matches "3.2.1")
						for num, rid in req_number_map.items():
							if num.startswith(ref_number) or ref_number.startswith(num):
								refs.append(rid)
								break

			# Also check for section references
			for match in self._section_ref_pattern.finditer(req.text):
				ref_text = match.group(0)
				# Store as metadata
				if "section_references" not in req.metadata:
					req.metadata["section_references"] = []
				req.metadata["section_references"].append(ref_text)

			# Update cross-references
			for ref_id in refs:
				if ref_id != req.id:  # Don't reference self
					req.add_cross_reference(ref_id)

	def _calculate_statistics(self, requirements: list[Requirement]) -> dict[str, Any]:
		"""Calculate extraction statistics"""
		if not requirements:
			return {}

		# Category distribution
		category_counts: dict[str, int] = {}
		for req in requirements:
			cat = req.category.value
			category_counts[cat] = category_counts.get(cat, 0) + 1

		# Type distribution
		type_counts: dict[str, int] = {}
		for req in requirements:
			t = req.requirement_type.value
			type_counts[t] = type_counts.get(t, 0) + 1

		# Confidence statistics
		confidences = [req.confidence for req in requirements]
		avg_confidence = sum(confidences) / len(confidences)

		# Cross-reference statistics
		total_refs = sum(len(req.cross_references) for req in requirements)
		reqs_with_refs = sum(1 for req in requirements if req.cross_references)

		# Page coverage
		pages_with_reqs: set[int | None] = {req.page_number for req in requirements}

		return {
			"total_requirements": len(requirements),
			"category_distribution": category_counts,
			"type_distribution": type_counts,
			"average_confidence": round(avg_confidence, 3),
			"confidence_range": {
				"min": min(confidences),
				"max": max(confidences),
			},
			"cross_references": {
				"total": total_refs,
				"requirements_with_refs": reqs_with_refs,
			},
			"page_coverage": {
				"unique_pages": len([p for p in pages_with_reqs if p is not None]),
			},
		}

	def get_extractor_info(self) -> dict[str, Any]:
		"""Get extractor information and capabilities"""
		return {
			"version": "1.0.0",
			"supported_formats": ["pdf", "docx", "text"],
			"classification_categories": [cat.value for cat in RequirementCategory],
			"requirement_types": [t.value for t in RequirementType],
			"features": [
				"pattern_detection",
				"section_analysis",
				"cross_reference_detection",
				"measurement_extraction",
				"confidence_scoring",
			],
			"docling_service_url": self.config["docling_service_url"],
		}

def create_requirement_extractor(
	config: dict[str, Any] | None = None,
) -> RequirementExtractor:
	"""Create RequirementExtractor instance with configuration"""
	return RequirementExtractor(config)