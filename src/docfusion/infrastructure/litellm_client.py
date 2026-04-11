"""
LiteLLM Client

Client for LiteLLM AI gateway running on PJS infrastructure.
Provides OpenAI-compatible API that routes to multiple LLM providers.

Server: Configured via LITELLM_URL environment variable
Key: Configured via LITELLM_KEY environment variable (use SecretsManager)

Usage:
    async with LiteLLMClient() as client:
        response = await client.chat_completion(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hello!"}]
        )
        print(response.content)

        # Streaming
        async for chunk in client.stream_completion("gpt-4o", messages):
            print(chunk, end="")

    # Application shutdown - close singleton session
    await LiteLLMClient.close_session()
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Any, AsyncGenerator

# Import secrets manager for centralized configuration
from ..config.secrets import SecretsManager

# Optional dependencies - handled at runtime with availability checks
if TYPE_CHECKING:
	import aiohttp  # type: ignore[import-not-found]
	import httpx  # type: ignore[import-not-found]
else:
	aiohttp = None  # type: ignore[misc]
	httpx = None  # type: ignore[misc]

# Runtime availability flags
AIOHTTP_AVAILABLE = False
HTTPX_AVAILABLE = False

try:
	import aiohttp as _aiohttp_runtime  # type: ignore[import-not-found]
	AIOHTTP_AVAILABLE = True
	if not TYPE_CHECKING:
		aiohttp = _aiohttp_runtime  # type: ignore[misc]
except ImportError:
	pass

try:
	import httpx as _httpx_runtime  # type: ignore[import-not-found]
	HTTPX_AVAILABLE = True
	if not TYPE_CHECKING:
		httpx = _httpx_runtime  # type: ignore[misc]
except ImportError:
	pass

logger = logging.getLogger(__name__)


class Model(str, Enum):
	"""Available models through LiteLLM."""
	# Azure OpenAI
	GPT_4O = "gpt-4o"
	GPT_4O_MINI = "gpt-4o-mini"

	# Anthropic
	CLAUDE_SONNET = "claude-sonnet"
	CLAUDE_HAIKU = "claude-haiku"

	# Local
	OLLAMA_LLAMA = "ollama-llama"

	# Embeddings
	TEXT_EMBEDDING_ADA = "text-embedding-ada-002"


def _get_default_timeout() -> int:
	"""Get default timeout via SecretsManager or return 120 seconds."""
	return SecretsManager.get_litellm_timeout()


@dataclass
class ChatMessage:
	"""Chat message."""
	role: str  # system, user, assistant
	content: str
	name: str | None = None

	def to_dict(self) -> dict[str, str]:
		"""Convert to dictionary."""
		result = {"role": self.role, "content": self.content}
		if self.name:
			result["name"] = self.name
		return result


@dataclass
class CompletionResponse:
	"""Response from chat completion."""
	id: str
	model: str
	content: str
	role: str = "assistant"
	finish_reason: str = "stop"
	usage: dict[str, int] = field(default_factory=dict)

	@classmethod
	def from_dict(cls, data: dict[str, Any]) -> "CompletionResponse":
		"""Create from API response."""
		choices = data.get("choices", [{}])
		message = choices[0].get("message", {}) if choices else {}

		return cls(
			id=data.get("id", ""),
			model=data.get("model", ""),
			content=message.get("content", ""),
			role=message.get("role", "assistant"),
			finish_reason=choices[0].get("finish_reason", "stop"),
			usage=data.get("usage", {}),
		)


@dataclass
class EmbeddingResponse:
	"""Response from embedding."""
	object: str = "list"
	data: list[dict[str, Any]] = field(default_factory=list)
	model: str = ""
	usage: dict[str, int] = field(default_factory=dict)


@dataclass
class ModelInfo:
	"""Model information."""
	id: str
	object: str = "model"
	created: int = 0
	owned_by: str = "litellm"


class LiteLLMClient:
	"""
	Async client for LiteLLM AI gateway with connection pooling.

	LiteLLM provides an OpenAI-compatible API that routes to multiple
	LLM providers (Azure OpenAI, Anthropic, Ollama) with caching
	via Redis and automatic failover.

	Uses aiohttp with connection pooling for efficient resource management.
	The singleton session is reused across instances and must be closed
	during application shutdown via `await LiteLLMClient.close_session()`.

	Attributes:
		base_url: LiteLLM server URL
		api_key: API key
		timeout: Request timeout in seconds

	Example:
		async with LiteLLMClient() as client:
			response = await client.chat_completion(
                model="gpt-4o",
                messages=[{"role": "user", "content": "Analyze this RFP..."}]
            )
			print(response.content)

		# Application shutdown
		await LiteLLMClient.close_session()
	"""

	# Class-level singleton session with connection pooling
	_session: "aiohttp.ClientSession | None" = None
	_session_lock: "asyncio.Lock | None" = None

	@classmethod
	def _get_session_lock(cls) -> asyncio.Lock:
		"""Lazy-initialize session lock to avoid creating Lock outside event loop."""
		if cls._session_lock is None:
			cls._session_lock = asyncio.Lock()
		return cls._session_lock

	def __init__(
		self,
		base_url: str | None = None,
		api_key: str | None = None,
		timeout: int | None = None,
	):
		self.base_url = (base_url or SecretsManager.get_litellm_url()).rstrip("/")
		self.api_key = api_key or SecretsManager.get_litellm_key()
		self.timeout = timeout or _get_default_timeout()
		self._httpx_client: "httpx.AsyncClient | None" = None

	async def __aenter__(self) -> "LiteLLMClient":
		"""Async context manager entry - initializes or reuses singleton session."""
		await self._ensure_session()
		return self

	async def __aexit__(
		self,
		exc_type: type[BaseException] | None,
		exc_val: BaseException | None,
		exc_tb: object,
	) -> None:
		"""Async context manager exit - session persists for reuse."""
		# Don't close session in singleton - it will be reused
		# Session must be closed via close_session() during application shutdown
		pass

	async def _ensure_session(self) -> None:
		"""Ensure aiohttp session exists with connection pooling."""
		if not AIOHTTP_AVAILABLE:
			raise RuntimeError(
				"aiohttp is required for LiteLLMClient. "
				"Install with: pip install aiohttp"
			)
		async with self._get_session_lock():
			if self._session is None or self._session.closed:
				# Create session with connection pooling
				connector = aiohttp.TCPConnector(
					limit=100,  # Total connection pool size
					limit_per_host=10,  # Per-host connection limit
					ttl_dns_cache=300,  # DNS cache TTL
					enable_cleanup_closed=True,  # Clean up closed connections
				)
				self._session = aiohttp.ClientSession(
					timeout=aiohttp.ClientTimeout(total=self.timeout),
					connector=connector,
				)

	@property
	def client(self) -> "httpx.AsyncClient":
		"""Get or create HTTP client (httpx fallback for streaming)."""
		if not HTTPX_AVAILABLE:
			raise RuntimeError(
				"httpx is required for LiteLLMClient. "
				"Install with: pip install httpx"
			)
		if self._httpx_client is None:
			self._httpx_client = httpx.AsyncClient(timeout=self.timeout)
		return self._httpx_client

	@classmethod
	async def close_session(cls) -> None:
		"""
		Close the singleton session during application shutdown.

		Call this method during application shutdown to properly
		release all connections and resources.
		"""
		async with cls._get_session_lock():
			if cls._session and not cls._session.closed:
				await cls._session.close()
				cls._session = None

	def _get_headers(self) -> dict[str, str]:
		"""Get request headers with auth."""
		return {
			"Content-Type": "application/json",
			"Authorization": f"Bearer {self.api_key}",
		}

	async def chat_completion(
		self,
		model: str | Model,
		messages: list[ChatMessage | dict[str, str]],
		temperature: float = 0.7,
		max_tokens: int | None = None,
		top_p: float = 1.0,
		stream: bool = False,
		**kwargs,
	) -> CompletionResponse:
		"""
		Create a chat completion.

		Args:
			model: Model to use (gpt-4o, claude-sonnet, etc.)
			messages: List of chat messages
			temperature: Sampling temperature (0-2)
			max_tokens: Maximum tokens to generate
			top_p: Top-p sampling
			stream: Whether to stream response
			**kwargs: Additional parameters

		Returns:
			CompletionResponse with generated content

		Raises:
			httpx.HTTPError: On network/HTTP errors
		"""
		if isinstance(model, Model):
			model = model.value

		formatted_messages = [
			m.to_dict() if isinstance(m, ChatMessage) else m
			for m in messages
		]

		payload = {
			"model": model,
			"messages": formatted_messages,
			"temperature": temperature,
			"top_p": top_p,
			"stream": stream,
		}

		if max_tokens:
			payload["max_tokens"] = max_tokens

		payload.update(kwargs)

		response = await self.client.post(
			f"{self.base_url}/v1/chat/completions",
			json=payload,
			headers=self._get_headers(),
		)
		response.raise_for_status()

		data = response.json()
		return CompletionResponse.from_dict(data)

	async def stream_completion(
		self,
		model: str | Model,
		messages: list[ChatMessage | dict[str, str]],
		temperature: float = 0.7,
		max_tokens: int | None = None,
		**kwargs,
	) -> AsyncGenerator[str, None]:
		"""
		Stream chat completion.

		Args:
			model: Model to use
			messages: List of chat messages
			temperature: Sampling temperature
			max_tokens: Maximum tokens to generate
			**kwargs: Additional parameters

		Yields:
			Chunks of generated content
		"""
		if isinstance(model, Model):
			model = model.value

		formatted_messages = [
			m.to_dict() if isinstance(m, ChatMessage) else m
			for m in messages
		]

		payload = {
			"model": model,
			"messages": formatted_messages,
			"temperature": temperature,
			"stream": True,
		}

		if max_tokens:
			payload["max_tokens"] = max_tokens

		payload.update(kwargs)

		async with self.client.stream(
			"POST",
			f"{self.base_url}/v1/chat/completions",
			json=payload,
			headers=self._get_headers(),
		) as response:
			async for line in response.aiter_lines():
				if not line:
					continue
				if line.startswith("data: "):
					data = line[6:]
					if data == "[DONE]":
						break
					try:
						chunk = json.loads(data)
						content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
						if content:
							yield content
					except json.JSONDecodeError:
						continue

	async def embeddings(
		self,
		model: str | Model,
		input: str | list[str],
	) -> EmbeddingResponse:
		"""
		Generate embeddings for text.

		Args:
			model: Embedding model (text-embedding-ada-002)
			input: Text or list of texts to embed

		Returns:
			EmbeddingResponse with vectors
		"""
		if isinstance(model, Model):
			model = model.value

		payload = {
			"model": model,
			"input": input,
		}

		response = await self.client.post(
			f"{self.base_url}/v1/embeddings",
			json=payload,
			headers=self._get_headers(),
		)
		response.raise_for_status()

		data = response.json()
		return EmbeddingResponse(
			object=data.get("object", "list"),
			data=data.get("data", []),
			model=data.get("model", model),
			usage=data.get("usage", {}),
		)

	async def list_models(self) -> list[ModelInfo]:
		"""
		List available models.

		Returns:
			List of available models
		"""
		response = await self.client.get(
			f"{self.base_url}/v1/models",
			headers=self._get_headers(),
		)
		response.raise_for_status()

		data = response.json()
		return [
			ModelInfo(
				id=m.get("id", ""),
				object=m.get("object", "model"),
				created=m.get("created", 0),
				owned_by=m.get("owned_by", "litellm"),
			)
			for m in data.get("data", [])
		]

	async def analyze_document(
		self,
		content: str,
		instructions: str = "Analyze this document and extract key information.",
		model: str | Model = Model.GPT_4O_MINI,
	) -> dict[str, Any]:
		"""
		Analyze document content with LLM.

		Args:
			content: Document content to analyze
			instructions: Analysis instructions
			model: Model to use

		Returns:
			Parsed JSON response
		"""
		response = await self.chat_completion(
			model=model,
			messages=[
				{"role": "system", "content": instructions},
				{"role": "user", "content": content},
			],
			temperature=0.3,  # Lower temperature for more consistent output
		)

		# Try to parse as JSON
		try:
			# Remove markdown code blocks if present
			content = response.content.strip()
			if content.startswith("```json"):
				content = content[7:]
			if content.startswith("```"):
				content = content[3:]
			if content.endswith("```"):
				content = content[:-3]
			return json.loads(content.strip())
		except json.JSONDecodeError:
			return {"content": response.content}

	async def health_check(self) -> bool:
		"""
		Check if LiteLLM is accessible.

		Returns:
			True if health check passes
		"""
		try:
			response = await self.client.get(
				f"{self.base_url}/health",
				timeout=10.0,
			)
			return response.status_code == 200
		except Exception as e:
			logger.warning(f"LiteLLM health check failed: {e}")
			return False

	async def close(self) -> None:
		"""Close the httpx client (aiohttp session managed at class level)."""
		if self._httpx_client:
			await self._httpx_client.aclose()
			self._httpx_client = None

	@classmethod
	async def get_session(cls) -> "aiohttp.ClientSession":
		"""
		Get the singleton session, creating if necessary.

		Use this for direct access to the shared session.
		"""
		if not AIOHTTP_AVAILABLE:
			raise RuntimeError(
				"aiohttp is required for LiteLLMClient. "
				"Install with: pip install aiohttp"
			)
		async with cls._get_session_lock():
			if cls._session is None or cls._session.closed:
				connector = aiohttp.TCPConnector(
					limit=100,
					limit_per_host=10,
					ttl_dns_cache=300,
					enable_cleanup_closed=True,
				)
				cls._session = aiohttp.ClientSession(
					timeout=aiohttp.ClientTimeout(total=_get_default_timeout()),
					connector=connector,
				)
			return cls._session


# Singleton instance (deprecated - use context manager pattern)
_default_client: LiteLLMClient | None = None


async def get_litellm_client() -> LiteLLMClient:
	"""
	Get or create the default LiteLLM client.

	Note: Prefer using async with LiteLLMClient() context manager
	for proper resource management. The singleton pattern is kept
	for backward compatibility.
	"""
	global _default_client
	if _default_client is None:
		_default_client = LiteLLMClient()
		await _default_client._ensure_session()
	return _default_client


async def close_litellm_client() -> None:
	"""
	Close the singleton client session during application shutdown.

	This should be called during application shutdown to properly
	release all connections and resources.
	"""
	await LiteLLMClient.close_session()