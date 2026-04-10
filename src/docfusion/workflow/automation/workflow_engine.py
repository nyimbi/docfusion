"""
WorkflowEngine - Process instance management and execution engine.

This module provides comprehensive workflow execution capabilities including
process instance management, task scheduling, event-driven triggers, state
persistence, monitoring, alerting, and optimization.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Callable, Union
from concurrent.futures import ThreadPoolExecutor
import json

from pydantic import BaseModel, Field, ConfigDict
from ...core.utils import uuid7str

logger = logging.getLogger(__name__)

class ProcessState(str, Enum):
	"""Workflow process states."""
	CREATED = "created"
	INITIALIZED = "initialized"
	RUNNING = "running"
	PAUSED = "paused"
	WAITING = "waiting"
	BLOCKED = "blocked"
	COMPLETED = "completed"
	FAILED = "failed"
	CANCELLED = "cancelled"
	TERMINATED = "terminated"

class TaskState(str, Enum):
	"""Individual task states within workflow."""
	PENDING = "pending"
	QUEUED = "queued"
	RUNNING = "running"
	WAITING_FOR_INPUT = "waiting_for_input"
	WAITING_FOR_DEPENDENCY = "waiting_for_dependency"
	COMPLETED = "completed"
	FAILED = "failed"
	CANCELLED = "cancelled"
	SKIPPED = "skipped"
	RETRYING = "retrying"

class TriggerType(str, Enum):
	"""Types of workflow triggers."""
	MANUAL = "manual"
	SCHEDULED = "scheduled"
	EVENT_DRIVEN = "event_driven"
	DOCUMENT_CREATED = "document_created"
	DOCUMENT_UPDATED = "document_updated"
	DEADLINE_APPROACHING = "deadline_approaching"
	APPROVAL_RECEIVED = "approval_received"
	COLLABORATION_STARTED = "collaboration_started"
	COMPLIANCE_FAILED = "compliance_failed"
	TEMPLATE_AVAILABLE = "template_available"

class OptimizationType(str, Enum):
	"""Types of workflow optimization."""
	PERFORMANCE = "performance"
	RESOURCE_USAGE = "resource_usage"
	COST = "cost"
	QUALITY = "quality"
	DEADLINE_ADHERENCE = "deadline_adherence"
	USER_SATISFACTION = "user_satisfaction"

class WorkflowTask(BaseModel):
	"""Individual task within a workflow instance."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	task_id: str = Field(default_factory=uuid7str)
	name: str = Field(description="Human-readable task name")
	description: str = Field(description="Task description")
	task_type: str = Field(description="Type of task (user, service, script, etc.)")
	state: TaskState = Field(TaskState.PENDING)
	
	# Task configuration
	assigned_to: List[str] = Field(default_factory=list, description="Assigned user IDs")
	priority: int = Field(5, description="Task priority (1-10)")
	estimated_duration_minutes: Optional[int] = Field(None)
	max_duration_minutes: Optional[int] = Field(None)
	retry_count: int = Field(0)
	max_retries: int = Field(3)
	
	# Dependencies and conditions
	depends_on: List[str] = Field(default_factory=list, description="Task IDs this task depends on")
	conditions: Dict[str, Any] = Field(default_factory=dict, description="Execution conditions")
	input_data: Dict[str, Any] = Field(default_factory=dict)
	output_data: Dict[str, Any] = Field(default_factory=dict)
	
	# Timing
	created_at: datetime = Field(default_factory=datetime.now)
	started_at: Optional[datetime] = None
	completed_at: Optional[datetime] = None
	deadline: Optional[datetime] = None
	
	# Execution details
	executor_id: Optional[str] = None
	error_message: Optional[str] = None
	execution_context: Dict[str, Any] = Field(default_factory=dict)
	
	# Metrics
	actual_duration_minutes: Optional[float] = None
	resource_usage: Dict[str, float] = Field(default_factory=dict)
	quality_score: Optional[float] = None

class WorkflowInstance(BaseModel):
	"""Active workflow process instance."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	instance_id: str = Field(default_factory=uuid7str)
	process_definition_id: str = Field(description="Process definition this instance is based on")
	name: str = Field(description="Instance name")
	description: str = Field(description="Instance description")
	
	# State management
	state: ProcessState = Field(ProcessState.CREATED)
	current_phase: str = Field("initialization", description="Current workflow phase")
	completion_percentage: float = Field(0.0)
	
	# Tasks and execution
	tasks: Dict[str, WorkflowTask] = Field(default_factory=dict, description="Task ID -> Task")
	active_tasks: Set[str] = Field(default_factory=set, description="Currently executing task IDs")
	completed_tasks: Set[str] = Field(default_factory=set, description="Completed task IDs")
	failed_tasks: Set[str] = Field(default_factory=set, description="Failed task IDs")
	
	# Context and variables
	workflow_variables: Dict[str, Any] = Field(default_factory=dict)
	execution_context: Dict[str, Any] = Field(default_factory=dict)
	
	# Timing and scheduling
	created_at: datetime = Field(default_factory=datetime.now)
	started_at: Optional[datetime] = None
	completed_at: Optional[datetime] = None
	estimated_completion: Optional[datetime] = None
	deadline: Optional[datetime] = None
	
	# Creator and ownership
	created_by: str = Field(description="User who created this instance")
	owner: str = Field(description="Current instance owner")
	participants: Set[str] = Field(default_factory=set, description="All participants in workflow")
	
	# Monitoring and optimization
	performance_metrics: Dict[str, Any] = Field(default_factory=dict)
	optimization_suggestions: List[str] = Field(default_factory=list)
	alerts: List[Dict[str, Any]] = Field(default_factory=list)
	
	# History and audit
	state_history: List[Dict[str, Any]] = Field(default_factory=list)
	execution_log: List[Dict[str, Any]] = Field(default_factory=list)

@dataclass
class WorkflowTrigger:
	"""Workflow trigger configuration."""
	trigger_id: str = field(default_factory=uuid7str)
	trigger_type: TriggerType = TriggerType.MANUAL
	trigger_condition: Dict[str, Any] = field(default_factory=dict)
	target_process_id: str = ""
	is_active: bool = True
	created_at: datetime = field(default_factory=datetime.now)

@dataclass
class OptimizationMetric:
	"""Workflow optimization metric."""
	metric_id: str = field(default_factory=uuid7str)
	optimization_type: OptimizationType = OptimizationType.PERFORMANCE
	current_value: float = 0.0
	target_value: float = 0.0
	improvement_suggestions: List[str] = field(default_factory=list)
	measured_at: datetime = field(default_factory=datetime.now)

class WorkflowEngine:
	"""
	Comprehensive workflow execution engine.
	
	Provides process instance management, task scheduling and execution,
	event-driven workflow triggers, state persistence, monitoring, alerting,
	and intelligent workflow optimization.
	"""
	
	def __init__(self, max_concurrent_workflows: int = 100):
		"""
		Initialize the workflow engine.
		
		Args:
			max_concurrent_workflows: Maximum number of concurrent workflow instances
		"""
		self.max_concurrent_workflows = max_concurrent_workflows
		
		# Core data structures
		self.active_instances: Dict[str, WorkflowInstance] = {}
		self.completed_instances: Dict[str, WorkflowInstance] = {}
		self.workflow_triggers: Dict[str, WorkflowTrigger] = {}
		self.optimization_metrics: Dict[str, OptimizationMetric] = {}
		
		# Event handling
		self.event_handlers: Dict[str, List[Callable]] = {}
		self.workflow_subscribers: List[Callable] = []
		
		# Execution management
		self.task_executor = ThreadPoolExecutor(max_workers=20)
		self.monitoring_task: Optional[asyncio.Task] = None
		self.optimization_task: Optional[asyncio.Task] = None
		
		# Synchronization
		self._lock = asyncio.Lock()
		self._is_running = False
		
		# Performance tracking
		self.performance_stats = {
			'workflows_started': 0,
			'workflows_completed': 0,
			'workflows_failed': 0,
			'average_completion_time': 0.0,
			'task_execution_count': 0,
			'optimization_runs': 0
		}
		
		logger.info("WorkflowEngine initialized with max_concurrent_workflows=%d", max_concurrent_workflows)
	
	async def start_engine(self):
		"""Start the workflow engine and background tasks."""
		async with self._lock:
			if self._is_running:
				logger.warning("WorkflowEngine is already running")
				return
			
			self._is_running = True
			
			# Start background monitoring
			self.monitoring_task = asyncio.create_task(self._monitor_workflows())
			self.optimization_task = asyncio.create_task(self._optimize_workflows())
			
			logger.info("WorkflowEngine started successfully")
	
	async def stop_engine(self):
		"""Stop the workflow engine and cleanup resources."""
		async with self._lock:
			if not self._is_running:
				return
			
			self._is_running = False
			
			# Cancel background tasks
			if self.monitoring_task:
				self.monitoring_task.cancel()
				try:
					await self.monitoring_task
				except asyncio.CancelledError:
					pass
			
			if self.optimization_task:
				self.optimization_task.cancel()
				try:
					await self.optimization_task
				except asyncio.CancelledError:
					pass
			
			# Shutdown executor
			self.task_executor.shutdown(wait=True)
			
			logger.info("WorkflowEngine stopped successfully")
	
	async def create_workflow_instance(
		self,
		process_definition_id: str,
		name: str,
		description: str,
		created_by: str,
		workflow_variables: Optional[Dict[str, Any]] = None,
		deadline: Optional[datetime] = None
	) -> WorkflowInstance:
		"""
		Create a new workflow instance.
		
		Args:
			process_definition_id: ID of the process definition to instantiate
			name: Human-readable instance name
			description: Instance description
			created_by: User creating the instance
			workflow_variables: Initial workflow variables
			deadline: Optional deadline for completion
		
		Returns:
			WorkflowInstance: Created workflow instance
		"""
		async with self._lock:
			# Check capacity
			if len(self.active_instances) >= self.max_concurrent_workflows:
				raise RuntimeError(f"Maximum concurrent workflows ({self.max_concurrent_workflows}) reached")
			
			# Create workflow instance
			instance = WorkflowInstance(
				process_definition_id=process_definition_id,
				name=name,
				description=description,
				created_by=created_by,
				owner=created_by,
				workflow_variables=workflow_variables or {},
				deadline=deadline
			)
			
			# Add to active instances
			self.active_instances[instance.instance_id] = instance
			
			# Record state change
			await self._record_state_change(instance, ProcessState.CREATED, "Workflow instance created")
			
			# Update stats
			self.performance_stats['workflows_started'] += 1
			
			logger.info(f"Created workflow instance {instance.instance_id} for process {process_definition_id}")
			
			# Notify subscribers
			await self._notify_workflow_event("instance_created", instance)
			
			return instance
	
	async def start_workflow_instance(self, instance_id: str) -> bool:
		"""
		Start execution of a workflow instance.
		
		Args:
			instance_id: Workflow instance ID to start
		
		Returns:
			bool: True if started successfully
		"""
		async with self._lock:
			if instance_id not in self.active_instances:
				logger.error(f"Workflow instance {instance_id} not found")
				return False
			
			instance = self.active_instances[instance_id]
			
			if instance.state != ProcessState.CREATED:
				logger.warning(f"Workflow instance {instance_id} is not in CREATED state (current: {instance.state})")
				return False
			
			# Initialize workflow
			instance.state = ProcessState.INITIALIZED
			instance.started_at = datetime.now()
			
			# Record state change
			await self._record_state_change(instance, ProcessState.INITIALIZED, "Workflow instance initialized")
			
			# Start initial tasks
			await self._initialize_workflow_tasks(instance)
			
			# Change to running state
			instance.state = ProcessState.RUNNING
			await self._record_state_change(instance, ProcessState.RUNNING, "Workflow execution started")
			
			# Schedule initial tasks
			await self._schedule_ready_tasks(instance)
			
			logger.info(f"Started workflow instance {instance_id}")
			
			# Notify subscribers
			await self._notify_workflow_event("instance_started", instance)
			
			return True
	
	async def pause_workflow_instance(self, instance_id: str, reason: str = "Manual pause") -> bool:
		"""
		Pause execution of a workflow instance.
		
		Args:
			instance_id: Workflow instance ID to pause
			reason: Reason for pausing
		
		Returns:
			bool: True if paused successfully
		"""
		async with self._lock:
			if instance_id not in self.active_instances:
				return False
			
			instance = self.active_instances[instance_id]
			
			if instance.state not in [ProcessState.RUNNING, ProcessState.WAITING]:
				return False
			
			# Pause workflow
			previous_state = instance.state
			instance.state = ProcessState.PAUSED
			
			# Record state change
			await self._record_state_change(instance, ProcessState.PAUSED, f"Workflow paused: {reason}")
			
			logger.info(f"Paused workflow instance {instance_id}: {reason}")
			
			# Notify subscribers
			await self._notify_workflow_event("instance_paused", instance, {"reason": reason, "previous_state": previous_state})
			
			return True
	
	async def resume_workflow_instance(self, instance_id: str) -> bool:
		"""
		Resume execution of a paused workflow instance.
		
		Args:
			instance_id: Workflow instance ID to resume
		
		Returns:
			bool: True if resumed successfully
		"""
		async with self._lock:
			if instance_id not in self.active_instances:
				return False
			
			instance = self.active_instances[instance_id]
			
			if instance.state != ProcessState.PAUSED:
				return False
			
			# Resume workflow
			instance.state = ProcessState.RUNNING
			
			# Record state change
			await self._record_state_change(instance, ProcessState.RUNNING, "Workflow resumed")
			
			# Schedule ready tasks
			await self._schedule_ready_tasks(instance)
			
			logger.info(f"Resumed workflow instance {instance_id}")
			
			# Notify subscribers
			await self._notify_workflow_event("instance_resumed", instance)
			
			return True
	
	async def cancel_workflow_instance(self, instance_id: str, reason: str = "Manual cancellation") -> bool:
		"""
		Cancel execution of a workflow instance.
		
		Args:
			instance_id: Workflow instance ID to cancel
			reason: Reason for cancellation
		
		Returns:
			bool: True if cancelled successfully
		"""
		async with self._lock:
			if instance_id not in self.active_instances:
				return False
			
			instance = self.active_instances[instance_id]
			
			# Cancel all active tasks
			for task_id in instance.active_tasks.copy():
				task = instance.tasks[task_id]
				task.state = TaskState.CANCELLED
				instance.active_tasks.discard(task_id)
			
			# Update workflow state
			instance.state = ProcessState.CANCELLED
			instance.completed_at = datetime.now()
			
			# Record state change
			await self._record_state_change(instance, ProcessState.CANCELLED, f"Workflow cancelled: {reason}")
			
			# Move to completed instances
			self.completed_instances[instance_id] = self.active_instances.pop(instance_id)
			
			logger.info(f"Cancelled workflow instance {instance_id}: {reason}")
			
			# Notify subscribers
			await self._notify_workflow_event("instance_cancelled", instance, {"reason": reason})
			
			return True
	
	async def complete_task(
		self,
		instance_id: str,
		task_id: str,
		output_data: Optional[Dict[str, Any]] = None,
		completed_by: Optional[str] = None
	) -> bool:
		"""
		Mark a task as completed and advance workflow.
		
		Args:
			instance_id: Workflow instance ID
			task_id: Task ID to complete
			output_data: Task output data
			completed_by: User who completed the task
		
		Returns:
			bool: True if task was completed successfully
		"""
		async with self._lock:
			if instance_id not in self.active_instances:
				return False
			
			instance = self.active_instances[instance_id]
			
			if task_id not in instance.tasks:
				return False
			
			task = instance.tasks[task_id]
			
			if task.state != TaskState.RUNNING:
				logger.warning(f"Task {task_id} is not in RUNNING state (current: {task.state})")
				return False
			
			# Complete task
			task.state = TaskState.COMPLETED
			task.completed_at = datetime.now()
			task.output_data = output_data or {}
			
			if task.started_at:
				task.actual_duration_minutes = (task.completed_at - task.started_at).total_seconds() / 60
			
			# Update instance state
			instance.active_tasks.discard(task_id)
			instance.completed_tasks.add(task_id)
			
			# Log execution
			await self._log_execution_event(instance, "task_completed", {
				"task_id": task_id,
				"task_name": task.name,
				"completed_by": completed_by,
				"duration_minutes": task.actual_duration_minutes,
				"output_data_size": len(str(task.output_data))
			})
			
			logger.info(f"Completed task {task_id} in workflow {instance_id}")
			
			# Update completion percentage
			await self._update_completion_percentage(instance)
			
			# Schedule next tasks
			await self._schedule_ready_tasks(instance)
			
			# Check if workflow is complete
			await self._check_workflow_completion(instance)
			
			# Notify subscribers
			await self._notify_workflow_event("task_completed", instance, {
				"task_id": task_id,
				"completed_by": completed_by
			})
			
			# Update performance stats
			self.performance_stats['task_execution_count'] += 1
			
			return True
	
	async def fail_task(
		self,
		instance_id: str,
		task_id: str,
		error_message: str,
		retry: bool = True
	) -> bool:
		"""
		Mark a task as failed and handle retry logic.
		
		Args:
			instance_id: Workflow instance ID
			task_id: Task ID that failed
			error_message: Error description
			retry: Whether to attempt retry
		
		Returns:
			bool: True if failure was handled successfully
		"""
		async with self._lock:
			if instance_id not in self.active_instances:
				return False
			
			instance = self.active_instances[instance_id]
			
			if task_id not in instance.tasks:
				return False
			
			task = instance.tasks[task_id]
			task.error_message = error_message
			
			# Handle retry logic
			if retry and task.retry_count < task.max_retries:
				task.retry_count += 1
				task.state = TaskState.RETRYING
				
				# Schedule retry
				await self._schedule_task_retry(instance, task)
				
				logger.info(f"Retrying task {task_id} (attempt {task.retry_count}/{task.max_retries})")
			else:
				# Task finally failed
				task.state = TaskState.FAILED
				task.completed_at = datetime.now()
				
				# Update instance state
				instance.active_tasks.discard(task_id)
				instance.failed_tasks.add(task_id)
				
				logger.error(f"Task {task_id} failed in workflow {instance_id}: {error_message}")
				
				# Check if workflow should fail
				await self._check_workflow_failure(instance)
			
			# Log execution
			await self._log_execution_event(instance, "task_failed", {
				"task_id": task_id,
				"task_name": task.name,
				"error_message": error_message,
				"retry_count": task.retry_count,
				"will_retry": retry and task.retry_count < task.max_retries
			})
			
			# Notify subscribers
			await self._notify_workflow_event("task_failed", instance, {
				"task_id": task_id,
				"error_message": error_message,
				"retry_count": task.retry_count
			})
			
			return True
	
	async def get_workflow_instance(self, instance_id: str) -> Optional[WorkflowInstance]:
		"""
		Get workflow instance by ID.
		
		Args:
			instance_id: Workflow instance ID
		
		Returns:
			Optional[WorkflowInstance]: Workflow instance if found
		"""
		# Check active instances first
		if instance_id in self.active_instances:
			return self.active_instances[instance_id]
		
		# Check completed instances
		if instance_id in self.completed_instances:
			return self.completed_instances[instance_id]
		
		return None
	
	async def get_active_workflows(self) -> List[WorkflowInstance]:
		"""
		Get all active workflow instances.
		
		Returns:
			List[WorkflowInstance]: List of active workflow instances
		"""
		return list(self.active_instances.values())
	
	async def get_workflow_status(self, instance_id: str) -> Optional[Dict[str, Any]]:
		"""
		Get comprehensive workflow status information.
		
		Args:
			instance_id: Workflow instance ID
		
		Returns:
			Optional[Dict[str, Any]]: Status information if workflow found
		"""
		instance = await self.get_workflow_instance(instance_id)
		if not instance:
			return None
		
		return {
			"instance_id": instance.instance_id,
			"name": instance.name,
			"state": instance.state.value,
			"current_phase": instance.current_phase,
			"completion_percentage": instance.completion_percentage,
			"created_at": instance.created_at.isoformat(),
			"started_at": instance.started_at.isoformat() if instance.started_at else None,
			"estimated_completion": instance.estimated_completion.isoformat() if instance.estimated_completion else None,
			"deadline": instance.deadline.isoformat() if instance.deadline else None,
			"total_tasks": len(instance.tasks),
			"active_tasks": len(instance.active_tasks),
			"completed_tasks": len(instance.completed_tasks),
			"failed_tasks": len(instance.failed_tasks),
			"participants": list(instance.participants),
			"performance_metrics": instance.performance_metrics,
			"alerts": instance.alerts[-5:] if instance.alerts else [],  # Last 5 alerts
			"optimization_suggestions": instance.optimization_suggestions
		}
	
	async def register_workflow_trigger(
		self,
		trigger_type: TriggerType,
		trigger_condition: Dict[str, Any],
		target_process_id: str
	) -> str:
		"""
		Register an event-driven workflow trigger.
		
		Args:
			trigger_type: Type of trigger
			trigger_condition: Condition parameters
			target_process_id: Process to trigger
		
		Returns:
			str: Trigger ID
		"""
		trigger = WorkflowTrigger(
			trigger_type=trigger_type,
			trigger_condition=trigger_condition,
			target_process_id=target_process_id
		)
		
		self.workflow_triggers[trigger.trigger_id] = trigger
		
		logger.info(f"Registered workflow trigger {trigger.trigger_id} for process {target_process_id}")
		
		return trigger.trigger_id
	
	async def fire_event(self, event_type: str, event_data: Dict[str, Any]):
		"""
		Fire a workflow event that may trigger workflows.
		
		Args:
			event_type: Type of event
			event_data: Event data
		"""
		# Check triggers
		for trigger in self.workflow_triggers.values():
			if not trigger.is_active:
				continue
			
			if await self._evaluate_trigger_condition(trigger, event_type, event_data):
				# Create and start workflow instance
				try:
					instance = await self.create_workflow_instance(
						process_definition_id=trigger.target_process_id,
						name=f"Triggered by {event_type}",
						description=f"Automatically triggered workflow from {event_type} event",
						created_by="system",
						workflow_variables=event_data
					)
					
					await self.start_workflow_instance(instance.instance_id)
					
					logger.info(f"Triggered workflow {instance.instance_id} from event {event_type}")
				except Exception as e:
					logger.error(f"Failed to trigger workflow from event {event_type}: {e}")
	
	async def subscribe_to_workflow_events(self, callback: Callable) -> str:
		"""
		Subscribe to workflow events.
		
		Args:
			callback: Callback function for workflow events
		
		Returns:
			str: Subscription ID
		"""
		self.workflow_subscribers.append(callback)
		subscription_id = uuid7str()
		logger.info("New workflow event subscription added")
		return subscription_id
	
	async def get_performance_stats(self) -> Dict[str, Any]:
		"""
		Get workflow engine performance statistics.
		
		Returns:
			Dict[str, Any]: Performance statistics
		"""
		return {
			**self.performance_stats,
			"active_workflows": len(self.active_instances),
			"completed_workflows": len(self.completed_instances),
			"registered_triggers": len(self.workflow_triggers),
			"engine_uptime_seconds": (datetime.now() - getattr(self, '_start_time', datetime.now())).total_seconds(),
			"optimization_metrics_count": len(self.optimization_metrics)
		}
	
	# Private helper methods
	
	async def _initialize_workflow_tasks(self, instance: WorkflowInstance):
		"""Initialize tasks for a workflow instance."""
		# This would normally load tasks from process definition
		# For now, create a sample task structure
		
		# Example task creation (would be loaded from process definition)
		initial_task = WorkflowTask(
			name="Initialize Workflow",
			description="Initialize workflow execution",
			task_type="system",
			priority=10
		)
		
		instance.tasks[initial_task.task_id] = initial_task
		logger.debug(f"Initialized {len(instance.tasks)} tasks for workflow {instance.instance_id}")
	
	async def _schedule_ready_tasks(self, instance: WorkflowInstance):
		"""Schedule tasks that are ready to execute."""
		for task_id, task in instance.tasks.items():
			if (task.state == TaskState.PENDING and 
				await self._are_dependencies_satisfied(instance, task)):
				
				# Schedule task
				task.state = TaskState.QUEUED
				instance.active_tasks.add(task_id)
				
				# Start task execution
				await self._execute_task(instance, task)
	
	async def _are_dependencies_satisfied(self, instance: WorkflowInstance, task: WorkflowTask) -> bool:
		"""Check if task dependencies are satisfied."""
		for dep_task_id in task.depends_on:
			if dep_task_id not in instance.completed_tasks:
				return False
		return True
	
	async def _execute_task(self, instance: WorkflowInstance, task: WorkflowTask):
		"""Execute a workflow task."""
		task.state = TaskState.RUNNING
		task.started_at = datetime.now()

		logger.debug(f"Starting execution of task {task.task_id}: {task.name}")

		# For demonstration, automatically complete system tasks
		# Complete inline (without acquiring lock) since we're already in a locked context
		if task.task_type == "system":
			await asyncio.sleep(0.1)  # Simulate execution time
			task.state = TaskState.COMPLETED
			task.completed_at = datetime.now()
			task.output_data = {"result": "success"}
			if task.started_at:
				task.actual_duration_minutes = (task.completed_at - task.started_at).total_seconds() / 60
			instance.active_tasks.discard(task.task_id)
			instance.completed_tasks.add(task.task_id)
			self.performance_stats['task_execution_count'] += 1
			await self._update_completion_percentage(instance)
			await self._check_workflow_completion(instance)
	
	async def _schedule_task_retry(self, instance: WorkflowInstance, task: WorkflowTask):
		"""Schedule a task retry after delay."""
		retry_delay = min(task.retry_count * 60, 300)  # Max 5 minute delay
		
		async def retry_task():
			await asyncio.sleep(retry_delay)
			task.state = TaskState.QUEUED
			await self._execute_task(instance, task)
		
		asyncio.create_task(retry_task())
	
	async def _update_completion_percentage(self, instance: WorkflowInstance):
		"""Update workflow completion percentage."""
		total_tasks = len(instance.tasks)
		if total_tasks == 0:
			instance.completion_percentage = 0.0
			return
		
		completed = len(instance.completed_tasks)
		instance.completion_percentage = (completed / total_tasks) * 100.0
		
		# Update estimated completion time
		if instance.completion_percentage > 0 and instance.started_at:
			elapsed = datetime.now() - instance.started_at
			estimated_total = elapsed / (instance.completion_percentage / 100.0)
			instance.estimated_completion = instance.started_at + estimated_total
	
	async def _check_workflow_completion(self, instance: WorkflowInstance):
		"""Check if workflow is complete."""
		if len(instance.active_tasks) == 0 and len(instance.completed_tasks) == len(instance.tasks):
			# Workflow completed
			instance.state = ProcessState.COMPLETED
			instance.completed_at = datetime.now()
			instance.completion_percentage = 100.0
			
			# Record state change
			await self._record_state_change(instance, ProcessState.COMPLETED, "Workflow completed successfully")
			
			# Move to completed instances
			self.completed_instances[instance.instance_id] = self.active_instances.pop(instance.instance_id)
			
			# Update stats
			self.performance_stats['workflows_completed'] += 1
			if instance.started_at:
				duration = (instance.completed_at - instance.started_at).total_seconds() / 60
				current_avg = self.performance_stats['average_completion_time']
				completed_count = self.performance_stats['workflows_completed']
				self.performance_stats['average_completion_time'] = (
					(current_avg * (completed_count - 1) + duration) / completed_count
				)
			
			logger.info(f"Workflow instance {instance.instance_id} completed successfully")
			
			# Notify subscribers
			await self._notify_workflow_event("instance_completed", instance)
	
	async def _check_workflow_failure(self, instance: WorkflowInstance):
		"""Check if workflow should fail due to critical task failures."""
		# Simple logic: fail if any task failed (could be more sophisticated)
		if len(instance.failed_tasks) > 0:
			# Check if there are any critical tasks that failed
			critical_failed = any(
				instance.tasks[task_id].priority >= 8 
				for task_id in instance.failed_tasks
			)
			
			if critical_failed or len(instance.failed_tasks) > len(instance.tasks) * 0.5:
				instance.state = ProcessState.FAILED
				instance.completed_at = datetime.now()
				
				# Record state change
				await self._record_state_change(instance, ProcessState.FAILED, 
					f"Workflow failed due to {len(instance.failed_tasks)} failed tasks")
				
				# Move to completed instances
				self.completed_instances[instance.instance_id] = self.active_instances.pop(instance.instance_id)
				
				# Update stats
				self.performance_stats['workflows_failed'] += 1
				
				logger.error(f"Workflow instance {instance.instance_id} failed")
				
				# Notify subscribers
				await self._notify_workflow_event("instance_failed", instance)
	
	async def _record_state_change(self, instance: WorkflowInstance, new_state: ProcessState, reason: str):
		"""Record a state change in workflow history."""
		state_change = {
			"timestamp": datetime.now().isoformat(),
			"previous_state": instance.state.value,
			"new_state": new_state.value,
			"reason": reason
		}
		
		instance.state_history.append(state_change)
		
		# Keep only last 50 state changes
		if len(instance.state_history) > 50:
			instance.state_history = instance.state_history[-50:]
	
	async def _log_execution_event(self, instance: WorkflowInstance, event_type: str, event_data: Dict[str, Any]):
		"""Log an execution event."""
		event = {
			"timestamp": datetime.now().isoformat(),
			"event_type": event_type,
			"event_data": event_data
		}
		
		instance.execution_log.append(event)
		
		# Keep only last 100 execution events
		if len(instance.execution_log) > 100:
			instance.execution_log = instance.execution_log[-100:]
	
	async def _evaluate_trigger_condition(
		self, 
		trigger: WorkflowTrigger, 
		event_type: str, 
		event_data: Dict[str, Any]
	) -> bool:
		"""Evaluate if a trigger condition is met."""
		# Simple evaluation logic (could be more sophisticated)
		if trigger.trigger_type.value == event_type:
			return True
		
		# Check condition matching
		for key, expected_value in trigger.trigger_condition.items():
			if key not in event_data or event_data[key] != expected_value:
				return False
		
		return True
	
	async def _monitor_workflows(self):
		"""Background task to monitor workflow health and performance."""
		while self._is_running:
			try:
				await asyncio.sleep(30)  # Monitor every 30 seconds
				
				current_time = datetime.now()
				
				# Check for stuck workflows
				for instance in self.active_instances.values():
					if instance.state == ProcessState.RUNNING:
						# Check for overdue tasks
						for task_id in instance.active_tasks:
							task = instance.tasks[task_id]
							if (task.deadline and current_time > task.deadline):
								# Task is overdue
								alert = {
									"type": "task_overdue",
									"task_id": task_id,
									"task_name": task.name,
									"deadline": task.deadline.isoformat(),
									"overdue_minutes": (current_time - task.deadline).total_seconds() / 60,
									"timestamp": current_time.isoformat()
								}
								instance.alerts.append(alert)
								
								logger.warning(f"Task {task_id} is overdue in workflow {instance.instance_id}")
						
						# Check workflow deadline
						if (instance.deadline and current_time > instance.deadline):
							alert = {
								"type": "workflow_overdue",
								"deadline": instance.deadline.isoformat(),
								"overdue_minutes": (current_time - instance.deadline).total_seconds() / 60,
								"timestamp": current_time.isoformat()
							}
							instance.alerts.append(alert)
							
							logger.warning(f"Workflow {instance.instance_id} is overdue")
				
				# Cleanup old alerts (keep only last 20)
				for instance in self.active_instances.values():
					if len(instance.alerts) > 20:
						instance.alerts = instance.alerts[-20:]
				
			except Exception as e:
				logger.error(f"Error in workflow monitoring: {e}")
	
	async def _optimize_workflows(self):
		"""Background task to optimize workflow performance."""
		while self._is_running:
			try:
				await asyncio.sleep(300)  # Optimize every 5 minutes
				
				# Analyze performance metrics
				for instance in self.active_instances.values():
					await self._analyze_workflow_performance(instance)
				
				# Update optimization metrics
				await self._update_optimization_metrics()
				
				self.performance_stats['optimization_runs'] += 1
				
			except Exception as e:
				logger.error(f"Error in workflow optimization: {e}")
	
	async def _analyze_workflow_performance(self, instance: WorkflowInstance):
		"""Analyze performance of a specific workflow instance."""
		suggestions = []
		
		# Check task execution times
		slow_tasks = [
			task for task in instance.tasks.values()
			if (task.actual_duration_minutes and 
				task.estimated_duration_minutes and
				task.actual_duration_minutes > task.estimated_duration_minutes * 1.5)
		]
		
		if slow_tasks:
			suggestions.append(f"Consider optimizing {len(slow_tasks)} slow-running tasks")
		
		# Check for bottlenecks
		if len(instance.active_tasks) == 1 and len(instance.tasks) > 5:
			suggestions.append("Consider parallelizing tasks to reduce bottlenecks")
		
		# Check resource utilization
		high_resource_tasks = [
			task for task in instance.tasks.values()
			if any(usage > 80.0 for usage in task.resource_usage.values())
		]
		
		if high_resource_tasks:
			suggestions.append(f"Monitor resource usage for {len(high_resource_tasks)} resource-intensive tasks")
		
		# Update instance suggestions
		instance.optimization_suggestions = suggestions
	
	async def _update_optimization_metrics(self):
		"""Update global optimization metrics."""
		# Performance metrics
		performance_metric = OptimizationMetric(
			optimization_type=OptimizationType.PERFORMANCE,
			current_value=self.performance_stats['average_completion_time'],
			target_value=60.0,  # Target 60 minutes average
			improvement_suggestions=[
				"Optimize slow-running tasks",
				"Increase parallelization",
				"Improve resource allocation"
			]
		)
		
		self.optimization_metrics[performance_metric.metric_id] = performance_metric
	
	async def _notify_workflow_event(self, event_type: str, instance: WorkflowInstance, additional_data: Optional[Dict[str, Any]] = None):
		"""Notify subscribers of workflow events."""
		event_data = {
			"event_type": event_type,
			"instance_id": instance.instance_id,
			"instance_name": instance.name,
			"instance_state": instance.state.value,
			"timestamp": datetime.now().isoformat()
		}
		
		if additional_data:
			event_data.update(additional_data)
		
		for callback in self.workflow_subscribers:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback(event_data)
				else:
					callback(event_data)
			except Exception as e:
				logger.error(f"Error in workflow event callback: {e}")
	
	async def cleanup(self):
		"""Clean up workflow engine resources."""
		await self.stop_engine()
		
		async with self._lock:
			self.active_instances.clear()
			self.completed_instances.clear()
			self.workflow_triggers.clear()
			self.optimization_metrics.clear()
			self.event_handlers.clear()
			self.workflow_subscribers.clear()
		
		logger.info("WorkflowEngine cleaned up")