import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass
import aiohttp
from datetime import datetime

"""
Ollama LLM Client

Provides integration with Ollama-served language models for agent processing.
Configured by default to use Qwen2.5:1.5B model.

Author: Nyimbi Odero  
Company: Datacraft Ltd
Copyright (c) 2025
"""

@dataclass
class OllamaConfig:
	"""Configuration for Ollama client"""
	host: str = "http://localhost:11434"
	model: str = "qwen2.5:1.5b"
	temperature: float = 0.7
	max_tokens: int = 2048
	timeout_seconds: int = 30
	stream: bool = False

@dataclass
class OllamaMessage:
	"""Message for Ollama chat format"""
	role: str  # "system", "user", "assistant"
	content: str

@dataclass 
class OllamaResponse:
	"""Response from Ollama"""
	content: str
	model: str
	done: bool
	total_duration: Optional[int] = None
	load_duration: Optional[int] = None
	prompt_eval_count: Optional[int] = None
	eval_count: Optional[int] = None

class OllamaClient:
	"""
	Async client for Ollama LLM inference
	
	Provides a simple interface for agents to interact with Ollama-served
	language models, with built-in error handling and retry logic.
	"""
	
	def __init__(self, config: Optional[OllamaConfig] = None):
		self.config = config or OllamaConfig()
		self.logger = logging.getLogger("ollama_client")
		self.session: Optional[aiohttp.ClientSession] = None
		
	async def __aenter__(self):
		"""Async context manager entry"""
		self.session = aiohttp.ClientSession(
			timeout=aiohttp.ClientTimeout(total=self.config.timeout_seconds)
		)
		return self
		
	async def __aexit__(self, exc_type, exc_val, exc_tb):
		"""Async context manager exit"""
		if self.session:
			await self.session.close()
			
	async def _ensure_session(self):
		"""Ensure we have an active session"""
		if not self.session or self.session.closed:
			self.session = aiohttp.ClientSession(
				timeout=aiohttp.ClientTimeout(total=self.config.timeout_seconds)
			)
			
	async def health_check(self) -> bool:
		"""Check if Ollama is running and model is available"""
		try:
			await self._ensure_session()
			
			# Check if Ollama is running
			async with self.session.get(f"{self.config.host}/api/tags") as response:
				if response.status == 200:
					models = await response.json()
					model_names = [m["name"] for m in models.get("models", [])]
					
					if self.config.model in model_names:
						self.logger.info(f"Ollama health check passed - {self.config.model} available")
						return True
					else:
						self.logger.warning(f"Model {self.config.model} not found. Available: {model_names}")
						return False
				else:
					self.logger.error(f"Ollama not responding: {response.status}")
					return False
					
		except Exception as e:
			self.logger.error(f"Ollama health check failed: {e}")
			return False
			
	async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> OllamaResponse:
		"""Generate a response from Ollama"""
		try:
			await self._ensure_session()
			
			# Prepare the request
			messages = []
			if system_prompt:
				messages.append({"role": "system", "content": system_prompt})
			messages.append({"role": "user", "content": prompt})
			
			payload = {
				"model": self.config.model,
				"messages": messages,
				"stream": self.config.stream,
				"options": {
					"temperature": self.config.temperature,
					"num_predict": self.config.max_tokens
				}
			}
			
			self.logger.debug(f"Sending request to Ollama: {self.config.model}")
			
			async with self.session.post(
				f"{self.config.host}/api/chat",
				json=payload
			) as response:
				
				if response.status == 200:
					result = await response.json()
					
					return OllamaResponse(
						content=result.get("message", {}).get("content", ""),
						model=result.get("model", self.config.model),
						done=result.get("done", True),
						total_duration=result.get("total_duration"),
						load_duration=result.get("load_duration"),
						prompt_eval_count=result.get("prompt_eval_count"),
						eval_count=result.get("eval_count")
					)
				else:
					error_text = await response.text()
					self.logger.error(f"Ollama API error {response.status}: {error_text}")
					raise Exception(f"Ollama API error: {response.status}")
					
		except Exception as e:
			self.logger.error(f"Ollama generation failed: {e}")
			raise
			
	async def chat(self, messages: List[OllamaMessage]) -> OllamaResponse:
		"""Chat with context using message history"""
		try:
			await self._ensure_session()
			
			# Convert messages to Ollama format
			ollama_messages = [
				{"role": msg.role, "content": msg.content} 
				for msg in messages
			]
			
			payload = {
				"model": self.config.model,
				"messages": ollama_messages,
				"stream": self.config.stream,
				"options": {
					"temperature": self.config.temperature,
					"num_predict": self.config.max_tokens
				}
			}
			
			async with self.session.post(
				f"{self.config.host}/api/chat",
				json=payload
			) as response:
				
				if response.status == 200:
					result = await response.json()
					
					return OllamaResponse(
						content=result.get("message", {}).get("content", ""),
						model=result.get("model", self.config.model),
						done=result.get("done", True),
						total_duration=result.get("total_duration"),
						load_duration=result.get("load_duration"), 
						prompt_eval_count=result.get("prompt_eval_count"),
						eval_count=result.get("eval_count")
					)
				else:
					error_text = await response.text()
					raise Exception(f"Ollama chat error: {response.status} - {error_text}")
					
		except Exception as e:
			self.logger.error(f"Ollama chat failed: {e}")
			raise
			
	async def pull_model(self, model_name: Optional[str] = None) -> bool:
		"""Pull a model if not available"""
		model = model_name or self.config.model
		
		try:
			await self._ensure_session()
			
			payload = {"name": model}
			
			async with self.session.post(
				f"{self.config.host}/api/pull",
				json=payload
			) as response:
				
				if response.status == 200:
					self.logger.info(f"Successfully pulled model: {model}")
					return True
				else:
					error_text = await response.text()
					self.logger.error(f"Failed to pull model {model}: {error_text}")
					return False
					
		except Exception as e:
			self.logger.error(f"Model pull failed: {e}")
			return False
			
	def get_config(self) -> OllamaConfig:
		"""Get current configuration"""
		return self.config
		
	def update_config(self, **kwargs) -> None:
		"""Update configuration parameters"""
		for key, value in kwargs.items():
			if hasattr(self.config, key):
				setattr(self.config, key, value)
			else:
				self.logger.warning(f"Unknown config parameter: {key}")
				
	async def close(self):
		"""Close the client session"""
		if self.session and not self.session.closed:
			await self.session.close()


# Default shared client instance
_default_client: Optional[OllamaClient] = None

async def get_default_client() -> OllamaClient:
	"""Get the default Ollama client instance"""
	global _default_client
	if _default_client is None:
		_default_client = OllamaClient()
		# Ensure model is available
		if not await _default_client.health_check():
			# Try to pull the model
			await _default_client.pull_model()
	return _default_client

async def generate_with_ollama(prompt: str, system_prompt: Optional[str] = None) -> str:
	"""Convenience function for simple generation"""
	client = await get_default_client()
	response = await client.generate(prompt, system_prompt)
	return response.content