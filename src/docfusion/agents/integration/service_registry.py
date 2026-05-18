"""
Service Registry

Central service registry for agent integration with existing
proposal generation infrastructure and external services.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional, Callable
from datetime import datetime
from dataclasses import dataclass
from enum import Enum



class ServiceStatus(str, Enum):
	"""Service operational status"""
	AVAILABLE = "available"
	UNAVAILABLE = "unavailable"
	INITIALIZING = "initializing"
	ERROR = "error"


@dataclass
class ServiceDefinition:
	"""Service definition and metadata"""
	service_name: str
	service_type: str
	instance: Any
	status: ServiceStatus = ServiceStatus.INITIALIZING
	health_check: Optional[Callable] = None
	dependencies: List[str] = None
	registered_at: datetime = datetime.now()
	last_health_check: Optional[datetime] = None


class ServiceRegistry:
	"""
	Central registry for all system services
	
	Manages service discovery, health monitoring, and dependency
	resolution for agent integration.
	"""
	
	def __init__(self):
		self.services: Dict[str, ServiceDefinition] = {}
		self.service_aliases: Dict[str, str] = {}
		self.health_check_interval = 300  # 5 minutes
		
		self._health_check_task: Optional[asyncio.Task] = None
		self._running = False
		
		self.logger = logging.getLogger("service_registry")
		self.logger.info("Service Registry initialized")
	
	async def start(self) -> None:
		"""Start service registry and health monitoring"""
		if self._running:
			return
		
		self._running = True
		self._health_check_task = asyncio.create_task(self._health_check_loop())
		
		self.logger.info("Service Registry started")
	
	async def stop(self) -> None:
		"""Stop service registry"""
		if not self._running:
			return
		
		self._running = False
		
		if self._health_check_task:
			self._health_check_task.cancel()
		
		self.logger.info("Service Registry stopped")
	
	def register_service(self, service_name: str, service_type: str, 
						 instance: Any, health_check: Optional[Callable] = None,
						 dependencies: Optional[List[str]] = None, 
						 aliases: Optional[List[str]] = None) -> bool:
		"""Register a service"""
		try:
			service_def = ServiceDefinition(
				service_name=service_name,
				service_type=service_type,
				instance=instance,
				health_check=health_check,
				dependencies=dependencies or []
			)
			
			self.services[service_name] = service_def
			
			# Register aliases
			if aliases:
				for alias in aliases:
					self.service_aliases[alias] = service_name
			
			# Mark as available if no health check
			if not health_check:
				service_def.status = ServiceStatus.AVAILABLE
			
			self.logger.info(f"Registered service: {service_name} ({service_type})")
			return True
			
		except Exception as e:
			self.logger.error(f"Failed to register service {service_name}: {e}")
			return False
	
	def unregister_service(self, service_name: str) -> bool:
		"""Unregister a service"""
		try:
			if service_name in self.services:
				del self.services[service_name]
				
				# Remove aliases
				aliases_to_remove = []
				for alias, target in self.service_aliases.items():
					if target == service_name:
						aliases_to_remove.append(alias)
				
				for alias in aliases_to_remove:
					del self.service_aliases[alias]
				
				self.logger.info(f"Unregistered service: {service_name}")
				return True
			
			return False
			
		except Exception as e:
			self.logger.error(f"Failed to unregister service {service_name}: {e}")
			return False
	
	def get_service(self, service_name: str) -> Optional[Any]:
		"""Get service instance"""
		# Check if it's an alias
		actual_name = self.service_aliases.get(service_name, service_name)
		
		service_def = self.services.get(actual_name)
		if service_def and service_def.status == ServiceStatus.AVAILABLE:
			return service_def.instance
		
		return None
	
	def get_service_status(self, service_name: str) -> Optional[ServiceStatus]:
		"""Get service status"""
		actual_name = self.service_aliases.get(service_name, service_name)
		service_def = self.services.get(actual_name)
		
		return service_def.status if service_def else None
	
	def list_services(self, service_type: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
		"""List all registered services"""
		result = {}
		
		for name, service_def in self.services.items():
			if service_type and service_def.service_type != service_type:
				continue
			
			result[name] = {
				"service_type": service_def.service_type,
				"status": service_def.status.value,
				"registered_at": service_def.registered_at.isoformat(),
				"dependencies": service_def.dependencies,
				"has_health_check": service_def.health_check is not None
			}
		
		return result
	
	def get_services_by_type(self, service_type: str) -> Dict[str, Any]:
		"""Get all services of a specific type"""
		result = {}
		
		for name, service_def in self.services.items():
			if service_def.service_type == service_type and service_def.status == ServiceStatus.AVAILABLE:
				result[name] = service_def.instance
		
		return result
	
	async def _health_check_loop(self) -> None:
		"""Background health check loop"""
		while self._running:
			try:
				await self._perform_health_checks()
				await asyncio.sleep(self.health_check_interval)
			except Exception as e:
				self.logger.error(f"Health check error: {e}")
				await asyncio.sleep(60)
	
	async def _perform_health_checks(self) -> None:
		"""Perform health checks on all services"""
		for service_name, service_def in self.services.items():
			if service_def.health_check:
				try:
					if asyncio.iscoroutinefunction(service_def.health_check):
						is_healthy = await service_def.health_check()
					else:
						is_healthy = service_def.health_check()
					
					service_def.status = ServiceStatus.AVAILABLE if is_healthy else ServiceStatus.ERROR
					service_def.last_health_check = datetime.now()
					
				except Exception as e:
					service_def.status = ServiceStatus.ERROR
					self.logger.warning(f"Health check failed for {service_name}: {e}")
	
	def get_registry_status(self) -> Dict[str, Any]:
		"""Get registry status and statistics"""
		status_counts = {}
		for service_def in self.services.values():
			status = service_def.status.value
			status_counts[status] = status_counts.get(status, 0) + 1
		
		return {
			"running": self._running,
			"total_services": len(self.services),
			"status_distribution": status_counts,
			"aliases_count": len(self.service_aliases)
		}


class ServiceIntegration:
	"""
	High-level service integration manager
	
	Provides convenient access to common proposal system services
	with automatic discovery and fallback mechanisms.
	"""
	
	def __init__(self, registry: Optional[ServiceRegistry] = None):
		self.registry = registry or ServiceRegistry()
		self._initialized = False
		
		self.logger = logging.getLogger("service_integration")
	
	async def initialize(self) -> None:
		"""Initialize service integration"""
		if not self._initialized:
			await self.registry.start()
			await self._register_core_services()
			self._initialized = True
			
			self.logger.info("Service Integration initialized")
	
	async def _register_core_services(self) -> None:
		"""Register core system services"""
		# This would register known services with the registry
		# Implementation would be specific to the actual services available
		pass
	
	@property
	def voice_integrator(self) -> Optional[Any]:
		"""Get voice integration service"""
		return self.registry.get_service("voice_integrator")
	
	@property
	def document_engine(self) -> Optional[Any]:
		"""Get document engine service"""
		return self.registry.get_service("document_engine")
	
	@property
	def storage_service(self) -> Optional[Any]:
		"""Get storage service"""
		return self.registry.get_service("storage_service")
	
	@property
	def rag_service(self) -> Optional[Any]:
		"""Get RAG service"""
		return self.registry.get_service("rag_service")
	
	def get_available_services(self) -> List[str]:
		"""Get list of available service names"""
		return [
			name for name, service_def in self.registry.services.items()
			if service_def.status == ServiceStatus.AVAILABLE
		]
	
	def is_service_available(self, service_name: str) -> bool:
		"""Check if service is available"""
		status = self.registry.get_service_status(service_name)
		return status == ServiceStatus.AVAILABLE