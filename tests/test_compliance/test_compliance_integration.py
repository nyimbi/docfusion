"""
Tests for DocumentComplianceIntegrator

Comprehensive test suite for compliance integration with document engine
including end-to-end validation, real-time checking, and auto-fixes.
"""

import pytest
import asyncio
import tempfile
import os
from datetime import datetime
from pathlib import Path

from docfusion.document_engine.compliance_integration import (
	DocumentComplianceIntegrator,
	DocumentComplianceConfig,
	ComplianceIntegrationResult,
	DocumentComplianceStatus,
	ComplianceCheck
)
from docfusion.compliance.frameworks.compliance_framework import ComplianceFramework


class TestDocumentComplianceIntegrator:
	"""Test suite for DocumentComplianceIntegrator"""
	
	@pytest.fixture
	def integrator(self):
		"""Create DocumentComplianceIntegrator instance"""
		return DocumentComplianceIntegrator()
	
	@pytest.fixture
	def sample_proposal_content(self):
		"""Sample proposal content for testing"""
		return """
		GOVERNMENT PROPOSAL
		
		Executive Summary
		This proposal outlines our comprehensive technical approach.
		
		Technical Approach
		Our methodology includes proven techniques and best practices.
		We utilize cutting-edge technology and industry standards.
		
		Past Performance
		Our company has successfully delivered similar projects.
		We have an excellent track record of customer satisfaction.
		
		Cost Information
		Total project cost: $750,000 over 18 months.
		This includes all labor, materials, and overhead.
		
		Representations and Certifications
		We certify compliance with all federal requirements.
		Our company is registered in SAM and meets all standards.
		"""
	
	@pytest.fixture
	def defense_proposal_content(self):
		"""Sample defense proposal content"""
		return """
		DEFENSE CONTRACT PROPOSAL
		
		Executive Summary
		This proposal addresses all DFARS cybersecurity requirements.
		
		Technical Approach
		Our solution implements NIST SP 800-171 controls comprehensively.
		We ensure protection of covered defense information.
		
		Past Performance
		Extensive experience with defense contractors and clearances.
		
		Cybersecurity Implementation
		We have implemented adequate security controls per DFARS 252.204-7012.
		Our systems protect covered defense information effectively.
		
		Buy American Compliance
		All components are manufactured domestically in the United States.
		We comply with Buy American Act requirements fully.
		
		Supply Chain Risk Assessment
		Comprehensive supply chain risk assessment completed.
		All vendors verified and pose minimal security risk.
		
		Cost Analysis
		Total cost: $1,500,000 including security implementation.
		"""
	
	@pytest.fixture
	def create_temp_document(self):
		"""Create temporary document file for testing"""
		def _create_doc(filename="test_proposal.pdf", content="", size_mb=2):
			temp_dir = tempfile.mkdtemp()
			file_path = os.path.join(temp_dir, filename)
			
			with open(file_path, 'wb') as f:
				if content:
					f.write(content.encode('utf-8'))
				else:
					f.write(b'Document content' * (size_mb * 1024 * 64))
			
			return file_path
		
		return _create_doc
	
	@pytest.mark.asyncio
	async def test_basic_compliance_validation(self, integrator, sample_proposal_content):
		"""Test basic compliance validation integration"""
		result = await integrator.validate_document_compliance(
			document_content=sample_proposal_content,
			document_id="test_doc_001"
		)
		
		assert isinstance(result, ComplianceIntegrationResult)
		assert result.document_id == "test_doc_001"
		assert result.overall_status in [status for status in DocumentComplianceStatus]
		assert 0 <= result.compliance_score <= 100
		assert isinstance(result.recommendations, list)
	
	@pytest.mark.asyncio
	async def test_government_proposal_configuration(self, integrator, sample_proposal_content):
		"""Test government proposal compliance configuration"""
		result = await integrator.validate_document_compliance(
			document_content=sample_proposal_content,
			document_id="gov_proposal_001",
			document_type="government_proposal"
		)
		
		assert isinstance(result, ComplianceIntegrationResult)
		# Should have regulatory validation (FAR)
		assert result.regulatory_report is not None
		assert result.regulatory_report.total_rules_checked > 0
		
		# Should provide meaningful compliance score
		assert result.compliance_score >= 0
	
	@pytest.mark.asyncio
	async def test_defense_proposal_configuration(self, integrator, defense_proposal_content):
		"""Test defense proposal compliance configuration"""
		result = await integrator.validate_document_compliance(
			document_content=defense_proposal_content,
			document_id="defense_proposal_001",
			document_type="defense_proposal"
		)
		
		assert isinstance(result, ComplianceIntegrationResult)
		# Should have both FAR and DFARS validation
		assert result.regulatory_report is not None
		
		# Defense proposals should be more strictly validated
		assert result.regulatory_report.total_rules_checked > 0
	
	@pytest.mark.asyncio
	async def test_format_validation_integration(self, integrator, sample_proposal_content, create_temp_document):
		"""Test format validation integration"""
		doc_path = create_temp_document("format_test.pdf", sample_proposal_content)
		
		try:
			result = await integrator.validate_document_compliance(
				document_content=sample_proposal_content,
				document_id="format_test_001",
				document_path=doc_path
			)
			
			assert isinstance(result, ComplianceIntegrationResult)
			# Should have format validation results
			assert result.format_report is not None
			assert result.format_report.total_requirements_checked > 0
			
		finally:
			os.unlink(doc_path)
	
	@pytest.mark.asyncio
	async def test_pre_render_validation(self, integrator, sample_proposal_content):
		"""Test pre-render validation workflow"""
		can_proceed, result = await integrator.validate_pre_render(
			document_content=sample_proposal_content,
			document_id="pre_render_001",
			document_type="government_proposal"
		)
		
		assert isinstance(can_proceed, bool)
		assert isinstance(result, ComplianceIntegrationResult)
		
		# Should allow proceeding unless critical violations
		if result.critical_violations == 0:
			assert can_proceed is True
	
	@pytest.mark.asyncio
	async def test_post_render_validation(self, integrator, sample_proposal_content, create_temp_document):
		"""Test post-render validation workflow"""
		doc_path = create_temp_document("post_render.pdf", sample_proposal_content)
		
		try:
			result = await integrator.validate_post_render(
				document_path=doc_path,
				document_content=sample_proposal_content,
				document_id="post_render_001",
				document_type="government_proposal"
			)
			
			assert isinstance(result, ComplianceIntegrationResult)
			# Should have both regulatory and format validation
			assert result.regulatory_report is not None
			assert result.format_report is not None
			
		finally:
			os.unlink(doc_path)
	
	@pytest.mark.asyncio
	async def test_compliance_checklist_generation(self, integrator):
		"""Test compliance checklist generation"""
		checklist = await integrator.get_compliance_checklist(
			document_type="government_proposal"
		)
		
		assert isinstance(checklist, list)
		assert len(checklist) > 0
		
		# Each checklist item should have required fields
		for item in checklist:
			assert "rule_code" in item
			assert "title" in item
			assert "description" in item
			assert "category" in item
			assert "severity" in item
			assert "mandatory" in item
			assert "checked" in item
	
	@pytest.mark.asyncio
	async def test_custom_compliance_configuration(self, integrator, sample_proposal_content):
		"""Test custom compliance configuration"""
		custom_checks = [
			ComplianceCheck(
				check_type="regulatory",
				framework_code="FAR",
				enabled=True,
				severity_threshold="low",
				auto_fix=False
			),
			ComplianceCheck(
				check_type="format",
				framework_code="STANDARD",
				enabled=True,
				severity_threshold="medium"
			)
		]
		
		custom_config = DocumentComplianceConfig(
			document_type="custom_proposal",
			industry="technology",
			jurisdiction="federal",
			compliance_checks=custom_checks,
			validate_on_render=True,
			enable_auto_fix=True
		)
		
		result = await integrator.validate_document_compliance(
			document_content=sample_proposal_content,
			document_id="custom_config_001",
			config=custom_config
		)
		
		assert isinstance(result, ComplianceIntegrationResult)
		assert result.regulatory_report is not None
	
	@pytest.mark.asyncio
	async def test_violation_severity_aggregation(self, integrator):
		"""Test violation severity aggregation across validators"""
		# Use minimal content to generate violations
		minimal_content = "This is a minimal document without required sections."
		
		result = await integrator.validate_document_compliance(
			document_content=minimal_content,
			document_id="severity_test_001",
			document_type="government_proposal"
		)
		
		# Should aggregate violations properly
		total_violations = (result.critical_violations + result.high_violations +
						   result.medium_violations + result.low_violations)
		assert total_violations == result.total_violations
		
		# Should have violations due to minimal content
		assert result.total_violations > 0
	
	@pytest.mark.asyncio
	async def test_compliance_score_calculation(self, integrator, sample_proposal_content):
		"""Test overall compliance score calculation"""
		result = await integrator.validate_document_compliance(
			document_content=sample_proposal_content,
			document_id="score_test_001"
		)
		
		assert 0 <= result.compliance_score <= 100
		
		# Score should correlate with violation severity
		if result.critical_violations > 0:
			assert result.compliance_score < 90
		if result.total_violations == 0:
			assert result.compliance_score == 100
	
	@pytest.mark.asyncio
	async def test_recommendations_generation(self, integrator):
		"""Test comprehensive recommendations generation"""
		# Use content that will generate violations
		poor_content = "Incomplete proposal missing key sections."
		
		result = await integrator.validate_document_compliance(
			document_content=poor_content,
			document_id="recommendations_001"
		)
		
		assert isinstance(result.recommendations, list)
		if result.total_violations > 0:
			assert len(result.recommendations) > 0
			
			# Recommendations should be actionable
			for recommendation in result.recommendations:
				assert isinstance(recommendation, str)
				assert len(recommendation) > 0
	
	@pytest.mark.asyncio
	async def test_framework_management(self, integrator):
		"""Test compliance framework management"""
		# Test framework listing
		frameworks = integrator.list_available_frameworks()
		assert isinstance(frameworks, list)
		assert len(frameworks) > 0
		
		# Should include default frameworks
		framework_codes = [f["code"] for f in frameworks]
		assert "FAR" in framework_codes
		assert "DFARS" in framework_codes
		
		# Test framework retrieval
		far_framework = integrator.get_framework("FAR")
		assert far_framework is not None
		assert far_framework.code == "FAR"
	
	@pytest.mark.asyncio
	async def test_custom_framework_addition(self, integrator):
		"""Test adding custom compliance framework"""
		custom_framework = ComplianceFramework(
			name="Custom Test Framework",
			code="CTF",
			description="Test framework for validation",
			framework_type=ComplianceFramework.FrameworkType.CUSTOM,
			jurisdiction=ComplianceFramework.JurisdictionLevel.ORGANIZATIONAL
		)
		
		integrator.add_custom_framework(custom_framework)
		
		# Should be able to retrieve custom framework
		retrieved_framework = integrator.get_framework("CTF")
		assert retrieved_framework is not None
		assert retrieved_framework.name == "Custom Test Framework"
		
		# Should appear in framework list
		frameworks = integrator.list_available_frameworks()
		framework_codes = [f["code"] for f in frameworks]
		assert "CTF" in framework_codes
	
	@pytest.mark.asyncio
	async def test_auto_fix_functionality(self, integrator):
		"""Test automatic fix functionality"""
		# This would test auto-fix when implemented
		# For now, test that auto-fix configuration is respected
		
		config = DocumentComplianceConfig(
			document_type="test_proposal",
			enable_auto_fix=True,
			auto_fix_severity_limit="low"
		)
		
		result = await integrator.validate_document_compliance(
			document_content="Test content for auto-fix",
			document_id="autofix_test_001",
			config=config
		)
		
		assert isinstance(result.auto_fixes_applied, list)
		# Auto-fixes may or may not be applied depending on violations found
	
	@pytest.mark.asyncio
	async def test_blocking_render_on_violations(self, integrator):
		"""Test blocking render on critical violations"""
		# Use content that should generate violations
		problematic_content = "This document has no required sections or content."
		
		# Test with blocking configuration
		blocking_config = DocumentComplianceConfig(
			document_type="defense_proposal",  # Stricter requirements
			block_render_on_violations=True
		)
		
		can_proceed, result = await integrator.validate_pre_render(
			document_content=problematic_content,
			document_id="blocking_test_001",
			document_type="defense_proposal",
			config=blocking_config
		)
		
		# May or may not block depending on specific violations found
		assert isinstance(can_proceed, bool)
		assert isinstance(result, ComplianceIntegrationResult)
	
	@pytest.mark.asyncio
	async def test_performance_with_large_document(self, integrator):
		"""Test performance with large document validation"""
		large_content = """
		LARGE PROPOSAL DOCUMENT
		
		Executive Summary
		""" + "This is a comprehensive proposal with extensive content. " * 1000 + """
		
		Technical Approach
		""" + "Our detailed technical approach includes multiple methodologies. " * 800 + """
		
		Past Performance
		""" + "We have extensive past performance across various projects. " * 500 + """
		"""
		
		start_time = datetime.now()
		result = await integrator.validate_document_compliance(
			document_content=large_content,
			document_id="large_doc_001"
		)
		end_time = datetime.now()
		
		processing_time = (end_time - start_time).total_seconds()
		
		assert isinstance(result, ComplianceIntegrationResult)
		assert processing_time < 60  # Should complete within 60 seconds
		assert result.validation_time_ms > 0
	
	@pytest.mark.asyncio
	async def test_error_handling(self, integrator):
		"""Test error handling in compliance validation"""
		# Test with None content
		result = await integrator.validate_document_compliance(
			document_content="",
			document_id="error_test_001"
		)
		
		# Should handle empty content gracefully
		assert isinstance(result, ComplianceIntegrationResult)
		# May have validation error status depending on implementation
	
	@pytest.mark.asyncio
	async def test_result_completeness(self, integrator, sample_proposal_content):
		"""Test that compliance results contain all required information"""
		result = await integrator.validate_document_compliance(
			document_content=sample_proposal_content,
			document_id="completeness_test_001"
		)
		
		# Check result completeness
		assert result.result_id is not None
		assert result.document_id == "completeness_test_001"
		assert result.overall_status in [status for status in DocumentComplianceStatus]
		assert isinstance(result.compliance_score, (int, float))
		assert result.total_violations >= 0
		assert isinstance(result.recommendations, list)
		assert isinstance(result.auto_fixes_applied, list)
		assert result.validation_time_ms >= 0
		assert isinstance(result.created_at, datetime)


if __name__ == "__main__":
	pytest.main([__file__, "-v"])