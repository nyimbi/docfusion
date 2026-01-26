"""
LLM Integration Module

Provides language model integration for the agent system, with default
support for Ollama-served models.
"""

from .ollama_client import (
    OllamaClient,
    OllamaConfig, 
    OllamaMessage,
    OllamaResponse,
    get_default_client,
    generate_with_ollama
)

__all__ = [
    "OllamaClient",
    "OllamaConfig",
    "OllamaMessage", 
    "OllamaResponse",
    "get_default_client",
    "generate_with_ollama"
]