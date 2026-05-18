#!/usr/bin/env python3
"""
Performance Dashboard

Provides comprehensive performance monitoring and visualization
for the Discovery Engine, including scraper metrics, deployment health,
data quality tracking, and real-time monitoring capabilities.
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
from collections import defaultdict, deque
import statistics

from pydantic import BaseModel, Field
from ...core.utils import uuid7str

from ..deployment.scraper_deployment import ScraperDeployment
from ..deployment.deployment_monitor import DeploymentMonitor
from ..crawlers.source_databases.global_source_db import GlobalSourceDB
from ..crawlers.ai_driven.structure_learner import StructureLearner


class DashboardMetrics(BaseModel):
	"""Dashboard metrics data structure"""
	timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	
	# System metrics
	system_cpu_percent: float = 0.0
	system_memory_percent: float = 0.0
	system_disk_percent: float = 0.0
	
	# Deployment metrics
	total_deployments: int = 0
	active_deployments: int = 0
	failed_deployments: int = 0
	deployment_success_rate: float = 0.0
	
	# Scraping metrics
	total_scraping_jobs: int = 0
	successful_jobs: int = 0
	failed_jobs: int = 0
	jobs_success_rate: float = 0.0
	avg_job_duration_seconds: float = 0.0
	
	# Data quality metrics
	total_opportunities_extracted: int = 0
	opportunities_per_hour: float = 0.0
	unique_sources_active: int = 0
	data_quality_score: float = 0.0
	
	# Performance metrics
	avg_response_time_ms: float = 0.0
	requests_per_minute: float = 0.0
	error_rate_percent: float = 0.0
	
	# Alert metrics
	active_alerts: int = 0
	critical_alerts: int = 0
	warning_alerts: int = 0
	alerts_resolved_today: int = 0


class PerformanceChart(BaseModel):
	"""Performance chart data"""
	chart_id: str = Field(default_factory=uuid7str)
	title: str
	chart_type: str  # 'line', 'bar', 'pie', 'gauge'
	data_points: List[Dict[str, Any]] = Field(default_factory=list)
	labels: List[str] = Field(default_factory=list)
	metadata: Dict[str, Any] = Field(default_factory=dict)
	last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DashboardConfig(BaseModel):
	"""Dashboard configuration"""
	config_id: str = Field(default_factory=uuid7str)
	
	# Update intervals
	metrics_update_interval_seconds: int = 30
	charts_update_interval_seconds: int = 60
	dashboard_refresh_interval_seconds: int = 10
	
	# Data retention
	metrics_history_hours: int = 24
	chart_data_points_max: int = 100
	
	# Display settings
	enable_real_time_updates: bool = True
	show_system_metrics: bool = True
	show_deployment_metrics: bool = True
	show_performance_charts: bool = True
	show_alerts_panel: bool = True
	
	# Chart configurations
	chart_configs: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
	
	# Notification settings
	enable_dashboard_alerts: bool = True
	critical_threshold_notifications: bool = True


class PerformanceDashboard:
	"""
	Comprehensive performance dashboard for the Discovery Engine
	"""
	
	def __init__(
		self,
		scraper_deployment: Optional[ScraperDeployment] = None,
		deployment_monitor: Optional[DeploymentMonitor] = None,
		global_db: Optional[GlobalSourceDB] = None,
		structure_learner: Optional[StructureLearner] = None,
		config: Optional[DashboardConfig] = None,
		dashboard_dir: Optional[Path] = None
	):
		self.logger = logging.getLogger(__name__)
		
		# Dependencies
		self.deployment = scraper_deployment
		self.monitor = deployment_monitor
		self.global_db = global_db or GlobalSourceDB()
		self.structure_learner = structure_learner
		self.config = config or DashboardConfig()
		
		# Storage
		self.dashboard_dir = dashboard_dir or Path(tempfile.gettempdir()) / "dashboard"
		self.dashboard_dir.mkdir(exist_ok=True)
		
		# Dashboard state
		self.current_metrics: Optional[DashboardMetrics] = None
		self.metrics_history: deque = deque(maxlen=1000)  # Last 1000 metric points
		self.charts: Dict[str, PerformanceChart] = {}
		
		# Background tasks
		self.dashboard_tasks: List[asyncio.Task] = []
		self.is_running = False
		
		# Performance tracking
		self.dashboard_stats = {
			'dashboard_start_time': datetime.now(timezone.utc),
			'total_metrics_collected': 0,
			'charts_generated': 0,
			'dashboard_errors': 0,
			'last_metrics_update': None,
			'last_charts_update': None
		}
		
		# Initialize charts
		self._initialize_charts()
	
	def _initialize_charts(self):
		"""Initialize dashboard charts"""
		
		# System resource utilization chart
		self.charts['system_resources'] = PerformanceChart(
			title="System Resource Utilization",
			chart_type="line",
			metadata={
				'y_axis_label': 'Percentage',
				'lines': ['CPU', 'Memory', 'Disk'],
				'color_scheme': ['#ff6b6b', '#4ecdc4', '#45b7d1']
			}
		)
		
		# Scraping performance chart
		self.charts['scraping_performance'] = PerformanceChart(
			title="Scraping Performance",
			chart_type="line",
			metadata={
				'y_axis_label': 'Jobs per Hour',
				'lines': ['Successful Jobs', 'Failed Jobs'],
				'color_scheme': ['#2ecc71', '#e74c3c']
			}
		)
		
		# Deployment status pie chart
		self.charts['deployment_status'] = PerformanceChart(
			title="Deployment Status Distribution",
			chart_type="pie",
			metadata={
				'color_scheme': ['#2ecc71', '#f39c12', '#e74c3c', '#95a5a6']
			}
		)
		
		# Response time trend
		self.charts['response_times'] = PerformanceChart(
			title="Average Response Time Trend",
			chart_type="line",
			metadata={
				'y_axis_label': 'Response Time (ms)',
				'lines': ['Avg Response Time'],
				'color_scheme': ['#3498db']
			}
		)
		
		# Opportunities extracted
		self.charts['opportunities_extracted'] = PerformanceChart(
			title="Opportunities Extracted Over Time",
			chart_type="bar",
			metadata={
				'y_axis_label': 'Opportunities Count',
				'color_scheme': ['#9b59b6']
			}
		)
		
		# Error rate gauge
		self.charts['error_rate'] = PerformanceChart(
			title="Current Error Rate",
			chart_type="gauge",
			metadata={
				'max_value': 100,
				'zones': [
					{'min': 0, 'max': 5, 'color': '#2ecc71'},    # Good
					{'min': 5, 'max': 15, 'color': '#f39c12'},   # Warning
					{'min': 15, 'max': 100, 'color': '#e74c3c'}  # Critical
				]
			}
		)
		
		# Data quality trend
		self.charts['data_quality'] = PerformanceChart(
			title="Data Quality Score Trend",
			chart_type="line",
			metadata={
				'y_axis_label': 'Quality Score (0-100)',
				'lines': ['Quality Score'],
				'color_scheme': ['#1abc9c']
			}
		)
	
	async def start_dashboard(self):
		"""Start the dashboard background tasks"""
		
		if self.is_running:
			return
		
		self.is_running = True
		self.logger.info("Starting performance dashboard")
		
		try:
			# Start metrics collection task
			metrics_task = asyncio.create_task(self._metrics_collection_loop())
			self.dashboard_tasks.append(metrics_task)
			
			# Start charts update task
			charts_task = asyncio.create_task(self._charts_update_loop())
			self.dashboard_tasks.append(charts_task)
			
			# Start dashboard data export task
			export_task = asyncio.create_task(self._data_export_loop())
			self.dashboard_tasks.append(export_task)
			
			self.logger.info(f"Started {len(self.dashboard_tasks)} dashboard tasks")
			
		except Exception as e:
			self.logger.error(f"Failed to start dashboard: {e}")
			self.is_running = False
	
	async def stop_dashboard(self):
		"""Stop the dashboard background tasks"""
		
		if not self.is_running:
			return
		
		self.is_running = False
		self.logger.info("Stopping performance dashboard")
		
		# Cancel all tasks
		for task in self.dashboard_tasks:
			task.cancel()
		
		# Wait for tasks to complete
		if self.dashboard_tasks:
			await asyncio.gather(*self.dashboard_tasks, return_exceptions=True)
		
		self.dashboard_tasks.clear()
		self.logger.info("Dashboard stopped")
	
	async def _metrics_collection_loop(self):
		"""Background loop for collecting dashboard metrics"""
		
		while self.is_running:
			try:
				# Collect current metrics
				metrics = await self._collect_dashboard_metrics()
				
				# Store metrics
				self.current_metrics = metrics
				self.metrics_history.append(metrics)
				
				# Update stats
				self.dashboard_stats['total_metrics_collected'] += 1
				self.dashboard_stats['last_metrics_update'] = datetime.now(timezone.utc)
				
				# Sleep until next collection
				await asyncio.sleep(self.config.metrics_update_interval_seconds)
				
			except asyncio.CancelledError:
				break
			except Exception as e:
				self.logger.error(f"Metrics collection error: {e}")
				self.dashboard_stats['dashboard_errors'] += 1
				await asyncio.sleep(60)  # Wait 1 minute on error
	
	async def _collect_dashboard_metrics(self) -> DashboardMetrics:
		"""Collect comprehensive dashboard metrics"""
		
		metrics = DashboardMetrics()
		
		try:
			# Get monitoring data
			if self.monitor:
				monitor_data = self.monitor.get_monitoring_dashboard_data()
				
				# System metrics
				system_status = monitor_data.get('system_status', {})
				system_metrics = system_status.get('metrics', {})
				metrics.system_cpu_percent = system_metrics.get('cpu_percent', 0.0)
				metrics.system_memory_percent = system_metrics.get('memory_percent', 0.0)
				metrics.system_disk_percent = system_metrics.get('disk_percent', 0.0)
				
				# Deployment metrics
				deployment_status = monitor_data.get('deployment_status', {})
				deployment_metrics = deployment_status.get('metrics', {})
				metrics.deployment_success_rate = deployment_metrics.get('success_rate', 0.0)
				metrics.avg_response_time_ms = deployment_metrics.get('avg_response_time_ms', 0.0)
				metrics.error_rate_percent = deployment_metrics.get('error_rate', 0.0) * 100
				
				# Alert metrics
				active_alerts = monitor_data.get('active_alerts', [])
				metrics.active_alerts = len(active_alerts)
				metrics.critical_alerts = len([a for a in active_alerts if a.get('severity') == 'critical'])
				metrics.warning_alerts = len([a for a in active_alerts if a.get('severity') == 'warning'])
			
			# Get deployment data
			if self.deployment:
				deployment_stats = self.deployment.get_deployment_stats()
				
				metrics.total_deployments = deployment_stats.get('total_deployments', 0)
				metrics.active_deployments = deployment_stats.get('current_active_instances', 0)
				metrics.total_scraping_jobs = deployment_stats.get('total_jobs_run', 0)
				metrics.successful_jobs = deployment_stats.get('successful_jobs', 0)
				metrics.failed_jobs = deployment_stats.get('failed_jobs', 0)
				
				if metrics.total_scraping_jobs > 0:
					metrics.jobs_success_rate = metrics.successful_jobs / metrics.total_scraping_jobs
				
				metrics.total_opportunities_extracted = deployment_stats.get('total_opportunities_extracted', 0)
				
				# Calculate opportunities per hour
				jobs_last_24h = deployment_stats.get('jobs_last_24h', 0)
				opportunities_last_24h = deployment_stats.get('opportunities_last_24h', 0)
				if jobs_last_24h > 0:
					metrics.opportunities_per_hour = opportunities_last_24h / 24
			
			# Get database metrics
			if self.global_db:
				try:
					all_sources = await self.global_db.get_all_sources()
					active_sources = [s for s in all_sources if s.status.value == 'active']
					metrics.unique_sources_active = len(active_sources)
					
					# Calculate data quality score based on source health
					if active_sources:
						avg_health = sum(s.health_score for s in active_sources) / len(active_sources)
						metrics.data_quality_score = avg_health * 100
				except Exception as e:
					self.logger.warning(f"Failed to get database metrics: {e}")
			
			# Calculate additional metrics
			if self.structure_learner:
				try:
					learning_stats = self.structure_learner.get_learning_stats()
					# Factor in prediction accuracy for data quality
					prediction_accuracy = learning_stats.get('prediction_accuracy', 0.5)
					metrics.data_quality_score = (metrics.data_quality_score + prediction_accuracy * 100) / 2
				except Exception as e:
					self.logger.warning(f"Failed to get learning stats: {e}")
			
		except Exception as e:
			self.logger.error(f"Dashboard metrics collection failed: {e}")
		
		return metrics
	
	async def _charts_update_loop(self):
		"""Background loop for updating dashboard charts"""
		
		while self.is_running:
			try:
				# Update all charts
				await self._update_all_charts()
				
				# Update stats
				self.dashboard_stats['charts_generated'] += len(self.charts)
				self.dashboard_stats['last_charts_update'] = datetime.now(timezone.utc)
				
				# Sleep until next update
				await asyncio.sleep(self.config.charts_update_interval_seconds)
				
			except asyncio.CancelledError:
				break
			except Exception as e:
				self.logger.error(f"Charts update error: {e}")
				self.dashboard_stats['dashboard_errors'] += 1
				await asyncio.sleep(120)  # Wait 2 minutes on error
	
	async def _update_all_charts(self):
		"""Update all dashboard charts"""
		
		try:
			# Update system resources chart
			await self._update_system_resources_chart()
			
			# Update scraping performance chart
			await self._update_scraping_performance_chart()
			
			# Update deployment status chart
			await self._update_deployment_status_chart()
			
			# Update response time chart
			await self._update_response_times_chart()
			
			# Update opportunities chart
			await self._update_opportunities_chart()
			
			# Update error rate gauge
			await self._update_error_rate_gauge()
			
			# Update data quality chart
			await self._update_data_quality_chart()
			
		except Exception as e:
			self.logger.error(f"Chart updates failed: {e}")
	
	async def _update_system_resources_chart(self):
		"""Update system resources chart"""
		
		try:
			chart = self.charts['system_resources']
			
			# Get recent metrics
			recent_metrics = list(self.metrics_history)[-50:]  # Last 50 points
			
			chart.data_points = []
			chart.labels = []
			
			for i, metrics in enumerate(recent_metrics):
				timestamp_str = metrics.timestamp.strftime('%H:%M:%S')
				chart.labels.append(timestamp_str)
				
				chart.data_points.append({
					'timestamp': timestamp_str,
					'CPU': metrics.system_cpu_percent,
					'Memory': metrics.system_memory_percent,
					'Disk': metrics.system_disk_percent
				})
			
			chart.last_updated = datetime.now(timezone.utc)
			
		except Exception as e:
			self.logger.error(f"System resources chart update failed: {e}")
	
	async def _update_scraping_performance_chart(self):
		"""Update scraping performance chart"""
		
		try:
			chart = self.charts['scraping_performance']
			
			# Calculate job rates from metrics history
			recent_metrics = list(self.metrics_history)[-30:]  # Last 30 points
			
			chart.data_points = []
			chart.labels = []
			
			for i, metrics in enumerate(recent_metrics):
				timestamp_str = metrics.timestamp.strftime('%H:%M')
				chart.labels.append(timestamp_str)
				
				# Calculate jobs per hour (approximate)
				successful_rate = metrics.successful_jobs * 2 if metrics.total_scraping_jobs > 0 else 0
				failed_rate = metrics.failed_jobs * 2 if metrics.total_scraping_jobs > 0 else 0
				
				chart.data_points.append({
					'timestamp': timestamp_str,
					'Successful Jobs': successful_rate,
					'Failed Jobs': failed_rate
				})
			
			chart.last_updated = datetime.now(timezone.utc)
			
		except Exception as e:
			self.logger.error(f"Scraping performance chart update failed: {e}")
	
	async def _update_deployment_status_chart(self):
		"""Update deployment status pie chart"""
		
		try:
			chart = self.charts['deployment_status']
			
			if self.current_metrics:
				chart.data_points = [
					{'label': 'Active', 'value': self.current_metrics.active_deployments},
					{'label': 'Failed', 'value': self.current_metrics.failed_deployments},
					{'label': 'Idle', 'value': max(0, self.current_metrics.total_deployments - 
													  self.current_metrics.active_deployments - 
													  self.current_metrics.failed_deployments)}
				]
				
				chart.labels = ['Active', 'Failed', 'Idle']
			
			chart.last_updated = datetime.now(timezone.utc)
			
		except Exception as e:
			self.logger.error(f"Deployment status chart update failed: {e}")
	
	async def _update_response_times_chart(self):
		"""Update response times chart"""
		
		try:
			chart = self.charts['response_times']
			
			recent_metrics = list(self.metrics_history)[-40:]  # Last 40 points
			
			chart.data_points = []
			chart.labels = []
			
			for metrics in recent_metrics:
				timestamp_str = metrics.timestamp.strftime('%H:%M')
				chart.labels.append(timestamp_str)
				
				chart.data_points.append({
					'timestamp': timestamp_str,
					'Avg Response Time': metrics.avg_response_time_ms
				})
			
			chart.last_updated = datetime.now(timezone.utc)
			
		except Exception as e:
			self.logger.error(f"Response times chart update failed: {e}")
	
	async def _update_opportunities_chart(self):
		"""Update opportunities extracted chart"""
		
		try:
			chart = self.charts['opportunities_extracted']
			
			# Group metrics by hour for bar chart
			hourly_data = defaultdict(int)
			
			for metrics in list(self.metrics_history)[-100:]:  # Last 100 points
				hour_key = metrics.timestamp.strftime('%H:00')
				hourly_data[hour_key] += int(metrics.opportunities_per_hour)
			
			# Sort by hour
			sorted_hours = sorted(hourly_data.items())
			
			chart.data_points = []
			chart.labels = []
			
			for hour, count in sorted_hours[-12:]:  # Last 12 hours
				chart.labels.append(hour)
				chart.data_points.append({
					'hour': hour,
					'opportunities': count
				})
			
			chart.last_updated = datetime.now(timezone.utc)
			
		except Exception as e:
			self.logger.error(f"Opportunities chart update failed: {e}")
	
	async def _update_error_rate_gauge(self):
		"""Update error rate gauge"""
		
		try:
			chart = self.charts['error_rate']
			
			if self.current_metrics:
				chart.data_points = [{
					'value': self.current_metrics.error_rate_percent,
					'label': f"{self.current_metrics.error_rate_percent:.1f}%"
				}]
			
			chart.last_updated = datetime.now(timezone.utc)
			
		except Exception as e:
			self.logger.error(f"Error rate gauge update failed: {e}")
	
	async def _update_data_quality_chart(self):
		"""Update data quality chart"""
		
		try:
			chart = self.charts['data_quality']
			
			recent_metrics = list(self.metrics_history)[-30:]  # Last 30 points
			
			chart.data_points = []
			chart.labels = []
			
			for metrics in recent_metrics:
				timestamp_str = metrics.timestamp.strftime('%H:%M')
				chart.labels.append(timestamp_str)
				
				chart.data_points.append({
					'timestamp': timestamp_str,
					'Quality Score': metrics.data_quality_score
				})
			
			chart.last_updated = datetime.now(timezone.utc)
			
		except Exception as e:
			self.logger.error(f"Data quality chart update failed: {e}")
	
	async def _data_export_loop(self):
		"""Background loop for exporting dashboard data"""
		
		while self.is_running:
			try:
				# Export dashboard data periodically
				await self._export_dashboard_data()
				
				# Sleep for 10 minutes
				await asyncio.sleep(600)
				
			except asyncio.CancelledError:
				break
			except Exception as e:
				self.logger.error(f"Data export error: {e}")
				await asyncio.sleep(300)  # Wait 5 minutes on error
	
	async def _export_dashboard_data(self):
		"""Export dashboard data to files"""
		
		try:
			export_data = {
				'timestamp': datetime.now(timezone.utc).isoformat(),
				'current_metrics': self.current_metrics.dict() if self.current_metrics else None,
				'charts': {
					chart_id: {
						'title': chart.title,
						'chart_type': chart.chart_type,
						'data_points': chart.data_points,
						'labels': chart.labels,
						'last_updated': chart.last_updated.isoformat()
					}
					for chart_id, chart in self.charts.items()
				},
				'dashboard_stats': self.dashboard_stats.copy()
			}
			
			# Convert datetime objects to strings
			stats_copy = export_data['dashboard_stats']
			for key, value in stats_copy.items():
				if isinstance(value, datetime):
					stats_copy[key] = value.isoformat()
			
			# Export to JSON file
			export_file = self.dashboard_dir / f"dashboard_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
			
			with open(export_file, 'w') as f:
				json.dump(export_data, f, indent=2, default=str)
			
			# Keep only last 10 export files
			export_files = sorted(self.dashboard_dir.glob("dashboard_data_*.json"))
			for old_file in export_files[:-10]:
				old_file.unlink()
			
		except Exception as e:
			self.logger.error(f"Dashboard data export failed: {e}")
	
	def get_dashboard_data(self) -> Dict[str, Any]:
		"""Get current dashboard data for display"""
		
		try:
			dashboard_data = {
				'current_metrics': self.current_metrics.dict() if self.current_metrics else None,
				'charts': {
					chart_id: {
						'title': chart.title,
						'chart_type': chart.chart_type,
						'data_points': chart.data_points,
						'labels': chart.labels,
						'metadata': chart.metadata,
						'last_updated': chart.last_updated
					}
					for chart_id, chart in self.charts.items()
				},
				'dashboard_stats': self.dashboard_stats.copy(),
				'is_running': self.is_running,
				'config': self.config.dict()
			}
			
			# Add summary statistics
			if len(self.metrics_history) > 1:
				recent_metrics = list(self.metrics_history)[-10:]  # Last 10 points
				
				dashboard_data['summary_stats'] = {
					'avg_cpu_utilization': statistics.mean(m.system_cpu_percent for m in recent_metrics),
					'avg_memory_utilization': statistics.mean(m.system_memory_percent for m in recent_metrics),
					'avg_success_rate': statistics.mean(m.jobs_success_rate for m in recent_metrics),
					'total_opportunities_trend': [m.total_opportunities_extracted for m in recent_metrics],
					'error_rate_trend': [m.error_rate_percent for m in recent_metrics]
				}
			
			return dashboard_data
			
		except Exception as e:
			self.logger.error(f"Failed to get dashboard data: {e}")
			return {'error': str(e)}
	
	def get_real_time_metrics(self) -> Optional[DashboardMetrics]:
		"""Get current real-time metrics"""
		return self.current_metrics
	
	def get_historical_metrics(self, hours: int = 24) -> List[DashboardMetrics]:
		"""Get historical metrics for specified time period"""
		
		cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
		
		return [
			metrics for metrics in self.metrics_history
			if metrics.timestamp > cutoff_time
		]
	
	def get_performance_summary(self) -> Dict[str, Any]:
		"""Get performance summary"""
		
		try:
			if not self.current_metrics:
				return {'status': 'no_data'}
			
			m = self.current_metrics
			
			# Determine overall health
			health_score = 100
			health_factors = []
			
			# CPU health
			if m.system_cpu_percent > 90:
				health_score -= 20
				health_factors.append('High CPU usage')
			elif m.system_cpu_percent > 70:
				health_score -= 10
				health_factors.append('Elevated CPU usage')
			
			# Memory health  
			if m.system_memory_percent > 95:
				health_score -= 25
				health_factors.append('Critical memory usage')
			elif m.system_memory_percent > 80:
				health_score -= 15
				health_factors.append('High memory usage')
			
			# Success rate health
			if m.jobs_success_rate < 0.6:
				health_score -= 30
				health_factors.append('Low job success rate')
			elif m.jobs_success_rate < 0.8:
				health_score -= 15
				health_factors.append('Moderate job success rate')
			
			# Error rate health
			if m.error_rate_percent > 15:
				health_score -= 25
				health_factors.append('High error rate')
			elif m.error_rate_percent > 5:
				health_score -= 10
				health_factors.append('Elevated error rate')
			
			# Alert health
			if m.critical_alerts > 0:
				health_score -= 20
				health_factors.append(f'{m.critical_alerts} critical alerts')
			
			health_score = max(0, health_score)
			
			# Determine status
			if health_score >= 90:
				status = 'excellent'
			elif health_score >= 70:
				status = 'good'
			elif health_score >= 50:
				status = 'fair'
			else:
				status = 'poor'
			
			return {
				'status': status,
				'health_score': health_score,
				'health_factors': health_factors,
				'key_metrics': {
					'deployments_active': m.active_deployments,
					'success_rate': f"{m.jobs_success_rate:.1%}",
					'opportunities_per_hour': f"{m.opportunities_per_hour:.1f}",
					'avg_response_time': f"{m.avg_response_time_ms:.0f}ms",
					'data_quality': f"{m.data_quality_score:.1f}%"
				},
				'alerts': {
					'critical': m.critical_alerts,
					'warning': m.warning_alerts,
					'total': m.active_alerts
				}
			}
			
		except Exception as e:
			self.logger.error(f"Performance summary generation failed: {e}")
			return {'status': 'error', 'error': str(e)}
	
	async def cleanup(self):
		"""Clean up dashboard resources"""
		
		try:
			await self.stop_dashboard()
			self.logger.info("PerformanceDashboard cleanup completed")
		
		except Exception as e:
			self.logger.error(f"Cleanup failed: {e}")


# Factory function
def create_performance_dashboard(
	scraper_deployment: Optional[ScraperDeployment] = None,
	deployment_monitor: Optional[DeploymentMonitor] = None,
	global_db: Optional[GlobalSourceDB] = None,
	structure_learner: Optional[StructureLearner] = None,
	config: Optional[DashboardConfig] = None
) -> PerformanceDashboard:
	"""Create a PerformanceDashboard instance"""
	return PerformanceDashboard(
		scraper_deployment,
		deployment_monitor,
		global_db,
		structure_learner,
		config
	)