"""
LLM Fallback Chain

Provides automatic failover between LLM providers with circuit breaker pattern.
Supports Azure OpenAI, Anthropic Claude, and Ollama as fallback providers.

Architecture:
    The fallback chain maintains health status for each provider and automatically
    routes requests to healthy providers. Circuit breakers prevent cascading
    failures by temporarily disabling failing providers.

Usage:
    chain = LLMFallbackChain()

    # Complete with automatic fallback
    response = await chain.complete(
        messages=[{"role": "user", "content": "Analyze this RFP..."}],
        model="gpt-4o"
    )

    # Get metrics for monitoring
    metrics = chain.get_metrics()
    print(metrics["fallback_triggers"])  # Number of fallbacks
    print(metrics["provider_health"])   # Health status per provider

Circuit Breaker States:
    - CLOSED: Provider is healthy, requests flow normally
    - OPEN: Provider has failed threshold, requests blocked
    - HALF_OPEN: Recovery period, testing if provider is back

Default Provider Order:
    1. Azure OpenAI (gpt-4o, gpt-4o-mini) - Primary
    2. Anthropic Claude (claude-sonnet, claude-haiku) - Fallback
    3. Ollama (ollama-llama) - Final fallback (local)
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, AsyncGenerator

from .litellm_client import (
	ChatMessage,
	CompletionResponse,
	LiteLLMClient,
	Model,
)

logger = logging.getLogger(__name__)


class ProviderStatus(str, Enum):
	"""Health status of a provider."""
	HEALTHY = "healthy"
	DEGRADED = "degraded"
	UNHEALTHY = "unhealthy"


class CircuitState(str, Enum):
	"""Circuit breaker states."""
	CLOSED = "closed"  # Normal operation
	OPEN = "open"      # Failing, requests blocked
	HALF_OPEN = "half_open"  # Testing recovery


@dataclass
class ProviderHealth:
	"""Health tracking for a provider."""
	status: ProviderStatus = ProviderStatus.HEALTHY
	state: CircuitState = CircuitState.CLOSED
	last_check: datetime | None = None
	last_failure: datetime | None = None
	consecutive_failures: int = 0
	consecutive_successes: int = 0
	total_requests: int = 0
	total_failures: int = 0
	total_successes: int = 0

	@property
	def success_rate(self) -> float:
		"""Calculate success rate (0.0 to 1.0)."""
		if self.total_requests == 0:
			return 1.0
		return self.total_successes / self.total_requests

	@property
	def failure_rate(self) -> float:
		"""Calculate failure rate (0.0 to 1.0)."""
		return 1.0 - self.success_rate


@dataclass
class ProviderConfig:
	"""Configuration for a fallback provider."""
	name: str
	model: str
	priority: int = 0  # Lower is better
	timeout: float = 30.0
	max_retries: int = 3
	health_check_interval: int = 60  # seconds
	circuit_breaker_threshold: int = 5  # failures before open
	recovery_timeout: int = 300  # seconds before half-open

	# Optional custom endpoint (for non-LiteLLM providers)
	custom_url: str | None = None
	custom_key: str | None = None

	def __lt__(self, other: "ProviderConfig") -> bool:
		"""Sort by priority."""
		return self.priority < other.priority


@dataclass
class FallbackMetrics:
	"""Metrics for fallback chain monitoring."""
	total_requests: int = 0
	successful_requests: int = 0
	failed_requests: int = 0
	fallback_triggers: int = 0
	circuit_opens: int = 0
	circuit_closes: int = 0

	# Per-provider metrics
	provider_requests: dict[str, int] = field(default_factory=dict)
	provider_successes: dict[str, int] = field(default_factory=dict)
	provider_failures: dict[str, int] = field(default_factory=dict)

	# Timing metrics
	total_latency_ms: float = 0.0
	p99_latency_ms: float = 0.0
	latency_samples: list[float] = field(default_factory=list)

	def record_request(self, provider: str, success: bool, latency_ms: float) -> None:
		"""Record a request result."""
		self.total_requests += 1
		self.total_latency_ms += latency_ms
		self.latency_samples.append(latency_ms)

		# Keep last 1000 samples for P99
		if len(self.latency_samples) > 1000:
			self.latency_samples = self.latency_samples[-1000:]

		# Update P99
		if self.latency_samples:
			sorted_samples = sorted(self.latency_samples)
			p99_index = int(len(sorted_samples) * 0.99)
			self.p99_latency_ms = sorted_samples[min(p99_index, len(sorted_samples) - 1)]

		# Provider metrics
		if provider not in self.provider_requests:
			self.provider_requests[provider] = 0
			self.provider_successes[provider] = 0
			self.provider_failures[provider] = 0

		self.provider_requests[provider] += 1
		if success:
			self.successful_requests += 1
			self.provider_successes[provider] += 1
		else:
			self.failed_requests += 1
			self.provider_failures[provider] += 1

	@property
	def success_rate(self) -> float:
		"""Overall success rate."""
		if self.total_requests == 0:
			return 1.0
		return self.successful_requests / self.total_requests


class LLMFallbackChain:
	"""
	Manages LLM provider fallback with circuit breaker pattern.

	The fallback chain provides automatic failover between LLM providers,
	maintaining health status for each provider and using circuit breakers
	to prevent cascading failures.

	Attributes:
		providers: Ordered list of provider configurations
		health: Health status for each provider
		metrics: Fallback metrics for monitoring
		client: LiteLLM client for making requests

	Example:
		async with LLMFallbackChain() as chain:
			response = await chain.complete(
			 messages=[{"role": "user", "content": "Hello!"}]
			)
	"""

	# Default provider configurations
	DEFAULT_PROVIDERS: list[dict[str, Any]] = [
		{
			"name": "azure",
			"model": "gpt-4o",
			"priority": 0,
			"timeout": 30.0,
			"max_retries": 3,
		},
		{
			"name": "anthropic",
			"model": "claude-sonnet",
			"priority": 1,
			"timeout": 30.0,
			"max_retries": 3,
		},
		{
			"name": "ollama",
			"model": "ollama-llama",
			"priority": 2,
			"timeout": 60.0,
			"max_retries": 2,
		},
	]

	def __init__(
		self,
		providers: list[ProviderConfig] | None = None,
		client: LiteLLMClient | None = None,
		circuit_breaker_threshold: int = 5,
		recovery_timeout: int = 300,
		health_check_interval: int = 60,
	):
		"""
		Initialize fallback chain.

		Args:
			providers: Custom provider configurations (uses defaults if None)
			client: LiteLLM client instance (creates new if None)
			circuit_breaker_threshold: Failures before circuit opens
			recovery_timeout: Seconds before circuit enters half-open
			health_check_interval: Seconds between health checks
		"""
		self.providers = providers or self._get_default_providers()
		self.providers.sort()  # Sort by priority

		self._client = client
		self._owns_client = client is None

		self._circuit_breaker_threshold = circuit_breaker_threshold
		self._recovery_timeout = timedelta(seconds=recovery_timeout)
		self._health_check_interval = health_check_interval

		# Health tracking
		self.health: dict[str, ProviderHealth] = {
			p.name: ProviderHealth() for p in self.providers
		}

		# Metrics tracking
		self.metrics = FallbackMetrics()

		# Background health check task
		self._health_check_task: asyncio.Task[None] | None = None
		self._running = False

	@staticmethod
	def _get_default_providers() -> list[ProviderConfig]:
		"""Get default provider configurations from Azure → Anthropic → Ollama."""
		return [
			ProviderConfig(
				name=cfg["name"],
				model=cfg["model"],
				priority=cfg["priority"],
				timeout=cfg["timeout"],
				max_retries=cfg["max_retries"],
			)
			for cfg in LLMFallbackChain.DEFAULT_PROVIDERS
		]

	async def __aenter__(self) -> "LLMFallbackChain":
		"""Async context manager entry."""
		await self.start()
		return self

	async def __aexit__(
		self,
		exc_type: type[BaseException] | None,
		exc_val: BaseException | None,
		exc_tb: object | None,
	) -> None:
		"""Async context manager exit."""
		await self.stop()

	async def start(self) -> None:
		"""Start the fallback chain and health check background task."""
		if self._running:
			return

		self._running = True

		# Create client if needed
		if self._client is None:
			self._client = LiteLLMClient()

		# Start background health check
		self._health_check_task = asyncio.create_task(self._health_check_loop())

		logger.info(
			"LLMFallbackChain started",
			extra={"providers": [p.name for p in self.providers]}
		)

	async def stop(self) -> None:
		"""Stop the fallback chain and cleanup resources."""
		self._running = False

		if self._health_check_task:
			self._health_check_task.cancel()
			try:
				await self._health_check_task
			except asyncio.CancelledError:
				pass
			self._health_check_task = None

		# Close client if we own it
		if self._owns_client and self._client:
			await self._client.close()
			self._client = None

		logger.info("LLMFallbackChain stopped")

	@property
	def client(self) -> LiteLLMClient:
		"""Get or create the LiteLLM client."""
		if self._client is None:
			self._client = LiteLLMClient()
		return self._client

	async def complete(
		self,
		messages: list[ChatMessage | dict[str, str]],
		model: str | Model | None = None,
		temperature: float = 0.7,
		max_tokens: int | None = None,
		**kwargs: Any,
	) -> CompletionResponse:
		"""
		Complete a chat request with automatic fallback.

		Attempts to complete the request using providers in priority order,
		automatically falling back to the next provider on failure.

		Args:
			messages: List of chat messages
			model: Preferred model (uses provider default if None)
			temperature: Sampling temperature (0-2)
			max_tokens: Maximum tokens to generate
			**kwargs: Additional parameters for the completion

		Returns:
			CompletionResponse with generated content

		Raises:
			RuntimeError: If all providers fail
		"""
		if not self._running:
			await self.start()

		start_time = time.monotonic()
		last_error: Exception | None = None

		# Get ordered providers (skip unhealthy ones with open circuits)
		available_providers = self._get_available_providers()

		if not available_providers:
			raise RuntimeError("No healthy providers available")

		for provider in available_providers:
			provider_health = self.health[provider.name]

			try:
				# Check circuit breaker state
				if provider_health.state == CircuitState.OPEN:
					# Check if recovery timeout has passed
					if provider_health.last_failure:
						elapsed = datetime.now() - provider_health.last_failure
						if elapsed < self._recovery_timeout:
							logger.debug(
								f"Skipping {provider.name}: circuit open",
								extra={"provider": provider.name}
							)
							continue
						else:
							# Enter half-open state
							provider_health.state = CircuitState.HALF_OPEN
							logger.info(
								f"Circuit half-open for {provider.name}",
								extra={"provider": provider.name}
							)

				# Determine model to use
				use_model = model if model else provider.model
				if isinstance(use_model, Model):
					use_model = use_model.value

				# Make the request
				response = await self._make_request(
					provider=provider,
					messages=messages,
					model=use_model,
					temperature=temperature,
					max_tokens=max_tokens,
					**kwargs,
				)

				# Record success
				self._record_success(provider.name, start_time)

				return response

			except Exception as e:
				last_error = e
				self._record_failure(provider.name, start_time)
				logger.warning(
					f"Provider {provider.name} failed: {e}",
					extra={"provider": provider.name, "error": str(e)}
				)

				# Track fallback trigger
				self.metrics.fallback_triggers += 1

				# Continue to next provider
				continue

		# All providers failed
		raise RuntimeError(
			f"All providers failed. Last error: {last_error}"
		) from last_error

	async def _make_request(
		self,
		provider: ProviderConfig,
		messages: list[ChatMessage | dict[str, str]],
		model: str,
		temperature: float,
		max_tokens: int | None,
		**kwargs: Any,
	) -> CompletionResponse:
		"""Make a completion request to a specific provider."""
		# For LiteLLM, all requests go through the same endpoint
		# The model name determines routing
		return await self.client.chat_completion(
			model=model,
			messages=messages,
			temperature=temperature,
			max_tokens=max_tokens,
			timeout=provider.timeout,
			**kwargs,
		)

	def _get_available_providers(self) -> list[ProviderConfig]:
		"""Get providers sorted by priority, filtering out open circuits."""
		available = []

		for provider in self.providers:
			health = self.health[provider.name]

			# Include provider unless circuit is fully open
			if health.state != CircuitState.OPEN:
				available.append(provider)
			elif health.last_failure:
				# Check if we should transition to half-open
				elapsed = datetime.now() - health.last_failure
				if elapsed >= self._recovery_timeout:
					available.append(provider)

		return available

	def _record_success(self, provider: str, start_time: float) -> None:
		"""Record a successful request."""
		latency_ms = (time.monotonic() - start_time) * 1000
		health = self.health.get(provider)

		if health:
			health.consecutive_failures = 0
			health.consecutive_successes += 1
			health.total_requests += 1
			health.total_successes += 1
			health.last_check = datetime.now()

			# Close circuit on successful request in half-open state
			if health.state == CircuitState.HALF_OPEN:
				health.state = CircuitState.CLOSED
				self.metrics.circuit_closes += 1
				logger.info(
					f"Circuit closed for {provider}",
					extra={"provider": provider}
				)

		self.metrics.record_request(provider, True, latency_ms)

	def _record_failure(self, provider: str, start_time: float) -> None:
		"""Record a failed request."""
		latency_ms = (time.monotonic() - start_time) * 1000
		health = self.health.get(provider)

		if health:
			health.consecutive_successes = 0
			health.consecutive_failures += 1
			health.total_requests += 1
			health.total_failures += 1
			health.last_failure = datetime.now()

			# Open circuit if threshold reached
			if (
				health.consecutive_failures >= self._circuit_breaker_threshold
				and health.state == CircuitState.CLOSED
			):
				health.state = CircuitState.OPEN
				self.metrics.circuit_opens += 1
				logger.warning(
					f"Circuit opened for {provider} after {health.consecutive_failures} failures",
					extra={"provider": provider, "failures": health.consecutive_failures}
				)

		self.metrics.record_request(provider, False, latency_ms)

	async def health_check(self, provider_name: str | None = None) -> dict[str, ProviderStatus]:
		"""
		Check health of providers.

		Args:
			provider_name: Specific provider to check (all if None)

		Returns:
			Dictionary of provider name to health status
		"""
		if provider_name:
			providers_to_check = [p for p in self.providers if p.name == provider_name]
		else:
			providers_to_check = self.providers

		results = {}

		for provider in providers_to_check:
			try:
				# Simple health check - list models
				is_healthy = await self.client.health_check()

				if is_healthy:
					results[provider.name] = ProviderStatus.HEALTHY
					self._update_health_status(provider.name, ProviderStatus.HEALTHY)
				else:
					results[provider.name] = ProviderStatus.DEGRADED
					self._update_health_status(provider.name, ProviderStatus.DEGRADED)

			except Exception as e:
				logger.error(
					f"Health check failed for {provider.name}: {e}",
					extra={"provider": provider.name, "error": str(e)}
				)
				results[provider.name] = ProviderStatus.UNHEALTHY
				self._update_health_status(provider.name, ProviderStatus.UNHEALTHY)

		return results

	def _update_health_status(self, provider: str, status: ProviderStatus) -> None:
		"""Update health status for a provider."""
		if provider in self.health:
			self.health[provider].status = status
			self.health[provider].last_check = datetime.now()

	async def _health_check_loop(self) -> None:
		"""Background task for periodic health checks."""
		while self._running:
			try:
				await asyncio.sleep(self._health_check_interval)
				await self.health_check()
			except asyncio.CancelledError:
				break
			except Exception as e:
				logger.error(f"Health check loop error: {e}")

	def get_metrics(self) -> dict[str, Any]:
		"""
		Get fallback metrics for monitoring.

		Returns:
			Dictionary with metrics:
			- total_requests: Total requests made
			- success_rate: Overall success rate
			- fallback_triggers: Number of times fallback was used
			- circuit_opens: Number of circuit breaker opens
			- circuit_closes: Number of circuit breaker closes
			- p99_latency_ms: P99 latency in milliseconds
			- provider_health: Health status per provider
			- provider_metrics: Detailed metrics per provider
		"""
		return {
			"total_requests": self.metrics.total_requests,
			"success_rate": self.metrics.success_rate,
			"fallback_triggers": self.metrics.fallback_triggers,
			"circuit_opens": self.metrics.circuit_opens,
			"circuit_closes": self.metrics.circuit_closes,
			"p99_latency_ms": self.metrics.p99_latency_ms,
			"provider_health": {
				name: {
					"status": health.status.value,
					"state": health.state.value,
					"consecutive_failures": health.consecutive_failures,
					"success_rate": health.success_rate,
					"last_check": health.last_check.isoformat() if health.last_check else None,
				}
				for name, health in self.health.items()
			},
			"provider_metrics": {
				name: {
					"requests": self.metrics.provider_requests.get(name, 0),
					"successes": self.metrics.provider_successes.get(name, 0),
					"failures": self.metrics.provider_failures.get(name, 0),
				}
				for name in self.health
			},
		}

	def get_provider_status(self, provider: str) -> ProviderHealth | None:
		"""
		Get health status for a specific provider.

		Args:
			provider: Provider name

		Returns:
			ProviderHealth or None if not found
		"""
		return self.health.get(provider)

	async def stream_completion(
		self,
		messages: list[ChatMessage | dict[str, str]],
		model: str | Model | None = None,
		temperature: float = 0.7,
		max_tokens: int | None = None,
		**kwargs: Any,
	) -> AsyncGenerator[str, None]:
		"""
		Stream completion with automatic fallback.

		Note: Streaming does not support automatic fallback mid-stream.
		If the streaming request fails, an exception is raised.

		Args:
			messages: List of chat messages
			model: Model to use (provider default if None)
			temperature: Sampling temperature
			max_tokens: Maximum tokens to generate
			**kwargs: Additional parameters

		Yields:
			Chunks of generated content

		Raises:
			RuntimeError: If streaming fails (no fallback support)
		"""
		if not self._running:
			await self.start()

		# Streaming doesn't support fallback mid-stream
		# Use the first available provider
		available_providers = self._get_available_providers()

		if not available_providers:
			raise RuntimeError("No healthy providers available")

		provider = available_providers[0]
		use_model = model if model else provider.model

		if isinstance(use_model, Model):
			use_model = use_model.value

		start_time = time.monotonic()

		try:
			async for chunk in self.client.stream_completion(
				model=use_model,
				messages=messages,
				temperature=temperature,
				max_tokens=max_tokens,
				**kwargs,
			):
				yield chunk

			# Record success after complete stream
			self._record_success(provider.name, start_time)

		except Exception as e:
			self._record_failure(provider.name, start_time)
			raise

	def reset_circuit(self, provider: str) -> bool:
		"""
		Manually reset a circuit breaker for a provider.

		Args:
			provider: Provider name

		Returns:
			True if reset, False if provider not found
		"""
		if provider not in self.health:
			return False

		health = self.health[provider]
		health.state = CircuitState.CLOSED
		health.consecutive_failures = 0
		health.status = ProviderStatus.HEALTHY

		logger.info(f"Circuit manually reset for {provider}")
		return True


# Singleton instance
_default_chain: LLMFallbackChain | None = None


async def get_fallback_chain() -> LLMFallbackChain:
	"""Get or create the default fallback chain."""
	global _default_chain
	if _default_chain is None:
		_default_chain = LLMFallbackChain()
		await _default_chain.start()
	return _default_chain


async def complete_with_fallback(
	messages: list[ChatMessage | dict[str, str]],
	model: str | Model | None = None,
	**kwargs: Any,
) -> CompletionResponse:
	"""
	Convenience function for completion with default fallback chain.

	Args:
		messages: List of chat messages
		model: Model to use
		**kwargs: Additional parameters

	Returns:
		CompletionResponse
	"""
	chain = await get_fallback_chain()
	return await chain.complete(messages=messages, model=model, **kwargs)