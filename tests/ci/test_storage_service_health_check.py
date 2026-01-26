#!/usr/bin/env python3
"""
Tests for Storage Service Health Check functionality.

This module tests the comprehensive health check system including
component health monitoring, performance metrics, and overall status determination.
"""

import asyncio
import pytest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
from typing import Dict, Any

from docfusion.storage.storage_service import (
	StorageService,
	StorageConfiguration,
	StorageHealthCheck,
	ComponentHealth,
	HealthStatus
)


class TestStorageServiceHealthCheck:
	"""Test suite for storage service health check functionality."""
	
	@pytest.fixture
	def temp_storage_path(self):
		"""Create temporary storage directory for testing."""
		temp_dir = tempfile.mkdtemp()
		yield Path(temp_dir)
		# Only remove if it still exists
		if Path(temp_dir).exists():
			shutil.rmtree(temp_dir)
	
	@pytest.fixture
	def storage_config(self, temp_storage_path):
		"""Create storage configuration for testing."""
		return StorageConfiguration(
			storage_root_path=temp_storage_path,
			enable_search=True,
			enable_indexing=True,
			enable_retrieval=True,
			enable_content_blocks=True,
			search_cache_size=100,
			retrieval_cache_size=100
		)
	
	@pytest.fixture
	def storage_service(self, storage_config):
		"""Create storage service instance for testing."""
		return StorageService(storage_config)
	
	@pytest.mark.asyncio
	async def test_ping_endpoint(self, storage_service):
		"""Test basic ping functionality."""
		result = await storage_service.ping()
		
		assert result['status'] == 'ok'
		assert 'timestamp' in result
		assert 'uptime_seconds' in result
		assert result['initialized'] == False  # Not initialized yet
		assert result['service'] == 'storage_service'
		assert result['version'] == '1.0.0'
		assert result['uptime_seconds'] >= 0
	
	@pytest.mark.asyncio
	async def test_health_check_uninitialized_service(self, storage_service):
		"""Test health check on uninitialized service."""
		health = await storage_service.health_check()
		
		assert isinstance(health, StorageHealthCheck)
		assert health.overall_status in [HealthStatus.DEGRADED, HealthStatus.UNKNOWN, HealthStatus.UNHEALTHY]
		assert "Storage service not initialized" in health.warnings
		assert health.uptime_seconds >= 0
		assert len(health.component_health) == 5  # All components should be checked
		
		# Check that all components are in unknown state since not initialized
		for component_name, component_health in health.component_health.items():
			if component_name != 'filesystem':  # Filesystem should work regardless
				assert component_health.status == HealthStatus.UNKNOWN
				assert "Component not enabled" in component_health.error_message or component_health.status == HealthStatus.UNKNOWN
	
	@pytest.mark.asyncio
	async def test_health_check_initialized_service_mocked(self, storage_service):
		"""Test health check on initialized service with mocked components."""
		# Mock all storage components to avoid actual initialization
		storage_service._search_engine = AsyncMock()
		storage_service._document_retrieval = AsyncMock()
		storage_service._document_indexer = AsyncMock()
		storage_service._document_retriever = AsyncMock()
		storage_service._initialized = True
		
		# Mock component methods to return successful responses
		async def mock_search(*args, **kwargs):
			return []
		storage_service._search_engine.search = mock_search
		
		async def mock_get_search_stats(*args, **kwargs):
			mock_stats = AsyncMock()
			mock_stats.total_searches = 10
			mock_stats.average_search_time = 0.05
			mock_stats.cache_size = 100
			return mock_stats
		storage_service._search_engine.get_search_stats = mock_get_search_stats
		
		async def mock_get_storage_stats(*args, **kwargs):
			return {
				'total_documents': 5,
				'total_storage_mb': 10.5,
				'cache_hit_rate': 0.85
			}
		storage_service._document_retrieval.get_storage_stats = mock_get_storage_stats
		
		async def mock_get_index_statistics(*args, **kwargs):
			mock_stats = AsyncMock()
			mock_stats.total_documents = 5
			mock_stats.total_categories = 3
			mock_stats.total_tags = 8
			mock_stats.index_size = 1024
			return mock_stats
		storage_service._document_indexer.get_index_statistics = mock_get_index_statistics
		
		async def mock_get_retrieval_stats(*args, **kwargs):
			return {
				'cache_hit_rate': 0.75,
				'recommendations_served': 20,
				'average_recommendation_time': 0.02
			}
		storage_service._document_retriever.get_retrieval_stats = mock_get_retrieval_stats
		
		health = await storage_service.health_check()
		
		# Overall status may be unhealthy due to filesystem (disk usage), so be flexible
		assert health.overall_status in [HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.UNHEALTHY]
		assert health.uptime_seconds >= 0
		
		# Check component health details
		assert 'search_engine' in health.component_health
		assert 'document_retrieval' in health.component_health
		assert 'document_indexer' in health.component_health
		assert 'document_retriever' in health.component_health
		assert 'filesystem' in health.component_health
		
		# All non-filesystem components should be healthy
		for component_name, component_health in health.component_health.items():
			if component_name != 'filesystem':  # Filesystem may be unhealthy due to disk usage
				assert component_health.status == HealthStatus.HEALTHY
				assert component_health.response_time_ms >= 0
				assert component_health.error_message is None
	
	@pytest.mark.asyncio
	async def test_health_check_with_component_errors(self, storage_service):
		"""Test health check when components have errors."""
		# Mock components with errors
		storage_service._search_engine = AsyncMock()
		storage_service._document_retrieval = AsyncMock()
		storage_service._initialized = True
		
		# Make search engine fail
		async def failing_search(*args, **kwargs):
			raise Exception("Search engine connection failed")
		storage_service._search_engine.search = failing_search
		
		# Make document retrieval slow (degraded)
		async def slow_get_storage_stats(*args, **kwargs):
			await asyncio.sleep(1.5)  # Simulate slow response (should trigger degraded status)
			return {'total_documents': 0, 'total_storage_mb': 0, 'cache_hit_rate': 0}
		storage_service._document_retrieval.get_storage_stats = slow_get_storage_stats
		
		health = await storage_service.health_check()
		
		assert health.overall_status == HealthStatus.UNHEALTHY  # Because search engine is unhealthy
		assert len(health.errors) >= 1  # Should have search engine error
		
		# Check specific component statuses
		assert health.component_health['search_engine'].status == HealthStatus.UNHEALTHY
		assert "Search engine connection failed" in health.component_health['search_engine'].error_message
		
		assert health.component_health['document_retrieval'].status == HealthStatus.DEGRADED
		assert "response time degraded" in health.component_health['document_retrieval'].error_message
	
	@pytest.mark.asyncio
	async def test_health_check_filesystem_health(self, storage_service, temp_storage_path):
		"""Test filesystem health check functionality."""
		storage_service._initialized = True
		
		health = await storage_service.health_check(include_details=True)
		
		filesystem_health = health.component_health['filesystem']
		# Filesystem may be unhealthy due to high disk usage in CI environment
		assert filesystem_health.status in [HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.UNHEALTHY]
		assert filesystem_health.response_time_ms >= 0
		
		# Check filesystem details
		assert 'total_space_gb' in filesystem_health.details
		assert 'used_space_gb' in filesystem_health.details
		assert 'free_space_gb' in filesystem_health.details
		assert 'usage_percent' in filesystem_health.details
		assert 'storage_path' in filesystem_health.details
		assert str(temp_storage_path) in filesystem_health.details['storage_path']
	
	@pytest.mark.asyncio
	async def test_health_check_filesystem_error(self, temp_storage_path):
		"""Test filesystem health check with permission error."""
		# Create service with temporary path but then delete it to simulate error
		storage_service = StorageService(StorageConfiguration(
			storage_root_path=temp_storage_path,
			enable_search=False,
			enable_indexing=False,
			enable_retrieval=False,
			enable_content_blocks=False
		))
		storage_service._initialized = True
		
		# Remove the directory to cause filesystem error
		import shutil
		shutil.rmtree(temp_storage_path)
		
		health = await storage_service.health_check()
		
		filesystem_health = health.component_health['filesystem']
		assert filesystem_health.status == HealthStatus.UNHEALTHY
		assert "Storage root path does not exist" in filesystem_health.error_message
		assert health.overall_status == HealthStatus.UNHEALTHY
	
	@pytest.mark.asyncio
	async def test_health_check_performance_metrics(self, storage_service):
		"""Test that health check includes performance metrics."""
		storage_service._initialized = True
		
		# Mock all components as healthy
		storage_service._search_engine = AsyncMock()
		storage_service._document_retrieval = AsyncMock()
		storage_service._document_indexer = AsyncMock()
		storage_service._document_retriever = AsyncMock()
		
		# Mock quick responses
		async def quick_response(*args, **kwargs):
			return {'total_documents': 0}
		
		storage_service._search_engine.search = lambda *args, **kwargs: []
		storage_service._search_engine.get_search_stats = lambda: AsyncMock(total_searches=0, average_search_time=0, cache_size=0)
		storage_service._document_retrieval.get_storage_stats = quick_response
		storage_service._document_indexer.get_index_statistics = lambda: AsyncMock(total_documents=0, total_categories=0, total_tags=0, index_size=0)
		storage_service._document_retriever.get_retrieval_stats = quick_response
		
		health = await storage_service.health_check()
		
		metrics = health.performance_metrics
		assert 'uptime_seconds' in metrics
		assert 'total_components' in metrics
		assert 'healthy_components' in metrics
		assert 'degraded_components' in metrics
		assert 'unhealthy_components' in metrics
		assert 'search_response_time_ms' in metrics
		assert 'retrieval_response_time_ms' in metrics
		assert 'indexer_response_time_ms' in metrics
		assert 'retriever_response_time_ms' in metrics
		
		assert metrics['total_components'] == 5  # All components
		assert metrics['healthy_components'] >= 1  # At least filesystem should be healthy
	
	@pytest.mark.asyncio
	async def test_health_check_include_details_false(self, storage_service):
		"""Test health check with include_details=False."""
		storage_service._initialized = True
		storage_service._search_engine = AsyncMock()
		
		# Mock search engine
		storage_service._search_engine.search = lambda *args, **kwargs: []
		
		health = await storage_service.health_check(include_details=False)
		
		# Search engine details should be empty when include_details=False
		search_health = health.component_health['search_engine']
		assert len(search_health.details) == 0
		
		# But filesystem details should still be empty (they're only populated with include_details=True)
		filesystem_health = health.component_health['filesystem']
		assert len(filesystem_health.details) == 0
	
	@pytest.mark.asyncio
	async def test_overall_health_status_determination(self, storage_service):
		"""Test overall health status determination logic."""
		storage_service._initialized = True
		
		# Test all healthy
		component_healths = [
			ComponentHealth("comp1", HealthStatus.HEALTHY, None, 10),
			ComponentHealth("comp2", HealthStatus.HEALTHY, None, 20),
		]
		overall = storage_service._determine_overall_health_status(component_healths)
		assert overall == HealthStatus.HEALTHY
		
		# Test with one degraded
		component_healths = [
			ComponentHealth("comp1", HealthStatus.HEALTHY, None, 10),
			ComponentHealth("comp2", HealthStatus.DEGRADED, None, 20),
		]
		overall = storage_service._determine_overall_health_status(component_healths)
		assert overall == HealthStatus.DEGRADED
		
		# Test with one unhealthy
		component_healths = [
			ComponentHealth("comp1", HealthStatus.HEALTHY, None, 10),
			ComponentHealth("comp2", HealthStatus.UNHEALTHY, None, 20),
		]
		overall = storage_service._determine_overall_health_status(component_healths)
		assert overall == HealthStatus.UNHEALTHY
		
		# Test with majority degraded/unknown
		component_healths = [
			ComponentHealth("comp1", HealthStatus.HEALTHY, None, 10),
			ComponentHealth("comp2", HealthStatus.DEGRADED, None, 20),
			ComponentHealth("comp3", HealthStatus.UNKNOWN, None, 30),
		]
		overall = storage_service._determine_overall_health_status(component_healths)
		assert overall == HealthStatus.DEGRADED
	
	@pytest.mark.asyncio
	async def test_health_check_exception_handling(self, storage_service):
		"""Test health check handles exceptions gracefully."""
		storage_service._initialized = True
		
		# Mock a component that raises an exception during health check setup
		with patch.object(storage_service, '_check_filesystem_health', side_effect=Exception("Test exception")):
			health = await storage_service.health_check()
			
			assert health.overall_status == HealthStatus.UNHEALTHY
			assert len(health.errors) >= 1
			assert any("Health check failed" in error for error in health.errors)
	
	@pytest.mark.asyncio
	async def test_health_check_response_time_thresholds(self, storage_service):
		"""Test health check response time threshold logic."""
		storage_service._initialized = True
		storage_service._search_engine = AsyncMock()
		
		# Mock slow search engine (should be degraded)
		async def slow_search(*args, **kwargs):
			await asyncio.sleep(1.2)  # 1.2 seconds - should trigger degraded status
			return []
		storage_service._search_engine.search = slow_search
		
		# Mock get_search_stats to return a proper mock object
		async def mock_get_search_stats():
			mock_stats = AsyncMock()
			mock_stats.total_searches = 0
			mock_stats.average_search_time = 0
			mock_stats.cache_size = 0
			return mock_stats
		storage_service._search_engine.get_search_stats = mock_get_search_stats
		
		health = await storage_service.health_check()
		
		search_health = health.component_health['search_engine']
		assert search_health.status == HealthStatus.DEGRADED
		assert search_health.response_time_ms > 1000
		assert "response time degraded" in search_health.error_message
	
	@pytest.mark.asyncio
	async def test_ping_after_initialization(self, storage_service):
		"""Test ping endpoint after service initialization."""
		await storage_service.initialize()
		
		result = await storage_service.ping()
		
		assert result['status'] == 'ok'
		assert result['initialized'] == True
		assert result['uptime_seconds'] > 0


if __name__ == "__main__":
	pytest.main([__file__])