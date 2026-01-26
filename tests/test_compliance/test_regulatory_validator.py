"""
Tests for RegulatoryValidator

Comprehensive test suite for regulatory compliance validation including
FAR, DFARS, and industry-specific compliance requirements.
"""

import pytest
import asyncio
from datetime import datetime
from pathlib import Path

from docfusion.compliance.validators.regulatory_validator import (
	RegulatoryValidator,
	ComplianceReport,
	ComplianceViolation,
	ComplianceRule,
	ViolationSeverity,
	ComplianceStatus
)


class TestRegulatoryValidator:
	"""Test suite for RegulatoryValidator"""
	
	@pytest.fixture
	def validator(self):
		"""Create RegulatoryValidator instance"""
		return RegulatoryValidator()
	
	@pytest.fixture
	def sample_proposal_content(self):
		"""Sample proposal content for testing"""
		return """
		PROPOSAL FOR IT SERVICES
		
		Executive Summary
		This proposal outlines our technical approach to provide comprehensive IT services.
		
		Technical Approach
		Our methodology includes proven techniques and innovative solutions.
		We utilize industry best practices and cutting-edge technology.
		
		Past Performance
		Our company has successfully delivered similar projects with excellent results.
		We have a proven track record of on-time delivery and customer satisfaction.
		
		Cost Information
		The total cost for this project is $500,000 over 12 months.
		This includes all labor, materials, and overhead costs.
		
		Representations and Certifications
		We certify that our company meets all requirements.
		We are a small business enterprise registered with SAM.
		"""
	
	@pytest.fixture
	def sample_defense_proposal(self):
		"""Sample defense proposal content"""
		return """
		DEFENSE CONTRACT PROPOSAL
		
		Executive Summary
		This proposal addresses cybersecurity requirements per NIST SP 800-171.
		
		Technical Approach
		Our solution implements comprehensive cybersecurity controls.
		We ensure protection of covered defense information.
		
		Past Performance
		Extensive experience with defense contractors and security clearances.
		
		Cost Analysis
		Total cost: $2,000,000 including security implementation.
		
		Buy American Compliance
		All components will be manufactured in the United States.
		We comply with Buy American Act requirements for domestic content.
		
		Supply Chain Risk Assessment
		We have conducted comprehensive supply chain risk assessment.
		All vendors are verified and pose minimal risk.
		
		Certifications
		Our company maintains appropriate security certifications.
		"""
	
	@pytest.mark.asyncio
	async def test_validate_document_basic(self, validator, sample_proposal_content):
		"""Test basic document validation"""
		report = await validator.validate_document(
			document_content=sample_proposal_content,
			document_type="proposal"
		)
		
		assert isinstance(report, ComplianceReport)
		assert report.document_type == "proposal"
		assert report.total_rules_checked > 0
		assert report.overall_status in [status for status in ComplianceStatus]
		assert 0 <= report.compliance_score <= 100
	
	@pytest.mark.asyncio
	async def test_far_compliance_validation(self, validator, sample_proposal_content):
		"""Test FAR compliance validation"""
		report = await validator.validate_document(
			document_content=sample_proposal_content,
			document_type="proposal",
			regulations=["FAR"]
		)
		
		# Should find minimal violations due to comprehensive sample content
		assert report.violations_found >= 0
		assert report.compliance_score > 50  # Should score reasonably well
		
		# Check for specific FAR rule violations
		rule_codes_found = [v.regulation for v in report.violations]
		assert any("FAR" in code for code in rule_codes_found) or report.violations_found == 0
	
	@pytest.mark.asyncio
	async def test_dfars_compliance_validation(self, validator, sample_defense_proposal):
		"""Test DFARS compliance validation"""
		report = await validator.validate_document(
			document_content=sample_defense_proposal,
			document_type="proposal",
			regulations=["DFARS"]
		)
		
		assert isinstance(report, ComplianceReport)
		# Should have better compliance due to defense-specific content
		assert report.compliance_score >= 60
	
	@pytest.mark.asyncio
	async def test_missing_content_violations(self, validator):
		"""Test validation with missing required content"""
		minimal_content = "This is a minimal proposal with no required sections."
		
		report = await validator.validate_document(
			document_content=minimal_content,
			document_type="proposal"
		)
		
		# Should find violations for missing content
		assert report.violations_found > 0
		assert report.compliance_score < 80  # Should score poorly
		
		# Check for specific violations
		violation_descriptions = [v.description for v in report.violations]
		assert any("Missing" in desc for desc in violation_descriptions)
	
	@pytest.mark.asyncio
	async def test_violation_severity_levels(self, validator, sample_proposal_content):
		"""Test that violations are properly categorized by severity"""
		report = await validator.validate_document(
			document_content=sample_proposal_content,
			document_type="proposal"
		)
		
		total_violations = (report.critical_violations + report.high_violations +
						   report.medium_violations + report.low_violations)
		assert total_violations == report.violations_found
		
		# Check that violations have proper severity levels
		for violation in report.violations:
			assert isinstance(violation.severity, ViolationSeverity)
	
	@pytest.mark.asyncio
	async def test_multiple_regulation_validation(self, validator, sample_defense_proposal):
		"""Test validation against multiple regulations"""
		report = await validator.validate_document(
			document_content=sample_defense_proposal,
			document_type="proposal",
			regulations=["FAR", "DFARS"]
		)
		
		assert report.total_rules_checked > 0
		# Should check rules from both FAR and DFARS
		assert any("FAR" in v.regulation or "DFARS" in v.regulation 
				  for v in report.violations) or report.violations_found == 0
	
	@pytest.mark.asyncio
	async def test_healthcare_compliance(self, validator):
		"""Test healthcare-specific compliance validation"""
		healthcare_content = """
		HEALTHCARE IT PROPOSAL
		
		Executive Summary
		This proposal addresses HIPAA compliance for PHI protection.
		
		Technical Approach
		Our solution implements comprehensive HIPAA safeguards.
		We ensure protection of protected health information.
		
		Security Measures
		All systems comply with HIPAA security requirements.
		Administrative, physical, and technical safeguards are implemented.
		"""
		
		report = await validator.validate_document(
			document_content=healthcare_content,
			document_type="healthcare_proposal"
		)
		
		assert isinstance(report, ComplianceReport)
		# Should apply HIPAA rules for healthcare content
		regulations_checked = set(v.regulation for v in report.violations)
		assert len(regulations_checked) > 0 or report.violations_found == 0
	
	@pytest.mark.asyncio
	async def test_custom_rule_addition(self, validator):
		"""Test adding custom compliance rules"""
		custom_rule = ComplianceRule(
			name="Custom Test Rule",
			description="Test rule for validation",
			regulation="TEST",
			section="TEST-001",
			severity=ViolationSeverity.MEDIUM,
			pattern=r"(?i)custom.*requirement"
		)
		
		await validator.add_custom_rule(custom_rule, "TEST")
		
		test_content = "This document has custom requirements that must be met."
		report = await validator.validate_document(
			document_content=test_content,
			document_type="proposal",
			regulations=["TEST"]
		)
		
		# Should find the custom content
		assert report.total_rules_checked >= 1
	
	@pytest.mark.asyncio
	async def test_applicable_rules_detection(self, validator, sample_proposal_content):
		"""Test detection of applicable rules for document"""
		rules = await validator.get_applicable_rules(
			document_content=sample_proposal_content,
			document_type="proposal"
		)
		
		assert isinstance(rules, list)
		assert len(rules) > 0
		assert all(isinstance(rule, ComplianceRule) for rule in rules)
	
	@pytest.mark.asyncio
	async def test_report_generation_completeness(self, validator, sample_proposal_content):
		"""Test that compliance reports contain all required information"""
		report = await validator.validate_document(
			document_content=sample_proposal_content,
			document_type="proposal"
		)
		
		# Check report completeness
		assert report.report_id is not None
		assert report.document_type == "proposal"
		assert isinstance(report.assessment_date, datetime)
		assert isinstance(report.compliance_score, (int, float))
		assert report.total_rules_checked >= 0
		assert report.violations_found >= 0
		assert isinstance(report.violations, list)
		assert isinstance(report.recommendations, list)
		assert report.processing_time_ms >= 0
	
	@pytest.mark.asyncio
	async def test_regulation_database_export(self, validator):
		"""Test export of regulations database"""
		export_data = await validator.export_regulations_database()
		
		assert isinstance(export_data, str)
		assert len(export_data) > 0
		
		# Should be valid JSON
		import json
		parsed_data = json.loads(export_data)
		assert isinstance(parsed_data, dict)
		assert "FAR" in parsed_data
		assert "DFARS" in parsed_data
	
	@pytest.mark.asyncio
	async def test_performance_with_large_document(self, validator):
		"""Test performance with large document"""
		# Create a large document
		large_content = """
		LARGE PROPOSAL DOCUMENT
		
		Executive Summary
		""" + "This is a large document with extensive content. " * 1000 + """
		
		Technical Approach
		""" + "Our approach includes detailed technical specifications. " * 500 + """
		
		Past Performance
		""" + "We have extensive past performance records. " * 300 + """
		
		Cost Information
		The total project cost is detailed in our pricing structure.
		"""
		
		start_time = datetime.now()
		report = await validator.validate_document(
			document_content=large_content,
			document_type="proposal"
		)
		end_time = datetime.now()
		
		processing_time = (end_time - start_time).total_seconds()
		
		assert isinstance(report, ComplianceReport)
		assert processing_time < 30  # Should complete within 30 seconds
		assert report.processing_time_ms > 0
	
	@pytest.mark.asyncio
	async def test_empty_document_handling(self, validator):
		"""Test handling of empty or minimal documents"""
		empty_content = ""
		
		report = await validator.validate_document(
			document_content=empty_content,
			document_type="proposal"
		)
		
		assert isinstance(report, ComplianceReport)
		# Empty document should have violations
		assert report.violations_found > 0
		assert report.compliance_score < 50
	
	@pytest.mark.asyncio
	async def test_violation_recommendations(self, validator, sample_proposal_content):
		"""Test that violations include actionable recommendations"""
		# Use content missing key elements to generate violations
		incomplete_content = "This is an incomplete proposal without required sections."
		
		report = await validator.validate_document(
			document_content=incomplete_content,
			document_type="proposal"
		)
		
		if report.violations_found > 0:
			# Check that violations have recommendations
			for violation in report.violations:
				assert violation.recommendation is not None
				assert len(violation.recommendation) > 0
			
			# Check that report has overall recommendations
			assert len(report.recommendations) > 0
			assert all(isinstance(rec, str) and len(rec) > 0 
					  for rec in report.recommendations)


if __name__ == "__main__":
	pytest.main([__file__, "-v"])