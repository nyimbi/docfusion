"""
Integration tests for Agent Memory Integration.

Tests verify that the Agent base class has memory_manager attribute
and that store_memory/recall_memory methods work correctly.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import os
import sys
import pytest
from datetime import datetime
from typing import Dict, Any, Set, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

# Import agent components directly to avoid circular imports
sys.path.insert(0, "/Users/nyimbiodero/src/pjs/docfusion/src")

from docfusion.agents.core.agent import (
	Agent,
	AgentConfig,
	AgentCapabilities,
	AgentState,
)
from docfusion.agents.core.messages import AgentMessage

from docfusion.agents.memory import (
	MemoryManager,
	MemoryConfig,
	MemoryType,
	MemoryScope,
	MemoryPriority,
	get_memory_manager,
	is_persistent_memory_enabled,
	reset_memory_manager,
)


class ConcreteTestAgent(Agent):
	"""Concrete implementation of Agent for testing."""

	def __init__(self, config: AgentConfig):
		super().__init__(config)
		self._processed_tasks = []

	async def process_task(self, task: Any) -> Any:
		"""Process a task."""
		self._processed_tasks.append(task)
		return {"status": "completed", "task": task}

	async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
		"""Handle a message."""
		return None

	def get_capabilities(self) -> List[str]:
		"""Return capabilities."""
		return ["test_capability"]

	async def evaluate_task_fit(self, task: Any) -> float:
		"""Evaluate task fit."""
		return 0.8


class TestFeatureFlag:
	"""Test suite for feature flag functionality."""

	@pytest.fixture(autouse=True)
	def setup_method(self):
		"""Set up test fixtures."""
		reset_memory_manager()
		os.environ.pop("PERSISTENT_MEMORY_ENABLED", None)
		os.environ.pop("DATABASE_URL", None)
		os.environ.pop("DEBUG", None)
		os.environ.pop("ENVIRONMENT", None)
		os.environ.pop("NODE_ENV", None)

	def test_feature_flag_disabled_by_default_in_debug(self):
		"""Test that persistent memory is disabled by default in debug mode."""
		os.environ["DEBUG"] = "true"
		reset_memory_manager()

		assert is_persistent_memory_enabled() is False

	def test_feature_flag_enabled_by_default_in_production(self):
		"""Test that persistent memory is enabled by default in production."""
		os.environ["ENVIRONMENT"] = "production"
		reset_memory_manager()

		assert is_persistent_memory_enabled() is True

	def test_feature_flag_explicit_true(self):
		"""Test that explicit PERSISTENT_MEMORY_ENABLED=true works."""
		os.environ["PERSISTENT_MEMORY_ENABLED"] = "true"
		reset_memory_manager()

		assert is_persistent_memory_enabled() is True

	def test_feature_flag_explicit_false(self):
		"""Test that explicit PERSISTENT_MEMORY_ENABLED=false works."""
		os.environ["PERSISTENT_MEMORY_ENABLED"] = "false"
		reset_memory_manager()

		assert is_persistent_memory_enabled() is False


class TestAgentBaseMemoryIntegration:
	"""Test suite for agent base class memory integration."""

	@pytest.fixture(autouse=True)
	def setup_method(self):
		"""Set up test fixtures."""
		reset_memory_manager()
		os.environ.pop("PERSISTENT_MEMORY_ENABLED", None)
		os.environ.pop("DATABASE_URL", None)
		os.environ.pop("DEBUG", None)

	@pytest.fixture
	def agent_config(self) -> AgentConfig:
		"""Create a basic agent configuration for testing."""
		return AgentConfig(
			name="Test Agent",
			description="Agent for testing memory integration",
			primary_role="tester",
			capabilities=AgentCapabilities(
				max_concurrent_tasks=2,
				expertise_domains=["testing"],
				supported_task_types=["test"],
			),
			memory_persistence=True,
			llm_model="test-model",
		)

	def test_agent_has_memory_manager_attribute(self, agent_config):
		"""Test that Agent base class has memory_manager attribute."""
		agent = ConcreteTestAgent(agent_config)

		assert hasattr(agent, "memory_manager")
		assert agent.memory_manager is None  # Not initialized until start()

	@pytest.mark.asyncio
	async def test_agent_store_memory_fallback_without_manager(self, agent_config):
		"""Test that store_memory falls back to working memory without manager."""
		agent = ConcreteTestAgent(agent_config)

		# Don't start the agent (no memory manager)
		result = await agent.store_memory("test_key", {"data": "test_value"})

		assert result is True
		assert agent.context.working_memory.get("test_key") == {"data": "test_value"}

	@pytest.mark.asyncio
	async def test_agent_recall_memory_fallback_without_manager(self, agent_config):
		"""Test that recall_memory falls back to working memory without manager."""
		agent = ConcreteTestAgent(agent_config)

		# Store in working memory directly
		agent.context.working_memory["test_key"] = "test_value"

		result = await agent.recall_memory("test_key")

		assert result == "test_value"

	@pytest.mark.asyncio
	async def test_agent_recall_memory_default_value(self, agent_config):
		"""Test that recall_memory returns default for missing keys."""
		agent = ConcreteTestAgent(agent_config)

		result = await agent.recall_memory("nonexistent_key", default="default_value")

		assert result == "default_value"

	@pytest.mark.asyncio
	async def test_store_memory_with_memory_types(self, agent_config):
		"""Test storing memory with different memory types."""
		agent = ConcreteTestAgent(agent_config)

		memory_types = [
			"working",
			"short_term",
			"long_term",
			"episodic",
			"semantic",
			"procedural",
		]

		for mem_type in memory_types:
			result = await agent.store_memory(
				f"key_{mem_type}",
				f"value_{mem_type}",
				memory_type=mem_type,
			)
			assert result is True, f"Failed to store with memory_type={mem_type}"

	@pytest.mark.asyncio
	async def test_store_memory_with_scope(self, agent_config):
		"""Test storing memory with different scopes."""
		agent = ConcreteTestAgent(agent_config)

		scopes = [
			"private",
			"crew",
			"swarm",
			"global",
			"project",
		]

		for scope in scopes:
			result = await agent.store_memory(
				f"key_scope_{scope}",
				f"value_scope_{scope}",
				scope=scope,
			)
			assert result is True, f"Failed to store with scope={scope}"

	@pytest.mark.asyncio
	async def test_store_memory_with_tags(self, agent_config):
		"""Test storing memory with tags."""
		agent = ConcreteTestAgent(agent_config)

		tags = {"test", "integration", "memory"}

		result = await agent.store_memory(
			"tagged_key",
			"tagged_value",
			tags=tags,
		)

		assert result is True

	@pytest.mark.asyncio
	async def test_store_memory_with_ttl(self, agent_config):
		"""Test storing memory with TTL."""
		agent = ConcreteTestAgent(agent_config)

		result = await agent.store_memory(
			"ttl_key",
			"ttl_value",
			ttl_seconds=3600,
		)

		assert result is True

	@pytest.mark.asyncio
	async def test_search_memories_fallback(self, agent_config):
		"""Test search_memories with fallback to in-memory."""
		agent = ConcreteTestAgent(agent_config)

		# Store some memories
		await agent.store_memory("search_key_1", "search_value_1")
		await agent.store_memory("search_key_2", "search_value_2")
		await agent.store_memory("other_key", "other_value")

		# Search for memories
		results = await agent.search_memories("search")

		assert len(results) >= 2
		assert any("search_key_1" in str(r) for r in results)

	@pytest.mark.asyncio
	async def test_memory_persistence_disabled(self, agent_config):
		"""Test that memory_persistence=False prevents memory manager initialization."""
		agent_config.memory_persistence = False

		with patch("docfusion.agents.core.agent.get_memory_manager") as mock_get_mm:
			agent = ConcreteTestAgent(agent_config)

			await agent.start()

			# get_memory_manager should not be called when memory_persistence is False
			mock_get_mm.assert_not_called()

			await agent.stop()

	@pytest.mark.asyncio
	async def test_agent_context_still_works(self, agent_config):
		"""Test that existing context methods still work after memory integration."""
		agent = ConcreteTestAgent(agent_config)

		# Test update_context (existing method)
		agent.update_context("test_context_key", "test_context_value")
		assert agent.get_context("test_context_key") == "test_context_value"

		# Test store_knowledge (existing method)
		agent.store_knowledge("test_knowledge_key", "test_knowledge_value")
		assert agent.retrieve_knowledge("test_knowledge_key") == "test_knowledge_value"


class TestMemoryManagerFactory:
	"""Test suite for memory manager factory functions."""

	@pytest.fixture(autouse=True)
	def setup_method(self):
		"""Reset state before each test."""
		reset_memory_manager()
		os.environ.pop("PERSISTENT_MEMORY_ENABLED", None)
		os.environ.pop("DATABASE_URL", None)
		os.environ.pop("DEBUG", None)

	@pytest.mark.asyncio
	async def test_get_memory_manager_returns_in_memory_by_default(self):
		"""Test that get_memory_manager returns in-memory manager by default."""
		os.environ["DEBUG"] = "true"  # Disable persistent memory
		reset_memory_manager()

		manager = await get_memory_manager(agent_id="test_agent")

		assert manager is not None
		assert isinstance(manager, MemoryManager)

	@pytest.mark.asyncio
	async def test_get_memory_manager_singleton_for_default_agent(self):
		"""Test that singleton pattern works for default agent."""
		os.environ["DEBUG"] = "true"
		reset_memory_manager()

		manager1 = await get_memory_manager()
		manager2 = await get_memory_manager()

		assert manager1 is manager2

	@pytest.mark.asyncio
	async def test_get_memory_manager_different_for_each_agent(self):
		"""Test that different agents get different managers."""
		os.environ["DEBUG"] = "true"
		reset_memory_manager()

		manager1 = await get_memory_manager(agent_id="agent_1")
		manager2 = await get_memory_manager(agent_id="agent_2")

		# They should have different agent_ids
		assert manager1.agent_id != manager2.agent_id


class TestMemoryIntegrationPerformance:
	"""Performance tests for memory integration."""

	@pytest.fixture(autouse=True)
	def setup_method(self):
		"""Set up test fixtures."""
		reset_memory_manager()
		os.environ.pop("PERSISTENT_MEMORY_ENABLED", None)
		os.environ.pop("DATABASE_URL", None)
		os.environ.pop("DEBUG", None)

	@pytest.fixture
	def agent_config(self) -> AgentConfig:
		"""Create a basic agent configuration for testing."""
		return AgentConfig(
			name="Performance Test Agent",
			description="Agent for performance testing",
			primary_role="tester",
			capabilities=AgentCapabilities(
				max_concurrent_tasks=2,
				expertise_domains=["testing"],
				supported_task_types=["test"],
			),
			memory_persistence=False,
			llm_model="test-model",
		)

	@pytest.mark.asyncio
	async def test_store_recall_performance(self, agent_config):
		"""Test that store/recall operations are reasonably fast."""
		import time

		agent = ConcreteTestAgent(agent_config)

		# Time store operations
		store_times = []
		for i in range(100):
			start = time.perf_counter()
			await agent.store_memory(f"perf_key_{i}", f"perf_value_{i}")
			store_times.append(time.perf_counter() - start)

		avg_store_time = sum(store_times) / len(store_times)

		# Store operations should be fast (< 10ms average for in-memory)
		assert avg_store_time < 0.01, \
			f"Average store time {avg_store_time*1000:.2f}ms exceeds 10ms"

		# Time recall operations
		recall_times = []
		for i in range(100):
			start = time.perf_counter()
			await agent.recall_memory(f"perf_key_{i}")
			recall_times.append(time.perf_counter() - start)

		avg_recall_time = sum(recall_times) / len(recall_times)

		# Recall operations should be fast (< 10ms average for in-memory)
		assert avg_recall_time < 0.01, \
			f"Average recall time {avg_recall_time*1000:.2f}ms exceeds 10ms"


if __name__ == "__main__":
	pytest.main([__file__, "-v"])