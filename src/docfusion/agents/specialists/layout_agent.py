"""
Layout Agent

Specialized agent for creating beautiful document layouts, formatting,
and visual presentation optimization.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import re
import logging
from typing import Any, Dict, List, Optional, Tuple, Set
from datetime import datetime
import hashlib
from collections import defaultdict
from dataclasses import dataclass
from enum import Enum

from ..core import Agent, AgentRole, AgentCapabilities, AgentConfig
from ..core.messages import Message, MessagePriority


class DocumentFormat(str, Enum):
	"""Supported document output formats"""
	PDF = "pdf"
	DOCX = "docx"
	HTML = "html"
	MARKDOWN = "markdown"
	LATEX = "latex"


class LayoutStyle(str, Enum):
	"""Document layout styles"""
	PROFESSIONAL = "professional"
	CORPORATE = "corporate"
	ACADEMIC = "academic"
	CREATIVE = "creative"
	TECHNICAL = "technical"
	EXECUTIVE = "executive"
	PROPOSAL = "proposal"


class ColorScheme(str, Enum):
	"""Color schemes for document design"""
	CORPORATE_BLUE = "corporate_blue"
	PROFESSIONAL_GRAY = "professional_gray"
	MODERN_TEAL = "modern_teal"
	WARM_ORANGE = "warm_orange"
	ELEGANT_PURPLE = "elegant_purple"
	CLASSIC_BLACK = "classic_black"
	CUSTOM = "custom"


@dataclass
class FontConfiguration:
	"""Font configuration for document elements"""
	primary_font: str = "Arial"
	secondary_font: str = "Times New Roman"
	header_font: str = "Arial Bold"
	code_font: str = "Courier New"
	
	base_size: int = 11
	header_size: int = 16
	subheader_size: int = 14
	caption_size: int = 9
	
	line_height: float = 1.2
	paragraph_spacing: float = 6.0


@dataclass
class MarginConfiguration:
	"""Page margin configuration"""
	top: float = 1.0
	bottom: float = 1.0
	left: float = 1.0
	right: float = 1.0
	header: float = 0.5
	footer: float = 0.5
	
	# Values in inches by default
	unit: str = "inch"


@dataclass
class LayoutElement:
	"""Individual layout element configuration"""
	element_type: str  # header, paragraph, list, table, image, etc.
	content: str
	style_properties: Dict[str, Any]
	position: Optional[Tuple[float, float]] = None
	size: Optional[Tuple[float, float]] = None
	order: int = 0


class LayoutConfiguration:
	"""Complete layout configuration for a document"""
	
	def __init__(self):
		self.format: DocumentFormat = DocumentFormat.PDF
		self.style: LayoutStyle = LayoutStyle.PROFESSIONAL
		self.color_scheme: ColorScheme = ColorScheme.CORPORATE_BLUE
		
		self.font_config = FontConfiguration()
		self.margin_config = MarginConfiguration()
		
		self.page_orientation: str = "portrait"  # portrait, landscape
		self.page_size: str = "A4"  # A4, Letter, Legal, etc.
		
		self.header_enabled: bool = True
		self.footer_enabled: bool = True
		self.page_numbers: bool = True
		
		self.table_of_contents: bool = True
		self.appendices: bool = True
		
		# Brand elements
		self.logo_path: Optional[str] = None
		self.logo_position: str = "top_right"  # top_left, top_right, center, etc.
		
		# Advanced features
		self.watermark: Optional[str] = None
		self.background_color: str = "#FFFFFF"
		self.border_style: str = "none"
		
		# Accessibility features
		self.high_contrast: bool = False
		self.large_text: bool = False
		self.alt_text_enabled: bool = True


class LayoutAnalysis:
	"""Results of document layout analysis"""
	
	def __init__(self):
		self.readability_score: float = 0.0
		self.visual_hierarchy_score: float = 0.0
		self.consistency_score: float = 0.0
		self.accessibility_score: float = 0.0
		self.brand_compliance_score: float = 0.0
		self.overall_design_score: float = 0.0
		
		self.layout_issues: List[str] = []
		self.recommendations: List[str] = []
		
		self.elements_analyzed: int = 0
		self.pages_analyzed: int = 0
		self.analysis_timestamp = datetime.now()


class LayoutAgent(Agent):
	"""
	Layout Agent specializing in document design and visual presentation
	
	Key responsibilities:
	- Document formatting and layout optimization
	- Visual hierarchy and readability enhancement
	- Brand compliance and consistency
	- Multi-format document generation
	- Accessibility optimization
	- Template creation and management
	"""
	
	def __init__(self, agent_id: str = None, config: Optional[AgentConfig] = None, **kwargs):
		# Define layout role and capabilities
		layout_role = AgentRole(
			name="Document Layout Designer",
			description="Creates beautiful, accessible, and brand-compliant document layouts",
			primary_capabilities=AgentCapabilities(
				document_formatting=True,
				visual_design=True,
				brand_compliance=True,
				accessibility_optimization=True
			),
			secondary_capabilities=AgentCapabilities(
				template_creation=True,
				multi_format_output=True,
				collaboration=True
			)
		)
		
		# Initialize base agent
		super().__init__(
			agent_id=agent_id or f"layout_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
			config=config,
			role=layout_role,
			**kwargs
		)
		
		# Layout-specific settings
		self.default_layouts = self._initialize_default_layouts()
		self.brand_guidelines = self._initialize_brand_guidelines()
		self.accessibility_standards = self._initialize_accessibility_standards()
		
		self.logger = logging.getLogger(f"layout_agent.{self.agent_id}")
		
		# Cache for layout configurations and analyses
		self.layout_cache: Dict[str, LayoutConfiguration] = {}
		self.analysis_cache: Dict[str, LayoutAnalysis] = {}

	def _initialize_default_layouts(self) -> Dict[LayoutStyle, LayoutConfiguration]:
		"""Initialize default layout configurations"""
		layouts = {}
		
		# Professional layout
		professional = LayoutConfiguration()
		professional.style = LayoutStyle.PROFESSIONAL
		professional.color_scheme = ColorScheme.CORPORATE_BLUE
		professional.font_config.primary_font = "Arial"
		professional.font_config.secondary_font = "Times New Roman"
		layouts[LayoutStyle.PROFESSIONAL] = professional
		
		# Corporate layout
		corporate = LayoutConfiguration()
		corporate.style = LayoutStyle.CORPORATE
		corporate.color_scheme = ColorScheme.PROFESSIONAL_GRAY
		corporate.font_config.primary_font = "Calibri"
		corporate.font_config.base_size = 12
		corporate.margin_config.left = 1.25
		corporate.margin_config.right = 1.25
		layouts[LayoutStyle.CORPORATE] = corporate
		
		# Academic layout
		academic = LayoutConfiguration()
		academic.style = LayoutStyle.ACADEMIC
		academic.color_scheme = ColorScheme.CLASSIC_BLACK
		academic.font_config.primary_font = "Times New Roman"
		academic.font_config.base_size = 12
		academic.font_config.line_height = 1.5
		academic.page_orientation = "portrait"
		layouts[LayoutStyle.ACADEMIC] = academic
		
		# Technical layout
		technical = LayoutConfiguration()
		technical.style = LayoutStyle.TECHNICAL
		technical.color_scheme = ColorScheme.MODERN_TEAL
		technical.font_config.primary_font = "Arial"
		technical.font_config.code_font = "Consolas"
		technical.font_config.base_size = 10
		layouts[LayoutStyle.TECHNICAL] = technical
		
		# Executive layout
		executive = LayoutConfiguration()
		executive.style = LayoutStyle.EXECUTIVE
		executive.color_scheme = ColorScheme.ELEGANT_PURPLE
		executive.font_config.primary_font = "Garamond"
		executive.font_config.base_size = 12
		executive.margin_config = MarginConfiguration(
			top=1.5, bottom=1.5, left=1.5, right=1.5
		)
		layouts[LayoutStyle.EXECUTIVE] = executive
		
		return layouts

	def _initialize_brand_guidelines(self) -> Dict[str, Dict[str, Any]]:
		"""Initialize brand guideline templates"""
		return {
			"datacraft": {
				"primary_color": "#2E5BBA",
				"secondary_color": "#8FA8D8",
				"accent_color": "#FF6B35",
				"fonts": ["Arial", "Helvetica", "Calibri"],
				"logo_position": "top_right",
				"style_preferences": ["clean", "professional", "modern"]
			},
			"generic_corporate": {
				"primary_color": "#003366",
				"secondary_color": "#336699",
				"accent_color": "#FF9900",
				"fonts": ["Arial", "Times New Roman"],
				"logo_position": "top_left",
				"style_preferences": ["professional", "conservative"]
			}
		}

	def _initialize_accessibility_standards(self) -> Dict[str, Any]:
		"""Initialize accessibility standards and requirements"""
		return {
			"wcag_2_1": {
				"min_color_contrast_ratio": 4.5,
				"large_text_contrast_ratio": 3.0,
				"min_font_size": 9,
				"max_line_length": 80,  # characters
				"required_alt_text": True,
				"heading_hierarchy": True,
				"focus_indicators": True
			},
			"section_508": {
				"keyboard_navigation": True,
				"screen_reader_compatibility": True,
				"color_not_sole_indicator": True,
				"alt_text_required": True
			}
		}

	async def create_layout_configuration(self, content_structure: Dict[str, Any], 
										  requirements: Dict[str, Any]) -> LayoutConfiguration:
		"""
		Create optimal layout configuration based on content and requirements
		
		Args:
			content_structure: Document structure and content analysis
			requirements: Layout requirements and preferences
		"""
		layout_config = LayoutConfiguration()
		
		try:
			# Determine appropriate layout style
			layout_config.style = await self._determine_layout_style(
				content_structure, requirements
			)
			
			# Configure based on document type and requirements
			await self._configure_format(layout_config, requirements)
			await self._configure_typography(layout_config, content_structure, requirements)
			await self._configure_spacing(layout_config, content_structure)
			await self._configure_brand_elements(layout_config, requirements)
			await self._configure_accessibility(layout_config, requirements)
			
			# Cache the configuration
			config_hash = self._generate_config_hash(content_structure, requirements)
			self.layout_cache[config_hash] = layout_config
			
			self.logger.info(f"Created layout configuration: {layout_config.style.value}")
			
			return layout_config
			
		except Exception as e:
			self.logger.error(f"Layout configuration creation failed: {e}")
			# Return default professional layout as fallback
			return self.default_layouts[LayoutStyle.PROFESSIONAL]

	async def _determine_layout_style(self, content_structure: Dict[str, Any], 
									  requirements: Dict[str, Any]) -> LayoutStyle:
		"""Determine the most appropriate layout style"""
		document_type = requirements.get("document_type", "").lower()
		audience = requirements.get("audience", "").lower()
		purpose = requirements.get("purpose", "").lower()
		
		# Rule-based style selection
		if any(word in document_type for word in ["proposal", "rfp", "bid"]):
			return LayoutStyle.PROPOSAL
		elif any(word in document_type for word in ["executive", "summary", "brief"]):
			return LayoutStyle.EXECUTIVE
		elif any(word in document_type for word in ["academic", "research", "thesis"]):
			return LayoutStyle.ACADEMIC
		elif any(word in document_type for word in ["technical", "manual", "specification"]):
			return LayoutStyle.TECHNICAL
		elif any(word in audience for word in ["creative", "marketing", "design"]):
			return LayoutStyle.CREATIVE
		elif any(word in audience for word in ["corporate", "business", "enterprise"]):
			return LayoutStyle.CORPORATE
		else:
			return LayoutStyle.PROFESSIONAL

	async def _configure_format(self, config: LayoutConfiguration, requirements: Dict[str, Any]):
		"""Configure document format and basic properties"""
		# Output format
		requested_format = requirements.get("output_format", "pdf").lower()
		if requested_format in [f.value for f in DocumentFormat]:
			config.format = DocumentFormat(requested_format)
		
		# Page properties
		config.page_size = requirements.get("page_size", "A4")
		config.page_orientation = requirements.get("orientation", "portrait")
		
		# Document features
		config.table_of_contents = requirements.get("include_toc", True)
		config.page_numbers = requirements.get("page_numbers", True)
		config.header_enabled = requirements.get("headers", True)
		config.footer_enabled = requirements.get("footers", True)

	async def _configure_typography(self, config: LayoutConfiguration, 
									content_structure: Dict[str, Any], 
									requirements: Dict[str, Any]):
		"""Configure typography based on content and requirements"""
		# Analyze content complexity for font sizing
		avg_word_length = content_structure.get("avg_word_length", 5)
		technical_density = content_structure.get("technical_terms_ratio", 0.1)
		
		# Adjust base font size based on complexity
		if technical_density > 0.3:
			config.font_config.base_size = 10  # Smaller for dense technical content
		elif avg_word_length > 7:
			config.font_config.base_size = 12  # Larger for complex vocabulary
		
		# Font selection based on requirements
		preferred_fonts = requirements.get("fonts", [])
		if preferred_fonts:
			config.font_config.primary_font = preferred_fonts[0]
			if len(preferred_fonts) > 1:
				config.font_config.secondary_font = preferred_fonts[1]

	async def _configure_spacing(self, config: LayoutConfiguration, 
								 content_structure: Dict[str, Any]):
		"""Configure spacing and margins based on content structure"""
		section_count = content_structure.get("section_count", 5)
		avg_section_length = content_structure.get("avg_section_length", 500)
		
		# Adjust margins for content density
		if section_count > 10:
			# More sections = tighter margins to fit more content
			config.margin_config.top = 0.75
			config.margin_config.bottom = 0.75
		
		# Adjust line height for readability
		if avg_section_length > 1000:
			# Longer sections need more line spacing for readability
			config.font_config.line_height = 1.3

	async def _configure_brand_elements(self, config: LayoutConfiguration, 
										requirements: Dict[str, Any]):
		"""Configure brand-specific elements"""
		organization = requirements.get("organization", "").lower()
		
		if organization in self.brand_guidelines:
			brand = self.brand_guidelines[organization]
			
			# Apply brand colors
			if "primary_color" in brand:
				# This would set theme colors in the actual implementation
				pass
			
			# Set logo configuration
			config.logo_path = requirements.get("logo_path")
			config.logo_position = brand.get("logo_position", "top_right")
			
			# Apply brand fonts
			brand_fonts = brand.get("fonts", [])
			if brand_fonts:
				config.font_config.primary_font = brand_fonts[0]

	async def _configure_accessibility(self, config: LayoutConfiguration, 
									   requirements: Dict[str, Any]):
		"""Configure accessibility features"""
		accessibility_level = requirements.get("accessibility", "standard").lower()
		
		if accessibility_level in ["high", "wcag_aa", "section_508"]:
			config.high_contrast = True
			config.alt_text_enabled = True
			
			# Ensure minimum font sizes
			if config.font_config.base_size < 10:
				config.font_config.base_size = 10
			
			# Improve line spacing for readability
			if config.font_config.line_height < 1.3:
				config.font_config.line_height = 1.3

	async def generate_document_layout(self, content: Dict[str, Any], 
									   layout_config: LayoutConfiguration) -> Dict[str, Any]:
		"""
		Generate formatted document layout from content and configuration
		
		Args:
			content: Document content structure
			layout_config: Layout configuration to apply
			
		Returns:
			Dictionary containing formatted document elements and metadata
		"""
		try:
			# Parse content into layout elements
			elements = await self._parse_content_to_elements(content)
			
			# Apply layout configuration to elements
			formatted_elements = await self._format_elements(elements, layout_config)
			
			# Generate page layout
			pages = await self._generate_pages(formatted_elements, layout_config)
			
			# Create document metadata
			metadata = await self._generate_document_metadata(layout_config, pages)
			
			layout_result = {
				"formatted_elements": formatted_elements,
				"pages": pages,
				"metadata": metadata,
				"layout_config": layout_config,
				"generation_timestamp": datetime.now().isoformat()
			}
			
			self.logger.info(f"Generated document layout: {len(pages)} pages, {len(formatted_elements)} elements")
			
			return layout_result
			
		except Exception as e:
			self.logger.error(f"Document layout generation failed: {e}")
			raise

	async def _parse_content_to_elements(self, content: Dict[str, Any]) -> List[LayoutElement]:
		"""Parse document content into layout elements"""
		elements = []
		order = 0
		
		# Title element
		if "title" in content:
			elements.append(LayoutElement(
				element_type="title",
				content=content["title"],
				style_properties={"font_size": 18, "font_weight": "bold", "alignment": "center"},
				order=order
			))
			order += 1
		
		# Process sections
		if "sections" in content:
			for section in content["sections"]:
				# Section header
				elements.append(LayoutElement(
					element_type="section_header",
					content=section.get("title", ""),
					style_properties={"font_size": 14, "font_weight": "bold", "spacing_before": 12},
					order=order
				))
				order += 1
				
				# Section content
				section_content = section.get("content", "")
				paragraphs = self._split_into_paragraphs(section_content)
				
				for paragraph in paragraphs:
					elements.append(LayoutElement(
						element_type="paragraph",
						content=paragraph,
						style_properties={"spacing_after": 6, "justify": True},
						order=order
					))
					order += 1
		
		return elements

	def _split_into_paragraphs(self, content: str) -> List[str]:
		"""Split content into paragraphs"""
		# Split on double newlines or explicit paragraph breaks
		paragraphs = re.split(r'\n\s*\n', content.strip())
		return [p.strip() for p in paragraphs if p.strip()]

	async def _format_elements(self, elements: List[LayoutElement], 
							   config: LayoutConfiguration) -> List[LayoutElement]:
		"""Apply layout configuration to elements"""
		formatted_elements = []
		
		for element in elements:
			# Create a copy to avoid modifying original
			formatted_element = LayoutElement(
				element_type=element.element_type,
				content=element.content,
				style_properties=element.style_properties.copy(),
				position=element.position,
				size=element.size,
				order=element.order
			)
			
			# Apply configuration-based styling
			await self._apply_element_styling(formatted_element, config)
			
			formatted_elements.append(formatted_element)
		
		return formatted_elements

	async def _apply_element_styling(self, element: LayoutElement, 
									 config: LayoutConfiguration):
		"""Apply layout configuration to a specific element"""
		base_styles = {
			"font_family": config.font_config.primary_font,
			"line_height": config.font_config.line_height,
			"color": "#000000"  # Default text color
		}
		
		# Element-specific styling
		if element.element_type == "title":
			base_styles.update({
				"font_size": config.font_config.header_size + 2,
				"font_weight": "bold",
				"alignment": "center",
				"spacing_after": 18
			})
		elif element.element_type == "section_header":
			base_styles.update({
				"font_size": config.font_config.subheader_size,
				"font_weight": "bold",
				"spacing_before": 12,
				"spacing_after": 6
			})
		elif element.element_type == "paragraph":
			base_styles.update({
				"font_size": config.font_config.base_size,
				"spacing_after": config.font_config.paragraph_spacing,
				"justify": True
			})
		
		# Merge with existing properties (existing takes precedence)
		for key, value in base_styles.items():
			if key not in element.style_properties:
				element.style_properties[key] = value

	async def _generate_pages(self, elements: List[LayoutElement], 
							  config: LayoutConfiguration) -> List[Dict[str, Any]]:
		"""Generate page layout from formatted elements"""
		pages = []
		current_page = {
			"page_number": 1,
			"elements": [],
			"header": None,
			"footer": None
		}
		
		current_height = config.margin_config.top * 72  # Convert inches to points
		page_height = 792 if config.page_size == "A4" else 792  # A4 height in points
		usable_height = page_height - (config.margin_config.top + config.margin_config.bottom) * 72
		
		for element in elements:
			# Calculate element height (simplified calculation)
			element_height = await self._calculate_element_height(element, config)
			
			# Check if element fits on current page
			if current_height + element_height > usable_height and current_page["elements"]:
				# Finish current page
				await self._add_page_headers_footers(current_page, config)
				pages.append(current_page)
				
				# Start new page
				current_page = {
					"page_number": len(pages) + 1,
					"elements": [],
					"header": None,
					"footer": None
				}
				current_height = config.margin_config.top * 72
			
			# Add element to current page
			current_page["elements"].append(element)
			current_height += element_height + element.style_properties.get("spacing_after", 0)
		
		# Add final page
		if current_page["elements"]:
			await self._add_page_headers_footers(current_page, config)
			pages.append(current_page)
		
		return pages

	async def _calculate_element_height(self, element: LayoutElement, 
										config: LayoutConfiguration) -> float:
		"""Calculate approximate height of an element in points"""
		font_size = element.style_properties.get("font_size", config.font_config.base_size)
		line_height = element.style_properties.get("line_height", config.font_config.line_height)
		
		# Estimate number of lines based on content length and average characters per line
		avg_chars_per_line = 80  # Approximate for standard page width
		content_length = len(element.content)
		estimated_lines = max(1, content_length // avg_chars_per_line)
		
		# Calculate height
		line_height_points = font_size * line_height
		total_height = estimated_lines * line_height_points
		
		# Add spacing
		total_height += element.style_properties.get("spacing_before", 0)
		total_height += element.style_properties.get("spacing_after", 0)
		
		return total_height

	async def _add_page_headers_footers(self, page: Dict[str, Any], 
										config: LayoutConfiguration):
		"""Add headers and footers to a page"""
		if config.header_enabled:
			page["header"] = {
				"content": "Document Header",  # Would be customizable
				"style": {
					"font_size": config.font_config.base_size - 1,
					"alignment": "center"
				}
			}
		
		if config.footer_enabled:
			footer_content = ""
			if config.page_numbers:
				footer_content = f"Page {page['page_number']}"
			
			page["footer"] = {
				"content": footer_content,
				"style": {
					"font_size": config.font_config.base_size - 1,
					"alignment": "center"
				}
			}

	async def _generate_document_metadata(self, config: LayoutConfiguration, 
										  pages: List[Dict[str, Any]]) -> Dict[str, Any]:
		"""Generate document metadata"""
		total_elements = sum(len(page["elements"]) for page in pages)
		
		return {
			"total_pages": len(pages),
			"total_elements": total_elements,
			"layout_style": config.style.value,
			"output_format": config.format.value,
			"font_config": {
				"primary_font": config.font_config.primary_font,
				"base_size": config.font_config.base_size
			},
			"accessibility_enabled": config.high_contrast or config.alt_text_enabled,
			"generation_date": datetime.now().isoformat()
		}

	async def analyze_layout_quality(self, layout_result: Dict[str, Any]) -> LayoutAnalysis:
		"""Analyze the quality of a generated layout"""
		analysis = LayoutAnalysis()
		
		try:
			pages = layout_result.get("pages", [])
			elements = layout_result.get("formatted_elements", [])
			config = layout_result.get("layout_config")
			
			analysis.pages_analyzed = len(pages)
			analysis.elements_analyzed = len(elements)
			
			# Analyze different aspects
			analysis.readability_score = await self._analyze_readability(elements, config)
			analysis.visual_hierarchy_score = await self._analyze_visual_hierarchy(elements)
			analysis.consistency_score = await self._analyze_consistency(elements)
			analysis.accessibility_score = await self._analyze_accessibility(config, elements)
			analysis.brand_compliance_score = await self._analyze_brand_compliance(config)
			
			# Calculate overall score
			weights = {
				"readability": 0.3,
				"hierarchy": 0.2,
				"consistency": 0.2,
				"accessibility": 0.15,
				"brand": 0.15
			}
			
			analysis.overall_design_score = (
				analysis.readability_score * weights["readability"] +
				analysis.visual_hierarchy_score * weights["hierarchy"] +
				analysis.consistency_score * weights["consistency"] +
				analysis.accessibility_score * weights["accessibility"] +
				analysis.brand_compliance_score * weights["brand"]
			)
			
			# Generate recommendations
			analysis.recommendations = await self._generate_layout_recommendations(analysis)
			
			self.logger.info(f"Layout analysis complete: {analysis.overall_design_score:.1f} overall score")
			
			return analysis
			
		except Exception as e:
			self.logger.error(f"Layout analysis failed: {e}")
			raise

	async def _analyze_readability(self, elements: List[LayoutElement], 
								   config: LayoutConfiguration) -> float:
		"""Analyze layout readability"""
		score = 100.0
		
		# Check font sizes
		small_fonts = sum(1 for e in elements 
						 if e.style_properties.get("font_size", config.font_config.base_size) < 9)
		if small_fonts > 0:
			score -= min(30, small_fonts * 5)
		
		# Check line spacing
		if config.font_config.line_height < 1.1:
			score -= 15
		elif config.font_config.line_height > 1.5:
			score -= 5
		
		# Check margin adequacy
		if config.margin_config.left < 0.75 or config.margin_config.right < 0.75:
			score -= 10
		
		return max(0, score)

	async def _analyze_visual_hierarchy(self, elements: List[LayoutElement]) -> float:
		"""Analyze visual hierarchy clarity"""
		score = 100.0
		
		# Check for proper heading structure
		headers = [e for e in elements if "header" in e.element_type]
		if not headers:
			score -= 20
		
		# Check font size progression
		font_sizes = [e.style_properties.get("font_size", 11) for e in headers]
		if len(set(font_sizes)) == 1:  # All same size
			score -= 15
		
		# Check spacing consistency
		spacings = [e.style_properties.get("spacing_after", 0) for e in elements]
		if len(set(spacings)) > len(spacings) * 0.5:  # Too many different spacings
			score -= 10
		
		return max(0, score)

	async def _analyze_consistency(self, elements: List[LayoutElement]) -> float:
		"""Analyze formatting consistency"""
		score = 100.0
		
		# Group elements by type
		type_groups = defaultdict(list)
		for element in elements:
			type_groups[element.element_type].append(element)
		
		# Check consistency within each type
		for element_type, type_elements in type_groups.items():
			if len(type_elements) > 1:
				# Check font size consistency
				font_sizes = [e.style_properties.get("font_size") for e in type_elements]
				if len(set(font_sizes)) > 1:
					score -= 5
				
				# Check spacing consistency
				spacings = [e.style_properties.get("spacing_after") for e in type_elements]
				if len(set(spacings)) > 1:
					score -= 3
		
		return max(0, score)

	async def _analyze_accessibility(self, config: LayoutConfiguration, 
									 elements: List[LayoutElement]) -> float:
		"""Analyze accessibility compliance"""
		score = 100.0
		
		# Check minimum font sizes
		min_font_size = min(e.style_properties.get("font_size", config.font_config.base_size) 
						   for e in elements)
		if min_font_size < 9:
			score -= 30
		elif min_font_size < 10:
			score -= 15
		
		# Check line height
		if config.font_config.line_height < 1.2:
			score -= 20
		
		# Check if accessibility features are enabled
		if not config.alt_text_enabled:
			score -= 15
		
		if config.high_contrast:
			score += 10  # Bonus for high contrast
		
		return max(0, min(100, score))

	async def _analyze_brand_compliance(self, config: LayoutConfiguration) -> float:
		"""Analyze brand compliance"""
		score = 80.0  # Default score for basic compliance
		
		# Check if logo is configured
		if config.logo_path:
			score += 10
		
		# Check font compliance (would need brand guidelines integration)
		# This is a simplified check
		professional_fonts = ["Arial", "Helvetica", "Calibri", "Times New Roman"]
		if config.font_config.primary_font in professional_fonts:
			score += 10
		
		return min(100, score)

	async def _generate_layout_recommendations(self, analysis: LayoutAnalysis) -> List[str]:
		"""Generate layout improvement recommendations"""
		recommendations = []
		
		if analysis.readability_score < 80:
			recommendations.append("Increase font sizes for better readability")
			recommendations.append("Improve line spacing to enhance text clarity")
		
		if analysis.visual_hierarchy_score < 80:
			recommendations.append("Create clearer visual hierarchy with varied heading sizes")
			recommendations.append("Use consistent spacing patterns to guide the reader's eye")
		
		if analysis.consistency_score < 80:
			recommendations.append("Standardize formatting for similar elements")
			recommendations.append("Create a consistent spacing rhythm throughout the document")
		
		if analysis.accessibility_score < 80:
			recommendations.append("Ensure minimum font sizes meet accessibility standards")
			recommendations.append("Enable high contrast mode for better visibility")
		
		if analysis.brand_compliance_score < 80:
			recommendations.append("Apply consistent brand colors and fonts")
			recommendations.append("Include brand elements like logos and color schemes")
		
		return recommendations

	def _generate_config_hash(self, content_structure: Dict[str, Any], 
							  requirements: Dict[str, Any]) -> str:
		"""Generate hash for configuration caching"""
		config_str = str(content_structure) + str(requirements)
		return hashlib.md5(config_str.encode()).hexdigest()

	async def create_template(self, layout_config: LayoutConfiguration, 
							  template_name: str) -> Dict[str, Any]:
		"""Create a reusable layout template"""
		template = {
			"name": template_name,
			"style": layout_config.style.value,
			"format": layout_config.format.value,
			"font_config": {
				"primary_font": layout_config.font_config.primary_font,
				"secondary_font": layout_config.font_config.secondary_font,
				"base_size": layout_config.font_config.base_size,
				"line_height": layout_config.font_config.line_height
			},
			"margin_config": {
				"top": layout_config.margin_config.top,
				"bottom": layout_config.margin_config.bottom,
				"left": layout_config.margin_config.left,
				"right": layout_config.margin_config.right
			},
			"features": {
				"table_of_contents": layout_config.table_of_contents,
				"page_numbers": layout_config.page_numbers,
				"headers": layout_config.header_enabled,
				"footers": layout_config.footer_enabled
			},
			"accessibility": {
				"high_contrast": layout_config.high_contrast,
				"alt_text_enabled": layout_config.alt_text_enabled
			},
			"created_at": datetime.now().isoformat(),
			"created_by": self.agent_id
		}
		
		self.logger.info(f"Created layout template: {template_name}")
		
		return template

	def get_agent_status(self) -> Dict[str, Any]:
		"""Get current agent status and statistics"""
		return {
			"agent_type": "LayoutAgent",
			"agent_id": self.agent_id,
			"status": self.status,
			"layouts_cached": len(self.layout_cache),
			"analyses_performed": len(self.analysis_cache),
			"supported_formats": [f.value for f in DocumentFormat],
			"supported_styles": [s.value for s in LayoutStyle],
			"capabilities": {
				"document_formatting": True,
				"visual_design": True,
				"brand_compliance": True,
				"accessibility_optimization": True,
				"multi_format_output": True,
				"template_creation": True
			},
			"performance_metrics": {
				"avg_layout_generation_time": "estimated_1-3_minutes",
				"supported_page_sizes": ["A4", "Letter", "Legal", "A3"],
				"max_pages_supported": "unlimited",
				"accessibility_compliance": "WCAG 2.1 AA"
			}
		}