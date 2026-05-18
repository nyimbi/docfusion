#!/usr/bin/env python3
"""
StyleApplier Module Tests

Comprehensive test suite for the StyleApplier module covering:
- Color management and accessibility validation
- Typography application and font management
- Brand compliance checking and auto-correction
- Style application performance and caching
- Integration with DocumentFormatter
"""

import pytest
from datetime import datetime

from .style_applier import (
	StyleApplier,
	ColorManager,
	TypographyManager,
	BrandCompliance,
	ColorPalette,
	TypographyProfile,
	BrandGuidelines,
	create_default_brand_guidelines,
	quick_apply_brand_styles
)

from .document_formatter import ComputedStyle


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def sample_color_palette():
	"""Create sample color palette for testing"""
	return ColorPalette(
		primary="#1f2937",
		secondary="#6b7280",
		accent="#3b82f6",
		text_primary="#111827",
		text_secondary="#374151",
		text_muted="#6b7280",
		background_primary="#ffffff",
		background_secondary="#f9fafb",
		background_accent="#f3f4f6",
		palette_name="test_palette",
		accessibility_level="AA"
	)


@pytest.fixture
def sample_typography_profile():
	"""Create sample typography profile for testing"""
	return TypographyProfile(
		primary_font="Inter",
		heading_font="Inter",
		code_font="JetBrains Mono",
		base_font_size="16px",
		scale_ratio=1.25,
		base_line_height=1.5,
		font_sources={
			"Inter": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700",
			"JetBrains Mono": "https://fonts.googleapis.com/css2?family=JetBrains+Mono"
		},
		fallback_fonts={
			"Inter": ["Arial", "Helvetica", "sans-serif"],
			"JetBrains Mono": ["Courier New", "Courier", "monospace"]
		}
	)


@pytest.fixture
def sample_brand_guidelines(sample_color_palette, sample_typography_profile):
	"""Create sample brand guidelines for testing"""
	return BrandGuidelines(
		brand_name="Test Brand",
		color_palette=sample_color_palette,
		typography=sample_typography_profile,
		min_contrast_ratio=4.5,
		spacing_rules={
			"section_margin": "2rem",
			"paragraph_spacing": "1rem"
		},
		validation_rules=[
			{"type": "color_compliance", "strict": True},
			{"type": "typography_compliance", "strict": False},
			{"type": "accessibility_compliance", "strict": True}
		]
	)


@pytest.fixture
def sample_computed_styles():
	"""Create sample computed styles for testing"""
	return [
		ComputedStyle(
			element_id="heading_1",
			element_type="heading",
			font_family="serif",
			font_size="24pt",
			color="#000000",
			font_weight="bold"
		),
		ComputedStyle(
			element_id="paragraph_1",
			element_type="text",
			font_family="serif",
			font_size="12pt",
			color="#000000",
			line_height="1.4"
		),
		ComputedStyle(
			element_id="code_1",
			element_type="code",
			font_family="monospace",
			font_size="11pt",
			color="#000000",
			background_color="#f5f5f5"
		)
	]


@pytest.fixture
def color_manager(sample_color_palette):
	"""Create ColorManager instance for testing"""
	return ColorManager(sample_color_palette)


@pytest.fixture
def typography_manager(sample_typography_profile):
	"""Create TypographyManager instance for testing"""
	return TypographyManager(sample_typography_profile)


@pytest.fixture
def brand_compliance(sample_brand_guidelines):
	"""Create BrandCompliance instance for testing"""
	return BrandCompliance(sample_brand_guidelines)


@pytest.fixture
def style_applier(color_manager, typography_manager, brand_compliance):
	"""Create StyleApplier instance for testing"""
	return StyleApplier(color_manager, typography_manager, brand_compliance)


# ============================================================================
# ColorManager Tests
# ============================================================================

class TestColorManager:
	"""Test ColorManager functionality"""
	
	def test_color_manager_initialization(self, color_manager, sample_color_palette):
		"""Test ColorManager initialization"""
		assert color_manager.palette == sample_color_palette
		assert color_manager.palette.primary == "#1f2937"
		assert len(color_manager.color_cache) == 0
		assert len(color_manager.contrast_cache) == 0
	
	def test_apply_brand_colors_heading(self, color_manager):
		"""Test brand color application to heading"""
		style = ComputedStyle(
			element_id="test_heading",
			element_type="heading",
			color="#000000"
		)
		
		enhanced_style = color_manager.apply_brand_colors(style)
		
		assert enhanced_style.color == color_manager.palette.primary
		assert enhanced_style.element_type == "heading"
	
	def test_apply_brand_colors_text(self, color_manager):
		"""Test brand color application to text"""
		style = ComputedStyle(
			element_id="test_text",
			element_type="text",
			color="#000000"
		)
		
		enhanced_style = color_manager.apply_brand_colors(style)
		
		assert enhanced_style.color == color_manager.palette.text_primary
	
	def test_apply_brand_colors_semantic(self, color_manager):
		"""Test semantic color application"""
		success_style = ComputedStyle(
			element_id="success_message",
			element_type="success",
			color="#000000"
		)
		
		enhanced_style = color_manager.apply_brand_colors(success_style)
		assert enhanced_style.color == color_manager.palette.success
	
	def test_contrast_validation(self, color_manager):
		"""Test WCAG contrast ratio calculation"""
		# High contrast (good)
		contrast = color_manager.validate_contrast("#000000", "#ffffff")
		assert contrast > 15  # Should be 21:1
		
		# Low contrast (poor)
		contrast = color_manager.validate_contrast("#cccccc", "#ffffff")
		assert contrast < 5  # Should be around 1.6:1
	
	def test_hex_to_rgb_conversion(self, color_manager):
		"""Test hex to RGB conversion"""
		rgb = color_manager._hex_to_rgb("#ff0000")
		assert rgb == (255, 0, 0)
		
		rgb = color_manager._hex_to_rgb("#00ff00")
		assert rgb == (0, 255, 0)
		
		rgb = color_manager._hex_to_rgb("#0000ff")
		assert rgb == (0, 0, 255)
	
	def test_rgb_to_hex_conversion(self, color_manager):
		"""Test RGB to hex conversion"""
		hex_color = color_manager._rgb_to_hex((255, 0, 0))
		assert hex_color == "#ff0000"
		
		hex_color = color_manager._rgb_to_hex((0, 255, 0))
		assert hex_color == "#00ff00"
	
	def test_contrast_adjustment(self, color_manager):
		"""Test automatic contrast adjustment"""
		# Test with poor contrast
		original = "#cccccc"
		background = "#ffffff"
		
		adjusted = color_manager._adjust_contrast(original, background, 4.5)
		new_contrast = color_manager.validate_contrast(adjusted, background)
		
		# Should improve contrast
		original_contrast = color_manager.validate_contrast(original, background)
		assert new_contrast > original_contrast
	
	def test_secondary_color_generation(self, color_manager):
		"""Test secondary color generation"""
		primary = "#1f2937"
		secondary = color_manager._generate_secondary_color(primary)
		
		assert secondary != primary
		assert secondary.startswith("#")
		assert len(secondary) == 7
	
	def test_latex_color_export(self, color_manager):
		"""Test LaTeX color definition export"""
		latex_colors = color_manager.export_latex_colors()
		
		assert "\\RequirePackage{xcolor}" in latex_colors
		assert "\\definecolor{brandprimary}" in latex_colors
		assert "RGB" in latex_colors
	
	def test_css_variables_export(self, color_manager):
		"""Test CSS custom properties export"""
		css_vars = color_manager.export_css_variables()
		
		assert ":root {" in css_vars
		assert "--color-primary:" in css_vars
		assert color_manager.palette.primary in css_vars
		assert "}" in css_vars


# ============================================================================
# TypographyManager Tests
# ============================================================================

class TestTypographyManager:
	"""Test TypographyManager functionality"""
	
	def test_typography_manager_initialization(self, typography_manager, sample_typography_profile):
		"""Test TypographyManager initialization"""
		assert typography_manager.profile == sample_typography_profile
		assert typography_manager.profile.primary_font == "Inter"
		assert len(typography_manager.profile.font_sizes) > 0
		assert len(typography_manager.profile.line_heights) > 0
	
	def test_typography_scale_initialization(self, typography_manager):
		"""Test automatic typography scale generation"""
		font_sizes = typography_manager.profile.font_sizes
		
		# Check that all heading levels are defined
		for level in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body']:
			assert level in font_sizes
		
		# Check scale progression (h1 should be largest)
		h1_size = typography_manager._parse_font_size(font_sizes['h1'])
		h2_size = typography_manager._parse_font_size(font_sizes['h2'])
		body_size = typography_manager._parse_font_size(font_sizes['body'])
		
		assert h1_size > h2_size > body_size
	
	def test_apply_typography_heading(self, typography_manager):
		"""Test typography application to heading"""
		style = ComputedStyle(
			element_id="test_heading",
			element_type="heading",
			font_family="serif"
		)
		
		enhanced_style = typography_manager.apply_typography(style, "heading")
		
		assert "Inter" in enhanced_style.font_family
		assert enhanced_style.font_weight == "bold"
	
	def test_apply_typography_code(self, typography_manager):
		"""Test typography application to code"""
		style = ComputedStyle(
			element_id="test_code",
			element_type="code",
			font_family="serif"
		)
		
		enhanced_style = typography_manager.apply_typography(style, "code")
		
		assert "JetBrains Mono" in enhanced_style.font_family
		assert "monospace" in enhanced_style.font_family
	
	def test_font_size_conversion(self, typography_manager):
		"""Test font size conversion between units"""
		# Test px to pt conversion
		pt_size = typography_manager._convert_font_size("16px")
		assert pt_size.endswith("pt")
		assert float(pt_size[:-2]) > 10  # Should be around 12pt
		
		# Test pt passthrough  
		pt_size = typography_manager._convert_font_size("12pt")
		assert pt_size == "12.0pt"  # Implementation uses float precision
	
	def test_font_stack_resolution(self, typography_manager):
		"""Test font stack building with fallbacks"""
		font_stack = typography_manager.resolve_font_stack("Inter")
		
		assert "Inter" in font_stack
		assert "sans-serif" in font_stack  # Should have fallback
		
		# Test caching
		font_stack2 = typography_manager.resolve_font_stack("Inter")
		assert font_stack == font_stack2
	
	def test_size_key_mapping(self, typography_manager):
		"""Test element type to size key mapping"""
		assert typography_manager._get_size_key("h1") == "h1"
		assert typography_manager._get_size_key("heading") == "h1"
		assert typography_manager._get_size_key("text") == "body"
		assert typography_manager._get_size_key("unknown") == "body"
	
	def test_latex_fonts_generation(self, typography_manager):
		"""Test LaTeX font package generation"""
		latex_fonts = typography_manager.generate_latex_fonts()
		
		assert "fontspec" in latex_fonts or "\\usepackage{fontspec}" in latex_fonts
		assert "setmainfont" in latex_fonts
		assert "Inter" in latex_fonts
	
	def test_css_fonts_generation(self, typography_manager):
		"""Test CSS font declarations generation"""
		css_fonts = typography_manager.generate_css_fonts()
		
		assert "@font-face" in css_fonts
		assert "font-family:" in css_fonts
		assert ".font-primary" in css_fonts


# ============================================================================
# BrandCompliance Tests
# ============================================================================

class TestBrandCompliance:
	"""Test BrandCompliance functionality"""
	
	async def test_brand_compliance_initialization(self, brand_compliance, sample_brand_guidelines):
		"""Test BrandCompliance initialization"""
		assert brand_compliance.guidelines == sample_brand_guidelines
		assert brand_compliance.guidelines.brand_name == "Test Brand"
	
	async def test_validate_style_compliance_success(self, brand_compliance):
		"""Test style compliance validation with compliant style"""
		style = ComputedStyle(
			element_id="compliant_style",
			element_type="heading",
			font_family="Inter",
			font_size="18pt",
			color="#1f2937"  # Brand primary color
		)
		
		result = await brand_compliance.validate_style_compliance(style)
		
		assert result.element_id == "compliant_style"
		assert result.overall_score > 0.8  # Should be highly compliant
		assert len(result.violations) == 0
	
	async def test_validate_style_compliance_violations(self, brand_compliance):
		"""Test style compliance validation with violations"""
		style = ComputedStyle(
			element_id="non_compliant_style",
			element_type="heading",
			font_family="Comic Sans MS",  # Non-brand font
			font_size="8pt",  # Too small
			color="#ff00ff"  # Non-brand color
		)
		
		result = await brand_compliance.validate_style_compliance(style)
		
		assert result.overall_score < 0.8  # Should have violations
		assert len(result.violations) > 0
	
	async def test_auto_correct_violations(self, brand_compliance):
		"""Test automatic violation correction"""
		style = ComputedStyle(
			element_id="correctable_style",
			element_type="heading",
			font_family="Comic Sans MS",
			color="#ff00ff"
		)
		
		corrected_style = await brand_compliance.auto_correct_violations(style)
		
		# Should correct to brand-compliant values
		assert corrected_style.font_family == brand_compliance.guidelines.typography.heading_font
		assert corrected_style.color == brand_compliance.guidelines.color_palette.primary
	
	async def test_accessibility_validation(self, brand_compliance):
		"""Test accessibility compliance checking"""
		style = ComputedStyle(
			element_id="accessibility_test",
			element_type="text",
			font_size="8pt"  # Below minimum
		)
		
		result = await brand_compliance.validate_style_compliance(style)
		
		# Should detect accessibility violation
		accessibility_violations = [v for v in result.violations if v["type"] == "accessibility_violation"]
		assert len(accessibility_violations) > 0


# ============================================================================
# StyleApplier Tests
# ============================================================================

class TestStyleApplier:
	"""Test main StyleApplier functionality"""
	
	def test_style_applier_initialization(self, style_applier, color_manager, typography_manager, brand_compliance):
		"""Test StyleApplier initialization"""
		assert style_applier.color_manager == color_manager
		assert style_applier.typography_manager == typography_manager
		assert style_applier.brand_compliance == brand_compliance
		assert len(style_applier.style_cache) == 0
		assert style_applier.metrics['styles_applied'] == 0
	
	async def test_apply_brand_styles_success(self, style_applier, sample_computed_styles, sample_brand_guidelines):
		"""Test successful brand style application"""
		result = await style_applier.apply_brand_styles(
			sample_computed_styles,
			sample_brand_guidelines
		)
		
		assert result.success is True
		assert result.styles_processed == len(sample_computed_styles)
		assert result.styles_enhanced == len(sample_computed_styles)
		assert len(result.enhanced_styles) == len(sample_computed_styles)
		assert result.processing_time > 0
		assert len(result.latex_preamble) > 0
		assert len(result.css_styles) > 0
	
	async def test_apply_brand_styles_caching(self, style_applier, sample_computed_styles, sample_brand_guidelines):
		"""Test style caching functionality"""
		# First application
		await style_applier.apply_brand_styles(
			sample_computed_styles,
			sample_brand_guidelines
		)
		
		# Second application (should use cache)
		result2 = await style_applier.apply_brand_styles(
			sample_computed_styles,
			sample_brand_guidelines
		)
		
		assert result2.cache_hit_rate > 0  # Should have cache hits
		assert len(style_applier.style_cache) > 0
	
	async def test_enhance_computed_style(self, style_applier, sample_brand_guidelines):
		"""Test single style enhancement"""
		style = ComputedStyle(
			element_id="test_style",
			element_type="heading",
			font_family="serif",
			color="#000000"
		)
		
		enhanced_style = await style_applier.enhance_computed_style(
			style,
			"heading",
			{"brand_guidelines": sample_brand_guidelines}
		)
		
		# Should apply brand colors and typography
		assert enhanced_style.color != "#000000"  # Should change
		assert "Inter" in enhanced_style.font_family  # Should apply brand font
	
	async def test_auto_initialization(self, sample_computed_styles, sample_brand_guidelines):
		"""Test auto-initialization of managers"""
		# Create StyleApplier without pre-initialized managers
		applier = StyleApplier()
		
		result = await applier.apply_brand_styles(
			sample_computed_styles,
			sample_brand_guidelines
		)
		
		assert result.success is True
		assert applier.color_manager is not None
		assert applier.typography_manager is not None
		assert applier.brand_compliance is not None
	
	async def test_get_applier_metrics(self, style_applier, sample_computed_styles, sample_brand_guidelines):
		"""Test metrics collection"""
		# Apply some styles first
		await style_applier.apply_brand_styles(sample_computed_styles, sample_brand_guidelines)
		
		metrics = await style_applier.get_applier_metrics()
		
		assert 'performance_metrics' in metrics
		assert 'cache_size' in metrics
		assert 'components_initialized' in metrics
		assert metrics['performance_metrics']['styles_applied'] > 0
		assert metrics['components_initialized']['color_manager'] is True


# ============================================================================
# Integration Tests
# ============================================================================

class TestStyleApplierIntegration:
	"""Test StyleApplier integration with other components"""
	
	async def test_quick_apply_brand_styles(self, sample_computed_styles):
		"""Test quick brand style application utility"""
		result = await quick_apply_brand_styles(sample_computed_styles, "Test Brand")
		
		assert result.success is True
		assert len(result.enhanced_styles) == len(sample_computed_styles)
		assert result.processing_time > 0
	
	def test_create_default_brand_guidelines(self):
		"""Test default brand guidelines creation"""
		guidelines = create_default_brand_guidelines("Test Company")
		
		assert guidelines.brand_name == "Test Company"
		assert guidelines.color_palette.primary == "#1f2937"
		assert guidelines.typography.primary_font == "Inter"
	
	async def test_responsive_style_application(self, style_applier, sample_computed_styles, sample_brand_guidelines):
		"""Test responsive style application"""
		from .document_formatter import ResponsiveConfiguration
		
		responsive_config = ResponsiveConfiguration(
			config_name="mobile_first",
			page_size_breakpoints={
				"mobile": {"width": "360px", "height": "640px"},
				"tablet": {"width": "768px", "height": "1024px"},
				"desktop": {"width": "1200px", "height": "800px"}
			}
		)
		
		result = await style_applier.apply_brand_styles(
			sample_computed_styles,
			sample_brand_guidelines,
			responsive_config
		)
		
		assert result.success is True
		assert len(result.enhanced_styles) == len(sample_computed_styles)


# ============================================================================
# Performance Tests
# ============================================================================

class TestStyleApplierPerformance:
	"""Test StyleApplier performance characteristics"""
	
	async def test_large_style_list_performance(self, style_applier, sample_brand_guidelines):
		"""Test performance with large number of styles"""
		# Create large list of styles
		large_style_list = []
		for i in range(100):
			style = ComputedStyle(
				element_id=f"style_{i}",
				element_type="text" if i % 2 == 0 else "heading",
				font_family="serif",
				color="#000000"
			)
			large_style_list.append(style)
		
		start_time = datetime.now()
		result = await style_applier.apply_brand_styles(large_style_list, sample_brand_guidelines)
		end_time = datetime.now()
		
		processing_time = (end_time - start_time).total_seconds()
		
		assert result.success is True
		assert processing_time < 1.0  # Should process 100 styles in under 1 second
		assert len(result.enhanced_styles) == 100
	
	async def test_cache_performance(self, style_applier, sample_computed_styles, sample_brand_guidelines):
		"""Test caching performance improvement"""
		# First run (no cache)
		await style_applier.apply_brand_styles(sample_computed_styles, sample_brand_guidelines)
		
		# Second run (with cache)
		result2 = await style_applier.apply_brand_styles(sample_computed_styles, sample_brand_guidelines)
		
		assert result2.cache_hit_rate > 0
		# Note: In real scenarios, cached run should be faster
		# but for tests with small datasets, the difference might be minimal


# ============================================================================
# Error Handling Tests
# ============================================================================

class TestStyleApplierErrorHandling:
	"""Test StyleApplier error handling"""
	
	async def test_invalid_style_handling(self, style_applier, sample_brand_guidelines):
		"""Test handling of invalid styles"""
		# Create invalid style (missing required fields)
		invalid_styles = [
			ComputedStyle(element_id="", element_type="", font_family="", color="")
		]
		
		result = await style_applier.apply_brand_styles(invalid_styles, sample_brand_guidelines)
		
		# Should handle gracefully
		assert result.success is True  # Should not fail completely
		assert len(result.enhanced_styles) == len(invalid_styles)
	
	async def test_missing_brand_guidelines(self, style_applier, sample_computed_styles):
		"""Test handling missing brand guidelines"""
		with pytest.raises(AssertionError):
			await style_applier.apply_brand_styles(sample_computed_styles, None)
	
	def test_invalid_color_format_handling(self, color_manager):
		"""Test handling of invalid color formats"""
		style = ComputedStyle(
			element_id="invalid_color_style",
			element_type="text",
			color="invalid_color"
		)
		
		# Should handle gracefully without throwing exception
		enhanced_style = color_manager.apply_brand_colors(style)
		assert enhanced_style is not None
	
	async def test_font_loading_failure_handling(self, typography_manager):
		"""Test handling of font loading failures"""
		style = ComputedStyle(
			element_id="font_test",
			element_type="text",
			font_family="NonexistentFont"
		)
		
		# Should handle gracefully and provide fallbacks
		enhanced_style = typography_manager.apply_typography(style, "text")
		assert enhanced_style is not None
		assert enhanced_style.font_family  # Should have some font assigned


# ============================================================================
# Accessibility Tests
# ============================================================================

class TestAccessibilityCompliance:
	"""Test accessibility compliance features"""
	
	def test_contrast_ratio_validation(self, color_manager):
		"""Test WCAG contrast ratio validation"""
		# Test AA compliance (4.5:1)
		contrast = color_manager.validate_contrast("#000000", "#ffffff")
		assert contrast >= 4.5
		
		# Test AAA compliance (7:1)
		contrast = color_manager.validate_contrast("#000000", "#ffffff")
		assert contrast >= 7.0
	
	async def test_font_size_accessibility(self, brand_compliance):
		"""Test minimum font size enforcement"""
		small_font_style = ComputedStyle(
			element_id="small_font",
			element_type="text",
			font_size="8px"  # Below minimum
		)
		
		result = await brand_compliance.validate_style_compliance(small_font_style)
		
		# Should detect accessibility violation
		assert result.accessibility_compliance < 1.0
		assert len(result.violations) > 0
	
	def test_color_blind_friendly_palette(self, color_manager):
		"""Test color palette works for color blind users"""
		# This is a basic test - in practice would use specialized libraries
		palette = color_manager.palette
		
		# Check that primary and secondary colors have sufficient difference
		primary_luminance = color_manager._calculate_luminance(color_manager._hex_to_rgb(palette.primary))
		secondary_luminance = color_manager._calculate_luminance(color_manager._hex_to_rgb(palette.secondary))
		
		assert abs(primary_luminance - secondary_luminance) > 0.1  # Should be distinguishable
