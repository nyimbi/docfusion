"""
Protocol interfaces for the DocumentEngine's pluggable components.

These protocols define the structural contracts that each component category
must satisfy. They enable dependency injection, test isolation, and
runtime swapping of implementations without modifying the orchestration layer.

All protocols are runtime-checkable, so ``isinstance(obj, SomeProtocol)``
works at runtime for defensive validation inside factory code.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


# ============================================================================
# Assembly Protocols
# ============================================================================

@runtime_checkable
class ContentAssemblerProtocol(Protocol):
	"""Structural contract for content assembly components.

	A content assembler takes raw content sources and assembles them into
	a cohesive document structure. Implementations must support the
	``assemble_content`` coroutine used by the DocumentEngine orchestration
	phase, and ``get_assembly_metrics`` for observability.
	"""

	async def assemble_content(
		self,
		content_sources: list[dict[str, Any]],
		document_type: str,
		user_id: str,
		organization_id: str,
	) -> Any:
		"""Assemble content sources into a unified document structure."""
		...

	async def get_assembly_metrics(self) -> dict[str, Any]:
		"""Return assembly performance and quality metrics."""
		...


@runtime_checkable
class StructureBuilderProtocol(Protocol):
	"""Structural contract for document structure building."""

	async def build_structure(
		self,
		template: Any,
		content_blocks: list[Any],
		document_id: str,
		variables: dict[str, Any] | None = None,
	) -> Any:
		"""Build hierarchical document structure from template and blocks."""
		...


@runtime_checkable
class CrossReferenceManagerProtocol(Protocol):
	"""Structural contract for cross-reference detection and resolution."""

	# The DocumentEngine currently does not call any methods directly on
	# CrossReferenceManager in its phase implementations (it returns mock
	# dicts). The protocol exposes the manager's public surface so that
	# future phases can integrate properly.
	pass


# ============================================================================
# Formatting Protocols
# ============================================================================

@runtime_checkable
class DocumentFormatterProtocol(Protocol):
	"""Structural contract for document formatting engines."""

	async def format_document(
		self,
		document_id: str,
		content_elements: list[Any],
		output_formats: list[str] | None = None,
	) -> Any:
		"""Apply formatting rules and produce formatted output."""
		...


@runtime_checkable
class BrandFormatterProtocol(Protocol):
	"""Structural contract for brand-compliance formatting."""

	async def get_brand_formatter_metrics(self) -> Any:
		"""Return brand formatting metrics."""
		...


@runtime_checkable
class LayoutManagerProtocol(Protocol):
	"""Structural contract for page layout computation."""

	async def get_layout_metrics(self) -> Any:
		"""Return layout computation metrics."""
		...


@runtime_checkable
class StyleApplierProtocol(Protocol):
	"""Structural contract for style application."""

	async def get_applier_metrics(self) -> dict[str, Any]:
		"""Return style-applier performance metrics."""
		...


# ============================================================================
# Rendering Protocols
# ============================================================================

@runtime_checkable
class PDFRendererProtocol(Protocol):
	"""Structural contract for PDF rendering."""

	async def get_pdf_renderer_metrics(self) -> dict[str, Any]:
		"""Return PDF renderer performance metrics."""
		...


@runtime_checkable
class DOCXRendererProtocol(Protocol):
	"""Structural contract for DOCX rendering."""

	async def get_docx_renderer_metrics(self) -> dict[str, Any]:
		"""Return DOCX renderer performance metrics."""
		...


@runtime_checkable
class HTMLRendererProtocol(Protocol):
	"""Structural contract for HTML rendering."""

	async def get_html_renderer_metrics(self) -> dict[str, Any]:
		"""Return HTML renderer performance metrics."""
		...


@runtime_checkable
class AccessibilityRendererProtocol(Protocol):
	"""Structural contract for accessibility-enhanced rendering."""

	async def render_accessibility_enhanced(
		self,
		source_document: Any,
		source_format: str,
		target_formats: list[str] | None = None,
		custom_config: Any | None = None,
	) -> Any:
		"""Enhance a document with accessibility features."""
		...

	async def get_accessibility_renderer_metrics(self) -> dict[str, Any]:
		"""Return accessibility renderer performance metrics."""
		...


# ============================================================================
# Storage Protocol
# ============================================================================

@runtime_checkable
class StorageServiceProtocol(Protocol):
	"""Structural contract for document storage backends.

	The DocumentEngine delegates persistence, search, and content
	recommendation operations to a storage service. Any object satisfying
	this protocol can be injected in place of the concrete StorageService.
	"""

	_initialized: bool

	async def initialize(self) -> None:
		"""Initialize storage backend resources."""
		...

	async def store_document(
		self,
		content: str,
		title: str,
		document_id: str,
		content_type: str,
		category: str,
		tags: list[str],
		author: str,
		metadata: dict[str, Any],
	) -> str:
		"""Persist a document, return its storage identifier."""
		...

	async def search_documents(
		self,
		query: str,
		search_type: str,
		filters: dict[str, Any] | None,
		limit: int,
		include_highlights: bool,
	) -> list[dict[str, Any]]:
		"""Full-text / semantic search over stored documents."""
		...

	async def retrieve_document(
		self,
		document_id: str,
		include_metadata: bool,
	) -> dict[str, Any] | None:
		"""Retrieve a single document by its identifier."""
		...

	async def get_content_recommendations(
		self,
		context: str,
		content_type: str,
		category: str | None = None,
		limit: int = 10,
	) -> list[Any]:
		"""Return content recommendations for the given context."""
		...

	async def add_content_block(
		self,
		content: str,
		title: str,
		block_type: str,
		category: str,
		tags: list[str],
		author: str,
		metadata: dict[str, Any],
	) -> str:
		"""Add a reusable content block to storage."""
		...

	async def add_template(
		self,
		name: str,
		description: str,
		template_type: str,
		category: str,
		content_blocks: list[str],
		variables: dict[str, Any],
		tags: list[str],
		author: str,
	) -> str:
		"""Register a document template."""
		...

	async def list_documents(
		self,
		category: str | None,
		content_type: str | None,
		tags: list[str] | None,
		limit: int,
		offset: int,
	) -> list[dict[str, Any]]:
		"""List documents with optional filtering."""
		...

	async def get_storage_statistics(self) -> Any:
		"""Return aggregate storage statistics."""
		...

	async def optimize_storage(self) -> dict[str, Any]:
		"""Run storage optimisation routines."""
		...
