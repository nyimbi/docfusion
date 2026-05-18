#!/usr/bin/env python3
"""
Ollama Management Utilities

Provides health monitoring, model management, and operational utilities for Ollama
integration with the RAG system. Includes automatic model downloading, health checks,
and performance monitoring.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from datetime import datetime
import json
import aiohttp


@dataclass
class OllamaModelInfo:
	"""Information about an Ollama model"""
	name: str
	size: int
	digest: str
	modified_at: datetime
	format: str = "gguf"
	family: str = ""
	parameter_size: str = ""
	quantization_level: str = ""


@dataclass
class OllamaHealth:
	"""Ollama service health status"""
	is_healthy: bool
	response_time: float
	version: Optional[str] = None
	available_models: List[str] = field(default_factory=list)
	memory_usage: Optional[Dict[str, Any]] = None
	error_message: Optional[str] = None
	last_check: datetime = field(default_factory=datetime.now)


@dataclass
class OllamaMetrics:
	"""Ollama performance metrics"""
	total_requests: int = 0
	successful_requests: int = 0
	failed_requests: int = 0
	avg_response_time: float = 0.0
	min_response_time: float = float('inf')
	max_response_time: float = 0.0
	last_error: Optional[str] = None
	error_count: Dict[str, int] = field(default_factory=dict)
	request_history: List[Dict[str, Any]] = field(default_factory=list)


class OllamaManager:
	"""Manages Ollama service health, models, and performance monitoring"""
	
	def __init__(self, base_url: str = "http://localhost:11434"):
		self.base_url = base_url.rstrip('/')
		self.logger = logging.getLogger(__name__)
		self.metrics = OllamaMetrics()
		self.health_history: List[OllamaHealth] = []
		self.max_history_size = 100
		
		# Model management
		self.required_models = {
			"nomic-embed-text": {
				"type": "embedding",
				"dimensions": 768,
				"description": "High-quality text embedding model optimized for retrieval"
			},
			"bge-m3": {
				"type": "embedding", 
				"dimensions": 1024,
				"description": "Multilingual embedding model supporting 100+ languages"
			}
		}
	
	async def check_health(self, timeout: float = 5.0) -> OllamaHealth:
		"""Perform comprehensive health check of Ollama service"""
		start_time = time.time()
		
		try:
			async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
				# Check version endpoint
				async with session.get(f"{self.base_url}/api/version") as response:
					response_time = time.time() - start_time
					
					if response.status == 200:
						version_data = await response.json()
						version = version_data.get("version", "unknown")
						
						# Get available models
						models = await self._get_available_models(session)
						
						# Get memory usage (if available)
						memory_usage = await self._get_memory_usage(session)
						
						health = OllamaHealth(
							is_healthy=True,
							response_time=response_time,
							version=version,
							available_models=models,
							memory_usage=memory_usage
						)
						
						self._update_metrics(True, response_time)
						
					else:
						health = OllamaHealth(
							is_healthy=False,
							response_time=response_time,
							error_message=f"HTTP {response.status}: {await response.text()}"
						)
						
						self._update_metrics(False, response_time, f"HTTP {response.status}")
		
		except asyncio.TimeoutError:
			response_time = timeout
			health = OllamaHealth(
				is_healthy=False,
				response_time=response_time,
				error_message="Health check timeout"
			)
			
			self._update_metrics(False, response_time, "Timeout")
		
		except Exception as e:
			response_time = time.time() - start_time
			health = OllamaHealth(
				is_healthy=False,
				response_time=response_time,
				error_message=str(e)
			)
			
			self._update_metrics(False, response_time, str(e))
		
		# Store health history
		self.health_history.append(health)
		if len(self.health_history) > self.max_history_size:
			self.health_history.pop(0)
		
		return health
	
	async def _get_available_models(self, session: aiohttp.ClientSession) -> List[str]:
		"""Get list of available models"""
		try:
			async with session.get(f"{self.base_url}/api/tags") as response:
				if response.status == 200:
					data = await response.json()
					return [model["name"] for model in data.get("models", [])]
				else:
					return []
		except Exception as e:
			self.logger.warning(f"Failed to get available models: {e}")
			return []
	
	async def _get_memory_usage(self, session: aiohttp.ClientSession) -> Optional[Dict[str, Any]]:
		"""Get memory usage information if available"""
		try:
			# This endpoint may not be available in all Ollama versions
			async with session.get(f"{self.base_url}/api/ps") as response:
				if response.status == 200:
					return await response.json()
				else:
					return None
		except Exception as e:
			self.logger.warning(f"Failed to get running models: {e}")
			return None
	
	def _update_metrics(self, success: bool, response_time: float, error: Optional[str] = None):
		"""Update performance metrics"""
		self.metrics.total_requests += 1
		
		if success:
			self.metrics.successful_requests += 1
		else:
			self.metrics.failed_requests += 1
			if error:
				self.metrics.last_error = error
				self.metrics.error_count[error] = self.metrics.error_count.get(error, 0) + 1
		
		# Update response time metrics
		if response_time < self.metrics.min_response_time:
			self.metrics.min_response_time = response_time
		if response_time > self.metrics.max_response_time:
			self.metrics.max_response_time = response_time
		
		# Calculate moving average
		total_time = self.metrics.avg_response_time * (self.metrics.total_requests - 1) + response_time
		self.metrics.avg_response_time = total_time / self.metrics.total_requests
		
		# Store request history (limited)
		self.metrics.request_history.append({
			"timestamp": datetime.now(),
			"success": success,
			"response_time": response_time,
			"error": error
		})
		
		# Limit history size
		if len(self.metrics.request_history) > 1000:
			self.metrics.request_history = self.metrics.request_history[-500:]
	
	async def ensure_model_available(self, model_name: str, auto_pull: bool = True) -> bool:
		"""Ensure a specific model is available, optionally auto-pulling it"""
		health = await self.check_health()
		
		if not health.is_healthy:
			self.logger.error(f"Cannot check model availability: Ollama service unhealthy")
			return False
		
		# Check if model is already available
		if any(model_name in model for model in health.available_models):
			self.logger.info(f"Model {model_name} is available")
			return True
		
		if not auto_pull:
			self.logger.warning(f"Model {model_name} not available and auto_pull disabled")
			return False
		
		# Attempt to pull the model
		self.logger.info(f"Model {model_name} not found, attempting to pull...")
		return await self.pull_model(model_name)
	
	async def pull_model(self, model_name: str, timeout: float = 300.0) -> bool:
		"""Pull a model from Ollama registry"""
		try:
			async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
				payload = {"name": model_name}
				
				self.logger.info(f"Pulling model {model_name}...")
				start_time = time.time()
				
				async with session.post(f"{self.base_url}/api/pull", json=payload) as response:
					if response.status == 200:
						# Monitor pull progress
						async for line in response.content:
							if line:
								try:
									progress = json.loads(line.decode().strip())
									if "status" in progress:
										self.logger.debug(f"Pull progress: {progress['status']}")
									
									# Check if pull completed
									if progress.get("status") == "success":
										duration = time.time() - start_time
										self.logger.info(f"Successfully pulled {model_name} in {duration:.1f}s")
										return True
								
								except json.JSONDecodeError:
									continue
					
					else:
						error_text = await response.text()
						self.logger.error(f"Failed to pull model {model_name}: HTTP {response.status} - {error_text}")
						return False
		
		except asyncio.TimeoutError:
			self.logger.error(f"Timeout pulling model {model_name} after {timeout}s")
			return False
		
		except Exception as e:
			self.logger.error(f"Error pulling model {model_name}: {e}")
			return False
		
		return False
	
	async def list_models(self) -> List[OllamaModelInfo]:
		"""Get detailed information about all available models"""
		try:
			async with aiohttp.ClientSession() as session:
				async with session.get(f"{self.base_url}/api/tags") as response:
					if response.status == 200:
						data = await response.json()
						models = []
						
						for model_data in data.get("models", []):
							try:
								model_info = OllamaModelInfo(
									name=model_data["name"],
									size=model_data["size"],
									digest=model_data["digest"],
									modified_at=datetime.fromisoformat(model_data["modified_at"].replace('Z', '+00:00')),
									format=model_data.get("details", {}).get("format", "gguf"),
									family=model_data.get("details", {}).get("family", ""),
									parameter_size=model_data.get("details", {}).get("parameter_size", ""),
									quantization_level=model_data.get("details", {}).get("quantization_level", "")
								)
								models.append(model_info)
							except Exception as e:
								self.logger.warning(f"Failed to parse model info: {e}")
								continue
						
						return models
					else:
						self.logger.error(f"Failed to list models: HTTP {response.status}")
						return []
		
		except Exception as e:
			self.logger.error(f"Error listing models: {e}")
			return []
	
	async def delete_model(self, model_name: str) -> bool:
		"""Delete a model to free up space"""
		try:
			async with aiohttp.ClientSession() as session:
				payload = {"name": model_name}
				
				async with session.delete(f"{self.base_url}/api/delete", json=payload) as response:
					if response.status == 200:
						self.logger.info(f"Successfully deleted model {model_name}")
						return True
					else:
						error_text = await response.text()
						self.logger.error(f"Failed to delete model {model_name}: HTTP {response.status} - {error_text}")
						return False
		
		except Exception as e:
			self.logger.error(f"Error deleting model {model_name}: {e}")
			return False
	
	async def ensure_required_models(self, auto_pull: bool = True) -> Dict[str, bool]:
		"""Ensure all required embedding models are available"""
		results = {}
		
		for model_name, model_info in self.required_models.items():
			self.logger.info(f"Checking required model: {model_name}")
			available = await self.ensure_model_available(model_name, auto_pull)
			results[model_name] = available
			
			if available:
				self.logger.info(f"✅ {model_name}: {model_info['description']}")
			else:
				self.logger.warning(f"❌ {model_name}: Not available")
		
		return results
	
	async def benchmark_model(self, model_name: str, test_texts: List[str]) -> Dict[str, Any]:
		"""Benchmark embedding generation performance for a model"""
		if not await self.ensure_model_available(model_name):
			return {"error": f"Model {model_name} not available"}
		
		results = {
			"model": model_name,
			"test_count": len(test_texts),
			"response_times": [],
			"total_time": 0,
			"avg_time": 0,
			"min_time": float('inf'),
			"max_time": 0,
			"success_count": 0,
			"error_count": 0,
			"errors": []
		}
		
		self.logger.info(f"Benchmarking {model_name} with {len(test_texts)} test cases")
		start_time = time.time()
		
		try:
			async with aiohttp.ClientSession() as session:
				for i, text in enumerate(test_texts):
					try:
						request_start = time.time()
						payload = {"model": model_name, "prompt": text}
						
						async with session.post(f"{self.base_url}/api/embeddings", json=payload) as response:
							request_time = time.time() - request_start
							results["response_times"].append(request_time)
							
							if response.status == 200:
								results["success_count"] += 1
								
								# Update min/max times
								if request_time < results["min_time"]:
									results["min_time"] = request_time
								if request_time > results["max_time"]:
									results["max_time"] = request_time
								
								self.logger.debug(f"Benchmark {i+1}/{len(test_texts)}: {request_time:.3f}s")
							else:
								results["error_count"] += 1
								error_msg = f"HTTP {response.status}"
								results["errors"].append(error_msg)
								self.logger.warning(f"Benchmark {i+1}/{len(test_texts)} failed: {error_msg}")
					
					except Exception as e:
						results["error_count"] += 1
						results["errors"].append(str(e))
						self.logger.warning(f"Benchmark {i+1}/{len(test_texts)} error: {e}")
		
		except Exception as e:
			results["errors"].append(f"Session error: {str(e)}")
		
		# Calculate final statistics
		results["total_time"] = time.time() - start_time
		
		if results["response_times"]:
			results["avg_time"] = sum(results["response_times"]) / len(results["response_times"])
		
		if results["min_time"] == float('inf'):
			results["min_time"] = 0
		
		success_rate = results["success_count"] / len(test_texts) if test_texts else 0
		results["success_rate"] = success_rate
		
		self.logger.info(f"Benchmark complete: {results['success_count']}/{len(test_texts)} successful")
		self.logger.info(f"Average response time: {results['avg_time']:.3f}s")
		self.logger.info(f"Success rate: {success_rate:.1%}")
		
		return results
	
	def get_health_summary(self) -> Dict[str, Any]:
		"""Get summary of health check history"""
		if not self.health_history:
			return {"error": "No health check history available"}
		
		recent_checks = self.health_history[-10:]  # Last 10 checks
		healthy_count = sum(1 for h in recent_checks if h.is_healthy)
		
		response_times = [h.response_time for h in recent_checks]
		
		return {
			"current_status": self.health_history[-1].is_healthy,
			"recent_availability": healthy_count / len(recent_checks),
			"avg_response_time": sum(response_times) / len(response_times),
			"min_response_time": min(response_times),
			"max_response_time": max(response_times),
			"total_checks": len(self.health_history),
			"last_check": self.health_history[-1].last_check,
			"current_version": self.health_history[-1].version,
			"available_models": self.health_history[-1].available_models
		}
	
	def get_metrics_summary(self) -> Dict[str, Any]:
		"""Get performance metrics summary"""
		return {
			"total_requests": self.metrics.total_requests,
			"successful_requests": self.metrics.successful_requests,
			"failed_requests": self.metrics.failed_requests,
			"success_rate": self.metrics.successful_requests / max(1, self.metrics.total_requests),
			"avg_response_time": self.metrics.avg_response_time,
			"min_response_time": self.metrics.min_response_time if self.metrics.min_response_time != float('inf') else 0,
			"max_response_time": self.metrics.max_response_time,
			"last_error": self.metrics.last_error,
			"error_breakdown": dict(self.metrics.error_count),
			"request_history_size": len(self.metrics.request_history)
		}
	
	async def cleanup_old_models(self, keep_models: List[str], dry_run: bool = True) -> Dict[str, Any]:
		"""Clean up old or unused models to free disk space"""
		models = await self.list_models()
		cleanup_results = {
			"total_models": len(models),
			"models_to_delete": [],
			"space_to_free": 0,
			"deleted_models": [],
			"deletion_errors": [],
			"dry_run": dry_run
		}
		
		for model in models:
			if model.name not in keep_models and not any(req in model.name for req in self.required_models):
				cleanup_results["models_to_delete"].append({
					"name": model.name,
					"size": model.size,
					"modified_at": model.modified_at.isoformat()
				})
				cleanup_results["space_to_free"] += model.size
		
		if not dry_run and cleanup_results["models_to_delete"]:
			self.logger.info(f"Deleting {len(cleanup_results['models_to_delete'])} unused models...")
			
			for model_info in cleanup_results["models_to_delete"]:
				if await self.delete_model(model_info["name"]):
					cleanup_results["deleted_models"].append(model_info["name"])
				else:
					cleanup_results["deletion_errors"].append(model_info["name"])
		
		return cleanup_results


# Utility functions
async def create_ollama_manager(base_url: str = "http://localhost:11434") -> OllamaManager:
	"""Create and validate Ollama manager"""
	manager = OllamaManager(base_url)
	
	# Perform initial health check
	health = await manager.check_health()
	
	if not health.is_healthy:
		raise Exception(f"Ollama service not available: {health.error_message}")
	
	return manager


async def ensure_embedding_models_ready(base_url: str = "http://localhost:11434") -> bool:
	"""Ensure required embedding models are available"""
	manager = await create_ollama_manager(base_url)
	results = await manager.ensure_required_models(auto_pull=True)
	
	return all(results.values())