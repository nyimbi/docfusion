#!/usr/bin/env python3
"""
Ollama Load Balancer

Provides load balancing and high availability for multiple Ollama instances
in production deployments. Supports health-based routing, failover, and
request distribution strategies.
"""

import asyncio
import logging
import random
import time
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime, timedelta
from enum import Enum
import aiohttp
from collections import deque

from .ollama_manager import OllamaManager, OllamaHealth, OllamaMetrics


class LoadBalancingStrategy(Enum):
	"""Load balancing strategies"""
	ROUND_ROBIN = "round_robin"
	RANDOM = "random"
	LEAST_CONNECTIONS = "least_connections"
	RESPONSE_TIME = "response_time"
	HEALTH_WEIGHTED = "health_weighted"


@dataclass
class OllamaInstance:
	"""Represents a single Ollama instance"""
	url: str
	weight: float = 1.0
	max_connections: int = 10
	timeout: float = 30.0
	
	# Runtime state
	current_connections: int = 0
	last_health_check: Optional[datetime] = None
	health_status: Optional[OllamaHealth] = None
	manager: Optional[OllamaManager] = None
	
	# Performance metrics
	total_requests: int = 0
	successful_requests: int = 0
	failed_requests: int = 0
	avg_response_time: float = 0.0
	error_rate: float = 0.0
	
	def __post_init__(self):
		"""Initialize manager after creation"""
		self.manager = OllamaManager(self.url)
	
	@property
	def is_healthy(self) -> bool:
		"""Check if instance is healthy"""
		return (
			self.health_status is not None and
			self.health_status.is_healthy and
			self.current_connections < self.max_connections
		)
	
	@property
	def load_score(self) -> float:
		"""Calculate load score (lower is better)"""
		if not self.is_healthy:
			return float('inf')
		
		# Combine connection count and response time
		connection_score = self.current_connections / self.max_connections
		response_score = min(self.avg_response_time / 2.0, 1.0)  # Normalize to 0-1
		
		return (connection_score * 0.6 + response_score * 0.4) / self.weight
	
	def update_metrics(self, success: bool, response_time: float):
		"""Update performance metrics"""
		self.total_requests += 1
		
		if success:
			self.successful_requests += 1
		else:
			self.failed_requests += 1
		
		# Update average response time (exponential moving average)
		alpha = 0.1
		self.avg_response_time = alpha * response_time + (1 - alpha) * self.avg_response_time
		
		# Update error rate
		self.error_rate = self.failed_requests / max(1, self.total_requests)


@dataclass
class LoadBalancerConfig:
	"""Configuration for Ollama load balancer"""
	instances: List[str] = field(default_factory=list)
	strategy: LoadBalancingStrategy = LoadBalancingStrategy.HEALTH_WEIGHTED
	health_check_interval: int = 30  # seconds
	health_check_timeout: float = 5.0
	max_retries: int = 3
	retry_delay: float = 1.0
	enable_failover: bool = True
	circuit_breaker_threshold: float = 0.5  # 50% error rate threshold
	circuit_breaker_timeout: int = 60  # seconds
	request_timeout: float = 30.0


class OllamaLoadBalancer:
	"""Load balancer for multiple Ollama instances"""
	
	def __init__(self, config: LoadBalancerConfig):
		self.config = config
		self.logger = logging.getLogger(__name__)
		
		# Initialize instances
		self.instances: List[OllamaInstance] = []
		for url in config.instances:
			instance = OllamaInstance(
				url=url,
				timeout=config.request_timeout
			)
			self.instances.append(instance)
		
		# Load balancing state
		self.round_robin_index = 0
		self.circuit_breakers: Dict[str, datetime] = {}
		
		# Health monitoring
		self.health_check_task: Optional[asyncio.Task] = None
		self.running = False
		
		# Performance tracking
		self.total_requests = 0
		self.successful_requests = 0
		self.failed_requests = 0
		self.request_history = deque(maxlen=1000)
	
	async def start(self):
		"""Start the load balancer and health monitoring"""
		if self.running:
			return
		
		self.running = True
		self.logger.info(f"Starting Ollama load balancer with {len(self.instances)} instances")
		
		# Initial health check for all instances
		await self._check_all_instances_health()
		
		# Start background health monitoring
		self.health_check_task = asyncio.create_task(self._health_monitor())
		
		self.logger.info("Ollama load balancer started successfully")
	
	async def stop(self):
		"""Stop the load balancer"""
		self.running = False
		
		if self.health_check_task:
			self.health_check_task.cancel()
			try:
				await self.health_check_task
			except asyncio.CancelledError:
				pass
		
		self.logger.info("Ollama load balancer stopped")
	
	async def _health_monitor(self):
		"""Background task to monitor instance health"""
		while self.running:
			try:
				await self._check_all_instances_health()
				await asyncio.sleep(self.config.health_check_interval)
			except asyncio.CancelledError:
				break
			except Exception as e:
				self.logger.error(f"Health monitor error: {e}")
				await asyncio.sleep(5)  # Short delay on error
	
	async def _check_all_instances_health(self):
		"""Check health of all instances"""
		tasks = []
		for instance in self.instances:
			task = self._check_instance_health(instance)
			tasks.append(task)
		
		if tasks:
			await asyncio.gather(*tasks, return_exceptions=True)
	
	async def _check_instance_health(self, instance: OllamaInstance):
		"""Check health of a single instance"""
		try:
			health = await instance.manager.check_health(timeout=self.config.health_check_timeout)
			instance.health_status = health
			instance.last_health_check = datetime.now()
			
			# Update circuit breaker status
			if health.is_healthy and instance.url in self.circuit_breakers:
				del self.circuit_breakers[instance.url]
			
			self.logger.debug(f"Health check for {instance.url}: {'✅' if health.is_healthy else '❌'}")
		
		except Exception as e:
			# Create unhealthy status
			instance.health_status = OllamaHealth(
				is_healthy=False,
				response_time=self.config.health_check_timeout,
				error_message=str(e)
			)
			instance.last_health_check = datetime.now()
			
			self.logger.warning(f"Health check failed for {instance.url}: {e}")
	
	def _select_instance(self) -> Optional[OllamaInstance]:
		"""Select an instance based on load balancing strategy"""
		healthy_instances = [inst for inst in self.instances if self._is_available(inst)]
		
		if not healthy_instances:
			return None
		
		if self.config.strategy == LoadBalancingStrategy.ROUND_ROBIN:
			instance = healthy_instances[self.round_robin_index % len(healthy_instances)]
			self.round_robin_index += 1
			return instance
		
		elif self.config.strategy == LoadBalancingStrategy.RANDOM:
			return random.choice(healthy_instances)
		
		elif self.config.strategy == LoadBalancingStrategy.LEAST_CONNECTIONS:
			return min(healthy_instances, key=lambda x: x.current_connections)
		
		elif self.config.strategy == LoadBalancingStrategy.RESPONSE_TIME:
			return min(healthy_instances, key=lambda x: x.avg_response_time or float('inf'))
		
		elif self.config.strategy == LoadBalancingStrategy.HEALTH_WEIGHTED:
			return min(healthy_instances, key=lambda x: x.load_score)
		
		else:
			return healthy_instances[0]
	
	def _is_available(self, instance: OllamaInstance) -> bool:
		"""Check if instance is available for requests"""
		# Check circuit breaker
		if instance.url in self.circuit_breakers:
			if datetime.now() < self.circuit_breakers[instance.url]:
				return False
			else:
				# Circuit breaker timeout expired, give instance another chance
				del self.circuit_breakers[instance.url]
		
		# Check health and capacity
		return (
			instance.is_healthy and
			instance.current_connections < instance.max_connections
		)
	
	def _trigger_circuit_breaker(self, instance: OllamaInstance):
		"""Trigger circuit breaker for an instance"""
		if instance.error_rate >= self.config.circuit_breaker_threshold:
			breaker_until = datetime.now() + timedelta(seconds=self.config.circuit_breaker_timeout)
			self.circuit_breakers[instance.url] = breaker_until
			
			self.logger.warning(
				f"Circuit breaker triggered for {instance.url} "
				f"(error rate: {instance.error_rate:.2%})"
			)
	
	async def generate_embedding(self, model: str, text: str) -> Optional[Dict[str, Any]]:
		"""Generate embedding using load-balanced Ollama instances"""
		if not self.running:
			await self.start()
		
		for attempt in range(self.config.max_retries):
			instance = self._select_instance()
			
			if not instance:
				self.logger.error("No healthy Ollama instances available")
				break
			
			try:
				# Track connection
				instance.current_connections += 1
				start_time = time.time()
				
				# Make request to selected instance
				result = await self._make_embedding_request(instance, model, text)
				
				# Update metrics
				response_time = time.time() - start_time
				instance.update_metrics(True, response_time)
				self._update_global_metrics(True)
				
				self.logger.debug(f"Embedding generated via {instance.url} in {response_time:.3f}s")
				return result
			
			except Exception as e:
				# Update metrics
				response_time = time.time() - start_time
				instance.update_metrics(False, response_time)
				self._update_global_metrics(False)
				
				# Check circuit breaker
				self._trigger_circuit_breaker(instance)
				
				self.logger.warning(f"Request failed on {instance.url}: {e}")
				
				if attempt < self.config.max_retries - 1:
					await asyncio.sleep(self.config.retry_delay * (attempt + 1))
			
			finally:
				instance.current_connections = max(0, instance.current_connections - 1)
		
		self.logger.error(f"All embedding attempts failed after {self.config.max_retries} retries")
		return None
	
	async def _make_embedding_request(self, instance: OllamaInstance, model: str, text: str) -> Dict[str, Any]:
		"""Make embedding request to specific instance"""
		timeout = aiohttp.ClientTimeout(total=instance.timeout)
		
		async with aiohttp.ClientSession(timeout=timeout) as session:
			url = f"{instance.url}/api/embeddings"
			payload = {"model": model, "prompt": text}
			
			async with session.post(url, json=payload) as response:
				if response.status == 200:
					data = await response.json()
					embedding = data.get("embedding", [])
					
					if not embedding:
						raise ValueError("Empty embedding returned")
					
					return {
						"embedding": embedding,
						"model": model,
						"instance": instance.url,
						"dimensions": len(embedding)
					}
				else:
					error_text = await response.text()
					raise Exception(f"HTTP {response.status}: {error_text}")
	
	def _update_global_metrics(self, success: bool):
		"""Update global load balancer metrics"""
		self.total_requests += 1
		
		if success:
			self.successful_requests += 1
		else:
			self.failed_requests += 1
		
		# Add to request history
		self.request_history.append({
			"timestamp": datetime.now(),
			"success": success
		})
	
	def get_status(self) -> Dict[str, Any]:
		"""Get load balancer status and metrics"""
		healthy_instances = sum(1 for inst in self.instances if inst.is_healthy)
		
		instance_details = []
		for inst in self.instances:
			instance_details.append({
				"url": inst.url,
				"healthy": inst.is_healthy,
				"connections": inst.current_connections,
				"max_connections": inst.max_connections,
				"total_requests": inst.total_requests,
				"success_rate": inst.successful_requests / max(1, inst.total_requests),
				"avg_response_time": inst.avg_response_time,
				"load_score": inst.load_score if inst.is_healthy else None,
				"last_health_check": inst.last_health_check.isoformat() if inst.last_health_check else None,
				"circuit_breaker": inst.url in self.circuit_breakers
			})
		
		return {
			"running": self.running,
			"strategy": self.config.strategy.value,
			"total_instances": len(self.instances),
			"healthy_instances": healthy_instances,
			"total_requests": self.total_requests,
			"success_rate": self.successful_requests / max(1, self.total_requests),
			"active_circuit_breakers": len(self.circuit_breakers),
			"instances": instance_details
		}
	
	def get_metrics(self) -> Dict[str, Any]:
		"""Get detailed performance metrics"""
		# Calculate request rate
		now = datetime.now()
		recent_requests = [
			req for req in self.request_history
			if now - req["timestamp"] <= timedelta(minutes=5)
		]
		request_rate = len(recent_requests) / 300.0  # requests per second over 5 minutes
		
		return {
			"global_metrics": {
				"total_requests": self.total_requests,
				"successful_requests": self.successful_requests,
				"failed_requests": self.failed_requests,
				"success_rate": self.successful_requests / max(1, self.total_requests),
				"request_rate_5min": request_rate,
				"request_history_size": len(self.request_history)
			},
			"instance_metrics": {
				inst.url: {
					"total_requests": inst.total_requests,
					"successful_requests": inst.successful_requests,
					"failed_requests": inst.failed_requests,
					"success_rate": inst.successful_requests / max(1, inst.total_requests),
					"error_rate": inst.error_rate,
					"avg_response_time": inst.avg_response_time,
					"current_connections": inst.current_connections,
					"load_score": inst.load_score if inst.is_healthy else None
				}
				for inst in self.instances
			}
		}
	
	async def add_instance(self, url: str, weight: float = 1.0) -> bool:
		"""Dynamically add a new Ollama instance"""
		# Check if instance already exists
		if any(inst.url == url for inst in self.instances):
			self.logger.warning(f"Instance {url} already exists")
			return False
		
		instance = OllamaInstance(url=url, weight=weight, timeout=self.config.request_timeout)
		
		# Test instance health before adding
		try:
			await self._check_instance_health(instance)
			
			if instance.is_healthy:
				self.instances.append(instance)
				self.logger.info(f"Added healthy instance: {url}")
				return True
			else:
				self.logger.warning(f"Instance {url} is not healthy, adding anyway")
				self.instances.append(instance)
				return True
		
		except Exception as e:
			self.logger.error(f"Failed to add instance {url}: {e}")
			return False
	
	async def remove_instance(self, url: str) -> bool:
		"""Dynamically remove an Ollama instance"""
		instance = next((inst for inst in self.instances if inst.url == url), None)
		
		if not instance:
			self.logger.warning(f"Instance {url} not found")
			return False
		
		# Wait for active connections to finish (with timeout)
		timeout = 30  # seconds
		start_time = time.time()
		
		while instance.current_connections > 0 and time.time() - start_time < timeout:
			await asyncio.sleep(1)
		
		# Force removal if timeout reached
		self.instances.remove(instance)
		
		# Clean up circuit breaker if exists
		if url in self.circuit_breakers:
			del self.circuit_breakers[url]
		
		self.logger.info(f"Removed instance: {url}")
		return True


# Utility functions
async def create_load_balanced_embedding_service(
	instances: List[str],
	strategy: LoadBalancingStrategy = LoadBalancingStrategy.HEALTH_WEIGHTED,
	**kwargs
) -> OllamaLoadBalancer:
	"""Create load-balanced Ollama embedding service"""
	config = LoadBalancerConfig(
		instances=instances,
		strategy=strategy,
		**kwargs
	)
	
	balancer = OllamaLoadBalancer(config)
	await balancer.start()
	return balancer


def create_load_balancer_config(
	instances: List[str],
	strategy: str = "health_weighted",
	**kwargs
) -> LoadBalancerConfig:
	"""Create load balancer configuration with validation"""
	strategy_enum = LoadBalancingStrategy(strategy)
	
	return LoadBalancerConfig(
		instances=instances,
		strategy=strategy_enum,
		**kwargs
	)