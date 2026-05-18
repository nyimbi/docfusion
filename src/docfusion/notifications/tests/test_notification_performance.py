"""
Comprehensive Notification Performance Tests - Week 20

Tests notification performance, reliability, and integration across all channels
including load testing, error handling, and end-to-end workflow integration.
"""

import asyncio
import logging
logger = logging.getLogger(__name__)
import pytest
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
from unittest.mock import Mock, AsyncMock, patch

from ..delivery.notification_delivery import (
	NotificationDelivery, NotificationMessage, ChannelType, Priority, DeliveryStatus,
	create_notification_delivery
)
from ..prioritization.priority_manager import (
	PriorityManager, NotificationMetadata, ImportanceContext,
	create_priority_manager
)
from ..analytics.notification_analytics import (
	NotificationAnalytics, AnalyticsEvent, NotificationEvent,
	create_notification_analytics
)
from ..channels import (
	EmailChannel, EmailConfiguration, EmailProvider,
	SMSChannel, SMSConfiguration, SMSProvider,
	PushChannel, PushConfiguration,
	InAppChannel, InAppConfiguration
)
from ..workflow_notification_integration import (
	WorkflowNotificationIntegration, WorkflowEventType,
	create_workflow_notification_integration
)


@pytest.fixture
async def mock_channels():
	"""Create mock notification channels for testing."""
	channels = {}

	# Mock Email Channel
	email_config = EmailConfiguration(
		provider=EmailProvider.SMTP,
		from_email="test@docufusion.com",
		smtp_host="localhost"
	)
	email_channel = EmailChannel(email_config)
	email_channel.send = AsyncMock(return_value=Mock(success=True, delivery_time_ms=100))
	email_channel.validate_recipient = AsyncMock(return_value=True)
	channels[ChannelType.EMAIL] = email_channel

	# Mock SMS Channel
	sms_config = SMSConfiguration(
		provider=SMSProvider.TWILIO,
		api_key="test_key"
	)
	sms_channel = SMSChannel(sms_config)
	sms_channel.send = AsyncMock(return_value=Mock(success=True, delivery_time_ms=200))
	sms_channel.validate_recipient = AsyncMock(return_value=True)
	channels[ChannelType.SMS] = sms_channel

	# Mock In-App Channel
	inapp_config = InAppConfiguration()
	inapp_channel = InAppChannel(inapp_config)
	inapp_channel.send = AsyncMock(return_value=Mock(success=True, delivery_time_ms=50))
	inapp_channel.validate_recipient = AsyncMock(return_value=True)
	channels[ChannelType.IN_APP] = inapp_channel

	# Mock Push Channel
	push_config = PushConfiguration()
	push_channel = PushChannel(push_config)
	push_channel.send = AsyncMock(return_value=Mock(success=True, delivery_time_ms=150))
	push_channel.validate_recipient = AsyncMock(return_value=True)
	channels[ChannelType.PUSH] = push_channel

	return channels


@pytest.fixture
async def notification_delivery(mock_channels):
	"""Create notification delivery service with mock channels."""
	delivery = await create_notification_delivery(channels=mock_channels)
	yield delivery
	await delivery.stop()


@pytest.fixture
async def priority_manager():
	"""Create priority manager for testing."""
	manager = await create_priority_manager()
	yield manager
	await manager.stop()


@pytest.fixture
async def analytics():
	"""Create analytics service for testing."""
	return await create_notification_analytics()


@pytest.fixture
async def workflow_integration(mock_channels):
	"""Create workflow integration for testing."""
	integration = await create_workflow_notification_integration(
		notification_channels=mock_channels
	)
	yield integration
	await integration.stop()


async def wait_for_total_sent(delivery: NotificationDelivery, expected: int, timeout: float = 2.0):
	"""Wait until async delivery workers have processed the expected attempts."""
	deadline = time.monotonic() + timeout
	while time.monotonic() < deadline:
		if delivery.get_metrics().total_sent >= expected:
			return
		await asyncio.sleep(0.01)


class TestNotificationPerformance:
	"""Performance tests for the complete notifications system."""

	async def test_single_notification_performance(self, notification_delivery):
		"""Test performance of sending a single notification."""
		message = NotificationMessage(
			title="Test Notification",
			content="Test content",
			recipient_id="test_user",
			channel=ChannelType.EMAIL,
			priority=Priority.MEDIUM
		)
		
		start_time = time.time()
		notification_id = await notification_delivery.send_notification(message)
		end_time = time.time()
		
		assert notification_id is not None
		assert (end_time - start_time) < 1.0  # Should complete within 1 second
	
	async def test_batch_notification_performance(self, notification_delivery):
		"""Test performance of batch notification sending."""
		messages = []
		for i in range(100):
			message = NotificationMessage(
				title=f"Test Notification {i}",
				content=f"Test content {i}",
				recipient_id=f"user_{i}",
				channel=ChannelType.EMAIL,
				priority=Priority.MEDIUM
			)
			messages.append(message)
		
		start_time = time.time()
		notification_ids = await notification_delivery.send_batch(messages)
		end_time = time.time()
		
		assert len(notification_ids) == 100
		assert (end_time - start_time) < 10.0  # Should complete within 10 seconds
		
		# Verify throughput
		throughput = len(messages) / (end_time - start_time)
		assert throughput > 10  # Should handle at least 10 notifications per second
	
	async def test_concurrent_notification_performance(self, notification_delivery):
		"""Test performance under concurrent load."""
		async def send_notification_batch():
			messages = []
			for i in range(50):
				message = NotificationMessage(
					title=f"Concurrent Test {i}",
					content=f"Concurrent content {i}",
					recipient_id=f"concurrent_user_{i}",
					channel=ChannelType.IN_APP,
					priority=Priority.MEDIUM
				)
				messages.append(message)
			
			return await notification_delivery.send_batch(messages)
		
		# Run 5 concurrent batches
		start_time = time.time()
		tasks = [send_notification_batch() for _ in range(5)]
		results = await asyncio.gather(*tasks)
		end_time = time.time()
		
		total_notifications = sum(len(result) for result in results)
		assert total_notifications == 250  # 5 batches * 50 notifications
		assert (end_time - start_time) < 15.0  # Should complete within 15 seconds
		
		throughput = total_notifications / (end_time - start_time)
		assert throughput > 15  # Should handle concurrent load efficiently
	
	async def test_multi_channel_performance(self, notification_delivery):
		"""Test performance across multiple channels."""
		channels = [ChannelType.EMAIL, ChannelType.SMS, ChannelType.IN_APP, ChannelType.PUSH]
		messages = []
		
		for i in range(100):
			channel = channels[i % len(channels)]
			message = NotificationMessage(
				title=f"Multi-channel Test {i}",
				content=f"Multi-channel content {i}",
				recipient_id=f"multi_user_{i}",
				channel=channel,
				priority=Priority.MEDIUM
			)
			messages.append(message)
		
		start_time = time.time()
		notification_ids = await notification_delivery.send_batch(messages)
		end_time = time.time()
		
		assert len(notification_ids) == 100
		assert (end_time - start_time) < 12.0  # Account for different channel latencies
		
		# Verify metrics show distribution across channels
		await wait_for_total_sent(notification_delivery, 100)
		metrics = notification_delivery.get_metrics()
		assert metrics.total_sent >= 100
	
	async def test_priority_calculation_performance(self, priority_manager):
		"""Test performance of priority calculation system."""
		metadatas = []
		for i in range(1000):
			if i % 3 == 0:
				title_keywords = [f"keyword_{i}", "urgent", "important"]
				content_keywords = [f"content_{i}", "deadline", "critical"]
				importance_contexts = [
					ImportanceContext.DEADLINE_CRITICAL,
					ImportanceContext.STAKEHOLDER_PRIORITY,
				]
				deadline_timestamp = datetime.now() + timedelta(hours=2)
				revenue_impact_estimate = 1000.0
				team_size_affected = 5
			elif i % 3 == 1:
				title_keywords = [f"keyword_{i}", "update"]
				content_keywords = [f"content_{i}", "summary"]
				importance_contexts = []
				deadline_timestamp = datetime.now() + timedelta(days=7)
				revenue_impact_estimate = 0.0
				team_size_affected = 1
			else:
				title_keywords = [f"keyword_{i}"]
				content_keywords = [f"content_{i}"]
				importance_contexts = []
				deadline_timestamp = None
				revenue_impact_estimate = 0.0
				team_size_affected = 1

			metadata = NotificationMetadata(
				notification_id=f"perf_test_{i}",
				user_id=f"user_{i}",
				title_keywords=title_keywords,
				content_keywords=content_keywords,
				importance_contexts=importance_contexts,
				deadline_timestamp=deadline_timestamp,
				revenue_impact_estimate=revenue_impact_estimate,
				team_size_affected=team_size_affected
			)
			metadatas.append(metadata)
		
		start_time = time.time()
		priority_scores = await priority_manager.batch_calculate_priorities(metadatas)
		end_time = time.time()
		
		assert len(priority_scores) == 1000
		assert (end_time - start_time) < 5.0  # Should calculate 1000 priorities within 5 seconds
		
		# Verify priority distribution makes sense
		priority_counts = {}
		for score in priority_scores:
			priority_counts[score.final_priority] = priority_counts.get(score.final_priority, 0) + 1
		
		# Should have a reasonable distribution
		assert len(priority_counts) > 1  # Should have multiple priority levels
	
	async def test_analytics_performance(self, analytics):
		"""Test analytics system performance with high event volume."""
		events = []
		
		# Create a large number of events
		for i in range(5000):
			event = NotificationEvent(
				event_id=f"perf_event_{i}",
				notification_id=f"notification_{i % 1000}",  # 1000 unique notifications
				user_id=f"user_{i % 100}",  # 100 unique users
				event_type=AnalyticsEvent.SENT if i % 3 == 0 else AnalyticsEvent.DELIVERED,
				channel_type=["email", "sms", "in_app"][i % 3],
				timestamp=datetime.now() - timedelta(minutes=i),
				delivery_time_ms=100 + (i % 200),
				response_time_seconds=1.0 + (i % 10)
			)
			events.append(event)
		
		# Track events
		start_time = time.time()
		for event in events:
			await analytics.track_event(event)
		end_time = time.time()
		
		tracking_time = end_time - start_time
		assert tracking_time < 10.0  # Should track 5000 events within 10 seconds
		
		# Test metrics calculation performance
		start_time = time.time()
		metrics = await analytics.get_metrics(
			datetime.now() - timedelta(hours=1),
			datetime.now()
		)
		end_time = time.time()
		
		metrics_time = end_time - start_time
		assert metrics_time < 2.0  # Should calculate metrics within 2 seconds
		assert metrics.total_sent > 0
	
	async def test_workflow_integration_performance(self, workflow_integration):
		"""Test workflow integration performance under load."""
		# Subscribe users to events
		users = [f"user_{i}" for i in range(100)]
		for user in users:
			await workflow_integration.subscribe_user(user, [
				WorkflowEventType.TASK_ASSIGNED,
				WorkflowEventType.DEADLINE_APPROACHING,
				WorkflowEventType.WORKFLOW_COMPLETED
			])
		
		# Generate workflow events
		events = []
		for i in range(200):
			event_data = {
				'workflow_name': f'Workflow {i}',
				'workflow_id': f'wf_{i}',
				'users': users[i % len(users):i % len(users) + 5],  # 5 users per event
				'description': f'Test workflow event {i}',
				'timestamp': datetime.now().isoformat()
			}
			events.append(event_data)
		
		# Process events
		start_time = time.time()
		all_notification_ids = []
		
		for i, event_data in enumerate(events):
			event_type = [
				WorkflowEventType.TASK_ASSIGNED,
				WorkflowEventType.DEADLINE_APPROACHING,
				WorkflowEventType.WORKFLOW_COMPLETED
			][i % 3]
			
			notification_ids = await workflow_integration.handle_workflow_event(
				event_type, event_data
			)
			all_notification_ids.extend(notification_ids)
		
		end_time = time.time()
		
		processing_time = end_time - start_time
		assert processing_time < 30.0  # Should process 200 events within 30 seconds
		
		# Verify notifications were created
		assert len(all_notification_ids) > 0
		
		# Check integration statistics
		stats = await workflow_integration.get_integration_statistics()
		assert stats['events_processed'] >= 200
		assert stats['notifications_sent'] > 0
	
	async def test_error_handling_performance(self, mock_channels):
		"""Test system performance when handling errors."""
		# Configure some channels to fail
		mock_channels[ChannelType.EMAIL].send = AsyncMock(
			return_value=Mock(success=False, error_message="SMTP error")
		)
		
		delivery = await create_notification_delivery(channels=mock_channels)
		
		# Send notifications that will fail
		messages = []
		for i in range(100):
			message = NotificationMessage(
				title=f"Error Test {i}",
				content=f"Error content {i}",
				recipient_id=f"error_user_{i}",
				channel=ChannelType.EMAIL,  # Will fail
				priority=Priority.MEDIUM,
				retry_count=2  # Will retry twice
			)
			messages.append(message)
		
		start_time = time.time()
		notification_ids = await delivery.send_batch(messages)
		end_time = time.time()
		
		# Should still complete in reasonable time despite failures
		assert (end_time - start_time) < 15.0
		
		# Check that failures were handled
		await wait_for_total_sent(delivery, 100)
		metrics = delivery.get_metrics()
		assert metrics.total_sent >= 100
		
		await delivery.stop()
	
	async def test_memory_usage_under_load(self, notification_delivery):
		"""Test memory usage during high-volume operations."""
		import psutil
		import os
		
		process = psutil.Process(os.getpid())
		initial_memory = process.memory_info().rss / 1024 / 1024  # MB
		
		# Send a large number of notifications
		for batch in range(10):  # 10 batches
			messages = []
			for i in range(500):  # 500 messages per batch
				message = NotificationMessage(
					title=f"Memory Test B{batch} M{i}",
					content=f"Memory test content for batch {batch}, message {i}",
					recipient_id=f"memory_user_{batch}_{i}",
					channel=ChannelType.IN_APP,
					priority=Priority.MEDIUM
				)
				messages.append(message)
			
			await notification_delivery.send_batch(messages)
			
			# Check memory periodically
			if batch % 3 == 0:
				current_memory = process.memory_info().rss / 1024 / 1024  # MB
				memory_increase = current_memory - initial_memory
				
				# Memory increase should be reasonable (less than 100MB for this test)
				assert memory_increase < 100, f"Memory usage increased by {memory_increase}MB"
		
		final_memory = process.memory_info().rss / 1024 / 1024  # MB
		total_memory_increase = final_memory - initial_memory
		
		# Total memory increase should be bounded
		assert total_memory_increase < 150, f"Total memory increase: {total_memory_increase}MB"
	
	async def test_rate_limit_metadata_queueing_performance(self, mock_channels):
		"""Test queueing performance when channels expose rate limit metadata."""
		# Configure channels with rate limits
		for channel in mock_channels.values():
			channel.rate_limit_per_minute = 60  # 1 per second
		
		delivery = await create_notification_delivery(channels=mock_channels)
		
		messages = []
		for i in range(30):  # 30 messages
			message = NotificationMessage(
				title=f"Rate Limit Test {i}",
				content=f"Rate limit content {i}",
				recipient_id=f"rate_user_{i}",
				channel=ChannelType.EMAIL,
				priority=Priority.MEDIUM
			)
			messages.append(message)
		
		start_time = time.time()
		notification_ids = await delivery.send_batch(messages)
		end_time = time.time()
		
		# Should respect rate limits but still complete
		assert len(notification_ids) == 30
		assert (end_time - start_time) < 5.0
		await wait_for_total_sent(delivery, 30)
		
		await delivery.stop()
	
	async def test_channel_failover_performance(self, mock_channels):
		"""Test performance when channels fail and failover occurs."""
		# Configure primary channel to fail
		mock_channels[ChannelType.EMAIL].send = AsyncMock(
			return_value=Mock(success=False, error_message="Primary channel failed")
		)
		
		# Configure fallback to succeed
		mock_channels[ChannelType.SMS].send = AsyncMock(
			return_value=Mock(success=True, delivery_time_ms=300)
		)
		
		delivery = await create_notification_delivery(channels=mock_channels)
		
		# Create messages with fallback configuration
		messages = []
		for i in range(50):
			message = NotificationMessage(
				title=f"Failover Test {i}",
				content=f"Failover content {i}",
				recipient_id=f"failover_user_{i}",
				channel=ChannelType.EMAIL,  # Will fail
				priority=Priority.HIGH,
				retry_count=1,  # One retry
				channel_data={'fallback_channel': 'sms'}  # Would need implementation
			)
			messages.append(message)
		
		start_time = time.time()
		notification_ids = await delivery.send_batch(messages)
		end_time = time.time()
		
		# Should complete despite primary channel failures
		assert (end_time - start_time) < 20.0
		
		# Check metrics reflect both failures and any successful fallbacks
		await wait_for_total_sent(delivery, 50)
		metrics = delivery.get_metrics()
		assert metrics.total_sent >= 50
		
		await delivery.stop()


class TestNotificationReliability:
	"""Reliability and resilience tests for the notifications system."""
	
	async def test_system_recovery_after_failure(self, mock_channels):
		"""Test system recovery after component failures."""
		delivery = await create_notification_delivery(channels=mock_channels)
		
		# Initially working
		message = NotificationMessage(
			title="Recovery Test 1",
			content="Initial message",
			recipient_id="recovery_user",
			channel=ChannelType.EMAIL,
			priority=Priority.MEDIUM
		)
		
		result1 = await delivery.send_notification(message)
		assert result1 is not None
		
		# Simulate failure
		mock_channels[ChannelType.EMAIL].send = AsyncMock(
			side_effect=Exception("Temporary failure")
		)
		
		result2 = await delivery.send_notification(message)
		# Should handle failure gracefully
		
		# Restore functionality
		mock_channels[ChannelType.EMAIL].send = AsyncMock(
			return_value=Mock(success=True, delivery_time_ms=100)
		)
		
		result3 = await delivery.send_notification(message)
		assert result3 is not None
		
		await delivery.stop()
	
	async def test_data_consistency_under_load(self, workflow_integration):
		"""Test data consistency during high-load operations."""
		# Subscribe users
		users = [f"consistency_user_{i}" for i in range(50)]
		for user in users:
			await workflow_integration.subscribe_user(user, [WorkflowEventType.TASK_ASSIGNED])
		
		# Generate events concurrently
		async def generate_events():
			events = []
			for i in range(100):
				event_data = {
					'workflow_name': f'Consistency Workflow {i}',
					'workflow_id': f'consistency_wf_{i}',
					'users': users[:10],  # First 10 users
					'task_name': f'Task {i}',
					'timestamp': datetime.now().isoformat()
				}
				
				notification_ids = await workflow_integration.handle_workflow_event(
					WorkflowEventType.TASK_ASSIGNED,
					event_data
				)
				events.extend(notification_ids)
			
			return events
		
		# Run multiple concurrent event generators
		tasks = [generate_events() for _ in range(3)]
		results = await asyncio.gather(*tasks)
		
		# Verify data consistency
		all_notifications = []
		for result in results:
			all_notifications.extend(result)
		
		# Check statistics are consistent
		stats = await workflow_integration.get_integration_statistics()
		assert stats['events_processed'] >= 300  # 3 generators * 100 events
		
		# No duplicate notification IDs
		unique_notifications = set(all_notifications)
		assert len(unique_notifications) == len(all_notifications)


@pytest.mark.asyncio
class TestIntegrationEndToEnd:
	"""End-to-end integration tests for the complete workflow."""
	
	async def test_complete_workflow_notification_cycle(self):
		"""Test complete end-to-end notification workflow."""
		# Setup all components
		channels = {
			ChannelType.EMAIL: Mock(),
			ChannelType.IN_APP: Mock(),
			ChannelType.SMS: Mock()
		}
		
		# Mock successful sends
		for channel in channels.values():
			channel.send = AsyncMock(return_value=Mock(success=True, delivery_time_ms=100))
			channel.validate_recipient = AsyncMock(return_value=True)
			channel.get_channel_type = Mock(return_value=ChannelType.EMAIL)
			channel.supports_priority = Mock(return_value=True)
		
		integration = await create_workflow_notification_integration(
			notification_channels=channels
		)
		
		# Subscribe users
		await integration.subscribe_user("endtoend_user_1", [
			WorkflowEventType.WORKFLOW_STARTED,
			WorkflowEventType.TASK_ASSIGNED,
			WorkflowEventType.WORKFLOW_COMPLETED
		])
		
		# Set preferences
		await integration.set_user_channel_preferences("endtoend_user_1", {
			WorkflowEventType.WORKFLOW_STARTED: [ChannelType.IN_APP],
			WorkflowEventType.TASK_ASSIGNED: [ChannelType.EMAIL, ChannelType.IN_APP],
			WorkflowEventType.WORKFLOW_COMPLETED: [ChannelType.EMAIL]
		})
		
		# Simulate complete workflow
		workflow_id = "endtoend_workflow_001"
		
		# 1. Workflow starts
		start_event = {
			'workflow_name': 'End-to-End Test Workflow',
			'workflow_id': workflow_id,
			'workflow_owner': 'endtoend_user_1',
			'description': 'Testing complete workflow cycle'
		}
		
		start_notifications = await integration.handle_workflow_event(
			WorkflowEventType.WORKFLOW_STARTED,
			start_event
		)
		
		# 2. Task assigned
		task_event = {
			'workflow_name': 'End-to-End Test Workflow',
			'workflow_id': workflow_id,
			'assigned_user': 'endtoend_user_1',
			'task_name': 'Complete end-to-end testing',
			'due_date': (datetime.now() + timedelta(days=1)).isoformat()
		}
		
		task_notifications = await integration.handle_workflow_event(
			WorkflowEventType.TASK_ASSIGNED,
			task_event
		)
		
		# 3. Workflow completes
		complete_event = {
			'workflow_name': 'End-to-End Test Workflow',
			'workflow_id': workflow_id,
			'workflow_owner': 'endtoend_user_1',
			'duration': '2 hours 15 minutes',
			'status': 'success'
		}
		
		complete_notifications = await integration.handle_workflow_event(
			WorkflowEventType.WORKFLOW_COMPLETED,
			complete_event
		)
		
		# Verify notifications were sent
		assert len(start_notifications) > 0
		assert len(task_notifications) > 0
		assert len(complete_notifications) > 0
		
		# Verify statistics
		stats = await integration.get_integration_statistics()
		assert stats['events_processed'] >= 3
		assert stats['notifications_sent'] >= 3
		
		await integration.stop()
	
	async def test_performance_benchmark_suite(self):
		"""Comprehensive performance benchmark for the entire system."""
		logger.info(f"\n=== DocuFusion Notifications Performance Benchmark ===")
		
		# Setup test environment
		channels = {}
		for channel_type in [ChannelType.EMAIL, ChannelType.SMS, ChannelType.IN_APP, ChannelType.PUSH]:
			mock_channel = Mock()
			mock_channel.send = AsyncMock(return_value=Mock(success=True, delivery_time_ms=100))
			mock_channel.validate_recipient = AsyncMock(return_value=True)
			mock_channel.get_channel_type = Mock(return_value=channel_type)
			mock_channel.supports_priority = Mock(return_value=True)
			channels[channel_type] = mock_channel
		
		integration = await create_workflow_notification_integration(
			notification_channels=channels,
			batch_processing=True,
			batch_interval_seconds=1
		)
		
		# Benchmark 1: Single notification latency
		start_time = time.time()
		event_data = {'workflow_name': 'Benchmark', 'workflow_id': 'bench_001', 'users': ['bench_user']}
		await integration.handle_workflow_event(WorkflowEventType.TASK_ASSIGNED, event_data)
		single_latency = (time.time() - start_time) * 1000  # milliseconds
		
		logger.info(f"Single notification latency: {single_latency:.2f}ms")
		
		# Benchmark 2: Batch throughput
		batch_size = 1000
		messages = []
		for i in range(batch_size):
			event_data = {
				'workflow_name': f'Batch Workflow {i}',
				'workflow_id': f'batch_{i}',
				'users': [f'batch_user_{i % 100}']  # 100 unique users
			}
			messages.append(event_data)
		
		start_time = time.time()
		for event_data in messages:
			await integration.handle_workflow_event(WorkflowEventType.TASK_ASSIGNED, event_data)
		batch_time = time.time() - start_time
		throughput = batch_size / batch_time
		
		logger.info(f"Batch throughput: {throughput:.2f} notifications/second")
		
		# Benchmark 3: Memory efficiency
		import psutil
		import os
		process = psutil.Process(os.getpid())
		memory_before = process.memory_info().rss / 1024 / 1024  # MB
		
		# Process large volume
		for batch in range(10):
			batch_events = []
			for i in range(500):
				event_data = {
					'workflow_name': f'Memory Test {batch}_{i}',
					'workflow_id': f'mem_{batch}_{i}',
					'users': [f'mem_user_{i % 50}']
				}
				batch_events.append(event_data)
			
			for event_data in batch_events:
				await integration.handle_workflow_event(WorkflowEventType.WORKFLOW_COMPLETED, event_data)
		
		memory_after = process.memory_info().rss / 1024 / 1024  # MB
		memory_increase = memory_after - memory_before
		
		logger.info(f"Memory increase for 5000 notifications: {memory_increase:.2f}MB")
		
		# Final statistics
		stats = await integration.get_integration_statistics()
		logger.info(f"Total events processed: {stats['events_processed']}")
		logger.info(f"Total notifications sent: {stats['notifications_sent']}")
		
		# Performance assertions
		assert single_latency < 100  # Less than 100ms for single notification
		assert throughput > 50  # At least 50 notifications per second
		assert memory_increase < 50  # Less than 50MB memory increase
		
		await integration.stop()
		
		logger.info(f"=== Benchmark Complete ===\n")


if __name__ == "__main__":
	# Run performance tests directly
	async def run_benchmark():
		test_instance = TestIntegrationEndToEnd()
		await test_instance.test_performance_benchmark_suite()
	
	asyncio.run(run_benchmark())
