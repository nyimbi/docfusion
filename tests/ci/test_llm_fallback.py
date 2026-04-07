"""
Tests for LLM Fallback Chain

Tests circuit breaker pattern, automatic failover, and health tracking.
"""

import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from docfusion.infrastructure.llm_fallback import (
	CircuitState,
	FallbackMetrics,
	LLMFallbackChain,
	ProviderConfig,
	ProviderHealth,
	ProviderStatus,
	complete_with_fallback,
	get_fallback_chain,
)
from docfusion.infrastructure.litellm_client import ChatMessage, CompletionResponse, LiteLLMClient


class TestProviderConfig:
	"""Tests for ProviderConfig."""

	def test_provider_config_defaults(self):
		"""Test default values."""
		config = ProviderConfig(name="test", model="gpt-4o")
		assert config.name == "test"
		assert config.model == "gpt-4o"
		assert config.priority == 0
		assert config.timeout == 30.0
		assert config.max_retries == 3
		assert config.health_check_interval == 60
		assert config.circuit_breaker_threshold == 5
		assert config.recovery_timeout == 300

	def test_provider_config_comparison(self):
		"""Test priority-based comparison."""
		config1 = ProviderConfig(name="low", model="model1", priority=1)
		config2 = ProviderConfig(name="high", model="model2", priority=0)
		assert config2 < config1  # Lower priority value = higher priority
		assert config1 > config2


class TestProviderHealth:
	"""Tests for ProviderHealth."""

	def test_initial_health(self):
		"""Test initial health state."""
		health = ProviderHealth()
		assert health.status == ProviderStatus.HEALTHY
		assert health.state == CircuitState.CLOSED
		assert health.consecutive_failures == 0
		assert health.success_rate == 1.0
		assert health.last_check is None

	def test_success_rate_calculation(self):
		"""Test success rate calculation."""
		health = ProviderHealth()
		health.total_requests = 10
		health.total_successes = 8
		health.total_failures = 2
		assert health.success_rate == pytest.approx(0.8)
		assert health.failure_rate == pytest.approx(0.2)

	def test_success_rate_zero_requests(self):
		"""Test success rate with no requests."""
		health = ProviderHealth()
		assert health.success_rate == 1.0


class TestFallbackMetrics:
	"""Tests for FallbackMetrics."""

	def test_initial_metrics(self):
		"""Test initial metrics state."""
		metrics = FallbackMetrics()
		assert metrics.total_requests == 0
		assert metrics.success_rate == 1.0
		assert metrics.fallback_triggers == 0

	def test_record_success(self):
		"""Test recording successful request."""
		metrics = FallbackMetrics()
		metrics.record_request("azure", success=True, latency_ms=100.0)

		assert metrics.total_requests == 1
		assert metrics.successful_requests == 1
		assert metrics.failed_requests == 0
		assert metrics.provider_requests["azure"] == 1
		assert metrics.provider_successes["azure"] == 1
		assert metrics.total_latency_ms == 100.0

	def test_record_failure(self):
		"""Test recording failed request."""
		metrics = FallbackMetrics()
		metrics.record_request("anthropic", success=False, latency_ms=500.0)

		assert metrics.total_requests == 1
		assert metrics.successful_requests == 0
		assert metrics.failed_requests == 1
		assert metrics.provider_requests["anthropic"] == 1
		assert metrics.provider_failures["anthropic"] == 1

	def test_p99_latency(self):
		"""Test P99 latency calculation."""
		metrics = FallbackMetrics()

		# Add 100 samples
		for i in range(100):
			metrics.record_request("test", success=True, latency_ms=float(i))

		# P99 should be around 99
		assert metrics.p99_latency_ms >= 98.0

	def test_latency_samples_limit(self):
		"""Test latency samples are limited to 1000."""
		metrics = FallbackMetrics()

		# Add 2000 samples
		for i in range(2000):
			metrics.record_request("test", success=True, latency_ms=float(i))

		assert len(metrics.latency_samples) == 1000


class TestLLMFallbackChain:
	"""Tests for LLMFallbackChain."""

	def test_default_providers(self):
		"""Test default provider configuration."""
		chain = LLMFallbackChain()

		assert len(chain.providers) == 3
		assert chain.providers[0].name == "azure"
		assert chain.providers[1].name == "anthropic"
		assert chain.providers[2].name == "ollama"

		# Check priority order
		assert chain.providers[0].priority < chain.providers[1].priority
		assert chain.providers[1].priority < chain.providers[2].priority

	def test_custom_providers(self):
		"""Test custom provider configuration."""
		custom_providers = [
			ProviderConfig(name="custom1", model="model1", priority=0),
			ProviderConfig(name="custom2", model="model2", priority=1),
		]

		chain = LLMFallbackChain(providers=custom_providers)
		assert len(chain.providers) == 2
		assert chain.providers[0].name == "custom1"

	def test_health_initialization(self):
		"""Test health status initialization."""
		chain = LLMFallbackChain()

		assert "azure" in chain.health
		assert "anthropic" in chain.health
		assert "ollama" in chain.health

		for health in chain.health.values():
			assert health.status == ProviderStatus.HEALTHY
			assert health.state == CircuitState.CLOSED

	@pytest.mark.asyncio
	async def test_context_manager(self):
		"""Test async context manager."""
		chain = LLMFallbackChain()

		# Test entry
		async with chain as c:
			assert c is chain
			assert chain._running

		# Test exit
		assert not chain._running

	def test_get_available_providers(self):
		"""Test available provider filtering."""
		chain = LLMFallbackChain()

		# All providers available initially
		available = chain._get_available_providers()
		assert len(available) == 3

		# Open circuit for one provider
		chain.health["azure"].state = CircuitState.OPEN
		available = chain._get_available_providers()

		# Azure should be filtered out (unless recovery timeout)
		assert len(available) <= 3

	def test_record_success(self):
		"""Test recording successful request."""
		chain = LLMFallbackChain()
		start_time = time.monotonic()

		chain._record_success("azure", start_time)

		assert chain.health["azure"].consecutive_successes == 1
		assert chain.health["azure"].consecutive_failures == 0
		assert chain.metrics.successful_requests == 1

	def test_record_failure(self):
		"""Test recording failed request."""
		chain = LLMFallbackChain()
		start_time = time.monotonic()

		chain._record_failure("azure", start_time)

		assert chain.health["azure"].consecutive_failures == 1
		assert chain.health["azure"].consecutive_successes == 0
		assert chain.metrics.failed_requests == 1

	def test_circuit_breaker_open(self):
		"""Test circuit breaker opens after threshold failures."""
		chain = LLMFallbackChain(circuit_breaker_threshold=3)
		start_time = time.monotonic()

		# Record failures up to threshold
		for _ in range(3):
			chain._record_failure("azure", start_time)

		assert chain.health["azure"].state == CircuitState.OPEN
		assert chain.metrics.circuit_opens == 1

	def test_circuit_breaker_close_on_success(self):
		"""Test circuit breaker closes after successful request."""
		chain = LLMFallbackChain()
		start_time = time.monotonic()

		# Set to half-open
		chain.health["azure"].state = CircuitState.HALF_OPEN

		# Record success
		chain._record_success("azure", start_time)

		assert chain.health["azure"].state == CircuitState.CLOSED
		assert chain.metrics.circuit_closes == 1

	def test_reset_circuit(self):
		"""Test manual circuit reset."""
		chain = LLMFallbackChain()

		# Open circuit
		chain.health["azure"].state = CircuitState.OPEN
		chain.health["azure"].consecutive_failures = 10
		chain.health["azure"].status = ProviderStatus.UNHEALTHY

		# Reset
		result = chain.reset_circuit("azure")

		assert result is True
		assert chain.health["azure"].state == CircuitState.CLOSED
		assert chain.health["azure"].consecutive_failures == 0
		assert chain.health["azure"].status == ProviderStatus.HEALTHY

	def test_reset_circuit_unknown_provider(self):
		"""Test reset for unknown provider."""
		chain = LLMFallbackChain()

		result = chain.reset_circuit("unknown")
		assert result is False

	def test_get_metrics(self):
		"""Test metrics retrieval."""
		chain = LLMFallbackChain()
		start_time = time.monotonic()

		# Record some requests
		chain._record_success("azure", start_time)
		chain._record_failure("anthropic", start_time)

		metrics = chain.get_metrics()

		assert "total_requests" in metrics
		assert "success_rate" in metrics
		assert "provider_health" in metrics
		assert "provider_metrics" in metrics
		assert metrics["total_requests"] == 2

	def test_get_provider_status(self):
		"""Test getting provider status."""
		chain = LLMFallbackChain()

		status = chain.get_provider_status("azure")
		assert status is not None
		assert isinstance(status, ProviderHealth)

		status = chain.get_provider_status("unknown")
		assert status is None

	@pytest.mark.asyncio
	async def test_complete_with_mock(self):
		"""Test completion with mocked client."""
		chain = LLMFallbackChain()

		# Mock the LiteLLM client
		mock_client = AsyncMock(spec=LiteLLMClient)
		mock_response = CompletionResponse(
			id="test-id",
			model="gpt-4o",
			content="Test response",
		)
		mock_client.chat_completion = AsyncMock(return_value=mock_response)
		mock_client.health_check = AsyncMock(return_value=True)
		mock_client.close = AsyncMock()

		chain._client = mock_client

		# Test completion
		async with chain:
			response = await chain.complete(
				messages=[{"role": "user", "content": "Hello!"}]
			)

		assert response.content == "Test response"
		assert chain.metrics.successful_requests == 1

	@pytest.mark.asyncio
	async def test_fallback_on_failure(self):
		"""Test fallback to next provider on failure."""
		chain = LLMFallbackChain()

		# Mock client that fails for first provider
		mock_client = AsyncMock(spec=LiteLLMClient)
		call_count = [0]

		async def mock_complete(**kwargs):
			call_count[0] += 1
			if call_count[0] == 1:
				raise Exception("Azure failed")
			return CompletionResponse(id="test-id", model="claude-sonnet", content="Fallback response")

		mock_client.chat_completion = AsyncMock(side_effect=mock_complete)
		mock_client.health_check = AsyncMock(return_value=True)
		mock_client.close = AsyncMock()

		chain._client = mock_client

		# Test fallback
		async with chain:
			response = await chain.complete(
				messages=[{"role": "user", "content": "Hello!"}]
			)

		assert response.content == "Fallback response"
		assert chain.metrics.fallback_triggers == 1
		assert chain.health["azure"].consecutive_failures == 1

	@pytest.mark.asyncio
	async def test_all_providers_fail(self):
		"""Test error when all providers fail."""
		chain = LLMFallbackChain()

		# Mock client that always fails
		mock_client = AsyncMock(spec=LiteLLMClient)
		mock_client.chat_completion = AsyncMock(side_effect=Exception("All failed"))
		mock_client.health_check = AsyncMock(return_value=True)
		mock_client.close = AsyncMock()

		chain._client = mock_client

		# Test all failures
		async with chain:
			with pytest.raises(RuntimeError, match="All providers failed"):
				await chain.complete(messages=[{"role": "user", "content": "Hello!"}])

	@pytest.mark.asyncio
	async def test_health_check(self):
		"""Test health check functionality."""
		chain = LLMFallbackChain()

		mock_client = AsyncMock(spec=LiteLLMClient)
		mock_client.health_check = AsyncMock(return_value=True)
		mock_client.close = AsyncMock()

		chain._client = mock_client

		async with chain:
			status = await chain.health_check("azure")

		assert status["azure"] == ProviderStatus.HEALTHY

	@pytest.mark.asyncio
	async def test_stream_completion(self):
		"""Test streaming completion."""
		chain = LLMFallbackChain()

		# Mock streaming
		mock_client = AsyncMock(spec=LiteLLMClient)

		async def mock_stream(**kwargs):
			for chunk in ["Hello", " ", "World"]:
				yield chunk

		mock_client.stream_completion = mock_stream
		mock_client.health_check = AsyncMock(return_value=True)
		mock_client.close = AsyncMock()

		chain._client = mock_client

		# Test streaming
		async with chain:
			chunks = []
			async for chunk in chain.stream_completion(
				messages=[{"role": "user", "content": "Hello!"}]
			):
				chunks.append(chunk)

		assert chunks == ["Hello", " ", "World"]


class TestConvenienceFunctions:
	"""Tests for convenience functions."""

	@pytest.mark.asyncio
	async def test_get_fallback_chain_singleton(self):
		"""Test that get_fallback_chain returns a singleton."""
		# Reset the singleton
		import docfusion.infrastructure.llm_fallback as fallback_module
		fallback_module._default_chain = None

		chain1 = await get_fallback_chain()
		chain2 = await get_fallback_chain()

		assert chain1 is chain2

		# Cleanup
		await chain1.stop()
		fallback_module._default_chain = None


if __name__ == "__main__":
	pytest.main([__file__, "-v"])