"""
Infrastructure Clients

This module provides clients for PJS shared infrastructure services:
- SearXNG: Metasearch engine for web search
- Firecrawl: Web scraping with JS rendering
- LiteLLM: AI gateway for LLM operations
- Temporal: Workflow orchestration
- Stalwart: Email notifications
- LLM Fallback Chain: Automatic failover between LLM providers
"""

from .searxng_client import SearXNGClient
from .firecrawl_client import FirecrawlClient
from .litellm_client import LiteLLMClient
from .temporal_client import TemporalClient, TemporalConfiguration
from .llm_fallback import (
	LLMFallbackChain,
	ProviderConfig,
	ProviderHealth,
	ProviderStatus,
	CircuitState,
	FallbackMetrics,
	get_fallback_chain,
	complete_with_fallback,
)

__all__ = [
	"SearXNGClient",
	"FirecrawlClient",
	"LiteLLMClient",
	"TemporalClient",
	"TemporalConfiguration",
	"LLMFallbackChain",
	"ProviderConfig",
	"ProviderHealth",
	"ProviderStatus",
	"CircuitState",
	"FallbackMetrics",
	"get_fallback_chain",
	"complete_with_fallback",
]