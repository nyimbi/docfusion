"""
StructureBuilder Module - Hierarchical Document Structure Management

This module provides comprehensive document structure management for DocuFusion,
including template-driven generation, section hierarchy management, automatic
table of contents generation, and document outline creation.

Key Features:
- Template-driven structure generation with inheritance
- Multi-level section hierarchy management (up to 6 levels)
- Automatic TOC generation with customizable formatting
- Document outline creation and export
- Performance optimization with caching and async processing
- Integration with Git + LaTeX file-based system
"""

import asyncio
import json
import weakref
from collections import defaultdict, deque
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Protocol, Optional, Union
from uuid import uuid4

from pydantic import BaseModel, Field, ConfigDict
from pydantic.dataclasses import dataclass as pydantic_dataclass

from .content_assembler import ContentBlock, uuid7str


# Core Data Models
@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class DocumentSection:
	"""Individual section within document structure"""
	# Required fields first
	title: str
	section_type: str  # heading, content, appendix, toc, index
	
	# Optional fields with defaults
	section_id: str = Field(default_factory=uuid7str)
	level: int = 1  # 1-6 depth levels
	parent_id: str | None = None
	child_ids: list[str] = Field(default_factory=list)
	sibling_order: int = 0
	section_number: str = ""  # Auto-generated: "1.2.3"
	
	# Content association
	content_block_ids: list[str] = Field(default_factory=list)
	content_requirements: dict[str, Any] = Field(default_factory=dict)
	optional_content: bool = False
	
	# Template configuration
	template_section: str = ""
	template_variables: dict[str, Any] = Field(default_factory=dict)
	styling_rules: dict[str, str] = Field(default_factory=dict)
	
	# Navigation and references
	anchor_id: str = ""
	cross_references: list[str] = Field(default_factory=list)
	backlinks: list[str] = Field(default_factory=list)
	
	# Metadata
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)
	section_status: str = "active"  # active, hidden, conditional
	priority: int = 0


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class TOCConfiguration:
	"""Table of Contents configuration and formatting"""
	enabled: bool = True
	max_depth: int = 3
	min_depth: int = 1
	
	# Formatting options
	numbering_style: str = "decimal"  # decimal, roman, alpha, none
	indentation_style: str = "spaces"  # spaces, tabs, bullets
	indentation_size: int = 4
	
	# Content filtering
	include_sections: list[str] = Field(default_factory=list)
	exclude_sections: list[str] = Field(default_factory=list)
	section_types: list[str] = Field(default_factory=lambda: ["heading", "content"])
	
	# Styling and presentation
	title: str = "Table of Contents"
	page_numbers: bool = True
	clickable_links: bool = True
	custom_formatting: dict[str, str] = Field(default_factory=dict)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class TOCEntry:
	"""Individual entry in table of contents"""
	section_id: str
	title: str
	level: int
	section_number: str = ""
	page_number: int | None = None
	anchor_id: str = ""
	indent_level: int = 0


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class TableOfContents:
	"""Complete table of contents representation"""
	toc_id: str = Field(default_factory=uuid7str)
	document_id: str = ""
	title: str = "Table of Contents"
	entries: list[TOCEntry] = Field(default_factory=list)
	configuration: TOCConfiguration = Field(default_factory=TOCConfiguration)
	generated_at: datetime = Field(default_factory=datetime.now)
	total_entries: int = 0
	max_depth_used: int = 0


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class SectionDefinition:
	"""Template section definition"""
	# Required fields
	name: str
	section_type: str
	
	# Optional fields
	title_template: str = ""
	required: bool = True
	level: int = 1
	order: int = 0
	content_types: list[str] = Field(default_factory=list)
	template_variables: dict[str, Any] = Field(default_factory=dict)
	conditions: dict[str, str] = Field(default_factory=dict)
	child_sections: list[str] = Field(default_factory=list)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class TemplateVariable:
	"""Template variable definition"""
	name: str
	variable_type: str  # string, integer, boolean, list, dict
	default_value: Any = None
	required: bool = False
	description: str = ""
	validation_rules: dict[str, Any] = Field(default_factory=dict)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class DocumentTemplate:
	"""Template definition for document structure generation"""
	# Required fields
	template_name: str
	template_type: str  # proposal, report, presentation, technical_doc
	
	# Optional fields
	template_id: str = Field(default_factory=uuid7str)
	base_template: str | None = None  # For template inheritance
	template_version: str = "1.0.0"
	
	# Section definitions
	section_definitions: list[SectionDefinition] = Field(default_factory=list)
	required_sections: list[str] = Field(default_factory=list)
	optional_sections: list[str] = Field(default_factory=list)
	conditional_sections: dict[str, str] = Field(default_factory=dict)  # section_id -> condition
	
	# Structure rules
	max_depth: int = 6
	auto_numbering_format: str = "1.2.3"  # or "I.A.1", "a.i.1", etc.
	section_ordering_rules: dict[str, int] = Field(default_factory=dict)
	
	# TOC configuration
	default_toc_config: TOCConfiguration = Field(default_factory=TOCConfiguration)
	toc_placement: str = "after_title"  # after_title, before_content, custom
	
	# Template variables
	variables: dict[str, TemplateVariable] = Field(default_factory=dict)
	variable_validation: dict[str, str] = Field(default_factory=dict)
	
	# Integration configuration
	latex_class: str = "docufusion-proposal"
	git_integration: bool = True
	file_structure: dict[str, str] = Field(default_factory=dict)  # section -> file mapping


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class DocumentStructure:
	"""Hierarchical document structure representation"""
	# Required fields
	document_id: str
	template_name: str
	
	# Optional fields
	structure_id: str = Field(default_factory=uuid7str)
	sections: list[DocumentSection] = Field(default_factory=list)
	section_tree: dict[str, list[str]] = Field(default_factory=dict)  # parent -> children
	max_depth: int = 6
	
	# Table of contents
	toc_config: TOCConfiguration = Field(default_factory=TOCConfiguration)
	generated_toc: list[TOCEntry] = Field(default_factory=list)
	
	# Metadata and configuration
	template_version: str = "1.0.0"
	structure_version: str = "1.0.0"
	auto_numbering: bool = True
	custom_ordering: dict[str, int] = Field(default_factory=dict)
	
	# Performance optimization
	structure_hash: str = ""
	last_compiled: datetime = Field(default_factory=datetime.now)
	compilation_time: float = 0.0
	
	# Integration points
	content_block_mapping: dict[str, str] = Field(default_factory=dict)  # block_id -> section_id
	template_variables: dict[str, Any] = Field(default_factory=dict)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class DocumentOutline:
	"""Document outline representation"""
	outline_id: str = Field(default_factory=uuid7str)
	document_id: str = ""
	title: str = ""
	sections: list[dict[str, Any]] = Field(default_factory=list)
	summaries: dict[str, str] = Field(default_factory=dict)
	total_sections: int = 0
	outline_depth: int = 0
	generated_at: datetime = Field(default_factory=datetime.now)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class ValidationResult:
	"""Result of validation operations"""
	valid: bool
	errors: list[str] = Field(default_factory=list)
	warnings: list[str] = Field(default_factory=list)
	validation_time: float = 0.0
	validated_at: datetime = Field(default_factory=datetime.now)


@pydantic_dataclass(config=ConfigDict(extra='forbid', validate_by_name=True, validate_assignment=True))
class CompiledTemplate:
	"""Compiled template ready for structure generation"""
	template_id: str
	compiled_sections: list[SectionDefinition]
	resolved_variables: dict[str, Any]
	section_order: list[str]
	compilation_time: float = 0.0
	compiled_at: datetime = Field(default_factory=datetime.now)


# Exception Classes
class StructureBuilderException(Exception):
	"""Base exception for StructureBuilder operations"""
	pass


class TemplateException(StructureBuilderException):
	"""Template-related exceptions"""
	pass


class TemplateNotFound(TemplateException):
	"""Template not found"""
	pass


class TemplateInvalid(TemplateException):
	"""Invalid template structure"""
	pass


class StructureException(StructureBuilderException):
	"""Structure-related exceptions"""
	pass


class HierarchyInvalid(StructureException):
	"""Invalid hierarchy structure"""
	pass


class DepthLimitExceeded(StructureException):
	"""Section depth limit exceeded"""
	pass


# Core Components
class NumberingSystem:
	"""Section numbering system with multiple formats"""
	
	def __init__(self):
		self.numbering_formats = {
			"1.2.3": self._decimal_numbering,
			"I.A.1": self._roman_alpha_numbering,
			"a.i.1": self._alpha_roman_numbering
		}
	
	def generate_section_number(
		self, 
		section: DocumentSection, 
		parent_number: str = "", 
		format_type: str = "1.2.3"
	) -> str:
		"""Generate section number based on hierarchy and format"""
		assert isinstance(section, DocumentSection), "section must be DocumentSection"
		assert isinstance(format_type, str), "format_type must be string"
		
		numbering_func = self.numbering_formats.get(format_type, self._decimal_numbering)
		result = numbering_func(section, parent_number)
		
		assert isinstance(result, str), "Generated number must be string"
		return result
	
	def _decimal_numbering(self, section: DocumentSection, parent_number: str) -> str:
		"""Generate decimal numbering (1.2.3)"""
		if not parent_number:
			return str(section.sibling_order + 1)
		return f"{parent_number}.{section.sibling_order + 1}"
	
	def _roman_alpha_numbering(self, section: DocumentSection, parent_number: str) -> str:
		"""Generate Roman-Alpha numbering (I.A.1)"""
		level_formatters = [
			lambda x: self._to_roman(x).upper(),  # I, II, III
			lambda x: chr(64 + x),  # A, B, C
			lambda x: str(x)  # 1, 2, 3
		]
		
		level = section.level - 1
		if level < len(level_formatters):
			formatter = level_formatters[level]
			number = formatter(section.sibling_order + 1)
		else:
			number = str(section.sibling_order + 1)
		
		if not parent_number:
			return number
		return f"{parent_number}.{number}"
	
	def _alpha_roman_numbering(self, section: DocumentSection, parent_number: str) -> str:
		"""Generate Alpha-Roman numbering (a.i.1)"""
		level_formatters = [
			lambda x: chr(96 + x),  # a, b, c
			lambda x: self._to_roman(x).lower(),  # i, ii, iii
			lambda x: str(x)  # 1, 2, 3
		]
		
		level = section.level - 1
		if level < len(level_formatters):
			formatter = level_formatters[level]
			number = formatter(section.sibling_order + 1)
		else:
			number = str(section.sibling_order + 1)
		
		if not parent_number:
			return number
		return f"{parent_number}.{number}"
	
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


class TemplateCache:
	"""High-performance template caching system"""
	
	def __init__(self, max_size: int = 50):
		self.max_size = max_size
		self.templates: dict[str, DocumentTemplate] = {}
		self.compiled_templates: dict[str, CompiledTemplate] = {}
		self.access_times: dict[str, datetime] = {}
		self.dependencies: dict[str, set[str]] = defaultdict(set)
	
	def get_template(self, template_name: str) -> DocumentTemplate | None:
		"""Get template from cache"""
		assert isinstance(template_name, str), "template_name must be string"
		
		if template_name in self.templates:
			self.access_times[template_name] = datetime.now()
			return self.templates[template_name]
		return None
	
	def store_template(self, template: DocumentTemplate) -> None:
		"""Store template in cache"""
		assert isinstance(template, DocumentTemplate), "template must be DocumentTemplate"
		
		if len(self.templates) >= self.max_size:
			self._evict_oldest()
		
		self.templates[template.template_name] = template
		self.access_times[template.template_name] = datetime.now()
	
	def get_compiled_template(self, template_id: str) -> CompiledTemplate | None:
		"""Get compiled template from cache"""
		assert isinstance(template_id, str), "template_id must be string"
		
		return self.compiled_templates.get(template_id)
	
	def store_compiled_template(self, compiled: CompiledTemplate) -> None:
		"""Store compiled template in cache"""
		assert isinstance(compiled, CompiledTemplate), "compiled must be CompiledTemplate"
		
		self.compiled_templates[compiled.template_id] = compiled
	
	def invalidate_template(self, template_name: str) -> None:
		"""Invalidate template and dependencies"""
		assert isinstance(template_name, str), "template_name must be string"
		
		# Remove from caches
		self.templates.pop(template_name, None)
		self.access_times.pop(template_name, None)
		
		# Invalidate compiled templates that depend on this template
		to_remove = []
		for template_id, compiled in self.compiled_templates.items():
			if template_name in self.dependencies.get(template_id, set()):
				to_remove.append(template_id)
		
		for template_id in to_remove:
			self.compiled_templates.pop(template_id, None)
	
	def _evict_oldest(self) -> None:
		"""Evict oldest template from cache"""
		if not self.access_times:
			return
		
		oldest_template = min(self.access_times.items(), key=lambda x: x[1])[0]
		self.invalidate_template(oldest_template)


class TemplateEngine:
	"""Core template processing and compilation engine"""
	
	def __init__(self):
		self.template_cache = TemplateCache()
		self.numbering_system = NumberingSystem()
		self._built_in_templates = self._initialize_built_in_templates()
	
	def _initialize_built_in_templates(self) -> dict[str, DocumentTemplate]:
		"""Initialize built-in document templates"""
		templates = {}
		
		# Proposal template
		proposal_template = DocumentTemplate(
			template_name="proposal",
			template_type="proposal",
			section_definitions=[
				SectionDefinition(
					name="title_page",
					section_type="heading",
					title_template="Proposal for {client_name}",
					level=0,
					order=0,
					required=True
				),
				SectionDefinition(
					name="executive_summary",
					section_type="content",
					title_template="Executive Summary",
					level=1,
					order=1,
					required=True,
					content_types=["text"]
				),
				SectionDefinition(
					name="technical_approach",
					section_type="content",
					title_template="Technical Approach",
					level=1,
					order=2,
					required=True,
					content_types=["text", "table", "image"]
				),
				SectionDefinition(
					name="project_timeline",
					section_type="content",
					title_template="Project Timeline",
					level=1,
					order=3,
					required=True,
					content_types=["text", "table", "chart"]
				),
				SectionDefinition(
					name="team_qualifications",
					section_type="content",
					title_template="Team Qualifications",
					level=1,
					order=4,
					required=False,
					content_types=["text", "table"]
				),
				SectionDefinition(
					name="budget",
					section_type="content",
					title_template="Budget Breakdown",
					level=1,
					order=5,
					required=True,
					content_types=["text", "table"]
				),
				SectionDefinition(
					name="appendices",
					section_type="appendix",
					title_template="Appendices",
					level=1,
					order=6,
					required=False
				)
			],
			required_sections=["title_page", "executive_summary", "technical_approach", "project_timeline", "budget"],
			optional_sections=["team_qualifications", "appendices"],
			variables={
				"client_name": TemplateVariable(
					name="client_name",
					variable_type="string",
					required=True,
					description="Name of the client organization"
				),
				"rfp_number": TemplateVariable(
					name="rfp_number",
					variable_type="string",
					required=True,
					description="RFP identification number"
				),
				"submission_date": TemplateVariable(
					name="submission_date",
					variable_type="string",
					default_value=datetime.now().strftime("%Y-%m-%d"),
					description="Proposal submission date"
				)
			}
		)
		templates["proposal"] = proposal_template
		
		# Report template
		report_template = DocumentTemplate(
			template_name="report",
			template_type="report",
			section_definitions=[
				SectionDefinition(
					name="title_page",
					section_type="heading",
					title_template="{report_title}",
					level=0,
					order=0,
					required=True
				),
				SectionDefinition(
					name="abstract",
					section_type="content",
					title_template="Abstract",
					level=1,
					order=1,
					required=True,
					content_types=["text"]
				),
				SectionDefinition(
					name="introduction",
					section_type="content",
					title_template="Introduction",
					level=1,
					order=2,
					required=True,
					content_types=["text"]
				),
				SectionDefinition(
					name="methodology",
					section_type="content",
					title_template="Methodology",
					level=1,
					order=3,
					required=True,
					content_types=["text", "table", "image"]
				),
				SectionDefinition(
					name="results",
					section_type="content",
					title_template="Results",
					level=1,
					order=4,
					required=True,
					content_types=["text", "table", "chart", "image"]
				),
				SectionDefinition(
					name="discussion",
					section_type="content",
					title_template="Discussion",
					level=1,
					order=5,
					required=True,
					content_types=["text"]
				),
				SectionDefinition(
					name="conclusion",
					section_type="content",
					title_template="Conclusion",
					level=1,
					order=6,
					required=True,
					content_types=["text"]
				),
				SectionDefinition(
					name="references",
					section_type="content",
					title_template="References",
					level=1,
					order=7,
					required=False,
					content_types=["text"]
				)
			],
			required_sections=["title_page", "abstract", "introduction", "methodology", "results", "discussion", "conclusion"],
			optional_sections=["references"],
			variables={
				"report_title": TemplateVariable(
					name="report_title",
					variable_type="string",
					required=True,
					description="Title of the report"
				),
				"author": TemplateVariable(
					name="author",
					variable_type="string",
					required=True,
					description="Report author name"
				),
				"organization": TemplateVariable(
					name="organization",
					variable_type="string",
					required=False,
					description="Author organization"
				)
			}
		)
		templates["report"] = report_template
		
		return templates
	
	async def load_template(self, template_name: str) -> DocumentTemplate:
		"""Load and validate template definition"""
		assert isinstance(template_name, str), "template_name must be string"
		
		# Check cache first
		cached_template = self.template_cache.get_template(template_name)
		if cached_template:
			return cached_template
		
		# Check built-in templates
		if template_name in self._built_in_templates:
			template = self._built_in_templates[template_name]
			self.template_cache.store_template(template)
			return template
		
		raise TemplateNotFound(f"Template '{template_name}' not found")
	
	async def compile_template(
		self, 
		template: DocumentTemplate, 
		variables: dict[str, Any]
	) -> CompiledTemplate:
		"""Compile template with variables into executable structure"""
		assert isinstance(template, DocumentTemplate), "template must be DocumentTemplate"
		assert isinstance(variables, dict), "variables must be dict"
		
		start_time = datetime.now()
		
		# Validate template variables
		resolved_variables = self._resolve_template_variables(template, variables)
		
		# Process section definitions
		compiled_sections = self._process_section_definitions(template, resolved_variables)
		
		# Determine section order
		section_order = self._calculate_section_order(compiled_sections)
		
		compilation_time = (datetime.now() - start_time).total_seconds()
		
		compiled = CompiledTemplate(
			template_id=template.template_id,
			compiled_sections=compiled_sections,
			resolved_variables=resolved_variables,
			section_order=section_order,
			compilation_time=compilation_time
		)
		
		# Cache compiled template
		self.template_cache.store_compiled_template(compiled)
		
		assert isinstance(compiled, CompiledTemplate), "Result must be CompiledTemplate"
		return compiled
	
	async def validate_template(self, template: DocumentTemplate) -> ValidationResult:
		"""Validate template syntax and structure"""
		assert isinstance(template, DocumentTemplate), "template must be DocumentTemplate"
		
		start_time = datetime.now()
		errors = []
		warnings = []
		
		# Validate section definitions
		section_names = set()
		for section_def in template.section_definitions:
			if section_def.name in section_names:
				errors.append(f"Duplicate section name: {section_def.name}")
			section_names.add(section_def.name)
			
			if section_def.level < 0 or section_def.level > template.max_depth:
				errors.append(f"Section {section_def.name} level {section_def.level} exceeds max depth {template.max_depth}")
		
		# Validate required sections exist
		for required_section in template.required_sections:
			if required_section not in section_names:
				errors.append(f"Required section '{required_section}' not defined")
		
		# Validate optional sections exist
		for optional_section in template.optional_sections:
			if optional_section not in section_names:
				warnings.append(f"Optional section '{optional_section}' not defined")
		
		# Validate template variables
		for var_name, var_def in template.variables.items():
			if not var_def.name:
				errors.append(f"Variable {var_name} missing name")
			if not var_def.variable_type:
				errors.append(f"Variable {var_name} missing type")
		
		validation_time = (datetime.now() - start_time).total_seconds()
		
		result = ValidationResult(
			valid=len(errors) == 0,
			errors=errors,
			warnings=warnings,
			validation_time=validation_time
		)
		
		assert isinstance(result, ValidationResult), "Result must be ValidationResult"
		return result
	
	def _resolve_template_variables(
		self, 
		template: DocumentTemplate, 
		variables: dict[str, Any]
	) -> dict[str, Any]:
		"""Resolve template variables with defaults and validation"""
		resolved = {}
		
		# Process defined variables
		for var_name, var_def in template.variables.items():
			if var_name in variables:
				resolved[var_name] = variables[var_name]
			elif var_def.default_value is not None:
				resolved[var_name] = var_def.default_value
			elif var_def.required:
				raise TemplateInvalid(f"Required variable '{var_name}' not provided")
		
		# Add any additional variables provided
		for var_name, value in variables.items():
			if var_name not in resolved:
				resolved[var_name] = value
		
		return resolved
	
	def _process_section_definitions(
		self, 
		template: DocumentTemplate, 
		variables: dict[str, Any]
	) -> list[SectionDefinition]:
		"""Process section definitions with variable substitution"""
		processed_sections = []
		
		for section_def in template.section_definitions:
			# Create copy to avoid modifying original
			processed_def = deepcopy(section_def)
			
			# Substitute variables in title template
			if processed_def.title_template:
				try:
					processed_def.title_template = processed_def.title_template.format(**variables)
				except KeyError as e:
					raise TemplateInvalid(f"Missing variable in title template: {e}") from e
			
			# Process template variables
			for var_name, var_value in variables.items():
				if var_name in processed_def.template_variables:
					processed_def.template_variables[var_name] = var_value
			
			processed_sections.append(processed_def)
		
		return processed_sections
	
	def _calculate_section_order(self, sections: list[SectionDefinition]) -> list[str]:
		"""Calculate optimal section ordering"""
		# Sort by order field, then by name for consistency
		sorted_sections = sorted(sections, key=lambda s: (s.order, s.name))
		return [section.name for section in sorted_sections]


class StructureManager:
	"""Hierarchical document structure management"""
	
	def __init__(self):
		self.numbering_system = NumberingSystem()
		self.structure_cache: dict[str, DocumentStructure] = {}
		self.performance_stats = {
			"structures_built": 0,
			"average_build_time": 0.0,
			"cache_hits": 0,
			"cache_misses": 0
		}
	
	async def build_structure(
		self, 
		template: CompiledTemplate, 
		content_blocks: list[ContentBlock],
		document_id: str,
		variables: dict[str, Any] = None
	) -> DocumentStructure:
		"""Build document structure from template and content blocks"""
		assert isinstance(template, CompiledTemplate), "template must be CompiledTemplate"
		assert isinstance(content_blocks, list), "content_blocks must be list"
		assert isinstance(document_id, str), "document_id must be string"
		
		start_time = datetime.now()
		variables = variables or {}
		
		# Create document structure
		structure = DocumentStructure(
			document_id=document_id,
			template_name=template.template_id,
			template_variables=variables
		)
		
		# Build sections from template
		sections = await self._build_sections_from_template(template, content_blocks)
		structure.sections = sections
		
		# Build section tree
		structure.section_tree = self._build_section_tree(sections)
		
		# Generate section numbering
		await self._generate_section_numbering(structure)
		
		# Map content blocks to sections
		structure.content_block_mapping = self._map_content_blocks_to_sections(
			content_blocks, sections
		)
		
		# Calculate structure hash for caching
		structure.structure_hash = self._calculate_structure_hash(structure)
		
		compilation_time = (datetime.now() - start_time).total_seconds()
		structure.compilation_time = compilation_time
		
		# Update performance stats
		self.performance_stats["structures_built"] += 1
		self.performance_stats["average_build_time"] = (
			(self.performance_stats["average_build_time"] * (self.performance_stats["structures_built"] - 1) + compilation_time) 
			/ self.performance_stats["structures_built"]
		)
		
		# Cache structure
		self.structure_cache[structure.structure_hash] = structure
		
		assert isinstance(structure, DocumentStructure), "Result must be DocumentStructure"
		return structure
	
	async def _build_sections_from_template(
		self, 
		template: CompiledTemplate, 
		content_blocks: list[ContentBlock]
	) -> list[DocumentSection]:
		"""Build document sections from template definitions"""
		sections = []
		
		for i, section_def in enumerate(template.compiled_sections):
			section = DocumentSection(
				title=section_def.title_template or section_def.name.replace("_", " ").title(),
				section_type=section_def.section_type,
				level=section_def.level,
				sibling_order=i,
				template_section=section_def.name,
				template_variables=section_def.template_variables,
				priority=section_def.order,
				anchor_id=f"sec-{section_def.name}",
				optional_content=not section_def.required
			)
			
			# Find relevant content blocks for this section
			relevant_blocks = self._find_relevant_content_blocks(section_def, content_blocks)
			section.content_block_ids = [block.block_id for block in relevant_blocks]
			
			sections.append(section)
		
		return sections
	
	def _find_relevant_content_blocks(
		self, 
		section_def: SectionDefinition, 
		content_blocks: list[ContentBlock]
	) -> list[ContentBlock]:
		"""Find content blocks relevant to section definition"""
		relevant_blocks = []
		
		for block in content_blocks:
			# Match by content type
			if section_def.content_types and block.block_type in section_def.content_types:
				relevant_blocks.append(block)
			# Match by metadata keywords
			elif self._matches_section_keywords(block, section_def):
				relevant_blocks.append(block)
		
		return relevant_blocks
	
	def _matches_section_keywords(self, block: ContentBlock, section_def: SectionDefinition) -> bool:
		"""Check if content block matches section keywords"""
		section_keywords = {
			"executive_summary": ["executive", "summary", "overview"],
			"technical_approach": ["technical", "approach", "methodology", "solution"],
			"project_timeline": ["timeline", "schedule", "milestones", "phases"],
			"team_qualifications": ["team", "qualifications", "experience", "personnel"],
			"budget": ["budget", "cost", "pricing", "financial"]
		}
		
		keywords = section_keywords.get(section_def.name, [])
		if not keywords:
			return False
		
		# Check title and content for keywords
		text_to_check = f"{block.title} {block.content}".lower()
		return any(keyword in text_to_check for keyword in keywords)
	
	def _build_section_tree(self, sections: list[DocumentSection]) -> dict[str, list[str]]:
		"""Build hierarchical section tree"""
		tree = defaultdict(list)
		
		# Sort sections by level and order
		sorted_sections = sorted(sections, key=lambda s: (s.level, s.sibling_order))
		
		# Build parent-child relationships
		for i, section in enumerate(sorted_sections):
			# Find parent section (previous section with lower level)
			parent_id = None
			for j in range(i - 1, -1, -1):
				if sorted_sections[j].level < section.level:
					parent_id = sorted_sections[j].section_id
					break
			
			section.parent_id = parent_id
			if parent_id:
				tree[parent_id].append(section.section_id)
				# Update parent's child list
				for parent_section in sorted_sections:
					if parent_section.section_id == parent_id:
						parent_section.child_ids.append(section.section_id)
						break
		
		return dict(tree)
	
	async def _generate_section_numbering(self, structure: DocumentStructure) -> None:
		"""Generate section numbering for all sections"""
		if not structure.auto_numbering:
			return
		
		# Build numbering map
		section_numbers = {}
		parent_counters = defaultdict(int)
		
		# Process sections in hierarchy order
		def process_section(section_id: str, parent_number: str = ""):
			section = next((s for s in structure.sections if s.section_id == section_id), None)
			if not section:
				return
			
			# Generate number for this section
			if section.level > 0:  # Skip level 0 (title pages)
				parent_counters[parent_number] += 1
				counter = parent_counters[parent_number]
				
				if parent_number:
					section_number = f"{parent_number}.{counter}"
				else:
					section_number = str(counter)
				
				section.section_number = section_number
				section_numbers[section_id] = section_number
				
				# Process children
				for child_id in structure.section_tree.get(section_id, []):
					process_section(child_id, section_number)
		
		# Start with root sections (level 1)
		root_sections = [s for s in structure.sections if s.level == 1]
		for section in sorted(root_sections, key=lambda s: s.sibling_order):
			process_section(section.section_id)
	
	def _map_content_blocks_to_sections(
		self, 
		content_blocks: list[ContentBlock], 
		sections: list[DocumentSection]
	) -> dict[str, str]:
		"""Map content blocks to their assigned sections"""
		mapping = {}
		
		for section in sections:
			for block_id in section.content_block_ids:
				mapping[block_id] = section.section_id
		
		return mapping
	
	def _calculate_structure_hash(self, structure: DocumentStructure) -> str:
		"""Calculate hash for structure caching"""
		structure_data = {
			"template_name": structure.template_name,
			"sections": [
				{
					"title": s.title,
					"type": s.section_type,
					"level": s.level,
					"order": s.sibling_order
				}
				for s in structure.sections
			]
		}
		
		structure_json = json.dumps(structure_data, sort_keys=True)
		import hashlib
		return hashlib.md5(structure_json.encode()).hexdigest()


class TOCGenerator:
	"""Table of Contents generation and management"""
	
	def __init__(self):
		self.toc_cache: dict[str, TableOfContents] = {}
		self.formatting_rules = {
			"decimal": "1.2.3",
			"roman": "I.II.III",
			"alpha": "A.B.C",
			"none": ""
		}
	
	async def generate_toc(
		self, 
		structure: DocumentStructure, 
		config: TOCConfiguration = None
	) -> TableOfContents:
		"""Generate table of contents from document structure"""
		assert isinstance(structure, DocumentStructure), "structure must be DocumentStructure"
		
		config = config or structure.toc_config
		
		# Filter sections based on configuration
		filtered_sections = self._filter_sections_for_toc(structure.sections, config)
		
		# Generate TOC entries
		toc_entries = []
		for section in filtered_sections:
			if config.min_depth <= section.level <= config.max_depth:
				entry = TOCEntry(
					section_id=section.section_id,
					title=section.title,
					level=section.level,
					section_number=section.section_number,
					anchor_id=section.anchor_id,
					indent_level=section.level - config.min_depth
				)
				toc_entries.append(entry)
		
		# Create table of contents
		toc = TableOfContents(
			document_id=structure.document_id,
			title=config.title,
			entries=toc_entries,
			configuration=config,
			total_entries=len(toc_entries),
			max_depth_used=max((e.level for e in toc_entries), default=0)
		)
		
		# Cache TOC
		cache_key = f"{structure.structure_hash}:{hash(str(config.__dict__))}"
		self.toc_cache[cache_key] = toc
		
		assert isinstance(toc, TableOfContents), "Result must be TableOfContents"
		return toc
	
	def _filter_sections_for_toc(
		self, 
		sections: list[DocumentSection], 
		config: TOCConfiguration
	) -> list[DocumentSection]:
		"""Filter sections based on TOC configuration"""
		filtered = []
		
		for section in sections:
			# Check section type filter
			if config.section_types and section.section_type not in config.section_types:
				continue
			
			# Check include/exclude lists
			if config.include_sections and section.section_id not in config.include_sections:
				continue
			if config.exclude_sections and section.section_id in config.exclude_sections:
				continue
			
			# Check depth limits
			if not (config.min_depth <= section.level <= config.max_depth):
				continue
			
			filtered.append(section)
		
		return filtered
	
	def format_toc_latex(self, toc: TableOfContents) -> str:
		"""Format TOC for LaTeX output"""
		assert isinstance(toc, TableOfContents), "toc must be TableOfContents"
		
		lines = [
			f"\\section*{{{toc.title}}}",
			"\\addcontentsline{toc}{section}{" + toc.title + "}",
			""
		]
		
		for entry in toc.entries:
			indent = "  " * entry.indent_level
			if entry.section_number:
				line = f"{indent}\\textbf{{{entry.section_number}}} {entry.title}"
			else:
				line = f"{indent}{entry.title}"
			
			if toc.configuration.clickable_links and entry.anchor_id:
				line += f" \\dotfill \\hyperref[{entry.anchor_id}]{{\\pageref{{{entry.anchor_id}}}}}"
			elif toc.configuration.page_numbers:
				line += " \\dotfill \\pageref{" + entry.anchor_id + "}"
			
			lines.append(line + " \\\\")
		
		result = "\n".join(lines)
		assert isinstance(result, str), "Formatted TOC must be string"
		return result
	
	def format_toc_markdown(self, toc: TableOfContents) -> str:
		"""Format TOC for Markdown output"""
		assert isinstance(toc, TableOfContents), "toc must be TableOfContents"
		
		lines = [f"# {toc.title}", ""]
		
		for entry in toc.entries:
			indent = "  " * entry.indent_level
			if entry.section_number:
				title = f"{entry.section_number} {entry.title}"
			else:
				title = entry.title
			
			if toc.configuration.clickable_links and entry.anchor_id:
				line = f"{indent}- [{title}](#{entry.anchor_id})"
			else:
				line = f"{indent}- {title}"
			
			lines.append(line)
		
		result = "\n".join(lines)
		assert isinstance(result, str), "Formatted TOC must be string"
		return result


class OutlineBuilder:
	"""Document outline creation and export"""
	
	def __init__(self):
		self.outline_cache: dict[str, DocumentOutline] = {}
	
	async def create_outline(
		self, 
		structure: DocumentStructure,
		content_blocks: dict[str, ContentBlock] = None,
		detail_level: str = "full"
	) -> DocumentOutline:
		"""Create comprehensive document outline"""
		assert isinstance(structure, DocumentStructure), "structure must be DocumentStructure"
		assert detail_level in ["summary", "full", "detailed"], "Invalid detail level"
		
		content_blocks = content_blocks or {}
		
		# Generate section summaries
		summaries = await self.generate_section_summaries(structure, content_blocks)
		
		# Build outline sections
		outline_sections = []
		for section in structure.sections:
			section_info = {
				"id": section.section_id,
				"title": section.title,
				"level": section.level,
				"type": section.section_type,
				"number": section.section_number,
				"content_blocks": len(section.content_block_ids),
				"summary": summaries.get(section.section_id, ""),
				"children": section.child_ids
			}
			
			if detail_level == "detailed":
				section_info.update({
					"template_section": section.template_section,
					"anchor_id": section.anchor_id,
					"priority": section.priority,
					"optional": section.optional_content,
					"created_at": section.created_at.isoformat(),
					"updated_at": section.updated_at.isoformat()
				})
			
			outline_sections.append(section_info)
		
		# Create outline
		outline = DocumentOutline(
			document_id=structure.document_id,
			title=f"Outline for {structure.document_id}",
			sections=outline_sections,
			summaries=summaries,
			total_sections=len(outline_sections),
			outline_depth=max((s.level for s in structure.sections), default=0)
		)
		
		# Cache outline
		cache_key = f"{structure.structure_hash}:{detail_level}"
		self.outline_cache[cache_key] = outline
		
		assert isinstance(outline, DocumentOutline), "Result must be DocumentOutline"
		return outline
	
	async def generate_section_summaries(
		self, 
		structure: DocumentStructure,
		content_blocks: dict[str, ContentBlock]
	) -> dict[str, str]:
		"""Generate summaries for each section"""
		assert isinstance(structure, DocumentStructure), "structure must be DocumentStructure"
		assert isinstance(content_blocks, dict), "content_blocks must be dict"
		
		summaries = {}
		
		for section in structure.sections:
			# Collect content from blocks in this section
			section_content = []
			for block_id in section.content_block_ids:
				if block_id in content_blocks:
					block = content_blocks[block_id]
					section_content.append(block.content)
			
			# Generate summary
			if section_content:
				combined_content = " ".join(section_content)
				summary = self._generate_summary(combined_content, section.title)
			else:
				summary = f"Section covering {section.title.lower()} topics."
			
			summaries[section.section_id] = summary
		
		return summaries
	
	def _generate_summary(self, content: str, section_title: str) -> str:
		"""Generate summary from content (mock implementation for Phase 1)"""
		# Simple summary generation - take first sentence or create default
		sentences = content.split('. ')
		if sentences and len(sentences[0]) > 10:
			summary = sentences[0][:150] + "..."
			return summary
		
		return f"This section covers {section_title.lower()} with detailed information and analysis."
	
	def export_outline_json(self, outline: DocumentOutline) -> str:
		"""Export outline as JSON"""
		assert isinstance(outline, DocumentOutline), "outline must be DocumentOutline"
		
		export_data = {
			"outline_id": outline.outline_id,
			"document_id": outline.document_id,
			"title": outline.title,
			"generated_at": outline.generated_at.isoformat(),
			"total_sections": outline.total_sections,
			"outline_depth": outline.outline_depth,
			"sections": outline.sections,
			"summaries": outline.summaries
		}
		
		result = json.dumps(export_data, indent=2)
		assert isinstance(result, str), "JSON export must be string"
		return result
	
	def export_outline_markdown(self, outline: DocumentOutline) -> str:
		"""Export outline as Markdown"""
		assert isinstance(outline, DocumentOutline), "outline must be DocumentOutline"
		
		lines = [
			f"# {outline.title}",
			"",
			f"**Document ID:** {outline.document_id}",
			f"**Generated:** {outline.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
			f"**Total Sections:** {outline.total_sections}",
			f"**Max Depth:** {outline.outline_depth}",
			"",
			"## Document Structure",
			""
		]
		
		for section in outline.sections:
			level = section["level"]
			indent = "  " * (level - 1) if level > 0 else ""
			
			title = f"{section['number']} {section['title']}" if section['number'] else section['title']
			lines.append(f"{indent}- **{title}**")
			
			if section["summary"]:
				lines.append(f"{indent}  {section['summary']}")
			
			if section["content_blocks"] > 0:
				lines.append(f"{indent}  *Content blocks: {section['content_blocks']}*")
			
			lines.append("")
		
		result = "\n".join(lines)
		assert isinstance(result, str), "Markdown export must be string"
		return result


# Main StructureBuilder Class
class StructureBuilder:
	"""Main StructureBuilder class combining all functionality"""
	
	def __init__(self):
		self.template_engine = TemplateEngine()
		self.structure_manager = StructureManager()
		self.toc_generator = TOCGenerator()
		self.outline_builder = OutlineBuilder()
		
		# Performance monitoring
		self.performance_stats = {
			"total_operations": 0,
			"average_response_time": 0.0,
			"cache_hit_ratio": 0.0,
			"structures_created": 0
		}
	
	async def create_document_structure(
		self,
		template_name: str,
		document_id: str,
		content_blocks: list[ContentBlock],
		template_variables: dict[str, Any] = None,
		toc_config: TOCConfiguration = None
	) -> DocumentStructure:
		"""Create complete document structure from template and content"""
		assert isinstance(template_name, str), "template_name must be string"
		assert isinstance(document_id, str), "document_id must be string"
		assert isinstance(content_blocks, list), "content_blocks must be list"
		
		start_time = datetime.now()
		template_variables = template_variables or {}
		
		try:
			# Load and compile template
			template = await self.template_engine.load_template(template_name)
			compiled_template = await self.template_engine.compile_template(template, template_variables)
			
			# Build document structure
			structure = await self.structure_manager.build_structure(
				compiled_template, content_blocks, document_id, template_variables
			)
			
			# Configure TOC
			if toc_config:
				structure.toc_config = toc_config
			
			# Generate TOC
			toc = await self.toc_generator.generate_toc(structure)
			structure.generated_toc = toc.entries
			
			# Update performance stats
			self._update_performance_stats(start_time)
			
			assert isinstance(structure, DocumentStructure), "Result must be DocumentStructure"
			return structure
			
		except Exception as e:
			self._log_structure_error(f"Error creating document structure: {e}")
			raise
	
	async def generate_table_of_contents(
		self,
		structure: DocumentStructure,
		config: TOCConfiguration = None,
		output_format: str = "latex"
	) -> str:
		"""Generate formatted table of contents"""
		assert isinstance(structure, DocumentStructure), "structure must be DocumentStructure"
		assert output_format in ["latex", "markdown", "json"], "Invalid output format"
		
		toc = await self.toc_generator.generate_toc(structure, config)
		
		if output_format == "latex":
			result = self.toc_generator.format_toc_latex(toc)
		elif output_format == "markdown":
			result = self.toc_generator.format_toc_markdown(toc)
		else:  # json
			result = json.dumps({
				"title": toc.title,
				"entries": [
					{
						"title": entry.title,
						"level": entry.level,
						"number": entry.section_number,
						"anchor": entry.anchor_id
					}
					for entry in toc.entries
				]
			}, indent=2)
		
		assert isinstance(result, str), "Formatted TOC must be string"
		return result
	
	async def create_document_outline(
		self,
		structure: DocumentStructure,
		content_blocks: dict[str, ContentBlock] = None,
		detail_level: str = "full",
		export_format: str = "json"
	) -> str:
		"""Create and export document outline"""
		assert isinstance(structure, DocumentStructure), "structure must be DocumentStructure"
		assert export_format in ["json", "markdown"], "Invalid export format"
		
		outline = await self.outline_builder.create_outline(structure, content_blocks, detail_level)
		
		if export_format == "json":
			result = self.outline_builder.export_outline_json(outline)
		else:  # markdown
			result = self.outline_builder.export_outline_markdown(outline)
		
		assert isinstance(result, str), "Exported outline must be string"
		return result
	
	async def validate_document_structure(self, structure: DocumentStructure) -> ValidationResult:
		"""Validate document structure integrity"""
		assert isinstance(structure, DocumentStructure), "structure must be DocumentStructure"
		
		start_time = datetime.now()
		errors = []
		warnings = []
		
		# Validate section hierarchy
		for section in structure.sections:
			# Check level constraints
			if section.level < 0 or section.level > structure.max_depth:
				errors.append(f"Section {section.title} level {section.level} exceeds limits")
			
			# Check parent-child relationships
			if section.parent_id:
				parent_exists = any(s.section_id == section.parent_id for s in structure.sections)
				if not parent_exists:
					errors.append(f"Section {section.title} references non-existent parent")
		
		# Validate section tree consistency
		for parent_id, child_ids in structure.section_tree.items():
			parent_section = next((s for s in structure.sections if s.section_id == parent_id), None)
			if not parent_section:
				errors.append(f"Section tree references non-existent parent: {parent_id}")
				continue
			
			# Check if all children exist
			for child_id in child_ids:
				child_exists = any(s.section_id == child_id for s in structure.sections)
				if not child_exists:
					errors.append(f"Section tree references non-existent child: {child_id}")
		
		# Check for circular dependencies
		if self._has_circular_dependencies(structure):
			errors.append("Circular dependencies detected in section hierarchy")
		
		validation_time = (datetime.now() - start_time).total_seconds()
		
		result = ValidationResult(
			valid=len(errors) == 0,
			errors=errors,
			warnings=warnings,
			validation_time=validation_time
		)
		
		assert isinstance(result, ValidationResult), "Result must be ValidationResult"
		return result
	
	def _has_circular_dependencies(self, structure: DocumentStructure) -> bool:
		"""Check for circular dependencies in section hierarchy"""
		visited = set()
		recursion_stack = set()
		
		def dfs(section_id: str) -> bool:
			if section_id in recursion_stack:
				return True  # Cycle detected
			if section_id in visited:
				return False
			
			visited.add(section_id)
			recursion_stack.add(section_id)
			
			# Check children
			for child_id in structure.section_tree.get(section_id, []):
				if dfs(child_id):
					return True
			
			recursion_stack.remove(section_id)
			return False
		
		# Check all root sections
		root_sections = [s.section_id for s in structure.sections if not s.parent_id]
		for root_id in root_sections:
			if dfs(root_id):
				return True
		
		return False
	
	def _update_performance_stats(self, start_time: datetime) -> None:
		"""Update performance statistics"""
		operation_time = (datetime.now() - start_time).total_seconds()
		
		self.performance_stats["total_operations"] += 1
		self.performance_stats["structures_created"] += 1
		
		# Update average response time
		total_ops = self.performance_stats["total_operations"]
		current_avg = self.performance_stats["average_response_time"]
		self.performance_stats["average_response_time"] = (
			(current_avg * (total_ops - 1) + operation_time) / total_ops
		)
	
	def _log_structure_error(self, message: str) -> None:
		"""Log structure operation errors"""
		print(f"[StructureBuilder] Error: {message}")
	
	def get_performance_stats(self) -> dict[str, Any]:
		"""Get current performance statistics"""
		return self.performance_stats.copy()
	
	def clear_caches(self) -> None:
		"""Clear all caches"""
		self.template_engine.template_cache.templates.clear()
		self.template_engine.template_cache.compiled_templates.clear()
		self.structure_manager.structure_cache.clear()
		self.toc_generator.toc_cache.clear()
		self.outline_builder.outline_cache.clear()


# Mock integration functions for Phase 1
async def create_mock_content_blocks() -> list[ContentBlock]:
	"""Create mock content blocks for testing"""
	blocks = [
		ContentBlock(
			block_type="text",
			content="Our organization has extensive experience in delivering innovative solutions.",
			title="Executive Summary",
			metadata={"section": "executive_summary", "priority": "high"}
		),
		ContentBlock(
			block_type="text",
			content="Our technical approach leverages modern cloud architecture and AI technologies.",
			title="Technical Approach",
			metadata={"section": "technical_approach", "priority": "high"}
		),
		ContentBlock(
			block_type="table",
			content="Phase 1: 4 weeks, Phase 2: 8 weeks, Phase 3: 6 weeks, Phase 4: 4 weeks",
			title="Project Timeline",
			metadata={"section": "project_timeline", "priority": "medium"}
		),
		ContentBlock(
			block_type="text",
			content="Our team consists of certified professionals with relevant industry experience.",
			title="Team Qualifications",
			metadata={"section": "team_qualifications", "priority": "medium"}
		),
		ContentBlock(
			block_type="table",
			content="Development: $150,000, Infrastructure: $50,000, Testing: $25,000",
			title="Budget Breakdown",
			metadata={"section": "budget", "priority": "high"}
		)
	]
	
	return blocks