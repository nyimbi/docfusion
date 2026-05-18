"""
Format Validator Module

Provides comprehensive format validation for RFP responses and document submissions including:
- Document structure validation (headers, sections, page limits)
- Formatting requirements (fonts, margins, spacing)
- Submission standard compliance (file formats, naming conventions)
- Accessibility compliance (WCAG, PDF/UA)
"""

from typing import Any, Dict, List, Optional
import logging
logger = logging.getLogger(__name__)
from dataclasses import dataclass, field
from enum import Enum
import re
from datetime import datetime
import os
import mimetypes
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from ...core.utils import uuid7str

class FormatSeverity(Enum):
	"""Severity levels for format violations"""
	CRITICAL = "critical"
	HIGH = "high"
	MEDIUM = "medium"
	LOW = "low"
	WARNING = "warning"

class DocumentFormat(Enum):
	"""Supported document formats"""
	PDF = "pdf"
	DOCX = "docx"
	DOC = "doc"
	HTML = "html"
	TXT = "txt"
	RTF = "rtf"

@dataclass
class FormatRequirement:
	"""Defines a format requirement"""
	requirement_id: str = field(default_factory=uuid7str)
	name: str = ""
	description: str = ""
	category: str = ""  # structure, formatting, accessibility, submission
	severity: FormatSeverity = FormatSeverity.MEDIUM
	validator_function: str = ""
	parameters: Dict[str, Any] = field(default_factory=dict)
	applicable_formats: List[DocumentFormat] = field(default_factory=list)
	active: bool = True
	metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class FormatViolation:
	"""Represents a format violation"""
	violation_id: str = field(default_factory=uuid7str)
	requirement_id: str = ""
	requirement_name: str = ""
	description: str = ""
	severity: FormatSeverity = FormatSeverity.MEDIUM
	location: str = ""
	recommendation: str = ""
	category: str = ""
	detected_at: datetime = field(default_factory=datetime.now)
	metadata: Dict[str, Any] = field(default_factory=dict)

class FormatReport(BaseModel):
	"""Comprehensive format validation report"""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True, validate_default=True)
	
	report_id: str = Field(default_factory=uuid7str)
	document_id: str
	document_name: str = ""
	document_format: DocumentFormat
	assessment_date: datetime = Field(default_factory=datetime.now)
	format_compliance_score: float = Field(ge=0.0, le=100.0)
	total_requirements_checked: int = 0
	violations_found: int = 0
	critical_violations: int = 0
	high_violations: int = 0
	medium_violations: int = 0
	low_violations: int = 0
	violations: List[FormatViolation] = Field(default_factory=list)
	recommendations: List[str] = Field(default_factory=list)
	file_properties: Dict[str, Any] = Field(default_factory=dict)
	processing_time_ms: float = 0.0
	metadata: Dict[str, Any] = Field(default_factory=dict)

class FormatValidator:
	"""
	Comprehensive document format field_validator.
	
	Validates documents against format requirements including:
	- RFP format specifications
	- Document structure requirements  
	- Formatting standards (fonts, margins, spacing)
	- Accessibility compliance (WCAG 2.1, PDF/UA)
	- Submission standards (file formats, naming)
	"""
	
	def __init__(self):
		self.format_requirements: Dict[str, List[FormatRequirement]] = {}
		self._initialize_default_requirements()
	
	def _initialize_default_requirements(self) -> None:
		"""Initialize default format requirements"""
		
		# Document Structure Requirements
		structure_requirements = [
			FormatRequirement(
				name="Title Page Required",
				description="Document must include a title page with required elements",
				category="structure",
				severity=FormatSeverity.HIGH,
				validator_function="validate_title_page",
				parameters={"required_elements": ["title", "organization", "date", "proposal_number"]},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.DOCX]
			),
			FormatRequirement(
				name="Table of Contents Required",
				description="Document must include a table of contents",
				category="structure",
				severity=FormatSeverity.MEDIUM,
				validator_function="validate_table_of_contents",
				parameters={"min_sections": 3},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.DOCX]
			),
			FormatRequirement(
				name="Executive Summary Required", 
				description="Proposal must include an executive summary section",
				category="structure",
				severity=FormatSeverity.HIGH,
				validator_function="validate_executive_summary",
				parameters={"max_pages": 2},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.DOCX]
			),
			FormatRequirement(
				name="Section Headers Required",
				description="Document must use consistent section headers",
				category="structure",
				severity=FormatSeverity.MEDIUM,
				validator_function="validate_section_headers",
				parameters={"min_header_levels": 2},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.DOCX, DocumentFormat.HTML]
			),
			FormatRequirement(
				name="Page Numbering Required",
				description="Document must include page numbers on all pages",
				category="structure",
				severity=FormatSeverity.MEDIUM,
				validator_function="validate_page_numbering",
				parameters={},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.DOCX]
			)
		]
		
		# Formatting Requirements
		formatting_requirements = [
			FormatRequirement(
				name="Font Requirements",
				description="Document must use approved fonts and sizes",
				category="formatting",
				severity=FormatSeverity.MEDIUM,
				validator_function="validate_fonts",
				parameters={
					"approved_fonts": ["Times New Roman", "Arial", "Calibri", "Times"],
					"min_font_size": 10,
					"max_font_size": 12
				},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.DOCX]
			),
			FormatRequirement(
				name="Margin Requirements",
				description="Document must meet margin specifications",
				category="formatting",
				severity=FormatSeverity.MEDIUM,
				validator_function="validate_margins",
				parameters={
					"min_margin_inches": {"top": 1.0, "bottom": 1.0, "left": 1.0, "right": 1.0}
				},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.DOCX]
			),
			FormatRequirement(
				name="Line Spacing Requirements",
				description="Document must use appropriate line spacing",
				category="formatting",
				severity=FormatSeverity.LOW,
				validator_function="validate_line_spacing",
				parameters={"allowed_spacing": [1.0, 1.15, 1.5, 2.0]},
				applicable_formats=[DocumentFormat.DOCX]
			),
			FormatRequirement(
				name="Page Limits Compliance",
				description="Document must not exceed specified page limits",
				category="formatting",
				severity=FormatSeverity.CRITICAL,
				validator_function="validate_page_limits",
				parameters={"max_pages": 50},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.DOCX]
			),
			FormatRequirement(
				name="Image Quality Standards",
				description="Images must meet minimum resolution and quality standards",
				category="formatting",
				severity=FormatSeverity.MEDIUM,
				validator_function="validate_image_quality",
				parameters={"min_dpi": 300, "max_file_size_mb": 2},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.DOCX]
			)
		]
		
		# Accessibility Requirements
		accessibility_requirements = [
			FormatRequirement(
				name="PDF Accessibility Compliance",
				description="PDF documents must comply with PDF/UA standards",
				category="accessibility",
				severity=FormatSeverity.HIGH,
				validator_function="validate_pdf_accessibility",
				parameters={"check_tags": True, "check_alt_text": True},
				applicable_formats=[DocumentFormat.PDF]
			),
			FormatRequirement(
				name="Alt Text for Images",
				description="All images must include descriptive alt text",
				category="accessibility",
				severity=FormatSeverity.HIGH,
				validator_function="validate_alt_text",
				parameters={},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.DOCX, DocumentFormat.HTML]
			),
			FormatRequirement(
				name="Color Contrast Standards",
				description="Text must meet WCAG color contrast requirements",
				category="accessibility",
				severity=FormatSeverity.MEDIUM,
				validator_function="validate_color_contrast",
				parameters={"min_contrast_ratio": 4.5},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.HTML]
			),
			FormatRequirement(
				name="Reading Order",
				description="Document must have logical reading order",
				category="accessibility",
				severity=FormatSeverity.MEDIUM,
				validator_function="validate_reading_order",
				parameters={},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.HTML]
			)
		]
		
		# Submission Requirements
		submission_requirements = [
			FormatRequirement(
				name="File Format Compliance",
				description="Document must be in approved file format",
				category="submission",
				severity=FormatSeverity.CRITICAL,
				validator_function="validate_file_format",
				parameters={"approved_formats": ["pdf", "docx", "doc"]},
				applicable_formats=list(DocumentFormat)
			),
			FormatRequirement(
				name="File Naming Convention",
				description="File must follow specified naming convention",
				category="submission",
				severity=FormatSeverity.MEDIUM,
				validator_function="validate_file_naming",
				parameters={
					"pattern": r"^[A-Za-z0-9\-_]+\.(pdf|docx|doc)$",
					"max_filename_length": 100
				},
				applicable_formats=list(DocumentFormat)
			),
			FormatRequirement(
				name="File Size Limits",
				description="Document must not exceed maximum file size",
				category="submission",
				severity=FormatSeverity.HIGH,
				validator_function="validate_file_size",
				parameters={"max_size_mb": 25},
				applicable_formats=list(DocumentFormat)
			),
			FormatRequirement(
				name="Password Protection",
				description="Document must not be password protected",
				category="submission",
				severity=FormatSeverity.MEDIUM,
				validator_function="validate_password_protection",
				parameters={},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.DOCX]
			),
			FormatRequirement(
				name="Document Properties",
				description="Document must include required metadata properties",
				category="submission",
				severity=FormatSeverity.LOW,
				validator_function="validate_document_properties",
				parameters={"required_properties": ["title", "author", "subject"]},
				applicable_formats=[DocumentFormat.PDF, DocumentFormat.DOCX]
			)
		]
		
		# Store requirements by category
		self.format_requirements = {
			"structure": structure_requirements,
			"formatting": formatting_requirements,
			"accessibility": accessibility_requirements,
			"submission": submission_requirements
		}
	
	async def validate_document_format(
		self,
		document_path: str,
		document_content: Optional[str] = None,
		format_specifications: Optional[Dict[str, Any]] = None,
		document_id: Optional[str] = None
	) -> FormatReport:
		"""
		Validate document format against requirements
		
		Args:
			document_path: Path to document file
			document_content: Document text content (if available)
			format_specifications: Specific format requirements to check
			document_id: Unique document identifier
			
		Returns:
			FormatReport with validation results
		"""
		start_time = datetime.now()
		
		if document_id is None:
			document_id = uuid7str()
		
		# Determine document format
		document_format = self._detect_document_format(document_path)
		document_name = os.path.basename(document_path)
		
		# Get file properties
		file_properties = await self._extract_file_properties(document_path)
		
		# Get applicable requirements
		requirements = self._get_applicable_requirements(
			document_format, format_specifications
		)
		
		# Run format validation
		violations = []
		for requirement in requirements:
			if requirement.active:
				req_violations = await self._check_format_requirement(
					document_path, document_content, requirement, file_properties
				)
				violations.extend(req_violations)
		
		# Calculate format metrics
		total_requirements = len(requirements)
		violation_counts = self._count_violations_by_severity(violations)
		compliance_score = self._calculate_format_score(total_requirements, violation_counts)
		
		# Generate recommendations
		recommendations = self._generate_format_recommendations(violations)
		
		# Calculate processing time
		processing_time = (datetime.now() - start_time).total_seconds() * 1000
		
		return FormatReport(
			document_id=document_id,
			document_name=document_name,
			document_format=document_format,
			format_compliance_score=compliance_score,
			total_requirements_checked=total_requirements,
			violations_found=len(violations),
			critical_violations=violation_counts[FormatSeverity.CRITICAL],
			high_violations=violation_counts[FormatSeverity.HIGH],
			medium_violations=violation_counts[FormatSeverity.MEDIUM],
			low_violations=violation_counts[FormatSeverity.LOW],
			violations=violations,
			recommendations=recommendations,
			file_properties=file_properties,
			processing_time_ms=processing_time
		)
	
	def _detect_document_format(self, document_path: str) -> DocumentFormat:
		"""Detect document format from file extension and MIME type"""
		file_extension = Path(document_path).suffix.lower()
		
		format_mapping = {
			".pdf": DocumentFormat.PDF,
			".docx": DocumentFormat.DOCX,
			".doc": DocumentFormat.DOC,
			".html": DocumentFormat.HTML,
			".htm": DocumentFormat.HTML,
			".txt": DocumentFormat.TXT,
			".rtf": DocumentFormat.RTF
		}
		
		return format_mapping.get(file_extension, DocumentFormat.PDF)
	
	async def _extract_file_properties(self, document_path: str) -> Dict[str, Any]:
		"""Extract file properties and metadata"""
		properties = {}
		
		try:
			# Basic file info
			stat_info = os.stat(document_path)
			properties.update({
				"file_size_bytes": stat_info.st_size,
				"file_size_mb": round(stat_info.st_size / (1024 * 1024), 2),
				"creation_time": datetime.fromtimestamp(stat_info.st_ctime),
				"modification_time": datetime.fromtimestamp(stat_info.st_mtime),
				"file_extension": Path(document_path).suffix.lower(),
				"mime_type": mimetypes.guess_type(document_path)[0]
			})
			
			# Document-specific properties would be extracted here
			# This would typically use libraries like PyPDF2, python-docx, etc.
			# For now, we'll add placeholder values
			properties.update({
				"page_count": 1,  # Would be extracted from actual document
				"word_count": 0,   # Would be extracted from actual document
				"character_count": 0  # Would be extracted from actual document
			})
			
		except Exception as e:
			logger.error(f"Error extracting file properties: {str(e)}")
			properties = {"error": str(e)}
		
		return properties
	
	def _get_applicable_requirements(
		self,
		document_format: DocumentFormat,
		format_specifications: Optional[Dict[str, Any]] = None
	) -> List[FormatRequirement]:
		"""Get applicable format requirements for document"""
		applicable_requirements = []
		
		# Get all requirements that apply to this format
		for category, requirements in self.format_requirements.items():
			for requirement in requirements:
				if (not requirement.applicable_formats or 
					document_format in requirement.applicable_formats):
					# Apply format specifications if provided
					if format_specifications:
						requirement = self._apply_format_specifications(
							requirement, format_specifications
						)
					applicable_requirements.append(requirement)
		
		return applicable_requirements
	
	def _apply_format_specifications(
		self,
		requirement: FormatRequirement,
		specifications: Dict[str, Any]
	) -> FormatRequirement:
		"""Apply custom format specifications to requirement"""
		# This would merge custom specifications with default requirements
		# For example, custom page limits, font requirements, etc.
		# Implementation would depend on specific specification format
		return requirement
	
	async def _check_format_requirement(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Check a specific format requirement"""
		violations = []
		
		try:
			# Map field_validator functions to methods
			validator_methods = {
				"validate_title_page": self._validate_title_page,
				"validate_table_of_contents": self._validate_table_of_contents,
				"validate_executive_summary": self._validate_executive_summary,
				"validate_section_headers": self._validate_section_headers,
				"validate_page_numbering": self._validate_page_numbering,
				"validate_fonts": self._validate_fonts,
				"validate_margins": self._validate_margins,
				"validate_line_spacing": self._validate_line_spacing,
				"validate_page_limits": self._validate_page_limits,
				"validate_image_quality": self._validate_image_quality,
				"validate_pdf_accessibility": self._validate_pdf_accessibility,
				"validate_alt_text": self._validate_alt_text,
				"validate_color_contrast": self._validate_color_contrast,
				"validate_reading_order": self._validate_reading_order,
				"validate_file_format": self._validate_file_format,
				"validate_file_naming": self._validate_file_naming,
				"validate_file_size": self._validate_file_size,
				"validate_password_protection": self._validate_password_protection,
				"validate_document_properties": self._validate_document_properties
			}
			
			if requirement.validator_function in validator_methods:
				method = validator_methods[requirement.validator_function]
				result = await method(
					document_path, document_content, requirement, file_properties
				)
				if result:
					violations.extend(result)
					
		except Exception as e:
			logger.error(f"Error checking requirement {requirement.requirement_id}: {str(e)}")
		
		return violations
	
	async def _validate_title_page(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate title page presence and required elements"""
		violations = []
		
		if not document_content:
			return violations
		
		# Check for title page indicators
		title_page_patterns = [
			r"(?i)(proposal|response).*title",
			r"(?i)submitted\s+(to|by)",
			r"(?i)(rfp|request\s+for\s+proposal)",
			r"(?i)proposal\s+(number|id|reference)"
		]
		
		has_title_elements = any(
			re.search(pattern, document_content[:2000])  # Check first 2000 chars
			for pattern in title_page_patterns
		)
		
		if not has_title_elements:
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description="Document appears to be missing a title page or title page elements",
				severity=requirement.severity,
				location="document beginning",
				recommendation="Add a title page with required elements: title, organization, date, proposal number",
				category=requirement.category,
				metadata={"checked_patterns": title_page_patterns}
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_table_of_contents(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate table of contents presence"""
		violations = []
		
		if not document_content:
			return violations
		
		toc_patterns = [
			r"(?i)table\s+of\s+contents",
			r"(?i)contents",
			r"(?i)index"
		]
		
		has_toc = any(
			re.search(pattern, document_content)
			for pattern in toc_patterns
		)
		
		if not has_toc:
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description="Document is missing a table of contents",
				severity=requirement.severity,
				location="document",
				recommendation="Add a table of contents listing all major sections",
				category=requirement.category
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_executive_summary(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate executive summary presence"""
		violations = []
		
		if not document_content:
			return violations
		
		exec_summary_patterns = [
			r"(?i)executive\s+summary",
			r"(?i)summary",
			r"(?i)overview"
		]
		
		has_exec_summary = any(
			re.search(pattern, document_content)
			for pattern in exec_summary_patterns
		)
		
		if not has_exec_summary:
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description="Document is missing an executive summary",
				severity=requirement.severity,
				location="document",
				recommendation="Add an executive summary section highlighting key points",
				category=requirement.category
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_section_headers(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate section headers and structure"""
		violations = []
		
		if not document_content:
			return violations
		
		# Look for numbered sections or clear headers
		header_patterns = [
			r"^\s*\d+\.?\s+[A-Z]",  # Numbered sections
			r"^[A-Z\s]+$",          # ALL CAPS headers
			r"^\s*[A-Z][a-z\s:]+$"  # Title Case headers
		]
		
		lines = document_content.split('\n')
		header_count = 0
		
		for line in lines[:100]:  # Check first 100 lines
			if any(re.match(pattern, line.strip()) for pattern in header_patterns):
				header_count += 1
		
		min_headers = requirement.parameters.get("min_header_levels", 2)
		if header_count < min_headers:
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description=f"Document has insufficient section headers ({header_count} found, {min_headers} required)",
				severity=requirement.severity,
				location="document structure",
				recommendation="Use clear section headers to organize content",
				category=requirement.category,
				metadata={"headers_found": header_count, "min_required": min_headers}
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_page_numbering(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate page numbering presence"""
		violations = []
		
		# This would require actual document parsing to check for page numbers
		# For now, we'll create a placeholder validation
		
		page_count = file_properties.get("page_count", 1)
		if page_count > 1:
			# In a real implementation, this would check for actual page numbers
			# For now, we'll assume documents > 1 page need page numbers
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description="Multi-page document should include page numbers",
				severity=requirement.severity,
				location="document pages",
				recommendation="Add page numbers to all pages",
				category=requirement.category,
				metadata={"page_count": page_count}
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_fonts(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate font requirements"""
		violations = []
		
		# This would require document parsing to extract font information
		# For now, we'll create a placeholder validation
		approved_fonts = requirement.parameters.get("approved_fonts", [])
		
		# Placeholder: assume font validation passes unless document format doesn't support analysis
		if not approved_fonts:
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description="Cannot validate font requirements - no approved fonts specified",
				severity=FormatSeverity.WARNING,
				location="document formatting",
				recommendation="Ensure document uses approved fonts",
				category=requirement.category
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_margins(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate margin requirements"""
		violations = []
		
		# This would require document parsing to extract margin information
		# For now, we'll create a placeholder validation
		min_margins = requirement.parameters.get("min_margin_inches", {})
		
		if min_margins:
			# Placeholder validation
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description="Margin validation requires document parsing - please verify manually",
				severity=FormatSeverity.WARNING,
				location="document formatting",
				recommendation=f"Ensure margins meet requirements: {min_margins}",
				category=requirement.category,
				metadata={"required_margins": min_margins}
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_line_spacing(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate line spacing requirements"""
		violations = []
		
		# Placeholder validation for line spacing
		allowed_spacing = requirement.parameters.get("allowed_spacing", [])
		
		if allowed_spacing:
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description="Line spacing validation requires document parsing",
				severity=FormatSeverity.WARNING,
				location="document formatting",
				recommendation=f"Ensure line spacing is one of: {allowed_spacing}",
				category=requirement.category,
				metadata={"allowed_spacing": allowed_spacing}
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_page_limits(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate page limit compliance"""
		violations = []
		
		max_pages = requirement.parameters.get("max_pages", 50)
		actual_pages = file_properties.get("page_count", 1)
		
		if actual_pages > max_pages:
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description=f"Document exceeds page limit ({actual_pages} pages, {max_pages} allowed)",
				severity=requirement.severity,
				location="document length",
				recommendation=f"Reduce document to {max_pages} pages or fewer",
				category=requirement.category,
				metadata={"actual_pages": actual_pages, "max_pages": max_pages}
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_image_quality(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate image quality standards"""
		violations = []
		
		# This would require image extraction and analysis
		min_dpi = requirement.parameters.get("min_dpi", 300)
		
		# Placeholder validation
		violation = FormatViolation(
			requirement_id=requirement.requirement_id,
			requirement_name=requirement.name,
			description="Image quality validation requires image extraction",
			severity=FormatSeverity.WARNING,
			location="document images",
			recommendation=f"Ensure all images are at least {min_dpi} DPI",
			category=requirement.category,
			metadata={"min_dpi": min_dpi}
		)
		violations.append(violation)
		
		return violations
	
	async def _validate_pdf_accessibility(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate PDF accessibility compliance"""
		violations = []
		
		document_format = self._detect_document_format(document_path)
		if document_format != DocumentFormat.PDF:
			return violations
		
		# This would require PDF accessibility analysis
		violation = FormatViolation(
			requirement_id=requirement.requirement_id,
			requirement_name=requirement.name,
			description="PDF accessibility validation requires specialized PDF analysis",
			severity=FormatSeverity.WARNING,
			location="PDF accessibility",
			recommendation="Ensure PDF complies with PDF/UA standards and includes proper tags",
			category=requirement.category
		)
		violations.append(violation)
		
		return violations
	
	async def _validate_alt_text(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate alt text for images"""
		violations = []
		
		# This would require image detection and alt text extraction
		violation = FormatViolation(
			requirement_id=requirement.requirement_id,
			requirement_name=requirement.name,
			description="Alt text validation requires image and metadata analysis",
			severity=FormatSeverity.WARNING,
			location="document images",
			recommendation="Ensure all images include descriptive alt text",
			category=requirement.category
		)
		violations.append(violation)
		
		return violations
	
	async def _validate_color_contrast(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate color contrast requirements"""
		violations = []
		
		min_contrast = requirement.parameters.get("min_contrast_ratio", 4.5)
		
		# This would require color analysis
		violation = FormatViolation(
			requirement_id=requirement.requirement_id,
			requirement_name=requirement.name,
			description="Color contrast validation requires color analysis",
			severity=FormatSeverity.WARNING,
			location="document colors",
			recommendation=f"Ensure text has contrast ratio of at least {min_contrast}:1",
			category=requirement.category,
			metadata={"min_contrast_ratio": min_contrast}
		)
		violations.append(violation)
		
		return violations
	
	async def _validate_reading_order(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate logical reading order"""
		violations = []
		
		# This would require document structure analysis
		violation = FormatViolation(
			requirement_id=requirement.requirement_id,
			requirement_name=requirement.name,
			description="Reading order validation requires document structure analysis",
			severity=FormatSeverity.WARNING,
			location="document structure",
			recommendation="Ensure document has logical reading order for accessibility",
			category=requirement.category
		)
		violations.append(violation)
		
		return violations
	
	async def _validate_file_format(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate file format compliance"""
		violations = []
		
		approved_formats = requirement.parameters.get("approved_formats", ["pdf", "docx"])
		file_extension = Path(document_path).suffix.lower().lstrip('.')
		
		if file_extension not in approved_formats:
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description=f"File format '{file_extension}' is not approved",
				severity=requirement.severity,
				location="file format",
				recommendation=f"Convert to approved format: {', '.join(approved_formats)}",
				category=requirement.category,
				metadata={"actual_format": file_extension, "approved_formats": approved_formats}
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_file_naming(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate file naming convention"""
		violations = []
		
		filename = os.path.basename(document_path)
		pattern = requirement.parameters.get("pattern", r"^[A-Za-z0-9\-_]+\.(pdf|docx|doc)$")
		max_length = requirement.parameters.get("max_filename_length", 100)
		
		if not re.match(pattern, filename):
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description=f"Filename '{filename}' doesn't match required pattern",
				severity=requirement.severity,
				location="filename",
				recommendation=f"Rename file to match pattern: {pattern}",
				category=requirement.category,
				metadata={"filename": filename, "pattern": pattern}
			)
			violations.append(violation)
		
		if len(filename) > max_length:
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description=f"Filename too long ({len(filename)} chars, {max_length} max)",
				severity=requirement.severity,
				location="filename",
				recommendation=f"Shorten filename to {max_length} characters or fewer",
				category=requirement.category,
				metadata={"filename_length": len(filename), "max_length": max_length}
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_file_size(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate file size limits"""
		violations = []
		
		max_size_mb = requirement.parameters.get("max_size_mb", 25)
		actual_size_mb = file_properties.get("file_size_mb", 0)
		
		if actual_size_mb > max_size_mb:
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description=f"File size ({actual_size_mb}MB) exceeds limit ({max_size_mb}MB)",
				severity=requirement.severity,
				location="file size",
				recommendation=f"Reduce file size to {max_size_mb}MB or smaller",
				category=requirement.category,
				metadata={"actual_size_mb": actual_size_mb, "max_size_mb": max_size_mb}
			)
			violations.append(violation)
		
		return violations
	
	async def _validate_password_protection(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate password protection requirements"""
		violations = []
		
		# This would require attempting to open the document
		# For now, we'll create a placeholder validation
		violation = FormatViolation(
			requirement_id=requirement.requirement_id,
			requirement_name=requirement.name,
			description="Password protection check requires document opening test",
			severity=FormatSeverity.WARNING,
			location="document security",
			recommendation="Ensure document is not password protected",
			category=requirement.category
		)
		violations.append(violation)
		
		return violations
	
	async def _validate_document_properties(
		self,
		document_path: str,
		document_content: Optional[str],
		requirement: FormatRequirement,
		file_properties: Dict[str, Any]
	) -> List[FormatViolation]:
		"""Validate document properties and metadata"""
		violations = []
		
		required_properties = requirement.parameters.get("required_properties", [])
		
		# This would require document metadata extraction
		if required_properties:
			violation = FormatViolation(
				requirement_id=requirement.requirement_id,
				requirement_name=requirement.name,
				description="Document properties validation requires metadata extraction",
				severity=FormatSeverity.WARNING,
				location="document metadata",
				recommendation=f"Ensure document includes properties: {', '.join(required_properties)}",
				category=requirement.category,
				metadata={"required_properties": required_properties}
			)
			violations.append(violation)
		
		return violations
	
	def _count_violations_by_severity(
		self,
		violations: List[FormatViolation]
	) -> Dict[FormatSeverity, int]:
		"""Count violations by severity level"""
		counts = {severity: 0 for severity in FormatSeverity}
		
		for violation in violations:
			counts[violation.severity] += 1
		
		return counts
	
	def _calculate_format_score(
		self,
		total_requirements: int,
		violation_counts: Dict[FormatSeverity, int]
	) -> float:
		"""Calculate overall format compliance score (0-100)"""
		if total_requirements == 0:
			return 100.0
		
		# Weight violations by severity
		severity_weights = {
			FormatSeverity.CRITICAL: 10,
			FormatSeverity.HIGH: 5,
			FormatSeverity.MEDIUM: 2,
			FormatSeverity.LOW: 1,
			FormatSeverity.WARNING: 0.5
		}
		
		total_deductions = 0
		for severity, count in violation_counts.items():
			total_deductions += count * severity_weights[severity]
		
		# Calculate score as percentage
		max_possible_deductions = total_requirements * severity_weights[FormatSeverity.CRITICAL]
		if max_possible_deductions == 0:
			return 100.0
		
		score = 100.0 - (total_deductions / max_possible_deductions * 100)
		return max(0.0, min(100.0, score))
	
	def _generate_format_recommendations(
		self,
		violations: List[FormatViolation]
	) -> List[str]:
		"""Generate actionable format recommendations"""
		recommendations = []
		
		# Group violations by category
		category_violations = {}
		for violation in violations:
			category = violation.category
			if category not in category_violations:
				category_violations[category] = []
			category_violations[category].append(violation)
		
		# Generate category-specific recommendations
		for category, cat_violations in category_violations.items():
			if category == "structure":
				recommendations.append(
					"Review document structure requirements and ensure all required sections "
					"are included with proper organization and formatting."
				)
			elif category == "formatting":
				recommendations.append(
					"Check document formatting including fonts, margins, line spacing, and "
					"page limits to ensure compliance with specifications."
				)
			elif category == "accessibility":
				recommendations.append(
					"Improve document accessibility by adding alt text, ensuring color contrast, "
					"and providing proper document structure for assistive technologies."
				)
			elif category == "submission":
				recommendations.append(
					"Verify file format, naming convention, file size, and other submission "
					"requirements are met before final submission."
				)
		
		# Add priority recommendations
		critical_violations = [v for v in violations if v.severity == FormatSeverity.CRITICAL]
		if critical_violations:
			recommendations.insert(0,
				f"Address {len(critical_violations)} critical format violations immediately "
				"as these may result in submission rejection."
			)
		
		return recommendations
	
	async def add_custom_requirement(
		self,
		requirement: FormatRequirement,
		category: str = "custom"
	) -> None:
		"""Add a custom format requirement"""
		if category not in self.format_requirements:
			self.format_requirements[category] = []
		
		self.format_requirements[category].append(requirement)
	
	async def get_format_requirements(self, category: Optional[str] = None) -> List[FormatRequirement]:
		"""Get format requirements by category"""
		if category and category in self.format_requirements:
			return self.format_requirements[category]
		
		all_requirements = []
		for requirements in self.format_requirements.values():
			all_requirements.extend(requirements)
		return all_requirements