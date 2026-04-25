#!/usr/bin/env python3
"""
RFP Response Packager

Packages a complete RFP response including:
- Cover letter / transmittal
- Compliance matrix
- Main technical proposal
- Cost proposal
- Appendices (resumes, past performance, certifications)
- Forms (SF-33, representations, etc.)
"""

from dataclasses import dataclass, field
from typing import Any

from .document_packager import DocumentPackager, PackagingConfiguration, PackagingResult


@dataclass
class RFPResponsePackage:
	"""Configuration for an RFP response package"""
	cover_letter: bytes = b""
	compliance_matrix: bytes = b""
	main_proposal: bytes = b""
	cost_proposal: bytes = b""
	appendices: list[dict[str, Any]] = field(default_factory=list)
	forms: list[dict[str, Any]] = field(default_factory=list)


class RFPPackager(DocumentPackager):
	"""Package complete RFP responses into a single deliverable"""

	async def package_rfp_response(
		self,
		package: RFPResponsePackage,
		format: str = "pdf",
		title: str = "RFP Response",
	) -> PackagingResult:
		"""Package a complete RFP response"""
		result = PackagingResult(format=format)

		if format.lower() == "pdf":
			result.file_name = f"{title}.pdf"
			result.success = True
			
			# Try to merge all PDF components using pypdf
			components = [
				package.cover_letter,
				package.compliance_matrix,
				package.main_proposal,
				package.cost_proposal,
			]
			for app in package.appendices:
				components.append(app.get("data", b""))
			for form in package.forms:
				components.append(form.get("data", b""))
			
			pdf_components = [c for c in components if isinstance(c, bytes) and len(c) > 0]
			
			if len(pdf_components) > 1 and self.config.merge_pdfs:
				try:
					import io
					from pypdf import PdfWriter
					writer = PdfWriter()
					for pdf_bytes in pdf_components:
						writer.merge(position=None, fileobj=io.BytesIO(pdf_bytes))
					output = io.BytesIO()
					writer.write(output)
					result.packaged_bytes = output.getvalue()
				except Exception as e:
					result.packaged_bytes = package.main_proposal
					result.warnings.append(f"PDF merge merge failed: {e}. Returning main proposal only.")
			else:
				result.packaged_bytes = package.main_proposal or (pdf_components[0] if pdf_components else b"")
				if len(pdf_components) > 1:
					result.warnings.append(
						"PDF RFP response components not merged: set merge_pdfs=True in PackagingConfiguration"
					)

		elif format.lower() in ("docx", "html"):
			import io
			import zipfile

			buffer = io.BytesIO()
			with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
				if package.cover_letter:
					zf.writestr("01_cover_letter.pdf", package.cover_letter)
				if package.compliance_matrix:
					zf.writestr("02_compliance_matrix.pdf", package.compliance_matrix)
				if package.main_proposal:
					zf.writestr("03_main_proposal.pdf", package.main_proposal)
				if package.cost_proposal:
					zf.writestr("04_cost_proposal.pdf", package.cost_proposal)
				for i, app in enumerate(package.appendices, 1):
					name = app.get("filename", f"appendix_{i}.pdf")
					data = app.get("data", b"")
					if isinstance(data, str):
						data = data.encode("utf-8")
					zf.writestr(f"05_appendices/{name}", data)
				for i, form in enumerate(package.forms, 1):
					name = form.get("filename", f"form_{i}.pdf")
					data = form.get("data", b"")
					if isinstance(data, str):
						data = data.encode("utf-8")
					zf.writestr(f"06_forms/{name}", data)
			result.packaged_bytes = buffer.getvalue()
			result.file_name = f"{title}.zip"
			result.success = True

		else:
			result.warnings.append(f"Unsupported RFP packaging format: {format}")
			result.packaged_bytes = package.main_proposal
			result.file_name = f"{title}.{format}"

		return result
