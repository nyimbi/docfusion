#!/usr/bin/env python3
"""
API Health Checks and Status Pages

Comprehensive health monitoring system with dependency checks,
status pages, and automated health reporting for all system components.
"""

import asyncio
import logging
import time
import json
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field

try:
	from uuid_extensions import uuid7str
except ImportError:
	from uuid import uuid4
	def uuid7str() -> str:
		return str(uuid4())

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

try:
	import httpx
	import aioredis
	import asyncpg
	import meilisearch
	from opensearchpy import OpenSearch
except ImportError:
	httpx = None
	aioredis = None
	asyncpg = None
	meilisearch = None
	OpenSearch = None


class HealthStatus(str, Enum):
	"""Health check status levels"""
	HEALTHY = "healthy"
	DEGRADED = "degraded" 
	UNHEALTHY = "unhealthy"
	UNKNOWN = "unknown"


class ComponentType(str, Enum):
	"""System component types"""
	DATABASE = "database"
	CACHE = "cache"
	SEARCH = "search"
	EXTERNAL_API = "external_api"
	FILESYSTEM = "filesystem"
	WEBSOCKET = "websocket"
	QUEUE = "queue"
	AUTHENTICATION = "authentication"
	MONITORING = "monitoring"


@dataclass
class HealthCheckResult:
	"""Health check result for a component"""
	component: str
	component_type: ComponentType
	status: HealthStatus
	response_time_ms: float
	message: str = ""
	details: Dict[str, Any] = field(default_factory=dict)
	checked_at: datetime = field(default_factory=datetime.utcnow)
	error: Optional[str] = None


@dataclass
class SystemHealth:
	"""Overall system health status"""
	status: HealthStatus
	components: List[HealthCheckResult]
	checked_at: datetime = field(default_factory=datetime.utcnow)
	response_time_ms: float = 0.0
	uptime_seconds: float = 0.0
	version: str = "1.0.0"


class BaseHealthCheck:
	"""Base class for health checks"""
	
	def __init__(self, name: str, component_type: ComponentType, timeout: float = 5.0):
		self.name = name
		self.component_type = component_type
		self.timeout = timeout
		self.logger = logging.getLogger(__name__)
	
	async def check(self) -> HealthCheckResult:
		"""Execute health check"""
		start_time = time.time()
		
		try:
			result = await asyncio.wait_for(self._perform_check(), timeout=self.timeout)
			response_time = (time.time() - start_time) * 1000
			
			if result is True:
				return HealthCheckResult(
					component=self.name,
					component_type=self.component_type,
					status=HealthStatus.HEALTHY,
					response_time_ms=response_time,
					message="Component is healthy"
				)
			elif isinstance(result, dict):
				return HealthCheckResult(
					component=self.name,
					component_type=self.component_type,
					status=result.get('status', HealthStatus.HEALTHY),
					response_time_ms=response_time,
					message=result.get('message', 'Component check completed'),
					details=result.get('details', {})
				)
			else:
				return HealthCheckResult(
					component=self.name,
					component_type=self.component_type,
					status=HealthStatus.UNKNOWN,
					response_time_ms=response_time,
					message="Unexpected check result",
					details={'result': str(result)}
				)
				
		except asyncio.TimeoutError:
			return HealthCheckResult(
				component=self.name,
				component_type=self.component_type,
				status=HealthStatus.UNHEALTHY,
				response_time_ms=(time.time() - start_time) * 1000,
				message=f"Health check timed out after {self.timeout}s",
				error="timeout"
			)
		except Exception as e:
			return HealthCheckResult(
				component=self.name,
				component_type=self.component_type,
				status=HealthStatus.UNHEALTHY,
				response_time_ms=(time.time() - start_time) * 1000,
				message=f"Health check failed: {str(e)}",
				error=str(e)
			)
	
	async def _perform_check(self) -> Any:
		"""Override this method to implement specific health check logic"""
		raise NotImplementedError


class DatabaseHealthCheck(BaseHealthCheck):
	"""Database connectivity and performance check"""
	
	def __init__(self, connection_string: str, name: str = "database"):
		super().__init__(name, ComponentType.DATABASE)
		self.connection_string = connection_string
	
	async def _perform_check(self) -> Dict[str, Any]:
		if asyncpg is None:
			return {
				'status': HealthStatus.UNKNOWN,
				'message': 'Database driver not available',
				'details': {'driver': 'asyncpg not installed'}
			}
		
		try:
			conn = await asyncpg.connect(self.connection_string)
			
			# Test query
			result = await conn.fetchval('SELECT 1')
			
			# Get database stats
			stats_query = """
			SELECT 
				count(*) as active_connections,
				current_database() as database_name,
				version() as version
			FROM pg_stat_activity 
			WHERE state = 'active'
			"""
			
			stats = await conn.fetchrow(stats_query)
			await conn.close()
			
			if result == 1:
				return {
					'status': HealthStatus.HEALTHY,
					'message': 'Database connection successful',
					'details': {
						'active_connections': stats['active_connections'],
						'database_name': stats['database_name'],
						'version': stats['version'][:50]  # Truncate version string
					}
				}
			else:
				return {
					'status': HealthStatus.UNHEALTHY,
					'message': 'Database query returned unexpected result'
				}
				
		except Exception as e:
			return {
				'status': HealthStatus.UNHEALTHY,
				'message': f'Database connection failed: {str(e)}',
				'details': {'connection_string': self.connection_string.split('@')[0] + '@***'}
			}


class RedisHealthCheck(BaseHealthCheck):
	"""Redis cache connectivity check"""
	
	def __init__(self, redis_url: str, name: str = "redis_cache"):
		super().__init__(name, ComponentType.CACHE)
		self.redis_url = redis_url
	
	async def _perform_check(self) -> Dict[str, Any]:
		if aioredis is None:
			return {
				'status': HealthStatus.UNKNOWN,
				'message': 'Redis driver not available',
				'details': {'driver': 'aioredis not installed'}
			}
		
		try:
			redis = aioredis.from_url(self.redis_url)
			
			# Test ping
			result = await redis.ping()
			
			# Get Redis info
			info = await redis.info()
			await redis.close()
			
			if result:
				return {
					'status': HealthStatus.HEALTHY,
					'message': 'Redis connection successful',
					'details': {
						'redis_version': info.get('redis_version'),
						'connected_clients': info.get('connected_clients'),
						'used_memory_human': info.get('used_memory_human'),
						'uptime_in_seconds': info.get('uptime_in_seconds')
					}
				}
			else:
				return {
					'status': HealthStatus.UNHEALTHY,
					'message': 'Redis ping failed'
				}
				
		except Exception as e:
			return {
				'status': HealthStatus.UNHEALTHY,
				'message': f'Redis connection failed: {str(e)}'
			}


class MeiliSearchHealthCheck(BaseHealthCheck):
	"""MeiliSearch search engine health check"""
	
	def __init__(self, host: str, api_key: str = None, name: str = "meilisearch"):
		super().__init__(name, ComponentType.SEARCH)
		self.host = host
		self.api_key = api_key
	
	async def _perform_check(self) -> Dict[str, Any]:
		if meilisearch is None:
			return {
				'status': HealthStatus.UNKNOWN,
				'message': 'MeiliSearch client not available',
				'details': {'client': 'meilisearch not installed'}
			}
		
		try:
			client = meilisearch.Client(self.host, self.api_key)
			
			# Get health status
			health = client.health()
			
			# Get stats
			stats = client.get_stats()
			
			if health.get('status') == 'available':
				return {
					'status': HealthStatus.HEALTHY,
					'message': 'MeiliSearch is available',
					'details': {
						'host': self.host,
						'database_size': stats.get('databaseSize'),
						'last_update': stats.get('lastUpdate'),
						'indexes': len(stats.get('indexes', {}))
					}
				}
			else:
				return {
					'status': HealthStatus.UNHEALTHY,
					'message': f'MeiliSearch status: {health.get("status")}'
				}
				
		except Exception as e:
			return {
				'status': HealthStatus.UNHEALTHY,
				'message': f'MeiliSearch connection failed: {str(e)}'
			}


class OpenSearchHealthCheck(BaseHealthCheck):
	"""OpenSearch/Elasticsearch health check"""
	
	def __init__(self, host: str, port: int = 9200, username: str = None, 
	             password: str = None, use_ssl: bool = False, name: str = "opensearch"):
		super().__init__(name, ComponentType.SEARCH)
		self.host = host
		self.port = port
		self.username = username
		self.password = password
		self.use_ssl = use_ssl
	
	async def _perform_check(self) -> Dict[str, Any]:
		if OpenSearch is None:
			return {
				'status': HealthStatus.UNKNOWN,
				'message': 'OpenSearch client not available',
				'details': {'client': 'opensearch-py not installed'}
			}
		
		try:
			auth = (self.username, self.password) if self.username else None
			client = OpenSearch(
				hosts=[{'host': self.host, 'port': self.port}],
				http_auth=auth,
				use_ssl=self.use_ssl,
				verify_certs=False
			)
			
			# Check cluster health
			health = await asyncio.get_event_loop().run_in_executor(
				None, client.cluster.health
			)
			
			# Get cluster stats
			stats = await asyncio.get_event_loop().run_in_executor(
				None, client.cluster.stats
			)
			
			cluster_status = health.get('status')
			
			if cluster_status == 'green':
				status = HealthStatus.HEALTHY
			elif cluster_status == 'yellow':
				status = HealthStatus.DEGRADED
			else:
				status = HealthStatus.UNHEALTHY
			
			return {
				'status': status,
				'message': f'OpenSearch cluster status: {cluster_status}',
				'details': {
					'cluster_name': health.get('cluster_name'),
					'number_of_nodes': health.get('number_of_nodes'),
					'active_primary_shards': health.get('active_primary_shards'),
					'active_shards': health.get('active_shards'),
					'indices_count': stats.get('indices', {}).get('count', 0)
				}
			}
			
		except Exception as e:
			return {
				'status': HealthStatus.UNHEALTHY,
				'message': f'OpenSearch connection failed: {str(e)}'
			}


class ExternalAPIHealthCheck(BaseHealthCheck):
	"""External API service health check"""
	
	def __init__(self, url: str, expected_status: int = 200, 
	             headers: Dict[str, str] = None, name: str = "external_api"):
		super().__init__(name, ComponentType.EXTERNAL_API)
		self.url = url
		self.expected_status = expected_status
		self.headers = headers or {}
	
	async def _perform_check(self) -> Dict[str, Any]:
		if httpx is None:
			return {
				'status': HealthStatus.UNKNOWN,
				'message': 'HTTP client not available',
				'details': {'client': 'httpx not installed'}
			}
		
		try:
			async with httpx.AsyncClient(timeout=self.timeout) as client:
				response = await client.get(self.url, headers=self.headers)
				
				if response.status_code == self.expected_status:
					return {
						'status': HealthStatus.HEALTHY,
						'message': f'External API responded with status {response.status_code}',
						'details': {
							'url': self.url,
							'status_code': response.status_code,
							'response_size': len(response.content)
						}
					}
				else:
					return {
						'status': HealthStatus.UNHEALTHY,
						'message': f'Unexpected status code: {response.status_code}',
						'details': {
							'url': self.url,
							'expected_status': self.expected_status,
							'actual_status': response.status_code
						}
					}
					
		except Exception as e:
			return {
				'status': HealthStatus.UNHEALTHY,
				'message': f'External API check failed: {str(e)}',
				'details': {'url': self.url}
			}


class WebSocketHealthCheck(BaseHealthCheck):
	"""WebSocket service health check"""
	
	def __init__(self, connection_manager, name: str = "websocket"):
		super().__init__(name, ComponentType.WEBSOCKET)
		self.connection_manager = connection_manager
	
	async def _perform_check(self) -> Dict[str, Any]:
		try:
			stats = self.connection_manager.get_connection_stats()
			
			return {
				'status': HealthStatus.HEALTHY,
				'message': 'WebSocket service is running',
				'details': {
					'active_connections': stats.get('total_connections', 0),
					'total_documents': stats.get('total_documents', 0),
					'online_users': stats.get('online_users', 0)
				}
			}
			
		except Exception as e:
			return {
				'status': HealthStatus.UNHEALTHY,
				'message': f'WebSocket service check failed: {str(e)}'
			}


class HealthChecker:
	"""Main health checking system"""
	
	def __init__(self):
		self.checks: List[BaseHealthCheck] = []
		self.start_time = time.time()
		self.logger = logging.getLogger(__name__)
		self.last_check_results: Dict[str, HealthCheckResult] = {}
		
		# Background health checking
		self._background_task = None
		self.check_interval = 60  # Check every minute
		
	def add_check(self, health_check: BaseHealthCheck):
		"""Add health check to the system"""
		self.checks.append(health_check)
		self.logger.info(f"Added health check: {health_check.name}")
	
	def start_background_checks(self):
		"""Start background health checking"""
		if self._background_task is None:
			self._background_task = asyncio.create_task(self._run_background_checks())
			self.logger.info("Started background health checks")
	
	def stop_background_checks(self):
		"""Stop background health checking"""
		if self._background_task:
			self._background_task.cancel()
			self._background_task = None
			self.logger.info("Stopped background health checks")
	
	async def _run_background_checks(self):
		"""Background task to run health checks periodically"""
		while True:
			try:
				await self.check_all_components()
				await asyncio.sleep(self.check_interval)
			except asyncio.CancelledError:
				break
			except Exception as e:
				self.logger.error(f"Background health check failed: {e}")
				await asyncio.sleep(self.check_interval)
	
	async def check_all_components(self) -> SystemHealth:
		"""Run all health checks and return system health"""
		start_time = time.time()
		results = []
		
		# Run all checks concurrently
		tasks = [check.check() for check in self.checks]
		if tasks:
			check_results = await asyncio.gather(*tasks, return_exceptions=True)
			
			for i, result in enumerate(check_results):
				if isinstance(result, Exception):
					# Handle check that raised exception
					error_result = HealthCheckResult(
						component=self.checks[i].name,
						component_type=self.checks[i].component_type,
						status=HealthStatus.UNHEALTHY,
						response_time_ms=0,
						message=f"Health check failed: {str(result)}",
						error=str(result)
					)
					results.append(error_result)
				else:
					results.append(result)
					# Cache result
					self.last_check_results[result.component] = result
		
		# Determine overall system health
		if not results:
			overall_status = HealthStatus.UNKNOWN
		elif all(r.status == HealthStatus.HEALTHY for r in results):
			overall_status = HealthStatus.HEALTHY
		elif any(r.status == HealthStatus.UNHEALTHY for r in results):
			overall_status = HealthStatus.UNHEALTHY
		else:
			overall_status = HealthStatus.DEGRADED
		
		response_time = (time.time() - start_time) * 1000
		uptime = time.time() - self.start_time
		
		return SystemHealth(
			status=overall_status,
			components=results,
			response_time_ms=response_time,
			uptime_seconds=uptime
		)
	
	async def check_component(self, component_name: str) -> Optional[HealthCheckResult]:
		"""Check specific component by name"""
		for check in self.checks:
			if check.name == component_name:
				result = await check.check()
				self.last_check_results[component_name] = result
				return result
		return None
	
	def get_cached_results(self) -> List[HealthCheckResult]:
		"""Get last cached health check results"""
		return list(self.last_check_results.values())


class HealthEndpoints:
	"""Health check API endpoints"""
	
	def __init__(self, health_checker: HealthChecker):
		self.health_checker = health_checker
		self.logger = logging.getLogger(__name__)
		
		# Create FastAPI router
		self.router = APIRouter(prefix="/health", tags=["health"])
		
		# Register endpoints
		self._register_endpoints()
		
		self.logger.info("Health check endpoints initialized")
	
	def _register_endpoints(self):
		"""Register health check endpoints"""
		
		@self.router.get("/", response_model=Dict[str, Any])
		async def health_check():
			"""Basic health check endpoint"""
			try:
				system_health = await self.health_checker.check_all_components()
				
				response = {
					'status': system_health.status.value,
					'timestamp': system_health.checked_at.isoformat(),
					'response_time_ms': system_health.response_time_ms,
					'uptime_seconds': system_health.uptime_seconds,
					'version': system_health.version,
					'components': {
						result.component: {
							'status': result.status.value,
							'response_time_ms': result.response_time_ms,
							'message': result.message
						}
						for result in system_health.components
					}
				}
				
				status_code = 200 if system_health.status == HealthStatus.HEALTHY else 503
				return JSONResponse(content=response, status_code=status_code)
				
			except Exception as e:
				self.logger.error(f"Health check failed: {e}")
				return JSONResponse(
					content={
						'status': HealthStatus.UNHEALTHY.value,
						'error': str(e),
						'timestamp': datetime.utcnow().isoformat()
					},
					status_code=503
				)
		
		@self.router.get("/detailed", response_model=Dict[str, Any])
		async def detailed_health_check():
			"""Detailed health check with full component information"""
			try:
				system_health = await self.health_checker.check_all_components()
				
				response = {
					'status': system_health.status.value,
					'timestamp': system_health.checked_at.isoformat(),
					'response_time_ms': system_health.response_time_ms,
					'uptime_seconds': system_health.uptime_seconds,
					'version': system_health.version,
					'components': [
						{
							'component': result.component,
							'type': result.component_type.value,
							'status': result.status.value,
							'response_time_ms': result.response_time_ms,
							'message': result.message,
							'details': result.details,
							'checked_at': result.checked_at.isoformat(),
							'error': result.error
						}
						for result in system_health.components
					]
				}
				
				status_code = 200 if system_health.status == HealthStatus.HEALTHY else 503
				return JSONResponse(content=response, status_code=status_code)
				
			except Exception as e:
				self.logger.error(f"Detailed health check failed: {e}")
				return JSONResponse(
					content={
						'status': HealthStatus.UNHEALTHY.value,
						'error': str(e),
						'timestamp': datetime.utcnow().isoformat()
					},
					status_code=503
				)
		
		@self.router.get("/component/{component_name}")
		async def component_health_check(component_name: str):
			"""Check specific component health"""
			try:
				result = await self.health_checker.check_component(component_name)
				
				if result is None:
					raise HTTPException(status_code=404, detail=f"Component '{component_name}' not found")
				
				response = {
					'component': result.component,
					'type': result.component_type.value,
					'status': result.status.value,
					'response_time_ms': result.response_time_ms,
					'message': result.message,
					'details': result.details,
					'checked_at': result.checked_at.isoformat(),
					'error': result.error
				}
				
				status_code = 200 if result.status == HealthStatus.HEALTHY else 503
				return JSONResponse(content=response, status_code=status_code)
				
			except HTTPException:
				raise
			except Exception as e:
				self.logger.error(f"Component health check failed: {e}")
				return JSONResponse(
					content={
						'component': component_name,
						'status': HealthStatus.UNHEALTHY.value,
						'error': str(e),
						'timestamp': datetime.utcnow().isoformat()
					},
					status_code=503
				)
		
		@self.router.get("/status", response_class=HTMLResponse)
		async def status_page():
			"""HTML status page"""
			try:
				system_health = await self.health_checker.check_all_components()
				
				# Generate HTML status page
				html_content = self._generate_status_page_html(system_health)
				return HTMLResponse(content=html_content)
				
			except Exception as e:
				self.logger.error(f"Status page generation failed: {e}")
				error_html = f"""
				<html>
				<head><title>System Status - Error</title></head>
				<body>
					<h1>System Status - Error</h1>
					<p>Failed to generate status page: {str(e)}</p>
					<p>Time: {datetime.utcnow().isoformat()}</p>
				</body>
				</html>
				"""
				return HTMLResponse(content=error_html, status_code=503)
	
	def _generate_status_page_html(self, system_health: SystemHealth) -> str:
		"""Generate HTML status page"""
		
		# Status colors
		status_colors = {
			HealthStatus.HEALTHY: "#28a745",
			HealthStatus.DEGRADED: "#ffc107", 
			HealthStatus.UNHEALTHY: "#dc3545",
			HealthStatus.UNKNOWN: "#6c757d"
		}
		
		# Generate component rows
		component_rows = ""
		for result in system_health.components:
			status_color = status_colors.get(result.status, "#6c757d")
			component_rows += f"""
			<tr>
				<td>{result.component}</td>
				<td>{result.component_type.value}</td>
				<td style="color: {status_color}; font-weight: bold;">{result.status.value.upper()}</td>
				<td>{result.response_time_ms:.1f} ms</td>
				<td>{result.message}</td>
				<td>{result.checked_at.strftime('%H:%M:%S')}</td>
			</tr>
			"""
		
		overall_color = status_colors.get(system_health.status, "#6c757d")
		
		html_content = f"""
		<!DOCTYPE html>
		<html>
		<head>
			<title>System Status</title>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<meta http-equiv="refresh" content="30">
			<style>
				body {{ font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }}
				.container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
				.header {{ text-align: center; margin-bottom: 30px; }}
				.status-badge {{ display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; margin: 10px; }}
				.healthy {{ background-color: #28a745; }}
				.degraded {{ background-color: #ffc107; }}
				.unhealthy {{ background-color: #dc3545; }}
				.unknown {{ background-color: #6c757d; }}
				table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
				th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
				th {{ background-color: #f8f9fa; font-weight: bold; }}
				.stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }}
				.stat-box {{ background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }}
				.stat-value {{ font-size: 24px; font-weight: bold; color: #333; }}
				.stat-label {{ font-size: 14px; color: #666; margin-top: 5px; }}
				.footer {{ text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }}
			</style>
		</head>
		<body>
			<div class="container">
				<div class="header">
					<h1>System Status</h1>
					<div class="status-badge {system_health.status.value}" style="background-color: {overall_color};">
						{system_health.status.value.upper()}
					</div>
				</div>
				
				<div class="stats">
					<div class="stat-box">
						<div class="stat-value">{system_health.uptime_seconds / 3600:.1f}h</div>
						<div class="stat-label">Uptime</div>
					</div>
					<div class="stat-box">
						<div class="stat-value">{len([c for c in system_health.components if c.status == HealthStatus.HEALTHY])}/{len(system_health.components)}</div>
						<div class="stat-label">Healthy Components</div>
					</div>
					<div class="stat-box">
						<div class="stat-value">{system_health.response_time_ms:.1f}ms</div>
						<div class="stat-label">Check Time</div>
					</div>
					<div class="stat-box">
						<div class="stat-value">{system_health.version}</div>
						<div class="stat-label">Version</div>
					</div>
				</div>
				
				<table>
					<thead>
						<tr>
							<th>Component</th>
							<th>Type</th>
							<th>Status</th>
							<th>Response Time</th>
							<th>Message</th>
							<th>Last Check</th>
						</tr>
					</thead>
					<tbody>
						{component_rows}
					</tbody>
				</table>
				
				<div class="footer">
					<p>Last updated: {system_health.checked_at.strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
					<p>Page refreshes automatically every 30 seconds</p>
				</div>
			</div>
		</body>
		</html>
		"""
		
		return html_content


# Factory functions
def create_health_checker() -> HealthChecker:
	"""Create health checker instance"""
	return HealthChecker()


def create_health_endpoints(health_checker: HealthChecker) -> HealthEndpoints:
	"""Create health endpoints instance"""
	return HealthEndpoints(health_checker)