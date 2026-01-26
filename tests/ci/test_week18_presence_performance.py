"""
Performance tests for Week 18 presence tracking and workflow foundation.

Tests real-time presence management, activity tracking, permissions,
and workflow integration under various load conditions.
"""

import asyncio
import pytest
import time
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any

def uuid7str():
	"""Generate a UUID7-like string using UUID4 for compatibility."""
	return str(uuid.uuid4())

from docfusion.collaboration.presence.presence_manager import (
	PresenceManager, PresenceStatus, CursorPosition
)
from docfusion.collaboration.presence.activity_tracker import (
	ActivityTracker, ActivityType
)
from docfusion.collaboration.permissions.collaboration_permissions import (
	CollaborationPermissions, Permission, PermissionScope
)
from docfusion.workflow.processes.process_definition import (
	ProcessDefinition, NodeType
)
from docfusion.workflow.processes.workflow_template import (
	WorkflowTemplate, TemplateCategory, IndustryType
)
from docfusion.workflow.collaboration_workflow_integration import (
	CollaborationWorkflowIntegrator
)


@pytest.fixture
async def presence_manager():
	"""Create presence manager for testing."""
	manager = PresenceManager()
	await manager.start_cleanup_task()
	yield manager
	await manager.cleanup()


@pytest.fixture
async def activity_tracker():
	"""Create activity tracker for testing."""
	tracker = ActivityTracker()
	yield tracker
	await tracker.cleanup()


@pytest.fixture
async def permissions_manager():
	"""Create permissions manager for testing."""
	manager = CollaborationPermissions()
	yield manager
	await manager.cleanup()


@pytest.fixture
async def process_definition():
	"""Create process definition manager for testing."""
	manager = ProcessDefinition()
	yield manager
	await manager.cleanup()


@pytest.fixture
async def workflow_template():
	"""Create workflow template manager for testing."""
	manager = WorkflowTemplate()
	yield manager
	await manager.cleanup()


@pytest.fixture
async def workflow_integrator(presence_manager, permissions_manager, process_definition, workflow_template):
	"""Create workflow integrator for testing."""
	integrator = CollaborationWorkflowIntegrator(
		presence_manager=presence_manager,
		permissions_manager=permissions_manager,
		process_definition=process_definition,
		workflow_template=workflow_template
	)
	await integrator.start_monitoring()
	yield integrator
	await integrator.cleanup()


class TestPresencePerformance:
	"""Test presence manager performance under load."""
	
	@pytest.mark.asyncio
	async def test_concurrent_user_connections(self, presence_manager):
		"""Test handling many concurrent user connections."""
		document_id = "test_doc_concurrent"
		user_count = 100
		
		start_time = time.time()
		
		# Add users concurrently
		tasks = []
		for i in range(user_count):
			user_id = f"user_{i}"
			user_name = f"User {i}"
			task = presence_manager.add_user_to_document(
				document_id, user_id, user_name
			)
			tasks.append(task)
		
		sessions = await asyncio.gather(*tasks)
		connection_time = time.time() - start_time
		
		# Verify all users connected
		assert len(sessions) == user_count
		for session in sessions:
			assert session.document_id == document_id
			assert session.is_online
		
		# Performance assertions
		assert connection_time < 5.0, f"Connection time too high: {connection_time:.2f}s"
		assert connection_time / user_count < 0.05, f"Average connection time per user too high: {(connection_time / user_count):.3f}s"
		
		# Test getting active users
		start_time = time.time()
		active_users = await presence_manager.get_active_users(document_id)
		retrieval_time = time.time() - start_time
		
		assert len(active_users) == user_count
		assert retrieval_time < 1.0, f"User retrieval time too high: {retrieval_time:.2f}s"
	
	@pytest.mark.asyncio
	async def test_high_frequency_cursor_updates(self, presence_manager):
		"""Test handling high-frequency cursor position updates."""
		document_id = "test_doc_cursor"
		user_count = 50
		updates_per_user = 100
		
		# Add users
		sessions = []
		for i in range(user_count):
			session = await presence_manager.add_user_to_document(
				document_id, f"user_{i}", f"User {i}"
			)
			sessions.append(session)
		
		# Generate cursor updates concurrently
		start_time = time.time()
		
		async def update_cursor_positions(session_id: str, user_index: int):
			"""Update cursor positions for a user."""
			update_times = []
			for j in range(updates_per_user):
				update_start = time.time()
				
				success = await presence_manager.update_cursor_position(
					session_id=session_id,
					position=j * 10,
					selection_start=j * 10,
					selection_end=j * 10 + 5,
					line=j // 80,
					column=j % 80
				)
				
				update_end = time.time()
				update_times.append((update_end - update_start) * 1000)  # Convert to ms
				
				assert success, f"Cursor update failed for user {user_index}, update {j}"
				
				# Small delay to simulate realistic usage
				await asyncio.sleep(0.001)
			
			return update_times
		
		# Run all cursor updates concurrently
		tasks = [
			update_cursor_positions(session.session_id, i) 
			for i, session in enumerate(sessions)
		]
		
		all_update_times = await asyncio.gather(*tasks)
		total_time = time.time() - start_time
		
		# Analyze performance
		flat_times = [t for user_times in all_update_times for t in user_times]
		total_updates = user_count * updates_per_user
		
		avg_update_time = sum(flat_times) / len(flat_times)
		max_update_time = max(flat_times)
		updates_per_second = total_updates / total_time
		
		# Performance assertions
		assert avg_update_time < 10.0, f"Average cursor update time too high: {avg_update_time:.2f}ms"
		assert max_update_time < 100.0, f"Maximum cursor update time too high: {max_update_time:.2f}ms"
		assert updates_per_second > 1000, f"Updates per second too low: {updates_per_second:.1f}"
		
		print(f"Cursor update performance:")
		print(f"  Total updates: {total_updates}")
		print(f"  Total time: {total_time:.2f}s")
		print(f"  Updates/second: {updates_per_second:.1f}")
		print(f"  Average update time: {avg_update_time:.2f}ms")
		print(f"  Max update time: {max_update_time:.2f}ms")
	
	@pytest.mark.asyncio
	async def test_presence_subscription_performance(self, presence_manager):
		"""Test performance of presence update notifications."""
		document_id = "test_doc_subscriptions"
		subscriber_count = 20
		user_count = 10
		updates_per_user = 50
		
		# Setup subscribers
		received_updates = [[] for _ in range(subscriber_count)]
		
		async def create_subscriber(subscriber_index: int):
			def callback(update):
				received_updates[subscriber_index].append(update)
			
			return await presence_manager.subscribe_to_presence_updates(
				document_id, callback
			)
		
		subscription_tasks = [create_subscriber(i) for i in range(subscriber_count)]
		subscription_ids = await asyncio.gather(*subscription_tasks)
		
		# Add users
		sessions = []
		for i in range(user_count):
			session = await presence_manager.add_user_to_document(
				document_id, f"user_{i}", f"User {i}"
			)
			sessions.append(session)
		
		# Generate status updates
		start_time = time.time()
		
		async def generate_updates(session):
			for j in range(updates_per_user):
				status = PresenceStatus.EDITING if j % 2 == 0 else PresenceStatus.VIEWING
				await presence_manager.update_user_status(
					session.session_id,
					status,
					CursorPosition(position=j * 10)
				)
				await asyncio.sleep(0.001)
		
		update_tasks = [generate_updates(session) for session in sessions]
		await asyncio.gather(*update_tasks)
		
		notification_time = time.time() - start_time
		
		# Wait for all notifications to be processed
		await asyncio.sleep(0.1)
		
		# Verify notification delivery
		total_expected_updates = user_count * updates_per_user * 2  # status + cursor updates
		
		for i, updates in enumerate(received_updates):
			assert len(updates) > 0, f"Subscriber {i} received no updates"
		
		# Performance assertions
		total_notifications = sum(len(updates) for updates in received_updates)
		notifications_per_second = total_notifications / notification_time
		
		assert notification_time < 5.0, f"Notification time too high: {notification_time:.2f}s"
		assert notifications_per_second > 1000, f"Notifications per second too low: {notifications_per_second:.1f}"
		
		print(f"Presence notification performance:")
		print(f"  Subscribers: {subscriber_count}")
		print(f"  Total notifications: {total_notifications}")
		print(f"  Notification time: {notification_time:.2f}s")
		print(f"  Notifications/second: {notifications_per_second:.1f}")


class TestActivityTrackingPerformance:
	"""Test activity tracker performance under load."""
	
	@pytest.mark.asyncio
	async def test_high_volume_activity_logging(self, activity_tracker):
		"""Test logging high volume of activities."""
		document_id = "test_doc_activities"
		user_count = 20
		activities_per_user = 200
		
		# Start user sessions
		sessions = []
		for i in range(user_count):
			session = await activity_tracker.start_session(
				f"session_{i}", document_id, f"user_{i}"
			)
			sessions.append(session)
		
		# Log activities concurrently
		start_time = time.time()
		
		async def log_user_activities(session_id: str, user_id: str):
			activity_types = [
				ActivityType.TEXT_INSERT,
				ActivityType.TEXT_DELETE,
				ActivityType.CURSOR_MOVE,
				ActivityType.SECTION_NAVIGATE,
				ActivityType.SAVE_DOCUMENT
			]
			
			log_times = []
			for j in range(activities_per_user):
				log_start = time.time()
				
				activity_type = activity_types[j % len(activity_types)]
				await activity_tracker.log_activity(
					document_id=document_id,
					user_id=user_id,
					session_id=session_id,
					activity_type=activity_type,
					content_length=50 if activity_type in [ActivityType.TEXT_INSERT, ActivityType.TEXT_DELETE] else None,
					section_id=f"section_{j % 5}",
					metadata={"sequence": j}
				)
				
				log_end = time.time()
				log_times.append((log_end - log_start) * 1000)
				
				await asyncio.sleep(0.0001)  # Minimal delay
			
			return log_times
		
		# Run activity logging concurrently
		tasks = [
			log_user_activities(session.session_id, f"user_{i}")
			for i, session in enumerate(sessions)
		]
		
		all_log_times = await asyncio.gather(*tasks)
		total_time = time.time() - start_time
		
		# Analyze performance
		flat_times = [t for user_times in all_log_times for t in user_times]
		total_activities = user_count * activities_per_user
		
		avg_log_time = sum(flat_times) / len(flat_times)
		activities_per_second = total_activities / total_time
		
		# Performance assertions
		assert avg_log_time < 5.0, f"Average activity log time too high: {avg_log_time:.2f}ms"
		assert activities_per_second > 5000, f"Activities per second too low: {activities_per_second:.1f}"
		
		print(f"Activity logging performance:")
		print(f"  Total activities: {total_activities}")
		print(f"  Total time: {total_time:.2f}s")
		print(f"  Activities/second: {activities_per_second:.1f}")
		print(f"  Average log time: {avg_log_time:.2f}ms")
	
	@pytest.mark.asyncio
	async def test_productivity_metrics_calculation(self, activity_tracker):
		"""Test performance of productivity metrics calculation."""
		document_id = "test_doc_metrics"
		user_count = 10
		
		# Create sessions and log activities
		for i in range(user_count):
			session = await activity_tracker.start_session(
				f"session_{i}", document_id, f"user_{i}"
			)
			
			# Log varied activities for each user
			for j in range(100):
				await activity_tracker.log_activity(
					document_id=document_id,
					user_id=f"user_{i}",
					session_id=session.session_id,
					activity_type=ActivityType.TEXT_INSERT,
					content_length=j + 1,
					duration_ms=100 + j
				)
			
			await activity_tracker.end_session(session.session_id)
		
		# Test metrics calculation performance
		start_time = time.time()
		
		metrics_tasks = [
			activity_tracker.get_user_productivity_metrics(f"user_{i}")
			for i in range(user_count)
		]
		
		metrics_results = await asyncio.gather(*metrics_tasks)
		calculation_time = time.time() - start_time
		
		# Verify metrics were calculated
		for metrics in metrics_results:
			assert metrics.total_activities > 0
			assert metrics.total_session_time_hours > 0
			assert metrics.average_productivity_score > 0
		
		# Performance assertions
		assert calculation_time < 2.0, f"Metrics calculation time too high: {calculation_time:.2f}s"
		
		print(f"Productivity metrics performance:")
		print(f"  Users: {user_count}")
		print(f"  Calculation time: {calculation_time:.2f}s")
		print(f"  Time per user: {(calculation_time / user_count):.3f}s")


class TestPermissionsPerformance:
	"""Test permissions manager performance under load."""
	
	@pytest.mark.asyncio
	async def test_bulk_permission_operations(self, permissions_manager):
		"""Test bulk permission granting and checking."""
		user_count = 100
		resource_count = 50
		permissions_per_user = 10
		
		# Generate test data
		users = [f"user_{i}" for i in range(user_count)]
		resources = [f"resource_{i}" for i in range(resource_count)]
		permissions = [Permission.READ, Permission.WRITE, Permission.COMMENT, Permission.REVIEW]
		
		# Grant permissions in bulk
		start_time = time.time()
		
		grant_tasks = []
		for user_id in users:
			for resource_id in resources[:permissions_per_user]:  # Limit to avoid combinatorial explosion
				for permission in permissions[:2]:  # Use subset of permissions
					task = permissions_manager.grant_permission(
						user_id=user_id,
						permission=permission,
						scope=PermissionScope.DOCUMENT,
						target_id=resource_id,
						granted_by="admin"
					)
					grant_tasks.append(task)
		
		await asyncio.gather(*grant_tasks)
		grant_time = time.time() - start_time
		
		total_grants = len(grant_tasks)
		grants_per_second = total_grants / grant_time
		
		# Test permission checking performance
		check_start = time.time()
		
		check_tasks = []
		for user_id in users:
			for resource_id in resources[:5]:  # Check fewer to focus on performance
				for permission in permissions[:2]:
					task = permissions_manager.check_permission(
						user_id=user_id,
						permission=permission,
						target_id=resource_id,
						scope=PermissionScope.DOCUMENT
					)
					check_tasks.append(task)
		
		check_results = await asyncio.gather(*check_tasks)
		check_time = time.time() - check_start
		
		total_checks = len(check_tasks)
		checks_per_second = total_checks / check_time
		
		# Verify some permissions were granted
		granted_count = sum(1 for result in check_results if result)
		assert granted_count > 0, "No permissions were found to be granted"
		
		# Performance assertions
		assert grant_time < 10.0, f"Permission granting time too high: {grant_time:.2f}s"
		assert check_time < 5.0, f"Permission checking time too high: {check_time:.2f}s"
		assert grants_per_second > 100, f"Grants per second too low: {grants_per_second:.1f}"
		assert checks_per_second > 1000, f"Checks per second too low: {checks_per_second:.1f}"
		
		print(f"Permission operation performance:")
		print(f"  Total grants: {total_grants} in {grant_time:.2f}s ({grants_per_second:.1f}/s)")
		print(f"  Total checks: {total_checks} in {check_time:.2f}s ({checks_per_second:.1f}/s)")
		print(f"  Permissions found: {granted_count}/{total_checks}")


class TestWorkflowIntegrationPerformance:
	"""Test workflow integration performance."""
	
	@pytest.mark.asyncio
	async def test_concurrent_workflow_executions(self, workflow_integrator, process_definition):
		"""Test multiple concurrent workflow executions."""
		workflow_count = 10
		users_per_workflow = 5
		
		# Create a simple test process
		process = await process_definition.create_process(
			name="Test Process",
			description="Simple test process",
			created_by="admin"
		)
		
		# Add nodes to process
		start_node = await process_definition.add_node(
			process.process_id, NodeType.START, "Start"
		)
		
		task_node = await process_definition.add_node(
			process.process_id, NodeType.USER_TASK, "Review Task"
		)
		
		end_node = await process_definition.add_node(
			process.process_id, NodeType.END, "End"
		)
		
		# Add edges
		await process_definition.add_edge(
			process.process_id, start_node.node_id, task_node.node_id
		)
		
		await process_definition.add_edge(
			process.process_id, task_node.node_id, end_node.node_id
		)
		
		# Start multiple workflows concurrently
		start_time = time.time()
		
		async def start_and_complete_workflow(workflow_index: int):
			document_id = f"doc_{workflow_index}"
			initiator = f"user_{workflow_index}_0"
			
			# Start workflow
			execution = await workflow_integrator.start_workflow_for_document(
				process.process_id, document_id, initiator
			)
			
			# Add users to workflow
			for i in range(users_per_workflow):
				user_id = f"user_{workflow_index}_{i}"
				await workflow_integrator.assign_task_to_users(
					execution.execution_id, task_node.node_id, [user_id], initiator
				)
			
			# Complete the task
			await workflow_integrator.complete_task(
				execution.execution_id, task_node.node_id, initiator
			)
			
			return execution.execution_id
		
		# Run workflows concurrently
		workflow_tasks = [
			start_and_complete_workflow(i) for i in range(workflow_count)
		]
		
		execution_ids = await asyncio.gather(*workflow_tasks)
		total_time = time.time() - start_time
		
		# Verify all workflows completed
		assert len(execution_ids) == workflow_count
		
		for execution_id in execution_ids:
			status = await workflow_integrator.get_workflow_status(execution_id)
			assert status is not None
			assert status["status"] in ["completed", "running"]
		
		# Performance assertions
		workflows_per_second = workflow_count / total_time
		
		assert total_time < 30.0, f"Total workflow execution time too high: {total_time:.2f}s"
		assert workflows_per_second > 0.5, f"Workflows per second too low: {workflows_per_second:.2f}"
		
		print(f"Workflow execution performance:")
		print(f"  Workflows: {workflow_count}")
		print(f"  Users per workflow: {users_per_workflow}")
		print(f"  Total time: {total_time:.2f}s")
		print(f"  Workflows/second: {workflows_per_second:.2f}")


class TestIntegratedSystemPerformance:
	"""Test integrated system performance under realistic load."""
	
	@pytest.mark.asyncio
	async def test_realistic_collaboration_scenario(
		self,
		presence_manager,
		activity_tracker,
		permissions_manager,
		workflow_integrator,
		process_definition
	):
		"""Test realistic collaboration scenario with all components."""
		document_count = 5
		users_per_document = 10
		activities_per_user = 50
		
		# Create test processes
		processes = []
		for i in range(document_count):
			process = await process_definition.create_process(
				name=f"Document Process {i}",
				description=f"Test process for document {i}",
				created_by="admin"
			)
			processes.append(process)
		
		start_time = time.time()
		
		async def simulate_document_collaboration(doc_index: int, process):
			document_id = f"collaborative_doc_{doc_index}"
			
			# Add users to document
			user_sessions = []
			for u in range(users_per_document):
				user_id = f"doc{doc_index}_user_{u}"
				session = await presence_manager.add_user_to_document(
					document_id, user_id, f"User {u}"
				)
				user_sessions.append((user_id, session))
			
			# Grant permissions
			for user_id, session in user_sessions:
				await permissions_manager.grant_permission(
					user_id=user_id,
					permission=Permission.WRITE,
					scope=PermissionScope.DOCUMENT,
					target_id=document_id,
					granted_by="admin"
				)
			
			# Start activity tracking sessions
			for user_id, session in user_sessions:
				await activity_tracker.start_session(
					session.session_id, document_id, user_id
				)
			
			# Simulate collaborative activities
			async def user_activity_simulation(user_id: str, session_id: str):
				for j in range(activities_per_user):
					# Update presence
					status = PresenceStatus.EDITING if j % 3 == 0 else PresenceStatus.VIEWING
					await presence_manager.update_cursor_position(
						session_id, j * 10, j * 10, j * 10 + 5
					)
					
					await presence_manager.update_user_status(
						session_id, status
					)
					
					# Log activity
					activity_type = ActivityType.TEXT_INSERT if j % 2 == 0 else ActivityType.CURSOR_MOVE
					await activity_tracker.log_activity(
						document_id=document_id,
						user_id=user_id,
						session_id=session_id,
						activity_type=activity_type,
						content_length=10 if activity_type == ActivityType.TEXT_INSERT else None
					)
					
					await asyncio.sleep(0.001)  # Small delay
			
			# Run user activities concurrently
			activity_tasks = [
				user_activity_simulation(user_id, session.session_id)
				for user_id, session in user_sessions
			]
			
			await asyncio.gather(*activity_tasks)
			
			# End activity sessions
			for user_id, session in user_sessions:
				await activity_tracker.end_session(session.session_id)
			
			return document_id
		
		# Simulate all documents concurrently
		document_tasks = [
			simulate_document_collaboration(i, processes[i])
			for i in range(document_count)
		]
		
		document_ids = await asyncio.gather(*document_tasks)
		total_time = time.time() - start_time
		
		# Calculate metrics
		total_users = document_count * users_per_document
		total_activities = total_users * activities_per_user
		activities_per_second = total_activities / total_time
		
		# Verify system state
		assert len(document_ids) == document_count
		
		# Check presence state
		for i, document_id in enumerate(document_ids):
			active_users = await presence_manager.get_active_users(document_id)
			assert len(active_users) == users_per_document
		
		# Check permissions
		for i, document_id in enumerate(document_ids):
			for u in range(users_per_document):
				user_id = f"doc{i}_user_{u}"
				has_write = await permissions_manager.check_permission(
					user_id, Permission.WRITE, document_id
				)
				assert has_write
		
		# Performance assertions
		assert total_time < 60.0, f"Total simulation time too high: {total_time:.2f}s"
		assert activities_per_second > 100, f"Activities per second too low: {activities_per_second:.1f}"
		
		print(f"Integrated system performance:")
		print(f"  Documents: {document_count}")
		print(f"  Users per document: {users_per_document}")
		print(f"  Activities per user: {activities_per_user}")
		print(f"  Total time: {total_time:.2f}s")
		print(f"  Total activities: {total_activities}")
		print(f"  Activities/second: {activities_per_second:.1f}")
		print(f"  Users/second: {total_users / total_time:.1f}")


# Additional benchmark tests
class TestBenchmarks:
	"""Benchmark tests for performance regression detection."""
	
	@pytest.mark.benchmark
	@pytest.mark.asyncio
	async def test_presence_manager_benchmark(self, presence_manager):
		"""Benchmark presence manager operations."""
		document_id = "benchmark_doc"
		
		# Benchmark user addition
		async def add_users_benchmark():
			tasks = []
			for i in range(50):
				task = presence_manager.add_user_to_document(
					document_id, f"bench_user_{i}", f"Benchmark User {i}"
				)
				tasks.append(task)
			return await asyncio.gather(*tasks)
		
		start = time.time()
		sessions = await add_users_benchmark()
		add_time = time.time() - start
		
		# Benchmark cursor updates
		async def cursor_updates_benchmark():
			tasks = []
			for session in sessions:
				for j in range(20):
					task = presence_manager.update_cursor_position(
						session.session_id, j * 10
					)
					tasks.append(task)
			return await asyncio.gather(*tasks)
		
		start = time.time()
		await cursor_updates_benchmark()
		update_time = time.time() - start
		
		# Benchmark user retrieval
		start = time.time()
		active_users = await presence_manager.get_active_users(document_id)
		retrieval_time = time.time() - start
		
		print(f"Presence Manager Benchmark:")
		print(f"  Add 50 users: {add_time:.3f}s ({50/add_time:.1f}/s)")
		print(f"  1000 cursor updates: {update_time:.3f}s ({1000/update_time:.1f}/s)")
		print(f"  Retrieve users: {retrieval_time:.3f}s")
		print(f"  Active users found: {len(active_users)}")
		
		# Store benchmark results for regression testing
		benchmark_results = {
			"add_users_time": add_time,
			"cursor_updates_time": update_time,
			"user_retrieval_time": retrieval_time,
			"timestamp": datetime.now().isoformat()
		}
		
		return benchmark_results


if __name__ == "__main__":
	# Run performance tests
	pytest.main([__file__, "-v", "--tb=short"])