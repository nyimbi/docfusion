#!/usr/bin/env python3
"""Defaults for BaseAgent so subclasses don't need to reimplement trivial hooks."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from docfusion.agents.core.agent import Agent, AgentConfig


def _make_config(**kwargs):
	defaults = {
		"name": "TinyAgent",
		"description": "A tiny agent for testing",
		"primary_role": "tester",
	}
	defaults.update(kwargs)
	return AgentConfig(**defaults)


class TinyAgent(Agent):
	"""Minimal concrete agent for testing defaults."""

	pass


class TestAgentDefaults:
	"""Tests for Agent default method implementations."""

	@pytest.mark.asyncio
	async def test_process_task_completes_with_llm(self):
		"""Test default process_task completes when LLM is available."""
		config = _make_config()
		agent = TinyAgent(config)
		agent.llm_client = MagicMock()
		agent.llm_client.generate = AsyncMock(return_value=MagicMock(content="hello"))

		result = await agent.process_task({"id": "t1", "prompt": "say hi"})

		assert result["status"] == "completed"
		assert result["task_id"] == "t1"
		assert result["result"] == "hello"

	@pytest.mark.asyncio
	async def test_process_task_fails_gracefully_without_llm(self):
		"""Test default process_task fails gracefully when LLM is unavailable."""
		config = _make_config()
		agent = TinyAgent(config)
		agent.llm_client = None

		result = await agent.process_task({"id": "t2", "prompt": "say hi"})

		assert result["status"] == "completed"
		assert result["result"] == "LLM client not available"

	@pytest.mark.asyncio
	async def test_handle_ping_returns_pong(self):
		"""Test ping message returns pong response."""
		config = _make_config()
		agent = TinyAgent(config)
		response = await agent.handle_message({"type": "ping"})

		assert response == {"type": "pong", "sender": agent.agent_id}

	@pytest.mark.asyncio
	async def test_handle_capability_query_returns_capabilities(self):
		"""Test capability_query message returns capabilities."""
		config = _make_config()
		agent = TinyAgent(config)
		agent.capabilities = ["writer", "editor"]
		response = await agent.handle_message({"type": "capability_query"})

		assert response == {"type": "capability_response", "capabilities": ["writer", "editor"]}

	@pytest.mark.asyncio
	async def test_handle_unknown_message_returns_none(self):
		"""Test unknown message type returns None by default."""
		config = _make_config()
		agent = TinyAgent(config)
		response = await agent.handle_message({"type": "unknown_xyz"})

		assert response is None

	def test_get_capabilities_returns_set_capabilities(self):
		"""Test get_capabilities reads from instance attribute."""
		config = _make_config()
		agent = TinyAgent(config)
		agent.capabilities = ["writer", "editor"]
		caps = agent.get_capabilities()

		assert caps == ["writer", "editor"]

	def test_get_capabilities_empty_when_none(self):
		"""Test get_capabilities returns empty list when none set."""
		config = _make_config()
		agent = TinyAgent(config)
		caps = agent.get_capabilities()

		assert caps == []

	def test_evaluate_task_fit_perfect_match(self):
		"""Test perfect capability match returns 1.0."""
		config = _make_config()
		agent = TinyAgent(config)
		agent.capabilities = ["writer"]
		score = agent.evaluate_task_fit({"required_capabilities": ["writer"]})

		assert score == 1.0

	def test_evaluate_task_fit_partial_match(self):
		"""Test partial capability overlap returns score between 0 and 1."""
		config = _make_config()
		agent = TinyAgent(config)
		agent.capabilities = ["writer", "editor"]
		score = agent.evaluate_task_fit({"required_capabilities": ["writer"]})

		assert 0.0 < score < 1.0

	def test_evaluate_task_fit_no_overlap(self):
		"""Test no capability overlap returns 0.0."""
		config = _make_config()
		agent = TinyAgent(config)
		agent.capabilities = ["writer"]
		score = agent.evaluate_task_fit({"required_capabilities": ["reviewer"]})

		assert score == 0.0

	def test_evaluate_task_fit_no_required(self):
		"""Test no required capabilities returns default 0.5."""
		config = _make_config()
		agent = TinyAgent(config)
		agent.capabilities = ["writer"]
		score = agent.evaluate_task_fit({})

		assert score == 0.5

	def test_evaluate_task_fit_no_capabilities(self):
		"""Test agent with no capabilities returns 0.0."""
		config = _make_config()
		agent = TinyAgent(config)
		score = agent.evaluate_task_fit({"required_capabilities": ["writer"]})

		assert score == 0.0

	@pytest.mark.asyncio
	async def test_ollama_fallback_close_noop(self):
		"""Test Ollama fallback close does not raise."""
		from docfusion.agents.core.agent import OllamaClient

		client = OllamaClient()
		await client.close()  # Should not raise


if __name__ == "__main__":
	pytest.main([__file__, "-v"])
