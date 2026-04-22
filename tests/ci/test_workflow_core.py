#!/usr/bin/env python3
"""Smoke coverage for docfusion.workflow top-level modules.

Happy and failure paths for workflow creation, transition, and failure handling.
All tests use real objects; no mocks.
"""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from docfusion.workflow.automation.task_scheduler import (
	ScheduledTask,
	TaskPriority,
	TaskScheduler,
)
from docfusion.workflow.automation.workflow_engine import WorkflowEngine
from docfusion.workflow.coordination.task_coordinator import (
	AssignmentStrategy,
	CollaborationType,
	TaskComplexity,
	TaskCoordinator,
	TeamMember,
)
from docfusion.workflow.monitoring.workflow_monitor import (
	MonitoringLevel,
	WorkflowMonitor,
)
from docfusion.workflow.processes.process_definition import ProcessDefinition


# ============================================================================
# WorkflowEngine
# ============================================================================

class TestWorkflowEngineSmoke:
	"""Smoke tests for WorkflowEngine (complementing test_workflow_engine.py)."""

	async def test_create_and_start_workflow(self):
		"""Happy path: create a workflow instance and start it."""
		engine = WorkflowEngine(max_concurrent_workflows=5)
		await engine.start_engine()
		instance = await engine.create_workflow_instance(
			process_definition_id="proc_001",
			name="Test Workflow",
			description="Smoke test",
			created_by="user_001",
		)
		assert instance.state.name == "CREATED"
		await engine.stop_engine()

	async def test_start_workflow_with_invalid_id(self):
		"""Failure path: start a workflow with a non-existent instance."""
		engine = WorkflowEngine(max_concurrent_workflows=5)
		await engine.start_engine()
		result = await engine.start_workflow_instance("nonexistent-id")
		assert result is False
		await engine.stop_engine()


# ============================================================================
# TaskCoordinator
# ============================================================================

class TestTaskCoordinator:
	"""Happy and failure paths for TaskCoordinator."""

	def test_assign_task_happy_path(self):
		"""Happy path: assign a task to a team member."""
		coordinator = TaskCoordinator(
			default_strategy=AssignmentStrategy.SKILL_BASED,
			enable_workload_balancing=True,
		)
		member = TeamMember(
			user_id="member-1",
			name="Alice",
			email="alice@example.com",
			skills={"design": 0.9},
			specializations=["ui"],
			certifications=[],
			experience_years=5.0,
			average_task_completion_time=2.5,
			quality_rating=0.9,
			collaboration_rating=0.85,
			reliability_score=0.95,
			preferred_task_types=["design", "ui"],
			unavailable_dates=[],
			learning_goals=[],
		)
		asyncio.run(coordinator.add_team_member(member))
		assignment = asyncio.run(
			coordinator.assign_task(
				task_id="task-1",
				workflow_instance_id="wf-1",
				required_skills={"design": 0.5},
				estimated_effort_hours=4.0,
				complexity_level=TaskComplexity.MODERATE,
				collaboration_type=CollaborationType.INDIVIDUAL,
			)
		)
		assert assignment is not None
		assert assignment.assigned_to == ["member-1"]

	def test_assign_task_no_matching_member(self):
		"""Failure path: assign a task when no member has the required skills."""
		coordinator = TaskCoordinator(
			default_strategy=AssignmentStrategy.SKILL_BASED,
			enable_workload_balancing=True,
		)
		member = TeamMember(
			user_id="member-1",
			name="Bob",
			email="bob@example.com",
			skills={"python": 0.8},
			specializations=["backend"],
			certifications=[],
			experience_years=3.0,
			average_task_completion_time=3.0,
			quality_rating=0.8,
			collaboration_rating=0.8,
			reliability_score=0.9,
			preferred_task_types=["backend", "api"],
			unavailable_dates=[],
			learning_goals=[],
		)
		asyncio.run(coordinator.add_team_member(member))
		assignment = asyncio.run(
			coordinator.assign_task(
				task_id="task-2",
				workflow_instance_id="wf-1",
				required_skills={"rocket-science": 0.9},
				estimated_effort_hours=8.0,
				complexity_level=TaskComplexity.COMPLEX,
				collaboration_type=CollaborationType.INDIVIDUAL,
			)
		)
		assert assignment is not None
		assert assignment.confidence_score < 0.5


# ============================================================================
# WorkflowMonitor
# ============================================================================

class TestWorkflowMonitor:
	"""Happy and failure paths for WorkflowMonitor."""

	def test_register_step_and_get_metrics(self):
		"""Happy path: register a workflow step and retrieve metrics."""
		monitor = WorkflowMonitor(
			monitoring_level=MonitoringLevel.DETAILED,
			metrics_retention_days=7,
		)
		asyncio.run(
			monitor.register_step_start(
				workflow_instance_id="wf-1",
				step_name="parse",
				step_type="processing",
				input_size_bytes=1024,
			)
		)
		metrics = asyncio.run(monitor.get_real_time_metrics("wf-1"))
		assert isinstance(metrics, dict)

	def test_get_metrics_for_unknown_workflow(self):
		"""Failure path: get metrics for a workflow with no recorded steps."""
		monitor = WorkflowMonitor(
			monitoring_level=MonitoringLevel.DETAILED,
			metrics_retention_days=7,
		)
		metrics = asyncio.run(monitor.get_real_time_metrics("unknown-wf"))
		assert isinstance(metrics, dict)
		assert len(metrics) == 0 or metrics.get("step_count", 0) == 0


# ============================================================================
# ProcessDefinition
# ============================================================================

class TestProcessDefinition:
	"""Happy and failure paths for ProcessDefinition."""

	def test_create_process(self):
		"""Happy path: create a new process definition."""
		proc = ProcessDefinition()
		result = asyncio.run(
			proc.create_process(
				name="Invoice Approval",
				description="Approve incoming invoices",
				created_by="admin",
				category="finance",
			)
		)
		assert result.name == "Invoice Approval"
		assert result.process_id is not None

	def test_validate_empty_process(self):
		"""Failure path: validate a process with no nodes or edges."""
		proc = ProcessDefinition()
		result = asyncio.run(
			proc.create_process(
				name="Empty Process",
				description="Nothing here",
				created_by="admin",
			)
		)
		assert result.name == "Empty Process"
		validation = asyncio.run(proc.validate_process(result.process_id))
		assert validation.is_valid is False


# ============================================================================
# TaskScheduler
# ============================================================================

class TestTaskScheduler:
	"""Happy and failure paths for TaskScheduler."""

	def test_submit_task(self):
		"""Happy path: submit a task to the scheduler."""
		scheduler = TaskScheduler()
		asyncio.run(scheduler.start_scheduler())
		task = ScheduledTask(
			workflow_instance_id="wf-1",
			name="send_reminder",
			description="Send reminder email",
			task_type="notification",
			priority=TaskPriority.NORMAL,
			deadline=datetime.now(timezone.utc) + timedelta(minutes=5),
		)
		result = asyncio.run(scheduler.submit_task(task))
		assert result is True
		asyncio.run(scheduler.stop_scheduler())

	def test_cancel_nonexistent_task(self):
		"""Failure path: cancel a task that was never submitted."""
		scheduler = TaskScheduler()
		asyncio.run(scheduler.start_scheduler())
		result = asyncio.run(scheduler.cancel_task("nonexistent-task"))
		assert result is False
		asyncio.run(scheduler.stop_scheduler())
