#!/usr/bin/env python3
"""Tests for DocumentPackager and RFPPackager."""

import io
import zipfile

import pytest

from docfusion.document_engine.packager.document_packager import (
    DocumentPackager,
    PackagingConfiguration,
    PackagingResult,
)
from docfusion.document_engine.packager.rfp_packager import (
    RFPPackager,
    RFPResponsePackage,
)


def _minimal_pdf_bytes(title: str = "test") -> bytes:
    """Generate a minimal valid PDF for testing."""
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


class TestDocumentPackager:
    @pytest.fixture
    def packager(self):
        return DocumentPackager()

    @pytest.fixture
    def main_pdf(self):
        return _minimal_pdf_bytes("main")

    @pytest.fixture
    def appendix_pdf(self):
        return _minimal_pdf_bytes("appendix")

    @pytest.mark.asyncio
    async def test_package_pdf_without_appendices(self, packager, main_pdf):
        result = await packager.package_document(main_pdf, format="pdf", title="doc")
        assert result.success is True
        assert result.file_name == "doc.pdf"
        assert result.packaged_bytes == main_pdf
        assert not result.warnings

    @pytest.mark.asyncio
    async def test_package_pdf_with_appendices_no_merge(self, packager, main_pdf, appendix_pdf):
        appendices = [{"filename": "app1.pdf", "data": appendix_pdf}]
        result = await packager.package_document(
            main_pdf, format="pdf", title="doc", appendices=appendices
        )
        assert result.success is True
        assert result.packaged_bytes == main_pdf
        assert any("merge_pdfs=True" in w for w in result.warnings)

    @pytest.mark.asyncio
    async def test_package_pdf_with_merge(self, main_pdf, appendix_pdf):
        config = PackagingConfiguration(merge_pdfs=True)
        packager = DocumentPackager(config=config)
        appendices = [{"filename": "app1.pdf", "data": appendix_pdf}]
        result = await packager.package_document(
            main_pdf, format="pdf", title="doc", appendices=appendices
        )
        assert result.success is True
        assert len(result.packaged_bytes) > len(main_pdf)
        # Verify it's a valid merged PDF
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(result.packaged_bytes))
        assert len(reader.pages) == 2

    @pytest.mark.asyncio
    async def test_package_docx(self, packager, main_pdf):
        result = await packager.package_document(
            main_pdf,
            format="docx",
            title="doc",
            attachments=[{"filename": "att1.txt", "data": b"hello"}],
            appendices=[{"filename": "app1.pdf", "data": b"pdfdata"}],
        )
        assert result.success is True
        assert result.file_name == "doc.zip"
        # Verify ZIP contents
        zf = zipfile.ZipFile(io.BytesIO(result.packaged_bytes))
        names = zf.namelist()
        assert "doc.docx" in names
        assert "attachments/att1.txt" in names
        assert "appendices/app1.pdf" in names

    @pytest.mark.asyncio
    async def test_package_html(self, packager):
        html = b"<html><body>Hello</body></html>"
        result = await packager.package_document(
            html,
            format="html",
            title="doc",
            attachments=[{"filename": "style.css", "data": b"body{}"}],
        )
        assert result.success is True
        assert result.file_name == "doc.zip"
        zf = zipfile.ZipFile(io.BytesIO(result.packaged_bytes))
        names = zf.namelist()
        assert "doc.html" in names
        assert "assets/style.css" in names

    @pytest.mark.asyncio
    async def test_package_unsupported_format(self, packager, main_pdf):
        result = await packager.package_document(main_pdf, format="txt", title="doc")
        assert result.success is False  # default success=False
        assert any("Unsupported" in w for w in result.warnings)


class TestRFPPackager:
    @pytest.fixture
    def packager(self):
        return RFPPackager()

    @pytest.fixture
    def sample_package(self):
        return RFPResponsePackage(
            cover_letter=_minimal_pdf_bytes("cover"),
            compliance_matrix=_minimal_pdf_bytes("matrix"),
            main_proposal=_minimal_pdf_bytes("proposal"),
            cost_proposal=_minimal_pdf_bytes("cost"),
            appendices=[{"filename": "resume.pdf", "data": _minimal_pdf_bytes("resume")}],
            forms=[{"filename": "sf33.pdf", "data": _minimal_pdf_bytes("form")}],
        )

    @pytest.mark.asyncio
    async def test_package_rfp_pdf_no_merge(self, packager, sample_package):
        result = await packager.package_rfp_response(sample_package, format="pdf", title="RFP")
        assert result.success is True
        assert result.file_name == "RFP.pdf"
        assert result.packaged_bytes == sample_package.main_proposal
        assert any("merge_pdfs=True" in w for w in result.warnings)

    @pytest.mark.asyncio
    async def test_package_rfp_pdf_with_merge(self, sample_package):
        config = PackagingConfiguration(merge_pdfs=True)
        packager = RFPPackager(config=config)
        result = await packager.package_rfp_response(
            sample_package, format="pdf", title="RFP"
        )
        assert result.success is True
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(result.packaged_bytes))
        assert len(reader.pages) == 6  # cover + matrix + proposal + cost + resume + form

    @pytest.mark.asyncio
    async def test_package_rfp_docx(self, packager, sample_package):
        result = await packager.package_rfp_response(
            sample_package, format="docx", title="RFP"
        )
        assert result.success is True
        assert result.file_name == "RFP.zip"
        zf = zipfile.ZipFile(io.BytesIO(result.packaged_bytes))
        names = zf.namelist()
        assert "01_cover_letter.pdf" in names
        assert "03_main_proposal.pdf" in names
        assert "05_appendices/resume.pdf" in names
        assert "06_forms/sf33.pdf" in names

    @pytest.mark.asyncio
    async def test_package_rfp_html(self, packager, sample_package):
        result = await packager.package_rfp_response(
            sample_package, format="html", title="RFP"
        )
        assert result.success is True
        assert result.file_name == "RFP.zip"

    @pytest.mark.asyncio
    async def test_package_rfp_empty_components(self, packager):
        package = RFPResponsePackage(main_proposal=_minimal_pdf_bytes("proposal"))
        result = await packager.package_rfp_response(package, format="pdf", title="RFP")
        assert result.success is True
        assert result.packaged_bytes == package.main_proposal
        assert not result.warnings
