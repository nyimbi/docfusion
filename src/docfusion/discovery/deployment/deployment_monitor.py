#!/usr/bin/env python3
"""
Deployment Monitoring System

Provides comprehensive monitoring and health checks for scraper deployments,
including performance tracking, error detection, alert management,
and automated recovery mechanisms.
"""

import asyncio
import json
import logging
import psutil
import aiohttp
from typing import Dict, List, Optional, Any, Callable, Set
from datetime import datetime, timedelta, timezone
from pathlib import Path
from enum import Enum
from dataclasses import dataclass
import tempfile

from pydantic import BaseModel, Field, validator
from ..generic.base_scraper import uuid7str

from .scraper_deployment import ScraperDeployment, DeploymentStatus, ScraperInstance
from ..crawlers.source_databases.global_source_db import GlobalSourceDB, ProcurementSource


class HealthStatus(Enum):
	"""Health check status"""
	HEALTHY = "healthy"
	WARNING = "warning" 
	CRITICAL = "critical"
	UNKNOWN = "unknown"


class AlertSeverity(Enum):
	"""Alert severity levels"""
	INFO = "info"
	WARNING = "warning"
	ERROR = "error"
	CRITICAL = "critical"


@dataclass
class MetricThreshold:
	"""Threshold definition for metrics"""
	warning_threshold: float
	critical_threshold: float
	comparison_operator: str = ">"  # >, <, >=, <=, ==, !=


class HealthCheck(BaseModel):
	"""Health check configuration and result"""
	check_id: str = Field(default_factory=uuid7str)
	name: str
	description: str
	target_type: str  # 'instance', 'deployment', 'system'
	target_id: Optional[str] = None
	
	# Check configuration
	check_interval_seconds: int = 300
	timeout_seconds: int = 30
	enabled: bool = True
	
	# Thresholds
	thresholds: Dict[str, MetricThreshold] = Field(default_factory=dict)
	
	# Last check results
	last_check_at: Optional[datetime] = None
	last_status: HealthStatus = HealthStatus.UNKNOWN
	last_metrics: Dict[str, float] = Field(default_factory=dict)
	last_error: Optional[str] = None
	
	# Statistics
	consecutive_failures: int = 0
	total_checks: int = 0
	total_failures: int = 0
	
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Alert(BaseModel):
	"""Monitoring alert"""
	alert_id: str = Field(default_factory=uuid7str)
	severity: AlertSeverity
	title: str
	message: str
	
	# Context
	source_type: str  # 'health_check', 'metric_threshold', 'system_event'
	source_id: Optional[str] = None
	target_type: Optional[str] = None  # 'instance', 'deployment', 'system'
	target_id: Optional[str] = None
	
	# Metadata
	metrics: Dict[str, Any] = Field(default_factory=dict)
	tags: List[str] = Field(default_factory=list)
	
	# Lifecycle
	created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	acknowledged_at: Optional[datetime] = None
	resolved_at: Optional[datetime] = None
	acknowledged_by: Optional[str] = None
	
	# Notification
	notification_channels: List[str] = Field(default_factory=list)
	notifications_sent: List[str] = Field(default_factory=list)


class MonitoringConfig(BaseModel):
	"""Configuration for monitoring system"""
	config_id: str = Field(default_factory=uuid7str)
	
	# System monitoring
	system_check_interval_seconds: int = 60
	instance_check_interval_seconds: int = 300
	deployment_check_interval_seconds: int = 600
	
	# Resource thresholds
	cpu_warning_threshold: float = 70.0
	cpu_critical_threshold: float = 90.0
	memory_warning_threshold: float = 80.0
	memory_critical_threshold: float = 95.0
	disk_warning_threshold: float = 85.0
	disk_critical_threshold: float = 95.0
	
	# Performance thresholds
	success_rate_warning_threshold: float = 0.8
	success_rate_critical_threshold: float = 0.6
	avg_response_time_warning_ms: float = 10000
	avg_response_time_critical_ms: float = 30000
	
	# Alert configuration
	max_alerts_per_hour: int = 50
	alert_suppression_window_minutes: int = 15
	enable_auto_recovery: bool = True
	
	# Notification channels
	notification_channels: Dict[str, Dict[str, Any]] = Field(default_factory=dict)


class DeploymentMonitor:
	"""
	Comprehensive monitoring system for scraper deployments
	"""
	
	def __init__(
		self,
		scraper_deployment: Optional[ScraperDeployment] = None,
		global_db: Optional[GlobalSourceDB] = None,
		config: Optional[MonitoringConfig] = None,
		monitoring_dir: Optional[Path] = None
	):
		self.logger = logging.getLogger(__name__)
		
		# Dependencies
		self.deployment = scraper_deployment
		self.global_db = global_db or GlobalSourceDB()
		self.config = config or MonitoringConfig()
		
		# Storage
		self.monitoring_dir = monitoring_dir or Path(tempfile.gettempdir()) / "deployment_monitoring"
		self.monitoring_dir.mkdir(exist_ok=True)
		
		# Monitoring state
		self.health_checks: Dict[str, HealthCheck] = {}
		self.alerts: Dict[str, Alert] = {}
		self.metrics_history: Dict[str, List[Dict[str, Any]]] = {}
		
		# Running tasks
		self.monitoring_tasks: Set[asyncio.Task] = set()
		self.is_monitoring = False
		
		# Statistics
		self.monitoring_stats = {
			'total_health_checks': 0,
			'failed_health_checks': 0,
			'alerts_generated': 0,
			'alerts_resolved': 0,
			'system_uptime_start': datetime.now(timezone.utc),
			'last_system_check': None,
			'monitoring_errors': 0
		}
		
		# Initialize default health checks
		self._initialize_default_health_checks()
	
	def _initialize_default_health_checks(self):
		"""Initialize default health checks"""
		
		# System health check
		system_check = HealthCheck(
			name="System Health",
			description="Monitor system resource usage",
			target_type="system",
			check_interval_seconds=self.config.system_check_interval_seconds,
			thresholds={
				'cpu_percent': MetricThreshold(
					warning_threshold=self.config.cpu_warning_threshold,
					critical_threshold=self.config.cpu_critical_threshold
				),
				'memory_percent': MetricThreshold(
					warning_threshold=self.config.memory_warning_threshold,
					critical_threshold=self.config.memory_critical_threshold
				),
				'disk_percent': MetricThreshold(
					warning_threshold=self.config.disk_warning_threshold,
					critical_threshold=self.config.disk_critical_threshold
				)
			}
		)
		self.health_checks[system_check.check_id] = system_check
		
		# Deployment overview check
		deployment_check = HealthCheck(
			name="Deployment Overview",
			description="Monitor overall deployment health",
			target_type="deployment",
			check_interval_seconds=self.config.deployment_check_interval_seconds,
			thresholds={
				'success_rate': MetricThreshold(
					warning_threshold=self.config.success_rate_warning_threshold,
					critical_threshold=self.config.success_rate_critical_threshold,
					comparison_operator="<"
				),
				'avg_response_time_ms': MetricThreshold(
					warning_threshold=self.config.avg_response_time_warning_ms,
					critical_threshold=self.config.avg_response_time_critical_ms
				)
			}
		)
		self.health_checks[deployment_check.check_id] = deployment_check
	
	async def start_monitoring(self):
		"""Start the monitoring system"""
		
		if self.is_monitoring:
			return
		
		self.is_monitoring = True
		self.logger.info("Starting deployment monitoring system")
		
		try:
			# Start health check tasks
			for health_check in self.health_checks.values():
				if health_check.enabled:
					task = asyncio.create_task(
						self._health_check_loop(health_check.check_id)
					)
					self.monitoring_tasks.add(task)
			
			# Start alert processing task
			alert_task = asyncio.create_task(self._alert_processing_loop())
			self.monitoring_tasks.add(alert_task)
			
			# Start metrics collection task
			metrics_task = asyncio.create_task(self._metrics_collection_loop())
			self.monitoring_tasks.add(metrics_task)
			
			self.logger.info(f"Started {len(self.monitoring_tasks)} monitoring tasks")
			
		except Exception as e:
			self.logger.error(f"Failed to start monitoring: {e}")
			self.is_monitoring = False
	
	async def stop_monitoring(self):
		"""Stop the monitoring system"""
		
		if not self.is_monitoring:
			return
		
		self.is_monitoring = False
		self.logger.info("Stopping deployment monitoring system")
		
		# Cancel all monitoring tasks
		for task in self.monitoring_tasks:
			task.cancel()
		
		# Wait for tasks to complete
		if self.monitoring_tasks:
			await asyncio.gather(*self.monitoring_tasks, return_exceptions=True)
		
		self.monitoring_tasks.clear()
		self.logger.info("Monitoring system stopped")
	
	async def _health_check_loop(self, check_id: str):
		"""Main loop for a specific health check"""
		
		while self.is_monitoring:
			try:
				health_check = self.health_checks.get(check_id)
				if not health_check or not health_check.enabled:
					break
				
				# Execute the health check
				await self._execute_health_check(health_check)
				
				# Sleep until next check
				await asyncio.sleep(health_check.check_interval_seconds)
				
			except asyncio.CancelledError:
				break
			except Exception as e:
				self.logger.error(f"Health check loop error for {check_id}: {e}")
				self.monitoring_stats['monitoring_errors'] += 1
				await asyncio.sleep(60)  # Wait 1 minute on error
	
	async def _execute_health_check(self, health_check: HealthCheck):
		"""Execute a single health check"""
		
		try:
			health_check.last_check_at = datetime.now(timezone.utc)
			health_check.total_checks += 1
			self.monitoring_stats['total_health_checks'] += 1
			
			# Collect metrics based on target type
			if health_check.target_type == "system":
				metrics = await self._collect_system_metrics()
			elif health_check.target_type == "deployment":
				metrics = await self._collect_deployment_metrics()
			elif health_check.target_type == "instance":
				metrics = await self._collect_instance_metrics(health_check.target_id)
			else:
				self.logger.warning(f"Unknown target type: {health_check.target_type}")
				return
			
			health_check.last_metrics = metrics
			
			# Evaluate thresholds
			status, violations = self._evaluate_thresholds(health_check, metrics)
			health_check.last_status = status
			
			# Handle status changes
			if status in [HealthStatus.WARNING, HealthStatus.CRITICAL]:
				health_check.consecutive_failures += 1
				health_check.total_failures += 1
				self.monitoring_stats['failed_health_checks'] += 1
				
				# Generate alerts for violations
				for metric, threshold_info in violations:
					await self._generate_threshold_alert(health_check, metric, metrics[metric], threshold_info)
			else:
				health_check.consecutive_failures = 0
				health_check.last_error = None
			
			self.logger.debug(f"Health check {health_check.name}: {status.value}")
			
		except Exception as e:
			health_check.last_error = str(e)
			health_check.last_status = HealthStatus.UNKNOWN
			health_check.consecutive_failures += 1
			health_check.total_failures += 1
			self.logger.error(f"Health check execution failed for {health_check.name}: {e}")
	
	async def _collect_system_metrics(self) -> Dict[str, float]:
		"""Collect system-level metrics"""
		
		metrics = {}
		
		try:
			# CPU usage
			cpu_percent = psutil.cpu_percent(interval=1)
			metrics['cpu_percent'] = cpu_percent
			
			# Memory usage
			memory = psutil.virtual_memory()
			metrics['memory_percent'] = memory.percent
			metrics['memory_used_gb'] = memory.used / (1024**3)
			metrics['memory_available_gb'] = memory.available / (1024**3)
			
			# Disk usage
			disk = psutil.disk_usage('/')
			metrics['disk_percent'] = (disk.used / disk.total) * 100
			metrics['disk_used_gb'] = disk.used / (1024**3)
			metrics['disk_free_gb'] = disk.free / (1024**3)
			
			# Load average (Unix systems)
			try:
				load_avg = psutil.getloadavg()
				metrics['load_avg_1min'] = load_avg[0]
				metrics['load_avg_5min'] = load_avg[1]
				metrics['load_avg_15min'] = load_avg[2]
			except AttributeError:
				pass  # Not available on all systems
			
			# Network I/O
			net_io = psutil.net_io_counters()
			metrics['network_bytes_sent'] = net_io.bytes_sent
			metrics['network_bytes_recv'] = net_io.bytes_recv
			
			# Process count
			metrics['process_count'] = len(psutil.pids())
			
		except Exception as e:
			self.logger.error(f"System metrics collection failed: {e}")
		
		return metrics
	
	async def _collect_deployment_metrics(self) -> Dict[str, float]:
		"""Collect deployment-level metrics"""
		
		metrics = {}
		
		try:
			if not self.deployment:
				return metrics
			
			# Get deployment statistics
			stats = self.deployment.get_deployment_stats()
			
			# Convert stats to metrics
			total_jobs = stats.get('successful_jobs', 0) + stats.get('failed_jobs', 0)
			metrics['success_rate'] = stats.get('successful_jobs', 0) / max(total_jobs, 1)
			metrics['total_deployments'] = stats.get('total_deployments', 0)
			metrics['active_instances'] = stats.get('current_active_instances', 0)
			metrics['total_opportunities'] = stats.get('total_opportunities_extracted', 0)
			metrics['jobs_last_24h'] = stats.get('jobs_last_24h', 0)
			metrics['opportunities_last_24h'] = stats.get('opportunities_last_24h', 0)
			
			# Calculate average response time from recent deployments
			deployment_statuses = self.deployment.get_all_deployments_status()
			if deployment_statuses:
				avg_runtime = sum(
					status.get('average_runtime_seconds', 0) 
					for status in deployment_statuses
				) / len(deployment_statuses)
				metrics['avg_response_time_ms'] = avg_runtime * 1000
				
				# Active deployment metrics
				active_deployments = [
					status for status in deployment_statuses
					if status.get('status') == 'active'
				]
				metrics['active_deployment_count'] = len(active_deployments)
				
				# Error rate
				total_runs = sum(status.get('total_runs', 0) for status in deployment_statuses)
				failed_runs = sum(status.get('failed_runs', 0) for status in deployment_statuses)
				metrics['error_rate'] = failed_runs / max(total_runs, 1)
			
		except Exception as e:
			self.logger.error(f"Deployment metrics collection failed: {e}")
		
		return metrics
	
	async def _collect_instance_metrics(self, instance_id: Optional[str]) -> Dict[str, float]:
		"""Collect instance-specific metrics"""
		
		metrics = {}
		
		try:
			if not self.deployment or not instance_id:
				return metrics
			
			# Find the instance
			instance = self.deployment.instances.get(instance_id)
			if not instance:
				return metrics
			
			# Instance performance metrics
			metrics['total_runs'] = float(instance.total_runs)
			metrics['successful_runs'] = float(instance.successful_runs)
			metrics['failed_runs'] = float(instance.failed_runs)
			metrics['success_rate'] = instance.successful_runs / max(instance.total_runs, 1)
			metrics['average_runtime_seconds'] = instance.average_runtime_seconds
			metrics['opportunities_extracted'] = float(instance.opportunities_extracted_total)
			metrics['is_running'] = 1.0 if instance.is_running else 0.0
			
			# Time-based metrics
			now = datetime.now(timezone.utc)
			if instance.last_run_at:
				metrics['minutes_since_last_run'] = (now - instance.last_run_at).total_seconds() / 60
			
			if instance.next_run_at:
				metrics['minutes_until_next_run'] = (instance.next_run_at - now).total_seconds() / 60
			
			# Resource usage (if available)
			metrics['memory_usage_mb'] = instance.memory_usage_mb
			metrics['cpu_usage_percent'] = instance.cpu_usage_percent
			
		except Exception as e:
			self.logger.error(f"Instance metrics collection failed for {instance_id}: {e}")
		
		return metrics
	
	def _evaluate_thresholds(
		self,
		health_check: HealthCheck,
		metrics: Dict[str, float]
	) -> tuple[HealthStatus, List[tuple[str, MetricThreshold]]]:
		"""Evaluate metrics against thresholds"""
		
		status = HealthStatus.HEALTHY
		violations = []
		
		for metric_name, threshold in health_check.thresholds.items():
			if metric_name not in metrics:
				continue
			
			metric_value = metrics[metric_name]
			violated = False
			is_critical = False
			
			# Evaluate threshold based on comparison operator
			op = threshold.comparison_operator
			
			if op == ">":
				if metric_value > threshold.critical_threshold:
					violated = True
					is_critical = True
				elif metric_value > threshold.warning_threshold:
					violated = True
			elif op == "<":
				if metric_value < threshold.critical_threshold:
					violated = True
					is_critical = True
				elif metric_value < threshold.warning_threshold:
					violated = True
			elif op == ">=":
				if metric_value >= threshold.critical_threshold:
					violated = True
					is_critical = True
				elif metric_value >= threshold.warning_threshold:
					violated = True
			elif op == "<=":
				if metric_value <= threshold.critical_threshold:
					violated = True
					is_critical = True
				elif metric_value <= threshold.warning_threshold:
					violated = True
			
			if violated:
				violations.append((metric_name, threshold))
				
				if is_critical:
					status = HealthStatus.CRITICAL
				elif status != HealthStatus.CRITICAL:
					status = HealthStatus.WARNING
		
		return status, violations
	
	async def _generate_threshold_alert(
		self,
		health_check: HealthCheck,
		metric_name: str,
		metric_value: float,
		threshold: MetricThreshold
	):
		"""Generate an alert for a threshold violation"""
		
		try:
			# Determine severity
			is_critical = (
				(threshold.comparison_operator == ">" and metric_value > threshold.critical_threshold) or
				(threshold.comparison_operator == "<" and metric_value < threshold.critical_threshold) or
				(threshold.comparison_operator == ">=" and metric_value >= threshold.critical_threshold) or
				(threshold.comparison_operator == "<=" and metric_value <= threshold.critical_threshold)
			)
			
			severity = AlertSeverity.CRITICAL if is_critical else AlertSeverity.WARNING
			
			# Create alert
			alert = Alert(
				severity=severity,
				title=f"Threshold Violation: {metric_name}",
				message=f"{health_check.name} - {metric_name} is {metric_value:.2f}, "
						f"threshold: {threshold.warning_threshold:.2f} (warning), "
						f"{threshold.critical_threshold:.2f} (critical)",
				source_type="health_check",
				source_id=health_check.check_id,
				target_type=health_check.target_type,
				target_id=health_check.target_id,
				metrics={
					metric_name: metric_value,
					'warning_threshold': threshold.warning_threshold,
					'critical_threshold': threshold.critical_threshold
				},
				tags=[health_check.target_type, metric_name, severity.value]
			)
			
			await self._process_alert(alert)
			
		except Exception as e:
			self.logger.error(f"Failed to generate threshold alert: {e}")
	
	async def _process_alert(self, alert: Alert):
		"""Process and store an alert"""
		
		try:
			# Check for suppression (avoid duplicate alerts)
			suppression_window = timedelta(minutes=self.config.alert_suppression_window_minutes)
			recent_cutoff = datetime.now(timezone.utc) - suppression_window
			
			similar_alerts = [
				existing_alert for existing_alert in self.alerts.values()
				if (existing_alert.title == alert.title and
					existing_alert.target_id == alert.target_id and
					existing_alert.created_at > recent_cutoff and
					existing_alert.resolved_at is None)
			]
			
			if similar_alerts:
				self.logger.debug(f"Alert suppressed: {alert.title}")
				return
			
			# Store the alert
			self.alerts[alert.alert_id] = alert
			self.monitoring_stats['alerts_generated'] += 1
			
			# Send notifications
			await self._send_alert_notifications(alert)
			
			self.logger.warning(f"Alert generated: [{alert.severity.value}] {alert.title}")
			
		except Exception as e:
			self.logger.error(f"Alert processing failed: {e}")
	
	async def _send_alert_notifications(self, alert: Alert):
		"""Send alert notifications to configured channels"""
		
		try:
			# Get notification channels from config
			for channel_name, channel_config in self.config.notification_channels.items():
				if channel_config.get('enabled', True):
					try:
						await self._send_notification(alert, channel_name, channel_config)
						alert.notifications_sent.append(channel_name)
					except Exception as e:
						self.logger.error(f"Failed to send notification to {channel_name}: {e}")
		
		except Exception as e:
			self.logger.error(f"Notification sending failed: {e}")
	
	async def _send_notification(self, alert: Alert, channel_name: str, channel_config: Dict[str, Any]):
		"""Send notification to a specific channel"""
		
		channel_type = channel_config.get('type', 'log')
		
		if channel_type == 'log':
			# Log notification
			log_level = logging.ERROR if alert.severity in [AlertSeverity.ERROR, AlertSeverity.CRITICAL] else logging.WARNING
			self.logger.log(log_level, f"[ALERT] {alert.title}: {alert.message}")
		
		elif channel_type == 'webhook':
			# Webhook notification
			webhook_url = channel_config.get('url')
			if webhook_url:
				await self._send_webhook_notification(alert, webhook_url, channel_config)
		
		elif channel_type == 'email':
			# Email notification (would require email configuration)
			self.logger.info(f"Email notification would be sent to {channel_config.get('recipients', [])}")
		
		else:
			self.logger.warning(f"Unknown notification channel type: {channel_type}")
	
	async def _send_webhook_notification(self, alert: Alert, webhook_url: str, config: Dict[str, Any]):
		"""Send webhook notification"""
		
		try:
			payload = {
				'alert_id': alert.alert_id,
				'severity': alert.severity.value,
				'title': alert.title,
				'message': alert.message,
				'created_at': alert.created_at.isoformat(),
				'target_type': alert.target_type,
				'target_id': alert.target_id,
				'metrics': alert.metrics,
				'tags': alert.tags
			}
			
			timeout = config.get('timeout', 10)
			
			async with aiohttp.ClientSession() as session:
				async with session.post(
					webhook_url,
					json=payload,
					timeout=aiohttp.ClientTimeout(total=timeout)
				) as response:
					if response.status != 200:
						self.logger.warning(f"Webhook returned status {response.status}")
					else:
						self.logger.debug(f"Webhook notification sent successfully")
		
		except Exception as e:
			self.logger.error(f"Webhook notification failed: {e}")
	
	async def _alert_processing_loop(self):
		"""Background loop for alert processing"""
		
		while self.is_monitoring:
			try:
				# Process auto-recovery
				if self.config.enable_auto_recovery:
					await self._process_auto_recovery()
				
				# Clean up old resolved alerts
				await self._cleanup_old_alerts()
				
				# Sleep for a while
				await asyncio.sleep(300)  # Check every 5 minutes
				
			except asyncio.CancelledError:
				break
			except Exception as e:
				self.logger.error(f"Alert processing loop error: {e}")
				await asyncio.sleep(60)
	
	async def _process_auto_recovery(self):
		"""Process automatic recovery for critical alerts"""
		
		try:
			# Find critical unresolved alerts
			critical_alerts = [
				alert for alert in self.alerts.values()
				if (alert.severity == AlertSeverity.CRITICAL and
					alert.resolved_at is None and
					alert.target_type == "instance")
			]
			
			for alert in critical_alerts:
				if alert.target_id and self.deployment:
					# Try to restart failed instance
					instance = self.deployment.instances.get(alert.target_id)
					if instance and instance.status == DeploymentStatus.FAILED:
						self.logger.info(f"Attempting auto-recovery for instance {alert.target_id}")
						
						# Try to resume the deployment
						success = await self.deployment.resume_deployment(instance.deployment_id)
						
						if success:
							# Mark alert as resolved
							alert.resolved_at = datetime.now(timezone.utc)
							alert.acknowledged_by = "auto_recovery"
							self.monitoring_stats['alerts_resolved'] += 1
							
							self.logger.info(f"Auto-recovery successful for {alert.target_id}")
		
		except Exception as e:
			self.logger.error(f"Auto-recovery processing failed: {e}")
	
	async def _cleanup_old_alerts(self):
		"""Clean up old resolved alerts"""
		
		try:
			# Remove alerts older than 30 days
			cutoff = datetime.now(timezone.utc) - timedelta(days=30)
			
			alerts_to_remove = [
				alert_id for alert_id, alert in self.alerts.items()
				if (alert.resolved_at and alert.resolved_at < cutoff)
			]
			
			for alert_id in alerts_to_remove:
				del self.alerts[alert_id]
			
			if alerts_to_remove:
				self.logger.debug(f"Cleaned up {len(alerts_to_remove)} old alerts")
		
		except Exception as e:
			self.logger.error(f"Alert cleanup failed: {e}")
	
	async def _metrics_collection_loop(self):
		"""Background loop for metrics collection and storage"""
		
		while self.is_monitoring:
			try:
				# Collect and store metrics history
				timestamp = datetime.now(timezone.utc)
				
				# System metrics
				system_metrics = await self._collect_system_metrics()
				self._store_metrics_history("system", timestamp, system_metrics)
				
				# Deployment metrics
				deployment_metrics = await self._collect_deployment_metrics()
				self._store_metrics_history("deployment", timestamp, deployment_metrics)
				
				# Instance metrics
				if self.deployment:
					for instance_id in self.deployment.instances.keys():
						instance_metrics = await self._collect_instance_metrics(instance_id)
						self._store_metrics_history(f"instance_{instance_id}", timestamp, instance_metrics)
				
				self.monitoring_stats['last_system_check'] = timestamp
				
				# Sleep until next collection
				await asyncio.sleep(self.config.system_check_interval_seconds)
				
			except asyncio.CancelledError:
				break
			except Exception as e:
				self.logger.error(f"Metrics collection loop error: {e}")
				await asyncio.sleep(60)
	
	def _store_metrics_history(self, target: str, timestamp: datetime, metrics: Dict[str, float]):
		"""Store metrics in history for trending"""
		
		if target not in self.metrics_history:
			self.metrics_history[target] = []
		
		history_entry = {
			'timestamp': timestamp,
			'metrics': metrics
		}
		
		self.metrics_history[target].append(history_entry)
		
		# Keep only last 24 hours of data
		cutoff = timestamp - timedelta(hours=24)
		self.metrics_history[target] = [
			entry for entry in self.metrics_history[target]
			if entry['timestamp'] > cutoff
		]
	
	def get_monitoring_dashboard_data(self) -> Dict[str, Any]:
		"""Get data for monitoring dashboard"""
		
		dashboard_data = {
			'monitoring_stats': self.monitoring_stats.copy(),
			'system_status': {},
			'deployment_status': {},
			'active_alerts': [],
			'recent_metrics': {}
		}
		
		try:
			# System status
			system_checks = [hc for hc in self.health_checks.values() if hc.target_type == "system"]
			if system_checks:
				system_check = system_checks[0]
				dashboard_data['system_status'] = {
					'status': system_check.last_status.value,
					'metrics': system_check.last_metrics,
					'last_check': system_check.last_check_at,
					'consecutive_failures': system_check.consecutive_failures
				}
			
			# Deployment status
			deployment_checks = [hc for hc in self.health_checks.values() if hc.target_type == "deployment"]
			if deployment_checks:
				deployment_check = deployment_checks[0]
				dashboard_data['deployment_status'] = {
					'status': deployment_check.last_status.value,
					'metrics': deployment_check.last_metrics,
					'last_check': deployment_check.last_check_at,
					'consecutive_failures': deployment_check.consecutive_failures
				}
			
			# Active alerts
			active_alerts = [
				{
					'alert_id': alert.alert_id,
					'severity': alert.severity.value,
					'title': alert.title,
					'message': alert.message,
					'created_at': alert.created_at,
					'target_type': alert.target_type,
					'target_id': alert.target_id
				}
				for alert in self.alerts.values()
				if alert.resolved_at is None
			]
			dashboard_data['active_alerts'] = sorted(active_alerts, key=lambda x: x['created_at'], reverse=True)
			
			# Recent metrics (last hour)
			for target, history in self.metrics_history.items():
				if history:
					recent_entry = history[-1]  # Most recent
					dashboard_data['recent_metrics'][target] = {
						'timestamp': recent_entry['timestamp'],
						'metrics': recent_entry['metrics']
					}
		
		except Exception as e:
			self.logger.error(f"Dashboard data generation failed: {e}")
		
		return dashboard_data
	
	async def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
		"""Acknowledge an alert"""
		
		try:
			if alert_id in self.alerts:
				alert = self.alerts[alert_id]
				alert.acknowledged_at = datetime.now(timezone.utc)
				alert.acknowledged_by = acknowledged_by
				return True
			return False
		
		except Exception as e:
			self.logger.error(f"Failed to acknowledge alert {alert_id}: {e}")
			return False
	
	async def resolve_alert(self, alert_id: str) -> bool:
		"""Resolve an alert"""
		
		try:
			if alert_id in self.alerts:
				alert = self.alerts[alert_id]
				alert.resolved_at = datetime.now(timezone.utc)
				self.monitoring_stats['alerts_resolved'] += 1
				return True
			return False
		
		except Exception as e:
			self.logger.error(f"Failed to resolve alert {alert_id}: {e}")
			return False
	
	async def add_health_check(self, health_check: HealthCheck) -> str:
		"""Add a new health check"""
		
		try:
			self.health_checks[health_check.check_id] = health_check
			
			# Start monitoring task if system is running
			if self.is_monitoring and health_check.enabled:
				task = asyncio.create_task(
					self._health_check_loop(health_check.check_id)
				)
				self.monitoring_tasks.add(task)
			
			self.logger.info(f"Added health check: {health_check.name}")
			return health_check.check_id
		
		except Exception as e:
			self.logger.error(f"Failed to add health check: {e}")
			raise
	
	def get_monitoring_stats(self) -> Dict[str, Any]:
		"""Get monitoring system statistics"""
		
		stats = self.monitoring_stats.copy()
		
		# Add current state
		stats.update({
			'is_monitoring': self.is_monitoring,
			'active_health_checks': len([hc for hc in self.health_checks.values() if hc.enabled]),
			'total_health_checks': len(self.health_checks),
			'active_alerts': len([alert for alert in self.alerts.values() if alert.resolved_at is None]),
			'total_alerts': len(self.alerts),
			'monitoring_tasks': len(self.monitoring_tasks)
		})
		
		# Uptime
		if stats['system_uptime_start']:
			uptime_seconds = (datetime.now(timezone.utc) - stats['system_uptime_start']).total_seconds()
			stats['system_uptime_hours'] = uptime_seconds / 3600
		
		return stats
	
	async def cleanup(self):
		"""Clean up monitoring resources"""
		
		try:
			await self.stop_monitoring()
			self.logger.info("DeploymentMonitor cleanup completed")
		
		except Exception as e:
			self.logger.error(f"Cleanup failed: {e}")


# Factory function
def create_deployment_monitor(
	scraper_deployment: Optional[ScraperDeployment] = None,
	global_db: Optional[GlobalSourceDB] = None,
	config: Optional[MonitoringConfig] = None
) -> DeploymentMonitor:
	"""Create a DeploymentMonitor instance"""
	return DeploymentMonitor(scraper_deployment, global_db, config)