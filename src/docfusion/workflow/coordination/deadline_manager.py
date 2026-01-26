"""
DeadlineManager - Deadline tracking and critical path analysis.

This module provides comprehensive deadline management including deadline
tracking and alerts, critical path analysis, schedule optimization,
buffer time management, and escalation procedures.
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Callable
from collections import defaultdict, deque
import json
import heapq

from pydantic import BaseModel, Field, ConfigDict

def uuid7str():
	"""Generate a UUID7-like string using UUID4 for compatibility."""
	return str(uuid.uuid4())


logger = logging.getLogger(__name__)


class AlertSeverity(str, Enum):
	"""Alert severity levels."""
	INFO = "info"
	WARNING = "warning"
	CRITICAL = "critical"
	URGENT = "urgent"


class EscalationLevel(str, Enum):
	"""Escalation levels."""
	NONE = "none"
	SUPERVISOR = "supervisor"
	MANAGER = "manager"
	EXECUTIVE = "executive"
	EMERGENCY = "emergency"


class BufferStrategy(str, Enum):
	"""Buffer time management strategies."""
	FIXED_PERCENTAGE = "fixed_percentage"
	RISK_BASED = "risk_based"
	HISTORICAL = "historical"
	DYNAMIC = "dynamic"
	MONTE_CARLO = "monte_carlo"


class DeadlineAlert(BaseModel):
	"""Deadline alert notification."""
	model_config = ConfigDict(extra='forbid')
	
	alert_id: str = Field(default_factory=uuid7str)
	task_id: str = Field(description="Task identifier")
	workflow_instance_id: str = Field(description="Workflow instance ID")
	alert_type: str = Field(description="Type of alert")
	severity: AlertSeverity = Field(description="Alert severity")
	
	# Alert details
	message: str = Field(description="Alert message")
	deadline: datetime = Field(description="Task deadline")
	estimated_completion: Optional[datetime] = Field(None, description="Estimated completion time")
	time_remaining_hours: float = Field(description="Hours remaining until deadline")
	delay_risk_percentage: float = Field(description="Risk of missing deadline (0-100)")
	
	# Affected parties
	assigned_users: List[str] = Field(default_factory=list, description="Users assigned to task")
	stakeholders: List[str] = Field(default_factory=list, description="Stakeholders to notify")
	escalation_level: EscalationLevel = Field(EscalationLevel.NONE)
	
	# Timing
	created_at: datetime = Field(default_factory=datetime.now)
	triggered_at: Optional[datetime] = None
	acknowledged_at: Optional[datetime] = None
	resolved_at: Optional[datetime] = None
	
	# Actions and responses
	suggested_actions: List[str] = Field(default_factory=list)
	escalation_actions: List[str] = Field(default_factory=list)
	dependencies_blocking: List[str] = Field(default_factory=list)
	
	# Status tracking
	is_acknowledged: bool = Field(False)
	is_resolved: bool = Field(False)
	notification_sent: bool = Field(False)


class CriticalPathNode(BaseModel):
	"""Node in critical path analysis."""
	model_config = ConfigDict(extra='forbid')
	
	task_id: str = Field(description="Task identifier")
	task_name: str = Field(description="Task name")
	estimated_duration_hours: float = Field(description="Estimated duration")
	earliest_start: datetime = Field(description="Earliest possible start time")
	latest_start: datetime = Field(description="Latest allowable start time")
	earliest_finish: datetime = Field(description="Earliest possible finish time")
	latest_finish: datetime = Field(description="Latest allowable finish time")
	
	# Critical path properties
	total_float: float = Field(description="Total float time in hours")
	free_float: float = Field(description="Free float time in hours")
	is_critical: bool = Field(description="Whether task is on critical path")
	criticality_index: float = Field(description="Criticality score (0-1)")
	
	# Dependencies
	predecessors: List[str] = Field(default_factory=list, description="Predecessor task IDs")
	successors: List[str] = Field(default_factory=list, description="Successor task IDs")
	
	# Risk factors
	risk_factors: Dict[str, float] = Field(default_factory=dict, description="Risk assessment")
	buffer_time_hours: float = Field(0.0, description="Buffer time allocated")
	confidence_level: float = Field(description="Confidence in duration estimate")


class CriticalPath(BaseModel):
	"""Complete critical path analysis."""
	model_config = ConfigDict(extra='forbid')
	
	analysis_id: str = Field(default_factory=uuid7str)
	workflow_instance_id: str = Field(description="Workflow instance ID")
	
	# Path details
	critical_path_tasks: List[str] = Field(description="Task IDs on critical path")
	total_duration_hours: float = Field(description="Total critical path duration")
	project_start: datetime = Field(description="Project start time")
	project_deadline: datetime = Field(description="Project deadline")
	estimated_completion: datetime = Field(description="Estimated completion based on critical path")
	
	# Analysis results
	schedule_risk: float = Field(description="Overall schedule risk (0-1)")
	buffer_available_hours: float = Field(description="Available buffer time")
	critical_tasks_count: int = Field(description="Number of critical tasks")
	near_critical_tasks: List[str] = Field(default_factory=list, description="Near-critical task IDs")
	
	# Path nodes
	path_nodes: Dict[str, CriticalPathNode] = Field(default_factory=dict, description="All task nodes")
	
	# Recommendations
	optimization_suggestions: List[str] = Field(default_factory=list)
	risk_mitigation_actions: List[str] = Field(default_factory=list)
	resource_reallocation_suggestions: List[str] = Field(default_factory=list)
	
	# Analysis metadata
	calculated_at: datetime = Field(default_factory=datetime.now)
	calculation_method: str = Field("CPM", description="Calculation method used")
	confidence_score: float = Field(description="Confidence in analysis accuracy")


@dataclass
class EscalationRule:
	"""Rule for escalating deadline issues."""
	rule_id: str = field(default_factory=uuid7str)
	trigger_condition: str = ""  # e.g., "deadline_risk > 0.8"
	escalation_level: EscalationLevel = EscalationLevel.SUPERVISOR
	escalation_targets: List[str] = field(default_factory=list)  # User IDs to escalate to
	escalation_message_template: str = ""
	delay_before_escalation_minutes: int = 60
	auto_escalate: bool = True
	is_active: bool = True


@dataclass
class ScheduleOptimization:
	"""Schedule optimization result."""
	optimization_id: str = field(default_factory=uuid7str)
	original_completion: datetime = field(default_factory=datetime.now)
	optimized_completion: datetime = field(default_factory=datetime.now)
	time_saved_hours: float = 0.0
	optimization_actions: List[str] = field(default_factory=list)
	resource_changes: Dict[str, Any] = field(default_factory=dict)
	confidence_score: float = 0.0
	implementation_cost: float = 0.0


class DeadlineManager:
	"""
	Comprehensive deadline management and critical path analysis system.
	
	Provides deadline tracking and alerts, critical path analysis,
	schedule optimization, buffer time management, and escalation procedures.
	"""
	
	def __init__(
		self,
		default_buffer_percentage: float = 0.2,
		enable_auto_escalation: bool = True,
		critical_path_update_interval: int = 300  # 5 minutes
	):
		"""
		Initialize the deadline manager.
		
		Args:
			default_buffer_percentage: Default buffer time as percentage of duration
			enable_auto_escalation: Enable automatic escalation
			critical_path_update_interval: Interval for critical path updates (seconds)
		"""
		self.default_buffer_percentage = default_buffer_percentage
		self.enable_auto_escalation = enable_auto_escalation
		self.critical_path_update_interval = critical_path_update_interval
		
		# Core data structures
		self.active_alerts: Dict[str, DeadlineAlert] = {}
		self.resolved_alerts: Dict[str, DeadlineAlert] = {}
		self.critical_paths: Dict[str, CriticalPath] = {}  # workflow_id -> critical_path
		self.escalation_rules: Dict[str, EscalationRule] = {}
		
		# Task and deadline tracking
		self.task_deadlines: Dict[str, datetime] = {}  # task_id -> deadline
		self.task_estimations: Dict[str, float] = {}  # task_id -> estimated_hours
		self.task_dependencies: Dict[str, List[str]] = {}  # task_id -> dependency_list
		self.task_progress: Dict[str, float] = {}  # task_id -> progress_percentage
		
		# Buffer and risk management
		self.buffer_allocations: Dict[str, float] = {}  # task_id -> buffer_hours
		self.risk_assessments: Dict[str, Dict[str, float]] = {}  # task_id -> risk_factors
		self.historical_performance: Dict[str, List[float]] = defaultdict(list)  # task_type -> durations
		
		# Optimization and scheduling
		self.schedule_optimizations: List[ScheduleOptimization] = []
		self.optimization_suggestions: Dict[str, List[str]] = defaultdict(list)
		
		# Event handling and notifications
		self.deadline_subscribers: List[Callable] = []
		self.escalation_subscribers: List[Callable] = []
		
		# Background tasks
		self.monitoring_task: Optional[asyncio.Task] = None
		self.critical_path_task: Optional[asyncio.Task] = None
		self.escalation_task: Optional[asyncio.Task] = None
		
		# Synchronization
		self._lock = asyncio.Lock()
		self._manager_running = False
		
		# Performance metrics
		self.performance_metrics = {
			'alerts_triggered': 0,
			'deadlines_met': 0,
			'deadlines_missed': 0,
			'escalations_triggered': 0,
			'critical_paths_calculated': 0,
			'optimizations_performed': 0
		}
		
		logger.info(f"DeadlineManager initialized with buffer={default_buffer_percentage*100}%")
	
	async def start_manager(self):
		"""Start the deadline manager."""
		async with self._lock:
			if self._manager_running:
				logger.warning("DeadlineManager is already running")
				return
			
			self._manager_running = True
			
			# Start background tasks
			self.monitoring_task = asyncio.create_task(self._deadline_monitoring_loop())
			self.critical_path_task = asyncio.create_task(self._critical_path_update_loop())
			
			if self.enable_auto_escalation:
				self.escalation_task = asyncio.create_task(self._escalation_loop())
			
			logger.info("DeadlineManager started successfully")
	
	async def stop_manager(self):
		"""Stop the deadline manager."""
		async with self._lock:
			if not self._manager_running:
				return
			
			self._manager_running = False
			
			# Cancel background tasks
			tasks = [self.monitoring_task, self.critical_path_task, self.escalation_task]
			for task in tasks:
				if task:
					task.cancel()
					try:
						await task
					except asyncio.CancelledError:
						pass
			
			logger.info("DeadlineManager stopped successfully")
	
	async def register_task_deadline(
		self,
		task_id: str,
		deadline: datetime,
		estimated_duration_hours: float,
		dependencies: Optional[List[str]] = None,
		buffer_strategy: BufferStrategy = BufferStrategy.FIXED_PERCENTAGE,
		risk_factors: Optional[Dict[str, float]] = None
	):
		"""
		Register a task with deadline tracking.
		
		Args:
			task_id: Unique task identifier
			deadline: Task deadline
			estimated_duration_hours: Estimated task duration
			dependencies: List of dependent task IDs
			buffer_strategy: Buffer calculation strategy
			risk_factors: Risk assessment factors
		"""
		async with self._lock:
			self.task_deadlines[task_id] = deadline
			self.task_estimations[task_id] = estimated_duration_hours
			self.task_dependencies[task_id] = dependencies or []
			self.task_progress[task_id] = 0.0
			
			# Calculate buffer time
			buffer_hours = await self._calculate_buffer_time(
				estimated_duration_hours, buffer_strategy, risk_factors or {}
			)
			self.buffer_allocations[task_id] = buffer_hours
			
			# Store risk factors
			self.risk_assessments[task_id] = risk_factors or {}
			
			logger.info(f"Registered task {task_id} with deadline {deadline.isoformat()}, buffer: {buffer_hours:.1f}h")
	
	async def update_task_progress(self, task_id: str, progress_percentage: float):
		"""
		Update task progress for deadline tracking.
		
		Args:
			task_id: Task identifier
			progress_percentage: Current progress (0-100)
		"""
		async with self._lock:
			if task_id not in self.task_deadlines:
				logger.warning(f"Task {task_id} not registered for deadline tracking")
				return
			
			old_progress = self.task_progress.get(task_id, 0.0)
			self.task_progress[task_id] = min(100.0, max(0.0, progress_percentage))
			
			# Check if progress update affects deadline risk
			if progress_percentage > old_progress:
				await self._assess_deadline_risk(task_id)
			
			logger.debug(f"Updated task {task_id} progress to {progress_percentage}%")
	
	async def calculate_critical_path(
		self,
		workflow_instance_id: str,
		task_network: Dict[str, Dict[str, Any]],
		project_deadline: datetime
	) -> CriticalPath:
		"""
		Calculate critical path for a workflow.
		
		Args:
			workflow_instance_id: Workflow instance identifier
			task_network: Network of tasks with dependencies
			project_deadline: Overall project deadline
		
		Returns:
			CriticalPath: Critical path analysis results
		"""
		async with self._lock:
			logger.info(f"Calculating critical path for workflow {workflow_instance_id}")
			
			# Initialize nodes
			nodes = {}
			for task_id, task_data in task_network.items():
				duration = task_data.get('estimated_duration_hours', 0.0)
				dependencies = task_data.get('dependencies', [])
				
				node = CriticalPathNode(
					task_id=task_id,
					task_name=task_data.get('name', task_id),
					estimated_duration_hours=duration,
					earliest_start=datetime.now(),
					latest_start=datetime.now(),
					earliest_finish=datetime.now(),
					latest_finish=datetime.now(),
					total_float=0.0,
					free_float=0.0,
					is_critical=False,
					criticality_index=0.0,
					predecessors=dependencies,
					successors=[],
					confidence_level=task_data.get('confidence', 0.8)
				)
				
				nodes[task_id] = node
			
			# Build successor relationships
			for task_id, node in nodes.items():
				for pred_id in node.predecessors:
					if pred_id in nodes:
						nodes[pred_id].successors.append(task_id)
			
			# Forward pass - calculate earliest times
			await self._forward_pass(nodes, datetime.now())
			
			# Backward pass - calculate latest times
			await self._backward_pass(nodes, project_deadline)
			
			# Calculate float and identify critical path
			critical_tasks = await self._calculate_float_and_critical_path(nodes)
			
			# Calculate project metrics
			project_start = min(node.earliest_start for node in nodes.values())
			estimated_completion = max(node.earliest_finish for node in nodes.values())
			total_duration = (estimated_completion - project_start).total_seconds() / 3600
			
			# Calculate schedule risk
			schedule_risk = await self._calculate_schedule_risk(nodes, project_deadline, estimated_completion)
			
			# Calculate available buffer
			if project_deadline > estimated_completion:
				buffer_hours = (project_deadline - estimated_completion).total_seconds() / 3600
			else:
				buffer_hours = 0.0
			
			# Find near-critical tasks (low float)
			near_critical_tasks = [
				task_id for task_id, node in nodes.items()
				if not node.is_critical and node.total_float <= 8.0  # Within 8 hours
			]
			
			# Generate optimization suggestions
			optimization_suggestions = await self._generate_optimization_suggestions(nodes, critical_tasks)
			risk_mitigation_actions = await self._generate_risk_mitigation_actions(nodes, schedule_risk)
			
			# Create critical path analysis
			critical_path = CriticalPath(
				workflow_instance_id=workflow_instance_id,
				critical_path_tasks=critical_tasks,
				total_duration_hours=total_duration,
				project_start=project_start,
				project_deadline=project_deadline,
				estimated_completion=estimated_completion,
				schedule_risk=schedule_risk,
				buffer_available_hours=buffer_hours,
				critical_tasks_count=len(critical_tasks),
				near_critical_tasks=near_critical_tasks,
				path_nodes=nodes,
				optimization_suggestions=optimization_suggestions,
				risk_mitigation_actions=risk_mitigation_actions,
				confidence_score=await self._calculate_analysis_confidence(nodes)
			)
			
			# Store analysis
			self.critical_paths[workflow_instance_id] = critical_path
			self.performance_metrics['critical_paths_calculated'] += 1
			
			logger.info(f"Critical path calculated: {len(critical_tasks)} critical tasks, risk: {schedule_risk:.2f}")
			
			return critical_path
	
	async def create_deadline_alert(
		self,
		task_id: str,
		workflow_instance_id: str,
		alert_type: str,
		severity: AlertSeverity,
		message: str,
		assigned_users: List[str],
		stakeholders: Optional[List[str]] = None
	) -> DeadlineAlert:
		"""
		Create a deadline alert.
		
		Args:
			task_id: Task identifier
			workflow_instance_id: Workflow instance ID
			alert_type: Type of alert
			severity: Alert severity
			message: Alert message
			assigned_users: Users assigned to task
			stakeholders: Stakeholders to notify
		
		Returns:
			DeadlineAlert: Created alert
		"""
		async with self._lock:
			if task_id not in self.task_deadlines:
				raise ValueError(f"Task {task_id} not registered for deadline tracking")
			
			deadline = self.task_deadlines[task_id]
			time_remaining = (deadline - datetime.now()).total_seconds() / 3600
			delay_risk = await self._calculate_delay_risk(task_id)
			
			# Estimate completion time
			progress = self.task_progress.get(task_id, 0.0)
			estimated_duration = self.task_estimations.get(task_id, 0.0)
			
			if progress > 0:
				remaining_work = (100.0 - progress) / 100.0 * estimated_duration
				estimated_completion = datetime.now() + timedelta(hours=remaining_work)
			else:
				estimated_completion = datetime.now() + timedelta(hours=estimated_duration)
			
			# Generate suggested actions
			suggested_actions = await self._generate_alert_actions(task_id, severity, delay_risk)
			
			# Determine escalation level
			escalation_level = await self._determine_escalation_level(severity, delay_risk, time_remaining)
			
			alert = DeadlineAlert(
				task_id=task_id,
				workflow_instance_id=workflow_instance_id,
				alert_type=alert_type,
				severity=severity,
				message=message,
				deadline=deadline,
				estimated_completion=estimated_completion,
				time_remaining_hours=time_remaining,
				delay_risk_percentage=delay_risk * 100,
				assigned_users=assigned_users,
				stakeholders=stakeholders or [],
				escalation_level=escalation_level,
				suggested_actions=suggested_actions,
				triggered_at=datetime.now()
			)
			
			# Store alert
			self.active_alerts[alert.alert_id] = alert
			self.performance_metrics['alerts_triggered'] += 1
			
			logger.warning(f"Created {severity.value} alert for task {task_id}: {message}")
			
			# Notify subscribers
			await self._notify_deadline_event("alert_created", alert)
			
			return alert
	
	async def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
		"""
		Acknowledge a deadline alert.
		
		Args:
			alert_id: Alert identifier
			acknowledged_by: User acknowledging the alert
		
		Returns:
			bool: True if acknowledged successfully
		"""
		async with self._lock:
			if alert_id not in self.active_alerts:
				return False
			
			alert = self.active_alerts[alert_id]
			alert.is_acknowledged = True
			alert.acknowledged_at = datetime.now()
			
			logger.info(f"Alert {alert_id} acknowledged by {acknowledged_by}")
			
			# Notify subscribers
			await self._notify_deadline_event("alert_acknowledged", alert, {"acknowledged_by": acknowledged_by})
			
			return True
	
	async def resolve_alert(self, alert_id: str, resolved_by: str, resolution_notes: Optional[str] = None) -> bool:
		"""
		Resolve a deadline alert.
		
		Args:
			alert_id: Alert identifier
			resolved_by: User resolving the alert
			resolution_notes: Optional resolution notes
		
		Returns:
			bool: True if resolved successfully
		"""
		async with self._lock:
			if alert_id not in self.active_alerts:
				return False
			
			alert = self.active_alerts.pop(alert_id)
			alert.is_resolved = True
			alert.resolved_at = datetime.now()
			
			# Store in resolved alerts
			self.resolved_alerts[alert_id] = alert
			
			logger.info(f"Alert {alert_id} resolved by {resolved_by}")
			
			# Notify subscribers
			await self._notify_deadline_event("alert_resolved", alert, {
				"resolved_by": resolved_by,
				"resolution_notes": resolution_notes
			})
			
			return True
	
	async def add_escalation_rule(
		self,
		trigger_condition: str,
		escalation_level: EscalationLevel,
		escalation_targets: List[str],
		message_template: str,
		delay_minutes: int = 60
	) -> str:
		"""
		Add an escalation rule.
		
		Args:
			trigger_condition: Condition that triggers escalation
			escalation_level: Level of escalation
			escalation_targets: User IDs to escalate to
			message_template: Message template for escalation
			delay_minutes: Delay before escalation
		
		Returns:
			str: Rule ID
		"""
		rule = EscalationRule(
			trigger_condition=trigger_condition,
			escalation_level=escalation_level,
			escalation_targets=escalation_targets,
			escalation_message_template=message_template,
			delay_before_escalation_minutes=delay_minutes
		)
		
		self.escalation_rules[rule.rule_id] = rule
		
		logger.info(f"Added escalation rule: {trigger_condition} -> {escalation_level.value}")
		
		return rule.rule_id
	
	async def optimize_schedule(
		self,
		workflow_instance_id: str,
		optimization_goals: List[str],
		constraints: Dict[str, Any]
	) -> Optional[ScheduleOptimization]:
		"""
		Perform schedule optimization.
		
		Args:
			workflow_instance_id: Workflow to optimize
			optimization_goals: Goals for optimization
			constraints: Optimization constraints
		
		Returns:
			Optional[ScheduleOptimization]: Optimization results
		"""
		if workflow_instance_id not in self.critical_paths:
			logger.warning(f"No critical path found for workflow {workflow_instance_id}")
			return None
		
		critical_path = self.critical_paths[workflow_instance_id]
		original_completion = critical_path.estimated_completion
		
		# Perform optimization analysis
		optimization_actions = []
		time_saved_hours = 0.0
		
		# Identify optimization opportunities
		for suggestion in critical_path.optimization_suggestions:
			if "parallel" in suggestion.lower():
				# Parallelization opportunity
				optimization_actions.append(suggestion)
				time_saved_hours += 4.0  # Estimated time savings
			elif "resource" in suggestion.lower():
				# Resource reallocation opportunity
				optimization_actions.append(suggestion)
				time_saved_hours += 2.0
		
		if not optimization_actions:
			logger.info(f"No optimization opportunities found for workflow {workflow_instance_id}")
			return None
		
		# Calculate optimized completion time
		optimized_completion = original_completion - timedelta(hours=time_saved_hours)
		
		# Create optimization result
		optimization = ScheduleOptimization(
			original_completion=original_completion,
			optimized_completion=optimized_completion,
			time_saved_hours=time_saved_hours,
			optimization_actions=optimization_actions,
			confidence_score=0.8,  # Estimated confidence
			implementation_cost=time_saved_hours * 100  # Estimated cost per hour
		)
		
		self.schedule_optimizations.append(optimization)
		self.performance_metrics['optimizations_performed'] += 1
		
		logger.info(f"Schedule optimization completed: {time_saved_hours:.1f} hours saved")
		
		return optimization
	
	async def get_deadline_status(self, task_id: Optional[str] = None) -> Dict[str, Any]:
		"""
		Get comprehensive deadline status.
		
		Args:
			task_id: Specific task ID, or None for all tasks
		
		Returns:
			Dict[str, Any]: Deadline status information
		"""
		if task_id:
			task_ids = [task_id] if task_id in self.task_deadlines else []
		else:
			task_ids = list(self.task_deadlines.keys())
		
		status_info = {
			"tasks": {},
			"summary": {
				"total_tasks": len(task_ids),
				"on_track": 0,
				"at_risk": 0,
				"overdue": 0,
				"active_alerts": len(self.active_alerts)
			}
		}
		
		current_time = datetime.now()
		
		for tid in task_ids:
			deadline = self.task_deadlines[tid]
			progress = self.task_progress.get(tid, 0.0)
			estimated_hours = self.task_estimations.get(tid, 0.0)
			buffer_hours = self.buffer_allocations.get(tid, 0.0)
			
			# Calculate status
			time_remaining = (deadline - current_time).total_seconds() / 3600
			
			if progress >= 100.0:
				task_status = "completed"
			elif time_remaining < 0:
				task_status = "overdue"
				status_info["summary"]["overdue"] += 1
			elif time_remaining < buffer_hours:
				task_status = "at_risk"
				status_info["summary"]["at_risk"] += 1
			else:
				task_status = "on_track"
				status_info["summary"]["on_track"] += 1
			
			# Calculate estimated completion
			if progress > 0 and progress < 100:
				remaining_work = (100.0 - progress) / 100.0 * estimated_hours
				estimated_completion = current_time + timedelta(hours=remaining_work)
			else:
				estimated_completion = None
			
			status_info["tasks"][tid] = {
				"deadline": deadline.isoformat(),
				"progress": progress,
				"status": task_status,
				"time_remaining_hours": time_remaining,
				"buffer_hours": buffer_hours,
				"estimated_completion": estimated_completion.isoformat() if estimated_completion else None,
				"delay_risk": await self._calculate_delay_risk(tid)
			}
		
		return status_info
	
	async def subscribe_to_deadline_events(self, callback: Callable) -> str:
		"""
		Subscribe to deadline events.
		
		Args:
			callback: Callback function for deadline events
		
		Returns:
			str: Subscription ID
		"""
		self.deadline_subscribers.append(callback)
		subscription_id = uuid7str()
		logger.info("New deadline event subscription added")
		return subscription_id
	
	# Private helper methods
	
	async def _calculate_buffer_time(
		self,
		estimated_duration: float,
		strategy: BufferStrategy,
		risk_factors: Dict[str, float]
	) -> float:
		"""Calculate buffer time based on strategy."""
		if strategy == BufferStrategy.FIXED_PERCENTAGE:
			return estimated_duration * self.default_buffer_percentage
		
		elif strategy == BufferStrategy.RISK_BASED:
			base_buffer = estimated_duration * self.default_buffer_percentage
			risk_multiplier = 1.0 + sum(risk_factors.values()) * 0.1
			return base_buffer * risk_multiplier
		
		elif strategy == BufferStrategy.HISTORICAL:
			# Use historical data if available
			# Simplified implementation
			return estimated_duration * 0.25
		
		elif strategy == BufferStrategy.DYNAMIC:
			# Dynamic buffer based on current system load
			return estimated_duration * min(0.5, self.default_buffer_percentage * 1.5)
		
		else:
			return estimated_duration * self.default_buffer_percentage
	
	async def _assess_deadline_risk(self, task_id: str):
		"""Assess deadline risk for a task."""
		if task_id not in self.task_deadlines:
			return
		
		delay_risk = await self._calculate_delay_risk(task_id)
		
		# Create alert if risk is high
		if delay_risk > 0.7:  # 70% risk threshold
			severity = AlertSeverity.CRITICAL if delay_risk > 0.9 else AlertSeverity.WARNING
			
			await self.create_deadline_alert(
				task_id=task_id,
				workflow_instance_id="unknown",  # Would need to be passed in
				alert_type="deadline_risk",
				severity=severity,
				message=f"High deadline risk: {delay_risk*100:.0f}%",
				assigned_users=[]  # Would need to be looked up
			)
	
	async def _calculate_delay_risk(self, task_id: str) -> float:
		"""Calculate delay risk for a task."""
		if task_id not in self.task_deadlines:
			return 0.0
		
		deadline = self.task_deadlines[task_id]
		progress = self.task_progress.get(task_id, 0.0)
		estimated_hours = self.task_estimations.get(task_id, 0.0)
		
		# Calculate time remaining and work remaining
		time_remaining = (deadline - datetime.now()).total_seconds() / 3600
		work_remaining = (100.0 - progress) / 100.0 * estimated_hours
		
		if time_remaining <= 0:
			return 1.0  # Already overdue
		
		if work_remaining <= 0:
			return 0.0  # Already completed
		
		# Risk based on work remaining vs time remaining
		risk_ratio = work_remaining / time_remaining
		
		# Apply risk factors
		risk_factors = self.risk_assessments.get(task_id, {})
		risk_multiplier = 1.0 + sum(risk_factors.values()) * 0.2
		
		total_risk = min(1.0, risk_ratio * risk_multiplier)
		
		return total_risk
	
	async def _forward_pass(self, nodes: Dict[str, CriticalPathNode], project_start: datetime):
		"""Perform forward pass for critical path calculation."""
		# Topological sort
		in_degree = {task_id: len(node.predecessors) for task_id, node in nodes.items()}
		queue = deque([task_id for task_id, degree in in_degree.items() if degree == 0])
		
		while queue:
			task_id = queue.popleft()
			node = nodes[task_id]
			
			# Calculate earliest start
			if not node.predecessors:
				node.earliest_start = project_start
			else:
				max_finish = max(
					nodes[pred_id].earliest_finish
					for pred_id in node.predecessors
					if pred_id in nodes
				)
				node.earliest_start = max_finish
			
			# Calculate earliest finish
			duration_delta = timedelta(hours=node.estimated_duration_hours)
			node.earliest_finish = node.earliest_start + duration_delta
			
			# Update successors
			for successor_id in node.successors:
				if successor_id in nodes:
					in_degree[successor_id] -= 1
					if in_degree[successor_id] == 0:
						queue.append(successor_id)
	
	async def _backward_pass(self, nodes: Dict[str, CriticalPathNode], project_deadline: datetime):
		"""Perform backward pass for critical path calculation."""
		# Start from end nodes
		end_nodes = [task_id for task_id, node in nodes.items() if not node.successors]
		
		# Initialize latest finish times for end nodes
		for task_id in end_nodes:
			node = nodes[task_id]
			node.latest_finish = min(project_deadline, node.earliest_finish)
		
		# Reverse topological sort
		in_degree = {task_id: len(node.successors) for task_id, node in nodes.items()}
		queue = deque([task_id for task_id, degree in in_degree.items() if degree == 0])
		
		while queue:
			task_id = queue.popleft()
			node = nodes[task_id]
			
			# Calculate latest start
			duration_delta = timedelta(hours=node.estimated_duration_hours)
			node.latest_start = node.latest_finish - duration_delta
			
			# Update predecessors
			for predecessor_id in node.predecessors:
				if predecessor_id in nodes:
					pred_node = nodes[predecessor_id]
					if pred_node.latest_finish > node.latest_start:
						pred_node.latest_finish = node.latest_start
					
					in_degree[predecessor_id] -= 1
					if in_degree[predecessor_id] == 0:
						queue.append(predecessor_id)
	
	async def _calculate_float_and_critical_path(self, nodes: Dict[str, CriticalPathNode]) -> List[str]:
		"""Calculate float times and identify critical path."""
		critical_tasks = []
		
		for task_id, node in nodes.items():
			# Calculate total float
			total_float_delta = node.latest_start - node.earliest_start
			node.total_float = total_float_delta.total_seconds() / 3600
			
			# Calculate free float (simplified)
			if node.successors:
				min_successor_start = min(
					nodes[succ_id].earliest_start
					for succ_id in node.successors
					if succ_id in nodes
				)
				free_float_delta = min_successor_start - node.earliest_finish
				node.free_float = max(0, free_float_delta.total_seconds() / 3600)
			else:
				node.free_float = node.total_float
			
			# Determine if critical
			if node.total_float <= 0.1:  # Allow small tolerance
				node.is_critical = True
				critical_tasks.append(task_id)
			
			# Calculate criticality index
			node.criticality_index = max(0.0, 1.0 - node.total_float / 24.0)  # Based on 24-hour scale
		
		return critical_tasks
	
	async def _calculate_schedule_risk(
		self,
		nodes: Dict[str, CriticalPathNode],
		project_deadline: datetime,
		estimated_completion: datetime
	) -> float:
		"""Calculate overall schedule risk."""
		# Base risk from schedule pressure
		if estimated_completion > project_deadline:
			delay_hours = (estimated_completion - project_deadline).total_seconds() / 3600
			base_risk = min(1.0, delay_hours / 168)  # 1 week = high risk
		else:
			buffer_hours = (project_deadline - estimated_completion).total_seconds() / 3600
			base_risk = max(0.0, 1.0 - buffer_hours / 168)  # Less buffer = higher risk
		
		# Risk from critical path density
		critical_count = sum(1 for node in nodes.values() if node.is_critical)
		critical_density = critical_count / len(nodes) if nodes else 0
		
		# Risk from low confidence estimates
		avg_confidence = sum(node.confidence_level for node in nodes.values()) / len(nodes)
		confidence_risk = 1.0 - avg_confidence
		
		# Combined risk
		total_risk = (base_risk * 0.5 + critical_density * 0.3 + confidence_risk * 0.2)
		
		return min(1.0, total_risk)
	
	async def _generate_optimization_suggestions(self, nodes: Dict[str, CriticalPathNode], critical_tasks: List[str]) -> List[str]:
		"""Generate schedule optimization suggestions."""
		suggestions = []
		
		# Parallelization opportunities
		sequential_critical = []
		for task_id in critical_tasks:
			node = nodes[task_id]
			if len(node.successors) == 1 and len(nodes[node.successors[0]].predecessors) == 1:
				sequential_critical.append(task_id)
		
		if len(sequential_critical) > 1:
			suggestions.append(f"Consider parallelizing sequential critical tasks: {', '.join(sequential_critical[:3])}")
		
		# Resource allocation opportunities
		high_duration_tasks = [
			task_id for task_id, node in nodes.items()
			if node.estimated_duration_hours > 16 and task_id in critical_tasks
		]
		
		if high_duration_tasks:
			suggestions.append(f"Consider adding resources to long critical tasks: {', '.join(high_duration_tasks[:2])}")
		
		# Buffer reallocation
		non_critical_with_buffer = [
			task_id for task_id, node in nodes.items()
			if not node.is_critical and node.total_float > 8
		]
		
		if non_critical_with_buffer and critical_tasks:
			suggestions.append("Consider reallocating buffer time from non-critical to critical tasks")
		
		return suggestions
	
	async def _generate_risk_mitigation_actions(self, nodes: Dict[str, CriticalPathNode], schedule_risk: float) -> List[str]:
		"""Generate risk mitigation actions."""
		actions = []
		
		if schedule_risk > 0.7:
			actions.append("High schedule risk - consider scope reduction or deadline extension")
			actions.append("Implement daily progress reviews for critical tasks")
			actions.append("Prepare contingency plans for high-risk activities")
		
		elif schedule_risk > 0.4:
			actions.append("Monitor critical path tasks closely")
			actions.append("Maintain resource flexibility for critical activities")
		
		# Task-specific actions
		high_risk_tasks = [
			task_id for task_id, node in nodes.items()
			if node.is_critical and node.confidence_level < 0.7
		]
		
		if high_risk_tasks:
			actions.append(f"Improve estimates for uncertain tasks: {', '.join(high_risk_tasks[:3])}")
		
		return actions
	
	async def _calculate_analysis_confidence(self, nodes: Dict[str, CriticalPathNode]) -> float:
		"""Calculate confidence in critical path analysis."""
		if not nodes:
			return 0.0
		
		# Average confidence of individual estimates
		avg_confidence = sum(node.confidence_level for node in nodes.values()) / len(nodes)
		
		# Penalty for very short or very long durations (less reliable)
		duration_penalty = 0.0
		for node in nodes.values():
			if node.estimated_duration_hours < 1 or node.estimated_duration_hours > 80:
				duration_penalty += 0.1
		
		duration_penalty = min(0.3, duration_penalty / len(nodes))
		
		return max(0.1, avg_confidence - duration_penalty)
	
	async def _generate_alert_actions(self, task_id: str, severity: AlertSeverity, delay_risk: float) -> List[str]:
		"""Generate suggested actions for an alert."""
		actions = []
		
		if severity == AlertSeverity.CRITICAL or delay_risk > 0.8:
			actions.append("Immediately review task progress and blockers")
			actions.append("Consider adding additional resources")
			actions.append("Escalate to project manager")
			actions.append("Evaluate scope reduction options")
		
		elif severity == AlertSeverity.WARNING or delay_risk > 0.5:
			actions.append("Schedule progress review meeting")
			actions.append("Identify and remove blockers")
			actions.append("Consider task prioritization")
		
		else:
			actions.append("Monitor progress closely")
			actions.append("Ensure adequate resources are available")
		
		# Task-specific actions based on dependencies
		dependencies = self.task_dependencies.get(task_id, [])
		if dependencies:
			actions.append("Review status of dependent tasks")
		
		return actions
	
	async def _determine_escalation_level(self, severity: AlertSeverity, delay_risk: float, time_remaining: float) -> EscalationLevel:
		"""Determine appropriate escalation level."""
		if severity == AlertSeverity.URGENT or (delay_risk > 0.9 and time_remaining < 4):
			return EscalationLevel.EMERGENCY
		elif severity == AlertSeverity.CRITICAL or delay_risk > 0.8:
			return EscalationLevel.EXECUTIVE
		elif severity == AlertSeverity.WARNING or delay_risk > 0.6:
			return EscalationLevel.MANAGER
		elif delay_risk > 0.4:
			return EscalationLevel.SUPERVISOR
		else:
			return EscalationLevel.NONE
	
	async def _deadline_monitoring_loop(self):
		"""Background loop for deadline monitoring."""
		while self._manager_running:
			try:
				await asyncio.sleep(60)  # Check every minute
				await self._check_deadlines()
			except Exception as e:
				logger.error(f"Error in deadline monitoring loop: {e}")
	
	async def _critical_path_update_loop(self):
		"""Background loop for critical path updates."""
		while self._manager_running:
			try:
				await asyncio.sleep(self.critical_path_update_interval)
				await self._update_critical_paths()
			except Exception as e:
				logger.error(f"Error in critical path update loop: {e}")
	
	async def _escalation_loop(self):
		"""Background loop for escalation processing."""
		while self._manager_running:
			try:
				await asyncio.sleep(30)  # Check every 30 seconds
				await self._process_escalations()
			except Exception as e:
				logger.error(f"Error in escalation loop: {e}")
	
	async def _check_deadlines(self):
		"""Check all deadlines and create alerts as needed."""
		current_time = datetime.now()
		
		for task_id, deadline in self.task_deadlines.items():
			# Skip completed tasks
			if self.task_progress.get(task_id, 0.0) >= 100.0:
				continue
			
			# Check if task already has active alert
			has_active_alert = any(
				alert.task_id == task_id for alert in self.active_alerts.values()
			)
			
			if has_active_alert:
				continue
			
			# Calculate time remaining and risk
			time_remaining = (deadline - current_time).total_seconds() / 3600
			delay_risk = await self._calculate_delay_risk(task_id)
			
			# Determine if alert is needed
			should_alert = False
			severity = AlertSeverity.INFO
			
			if time_remaining < 0:
				should_alert = True
				severity = AlertSeverity.URGENT
			elif delay_risk > 0.8:
				should_alert = True
				severity = AlertSeverity.CRITICAL
			elif delay_risk > 0.6 or time_remaining < 8:
				should_alert = True
				severity = AlertSeverity.WARNING
			elif delay_risk > 0.4 or time_remaining < 24:
				should_alert = True
				severity = AlertSeverity.INFO
			
			if should_alert:
				message = f"Deadline alert: {time_remaining:.1f}h remaining, {delay_risk*100:.0f}% delay risk"
				
				await self.create_deadline_alert(
					task_id=task_id,
					workflow_instance_id="monitoring",
					alert_type="deadline_monitoring",
					severity=severity,
					message=message,
					assigned_users=[]  # Would need to be looked up
				)
	
	async def _update_critical_paths(self):
		"""Update critical path analyses."""
		# This would update existing critical paths based on current progress
		# Simplified implementation for now
		logger.debug("Critical path update cycle completed")
	
	async def _process_escalations(self):
		"""Process escalation rules."""
		for alert in self.active_alerts.values():
			if alert.is_acknowledged or alert.escalation_level == EscalationLevel.NONE:
				continue
			
			# Check if enough time has passed for escalation
			time_since_trigger = (datetime.now() - alert.triggered_at).total_seconds() / 60
			
			# Simple escalation logic (would be more sophisticated in practice)
			if time_since_trigger > 60 and not alert.notification_sent:  # 1 hour
				await self._trigger_escalation(alert)
	
	async def _trigger_escalation(self, alert: DeadlineAlert):
		"""Trigger escalation for an alert."""
		logger.warning(f"Escalating alert {alert.alert_id} to {alert.escalation_level.value} level")
		
		alert.notification_sent = True
		self.performance_metrics['escalations_triggered'] += 1
		
		# Notify escalation subscribers
		for callback in self.escalation_subscribers:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback({
						"event_type": "escalation_triggered",
						"alert": alert,
						"escalation_level": alert.escalation_level.value
					})
				else:
					callback({
						"event_type": "escalation_triggered", 
						"alert": alert,
						"escalation_level": alert.escalation_level.value
					})
			except Exception as e:
				logger.error(f"Error in escalation callback: {e}")
	
	async def _notify_deadline_event(self, event_type: str, alert: DeadlineAlert, additional_data: Optional[Dict[str, Any]] = None):
		"""Notify subscribers of deadline events."""
		event_data = {
			"event_type": event_type,
			"alert_id": alert.alert_id,
			"task_id": alert.task_id,
			"workflow_instance_id": alert.workflow_instance_id,
			"severity": alert.severity.value,
			"timestamp": datetime.now().isoformat()
		}
		
		if additional_data:
			event_data.update(additional_data)
		
		for callback in self.deadline_subscribers:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback(event_data)
				else:
					callback(event_data)
			except Exception as e:
				logger.error(f"Error in deadline event callback: {e}")
	
	async def cleanup(self):
		"""Clean up deadline manager resources."""
		await self.stop_manager()
		
		# Clear all data
		self.active_alerts.clear()
		self.resolved_alerts.clear()
		self.critical_paths.clear()
		self.escalation_rules.clear()
		self.task_deadlines.clear()
		self.task_estimations.clear()
		self.task_dependencies.clear()
		self.task_progress.clear()
		self.buffer_allocations.clear()
		self.risk_assessments.clear()
		self.historical_performance.clear()
		self.schedule_optimizations.clear()
		self.optimization_suggestions.clear()
		self.deadline_subscribers.clear()
		self.escalation_subscribers.clear()
		
		logger.info("DeadlineManager cleaned up")