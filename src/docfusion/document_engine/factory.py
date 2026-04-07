"""
Factory for creating DocumentEngine instances with default or custom components.

This module isolates all concrete-class imports behind a single entry point,
keeping the DocumentEngine orchestration layer free of hard-coded dependencies.
Callers that want the "batteries-included" experience call
``create_default_engine()``. Callers that need to swap one component (e.g. for
testing or a different PDF backend) pass an override::

	engine = create_default_engine(pdf_renderer=my_custom_renderer)

All overrides are validated against the corresponding Protocol at construction
time so wiring errors surface immediately rather than at first use.
"""

from __future__ import annotations

import logging
from typing import Any

from docfusion.document_engine.protocols import (
	AccessibilityRendererProtocol,
	BrandFormatterProtocol,
	ContentAssemblerProtocol,
	CrossReferenceManagerProtocol,
	DOCXRendererProtocol,
	DocumentFormatterProtocol,
	HTMLRendererProtocol,
	LayoutManagerProtocol,
	PDFRendererProtocol,
	StorageServiceProtocol,
	StructureBuilderProtocol,
	StyleApplierProtocol,
)

logger = logging.getLogger(__name__)


def _build_default_components() -> dict[str, Any]:
	"""Lazily import and instantiate every concrete component.

	All heavy imports live here so that the rest of the package can be
	imported without pulling in every transitive dependency.
	"""
	from docfusion.document_engine.assembler.content_assembler import ContentAssembler
	from docfusion.document_engine.assembler.cross_reference_manager import CrossReferenceManager
	from docfusion.document_engine.assembler.structure_builder import StructureBuilder
	from docfusion.document_engine.formatter.brand_formatter import (
		BrandFormatter,
		BrandSpecification,
		LogoAsset,
		LogoAssetLibrary,
	)
	from docfusion.document_engine.formatter.document_formatter import DocumentFormatter
	from docfusion.document_engine.formatter.layout_manager import LayoutManager
	from docfusion.document_engine.formatter.style_applier import StyleApplier
	from docfusion.document_engine.renderer.accessibility_renderer import AccessibilityRenderer
	from docfusion.document_engine.renderer.docx_renderer import DOCXRenderer
	from docfusion.document_engine.renderer.html_renderer import HTMLRenderer
	from docfusion.document_engine.renderer.pdf_renderer import PDFRenderer

	# Build a default BrandFormatter with minimal brand specification
	default_logo = LogoAsset(asset_name="Default Logo", variant_type="primary")
	default_logo_library = LogoAssetLibrary(primary_logo=default_logo)
	default_brand_spec = BrandSpecification(
		brand_name="Default Brand",
		logo_assets=default_logo_library,
	)

	return {
		"content_assembler": ContentAssembler(),
		"structure_builder": StructureBuilder(),
		"cross_reference_manager": CrossReferenceManager(),
		"document_formatter": DocumentFormatter(),
		"brand_formatter": BrandFormatter(default_brand_spec),
		"layout_manager": LayoutManager(),
		"style_applier": StyleApplier(),
		"pdf_renderer": PDFRenderer(),
		"docx_renderer": DOCXRenderer(),
		"html_renderer": HTMLRenderer(),
		"accessibility_renderer": AccessibilityRenderer(),
	}


# Mapping from kwarg name to the Protocol it must satisfy.
_PROTOCOL_MAP: dict[str, type] = {
	"content_assembler": ContentAssemblerProtocol,
	"structure_builder": StructureBuilderProtocol,
	"cross_reference_manager": CrossReferenceManagerProtocol,
	"document_formatter": DocumentFormatterProtocol,
	"brand_formatter": BrandFormatterProtocol,
	"layout_manager": LayoutManagerProtocol,
	"style_applier": StyleApplierProtocol,
	"pdf_renderer": PDFRendererProtocol,
	"docx_renderer": DOCXRendererProtocol,
	"html_renderer": HTMLRendererProtocol,
	"accessibility_renderer": AccessibilityRendererProtocol,
	"storage_service": StorageServiceProtocol,
}


def _validate_overrides(overrides: dict[str, Any]) -> None:
	"""Validate that every override satisfies its corresponding Protocol.

	Raises ``TypeError`` immediately if a supplied component does not
	structurally conform to the expected interface. This prevents subtle
	``AttributeError`` crashes deep inside a generation pipeline.
	"""
	for key, value in overrides.items():
		if value is None:
			continue
		expected_protocol = _PROTOCOL_MAP.get(key)
		if expected_protocol is None:
			raise TypeError(
				f"Unknown component override '{key}'. "
				f"Valid keys: {sorted(_PROTOCOL_MAP)}"
			)
		# Runtime-checkable protocols use isinstance
		if not isinstance(value, expected_protocol):
			raise TypeError(
				f"Component '{key}' does not satisfy {expected_protocol.__name__}. "
				f"Got {type(value).__name__}."
			)


def create_default_engine(
	*,
	config: Any | None = None,
	enable_logging: bool = True,
	enable_caching: bool = True,
	storage_service: Any | None = None,
	content_assembler: Any | None = None,
	structure_builder: Any | None = None,
	cross_reference_manager: Any | None = None,
	document_formatter: Any | None = None,
	brand_formatter: Any | None = None,
	layout_manager: Any | None = None,
	style_applier: Any | None = None,
	pdf_renderer: Any | None = None,
	docx_renderer: Any | None = None,
	html_renderer: Any | None = None,
	accessibility_renderer: Any | None = None,
) -> Any:
	"""Create a DocumentEngine with sensible defaults and optional overrides.

	Any keyword argument that is ``None`` (or omitted) uses the standard
	concrete implementation. Supplied values are validated against their
	Protocol before being wired in.

	Args:
		config: Optional ``DocumentGenerationConfiguration``.
		enable_logging: Enable structured logging (default ``True``).
		enable_caching: Enable result caching (default ``True``).
		storage_service: Override for document storage backend.
		content_assembler: Override for content assembly.
		structure_builder: Override for structure building.
		cross_reference_manager: Override for cross-reference management.
		document_formatter: Override for document formatting.
		brand_formatter: Override for brand-compliance formatting.
		layout_manager: Override for page layout.
		style_applier: Override for style application.
		pdf_renderer: Override for PDF rendering.
		docx_renderer: Override for DOCX rendering.
		html_renderer: Override for HTML rendering.
		accessibility_renderer: Override for accessibility rendering.

	Returns:
		Fully wired ``DocumentEngine`` instance.

	Raises:
		TypeError: If an override does not satisfy its Protocol.
	"""
	from docfusion.document_engine.document_engine import DocumentEngine

	# Collect all component overrides
	component_overrides = {
		k: v
		for k, v in {
			"content_assembler": content_assembler,
			"structure_builder": structure_builder,
			"cross_reference_manager": cross_reference_manager,
			"document_formatter": document_formatter,
			"brand_formatter": brand_formatter,
			"layout_manager": layout_manager,
			"style_applier": style_applier,
			"pdf_renderer": pdf_renderer,
			"docx_renderer": docx_renderer,
			"html_renderer": html_renderer,
			"accessibility_renderer": accessibility_renderer,
			"storage_service": storage_service,
		}.items()
		if v is not None
	}

	# Validate every override against its protocol
	_validate_overrides(component_overrides)

	# Remove storage_service from component overrides -- it goes to the
	# constructor directly, not through the components dict.
	ss = component_overrides.pop("storage_service", None)

	return DocumentEngine(
		config=config,
		enable_logging=enable_logging,
		enable_caching=enable_caching,
		storage_service=ss or storage_service,
		components=component_overrides or None,
	)
