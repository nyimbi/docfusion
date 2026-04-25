#!/usr/bin/env python3
"""
Document Packager

Packages a main document together with attachments, appendices, and related
files into a single downloadable deliverable.

Supports:
- PDF: returns main PDF (merged if merge library available in future)
- DOCX: ZIP containing main DOCX + attachments
- HTML: ZIP containing HTML + CSS + attachments
"""

import io
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ...core.utils import uuid7str


@dataclass
class PackagingConfiguration:
	"""Configuration for document packaging"""
	include_attachments: bool = True
	include_appendices: bool = True
	compress: bool = True
	merge_pdfs: bool = False  # future capability


@dataclass
class PackagingResult:
	"""Result of a packaging operation"""
	success: bool = False
	packaged_bytes: bytes = b""
	format: str = ""
	file_name: str = ""
	warnings: list[str] = field(default_factory=list)
	packaged_at: datetime = field(default_factory=datetime.now)


class DocumentPackager:
	"""Package documents with attachments and appendices"""

	def __init__(self, config: PackagingConfiguration | None = None):
		self.config = config or PackagingConfiguration()

	async def package_document(
		self,
		main_document_bytes: bytes,
		format: str,
		title: str = "document",
		attachments: list[dict[str, Any]] | None = None,
		appendices: list[dict[str, Any]] | None = None,
	) -> PackagingResult:
		"""Package a main document with optional attachments and appendices"""
		result = PackagingResult(format=format)
		attachments = attachments or []
		appendices = appendices or []

		if format.lower() == "pdf":
			result.file_name = f"{title}.pdf"
			result.success = True
			
			# Try to merge appendices using pypdf
			if appendices and self.config.merge_pdfs:
				try:
					from pypdf import PdfWriter
					writer = PdfWriter()
					writer.merge(position=None, fileobj=io.BytesIO(main_document_bytes))
					for app in appendices:
						data = app.get("data", b"")
						if isinstance(data, str):
							data = data.encode("utf-8")
						if data:
							writer.merge(position=None, fileobj=io.BytesIO(data))
					output = io.BytesIO()
					writer.write(output)
					result.packaged_bytes = output.getvalue()
				except Exception as e:
					result.packaged_bytes = main_document_bytes
					result.warnings.append(f"PDF merge failed: {e}. Returning main PDF only.")
			else:
				result.packaged_bytes = main_document_bytes
				if appendices:
					result.warnings.append(
						"PDF appendices not merged: set merge_pdfs=True in PackagingConfiguration"
					)

		elif format.lower() == "docx":
			# DOCX packaging: ZIP with main doc + attachments
			buffer = io.BytesIO()
			with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
				zf.writestr(f"{title}.docx", main_document_bytes)
				for i, att in enumerate(attachments, 1):
					name = att.get("filename", f"attachment_{i}")
					data = att.get("data", b"")
					if isinstance(data, str):
						data = data.encode("utf-8")
					zf.writestr(f"attachments/{name}", data)
				for i, app in enumerate(appendices, 1):
					name = app.get("filename", f"appendix_{i}.pdf")
					data = app.get("data", b"")
					if isinstance(data, str):
						data = data.encode("utf-8")
					zf.writestr(f"appendices/{name}", data)
			result.packaged_bytes = buffer.getvalue()
			result.file_name = f"{title}.zip"
			result.success = True

		elif format.lower() == "html":
			# HTML packaging: ZIP with HTML + assets
			buffer = io.BytesIO()
			with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
				zf.writestr(f"{title}.html", main_document_bytes)
				for i, att in enumerate(attachments, 1):
					name = att.get("filename", f"attachment_{i}")
					data = att.get("data", b"")
					if isinstance(data, str):
						data = data.encode("utf-8")
					zf.writestr(f"assets/{name}", data)
			result.packaged_bytes = buffer.getvalue()
			result.file_name = f"{title}.zip"
			result.success = True

		else:
			result.warnings.append(f"Unsupported packaging format: {format}")
			result.packaged_bytes = main_document_bytes
			result.file_name = f"{title}.{format}"

		return result
