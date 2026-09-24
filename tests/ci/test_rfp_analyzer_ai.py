#!/usr/bin/env python3
"""AI narrative generation in RFPAnalyzer."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from docfusion.rfp.rfp_analyzer import (
	RFPAnalysisError,
	RFPAnalysisResult,
	RFPAnalyzer,
	create_rfp_analyzer,
)
from docfusion.rfp.requirement_extractor import Requirement, RequirementModality, RequirementType


@pytest.fixture
def sample_requirements():
	return [
		Requirement(
			text="Vendor shall provide 24/7 support",
			modality=RequirementModality.MANDATORY,
			requirement_type=RequirementType.FUNCTIONAL,
			confidence=0.9,
		),
		Requirement(
			text="Must support SSO via SAML",
			modality=RequirementModality.MANDATORY,
			requirement_type=RequirementType.SECURITY,
			confidence=0.95,
		),
	]


class TestAIAnalysis:
	"""Tests for AI-powered RFP analysis narratives."""

	@pytest.mark.asyncio
	async def test_ai_populates_narratives(self, sample_requirements):
		"""Test AI enhancement populates narrative fields when enabled."""
		analyzer = create_rfp_analyzer({"ai_enhancement": True})

		mock_response = MagicMock()
		mock_response.content = json.dumps({
			"compliance_narrative": "The RFP requires SOC 2 and GDPR compliance.",
			"risk_narrative": "Tight timeline and legacy integration pose risks.",
			"strategic_recommendations": "- Allocate senior engineers\n- Plan for certification delays",
		})

		with patch("docfusion.rfp.rfp_analyzer.complete_with_fallback", new_callable=AsyncMock) as mock_llm:
			mock_llm.return_value = mock_response
			result = await analyzer._analyze_with_ai(
				sample_requirements,
				"RFP text about support and security.",
			)

		assert result.compliance_narrative == "The RFP requires SOC 2 and GDPR compliance."
		assert result.risk_narrative == "Tight timeline and legacy integration pose risks."
		assert result.strategic_recommendations == "- Allocate senior engineers\n- Plan for certification delays"

	@pytest.mark.asyncio
	async def test_narratives_none_when_ai_disabled(self):
		"""Test narrative fields remain None when AI enhancement is disabled."""
		analyzer = create_rfp_analyzer({"ai_enhancement": False})

		with patch("docfusion.rfp.rfp_analyzer.complete_with_fallback", new_callable=AsyncMock) as mock_llm:
			result = await analyzer.analyze_text("RFP text.", {"text": "RFP text."})

		assert result.compliance_narrative is None
		assert result.risk_narrative is None
		assert result.strategic_recommendations is None
		mock_llm.assert_not_called()
		assert result.success is True

	@pytest.mark.asyncio
	async def test_ai_failure_graceful(self, sample_requirements):
		"""Test AI failure does not break rule-based analysis."""
		analyzer = create_rfp_analyzer({"ai_enhancement": True})

		with patch("docfusion.rfp.rfp_analyzer.complete_with_fallback", new_callable=AsyncMock) as mock_llm:
			mock_llm.side_effect = RuntimeError("LLM unavailable")
			result = await analyzer._analyze_with_ai(
				sample_requirements,
				"RFP text.",
			)

		assert isinstance(result, RFPAnalysisError)
		assert "LLM unavailable" in result.reason

	@pytest.mark.asyncio
	async def test_ai_parses_markdown_fences(self, sample_requirements):
		"""Test AI response wrapped in markdown code fences."""
		analyzer = create_rfp_analyzer({"ai_enhancement": True})

		mock_response = MagicMock()
		mock_response.content = (
			"```json\n"
			+ json.dumps({
				"compliance_narrative": "Compliance summary here.",
				"risk_narrative": "Risk summary here.",
				"strategic_recommendations": "Recommendations here.",
			})
			+ "\n```"
		)

		with patch("docfusion.rfp.rfp_analyzer.complete_with_fallback", new_callable=AsyncMock) as mock_llm:
			mock_llm.return_value = mock_response
			result = await analyzer._analyze_with_ai(
				sample_requirements,
				"RFP text.",
			)

		assert result.compliance_narrative == "Compliance summary here."
		assert result.risk_narrative == "Risk summary here."
		assert result.strategic_recommendations == "Recommendations here."

	@pytest.mark.asyncio
	async def test_ai_ignores_extra_keys(self, sample_requirements):
		"""Test AI response with extra keys only extracts expected fields."""
		analyzer = create_rfp_analyzer({"ai_enhancement": True})

		mock_response = MagicMock()
		mock_response.content = json.dumps({
			"compliance_narrative": "Valid compliance.",
			"risk_narrative": "Valid risk.",
			"strategic_recommendations": "Valid recommendations.",
			"unexpected_field": "should be ignored",
			"score": 42,
		})

		with patch("docfusion.rfp.rfp_analyzer.complete_with_fallback", new_callable=AsyncMock) as mock_llm:
			mock_llm.return_value = mock_response
			result = await analyzer._analyze_with_ai(
				sample_requirements,
				"RFP text.",
			)

		assert result.compliance_narrative == "Valid compliance."
		assert result.risk_narrative == "Valid risk."
		assert result.strategic_recommendations == "Valid recommendations."
		assert not hasattr(result, "unexpected_field")
		assert not hasattr(result, "score")

	@pytest.mark.asyncio
	async def test_ai_skips_empty_requirements(self):
		"""Test AI analysis skipped when no requirements extracted."""
		analyzer = create_rfp_analyzer({"ai_enhancement": True})

		with patch("docfusion.rfp.rfp_analyzer.complete_with_fallback", new_callable=AsyncMock) as mock_llm:
			result = await analyzer._analyze_with_ai([], "Hello world.")

		assert isinstance(result, RFPAnalysisError)
		assert "returned no data" in result.reason
		mock_llm.assert_not_called()

	def test_ai_model_result_fields_exist(self):
		"""Test RFPAnalysisResult model accepts new narrative fields."""
		result = RFPAnalysisResult(
			compliance_narrative="Test compliance",
			risk_narrative="Test risk",
			strategic_recommendations="Test recs",
		)
		assert result.compliance_narrative == "Test compliance"
		assert result.risk_narrative == "Test risk"
		assert result.strategic_recommendations == "Test recs"

	@pytest.mark.asyncio
	async def test_analyze_text_with_ai_integration(self):
		"""Test full analyze_text pipeline with AI enabled and requirements present."""
		analyzer = create_rfp_analyzer({"ai_enhancement": True})

		# Use text that contains clear requirements
		rfp_text = (
			"SECTION 1: REQUIREMENTS\n\n"
			"1.1. The vendor shall provide 24/7 technical support.\n"
			"1.2. The system must support single sign-on via SAML 2.0.\n"
			"1.3. The solution should include a mobile application.\n"
		)

		mock_response = MagicMock()
		mock_response.content = json.dumps({
			"compliance_narrative": "SOC 2 and GDPR compliance required.",
			"risk_narrative": "Integration complexity is moderate.",
			"strategic_recommendations": "Focus on security certifications.",
		})

		with patch("docfusion.rfp.rfp_analyzer.complete_with_fallback", new_callable=AsyncMock) as mock_llm:
			mock_llm.return_value = mock_response
			result = await analyzer.analyze_text(rfp_text)

		assert result.success is True
		assert result.compliance_narrative == "SOC 2 and GDPR compliance required."
		assert result.risk_narrative == "Integration complexity is moderate."
		assert result.strategic_recommendations == "Focus on security certifications."
		assert len(result.requirements) > 0
		mock_llm.assert_called_once()


if __name__ == "__main__":
	pytest.main([__file__, "-v"])
