"""
Document Engine Formatter Package

This package provides professional document formatting capabilities including:
- CSS-like styling rules and computation
- Advanced typography processing
- Responsive layout adaptation  
- Multi-format output generation (LaTeX, HTML, PDF)

Main Classes:
- DocumentFormatter: Primary formatting engine
- StyleParser: CSS-like rule parsing
- StyleComputer: Style cascade resolution
- TypographyEngine: Typography optimization
- ResponsiveEngine: Responsive layout adaptation
- OutputGenerator: Multi-format output generation

Example Usage:
    from document_engine.formatter import DocumentFormatter
    
    formatter = DocumentFormatter()
    result = await formatter.format_document(
        document_id="my_doc",
        content_elements=[...],
        output_formats=["latex", "html"]
    )
"""

from .document_formatter import (
	DocumentFormatter,
	StyleRule,
	ComputedStyle,
	TypographyProfile,
	ResponsiveConfiguration,
	FormattingResult,
	StyleParser,
	StyleComputer,
	TypographyEngine,
	ResponsiveEngine,
	OutputGenerator,
	DocumentFormatterException,
	StyleParsingException,
	StyleComputationException,
	TypographyException,
	OutputGenerationException,
	create_document_formatter,
	quick_format_text,
	validate_formatter_installation
)

from .style_applier import (
	StyleApplier,
	ColorManager,
	TypographyManager,
	BrandCompliance,
	ColorPalette,
	BrandGuidelines,
	BrandStyleRule,
	StyleApplicationResult,
	ComplianceResult,
	create_default_brand_guidelines,
	quick_apply_brand_styles,
	ColorManagementException,
	BrandComplianceException
)

from .layout_manager import (
	LayoutManager,
	PageManager,
	ColumnEngine,
	ContentPositioner,
	PageConfiguration,
	PageMargins,
	ColumnLayout,
	ContentPositioning,
	HeaderFooterConfig,
	LayoutConstraint,
	LayoutSpecification,
	PageGeometry,
	ColumnLayoutResult,
	PositioningResult,
	LayoutResult,
	LayoutManagerMetrics,
	create_default_layout_manager,
	create_responsive_layout_specification,
	quick_layout_computation,
	validate_layout_manager_installation,
	LayoutManagerException,
	PageConfigurationException,
	ColumnLayoutException,
	ContentPositioningException,
	LayoutValidationException
)

__all__ = [
	# DocumentFormatter exports
	'DocumentFormatter',
	'StyleRule',
	'ComputedStyle', 
	'TypographyProfile',
	'ResponsiveConfiguration',
	'FormattingResult',
	'StyleParser',
	'StyleComputer',
	'TypographyEngine',
	'ResponsiveEngine',
	'OutputGenerator',
	'DocumentFormatterException',
	'StyleParsingException',
	'StyleComputationException',
	'TypographyException', 
	'OutputGenerationException',
	'create_document_formatter',
	'quick_format_text',
	'validate_formatter_installation',
	
	# StyleApplier exports
	'StyleApplier',
	'ColorManager',
	'TypographyManager', 
	'BrandCompliance',
	'ColorPalette',
	'BrandGuidelines',
	'BrandStyleRule',
	'StyleApplicationResult',
	'ComplianceResult',
	'create_default_brand_guidelines',
	'quick_apply_brand_styles',
	'ColorManagementException',
	'BrandComplianceException',
	
	# LayoutManager exports
	'LayoutManager',
	'PageManager',
	'ColumnEngine',
	'ContentPositioner',
	'PageConfiguration',
	'PageMargins',
	'ColumnLayout',
	'ContentPositioning',
	'HeaderFooterConfig',
	'LayoutConstraint',
	'LayoutSpecification',
	'PageGeometry',
	'ColumnLayoutResult',
	'PositioningResult',
	'LayoutResult',
	'LayoutManagerMetrics',
	'create_default_layout_manager',
	'create_responsive_layout_specification',
	'quick_layout_computation',
	'validate_layout_manager_installation',
	'LayoutManagerException',
	'PageConfigurationException',
	'ColumnLayoutException',
	'ContentPositioningException',
	'LayoutValidationException'
]