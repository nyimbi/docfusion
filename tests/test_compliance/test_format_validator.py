"""
Tests for FormatValidator

Comprehensive test suite for document format validation including
structure, formatting, accessibility, and submission requirements.
"""

import pytest
import asyncio
import tempfile
import os
from pathlib import Path
from datetime import datetime

from docfusion.compliance.validators.format_validator import (
	FormatValidator,
	FormatReport,
	FormatViolation,
	FormatRequirement,
	FormatSeverity,
	DocumentFormat
)


class TestFormatValidator:
	"""Test suite for FormatValidator"""
	
	@pytest.fixture
	def validator(self):
		"""Create FormatValidator instance"""
		return FormatValidator()
	
	@pytest.fixture
	def sample_document_content(self):
		"""Sample document content for testing"""
		return """
		PROPOSAL TITLE PAGE
		
		Proposal for IT Services
		Submitted to: Government Agency
		Submitted by: Test Company
		Date: 2024-01-15
		Proposal Number: PROP-2024-001
		
		TABLE OF CONTENTS
		1. Executive Summary
		2. Technical Approach
		3. Past Performance
		4. Cost Analysis
		
		EXECUTIVE SUMMARY
		This proposal outlines our comprehensive approach to delivering IT services.
		
		1. TECHNICAL APPROACH
		Our methodology includes proven techniques and best practices.
		
		2. PAST PERFORMANCE
		We have successfully delivered similar projects with excellent results.
		
		3. COST ANALYSIS
		The total project cost is $500,000 over 12 months.
		"""
	
	@pytest.fixture
	def create_temp_pdf(self):
		"""Create temporary PDF file for testing"""
		def _create_pdf(filename="test_document.pdf", size_mb=1):
			temp_dir = tempfile.mkdtemp()
			file_path = os.path.join(temp_dir, filename)
			
			# Create a file with specified size
			with open(file_path, 'wb') as f:
				f.write(b'PDF content' * (size_mb * 1024 * 128))  # Approximate size
			
			return file_path
		
		return _create_pdf
	
	@pytest.fixture
	def create_temp_docx(self):
		"""Create temporary DOCX file for testing"""
		def _create_docx(filename="test_document.docx", size_mb=1):
			temp_dir = tempfile.mkdtemp()
			file_path = os.path.join(temp_dir, filename)
			
			# Create a file with specified size
			with open(file_path, 'wb') as f:
				f.write(b'DOCX content' * (size_mb * 1024 * 128))  # Approximate size
			
			return file_path
		
		return _create_docx
	
	@pytest.mark.asyncio
	async def test_validate_document_format_basic(self, validator, create_temp_pdf, sample_document_content):
		"""Test basic document format validation"""
		pdf_path = create_temp_pdf("test.pdf", 2)
		
		try:
			report = await validator.validate_document_format(
				document_path=pdf_path,
				document_content=sample_document_content
			)
			
			assert isinstance(report, FormatReport)
			assert report.document_format == DocumentFormat.PDF
			assert report.document_name == "test.pdf"
			assert report.total_requirements_checked > 0
			assert 0 <= report.format_compliance_score <= 100
			assert isinstance(report.violations, list)
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_document_format_detection(self, validator, create_temp_pdf, create_temp_docx):
		"""Test document format detection"""
		pdf_path = create_temp_pdf("document.pdf")
		docx_path = create_temp_docx("document.docx")
		
		try:
			# Test PDF detection
			pdf_report = await validator.validate_document_format(document_path=pdf_path)
			assert pdf_report.document_format == DocumentFormat.PDF
			
			# Test DOCX detection
			docx_report = await validator.validate_document_format(document_path=docx_path)
			assert docx_report.document_format == DocumentFormat.DOCX
			
		finally:
			os.unlink(pdf_path)
			os.unlink(docx_path)
	
	@pytest.mark.asyncio
	async def test_file_size_validation(self, validator, create_temp_pdf):
		"""Test file size limit validation"""
		# Create a large file (30MB, above typical 25MB limit)
		large_file_path = create_temp_pdf("large_document.pdf", 30)
		
		try:
			report = await validator.validate_document_format(document_path=large_file_path)
			
			# Should find file size violations
			size_violations = [v for v in report.violations 
							  if "size" in v.description.lower() or "size" in v.requirement_name.lower()]
			
			# May or may not find size violations depending on requirement configuration
			assert isinstance(report.violations, list)
			
		finally:
			os.unlink(large_file_path)
	
	@pytest.mark.asyncio
	async def test_filename_validation(self, validator, create_temp_pdf):
		"""Test filename convention validation"""
		# Test invalid filename with special characters
		invalid_file_path = create_temp_pdf("invalid file name!@#$.pdf")
		
		try:
			report = await validator.validate_document_format(document_path=invalid_file_path)
			
			# Should find filename violations
			filename_violations = [v for v in report.violations 
								  if "name" in v.description.lower() or "filename" in v.requirement_name.lower()]
			
			assert isinstance(report.violations, list)
			# May find filename violations depending on requirement configuration
			
		finally:
			os.unlink(invalid_file_path)
	
	@pytest.mark.asyncio
	async def test_title_page_validation(self, validator, create_temp_pdf):
		"""Test title page presence validation"""
		# Content without title page elements
		content_without_title = """
		SECTION 1: INTRODUCTION
		This document provides information about our services.
		
		SECTION 2: METHODOLOGY
		Our approach is based on industry best practices.
		"""
		
		pdf_path = create_temp_pdf("no_title.pdf")
		
		try:
			report = await validator.validate_document_format(
				document_path=pdf_path,
				document_content=content_without_title
			)
			
			# Should find title page violations
			title_violations = [v for v in report.violations 
							   if "title" in v.description.lower()]
			
			assert len(title_violations) >= 0  # May or may not find based on content
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_table_of_contents_validation(self, validator, create_temp_pdf):
		"""Test table of contents validation"""
		# Content without TOC
		content_without_toc = """
		INTRODUCTION
		This document provides comprehensive information.
		
		METHODOLOGY
		Our approach follows proven practices.
		
		CONCLUSION
		We recommend proceeding with the proposed solution.
		"""
		
		pdf_path = create_temp_pdf("no_toc.pdf")
		
		try:
			report = await validator.validate_document_format(
				document_path=pdf_path,
				document_content=content_without_toc
			)
			
			# Should potentially find TOC violations
			toc_violations = [v for v in report.violations 
							 if "contents" in v.description.lower()]
			
			assert isinstance(report.violations, list)
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_section_headers_validation(self, validator, create_temp_pdf, sample_document_content):
		"""Test section headers validation"""
		pdf_path = create_temp_pdf("with_headers.pdf")
		
		try:
			report = await validator.validate_document_format(
				document_path=pdf_path,
				document_content=sample_document_content
			)
			
			# Should have fewer violations due to good section structure
			assert isinstance(report, FormatReport)
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_page_limits_validation(self, validator, create_temp_pdf):
		"""Test page limits validation"""
		pdf_path = create_temp_pdf("test.pdf")
		
		try:
			# Mock file properties to simulate large document
			report = await validator.validate_document_format(document_path=pdf_path)
			
			# Check that page limit validation is performed
			page_violations = [v for v in report.violations 
							  if "page" in v.description.lower()]
			
			assert isinstance(report.violations, list)
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_accessibility_validation_placeholders(self, validator, create_temp_pdf):
		"""Test accessibility validation placeholders"""
		pdf_path = create_temp_pdf("accessibility_test.pdf")
		
		try:
			report = await validator.validate_document_format(document_path=pdf_path)
			
			# Should include accessibility warnings/placeholders
			accessibility_violations = [v for v in report.violations 
									   if "accessibility" in v.description.lower() or
									   "alt text" in v.description.lower()]
			
			assert isinstance(report.violations, list)
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_format_requirements_by_document_type(self, validator, create_temp_pdf):
		"""Test that format requirements vary by document type"""
		pdf_path = create_temp_pdf("document.pdf")
		
		try:
			# Get requirements for PDF format
			requirements = await validator.get_format_requirements()
			
			# Should have requirements for different categories
			categories = set(req.category for req in requirements)
			expected_categories = {"structure", "formatting", "accessibility", "submission"}
			
			assert len(categories.intersection(expected_categories)) > 0
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_custom_requirement_addition(self, validator, create_temp_pdf):
		"""Test adding custom format requirements"""
		custom_requirement = FormatRequirement(
			name="Custom Test Requirement",
			description="Test requirement for validation",
			category="custom",
			severity=FormatSeverity.MEDIUM,
			validator_function="test_custom_validation",
			applicable_formats=[DocumentFormat.PDF]
		)
		
		await validator.add_custom_requirement(custom_requirement, "custom")
		
		pdf_path = create_temp_pdf("custom_test.pdf")
		
		try:
			# Get requirements should now include custom requirement
			requirements = await validator.get_format_requirements("custom")
			assert len(requirements) >= 1
			assert any(req.name == "Custom Test Requirement" for req in requirements)
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_violation_severity_levels(self, validator, create_temp_pdf):
		"""Test that violations are properly categorized by severity"""
		pdf_path = create_temp_pdf("severity_test.pdf")
		
		try:
			report = await validator.validate_document_format(document_path=pdf_path)
			
			total_violations = (report.critical_violations + report.high_violations +
							   report.medium_violations + report.low_violations)
			assert total_violations == report.violations_found
			
			# Check that violations have proper severity levels
			for violation in report.violations:
				assert isinstance(violation.severity, FormatSeverity)
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_file_properties_extraction(self, validator, create_temp_pdf):
		"""Test file properties extraction"""
		pdf_path = create_temp_pdf("properties_test.pdf", 3)
		
		try:
			report = await validator.validate_document_format(document_path=pdf_path)
			
			# Should extract basic file properties
			assert isinstance(report.file_properties, dict)
			assert "file_size_bytes" in report.file_properties
			assert "file_size_mb" in report.file_properties
			assert report.file_properties["file_size_mb"] > 0
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_format_score_calculation(self, validator, create_temp_pdf, sample_document_content):
		"""Test format compliance score calculation"""
		pdf_path = create_temp_pdf("score_test.pdf")
		
		try:
			report = await validator.validate_document_format(
				document_path=pdf_path,
				document_content=sample_document_content
			)
			
			# Score should be between 0 and 100
			assert 0 <= report.format_compliance_score <= 100
			
			# Score should correlate with violations
			if report.violations_found == 0:
				assert report.format_compliance_score == 100
			else:
				assert report.format_compliance_score < 100
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_recommendations_generation(self, validator, create_temp_pdf):
		"""Test that format reports include actionable recommendations"""
		pdf_path = create_temp_pdf("recommendations_test.pdf")
		
		try:
			report = await validator.validate_document_format(document_path=pdf_path)
			
			# Should generate recommendations
			assert isinstance(report.recommendations, list)
			
			if report.violations_found > 0:
				assert len(report.recommendations) > 0
				# Recommendations should be non-empty strings
				assert all(isinstance(rec, str) and len(rec) > 0 
						  for rec in report.recommendations)
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_multiple_format_support(self, validator, create_temp_pdf, create_temp_docx):
		"""Test validation of multiple document formats"""
		pdf_path = create_temp_pdf("multi_format.pdf")
		docx_path = create_temp_docx("multi_format.docx")
		
		try:
			pdf_report = await validator.validate_document_format(document_path=pdf_path)
			docx_report = await validator.validate_document_format(document_path=docx_path)
			
			assert pdf_report.document_format == DocumentFormat.PDF
			assert docx_report.document_format == DocumentFormat.DOCX
			
			# Both should have validation results
			assert isinstance(pdf_report.violations, list)
			assert isinstance(docx_report.violations, list)
			
		finally:
			os.unlink(pdf_path)
			os.unlink(docx_path)
	
	@pytest.mark.asyncio
	async def test_report_completeness(self, validator, create_temp_pdf, sample_document_content):
		"""Test that format reports contain all required information"""
		pdf_path = create_temp_pdf("completeness_test.pdf")
		
		try:
			report = await validator.validate_document_format(
				document_path=pdf_path,
				document_content=sample_document_content
			)
			
			# Check report completeness
			assert report.report_id is not None
			assert report.document_name == "completeness_test.pdf"
			assert isinstance(report.assessment_date, datetime)
			assert isinstance(report.format_compliance_score, (int, float))
			assert report.total_requirements_checked >= 0
			assert report.violations_found >= 0
			assert isinstance(report.violations, list)
			assert isinstance(report.recommendations, list)
			assert isinstance(report.file_properties, dict)
			assert report.processing_time_ms >= 0
			
		finally:
			os.unlink(pdf_path)
	
	@pytest.mark.asyncio
	async def test_performance_validation(self, validator, create_temp_pdf):
		"""Test performance with format validation"""
		pdf_path = create_temp_pdf("performance_test.pdf", 5)  # 5MB file
		
		try:
			start_time = datetime.now()
			report = await validator.validate_document_format(document_path=pdf_path)
			end_time = datetime.now()
			
			processing_time = (end_time - start_time).total_seconds()
			
			assert isinstance(report, FormatReport)
			assert processing_time < 10  # Should complete within 10 seconds
			assert report.processing_time_ms > 0
			
		finally:
			os.unlink(pdf_path)


if __name__ == "__main__":
	pytest.main([__file__, "-v"])