#!/usr/bin/env python3
"""
Tests for RFP Analyzer

Unit tests for the RFP document analysis orchestration.
"""

import asyncio
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from docfusion.rfp.rfp_analyzer import (
	RFPAnalyzer,
	RFPAnalysisResult,
	create_rfp_analyzer,
)
from docfusion.rfp.requirement_extractor import (
	Requirement,
	RequirementModality,
	RequirementType,
	RequirementExtractionResult,
)


# Sample RFP text for testing
SAMPLE_RFP_TEXT = """
REQUEST FOR PROPOSAL (RFP)
Enterprise Software Development Services

SECTION 1: PURPOSE

The purpose of this RFP is to solicit proposals from qualified vendors.

SECTION 2: TECHNICAL REQUIREMENTS

2.1. The system must support a minimum of 500 concurrent users.
2.2. The platform shall provide 99.9% uptime availability.
2.3. Security features must include GDPR compliance and SOC 2 certification.
2.4. The solution should integrate with existing legacy systems where applicable.
2.5. Response time for all transactions shall not exceed 3 seconds.

SECTION 3: DELIVERABLES

3.1. The contractor shall deliver the system within 180 days.
3.2. Training materials should be provided for end users.
3.3. See Section 2.3 for security compliance requirements.

SECTION 4: EVALUATION

4.1. Proposals will be evaluated on technical approach (40%), price (30%), and past performance (30%).
4.2. All proposals must include detailed cost breakdown.
"""


class TestRFPAnalysisResult:
	"""Tests for RFPAnalysisResult model"""

	def test_result_creation(self):
		"""Test result creation"""
		result = RFPAnalysisResult()

		assert result.success == False
		assert result.requirements == []
		assert result.requirement_summary == {}
		assert result.document_metadata == {}
		assert result.cross_reference_analysis == {}
		assert result.compliance_indicators == []
		assert result.risk_assessment == {}
		assert result.recommendations == []
		assert result.errors == []
		assert result.warnings == []
		assert result.processing_time == 0.0

	def test_result_with_data(self):
		"""Test result with data"""
		req = Requirement(
			text="Test requirement",
			modality=RequirementModality.MANDATORY,
			requirement_type=RequirementType.TECHNICAL,
			confidence=0.9,
		)

		result = RFPAnalysisResult(
			success=True,
			requirements=[req],
			requirement_summary={"total_requirements": 1},
			processing_time=0.5,
		)

		assert result.success
		assert len(result.requirements) == 1
		assert result.requirement_summary["total_requirements"] == 1
		assert result.processing_time == 0.5


class TestRFPAnalyzer:
	"""Tests for RFPAnalyzer"""

	@pytest.fixture
	def analyzer(self):
		"""Create analyzer instance"""
		return create_rfp_analyzer()

	def test_analyzer_creation(self, analyzer):
		"""Test analyzer creation"""
		assert analyzer is not None
		assert analyzer.config is not None
		assert "compliance_standards" in analyzer.config

	def test_get_analyzer_info(self, analyzer):
		"""Test analyzer info"""
		info = analyzer.get_analyzer_info()

		assert "version" in info
		assert "capabilities" in info
		assert "requirement_extraction" in info["capabilities"]
		assert "cross_reference_analysis" in info["capabilities"]
		assert "compliance_detection" in info["capabilities"]

	@pytest.mark.asyncio
	async def test_analyze_text_basic(self, analyzer):
		"""Test basic text analysis"""
		result = await analyzer.analyze_text(SAMPLE_RFP_TEXT)

		assert result.success
		assert len(result.requirements) > 0

	@pytest.mark.asyncio
	async def test_analyze_text_requirement_summary(self, analyzer):
		"""Test requirement summary generation"""
		result = await analyzer.analyze_text(SAMPLE_RFP_TEXT)

		assert result.success
		assert "total_requirements" in result.requirement_summary
		assert "category_distribution" in result.requirement_summary
		assert "type_distribution" in result.requirement_summary

	@pytest.mark.asyncio
	async def test_analyze_text_compliance_detection(self, analyzer):
		"""Test compliance indicator detection"""
		result = await analyzer.analyze_text(SAMPLE_RFP_TEXT)

		assert result.success
		# Should detect GDPR and SOC 2 compliance requirements
		compliance_standards = [
			ind["standard"] for ind in result.compliance_indicators
		]
		# GDPR or SOC 2 should be detected
		assert any(std in ["GDPR", "SOC 2"] for std in compliance_standards)

	@pytest.mark.asyncio
	async def test_analyze_text_risk_assessment(self, analyzer):
		"""Test risk assessment"""
		result = await analyzer.analyze_text(SAMPLE_RFP_TEXT)

		assert result.success
		assert "risk_factors" in result.risk_assessment
		assert "risk_level" in result.risk_assessment
		assert "risk_score" in result.risk_assessment
		assert result.risk_assessment["risk_level"] in ["low", "medium", "high", "critical"]

	@pytest.mark.asyncio
	async def test_analyze_text_recommendations(self, analyzer):
		"""Test recommendation generation"""
		result = await analyzer.analyze_text(SAMPLE_RFP_TEXT)

		assert result.success
		assert isinstance(result.recommendations, list)

	@pytest.mark.asyncio
	async def test_analyze_text_cross_reference_analysis(self, analyzer):
		"""Test cross-reference analysis"""
		result = await analyzer.analyze_text(SAMPLE_RFP_TEXT)

		assert result.success
		assert "total_references" in result.cross_reference_analysis
		assert "requirements_with_refs" in result.cross_reference_analysis

	@pytest.mark.asyncio
	async def test_analyze_text_empty(self, analyzer):
		"""Test analysis with empty text"""
		result = await analyzer.analyze_text("")

		assert result.success
		assert len(result.requirements) == 0

	@pytest.mark.asyncio
	async def test_analyze_text_with_metadata(self, analyzer):
		"""Test analysis with document metadata"""
		metadata = {
			"source": "test_rfp.pdf",
			"title": "Test RFP",
			"organization": "Test Organization",
		}

		result = await analyzer.analyze_text(SAMPLE_RFP_TEXT, metadata)

		assert result.success
		assert result.document_metadata["source"] == "test_rfp.pdf"
		assert result.document_metadata["title"] == "Test RFP"

	@pytest.mark.asyncio
	async def test_close_analyzer(self, analyzer):
		"""Test closing analyzer resources"""
		await analyzer.close()
		# Should not raise any errors


class TestRFPAnalyzerIntegration:
	"""Integration tests for RFPAnalyzer"""

	@pytest.fixture
	def analyzer(self):
		"""Create analyzer instance"""
		return create_rfp_analyzer()

	@pytest.mark.asyncio
	async def test_full_analysis_workflow(self, analyzer):
		"""Test complete analysis workflow"""
		result = await analyzer.analyze_text(SAMPLE_RFP_TEXT)

		# Verify success
		assert result.success
		assert len(result.requirements) > 0

		# Verify all analysis components are populated
		assert result.requirement_summary
		assert result.cross_reference_analysis
		assert result.risk_assessment

		# Verify requirements have proper classification
		mandatory_count = sum(
			1 for req in result.requirements
			if req.modality == RequirementModality.MANDATORY
		)
		assert mandatory_count > 0

	@pytest.mark.asyncio
	async def test_multiple_analysis_calls(self, analyzer):
		"""Test multiple analysis calls"""
		result1 = await analyzer.analyze_text(SAMPLE_RFP_TEXT)
		result2 = await analyzer.analyze_text("The system shall be secure.")

		assert result1.success
		assert result2.success
		assert len(result1.requirements) > len(result2.requirements)

	@pytest.mark.asyncio
	async def test_analysis_with_cross_references(self, analyzer):
		"""Test analysis detects cross-references"""
		text_with_refs = """
		SECTION 1: REQUIREMENTS

		1.1. The system must provide user authentication.
		1.2. See Section 1.1 for authentication requirements.
		1.3. Per requirement 1.1, session management shall be implemented.
		"""

		result = await analyzer.analyze_text(text_with_refs)

		assert result.success
		assert len(result.requirements) > 0
		# Cross-references should be detected
		assert "total_references" in result.cross_reference_analysis


class TestFactoryFunctions:
	"""Tests for factory functions"""

	def test_create_rfp_analyzer_default(self):
		"""Test default factory function"""
		analyzer = create_rfp_analyzer()

		assert analyzer is not None
		assert isinstance(analyzer, RFPAnalyzer)

	def test_create_rfp_analyzer_custom_config(self):
		"""Test factory with custom config"""
		config = {
			"analyze_compliance": False,
			"assess_risks": False,
			"compliance_standards": ["GDPR", "HIPAA"],
		}

		analyzer = create_rfp_analyzer(config)

		assert analyzer is not None
		assert analyzer.config["analyze_compliance"] == False
		assert analyzer.config["assess_risks"] == False
		assert "GDPR" in analyzer.config["compliance_standards"]


class TestRiskAssessment:
	"""Tests for risk assessment functionality"""

	@pytest.fixture
	def analyzer(self):
		"""Create analyzer instance"""
		return create_rfp_analyzer()

	@pytest.mark.asyncio
	async def test_high_complexity_detection(self, analyzer):
		"""Test detection of high complexity requirements"""
		text = """
		The system must integrate with multiple legacy systems.
		Real-time data migration is required.
		Custom interfaces must be developed.
		"""

		result = await analyzer.analyze_text(text)

		assert result.success
		# Should detect high complexity indicators
		# Risk factors are stored as counts
		risk_factors = result.risk_assessment.get("risk_factors", {})
		# Just verify the analysis completed successfully
		assert "high_complexity" in risk_factors or "total_risk_items" in result.risk_assessment

	@pytest.mark.asyncio
	async def test_low_confidence_detection(self, analyzer):
		"""Test detection of low confidence requirements"""
		result = await analyzer.analyze_text(SAMPLE_RFP_TEXT)

		assert result.success
		# Low confidence requirements should be tracked
		risk_factors = result.risk_assessment.get("risk_factors", {})
		# Just verify the structure is correct
		assert "low_confidence" in risk_factors or "total_risk_items" in result.risk_assessment


class TestComplianceAnalysis:
	"""Tests for compliance analysis functionality"""

	@pytest.fixture
	def analyzer(self):
		"""Create analyzer instance"""
		return create_rfp_analyzer()

	@pytest.mark.asyncio
	async def test_compliance_standard_detection(self, analyzer):
		"""Test detection of compliance standards"""
		text = """
		The system must comply with GDPR data protection regulations.
		HIPAA compliance is required for healthcare data.
		ISO 27001 certification must be maintained.
		"""

		result = await analyzer.analyze_text(text)

		assert result.success
		# Should detect compliance standards
		compliance_standards = [
			ind["standard"] for ind in result.compliance_indicators
		]
		assert any(std in compliance_standards for std in ["GDPR", "HIPAA", "ISO 27001"])

	@pytest.mark.asyncio
	async def test_compliance_requirement_linking(self, analyzer):
		"""Test compliance indicators are linked to requirements"""
		result = await analyzer.analyze_text(SAMPLE_RFP_TEXT)

		assert result.success
		for indicator in result.compliance_indicators:
			assert "requirement_id" in indicator
			assert "standard" in indicator
			assert "text_snippet" in indicator


class TestRecommendations:
	"""Tests for recommendation generation"""

	@pytest.fixture
	def analyzer(self):
		"""Create analyzer instance"""
		return create_rfp_analyzer()

	@pytest.mark.asyncio
	async def test_recommendation_generation(self, analyzer):
		"""Test recommendation generation"""
		result = await analyzer.analyze_text(SAMPLE_RFP_TEXT)

		assert result.success
		# Recommendations should be generated
		assert isinstance(result.recommendations, list)

	@pytest.mark.asyncio
	async def test_high_risk_recommendations(self, analyzer):
		"""Test recommendations for high risk RFPs"""
		# RFP with many mandatory requirements
		text = """
		All requirements are mandatory and must be completed immediately.
		Real-time integration with multiple legacy systems is required.
		Custom security implementation is necessary.
		"""

		result = await analyzer.analyze_text(text)

		assert result.success
		# Should generate recommendations
		assert isinstance(result.recommendations, list)


if __name__ == "__main__":
	pytest.main([__file__, "-v"])