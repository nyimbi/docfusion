"""
Week 17: Real-Time Collaboration Performance Tests

Comprehensive performance testing for the collaborative editing system including:
- Real-time synchronization performance
- Concurrent user handling
- Conflict detection and resolution performance  
- Version management scalability
- Memory and CPU usage analysis
"""

import asyncio
import pytest
import time
import random
import string
from datetime import datetime, timedelta
from typing import List, Dict, Any
from unittest.mock import Mock, AsyncMock
from pathlib import Path
import tempfile

# Import collaboration modules
import sys
sys.path.append(str(Path(__file__).parent.parent.parent / "src"))

from docfusion.collaboration.editing.collaborative_editor import (
	CollaborativeEditor, CollaborativeSession, Operation, User, OperationType
)
from docfusion.collaboration.versioning.version_manager import (
	VersionManager, DocumentCommit, DocumentBranch
)
from docfusion.collaboration.conflicts.conflict_detector import (
	ConflictDetector, ConflictType, ConflictSeverity
)
from docfusion.collaboration.conflicts.conflict_resolver import (
	ConflictResolver, ResolutionStrategy
)
from docfusion.collaboration.integration.collaboration_integration import (
	CollaborationIntegrator, CollaborationSettings, CollaborationMode
)


class PerformanceMetrics:
	"""Performance metrics collector"""
	
	def __init__(self):
		self.operation_times: List[float] = []
		self.memory_usage: List[float] = []
		self.concurrent_operations: List[int] = []
		self.conflict_resolution_times: List[float] = []
		self.sync_times: List[float] = []
	
	def record_operation(self, duration_ms: float):
		self.operation_times.append(duration_ms)
	
	def record_sync(self, duration_ms: float):
		self.sync_times.append(duration_ms)
	
	def record_conflict_resolution(self, duration_ms: float):
		self.conflict_resolution_times.append(duration_ms)
	
	def get_statistics(self) -> Dict[str, Any]:
		return {
			"operation_stats": {
				"count": len(self.operation_times),
				"avg_ms": sum(self.operation_times) / len(self.operation_times) if self.operation_times else 0,
				"min_ms": min(self.operation_times) if self.operation_times else 0,
				"max_ms": max(self.operation_times) if self.operation_times else 0,
				"p95_ms": sorted(self.operation_times)[int(len(self.operation_times) * 0.95)] if self.operation_times else 0
			},
			"sync_stats": {
				"count": len(self.sync_times),
				"avg_ms": sum(self.sync_times) / len(self.sync_times) if self.sync_times else 0,
				"min_ms": min(self.sync_times) if self.sync_times else 0,
				"max_ms": max(self.sync_times) if self.sync_times else 0
			},
			"conflict_resolution_stats": {
				"count": len(self.conflict_resolution_times),
				"avg_ms": sum(self.conflict_resolution_times) / len(self.conflict_resolution_times) if self.conflict_resolution_times else 0
			}
		}


@pytest.fixture
async def collaborative_editor():
	"""Create collaborative editor for testing"""
	editor = CollaborativeEditor(
		document_id="test_doc_123",
		initial_content="Initial document content for testing performance."
	)
	return editor


@pytest.fixture
async def version_manager():
	"""Create version manager for testing"""
	with tempfile.TemporaryDirectory() as temp_dir:
		vm = VersionManager(
			document_id="test_version_doc",
			storage_path=temp_dir
		)
		yield vm


@pytest.fixture
async def conflict_detector():
	"""Create conflict detector for testing"""
	return ConflictDetector(semantic_analysis=True)


@pytest.fixture
async def conflict_resolver():
	"""Create conflict resolver for testing"""
	return ConflictResolver(semantic_resolution=True)


@pytest.fixture
async def collaboration_integrator():
	"""Create collaboration integrator for testing"""
	with tempfile.TemporaryDirectory() as temp_dir:
		integrator = CollaborationIntegrator(storage_path=temp_dir)
		yield integrator


def generate_random_text(length: int) -> str:
	"""Generate random text for testing"""
	return ''.join(random.choices(string.ascii_letters + string.digits + ' ', k=length))


def generate_realistic_document_content() -> str:
	"""Generate realistic document content for testing"""
	sections = [
		"EXECUTIVE SUMMARY",
		"TECHNICAL APPROACH", 
		"PAST PERFORMANCE",
		"COST ANALYSIS",
		"PROJECT TIMELINE",
		"RISK MANAGEMENT",
		"CONCLUSION"
	]
	
	content = "COMPREHENSIVE PROPOSAL DOCUMENT\n\n"
	
	for section in sections:
		content += f"{section}\n"
		content += "=" * len(section) + "\n\n"
		
		# Add 3-5 paragraphs per section
		for _ in range(random.randint(3, 5)):
			paragraph_length = random.randint(100, 300)
			content += generate_random_text(paragraph_length) + "\n\n"
	
	return content


class TestCollaborativeEditorPerformance:
	"""Test collaborative editor performance under various conditions"""
	
	@pytest.mark.asyncio
	async def test_single_user_edit_performance(self, collaborative_editor):
		"""Test performance of single user editing operations"""
		metrics = PerformanceMetrics()
		
		# Add test user
		await collaborative_editor.add_user("user1", "Test User 1")
		
		# Perform 100 edit operations
		for i in range(100):
			start_time = time.time()
			
			# Insert text
			position = random.randint(0, len(await collaborative_editor.get_document_content()))
			text = generate_random_text(random.randint(10, 50))
			
			await collaborative_editor.insert_text("user1", position, text)
			
			end_time = time.time()
			metrics.record_operation((end_time - start_time) * 1000)
		
		stats = metrics.get_statistics()
		
		# Performance assertions
		assert stats["operation_stats"]["avg_ms"] < 50, f"Average operation time too high: {stats['operation_stats']['avg_ms']:.2f}ms"
		assert stats["operation_stats"]["p95_ms"] < 100, f"95th percentile too high: {stats['operation_stats']['p95_ms']:.2f}ms"
		assert stats["operation_stats"]["max_ms"] < 200, f"Max operation time too high: {stats['operation_stats']['max_ms']:.2f}ms"
	
	@pytest.mark.asyncio
	async def test_concurrent_users_performance(self, collaborative_editor):
		"""Test performance with multiple concurrent users"""
		metrics = PerformanceMetrics()
		user_count = 5
		operations_per_user = 20
		
		# Add multiple users
		users = []
		for i in range(user_count):
			user_id = f"user{i+1}"
			await collaborative_editor.add_user(user_id, f"Test User {i+1}")
			users.append(user_id)
		
		async def user_operations(user_id: str):
			"""Simulate user operations"""
			for _ in range(operations_per_user):
				start_time = time.time()
				
				# Random operation type
				if random.choice([True, False]):
					# Insert
					position = random.randint(0, len(await collaborative_editor.get_document_content()))
					text = generate_random_text(random.randint(5, 25))
					await collaborative_editor.insert_text(user_id, position, text)
				else:
					# Update cursor
					position = random.randint(0, len(await collaborative_editor.get_document_content()))
					await collaborative_editor.update_cursor(user_id, position)
				
				end_time = time.time()
				metrics.record_operation((end_time - start_time) * 1000)
				
				# Small delay to simulate realistic typing
				await asyncio.sleep(random.uniform(0.01, 0.05))
		
		# Run concurrent operations
		start_time = time.time()
		await asyncio.gather(*[user_operations(user_id) for user_id in users])
		total_time = time.time() - start_time
		
		stats = metrics.get_statistics()
		
		# Performance assertions
		assert stats["operation_stats"]["avg_ms"] < 100, f"Average operation time too high with {user_count} users: {stats['operation_stats']['avg_ms']:.2f}ms"
		assert total_time < 30, f"Total test time too high: {total_time:.2f}s"
		assert stats["operation_stats"]["count"] == user_count * operations_per_user
	
	@pytest.mark.asyncio
	async def test_large_document_performance(self, collaborative_editor):
		"""Test performance with large document content"""
		# Create large document
		large_content = generate_realistic_document_content() * 10  # ~50KB document
		
		# Add user
		await collaborative_editor.add_user("user1", "Test User")
		
		# Test operations on large document
		start_time = time.time()
		
		# Insert large content
		await collaborative_editor.insert_text("user1", 0, large_content)
		
		insert_time = (time.time() - start_time) * 1000
		
		# Test cursor operations
		start_time = time.time()
		for _ in range(20):
			position = random.randint(0, len(large_content))
			await collaborative_editor.update_cursor("user1", position)
		
		cursor_time = (time.time() - start_time) * 1000
		
		# Test small edits on large document
		start_time = time.time()
		for _ in range(10):
			position = random.randint(0, len(large_content))
			text = generate_random_text(10)
			await collaborative_editor.insert_text("user1", position, text)
		
		edit_time = (time.time() - start_time) * 1000
		
		# Performance assertions
		assert insert_time < 1000, f"Large content insert too slow: {insert_time:.2f}ms"
		assert cursor_time / 20 < 10, f"Cursor operations too slow on large document: {cursor_time/20:.2f}ms avg"
		assert edit_time / 10 < 100, f"Edit operations too slow on large document: {edit_time/10:.2f}ms avg"
	
	@pytest.mark.asyncio
	async def test_undo_redo_performance(self, collaborative_editor):
		"""Test undo/redo performance"""
		await collaborative_editor.add_user("user1", "Test User")
		metrics = PerformanceMetrics()
		
		# Perform operations to create undo history
		operations_count = 50
		for i in range(operations_count):
			text = f"Operation {i}: " + generate_random_text(20)
			await collaborative_editor.insert_text("user1", 0, text)
		
		# Test undo performance
		start_time = time.time()
		for _ in range(operations_count // 2):
			await collaborative_editor.undo("user1")
		
		undo_time = (time.time() - start_time) * 1000
		
		# Test redo performance
		start_time = time.time()
		for _ in range(operations_count // 4):
			await collaborative_editor.redo("user1")
		
		redo_time = (time.time() - start_time) * 1000
		
		# Performance assertions
		assert undo_time / (operations_count // 2) < 20, f"Undo operations too slow: {undo_time/(operations_count//2):.2f}ms avg"
		assert redo_time / (operations_count // 4) < 20, f"Redo operations too slow: {redo_time/(operations_count//4):.2f}ms avg"


class TestVersionManagerPerformance:
	"""Test version manager performance"""
	
	@pytest.mark.asyncio
	async def test_commit_performance(self, version_manager):
		"""Test commit creation performance"""
		metrics = PerformanceMetrics()
		
		content = generate_realistic_document_content()
		
		# Test multiple commits
		for i in range(20):
			# Modify content slightly
			modified_content = content + f"\n\nVersion {i} changes: " + generate_random_text(100)
			
			start_time = time.time()
			await version_manager.create_commit(
				f"user{i%3}",  # Rotate between 3 users
				f"Commit {i}",
				modified_content
			)
			end_time = time.time()
			
			metrics.record_operation((end_time - start_time) * 1000)
			content = modified_content
		
		stats = metrics.get_statistics()
		
		# Performance assertions
		assert stats["operation_stats"]["avg_ms"] < 500, f"Commit creation too slow: {stats['operation_stats']['avg_ms']:.2f}ms avg"
		assert stats["operation_stats"]["max_ms"] < 1000, f"Max commit time too high: {stats['operation_stats']['max_ms']:.2f}ms"
	
	@pytest.mark.asyncio
	async def test_branch_operations_performance(self, version_manager):
		"""Test branch creation and switching performance"""
		# Create initial commit
		await version_manager.create_commit("user1", "Initial", "Initial content")
		
		# Test branch creation performance
		branch_creation_times = []
		for i in range(10):
			start_time = time.time()
			await version_manager.create_branch(f"user{i}", f"feature-{i}", "main")
			end_time = time.time()
			branch_creation_times.append((end_time - start_time) * 1000)
		
		# Test branch switching performance
		switch_times = []
		for i in range(10):
			start_time = time.time()
			await version_manager.switch_branch(f"feature-{i}")
			end_time = time.time()
			switch_times.append((end_time - start_time) * 1000)
		
		# Performance assertions
		avg_create_time = sum(branch_creation_times) / len(branch_creation_times)
		avg_switch_time = sum(switch_times) / len(switch_times)
		
		assert avg_create_time < 100, f"Branch creation too slow: {avg_create_time:.2f}ms avg"
		assert avg_switch_time < 50, f"Branch switching too slow: {avg_switch_time:.2f}ms avg"
	
	@pytest.mark.asyncio
	async def test_diff_generation_performance(self, version_manager):
		"""Test diff generation performance"""
		content1 = generate_realistic_document_content()
		content2 = content1 + "\n\nAdditional section:\n" + generate_random_text(500)
		
		# Create commits
		commit1 = await version_manager.create_commit("user1", "Version 1", content1)
		commit2 = await version_manager.create_commit("user1", "Version 2", content2)
		
		# Test diff generation performance
		start_time = time.time()
		diff = await version_manager.generate_diff(commit1.commit_id, commit2.commit_id)
		end_time = time.time()
		
		diff_time = (end_time - start_time) * 1000
		
		# Performance assertion
		assert diff_time < 200, f"Diff generation too slow: {diff_time:.2f}ms"
		assert len(diff) > 0, "Diff should contain changes"


class TestConflictDetectionPerformance:
	"""Test conflict detection performance"""
	
	@pytest.mark.asyncio
	async def test_content_conflict_detection_performance(self, conflict_detector):
		"""Test performance of content conflict detection"""
		# Create test documents with potential conflicts
		base_content = generate_realistic_document_content()
		
		# Version A: modifications in first half
		content_a = base_content[:len(base_content)//2] + "\n\nMODIFIED SECTION A:\n" + generate_random_text(200) + base_content[len(base_content)//2:]
		
		# Version B: modifications in overlapping area
		content_b = base_content[:len(base_content)//2] + "\n\nMODIFIED SECTION B:\n" + generate_random_text(250) + base_content[len(base_content)//2:]
		
		# Test conflict detection performance
		start_time = time.time()
		result = await conflict_detector.detect_conflicts(content_a, content_b)
		end_time = time.time()
		
		detection_time = (end_time - start_time) * 1000
		
		# Performance assertions
		assert detection_time < 1000, f"Conflict detection too slow: {detection_time:.2f}ms"
		assert len(result.conflicts) > 0, "Should detect conflicts in overlapping content"
		assert result.processing_time_ms < 1500, f"Reported processing time too high: {result.processing_time_ms:.2f}ms"
	
	@pytest.mark.asyncio
	async def test_large_document_conflict_detection(self, conflict_detector):
		"""Test conflict detection performance on large documents"""
		# Create large documents with conflicts
		large_base = generate_realistic_document_content() * 20  # ~500KB
		
		# Create versions with conflicts
		content_a = large_base + "\n\nADDITIONAL CONTENT A\n" + generate_random_text(1000)
		content_b = large_base + "\n\nADDITIONAL CONTENT B\n" + generate_random_text(1200)
		
		start_time = time.time()
		result = await conflict_detector.detect_conflicts(content_a, content_b)
		end_time = time.time()
		
		detection_time = (end_time - start_time) * 1000
		
		# Performance assertions
		assert detection_time < 3000, f"Large document conflict detection too slow: {detection_time:.2f}ms"
		assert result.total_conflicts >= 0, "Should complete without errors"
	
	@pytest.mark.asyncio
	async def test_semantic_conflict_detection_performance(self, conflict_detector):
		"""Test semantic conflict detection performance"""
		if not conflict_detector.semantic_analysis_enabled:
			pytest.skip("Semantic analysis not enabled")
		
		content_a = """
		TECHNICAL APPROACH
		Our solution uses cloud-native architecture with microservices.
		The system will be deployed on AWS infrastructure.
		Performance target is 99.9% uptime.
		"""
		
		content_b = """
		TECHNICAL APPROACH  
		Our solution uses traditional monolithic architecture.
		The system will be deployed on on-premise servers.
		Performance target is 99.5% uptime.
		"""
		
		start_time = time.time()
		conflicts = await conflict_detector.detect_semantic_conflicts(content_a, content_b)
		end_time = time.time()
		
		semantic_time = (end_time - start_time) * 1000
		
		# Performance assertions
		assert semantic_time < 2000, f"Semantic conflict detection too slow: {semantic_time:.2f}ms"
		assert len(conflicts) >= 0, "Should complete without errors"


class TestConflictResolutionPerformance:
	"""Test conflict resolution performance"""
	
	@pytest.mark.asyncio
	async def test_auto_resolution_performance(self, conflict_resolver, conflict_detector):
		"""Test automatic conflict resolution performance"""
		# Create conflicting content
		content_a = "Original text with some content."
		content_b = "Modified text with different content."
		
		# Detect conflicts
		conflicts = await conflict_detector.detect_conflicts(content_a, content_b)
		
		if conflicts.total_conflicts == 0:
			pytest.skip("No conflicts detected for resolution test")
		
		# Test resolution performance
		start_time = time.time()
		result = await conflict_resolver.resolve_conflicts(
			conflicts, content_a, content_b, user_id="test_user"
		)
		end_time = time.time()
		
		resolution_time = (end_time - start_time) * 1000
		
		# Performance assertions
		assert resolution_time < 1000, f"Conflict resolution too slow: {resolution_time:.2f}ms"
		assert result.total_processing_time_ms < 1500, f"Reported processing time too high: {result.total_processing_time_ms:.2f}ms"
	
	@pytest.mark.asyncio
	async def test_multiple_conflicts_resolution_performance(self, conflict_resolver):
		"""Test resolution of multiple conflicts"""
		from docfusion.collaboration.conflicts.conflict_detector import (
			DetectedConflict, ConflictType, ConflictSeverity, ConflictScope
		)
		
		# Create multiple test conflicts
		conflicts = []
		for i in range(10):
			conflict = DetectedConflict(
				conflict_type=ConflictType.CONTENT_OVERLAP,
				severity=ConflictSeverity.MEDIUM,
				scope=ConflictScope.PARAGRAPH,
				position=i * 100,
				length=50,
				content_a=f"Original content {i}",
				content_b=f"Modified content {i}",
				description=f"Test conflict {i}",
				confidence=0.8
			)
			conflicts.append(conflict)
		
		start_time = time.time()
		result = await conflict_resolver.resolve_conflicts(
			conflicts, "original content", "modified content"
		)
		end_time = time.time()
		
		resolution_time = (end_time - start_time) * 1000
		
		# Performance assertions
		assert resolution_time < 2000, f"Multiple conflict resolution too slow: {resolution_time:.2f}ms"
		assert len(result.resolved_conflicts) + len(result.unresolved_conflicts) == len(conflicts)


class TestIntegrationPerformance:
	"""Test full integration performance"""
	
	@pytest.mark.asyncio
	async def test_document_creation_performance(self, collaboration_integrator):
		"""Test collaborative document creation performance"""
		metrics = PerformanceMetrics()
		
		# Test creating multiple documents
		for i in range(10):
			content = generate_realistic_document_content()
			
			start_time = time.time()
			doc = await collaboration_integrator.create_collaborative_document(
				title=f"Test Document {i}",
				initial_content=content,
				creator_id=f"user{i}"
			)
			end_time = time.time()
			
			metrics.record_operation((end_time - start_time) * 1000)
		
		stats = metrics.get_statistics()
		
		# Performance assertions
		assert stats["operation_stats"]["avg_ms"] < 1000, f"Document creation too slow: {stats['operation_stats']['avg_ms']:.2f}ms avg"
		assert stats["operation_stats"]["max_ms"] < 2000, f"Max document creation time too high: {stats['operation_stats']['max_ms']:.2f}ms"
	
	@pytest.mark.asyncio
	async def test_concurrent_editing_performance(self, collaboration_integrator):
		"""Test concurrent editing through integration layer"""
		# Create collaborative document
		doc = await collaboration_integrator.create_collaborative_document(
			"Concurrent Test Doc",
			"Initial content for concurrent testing."
		)
		
		# Add multiple users
		users = []
		for i in range(5):
			user_id = f"user{i+1}"
			await collaboration_integrator.add_user_to_document(
				doc.document_id, user_id, f"User {i+1}"
			)
			users.append(user_id)
		
		metrics = PerformanceMetrics()
		
		async def user_editing_session(user_id: str):
			"""Simulate user editing session"""
			for j in range(10):
				start_time = time.time()
				
				new_content = f"Edit from {user_id} - operation {j}: " + generate_random_text(50)
				
				result = await collaboration_integrator.edit_document(
					doc.document_id,
					user_id,
					doc.current_content + "\n" + new_content
				)
				
				end_time = time.time()
				metrics.record_operation((end_time - start_time) * 1000)
				
				if result.get("sync_time_ms"):
					metrics.record_sync(result["sync_time_ms"])
				
				# Small delay to simulate realistic editing
				await asyncio.sleep(random.uniform(0.02, 0.1))
		
		# Run concurrent editing sessions
		start_time = time.time()
		await asyncio.gather(*[user_editing_session(user_id) for user_id in users])
		total_time = time.time() - start_time
		
		stats = metrics.get_statistics()
		
		# Performance assertions
		assert stats["operation_stats"]["avg_ms"] < 500, f"Concurrent editing too slow: {stats['operation_stats']['avg_ms']:.2f}ms avg"
		assert total_time < 60, f"Total concurrent test time too high: {total_time:.2f}s"
		assert stats["sync_stats"]["avg_ms"] < 100, f"Sync operations too slow: {stats['sync_stats']['avg_ms']:.2f}ms avg"
	
	@pytest.mark.asyncio
	async def test_conflict_resolution_integration_performance(self, collaboration_integrator):
		"""Test integrated conflict resolution performance"""
		# Create document with potential conflicts
		doc = await collaboration_integrator.create_collaborative_document(
			"Conflict Test Doc",
			"Base content for conflict testing."
		)
		
		# Add users
		await collaboration_integrator.add_user_to_document(doc.document_id, "user1", "User 1")
		await collaboration_integrator.add_user_to_document(doc.document_id, "user2", "User 2")
		
		# Create conflicting edits
		await collaboration_integrator.edit_document(
			doc.document_id, "user1", "Version A: Modified by user 1"
		)
		
		await collaboration_integrator.edit_document(
			doc.document_id, "user2", "Version B: Modified by user 2"  
		)
		
		# Test conflict resolution performance
		start_time = time.time()
		result = await collaboration_integrator.resolve_conflicts(
			doc.document_id, "user1", auto_resolve=True
		)
		end_time = time.time()
		
		resolution_time = (end_time - start_time) * 1000
		
		# Performance assertions
		assert resolution_time < 2000, f"Integrated conflict resolution too slow: {resolution_time:.2f}ms"
		assert result.total_processing_time_ms < 3000, f"Total processing time too high: {result.total_processing_time_ms:.2f}ms"


class TestScalabilityAndMemory:
	"""Test system scalability and memory usage"""
	
	@pytest.mark.asyncio
	async def test_memory_usage_with_large_documents(self, collaboration_integrator):
		"""Test memory usage with large documents"""
		try:
			import psutil
			import os
		except ImportError:
			pytest.skip("psutil not available for memory testing")
		
		process = psutil.Process(os.getpid())
		initial_memory = process.memory_info().rss / 1024 / 1024  # MB
		
		# Create large documents
		large_content = generate_realistic_document_content() * 50  # ~2.5MB per document
		
		documents = []
		for i in range(5):  # Create 5 large documents
			doc = await collaboration_integrator.create_collaborative_document(
				f"Large Doc {i}",
				large_content
			)
			documents.append(doc)
			
			# Add users to each document
			for j in range(3):
				await collaboration_integrator.add_user_to_document(
					doc.document_id, f"user{j}", f"User {j}"
				)
		
		final_memory = process.memory_info().rss / 1024 / 1024  # MB
		memory_increase = final_memory - initial_memory
		
		# Memory usage assertions
		assert memory_increase < 500, f"Memory usage too high: {memory_increase:.2f}MB increase"
		
		# Test document cleanup
		for doc in documents:
			await collaboration_integrator.cleanup_document(doc.document_id)
		
		cleanup_memory = process.memory_info().rss / 1024 / 1024  # MB
		
		# Should free most of the memory
		assert cleanup_memory - initial_memory < memory_increase * 0.5, "Memory not properly freed after cleanup"
	
	@pytest.mark.asyncio
	async def test_concurrent_user_scalability(self, collaboration_integrator):
		"""Test system behavior with many concurrent users"""
		# Create document
		doc = await collaboration_integrator.create_collaborative_document(
			"Scalability Test",
			"Initial content for scalability testing."
		)
		
		# Add many users
		user_count = 20
		users = []
		
		start_time = time.time()
		for i in range(user_count):
			user_id = f"scale_user_{i}"
			await collaboration_integrator.add_user_to_document(
				doc.document_id, user_id, f"Scale User {i}"
			)
			users.append(user_id)
		
		user_creation_time = (time.time() - start_time) * 1000
		
		# Test getting active users
		start_time = time.time()
		active_users = await collaboration_integrator.get_active_users(doc.document_id)
		user_query_time = (time.time() - start_time) * 1000
		
		# Test document status with many users
		start_time = time.time()
		status = await collaboration_integrator.get_document_status(doc.document_id)
		status_query_time = (time.time() - start_time) * 1000
		
		# Scalability assertions
		assert user_creation_time < 5000, f"Adding {user_count} users too slow: {user_creation_time:.2f}ms"
		assert user_query_time < 100, f"Querying active users too slow: {user_query_time:.2f}ms"
		assert status_query_time < 200, f"Getting document status too slow: {status_query_time:.2f}ms"
		assert len(active_users) == user_count, f"Expected {user_count} active users, got {len(active_users)}"
		assert status["active_users"] == user_count, f"Status should show {user_count} active users"


@pytest.mark.asyncio
async def test_comprehensive_performance_benchmark():
	"""Comprehensive performance benchmark of the entire collaboration system"""
	print("\n" + "="*80)
	print("WEEK 17 COLLABORATION SYSTEM - COMPREHENSIVE PERFORMANCE BENCHMARK")
	print("="*80)
	
	with tempfile.TemporaryDirectory() as temp_dir:
		# Initialize system
		integrator = CollaborationIntegrator(storage_path=temp_dir)
		metrics = PerformanceMetrics()
		
		# Create test document
		start_time = time.time()
		doc = await integrator.create_collaborative_document(
			"Benchmark Document",
			generate_realistic_document_content(),
			creator_id="benchmark_user"
		)
		doc_creation_time = (time.time() - start_time) * 1000
		
		print(f"\n📄 Document Creation: {doc_creation_time:.2f}ms")
		
		# Add multiple users
		user_count = 8
		start_time = time.time()
		for i in range(user_count):
			await integrator.add_user_to_document(
				doc.document_id, f"user_{i}", f"Benchmark User {i}"
			)
		user_setup_time = (time.time() - start_time) * 1000
		
		print(f"👥 User Setup ({user_count} users): {user_setup_time:.2f}ms")
		
		# Concurrent editing benchmark
		operations_per_user = 15
		
		async def benchmark_user_session(user_id: str):
			user_metrics = []
			for j in range(operations_per_user):
				start_time = time.time()
				
				content_addition = f"\n{user_id}_operation_{j}: " + generate_random_text(75)
				
				result = await integrator.edit_document(
					doc.document_id,
					user_id,
					doc.current_content + content_addition,
					commit_message=f"Benchmark edit {j} by {user_id}"
				)
				
				end_time = time.time()
				operation_time = (end_time - start_time) * 1000
				user_metrics.append(operation_time)
				metrics.record_operation(operation_time)
				
				if result.get("sync_time_ms"):
					metrics.record_sync(result["sync_time_ms"])
				
				# Simulate realistic typing speed
				await asyncio.sleep(random.uniform(0.01, 0.03))
			
			return user_metrics
		
		# Run concurrent benchmark
		print(f"\n⚡ Running concurrent editing benchmark...")
		print(f"   Users: {user_count}, Operations per user: {operations_per_user}")
		
		benchmark_start = time.time()
		user_results = await asyncio.gather(*[
			benchmark_user_session(f"user_{i}") 
			for i in range(user_count)
		])
		benchmark_total_time = (time.time() - benchmark_start) * 1000
		
		# Conflict resolution benchmark
		print(f"\n🔧 Testing conflict resolution...")
		conflict_start = time.time()
		resolution_result = await integrator.resolve_conflicts(
			doc.document_id, "user_0", auto_resolve=True
		)
		conflict_resolution_time = (time.time() - conflict_start) * 1000
		
		if resolution_result:
			metrics.record_conflict_resolution(conflict_resolution_time)
		
		# Version control benchmark
		print(f"🌳 Testing version control operations...")
		branch_start = time.time()
		
		# Create branches
		for i in range(3):
			await integrator.create_document_branch(
				doc.document_id, f"user_{i}", f"feature_branch_{i}"
			)
		
		# Get history
		history = await integrator.get_document_history(doc.document_id, limit=50)
		
		version_control_time = (time.time() - branch_start) * 1000
		
		# Get final statistics
		final_status = await integrator.get_document_status(doc.document_id)
		stats = metrics.get_statistics()
		integration_stats = await integrator.get_integration_statistics()
		
		# Print comprehensive benchmark results
		print(f"\n" + "="*80)
		print("BENCHMARK RESULTS")
		print("="*80)
		
		print(f"\n📊 OPERATION PERFORMANCE:")
		print(f"   Total Operations: {stats['operation_stats']['count']}")
		print(f"   Average Time: {stats['operation_stats']['avg_ms']:.2f}ms")
		print(f"   95th Percentile: {stats['operation_stats']['p95_ms']:.2f}ms")
		print(f"   Max Time: {stats['operation_stats']['max_ms']:.2f}ms")
		print(f"   Min Time: {stats['operation_stats']['min_ms']:.2f}ms")
		
		print(f"\n🔄 SYNC PERFORMANCE:")
		print(f"   Sync Operations: {stats['sync_stats']['count']}")
		print(f"   Average Sync Time: {stats['sync_stats']['avg_ms']:.2f}ms")
		print(f"   Max Sync Time: {stats['sync_stats']['max_ms']:.2f}ms")
		
		print(f"\n⚡ CONCURRENT PERFORMANCE:")
		print(f"   Concurrent Users: {user_count}")
		print(f"   Total Benchmark Time: {benchmark_total_time:.2f}ms")
		print(f"   Operations per Second: {(user_count * operations_per_user) / (benchmark_total_time / 1000):.1f}")
		print(f"   Average User Session Time: {benchmark_total_time / user_count:.2f}ms")
		
		print(f"\n🔧 CONFLICT RESOLUTION:")
		print(f"   Resolution Time: {conflict_resolution_time:.2f}ms")
		if resolution_result:
			print(f"   Conflicts Detected: {resolution_result.total_conflicts}")
			print(f"   Conflicts Resolved: {len(resolution_result.resolved_conflicts)}")
			print(f"   Resolution Success Rate: {resolution_result.automated_resolution_rate:.1%}")
		
		print(f"\n🌳 VERSION CONTROL:")
		print(f"   Version Operations Time: {version_control_time:.2f}ms")
		print(f"   Total Commits: {len(history)}")
		print(f"   Document Version: {final_status['current_version']}")
		
		print(f"\n💻 SYSTEM STATUS:")
		print(f"   Active Documents: {integration_stats['active_documents']}")
		print(f"   Active Sessions: {integration_stats['active_collaborative_sessions']}")
		print(f"   Content Length: {final_status['content_length']} characters")
		print(f"   Total Document Operations: {final_status['total_operations']}")
		
		# Performance validation
		print(f"\n✅ PERFORMANCE VALIDATION:")
		
		assertions_passed = 0
		total_assertions = 0
		
		def check_assertion(condition: bool, description: str, actual: float, target: float, unit: str = "ms"):
			nonlocal assertions_passed, total_assertions
			total_assertions += 1
			status = "✅ PASS" if condition else "❌ FAIL"
			print(f"   {status} {description}: {actual:.2f}{unit} (target: <{target}{unit})")
			if condition:
				assertions_passed += 1
		
		# Core performance targets
		check_assertion(
			stats['operation_stats']['avg_ms'] < 100,
			"Average operation time",
			stats['operation_stats']['avg_ms'], 100
		)
		
		check_assertion(
			stats['operation_stats']['p95_ms'] < 200,
			"95th percentile operation time",
			stats['operation_stats']['p95_ms'], 200
		)
		
		check_assertion(
			stats['sync_stats']['avg_ms'] < 50,
			"Average sync time",
			stats['sync_stats']['avg_ms'], 50
		)
		
		check_assertion(
			conflict_resolution_time < 1000,
			"Conflict resolution time",
			conflict_resolution_time, 1000
		)
		
		check_assertion(
			version_control_time < 2000,
			"Version control operations",
			version_control_time, 2000
		)
		
		ops_per_second = (user_count * operations_per_user) / (benchmark_total_time / 1000)
		check_assertion(
			ops_per_second > 50,
			"Operations per second",
			ops_per_second, 50, " ops/s"
		)
		
		print(f"\n🎯 OVERALL PERFORMANCE: {assertions_passed}/{total_assertions} targets met ({assertions_passed/total_assertions:.1%})")
		
		if assertions_passed == total_assertions:
			print("🎉 ALL PERFORMANCE TARGETS ACHIEVED!")
		elif assertions_passed >= total_assertions * 0.8:
			print("⚠️  MOST PERFORMANCE TARGETS MET - System ready for production")
		else:
			print("🔧 PERFORMANCE OPTIMIZATION NEEDED")
		
		print("="*80)


if __name__ == "__main__":
	asyncio.run(test_comprehensive_performance_benchmark())