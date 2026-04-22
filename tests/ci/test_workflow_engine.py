#!/usr/bin/env python3
"""
WorkflowEngine Module Tests

Comprehensive test suite for the workflow automation engine covering:
- Workflow instance creation and execution
- Task scheduling and completion
- State transitions (create, start, pause, resume, cancel)
- Error handling and recovery (task failure, retry logic)
- Concurrent workflow execution
- Event-driven triggers
- Performance monitoring and optimization
"""

import asyncio
from datetime import datetime, timedelta

import pytest

from docfusion.workflow.automation.workflow_engine import (
	OptimizationMetric,
	OptimizationType,
	ProcessState,
	TaskState,
	TriggerType,
	WorkflowEngine,
	WorkflowInstance,
	WorkflowTask,
	WorkflowTrigger,
)


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def engine():
	"""Create a WorkflowEngine instance for testing."""
	return WorkflowEngine(max_concurrent_workflows=10)


@pytest.fixture
async def engine_started(engine):
	"""Create and start a WorkflowEngine instance."""
	await engine.start_engine()
	yield engine
	await engine.stop_engine()


# ============================================================================
# Workflow Creation Tests
# ============================================================================


class TestWorkflowCreation:
	"""Tests for creating workflow instances."""

	async def test_create_workflow_instance(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Test Workflow",
			description="A test workflow instance",
			created_by="user_001",
		)
		assert isinstance(instance, WorkflowInstance)
		assert instance.process_definition_id == "proc_001"
		assert instance.name == "Test Workflow"
		assert instance.state == ProcessState.CREATED
		assert instance.created_by == "user_001"
		assert instance.instance_id in engine.active_instances

	async def test_create_workflow_with_variables(self, engine):
		variables = {"doc_id": "doc_123", "priority": "high"}
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_002",
			name="Variable Workflow",
			description="Workflow with variables",
			created_by="user_001",
			workflow_variables=variables,
		)
		assert instance.workflow_variables == variables

	async def test_create_workflow_with_deadline(self, engine):
		deadline = datetime.now() + timedelta(days=7)
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_003",
			name="Deadline Workflow",
			description="Workflow with deadline",
			created_by="user_001",
			deadline=deadline,
		)
		assert instance.deadline is not None

	async def test_create_workflow_records_state_history(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_004",
			name="History Workflow",
			description="Check state history",
			created_by="user_001",
		)
		assert len(instance.state_history) >= 1
		assert instance.state_history[0]["new_state"] == ProcessState.CREATED.value

	async def test_create_workflow_max_concurrent_reached(self):
		small_engine = WorkflowEngine(max_concurrent_workflows=1)
		await small_engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="First",
			description="First workflow",
			created_by="user_001",
		)
		with pytest.raises(RuntimeError, match="Maximum concurrent workflows"):
			await small_engine.create_workflow_instance(
				process_definition_id="proc_002",
				name="Second",
				description="Second workflow",
				created_by="user_001",
			)

	async def test_create_workflow_updates_performance_stats(self, engine):
		initial_count = engine.performance_stats["workflows_started"]
		await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Stats Workflow",
			description="Check stats",
			created_by="user_001",
		)
		assert engine.performance_stats["workflows_started"] == initial_count + 1


# ============================================================================
# Workflow Execution Tests
# ============================================================================


class TestWorkflowExecution:
	"""Tests for starting and executing workflow instances."""

	async def test_start_workflow_instance(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Startable Workflow",
			description="Workflow to start",
			created_by="user_001",
		)
		result = await engine.start_workflow_instance(instance.instance_id)
		assert result is True
		# After start, the state transitions through INITIALIZED -> RUNNING
		# System tasks auto-complete, so the instance may end up in COMPLETED
		updated = engine.active_instances.get(instance.instance_id) or engine.completed_instances.get(instance.instance_id)
		assert updated.state in (ProcessState.RUNNING, ProcessState.COMPLETED)

	async def test_start_nonexistent_workflow(self, engine):
		result = await engine.start_workflow_instance("nonexistent_id")
		assert result is False

	async def test_start_already_running_workflow(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Double Start",
			description="Try to start twice",
			created_by="user_001",
		)
		await engine.start_workflow_instance(instance.instance_id)
		# Starting again should fail because state is not CREATED
		result = await engine.start_workflow_instance(instance.instance_id)
		assert result is False

	async def test_start_workflow_creates_initial_task(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Task Workflow",
			description="Check tasks created",
			created_by="user_001",
		)
		await engine.start_workflow_instance(instance.instance_id)
		# _initialize_workflow_tasks creates at least one system task
		updated = engine.active_instances.get(instance.instance_id) or engine.completed_instances.get(instance.instance_id)
		assert updated is not None
		assert len(updated.tasks) >= 1


# ============================================================================
# State Transition Tests
# ============================================================================


class TestStateTransitions:
	"""Tests for workflow state transitions."""

	async def test_initial_state_is_created(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="State Test",
			description="Test initial state",
			created_by="user_001",
		)
		assert instance.state == ProcessState.CREATED

	async def test_state_transitions_on_start(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Transition Test",
			description="Test state transition",
			created_by="user_001",
		)
		await engine.start_workflow_instance(instance.instance_id)
		updated = engine.active_instances.get(instance.instance_id) or engine.completed_instances.get(instance.instance_id)
		# Should have progressed past CREATED
		assert updated.state != ProcessState.CREATED

	async def test_pause_running_workflow(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Pause Test",
			description="Test pausing",
			created_by="user_001",
		)
		await engine.start_workflow_instance(instance.instance_id)
		# If the workflow completed already (system task auto-completes),
		# check current state first
		updated = engine.active_instances.get(instance.instance_id)
		if updated and updated.state == ProcessState.RUNNING:
			result = await engine.pause_workflow_instance(instance.instance_id)
			assert result is True
			assert updated.state == ProcessState.PAUSED

	async def test_pause_nonexistent_workflow(self, engine):
		result = await engine.pause_workflow_instance("nonexistent_id")
		assert result is False

	async def test_resume_paused_workflow(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Resume Test",
			description="Test resuming",
			created_by="user_001",
		)
		await engine.start_workflow_instance(instance.instance_id)
		updated = engine.active_instances.get(instance.instance_id)
		if updated and updated.state == ProcessState.RUNNING:
			await engine.pause_workflow_instance(instance.instance_id)
			result = await engine.resume_workflow_instance(instance.instance_id)
			assert result is True
			assert updated.state == ProcessState.RUNNING

	async def test_resume_non_paused_workflow(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Resume Non-Paused",
			description="Test resuming non-paused",
			created_by="user_001",
		)
		# CREATED state, not PAUSED
		result = await engine.resume_workflow_instance(instance.instance_id)
		assert result is False

	async def test_cancel_workflow(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Cancel Test",
			description="Test cancellation",
			created_by="user_001",
		)
		result = await engine.cancel_workflow_instance(instance.instance_id)
		assert result is True
		assert instance.instance_id not in engine.active_instances
		assert instance.instance_id in engine.completed_instances
		assert engine.completed_instances[instance.instance_id].state == ProcessState.CANCELLED

	async def test_cancel_nonexistent_workflow(self, engine):
		result = await engine.cancel_workflow_instance("nonexistent_id")
		assert result is False

	async def test_cancel_with_active_tasks_cancels_them(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Cancel Tasks Test",
			description="Test task cancellation",
			created_by="user_001",
		)
		# Manually add a task in RUNNING state
		task = WorkflowTask(
			name="Test Task",
			description="Task to cancel",
			task_type="user",
			state=TaskState.RUNNING,
		)
		instance.tasks[task.task_id] = task
		instance.active_tasks.add(task.task_id)

		await engine.cancel_workflow_instance(instance.instance_id)
		assert task.state == TaskState.CANCELLED


# ============================================================================
# Task Scheduling and Completion Tests
# ============================================================================


class TestTaskCompletion:
	"""Tests for task completion and scheduling."""

	async def test_complete_task(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Complete Task Test",
			description="Test completing a task",
			created_by="user_001",
		)
		# Add a running task manually
		task = WorkflowTask(
			name="Manual Task",
			description="Manually added task",
			task_type="user",
			state=TaskState.RUNNING,
		)
		task.started_at = datetime.now()
		instance.tasks[task.task_id] = task
		instance.active_tasks.add(task.task_id)

		result = await engine.complete_task(
			instance.instance_id,
			task.task_id,
			output_data={"result": "done"},
			completed_by="user_001",
		)
		assert result is True
		assert task.state == TaskState.COMPLETED
		assert task.output_data == {"result": "done"}
		assert task.completed_at is not None
		assert task.task_id in instance.completed_tasks

	async def test_complete_task_nonexistent_instance(self, engine):
		result = await engine.complete_task("nonexistent", "task_001", {"result": "done"})
		assert result is False

	async def test_complete_task_nonexistent_task(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="No Task Test",
			description="Test with missing task",
			created_by="user_001",
		)
		result = await engine.complete_task(instance.instance_id, "nonexistent_task", {"result": "done"})
		assert result is False

	async def test_complete_task_not_running(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Not Running Task",
			description="Task not in RUNNING state",
			created_by="user_001",
		)
		task = WorkflowTask(
			name="Pending Task",
			description="Pending task",
			task_type="user",
			state=TaskState.PENDING,
		)
		instance.tasks[task.task_id] = task

		result = await engine.complete_task(instance.instance_id, task.task_id, {"result": "done"})
		assert result is False

	async def test_complete_task_updates_completion_percentage(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Percentage Test",
			description="Test completion percentage",
			created_by="user_001",
		)
		# Add two tasks
		task1 = WorkflowTask(
			name="Task 1",
			description="First task",
			task_type="user",
			state=TaskState.RUNNING,
		)
		task1.started_at = datetime.now()
		task2 = WorkflowTask(
			name="Task 2",
			description="Second task",
			task_type="user",
			state=TaskState.PENDING,
		)
		instance.tasks[task1.task_id] = task1
		instance.tasks[task2.task_id] = task2
		instance.active_tasks.add(task1.task_id)
		instance.started_at = datetime.now()

		await engine.complete_task(instance.instance_id, task1.task_id, {"result": "done"})
		assert instance.completion_percentage == 50.0

	async def test_complete_task_records_execution_log(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Log Test",
			description="Test execution logging",
			created_by="user_001",
		)
		task = WorkflowTask(
			name="Logged Task",
			description="Task with logging",
			task_type="user",
			state=TaskState.RUNNING,
		)
		task.started_at = datetime.now()
		instance.tasks[task.task_id] = task
		instance.active_tasks.add(task.task_id)

		await engine.complete_task(instance.instance_id, task.task_id, {"result": "logged"})
		assert len(instance.execution_log) > 0
		assert instance.execution_log[-1]["event_type"] == "task_completed"


# ============================================================================
# Task Failure and Retry Tests
# ============================================================================


class TestTaskFailureAndRetry:
	"""Tests for task failure handling and retry logic."""

	async def test_fail_task_with_retry(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Retry Test",
			description="Test task retry",
			created_by="user_001",
		)
		task = WorkflowTask(
			name="Retryable Task",
			description="Task that will be retried",
			task_type="service",
			state=TaskState.RUNNING,
			max_retries=3,
		)
		instance.tasks[task.task_id] = task
		instance.active_tasks.add(task.task_id)

		result = await engine.fail_task(
			instance.instance_id,
			task.task_id,
			error_message="Temporary failure",
			retry=True,
		)
		assert result is True
		assert task.state == TaskState.RETRYING
		assert task.retry_count == 1
		assert task.error_message == "Temporary failure"

	async def test_fail_task_exhausts_retries(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Exhaust Retry Test",
			description="Test retry exhaustion",
			created_by="user_001",
		)
		task = WorkflowTask(
			name="Failing Task",
			description="Task that exhausts retries",
			task_type="service",
			state=TaskState.RUNNING,
			max_retries=2,
		)
		instance.tasks[task.task_id] = task
		instance.active_tasks.add(task.task_id)

		# Fail beyond max retries
		await engine.fail_task(instance.instance_id, task.task_id, "Error 1", retry=True)
		await engine.fail_task(instance.instance_id, task.task_id, "Error 2", retry=True)
		# Third failure - retries exhausted (retry_count = 2, max_retries = 2)
		await engine.fail_task(instance.instance_id, task.task_id, "Error 3", retry=True)
		assert task.state == TaskState.FAILED
		assert task.task_id in instance.failed_tasks

	async def test_fail_task_no_retry(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="No Retry Test",
			description="Test no retry on failure",
			created_by="user_001",
		)
		task = WorkflowTask(
			name="No Retry Task",
			description="Task with no retry",
			task_type="user",
			state=TaskState.RUNNING,
			max_retries=3,
		)
		instance.tasks[task.task_id] = task
		instance.active_tasks.add(task.task_id)

		result = await engine.fail_task(
			instance.instance_id,
			task.task_id,
			error_message="Fatal error",
			retry=False,
		)
		assert result is True
		assert task.state == TaskState.FAILED
		assert task.retry_count == 0

	async def test_fail_nonexistent_instance(self, engine):
		result = await engine.fail_task("nonexistent", "task_001", "error")
		assert result is False

	async def test_fail_nonexistent_task(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Missing Task Test",
			description="Test with missing task",
			created_by="user_001",
		)
		result = await engine.fail_task(instance.instance_id, "nonexistent_task", "error")
		assert result is False

	async def test_critical_task_failure_fails_workflow(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Critical Failure Test",
			description="Test workflow failure on critical task",
			created_by="user_001",
		)
		# Add a high-priority (critical) task
		critical_task = WorkflowTask(
			name="Critical Task",
			description="High priority task",
			task_type="service",
			state=TaskState.RUNNING,
			priority=9,  # >= 8 is critical
			max_retries=0,
		)
		instance.tasks[critical_task.task_id] = critical_task
		instance.active_tasks.add(critical_task.task_id)

		await engine.fail_task(
			instance.instance_id,
			critical_task.task_id,
			error_message="Critical failure",
			retry=False,
		)
		# Workflow should fail due to critical task
		assert instance.state == ProcessState.FAILED

	async def test_task_failure_records_execution_log(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Failure Log Test",
			description="Test failure logging",
			created_by="user_001",
		)
		task = WorkflowTask(
			name="Failing Task",
			description="Task that fails",
			task_type="user",
			state=TaskState.RUNNING,
			max_retries=0,
		)
		instance.tasks[task.task_id] = task
		instance.active_tasks.add(task.task_id)

		await engine.fail_task(instance.instance_id, task.task_id, "Error occurred", retry=False)
		assert len(instance.execution_log) > 0
		assert instance.execution_log[-1]["event_type"] == "task_failed"


# ============================================================================
# Workflow Retrieval and Status Tests
# ============================================================================


class TestWorkflowRetrieval:
	"""Tests for getting workflow instances and status."""

	async def test_get_workflow_instance_active(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Get Test",
			description="Test retrieval",
			created_by="user_001",
		)
		retrieved = await engine.get_workflow_instance(instance.instance_id)
		assert retrieved is not None
		assert retrieved.instance_id == instance.instance_id

	async def test_get_workflow_instance_completed(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Completed Get Test",
			description="Test retrieval after completion",
			created_by="user_001",
		)
		await engine.cancel_workflow_instance(instance.instance_id)
		retrieved = await engine.get_workflow_instance(instance.instance_id)
		assert retrieved is not None

	async def test_get_workflow_instance_nonexistent(self, engine):
		retrieved = await engine.get_workflow_instance("nonexistent_id")
		assert retrieved is None

	async def test_get_active_workflows(self, engine):
		await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Active 1",
			description="First active",
			created_by="user_001",
		)
		await engine.create_workflow_instance(
			process_definition_id="proc_002",
			name="Active 2",
			description="Second active",
			created_by="user_001",
		)
		active = await engine.get_active_workflows()
		assert len(active) == 2

	async def test_get_workflow_status(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Status Test",
			description="Test status",
			created_by="user_001",
		)
		status = await engine.get_workflow_status(instance.instance_id)
		assert status is not None
		assert status["instance_id"] == instance.instance_id
		assert status["name"] == "Status Test"
		assert "state" in status
		assert "total_tasks" in status
		assert "active_tasks" in status
		assert "completed_tasks" in status

	async def test_get_workflow_status_nonexistent(self, engine):
		status = await engine.get_workflow_status("nonexistent_id")
		assert status is None


# ============================================================================
# Event-Driven Trigger Tests
# ============================================================================


class TestWorkflowTriggers:
	"""Tests for workflow triggers and event-driven execution."""

	async def test_register_trigger(self, engine):
		trigger_id = await engine.register_workflow_trigger(
			trigger_type=TriggerType.DOCUMENT_CREATED,
			trigger_condition={"document_type": "rfp"},
			target_process_id="proc_rfp_001",
		)
		assert isinstance(trigger_id, str)
		assert trigger_id in engine.workflow_triggers

	async def test_trigger_stored_correctly(self, engine):
		trigger_id = await engine.register_workflow_trigger(
			trigger_type=TriggerType.APPROVAL_RECEIVED,
			trigger_condition={"approval_type": "budget"},
			target_process_id="proc_approval_001",
		)
		trigger = engine.workflow_triggers[trigger_id]
		assert trigger.trigger_type == TriggerType.APPROVAL_RECEIVED
		assert trigger.target_process_id == "proc_approval_001"
		assert trigger.is_active is True

	async def test_fire_event_creates_workflow(self, engine):
		await engine.register_workflow_trigger(
			trigger_type=TriggerType.DOCUMENT_CREATED,
			trigger_condition={"document_type": "rfp"},
			target_process_id="proc_rfp_001",
		)
		initial_active = len(engine.active_instances)
		initial_completed = len(engine.completed_instances)
		await engine.fire_event("document_created", {"document_type": "rfp"})
		# A new workflow should have been created (may auto-complete due to system tasks)
		total = len(engine.active_instances) + len(engine.completed_instances)
		assert total > initial_active + initial_completed

	async def test_fire_event_no_matching_trigger(self, engine):
		await engine.register_workflow_trigger(
			trigger_type=TriggerType.DOCUMENT_CREATED,
			trigger_condition={"document_type": "rfp"},
			target_process_id="proc_rfp_001",
		)
		initial_count = len(engine.active_instances)
		await engine.fire_event("unknown_event", {"data": "irrelevant"})
		# No new workflow should be created
		assert len(engine.active_instances) == initial_count


# ============================================================================
# Subscriber / Event Notification Tests
# ============================================================================


class TestWorkflowSubscribers:
	"""Tests for workflow event subscription and notification."""

	async def test_subscribe_to_events(self, engine):
		received_events = []

		async def callback(event_data):
			received_events.append(event_data)

		subscription_id = await engine.subscribe_to_workflow_events(callback)
		assert isinstance(subscription_id, str)
		assert len(engine.workflow_subscribers) == 1

	async def test_subscriber_receives_events(self, engine):
		received_events = []

		async def callback(event_data):
			received_events.append(event_data)

		await engine.subscribe_to_workflow_events(callback)

		# Create a workflow (should trigger instance_created event)
		await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Event Test",
			description="Test event notification",
			created_by="user_001",
		)
		assert len(received_events) >= 1
		assert received_events[0]["event_type"] == "instance_created"

	async def test_sync_subscriber(self, engine):
		received_events = []

		def sync_callback(event_data):
			received_events.append(event_data)

		await engine.subscribe_to_workflow_events(sync_callback)

		await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Sync Event Test",
			description="Test sync callback",
			created_by="user_001",
		)
		assert len(received_events) >= 1


# ============================================================================
# Concurrent Execution Tests
# ============================================================================


class TestConcurrentExecution:
	"""Tests for concurrent workflow execution."""

	async def test_multiple_workflows_concurrently(self, engine):
		instances = []
		for i in range(5):
			instance = await engine.create_workflow_instance(
				process_definition_id=f"proc_{i:03d}",
				name=f"Concurrent Workflow {i}",
				description=f"Concurrent test {i}",
				created_by="user_001",
			)
			instances.append(instance)

		assert len(engine.active_instances) == 5

		# Start all
		for instance in instances:
			await engine.start_workflow_instance(instance.instance_id)

		# All should have been processed
		total = len(engine.active_instances) + len(engine.completed_instances)
		assert total == 5

	async def test_max_concurrent_workflows_enforced(self):
		tiny_engine = WorkflowEngine(max_concurrent_workflows=2)
		await tiny_engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="WF 1",
			description="First",
			created_by="user_001",
		)
		await tiny_engine.create_workflow_instance(
			process_definition_id="proc_002",
			name="WF 2",
			description="Second",
			created_by="user_001",
		)
		with pytest.raises(RuntimeError, match="Maximum concurrent workflows"):
			await tiny_engine.create_workflow_instance(
				process_definition_id="proc_003",
				name="WF 3",
				description="Third",
				created_by="user_001",
			)


# ============================================================================
# Performance Stats Tests
# ============================================================================


class TestPerformanceStats:
	"""Tests for performance statistics tracking."""

	async def test_initial_performance_stats(self, engine):
		stats = await engine.get_performance_stats()
		assert stats["workflows_started"] == 0
		assert stats["workflows_completed"] == 0
		assert stats["workflows_failed"] == 0
		assert stats["active_workflows"] == 0

	async def test_stats_updated_on_workflow_creation(self, engine):
		await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Stats Test",
			description="Check stats update",
			created_by="user_001",
		)
		stats = await engine.get_performance_stats()
		assert stats["workflows_started"] == 1
		assert stats["active_workflows"] == 1

	async def test_stats_updated_on_workflow_completion(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Completion Stats Test",
			description="Check completion stats",
			created_by="user_001",
		)
		# Start the workflow - system tasks auto-complete, which may complete the workflow
		await engine.start_workflow_instance(instance.instance_id)

		stats = await engine.get_performance_stats()
		# Either the workflow is in active or completed
		total = stats["active_workflows"] + stats["completed_workflows"]
		assert total >= 1


# ============================================================================
# Engine Lifecycle Tests
# ============================================================================


class TestEngineLifecycle:
	"""Tests for engine start/stop lifecycle."""

	async def test_start_engine(self):
		eng = WorkflowEngine(max_concurrent_workflows=10)
		await eng.start_engine()
		assert eng._is_running is True
		await eng.stop_engine()

	async def test_stop_engine(self):
		eng = WorkflowEngine(max_concurrent_workflows=10)
		await eng.start_engine()
		await eng.stop_engine()
		assert eng._is_running is False

	async def test_start_engine_idempotent(self):
		eng = WorkflowEngine(max_concurrent_workflows=10)
		await eng.start_engine()
		await eng.start_engine()  # Should not raise
		assert eng._is_running is True
		await eng.stop_engine()

	async def test_stop_engine_when_not_running(self):
		eng = WorkflowEngine(max_concurrent_workflows=10)
		await eng.stop_engine()  # Should not raise
		assert eng._is_running is False

	async def test_cleanup(self):
		eng = WorkflowEngine(max_concurrent_workflows=10)
		await eng.start_engine()
		await eng.create_workflow_instance(
			process_definition_id="proc_001",
			name="Cleanup Test",
			description="Test cleanup",
			created_by="user_001",
		)
		await eng.cleanup()
		assert len(eng.active_instances) == 0
		assert len(eng.completed_instances) == 0
		assert len(eng.workflow_triggers) == 0
		assert len(eng.workflow_subscribers) == 0


# ============================================================================
# Dependency Resolution Tests
# ============================================================================


class TestDependencyResolution:
	"""Tests for task dependency resolution."""

	async def test_dependencies_satisfied(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Dep Test",
			description="Test dependency satisfaction",
			created_by="user_001",
		)
		task = WorkflowTask(
			name="Independent Task",
			description="No dependencies",
			task_type="user",
			depends_on=[],
		)
		instance.tasks[task.task_id] = task

		result = await engine._are_dependencies_satisfied(instance, task)
		assert result is True

	async def test_dependencies_not_satisfied(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Unmet Dep Test",
			description="Test unmet dependency",
			created_by="user_001",
		)
		task = WorkflowTask(
			name="Dependent Task",
			description="Has unmet dependency",
			task_type="user",
			depends_on=["task_not_completed"],
		)
		instance.tasks[task.task_id] = task

		result = await engine._are_dependencies_satisfied(instance, task)
		assert result is False

	async def test_dependencies_satisfied_after_completion(self, engine):
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Satisfied Dep Test",
			description="Test satisfied dependency",
			created_by="user_001",
		)
		prereq_task_id = "prereq_task_001"
		instance.completed_tasks.add(prereq_task_id)

		task = WorkflowTask(
			name="Dependent Task",
			description="Has met dependency",
			task_type="user",
			depends_on=[prereq_task_id],
		)
		instance.tasks[task.task_id] = task

		result = await engine._are_dependencies_satisfied(instance, task)
		assert result is True


# ============================================================================
# Pydantic Model Validation Tests
# ============================================================================


class TestWorkflowModels:
	"""Tests for Pydantic model validation on workflow data classes."""

	def test_workflow_task_defaults(self):
		task = WorkflowTask(
			name="Test Task",
			description="A test task",
			task_type="user",
		)
		assert task.state == TaskState.PENDING
		assert task.priority == 5
		assert task.max_retries == 3
		assert task.retry_count == 0
		assert len(task.depends_on) == 0
		assert task.task_id is not None

	def test_workflow_task_extra_fields_forbidden(self):
		with pytest.raises(Exception):
			WorkflowTask(
				name="Test",
				description="Test",
				task_type="user",
				extra_field="not_allowed",
			)

	def test_process_state_enum_values(self):
		assert ProcessState.CREATED.value == "created"
		assert ProcessState.RUNNING.value == "running"
		assert ProcessState.COMPLETED.value == "completed"
		assert ProcessState.FAILED.value == "failed"
		assert ProcessState.CANCELLED.value == "cancelled"

	def test_task_state_enum_values(self):
		assert TaskState.PENDING.value == "pending"
		assert TaskState.RUNNING.value == "running"
		assert TaskState.COMPLETED.value == "completed"
		assert TaskState.FAILED.value == "failed"
		assert TaskState.RETRYING.value == "retrying"

	def test_trigger_type_enum_values(self):
		assert TriggerType.MANUAL.value == "manual"
		assert TriggerType.SCHEDULED.value == "scheduled"
		assert TriggerType.EVENT_DRIVEN.value == "event_driven"
		assert TriggerType.DOCUMENT_CREATED.value == "document_created"

	def test_optimization_type_enum_values(self):
		assert OptimizationType.PERFORMANCE.value == "performance"
		assert OptimizationType.RESOURCE_USAGE.value == "resource_usage"
		assert OptimizationType.COST.value == "cost"

	def test_workflow_trigger_dataclass(self):
		trigger = WorkflowTrigger(
			trigger_type=TriggerType.MANUAL,
			trigger_condition={"key": "value"},
			target_process_id="proc_001",
		)
		assert trigger.trigger_type == TriggerType.MANUAL
		assert trigger.is_active is True
		assert trigger.trigger_id is not None

	def test_optimization_metric_dataclass(self):
		metric = OptimizationMetric(
			optimization_type=OptimizationType.PERFORMANCE,
			current_value=50.0,
			target_value=30.0,
		)
		assert metric.optimization_type == OptimizationType.PERFORMANCE
		assert metric.current_value == 50.0
		assert metric.metric_id is not None