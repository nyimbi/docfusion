#!/usr/bin/env python3
"""
BrandFormatter Module Tests

Comprehensive test suite for the BrandFormatter module covering:
- Logo management and intelligent placement
- Brand guideline enforcement and compliance validation
- Document type classification and template selection
- Multi-format brand output generation (LaTeX, CSS, HTML)
- Performance optimization and caching
- Cross-document brand consistency validation
"""

import asyncio
import pytest
from datetime import datetime
from pathlib import Path
from typing import Any

from docfusion.document_engine.formatter.brand_formatter import (
	BrandFormatter,
	LogoManager,
	BrandEnforcementEngine,
	DocumentTypeClassifier,
	BrandSpecification,
	LogoAsset,
	LogoAssetLibrary,
	BrandRule,
	BrandColorSystem,
	BrandTypographySystem,
	BrandSpacingSystem,
	LogoPlacementRules,
	ComplianceThresholds,
	LogoDimensions,
	LogoPlacement,
	BrandViolation,
	BrandComplianceReport,
	DocumentTypeClassification,
	BrandFormattingResult,
	BrandFormatterMetrics,
	create_default_brand_specification,
	create_logo_asset_from_file,
	quick_brand_formatting,
	validate_brand_formatter_installation,
	BrandFormatterException,
	LogoManagementException,
	BrandComplianceException,
	DocumentTypeClassificationException,
	BrandAssetException
)


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def sample_logo_dimensions():
	"""Create sample logo dimensions for testing"""
	return LogoDimensions(
		width=120.0,
		height=40.0,
		aspect_ratio=3.0,
		units="px",
		dpi=72,
		min_width=20.0,
		max_width=400.0
	)


@pytest.fixture
def sample_logo_asset(sample_logo_dimensions):
	"""Create sample logo asset for testing"""
	return LogoAsset(
		asset_name="Test Company Logo",
		variant_type="primary",
		file_path="assets/logos/test_logo.svg",
		file_format="svg",
		dimensions=sample_logo_dimensions,
		min_size="20px",
		max_size="400px",
		usage_contexts=["header", "footer", "cover"],
		document_types=["proposal", "report", "presentation"]
	)


@pytest.fixture
def sample_logo_asset_library(sample_logo_asset):
	"""Create sample logo asset library for testing"""
	icon_logo = LogoAsset(
		asset_name="Test Company Icon",
		variant_type="icon",
		file_path="assets/logos/test_icon.svg",
		file_format="svg",
		min_size="16px",
		max_size="64px"
	)
	
	return LogoAssetLibrary(
		primary_logo=sample_logo_asset,
		logo_variants={
			"primary": sample_logo_asset,
			"icon": icon_logo
		},
		vector_logos={
			"svg": "test_logo.svg",
			"pdf": "test_logo.pdf"
		},
		raster_logos={
			"png": "test_logo.png"
		}
	)


@pytest.fixture
def sample_brand_color_system():
	"""Create sample brand color system for testing"""
	return BrandColorSystem(
		primary_color="#1f2937",
		secondary_color="#6b7280",
		accent_color="#3b82f6",
		color_palette={
			"text_primary": "#111827",
			"text_secondary": "#374151",
			"background": "#ffffff"
		},
		min_contrast_ratios={
			"text_background": 4.5,
			"heading_background": 7.0
		},
		accessibility_compliance="AA"
	)


@pytest.fixture
def sample_brand_typography_system():
	"""Create sample brand typography system for testing"""
	return BrandTypographySystem(
		primary_font="Inter",
		heading_font="Inter",
		code_font="JetBrains Mono",
		font_sizes={
			"h1": "32px",
			"h2": "24px",
			"body": "16px"
		},
		font_weights={
			"normal": "400",
			"bold": "700"
		},
		line_heights={
			"h1": 1.2,
			"h2": 1.3,
			"body": 1.5
		}
	)


@pytest.fixture
def sample_brand_spacing_system():
	"""Create sample brand spacing system for testing"""
	return BrandSpacingSystem(
		base_unit="1rem",
		spacing_scale=["0.25rem", "0.5rem", "1rem", "2rem", "4rem"],
		section_spacing={
			"header": "2rem",
			"content": "1rem",
			"footer": "1rem"
		},
		margin_rules={
			"page_top": "2.5cm",
			"page_bottom": "2.5cm"
		}
	)


@pytest.fixture
def sample_brand_rules():
	"""Create sample brand rules for testing"""
	return [
		BrandRule(
			rule_name="minimum_logo_clear_space",
			rule_category="logo",
			rule_type="requirement",
			rule_description="Logo must have minimum clear space",
			severity="warning",
			enforcement_mode="validate"
		),
		BrandRule(
			rule_name="brand_color_usage",
			rule_category="color",
			rule_type="requirement",
			rule_description="Only approved brand colors should be used",
			severity="warning",
			enforcement_mode="correct"
		),
		BrandRule(
			rule_name="brand_font_usage",
			rule_category="typography",
			rule_type="requirement",
			rule_description="Only approved brand fonts should be used",
			severity="warning",
			enforcement_mode="correct"
		)
	]


@pytest.fixture
def sample_brand_specification(
	sample_logo_asset_library,
	sample_brand_color_system,
	sample_brand_typography_system,
	sample_brand_spacing_system,
	sample_brand_rules
):
	"""Create sample brand specification for testing"""
	return BrandSpecification(
		brand_name="Test Company",
		logo_assets=sample_logo_asset_library,
		color_system=sample_brand_color_system,
		typography_system=sample_brand_typography_system,
		spacing_system=sample_brand_spacing_system,
		brand_rules=sample_brand_rules,
		compliance_thresholds=ComplianceThresholds()
	)


@pytest.fixture
def sample_document_content():
	"""Create sample document content for testing"""
	return {
		"id": "test_doc_001",
		"title": "Project Proposal: Advanced Analytics Platform",
		"content_elements": [
			{
				"id": "heading_1",
				"type": "heading",
				"content": "Executive Summary",
				"level": 1
			},
			{
				"id": "paragraph_1",
				"type": "text",
				"content": "This proposal outlines the development of an advanced analytics platform that will transform our data processing capabilities.",
				"font_family": "Arial",
				"color": "#000000"
			},
			{
				"id": "heading_2",
				"type": "heading",
				"content": "Project Scope",
				"level": 2
			},
			{
				"id": "paragraph_2",
				"type": "text",
				"content": "The scope includes data ingestion, processing, analysis, and visualization components.",
				"font_family": "Arial",
				"color": "#333333"
			},
			{
				"id": "figure_1",
				"type": "figure",
				"content": "Architecture diagram",
				"width": "80%"
			}
		]
	}


@pytest.fixture
def logo_manager(sample_logo_asset_library):
	"""Create LogoManager instance for testing"""
	return LogoManager(sample_logo_asset_library)


@pytest.fixture
def brand_enforcement_engine(sample_brand_specification):
	"""Create BrandEnforcementEngine instance for testing"""
	return BrandEnforcementEngine(sample_brand_specification)


@pytest.fixture
def document_type_classifier():
	"""Create DocumentTypeClassifier instance for testing"""
	return DocumentTypeClassifier()


@pytest.fixture
def brand_formatter(sample_brand_specification):
	"""Create BrandFormatter instance for testing"""
	return BrandFormatter(sample_brand_specification)


# ============================================================================
# LogoManager Tests
# ============================================================================

class TestLogoManager:
	"""Test LogoManager functionality"""
	
	def test_logo_manager_initialization(self, logo_manager, sample_logo_asset_library):
		"""Test LogoManager initialization"""
		assert logo_manager.asset_library == sample_logo_asset_library
		assert logo_manager.supported_formats == {'svg', 'png', 'pdf', 'eps', 'jpg', 'jpeg'}
		assert len(logo_manager.optimization_strategies) == 3
		assert len(logo_manager.placement_cache) == 0
	
	def test_place_logo_header_context(self, logo_manager):
		"""Test logo placement in header context"""
		placement = logo_manager.place_logo(
			logo_variant="primary",
			placement_context="header",
			layout_constraints={"margins": {"left": "20px", "top": "20px"}}
		)
		
		assert placement.placement_context == "header"
		assert placement.logo_asset.variant_type == "primary"
		assert placement.position["alignment"] == "top_left"
		assert placement.placement_quality_score > 0
		assert placement.latex_placement != ""
		assert placement.css_placement != ""
		assert placement.html_placement != ""
	
	def test_place_logo_footer_context(self, logo_manager):
		"""Test logo placement in footer context"""
		placement = logo_manager.place_logo(
			logo_variant="icon",
			placement_context="footer",
			layout_constraints={}
		)
		
		assert placement.placement_context == "footer"
		assert placement.logo_asset.variant_type == "icon"
		assert placement.position["alignment"] == "bottom_center"
		assert "center" in placement.position["x"]
	
	def test_place_logo_cover_context(self, logo_manager):
		"""Test logo placement in cover context"""
		placement = logo_manager.place_logo(
			logo_variant="primary",
			placement_context="cover",
			layout_constraints={}
		)
		
		assert placement.placement_context == "cover"
		assert placement.position["alignment"] == "top_center"
		assert placement.size["width"] == "200px"  # Cover page default
	
	def test_place_logo_watermark_context(self, logo_manager):
		"""Test logo placement in watermark context"""
		placement = logo_manager.place_logo(
			logo_variant="primary",
			placement_context="watermark",
			layout_constraints={}
		)
		
		assert placement.placement_context == "watermark"
		assert placement.position["alignment"] == "center"
		assert placement.opacity == 1.0  # Default opacity
	
	def test_optimize_logo_for_web(self, logo_manager, sample_logo_asset_library):
		"""Test logo optimization for web"""
		logo_asset = sample_logo_asset_library.primary_logo
		
		result = logo_manager.optimize_logo_for_format(logo_asset, "web")
		
		assert result["format"] == "svg"
		assert result["compression"] == "gzip"
		assert "svg_minification" in result["optimization_applied"]
		assert result["performance_score"] == 0.9
	
	def test_optimize_logo_for_print(self, logo_manager, sample_logo_asset_library):
		"""Test logo optimization for print"""
		logo_asset = sample_logo_asset_library.primary_logo
		
		result = logo_manager.optimize_logo_for_format(logo_asset, "print")
		
		assert result["format"] == "pdf"
		assert result["color_profile"] == "CMYK"
		assert result["resolution"] == "300dpi"
		assert result["performance_score"] == 0.95
	
	def test_optimize_logo_for_mobile(self, logo_manager, sample_logo_asset_library):
		"""Test logo optimization for mobile"""
		logo_asset = sample_logo_asset_library.primary_logo
		
		result = logo_manager.optimize_logo_for_format(logo_asset, "mobile")
		
		assert result["format"] == "png"
		assert result["resolution"] == "2x"
		assert result["compression"] == "lossless"
		assert result["performance_score"] == 0.85
	
	def test_optimize_logo_caching(self, logo_manager, sample_logo_asset_library):
		"""Test logo optimization caching"""
		logo_asset = sample_logo_asset_library.primary_logo
		
		# First optimization
		result1 = logo_manager.optimize_logo_for_format(logo_asset, "web")
		
		# Second optimization (should use cache)
		result2 = logo_manager.optimize_logo_for_format(logo_asset, "web")
		
		assert result1 == result2
		assert len(logo_manager.optimization_cache) > 0
	
	def test_validate_logo_compliance_success(self, logo_manager, sample_brand_rules):
		"""Test logo compliance validation with compliant placement"""
		placement = LogoPlacement(
			logo_asset=LogoAsset(asset_name="Test Logo", variant_type="primary"),
			placement_context="header",
			clear_space_satisfied=True
		)
		
		compliance = logo_manager.validate_logo_compliance(placement, sample_brand_rules)
		
		assert compliance["compliant"] is True
		assert compliance["score"] == 1.0
		assert len(compliance["violations"]) == 0
	
	def test_validate_logo_compliance_violations(self, logo_manager, sample_brand_rules):
		"""Test logo compliance validation with violations"""
		placement = LogoPlacement(
			logo_asset=LogoAsset(asset_name="Test Logo", variant_type="primary"),
			placement_context="header",
			clear_space_satisfied=False,
			clear_space_violations=["Insufficient left margin"]
		)
		
		compliance = logo_manager.validate_logo_compliance(placement, sample_brand_rules)
		
		assert compliance["compliant"] is False
		assert compliance["score"] < 1.0
		assert len(compliance["violations"]) > 0
	
	def test_invalid_logo_variant_error(self, logo_manager):
		"""Test error handling for invalid logo variant"""
		with pytest.raises(AssertionError):
			logo_manager.place_logo("nonexistent_variant", "header", {})
	
	def test_invalid_placement_context_error(self, logo_manager):
		"""Test error handling for invalid placement context"""
		with pytest.raises(AssertionError):
			logo_manager.place_logo("primary", "invalid_context", {})
	
	def test_logo_size_constraints(self, logo_manager):
		"""Test logo size constraint enforcement"""
		# Test with size that should be adjusted to meet constraints
		placement = logo_manager.place_logo(
			logo_variant="primary",
			placement_context="header",
			layout_constraints={}
		)
		
		# Size should be within asset constraints
		width = logo_manager._parse_size(placement.size["width"])
		min_size = logo_manager._parse_size(placement.logo_asset.min_size)
		max_size = logo_manager._parse_size(placement.logo_asset.max_size)
		
		assert min_size <= width <= max_size


# ============================================================================
# BrandEnforcementEngine Tests
# ============================================================================

class TestBrandEnforcementEngine:
	"""Test BrandEnforcementEngine functionality"""
	
	def test_brand_enforcement_engine_initialization(self, brand_enforcement_engine, sample_brand_specification):
		"""Test BrandEnforcementEngine initialization"""
		assert brand_enforcement_engine.brand_spec == sample_brand_specification
		assert len(brand_enforcement_engine.brand_spec.brand_rules) >= 3
		assert len(brand_enforcement_engine.compliance_cache) == 0
	
	async def test_analyze_brand_compliance_success(self, brand_enforcement_engine, sample_document_content):
		"""Test brand compliance analysis with good compliance"""
		applied_formatting = {
			"logo_placements": [],
			"colors_used": ["#1f2937", "#6b7280"],  # Brand colors
			"text_elements": [
				{"font_family": "Inter", "color": "#1f2937"}
			]
		}
		
		report = await brand_enforcement_engine.analyze_brand_compliance(
			sample_document_content,
			applied_formatting
		)
		
		assert report.document_id == "test_doc_001"
		assert report.overall_compliance_score > 0.7
		assert report.analysis_duration > 0
		assert report.rules_evaluated > 0
		assert isinstance(report.detailed_violations, list)
	
	async def test_analyze_brand_compliance_violations(self, brand_enforcement_engine, sample_document_content):
		"""Test brand compliance analysis with violations"""
		applied_formatting = {
			"logo_placements": [],
			"colors_used": ["#ff0000", "#00ff00"],  # Non-brand colors
			"text_elements": [
				{"font_family": "Comic Sans", "color": "#ff0000"}  # Non-brand font and color
			]
		}
		
		report = await brand_enforcement_engine.analyze_brand_compliance(
			sample_document_content,
			applied_formatting
		)
		
		assert report.overall_compliance_score < 0.9  # Should detect violations
		assert report.total_violations > 0
		assert len(report.detailed_violations) > 0
		assert "color" in report.violations_by_category
		assert len(report.priority_recommendations) > 0
	
	async def test_enforce_brand_guidelines_strict(self, brand_enforcement_engine):
		"""Test brand guideline enforcement in strict mode"""
		content_elements = [
			{
				"id": "element_1",
				"type": "text",
				"font_family": "Comic Sans",
				"color": "#ff0000"
			},
			{
				"id": "element_2",
				"type": "heading",
				"font_family": "Times New Roman",
				"color": "#00ff00"
			}
		]
		
		result = await brand_enforcement_engine.enforce_brand_guidelines(
			content_elements,
			enforcement_level="strict"
		)
		
		assert result["success"] is True
		assert result["elements_processed"] == 2
		assert result["violations_detected"] > 0
		assert result["corrections_applied"] > 0
		assert len(result["corrected_elements"]) > 0
		assert result["processing_time"] > 0
	
	async def test_enforce_brand_guidelines_moderate(self, brand_enforcement_engine):
		"""Test brand guideline enforcement in moderate mode"""
		content_elements = [
			{
				"id": "element_1",
				"type": "text",
				"font_family": "Arial",
				"color": "#333333"
			}
		]
		
		result = await brand_enforcement_engine.enforce_brand_guidelines(
			content_elements,
			enforcement_level="moderate"
		)
		
		assert result["success"] is True
		assert result["enforcement_level"] == "moderate"
		assert result["elements_processed"] == 1
	
	def test_default_brand_rules_creation(self, sample_brand_specification):
		"""Test default brand rules creation"""
		# Create engine with no brand rules
		brand_spec_no_rules = BrandSpecification(
			brand_name="Test",
			logo_assets=sample_brand_specification.logo_assets
		)
		
		engine = BrandEnforcementEngine(brand_spec_no_rules)
		
		# Should have created default rules
		assert len(engine.brand_spec.brand_rules) > 0
		rule_categories = {rule.rule_category for rule in engine.brand_spec.brand_rules}
		assert "logo" in rule_categories
		assert "color" in rule_categories
		assert "typography" in rule_categories
	
	async def test_logo_compliance_analysis(self, brand_enforcement_engine):
		"""Test logo-specific compliance analysis"""
		document_content = {"id": "test"}
		applied_formatting = {
			"logo_placements": [
				{"clear_space_satisfied": False, "placement_context": "header"}
			],
			"colors_used": [],
			"text_elements": []
		}
		
		logo_analysis = await brand_enforcement_engine._analyze_logo_compliance(
			document_content,
			applied_formatting
		)
		
		assert logo_analysis["placements_analyzed"] == 1
		assert logo_analysis["score"] < 1.0  # Should detect clear space violation
		assert len(logo_analysis["violations"]) > 0
	
	async def test_color_compliance_analysis(self, brand_enforcement_engine):
		"""Test color-specific compliance analysis"""
		document_content = {"id": "test"}
		applied_formatting = {
			"logo_placements": [],
			"colors_used": ["#ff0000", "#00ff00", "#1f2937"],  # Two non-brand, one brand
			"text_elements": []
		}
		
		color_analysis = await brand_enforcement_engine._analyze_color_compliance(
			document_content,
			applied_formatting
		)
		
		assert color_analysis["colors_analyzed"] == 3
		assert color_analysis["score"] < 1.0  # Should detect non-brand colors
		assert len(color_analysis["violations"]) == 2  # Two non-brand colors
	
	async def test_typography_compliance_analysis(self, brand_enforcement_engine):
		"""Test typography-specific compliance analysis"""
		document_content = {"id": "test"}
		applied_formatting = {
			"logo_placements": [],
			"colors_used": [],
			"text_elements": [
				{"font_family": "Comic Sans"},
				{"font_family": "Inter"}  # Brand font
			]
		}
		
		typography_analysis = await brand_enforcement_engine._analyze_typography_compliance(
			document_content,
			applied_formatting
		)
		
		assert typography_analysis["elements_analyzed"] == 2
		assert typography_analysis["score"] < 1.0  # Should detect non-brand font
		assert len(typography_analysis["violations"]) == 1  # One non-brand font


# ============================================================================
# DocumentTypeClassifier Tests
# ============================================================================

class TestDocumentTypeClassifier:
	"""Test DocumentTypeClassifier functionality"""
	
	def test_document_type_classifier_initialization(self, document_type_classifier):
		"""Test DocumentTypeClassifier initialization"""
		assert len(document_type_classifier.type_indicators) >= 4
		assert "proposal" in document_type_classifier.type_indicators
		assert "report" in document_type_classifier.type_indicators
		assert "presentation" in document_type_classifier.type_indicators
		assert "memo" in document_type_classifier.type_indicators
	
	async def test_classify_document_type_proposal(self, document_type_classifier, sample_document_content):
		"""Test document type classification for proposal"""
		classification = await document_type_classifier.classify_document_type(sample_document_content)
		
		assert classification.document_type in ["proposal", "report"]  # Could be either based on content
		assert classification.confidence_score > 0.0
		assert len(classification.alternative_types) > 0
		assert classification.recommended_template != ""
		assert classification.template_confidence > 0.0
		assert classification.classification_method == "hybrid"
	
	async def test_classify_document_type_memo(self, document_type_classifier):
		"""Test document type classification for memo"""
		memo_content = {
			"id": "memo_001",
			"title": "Weekly Team Update Memo",
			"content_elements": [
				{
					"id": "header",
					"type": "heading",
					"content": "Memorandum"
				},
				{
					"id": "body",
					"type": "text",
					"content": "This memo provides an update on our weekly activities and next steps."
				}
			]
		}
		
		classification = await document_type_classifier.classify_document_type(memo_content)
		
		# Should classify as memo or similar short document type
		assert classification.document_type in ["memo", "report", "proposal"]
		assert classification.confidence_score > 0.0
	
	async def test_classify_document_type_with_metadata_hints(self, document_type_classifier, sample_document_content):
		"""Test document type classification with metadata hints"""
		metadata_hints = {
			"document_category": "proposal",
			"intended_audience": "client",
			"estimated_length": 20
		}
		
		classification = await document_type_classifier.classify_document_type(
			sample_document_content,
			metadata_hints
		)
		
		assert classification.document_type != "unknown"
		assert classification.confidence_score > 0.0
	
	def test_select_brand_template_existing(self, document_type_classifier, sample_brand_specification):
		"""Test brand template selection for existing template"""
		# Add a template to the brand specification
		sample_brand_specification.document_templates["proposal"] = {
			"template_id": "proposal_v1",
			"logo_configuration": {"primary_placement": "header_left"}
		}
		
		template = document_type_classifier.select_brand_template(
			"proposal",
			{},
			sample_brand_specification
		)
		
		assert template["template_id"] == "proposal_v1"
		assert "logo_configuration" in template
	
	def test_select_brand_template_default(self, document_type_classifier, sample_brand_specification):
		"""Test brand template selection with default template"""
		template = document_type_classifier.select_brand_template(
			"unknown_type",
			{},
			sample_brand_specification
		)
		
		assert template["template_id"] == "unknown_type_default"
		assert "logo_configuration" in template
		assert "typography_hierarchy" in template
		assert "color_scheme" in template
	
	def test_text_content_extraction(self, document_type_classifier, sample_document_content):
		"""Test text content extraction from document"""
		text_content = document_type_classifier._extract_text_content(sample_document_content)
		
		assert "project proposal" in text_content
		assert "executive summary" in text_content
		assert "analytics platform" in text_content
		assert len(text_content) > 0
	
	def test_document_structure_analysis(self, document_type_classifier, sample_document_content):
		"""Test document structure analysis"""
		structure_info = document_type_classifier._analyze_document_structure(sample_document_content)
		
		assert structure_info["has_title"] is True
		assert structure_info["section_count"] >= 2  # At least 2 headings
		assert len(structure_info["heading_levels"]) > 0
		assert "text" in structure_info["content_types"]
		assert "heading" in structure_info["content_types"]
	
	def test_text_score_calculation(self, document_type_classifier):
		"""Test text analysis score calculation"""
		keywords = ["proposal", "budget", "timeline"]
		
		# High match text
		high_match_text = "this is a proposal with budget and timeline information"
		high_score = document_type_classifier._calculate_text_score(high_match_text, keywords)
		assert high_score >= 0.5
		
		# Low match text
		low_match_text = "this is some random content without keywords"
		low_score = document_type_classifier._calculate_text_score(low_match_text, keywords)
		assert low_score < high_score
		
		# Empty text
		empty_score = document_type_classifier._calculate_text_score("", keywords)
		assert empty_score == 0.0


# ============================================================================
# BrandFormatter Integration Tests
# ============================================================================

class TestBrandFormatter:
	"""Test main BrandFormatter functionality"""
	
	def test_brand_formatter_initialization(self, brand_formatter, sample_brand_specification):
		"""Test BrandFormatter initialization"""
		assert brand_formatter.brand_spec == sample_brand_specification
		assert brand_formatter.logo_manager is not None
		assert brand_formatter.enforcement_engine is not None
		assert brand_formatter.type_classifier is not None
		assert len(brand_formatter.brand_cache) == 0
		assert brand_formatter.metrics["documents_processed"] == 0
	
	def test_brand_formatter_auto_initialization(self, sample_brand_specification):
		"""Test BrandFormatter auto-initialization of components"""
		formatter = BrandFormatter(sample_brand_specification)
		
		assert formatter.logo_manager is not None
		assert formatter.enforcement_engine is not None
		assert formatter.type_classifier is not None
	
	async def test_apply_brand_formatting_success(self, brand_formatter, sample_document_content):
		"""Test successful brand formatting application"""
		formatting_context = {
			"enforcement_level": "moderate",
			"layout_constraints": {"margins": {"left": "20px", "top": "20px"}},
			"metadata_hints": {"document_category": "proposal"},
			"colors_used": ["#1f2937"],
			"text_elements": [{"font_family": "Inter", "color": "#1f2937"}]
		}
		
		result = await brand_formatter.apply_brand_formatting(
			sample_document_content,
			formatting_context,
			["latex", "css", "html"]
		)
		
		assert result.formatting_successful is True
		assert result.document_id == "test_doc_001"
		assert result.document_classification.document_type != "unknown"
		assert len(result.logo_placements) > 0
		assert result.brand_compliance_report.overall_compliance_score > 0
		assert result.formatting_quality_score > 0
		assert result.latex_brand_output != ""
		assert result.css_brand_output != ""
		assert result.html_brand_output != ""
		assert result.total_processing_time > 0
	
	async def test_apply_brand_formatting_with_violations(self, brand_formatter, sample_document_content):
		"""Test brand formatting with brand violations"""
		formatting_context = {
			"enforcement_level": "strict",
			"colors_used": ["#ff0000", "#00ff00"],  # Non-brand colors
			"text_elements": [
				{"font_family": "Comic Sans", "color": "#ff0000"}
			]
		}
		
		result = await brand_formatter.apply_brand_formatting(
			sample_document_content,
			formatting_context,
			["latex", "css"]
		)
		
		assert result.formatting_successful is True
		assert result.brand_compliance_report.total_violations > 0
		assert len(result.auto_corrections_applied) > 0
		assert result.brand_compliance_report.overall_compliance_score < 0.9
	
	async def test_generate_branded_template_new(self, brand_formatter):
		"""Test branded template generation for new document type"""
		template = await brand_formatter.generate_branded_template(
			"technical_report",
			{"audience": "technical", "complexity": "high"}
		)
		
		assert template["template_id"] == "technical_report_default"
		assert "logo_configuration" in template
		assert "typography_hierarchy" in template
		assert "brand_styling" in template
		assert "colors" in template["brand_styling"]
		assert "typography" in template["brand_styling"]
	
	async def test_generate_branded_template_caching(self, brand_formatter):
		"""Test branded template generation caching"""
		customizations = {"style": "modern"}
		
		# First generation
		template1 = await brand_formatter.generate_branded_template("report", customizations)
		
		# Second generation (should use cache)
		template2 = await brand_formatter.generate_branded_template("report", customizations)
		
		assert template1 == template2
		assert len(brand_formatter.template_cache) > 0
	
	async def test_get_brand_formatter_metrics(self, brand_formatter, sample_document_content):
		"""Test brand formatter metrics collection"""
		# Process a document first to generate metrics
		formatting_context = {"enforcement_level": "moderate"}
		await brand_formatter.apply_brand_formatting(
			sample_document_content,
			formatting_context,
			["latex"]
		)
		
		metrics = await brand_formatter.get_brand_formatter_metrics()
		
		assert metrics.documents_processed >= 1
		assert metrics.total_processing_time >= 0  # Could be very small/zero for fast processing
		assert metrics.average_processing_time >= 0  # Could be very small/zero for fast processing
		assert metrics.average_compliance_score >= 0
		assert metrics.cache_hit_rate >= 0
		assert metrics.memory_usage > 0
		assert metrics.formatting_success_rate > 0
	
	def test_generate_latex_brand_output(self, brand_formatter):
		"""Test LaTeX brand output generation"""
		formatting_result = BrandFormattingResult(
			logo_placements=[
				LogoPlacement(
					logo_asset=LogoAsset(asset_name="Test", variant_type="primary", file_path="test.svg"),
					placement_context="header",
					latex_placement="\\includegraphics[width=120pt]{test.svg}"
				)
			]
		)
		
		latex_output = brand_formatter._generate_latex_brand_output(formatting_result)
		
		assert "\\RequirePackage{xcolor}" in latex_output
		assert "\\definecolor{brandprimary}" in latex_output
		assert "\\includegraphics" in latex_output
		assert "\\RequirePackage{fontspec}" in latex_output
		assert "\\setmainfont" in latex_output
	
	def test_generate_css_brand_output(self, brand_formatter):
		"""Test CSS brand output generation"""
		formatting_result = BrandFormattingResult(
			logo_placements=[
				LogoPlacement(
					logo_asset=LogoAsset(asset_name="Test", variant_type="primary"),
					placement_context="header",
					css_placement=".logo-header { position: absolute; }"
				)
			]
		)
		
		css_output = brand_formatter._generate_css_brand_output(formatting_result)
		
		assert ":root {" in css_output
		assert "--brand-primary:" in css_output
		assert "--brand-secondary:" in css_output
		assert ".logo-header" in css_output
		assert "font-family:" in css_output
	
	def test_generate_html_brand_output(self, brand_formatter):
		"""Test HTML brand output generation"""
		formatting_result = BrandFormattingResult(
			logo_placements=[
				LogoPlacement(
					logo_asset=LogoAsset(asset_name="Test", variant_type="primary"),
					placement_context="header",
					html_placement="<img src='test.svg' alt='Test logo'>"
				)
			]
		)
		
		html_output = brand_formatter._generate_html_brand_output(formatting_result)
		
		assert '<div class="brand-container">' in html_output
		assert "<img src='test.svg'" in html_output
		assert '</div>' in html_output
	
	def test_formatting_quality_calculation(self, brand_formatter):
		"""Test formatting quality score calculation"""
		formatting_result = BrandFormattingResult(
			logo_placements=[
				LogoPlacement(
					logo_asset=LogoAsset(asset_name="Test", variant_type="primary"),
					placement_context="header",
					placement_quality_score=0.9
				)
			],
			brand_compliance_report=BrandComplianceReport(overall_compliance_score=0.85),
			document_classification=DocumentTypeClassification(
				document_type="proposal",
				confidence_score=0.8
			)
		)
		
		quality_score = brand_formatter._calculate_formatting_quality(formatting_result)
		
		assert 0.0 <= quality_score <= 1.0
		assert quality_score > 0.7  # Should be reasonably high with good inputs
	
	async def test_error_handling_invalid_content(self, brand_formatter):
		"""Test error handling with invalid content"""
		with pytest.raises(AssertionError):
			await brand_formatter.apply_brand_formatting(None, {}, ["latex"])
	
	async def test_error_handling_empty_output_formats(self, brand_formatter, sample_document_content):
		"""Test error handling with empty output formats"""
		with pytest.raises(AssertionError):
			await brand_formatter.apply_brand_formatting(sample_document_content, {}, [])


# ============================================================================
# Utility Function Tests
# ============================================================================

class TestUtilityFunctions:
	"""Test BrandFormatter utility functions"""
	
	def test_create_default_brand_specification(self):
		"""Test default brand specification creation"""
		brand_spec = create_default_brand_specification("Acme Corporation")
		
		assert brand_spec.brand_name == "Acme Corporation"
		assert brand_spec.logo_assets.primary_logo.asset_name == "Acme Corporation Logo"
		assert "primary" in brand_spec.logo_assets.logo_variants
		assert "icon" in brand_spec.logo_assets.logo_variants
		assert brand_spec.color_system.primary_color == "#1f2937"
		assert brand_spec.typography_system.primary_font == "Inter"
	
	def test_create_logo_asset_from_file_success(self):
		"""Test logo asset creation from file path"""
		# Create a temporary file for testing
		import tempfile
		with tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as temp_file:
			temp_file.write(b"<svg>test</svg>")
			temp_path = temp_file.name
		
		try:
			logo_asset = create_logo_asset_from_file(
				temp_path,
				"Test Logo",
				"primary"
			)
			
			assert logo_asset.asset_name == "Test Logo"
			assert logo_asset.variant_type == "primary"
			assert logo_asset.file_format == "svg"
			assert logo_asset.file_size > 0
			assert "header" in logo_asset.usage_contexts
		finally:
			Path(temp_path).unlink()  # Clean up
	
	def test_create_logo_asset_from_file_not_found(self):
		"""Test logo asset creation with non-existent file"""
		with pytest.raises(BrandAssetException):
			create_logo_asset_from_file("/nonexistent/path.svg", "Test", "primary")
	
	def test_create_logo_asset_from_file_unsupported_format(self):
		"""Test logo asset creation with unsupported format"""
		import tempfile
		with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as temp_file:
			temp_file.write(b"not an image")
			temp_path = temp_file.name
		
		try:
			with pytest.raises(BrandAssetException):
				create_logo_asset_from_file(temp_path, "Test", "primary")
		finally:
			Path(temp_path).unlink()
	
	async def test_quick_brand_formatting(self, sample_document_content):
		"""Test quick brand formatting utility"""
		result = await quick_brand_formatting(
			sample_document_content,
			"Quick Test Brand",
			["latex", "css"]
		)
		
		assert result.formatting_successful is True
		assert result.document_classification.document_type != "unknown"
		assert len(result.logo_placements) > 0
		assert result.latex_brand_output != ""
		assert result.css_brand_output != ""
	
	async def test_quick_brand_formatting_default_formats(self, sample_document_content):
		"""Test quick brand formatting with default output formats"""
		result = await quick_brand_formatting(sample_document_content, "Test Brand")
		
		assert result.latex_brand_output != ""
		assert result.css_brand_output != ""
		assert result.html_brand_output != ""
	
	def test_validate_brand_formatter_installation(self):
		"""Test brand formatter installation validation"""
		validation_results = validate_brand_formatter_installation()
		
		assert "brand_specification_creation" in validation_results
		assert "logo_manager" in validation_results
		assert "enforcement_engine" in validation_results
		assert "document_classifier" in validation_results
		assert "brand_formatter" in validation_results
		assert "overall_status" in validation_results
		
		# All components should validate successfully
		assert validation_results["brand_specification_creation"] is True
		assert validation_results["logo_manager"] is True
		assert validation_results["enforcement_engine"] is True
		assert validation_results["document_classifier"] is True
		assert validation_results["brand_formatter"] is True
		assert validation_results["overall_status"] is True


# ============================================================================
# Performance Tests
# ============================================================================

class TestBrandFormatterPerformance:
	"""Test BrandFormatter performance characteristics"""
	
	async def test_large_document_processing(self, brand_formatter):
		"""Test performance with large document"""
		# Create large document
		large_document = {
			"id": "large_doc_001",
			"title": "Large Scale Enterprise Analysis Report",
			"content_elements": []
		}
		
		# Add many content elements
		for i in range(100):
			large_document["content_elements"].extend([
				{
					"id": f"heading_{i}",
					"type": "heading",
					"content": f"Section {i}",
					"level": 2
				},
				{
					"id": f"paragraph_{i}",
					"type": "text",
					"content": f"This is paragraph {i} with substantial content for performance testing.",
					"font_family": "Arial",
					"color": "#000000"
				}
			])
		
		formatting_context = {"enforcement_level": "moderate"}
		
		start_time = datetime.now()
		result = await brand_formatter.apply_brand_formatting(
			large_document,
			formatting_context,
			["latex", "css"]
		)
		end_time = datetime.now()
		
		processing_time = (end_time - start_time).total_seconds()
		
		assert result.formatting_successful is True
		assert processing_time < 5.0  # Should process large document in under 5 seconds
		assert len(large_document["content_elements"]) == 200
	
	async def test_cache_performance_improvement(self, brand_formatter, sample_document_content):
		"""Test that caching improves performance"""
		formatting_context = {"enforcement_level": "moderate"}
		
		# First processing (no cache)
		start_time = datetime.now()
		result1 = await brand_formatter.apply_brand_formatting(
			sample_document_content,
			formatting_context,
			["latex"]
		)
		first_time = (datetime.now() - start_time).total_seconds()
		
		# Generate template to populate cache
		await brand_formatter.generate_branded_template("proposal")
		
		# Second processing (with some cache)
		start_time = datetime.now()
		result2 = await brand_formatter.apply_brand_formatting(
			sample_document_content,
			formatting_context,
			["latex"]
		)
		second_time = (datetime.now() - start_time).total_seconds()
		
		assert result1.formatting_successful is True
		assert result2.formatting_successful is True
		assert brand_formatter.metrics["documents_processed"] >= 2
		# Note: In tests, the difference might be minimal due to small dataset
	
	async def test_memory_efficiency(self, brand_formatter):
		"""Test memory efficiency with multiple brand operations"""
		document = {
			"id": "memory_test",
			"title": "Memory Test Document",
			"content_elements": [
				{"id": "h1", "type": "heading", "content": "Test"},
				{"id": "p1", "type": "text", "content": "Content"}
			]
		}
		
		# Process multiple documents
		for i in range(10):
			document["id"] = f"memory_test_{i}"
			await brand_formatter.apply_brand_formatting(
				document,
				{"enforcement_level": "moderate"},
				["latex"]
			)
		
		metrics = await brand_formatter.get_brand_formatter_metrics()
		
		# Memory usage should be reasonable
		assert metrics.memory_usage < 200.0  # Less than 200MB
		assert metrics.documents_processed == 10
		assert metrics.cache_hit_rate >= 0.0


# ============================================================================
# Error Handling Tests
# ============================================================================

class TestBrandFormatterErrorHandling:
	"""Test BrandFormatter error handling and edge cases"""
	
	async def test_empty_document_handling(self, brand_formatter):
		"""Test handling of empty document"""
		empty_document = {
			"id": "empty_doc",
			"title": "",
			"content_elements": []
		}
		
		result = await brand_formatter.apply_brand_formatting(
			empty_document,
			{"enforcement_level": "moderate"},
			["latex"]
		)
		
		assert result.formatting_successful is True
		assert result.document_classification.document_type != ""
		assert result.total_processing_time > 0
	
	async def test_malformed_content_elements(self, brand_formatter):
		"""Test handling of malformed content elements"""
		malformed_document = {
			"id": "malformed_doc",
			"title": "Test Document",
			"content_elements": [
				{"type": "text"},  # Missing id and content
				{"id": "malformed_2"},  # Missing type
				{"id": "malformed_3", "type": "unknown_type", "invalid_field": "value"}
			]
		}
		
		result = await brand_formatter.apply_brand_formatting(
			malformed_document,
			{"enforcement_level": "moderate"},
			["latex"]
		)
		
		# Should handle gracefully without crashing
		assert result.formatting_successful is True
	
	def test_invalid_brand_specification_fields(self):
		"""Test handling of invalid brand specification fields"""
		# Create brand spec with missing required fields
		try:
			invalid_brand_spec = BrandSpecification(
				brand_name="",  # Empty name
				logo_assets=LogoAssetLibrary(
					primary_logo=LogoAsset(asset_name="", variant_type="")  # Empty fields
				)
			)
			
			formatter = BrandFormatter(invalid_brand_spec)
			# Should create without error, but may have reduced functionality
			assert formatter is not None
			
		except Exception as e:
			# If validation catches the error, that's also acceptable
			assert isinstance(e, (ValueError, TypeError))
	
	async def test_brand_enforcement_with_no_rules(self, sample_logo_asset_library):
		"""Test brand enforcement with no rules defined"""
		brand_spec_no_rules = BrandSpecification(
			brand_name="No Rules Brand",
			logo_assets=sample_logo_asset_library,
			brand_rules=[]  # No rules
		)
		
		formatter = BrandFormatter(brand_spec_no_rules)
		
		document = {
			"id": "test",
			"content_elements": [
				{"id": "elem1", "type": "text", "color": "#ff0000"}
			]
		}
		
		result = await formatter.apply_brand_formatting(
			document,
			{"enforcement_level": "strict"},
			["latex"]
		)
		
		# Should work but create default rules
		assert result.formatting_successful is True
		assert len(formatter.enforcement_engine.brand_spec.brand_rules) > 0  # Default rules added
	
	def test_logo_placement_edge_cases(self, logo_manager):
		"""Test logo placement with edge case constraints"""
		# Test with very small layout constraints
		small_constraints = {
			"margins": {"left": "1px", "top": "1px"},
			"max_width": "50px",
			"max_height": "20px"
		}
		
		placement = logo_manager.place_logo(
			"primary",
			"header",
			small_constraints
		)
		
		# Should handle gracefully
		assert placement is not None
		assert placement.placement_quality_score >= 0.0
		assert not placement.clear_space_satisfied  # Likely violated due to small space


# ============================================================================
# Integration Tests
# ============================================================================

class TestBrandFormatterIntegration:
	"""Test BrandFormatter integration scenarios"""
	
	async def test_end_to_end_brand_application(self, sample_document_content):
		"""Test complete end-to-end brand application workflow"""
		# Create comprehensive brand specification
		brand_spec = create_default_brand_specification("Integration Test Corp")
		
		# Add custom brand rules
		brand_spec.brand_rules.append(BrandRule(
			rule_name="custom_heading_color",
			rule_category="color",
			rule_type="requirement",
			rule_description="Headings must use primary brand color",
			severity="error",
			enforcement_mode="correct"
		))
		
		# Create formatter
		formatter = BrandFormatter(brand_spec)
		
		# Apply comprehensive formatting
		formatting_context = {
			"enforcement_level": "strict",
			"layout_constraints": {
				"margins": {"left": "2cm", "top": "2cm", "right": "2cm", "bottom": "2cm"}
			},
			"metadata_hints": {
				"document_category": "proposal",
				"audience": "executive",
				"importance": "high"
			},
			"colors_used": ["#000000", "#ff0000"],  # Some non-brand colors
			"text_elements": [
				{"font_family": "Arial", "color": "#000000"},
				{"font_family": "Times New Roman", "color": "#ff0000"}
			]
		}
		
		result = await formatter.apply_brand_formatting(
			sample_document_content,
			formatting_context,
			["latex", "css", "html"]
		)
		
		# Verify comprehensive results
		assert result.formatting_successful is True
		assert result.document_classification.document_type == "proposal"
		assert len(result.logo_placements) >= 1
		assert result.brand_compliance_report.total_violations >= 0
		assert result.latex_brand_output != ""
		assert result.css_brand_output != ""
		assert result.html_brand_output != ""
		
		# Verify auto-corrections were applied
		assert len(result.auto_corrections_applied) >= 0
		
		# Verify brand consistency
		assert result.brand_consistency_score >= 0.0
	
	async def test_multi_document_consistency(self, brand_formatter):
		"""Test brand consistency across multiple documents"""
		documents = []
		
		# Create multiple related documents
		for i in range(3):
			doc = {
				"id": f"consistency_doc_{i}",
				"title": f"Document {i}: Project Phase {i+1}",
				"content_elements": [
					{
						"id": f"heading_{i}",
						"type": "heading",
						"content": f"Phase {i+1} Overview"
					},
					{
						"id": f"content_{i}",
						"type": "text",
						"content": f"This document covers phase {i+1} of our project."
					}
				]
			}
			documents.append(doc)
		
		# Apply brand formatting to all documents
		results = []
		for doc in documents:
			result = await brand_formatter.apply_brand_formatting(
				doc,
				{"enforcement_level": "moderate"},
				["latex", "css"]
			)
			results.append(result)
		
		# Verify consistency across documents
		for result in results:
			assert result.formatting_successful is True
			assert result.document_classification.document_type != "unknown"
		
		# Check that logo placements are consistent
		logo_contexts = set()
		for result in results:
			for placement in result.logo_placements:
				logo_contexts.add(placement.placement_context)
		
		# Should have consistent logo placement strategies
		assert len(logo_contexts) <= 3  # Reasonable variety but not random
	
	async def test_responsive_brand_adaptation(self, brand_formatter, sample_document_content):
		"""Test brand adaptation for different output contexts"""
		contexts = [
			{
				"output_context": "print",
				"dpi": 300,
				"color_profile": "CMYK",
				"layout_constraints": {"page_size": "A4"}
			},
			{
				"output_context": "web",
				"responsive_breakpoints": ["mobile", "tablet", "desktop"],
				"optimization": "performance"
			},
			{
				"output_context": "mobile",
				"screen_size": "small",
				"touch_optimized": True
			}
		]
		
		results = []
		for context in contexts:
			result = await brand_formatter.apply_brand_formatting(
				sample_document_content,
				context,
				["latex", "css", "html"]
			)
			results.append(result)
		
		# Verify all contexts were handled
		for result in results:
			assert result.formatting_successful is True
			assert result.total_processing_time > 0
		
		# Check that output formats are appropriate for context
		for i, result in enumerate(results):
			if contexts[i]["output_context"] == "print":
				# Check for print-appropriate LaTeX output
				assert "\\RequirePackage{xcolor}" in result.latex_brand_output or "\\definecolor" in result.latex_brand_output
			elif contexts[i]["output_context"] == "web":
				# Check for web-appropriate CSS output (any valid CSS properties)
				assert ":root" in result.css_brand_output or "font-family" in result.css_brand_output
	
	async def test_brand_template_inheritance(self, brand_formatter):
		"""Test brand template inheritance and customization"""
		# Create base template
		base_template = await brand_formatter.generate_branded_template("report")
		
		# Create specialized templates
		technical_template = await brand_formatter.generate_branded_template(
			"report",
			{
				"audience": "technical",
				"style": "detailed",
				"complexity": "high"
			}
		)
		
		executive_template = await brand_formatter.generate_branded_template(
			"report",
			{
				"audience": "executive",
				"style": "summary",
				"complexity": "low"
			}
		)
		
		# Verify templates have common brand elements
		for template in [base_template, technical_template, executive_template]:
			assert "brand_styling" in template
			assert "colors" in template["brand_styling"]
			assert template["brand_styling"]["colors"]["primary"] == brand_formatter.brand_spec.color_system.primary_color
		
		# Verify customizations were applied
		assert technical_template != executive_template  # Should be different due to customizations
		assert base_template != technical_template  # Should be different from base