"""
TaskScheduler - Intelligent task scheduling and queue management.

This module provides comprehensive task scheduling capabilities including
intelligent task scheduling, priority-based queue management, resource-aware 
scheduling, deadline-driven optimization, and schedule conflict resolution.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Callable, Tuple
import heapq

from pydantic import BaseModel, Field, ConfigDict
from ...core.utils import uuid7str

logger = logging.getLogger(__name__)

class SchedulingStrategy(str, Enum):
	"""Task scheduling strategies."""
	FIFO = "fifo"  # First In, First Out
	PRIORITY = "priority"  # Priority-based scheduling
	DEADLINE = "deadline"  # Deadline-driven scheduling
	RESOURCE_AWARE = "resource_aware"  # Resource availability-based
	BALANCED = "balanced"  # Balanced approach considering multiple factors
	SHORTEST_JOB_FIRST = "shortest_job_first"  # Shortest estimated duration first
	LONGEST_JOB_FIRST = "longest_job_first"  # Longest estimated duration first
	ROUND_ROBIN = "round_robin"  # Round-robin across users/groups

class ResourceType(str, Enum):
	"""Types of resources that can be allocated."""
	CPU = "cpu"
	MEMORY = "memory"
	STORAGE = "storage"
	NETWORK = "network"
	GPU = "gpu"
	USER_ATTENTION = "user_attention"
	API_QUOTA = "api_quota"
	LICENSE = "license"
	CUSTOM = "custom"

class TaskPriority(int, Enum):
	"""Standard task priorities."""
	CRITICAL = 1
	HIGH = 3
	NORMAL = 5
	LOW = 7
	BACKGROUND = 9

class ScheduledTask(BaseModel):
	"""A task in the scheduling queue."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	task_id: str = Field(default_factory=uuid7str)
	workflow_instance_id: str = Field(description="Parent workflow instance")
	name: str = Field(description="Task name")
	description: str = Field(description="Task description")
	task_type: str = Field(description="Type of task")
	
	# Scheduling properties
	priority: int = Field(TaskPriority.NORMAL, description="Task priority (1=highest, 10=lowest)")
	estimated_duration_minutes: Optional[int] = Field(None, description="Estimated execution time")
	deadline: Optional[datetime] = Field(None, description="Task deadline")
	earliest_start: Optional[datetime] = Field(None, description="Earliest possible start time")
	latest_start: Optional[datetime] = Field(None, description="Latest acceptable start time")
	
	# Dependencies and constraints
	depends_on: List[str] = Field(default_factory=list, description="Task IDs this depends on")
	blocks: List[str] = Field(default_factory=list, description="Task IDs this blocks")
	required_resources: Dict[ResourceType, float] = Field(default_factory=dict, description="Required resources")
	preferred_resources: Dict[ResourceType, float] = Field(default_factory=dict, description="Preferred resources")
	
	# Assignment and execution
	assigned_to: List[str] = Field(default_factory=list, description="Assigned user/executor IDs")
	executor_preferences: Dict[str, float] = Field(default_factory=dict, description="Executor preference scores")
	execution_context: Dict[str, Any] = Field(default_factory=dict, description="Execution context")
	
	# Timing and lifecycle
	created_at: datetime = Field(default_factory=datetime.now)
	scheduled_at: Optional[datetime] = None
	started_at: Optional[datetime] = None
	completed_at: Optional[datetime] = None
	
	# Metrics and optimization
	scheduling_score: float = Field(0.0, description="Calculated scheduling score")
	resource_efficiency: float = Field(0.0, description="Resource utilization efficiency")
	delay_cost: float = Field(0.0, description="Cost of delaying this task")
	
	# State tracking
	retry_count: int = Field(0)
	max_retries: int = Field(3)
	last_failure_reason: Optional[str] = None

@dataclass
class ResourcePool:
	"""Available resource pool for scheduling."""
	resource_type: ResourceType
	total_capacity: float
	available_capacity: float
	allocated_tasks: Dict[str, float] = field(default_factory=dict)  # task_id -> allocated amount
	utilization_history: List[Tuple[datetime, float]] = field(default_factory=list)
	
	def allocate(self, task_id: str, amount: float) -> bool:
		"""Allocate resources to a task."""
		if amount <= self.available_capacity:
			self.allocated_tasks[task_id] = amount
			self.available_capacity -= amount
			self.utilization_history.append((datetime.now(), self.get_utilization_percentage()))
			return True
		return False
	
	def deallocate(self, task_id: str) -> bool:
		"""Deallocate resources from a task."""
		if task_id in self.allocated_tasks:
			amount = self.allocated_tasks.pop(task_id)
			self.available_capacity += amount
			self.utilization_history.append((datetime.now(), self.get_utilization_percentage()))
			return True
		return False
	
	def get_utilization_percentage(self) -> float:
		"""Get current resource utilization percentage."""
		return ((self.total_capacity - self.available_capacity) / self.total_capacity) * 100.0

@dataclass
class SchedulingDecision:
	"""Result of a scheduling decision."""
	task_id: str
	scheduled_start_time: datetime
	assigned_executor: Optional[str]
	allocated_resources: Dict[ResourceType, float]
	scheduling_reason: str
	confidence_score: float
	alternative_schedules: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class SchedulingMetrics:
	"""Metrics for scheduler performance."""
	total_tasks_scheduled: int = 0
	average_wait_time_minutes: float = 0.0
	average_scheduling_time_ms: float = 0.0
	deadline_adherence_rate: float = 0.0
	resource_utilization_efficiency: float = 0.0
	task_throughput_per_hour: float = 0.0
	conflicts_resolved: int = 0
	optimization_runs: int = 0

class TaskScheduler:
	"""
	Intelligent task scheduling and queue management system.
	
	Provides comprehensive task scheduling with multiple strategies,
	resource-aware allocation, deadline optimization, and conflict resolution.
	"""
	
	def __init__(
		self,
		default_strategy: SchedulingStrategy = SchedulingStrategy.BALANCED,
		max_concurrent_tasks: int = 50,
		resource_optimization_enabled: bool = True
	):
		"""
		Initialize the task scheduler.
		
		Args:
			default_strategy: Default scheduling strategy
			max_concurrent_tasks: Maximum concurrent task executions
			resource_optimization_enabled: Enable resource optimization
		"""
		self.default_strategy = default_strategy
		self.max_concurrent_tasks = max_concurrent_tasks
		self.resource_optimization_enabled = resource_optimization_enabled
		
		# Task queues and management
		self.pending_tasks: List[ScheduledTask] = []
		self.running_tasks: Dict[str, ScheduledTask] = {}
		self.completed_tasks: Dict[str, ScheduledTask] = {}
		self.failed_tasks: Dict[str, ScheduledTask] = {}
		
		# Priority queue for efficient scheduling
		self.priority_queue: List[Tuple[float, str]] = []  # (negative_priority, task_id)
		
		# Resource management
		self.resource_pools: Dict[ResourceType, ResourcePool] = {}
		self.initialize_default_resources()
		
		# Executor management
		self.available_executors: Set[str] = set()
		self.executor_capabilities: Dict[str, Dict[str, float]] = {}
		self.executor_workload: Dict[str, int] = {}
		
		# Scheduling state
		self.scheduling_enabled = True
		self.scheduler_task: Optional[asyncio.Task] = None
		self.optimization_task: Optional[asyncio.Task] = None
		
		# Synchronization
		self._lock = asyncio.Lock()
		self._scheduler_running = False
		
		# Metrics and monitoring
		self.metrics = SchedulingMetrics()
		self.scheduling_history: List[SchedulingDecision] = []
		self.conflict_log: List[Dict[str, Any]] = []
		
		# Event subscribers
		self.scheduling_subscribers: List[Callable] = []
		
		logger.info(f"TaskScheduler initialized with strategy={default_strategy.value}, max_concurrent={max_concurrent_tasks}")
	
	def initialize_default_resources(self):
		"""Initialize default resource pools."""
		default_resources = {
			ResourceType.CPU: 100.0,
			ResourceType.MEMORY: 100.0,
			ResourceType.USER_ATTENTION: 10.0,
			ResourceType.API_QUOTA: 1000.0
		}
		
		for resource_type, capacity in default_resources.items():
			self.resource_pools[resource_type] = ResourcePool(
				resource_type=resource_type,
				total_capacity=capacity,
				available_capacity=capacity
			)
		
		logger.debug(f"Initialized {len(self.resource_pools)} resource pools")
	
	async def start_scheduler(self):
		"""Start the task scheduler."""
		async with self._lock:
			if self._scheduler_running:
				logger.warning("TaskScheduler is already running")
				return
			
			self._scheduler_running = True
			
			# Start scheduling loop
			self.scheduler_task = asyncio.create_task(self._scheduling_loop())
			
			# Start optimization loop
			if self.resource_optimization_enabled:
				self.optimization_task = asyncio.create_task(self._optimization_loop())
			
			logger.info("TaskScheduler started successfully")
	
	async def stop_scheduler(self):
		"""Stop the task scheduler."""
		async with self._lock:
			if not self._scheduler_running:
				return
			
			self._scheduler_running = False
			
			# Cancel background tasks
			if self.scheduler_task:
				self.scheduler_task.cancel()
				try:
					await self.scheduler_task
				except asyncio.CancelledError:
					pass
			
			if self.optimization_task:
				self.optimization_task.cancel()
				try:
					await self.optimization_task
				except asyncio.CancelledError:
					pass
			
			logger.info("TaskScheduler stopped successfully")
	
	async def submit_task(self, task: ScheduledTask) -> bool:
		"""
		Submit a task for scheduling.
		
		Args:
			task: Task to schedule
		
		Returns:
			bool: True if task was submitted successfully
		"""
		async with self._lock:
			# Validate task
			if not await self._validate_task(task):
				logger.error(f"Task validation failed for {task.task_id}")
				return False
			
			# Calculate scheduling score
			task.scheduling_score = await self._calculate_scheduling_score(task)
			
			# Add to pending queue
			self.pending_tasks.append(task)
			
			# Add to priority queue
			heapq.heappush(self.priority_queue, (-task.scheduling_score, task.task_id))
			
			# Update metrics
			self.metrics.total_tasks_scheduled += 1
			
			logger.info(f"Submitted task {task.task_id} for scheduling (score: {task.scheduling_score:.2f})")
			
			# Notify subscribers
			await self._notify_scheduling_event("task_submitted", task)
			
			return True
	
	async def cancel_task(self, task_id: str, reason: str = "Manual cancellation") -> bool:
		"""
		Cancel a scheduled or running task.
		
		Args:
			task_id: Task ID to cancel
			reason: Cancellation reason
		
		Returns:
			bool: True if task was cancelled successfully
		"""
		async with self._lock:
			# Check if task is pending
			for i, task in enumerate(self.pending_tasks):
				if task.task_id == task_id:
					# Remove from pending
					cancelled_task = self.pending_tasks.pop(i)
					
					# Clean up priority queue (will be handled in next scheduling cycle)
					
					logger.info(f"Cancelled pending task {task_id}: {reason}")
					
					# Notify subscribers
					await self._notify_scheduling_event("task_cancelled", cancelled_task, {"reason": reason})
					
					return True
			
			# Check if task is running
			if task_id in self.running_tasks:
				running_task = self.running_tasks.pop(task_id)
				
				# Deallocate resources
				await self._deallocate_task_resources(running_task)
				
				logger.info(f"Cancelled running task {task_id}: {reason}")
				
				# Notify subscribers
				await self._notify_scheduling_event("task_cancelled", running_task, {"reason": reason})
				
				return True
			
			return False
	
	async def reschedule_task(self, task_id: str, new_priority: Optional[int] = None, new_deadline: Optional[datetime] = None) -> bool:
		"""
		Reschedule a pending task with new parameters.
		
		Args:
			task_id: Task ID to reschedule
			new_priority: New task priority
			new_deadline: New task deadline
		
		Returns:
			bool: True if task was rescheduled successfully
		"""
		async with self._lock:
			# Find task in pending queue
			task = None
			for pending_task in self.pending_tasks:
				if pending_task.task_id == task_id:
					task = pending_task
					break
			
			if not task:
				logger.warning(f"Task {task_id} not found for rescheduling")
				return False
			
			# Update parameters
			if new_priority is not None:
				task.priority = new_priority
			
			if new_deadline is not None:
				task.deadline = new_deadline
			
			# Recalculate scheduling score
			task.scheduling_score = await self._calculate_scheduling_score(task)
			
			# Rebuild priority queue (simple approach - could be optimized)
			self.priority_queue = []
			for pending_task in self.pending_tasks:
				heapq.heappush(self.priority_queue, (-pending_task.scheduling_score, pending_task.task_id))
			
			logger.info(f"Rescheduled task {task_id} with new score: {task.scheduling_score:.2f}")
			
			# Notify subscribers
			await self._notify_scheduling_event("task_rescheduled", task)
			
			return True
	
	async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
		"""
		Get comprehensive status of a task.
		
		Args:
			task_id: Task ID
		
		Returns:
			Optional[Dict[str, Any]]: Task status information
		"""
		# Check all queues
		task = None
		status = "unknown"
		
		# Check pending
		for pending_task in self.pending_tasks:
			if pending_task.task_id == task_id:
				task = pending_task
				status = "pending"
				break
		
		# Check running
		if not task and task_id in self.running_tasks:
			task = self.running_tasks[task_id]
			status = "running"
		
		# Check completed
		if not task and task_id in self.completed_tasks:
			task = self.completed_tasks[task_id]
			status = "completed"
		
		# Check failed
		if not task and task_id in self.failed_tasks:
			task = self.failed_tasks[task_id]
			status = "failed"
		
		if not task:
			return None
		
		# Calculate wait time
		wait_time_minutes = 0.0
		if task.started_at and task.created_at:
			wait_time_minutes = (task.started_at - task.created_at).total_seconds() / 60
		elif status == "pending":
			wait_time_minutes = (datetime.now() - task.created_at).total_seconds() / 60
		
		# Calculate execution time
		execution_time_minutes = 0.0
		if task.completed_at and task.started_at:
			execution_time_minutes = (task.completed_at - task.started_at).total_seconds() / 60
		elif task.started_at and status == "running":
			execution_time_minutes = (datetime.now() - task.started_at).total_seconds() / 60
		
		return {
			"task_id": task.task_id,
			"name": task.name,
			"status": status,
			"priority": task.priority,
			"scheduling_score": task.scheduling_score,
			"created_at": task.created_at.isoformat(),
			"scheduled_at": task.scheduled_at.isoformat() if task.scheduled_at else None,
			"started_at": task.started_at.isoformat() if task.started_at else None,
			"completed_at": task.completed_at.isoformat() if task.completed_at else None,
			"deadline": task.deadline.isoformat() if task.deadline else None,
			"wait_time_minutes": wait_time_minutes,
			"execution_time_minutes": execution_time_minutes,
			"estimated_duration_minutes": task.estimated_duration_minutes,
			"retry_count": task.retry_count,
			"assigned_to": task.assigned_to,
			"required_resources": {rt.value: amount for rt, amount in task.required_resources.items()},
			"last_failure_reason": task.last_failure_reason
		}
	
	async def get_queue_status(self) -> Dict[str, Any]:
		"""
		Get comprehensive queue status.
		
		Returns:
			Dict[str, Any]: Queue status information
		"""
		# Resource utilization
		resource_utilization = {}
		for resource_type, pool in self.resource_pools.items():
			resource_utilization[resource_type.value] = {
				"total_capacity": pool.total_capacity,
				"available_capacity": pool.available_capacity,
				"utilization_percentage": pool.get_utilization_percentage(),
				"allocated_tasks": len(pool.allocated_tasks)
			}
		
		# Executor status
		executor_status = {}
		for executor_id in self.available_executors:
			executor_status[executor_id] = {
				"workload": self.executor_workload.get(executor_id, 0),
				"capabilities": self.executor_capabilities.get(executor_id, {})
			}
		
		return {
			"pending_tasks": len(self.pending_tasks),
			"running_tasks": len(self.running_tasks),
			"completed_tasks": len(self.completed_tasks),
			"failed_tasks": len(self.failed_tasks),
			"max_concurrent_tasks": self.max_concurrent_tasks,
			"scheduling_enabled": self.scheduling_enabled,
			"default_strategy": self.default_strategy.value,
			"resource_utilization": resource_utilization,
			"executor_status": executor_status,
			"metrics": {
				"total_tasks_scheduled": self.metrics.total_tasks_scheduled,
				"average_wait_time_minutes": self.metrics.average_wait_time_minutes,
				"deadline_adherence_rate": self.metrics.deadline_adherence_rate,
				"resource_utilization_efficiency": self.metrics.resource_utilization_efficiency,
				"task_throughput_per_hour": self.metrics.task_throughput_per_hour,
				"conflicts_resolved": self.metrics.conflicts_resolved
			}
		}
	
	async def add_executor(self, executor_id: str, capabilities: Dict[str, float]):
		"""
		Add an executor to the available pool.
		
		Args:
			executor_id: Unique executor identifier
			capabilities: Executor capabilities (e.g., skill levels)
		"""
		async with self._lock:
			self.available_executors.add(executor_id)
			self.executor_capabilities[executor_id] = capabilities
			self.executor_workload[executor_id] = 0
			
			logger.info(f"Added executor {executor_id} with capabilities: {capabilities}")
	
	async def remove_executor(self, executor_id: str):
		"""
		Remove an executor from the available pool.
		
		Args:
			executor_id: Executor identifier to remove
		"""
		async with self._lock:
			self.available_executors.discard(executor_id)
			self.executor_capabilities.pop(executor_id, None)
			self.executor_workload.pop(executor_id, None)
			
			# Reassign tasks if needed
			tasks_to_reassign = [
				task for task in self.running_tasks.values()
				if executor_id in task.assigned_to
			]
			
			for task in tasks_to_reassign:
				task.assigned_to = [e for e in task.assigned_to if e != executor_id]
				if not task.assigned_to:
					# Need to reassign
					await self._assign_executor(task)
			
			logger.info(f"Removed executor {executor_id}")
	
	async def add_resource_pool(self, resource_type: ResourceType, total_capacity: float):
		"""
		Add or update a resource pool.
		
		Args:
			resource_type: Type of resource
			total_capacity: Total resource capacity
		"""
		if resource_type in self.resource_pools:
			# Update existing pool
			pool = self.resource_pools[resource_type]
			capacity_change = total_capacity - pool.total_capacity
			pool.total_capacity = total_capacity
			pool.available_capacity += capacity_change
		else:
			# Create new pool
			self.resource_pools[resource_type] = ResourcePool(
				resource_type=resource_type,
				total_capacity=total_capacity,
				available_capacity=total_capacity
			)
		
		logger.info(f"Updated resource pool {resource_type.value} with capacity {total_capacity}")
	
	async def subscribe_to_scheduling_events(self, callback: Callable) -> str:
		"""
		Subscribe to scheduling events.
		
		Args:
			callback: Callback function for scheduling events
		
		Returns:
			str: Subscription ID
		"""
		self.scheduling_subscribers.append(callback)
		subscription_id = uuid7str()
		logger.info("New scheduling event subscription added")
		return subscription_id
	
	# Private methods
	
	async def _scheduling_loop(self):
		"""Main scheduling loop."""
		while self._scheduler_running:
			try:
				await asyncio.sleep(1)  # Schedule every second
				await self._process_scheduling_cycle()
			except Exception as e:
				logger.error(f"Error in scheduling loop: {e}")
	
	async def _optimization_loop(self):
		"""Resource optimization loop."""
		while self._scheduler_running:
			try:
				await asyncio.sleep(30)  # Optimize every 30 seconds
				await self._optimize_resource_allocation()
				await self._update_scheduling_metrics()
				self.metrics.optimization_runs += 1
			except Exception as e:
				logger.error(f"Error in optimization loop: {e}")
	
	async def _process_scheduling_cycle(self):
		"""Process one scheduling cycle."""
		async with self._lock:
			if not self.scheduling_enabled or len(self.running_tasks) >= self.max_concurrent_tasks:
				return
			
			# Clean up priority queue
			self._cleanup_priority_queue()
			
			# Get next tasks to schedule
			available_slots = self.max_concurrent_tasks - len(self.running_tasks)
			scheduled_count = 0
			
			while (scheduled_count < available_slots and 
				   self.priority_queue and 
				   len(self.pending_tasks) > 0):
				
				# Get highest priority task
				_, task_id = heapq.heappop(self.priority_queue)
				
				# Find task in pending queue
				task = None
				task_index = None
				for i, pending_task in enumerate(self.pending_tasks):
					if pending_task.task_id == task_id:
						task = pending_task
						task_index = i
						break
				
				if not task:
					continue  # Task might have been cancelled
				
				# Check if task can be scheduled
				if await self._can_schedule_task(task):
					# Make scheduling decision
					decision = await self._make_scheduling_decision(task)
					
					if decision:
						# Execute scheduling decision
						await self._execute_scheduling_decision(task, decision)
						
						# Remove from pending
						self.pending_tasks.pop(task_index)
						scheduled_count += 1
						
						logger.debug(f"Scheduled task {task_id} using {decision.scheduling_reason}")
			
			# Update metrics
			if scheduled_count > 0:
				logger.info(f"Scheduled {scheduled_count} tasks in this cycle")
	
	async def _can_schedule_task(self, task: ScheduledTask) -> bool:
		"""Check if a task can be scheduled now."""
		# Check dependencies
		for dep_task_id in task.depends_on:
			if dep_task_id not in self.completed_tasks:
				return False
		
		# Check earliest start time
		if task.earliest_start and datetime.now() < task.earliest_start:
			return False
		
		# Check resource availability
		for resource_type, required_amount in task.required_resources.items():
			if resource_type not in self.resource_pools:
				return False
			
			pool = self.resource_pools[resource_type]
			if pool.available_capacity < required_amount:
				return False
		
		# Check executor availability
		if task.assigned_to:
			available_executors = [
				executor_id for executor_id in task.assigned_to
				if executor_id in self.available_executors
			]
			if not available_executors:
				return False
		
		return True
	
	async def _make_scheduling_decision(self, task: ScheduledTask) -> Optional[SchedulingDecision]:
		"""Make a scheduling decision for a task."""
		start_time = datetime.now()
		
		# Assign executor if not already assigned
		if not task.assigned_to:
			await self._assign_executor(task)
		
		if not task.assigned_to:
			return None  # No available executor
		
		# Choose executor from assigned list
		best_executor = await self._choose_best_executor(task)
		
		# Allocate resources
		allocated_resources = {}
		for resource_type, required_amount in task.required_resources.items():
			pool = self.resource_pools[resource_type]
			if pool.allocate(task.task_id, required_amount):
				allocated_resources[resource_type] = required_amount
			else:
				# Rollback allocations
				for allocated_resource_type in allocated_resources:
					self.resource_pools[allocated_resource_type].deallocate(task.task_id)
				return None
		
		# Calculate confidence score
		confidence_score = await self._calculate_confidence_score(task, best_executor, allocated_resources)
		
		return SchedulingDecision(
			task_id=task.task_id,
			scheduled_start_time=start_time,
			assigned_executor=best_executor,
			allocated_resources=allocated_resources,
			scheduling_reason=f"Scheduled using {self.default_strategy.value} strategy",
			confidence_score=confidence_score
		)
	
	async def _execute_scheduling_decision(self, task: ScheduledTask, decision: SchedulingDecision):
		"""Execute a scheduling decision."""
		# Update task state
		task.scheduled_at = decision.scheduled_start_time
		task.started_at = datetime.now()
		
		# Move to running tasks
		self.running_tasks[task.task_id] = task
		
		# Update executor workload
		if decision.assigned_executor:
			self.executor_workload[decision.assigned_executor] = (
				self.executor_workload.get(decision.assigned_executor, 0) + 1
			)
		
		# Record decision
		self.scheduling_history.append(decision)
		
		# Keep only last 1000 decisions
		if len(self.scheduling_history) > 1000:
			self.scheduling_history = self.scheduling_history[-1000:]
		
		# Notify subscribers
		await self._notify_scheduling_event("task_scheduled", task, {"decision": decision})
	
	async def _assign_executor(self, task: ScheduledTask):
		"""Assign an executor to a task."""
		if not self.available_executors:
			return
		
		# Score each executor
		executor_scores = {}
		for executor_id in self.available_executors:
			score = await self._calculate_executor_score(task, executor_id)
			executor_scores[executor_id] = score
		
		# Choose best executor(s)
		sorted_executors = sorted(executor_scores.items(), key=lambda x: x[1], reverse=True)
		
		# For now, assign single best executor
		if sorted_executors:
			best_executor = sorted_executors[0][0]
			task.assigned_to = [best_executor]
			logger.debug(f"Assigned executor {best_executor} to task {task.task_id}")
	
	async def _choose_best_executor(self, task: ScheduledTask) -> Optional[str]:
		"""Choose the best executor from assigned list."""
		if not task.assigned_to:
			return None
		
		# For now, choose first available
		for executor_id in task.assigned_to:
			if executor_id in self.available_executors:
				return executor_id
		
		return None
	
	async def _calculate_executor_score(self, task: ScheduledTask, executor_id: str) -> float:
		"""Calculate how well an executor matches a task."""
		base_score = 1.0
		
		# Consider workload
		current_workload = self.executor_workload.get(executor_id, 0)
		workload_penalty = current_workload * 0.1
		
		# Consider capabilities
		capabilities = self.executor_capabilities.get(executor_id, {})
		capability_bonus = 0.0
		
		# Simple capability matching (could be more sophisticated)
		if task.task_type in capabilities:
			capability_bonus = capabilities[task.task_type] * 0.5
		
		return base_score - workload_penalty + capability_bonus
	
	async def _calculate_confidence_score(
		self, 
		task: ScheduledTask, 
		executor_id: Optional[str], 
		allocated_resources: Dict[ResourceType, float]
	) -> float:
		"""Calculate confidence in scheduling decision."""
		base_confidence = 0.8
		
		# Factor in resource availability
		resource_confidence = 1.0
		for resource_type, allocated in allocated_resources.items():
			pool = self.resource_pools[resource_type]
			utilization = (pool.total_capacity - pool.available_capacity) / pool.total_capacity
			if utilization > 0.8:  # High utilization reduces confidence
				resource_confidence *= (1.0 - utilization * 0.3)
		
		# Factor in executor match
		executor_confidence = 1.0
		if executor_id:
			executor_score = await self._calculate_executor_score(task, executor_id)
			executor_confidence = min(executor_score, 1.0)
		
		# Factor in deadline pressure
		deadline_confidence = 1.0
		if task.deadline:
			time_to_deadline = (task.deadline - datetime.now(timezone.utc)).total_seconds() / 3600  # hours
			if task.estimated_duration_minutes:
				required_hours = task.estimated_duration_minutes / 60
				if time_to_deadline < required_hours * 1.5:  # Tight deadline
					deadline_confidence = max(0.3, time_to_deadline / (required_hours * 1.5))
		
		return base_confidence * resource_confidence * executor_confidence * deadline_confidence
	
	async def _calculate_scheduling_score(self, task: ScheduledTask) -> float:
		"""Calculate scheduling score for a task."""
		score = 10.0 - task.priority  # Higher priority = higher score
		
		# Add deadline urgency
		if task.deadline:
			time_to_deadline = (task.deadline - datetime.now(timezone.utc)).total_seconds() / 3600  # hours
			if time_to_deadline < 24:  # Within 24 hours
				score += (24 - time_to_deadline) / 24 * 5  # Up to 5 bonus points
		
		# Add duration preference (shorter tasks get slight bonus)
		if task.estimated_duration_minutes:
			if task.estimated_duration_minutes <= 30:  # Short tasks
				score += 1.0
			elif task.estimated_duration_minutes >= 240:  # Long tasks
				score -= 1.0
		
		# Add dependency bonus (tasks that unblock others)
		if len(task.blocks) > 0:
			score += len(task.blocks) * 0.5
		
		return max(0.1, score)  # Ensure positive score
	
	async def _validate_task(self, task: ScheduledTask) -> bool:
		"""Validate a task before scheduling."""
		# Basic validation
		if not task.name or not task.task_id:
			return False
		
		# Check resource requirements are reasonable
		for resource_type, amount in task.required_resources.items():
			if amount <= 0:
				return False
			
			if resource_type in self.resource_pools:
				pool = self.resource_pools[resource_type]
				if amount > pool.total_capacity:
					logger.warning(f"Task {task.task_id} requires more {resource_type.value} than available")
					return False
		
		# Check deadline is in future
		if task.deadline and task.deadline <= datetime.now(timezone.utc):
			logger.warning(f"Task {task.task_id} has deadline in the past")
			return False
		
		return True
	
	async def _deallocate_task_resources(self, task: ScheduledTask):
		"""Deallocate resources from a completed/cancelled task."""
		for resource_type in task.required_resources:
			if resource_type in self.resource_pools:
				self.resource_pools[resource_type].deallocate(task.task_id)
	
	def _cleanup_priority_queue(self):
		"""Clean up priority queue by removing cancelled tasks."""
		# Simple approach: rebuild queue (could be optimized)
		valid_task_ids = {task.task_id for task in self.pending_tasks}
		
		new_queue = []
		for priority, task_id in self.priority_queue:
			if task_id in valid_task_ids:
				new_queue.append((priority, task_id))
		
		self.priority_queue = new_queue
		heapq.heapify(self.priority_queue)
	
	async def _optimize_resource_allocation(self):
		"""Optimize resource allocation across running tasks."""
		if not self.resource_optimization_enabled:
			return
		
		# Analyze resource utilization patterns
		underutilized_resources = []
		overutilized_resources = []
		
		for resource_type, pool in self.resource_pools.items():
			utilization = pool.get_utilization_percentage()
			
			if utilization < 30:  # Underutilized
				underutilized_resources.append(resource_type)
			elif utilization > 85:  # Overutilized
				overutilized_resources.append(resource_type)
		
		# Log optimization opportunities
		if underutilized_resources:
			logger.debug(f"Underutilized resources: {[r.value for r in underutilized_resources]}")
		
		if overutilized_resources:
			logger.debug(f"Overutilized resources: {[r.value for r in overutilized_resources]}")
	
	async def _update_scheduling_metrics(self):
		"""Update scheduling performance metrics."""
		if not self.completed_tasks:
			return
		
		# Calculate average wait time
		total_wait_time = 0.0
		completed_with_wait_time = 0
		
		for task in self.completed_tasks.values():
			if task.started_at and task.created_at:
				wait_time = (task.started_at - task.created_at).total_seconds() / 60
				total_wait_time += wait_time
				completed_with_wait_time += 1
		
		if completed_with_wait_time > 0:
			self.metrics.average_wait_time_minutes = total_wait_time / completed_with_wait_time
		
		# Calculate deadline adherence rate
		tasks_with_deadlines = [
			task for task in self.completed_tasks.values()
			if task.deadline
		]
		
		if tasks_with_deadlines:
			on_time_tasks = [
				task for task in tasks_with_deadlines
				if task.completed_at and task.completed_at <= task.deadline
			]
			self.metrics.deadline_adherence_rate = len(on_time_tasks) / len(tasks_with_deadlines) * 100.0
		
		# Calculate resource utilization efficiency
		total_efficiency = 0.0
		resource_count = 0
		
		for pool in self.resource_pools.values():
			if pool.total_capacity > 0:
				efficiency = (pool.total_capacity - pool.available_capacity) / pool.total_capacity
				total_efficiency += efficiency
				resource_count += 1
		
		if resource_count > 0:
			self.metrics.resource_utilization_efficiency = (total_efficiency / resource_count) * 100.0
		
		# Calculate task throughput
		completed_count = len(self.completed_tasks)
		if completed_count > 0:
			# Estimate based on recent completions (simplified)
			self.metrics.task_throughput_per_hour = completed_count / max(1, completed_count / 10)
	
	async def _notify_scheduling_event(self, event_type: str, task: ScheduledTask, additional_data: Optional[Dict[str, Any]] = None):
		"""Notify subscribers of scheduling events."""
		event_data = {
			"event_type": event_type,
			"task_id": task.task_id,
			"task_name": task.name,
			"workflow_instance_id": task.workflow_instance_id,
			"timestamp": datetime.now().isoformat()
		}
		
		if additional_data:
			event_data.update(additional_data)
		
		for callback in self.scheduling_subscribers:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback(event_data)
				else:
					callback(event_data)
			except Exception as e:
				logger.error(f"Error in scheduling event callback: {e}")
	
	async def cleanup(self):
		"""Clean up scheduler resources."""
		await self.stop_scheduler()
		
		# Deallocate all resources
		for task in self.running_tasks.values():
			await self._deallocate_task_resources(task)
		
		# Clear all data
		self.pending_tasks.clear()
		self.running_tasks.clear()
		self.completed_tasks.clear()
		self.failed_tasks.clear()
		self.priority_queue.clear()
		self.scheduling_history.clear()
		self.conflict_log.clear()
		self.scheduling_subscribers.clear()
		
		logger.info("TaskScheduler cleaned up")