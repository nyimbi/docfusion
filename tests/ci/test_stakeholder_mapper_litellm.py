#!/usr/bin/env python3
"""Ensure StakeholderMapper uses LiteLLM, not direct Ollama."""

import inspect
import json

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from docfusion.rfp.stakeholder_mapper import StakeholderMapper, StakeholderRole


def test_no_direct_ollama_in_source():
	"""Verify StakeholderMapper source has no hardcoded Ollama references."""
	source = inspect.getsource(StakeholderMapper)
	assert "localhost:11434" not in source
	assert "/api/generate" not in source
	assert "ollama_client" not in source


class TestLiteLLMRouting:
	"""Tests for LiteLLM routing in StakeholderMapper."""

	@pytest.mark.asyncio
	async def test_maps_stakeholders_via_litellm(self):
		"""Test stakeholder extraction routes through complete_with_fallback."""
		mapper = StakeholderMapper({"use_ai_enhancement": True})

		mock_response = MagicMock()
		mock_response.content = json.dumps({
			"stakeholders": [
				{
					"name": "Alice Smith",
					"roles": ["project_manager"],
					"organization": "Acme Corp",
					"title": "Senior PM",
					"email": "alice@acme.com",
					"phone": None,
					"confidence": 0.92,
					"context": "oversees delivery",
				}
			],
			"organizations": ["Acme Corp"],
			"relationships": [],
			"analysis": {
				"total_stakeholders": 1,
				"dominant_roles": ["project_manager"],
				"key_organizations": ["Acme Corp"],
			},
		})

		text = "The project manager, Alice Smith, will oversee delivery. The CTO approves."

		with patch("docfusion.rfp.stakeholder_mapper.complete_with_fallback", new_callable=AsyncMock) as mock_llm:
			mock_llm.return_value = mock_response
			result = await mapper.extract_stakeholders(text)

		assert len(result.stakeholders) >= 1
		mock_llm.assert_called()
		# Verify the call used gpt-4o-mini
		call_kwargs = mock_llm.call_args.kwargs
		assert call_kwargs.get("model") == "gpt-4o-mini"

	@pytest.mark.asyncio
	async def test_ai_failure_falls_back_to_patterns(self):
		"""Test that AI failure still returns pattern-based results."""
		mapper = StakeholderMapper({"use_ai_enhancement": True})

		text = "Contact John Doe, Program Manager at NASA, john.doe@nasa.gov for questions."

		with patch("docfusion.rfp.stakeholder_mapper.complete_with_fallback", new_callable=AsyncMock) as mock_llm:
			mock_llm.side_effect = RuntimeError("LLM unavailable")
			result = await mapper.extract_stakeholders(text)

		# Should still find stakeholders via pattern matching
		assert len(result.stakeholders) >= 1
		names = [s.name for s in result.stakeholders]
		# Pattern matcher may include surrounding text in the name
		assert any("John Doe" in n for n in names)

	@pytest.mark.asyncio
	async def test_ai_disabled_skips_llm(self):
		"""Test that AI enhancement disabled skips LLM calls entirely."""
		mapper = StakeholderMapper({"use_ai_enhancement": False})

		text = "Alice Smith is the project manager."

		with patch("docfusion.rfp.stakeholder_mapper.complete_with_fallback", new_callable=AsyncMock) as mock_llm:
			result = await mapper.extract_stakeholders(text)

		mock_llm.assert_not_called()
		assert len(result.stakeholders) >= 0

	def test_config_uses_ai_model_not_ollama(self):
		"""Verify default config uses ai_model instead of ollama_model."""
		mapper = StakeholderMapper()
		assert "ollama_model" not in mapper.config
		assert "ollama_base_url" not in mapper.config
		assert mapper.config.get("ai_model") == "gpt-4o-mini"

	@pytest.mark.asyncio
	async def test_close_does_not_raise(self):
		"""Test close() is safe after LiteLLM refactor."""
		mapper = StakeholderMapper()
		await mapper.close()
		# Should not raise


if __name__ == "__main__":
	pytest.main([__file__, "-v"])
