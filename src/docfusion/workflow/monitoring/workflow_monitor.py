"""
WorkflowMonitor - Real-time process monitoring and analytics.

This module provides comprehensive workflow monitoring including real-time
process monitoring, performance metrics tracking, bottleneck identification,
SLA monitoring and reporting, and predictive workflow analytics.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Callable
from collections import defaultdict, deque
import statistics
import json

from pydantic import BaseModel, Field, ConfigDict
from ...core.utils import uuid7str

logger = logging.getLogger(__name__)

class MonitoringLevel(str, Enum):
	"""Monitoring detail levels."""
	BASIC = "basic"
	DETAILED = "detailed"
	COMPREHENSIVE = "comprehensive"
	DEBUG = "debug"

class AlertType(str, Enum):
	"""Types of monitoring alerts."""
	PERFORMANCE_DEGRADATION = "performance_degradation"
	BOTTLENECK_DETECTED = "bottleneck_detected"
	SLA_VIOLATION = "sla_violation"
	RESOURCE_EXHAUSTION = "resource_exhaustion"
	WORKFLOW_STALLED = "workflow_stalled"
	UNUSUAL_ACTIVITY = "unusual_activity"
	THRESHOLD_EXCEEDED = "threshold_exceeded"
	PREDICTIVE_WARNING = "predictive_warning"

class MetricType(str, Enum):
	"""Types of performance metrics."""
	THROUGHPUT = "throughput"
	LATENCY = "latency"
	ERROR_RATE = "error_rate"
	RESOURCE_UTILIZATION = "resource_utilization"
	QUEUE_LENGTH = "queue_length"
	COMPLETION_RATE = "completion_rate"
	USER_SATISFACTION = "user_satisfaction"
	COST = "cost"

class MonitoringAlert(BaseModel):
	"""Monitoring alert for workflow issues."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	alert_id: str = Field(default_factory=uuid7str)
	workflow_instance_id: str = Field(description="Affected workflow instance")
	alert_type: AlertType = Field(description="Type of alert")
	severity: str = Field(description="Alert severity (low, medium, high, critical)")
	
	# Alert details
	title: str = Field(description="Alert title")
	description: str = Field(description="Detailed description")
	affected_components: List[str] = Field(default_factory=list, description="Affected components")
	metrics_involved: Dict[str, float] = Field(default_factory=dict, description="Relevant metrics")
	
	# Timing
	detected_at: datetime = Field(default_factory=datetime.now)
	first_occurrence: datetime = Field(default_factory=datetime.now)
	last_occurrence: datetime = Field(default_factory=datetime.now)
	duration_seconds: float = Field(0.0, description="Duration of the issue")
	
	# Impact assessment
	impact_score: float = Field(description="Impact score (0-1)")
	affected_users: List[str] = Field(default_factory=list)
	business_impact: str = Field(description="Business impact description")
	
	# Recommendations
	recommended_actions: List[str] = Field(default_factory=list)
	automated_response: Optional[str] = None
	escalation_required: bool = False
	
	# Status tracking
	status: str = Field("active", description="Alert status (active, acknowledged, resolved)")
	acknowledged_by: Optional[str] = None
	acknowledged_at: Optional[datetime] = None
	resolved_by: Optional[str] = None
	resolved_at: Optional[datetime] = None
	resolution_notes: Optional[str] = None

class PerformanceMetrics(BaseModel):
	"""Performance metrics for workflows."""
	model_config = ConfigDict(extra='forbid', validate_by_name=True, validate_by_alias=True)
	
	metric_id: str = Field(default_factory=uuid7str)
	workflow_instance_id: str = Field(description="Workflow instance ID")
	metric_type: MetricType = Field(description="Type of metric")
	
	# Metric values
	current_value: float = Field(description="Current metric value")
	average_value: float = Field(description="Average value over time period")
	min_value: float = Field(description="Minimum observed value")
	max_value: float = Field(description="Maximum observed value")
	
	# Statistical measures
	standard_deviation: float = Field(description="Standard deviation")
	percentile_95: float = Field(description="95th percentile value")
	percentile_99: float = Field(description="99th percentile value")
	
	# Trend analysis
	trend_direction: str = Field(description="Trend direction (increasing, decreasing, stable)")
	trend_strength: float = Field(description="Strength of trend (0-1)")
	prediction_next_hour: Optional[float] = Field(None, description="Predicted value for next hour")
	
	# Timing
	measurement_period_start: datetime = Field(description="Start of measurement period")
	measurement_period_end: datetime = Field(description="End of measurement period")
	last_updated: datetime = Field(default_factory=datetime.now)
	
	# Thresholds and SLAs
	warning_threshold: Optional[float] = None
	critical_threshold: Optional[float] = None
	sla_target: Optional[float] = None
	sla_compliance: Optional[float] = None

@dataclass
class WorkflowStep:
	"""Individual step in workflow execution."""
	step_id: str = field(default_factory=uuid7str)
	workflow_instance_id: str = ""
	step_name: str = ""
	step_type: str = ""
	started_at: Optional[datetime] = None
	completed_at: Optional[datetime] = None
	duration_seconds: Optional[float] = None
	status: str = "pending"
	input_size_bytes: int = 0
	output_size_bytes: int = 0
	resource_usage: Dict[str, float] = field(default_factory=dict)
	error_message: Optional[str] = None

@dataclass
class BottleneckAnalysis:
	"""Analysis of workflow bottlenecks."""
	analysis_id: str = field(default_factory=uuid7str)
	workflow_instance_id: str = ""
	bottleneck_type: str = ""  # resource, dependency, processing, etc.
	bottleneck_location: str = ""  # specific step or component
	severity_score: float = 0.0  # 0-1 scale
	impact_description: str = ""
	wait_time_seconds: float = 0.0
	throughput_reduction: float = 0.0
	recommended_solutions: List[str] = field(default_factory=list)
	detected_at: datetime = field(default_factory=datetime.now)

@dataclass
class SLADefinition:
	"""Service Level Agreement definition."""
	sla_id: str = field(default_factory=uuid7str)
	sla_name: str = ""
	metric_type: MetricType = MetricType.LATENCY
	target_value: float = 0.0
	comparison: str = "less_than"  # less_than, greater_than, equals
	measurement_window_minutes: int = 60
	violation_threshold_percentage: float = 95.0  # % of time target must be met
	escalation_delay_minutes: int = 30
	is_active: bool = True

class WorkflowMonitor:
	"""
	Comprehensive workflow monitoring and analytics system.
	
	Provides real-time process monitoring, performance metrics tracking,
	bottleneck identification, SLA monitoring and reporting, and
	predictive workflow analytics.
	"""
	
	def __init__(
		self,
		monitoring_level: MonitoringLevel = MonitoringLevel.DETAILED,
		metrics_retention_days: int = 30,
		alert_retention_days: int = 90
	):
		"""
		Initialize the workflow monitor.
		
		Args:
			monitoring_level: Level of monitoring detail
			metrics_retention_days: Days to retain metrics data
			alert_retention_days: Days to retain alert data
		"""
		self.monitoring_level = monitoring_level
		self.metrics_retention_days = metrics_retention_days
		self.alert_retention_days = alert_retention_days
		
		# Core monitoring data
		self.workflow_steps: Dict[str, List[WorkflowStep]] = defaultdict(list)  # workflow_id -> steps
		self.active_alerts: Dict[str, MonitoringAlert] = {}
		self.resolved_alerts: Dict[str, MonitoringAlert] = {}
		self.performance_metrics: Dict[str, PerformanceMetrics] = {}
		
		# Real-time tracking
		self.active_workflows: Dict[str, Dict[str, Any]] = {}  # workflow_id -> metadata
		self.workflow_start_times: Dict[str, datetime] = {}
		self.step_timings: Dict[str, List[Tuple[datetime, float]]] = defaultdict(list)
		
		# Bottleneck and analysis
		self.bottleneck_analyses: List[BottleneckAnalysis] = []
		self.performance_baselines: Dict[str, Dict[str, float]] = defaultdict(dict)
		self.anomaly_detection_windows: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
		
		# SLA monitoring
		self.sla_definitions: Dict[str, SLADefinition] = {}
		self.sla_violations: List[Dict[str, Any]] = []
		self.sla_compliance_history: Dict[str, List[Tuple[datetime, float]]] = defaultdict(list)
		
		# Predictive analytics
		self.prediction_models: Dict[str, Any] = {}
		self.trend_analysis: Dict[str, Dict[str, Any]] = defaultdict(dict)
		
		# Event handling
		self.monitoring_subscribers: List[Callable] = []
		self.alert_subscribers: List[Callable] = []
		
		# Background tasks
		self.monitoring_task: Optional[asyncio.Task] = None
		self.metrics_calculation_task: Optional[asyncio.Task] = None
		self.bottleneck_analysis_task: Optional[asyncio.Task] = None
		self.sla_monitoring_task: Optional[asyncio.Task] = None
		self.cleanup_task: Optional[asyncio.Task] = None
		
		# Synchronization
		self._lock = asyncio.Lock()
		self._monitor_running = False
		
		# Configuration
		self.alert_thresholds = {
			MetricType.LATENCY: {"warning": 5.0, "critical": 15.0},  # seconds
			MetricType.ERROR_RATE: {"warning": 0.05, "critical": 0.15},  # percentage
			MetricType.THROUGHPUT: {"warning": 0.8, "critical": 0.5},  # relative to baseline
			MetricType.RESOURCE_UTILIZATION: {"warning": 0.8, "critical": 0.95}  # percentage
		}
		
		logger.info(f"WorkflowMonitor initialized with level={monitoring_level.value}")
	
	async def start_monitoring(self):
		"""Start the workflow monitoring system."""
		async with self._lock:
			if self._monitor_running:
				logger.warning("WorkflowMonitor is already running")
				return
			
			self._monitor_running = True
			
			# Start background monitoring tasks
			self.monitoring_task = asyncio.create_task(self._real_time_monitoring_loop())
			self.metrics_calculation_task = asyncio.create_task(self._metrics_calculation_loop())
			self.bottleneck_analysis_task = asyncio.create_task(self._bottleneck_analysis_loop())
			self.sla_monitoring_task = asyncio.create_task(self._sla_monitoring_loop())
			self.cleanup_task = asyncio.create_task(self._cleanup_loop())
			
			logger.info("WorkflowMonitor started successfully")
	
	async def stop_monitoring(self):
		"""Stop the workflow monitoring system."""
		async with self._lock:
			if not self._monitor_running:
				return
			
			self._monitor_running = False
			
			# Cancel background tasks
			tasks = [
				self.monitoring_task,
				self.metrics_calculation_task,
				self.bottleneck_analysis_task,
				self.sla_monitoring_task,
				self.cleanup_task
			]
			
			for task in tasks:
				if task:
					task.cancel()
					try:
						await task
					except asyncio.CancelledError:
						pass
			
			logger.info("WorkflowMonitor stopped successfully")
	
	async def register_workflow_start(
		self,
		workflow_instance_id: str,
		workflow_name: str,
		expected_duration_minutes: Optional[float] = None,
		priority: str = "normal",
		metadata: Optional[Dict[str, Any]] = None
	):
		"""
		Register the start of a workflow for monitoring.
		
		Args:
			workflow_instance_id: Unique workflow instance identifier
			workflow_name: Human-readable workflow name
			expected_duration_minutes: Expected workflow duration
			priority: Workflow priority (low, normal, high, critical)
			metadata: Additional workflow metadata
		"""
		async with self._lock:
			start_time = datetime.now()
			
			self.active_workflows[workflow_instance_id] = {
				"name": workflow_name,
				"started_at": start_time,
				"expected_duration_minutes": expected_duration_minutes,
				"priority": priority,
				"metadata": metadata or {},
				"step_count": 0,
				"completed_steps": 0,
				"failed_steps": 0
			}
			
			self.workflow_start_times[workflow_instance_id] = start_time
			
			logger.info(f"Registered workflow {workflow_name} ({workflow_instance_id}) for monitoring")
			
			# Notify subscribers
			await self._notify_monitoring_event("workflow_started", {
				"workflow_instance_id": workflow_instance_id,
				"workflow_name": workflow_name,
				"started_at": start_time.isoformat()
			})
	
	async def register_step_start(
		self,
		workflow_instance_id: str,
		step_name: str,
		step_type: str,
		input_size_bytes: int = 0,
		expected_duration_seconds: Optional[float] = None
	) -> str:
		"""
		Register the start of a workflow step.
		
		Args:
			workflow_instance_id: Workflow instance ID
			step_name: Human-readable step name
			step_type: Type of step (e.g., processing, io, validation)
			input_size_bytes: Size of input data
			expected_duration_seconds: Expected step duration
		
		Returns:
			str: Step ID for tracking
		"""
		async with self._lock:
			step = WorkflowStep(
				workflow_instance_id=workflow_instance_id,
				step_name=step_name,
				step_type=step_type,
				started_at=datetime.now(),
				status="running",
				input_size_bytes=input_size_bytes
			)
			
			self.workflow_steps[workflow_instance_id].append(step)
			
			# Update workflow metadata
			if workflow_instance_id in self.active_workflows:
				self.active_workflows[workflow_instance_id]["step_count"] += 1
			
			logger.debug(f"Started step '{step_name}' in workflow {workflow_instance_id}")
			
			return step.step_id
	
	async def register_step_completion(
		self,
		workflow_instance_id: str,
		step_id: str,
		success: bool = True,
		output_size_bytes: int = 0,
		resource_usage: Optional[Dict[str, float]] = None,
		error_message: Optional[str] = None
	):
		"""
		Register the completion of a workflow step.
		
		Args:
			workflow_instance_id: Workflow instance ID
			step_id: Step ID from register_step_start
			success: Whether step completed successfully
			output_size_bytes: Size of output data
			resource_usage: Resource usage metrics
			error_message: Error message if step failed
		"""
		async with self._lock:
			# Find the step
			step = None
			for workflow_step in self.workflow_steps[workflow_instance_id]:
				if workflow_step.step_id == step_id:
					step = workflow_step
					break
			
			if not step:
				logger.warning(f"Step {step_id} not found for completion")
				return
			
			# Update step
			completion_time = datetime.now()
			step.completed_at = completion_time
			step.status = "completed" if success else "failed"
			step.output_size_bytes = output_size_bytes
			step.resource_usage = resource_usage or {}
			step.error_message = error_message
			
			if step.started_at:
				step.duration_seconds = (completion_time - step.started_at).total_seconds()
				
				# Record timing for analysis
				self.step_timings[step.step_type].append((completion_time, step.duration_seconds))
			
			# Update workflow metadata
			if workflow_instance_id in self.active_workflows:
				if success:
					self.active_workflows[workflow_instance_id]["completed_steps"] += 1
				else:
					self.active_workflows[workflow_instance_id]["failed_steps"] += 1
			
			# Check for performance issues
			await self._analyze_step_performance(step)
			
			logger.debug(f"Completed step '{step.step_name}' in {step.duration_seconds:.2f}s")
	
	async def register_workflow_completion(
		self,
		workflow_instance_id: str,
		success: bool = True,
		final_output_size_bytes: int = 0,
		completion_notes: Optional[str] = None
	):
		"""
		Register the completion of a workflow.
		
		Args:
			workflow_instance_id: Workflow instance ID
			success: Whether workflow completed successfully
			final_output_size_bytes: Size of final output
			completion_notes: Optional completion notes
		"""
		async with self._lock:
			if workflow_instance_id not in self.active_workflows:
				logger.warning(f"Workflow {workflow_instance_id} not found for completion")
				return
			
			workflow_info = self.active_workflows.pop(workflow_instance_id)
			completion_time = datetime.now()
			start_time = workflow_info["started_at"]
			total_duration = (completion_time - start_time).total_seconds()
			
			# Calculate workflow metrics
			steps = self.workflow_steps[workflow_instance_id]
			total_steps = len(steps)
			completed_steps = workflow_info["completed_steps"]
			failed_steps = workflow_info["failed_steps"]
			
			# Update performance metrics
			await self._update_workflow_metrics(
				workflow_instance_id,
				total_duration,
				success,
				total_steps,
				completed_steps,
				failed_steps
			)
			
			logger.info(f"Workflow {workflow_instance_id} completed in {total_duration:.2f}s (success: {success})")
			
			# Notify subscribers
			await self._notify_monitoring_event("workflow_completed", {
				"workflow_instance_id": workflow_instance_id,
				"success": success,
				"duration_seconds": total_duration,
				"total_steps": total_steps,
				"completed_steps": completed_steps,
				"failed_steps": failed_steps
			})
	
	async def create_alert(
		self,
		workflow_instance_id: str,
		alert_type: AlertType,
		severity: str,
		title: str,
		description: str,
		affected_components: Optional[List[str]] = None,
		metrics_involved: Optional[Dict[str, float]] = None,
		recommended_actions: Optional[List[str]] = None
	) -> MonitoringAlert:
		"""
		Create a monitoring alert.
		
		Args:
			workflow_instance_id: Affected workflow instance
			alert_type: Type of alert
			severity: Alert severity
			title: Alert title
			description: Detailed description
			affected_components: List of affected components
			metrics_involved: Relevant metrics
			recommended_actions: Recommended actions
		
		Returns:
			MonitoringAlert: Created alert
		"""
		async with self._lock:
			# Calculate impact score
			impact_score = await self._calculate_alert_impact(
				workflow_instance_id, alert_type, severity, metrics_involved or {}
			)
			
			# Generate recommendations if not provided
			if not recommended_actions:
				recommended_actions = await self._generate_alert_recommendations(
					alert_type, severity, metrics_involved or {}
				)
			
			alert = MonitoringAlert(
				workflow_instance_id=workflow_instance_id,
				alert_type=alert_type,
				severity=severity,
				title=title,
				description=description,
				affected_components=affected_components or [],
				metrics_involved=metrics_involved or {},
				impact_score=impact_score,
				recommended_actions=recommended_actions,
				escalation_required=severity in ["high", "critical"]
			)
			
			self.active_alerts[alert.alert_id] = alert
			
			logger.warning(f"Created {severity} alert: {title}")
			
			# Notify subscribers
			await self._notify_alert_event("alert_created", alert)
			
			return alert
	
	async def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
		"""
		Acknowledge a monitoring alert.
		
		Args:
			alert_id: Alert ID to acknowledge
			acknowledged_by: User acknowledging the alert
		
		Returns:
			bool: True if acknowledged successfully
		"""
		async with self._lock:
			if alert_id not in self.active_alerts:
				return False
			
			alert = self.active_alerts[alert_id]
			alert.status = "acknowledged"
			alert.acknowledged_by = acknowledged_by
			alert.acknowledged_at = datetime.now()
			
			logger.info(f"Alert {alert_id} acknowledged by {acknowledged_by}")
			
			# Notify subscribers
			await self._notify_alert_event("alert_acknowledged", alert)
			
			return True
	
	async def resolve_alert(
		self,
		alert_id: str,
		resolved_by: str,
		resolution_notes: Optional[str] = None
	) -> bool:
		"""
		Resolve a monitoring alert.
		
		Args:
			alert_id: Alert ID to resolve
			resolved_by: User resolving the alert
			resolution_notes: Optional resolution notes
		
		Returns:
			bool: True if resolved successfully
		"""
		async with self._lock:
			if alert_id not in self.active_alerts:
				return False
			
			alert = self.active_alerts.pop(alert_id)
			alert.status = "resolved"
			alert.resolved_by = resolved_by
			alert.resolved_at = datetime.now()
			alert.resolution_notes = resolution_notes
			
			# Move to resolved alerts
			self.resolved_alerts[alert_id] = alert
			
			logger.info(f"Alert {alert_id} resolved by {resolved_by}")
			
			# Notify subscribers
			await self._notify_alert_event("alert_resolved", alert)
			
			return True
	
	async def add_sla_definition(
		self,
		sla_name: str,
		metric_type: MetricType,
		target_value: float,
		comparison: str = "less_than",
		measurement_window_minutes: int = 60
	) -> str:
		"""
		Add an SLA definition for monitoring.
		
		Args:
			sla_name: Human-readable SLA name
			metric_type: Type of metric to monitor
			target_value: Target value for the metric
			comparison: Comparison operator (less_than, greater_than, equals)
			measurement_window_minutes: Measurement window in minutes
		
		Returns:
			str: SLA ID
		"""
		sla = SLADefinition(
			sla_name=sla_name,
			metric_type=metric_type,
			target_value=target_value,
			comparison=comparison,
			measurement_window_minutes=measurement_window_minutes
		)
		
		self.sla_definitions[sla.sla_id] = sla
		
		logger.info(f"Added SLA definition: {sla_name} ({metric_type.value} {comparison} {target_value})")
		
		return sla.sla_id
	
	async def get_real_time_metrics(self, workflow_instance_id: Optional[str] = None) -> Dict[str, Any]:
		"""
		Get real-time monitoring metrics.
		
		Args:
			workflow_instance_id: Specific workflow ID, or None for all workflows
		
		Returns:
			Dict[str, Any]: Real-time metrics
		"""
		current_time = datetime.now()
		
		if workflow_instance_id:
			# Metrics for specific workflow
			if workflow_instance_id in self.active_workflows:
				workflow_info = self.active_workflows[workflow_instance_id]
				steps = self.workflow_steps[workflow_instance_id]
				
				return {
					"workflow_instance_id": workflow_instance_id,
					"name": workflow_info["name"],
					"status": "running",
					"started_at": workflow_info["started_at"].isoformat(),
					"duration_seconds": (current_time - workflow_info["started_at"]).total_seconds(),
					"total_steps": len(steps),
					"completed_steps": workflow_info["completed_steps"],
					"failed_steps": workflow_info["failed_steps"],
					"current_step": await self._get_current_step(workflow_instance_id),
					"progress_percentage": await self._calculate_progress_percentage(workflow_instance_id)
				}
			else:
				return {"error": f"Workflow {workflow_instance_id} not found or not active"}
		
		else:
			# System-wide metrics
			total_active = len(self.active_workflows)
			total_alerts = len(self.active_alerts)
			
			# Calculate average metrics
			avg_duration = 0.0
			if self.workflow_start_times:
				durations = [
					(current_time - start_time).total_seconds()
					for start_time in self.workflow_start_times.values()
				]
				avg_duration = statistics.mean(durations) if durations else 0.0
			
			return {
				"system_status": "healthy" if total_alerts == 0 else "issues_detected",
				"active_workflows": total_active,
				"active_alerts": total_alerts,
				"average_workflow_duration_seconds": avg_duration,
				"monitoring_level": self.monitoring_level.value,
				"metrics_retention_days": self.metrics_retention_days,
				"performance_summary": await self._get_performance_summary()
			}
	
	async def get_performance_analytics(
		self,
		workflow_instance_id: Optional[str] = None,
		time_range_hours: int = 24
	) -> Dict[str, Any]:
		"""
		Get performance analytics and insights.
		
		Args:
			workflow_instance_id: Specific workflow ID, or None for system-wide
			time_range_hours: Time range for analysis
		
		Returns:
			Dict[str, Any]: Performance analytics
		"""
		end_time = datetime.now()
		start_time = end_time - timedelta(hours=time_range_hours)
		
		analytics = {
			"analysis_period": {
				"start": start_time.isoformat(),
				"end": end_time.isoformat(),
				"duration_hours": time_range_hours
			},
			"workflow_analytics": {},
			"step_analytics": {},
			"bottleneck_analysis": [],
			"trend_analysis": {},
			"predictions": {}
		}
		
		# Workflow-level analytics
		if workflow_instance_id:
			analytics["workflow_analytics"] = await self._analyze_workflow_performance(
				workflow_instance_id, start_time, end_time
			)
		else:
			analytics["workflow_analytics"] = await self._analyze_system_performance(
				start_time, end_time
			)
		
		# Step-level analytics
		analytics["step_analytics"] = await self._analyze_step_performance_trends(
			start_time, end_time
		)
		
		# Bottleneck analysis
		analytics["bottleneck_analysis"] = [
			{
				"type": ba.bottleneck_type,
				"location": ba.bottleneck_location,
				"severity": ba.severity_score,
				"impact": ba.impact_description,
				"solutions": ba.recommended_solutions
			}
			for ba in self.bottleneck_analyses
			if ba.detected_at >= start_time
		]
		
		# Trend analysis
		analytics["trend_analysis"] = await self._perform_trend_analysis(start_time, end_time)
		
		# Predictions
		analytics["predictions"] = await self._generate_performance_predictions()
		
		return analytics
	
	async def get_sla_compliance(self) -> Dict[str, Any]:
		"""
		Get SLA compliance report.
		
		Returns:
			Dict[str, Any]: SLA compliance information
		"""
		compliance_report = {
			"overall_compliance": 0.0,
			"sla_details": {},
			"violations": [],
			"trends": {}
		}
		
		total_compliance = 0.0
		active_slas = [sla for sla in self.sla_definitions.values() if sla.is_active]
		
		for sla in active_slas:
			sla_compliance = await self._calculate_sla_compliance(sla)
			
			compliance_report["sla_details"][sla.sla_id] = {
				"name": sla.sla_name,
				"metric_type": sla.metric_type.value,
				"target_value": sla.target_value,
				"current_compliance": sla_compliance,
				"status": "compliant" if sla_compliance >= sla.violation_threshold_percentage / 100 else "violated"
			}
			
			total_compliance += sla_compliance
		
		if active_slas:
			compliance_report["overall_compliance"] = total_compliance / len(active_slas) * 100
		
		# Recent violations
		compliance_report["violations"] = [
			violation for violation in self.sla_violations[-10:]  # Last 10 violations
		]
		
		return compliance_report
	
	async def subscribe_to_monitoring_events(self, callback: Callable) -> str:
		"""
		Subscribe to monitoring events.
		
		Args:
			callback: Callback function for monitoring events
		
		Returns:
			str: Subscription ID
		"""
		self.monitoring_subscribers.append(callback)
		subscription_id = uuid7str()
		logger.info("New monitoring event subscription added")
		return subscription_id
	
	async def subscribe_to_alert_events(self, callback: Callable) -> str:
		"""
		Subscribe to alert events.
		
		Args:
			callback: Callback function for alert events
		
		Returns:
			str: Subscription ID
		"""
		self.alert_subscribers.append(callback)
		subscription_id = uuid7str()
		logger.info("New alert event subscription added")
		return subscription_id
	
	# Private helper methods
	
	async def _real_time_monitoring_loop(self):
		"""Background loop for real-time monitoring."""
		while self._monitor_running:
			try:
				await asyncio.sleep(5)  # Monitor every 5 seconds
				await self._check_workflow_health()
				await self._detect_anomalies()
			except Exception as e:
				logger.error(f"Error in real-time monitoring loop: {e}")
	
	async def _metrics_calculation_loop(self):
		"""Background loop for metrics calculation."""
		while self._monitor_running:
			try:
				await asyncio.sleep(60)  # Calculate every minute
				await self._calculate_performance_metrics()
				await self._update_trend_analysis()
			except Exception as e:
				logger.error(f"Error in metrics calculation loop: {e}")
	
	async def _bottleneck_analysis_loop(self):
		"""Background loop for bottleneck analysis."""
		while self._monitor_running:
			try:
				await asyncio.sleep(300)  # Analyze every 5 minutes
				await self._analyze_bottlenecks()
			except Exception as e:
				logger.error(f"Error in bottleneck analysis loop: {e}")
	
	async def _sla_monitoring_loop(self):
		"""Background loop for SLA monitoring."""
		while self._monitor_running:
			try:
				await asyncio.sleep(30)  # Check every 30 seconds
				await self._monitor_slas()
			except Exception as e:
				logger.error(f"Error in SLA monitoring loop: {e}")
	
	async def _cleanup_loop(self):
		"""Background loop for data cleanup."""
		while self._monitor_running:
			try:
				await asyncio.sleep(3600)  # Cleanup every hour
				await self._cleanup_old_data()
			except Exception as e:
				logger.error(f"Error in cleanup loop: {e}")
	
	async def _check_workflow_health(self):
		"""Check health of active workflows."""
		current_time = datetime.now()
		
		for workflow_id, workflow_info in self.active_workflows.items():
			started_at = workflow_info["started_at"]
			duration = (current_time - started_at).total_seconds()
			
			# Check for stalled workflows
			expected_duration = workflow_info.get("expected_duration_minutes")
			if expected_duration and duration > expected_duration * 60 * 1.5:  # 150% of expected
				await self.create_alert(
					workflow_instance_id=workflow_id,
					alert_type=AlertType.WORKFLOW_STALLED,
					severity="high",
					title=f"Workflow {workflow_info['name']} appears stalled",
					description=f"Workflow has been running for {duration/3600:.1f} hours, "
					           f"expected duration was {expected_duration} minutes",
					recommended_actions=[
						"Check workflow progress",
						"Investigate potential blockers",
						"Consider restarting workflow"
					]
				)
			
			# Check for too many failed steps
			total_steps = workflow_info["step_count"]
			failed_steps = workflow_info["failed_steps"]
			if total_steps > 0 and failed_steps / total_steps > 0.2:  # >20% failure rate
				await self.create_alert(
					workflow_instance_id=workflow_id,
					alert_type=AlertType.UNUSUAL_ACTIVITY,
					severity="medium",
					title=f"High failure rate in workflow {workflow_info['name']}",
					description=f"{failed_steps}/{total_steps} steps have failed ({failed_steps/total_steps*100:.1f}%)",
					recommended_actions=[
						"Review failed step details",
						"Check system resources",
						"Validate input data quality"
					]
				)
	
	async def _detect_anomalies(self):
		"""Detect performance anomalies."""
		# Simple anomaly detection based on recent performance
		for step_type, timings in self.step_timings.items():
			if len(timings) < 10:  # Need sufficient data
				continue
			
			recent_timings = [duration for _, duration in timings[-20:]]  # Last 20 measurements
			if len(recent_timings) < 10:
				continue
			
			mean_duration = statistics.mean(recent_timings)
			stdev_duration = statistics.stdev(recent_timings) if len(recent_timings) > 1 else 0
			
			# Check latest timing
			if recent_timings:
				latest_duration = recent_timings[-1]
				if stdev_duration > 0 and latest_duration > mean_duration + 2 * stdev_duration:
					# Anomaly detected
					await self.create_alert(
						workflow_instance_id="system",
						alert_type=AlertType.PERFORMANCE_DEGRADATION,
						severity="medium",
						title=f"Performance anomaly detected in {step_type} steps",
						description=f"Latest execution took {latest_duration:.2f}s, "
						           f"significantly higher than average {mean_duration:.2f}s",
						metrics_involved={
							"latest_duration": latest_duration,
							"average_duration": mean_duration,
							"standard_deviation": stdev_duration
						},
						recommended_actions=[
							"Investigate system performance",
							"Check resource availability",
							"Review recent changes"
						]
					)
	
	async def _calculate_performance_metrics(self):
		"""Calculate performance metrics."""
		current_time = datetime.now()
		
		# Calculate system-wide metrics
		for metric_type in MetricType:
			metric_value = await self._calculate_metric_value(metric_type)
			
			# Update or create performance metric
			metric_id = f"system_{metric_type.value}"
			
			if metric_id in self.performance_metrics:
				# Update existing metric
				metric = self.performance_metrics[metric_id]
				await self._update_performance_metric(metric, metric_value)
			else:
				# Create new metric
				metric = PerformanceMetrics(
					workflow_instance_id="system",
					metric_type=metric_type,
					current_value=metric_value,
					average_value=metric_value,
					min_value=metric_value,
					max_value=metric_value,
					standard_deviation=0.0,
					percentile_95=metric_value,
					percentile_99=metric_value,
					trend_direction="stable",
					trend_strength=0.0,
					measurement_period_start=current_time - timedelta(hours=1),
					measurement_period_end=current_time
				)
				
				self.performance_metrics[metric_id] = metric
	
	async def _calculate_metric_value(self, metric_type: MetricType) -> float:
		"""Calculate current value for a metric type."""
		if metric_type == MetricType.THROUGHPUT:
			# Calculate workflows completed per hour
			completed_count = len([
				wf for wf in self.workflow_steps.values()
				if any(step.status == "completed" for step in wf)
			])
			return float(completed_count)
		
		elif metric_type == MetricType.LATENCY:
			# Calculate average step latency
			all_durations = []
			for steps in self.workflow_steps.values():
				for step in steps:
					if step.duration_seconds:
						all_durations.append(step.duration_seconds)
			
			return statistics.mean(all_durations) if all_durations else 0.0
		
		elif metric_type == MetricType.ERROR_RATE:
			# Calculate error rate
			total_steps = sum(len(steps) for steps in self.workflow_steps.values())
			failed_steps = sum(
				len([step for step in steps if step.status == "failed"])
				for steps in self.workflow_steps.values()
			)
			
			return failed_steps / total_steps if total_steps > 0 else 0.0
		
		elif metric_type == MetricType.RESOURCE_UTILIZATION:
			# Calculate average resource utilization
			utilizations = []
			for steps in self.workflow_steps.values():
				for step in steps:
					if step.resource_usage:
						avg_util = statistics.mean(step.resource_usage.values())
						utilizations.append(avg_util)
			
			return statistics.mean(utilizations) if utilizations else 0.0
		
		else:
			return 0.0
	
	async def _update_performance_metric(self, metric: PerformanceMetrics, new_value: float):
		"""Update a performance metric with new value."""
		# Update values
		metric.current_value = new_value
		metric.min_value = min(metric.min_value, new_value)
		metric.max_value = max(metric.max_value, new_value)
		metric.last_updated = datetime.now()
		
		# Simple trend analysis
		if new_value > metric.average_value * 1.1:
			metric.trend_direction = "increasing"
			metric.trend_strength = min(1.0, (new_value - metric.average_value) / metric.average_value)
		elif new_value < metric.average_value * 0.9:
			metric.trend_direction = "decreasing"
			metric.trend_strength = min(1.0, (metric.average_value - new_value) / metric.average_value)
		else:
			metric.trend_direction = "stable"
			metric.trend_strength = 0.0
		
		# Update average (simple moving average)
		metric.average_value = (metric.average_value * 0.9 + new_value * 0.1)
	
	async def _analyze_bottlenecks(self):
		"""Analyze system for bottlenecks."""
		# Analyze step types for bottlenecks
		step_type_stats = defaultdict(list)
		
		for steps in self.workflow_steps.values():
			for step in steps:
				if step.duration_seconds:
					step_type_stats[step.step_type].append(step.duration_seconds)
		
		# Find bottleneck step types
		for step_type, durations in step_type_stats.items():
			if len(durations) < 5:  # Need sufficient data
				continue
			
			avg_duration = statistics.mean(durations)
			max_duration = max(durations)
			
			# Consider it a bottleneck if max is significantly higher than average
			if max_duration > avg_duration * 3:
				bottleneck = BottleneckAnalysis(
					bottleneck_type="processing",
					bottleneck_location=step_type,
					severity_score=min(1.0, (max_duration - avg_duration) / avg_duration),
					impact_description=f"Step type '{step_type}' shows high variability in execution time",
					wait_time_seconds=max_duration - avg_duration,
					throughput_reduction=0.2,  # Estimated
					recommended_solutions=[
						f"Optimize {step_type} processing logic",
						"Consider parallel processing",
						"Review resource allocation"
					]
				)
				
				self.bottleneck_analyses.append(bottleneck)
				
				# Create alert for significant bottlenecks
				if bottleneck.severity_score > 0.7:
					await self.create_alert(
						workflow_instance_id="system",
						alert_type=AlertType.BOTTLENECK_DETECTED,
						severity="high" if bottleneck.severity_score > 0.9 else "medium",
						title=f"Bottleneck detected in {step_type} processing",
						description=bottleneck.impact_description,
						recommended_actions=bottleneck.recommended_solutions
					)
	
	async def _monitor_slas(self):
		"""Monitor SLA compliance."""
		for sla in self.sla_definitions.values():
			if not sla.is_active:
				continue
			
			compliance = await self._calculate_sla_compliance(sla)
			
			# Record compliance
			self.sla_compliance_history[sla.sla_id].append((datetime.now(), compliance))
			
			# Check for violations
			if compliance < sla.violation_threshold_percentage / 100:
				violation = {
					"sla_id": sla.sla_id,
					"sla_name": sla.sla_name,
					"detected_at": datetime.now().isoformat(),
					"compliance_level": compliance,
					"threshold": sla.violation_threshold_percentage / 100,
					"metric_type": sla.metric_type.value,
					"target_value": sla.target_value
				}
				
				self.sla_violations.append(violation)
				
				# Create alert
				await self.create_alert(
					workflow_instance_id="system",
					alert_type=AlertType.SLA_VIOLATION,
					severity="critical",
					title=f"SLA violation: {sla.sla_name}",
					description=f"SLA compliance is {compliance*100:.1f}%, "
					           f"below threshold of {sla.violation_threshold_percentage}%",
					metrics_involved={
						"compliance_level": compliance,
						"threshold": sla.violation_threshold_percentage / 100
					},
					recommended_actions=[
						"Review system performance",
						"Scale resources if needed",
						"Investigate root cause"
					]
				)
	
	async def _calculate_sla_compliance(self, sla: SLADefinition) -> float:
		"""Calculate SLA compliance for a given SLA."""
		# Simplified compliance calculation
		# In practice, this would analyze actual metric values over the measurement window
		
		# For now, return a mock compliance based on current system state
		active_alerts = len(self.active_alerts)
		if active_alerts == 0:
			return 0.95  # 95% compliance when no alerts
		elif active_alerts < 3:
			return 0.85  # 85% compliance with few alerts
		else:
			return 0.70  # 70% compliance with many alerts
	
	async def _cleanup_old_data(self):
		"""Clean up old monitoring data."""
		cutoff_time = datetime.now() - timedelta(days=self.metrics_retention_days)
		
		# Clean up old workflow steps
		for workflow_id in list(self.workflow_steps.keys()):
			steps = self.workflow_steps[workflow_id]
			recent_steps = [
				step for step in steps
				if step.started_at and step.started_at > cutoff_time
			]
			
			if recent_steps:
				self.workflow_steps[workflow_id] = recent_steps
			else:
				del self.workflow_steps[workflow_id]
		
		# Clean up old alerts
		alert_cutoff = datetime.now() - timedelta(days=self.alert_retention_days)
		old_alerts = [
			alert_id for alert_id, alert in self.resolved_alerts.items()
			if alert.resolved_at and alert.resolved_at < alert_cutoff
		]
		
		for alert_id in old_alerts:
			del self.resolved_alerts[alert_id]
		
		logger.debug(f"Cleaned up data older than {self.metrics_retention_days} days")
	
	async def _analyze_step_performance(self, step: WorkflowStep):
		"""Analyze performance of a completed step."""
		if not step.duration_seconds:
			return
		
		# Check against thresholds
		step_type = step.step_type
		duration = step.duration_seconds
		
		# Get baseline for this step type
		baseline = self.performance_baselines.get(step_type, {}).get("avg_duration", 5.0)
		
		# Check for performance issues
		if duration > baseline * 2:  # 2x slower than baseline
			await self.create_alert(
				workflow_instance_id=step.workflow_instance_id,
				alert_type=AlertType.PERFORMANCE_DEGRADATION,
				severity="medium",
				title=f"Slow step execution: {step.step_name}",
				description=f"Step took {duration:.2f}s, baseline is {baseline:.2f}s",
				metrics_involved={
					"duration": duration,
					"baseline": baseline,
					"slowdown_factor": duration / baseline
				},
				recommended_actions=[
					"Check system resources",
					"Review step implementation",
					"Consider optimization"
				]
			)
	
	async def _get_current_step(self, workflow_instance_id: str) -> Optional[str]:
		"""Get the current step for a workflow."""
		steps = self.workflow_steps.get(workflow_instance_id, [])
		for step in reversed(steps):  # Check most recent first
			if step.status == "running":
				return step.step_name
		return None
	
	async def _calculate_progress_percentage(self, workflow_instance_id: str) -> float:
		"""Calculate progress percentage for a workflow."""
		if workflow_instance_id not in self.active_workflows:
			return 0.0
		
		workflow_info = self.active_workflows[workflow_instance_id]
		total_steps = workflow_info["step_count"]
		completed_steps = workflow_info["completed_steps"]
		
		return (completed_steps / total_steps * 100) if total_steps > 0 else 0.0
	
	async def _get_performance_summary(self) -> Dict[str, Any]:
		"""Get system performance summary."""
		if not self.performance_metrics:
			return {"status": "no_data"}
		
		summary = {}
		for metric_id, metric in self.performance_metrics.items():
			summary[metric.metric_type.value] = {
				"current": metric.current_value,
				"average": metric.average_value,
				"trend": metric.trend_direction,
				"trend_strength": metric.trend_strength
			}
		
		return summary
	
	async def _update_workflow_metrics(
		self,
		workflow_instance_id: str,
		duration_seconds: float,
		success: bool,
		total_steps: int,
		completed_steps: int,
		failed_steps: int
	):
		"""Update metrics after workflow completion."""
		# Create workflow-specific metrics
		metric = PerformanceMetrics(
			workflow_instance_id=workflow_instance_id,
			metric_type=MetricType.LATENCY,
			current_value=duration_seconds,
			average_value=duration_seconds,
			min_value=duration_seconds,
			max_value=duration_seconds,
			standard_deviation=0.0,
			percentile_95=duration_seconds,
			percentile_99=duration_seconds,
			trend_direction="stable",
			trend_strength=0.0,
			measurement_period_start=datetime.now() - timedelta(seconds=duration_seconds),
			measurement_period_end=datetime.now()
		)
		
		self.performance_metrics[f"workflow_{workflow_instance_id}_duration"] = metric
	
	async def _calculate_alert_impact(
		self,
		workflow_instance_id: str,
		alert_type: AlertType,
		severity: str,
		metrics: Dict[str, float]
	) -> float:
		"""Calculate impact score for an alert."""
		base_impact = {
			"low": 0.2,
			"medium": 0.5,
			"high": 0.8,
			"critical": 1.0
		}.get(severity, 0.5)
		
		# Adjust based on alert type
		type_multiplier = {
			AlertType.SLA_VIOLATION: 1.2,
			AlertType.WORKFLOW_STALLED: 1.1,
			AlertType.RESOURCE_EXHAUSTION: 1.0,
			AlertType.PERFORMANCE_DEGRADATION: 0.8,
			AlertType.BOTTLENECK_DETECTED: 0.9
		}.get(alert_type, 1.0)
		
		return min(1.0, base_impact * type_multiplier)
	
	async def _generate_alert_recommendations(
		self,
		alert_type: AlertType,
		severity: str,
		metrics: Dict[str, float]
	) -> List[str]:
		"""Generate recommendations for an alert."""
		recommendations = []
		
		if alert_type == AlertType.PERFORMANCE_DEGRADATION:
			recommendations.extend([
				"Check system resource utilization",
				"Review recent code changes",
				"Analyze database query performance",
				"Consider scaling resources"
			])
		
		elif alert_type == AlertType.BOTTLENECK_DETECTED:
			recommendations.extend([
				"Identify bottleneck root cause",
				"Consider parallel processing",
				"Optimize critical path",
				"Review resource allocation"
			])
		
		elif alert_type == AlertType.SLA_VIOLATION:
			recommendations.extend([
				"Immediately assess service health",
				"Scale resources if needed",
				"Review SLA targets",
				"Implement corrective actions"
			])
		
		elif alert_type == AlertType.WORKFLOW_STALLED:
			recommendations.extend([
				"Check for deadlocks",
				"Review workflow dependencies",
				"Restart stalled processes",
				"Investigate external dependencies"
			])
		
		else:
			recommendations.extend([
				"Investigate alert details",
				"Check system logs",
				"Monitor related metrics"
			])
		
		return recommendations
	
	async def _analyze_workflow_performance(
		self,
		workflow_instance_id: str,
		start_time: datetime,
		end_time: datetime
	) -> Dict[str, Any]:
		"""Analyze performance for a specific workflow."""
		steps = self.workflow_steps.get(workflow_instance_id, [])
		
		if not steps:
			return {"error": "No data available"}
		
		# Filter steps by time range
		relevant_steps = [
			step for step in steps
			if step.started_at and start_time <= step.started_at <= end_time
		]
		
		if not relevant_steps:
			return {"error": "No steps in time range"}
		
		# Calculate statistics
		durations = [step.duration_seconds for step in relevant_steps if step.duration_seconds]
		
		return {
			"total_steps": len(relevant_steps),
			"completed_steps": len([s for s in relevant_steps if s.status == "completed"]),
			"failed_steps": len([s for s in relevant_steps if s.status == "failed"]),
			"average_step_duration": statistics.mean(durations) if durations else 0,
			"min_step_duration": min(durations) if durations else 0,
			"max_step_duration": max(durations) if durations else 0,
			"total_duration": sum(durations) if durations else 0
		}
	
	async def _analyze_system_performance(
		self,
		start_time: datetime,
		end_time: datetime
	) -> Dict[str, Any]:
		"""Analyze system-wide performance."""
		all_steps = []
		for steps in self.workflow_steps.values():
			all_steps.extend([
				step for step in steps
				if step.started_at and start_time <= step.started_at <= end_time
			])
		
		if not all_steps:
			return {"error": "No data available"}
		
		durations = [step.duration_seconds for step in all_steps if step.duration_seconds]
		
		return {
			"total_workflows": len(self.workflow_steps),
			"total_steps": len(all_steps),
			"completed_steps": len([s for s in all_steps if s.status == "completed"]),
			"failed_steps": len([s for s in all_steps if s.status == "failed"]),
			"success_rate": len([s for s in all_steps if s.status == "completed"]) / len(all_steps) if all_steps else 0,
			"average_step_duration": statistics.mean(durations) if durations else 0,
			"throughput_steps_per_hour": len(all_steps) / ((end_time - start_time).total_seconds() / 3600)
		}
	
	async def _analyze_step_performance_trends(
		self,
		start_time: datetime,
		end_time: datetime
	) -> Dict[str, Any]:
		"""Analyze step performance trends."""
		step_type_performance = defaultdict(list)
		
		for steps in self.workflow_steps.values():
			for step in steps:
				if (step.started_at and 
					start_time <= step.started_at <= end_time and 
					step.duration_seconds):
					step_type_performance[step.step_type].append(step.duration_seconds)
		
		trends = {}
		for step_type, durations in step_type_performance.items():
			if len(durations) >= 2:
				trends[step_type] = {
					"count": len(durations),
					"average_duration": statistics.mean(durations),
					"median_duration": statistics.median(durations),
					"std_deviation": statistics.stdev(durations) if len(durations) > 1 else 0
				}
		
		return trends
	
	async def _perform_trend_analysis(
		self,
		start_time: datetime,
		end_time: datetime
	) -> Dict[str, Any]:
		"""Perform trend analysis."""
		# Simplified trend analysis
		return {
			"overall_trend": "stable",
			"performance_trend": "improving",
			"error_rate_trend": "decreasing",
			"confidence": 0.7
		}
	
	async def _generate_performance_predictions(self) -> Dict[str, Any]:
		"""Generate performance predictions."""
		# Simplified predictions
		return {
			"next_hour_throughput": 10.0,
			"next_hour_latency": 2.5,
			"capacity_exhaustion_eta": None,
			"confidence": 0.6
		}
	
	async def _update_trend_analysis(self):
		"""Update trend analysis data."""
		# Update performance baselines
		for step_type, timings in self.step_timings.items():
			if len(timings) >= 10:
				recent_durations = [duration for _, duration in timings[-50:]]
				self.performance_baselines[step_type] = {
					"avg_duration": statistics.mean(recent_durations),
					"p95_duration": sorted(recent_durations)[int(len(recent_durations) * 0.95)],
					"last_updated": datetime.now()
				}
	
	async def _notify_monitoring_event(self, event_type: str, event_data: Dict[str, Any]):
		"""Notify subscribers of monitoring events."""
		for callback in self.monitoring_subscribers:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback({"event_type": event_type, **event_data})
				else:
					callback({"event_type": event_type, **event_data})
			except Exception as e:
				logger.error(f"Error in monitoring event callback: {e}")
	
	async def _notify_alert_event(self, event_type: str, alert: MonitoringAlert):
		"""Notify subscribers of alert events."""
		event_data = {
			"event_type": event_type,
			"alert_id": alert.alert_id,
			"workflow_instance_id": alert.workflow_instance_id,
			"alert_type": alert.alert_type.value,
			"severity": alert.severity,
			"title": alert.title,
			"timestamp": datetime.now().isoformat()
		}
		
		for callback in self.alert_subscribers:
			try:
				if asyncio.iscoroutinefunction(callback):
					await callback(event_data)
				else:
					callback(event_data)
			except Exception as e:
				logger.error(f"Error in alert event callback: {e}")
	
	async def cleanup(self):
		"""Clean up monitor resources."""
		await self.stop_monitoring()
		
		# Clear all data
		self.workflow_steps.clear()
		self.active_alerts.clear()
		self.resolved_alerts.clear()
		self.performance_metrics.clear()
		self.active_workflows.clear()
		self.workflow_start_times.clear()
		self.step_timings.clear()
		self.bottleneck_analyses.clear()
		self.performance_baselines.clear()
		self.anomaly_detection_windows.clear()
		self.sla_definitions.clear()
		self.sla_violations.clear()
		self.sla_compliance_history.clear()
		self.monitoring_subscribers.clear()
		self.alert_subscribers.clear()
		
		logger.info("WorkflowMonitor cleaned up")