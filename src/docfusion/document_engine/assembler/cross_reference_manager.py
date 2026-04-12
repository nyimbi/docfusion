"""
CrossReferenceManager Module - Advanced Reference Management System

This module provides comprehensive cross-reference management for DocuFusion,
including automatic numbering, reference tracking, link validation, and 
bibliography management. Designed for Git + LaTeX integration with professional
document standards.

Key Features:
- Automatic numbering systems with multiple formats
- Real-time reference tracking and validation
- LaTeX reference command generation
- Bibliography and citation management
- Cross-document reference support
- Performance-optimized graph processing
"""

import asyncio
import json
import re
import weakref
from collections import defaultdict, deque
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol, Optional, Union
from uuid import uuid4

from pydantic import BaseModel, Field, ConfigDict
from pydantic.dataclasses import dataclass as pydantic_dataclass

from .content_assembler import ContentBlock, uuid7str
from .structure_builder import DocumentStructure, DocumentSection


# Core Data Models
@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class CrossReference:
	"""Core cross-reference representation"""
	# Required fields first
	source_id: str  # Content block or section containing the reference
	target_id: str  # Target element being referenced
	reference_type: str  # figure, table, section, equation, citation, external
	reference_text: str  # The actual reference text (e.g., "Figure 1", "Section 2.3")
	
	# Optional fields with defaults
	reference_id: str = Field(default_factory=uuid7str)
	display_format: str = "auto"  # auto, number_only, title_only, full
	custom_text: str = ""  # User-defined reference text override
	
	# Positioning and context
	source_position: int = 0  # Position within source content
	source_context: str = ""  # Surrounding text for context
	target_scope: str = "document"  # document, section, chapter
	
	# Validation and status
	validation_status: str = "valid"  # valid, invalid, warning, pending
	validation_errors: list[str] = Field(default_factory=list)
	last_validated: datetime = Field(default_factory=datetime.now)
	
	# Formatting and presentation
	numbering_scheme: str = "decimal"  # decimal, roman, alpha, custom
	prefix: str = ""  # "Figure ", "Table ", "Section "
	suffix: str = ""  # Additional text after number
	styling: dict[str, str] = Field(default_factory=dict)
	
	# Temporal tracking
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)
	access_count: int = 0
	
	# Metadata
	metadata: dict[str, Any] = Field(default_factory=dict)
	tags: list[str] = Field(default_factory=list)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class ReferenceTarget:
	"""Target element that can be referenced"""
	# Required fields
	target_type: str  # figure, table, section, equation, citation
	content_id: str  # Associated content block or section ID
	
	# Optional fields
	target_id: str = Field(default_factory=uuid7str)
	number: str = ""  # Auto-generated number (e.g., "1", "2.3", "A")
	title: str = ""  # Element title or caption
	label: str = ""  # LaTeX-style label for reference
	anchor_id: str = ""  # HTML anchor or unique identifier
	
	# Content and description
	content: str = ""  # Element content (for validation)
	caption: str = ""  # Caption or description
	alt_text: str = ""  # Alternative text for accessibility
	
	# Positioning and hierarchy
	section_id: str = ""  # Parent section
	document_id: str = ""  # Parent document
	hierarchy_level: int = 0  # Nesting level for numbering
	display_order: int = 0  # Order within document
	
	# Formatting and style
	numbering_format: str = "decimal"
	caption_format: str = "default"
	styling_class: str = ""
	custom_formatting: dict[str, str] = Field(default_factory=dict)
	
	# References to this target
	referring_references: list[str] = Field(default_factory=list)  # IDs of references pointing here
	reference_count: int = 0
	
	# Validation and status
	validation_status: str = "valid"
	validation_errors: list[str] = Field(default_factory=list)
	
	# Temporal data
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class NumberingScheme:
	"""Numbering scheme configuration"""
	# Required fields
	scheme_name: str
	scheme_type: str  # decimal, roman, alpha, custom
	pattern: str  # Format pattern (e.g., "{section}.{number}", "{prefix}{number}{suffix}")
	
	# Optional fields
	scheme_id: str = Field(default_factory=uuid7str)
	prefix: str = ""
	suffix: str = ""
	separator: str = "."
	
	# Hierarchy and scope
	hierarchical: bool = True
	scope: str = "document"  # document, section, chapter
	reset_on_section: bool = False
	inherit_parent: bool = True
	
	# Counter configuration
	start_number: int = 1
	increment: int = 1
	counter_type: str = "sequential"  # sequential, chapter_based, custom
	
	# Format rules
	format_rules: dict[str, str] = Field(default_factory=dict)
	localization: dict[str, str] = Field(default_factory=dict)
	
	# Application scope
	applies_to: list[str] = Field(default_factory=list)  # List of target types
	document_types: list[str] = Field(default_factory=list)  # Applicable document types


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class Citation:
	"""Citation and bibliography entry"""
	# Required fields
	citation_key: str  # Unique key for referencing (e.g., "smith2024")
	citation_type: str  # book, article, website, report, thesis, etc.
	title: str
	
	# Optional fields
	citation_id: str = Field(default_factory=uuid7str)
	authors: list[str] = Field(default_factory=list)
	editors: list[str] = Field(default_factory=list)
	publication_year: int | None = None
	publication_date: str = ""
	
	# Publication details
	journal: str = ""
	volume: str = ""
	issue: str = ""
	pages: str = ""
	publisher: str = ""
	location: str = ""
	isbn: str = ""
	doi: str = ""
	url: str = ""
	
	# Additional metadata
	abstract: str = ""
	keywords: list[str] = Field(default_factory=list)
	language: str = "en"
	access_date: str = ""  # For web sources
	
	# Citation formatting
	citation_style: str = "apa"  # apa, mla, chicago, ieee, custom
	formatted_citation: str = ""
	bibliography_entry: str = ""
	
	# Usage tracking
	referenced_by: list[str] = Field(default_factory=list)  # Reference IDs
	usage_count: int = 0
	
	# Validation and quality
	validation_status: str = "pending"
	validation_errors: list[str] = Field(default_factory=list)
	quality_score: float = 0.0
	
	# Import and synchronization
	source_database: str = ""  # External source (Zotero, Mendeley, etc.)
	external_id: str = ""
	last_synced: datetime | None = None
	
	# Temporal data
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class ReferenceGraph:
	"""Graph representation of all references in a document"""
	# Required fields
	document_id: str
	
	# Optional fields
	graph_id: str = Field(default_factory=uuid7str)
	references: dict[str, CrossReference] = Field(default_factory=dict)
	targets: dict[str, ReferenceTarget] = Field(default_factory=dict)
	citations: dict[str, Citation] = Field(default_factory=dict)
	
	# Graph relationships
	reference_edges: dict[str, str] = Field(default_factory=dict)  # reference_id -> target_id
	reverse_edges: dict[str, list[str]] = Field(default_factory=dict)  # target_id -> [reference_ids]
	
	# Graph metrics
	total_references: int = 0
	total_targets: int = 0
	total_citations: int = 0
	validation_score: float = 1.0
	
	# Performance optimization
	reference_index: dict[str, list[str]] = Field(default_factory=dict)  # type -> [reference_ids]
	target_index: dict[str, list[str]] = Field(default_factory=dict)  # type -> [target_ids]
	section_index: dict[str, list[str]] = Field(default_factory=dict)  # section_id -> [reference_ids]
	
	# Change tracking
	change_log: list[dict[str, Any]] = Field(default_factory=list)
	last_updated: datetime = Field(default_factory=datetime.now)
	version: str = "1.0.0"


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class ValidationResult:
	"""Result of reference validation operations"""
	valid: bool
	errors: list[str] = Field(default_factory=list)
	warnings: list[str] = Field(default_factory=list)
	suggestions: list[str] = Field(default_factory=list)
	validation_time: float = 0.0
	validated_at: datetime = Field(default_factory=datetime.now)


# Exception Classes
class CrossReferenceException(Exception):
	"""Base exception for cross-reference operations"""
	pass


class ReferenceNotFoundException(CrossReferenceException):
	"""Reference target not found"""
	pass


class InvalidReferenceException(CrossReferenceException):
	"""Invalid reference format or content"""
	pass


class CircularReferenceException(CrossReferenceException):
	"""Circular reference detected"""
	pass


class NumberingException(CrossReferenceException):
	"""Numbering system error"""
	pass


# Core Components
class ReferenceDetector:
	"""Automatic reference detection and classification"""
	
	def __init__(self):
		self.detection_patterns = self._initialize_detection_patterns()
		self.reference_types = {
			'figure': ['fig', 'figure', 'image', 'diagram', 'chart'],
			'table': ['tab', 'table', 'tbl'],
			'section': ['sec', 'section', 'chapter', 'subsection'],
			'equation': ['eq', 'equation', 'formula'],
			'citation': ['cite', 'ref', 'reference']
		}
	
	def _initialize_detection_patterns(self) -> dict[str, re.Pattern]:
		"""Initialize regex patterns for reference detection"""
		patterns = {
			'latex_ref': re.compile(r'\\ref\{([^}]+)\}'),
			'latex_cite': re.compile(r'\\cite(?:\[[^\]]*\])?\{([^}]+)\}'),
			'latex_label': re.compile(r'\\label\{([^}]+)\}'),
			'generic_ref': re.compile(r'\b(?:Figure|Table|Section|Equation)\s+(\d+(?:\.\d+)*)\b', re.IGNORECASE),
			'see_reference': re.compile(r'\bsee\s+(?:Figure|Table|Section|Equation)\s+(\d+(?:\.\d+)*)\b', re.IGNORECASE),
			'parenthetical_ref': re.compile(r'\((?:Figure|Table|Section|Equation)\s+(\d+(?:\.\d+)*)\)', re.IGNORECASE)
		}
		return patterns
	
	async def detect_references(self, content: str, content_id: str) -> list[CrossReference]:
		"""Detect all references in content"""
		assert isinstance(content, str), "content must be string"
		assert isinstance(content_id, str), "content_id must be string"
		
		references = []
		
		# Detect LaTeX references
		latex_refs = await self._detect_latex_references(content, content_id)
		references.extend(latex_refs)
		
		# Detect generic text references
		text_refs = await self._detect_text_references(content, content_id)
		references.extend(text_refs)
		
		# Detect citations
		citations = await self._detect_citations(content, content_id)
		references.extend(citations)
		
		assert isinstance(references, list), "References must be list"
		return references
	
	async def _detect_latex_references(self, content: str, content_id: str) -> list[CrossReference]:
		"""Detect LaTeX \\ref{} references"""
		references = []
		
		for match in self.detection_patterns['latex_ref'].finditer(content):
			ref_label = match.group(1)
			ref_type = self._classify_reference_type(ref_label)
			
			reference = CrossReference(
				source_id=content_id,
				target_id=ref_label,  # Will be resolved later
				reference_type=ref_type,
				reference_text=match.group(0),
				source_position=match.start(),
				source_context=self._extract_context(content, match.start())
			)
			references.append(reference)
		
		return references
	
	async def _detect_text_references(self, content: str, content_id: str) -> list[CrossReference]:
		"""Detect generic text references"""
		references = []
		
		for match in self.detection_patterns['generic_ref'].finditer(content):
			ref_text = match.group(0)
			ref_number = match.group(1)
			ref_type = self._classify_reference_type(ref_text.lower())
			
			reference = CrossReference(
				source_id=content_id,
				target_id=f"{ref_type}_{ref_number}",  # Will be resolved later
				reference_type=ref_type,
				reference_text=ref_text,
				source_position=match.start(),
				source_context=self._extract_context(content, match.start())
			)
			references.append(reference)
		
		return references
	
	async def _detect_citations(self, content: str, content_id: str) -> list[CrossReference]:
		"""Detect LaTeX citations"""
		references = []
		
		for match in self.detection_patterns['latex_cite'].finditer(content):
			cite_keys = match.group(1).split(',')
			
			for cite_key in cite_keys:
				cite_key = cite_key.strip()
				reference = CrossReference(
					source_id=content_id,
					target_id=cite_key,
					reference_type="citation",
					reference_text=match.group(0),
					source_position=match.start(),
					source_context=self._extract_context(content, match.start())
				)
				references.append(reference)
		
		return references
	
	async def detect_targets(self, content: str, content_id: str) -> list[ReferenceTarget]:
		"""Detect referenceable targets in content"""
		assert isinstance(content, str), "content must be string"
		assert isinstance(content_id, str), "content_id must be string"
		
		targets = []
		
		# Detect LaTeX labels
		for match in self.detection_patterns['latex_label'].finditer(content):
			label = match.group(1)
			target_type = self._classify_reference_type(label)
			
			target = ReferenceTarget(
				target_type=target_type,
				content_id=content_id,
				label=label,
				anchor_id=label,
				content=self._extract_context(content, match.start(), 100)
			)
			targets.append(target)
		
		# Detect figure and table environments
		targets.extend(await self._detect_latex_environments(content, content_id))
		
		assert isinstance(targets, list), "Targets must be list"
		return targets
	
	async def _detect_latex_environments(self, content: str, content_id: str) -> list[ReferenceTarget]:
		"""Detect LaTeX figure and table environments"""
		targets = []
		
		# Figure environments
		fig_pattern = re.compile(r'\\begin\{figure\}(.*?)\\end\{figure\}', re.DOTALL)
		for match in fig_pattern.finditer(content):
			fig_content = match.group(1)
			
			# Extract caption and label
			caption_match = re.search(r'\\caption\{([^}]+)\}', fig_content)
			label_match = re.search(r'\\label\{([^}]+)\}', fig_content)
			
			target = ReferenceTarget(
				target_type="figure",
				content_id=content_id,
				content=fig_content,
				caption=caption_match.group(1) if caption_match else "",
				label=label_match.group(1) if label_match else f"fig_{uuid7str()[:8]}",
				anchor_id=label_match.group(1) if label_match else f"fig_{uuid7str()[:8]}"
			)
			targets.append(target)
		
		# Table environments
		tab_pattern = re.compile(r'\\begin\{table\}(.*?)\\end\{table\}', re.DOTALL)
		for match in tab_pattern.finditer(content):
			tab_content = match.group(1)
			
			# Extract caption and label
			caption_match = re.search(r'\\caption\{([^}]+)\}', tab_content)
			label_match = re.search(r'\\label\{([^}]+)\}', tab_content)
			
			target = ReferenceTarget(
				target_type="table",
				content_id=content_id,
				content=tab_content,
				caption=caption_match.group(1) if caption_match else "",
				label=label_match.group(1) if label_match else f"tab_{uuid7str()[:8]}",
				anchor_id=label_match.group(1) if label_match else f"tab_{uuid7str()[:8]}"
			)
			targets.append(target)
		
		return targets
	
	def _classify_reference_type(self, reference_text: str) -> str:
		"""Classify reference type based on pattern and context"""
		text_lower = reference_text.lower()
		
		for ref_type, keywords in self.reference_types.items():
			if any(keyword in text_lower for keyword in keywords):
				return ref_type
		
		# Default classification based on prefix patterns
		if text_lower.startswith(('sec:', 'sect:')):
			return 'section'
		elif text_lower.startswith(('fig:', 'figure:')):
			return 'figure'
		elif text_lower.startswith(('tab:', 'table:')):
			return 'table'
		elif text_lower.startswith(('eq:', 'equation:')):
			return 'equation'
		
		return 'generic'
	
	def _extract_context(self, content: str, position: int, window_size: int = 50) -> str:
		"""Extract context around reference for validation"""
		start = max(0, position - window_size)
		end = min(len(content), position + window_size)
		return content[start:end].strip()


class NumberingEngine:
	"""Automatic numbering system for all referenceable elements"""
	
	def __init__(self):
		self.numbering_schemes = self._initialize_numbering_schemes()
		self.counters = defaultdict(int)
		self.hierarchical_counters = defaultdict(lambda: defaultdict(int))
	
	def _initialize_numbering_schemes(self) -> dict[str, NumberingScheme]:
		"""Initialize default numbering schemes"""
		schemes = {}
		
		# Decimal scheme
		schemes['decimal'] = NumberingScheme(
			scheme_name="decimal",
			scheme_type="decimal",
			pattern="{number}",
			applies_to=["figure", "table", "equation"],
			document_types=["proposal", "report", "article"]
		)
		
		# Hierarchical decimal scheme
		schemes['hierarchical'] = NumberingScheme(
			scheme_name="hierarchical",
			scheme_type="decimal",
			pattern="{section}.{number}",
			hierarchical=True,
			applies_to=["figure", "table", "equation"],
			document_types=["report", "thesis", "book"]
		)
		
		# Roman scheme
		schemes['roman'] = NumberingScheme(
			scheme_name="roman",
			scheme_type="roman",
			pattern="{number}",
			applies_to=["section", "chapter"],
			document_types=["formal", "legal"]
		)
		
		return schemes
	
	async def apply_numbering(
		self, 
		targets: list[ReferenceTarget], 
		scheme: NumberingScheme,
		structure: DocumentStructure = None
	) -> list[ReferenceTarget]:
		"""Apply numbering scheme to targets"""
		assert isinstance(targets, list), "targets must be list"
		assert isinstance(scheme, NumberingScheme), "scheme must be NumberingScheme"
		
		# Group targets by type and section
		grouped_targets = self._group_targets(targets, scheme)
		
		# Apply numbering to each group
		numbered_targets = []
		for target_type, type_targets in grouped_targets.items():
			if target_type in scheme.applies_to:
				numbered = await self._apply_numbering_to_group(
					type_targets, scheme, structure
				)
				numbered_targets.extend(numbered)
			else:
				numbered_targets.extend(type_targets)
		
		assert isinstance(numbered_targets, list), "Result must be list"
		return numbered_targets
	
	def _group_targets(
		self, 
		targets: list[ReferenceTarget], 
		scheme: NumberingScheme
	) -> dict[str, list[ReferenceTarget]]:
		"""Group targets by type and section for numbering"""
		grouped = defaultdict(list)
		
		for target in targets:
			grouped[target.target_type].append(target)
		
		# Sort each group by display order
		for target_type in grouped:
			grouped[target_type].sort(key=lambda t: (t.section_id, t.display_order))
		
		return dict(grouped)
	
	async def _apply_numbering_to_group(
		self, 
		targets: list[ReferenceTarget], 
		scheme: NumberingScheme,
		structure: DocumentStructure = None
	) -> list[ReferenceTarget]:
		"""Apply numbering to a group of targets of the same type"""
		counter = scheme.start_number
		current_section = None
		section_counter = scheme.start_number
		
		for target in targets:
			# Reset counter for new section if required
			if scheme.reset_on_section and target.section_id != current_section:
				section_counter = scheme.start_number
				current_section = target.section_id
			
			# Generate number based on scheme
			if scheme.hierarchical and structure:
				# Get section number for hierarchical numbering
				section_number = self._get_section_number(target.section_id, structure)
				target.number = self._format_hierarchical_number(
					section_number, section_counter, scheme
				)
			else:
				target.number = self._format_number(counter, scheme)
			
			# Update target with numbering information
			target.numbering_format = scheme.scheme_type
			target.updated_at = datetime.now()
			
			# Increment counters
			counter += scheme.increment
			section_counter += scheme.increment
		
		return targets
	
	def _get_section_number(self, section_id: str, structure: DocumentStructure) -> str:
		"""Get section number for hierarchical numbering"""
		for section in structure.sections:
			if section.section_id == section_id:
				return section.section_number or "1"
		return "1"
	
	def _format_hierarchical_number(
		self, 
		section_number: str, 
		item_number: int, 
		scheme: NumberingScheme
	) -> str:
		"""Format hierarchical number (e.g., 2.3 for third item in section 2)"""
		if scheme.scheme_type == "roman":
			item_str = self._to_roman(item_number)
		elif scheme.scheme_type == "alpha":
			item_str = self._to_alpha(item_number)
		else:
			item_str = str(item_number)
		
		return f"{section_number}.{item_str}"
	
	def _format_number(self, number: int, scheme: NumberingScheme) -> str:
		"""Format number according to scheme type"""
		if scheme.scheme_type == "roman":
			return self._to_roman(number)
		elif scheme.scheme_type == "alpha":
			return self._to_alpha(number)
		else:
			return str(number)
	
	def _to_roman(self, num: int) -> str:
		"""Convert integer to Roman numeral"""
		values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
		literals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I']
		
		result = ""
		for i, value in enumerate(values):
			count = num // value
			if count:
				result += literals[i] * count
				num -= value * count
		return result
	
	def _to_alpha(self, num: int) -> str:
		"""Convert integer to alphabetic (A, B, C, ...)"""
		if num <= 0:
			return "A"
		
		result = ""
		while num > 0:
			num -= 1
			result = chr(65 + (num % 26)) + result
			num //= 26
		return result


class ReferenceValidator:
	"""Reference validation and integrity checking"""
	
	def __init__(self):
		self.validation_cache = {}
		self.repair_suggestions = defaultdict(list)
	
	async def validate_reference_graph(self, graph: ReferenceGraph) -> ValidationResult:
		"""Validate entire reference graph"""
		assert isinstance(graph, ReferenceGraph), "graph must be ReferenceGraph"
		
		start_time = datetime.now()
		errors = []
		warnings = []
		suggestions = []
		
		# Validate individual references
		for ref_id, reference in graph.references.items():
			ref_result = await self.validate_reference(reference, graph)
			errors.extend(ref_result.errors)
			warnings.extend(ref_result.warnings)
			suggestions.extend(ref_result.suggestions)
		
		# Check for circular references
		circular_refs = self.detect_circular_references(graph)
		if circular_refs:
			errors.extend([f"Circular reference detected: {ref}" for ref in circular_refs])
		
		# Check for orphaned references
		orphaned_refs = self.find_orphaned_references(graph)
		if orphaned_refs:
			warnings.extend([f"Orphaned reference: {ref}" for ref in orphaned_refs])
		
		# Check for duplicate targets
		duplicate_targets = self.find_duplicate_targets(graph)
		if duplicate_targets:
			warnings.extend([f"Duplicate target: {target}" for target in duplicate_targets])
		
		validation_time = (datetime.now() - start_time).total_seconds()
		
		result = ValidationResult(
			valid=len(errors) == 0,
			errors=errors,
			warnings=warnings,
			suggestions=suggestions,
			validation_time=validation_time
		)
		
		assert isinstance(result, ValidationResult), "Result must be ValidationResult"
		return result
	
	async def validate_reference(
		self, 
		reference: CrossReference, 
		graph: ReferenceGraph
	) -> ValidationResult:
		"""Validate individual reference"""
		assert isinstance(reference, CrossReference), "reference must be CrossReference"
		assert isinstance(graph, ReferenceGraph), "graph must be ReferenceGraph"
		
		errors = []
		warnings = []
		suggestions = []
		
		# Check if target exists
		target_exists = reference.target_id in graph.targets
		if not target_exists and reference.reference_type != "citation":
			errors.append(f"Reference target not found: {reference.target_id}")
			suggestions.extend(self._suggest_target_matches(reference.target_id, graph))
		
		# Check citation references
		if reference.reference_type == "citation":
			citation_exists = reference.target_id in graph.citations
			if not citation_exists:
				errors.append(f"Citation not found: {reference.target_id}")
		
		# Validate reference format
		if not self._validate_reference_format(reference):
			warnings.append(f"Invalid reference format: {reference.reference_text}")
		
		# Check scope validity
		if not self._validate_reference_scope(reference, graph):
			warnings.append(f"Reference scope violation: {reference.reference_id}")
		
		result = ValidationResult(
			valid=len(errors) == 0,
			errors=errors,
			warnings=warnings,
			suggestions=suggestions
		)
		
		assert isinstance(result, ValidationResult), "Result must be ValidationResult"
		return result
	
	def detect_circular_references(self, graph: ReferenceGraph) -> list[str]:
		"""Detect circular reference chains"""
		assert isinstance(graph, ReferenceGraph), "graph must be ReferenceGraph"
		
		visited = set()
		recursion_stack = set()
		circular_refs = []
		
		def dfs(ref_id: str, path: list[str]) -> bool:
			if ref_id in recursion_stack:
				# Found cycle
				cycle_start = path.index(ref_id)
				circular_refs.append(" -> ".join(path[cycle_start:] + [ref_id]))
				return True
			
			if ref_id in visited:
				return False
			
			visited.add(ref_id)
			recursion_stack.add(ref_id)
			
			# Check references from this target
			if ref_id in graph.reverse_edges:
				for next_ref_id in graph.reverse_edges[ref_id]:
					if next_ref_id in graph.reference_edges:
						next_target = graph.reference_edges[next_ref_id]
						if dfs(next_target, path + [ref_id]):
							return True
			
			recursion_stack.remove(ref_id)
			return False
		
		# Check all targets
		for target_id in graph.targets:
			if target_id not in visited:
				dfs(target_id, [])
		
		return circular_refs
	
	def find_orphaned_references(self, graph: ReferenceGraph) -> list[str]:
		"""Find references with missing targets"""
		assert isinstance(graph, ReferenceGraph), "graph must be ReferenceGraph"
		
		orphaned = []
		
		for ref_id, reference in graph.references.items():
			if reference.reference_type == "citation":
				# Check citation references
				if reference.target_id not in graph.citations:
					orphaned.append(ref_id)
			else:
				# Check regular references
				if reference.target_id not in graph.targets:
					orphaned.append(ref_id)
		
		return orphaned
	
	def find_duplicate_targets(self, graph: ReferenceGraph) -> list[str]:
		"""Find duplicate target labels"""
		assert isinstance(graph, ReferenceGraph), "graph must be ReferenceGraph"
		
		label_counts = defaultdict(list)
		
		for target_id, target in graph.targets.items():
			if target.label:
				label_counts[target.label].append(target_id)
		
		duplicates = []
		for label, target_ids in label_counts.items():
			if len(target_ids) > 1:
				duplicates.extend(target_ids)
		
		return duplicates
	
	def _validate_reference_format(self, reference: CrossReference) -> bool:
		"""Validate reference format"""
		# Basic format validation
		if not reference.reference_text:
			return False
		
		# Check for valid LaTeX reference format
		if reference.reference_text.startswith('\\'):
			return bool(re.match(r'\\(?:ref|cite)\{[^}]+\}', reference.reference_text))
		
		return True
	
	def _validate_reference_scope(self, reference: CrossReference, graph: ReferenceGraph) -> bool:
		"""Validate reference scope"""
		# For now, all references are valid in document scope
		# Future: implement section/chapter scope validation
		return True
	
	def _suggest_target_matches(self, target_id: str, graph: ReferenceGraph) -> list[str]:
		"""Suggest potential target matches for broken reference"""
		suggestions = []
		
		# Simple similarity matching
		for existing_target_id in graph.targets:
			similarity = self._calculate_similarity(target_id, existing_target_id)
			if similarity > 0.6:  # 60% similarity threshold
				suggestions.append(f"Did you mean '{existing_target_id}'?")
		
		return suggestions[:3]  # Return top 3 suggestions
	
	def _calculate_similarity(self, str1: str, str2: str) -> float:
		"""Calculate string similarity (simple implementation)"""
		if not str1 or not str2:
			return 0.0
		
		# Simple character-based similarity
		common_chars = set(str1.lower()) & set(str2.lower())
		total_chars = set(str1.lower()) | set(str2.lower())
		
		if not total_chars:
			return 0.0
		
		return len(common_chars) / len(total_chars)


class CitationManager:
	"""Bibliography and citation management"""
	
	def __init__(self):
		self.citation_styles = self._initialize_citation_styles()
		self.citation_cache = {}
	
	def _initialize_citation_styles(self) -> dict[str, dict[str, str]]:
		"""Initialize citation style templates"""
		styles = {
			'apa': {
				'book': "{authors} ({year}). {title}. {publisher}.",
				'article': "{authors} ({year}). {title}. {journal}, {volume}({issue}), {pages}.",
				'website': "{authors} ({year}). {title}. Retrieved from {url}"
			},
			'mla': {
				'book': "{authors}. {title}. {publisher}, {year}.",
				'article': "{authors}. \"{title}.\" {journal}, vol. {volume}, no. {issue}, {year}, pp. {pages}.",
				'website': "{authors}. \"{title}.\" {website}, {date}, {url}."
			},
			'ieee': {
				'book': "{authors}, {title}. {publisher}, {year}.",
				'article': "{authors}, \"{title},\" {journal}, vol. {volume}, no. {issue}, pp. {pages}, {year}.",
				'website': "{authors}. \"{title}.\" [Online]. Available: {url}"
			}
		}
		return styles
	
	async def generate_bibliography(
		self, 
		citations: list[Citation], 
		style: str = "apa"
	) -> str:
		"""Generate formatted bibliography"""
		assert isinstance(citations, list), "citations must be list"
		assert isinstance(style, str), "style must be string"
		
		if style not in self.citation_styles:
			style = "apa"  # Default fallback
		
		bibliography_entries = []
		
		# Sort citations alphabetically by first author
		sorted_citations = sorted(citations, key=lambda c: c.authors[0] if c.authors else c.title)
		
		for citation in sorted_citations:
			formatted = await self.format_citation(citation, style, "bibliography")
			if formatted:
				bibliography_entries.append(formatted)
		
		# Generate bibliography header and entries
		bibliography = "\\begin{thebibliography}{99}\n"
		for entry in bibliography_entries:
			bibliography += f"\\bibitem{{{citation.citation_key}}} {entry}\n"
		bibliography += "\\end{thebibliography}"
		
		assert isinstance(bibliography, str), "Bibliography must be string"
		return bibliography
	
	async def format_citation(
		self, 
		citation: Citation, 
		style: str, 
		format_type: str = "inline"
	) -> str:
		"""Format individual citation"""
		assert isinstance(citation, Citation), "citation must be Citation"
		assert isinstance(style, str), "style must be string"
		assert format_type in ["inline", "bibliography"], "Invalid format type"
		
		if style not in self.citation_styles:
			style = "apa"
		
		style_templates = self.citation_styles[style]
		citation_type = citation.citation_type
		
		if citation_type not in style_templates:
			citation_type = "book"  # Default fallback
		
		template = style_templates[citation_type]
		
		# Prepare citation data
		citation_data = {
			'authors': self._format_authors(citation.authors, style),
			'year': str(citation.publication_year) if citation.publication_year else "n.d.",
			'title': citation.title,
			'journal': citation.journal,
			'volume': citation.volume,
			'issue': citation.issue,
			'pages': citation.pages,
			'publisher': citation.publisher,
			'url': citation.url,
			'date': citation.publication_date,
			'website': citation.journal or "Website"
		}
		
		# Format citation
		try:
			formatted = template.format(**citation_data)
		except KeyError:
			# Handle missing fields gracefully
			formatted = f"{citation_data['authors']} ({citation_data['year']}). {citation.title}."
		
		assert isinstance(formatted, str), "Formatted citation must be string"
		return formatted
	
	def _format_authors(self, authors: list[str], style: str) -> str:
		"""Format author list according to citation style"""
		if not authors:
			return "Anonymous"
		
		if len(authors) == 1:
			return authors[0]
		elif len(authors) == 2:
			if style == "apa":
				return f"{authors[0]} & {authors[1]}"
			else:
				return f"{authors[0]} and {authors[1]}"
		else:
			if style == "apa":
				return f"{authors[0]} et al."
			else:
				return f"{authors[0]} et al."
	
	async def validate_citation(self, citation: Citation) -> ValidationResult:
		"""Validate citation completeness and format"""
		assert isinstance(citation, Citation), "citation must be Citation"
		
		errors = []
		warnings = []
		
		# Required fields check
		if not citation.title:
			errors.append("Citation missing title")
		
		if not citation.authors:
			warnings.append("Citation missing authors")
		
		if not citation.publication_year and not citation.publication_date:
			warnings.append("Citation missing publication date")
		
		# Type-specific validation
		if citation.citation_type == "article":
			if not citation.journal:
				warnings.append("Article citation missing journal name")
		elif citation.citation_type == "book":
			if not citation.publisher:
				warnings.append("Book citation missing publisher")
		elif citation.citation_type == "website":
			if not citation.url:
				errors.append("Website citation missing URL")
		
		result = ValidationResult(
			valid=len(errors) == 0,
			errors=errors,
			warnings=warnings
		)
		
		assert isinstance(result, ValidationResult), "Result must be ValidationResult"
		return result


class LaTeXReferenceGenerator:
	"""Generate LaTeX reference commands for Git + LaTeX integration"""
	
	def __init__(self):
		self.command_templates = {
			'label': '\\label{{{label}}}',
			'ref': '\\ref{{{label}}}',
			'cite': '\\cite{{{key}}}',
			'pageref': '\\pageref{{{label}}}'
		}
	
	def generate_latex_labels(self, targets: list[ReferenceTarget]) -> dict[str, str]:
		"""Generate LaTeX \\label commands for targets"""
		assert isinstance(targets, list), "targets must be list"
		
		labels = {}
		
		for target in targets:
			if target.label:
				labels[target.target_id] = self.command_templates['label'].format(
					label=target.label
				)
		
		assert isinstance(labels, dict), "Labels must be dict"
		return labels
	
	def generate_latex_references(self, references: list[CrossReference]) -> dict[str, str]:
		"""Generate LaTeX \\ref commands for references"""
		assert isinstance(references, list), "references must be list"
		
		refs = {}
		
		for reference in references:
			if reference.reference_type != "citation":
				refs[reference.reference_id] = self.command_templates['ref'].format(
					label=reference.target_id
				)
		
		assert isinstance(refs, dict), "References must be dict"
		return refs
	
	def generate_latex_citations(self, references: list[CrossReference]) -> dict[str, str]:
		"""Generate LaTeX \\cite commands for citations"""
		assert isinstance(references, list), "references must be list"
		
		citations = {}
		
		for reference in references:
			if reference.reference_type == "citation":
				citations[reference.reference_id] = self.command_templates['cite'].format(
					key=reference.target_id
				)
		
		assert isinstance(citations, dict), "Citations must be dict"
		return citations
	
	def generate_latex_bibliography(self, citations: list[Citation]) -> str:
		"""Generate LaTeX bibliography from citations"""
		assert isinstance(citations, list), "citations must be list"
		
		# For BibTeX integration
		bib_entries = []
		
		for citation in citations:
			entry_type = self._map_citation_type_to_bibtex(citation.citation_type)
			
			bib_entry = f"@{entry_type}{{{citation.citation_key},\n"
			
			# Add fields
			if citation.title:
				bib_entry += f"  title = {{{citation.title}}},\n"
			if citation.authors:
				authors_str = " and ".join(citation.authors)
				bib_entry += f"  author = {{{authors_str}}},\n"
			if citation.publication_year:
				bib_entry += f"  year = {{{citation.publication_year}}},\n"
			if citation.journal:
				bib_entry += f"  journal = {{{citation.journal}}},\n"
			if citation.volume:
				bib_entry += f"  volume = {{{citation.volume}}},\n"
			if citation.pages:
				bib_entry += f"  pages = {{{citation.pages}}},\n"
			if citation.publisher:
				bib_entry += f"  publisher = {{{citation.publisher}}},\n"
			if citation.url:
				bib_entry += f"  url = {{{citation.url}}},\n"
			
			bib_entry = bib_entry.rstrip(',\n') + "\n}\n"
			bib_entries.append(bib_entry)
		
		result = "\n".join(bib_entries)
		assert isinstance(result, str), "Bibliography must be string"
		return result
	
	def _map_citation_type_to_bibtex(self, citation_type: str) -> str:
		"""Map citation type to BibTeX entry type"""
		mapping = {
			'book': 'book',
			'article': 'article',
			'website': 'misc',
			'report': 'techreport',
			'thesis': 'phdthesis',
			'conference': 'inproceedings'
		}
		return mapping.get(citation_type, 'misc')


# Main CrossReferenceManager Class
class CrossReferenceManager:
	"""Main cross-reference management system"""
	
	def __init__(self):
		self.detector = ReferenceDetector()
		self.numbering_engine = NumberingEngine()
		self.field_validator = ReferenceValidator()
		self.citation_manager = CitationManager()
		self.latex_generator = LaTeXReferenceGenerator()
		
		# Performance optimization
		self.graph_cache = {}
		self.validation_cache = {}
		
		# Statistics
		self.performance_stats = {
			"graphs_built": 0,
			"references_processed": 0,
			"validations_performed": 0,
			"average_processing_time": 0.0
		}
	
	async def build_reference_graph(
		self, 
		document_id: str, 
		content_blocks: list[ContentBlock], 
		structure: DocumentStructure = None
	) -> ReferenceGraph:
		"""Build complete reference graph for document"""
		assert isinstance(document_id, str), "document_id must be string"
		assert isinstance(content_blocks, list), "content_blocks must be list"
		
		start_time = datetime.now()
		
		# Create reference graph
		graph = ReferenceGraph(document_id=document_id)
		
		# Detect references and targets in all content blocks
		all_references = []
		all_targets = []
		
		for block in content_blocks:
			# Detect references in this block
			block_refs = await self.detector.detect_references(block.content, block.block_id)
			all_references.extend(block_refs)
			
			# Detect targets in this block
			block_targets = await self.detector.detect_targets(block.content, block.block_id)
			all_targets.extend(block_targets)
		
		# Add section targets from structure
		if structure:
			section_targets = self._create_section_targets(structure)
			all_targets.extend(section_targets)
		
		# Apply numbering to targets
		if all_targets:
			default_scheme = self.numbering_engine.numbering_schemes['decimal']
			numbered_targets = await self.numbering_engine.apply_numbering(
				all_targets, default_scheme, structure
			)
			all_targets = numbered_targets
		
		# Build graph structure
		graph.references = {ref.reference_id: ref for ref in all_references}
		graph.targets = {target.target_id: target for target in all_targets}
		
		# Build reference mappings
		graph.reference_edges = {
			ref.reference_id: ref.target_id 
			for ref in all_references
		}
		
		# Build reverse mappings
		for ref_id, target_id in graph.reference_edges.items():
			if target_id not in graph.reverse_edges:
				graph.reverse_edges[target_id] = []
			graph.reverse_edges[target_id].append(ref_id)
		
		# Build indexes for performance
		graph.reference_index = self._build_reference_index(all_references)
		graph.target_index = self._build_target_index(all_targets)
		
		# Update metrics
		graph.total_references = len(all_references)
		graph.total_targets = len(all_targets)
		
		# Update performance stats
		processing_time = (datetime.now() - start_time).total_seconds()
		self._update_performance_stats(processing_time, len(all_references))
		
		# Cache graph
		self.graph_cache[document_id] = graph
		
		assert isinstance(graph, ReferenceGraph), "Result must be ReferenceGraph"
		return graph
	
	def _create_section_targets(self, structure: DocumentStructure) -> list[ReferenceTarget]:
		"""Create reference targets for document sections"""
		targets = []
		
		for section in structure.sections:
			if section.level > 0:  # Skip title pages
				target = ReferenceTarget(
					target_type="section",
					content_id=section.section_id,
					title=section.title,
					label=f"sec:{section.anchor_id}" if section.anchor_id else f"sec:{section.section_id}",
					anchor_id=section.anchor_id or section.section_id,
					number=section.section_number,
					section_id=section.section_id,
					document_id=structure.document_id,
					hierarchy_level=section.level,
					display_order=section.sibling_order
				)
				targets.append(target)
		
		return targets
	
	def _build_reference_index(self, references: list[CrossReference]) -> dict[str, list[str]]:
		"""Build reference type index for performance"""
		index = defaultdict(list)
		
		for reference in references:
			index[reference.reference_type].append(reference.reference_id)
		
		return dict(index)
	
	def _build_target_index(self, targets: list[ReferenceTarget]) -> dict[str, list[str]]:
		"""Build target type index for performance"""
		index = defaultdict(list)
		
		for target in targets:
			index[target.target_type].append(target.target_id)
		
		return dict(index)
	
	async def validate_document_references(
		self, 
		graph: ReferenceGraph
	) -> ValidationResult:
		"""Validate all references in document"""
		assert isinstance(graph, ReferenceGraph), "graph must be ReferenceGraph"
		
		result = await self.field_validator.validate_reference_graph(graph)
		
		# Update graph validation score
		graph.validation_score = 1.0 if result.valid else max(0.0, 1.0 - len(result.errors) * 0.1)
		
		# Cache validation result
		self.validation_cache[graph.graph_id] = result
		
		assert isinstance(result, ValidationResult), "Result must be ValidationResult"
		return result
	
	async def generate_latex_commands(self, graph: ReferenceGraph) -> dict[str, str]:
		"""Generate LaTeX commands for Git + LaTeX integration"""
		assert isinstance(graph, ReferenceGraph), "graph must be ReferenceGraph"
		
		commands = {}
		
		# Generate labels for targets
		targets = list(graph.targets.values())
		labels = self.latex_generator.generate_latex_labels(targets)
		commands.update(labels)
		
		# Generate references
		references = list(graph.references.values())
		refs = self.latex_generator.generate_latex_references(references)
		commands.update(refs)
		
		# Generate citations
		citations = self.latex_generator.generate_latex_citations(references)
		commands.update(citations)
		
		assert isinstance(commands, dict), "Commands must be dict"
		return commands
	
	async def generate_bibliography(
		self, 
		citations: list[Citation], 
		style: str = "apa", 
		format: str = "latex"
	) -> str:
		"""Generate formatted bibliography"""
		assert isinstance(citations, list), "citations must be list"
		assert isinstance(style, str), "style must be string"
		
		if format == "latex":
			result = self.latex_generator.generate_latex_bibliography(citations)
		else:
			result = await self.citation_manager.generate_bibliography(citations, style)
		
		assert isinstance(result, str), "Bibliography must be string"
		return result
	
	def get_reference_statistics(self, graph: ReferenceGraph) -> dict[str, Any]:
		"""Get comprehensive reference statistics"""
		assert isinstance(graph, ReferenceGraph), "graph must be ReferenceGraph"
		
		stats = {
			"total_references": graph.total_references,
			"total_targets": graph.total_targets,
			"total_citations": graph.total_citations,
			"validation_score": graph.validation_score,
			"reference_types": {},
			"target_types": {},
			"broken_references": 0,
			"orphaned_targets": 0
		}
		
		# Count by type
		for ref in graph.references.values():
			ref_type = ref.reference_type
			stats["reference_types"][ref_type] = stats["reference_types"].get(ref_type, 0) + 1
		
		for target in graph.targets.values():
			target_type = target.target_type
			stats["target_types"][target_type] = stats["target_types"].get(target_type, 0) + 1
		
		# Count broken references
		for ref in graph.references.values():
			if ref.validation_status != "valid":
				stats["broken_references"] += 1
		
		# Count orphaned targets (no references pointing to them)
		for target_id in graph.targets:
			if target_id not in graph.reverse_edges:
				stats["orphaned_targets"] += 1
		
		return stats
	
	def _update_performance_stats(self, processing_time: float, reference_count: int) -> None:
		"""Update performance statistics"""
		self.performance_stats["graphs_built"] += 1
		self.performance_stats["references_processed"] += reference_count
		
		# Update average processing time
		total_graphs = self.performance_stats["graphs_built"]
		current_avg = self.performance_stats["average_processing_time"]
		self.performance_stats["average_processing_time"] = (
			(current_avg * (total_graphs - 1) + processing_time) / total_graphs
		)
	
	def get_performance_stats(self) -> dict[str, Any]:
		"""Get current performance statistics"""
		return self.performance_stats.copy()
	
	def clear_caches(self) -> None:
		"""Clear all caches"""
		self.graph_cache.clear()
		self.validation_cache.clear()
		self.citation_manager.citation_cache.clear()


# Mock integration functions for testing
async def create_mock_citations() -> list[Citation]:
	"""Create mock citations for testing"""
	citations = [
		Citation(
			citation_key="smith2024",
			citation_type="article",
			title="Advanced Document Intelligence Systems",
			authors=["Smith, J.", "Johnson, M."],
			publication_year=2024,
			journal="Journal of AI Research",
			volume="15",
			issue="3",
			pages="123-145"
		),
		Citation(
			citation_key="doe2023",
			citation_type="book",
			title="Modern Document Processing Techniques",
			authors=["Doe, A."],
			publication_year=2023,
			publisher="Tech Publications",
			location="New York"
		),
		Citation(
			citation_key="wilson2024",
			citation_type="website",
			title="LaTeX Best Practices for Professional Documents",
			authors=["Wilson, R."],
			publication_year=2024,
			url="https://example.com/latex-practices",
			access_date="2024-01-15"
		)
	]
	
	return citations