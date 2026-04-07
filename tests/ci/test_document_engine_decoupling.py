#!/usr/bin/env python3
"""
Tests for DocumentEngine dependency injection and protocol decoupling.

Validates that:
- The constructor accepts injected components via the ``components`` kwarg.
- Injected components are used in place of concrete defaults.
- Backward compatibility is preserved (no-arg construction still works).
- The factory function wires components correctly and validates protocols.
- Protocol runtime-checking rejects non-conforming objects.
"""

import asyncio
from typing import Any
from dataclasses import dataclass

import pytest

from docfusion.document_engine.document_engine import (
	DocumentEngine,
	DocumentGenerationConfiguration,
	DocumentGenerationRequest,
	IntegrationException,
)
from docfusion.document_engine.protocols import (
	ContentAssemblerProtocol,
	StructureBuilderProtocol,
	CrossReferenceManagerProtocol,
	DocumentFormatterProtocol,
	BrandFormatterProtocol,
	LayoutManagerProtocol,
	StyleApplierProtocol,
	PDFRendererProtocol,
	DOCXRendererProtocol,
	HTMLRendererProtocol,
	AccessibilityRendererProtocol,
)
from docfusion.document_engine.factory import create_default_engine, _validate_overrides


# ============================================================================
# Stub implementations satisfying protocols
# ============================================================================

class StubContentAssembler:
	"""Minimal stub satisfying ContentAssemblerProtocol."""

	def __init__(self):
		self.called = False

	async def assemble_content(
		self,
		content_sources: list[dict[str, Any]],
		document_type: str,
		user_id: str,
		organization_id: str,
	) -> Any:
		self.called = True

		@dataclass
		class _Result:
			assembly_successful: bool = True
			total_blocks_processed: int = 0
			performance_score: float = 0.95
			quality_score: float = 0.95
			assembly_duration: float = 0.01
			dependency_resolution_count: int = 0

		return _Result(total_blocks_processed=len(content_sources))

	async def get_assembly_metrics(self) -> dict[str, Any]:
		return {"stub": True}


class StubAccessibilityRenderer:
	"""Minimal stub satisfying AccessibilityRendererProtocol."""

	async def render_accessibility_enhanced(
		self,
		source_document: Any,
		source_format: str,
		target_formats: list[str] | None = None,
		custom_config: Any | None = None,
	) -> Any:
		@dataclass
		class _Result:
			render_successful: bool = True
			overall_accessibility_score: float = 1.0

		return _Result()

	async def get_accessibility_renderer_metrics(self) -> dict[str, Any]:
		return {"stub": True}


class StubPDFRenderer:
	"""Minimal stub satisfying PDFRendererProtocol."""

	async def get_pdf_renderer_metrics(self) -> dict[str, Any]:
		return {"stub": True}


class StubDOCXRenderer:
	"""Minimal stub satisfying DOCXRendererProtocol."""

	async def get_docx_renderer_metrics(self) -> dict[str, Any]:
		return {"stub": True}


class StubHTMLRenderer:
	"""Minimal stub satisfying HTMLRendererProtocol."""

	async def get_html_renderer_metrics(self) -> dict[str, Any]:
		return {"stub": True}


class StubBrandFormatter:
	"""Minimal stub satisfying BrandFormatterProtocol."""

	async def get_brand_formatter_metrics(self) -> Any:
		return {"stub": True}


class StubLayoutManager:
	"""Minimal stub satisfying LayoutManagerProtocol."""

	async def get_layout_metrics(self) -> Any:
		return {"stub": True}


class StubStyleApplier:
	"""Minimal stub satisfying StyleApplierProtocol."""

	async def get_applier_metrics(self) -> dict[str, Any]:
		return {"stub": True}


class StubDocumentFormatter:
	"""Minimal stub satisfying DocumentFormatterProtocol."""

	async def format_document(
		self,
		document_id: str,
		content_elements: list[Any],
		output_formats: list[str] | None = None,
	) -> Any:
		return {}


class StubStructureBuilder:
	"""Minimal stub satisfying StructureBuilderProtocol."""

	async def build_structure(
		self,
		template: Any,
		content_blocks: list[Any],
		document_id: str,
		variables: dict[str, Any] | None = None,
	) -> Any:
		return {}


# ============================================================================
# Protocol conformance tests
# ============================================================================

def test_stub_assembler_satisfies_protocol():
	assert isinstance(StubContentAssembler(), ContentAssemblerProtocol)


def test_stub_accessibility_renderer_satisfies_protocol():
	assert isinstance(StubAccessibilityRenderer(), AccessibilityRendererProtocol)


def test_stub_pdf_renderer_satisfies_protocol():
	assert isinstance(StubPDFRenderer(), PDFRendererProtocol)


def test_stub_brand_formatter_satisfies_protocol():
	assert isinstance(StubBrandFormatter(), BrandFormatterProtocol)


def test_stub_structure_builder_satisfies_protocol():
	assert isinstance(StubStructureBuilder(), StructureBuilderProtocol)


def test_plain_object_does_not_satisfy_protocol():
	assert not isinstance(object(), ContentAssemblerProtocol)
	assert not isinstance(object(), AccessibilityRendererProtocol)


# ============================================================================
# Constructor injection tests
# ============================================================================

def test_backward_compatible_construction():
	"""DocumentEngine() with no components kwarg still works."""
	config = DocumentGenerationConfiguration(enable_storage=False)
	engine = DocumentEngine(config=config, enable_logging=False)

	# Concrete defaults are wired
	assert engine.content_assembler is not None
	assert engine.pdf_renderer is not None
	assert engine.accessibility_renderer is not None


def test_inject_single_component():
	"""Injecting one component leaves the rest as defaults."""
	stub = StubContentAssembler()
	config = DocumentGenerationConfiguration(enable_storage=False)
	engine = DocumentEngine(
		config=config,
		enable_logging=False,
		components={"content_assembler": stub},
	)

	assert engine.content_assembler is stub
	# Other components remain concrete defaults
	assert engine.structure_builder is not None
	assert engine.structure_builder is not stub


def test_inject_all_components():
	"""All 11 component slots can be overridden simultaneously."""
	overrides = {
		"content_assembler": StubContentAssembler(),
		"structure_builder": StubStructureBuilder(),
		"cross_reference_manager": object(),  # CrossReferenceManagerProtocol is empty
		"document_formatter": StubDocumentFormatter(),
		"brand_formatter": StubBrandFormatter(),
		"layout_manager": StubLayoutManager(),
		"style_applier": StubStyleApplier(),
		"pdf_renderer": StubPDFRenderer(),
		"docx_renderer": StubDOCXRenderer(),
		"html_renderer": StubHTMLRenderer(),
		"accessibility_renderer": StubAccessibilityRenderer(),
	}
	config = DocumentGenerationConfiguration(enable_storage=False)
	engine = DocumentEngine(
		config=config,
		enable_logging=False,
		components=overrides,
	)

	assert engine.content_assembler is overrides["content_assembler"]
	assert engine.structure_builder is overrides["structure_builder"]
	assert engine.cross_reference_manager is overrides["cross_reference_manager"]
	assert engine.document_formatter is overrides["document_formatter"]
	assert engine.brand_formatter is overrides["brand_formatter"]
	assert engine.layout_manager is overrides["layout_manager"]
	assert engine.style_applier is overrides["style_applier"]
	assert engine.pdf_renderer is overrides["pdf_renderer"]
	assert engine.docx_renderer is overrides["docx_renderer"]
	assert engine.html_renderer is overrides["html_renderer"]
	assert engine.accessibility_renderer is overrides["accessibility_renderer"]


def test_injected_assembler_is_called_during_generation():
	"""Verify the injected content assembler is actually invoked in the pipeline."""
	stub = StubContentAssembler()
	config = DocumentGenerationConfiguration(
		enable_storage=False,
		output_formats=["pdf"],
	)
	engine = DocumentEngine(
		config=config,
		enable_logging=False,
		components={
			"content_assembler": stub,
			"accessibility_renderer": StubAccessibilityRenderer(),
		},
	)

	request = DocumentGenerationRequest(
		generation_config=config,
		content_sources=[{"content": "hello", "type": "text"}],
	)
	request.generation_config.document_title = "Injection Test"

	loop = asyncio.get_event_loop()
	result = loop.run_until_complete(engine.generate_document(request))

	assert result.generation_successful
	assert stub.called


# ============================================================================
# Factory validation tests
# ============================================================================

def test_factory_rejects_unknown_key():
	with pytest.raises(TypeError, match="Unknown component override 'bogus_thing'"):
		_validate_overrides({"bogus_thing": object()})


def test_factory_rejects_non_conforming_component():
	with pytest.raises(TypeError, match="does not satisfy"):
		_validate_overrides({"content_assembler": object()})


def test_factory_accepts_valid_overrides():
	_validate_overrides({
		"content_assembler": StubContentAssembler(),
		"pdf_renderer": StubPDFRenderer(),
	})


def test_factory_creates_engine_with_overrides():
	stub = StubContentAssembler()
	engine = create_default_engine(
		config=DocumentGenerationConfiguration(enable_storage=False),
		enable_logging=False,
		content_assembler=stub,
	)
	assert engine.content_assembler is stub


def test_factory_creates_engine_with_defaults():
	engine = create_default_engine(
		config=DocumentGenerationConfiguration(enable_storage=False),
		enable_logging=False,
	)
	assert engine.content_assembler is not None
	assert engine.pdf_renderer is not None
