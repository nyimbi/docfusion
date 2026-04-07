"""
DocuFusion Document Engine Package

Core document composition and generation system.
Handles multimodal content creation, template processing,
and intelligent document assembly.
"""

__version__ = "0.1.0"
__author__ = "DocuFusion Team"

from .factory import create_default_engine
from .protocols import (
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

__all__ = [
	# Factory
	"create_default_engine",
	# Protocols
	"AccessibilityRendererProtocol",
	"BrandFormatterProtocol",
	"ContentAssemblerProtocol",
	"CrossReferenceManagerProtocol",
	"DOCXRendererProtocol",
	"DocumentFormatterProtocol",
	"HTMLRendererProtocol",
	"LayoutManagerProtocol",
	"PDFRendererProtocol",
	"StorageServiceProtocol",
	"StructureBuilderProtocol",
	"StyleApplierProtocol",
]
